# ⚡ Guía: Notificaciones Web Push con Supabase ($0 de Coste)

Sí, **Supabase puede lograr exactamente el mismo resultado a coste $0** usando su plan gratuito.

## ¿Cómo funciona la arquitectura con Supabase?

1. **Base de Datos PostgreSQL (Gratis hasta 500 MB)**:
   - Almacena las suscripciones push (`endpoint`, `p256dh`, `auth`, `user_id`, `device_type`).
2. **Supabase Edge Functions (Deno - Gratis 50,000 invocaciones/mes)**:
   - Contiene la lógica para firmar criptográficamente las peticiones VAPID y enviar las notificaciones a los servidores push de Apple (APNs) y Google (FCM).
3. **Disparadores (Triggers / Webhooks)**:
   - Puedes configurar que cuando ocurra un evento en una tabla (ej: nuevo mensaje o alerta), Supabase dispare automáticamente la Edge Function para enviar la notificación push al iPhone del usuario.

---

## Paso a Paso para configurarlo en tu proyecto Supabase:

### Paso 1: Crear la tabla en Supabase
1. Ve al panel de control de Supabase > **SQL Editor**.
2. Copia y pega el contenido del archivo [`schema.sql`](./schema.sql).
3. Ejecuta el script ("Run").

### Paso 2: Generar claves VAPID
Puedes generar tus claves VAPID en Node.js ejecutando en este proyecto:
```bash
npx web-push generate-vapid-keys
```
Obtendrás una `Public Key` y una `Private Key`.

### Paso 3: Configurar Secretos en Supabase
En el dashboard de Supabase ve a **Project Settings** > **Edge Functions** > **Secrets** (o usa el CLI de Supabase) y agrega:
- `VAPID_PUBLIC_KEY`: Tu clave pública.
- `VAPID_PRIVATE_KEY`: Tu clave privada.
- `VAPID_SUBJECT`: `mailto:tu-correo@ejemplo.com`

### Paso 4: Desplegar la Edge Function
Usando el CLI de Supabase (`supabase functions deploy`):
```bash
supabase functions new send-push
# Copia el código de edge-function.ts en supabase/functions/send-push/index.ts
supabase functions deploy send-push
```

### Paso 5: Llamar a la función desde tu Frontend o Backend
Puedes invocar la función con una simple petición HTTP POST:
```javascript
const res = await fetch('https://TU-PROYECTO.supabase.co/functions/v1/send-push', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer TU_ANON_KEY'
  },
  body: JSON.stringify({
    title: '¡Aviso importante!',
    body: 'Notificación enviada desde Supabase',
    url: '/'
  })
});
```
