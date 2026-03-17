/* ============================================================
   SEWA BOT — Frontend JavaScript (app.js)
   Mode: Midtrans Payment Gateway
   ============================================================ */

// ===== CONFIG =====
const CONFIG = {
  backendUrl: 'https://web-production-9cea7.up.railway.app',
};

// ===== STATE =====
let selectedPackage = { id: null, price: null, label: null, display: null };

// ===== SELECT PACKAGE (dari card) =====
function selectPackage(btn) {
  const card = btn.closest('.package-card');
  selectedPackage = {
    id:      card.dataset.package,
    price:   card.dataset.price,
    label:   card.dataset.label,
    display: card.dataset.display,
  };
  openModal();
}

// ===== MODAL CONTROLS =====
function openModal() {
  const modal = document.getElementById('orderModal');
  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
  document.getElementById('spValue').textContent = selectedPackage.label || '—';

  document.querySelectorAll('input[name="paket"]').forEach(r => {
    if (r.value === selectedPackage.id) r.checked = true;
  });
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

document.getElementById('orderModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});
document.getElementById('successModal').addEventListener('click', function (e) {
  if (e.target === this) closeSuccessModal();
});

document.querySelectorAll('input[name="paket"]').forEach((radio) => {
  radio.addEventListener('change', function () {
    const card = document.querySelector(`.package-card[data-package="${this.value}"]`);
    selectedPackage = {
      id:      this.value,
      price:   this.dataset.price,
      label:   this.dataset.label,
      display: card ? card.dataset.display : '',
    };
    document.getElementById('spValue').textContent = selectedPackage.label;
  });
});

// ===== FORM SUBMIT → MIDTRANS =====
document.getElementById('orderForm').addEventListener('submit', async function (e) {
  e.preventDefault();

  const nama       = document.getElementById('nama').value.trim();
  const whatsapp   = document.getElementById('whatsapp').value.trim();
  const linkGroup  = document.getElementById('linkGroup').value.trim();
  const paketRadio = document.querySelector('input[name="paket"]:checked');

  if (!nama || !whatsapp || !linkGroup) {
    showToast('⚠️ Mohon isi semua field!', 'error'); return;
  }
  if (!paketRadio) {
    showToast('⚠️ Pilih salah satu paket!', 'error'); return;
  }
  if (!whatsapp.match(/^[0-9]{10,15}$/)) {
    showToast('⚠️ Format nomor WA tidak valid!', 'error'); return;
  }

  setPayButtonLoading(true);

  const orderData = {
    nama,
    whatsapp,
    linkGroup,
    paket: paketRadio.value,
    price: paketRadio.dataset.price,
    label: paketRadio.dataset.label,
  };

  try {
    const res = await fetch(`${CONFIG.backendUrl}/api/create-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderData),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Gagal membuat transaksi');
    }

    const { snapToken, orderId } = await res.json();

    window.snap.pay(snapToken, {
      onSuccess: async function (result) {
        await handlePaymentSuccess({ ...orderData, orderId, result });
      },
      onPending: function () {
        showToast('⏳ Menunggu pembayaran...', 'success');
        setPayButtonLoading(false);
      },
      onError: function () {
        showToast('❌ Pembayaran gagal, coba lagi!', 'error');
        setPayButtonLoading(false);
      },
      onClose: function () {
        showToast('ℹ️ Popup ditutup', '');
        setPayButtonLoading(false);
      },
    });

  } catch (error) {
    showToast(`❌ ${error.message}`, 'error');
    setPayButtonLoading(false);
  }
});

// ===== HANDLE PAYMENT SUCCESS =====
async function handlePaymentSuccess(orderData) {
  try {
    await fetch(`${CONFIG.backendUrl}/api/notify-owner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nama:      orderData.nama,
        whatsapp:  orderData.whatsapp,
        linkGroup: orderData.linkGroup,
        paket:     orderData.label,
        orderId:   orderData.orderId,
        status:    'LUNAS',
      }),
    });
  } catch (err) {
    // Fallback WA link
    const pesan =
      `🤖 *NOTIFIKASI SEWA BOT — LUNAS*\n\n` +
      `👤 *Nama     :* ${orderData.nama}\n` +
      `📱 *WA       :* ${orderData.whatsapp}\n` +
      `🔗 *Link GC  :* ${orderData.linkGroup}\n` +
      `📦 *Paket    :* ${orderData.label}\n` +
      `💰 *Status   :* ✅ LUNAS\n` +
      `🆔 *Order ID :* ${orderData.orderId}`;
    window.open(`https://wa.me/62895411165811?text=${encodeURIComponent(pesan)}`, '_blank');
  }

  closeModal();
  showSuccessModal(orderData);
  setPayButtonLoading(false);
}

// ===== SUCCESS MODAL =====
function showSuccessModal(data) {
  document.getElementById('successDetails').innerHTML = `
    <div class="detail-row">
      <span class="detail-label">👤 Nama</span>
      <span class="detail-value">${escapeHtml(data.nama)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">📱 Nomor WA</span>
      <span class="detail-value">${escapeHtml(data.whatsapp)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">📦 Paket</span>
      <span class="detail-value">${escapeHtml(data.label)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">💰 Status</span>
      <span class="detail-value lunas">✅ LUNAS</span>
    </div>`;

  document.querySelector('.success-note').textContent =
    '📱 Notifikasi sudah dikirim ke Owner. Bot akan segera diaktifkan di grupmu!';

  document.getElementById('successModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

// ===== LOADING STATE =====
function setPayButtonLoading(isLoading) {
  const btn     = document.getElementById('btnPay');
  const text    = document.getElementById('btnPayText');
  const loading = document.getElementById('btnPayLoading');
  btn.disabled          = isLoading;
  text.style.display    = isLoading ? 'none' : 'flex';
  loading.style.display = isLoading ? 'flex' : 'none';
}

// ===== TOAST =====
function showToast(message, type = '') {
  let toast = document.querySelector('.toast');
  if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.appendChild(toast); }
  toast.textContent = message;
  toast.className = `toast ${type}`;
  requestAnimationFrame(() => { toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3500); });
}

// ===== HELPER =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str || ''));
  return div.innerHTML;
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeModal(); closeSuccessModal(); }
});