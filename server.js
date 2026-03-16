/* ============================================================
   SEWA BOT — Backend Server (server.js)
   Stack : Node.js + Express
   Payment: Midtrans Snap API
   Notify : Fonnte API (WhatsApp) + WA link fallback
   ============================================================ */

const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const midtrans   = require('midtrans-client');
const axios      = require('axios');
const crypto     = require('crypto');
require('dotenv').config();

const app = express();

// ============================================================
// ⚙️  KONFIGURASI — Ganti sesuai akun kamu
// ============================================================
const CONFIG = {
  // --- Midtrans ---
  midtrans: {
    isProduction: true,
    serverKey:    process.env.MIDTRANS_SERVER_KEY || 'Mid-server-PpBByhM_xT1FqcBYTQv5LVZo',
    clientKey:    process.env.MIDTRANS_CLIENT_KEY || 'Mid-client-ViEFiK8-otK5Dkhm',
  },
  fonnte: {
    token:       process.env.FONNTE_TOKEN || 'dkzUaExZzH2sUicLTsn8544NcJCTrpReAjkSbqJYmAfKd',
    ownerNumber: process.env.OWNER_WA_NUMBER || '62895411165811',
  },
  // --- Server ---
  port: process.env.PORT || 3000,
};
// ============================================================

// Verifikasi key yang aktif dipakai
console.log('=== CEK KEY ===');
console.log('SERVER KEY:', CONFIG.midtrans.serverKey);
console.log('===============');

// ===== MIDDLEWARE =====
// Izinkan semua origin Live Server (localhost & 127.0.0.1, semua port)
app.use(cors({
  origin: function (origin, callback) {
    // Izinkan request tanpa origin (Postman, curl) dan semua localhost/127.0.0.1
    if (!origin || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // Izinkan juga jika cocok dengan FRONTEND_URL di .env
    if (origin === process.env.FRONTEND_URL) {
      return callback(null, true);
    }
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(bodyParser.json());
app.use(express.static('.')); // sajikan file frontend

// ===== MIDTRANS SNAP CLIENT =====
const snap = new midtrans.Snap({
  isProduction: CONFIG.midtrans.isProduction,
  serverKey:    CONFIG.midtrans.serverKey,
  clientKey:    CONFIG.midtrans.clientKey,
});

// ===== PAKET PRICE MAP (validasi server-side) =====
const PAKET_MAP = {
  '30': { price: 15000, label: 'Starter — 30 Hari' },
  '60': { price: 25000, label: 'Pro — 60 Hari'     },
  '90': { price: 40000, label: 'Ultimate — 90 Hari' },
};

/* ============================================================
   POST /api/create-transaction
   Body: { nama, whatsapp, linkGroup, paket }
   Returns: { snapToken, orderId }
   ============================================================ */
app.post('/api/create-transaction', async (req, res) => {
  const { nama, whatsapp, linkGroup, paket } = req.body;

  // Validasi input
  if (!nama || !whatsapp || !linkGroup || !paket) {
    return res.status(400).json({ message: 'Semua field wajib diisi.' });
  }
  const paketInfo = PAKET_MAP[String(paket)];
  if (!paketInfo) {
    return res.status(400).json({ message: 'Paket tidak valid.' });
  }

  // Generate unique order ID
  const orderId = `SEWABOT-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

  const parameter = {
    transaction_details: {
      order_id:     orderId,
      gross_amount: paketInfo.price,
    },
    item_details: [
      {
        id:       `BOT-${paket}D`,
        price:    paketInfo.price,
        quantity: 1,
        name:     `Sewa Bot WA — ${paketInfo.label}`,
      },
    ],
    customer_details: {
      first_name: nama,
      phone:      whatsapp,
      // Simpan data tambahan di metadata
    },
    // Custom field untuk menyimpan data order
    custom_field1: whatsapp,
    custom_field2: linkGroup,
    custom_field3: paket,
  };

  try {
    const transaction = await snap.createTransaction(parameter);
    console.log(`✅ Transaksi dibuat: ${orderId} — ${paketInfo.label}`);

    res.json({
      snapToken: transaction.token,
      orderId,
    });
  } catch (error) {
    console.error('❌ Midtrans error:', error.message);
    res.status(500).json({ message: 'Gagal membuat transaksi Midtrans.', detail: error.message });
  }
});

/* ============================================================
   POST /api/notify-owner
   Body: { nama, whatsapp, linkGroup, paket, orderId, status }
   Kirim notifikasi WA ke Owner (Zea) via Fonnte
   ============================================================ */
app.post('/api/notify-owner', async (req, res) => {
  const { nama, whatsapp, linkGroup, paket, orderId, status } = req.body;

  const pesan =
    `🤖 *NOTIFIKASI SEWA BOT*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Nama Penyewa :* ${nama}\n` +
    `📱 *Nomor WA     :* ${whatsapp}\n` +
    `🔗 *Link GC      :* ${linkGroup}\n` +
    `📦 *Paket        :* ${paket}\n` +
    `💰 *Status       :* ✅ ${status || 'LUNAS'}\n` +
    `🆔 *Order ID     :* ${orderId}\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `Silakan aktifkan bot di grup tersebut. 🙏`;

  try {
    // Kirim via Fonnte WhatsApp API
    const fonnteRes = await axios.post(
      'https://api.fonnte.com/send',
      {
        target:  CONFIG.fonnte.ownerNumber,
        message: pesan,
      },
      {
        headers: {
          Authorization: CONFIG.fonnte.token,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log(`📱 Notifikasi WA terkirim ke Owner:`, fonnteRes.data);
    res.json({ success: true, message: 'Notifikasi berhasil dikirim.' });
  } catch (error) {
    console.error('❌ Fonnte error:', error.message);
    // Jangan fail total — biarkan frontend handle fallback
    res.status(500).json({ success: false, message: 'Gagal kirim notifikasi WA.' });
  }
});

/* ============================================================
   POST /api/midtrans-webhook
   Midtrans akan memanggil endpoint ini saat status berubah
   (Aktifkan di dashboard Midtrans > Settings > Payment Notification URL)
   ============================================================ */
app.post('/api/midtrans-webhook', async (req, res) => {
  const notif = req.body;

  // Verifikasi signature key
  const signatureInput = notif.order_id + notif.status_code + notif.gross_amount + CONFIG.midtrans.serverKey;
  const expectedSignature = crypto.createHash('sha512').update(signatureInput).digest('hex');

  if (notif.signature_key !== expectedSignature) {
    console.warn('⚠️ Midtrans webhook: signature tidak valid!');
    return res.status(401).json({ message: 'Invalid signature' });
  }

  const { order_id, transaction_status, custom_field1, custom_field2, custom_field3 } = notif;

  // Hanya proses jika sudah settled / capture
  if (transaction_status === 'settlement' || transaction_status === 'capture') {
    console.log(`✅ Pembayaran LUNAS: ${order_id}`);

    const paketInfo = PAKET_MAP[String(custom_field3)] || { label: `${custom_field3} Hari` };

    // Kirim notifikasi WA ke Owner
    const pesan =
      `🤖 *[WEBHOOK] PEMBAYARAN BERHASIL*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `📱 *Nomor WA  :* ${custom_field1 || '-'}\n` +
      `🔗 *Link GC   :* ${custom_field2 || '-'}\n` +
      `📦 *Paket     :* ${paketInfo.label}\n` +
      `💰 *Status    :* ✅ LUNAS (${transaction_status})\n` +
      `🆔 *Order ID  :* ${order_id}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Harap segera aktifkan bot! 🙏`;

    try {
      await axios.post(
        'https://api.fonnte.com/send',
        { target: CONFIG.fonnte.ownerNumber, message: pesan },
        { headers: { Authorization: CONFIG.fonnte.token, 'Content-Type': 'application/json' } }
      );
      console.log('📱 Notifikasi webhook WA terkirim.');
    } catch (err) {
      console.error('❌ Gagal kirim notifikasi webhook:', err.message);
    }
  }

  res.status(200).json({ message: 'OK' });
});

/* ============================================================
   GET /api/check-transaction/:orderId
   Cek status transaksi dari frontend
   ============================================================ */
app.get('/api/check-transaction/:orderId', async (req, res) => {
  try {
    const status = await snap.transaction.status(req.params.orderId);
    res.json(status);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ===== START SERVER =====
app.listen(CONFIG.port, () => {
  console.log(`\n🚀 SewaBot Server berjalan di: http://localhost:${CONFIG.port}`);
  console.log(`📦 Mode Midtrans: ${CONFIG.midtrans.isProduction ? '🔴 PRODUCTION' : '🟡 SANDBOX'}`);
  console.log(`📱 Owner WA    : ${CONFIG.fonnte.ownerNumber}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}); 
