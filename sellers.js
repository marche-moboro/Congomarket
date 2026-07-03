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

// ✅ CORRECTION 3 : addToCartFromBtn remplace l'injection de p.name dans onclick
function addToCartFromBtn(btn) {
  addToCart(btn.dataset.id, btn.dataset.name, Number(btn.dataset.price));
}

let currentCategory     = '';
let currentCategoryType = ''; // 'A' ou 'B'

// ================================================================
// Ouvrir une catégorie
// ================================================================
async function openCategory(catId, type) {
  try {
  currentCategory     = catId;
  currentCategoryType = type;

  const title = ALL_CATEGORIES[catId] || 'Vendeurs';
  document.getElementById('categoryTitle').innerText = title;

  showPage('sellersPage');
  document.getElementById('sellerList').innerHTML =
    '<div class="loading">Chargement...</div>';

  await loadSellers(catId);

  } catch(e) {
    console.error('openCategory error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

// ================================================================
// Charger vendeurs d'une catégorie
// ================================================================
let _sellersPage = 0;
let _sellersTotal = 0;
let _sellersCatId = '';
let _productsAll      = [];
let _productsPage     = 0;
const PRODUCTS_PER_PAGE = 10;

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
  .select('id, full_name, photo, category, quartier, ville, description, stars, badge, phone, position, dynamisme_score, account_type', { count: 'exact' })
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
            <h3>${escapeHtml(seller.full_name)}</h3>
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

    document.getElementById('sellerNameTitle').innerText    = seller.full_name;
    document.getElementById('sellerNameSubtitle').innerText =
      '📍 ' + seller.quartier + ', ' + seller.ville;

    showPage('productsPage');
    document.getElementById('productsList').innerHTML =
      '<div class="loading">Chargement...</div>';

    const { data: products, error: prodError } = await db
      .from(TABLES.PRODUCTS)
.select('id, name, price, description, image, seller_id, is_active, created_at, qte_min, prix_min, qte_max, prix_max')
.eq('seller_id', sellerId)
.eq('is_active', true)
.order('created_at', { ascending: false });

    if (prodError) {
      console.error('openSellerProducts products error:', JSON.stringify(prodError));
    }

    renderProducts(products || [], type);

    // Enregistrer 1 vue page_open par visite vendeur (Bug 9 fix)
    recordProductView(null, sellerId, 'page_open');

    if (type === 'B') {
      document.getElementById('cartBar').style.display = 'flex';
      loadCart(sellerId);
    } else {
      document.getElementById('cartBar').style.display = 'none';
    }

  } catch (e) {
    console.error('openSellerProducts exception:', e);
    showToast('Erreur chargement publications', 'error');
  }
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
  _appendProducts(type);
}

function _appendProducts(type) {
  const list  = document.getElementById('productsList');
  const start = _productsPage * PRODUCTS_PER_PAGE;
  const slice = _productsAll.slice(start, start + PRODUCTS_PER_PAGE);
  const oldBtn = document.getElementById('loadMoreProducts');
  if (oldBtn) oldBtn.remove();

  list.insertAdjacentHTML('beforeend', slice.map(p => `
    <div class="product-card">
      <img
        src="${escapeHtml(p.image)}"
        onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=600'"
        onclick="openLightbox(this.src)"
        style="cursor:zoom-in;"
      >
      <div class="product-content">
        <h3>${escapeHtml(p.name)}</h3>
        <p class="product-price">${formatPrice(p.price)} FCFA</p>
        ${p.description ? `<p class="product-desc">${escapeHtml(p.description)}</p>` : ''}
        ${p.qte_min
          ? `<p style="font-size:12px;color:#52c41a;margin:2px 0;">Qté min : ${p.qte_min} → ${formatPrice(p.prix_min)} FCFA</p>`
          : ''}
        ${p.qte_max
          ? `<p style="font-size:12px;color:#1677FF;margin:2px 0;">Qté max : ${p.qte_max} → ${formatPrice(p.prix_max)} FCFA</p>`
          : ''}
        ${type === 'B'
          ? `<button class="add-btn"
               data-id="${p.id}"
               data-name="${escapeHtml(p.name)}"
               data-price="${p.price}"
               onclick="addToCartFromBtn(this)">
               🛒 Ajouter au panier
             </button>`
          : `<a href="https://wa.me/${formatWhatsApp(window.currentViewedSeller?.phone)}"
               target="_blank" class="contact-btn-product"
               onclick="trackWhatsappClick(window.currentViewedSeller ? window.currentViewedSeller.id : null, window.currentViewedSeller ? window.currentViewedSeller.account_type : null)">
               <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                 <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
               </svg>
               Contacter le vendeur
             </a>`
        }
      </div>
    </div>
  `).join(''));

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

function loadMoreProducts() {
  _productsPage++;
  const type = typeof currentCategoryType !== 'undefined' ? currentCategoryType : 'B';
  _appendProducts(type);
}

function goHome() {
  showPage('homePage');
  document.getElementById('cartBar').style.display = 'none';
  cart = [];
  window.currentViewedSeller = null;
  // ✅ NE PAS effacer currentSeller ici — le vendeur reste connecté
  // currentSeller est effacé uniquement par logoutSeller()
}

function goBack() {
  history.back();
}

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
// Bug 3 fix — Exposer les fonctions de sellers.js sur window
window.openCategory                = openCategory;
window.loadSellers                 = loadSellers;
window.openSellerProducts          = openSellerProducts;
window.giveStar                    = giveStar;
window.trackWhatsappClick          = trackWhatsappClick;
window.addToCartFromBtn            = addToCartFromBtn;
window.loadMoreProducts            = loadMoreProducts;
