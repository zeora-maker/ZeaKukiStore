# 🤖 SewaBot — Website Rental Bot WhatsApp

Website sewa bot WhatsApp dengan integrasi **Midtrans Snap** untuk pembayaran dan **Fonnte** untuk notifikasi WhatsApp otomatis ke owner.

---

## 📁 Struktur File

```
sewa-bot/
├── index.html        → Halaman utama website
├── style.css         → Styling (tema Mint Green + Pink Pastel)
├── app.js            → JavaScript frontend (modal, form, Midtrans Snap)
├── server.js         → Backend Node.js + Express
├── package.json      → Dependencies Node.js
├── .env.example      → Template konfigurasi environment
└── README.md         → Panduan ini
```

---

## 🚀 Cara Menjalankan

### 1. Install Dependencies
```bash
npm install
```

### 2. Setup Environment
```bash
cp .env.example .env
# Buka .env dan isi semua konfigurasi
```

### 3. Isi Konfigurasi di `.env`

| Variable | Keterangan |
|---|---|
| `MIDTRANS_SERVER_KEY` | Server Key dari dashboard Midtrans |
| `MIDTRANS_CLIENT_KEY` | Client Key dari dashboard Midtrans |
| `FONNTE_TOKEN` | Token API dari fonnte.com |
| `OWNER_WA_NUMBER` | Nomor WA Owner dalam format `628XXXXXXXXXX` |
| `PORT` | Port server (default: 3000) |
| `FRONTEND_URL` | URL frontend untuk CORS |

### 4. Update Client Key di `index.html`
```html
<!-- Baris ~13 di index.html -->
<script src="https://app.sandbox.midtrans.com/snap/snap.js"
        data-client-key="ISI_CLIENT_KEY_KAMU_DISINI">
```
> Untuk production, ganti URL ke: `https://app.midtrans.com/snap/snap.js`

### 5. Jalankan Server
```bash
# Development (auto-restart)
npm run dev

# Production
npm start
```

### 6. Buka Website
Buka file `index.html` di browser, atau gunakan [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) di VS Code.

---

## ⚙️ Konfigurasi Midtrans Webhook

Agar notifikasi server-side berfungsi saat pembayaran berhasil:

1. Masuk ke [Dashboard Midtrans](https://dashboard.midtrans.com)
2. Buka **Settings > Payment Notification URL**
3. Isi dengan: `https://domainmu.com/api/midtrans-webhook`
4. Aktifkan juga **Finish/Error/Unfinish Redirect URL** jika dibutuhkan

> Gunakan [ngrok](https://ngrok.com) untuk testing webhook di lokal:
> ```bash
> ngrok http 3000
> # Lalu copy URL ngrok ke Midtrans notification URL
> ```

---

## 📱 Alur Pembayaran

```
User pilih paket
    ↓
Isi form (Nama, WA, Link GC)
    ↓
POST /api/create-transaction → Midtrans buat Snap Token
    ↓
Popup Midtrans terbuka (QRIS, Transfer, dll)
    ↓
Pembayaran sukses
    ↓
POST /api/notify-owner → Fonnte kirim WA ke Owner (Zea)
    ↓ (juga via Webhook server-side)
Midtrans POST /api/midtrans-webhook → Konfirmasi ulang
    ↓
Zea terima notifikasi → Manual addsewa ke bot
```

---

## 🛠 Troubleshooting

**CORS Error?**
- Pastikan `FRONTEND_URL` di `.env` sesuai dengan URL tempat kamu membuka `index.html`

**Midtrans Popup tidak muncul?**
- Pastikan `data-client-key` di `index.html` sudah diisi dengan benar
- Cek console browser untuk error

**Fonnte gagal kirim?**
- Verifikasi token di `https://fonnte.com`
- Pastikan nomor owner sudah benar formatnya: `628XXXXXXXXXX`
- Website akan fallback ke WA link jika Fonnte gagal

---

## 📦 Dependency

| Package | Kegunaan |
|---|---|
| `express` | Web framework Node.js |
| `midtrans-client` | Midtrans official library |
| `axios` | HTTP request ke Fonnte API |
| `cors` | Mengizinkan request dari frontend |
| `body-parser` | Parse request body JSON |
| `dotenv` | Load environment variables |
| `nodemon` | Auto-restart server (dev) |

---

Made with 💚 & 🩷 for SewaBot
