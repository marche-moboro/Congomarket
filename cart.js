// ==================== CART.JS — Panier multi-vendeurs ====================

let cart = [];

// ================================================================
// Charger le panier global (tous vendeurs confondus)
// ================================================================
function loadCart() {
  try {
    cart = JSON.parse(localStorage.getItem('cart_global')) || [];
  } catch (e) {
    console.warn('Panier corrompu, réinitialisation:', e);
    cart = [];
  }
  updateCartUI();
}

function saveCart() {
  localStorage.setItem('cart_global', JSON.stringify(cart));
}

// ================================================================
// Ajouter au panier — simplifié : incrémente silencieusement
// product = {id, name, price} / seller = {id, full_name, phone, account_type}
// ================================================================
function addToCartQuick(product, seller) {
  if (!product || !seller || !seller.id) {
    showToast('Erreur : boutique introuvable', 'error');
    return;
  }
  const key = product.id + '_' + seller.id;
  const existing = cart.find(item => item._key === key);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({
      _key: key,
      id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      sellerId: seller.id,
      sellerName: seller.full_name || 'Vendeur',
      sellerPhone: seller.phone || '',
      sellerAccountType: seller.account_type || ''
    });
  }
  saveCart();
  updateCartUI();
  showToast((product.name || 'Produit') + ' ajouté au panier 🛒', 'success');
}

// Compat avec d'anciens boutons data-id/data-name/data-price liés à une seule boutique
function addToCartFromBtn(btn) {
  const seller = window.currentViewedSeller;
  if (!seller) { showToast('Erreur : boutique introuvable', 'error'); return; }
  addToCartQuick(
    { id: btn.dataset.id, name: btn.dataset.name, price: Number(btn.dataset.price) },
    seller
  );
}

// ================================================================
// Supprimer un article
// ================================================================
function removeFromCart(index) {
  cart.splice(index, 1);
  saveCart();
  updateCartUI();
  renderCartModal();
}

// ================================================================
// Mettre à jour la barre panier flottante (persiste sur toutes les pages)
// ================================================================
function updateCartUI() {
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const countEl = document.getElementById('cartCount');
  const totalEl = document.getElementById('cartTotalPreview');
  if (countEl) countEl.innerText = count;
  if (totalEl) totalEl.innerText = formatPrice(total) + ' FCFA';

  const bar = document.getElementById('cartBar');
  if (bar) bar.style.display = count > 0 ? 'flex' : 'none';

  const lbBadge = document.getElementById('lbCartBadge');
  if (lbBadge) {
    if (count > 0) {
      lbBadge.innerText = count;
      lbBadge.style.display = 'flex';
    } else {
      lbBadge.style.display = 'none';
    }
  }
}

// ================================================================
// Ouvrir / fermer le panier
// ================================================================
function openCart() {
  if (cart.length === 0) {
    showToast('Votre panier est vide', 'info');
    return;
  }
  renderCartModal();
  prefillClientInfo();
  document.getElementById('cartModal').style.display = 'flex';
}

function closeCart() {
  document.getElementById('cartModal').style.display = 'none';
}

// ================================================================
// Infos de livraison client — mémorisées après la 1ère commande
// ================================================================
function prefillClientInfo() {
  try {
    const saved = JSON.parse(localStorage.getItem('moboro_client_info') || 'null');
    if (saved) {
      document.getElementById('clientName').value     = saved.name     || '';
      document.getElementById('clientPhone').value    = saved.phone    || '';
      document.getElementById('clientQuartier').value = saved.quartier || '';
      document.getElementById('clientAddress').value  = saved.address  || '';
    }
  } catch (e) {}
}

function getClientInfoFromForm() {
  const name     = document.getElementById('clientName').value.trim();
  const phone    = document.getElementById('clientPhone').value.trim();
  const quartier = document.getElementById('clientQuartier').value.trim();
  const address  = document.getElementById('clientAddress').value.trim();

  if (!name || !phone || !quartier || !address) {
    showToast('Veuillez remplir vos informations de livraison', 'error');
    return null;
  }
  if (phone.length < 9) {
    showToast('Numéro de téléphone invalide', 'error');
    return null;
  }
  localStorage.setItem('moboro_client_info', JSON.stringify({ name, phone, quartier, address }));
  return { name, phone, quartier, address };
}

// ================================================================
// Afficher le panier — groupé par boutique, un bouton Commander par groupe
// ================================================================
function renderCartModal() {
  const itemsEl = document.getElementById('cartItems');
  const totalEl = document.getElementById('totalPrice');

  if (cart.length === 0) {
    itemsEl.innerHTML = '<p style="text-align:center;padding:20px;">🛒 Panier vide</p>';
    totalEl.innerText = '0';
    return;
  }

  const groups = [];
  const groupMap = {};
  cart.forEach((item, i) => {
    if (!groupMap[item.sellerId]) {
      groupMap[item.sellerId] = { sellerId: item.sellerId, sellerName: item.sellerName, items: [] };
      groups.push(groupMap[item.sellerId]);
    }
    groupMap[item.sellerId].items.push({ ...item, _index: i });
  });

  let grandTotal = 0;

  itemsEl.innerHTML = groups.map(g => {
    let subTotal = 0;
    const rows = g.items.map(item => {
      const lineTotal = item.price * item.quantity;
      subTotal += lineTotal;
      return `
        <div class="cart-item">
          <div class="cart-item-info">
            <strong>${escapeHtml(item.name)}</strong>
            <span>${item.quantity} × ${formatPrice(item.price)} FCFA</span>
            <span class="cart-subtotal">${formatPrice(lineTotal)} FCFA</span>
          </div>
          <button class="remove-btn" onclick="removeFromCart(${item._index})">✕</button>
        </div>
      `;
    }).join('');
    grandTotal += subTotal;

    return `
      <div class="cart-seller-group" style="margin-bottom:16px;border:1px solid #eee;border-radius:12px;padding:10px;">
        <div style="font-weight:700;font-size:13px;margin-bottom:6px;">🏪 Boutique ${escapeHtml(g.sellerName)}</div>
        ${rows}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <strong style="font-size:13px;color:#1677FF;">${formatPrice(subTotal)} FCFA</strong>
          <button class="command-btn" style="width:auto;padding:8px 18px;font-size:13px;margin:0;"
            onclick="confirmOrderForSeller('${g.sellerId}')">
            🛍️ Commander
          </button>
        </div>
      </div>
    `;
  }).join('');

  totalEl.innerText = formatPrice(grandTotal);
}

// ================================================================
// Valider la commande pour UNE boutique (une partie du panier)
// → enregistre la commande + notifie le vendeur + ouvre WhatsApp
// ================================================================
async function confirmOrderForSeller(sellerId) {
  const info = getClientInfoFromForm();
  if (!info) return;

  const items = cart.filter(item => item.sellerId === sellerId);
  if (items.length === 0) return;

  const sellerPhone = items[0].sellerPhone;
  const sellerName  = items[0].sellerName;
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  try {
    const { error } = await db.from(TABLES.ORDERS).insert({
      seller_id:       sellerId,
      client_name:     info.name,
      client_phone:    info.phone,
      client_quartier: info.quartier,
      client_address:  info.address,
      items:           items.map(it => ({ id: it.id, name: it.name, price: it.price, quantity: it.quantity })),
      total:           total,
      status:          'en_preparation',
      created_at:      new Date().toISOString()
    });

    if (error) {
      console.error('confirmOrderForSeller insert error:', JSON.stringify(error));
      showToast('Erreur enregistrement commande', 'error');
      return;
    }

    fetch(`${SUPABASE_URL}/functions/v1/send-order-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({
        seller_id: sellerId,
        title: '🛒 Nouvelle commande !',
        body: `${info.name} vient de passer une commande de ${total.toLocaleString()} FC.`,
        url: '/Congomarket/'
      })
    }).catch(e => console.error('send-order-push error:', e));
  } catch (e) {
    console.error('confirmOrderForSeller exception:', e);
    showToast('Erreur réseau. Réessayez.', 'error');
    return;
  }

  let message = `COMMANDE CLIENT 🛒%0A%0A`;
  message += `Client: ${info.name}%0A`;
  message += `Téléphone: ${info.phone}%0A`;
  message += `Quartier: ${info.quartier}%0A`;
  message += `Adresse: ${info.address}%0A%0A`;
  message += `Produits:%0A`;
  items.forEach(item => {
    message += `• ${item.name} × ${item.quantity} = ${formatPrice(item.price * item.quantity)} FCFA%0A`;
  });
  message += `%0ATOTAL: ${formatPrice(total)} FCFA`;

  window.open(`https://wa.me/${formatWhatsApp(sellerPhone)}?text=${message}`, '_blank');
  showToast(`Commande envoyée à ${sellerName} !`, 'success');

  cart = cart.filter(item => item.sellerId !== sellerId);
  saveCart();
  updateCartUI();

  if (cart.length === 0) {
    closeCart();
  } else {
    renderCartModal();
  }
}

// ================================================================
// "Commander" dans le zoom → ferme le zoom, ouvre la page "Ma commande"
// ================================================================
function quickOrderProduct(product, seller) {
  if (typeof closeLightbox === 'function') closeLightbox();
  openQuickOrderPage(product, seller);
}

let _quickOrderProduct = null;
let _quickOrderSeller  = null;
let _quickOrderQty     = 1;

function openQuickOrderPage(product, seller) {
  _quickOrderProduct = product;
  _quickOrderSeller  = seller;
  _quickOrderQty     = 1;

  document.getElementById('quickOrderImg').src           = product.image || '';
  document.getElementById('quickOrderName').innerText     = product.name;
  document.getElementById('quickOrderSeller').innerText   = '🏪 Boutique ' + (seller.full_name || '');
  document.getElementById('quickOrderUnitPrice').innerText = formatPrice(product.price) + ' FCFA / unité';
  document.getElementById('quickOrderQty').innerText      = _quickOrderQty;
  document.getElementById('quickOrderTotal').innerText    = formatPrice(product.price * _quickOrderQty);

  prefillQuickOrderClientInfo();
  showPage('quickOrderPage');
}

function changeQuickOrderQty(delta) {
  _quickOrderQty = Math.max(1, _quickOrderQty + delta);
  document.getElementById('quickOrderQty').innerText   = _quickOrderQty;
  document.getElementById('quickOrderTotal').innerText = formatPrice(_quickOrderProduct.price * _quickOrderQty);
}

function prefillQuickOrderClientInfo() {
  try {
    const saved = JSON.parse(localStorage.getItem('moboro_client_info') || 'null');
    if (saved) {
      document.getElementById('quickOrderClientName').value     = saved.name     || '';
      document.getElementById('quickOrderClientPhone').value    = saved.phone    || '';
      document.getElementById('quickOrderClientQuartier').value = saved.quartier || '';
      document.getElementById('quickOrderClientAddress').value  = saved.address  || '';
    }
  } catch (e) {}
}

async function submitQuickOrder() {
  const name     = document.getElementById('quickOrderClientName').value.trim();
  const phone    = document.getElementById('quickOrderClientPhone').value.trim();
  const quartier = document.getElementById('quickOrderClientQuartier').value.trim();
  const address  = document.getElementById('quickOrderClientAddress').value.trim();

  if (!name || !phone || !quartier || !address) {
    showToast('Veuillez remplir vos informations de livraison', 'error');
    return;
  }
  if (phone.length < 9) {
    showToast('Numéro de téléphone invalide', 'error');
    return;
  }
  localStorage.setItem('moboro_client_info', JSON.stringify({ name, phone, quartier, address }));

  const product = _quickOrderProduct;
  const seller  = _quickOrderSeller;
  const qty     = _quickOrderQty;
  const total   = product.price * qty;

  try {
    const { error } = await db.from(TABLES.ORDERS).insert({
      seller_id:       seller.id,
      client_name:     name,
      client_phone:    phone,
      client_quartier: quartier,
      client_address:  address,
      items:           [{ id: product.id, name: product.name, price: product.price, quantity: qty }],
      total:           total,
      status:          'en_preparation',
      created_at:      new Date().toISOString()
    });

    if (error) {
      console.error('submitQuickOrder insert error:', JSON.stringify(error));
      showToast('Erreur enregistrement commande', 'error');
      return;
    }

    fetch(`${SUPABASE_URL}/functions/v1/send-order-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({
        seller_id: seller.id,
        title: '🛒 Nouvelle commande !',
        body: `${name} vient de passer une commande de ${total.toLocaleString()} FC.`,
        url: '/Congomarket/'
      })
    }).catch(e => console.error('send-order-push error:', e));
  } catch (e) {
    console.error('submitQuickOrder exception:', e);
    showToast('Erreur réseau. Réessayez.', 'error');
    return;
  }

  const message = `COMMANDE CLIENT 🛒%0A%0AClient: ${name}%0ATéléphone: ${phone}%0AQuartier: ${quartier}%0AAdresse: ${address}%0A%0AProduits:%0A• ${product.name} × ${qty} = ${formatPrice(total)} FCFA%0A%0ATOTAL: ${formatPrice(total)} FCFA`;
  window.open(`https://wa.me/${formatWhatsApp(seller.phone)}?text=${message}`, '_blank');
  showToast('Commande envoyée !', 'success');
  goBack();
}

// ================================================================
// Suivi de commande — côté client (sans compte, recherche par téléphone)
// ================================================================
async function trackMyOrders() {
  try {
    const phone = document.getElementById('trackPhoneInput').value.trim();
    if (!phone || phone.length < 8) {
      showToast('Entrez un numéro de téléphone valide', 'error');
      return;
    }

    const { data: orders, error } = await db.from(TABLES.ORDERS)
      .select('*')
      .eq('client_phone', phone)
      .order('created_at', { ascending: false });

    const container = document.getElementById('trackOrdersResults');
    if (!container) return;

    if (error) { showToast('Erreur recherche', 'error'); return; }

    if (!orders || orders.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#888;padding:20px 0;">Aucune commande trouvée pour ce numéro.</p>`;
      return;
    }

    const sellerIds = [...new Set(orders.map(o => o.seller_id).filter(Boolean))];
    let sellersMap = {};
    if (sellerIds.length > 0) {
      const { data: sellersData } = await db.from(TABLES.SELLERS)
        .select('id, full_name').in('id', sellerIds);
      (sellersData || []).forEach(s => { sellersMap[s.id] = s.full_name; });
    }

    const STATUS = {
      en_preparation: { label: '🟡 En préparation', color: '#faad14' },
      expedie:        { label: '🔵 Expédié',        color: '#1677FF' },
      livre:          { label: '🟢 Livré',          color: '#52c41a' }
    };

    container.innerHTML = orders.map(o => {
      const status     = STATUS[o.status || 'en_preparation'];
      const dateStr     = new Date(o.created_at).toLocaleDateString('fr-FR');
      const sellerName  = sellersMap[o.seller_id] || 'Vendeur';
      const itemsList   = (o.items || []).map(it => `${it.quantity} x ${escapeHtml(it.name)}`).join(', ');

      return `<div style="background:white;border:1px solid #eee;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="font-size:13px;">${escapeHtml(sellerName)}</strong>
          <span style="font-size:11px;color:#999;">${dateStr}</span>
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:6px;">${itemsList}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;font-weight:700;color:${status.color};">${status.label}</span>
          <strong style="font-size:13px;color:#1677FF;">${formatPrice(o.total)} FCFA</strong>
        </div>
      </div>`;
    }).join('');
  } catch (e) {
    console.error('trackMyOrders error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + e.message, 'error');
  }
}
window.trackMyOrders = trackMyOrders;

// ================================================================
// Fermer modals en cliquant dehors
// ================================================================
window.addEventListener('click', (e) => {
  const modal = document.getElementById('cartModal');
  if (e.target === modal) closeCart();

  const confirmDialog = document.getElementById('confirmDialog');
  if (e.target === confirmDialog) confirmDialog.style.display = 'none';
});
