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

  return `<div class="qty-tiers" style="margin:6px 0;border:1px solid #e8e8e8;border-radius:10px;overflow:hidden;">
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
    const { data, error } = await db.from(TABLES.PRODUCT_REVIEWS)
      .select('rating').eq('product_id', productId);
    if (error || !data || data.length === 0) {
      el.innerHTML = `<span style="font-size:11px;color:#999;">Aucun avis vérifié pour le moment</span>`;
      return;
    }
    const avg = data.reduce((s, r) => s + r.rating, 0) / data.length;
    el.innerHTML = `${renderStarsReadonly(avg)} <span style="font-size:12px;color:#666;">${avg.toFixed(1)} (${data.length} avis vérifiés)</span>`;
  } catch (e) { console.error('loadProductReviewsSummary error:', e); }
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
    if (insertError) { errorEl.innerText = 'Erreur, réessayez.'; return; }

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

window.loadSellerReviewsSummary   = loadSellerReviewsSummary;
window.openSellerReviewModal      = openSellerReviewModal;
window.closeSellerReviewModal     = closeSellerReviewModal;
window.submitSellerReview         = submitSellerReview;
window.openSellerReviewsListModal = openSellerReviewsListModal;
window.closeSellerReviewsListModal = closeSellerReviewsListModal;

// ================================================================
// PRODUITS SIMILAIRES — tous vendeurs confondus, priorité au nom, pagination 15
// ================================================================
const SIMILAR_PER_PAGE = 15;
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
        <div style="width:100px;cursor:pointer;" onclick="openSellerProducts('${sp.seller_id}', currentCategoryType || 'B')">
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

    // Lire les étoiles actuelles
    const { data: entity } = await db.from(table).select('stars').eq('id', entityId).single();
const currentStars = (entity && entity.stars ? entity.stars : 0) + 1;

    await db.from(table).update({ stars: currentStars }).eq('id', entityId);

    // Marquer localement — illimité dans le temps
    localStorage.setItem(storageKey, '1');

    // Mise à jour visuelle immédiate
    btn.style.opacity = '0.6';
    btn.disabled = true;
    btn.querySelector('span').style.color = '#fadb14';
const row = btn.closest('.star-row');
const countEl = row ? row.querySelector('.star-count') : null;
    if (countEl) countEl.innerText = `${currentStars} étoile${currentStars > 1 ? 's' : ''}`;

    // Badge dynamique
    const badgeEl = btn.closest('.star-row');
    if (badgeEl) {
      const existing = badgeEl.querySelector('.seller-badge');
      if (existing) existing.remove();
      const newBadge = getBadgeHtml(currentStars);
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
async function openCategory(catId, type) {
  try {
  currentCategory     = catId;
  currentCategoryType = type;
  window.currentViewedSeller = null;

  const title = ALL_CATEGORIES[catId] || 'Produits';
  document.getElementById('sellerNameTitle').innerText    = title;
  document.getElementById('sellerNameSubtitle').innerText = '';

  showPage('productsPage');
document.getElementById('productsList').innerHTML =
    '<div class="loading">Chargement...</div>';
  updateCartUI();

  const villeFilter = typeof _selectedVille !== 'undefined' ? _selectedVille : '';

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

  const { data: products, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('openCategory error:', JSON.stringify(error));
    document.getElementById('productsList').innerHTML =
      '<p style="text-align:center;padding:20px;color:#888;">Erreur de chargement.</p>';
    return;
  }

  renderProducts(products || [], type);

  } catch(e) {
    console.error('openCategory error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}
  
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
const PRODUCTS_PER_PAGE = 8;

async function loadSellers(catId, append = false) {
  const list = document.getElementById('sellerList');
  const villeFilter = typeof _selectedVille !== 'undefined' ? _selectedVille : '';

  if (!append) {
    _sellersPage = 0;
    _sellersCatId = catId;
    list.innerHTML = '<div class="loading">Chargement...</div>';
  }

  const from = _sellersPage * 15;
  const to = from + 14;

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
          <button class="view-btn" onclick="openSellerProducts('${seller.id}', '${currentCategoryType}')">📦 Publications</button>
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
async function openSellerProducts(sellerId, type) {
  try {
    const { data: seller, error } = await db
      .from(TABLES.SELLERS)
      .select('*')
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

    showPage('productsPage');
    document.getElementById('productsList').innerHTML =
      '<div class="loading">Chargement...</div>';

    const { data: products, error: prodError } = await db
      .from(TABLES.PRODUCTS)
.select('id, namey, price, description, image, seller_id, is_active, created_at, qte_min, prix_min, qte_max, prix_max, taille, couleur, matiere, seller_category')
.eq('seller_id', sellerId)
.eq('is_active', true)
.order('created_at', { ascending: false });

    if (prodError) {
      console.error('openSellerProducts products error:', JSON.stringify(prodError));
    }

    renderProducts(products || [], type);

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
function _productCardHtml(p) {
  const isGrossiste = typeof TREE_A_IDS !== 'undefined' && TREE_A_IDS.has(p.seller_category);
  const tierLine = isGrossiste ? renderQuantityTiersCompact(p) : '';

  return `
    <div class="product-card">
     <div class="product-img-wrap">
       <img
          src="${escapeHtml(p.image)}"
          data-product-id="${p.id}"
          data-category="${escapeHtml(p.seller_category || '')}"
          data-name="${escapeHtml(p.name)}"
          onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=600'"
          onclick="openLightbox(this.src, this.dataset.productId, this.dataset.category, this.dataset.name)"
          style="cursor:zoom-in;"
        >
        <span class="product-price-badge">${formatPrice(p.price)} FCFA</span>
        ${tierLine ? `<span class="product-tier-badge">📦 ${tierLine}</span>` : ''}
        <div class="product-name-overlay">${escapeHtml(p.name)}</div>
        <div class="product-reviews-overlay" id="reviews-${p.id}">Chargement...</div>
      </div>
    </div>
  `;
}

// ================================================================
// Afficher produits
// ================================================================
function renderProducts(products, type) {
  _productsAll  = products;
  _productsPage = 0;
  const list = document.getElementById('productsList');
  if (!products.length) {
    list.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Aucune publication pour le moment.</p>';
    return;
  }
  list.innerHTML = '';

  // Mode catégorie multi-boutiques : les produits portent p.sellers (jointure)
  if (products[0] && products[0].sellers) {
    list.style.cssText = 'display:block;padding:8px 15px 80px;';
    _renderProductsGroupedBySeller();
  } else {
    list.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:8px 15px 80px;';
    _appendProducts(type);
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