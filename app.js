/* ============================================================
   SEWA BOT — Frontend JavaScript (app.js)
   Handles: Modal, Form, Midtrans Snap, WA Notification
   ============================================================ */

// ===== CONFIG (sesuaikan jika perlu) =====
const CONFIG = {
  backendUrl: 'https://sewa-bot-production.up.railway.app',
};

// ===== STATE =====
let selectedPackage = { days: null, price: null, label: null };

// ===== SELECT PACKAGE (dari card) =====
function selectPackage(btn) {
  const card = btn.closest('.package-card');
  selectedPackage = {
    days:  card.dataset.package,
    price: card.dataset.price,
    label: card.dataset.label,
  };
  openModal();
}

// ===== MODAL CONTROLS =====
function openModal() {
  const modal = document.getElementById('orderModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Update info paket terpilih
  document.getElementById('spValue').textContent = selectedPackage.label || '—';

  // Pre-select radio sesuai paket yang dipilih
  if (selectedPackage.days) {
    const radio = document.querySelector(`input[name="paket"][value="${selectedPackage.days}"]`);
    if (radio) radio.checked = true;
  }
}

function closeModal() {
  document.getElementById('orderModal').classList.remove('active');
  document.body.style.overflow = '';
}

function closeSuccessModal() {
  document.getElementById('successModal').classList.remove('active');
  document.body.style.overflow = '';
  document.getElementById('orderForm').reset();
}

// Tutup modal saat klik overlay
document.getElementById('orderModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
document.getElementById('successModal').addEventListener('click', function (e) {
  if (e.target === this) closeSuccessModal();
});

// Update selectedPackage saat radio berubah
document.querySelectorAll('input[name="paket"]').forEach((radio) => {
  radio.addEventListener('change', function () {
    selectedPackage = {
      days:  this.value,
      price: this.dataset.price,
      label: this.dataset.label,
    };
    document.getElementById('spValue').textContent = selectedPackage.label;
  });
});

// ===== FORM SUBMIT =====
document.getElementById('orderForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const nama       = document.getElementById('nama').value.trim();
  const whatsapp   = document.getElementById('whatsapp').value.trim();
  const linkGroup  = document.getElementById('linkGroup').value.trim();
  const paketRadio = document.querySelector('input[name="paket"]:checked');

  // Validasi
  if (!nama || !whatsapp || !linkGroup) {
    showToast('⚠️ Mohon isi semua field!', 'error');
    return;
  }
  if (!paketRadio) {
    showToast('⚠️ Pilih salah satu paket!', 'error');
    return;
  }
  if (!whatsapp.match(/^[0-9]{10,15}$/)) {
    showToast('⚠️ Format nomor WA tidak valid!', 'error');
    return;
  }
  if (!linkGroup.includes('chat.whatsapp.com') && !linkGroup.startsWith('https://')) {
    showToast('⚠️ Masukkan link grup WA yang valid!', 'error');
    return;
  }

  // Set loading
  setPayButtonLoading(true);

  const orderData = {
    nama,
    whatsapp,
    linkGroup,
    paket:    paketRadio.value,
    price:    paketRadio.dataset.price,
    label:    paketRadio.dataset.label,
  };

  try {
    // 1. Buat transaksi ke backend
    const res = await fetch(`${CONFIG.backendUrl}/api/create-transaction`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(orderData),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal membuat transaksi');
    }

    const { snapToken, orderId } = await res.json();

    // 2. Buka Midtrans Snap popup
    window.snap.pay(snapToken, {
      onSuccess: async function (result) {
        console.log('Payment success:', result);
        await handlePaymentSuccess({ ...orderData, orderId, result });
      },
      onPending: function (result) {
        showToast('⏳ Menunggu pembayaran...', 'success');
        setPayButtonLoading(false);
      },
      onError: function (result) {
        showToast('❌ Pembayaran gagal, coba lagi!', 'error');
        setPayButtonLoading(false);
      },
      onClose: function () {
        showToast('ℹ️ Popup ditutup', '');
        setPayButtonLoading(false);
      },
    });

  } catch (error) {
    console.error('Error:', error);
    showToast(`❌ ${error.message}`, 'error');
    setPayButtonLoading(false);
  }
});

// ===== HANDLE PAYMENT SUCCESS =====
async function handlePaymentSuccess(orderData) {
  try {
    // 3. Kirim notifikasi ke backend → WhatsApp Owner
    await fetch(`${CONFIG.backendUrl}/api/notify-owner`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        nama:       orderData.nama,
        whatsapp:   orderData.whatsapp,
        linkGroup:  orderData.linkGroup,
        paket:      orderData.label,
        orderId:    orderData.orderId,
        status:     'LUNAS',
      }),
    });
  } catch (err) {
    console.warn('Notifikasi WA gagal, fallback ke WA link:', err);
    // Fallback: buka WA link jika API gagal
    openWhatsAppFallback(orderData);
  }

  // Tampilkan success modal
  closeModal();
  showSuccessModal(orderData);
  setPayButtonLoading(false);
}

// ===== FALLBACK: Buka WhatsApp dengan pesan siap kirim =====
function openWhatsAppFallback(orderData) {
  const ownerNumber = '628XXXXXXXXXX'; // Ganti dengan nomor WA Owner (Zea)
  const pesan = `🤖 *NOTIFIKASI SEWA BOT — LUNAS*\n\n` +
    `👤 *Nama Penyewa :* ${orderData.nama}\n` +
    `📱 *Nomor WA     :* ${orderData.whatsapp}\n` +
    `🔗 *Link GC      :* ${orderData.linkGroup}\n` +
    `📦 *Paket        :* ${orderData.label}\n` +
    `💰 *Status       :* ✅ LUNAS\n` +
    `🆔 *Order ID     :* ${orderData.orderId}\n\n` +
    `Mohon segera aktifkan bot di grup tersebut. Terima kasih! 🙏`;

  const waUrl = `https://wa.me/${ownerNumber}?text=${encodeURIComponent(pesan)}`;
  window.open(waUrl, '_blank');
}

// ===== SUCCESS MODAL =====
function showSuccessModal(orderData) {
  const details = document.getElementById('successDetails');
  details.innerHTML = `
    <div class="detail-row">
      <span class="detail-label">👤 Nama</span>
      <span class="detail-value">${escapeHtml(orderData.nama)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">📱 Nomor WA</span>
      <span class="detail-value">${escapeHtml(orderData.whatsapp)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">📦 Paket</span>
      <span class="detail-value">${escapeHtml(orderData.label)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">💰 Status</span>
      <span class="detail-value lunas">✅ LUNAS</span>
    </div>
  `;

  const successModal = document.getElementById('successModal');
  successModal.classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ===== LOADING STATE =====
function setPayButtonLoading(isLoading) {
  const btn     = document.getElementById('btnPay');
  const text    = document.getElementById('btnPayText');
  const loading = document.getElementById('btnPayLoading');

  btn.disabled      = isLoading;
  text.style.display    = isLoading ? 'none' : 'flex';
  loading.style.display = isLoading ? 'flex' : 'none';
}

// ===== TOAST NOTIFICATION =====
function showToast(message, type = '') {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className   = `toast ${type}`;

  // Trigger animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
  });
}

// ===== HELPER: Escape HTML =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ===== KEYBOARD: ESC to close =====
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
    closeSuccessModal();
  }
});