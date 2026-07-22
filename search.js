// ==================== SEARCH.JS ====================

let searchTimeout       = null;
let _searchResults      = null;
let _searchSellersPage  = 0;
let _searchProductsPage = 0;
const SEARCH_PER_PAGE   = 5;

// ================================================================
// Recherche principale
// ================================================================
function handleSearch() {
  clearTimeout(searchTimeout);
  const query = document.getElementById('searchInput').value.trim();
  // ✅ Lire _selectedVille en priorité (dropdown custom), fallback sur searchVilleFilter (legacy)
const ville = (typeof _selectedVille !== 'undefined' && _selectedVille)
  ? _selectedVille
  : '';

const searchVilleInput = document.getElementById('searchVilleFilter');
const searchVille = searchVilleInput && searchVilleInput.value
  ? searchVilleInput.value.trim()
  : '';

if (!query && ville) {
  searchTimeout = setTimeout(function () {
    performSearch('', ville);
  }, 300);
  return;
}

  if (query.length < 2 && !ville) {
    if (document.getElementById('searchResultsPage').style.display === 'block') {
      showPage('homePage');
    }
    return;
  }

  if (query.length >= 2 || ville) {
    searchTimeout = setTimeout(() => performSearch(query, ville), 400);
  }
}

// ================================================================
// Effectuer la recherche
// ================================================================
// Bug 6 fix — CETTE version (avec villeFilter) est la seule valide.
// L'ancienne version dans index.html (ligne 2908, sans villeFilter) doit être supprimée.
async function performSearch(query, villeFilter = '') {
  showPage('searchResultsPage');
  const displayQuery = query || villeFilter;
  document.getElementById('searchResultsTitle').innerText = `Résultats pour "${displayQuery}"`;
  document.getElementById('searchResults').innerHTML =
    '<div class="loading">Recherche en cours...</div>';

  const q = query.toLowerCase().trim();

  // Mots-clés → catégories
  const categoryKeywords = {
    'cosmétique': 'c3', 'cosmetique': 'c3', 'beaute': 'c3', 'beauté': 'c3',
    'basket': 'c1', 'chaussure': 'c1',
    'téléphone': 'c2', 'telephone': 'c2', 'accessoire': 'c2',
    'vêtement': 'c4', 'vetement': 'c4', 'robe': 'c4',
    'sac': 'c6', 'mode': 'c6',
    'maison': 'c7', 'décoration': 'c7', 'decoration': 'c7',
    'savon': 'c8', 'naturel': 'c8',
    'parfum': 'c9', 'soin': 'c9',
    'bébé': 'c10', 'bebe': 'c10', 'enfant': 'c10',
    'perruque': 'c11', 'mèche': 'c11', 'meche': 'c11',
    'lingerie': 'c12', 'rideau': 'c12',
    'santé': 'c13', 'sante': 'c13',
    'friperie': 'c14',
    'tissu': 'c15', 'pagne': 'c15',
    'occasion': 'c16',
    'pâtisserie': 'c17', 'patisserie': 'c17',
    'électronique': 'c20', 'electronique': 'c20', 'télé': 'c20', 'tele': 'c20',
    'immobilier': 'immo',
    'coiffure': 'coiffure',
    'hôtel': 'hotel', 'hotel': 'hotel',
    'mariage': 'deco-mariage',
    'ménage': 'menage', 'menage': 'menage',
    'grossiste': 'ig', 'importateur': 'ig',
'ambulance': 'ambulance', 'taxi': 'ambulance',
'moto': 'moto-taxi', 'moto taxi': 'moto-taxi',
'chambre froide': 'chambre-froide', 'froide': 'chambre-froide',
'hopital': 'hopital', 'hôpital': 'hopital', 'clinique': 'hopital',
'meuble': 'meubles', 'meubles': 'meubles'
  };

  let results = { sellers: [], products: [] };

  try {
    // 1. Produit + prix (ex: "robe 15000")
    const priceMatch = q.match(/(.+?)\s+(\d+)\s*(?:fcfa|f)?$/i);

    if (priceMatch) {
      const productName = priceMatch[1].trim();
      const targetPrice = Number(priceMatch[2]);
      const min = targetPrice * 0.95;
      const max = targetPrice * 1.05;

      const { data: products, error } = await db.from(TABLES.PRODUCTS)
        .select('*, sellers!inner(full_name, phone, quartier, ville, is_blocked)')
        .ilike('name', `%${productName}%`)
        .gte('price', min)
        .lte('price', max)
        .eq('is_active', true)
        .eq('sellers.is_blocked', false);

      if (error) console.error('search price error:', JSON.stringify(error));

      results.products = products || [];
      renderSearchResults(
        results,
        `Produits "${productName}" autour de ${formatPrice(targetPrice)} FCFA (±5%)`
      );
      return;
    }

    // --- Si seulement filtre ville (pas de texte) ---
    if (!q && villeFilter) {
      let qVille = db.from(TABLES.SELLERS)
        .select('*')
        .ilike('ville', `%${villeFilter}%`)
        .eq('is_blocked', false)
        .eq('is_active', true)
        .order('position', { ascending: true });
      if (isSubscriptionActive()) qVille = qVille.eq('subscription_status', 'en_cours');
      const { data: sellersByVille } = await qVille;
      results.sellers = sellersByVille || [];
      renderSearchResults(results, `Tous les vendeurs à ${villeFilter}`);
      return;
    }

    // 2. Quartier + catégorie (ex: "moungali basket")
    let detectedCat      = null;
    let detectedQuartier = null;

    for (const [keyword, catId] of Object.entries(categoryKeywords)) {
      if (q.includes(keyword)) {
        detectedCat      = catId;
        detectedQuartier = q.replace(keyword, '').trim();
        break;
      }
    }

    if (detectedCat && detectedQuartier) {
      let query2 = db.from(TABLES.SELLERS)
        .select('*')
        .eq('category',   detectedCat)
        .ilike('quartier', `%${detectedQuartier}%`)
        .eq('is_blocked', false)
        .eq('is_active',  true);
      if (villeFilter) query2 = query2.ilike('ville', `%${villeFilter}%`);

      const { data: sellers, error } = await query2;
      if (error) console.error('search cat+quartier error:', JSON.stringify(error));

      results.sellers = sellers || [];
      const villeLabel = villeFilter ? ` à ${villeFilter}` : ` à ${detectedQuartier}`;
      renderSearchResults(results, `Vendeurs de ${ALL_CATEGORIES[detectedCat]}${villeLabel}`);
      return;
    }

    // 3. Recherches parallèles (texte + ville optionnelle)
    function addVille(qb) {
      let q2 = villeFilter ? qb.ilike('ville', `%${villeFilter}%`) : qb;
      if (isSubscriptionActive()) q2 = q2.eq('subscription_status', 'en_cours');
      return q2;
    }

    const [
      { data: sellersByQuartier },
      { data: sellersByVilleQ   },
      { data: sellersByName     },
      { data: productsByName    }
    ] = await Promise.all([
      addVille(db.from(TABLES.SELLERS).select('*')
        .ilike('quartier', `%${q}%`)
        .eq('is_blocked', false)
        .eq('is_active',  true)),

      addVille(db.from(TABLES.SELLERS).select('*')
        .ilike('ville', `%${q || villeFilter}%`)
        .eq('is_blocked', false)
        .eq('is_active',  true)),

      addVille(db.from(TABLES.SELLERS).select('*')
        .ilike('full_name', `%${q}%`)
        .eq('is_blocked', false)
        .eq('is_active',  true)),

      db.from(TABLES.PRODUCTS)
        .select('*, sellers!inner(full_name, phone, quartier, ville, is_blocked)')
        .ilike('name', `%${q}%`)
        .eq('is_active', true)
        .eq('sellers.is_blocked', false)
    ]);

    // Fusionner vendeurs sans doublons
    const allSellers = [
      ...(sellersByQuartier || []),
      ...(sellersByVilleQ   || []),
      ...(sellersByName     || [])
    ];
    const uniqueSellers = allSellers.filter(
      (s, i, arr) => arr.findIndex(x => x.id === s.id) === i
    );

    results.sellers  = uniqueSellers;
    results.products = productsByName || [];

    const label = villeFilter ? `"${query}" à ${villeFilter}` : `"${query}"`;
    renderSearchResults(results, `Résultats pour ${label}`);

  } catch (e) {
    console.error('performSearch exception:', e);
    document.getElementById('searchResults').innerHTML =
      '<p style="text-align:center;padding:30px;color:#888;">Erreur de recherche. Réessayez.</p>';
  }
}

// ================================================================
// Afficher résultats
// ✅ CORRECTION 1 : HTML produits reconstruit — balises img et p corrigées
// ✅ CORRECTION 2 : indentation uniformisée dans le bloc vendeurs
// ================================================================
function renderSearchResults(results, title) {
  _searchResults      = results;
  _searchSellersPage  = 0;
  _searchProductsPage = 0;
  document.getElementById('searchResultsTitle').innerText = title;
  const container = document.getElementById('searchResults');

  if (!results.sellers.length && !results.products.length) {
    container.innerHTML = '<p style="text-align:center;padding:30px;color:#888;">Aucun résultat trouvé.<br>Essayez un autre mot-clé.</p>';
    return;
  }
  container.innerHTML = '';
  _appendSearchSellers();
  _appendSearchProducts();
}

function _appendSearchSellers() {
  if (!_searchResults || !_searchResults.sellers.length) return;
  const container = document.getElementById('searchResults');
  const start = _searchSellersPage * SEARCH_PER_PAGE;
  const slice = _searchResults.sellers.slice(start, start + SEARCH_PER_PAGE);
  const oldBtn = document.getElementById('loadMoreSearchSellers');
  if (oldBtn) oldBtn.remove();

  if (_searchSellersPage === 0) {
    container.insertAdjacentHTML('beforeend', `<h3 style="padding:10px 0;font-size:16px;color:#1677FF;">Vendeurs (${_searchResults.sellers.length})</h3>`);
  }
  container.insertAdjacentHTML('beforeend', slice.map(s => `
    <div class="seller-card" style="margin-bottom:12px;">
      <img src="${escapeHtml(s.photo) || 'https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'}"
           class="seller-image"
           onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'">
      <div class="seller-info">
        <h3>${escapeHtml(s.full_name)}</h3>
        <p class="seller-location">📍 ${escapeHtml(s.quartier)}, ${escapeHtml(s.ville)}</p>
        <p class="seller-desc">${escapeHtml(s.description)}</p>
        <div class="seller-actions">
          <button class="view-btn" onclick="openSellerProductsFromSearch('${s.id}')">Voir publications</button>
          <a href="https://wa.me/${formatWhatsApp(s.phone)}" target="_blank" class="contact-btn">Contacter</a>
        </div>
      </div>
    </div>
  `).join(''));

  const loaded = start + slice.length;
  if (loaded < _searchResults.sellers.length) {
    container.insertAdjacentHTML('beforeend', `
      <div id="loadMoreSearchSellers" style="text-align:center;padding:8px;">
        <button onclick="loadMoreSearchSellers()" style="background:#1677FF;color:white;border:none;padding:10px 28px;border-radius:99px;font-size:13px;font-weight:600;cursor:pointer;">
          Voir plus de vendeurs
        </button>
      </div>
    `);
  }
}

function _appendSearchProducts() {
  if (!_searchResults || !_searchResults.products.length) return;
  const container = document.getElementById('searchResults');
  const start = _searchProductsPage * SEARCH_PER_PAGE;
  const slice = _searchResults.products.slice(start, start + SEARCH_PER_PAGE);
  const oldBtn = document.getElementById('loadMoreSearchProducts');
  if (oldBtn) oldBtn.remove();

  if (_searchProductsPage === 0) {
    container.insertAdjacentHTML('beforeend', `<h3 style="padding:10px 0;font-size:16px;color:#1677FF;">Produits (${_searchResults.products.length})</h3>`);
  }
  container.insertAdjacentHTML('beforeend', slice.map(p => `
    <div class="product-card" style="margin-bottom:12px;">
      <img src="${escapeHtml(p.image)}"
           data-product-id="${p.id}"
           data-category="${escapeHtml(p.seller_category || '')}"
           data-name="${escapeHtml(p.name)}"
           onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'"
           onclick="openLightbox(this.src, this.dataset.productId, this.dataset.category, this.dataset.name)"
           style="cursor:zoom-in;">
      <div class="product-content">
        <h3>${escapeHtml(p.name)}</h3>
        <p class="seller-location">Par: ${escapeHtml((p.sellers && p.sellers.full_name) || p.seller_name || '')}</p>
        <p class="product-price">${formatPrice(p.price)} FCFA</p>
        <div id="reviews-search-${p.id}" style="margin:6px 0;">Chargement des avis...</div>
        <button onclick="openReviewModal('${p.id}','${p.seller_id}')"
          style="background:none;border:1px solid #e8e8e8;color:#1677FF;font-size:11px;font-weight:600;
                 padding:4px 10px;border-radius:20px;margin-bottom:6px;cursor:pointer;">
          ✍️ Laisser un avis vérifié
       </button>
        <a href="https://wa.me/${formatWhatsApp((p.sellers && p.sellers.phone) || p.seller_phone)}"
           target="_blank" class="contact-btn-product">Contacter le vendeur</a>
      </div>
    </div>
  `).join(''));

  slice.forEach(p => {
    loadProductReviewsSummary(p.id, `reviews-search-${p.id}`);
  });

  const loaded = start + slice.length;
  if (loaded < _searchResults.products.length) {
    container.insertAdjacentHTML('beforeend', `
      <div id="loadMoreSearchProducts" style="text-align:center;padding:8px;">
        <button onclick="loadMoreSearchProducts()" style="background:#1677FF;color:white;border:none;padding:10px 28px;border-radius:99px;font-size:13px;font-weight:600;cursor:pointer;">
          Voir plus de produits
        </button>
      </div>
    `);
  }
}

function loadMoreSearchSellers()  { _searchSellersPage++;  _appendSearchSellers(); }
function loadMoreSearchProducts() { _searchProductsPage++; _appendSearchProducts(); }

async function openSellerProductsFromSearch(sellerId) {
  try {
    const { data: seller, error } = await db.from(TABLES.SELLERS)
      .select('*').eq('id', sellerId).maybeSingle();

    if (error || !seller) {
      console.error('openSellerProductsFromSearch error:', JSON.stringify(error));
      showToast('Impossible de charger ce vendeur', 'error');
      return;
    }

    window.currentViewedSeller = seller;
    const type = seller.account_type === 'fournisseur_export'
      ? 'A'
      : (Object.keys(CATEGORIES_A).includes(seller.category) ? 'A' : 'B');
    currentCategoryType = type;
    await openSellerProducts(sellerId, type);

  } catch (e) {
    console.error('openSellerProductsFromSearch exception:', e);
  }
}

// Bug 3 fix — Exposer les fonctions de search.js sur window
window.performSearch                = performSearch;
window.openSellerProductsFromSearch = openSellerProductsFromSearch;
window.handleSearch                 = handleSearch;
window.loadMoreSearchSellers        = loadMoreSearchSellers;
window.loadMoreSearchProducts       = loadMoreSearchProducts;
