import localtunnel from 'localtunnel';
import qrcode from 'qrcode-terminal';
import dotenv from 'dotenv';

dotenv.config();

const PORT = parseInt(process.env.PORT, 10) || 3000;

console.log(`\n======================================================`);
console.log(`⏳ Iniciando túnel HTTPS seguro para iOS en el puerto ${PORT}...`);

try {
  const tunnel = await localtunnel({ port: PORT });

  console.log(`\n✅ ¡Túnel HTTPS Activo!`);
  console.log(`🌐 URL para tu iPhone: ${tunnel.url}`);
  console.log(`\n📲 Escanea este código QR con la cámara de tu iPhone:`);
  qrcode.generate(tunnel.url, { small: true }, (qr) => console.log(qr));
  console.log(`\n📋 Pasos en tu iPhone:`);
  console.log(`   1. Abre la URL en Safari`);
  console.log(`   2. Toca Compartir > "Añadir a pantalla de inicio"`);
  console.log(`   3. Abre la app desde la pantalla de inicio y activa Notificaciones`);
  console.log(`======================================================\n`);

  tunnel.on('close', () => {
    console.log('Túnel cerrado');
  });

  tunnel.on('error', (err) => {
    console.error('Error en el túnel:', err);
  });
} catch (error) {
  console.error('Error al iniciar el túnel:', error);
}
