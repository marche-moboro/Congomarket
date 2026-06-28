// ==================== CART.JS ====================

let cart = [];

// ================================================================
// Charger panier depuis localStorage
// ✅ CORRECTION : JSON.parse dans try/catch — évite crash si corrompu
// ================================================================
function loadCart(sellerId) {
  const key = 'cart_' + sellerId;
  try {
    cart = JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    console.warn('Panier corrompu, réinitialisation:', e);
    cart = [];
  }
  updateCartUI();
}

// Sauvegarder panier
function saveCart() {
  if (!window.currentViewedSeller) return;
  const key = 'cart_' + window.currentViewedSeller.id;
  localStorage.setItem(key, JSON.stringify(cart));
}

// ================================================================
// Ajouter au panier
// ================================================================
function addToCart(productId, name, price) {
  const existing = cart.find(item => item.id === productId);

  if (existing) {
    showConfirmDialog(
      `"${name}" est déjà dans votre panier. Voulez-vous l'ajouter à nouveau ?`,
      () => {
        existing.quantity += 1;
        saveCart();
        updateCartUI();
        showToast(name + ' ajouté (' + existing.quantity + '×)', 'success');
      }
    );
    return;
  }

  cart.push({ id: productId, name, price, quantity: 1 });
  saveCart();
  updateCartUI();
  showToast(name + ' ajouté au panier', 'success');
}

// ================================================================
// Supprimer du panier
// ================================================================
function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  updateCartUI();
  renderCartModal();
}

// ================================================================
// Mettre à jour UI panier
// ================================================================
function updateCartUI() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotalPreview');
  if (countEl) countEl.innerText = count;
  if (totalEl) totalEl.innerText = formatPrice(total) + ' FCFA';
}

// ================================================================
// Ouvrir / fermer modal panier
// ================================================================
function openCart() {
  if (cart.length === 0) {
    showToast('Votre panier est vide', 'info');
    return;
  }
  renderCartModal();
  document.getElementById('cartModal').style.display = 'flex';
}

function closeCart() {
  document.getElementById('cartModal').style.display = 'none';
}

// ================================================================
// Afficher contenu panier
// ✅ CORRECTION : escapeHtml sur item.name
// ================================================================
function renderCartModal() {
  const itemsEl = document.getElementById('cartItems');
  const totalEl = document.getElementById('totalPrice');
  let total = 0;

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p style="text-align:center;padding:20px;">🛒 Panier vide</p>';
    totalEl.innerText = '0';
    return;
  }

  itemsEl.innerHTML = cart.map((item, i) => {
    const subtotal = item.price * item.quantity;
    total += subtotal;
    return `
      <div class="cart-item">
        <div class="cart-item-info">
          <strong>${escapeHtml(item.name)}</strong>
          <span>${item.quantity} × ${formatPrice(item.price)} FCFA</span>
          <span class="cart-subtotal">${formatPrice(subtotal)} FCFA</span>
        </div>
        <button class="remove-btn" onclick="removeFromCart(${i})">✕</button>
      </div>
    `;
  }).join('');

  totalEl.innerText = formatPrice(total);
}

// ================================================================
// Confirmer commande
// ================================================================
async function confirmOrder() {
  const name     = document.getElementById('clientName').value.trim();
  const phone    = document.getElementById('clientPhone').value.trim();
  const quartier = document.getElementById('clientQuartier').value.trim();
  const address  = document.getElementById('clientAddress').value.trim();

  if (!name || !phone || !quartier || !address) {
    showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  if (phone.length < 9) {
    showToast('Numéro de téléphone invalide', 'error');
    return;
  }

  const seller = window.currentViewedSeller;
  if (!seller) return;

  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Enregistrer commande en base AVANT d'ouvrir WhatsApp
  try {
    const { error } = await db.from(TABLES.ORDERS).insert({
      seller_id:       seller.id,
      client_name:     name,
      client_phone:    phone,
      client_quartier: quartier,
      client_address:  address,
      items:           cart,
      total:           total,
      created_at:      new Date().toISOString()
    });

    if (error) {
      console.error('confirmOrder insert error:', JSON.stringify(error));
      showToast('Erreur enregistrement commande', 'error');
      return;
    }

  } catch (e) {
    console.error('confirmOrder exception:', e);
    showToast('Erreur réseau. Réessayez.', 'error');
    return;
  }

  // Message WhatsApp
  let message = `COMMANDE CLIENT 🛒%0A%0A`;
  message += `Client: ${name}%0A`;
  message += `Téléphone: ${phone}%0A`;
  message += `Quartier: ${quartier}%0A`;
  message += `Adresse: ${address}%0A%0A`;
  message += `Produits:%0A`;

  cart.forEach(item => {
    message += `• ${item.name} × ${item.quantity} = ${formatPrice(item.price * item.quantity)} FCFA%0A`;
  });

  message += `%0ATOTAL: ${formatPrice(total)} FCFA`;

  // Ouvrir WhatsApp vendeur
  window.open(`https://wa.me/${seller.phone}?text=${message}`, '_blank');

  showToast('Commande envoyée !', 'success');

  // Reset panier
  cart = [];
  saveCart();
  updateCartUI();
  closeCart();

  ['clientName', 'clientPhone', 'clientQuartier', 'clientAddress'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ================================================================
// Fermer modals en cliquant dehors
// ================================================================
window.addEventListener('click', (e) => {
  const modal = document.getElementById('cartModal');
  if (e.target === modal) closeCart();

  const confirmDialog = document.getElementById('confirmDialog');
  if (e.target === confirmDialog) confirmDialog.style.display = 'none';
});
