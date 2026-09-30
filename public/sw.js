// Service Worker para Send Noti PWA
const CACHE_NAME = 'send-noti-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png'
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de caches viejas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepción básica para soporte offline
self.addEventListener('fetch', (event) => {
  // Ignorar llamadas a la API
  if (event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).catch(() => caches.match('/'));
    })
  );
});

// MANEJO DE EVENTO PUSH (Segundo plano: App cerrada o en reposo)
self.addEventListener('push', (event) => {
  let data = {
    title: 'Notificación PWA',
    body: 'Has recibido un nuevo mensaje con la app cerrada',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    url: '/'
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const notificationOptions = {
    body: data.body,
    icon: data.icon || '/icons/icon-192.png',
    badge: data.badge || '/icons/icon-192.png',
    data: {
      url: data.url || '/'
    },
    vibrate: [200, 100, 200],
    tag: data.tag || 'general-notification',
    renotify: true
  };

  // Mantener el worker despierto hasta que el sistema operativo registre la notificación y el badge
  const promises = [
    self.registration.showNotification(data.title, notificationOptions)
  ];

  if ('setAppBadge' in self.navigator) {
    promises.push(self.navigator.setAppBadge(1).catch(() => {}));
  }

  // Notificar a las ventanas abiertas para actualizar el historial dentro de la PWA
  promises.push(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      clients.forEach((client) => {
        client.postMessage({
          type: 'PUSH_RECEIVED',
          payload: {
            title: data.title,
            body: data.body,
            url: data.url,
            receivedAt: new Date().toISOString()
          }
        });
      });
    })
  );

  event.waitUntil(Promise.all(promises));
});

// MANEJO DEL CLIC EN LA NOTIFICACIÓN
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // Limpiar el badge numérico del icono de la app
  if ('clearAppBadge' in self.navigator) {
    self.navigator.clearAppBadge().catch(() => {});
  }

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Si la app ya está abierta, hacerle focus
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (targetUrl && client.url !== targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      // Si la app está cerrada, abrir una nueva ventana
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
