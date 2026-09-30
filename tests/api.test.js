process.env.NODE_ENV = 'test';
import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { app } from '../server.js';

let server;
let baseUrl;

before(async () => {
  // Iniciar servidor en puerto efímero (0)
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

after(async () => {
  // Limpiar suscripciones de prueba y cerrar servidor
  try {
    await fetch(`${baseUrl}/api/subscriptions`, { method: 'DELETE' });
  } catch (e) {}
  if (server) {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise((resolve) => server.close(resolve));
  }
});

describe('1. Verificación de VAPID y Estado del Servidor', () => {
  test('GET /api/vapid-public-key debe retornar la clave pública VAPID válida', async () => {
    const res = await fetch(`${baseUrl}/api/vapid-public-key`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.ok(data.publicKey, 'Debe incluir publicKey');
    assert.ok(data.publicKey.length > 30, 'La clave pública debe tener longitud suficiente');
  });

  test('GET /api/stats debe retornar estadísticas iniciales', async () => {
    const res = await fetch(`${baseUrl}/api/stats`);
    assert.strictEqual(res.status, 200);

    const data = await res.json();
    assert.strictEqual(typeof data.subscribersCount, 'number');
    assert.ok(Array.isArray(data.subscribers));
    assert.ok(data.vapidSubject);
  });
});

describe('2. Gestión de Suscripciones Push', () => {
  const mockEndpoint = 'https://web.push.apple.com/test-iphone-token-123';
  const mockSubscription = {
    subscription: {
      endpoint: mockEndpoint,
      keys: {
        p256dh: 'BNcRdreALRF8FsE-Ginkg1Z5-test-key-p256dh',
        auth: 'test-auth-secret-123'
      }
    },
    deviceType: 'iPhone 15 Pro (iOS)',
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X)'
  };

  test('POST /api/subscribe debe rechazar cargas inválidas', async () => {
    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(res.status, 400);
  });

  test('POST /api/subscribe debe registrar un nuevo dispositivo exitosamente', async () => {
    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockSubscription)
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.totalSubscribers >= 1);
  });

  test('POST /api/subscribe debe ser idempotente al registrar el mismo dispositivo', async () => {
    const statsBefore = await (await fetch(`${baseUrl}/api/stats`)).json();

    // Registrar nuevamente el mismo endpoint
    const res = await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...mockSubscription,
        deviceType: 'iPhone 15 Pro Actualizado'
      })
    });

    assert.strictEqual(res.status, 201);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.totalSubscribers, statsBefore.subscribersCount, 'No debe incrementar el conteo total si el endpoint ya existe');
  });

  test('POST /api/unsubscribe debe desuscribir un dispositivo registrado', async () => {
    const res = await fetch(`${baseUrl}/api/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint: mockEndpoint })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.removed, 1);
  });
});

describe('3. Endpoints de Envío de Notificaciones Push', () => {
  test('POST /api/send debe validar título y cuerpo requeridos', async () => {
    const res = await fetch(`${baseUrl}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '' })
    });
    assert.strictEqual(res.status, 400);
  });

  test('POST /api/send debe responder limpiamente cuando no hay suscriptores', async () => {
    // Asegurar que no hay suscriptores
    await fetch(`${baseUrl}/api/subscriptions`, { method: 'DELETE' });

    const res = await fetch(`${baseUrl}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Prueba',
        body: 'Mensaje de prueba',
        url: '/'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.sent, 0);
  });

  test('POST /api/send-delayed debe programar el envío con retardo', async () => {
    // Primero agregar un dispositivo
    await fetch(`${baseUrl}/api/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: {
          endpoint: 'https://web.push.apple.com/test-delayed-device',
          keys: { p256dh: 'mock-key', auth: 'mock-auth' }
        },
        deviceType: 'iPhone Test'
      })
    });

    const res = await fetch(`${baseUrl}/api/send-delayed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Alerta App Cerrada',
        body: 'Este mensaje llega con la app cerrada',
        delaySeconds: 3
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.ok(data.delaySeconds >= 3);
  });

  test('GET /api/send-quick debe permitir disparar notificaciones por webhook/URL', async () => {
    const res = await fetch(`${baseUrl}/api/send-quick?title=AlertaRapida&body=HolaMundo`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
  });
});

describe('4. Archivos Estáticos y Recursos PWA para iOS/Android', () => {
  test('GET / debe entregar la página principal HTML', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Send Noti PWA'));
    assert.ok(text.includes('apple-mobile-web-app-capable'));
  });

  test('GET /manifest.json debe entregar el manifiesto PWA con modo standalone', async () => {
    const res = await fetch(`${baseUrl}/manifest.json`);
    assert.strictEqual(res.status, 200);
    const manifest = await res.json();
    assert.strictEqual(manifest.display, 'standalone');
    assert.ok(manifest.icons.length > 0);
  });

  test('GET /sw.js debe entregar el Service Worker con handlers push y notificationclick', async () => {
    const res = await fetch(`${baseUrl}/sw.js`);
    assert.strictEqual(res.status, 200);
    const code = await res.text();
    assert.ok(code.includes("addEventListener('push'"));
    assert.ok(code.includes("addEventListener('notificationclick'"));
    assert.ok(code.includes('setAppBadge'));
  });

  test('GET /icons/icon-192.png y /icons/apple-touch-icon.png deben existir', async () => {
    const res192 = await fetch(`${baseUrl}/icons/icon-192.png`);
    assert.strictEqual(res192.status, 200);

    const resTouch = await fetch(`${baseUrl}/icons/apple-touch-icon.png`);
    assert.strictEqual(resTouch.status, 200);
  });

  test('Rutas desconocidas deben hacer fallback a index.html (SPA)', async () => {
    const res = await fetch(`${baseUrl}/ruta-desconocida-de-prueba`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('Send Noti PWA'));
  });
});
