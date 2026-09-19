// ==================== SELLERS.JS ====================

// ================================================================
// SYSTÈME D'ÉTOILES & BADGES
// Règles :
//  - 1 client = 1 seule étoile par vendeur (même après fermeture)
//  - Stocké en localStorage : clé "star_{sellerId}" = "1"
//  - Badges : 7 étoiles = argent, 20 = bronze, 50 = or
//  - Admin peut forcer depuis admin.html
// ================================================================

const BADGE_SILVER = 7;
const BADGE_BRONZE = 20;
const BADGE_GOLD   = 50;

// ================================================================
// Normalise un numéro pour les liens wa.me (format international)
// ================================================================
function formatWhatsApp(phone) {
  if (!phone) return '';
  let n = String(phone).replace(/[\s\-().]/g, '');
  if (n.startsWith('00')) n = '+' + n.slice(2);
  return n.startsWith('+') ? n.replace('+', '') : n;
}



function getBadgeHtml(stars = 0, badge = null) {
  // badge peut être 'silver','bronze','gold' (forcé admin) ou calculé depuis stars
  const computed = badge || (stars >= BADGE_GOLD ? 'gold' : stars >= BADGE_BRONZE ? 'bronze' : stars >= BADGE_SILVER ? 'silver' : null);
  if (!computed) return '';
  const map = {
    silver: { emoji: '🥈', label: 'Badge Argent', color: '#a0aec0' },
    bronze: { emoji: '🥉', label: 'Badge Bronze', color: '#c07b3a' },
    gold:   { emoji: '🥇', label: 'Badge Or',     color: '#f6c90e' }
  };
  const b = map[computed];
  if (!b) return '';
  return `<span class="seller-badge" style="background:${b.color}20;border:1px solid ${b.color};
    color:${b.color};font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;
    display:inline-flex;align-items:center;gap:3px;">${b.emoji} ${b.label}</span>`;
}

// ================================================================
// TARIFS DÉGRESSIFS PAR QUANTITÉ — tableau clair type "1-9 = X, 10+ = Y"
// basePrice = prix unitaire normal, tier1Price = prix dès qteMin,
// tier2Price = prix dès qteMax (tier2Price optionnel)
// ================================================================
function renderQuantityTiers(basePrice, qteMin, tier1Price, qteMax, tier2Price) {
  if (!qteMin && !qteMax) return '';
  const base = Number(basePrice) || 0;
  const rows = [];

  if (qteMin && qteMax && Number(qteMax) > Number(qteMin)) {
    rows.push([`1 – ${qteMin - 1}`, base]);
    rows.push([`${qteMin} – ${qteMax - 1}`, tier1Price != null ? tier1Price : base]);
    rows.push([`${qteMax}+`, tier2Price != null ? tier2Price : base]);
  } else if (qteMin) {
    rows.push([`1 – ${qteMin - 1}`, base]);
    rows.push([`${qteMin}+`, tier1Price != null ? tier1Price : base]);
  } else if (qteMax) {
    rows.push([`1 – ${qteMax - 1}`, base]);
    rows.push([`${qteMax}+`, tier2Price != null ? tier2Price : base]);
  }

  return `<div class="qty-tiers" style="margin:6px 0;border:1px solid #e8e8e8;border-radius:10px;overflow:hidden;background:#fff;">
    <div style="background:#f5f7fb;padding:4px 8px;font-size:11px;font-weight:700;color:#555;">📦 Tarifs par quantité</div>
    ${rows.map(([range, price]) => `
      <div style="display:flex;justify-content:space-between;padding:4px 8px;font-size:12px;border-top:1px solid #f0f0f0;">
        <span style="color:#333;">${range} unités</span>
        <span style="color:#1677FF;font-weight:700;">${formatPrice(price)} FCFA</span>
      </div>`).join('')}
  </div>`;
}

// Version ultra-compacte pour la grille (1 seule ligne, pas de bloc)
function renderQuantityTiersCompact(p) {
  if (!p.qte_min && !p.qte_max) return '';
  const base = Number(p.price) || 0;
  const parts = [];
  if (p.qte_min) parts.push(`${p.qte_min}+:${formatPrice(p.prix_min != null ? p.prix_min : base)}F`);
  if (p.qte_max) parts.push(`${p.qte_max}+:${formatPrice(p.prix_max != null ? p.prix_max : base)}F`);
  return parts.join(' · ');
}

// ================================================================
// SPÉCIFICATIONS PRODUIT — taille / couleur / matière
// ================================================================
function renderSpecsHtml(p) {
  if (!p || (!p.taille && !p.couleur && !p.matiere)) return '';
  const chips = [];
  if (p.taille)  chips.push(`📏 ${escapeHtml(p.taille)}`);
  if (p.couleur) chips.push(`🎨 ${escapeHtml(p.couleur)}`);
  if (p.matiere) chips.push(`🧵 ${escapeHtml(p.matiere)}`);
  return `<div class="product-specs" style="display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;">
    ${chips.map(c => `<span style="background:#f5f7fb;border:1px solid #e8e8e8;color:#555;font-size:11px;font-weight:600;padding:3px 9px;border-radius:20px;">${c}</span>`).join('')}
  </div>`;
}
window.renderSpecsHtml = renderSpecsHtml;

// ================================================================
// AVIS VÉRIFIÉS — liés obligatoirement à une commande livrée
// ================================================================
function renderStarsReadonly(avg) {
  const full = Math.round(avg);
  let html = '<span style="color:#fadb14;font-size:13px;">';
  for (let i = 1; i <= 5; i++) html += i <= full ? '★' : '☆';
  return html + '</span>';
}

async function loadProductReviewsSummary(productId, elementId) {
  const el = document.getElementById(elementId || `reviews-${productId}`);
  if (!el) return;
  try {
    // Filet de sécurité : si la requête reste bloquée (réseau lent/instable),
    // on n'attend pas indéfiniment — on retombe sur "Aucun avis" après 10s
    // plutôt que de laisser la carte figée sur "Chargement..." pour toujours.
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 10000));
    const { data, error } = await Promise.race([
      db.from(TABLES.PRODUCT_REVIEWS).select('rating').eq('product_id', productId),
      timeout
    ]);
    if (error || !data || data.length === 0) {
      el.innerHTML = `<span style="font-size:11px;color:#999;">Aucun avis vérifié pour le moment</span>`;
      return;
    }
    const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
    el.innerHTML = `${renderStarsReadonly(avg)} <span style="font-size:12px;color:#666;">${avg.toFixed(1)} (${data.length} avis vérifiés)</span> <button onclick="openProductReviewsListModal('${productId}')" style="background:none;border:none;color:#1677FF;font-size:12px;text-decoration:underline;cursor:pointer;padding:0;margin-left:4px;">Voir plus</button>`;
  } catch (e) {
    console.error('loadProductReviewsSummary error (productId=' + productId + '):', e);
    el.innerHTML = `<span style="font-size:11px;color:#999;">Aucun avis vérifié pour le moment</span>`;
  }
}

let _pendingReview = null;

function openReviewModal(productId, sellerId) {
  _pendingReview = { productId, sellerId };
  document.getElementById('reviewNameInput').value = '';
  document.getElementById('reviewPhoneInput').value = '';
  document.getElementById('reviewCommentInput').value = '';
  document.getElementById('reviewRatingInput').value = '5';
  document.getElementById('reviewModalError').innerText = '';
  document.getElementById('reviewModal').style.display = 'flex';
}

function closeReviewModal() {
  document.getElementById('reviewModal').style.display = 'none';
  _pendingReview = null;
}

async function submitProductReview() {
  if (!_pendingReview) return;
  const { productId, sellerId } = _pendingReview;
  const name    = document.getElementById('reviewNameInput').value.trim();
  const phone   = document.getElementById('reviewPhoneInput').value.trim();
  const rating  = parseInt(document.getElementById('reviewRatingInput').value, 10);
  const comment = document.getElementById('reviewCommentInput').value.trim();
  const errorEl = document.getElementById('reviewModalError');

  if (!name) { errorEl.innerText = 'Entrez votre nom.'; return; }
  if (!phone || phone.length < 8) { errorEl.innerText = 'Entrez un numéro de téléphone valide.'; return; }

  try {
    const { data: existing } = await db.from(TABLES.PRODUCT_REVIEWS)
      .select('id').eq('product_id', productId).eq('client_phone', phone).maybeSingle();
    if (existing) { errorEl.innerText = 'Vous avez déjà laissé un avis pour ce produit.'; return; }

    const { error: insertError } = await db.from(TABLES.PRODUCT_REVIEWS).insert({
      product_id: productId, seller_id: sellerId,
      client_phone: phone, client_name: name,
      rating, comment, created_at: new Date().toISOString()
    });
    if (insertError) { errorEl.innerText = 'Erreur, réessayez.'; return; }

    showToast('✅ Merci pour votre avis !', 'success');
    closeReviewModal();
    loadProductReviewsSummary(productId);
  } catch (e) {
    console.error('submitProductReview error:', e);
    errorEl.innerText = 'Erreur réseau.';
  }
}

window.loadProductReviewsSummary = loadProductReviewsSummary;
window.openReviewModal           = openReviewModal;
window.closeReviewModal          = closeReviewModal;
window.submitProductReview       = submitProductReview;

// ================================================================
// AVIS VENDEUR (boutique) — distinct des avis produit
// ================================================================
async function loadSellerReviewsSummary(sellerId) {
  const el = document.getElementById(`sellerReviews-${sellerId}`);
  if (!el) return;
  try {
    const { data, error } = await db.from(TABLES.SELLER_REVIEWS)
      .select('rating').eq('seller_id', sellerId);
    if (error || !data || data.length === 0) {
      el.innerHTML = `<span style="font-size:12px;color:#999;">Aucun avis vérifié pour le moment</span>`;
      return;
    }
    const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
    el.innerHTML = `${renderStarsReadonly(avg)} <span style="font-size:12px;color:#666;">${avg.toFixed(1)} (${data.length} avis)</span> ` +
      `<button onclick="openSellerReviewsListModal('${sellerId}')" style="background:none;border:none;color:#1677FF;font-size:11px;font-weight:700;cursor:pointer;padding:0;text-decoration:underline;">Voir plus</button>`;
  } catch (e) { console.error('loadSellerReviewsSummary error:', e); }
}

let _pendingSellerReview = null;

function openSellerReviewModal(sellerId) {
  _pendingSellerReview = sellerId;
  document.getElementById('sellerReviewNameInput').value = '';
  document.getElementById('sellerReviewPhoneInput').value = '';
  document.getElementById('sellerReviewCommentInput').value = '';
  document.getElementById('sellerReviewRatingInput').value = '5';
  document.getElementById('sellerReviewModalError').innerText = '';
  document.getElementById('sellerReviewModal').style.display = 'flex';
}

function closeSellerReviewModal() {
  document.getElementById('sellerReviewModal').style.display = 'none';
  _pendingSellerReview = null;
}

async function submitSellerReview() {
  if (!_pendingSellerReview) return;
  const sellerId = _pendingSellerReview;
  const name    = document.getElementById('sellerReviewNameInput').value.trim();
  const phone   = document.getElementById('sellerReviewPhoneInput').value.trim();
  const rating  = parseInt(document.getElementById('sellerReviewRatingInput').value, 10);
  const comment = document.getElementById('sellerReviewCommentInput').value.trim();
  const errorEl = document.getElementById('sellerReviewModalError');

  if (!name) { errorEl.innerText = 'Entrez votre nom.'; return; }
  if (!phone || phone.length < 8) { errorEl.innerText = 'Entrez un numéro de téléphone valide.'; return; }

  try {
    const { data: existing } = await db.from(TABLES.SELLER_REVIEWS)
      .select('id').eq('seller_id', sellerId).eq('client_phone', phone).maybeSingle();
    if (existing) { errorEl.innerText = 'Vous avez déjà laissé un avis pour cette boutique.'; return; }

    const { error: insertError } = await db.from(TABLES.SELLER_REVIEWS).insert({
      seller_id: sellerId,
      client_phone: phone, client_name: name,
      rating, comment, created_at: new Date().toISOString()
    });
    if (insertError) {
      console.error('submitSellerReview insertError:', insertError);
      errorEl.innerText = insertError.message.includes('Trop d\'avis')
        ? 'Trop d\'avis envoyés récemment. Réessayez plus tard.'
        : 'Erreur: ' + insertError.message;
      return;
    }

    showToast('✅ Merci pour votre avis !', 'success');
    closeSellerReviewModal();
    loadSellerReviewsSummary(sellerId);
  } catch (e) {
    console.error('submitSellerReview error:', e);
    errorEl.innerText = 'Erreur réseau.';
  }
}

async function openSellerReviewsListModal(sellerId) {
  const modal = document.getElementById('sellerReviewsListModal');
  const body  = document.getElementById('sellerReviewsListBody');
  body.innerHTML = '<div class="loading">Chargement...</div>';
  modal.style.display = 'flex';

  try {
    const { data, error } = await db.from(TABLES.SELLER_REVIEWS)
      .select('client_name, rating, comment, created_at')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      body.innerHTML = '<p style="text-align:center;color:#888;padding:20px 0;">Aucun avis pour le moment.</p>';
      return;
    }

    body.innerHTML = data.map(r => `
      <div style="border-bottom:1px solid #eee;padding:10px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <strong style="font-size:13px;">${escapeHtml(r.client_name || 'Client')}</strong>
          <span style="font-size:11px;color:#999;">${new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
        ${renderStarsReadonly(r.rating)}
        ${r.comment ? `<p style="font-size:13px;color:#444;margin-top:4px;">${escapeHtml(r.comment)}</p>` : ''}
      </div>
    `).join('');
  } catch (e) {
    console.error('openSellerReviewsListModal error:', e);
    body.innerHTML = '<p style="text-align:center;color:#f5222d;padding:20px 0;">Erreur de chargement.</p>';
  }
}

function closeSellerReviewsListModal() {
  document.getElementById('sellerReviewsListModal').style.display = 'none';
}

async function openProductReviewsListModal(productId) {
  const modal = document.getElementById('productReviewsListModal');
  const body  = document.getElementById('productReviewsListBody');
  body.innerHTML = '<div class="loading">Chargement...</div>';
  modal.style.display = 'flex';

  try {
    const { data, error } = await db.from(TABLES.PRODUCT_REVIEWS)
      .select('client_name, rating, comment, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      body.innerHTML = '<p style="text-align:center;color:#888;padding:20px 0;">Aucun avis pour le moment.</p>';
      return;
    }

    body.innerHTML = data.map(r => `
      <div style="border-bottom:1px solid #eee;padding:10px 0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <strong style="font-size:13px;">${escapeHtml(r.client_name || 'Client')}</strong>
          <span style="font-size:11px;color:#999;">${new Date(r.created_at).toLocaleDateString('fr-FR')}</span>
        </div>
        ${renderStarsReadonly(r.rating)}
        ${r.comment ? `<p style="font-size:13px;color:#444;margin-top:4px;">${escapeHtml(r.comment)}</p>` : ''}
      </div>
    `).join('');
  } catch (e) {
    console.error('openProductReviewsListModal error:', e);
    body.innerHTML = '<p style="text-align:center;color:#f5222d;padding:20px 0;">Erreur de chargement.</p>';
  }
}

function closeProductReviewsListModal() {
  document.getElementById('productReviewsListModal').style.display = 'none';
}

window.loadSellerReviewsSummary   = loadSellerReviewsSummary;
window.openSellerReviewModal      = openSellerReviewModal;
window.closeSellerReviewModal     = closeSellerReviewModal;
window.submitSellerReview         = submitSellerReview;
window.openSellerReviewsListModal = openSellerReviewsListModal;
window.closeSellerReviewsListModal = closeSellerReviewsListModal;
window.openProductReviewsListModal = openProductReviewsListModal;
window.closeProductReviewsListModal = closeProductReviewsListModal;

// ================================================================
// PRODUITS SIMILAIRES — tous vendeurs confondus, priorité au nom, pagination 15
// ================================================================
const SIMILAR_PER_PAGE = 16;
const _similarProductsState = {}; // elementId -> { list, page, hideLabel }

async function loadSimilarProducts(productId, category, elementId, productName, hideLabel) {
  const id = elementId || `similar-${productId}`;
  const el = document.getElementById(id);
  if (!el) return;
  try {
    let results = [];

    if (productName) {
      const keyword = productName.trim().split(/\s+/)[0];
      if (keyword && keyword.length >= 3) {
        const { data: nameMatches } = await db.from(TABLES.PRODUCTS)
          .select('id, name, price, image, seller_id')
          .ilike('name', `%${keyword}%`)
          .eq('is_active', true)
          .neq('id', productId)
          .limit(30);
        results = results.concat(nameMatches || []);
      }
    }

    if (category) {
      const { data: catMatches } = await db.from(TABLES.PRODUCTS)
        .select('id, name, price, image, seller_id')
        .eq('seller_category', category)
        .eq('is_active', true)
        .neq('id', productId)
        .limit(30);
      results = results.concat(catMatches || []);
    }

    const seen = new Set();
    const finalList = [];
    for (const r of results) {
      if (!seen.has(r.id)) { seen.add(r.id); finalList.push(r); }
    }

    _similarProductsState[id] = { list: finalList, page: 0, hideLabel: !!hideLabel };
    _renderSimilarProductsPage(id);
  } catch (e) { console.error('loadSimilarProducts error:', e); }
}

function _renderSimilarProductsPage(elementId) {
  const state = _similarProductsState[elementId];
  const el = document.getElementById(elementId);
  if (!state || !el) return;

  if (state.list.length === 0) {
    el.innerHTML = '<p style="text-align:center;color:#888;font-size:12px;">Aucun produit similaire trouvé.</p>';
    return;
  }

  const shown   = Math.min((state.page + 1) * SIMILAR_PER_PAGE, state.list.length);
  const visible = state.list.slice(0, shown);
  const hasMore = shown < state.list.length;

  el.innerHTML = `
    ${state.hideLabel ? '' : '<div style="font-size:12px;font-weight:700;color:#555;margin:10px 0 6px;">🔎 Produits similaires</div>'}
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${visible.map(sp => `
        <div style="width:100px;cursor:pointer;" onclick="openSellerProducts('${sp.seller_id}', currentCategoryType || 'B', '${escapeHtml(sp.seller_category || '')}')">
          <img src="${escapeHtml(sp.image)}" onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=600'"
            style="width:100px;height:100px;object-fit:cover;border-radius:10px;">
          <div style="font-size:11px;color:#333;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(sp.name)}</div>
          <div style="font-size:11px;font-weight:700;color:#1677FF;">${formatPrice(sp.price)} FCFA</div>
        </div>
      `).join('')}
    </div>
    ${hasMore ? `
      <div style="text-align:center;margin-top:8px;">
        <button onclick="event.stopPropagation(); _loadMoreSimilarProducts('${elementId}')"
          style="background:#1677FF;color:white;border:none;padding:8px 20px;border-radius:99px;font-size:12px;font-weight:600;cursor:pointer;">
          Voir plus
        </button>
      </div>
    ` : ''}
  `;
}

function _loadMoreSimilarProducts(elementId) {
  const state = _similarProductsState[elementId];
  if (!state) return;
  state.page++;
  _renderSimilarProductsPage(elementId);
}

window.loadSimilarProducts = loadSimilarProducts;
window._loadMoreSimilarProducts = _loadMoreSimilarProducts;

function getStarHtml(sellerId, entityType = 'seller', stars = 0, badge = null) {
  const storageKey = `star_${entityType}_${sellerId}`;
  const alreadyGiven = !!localStorage.getItem(storageKey);
  const starColor = alreadyGiven ? '#fadb14' : '#e8e8e8';
  const title = alreadyGiven ? 'Vous avez déjà donné une étoile' : 'Donner une étoile';

  return `
    <div class="star-row" style="display:flex;align-items:center;gap:6px;margin:6px 0 4px;">
      <button class="star-btn" data-id="${sellerId}" data-type="${entityType}"
        onclick="giveStar('${sellerId}','${entityType}',this)"
        title="${title}"
        style="background:none;border:none;cursor:${alreadyGiven ? 'default' : 'pointer'};
               font-size:20px;line-height:1;padding:0;opacity:${alreadyGiven ? '0.6' : '1'};"
        ${alreadyGiven ? 'disabled' : ''}>
        <span style="color:${starColor};">⭐</span>
      </button>
      <span class="star-count" style="font-size:13px;font-weight:700;color:#555;">${stars} étoile${stars > 1 ? 's' : ''}</span>
      ${getBadgeHtml(stars, badge)}
    </div>`;
}

async function giveStar(entityId, entityType, btn) {
  // Bug 10 fix — désactiver immédiatement pour bloquer le double-clic
  if (btn.disabled) return;
  btn.disabled = true;

  const storageKey = `star_${entityType}_${entityId}`;
  if (localStorage.getItem(storageKey)) {
    showToast('Vous avez déjà donné une étoile à ce vendeur', 'info');
    btn.disabled = false;
    return;
  }

  try {
    const table = entityType === 'livreur' ? 'delivery_agents' : TABLES.SELLERS;
const res = await fetch(SUPABASE_URL + '/functions/v1/account-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify({ action: 'give_star', table, payload: { entityId } })
    });
    const result = await res.json();
    if (!result.ok) { showToast('Erreur', 'error'); btn.disabled = false; return; }

    // Marquer localement — illimité dans le temps
    localStorage.setItem(storageKey, '1');

    // Mise à jour visuelle immédiate
    btn.style.opacity = '0.6';
    btn.disabled = true;
    btn.querySelector('span').style.color = '#fadb14';
const row = btn.closest('.star-row');
const countEl = row ? row.querySelector('.star-count') : null;
    if (countEl) countEl.innerText = `${result.stars} étoile${result.stars > 1 ? 's' : ''}`;

    // Badge dynamique
    const badgeEl = btn.closest('.star-row');
    if (badgeEl) {
      const existing = badgeEl.querySelector('.seller-badge');
      if (existing) existing.remove();
      const newBadge = getBadgeHtml(result.stars);
      if (newBadge) badgeEl.insertAdjacentHTML('beforeend', newBadge);
    }

    showToast('⭐ Merci pour votre étoile !', 'success');

  } catch(e) {
    showToast('Erreur, réessayez', 'error');
  }
}


// ✅ escapeHtml() → définie dans supabase.js (supprimée ici pour éviter le doublon)

// addToCartFromBtn est maintenant définie dans cart.js (panier multi-vendeurs)

// ================================================================
// Contact WhatsApp rapide depuis le zoom — message pré-rempli
// ================================================================
function contactSellerWhatsApp(product, seller) {
  if (!seller || !seller.phone) {
    showToast('Numéro du vendeur indisponible', 'error');
    return;
  }
  const message =
    `Bonjour 👋, je suis intéressé(e) par ce produit :\n` +
    `🛍️ ${product.name} — ${formatPrice(product.price)} FCFA\n` +
    (product.image ? `📷 Photo : ${product.image}\n` : '') +
    `\nEst-il toujours disponible ? Quel est le prix pour plusieurs unités ?`;

  window.open(`https://wa.me/${formatWhatsApp(seller.phone)}?text=${encodeURIComponent(message)}`, '_blank');
}
window.contactSellerWhatsApp = contactSellerWhatsApp;

let currentCategory     = '';
let currentCategoryType = ''; // 'A' ou 'B'

// ================================================================
// Ouvrir une catégorie
// ================================================================
let _categoryPage      = 0;
let _categoryCatId     = '';
let _categoryType      = '';
const CATEGORY_PER_PAGE = 16;

async function openCategory(catId, type, append = false) {
  try {
  window.currentViewedSeller = null;

  if (!append) {
    currentCategory     = catId;
    currentCategoryType = type;
    _categoryPage       = 0;
    _categoryCatId      = catId;
    _categoryType        = type;
    _productsAll = [];

    const title = ALL_CATEGORIES[catId] || 'Produits';
    document.getElementById('sellerNameTitle').innerText    = title;
    document.getElementById('sellerNameSubtitle').innerText = '';

    showPage('productsPage');
    document.getElementById('productsList').innerHTML =
      '<div class="loading">Chargement...</div>';
    const simBlock = document.getElementById('similarSellersBlock');
    if (simBlock) simBlock.innerHTML = '';
    updateCartUI();
  }

  const villeFilter = typeof _selectedVille !== 'undefined' ? _selectedVille : '';
  const from = _categoryPage * CATEGORY_PER_PAGE;
  const to   = from + CATEGORY_PER_PAGE - 1;

  let query = db
    .from(TABLES.PRODUCTS)
    .select('id, name, price, description, image, seller_id, is_active, created_at, qte_min, prix_min, qte_max, prix_max, taille, couleur, matiere, seller_category, sellers!inner(id, full_name, phone, quartier, ville, is_blocked, is_active, account_type, stars, badge)')
    .eq('seller_category', catId)
    .eq('is_active', true)
    .eq('sellers.is_blocked', false)
    .eq('sellers.is_active', true);

  if (villeFilter) {
    query = query.ilike('sellers.ville', `%${villeFilter}%`);
  }

  const { data: products, error } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('openCategory error:', JSON.stringify(error));
    if (!append) {
      document.getElementById('productsList').innerHTML =
        '<p style="text-align:center;padding:20px;color:#888;">Erreur de chargement.</p>';
    }
    return;
  }

  renderProducts(products || [], type, append);

  } catch(e) {
    console.error('openCategory error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

function loadMoreCategory() {
  _categoryPage++;
  openCategory(_categoryCatId, _categoryType, true);
}
window.loadMoreCategory = loadMoreCategory;

  
  // ================================================================
// Arbre de catégories : titres + sous-titres affichés à plat
// ================================================================
function openCategoryTree(list, type, pageTitle) {
  document.getElementById('categoryTreeTitle').innerText = pageTitle;
  const grid = document.getElementById('categoryTreeGrid');
  grid.innerHTML = `<div class="categories">
    ${list.map(s => `<button class="cat-btn cat-btn-lg" onclick="openCategory('${s.id}','${type}')">${s.label}</button>`).join('')}
  </div>`;
  showPage('categoryTreePage');
}

// ================================================================
// Charger vendeurs d'une catégorie
// ================================================================
let _sellersPage = 0;
let _sellersTotal = 0;
let _sellersCatId = '';
let _productsAll      = [];
let _productsPage     = 0;
let _sidebarContext   = 'home'; // 'home' | 'category' — contexte de la sidebar partagée
const PRODUCTS_PER_PAGE = 16;

async function loadSellers(catId, append = false) {
  const list = document.getElementById('sellerList');
  const villeFilter = typeof _selectedVille !== 'undefined' ? _selectedVille : '';

  if (!append) {
    _sellersPage = 0;
    _sellersCatId = catId;
    list.innerHTML = '<div class="loading">Chargement...</div>';
  }

  const from = _sellersPage * 16;
  const to = from + 15;

  try {
let query = db
  .from(TABLES.SELLERS)
  .select('id, full_name, photo, category, quartier, ville, description, stars, badge, phone, position, dynamisme_score, account_type, is_reliable', { count: 'exact' })
  .eq('category', catId)
  .eq('is_blocked', false)
  .eq('is_active', true);

// ── Filtre abonnement actif ──
if (isSubscriptionActive()) {
  query = query.eq('subscription_status', 'en_cours');
}

if (villeFilter) {
  query = query.ilike('ville', `%${villeFilter}%`);
}

const { data: sellers, error, count } = await query
  .order('position', { ascending: true })
  .order('dynamisme_score', { ascending: false })
  .range(from, to);

    if (error) {
      list.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Erreur de chargement.</p>';
      return;
    }

    _sellersTotal = count || 0;

    if (!append) list.innerHTML = '';

    if (!sellers || sellers.length === 0) {
      if (!append) list.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Aucun vendeur dans cette catégorie.</p>';
      return;
    }

    list.style.cssText = 'display:block;padding:0 15px 80px;';

    // Supprimer l'ancien bouton "Voir plus" s'il existe
    const oldBtn = document.getElementById('loadMoreSellers');
    if (oldBtn) oldBtn.remove();

    list.insertAdjacentHTML('beforeend', sellers.map(seller => `
      <div class="seller-card" data-id="${seller.id}">
        <div class="seller-card-body">
          <img src="${escapeHtml(seller.photo) || 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=200'}"
            class="seller-image"
            onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=200'">
          <div class="seller-info">
            <h3>${escapeHtml(seller.full_name)} ${seller.is_reliable ? '<span style="background:#e6fffb;border:1px solid #08979c;color:#08979c;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;display:inline-flex;align-items:center;gap:3px;vertical-align:middle;">✅ Vendeur fiable</span>' : ''}</h3>
            <p class="seller-location">📍 ${escapeHtml(seller.quartier)}, ${escapeHtml(seller.ville)}</p>
            <p class="seller-desc">${escapeHtml(seller.description)}</p>
            ${getStarHtml(seller.id, 'seller', seller.stars || 0, seller.badge || null)}
          </div>
        </div>
        <div class="seller-actions">
          <button class="view-btn" onclick="openSellerProducts('${seller.id}', '${currentCategoryType}', '${escapeHtml(catId || '')}')">📦 Publications</button>
          <button class="view-btn promo-btn" onclick="openSellerPromos('${seller.id}', '${escapeHtml(seller.full_name)}')">🔥 Promos</button>
         <a href="https://wa.me/${formatWhatsApp(seller.phone)}" target="_blank" class="contact-btn"
            onclick="trackWhatsappClick('${seller.id}', '${seller.account_type || ''}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Contacter
          </a>
          <a href="tel:${formatWhatsApp(seller.phone)}" class="call-btn" title="Appeler">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z"/></svg>
          </a> 
        </div>
      </div>
    `).join(''));

    // Bouton "Voir plus" si il reste des vendeurs
    const loaded = from + sellers.length;
    if (loaded < _sellersTotal) {
      list.insertAdjacentHTML('beforeend', `
        <div id="loadMoreSellers" style="text-align:center;padding:16px;">
          <button onclick="loadMoreSellers()" style="background:#1677FF;color:white;border:none;padding:12px 32px;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer;">
            Voir plus 
          </button>
        </div>
      `);
    }

  } catch (e) {
    list.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Erreur réseau.</p>';
  }
}

function loadMoreSellers() {
  _sellersPage++;
  loadSellers(_sellersCatId, true);
}

// ================================================================
// Ouvrir publications d'un vendeur
// ================================================================
async function openSellerProducts(sellerId, type, categoryId) {
  try {
    const { data: seller, error } = await db
      .from(TABLES.SELLERS)
      .select('id, code, full_name, phone, quartier, address, ville, category, description, photo, is_blocked, is_active, position, dynamisme_score, account_type, subscription_status, subscription_start, subscription_end, stars, badge, is_verified, has_first_sale, is_reliable, pays, is_approved, created_at, last_published, whatsapp_clicks_today, whatsapp_clicks_total')
      .eq('id', sellerId)
      .single();

    if (error || !seller) {
      console.error('openSellerProducts error:', JSON.stringify(error));
      showToast('Impossible de charger ce vendeur', 'error');
      return;
    }

    window.currentViewedSeller = seller;

  const _isMultiServicesSeller = typeof TREE_B1_IDS !== 'undefined' && TREE_B1_IDS.has(currentCategory);
  document.getElementById('sellerNameTitle').innerText    = _isMultiServicesSeller ? seller.full_name : "Boutique " + seller.full_name;
    document.getElementById('sellerNameSubtitle').innerText =
      '📍 ' + seller.quartier + ', ' + seller.ville;
    document.getElementById('sellerNameMeta').innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-weight:700;font-size:14px;color:#222;">🏪 Boutique ${escapeHtml(seller.full_name)}</span>
        ${seller.phone ? `<a href="tel:+${formatWhatsApp(seller.phone)}" class="call-btn call-btn-sm" title="Appeler">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z"/></svg>
        </a>` : ''}
        <button class="review-btn-sm" onclick="openSellerReviewModal('${seller.id}')">✍️ Un avis</button>
      </div>
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin-top:2px;">
        ${getStarHtml(seller.id, 'seller', seller.stars || 0, seller.badge || null)}
        <span id="sellerReviews-${seller.id}" style="font-size:12px;">Chargement avis...</span>
      </div>
    `;
    loadSellerReviewsSummary(seller.id);

    showPage('productsPage');
    closeHomeSidebar();
    document.getElementById('productsList').innerHTML =
      '<div class="loading">Chargement...</div>';

    // ✅ Fix séparation des sections : on ne montre que les publications du
    // vendeur qui appartiennent à la même section que celle cliquée (Grossiste /
    // Service / Boutique). categoryId (catégorie précise du produit/lien cliqué)
    // est prioritaire ; à défaut on retombe sur le contexte de navigation ambiant.
    const _sectionCatIds = _catIdsForCategory(categoryId);

    let prodQuery = db
      .from(TABLES.PRODUCTS)
      .select('id, name, price, description, image, seller_id, is_active, created_at, qte_min, prix_min, qte_max, prix_max, taille, couleur, matiere, seller_category')
      .eq('seller_id', sellerId)
      .eq('is_active', true);

    if (_sectionCatIds.length) prodQuery = prodQuery.in('seller_category', _sectionCatIds);

    const { data: products, error: prodError } = await prodQuery
      .order('created_at', { ascending: false });

    if (prodError) {
      console.error('openSellerProducts products error:', JSON.stringify(prodError));
    }

    renderProducts(products || [], type);
    loadSimilarSellers(seller.id, seller.category);

    // Enregistrer 1 vue page_open par visite vendeur (Bug 9 fix)
    recordProductView(null, sellerId, 'page_open');

    updateCartUI();

  } catch (e) {
    console.error('openSellerProducts exception:', e);
    showToast('Erreur chargement publications', 'error');
  }
}

// ================================================================
// Carte produit minimale — tout reste dans le zoom, sauf :
// prix (badge rouge), nom (bandeau bas), avis (bandeau bas)
// ================================================================
function _productCardHtml(p, showSeller) {
  const isGrossiste = typeof TREE_A_IDS !== 'undefined' && TREE_A_IDS.has(p.seller_category);
  const tierLine = isGrossiste ? renderQuantityTiersCompact(p) : '';
  const sellerLine = (showSeller && p.sellers)
    ? `<div class="product-seller-overlay" onclick="event.stopPropagation(); openSellerProducts('${p.sellers.id}', currentCategoryType || 'B', '${escapeHtml(p.seller_category || '')}')">🏪 ${escapeHtml(p.sellers.full_name)}</div>`
    : '';
  // Dans une grille (accueil/catégorie, showSeller=true) : le clic sur la photo
  // ouvre la page du vendeur. Sur la page d'un vendeur (showSeller=false) : le
  // clic ouvre toujours le zoom/lightbox, puisqu'on y est déjà.
  const imgOnclick = (showSeller && p.sellers)
    ? `openSellerProducts('${p.sellers.id}', currentCategoryType || 'B', '${escapeHtml(p.seller_category || '')}')`
    : `openLightbox(this.src, this.dataset.productId, this.dataset.category, this.dataset.name)`;

  return `
    <div class="product-card">
     <div class="product-img-wrap">
       <img
          src="${escapeHtml(p.image)}"
          data-product-id="${p.id}"
          data-category="${escapeHtml(p.seller_category || '')}"
          data-name="${escapeHtml(p.name)}"
          onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=600'"
          onclick="${imgOnclick}"
          style="cursor:pointer;"
        >
        <span class="product-price-badge">${formatPrice(p.price)} FCFA</span>
        ${tierLine ? `<span class="product-tier-badge">📦 ${tierLine}</span>` : ''}
        <div class="product-name-overlay${sellerLine ? '' : ' no-seller-line'}">${escapeHtml(p.name)}</div>
        ${sellerLine}
        <div class="product-reviews-overlay" id="reviews-${p.id}">Chargement...</div>
      </div>
    </div>
  `;
}

// ================================================================
// Afficher produits
// ================================================================
function renderProducts(products, type, append = false) {
  const list = document.getElementById('productsList');

  if (!append) {
    _productsAll  = products;
    _productsPage = 0;
  } else {
    _productsAll = _productsAll.concat(products);
  }

  if (!_productsAll.length) {
    list.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Aucune publication pour le moment.</p>';
    return;
  }
  if (!append) list.innerHTML = '';

  // Grille plate + sidebar filtres partagée — même traitement pour Boutique & Vendeur,
  // Grossiste & Importateur et Services (uniformisé, plus de mode "groupé" séparé).
  if (products[0] && products[0].sellers) {
    list.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:8px 15px 80px;';
    _renderProductsFlat(products, append);
    _sidebarContext = 'category';
    _populateHomeSidebarStatic();
    _populateHomeSidebarSellersFromProducts(_productsAll);
  }
  // Mode boutique unique (page vendeur)
  else {
    list.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:8px 15px 80px;';
    _appendProducts(type);
  }
}

// ---- Mode "Boutique & Vendeur" : grille plate avec nom vendeur sur chaque carte ----
function _renderProductsFlat(newProducts, append) {
  const list = document.getElementById('productsList');
  const oldBtn = document.getElementById('loadMoreCategoryBtn');
  if (oldBtn) oldBtn.remove();

  const batch = append ? newProducts : _productsAll;
  list.insertAdjacentHTML('beforeend', batch.map(p => _productCardHtml(p, true)).join(''));
  batch.forEach(p => loadProductReviewsSummary(p.id));

  if (newProducts.length === CATEGORY_PER_PAGE) {
    list.insertAdjacentHTML('beforeend', `
      <div id="loadMoreCategoryBtn" style="grid-column:1 / -1;text-align:center;padding:16px;">
        <button onclick="loadMoreCategory()" style="background:#1677FF;color:white;border:none;padding:12px 32px;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer;">
          Voir plus
        </button>
      </div>
    `);
  }
}

// ---- Mode boutique unique (pagination classique) ----
function _appendProducts(type) {
  const list  = document.getElementById('productsList');
  const start = _productsPage * PRODUCTS_PER_PAGE;
  const slice = _productsAll.slice(start, start + PRODUCTS_PER_PAGE);
  const oldBtn = document.getElementById('loadMoreProducts');
  if (oldBtn) oldBtn.remove();

  list.insertAdjacentHTML('beforeend', slice.map(p => _productCardHtml(p)).join(''));

  slice.forEach(p => {
    loadProductReviewsSummary(p.id);
  });

  const loaded = start + slice.length;
  if (loaded < _productsAll.length) {
    list.insertAdjacentHTML('beforeend', `
      <div id="loadMoreProducts" style="text-align:center;padding:16px;">
        <button onclick="loadMoreProducts()" style="background:#1677FF;color:white;border:none;padding:12px 32px;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer;">
          Voir plus
        </button>
      </div>
    `);
  }
}

// ---- Mode catégorie : une grille par boutique, titrée "Boutique 'nom'" ----
function _renderProductsGroupedBySeller() {
  const list = document.getElementById('productsList');
  const isMultiServices = typeof TREE_B1_IDS !== 'undefined' && TREE_B1_IDS.has(currentCategory);
  const groups = [];
  const groupMap = {};

  _productsAll.forEach(p => {
    const sid = p.seller_id;
    if (!groupMap[sid]) {
      groupMap[sid] = { seller: p.sellers, products: [] };
      groups.push(groupMap[sid]);
    }
    groupMap[sid].products.push(p);
  });

list.innerHTML = groups.map(g => `
    <div class="seller-group" style="margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:2px;flex-wrap:wrap;">
        <h2 style="font-size:15px;font-weight:700;color:#222;margin:0;">${isMultiServices ? escapeHtml(g.seller.full_name) : '🏪 Boutique ' + escapeHtml(g.seller.full_name)}</h2>
        ${g.seller.phone ? `<a href="tel:+${formatWhatsApp(g.seller.phone)}" class="call-btn call-btn-sm" title="Appeler">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.01-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.25 1.01l-2.2 2.21z"/></svg>
        </a>` : ''}
        <button class="review-btn-sm" onclick="openSellerReviewModal('${g.seller.id}')">✍️ Un avis</button>
      </div>
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:2px 0 8px;">
        ${getStarHtml(g.seller.id, 'seller', g.seller.stars || 0, g.seller.badge || null)}
        <span id="sellerReviews-${g.seller.id}" style="font-size:12px;">Chargement avis...</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        ${g.products.map(p => _productCardHtml(p)).join('')}
      </div>
    </div>
  `).join('');

  _productsAll.forEach(p => loadProductReviewsSummary(p.id));
  groups.forEach(g => loadSellerReviewsSummary(g.seller.id));
}

// ================================================================
// SIDEBAR CATÉGORIE — fusionnée avec la sidebar globale (voir plus bas
// _populateHomeSidebarStatic / openHomeSidebar / homeSidebarSelectVille).
// openCategory() appelle directement ces fonctions partagées.
// ================================================================

// ================================================================
// Vendeurs similaires — affichés en bas d'une page vendeur
// ================================================================
async function loadSimilarSellers(sellerId, category) {
  const block = document.getElementById('similarSellersBlock');
  if (!block) return;
  if (!category) { block.innerHTML = ''; return; }
  try {
    const { data: sellers, error } = await db
      .from(TABLES.SELLERS)
      .select('id, full_name, photo, category, stars, badge')
      .eq('category', category)
      .eq('is_blocked', false)
      .eq('is_active', true)
      .neq('id', sellerId)
      .order('dynamisme_score', { ascending: false })
      .limit(10);

    if (error || !sellers || sellers.length === 0) { block.innerHTML = ''; return; }

    block.innerHTML = `
      <div style="padding:4px 15px 30px;">
        <div style="font-size:13px;font-weight:700;color:#555;margin-bottom:8px;">🏪 Vendeurs similaires</div>
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:12px 8px;">
          ${sellers.map(s => `
            <div style="text-align:center;cursor:pointer;" onclick="openSellerProducts('${s.id}', currentCategoryType || 'B', '${escapeHtml(category || '')}')">
              <img src="${escapeHtml(s.photo) || 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=200'}"
                onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=200'"
                style="width:70px;height:70px;border-radius:50%;object-fit:cover;">
              <div style="font-size:11px;font-weight:600;color:#222;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(s.full_name)}</div>
              <div style="font-size:10px;color:#888;">⭐ ${s.stars || 0}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } catch(e) {
    console.error('loadSimilarSellers error:', e);
    block.innerHTML = '';
  }
}
window.loadSimilarSellers = loadSimilarSellers;

function loadMoreProducts() {
  _productsPage++;
  const type = typeof currentCategoryType !== 'undefined' ? currentCategoryType : 'B';
  _appendProducts(type);
}

// goHome() déplacée dans index.html (le script inline se charge après
// sellers.js et écrasait silencieusement cette version — gardée à un seul endroit)

async function recordProductView(productId, sellerId, type = 'view') {
  try {
    await db.from(TABLES.PRODUCT_VIEWS).insert({
      product_id: productId,
      seller_id:  sellerId,
      type:       type
    });
  } catch (e) {
    console.error('recordProductView error:', e);
  }
}

// ================================================================
// Tracking clic WhatsApp
// ================================================================
async function trackWhatsappClick(sellerId, accountType) {
  if (!sellerId) return;
  try {
    await db.from(TABLES.WHATSAPP_CLICKS).insert({
      seller_id:    sellerId,
      account_type: accountType || null,
      clicked_at:   new Date().toISOString().split('T')[0]
    });
  } catch(e) {
    console.error('trackWhatsappClick error:', e);
  }
}

// ================================================================
// NOTIFICATIONS VENDEUR — Option A : badge temps réel (Supabase Realtime)
// ================================================================
let _ordersChannel = null;

function updateOrdersBadge(count) {
  document.querySelectorAll('.orders-notif-badge').forEach(el => {
    if (count > 0) {
      el.innerText = count > 9 ? '9+' : count;
      el.style.display = 'inline-flex';
    } else {
      el.style.display = 'none';
    }
  });
}

function subscribeSellerOrderNotifications(sellerId) {
  if (!sellerId || _ordersChannel) return;
  const unreadKey = `orders_unread_${sellerId}`;
  updateOrdersBadge(parseInt(localStorage.getItem(unreadKey) || '0', 10));

  _ordersChannel = db.channel('orders-seller-' + sellerId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'orders', filter: `seller_id=eq.${sellerId}` },
      () => {
        const current = parseInt(localStorage.getItem(unreadKey) || '0', 10) + 1;
        localStorage.setItem(unreadKey, current);
        updateOrdersBadge(current);
        showToast('🛒 Nouvelle commande reçue !', 'success');
      }
    )
    .subscribe();
}

function markOrdersNotificationsRead() {
  if (typeof currentSeller === 'undefined' || !currentSeller) return;
  localStorage.setItem(`orders_unread_${currentSeller.id}`, '0');
  updateOrdersBadge(0);
}

function unsubscribeSellerOrderNotifications() {
  if (_ordersChannel) { db.removeChannel(_ordersChannel); _ordersChannel = null; }
}

// ================================================================
// NOTIFICATIONS VENDEUR — Option B : push navigateur
// ================================================================
const VAPID_PUBLIC_KEY = 'BETaKCUXbi_24cmp2qv-8v5xHrhW-gMCYlWCxNljiqO_Cp5TjZmxgLPYcymD4m21aypPaqlrq5eJn8FFuFrlp7k';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeSellerPush(sellerId) {
  if (!sellerId) return;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('Notifications non supportées sur ce navigateur', 'error');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('Notifications refusées', 'error');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const subJson = sub.toJSON();
    const { error } = await db.from('push_subscriptions').upsert({
      seller_id: sellerId,
      endpoint:  subJson.endpoint,
      p256dh:    subJson.keys.p256dh,
      auth:      subJson.keys.auth
    }, { onConflict: 'endpoint' });

    if (error) {
      console.error('subscribeSellerPush save error:', error);
      showToast('Erreur activation notifications', 'error');
      return;
    }

    showToast('🔔 Notifications activées !', 'success');
  } catch (e) {
    console.error('subscribeSellerPush error:', e);
    showToast('Erreur activation notifications', 'error');
  }
}
// Bug 3 fix — Exposer les fonctions de sellers.js sur window
window.openCategory                = openCategory;
window.loadSellers                 = loadSellers;
window.openSellerProducts          = openSellerProducts;
window.giveStar                    = giveStar;
window.trackWhatsappClick          = trackWhatsappClick;
// addToCartFromBtn est exportée automatiquement par cart.js (déclaration globale)
window.loadMoreProducts            = loadMoreProducts;
window.subscribeSellerPush = subscribeSellerPush;
// ================================================================
// PAGE D'ACCUEIL — Sidebar + grille "Boutiques & Vendeurs" (tous les
// produits actifs, du plus récent au plus ancien — plus de personnalisation
// par historique de navigation)
// ================================================================

function _computeHomeFeedCategoryIds() {
  // Simplifié : plus de personnalisation par historique (6 catégories les
  // plus visitées) — l'accueil affiche désormais tous les produits actifs
  // de toutes les catégories Boutique & Vendeur, du plus récent au plus
  // ancien, jusqu'à suppression ou nouvelle publication qui les repousse.
  if (typeof TREE_B2 === 'undefined') return [];
  return TREE_B2.map(c => c.id);
}

// ---- Grille produits personnalisée ----
let _homeFeedPage = 0;
let _homeFeedProducts = [];

async function loadHomeFeed(append = false) {
  const list = document.getElementById('homeProductsGrid');
  if (!list) return;

  if (!append) {
    _homeFeedPage = 0;
    list.innerHTML = '<div class="loading">Chargement...</div>';
  }

  const from = _homeFeedPage * 16;
  const to = from + 15;
  const catIds = _computeHomeFeedCategoryIds();
  if (!catIds.length) { list.innerHTML = ''; return; }

  const villeFilter = typeof _selectedVille !== 'undefined' ? _selectedVille : '';

  try {
    let query = db
      .from(TABLES.PRODUCTS)
      .select('id, name, price, description, image, seller_id, is_active, created_at, qte_min, prix_min, qte_max, prix_max, taille, couleur, matiere, seller_category, sellers!inner(id, full_name, phone, quartier, ville, is_blocked, is_active, account_type, stars, badge, position_boutique)')
      .in('seller_category', catIds)
      .eq('is_active', true)
      .eq('sellers.is_blocked', false)
      .eq('sellers.is_active', true);

    if (villeFilter) query = query.ilike('sellers.ville', `%${villeFilter}%`);

    // Respect du positionnement/dynamisme du vendeur : ceux avec une position
    // manuelle (admin) passent d'abord (1, 2, 3...), les autres suivent par
    // ordre de publication la plus récente.
    const { data, error } = await query
      .order('position_boutique', { foreignTable: 'sellers', ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('loadHomeFeed error:', JSON.stringify(error));
      if (!append) list.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Erreur de chargement.</p>';
      return;
    }

    const oldBtn = document.getElementById('loadMoreHomeFeed');
    if (oldBtn) oldBtn.remove();
    if (!append) list.innerHTML = '';

    if (!append && (!data || data.length === 0)) {
      list.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Aucune publication pour le moment.</p>';
      _homeFeedProducts = [];
      return;
    }

    _homeFeedProducts = append ? _homeFeedProducts.concat(data || []) : (data || []);

    list.insertAdjacentHTML('beforeend', (data || []).map(p => _productCardHtml(p, true)).join(''));
    (data || []).forEach(p => loadProductReviewsSummary(p.id));

    if (_sidebarContext === 'home') _populateHomeSidebarSellersFromProducts(_homeFeedProducts);

    if (data && data.length === 16) {
      list.insertAdjacentHTML('beforeend', `
        <div id="loadMoreHomeFeed" style="grid-column:1 / -1;text-align:center;padding:16px;">
          <button onclick="_homeFeedPage++; loadHomeFeed(true);" style="background:#1677FF;color:white;border:none;padding:12px 32px;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer;">
            Voir plus
          </button>
        </div>
      `);
    }
  } catch (e) {
    console.error('loadHomeFeed exception:', e);
  }
}
window.loadHomeFeed = loadHomeFeed;

// ---- Sidebar accueil : liste des vendeurs, dérivée des produits chargés ----
// (sellers.category n'est pas fiable pour les vendeurs indépendants — non
// envoyé à l'inscription. La vraie source de vérité est products.seller_category,
// donc on déduplique les vendeurs à partir des produits déjà chargés par loadHomeFeed,
// exactement comme _populateCatSidebar() le fait sur la page catégorie.)
function _populateHomeSidebarSellersFromProducts(products) {
  const sellersEl = document.getElementById('homeCatSidebarSellers');
  if (!sellersEl) return;

  const seen = new Set();
  const sellersList = [];
  products.forEach(p => {
    if (p.sellers && !seen.has(p.sellers.id)) {
      seen.add(p.sellers.id);
      sellersList.push(p.sellers);
    }
  });

  sellersEl.innerHTML = sellersList.length
    ? sellersList.map(s => `
      <div class="seller-mini-card" onclick="openSellerFromHomeSidebar('${s.id}')">
        <img class="seller-mini-img" src="${escapeHtml(s.photo) || 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=200'}" onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=200'">
        <div class="seller-mini-info">
          <div class="seller-mini-name">🏪 ${escapeHtml(s.full_name)}</div>
          <div class="seller-mini-meta">⭐ ${s.stars || 0} avis</div>
        </div>
      </div>
    `).join('')
    : '<p style="font-size:12px;color:#888;padding:6px;">Aucun vendeur.</p>';
}
window._populateHomeSidebarSellersFromProducts = _populateHomeSidebarSellersFromProducts;

// ================================================================
// Détermine l'arbre de catégories (TREE_A / TREE_B1 / TREE_B2) actif.
// - _getActiveTree() : déduit l'arbre du contexte de navigation ambiant
//   (_sidebarContext + currentCategory). Utilisé pour la sidebar, et en
//   dernier recours si aucune catégorie précise n'est fournie.
// - _catIdsForCategory(categoryId) : déduit l'arbre directement à partir
//   d'une catégorie précise (ex. celle du produit cliqué). Plus fiable
//   que le contexte ambiant, qui peut être obsolète selon le parcours.
// ================================================================
function _getActiveTree() {
  let tree = null, treeType = 'B';
  if (_sidebarContext === 'category' && typeof currentCategory !== 'undefined' && currentCategory) {
    if (typeof TREE_A_IDS !== 'undefined' && TREE_A_IDS.has(currentCategory))       { tree = TREE_A;  treeType = 'A'; }
    else if (typeof TREE_B1_IDS !== 'undefined' && TREE_B1_IDS.has(currentCategory)) { tree = TREE_B1; treeType = 'A'; }
    else if (typeof TREE_B2 !== 'undefined')                                          { tree = TREE_B2; treeType = 'B'; }
  } else if (_sidebarContext === 'grossiste' && typeof TREE_A !== 'undefined') {
    tree = TREE_A; treeType = 'A';
  } else if (_sidebarContext === 'service' && typeof TREE_B1 !== 'undefined') {
    tree = TREE_B1; treeType = 'A';
  } else if (typeof TREE_B2 !== 'undefined') {
    tree = TREE_B2; treeType = 'B'; // 'home' / 'boutique' par défaut
  }
  return { tree, treeType };
}

function _treeForCategoryId(categoryId) {
  if (typeof TREE_A_IDS !== 'undefined' && TREE_A_IDS.has(categoryId))   return TREE_A;
  if (typeof TREE_B1_IDS !== 'undefined' && TREE_B1_IDS.has(categoryId)) return TREE_B1;
  if (typeof TREE_B2 !== 'undefined')                                     return TREE_B2;
  return null;
}

function _getActiveTreeCatIds() {
  const { tree } = _getActiveTree();
  return (tree || []).map(c => c.id);
}

// Catégorie précise connue (ex. p.seller_category du produit cliqué) → priorité.
// Sinon repli sur le contexte de navigation ambiant.
function _catIdsForCategory(categoryId) {
  const tree = categoryId ? _treeForCategoryId(categoryId) : null;
  if (tree) return tree.map(c => c.id);
  return _getActiveTreeCatIds();
}
window._getActiveTreeCatIds = _getActiveTreeCatIds;
window._catIdsForCategory   = _catIdsForCategory;

// ---- Sidebar accueil : villes + sous-catégories (dépend du contexte actif) ----
function _populateHomeSidebarStatic() {
  const villes = ['Brazzaville','Pointe-Noire','Dolisie','Nkayi','Oyo','Bétou','Ouesso','Impfondo','Madingou','Owando','Sibiti','Mossaka','Gamboma','Djambala','Makoua','Kinkala','Ewo','Dongou'];
  const currentVille = typeof _selectedVille !== 'undefined' ? _selectedVille : '';

  const villesEl = document.getElementById('homeCatSidebarVilles');
  if (villesEl) {
    villesEl.innerHTML =
      `<button class="cat-sidebar-ville-opt${!currentVille ? ' active' : ''}" onclick="homeSidebarSelectVille('','📍Toutes')">📍 Toutes les villes</button>` +
      villes.map(v =>
        `<button class="cat-sidebar-ville-opt${currentVille === v ? ' active' : ''}" onclick="homeSidebarSelectVille('${v}','${v}')">${v}</button>`
      ).join('');
  }

  // Choix de l'arbre de sous-catégories selon le contexte : sur la page catégorie
  // (drill-down), on regarde à quel groupe appartient la catégorie ouverte ;
  // sur l'accueil, chaque section (Boutique/Grossiste/Service) a son propre arbre.
  const { tree, treeType } = _getActiveTree();

  const subcatsEl = document.getElementById('homeCatSidebarSubcats');
  if (subcatsEl && tree) {
    // Regroupement en tiroirs repliables (accordéon) par section : un titre
    // cliquable, suivi de ses sous-catégories cachées tant qu'on ne l'a pas ouvert.
    const sections = [];
    let current = null;
    tree.forEach(c => {
      const secTitle = c.section || '';
      if (!current || current.title !== secTitle) {
        current = { title: secTitle, items: [] };
        sections.push(current);
      }
      current.items.push(c);
    });

    // Ouvre automatiquement la section qui contient la sous-catégorie active
    const activeSection = _sidebarContext === 'category' && currentCategory
      ? sections.find(s => s.items.some(c => c.id === currentCategory))
      : null;

    subcatsEl.innerHTML = sections.map((s, i) => {
      const secId = `subcatDrawer${i}`;
      const isOpen = activeSection === s;
      return `
        <button type="button" class="cat-sidebar-subcat-drawer-toggle${isOpen ? ' open' : ''}" onclick="_toggleSubcatDrawer('${secId}', this)">
          <span>${escapeHtml(s.title)}</span>
          <span class="cat-sidebar-subcat-drawer-arrow">›</span>
        </button>
        <div id="${secId}" class="cat-sidebar-subcat-drawer-body" style="display:${isOpen ? 'block' : 'none'};">
          ${s.items.map(c => {
            const isActive = _sidebarContext === 'category' && currentCategory === c.id;
            return `<button class="cat-sidebar-subcat-btn${isActive ? ' active' : ''}" onclick="openCategory('${c.id}','${treeType}')">${escapeHtml(c.label)}</button>`;
          }).join('')}
        </div>
      `;
    }).join('');
  }
}

// ---- Tiroir de sous-catégories : un seul ouvert à la fois (accordéon) ----
function _toggleSubcatDrawer(secId, btn) {
  const body = document.getElementById(secId);
  if (!body) return;
  const wasOpen = body.style.display === 'block';

  // Referme tous les autres tiroirs de la même liste
  const container = btn.closest('#homeCatSidebarSubcats');
  if (container) {
    container.querySelectorAll('.cat-sidebar-subcat-drawer-body').forEach(el => el.style.display = 'none');
    container.querySelectorAll('.cat-sidebar-subcat-drawer-toggle').forEach(el => el.classList.remove('open'));
  }

  if (!wasOpen) {
    body.style.display = 'block';
    btn.classList.add('open');
  }
  if (typeof _updateSidebarScrollThumb === 'function') {
    const scrollEl = document.getElementById('homeCatSidebarSubcats');
    if (scrollEl) _updateSidebarScrollThumb(scrollEl);
  }
}
window._toggleSubcatDrawer = _toggleSubcatDrawer;

// ---- (ancienne requête directe sellers.category — retirée, non fiable, voir
// _populateHomeSidebarSellersFromProducts ci-dessus pour la logique actuelle) ----

// ---- Ouverture / fermeture du tiroir accueil ----
function openHomeSidebar() {
  const sb = document.getElementById('homeCatSidebar');
  const ov = document.getElementById('homeCatSidebarOverlay');
  if (sb) sb.classList.add('open');
  if (ov) ov.classList.add('open');
  if (typeof _refreshAllSidebarScrollThumbs === 'function') {
    setTimeout(_refreshAllSidebarScrollThumbs, 50); // après la transition d'ouverture
  }
}
function closeHomeSidebar() {
  const sb = document.getElementById('homeCatSidebar');
  const ov = document.getElementById('homeCatSidebarOverlay');
  if (sb) sb.classList.remove('open');
  if (ov) ov.classList.remove('open');
}
function toggleHomeSidebar() {
  const sb = document.getElementById('homeCatSidebar');
  if (!sb) return;
  sb.classList.contains('open') ? closeHomeSidebar() : openHomeSidebar();
}
function homeSidebarSelectVille(value, label) {
  selectVille(value, label);
  _populateHomeSidebarStatic();
  if (_sidebarContext === 'category' && currentCategory) {
    openCategory(currentCategory, currentCategoryType);
  } else if (_sidebarContext === 'grossiste') {
    openGrossistePage();
  } else if (_sidebarContext === 'service') {
    openServicePage();
  } else {
    loadHomeFeed();
  }
  closeHomeSidebar();
}
function openSellerFromHomeSidebar(sellerId) {
  closeHomeSidebar();
  openSellerProducts(sellerId, currentCategoryType || 'B');
}
window.openHomeSidebar          = openHomeSidebar;
window.closeHomeSidebar         = closeHomeSidebar;
window.toggleHomeSidebar        = toggleHomeSidebar;
window.homeSidebarSelectVille   = homeSidebarSelectVille;
window.openSellerFromHomeSidebar = openSellerFromHomeSidebar;

// ================================================================
// BANDEAU PROMO ACCUEIL — Grossiste / Service (top 10 en position, défilement auto)
// ================================================================
let _homePromoGrossiste = { items: [], idx: 0, timer: null };
let _homePromoService   = { items: [], idx: 0, timer: null };

// ================================================================
// CLASSEMENT DES VENDEURS PAR SECTION (Boutique & Vendeur / Grossiste / Service)
// Priorité aux positions manuelles définies par l'admin (ordre croissant),
// puis les autres vendeurs classés par nombre de publications actives dans
// cette section (ordre décroissant) — ceux qui publient régulièrement montent,
// ceux qui publient peu ou pas restent en bas.
// ================================================================
async function getSectionRankedSellers(section, limit) {
  try {
    const tree = section === 'A' ? TREE_A : (section === 'B1' ? TREE_B1 : TREE_B2);
    const posField = section === 'A' ? 'position_grossiste' : (section === 'B1' ? 'position_service' : 'position_boutique');
    const catIds = (tree || []).map(c => c.id);
    if (!catIds.length) return [];

    // 1) Compter les publications actives par vendeur, dans cette section
    const { data: products } = await db.from(TABLES.PRODUCTS)
      .select('seller_id')
      .in('seller_category', catIds)
      .eq('is_active', true);

    const counts = {};
    (products || []).forEach(p => { counts[p.seller_id] = (counts[p.seller_id] || 0) + 1; });
    const sellerIds = Object.keys(counts);
    if (!sellerIds.length) return [];

    // 2) Infos vendeur + position manuelle éventuelle (peut être NULL)
    const { data: sellers } = await db.from(TABLES.SELLERS)
      .select(`id, full_name, photo, ville, stars, badge, is_blocked, is_active, ${posField}`)
      .in('id', sellerIds)
      .eq('is_blocked', false)
      .eq('is_active', true);

    const list = (sellers || []).map(s => ({
      ...s,
      _count: counts[s.id] || 0,
      _override: s[posField]
    }));

    list.sort((a, b) => {
      const aHas = a._override !== null && a._override !== undefined;
      const bHas = b._override !== null && b._override !== undefined;
      if (aHas && bHas) return a._override - b._override;
      if (aHas) return -1;
      if (bHas) return 1;
      return b._count - a._count; // plus de publications = mieux classé
    });

    return limit ? list.slice(0, limit) : list;
  } catch (e) {
    console.error('getSectionRankedSellers error:', e);
    return [];
  }
}
window.getSectionRankedSellers = getSectionRankedSellers;

async function _fetchHomePromoSellers(section) {
  try {
    const ranked = await getSectionRankedSellers(section, 10);
    if (!ranked.length) return [];

    const tree = section === 'A' ? TREE_A : (section === 'B1' ? TREE_B1 : TREE_B2);
    const catIds = (tree || []).map(c => c.id);
    const sellerIds = ranked.map(s => s.id);
    const nameById = {};
    ranked.forEach(s => { nameById[s.id] = s.full_name; });

    const { data: products, error: prodError } = await db
      .from(TABLES.PRODUCTS)
      .select('id, name, image, seller_id, created_at')
      .in('seller_id', sellerIds)
      .in('seller_category', catIds)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(60);

    if (prodError || !products) return [];

    // Un seul (le plus récent) par vendeur, dans l'ordre de classement déjà trié
    const bySeller = {};
    products.forEach(p => {
      if (!bySeller[p.seller_id]) bySeller[p.seller_id] = p;
    });

    return sellerIds
      .filter(id => bySeller[id])
      .map(id => ({
        image: bySeller[id].image,
        name: bySeller[id].name,
        sellerName: nameById[id] || ''
      }));
  } catch (e) {
    console.error('_fetchHomePromoSellers error:', e);
    return [];
  }
}

function _renderHomePromoFrame(state, imgId, nameId) {
  const imgEl  = document.getElementById(imgId);
  const nameEl = document.getElementById(nameId);
  if (!imgEl || !state.items.length) return;
  const item = state.items[state.idx];
  imgEl.style.opacity = '0';
  setTimeout(() => {
    imgEl.src = item.image;
    if (nameEl) nameEl.innerText = item.sellerName;
    imgEl.style.opacity = '1';
  }, 250);
}

function _startHomePromoRotation(state, imgId, nameId) {
  if (state.timer) clearInterval(state.timer);
  if (!state.items.length) return;
  _renderHomePromoFrame(state, imgId, nameId);
  state.timer = setInterval(() => {
    state.idx = (state.idx + 1) % state.items.length;
    _renderHomePromoFrame(state, imgId, nameId);
  }, 3500);
}

async function loadHomePromoPanels() {
  const [grossisteItems, serviceItems] = await Promise.all([
    _fetchHomePromoSellers('A'),
    _fetchHomePromoSellers('B1')
  ]);

  _homePromoGrossiste.items = grossisteItems;
  _homePromoGrossiste.idx   = 0;
  _startHomePromoRotation(_homePromoGrossiste, 'homePromoGrossisteImg', 'homePromoGrossisteName');

  _homePromoService.items = serviceItems;
  _homePromoService.idx   = 0;
  _startHomePromoRotation(_homePromoService, 'homePromoServiceImg', 'homePromoServiceName');
}
window.loadHomePromoPanels = loadHomePromoPanels;

// ---- Initialisation complète de l'accueil ----
function initHomeSidebarAndFeed() {
  _sidebarContext = 'home';
  _populateHomeSidebarStatic();
  loadHomeFeed();
  loadHomePromoPanels();
  openHomeSidebar();
  _maybeShowFirstVisitTutorial();
}
window.initHomeSidebarAndFeed = initHomeSidebarAndFeed;

// ================================================================
// TUTORIEL ANIMÉ — carrousel affiché une seule fois à la toute première
// ouverture du site (côté vendeur : inscription + publication), et
// rejouable à tout moment depuis la page "Aide".
// ================================================================
const TUTORIAL_SEEN_KEY = 'moboro_tutorial_vendeur_vu';

// ---- Tutoriel VENDEUR : inscription → publication → gestion ----
const TUTORIAL_SLIDES_VENDEUR = [
  {
    emoji: '👋',
    title: 'Bienvenue sur Marché Moboro',
    text: "Le marché local-digital du Congo. Devenez vendeur en quelques minutes."
  },
  {
    emoji: '🛒',
    title: 'Comment crée ton compte',
    text: "Cliquez sur COMPTE puis sur S'INSCRIRE. Un seul compte donne accès aux 3 sections ,.",
    mockup: `
      <div class="tm-btn" style="background:linear-gradient(135deg,#1677FF,#0d5bd1);">🛒 Vendeur, Grossiste &amp; Service</div>
      <div class="tm-btn" style="background:linear-gradient(135deg,#fa8c16,#d46b08);">🛵 Transport</div>
      <div class="tutorial-mockup-caption">Page "Type de compte"</div>
    `
  },
  {
    emoji: '🎉',
    title: 'Ton code vendeur',
    text: "Une fois inscrit, note bien ton code vendeur — il te servira, avec ton PIN, à te connecter à chaque fois.",
    mockup: `
      <div class="tm-card" style="text-align:center;padding:14px;">
        <div style="font-size:12.5px;color:#389e0d;font-weight:700;">🎉 Compte créé avec succès !</div>
        <div style="margin-top:10px;padding:10px;background:#f0f7ff;border-radius:10px;">
          <div style="font-size:10.5px;color:#888;">Votre code vendeur :</div>
          <div style="font-size:19px;letter-spacing:3px;font-weight:700;color:#1677FF;">MBR0001A</div>
        </div>
      </div>
      <div class="tutorial-mockup-caption">Page de confirmation d'inscription</div>
    `
  },
  {
    emoji: '📤',
    title: 'Comment publie un produit',
    text: "Depuis Mon espace dans votre tableau de bord, appuie sur Publier un produit."
  },
  {
    emoji: '📂',
    title: 'Choisis une section',
    text: "Chaque publication commence par ce choix : où veux-tu vendre ce produit ?",
    mockup: `
      <div class="tm-btn" style="background:linear-gradient(135deg,#52c41a,#389e0d);">🛍️ Boutiques &amp; Vendeurs</div>
      <div class="tm-btn" style="background:linear-gradient(135deg,#1677FF,#0d5bd1);">🏭 Grossiste</div>
      <div class="tm-btn" style="background:linear-gradient(135deg,#fa8c16,#d46b08);">⭐ Service</div>
    `
  },
  {
    emoji: '📝',
    title: 'Remplis le formulaire',
    text: "Nom, prix, catégorie précise, taille, matière et au moins une photo — c'est tout ce qu'il faut.",
    mockup: `
      <div class="tm-input">Nom du produit *</div>
      <div class="tm-input">💰 Prix (FCFA) *</div>
      <div class="tm-input">📂 Choisir une catégorie *</div>
      <div class="tm-btn" style="background:#1677FF;margin-top:4px;">📷 Ajouter une photo</div>
    `
  },
  {
    emoji: '📦',
    title: 'Gère tes publications',
    text: "Retrouve tous tes produits dans Mes publications — modifie ou supprime à tout moment.",
    mockup: `
      <div class="tm-card">
        <img src="https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=200" alt="">
        <div class="tm-card-name">Mon produit</div>
        <div class="tm-card-price">15 000 FCFA</div>
        <div class="tm-row" style="margin-top:8px;">
          <div class="tm-btn" style="background:#1677FF;font-size:11px;padding:7px;">✏️ Modifier</div>
          <div class="tm-btn" style="background:#ff4d4f;font-size:11px;padding:7px;">🗑 Supprimer</div>
        </div>
      </div>
    `
  },
  {
    emoji: '💰',
    title: 'Modifie un prix',
    text: "Dans Modifier, change n'importe quelle information — le prix, le nom, la photo — puis enregistre.",
    mockup: `
      <div class="tm-input" style="border-color:#1677FF;color:#333;">💰 15 000 → 12 000 FCFA</div>
      <div class="tm-btn" style="background:#52c41a;">💾 Enregistrer</div>
    `
  },
  {
    emoji: '🔥',
    title: 'Mets en promo',
    text: "Envoyer en promo pour booster tes ventes avec un prix temporaire réduit, suivi dans Mes promos.",
    mockup: `
      <div class="tm-btn" style="background:linear-gradient(135deg,#ff4d4f,#d42020);">🔥 Envoyer en promo</div>
    `
  },
  {
    emoji: '❓',
    title: "Besoin d'aide plus tard ?",
    text: "Le bouton \"❓\" en bas de l'écran te permet de revoir ce tutoriel, ou celui des acheteurs, à tout moment."
  },
];

// ---- Tutoriel ACHETEUR : sections, recherche, filtres, commande, avis ----
const TUTORIAL_SLIDES_ACHETEUR = [
  {
    emoji: '👋',
    title: 'Bienvenue sur Marché Moboro',
    text: "Le marché local-digital du Congo. Voici comment trouver plus rapidement et commander, très simple."
  },
  {
    emoji: '🗂️',
    title: 'Les 3 sections',
    text: "Chaque section a son propre catalogue — accessibles depuis la barre du bas.",
    mockup: `
      <div class="tm-section-header"><span>🛍️ Boutiques &amp; Vendeurs/ 🏠Acceuil</span></div>
      <p style="font-size:11px;color:#888;text-align:left;margin:0 0 8px;">Vente au détail, tout type de produits</p>
      <div class="tm-section-header"><span>🏭 Grossiste</span></div>
      <p style="font-size:11px;color:#888;text-align:left;margin:0 0 8px;">Achats en grande quantité, prix de gros</p>
      <div class="tm-section-header"><span>⭐ Service</span></div>
      <p style="font-size:11px;color:#888;text-align:left;margin:0;">Prestataires : plombier, coiffeur, restaurant...</p>
    `
  },
  {
    emoji: '🔍',
    title: 'Recherche un produit',
    text: "La barre de recherche en haut de l'accueil trouve un produit, un vendeur ou même tout les vendeurs d'un quartier.",
    mockup: `<div class="tm-input"><span class="tm-search-icon">🔍</span>Produit, vendeur, quartier...</div>`
  },
  {
    emoji: '📂',
    title: 'Filtre avec la sidebar',
    text: "Le bouton bleu > sur le côté gauche de l'écran ouvre un tiroir pour filtrer par ville, sous-catégorie ou vendeur.",
    mockup: `
      <div class="tm-sidebar-item tm-active">📍 Toutes les villes</div>
      <div class="tm-sidebar-item">Brazzaville</div>
      <div class="tm-sidebar-item">Pointe-Noire</div>
      <div style="height:6px;"></div>
      <div class="tm-sidebar-item tm-active">👔 Mode Homme</div>
      <div class="tm-sidebar-item">Chemise</div>
    `
  },
  {
    emoji: '📞',
    title: 'Commande directement',
    text: "Sur chaque fiche produit : WhatsApp pour discuter et négocier, ou l'appel pour aller plus vite. 0% de commission.",
    mockup: `
      <div class="tm-card">
        <img src="https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=200" alt="">
        <div class="tm-card-name">Produit</div>
        <div class="tm-card-price">15 000 FCFA</div>
        <div class="tm-row" style="margin-top:8px;justify-content:center;">
          <div class="tm-icon-btn" style="background:#25D366;">💬</div>
          <div class="tm-icon-btn" style="background:#1677FF;">📞</div>
          <div class="tm-icon-btn" style="background:#1677FF;">🛒</div>
        </div>
      </div>
    `
  },
  {
    emoji: '⭐',
    title: 'Regarde les avis',
    text: "Avant de commander, consulte la note du vendeur et les avis vérifiés d'autres acheteurs.",
    mockup: `
      <div class="tm-card" style="text-align:center;">
        <div class="tm-stars">★★★★☆</div>
        <div style="font-size:12px;color:#666;margin-top:4px;">4.2 (12 avis vérifiés)</div>
      </div>
    `
  },
  {
    emoji: '❓',
    title: "Besoin d'aide plus tard ?",
    text: "Le bouton \"❓\" en bas de l'écran te permet de revoir ce tutoriel, ou celui des vendeurs, à tout moment."
  },
];

// ---- Tutoriel TAXI (Livreur) : inscription → PIN → code livreur → grille de tarifs ----
const TUTORIAL_SLIDES_LIVREUR = [
  {
    emoji: '🛵',
    title: 'Comment créé ton compte pour le Taxi',
    text: "Cliquez sur COMPTE visible sur la barre en bas puis S'INSCRIRE en suite choisis � TRANSPORT pour rejoindre le réseau de Taxi sur Moboro.",
    mockup: `
      <div class="tm-btn" style="background:linear-gradient(135deg,#1677FF,#0d5bd1);">🛒 Vendeur, Grossiste &amp; Service</div>
      <div class="tm-btn" style="background:linear-gradient(135deg,#fa8c16,#d46b08);">🛵 Transport</div>
      <div class="tutorial-mockup-caption">Page "Type de compte"</div>
    `
  },
  {
    emoji: '📝',
    title: 'Remplissez le formulaire',
    text: "Nom, téléphone, ville, quartiers desservis, type de véhicule (moto, voiture, minibus...) et une photo de profil.",
    mockup: `
      <div class="tm-input">Nom complet *</div>
      <div class="tm-input">📞 Numéro complet *</div>
      <div class="tm-input">🏙️ Choisir ta ville *</div>
      <div class="tm-input">🛵 Type de véhicule *</div>
    `
  },
  {
    emoji: '🔒',
    title: 'Crée le PIN',
    text: "Un code PIN de 4 chiffres pour sécuriser ton compte, à confirmer une seconde fois.",
    mockup: `
      <div class="tm-input">Ton PIN (minimum 4 chiffres)</div>
      <div class="tm-input">Confirmer ton PIN</div>
      <div class="tm-btn" style="background:linear-gradient(135deg,#fa8c16,#d46b08);">🚚 Créer mon compte</div>
    `
  },
  {
    emoji: '🎉',
    title: 'Ton code Taxi',
    text: "Inscription réussie ! Note bien ton code livreur(capture d'écran)— il te servira, avec ton PIN, à te connecter.",
    mockup: `
      <div class="tm-card" style="text-align:center;padding:14px;">
        <div style="font-size:12.5px;color:#389e0d;font-weight:700;">🎉 Inscription réussie !</div>
        <div style="margin-top:10px;padding:10px;background:#fff7e6;border-radius:10px;">
          <div style="font-size:10.5px;color:#888;">Votre code livreur :</div>
          <div style="font-size:19px;letter-spacing:3px;font-weight:700;color:#fa8c16;">MBRL001A</div>
        </div>
      </div>
      <div class="tutorial-mockup-caption">Page de confirmation d'inscription</div>
    `
  },
  {
    emoji: '📋',
    title: 'Remplis la grille de tarifs',
    text: "Connecte-toi puis, dans ton tableau de bord, appuie sur Modifier ma grille pour fixer tes prix par tranche de distance.",
    mockup: `
      <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
        <div class="tm-input" style="margin:0;flex:1;">De...</div>
        <div class="tm-input" style="margin:0;flex:1;">À...</div>
        <div class="tm-input" style="margin:0;width:56px;">FCFA</div>
      </div>
      <div class="tm-btn" style="background:linear-gradient(135deg,#52c41a,#389e0d);margin-top:6px;">💾 Sauvegarder la grille</div>
    `
  },
  {
    emoji: '❓',
    title: "Besoin d'aide plus tard ?",
    text: "Le bouton \"❓\" en bas de l'écran te permet de revoir ce tutoriel, ou celui des vendeurs et acheteurs, à tout moment."
  },
];

let _tutorialIndex = 0;
let _tutorialActiveType = 'vendeur';

function _tutorialSlidesFor(type) {
  if (type === 'acheteur') return TUTORIAL_SLIDES_ACHETEUR;
  if (type === 'livreur') return TUTORIAL_SLIDES_LIVREUR;
  return TUTORIAL_SLIDES_VENDEUR;
}

function _renderTutorialSlides(type) {
  const container = document.getElementById('tutorialSlides');
  const dotsEl = document.getElementById('tutorialDots');
  if (!container) return;
  const slides = _tutorialSlidesFor(type);

  container.innerHTML = slides.map((s, i) => `
    <div class="tutorial-slide${i === 0 ? ' active' : ''}" data-slide="${i}">
      <div class="emoji">${s.emoji}</div>
      <h2>${escapeHtml(s.title)}</h2>
      <p>${escapeHtml(s.text)}</p>
      ${s.mockup ? `<div class="tutorial-mockup">${s.mockup}</div>` : ''}
    </div>
  `).join('');

  dotsEl.innerHTML = slides.map((_, i) =>
    `<div class="tutorial-dot${i === 0 ? ' active' : ''}" data-dot="${i}"></div>`
  ).join('');

  container.dataset.builtFor = type;
}

function _showTutorialSlide(index) {
  _tutorialIndex = index;
  document.querySelectorAll('#tutorialSlides .tutorial-slide').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.slide) === index);
  });
  document.querySelectorAll('#tutorialDots .tutorial-dot').forEach(el => {
    el.classList.toggle('active', Number(el.dataset.dot) === index);
  });
  const nextBtn = document.getElementById('tutorialNextBtn');
  const prevBtn = document.getElementById('tutorialPrevBtn');
  const isLast = index === _tutorialSlidesFor(_tutorialActiveType).length - 1;
  if (nextBtn) nextBtn.innerText = isLast ? "C'est parti !" : 'Suivant';
  if (prevBtn) prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
}

function nextTutorialSlide() {
  if (_tutorialIndex >= _tutorialSlidesFor(_tutorialActiveType).length - 1) {
    finishTutorial();
    return;
  }
  _showTutorialSlide(_tutorialIndex + 1);
}
window.nextTutorialSlide = nextTutorialSlide;

function prevTutorialSlide() {
  if (_tutorialIndex <= 0) return;
  _showTutorialSlide(_tutorialIndex - 1);
}
window.prevTutorialSlide = prevTutorialSlide;

function finishTutorial() {
  const overlay = document.getElementById('tutorialOverlay');
  if (overlay) overlay.style.display = 'none';
  try { localStorage.setItem(TUTORIAL_SEEN_KEY, '1'); } catch (e) {}
}
window.finishTutorial = finishTutorial;

// ---- Glissement tactile (swipe) pour naviguer entre les slides ----
let _tutorialSwipeInit = false;
function _initTutorialSwipe() {
  if (_tutorialSwipeInit) return;
  _tutorialSwipeInit = true;
  const el = document.getElementById('tutorialSlides');
  if (!el) return;
  let startX = 0, startY = 0, tracking = false;
  el.addEventListener('touchstart', (e) => {
    if (!e.touches || !e.touches.length) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (!tracking) return;
    tracking = false;
    const touch = e.changedTouches && e.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    // Ignore les glissements trop verticaux (scroll) ou trop courts.
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) {
      nextTutorialSlide();
    } else {
      prevTutorialSlide();
    }
  }, { passive: true });
}

// type: 'vendeur' | 'acheteur' | 'livreur'
function openTutorialOverlay(type) {
  _tutorialActiveType = (type === 'acheteur' || type === 'livreur') ? type : 'vendeur';
  _renderTutorialSlides(_tutorialActiveType);
  _showTutorialSlide(0);
  _initTutorialSwipe();
  const overlay = document.getElementById('tutorialOverlay');
  if (overlay) overlay.style.display = 'flex';
}
window.openTutorialOverlay = openTutorialOverlay;

// Appelée une seule fois, automatiquement, à la toute première visite
// (tutoriel vendeur par défaut — l'acheteur reste accessible via "Aide").
// Appelée une seule fois, automatiquement, à la toute première visite —
// ouvre la page de choix ("Aide") plutôt qu'un tutoriel directement, pour
// laisser la personne choisir vendeur ou acheteur (ou juste lire la
// présentation du site).
function _maybeShowFirstVisitTutorial() {
  let seen = null;
  try { seen = localStorage.getItem(TUTORIAL_SEEN_KEY); } catch (e) {}
  if (!seen) {
    showPage('helpPage');
    try { localStorage.setItem(TUTORIAL_SEEN_KEY, '1'); } catch (e) {}
  }
}

// ================================================================
// BARRE DE NAVIGATION FIXE (bas) — Accueil / Grossiste / Service / Compte / Aide
// ================================================================
function bottomNavGo(tab) {
  document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.bottom-nav-item[data-tab="${tab}"]`);
  if (activeBtn) activeBtn.classList.add('active');

  if (tab === 'accueil') {
    goHome();
  } else if (tab === 'grossiste') {
    openGrossistePage();
  } else if (tab === 'service') {
    openServicePage();
  } else if (tab === 'compte') {
    openAccountChoice();
  } else if (tab === 'aide') {
    showPage('helpPage');
  }
}
function openAccountChoice() {
  const sheet   = document.getElementById('accountChoiceSheet');
  const overlay = document.getElementById('accountChoiceOverlay');
  if (sheet)   sheet.classList.add('open');
  if (overlay) overlay.classList.add('open');
}
function closeAccountChoice() {
  const sheet   = document.getElementById('accountChoiceSheet');
  const overlay = document.getElementById('accountChoiceOverlay');
  if (sheet)   sheet.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
  // Remettre "Accueil" actif visuellement puisque le menu Compte n'est qu'un choix, pas une page
  document.querySelectorAll('.bottom-nav-item').forEach(btn => btn.classList.remove('active'));
  const homeBtn = document.querySelector('.bottom-nav-item[data-tab="accueil"]');
  if (homeBtn) homeBtn.classList.add('active');
}
window.bottomNavGo        = bottomNavGo;
window.openAccountChoice  = openAccountChoice;
window.closeAccountChoice = closeAccountChoice;

// ================================================================
// PAGES DÉDIÉES — Grossiste & Importateur / Services
// Même traitement que la page catégorie (openCategory) : titre + retour +
// sidebar de filtres (villes, sous-catégories du groupe, vendeurs) + grille,
// mais sur TOUTES les catégories du groupe d'un coup (pas une seule sous-catégorie).
// ================================================================
async function _openGroupPage(tree, title, ctx) {
  try {
    window.currentViewedSeller = null;
    currentCategory     = null;
    currentCategoryType = 'A';
    _sidebarContext      = ctx; // avant showPage() : sert à synchroniser la barre du bas

    document.getElementById('sellerNameTitle').innerText    = title;
    document.getElementById('sellerNameSubtitle').innerText = '';

    showPage('productsPage');
    document.getElementById('productsList').innerHTML = '<div class="loading">Chargement...</div>';
    const simBlock = document.getElementById('similarSellersBlock');
    if (simBlock) simBlock.innerHTML = '';
    updateCartUI();

    const catIds = (tree || []).map(c => c.id);
    if (!catIds.length) { renderProducts([], 'A'); return; }

    const villeFilter = typeof _selectedVille !== 'undefined' ? _selectedVille : '';

    let query = db
      .from(TABLES.PRODUCTS)
      .select('id, name, price, description, image, seller_id, is_active, created_at, qte_min, prix_min, qte_max, prix_max, taille, couleur, matiere, seller_category, sellers!inner(id, full_name, phone, quartier, ville, is_blocked, is_active, account_type, stars, badge, position_grossiste, position_service)')
      .in('seller_category', catIds)
      .eq('is_active', true)
      .eq('sellers.is_blocked', false)
      .eq('sellers.is_active', true);

    if (villeFilter) query = query.ilike('sellers.ville', `%${villeFilter}%`);

    // Respect du positionnement/dynamisme du vendeur, propre à chaque section.
    const posField = ctx === 'grossiste' ? 'position_grossiste' : 'position_service';
    const { data: products, error } = await query
      .order(posField, { foreignTable: 'sellers', ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('_openGroupPage error:', JSON.stringify(error));
      document.getElementById('productsList').innerHTML =
        '<p style="text-align:center;padding:20px;color:#888;">Erreur de chargement.</p>';
      return;
    }

    renderProducts(products || [], 'A');

    // renderProducts() remet _sidebarContext à 'category' (cas d'une seule
    // sous-catégorie via openCategory) : on le corrige ici pour que la
    // sidebar affiche bien tout l'arbre du groupe, sans sous-catégorie active.
    _sidebarContext = ctx;
    _populateHomeSidebarStatic();
    _populateHomeSidebarSellersFromProducts(products || []);
  } catch (e) {
    console.error('_openGroupPage error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }
}

function openGrossistePage() {
  _openGroupPage(typeof TREE_A !== 'undefined' ? TREE_A : [], '🏭 Grossiste & Importateurs', 'grossiste');
}
window.openGrossistePage = openGrossistePage;

function openServicePage() {
  _openGroupPage(typeof TREE_B1 !== 'undefined' ? TREE_B1 : [], '⭐ Services', 'service');
}
window.openServicePage = openServicePage;

// ================================================================
// BOUTON FLOTTANT SIDEBAR — déplaçable verticalement le long du bord,
// position mémorisée. Un tap (sans glissement) ouvre/ferme la sidebar.
// ================================================================
(function initSidebarFabDrag() {
  const FAB_POS_KEY = 'moboro_fab_top_pos';

  function setup() {
    const fab = document.getElementById('homeSidebarToggleBtn');
    if (!fab) return;

    // Restaurer la position mémorisée
    const savedTop = localStorage.getItem(FAB_POS_KEY);
    if (savedTop) {
      fab.style.top = savedTop;
      fab.style.transform = 'none';
    }

    // Pointer Events : gère souris/tactile/stylet de façon unifiée et fiable
    // (évite les soucis de "click" synthétique en double, et de touchcancel
    // qui bloquait le bouton après un scroll).
    let startY = 0, startTop = 0, dragging = false, moved = false, startTime = 0;

    fab.addEventListener('pointerdown', e => {
      dragging = true; moved = false;
      startY = e.clientY;
      startTop = fab.getBoundingClientRect().top;
      startTime = Date.now();
      try { fab.setPointerCapture(e.pointerId); } catch (err) {}
    });

    fab.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dy = e.clientY - startY;
      if (Math.abs(dy) > 10) moved = true;
      if (moved) {
        let newTop = startTop + dy;
        const maxTop = window.innerHeight - fab.offsetHeight - 66; // dégage la barre du bas
        newTop = Math.max(60, Math.min(newTop, maxTop));
        fab.style.top = newTop + 'px';
        fab.style.transform = 'none';
      }
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        localStorage.setItem(FAB_POS_KEY, fab.style.top);
      } else if (Date.now() - startTime < 500) {
        toggleHomeSidebar();
      }
    }

    fab.addEventListener('pointerup', endDrag);
    fab.addEventListener('pointercancel', () => { dragging = false; });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();

// ================================================================
// INDICATEUR DE DÉFILEMENT CUSTOM (tiroir filtres) — toujours visible,
// contrairement à la barre native qui s'estompe après le scroll sur mobile.
// ================================================================
function _updateSidebarScrollThumb(el) {
  const wrap = el.closest('.cat-sidebar-scroll-wrap');
  if (!wrap) return;
  const thumb = wrap.querySelector('.cat-sidebar-scrollbar-thumb');
  const track = wrap.querySelector('.cat-sidebar-scrollbar-track');
  if (!thumb || !track) return;

  const { scrollTop, scrollHeight, clientHeight } = el;
  if (scrollHeight <= clientHeight + 1) {
    // Rien à défiler : on cache la piste et le pouce
    track.style.display = 'none';
    thumb.style.display = 'none';
    return;
  }
  track.style.display = 'block';
  thumb.style.display = 'block';

  const trackHeight = clientHeight;
  const thumbHeight = Math.max(24, (clientHeight / scrollHeight) * trackHeight);
  const maxThumbTop = trackHeight - thumbHeight;
  const thumbTop = (scrollTop / (scrollHeight - clientHeight)) * maxThumbTop;

  thumb.style.height = thumbHeight + 'px';
  thumb.style.top = thumbTop + 'px';
}
window._updateSidebarScrollThumb = _updateSidebarScrollThumb;

// Recalcule les 3 indicateurs (villes / sous-catégories / vendeurs) après
// que leur contenu a été injecté dynamiquement en JS.
function _refreshAllSidebarScrollThumbs() {
  ['homeCatSidebarVilles', 'homeCatSidebarSubcats', 'homeCatSidebarSellers'].forEach(id => {
    const el = document.getElementById(id);
    if (el) _updateSidebarScrollThumb(el);
  });
}
window._refreshAllSidebarScrollThumbs = _refreshAllSidebarScrollThumbs;

// Observe les 3 listes : dès que leur innerHTML change (peu importe la
// fonction qui les remplit), on recalcule l'indicateur automatiquement —
// pas besoin de modifier chaque fonction de rendu une par une.
(function initSidebarScrollObservers() {
  function setup() {
    ['homeCatSidebarVilles', 'homeCatSidebarSubcats', 'homeCatSidebarSellers'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new MutationObserver(() => _updateSidebarScrollThumb(el));
      obs.observe(el, { childList: true, subtree: true, characterData: true });
    });
    window.addEventListener('resize', _refreshAllSidebarScrollThumbs);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setup);
  } else {
    setup();
  }
})();