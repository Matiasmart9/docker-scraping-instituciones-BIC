const express = require('express');
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const qrcode = require('qrcode-terminal');

const app = express();
app.use(express.json());
let sock;
let latestQr = null;

async function connectWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState('./auth_info');
  sock = makeWASocket({ 
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true
  });
  
  sock.ev.on('creds.update', saveCreds);
  
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('Escaneá este QR con tu celular (WhatsApp vinculado):');
      latestQr = qr;
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      console.log('Conexión cerrada. Reconectando...');
      latestQr = null;
      connectWhatsApp();
    } else if (connection === 'open') {
      console.log('WhatsApp conectado con éxito!');
      latestQr = null;
    }
  });
}
connectWhatsApp();

app.post('/send', async (req, res) => {
  const { telefonos, mensaje } = req.body;
  if (!telefonos || !mensaje) {
    return res.status(400).json({ ok: false, error: 'Faltan telefonos o mensaje' });
  }

  try {
    for (const tel of telefonos) {
      const jid = `${tel.replace('+', '')}@s.whatsapp.net`;
      await sock.sendMessage(jid, { text: mensaje });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/status', (req, res) => {
  // If sock has user property and there's no active QR waiting to be scanned, it's connected
  const isConnected = !!(sock && sock.user && !latestQr);
  res.json({ conectado: isConnected });
});

app.get('/qr', (req, res) => {
  if (latestQr) {
    res.send(`
      <html>
        <head><title>Vincular WhatsApp</title></head>
        <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h2>Escanea el código QR con WhatsApp</h2>
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(latestQr)}" />
          <p>El código se actualiza automáticamente.</p>
          <script>
            setTimeout(() => location.reload(), 10000); // Recarga cada 10 segundos
          </script>
        </body>
      </html>
    `);
  } else {
    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; margin-top: 50px;">
          <h2>No hay QR disponible</h2>
          <p>Es posible que WhatsApp ya esté conectado o el servidor esté inicializando.</p>
          <button onclick="location.reload()">Refrescar</button>
        </body>
      </html>
    `);
  }
});

app.listen(8002, () => console.log('WhatsApp service en :8002'));
