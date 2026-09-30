// Send Noti PWA - Lógica del Cliente

// Estado global
let swRegistration = null;
let currentSubscription = null;
let vapidPublicKey = null;

// Elementos del DOM
const deviceBadge = document.getElementById('deviceBadge');
const iosGuideBanner = document.getElementById('iosGuideBanner');
const standaloneBanner = document.getElementById('standaloneBanner');
const permStatus = document.getElementById('permStatus');
const subStatus = document.getElementById('subStatus');
const subscribersCount = document.getElementById('subscribersCount');
const activeSubscribersBadge = document.getElementById('activeSubscribersBadge');
const btnSubscribe = document.getElementById('btnSubscribe');
const btnSendTestToMe = document.getElementById('btnSendTestToMe');
const btnSendTestDelayed = document.getElementById('btnSendTestDelayed');
const btnUnsubscribe = document.getElementById('btnUnsubscribe');
const countdownBanner = document.getElementById('countdownBanner');
const countdownText = document.getElementById('countdownText');
const subscriptionMessage = document.getElementById('subscriptionMessage');
const pushForm = document.getElementById('pushForm');
const sendFeedback = document.getElementById('sendFeedback');
const subscribersList = document.getElementById('subscribersList');
const btnRefreshSubs = document.getElementById('btnRefreshSubs');

// Elementos de depuración
const debugUserAgent = document.getElementById('debugUserAgent');
const debugStandalone = document.getElementById('debugStandalone');
const debugSW = document.getElementById('debugSW');
const debugPush = document.getElementById('debugPush');
const debugVapidKey = document.getElementById('debugVapidKey');

// Utilidad: Convertir clave VAPID Base64 a Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// 1. Detección de Plataforma y Modo PWA
function detectPlatform() {
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isAndroid = /Android/.test(ua);
  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

  let platformName = 'Escritorio / Web';
  if (isIOS) platformName = 'Apple iOS (iPhone/iPad)';
  else if (isAndroid) platformName = 'Android';

  deviceBadge.textContent = `${platformName} • ${isStandalone ? 'PWA Instalada' : 'Navegador'}`;

  // Depuración
  if (debugUserAgent) debugUserAgent.textContent = ua;
  if (debugStandalone) debugStandalone.textContent = isStandalone ? 'Sí (display: standalone)' : 'No (Pestaña navegador)';
  if (debugSW) debugSW.textContent = ('serviceWorker' in navigator) ? 'Disponible' : 'No soportado';
  if (debugPush) debugPush.textContent = ('PushManager' in window) ? 'Disponible' : 'No soportado';

  // Mostrar advertencia o éxito en iOS
  if (isIOS) {
    if (isStandalone) {
      iosGuideBanner.classList.add('hidden');
      standaloneBanner.classList.remove('hidden');
    } else {
      iosGuideBanner.classList.remove('hidden');
      standaloneBanner.classList.add('hidden');
    }
  } else {
    // Si no es iOS, ocultar el aviso estricto de iOS pero dejarlo discreto si se desea
    if (isStandalone) {
      iosGuideBanner.classList.add('hidden');
      standaloneBanner.classList.remove('hidden');
    } else {
      iosGuideBanner.classList.add('hidden');
    }
  }

  return { isIOS, isAndroid, isStandalone, platformName };
}

// 2. Inicializar Service Worker
async function initServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    showFeedback(subscriptionMessage, 'Tu navegador no soporta Service Workers.', 'error');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    console.log('✓ Service Worker registrado:', registration);
    swRegistration = registration;
    return registration;
  } catch (error) {
    console.error('Error registrando Service Worker:', error);
    showFeedback(subscriptionMessage, `Error al registrar Service Worker: ${error.message}`, 'error');
    return null;
  }
}

// 3. Obtener Clave VAPID del Servidor
async function fetchVapidKey() {
  try {
    const res = await fetch('/api/vapid-public-key');
    const data = await res.json();
    vapidPublicKey = data.publicKey;
    if (debugVapidKey) {
      debugVapidKey.textContent = vapidPublicKey;
    }
    return vapidPublicKey;
  } catch (e) {
    console.error('Error obteniendo clave VAPID:', e);
    return null;
  }
}

// 4. Actualizar Estado de la Suscripción en UI
async function updateSubscriptionStatus() {
  // Estado de permisos de notificación
  const perm = Notification.permission;
  permStatus.textContent = perm.toUpperCase();

  if (perm === 'granted') {
    permStatus.className = 'badge badge-success';
  } else if (perm === 'denied') {
    permStatus.className = 'badge badge-danger';
  } else {
    permStatus.className = 'badge badge-warning';
  }

  if (!swRegistration) {
    subStatus.textContent = 'SW no listo';
    subStatus.className = 'badge badge-default';
    return;
  }

  try {
    currentSubscription = await swRegistration.pushManager.getSubscription();

    if (currentSubscription) {
      subStatus.textContent = 'Activa ✓';
      subStatus.className = 'badge badge-success';
      btnSubscribe.classList.add('hidden');
      btnSendTestToMe.classList.remove('hidden');
      btnSendTestDelayed.classList.remove('hidden');
      btnUnsubscribe.classList.remove('hidden');
    } else {
      subStatus.textContent = 'No suscrito';
      subStatus.className = 'badge badge-warning';
      btnSubscribe.classList.remove('hidden');
      btnSendTestToMe.classList.add('hidden');
      btnSendTestDelayed.classList.add('hidden');
      btnUnsubscribe.classList.add('hidden');
    }
  } catch (err) {
    console.warn('Error verificando suscripción Push:', err);
    subStatus.textContent = 'No disponible';
    subStatus.className = 'badge badge-default';
  }
}

// 5. Suscribir este Dispositivo
async function subscribeUser() {
  const { isIOS, isStandalone, platformName } = detectPlatform();

  // En iOS, advertir si no está instalada
  if (isIOS && !isStandalone) {
    alert(
      '⚠️ Atención: En iPhone / iOS, Apple solo permite notificaciones push cuando añades la PWA a la pantalla de inicio.\n\nPor favor, pulsa Compartir > "Añadir a pantalla de inicio" primero.'
    );
  }

  if (!('PushManager' in window)) {
    showFeedback(
      subscriptionMessage,
      'PushManager no está disponible. En iOS, debes abrir la app desde el icono en la pantalla de inicio.',
      'error'
    );
    return;
  }

  try {
    btnSubscribe.disabled = true;
    btnSubscribe.textContent = 'Solicitando permiso...';

    // Pedir permiso explícito al usuario
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showFeedback(subscriptionMessage, 'Permiso de notificaciones denegado por el usuario.', 'error');
      updateSubscriptionStatus();
      btnSubscribe.disabled = false;
      btnSubscribe.innerHTML = '<span class="btn-icon">🔔</span> Activar Notificaciones Push';
      return;
    }

    if (!vapidPublicKey) {
      await fetchVapidKey();
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    btnSubscribe.textContent = 'Registrando dispositivo...';
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    currentSubscription = subscription;

    // Enviar suscripción al backend
    const res = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscription: subscription.toJSON(),
        deviceType: platformName,
        userAgent: navigator.userAgent
      })
    });

    const data = await res.json();
    if (data.success) {
      showFeedback(
        subscriptionMessage,
        '¡Listo! Dispositivo registrado correctamente. Ya puedes recibir notificaciones.',
        'success'
      );
      updateSubscriptionStatus();
      loadSubscribers();
    } else {
      showFeedback(subscriptionMessage, `Error del servidor: ${data.error}`, 'error');
    }
  } catch (error) {
    console.error('Error durante la suscripción:', error);
    showFeedback(
      subscriptionMessage,
      `Error al suscribir: ${error.message}. (Asegúrate de estar en HTTPS o localhost y haber añadido la app a inicio)`,
      'error'
    );
  } finally {
    btnSubscribe.disabled = false;
    btnSubscribe.innerHTML = '<span class="btn-icon">🔔</span> Activar Notificaciones Push';
  }
}

// 6. Desuscribir este Dispositivo
async function unsubscribeUser() {
  if (!currentSubscription) return;

  try {
    btnUnsubscribe.disabled = true;
    const endpoint = currentSubscription.endpoint;

    await currentSubscription.unsubscribe();
    currentSubscription = null;

    // Avisar al servidor
    await fetch('/api/unsubscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ endpoint })
    });

    showFeedback(subscriptionMessage, 'Notificaciones desactivadas para este dispositivo.', 'success');
    updateSubscriptionStatus();
    loadSubscribers();
  } catch (err) {
    console.error('Error al desuscribir:', err);
    showFeedback(subscriptionMessage, `Error al desuscribir: ${err.message}`, 'error');
  } finally {
    btnUnsubscribe.disabled = false;
  }
}

// 7. Enviar notificación de prueba a mi propio dispositivo
async function sendTestToMe() {
  try {
    btnSendTestToMe.disabled = true;
    btnSendTestToMe.textContent = 'Enviando...';

    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: '¡Notificación en tu iPhone/Dispositivo!',
        body: 'Esta notificación push se envió exitosamente usando Web Push VAPID a coste $0 🚀',
        url: '/'
      })
    });

    const data = await res.json();
    if (data.success) {
      showFeedback(subscriptionMessage, `✓ Notificación disparada. Deberías verla en tu pantalla en breve.`, 'success');
    } else {
      showFeedback(subscriptionMessage, `No se pudo enviar: ${data.message}`, 'error');
    }
  } catch (e) {
    showFeedback(subscriptionMessage, `Error de red: ${e.message}`, 'error');
  } finally {
    btnSendTestToMe.disabled = false;
    btnSendTestToMe.innerHTML = '<span class="btn-icon">⚡</span> Enviarme Notificación Inmediata';
  }
}

// 7.1. Enviar notificación con retardo para probar con la app cerrada
async function sendTestDelayed() {
  try {
    btnSendTestDelayed.disabled = true;
    countdownBanner.classList.remove('hidden');

    const res = await fetch('/api/send-delayed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delaySeconds: 10,
        title: '¡App Cerrada! 📲',
        body: 'Esta notificación llegó mientras tenías la app cerrada o el iPhone bloqueado.',
        url: '/'
      })
    });

    const data = await res.json();
    if (!data.success) {
      showFeedback(subscriptionMessage, `Error: ${data.message}`, 'error');
      countdownBanner.classList.add('hidden');
      btnSendTestDelayed.disabled = false;
      return;
    }

    let timeLeft = 10;
    countdownText.textContent = `Tienes ${timeLeft} segundos: Sal a la pantalla de inicio y bloquea tu iPhone ahora...`;

    const timer = setInterval(() => {
      timeLeft--;
      if (timeLeft > 0) {
        countdownText.textContent = `Tienes ${timeLeft} segundos: Sal a la pantalla de inicio y bloquea tu iPhone ahora...`;
      } else {
        clearInterval(timer);
        countdownText.textContent = '¡Notificación enviada! Revisa la pantalla de tu iPhone.';
        setTimeout(() => {
          countdownBanner.classList.add('hidden');
          btnSendTestDelayed.disabled = false;
        }, 5000);
      }
    }, 1000);
  } catch (e) {
    showFeedback(subscriptionMessage, `Error al programar: ${e.message}`, 'error');
    countdownBanner.classList.add('hidden');
    btnSendTestDelayed.disabled = false;
  }
}

// 8. Cargar lista de suscriptores
async function loadSubscribers() {
  try {
    const res = await fetch('/api/stats');
    const data = await res.json();

    const count = data.subscribersCount || 0;
    subscribersCount.textContent = count;
    activeSubscribersBadge.textContent = `${count} ${count === 1 ? 'dispositivo' : 'dispositivos'}`;

    if (!data.subscribers || data.subscribers.length === 0) {
      subscribersList.innerHTML = '<p class="empty-state">No hay dispositivos registrados aún.</p>';
      return;
    }

    subscribersList.innerHTML = data.subscribers
      .map(
        (sub, index) => `
      <div class="sub-item">
        <div class="sub-info">
          <span class="sub-device">#${index + 1} ${escapeHtml(sub.deviceType || 'Dispositivo')}</span>
          <span class="sub-date">Servidor push: ${escapeHtml(sub.endpointDomain)} • ${new Date(sub.createdAt).toLocaleTimeString()}</span>
        </div>
        <span class="badge badge-success">Activo</span>
      </div>
    `
      )
      .join('');
  } catch (e) {
    console.error('Error cargando estadísticas:', e);
  }
}

// 9. Enviar Notificación de Difusión (Formulario)
async function handleSendBroadcast(e) {
  e.preventDefault();

  const title = document.getElementById('notiTitle').value.trim();
  const body = document.getElementById('notiBody').value.trim();
  const url = document.getElementById('notiUrl').value.trim() || '/';
  const btnBroadcast = document.getElementById('btnBroadcast');

  if (!title || !body) return;

  try {
    btnBroadcast.disabled = true;
    btnBroadcast.innerHTML = '<span class="btn-icon">⏳</span> Enviando a dispositivos...';

    const res = await fetch('/api/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url })
    });

    const data = await res.json();
    if (data.success) {
      showFeedback(
        sendFeedback,
        `✓ ${data.message}`,
        'success'
      );
      loadSubscribers();
    } else {
      showFeedback(sendFeedback, `Aviso: ${data.message}`, 'error');
    }
  } catch (err) {
    showFeedback(sendFeedback, `Error al enviar: ${err.message}`, 'error');
  } finally {
    btnBroadcast.disabled = false;
    btnBroadcast.innerHTML = '<span class="btn-icon">🚀</span> Enviar Notificación a Todos';
  }
}

// Utilidad para escapar HTML
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Utilidad para mensajes visuales
function showFeedback(element, message, type) {
  if (!element) return;
  element.textContent = message;
  element.className = `feedback-msg show ${type}`;
  setTimeout(() => {
    element.classList.remove('show');
  }, 7000);
}

// Control de Pestañas
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-tab');

      tabButtons.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((c) => c.classList.remove('active'));

      btn.classList.add('active');
      const targetContent = document.getElementById(targetId);
      if (targetContent) {
        targetContent.classList.add('active');
      }

      if (targetId === 'tab-send') {
        loadSubscribers();
      }
    });
  });
}

// Control de Conexión Online/Offline
function initNetworkListeners() {
  const netStatus = document.getElementById('netStatus');
  const updateNet = () => {
    if (navigator.onLine) {
      netStatus.textContent = 'En línea';
      netStatus.className = 'status-indicator online';
    } else {
      netStatus.textContent = 'Sin conexión';
      netStatus.className = 'status-indicator offline';
    }
  };
  window.addEventListener('online', updateNet);
  window.addEventListener('offline', updateNet);
  updateNet();
}

// Inicialización de la Aplicación
async function initApp() {
  detectPlatform();
  initTabs();
  initNetworkListeners();

  await initServiceWorker();
  await fetchVapidKey();
  await updateSubscriptionStatus();
  await loadSubscribers();

  // Listeners de botones
  btnSubscribe.addEventListener('click', subscribeUser);
  btnUnsubscribe.addEventListener('click', unsubscribeUser);
  btnSendTestToMe.addEventListener('click', sendTestToMe);
  btnSendTestDelayed.addEventListener('click', sendTestDelayed);
  pushForm.addEventListener('submit', handleSendBroadcast);
  if (btnRefreshSubs) {
    btnRefreshSubs.addEventListener('click', loadSubscribers);
  }
}

// Iniciar cuando el DOM esté listo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
