# 🔔 Send Noti PWA - Web Push con Coste $0 (iOS & Android)

Aplicación Web Progresiva (PWA) completa, moderna y minimalista diseñada para instalarse en la pantalla de inicio de **iPhone (iOS 16.4+)**, **Android** y **Escritorio**, permitiendo recibir y emitir notificaciones push en tiempo real a **coste $0**.

---

## 📱 ¿Cómo funciona en iOS (iPhone / iPad)?

Desde **iOS 16.4**, Apple permite Notificaciones Web Push en Safari **únicamente si la web se instala como PWA en la pantalla de inicio**:

1. Abre la web en **Safari** en tu iPhone.
2. Toca el botón **Compartir** (icono de cuadrado con flecha hacia arriba `⎙` en la barra inferior).
3. Selecciona **"Añadir a pantalla de inicio"** (o *"Add to Home Screen"*).
4. Abre la aplicación desde el nuevo icono en la pantalla de inicio de tu iPhone.
5. Pulsa el botón **"🔔 Activar Notificaciones Push"** y autoriza los permisos.
6. ¡Listo! Ya puedes recibir notificaciones incluso con la app cerrada o el iPhone bloqueado.

---

## 💡 Comparativa de Proveedores Push a Coste $0

Una de las principales dudas es qué proveedor utilizar sin incurrir en costes o pagos mensuales:

| Proveedor | Coste | Límite de Envíos | Soporte iOS 16.4+ | ¿Recomendado? |
| :--- | :---: | :---: | :---: | :---: |
| **Web Push Nativo (VAPID / Este Proyecto)** | **$0.00 de por vida** | **Ilimitado** | **Nativo 100%** | **⭐⭐⭐⭐⭐ (Máximo)** |
| **Supabase (Postgres + Edge Functions)** | **$0.00 (Free Tier)** | 50,000 req/mes | **Nativo 100%** | **⭐⭐⭐⭐⭐ (Excelente)** |
| **Firebase Cloud Messaging (FCM)** | **$0.00 (Spark)** | Ilimitado | Compatible | ⭐⭐⭐ (Más complejo en iOS) |
| **OneSignal** | Freemium | Hasta 10,000 subs | Compatible | ⭐⭐⭐ (Límites comerciales) |
| **Cloudflare Workers + D1** | **$0.00 (Free Tier)** | 100,000 req/día | **Nativo 100%** | ⭐⭐⭐⭐ (Muy rápido) |

### 1. Web Push Nativo (VAPID) — *La mejor opción ($0 real)*
- **¿Por qué cuesta $0?** Porque Web Push es un estándar abierto de la W3C. Tu servidor se comunica directamente con los servidores push oficiales de los fabricantes (**Apple APNs** para iOS y **Google FCM** para Android/Chrome).
- **Sin intermediarios:** No pagas a nadie, no tienes cuotas ocultas y no requieres la cuenta de Apple Developer ($99/año) para enviar Web Push a PWAs en iOS.
- **Implementación:** Este repositorio ya incluye toda la lógica lista para usar con `web-push`.

### 2. Supabase — *¿Logra el mismo resultado?*
- **SÍ, exactamente el mismo resultado a coste $0.**
- En el plan gratuito de Supabase dispones de:
  - Base de datos PostgreSQL (500 MB) para almacenar las suscripciones.
  - Supabase Edge Functions (50,000 invocaciones gratis al mes) con Deno para disparar los envíos Web Push con tus llaves VAPID.
  - Triggers y Webhooks en la base de datos para enviar notificaciones automáticamente cuando se inserte un registro.
- *Revisa la carpeta [`supabase/`](./supabase/) en este repositorio con el SQL y la Edge Function lista para desplegar.*

### 3. Firebase (FCM)
- FCM es gratuito e ilimitado en el plan Spark.
- Sin embargo, en Safari iOS suele requerir configuraciones adicionales en el Service Worker de Firebase JS SDK y mayor peso de dependencias en comparación con el estándar VAPID directo.

---

## 🚀 Puesta en Marcha Rápida (Local)

### 1. Clonar el repositorio
```bash
git clone https://github.com/Letalandroid/send-noti-pwa.git
cd send-noti-pwa
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Iniciar el servidor
```bash
npm start
```
El servidor se iniciará en `http://localhost:3000`.

> **Nota sobre claves VAPID:** Si no tienes claves VAPID en un archivo `.env`, el servidor generará un par automáticamente la primera vez y las guardará en `data/vapid.json`.

---

## 📲 Probar en tu iPhone en red local o HTTPS

Apple exige HTTPS para que funcionen los Service Workers y las Notificaciones Push (excepto en `localhost`). Para probarlo directamente en tu iPhone:

### Opción A: Probar con un túnel HTTPS temporal (Ngrok / Cloudflare Tunnel)
```bash
# Con npx untun o localtunnel o ngrok:
npx localtunnel --port 3000
# O con cloudflared:
# cloudflared tunnel --url http://localhost:3000
```
Abre la URL `https://...` resultante en el Safari de tu iPhone, agrégala a la pantalla de inicio y ¡listo!

### Opción B: Despliegue en 1 clic a hosting gratuito ($0)
Puedes desplegar este backend y PWA de forma 100% gratuita en:
- **Render.com** (Web Service gratuito Node.js)
- **Railway.app**
- **Fly.io**
- **Vercel**

---

## 🛠️ Estructura del Proyecto

```
send-noti-pwa/
├── server.js               # Servidor Express, endpoints de suscripción y envío push
├── package.json
├── .env.example            # Ejemplo de variables de entorno
├── data/
│   ├── vapid.json          # Claves VAPID auto-generadas (o configuradas en .env)
│   └── subscriptions.json  # Base de datos persistente local de dispositivos
├── supabase/               # Guía e implementación para Supabase ($0)
│   ├── README.md           # Explicación paso a paso
│   ├── schema.sql          # Tabla y políticas RLS para PostgreSQL
│   └── edge-function.ts    # Edge Function (Deno) para enviar notificaciones
└── public/
    ├── index.html          # Interfaz de usuario (PWA para iOS y Android)
    ├── style.css           # Estilos inspirados en Apple iOS (modo oscuro limpio)
    ├── app.js              # Lógica de detección iOS, registro PWA y suscripción
    ├── sw.js               # Service Worker para recibir 'push' y manejar clics
    ├── manifest.json       # Web App Manifest configurado para standalone iOS
    └── icons/              # Iconos en alta resolución para PWA y Apple Touch
        ├── icon-192.png
        ├── icon-512.png
        ├── apple-touch-icon.png
        └── icon.svg
```

---

## 📡 Endpoints de la API

- `GET /api/vapid-public-key`: Retorna la clave pública VAPID para que el cliente se suscriba.
- `POST /api/subscribe`: Registra la suscripción push de un dispositivo.
- `POST /api/unsubscribe`: Elimina la suscripción de un dispositivo.
- `GET /api/stats`: Devuelve el número y lista de dispositivos suscritos.
- `POST /api/send`: Envía una notificación push a todos los dispositivos (o a uno específico).
  ```json
  {
    "title": "Aviso",
    "body": "Mensaje de prueba",
    "url": "/"
  }
  ```

---

## 📄 Licencia

MIT - Libre para uso personal o comercial con coste $0.
