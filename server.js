import express from 'express';
import webpush from 'web-push';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Archivo para persistir claves VAPID y suscripciones
const DATA_DIR = path.join(__dirname, 'data');
const VAPID_FILE = path.join(DATA_DIR, 'vapid.json');
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 1. Obtener o generar claves VAPID
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  if (fs.existsSync(VAPID_FILE)) {
    try {
      vapidKeys = JSON.parse(fs.readFileSync(VAPID_FILE, 'utf-8'));
      console.log('✓ Claves VAPID cargadas desde data/vapid.json');
    } catch (e) {
      console.error('Error leyendo vapid.json, se generarán nuevas claves');
    }
  }

  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    const generated = webpush.generateVAPIDKeys();
    vapidKeys = {
      publicKey: generated.publicKey,
      privateKey: generated.privateKey
    };
    fs.writeFileSync(VAPID_FILE, JSON.stringify(vapidKeys, null, 2));
    console.log('✓ Nuevas claves VAPID generadas y guardadas en data/vapid.json');
  }
}

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:contacto@sendnotipwa.local';
webpush.setVapidDetails(VAPID_SUBJECT, vapidKeys.publicKey, vapidKeys.privateKey);

// 2. Cargar suscripciones guardadas
let subscriptions = [];
function loadSubscriptions() {
  if (fs.existsSync(SUBS_FILE)) {
    try {
      subscriptions = JSON.parse(fs.readFileSync(SUBS_FILE, 'utf-8'));
    } catch (e) {
      subscriptions = [];
    }
  }
}
function saveSubscriptions() {
  fs.writeFileSync(SUBS_FILE, JSON.stringify(subscriptions, null, 2));
}
loadSubscriptions();

// --- RUTAS DE LA API ---

// Devolver la clave pública VAPID al cliente
app.get('/api/vapid-public-key', (req, res) => {
  res.json({
    publicKey: vapidKeys.publicKey
  });
});

// Guardar nueva suscripción de dispositivo
app.post('/api/subscribe', (req, res) => {
  const { subscription, deviceType, userAgent } = req.body;

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: 'Suscripción inválida' });
  }

  // Comprobar si ya existe el endpoint
  const existingIndex = subscriptions.findIndex((sub) => sub.endpoint === subscription.endpoint);

  const subData = {
    ...subscription,
    deviceType: deviceType || 'Desconocido',
    userAgent: userAgent || '',
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    subscriptions[existingIndex] = {
      ...subscriptions[existingIndex],
      ...subData
    };
  } else {
    subscriptions.push({
      id: 'sub_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      createdAt: new Date().toISOString(),
      ...subData
    });
  }

  saveSubscriptions();
  console.log(`[Push] Nuevo dispositivo suscrito (${subData.deviceType}). Total: ${subscriptions.length}`);

  res.status(201).json({
    success: true,
    message: 'Dispositivo suscrito exitosamente a notificaciones push',
    totalSubscribers: subscriptions.length
  });
});

// Desuscribir dispositivo
app.post('/api/unsubscribe', (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) {
    return res.status(400).json({ error: 'Endpoint requerido' });
  }

  const initialCount = subscriptions.length;
  subscriptions = subscriptions.filter((sub) => sub.endpoint !== endpoint);
  saveSubscriptions();

  res.json({
    success: true,
    removed: initialCount - subscriptions.length,
    totalSubscribers: subscriptions.length
  });
});

// Obtener estadísticas y lista de suscriptores
app.get('/api/stats', (req, res) => {
  const sanitizedSubs = subscriptions.map((s) => ({
    id: s.id,
    deviceType: s.deviceType,
    createdAt: s.createdAt,
    endpointDomain: new URL(s.endpoint).hostname
  }));

  res.json({
    subscribersCount: subscriptions.length,
    subscribers: sanitizedSubs,
    vapidSubject: VAPID_SUBJECT,
    serverTime: new Date().toISOString()
  });
});

// Función interna para despachar notificaciones a los dispositivos
async function dispatchPushNotifications(targets, payload) {
  if (!targets || targets.length === 0) {
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  const expiredEndpoints = [];

  const sendPromises = targets.map(async (sub) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: sub.keys
        },
        payload
      );
      sent++;
    } catch (err) {
      failed++;
      console.error(`Error enviando a ${sub.endpoint.slice(0, 35)}...:`, err.statusCode || err.message);
      if (err.statusCode === 410 || err.statusCode === 404) {
        expiredEndpoints.push(sub.endpoint);
      }
    }
  });

  await Promise.all(sendPromises);

  if (expiredEndpoints.length > 0) {
    subscriptions = subscriptions.filter((s) => !expiredEndpoints.includes(s.endpoint));
    saveSubscriptions();
    console.log(`[Push] Se eliminaron ${expiredEndpoints.length} suscripciones expiradas`);
  }

  return { sent, failed, totalActive: subscriptions.length };
}

// Enviar notificación push inmediata
app.post('/api/send', async (req, res) => {
  const { title, body, url, targetId } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Título y mensaje son obligatorios' });
  }

  const payload = JSON.stringify({
    title: title.trim(),
    body: body.trim(),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: url ? url.trim() : '/'
  });

  let targets = subscriptions;
  if (targetId) {
    targets = subscriptions.filter((s) => s.id === targetId);
  }

  if (targets.length === 0) {
    return res.status(200).json({
      success: false,
      message: 'No hay dispositivos suscritos para enviar notificaciones',
      sent: 0,
      failed: 0
    });
  }

  const result = await dispatchPushNotifications(targets, payload);

  res.json({
    success: true,
    message: `Notificación enviada a ${result.sent} dispositivo(s). Fallidos: ${result.failed}`,
    sent: result.sent,
    failed: result.failed,
    totalActive: result.totalActive
  });
});

// Enviar notificación con RETARDO (ideal para probar cuando la app está CERRADA en iPhone)
app.post('/api/send-delayed', (req, res) => {
  const { title, body, url, targetId, delaySeconds = 10 } = req.body;

  if (!title || !body) {
    return res.status(400).json({ error: 'Título y mensaje son obligatorios' });
  }

  const waitTime = Math.min(Math.max(Number(delaySeconds) || 10, 3), 60);

  const payload = JSON.stringify({
    title: title.trim(),
    body: body.trim(),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: url ? url.trim() : '/'
  });

  let targets = subscriptions;
  if (targetId) {
    targets = subscriptions.filter((s) => s.id === targetId);
  }

  if (targets.length === 0) {
    return res.status(200).json({
      success: false,
      message: 'No hay dispositivos suscritos para programar la notificación'
    });
  }

  // Responder inmediatamente al cliente para que pueda cerrar la app o bloquear el teléfono
  res.json({
    success: true,
    message: `Notificación programada. Se enviará en ${waitTime} segundos. ¡Cierra la app o bloquea tu teléfono ahora para comprobarlo!`,
    delaySeconds: waitTime
  });

  // Ejecutar el envío en segundo plano tras el retardo
  setTimeout(async () => {
    console.log(`[Push Retardado] Disparando notificación tras ${waitTime}s de espera...`);
    // Recargar o usar targets activos
    const currentTargets = targetId
      ? subscriptions.filter((s) => s.id === targetId)
      : subscriptions;

    await dispatchPushNotifications(currentTargets, payload);
  }, waitTime * 1000);
});

// Disparador rápido por GET (útil para pruebas desde terminal o navegador)
app.get('/api/send-quick', async (req, res) => {
  const title = req.query.title || 'Notificación Push Rápida';
  const body = req.query.body || 'Esta notificación llega incluso con la app cerrada';
  const url = req.query.url || '/';

  const payload = JSON.stringify({
    title,
    body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url
  });

  const result = await dispatchPushNotifications(subscriptions, payload);
  res.json({
    success: true,
    message: `Enviado a ${result.sent} dispositivos (Fallidos: ${result.failed})`,
    result
  });
});

// Reiniciar todas las suscripciones (útil para pruebas)
app.delete('/api/subscriptions', (req, res) => {
  subscriptions = [];
  saveSubscriptions();
  res.json({ success: true, message: 'Todas las suscripciones han sido reiniciadas' });
});

// Fallback a index.html para PWA SPA
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`===============================================`);
  console.log(`🚀 Servidor Send Noti PWA corriendo en:`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Clave Pública VAPID:`);
  console.log(`   ${vapidKeys.publicKey}`);
  console.log(`===============================================`);
});
