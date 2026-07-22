// ==================== APP.JS ====================

// ================================================================
// ✅ CORRECTION 1 : showPage et DOMContentLoaded supprimés
//    Ces fonctions sont déjà dans index.html en version complète
//    (avec pageHistory, headerTitles, searchBox)
//    Ce fichier ne contient que initBanner() et openAdmin()
// ================================================================

// ================================================================
// BANNER — Défilement automatique + swipe + boutons nav
// Charge d'abord depuis Supabase (banner_slides), fallback Unsplash
// ================================================================
async function initBanner() {
  // Slides par défaut (Unsplash) — utilisés si Supabase ne retourne rien
  const defaultSlides = [
    { url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=1200', title: '🛍️ Mode & Tendances',         subtitle: 'Les meilleures boutiques vous attendent' },
    { url: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?q=80&w=1200', title: '💄 Beauté & Cosmétiques',      subtitle: 'Les meilleures marques à prix imbattables' },
    { url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=1200',    title: '👟 Chaussures & Basket',       subtitle: 'Des styles pour toutes les occasions' },
    { url: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=1200', title: '🔥 Promos Exclusives',         subtitle: 'Des réductions exceptionnelles chaque jour !' },
    { url: 'https://images.unsplash.com/photo-1567401893414-76b7b1e5a7a5?q=80&w=1200', title: '👗 Vêtements Femme',           subtitle: 'Robes, ensembles tendance — livraison à domicile' },
    { url: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?q=80&w=1200',    title: '🚚 Commandez Facilement',     subtitle: 'Recevez vos achats directement chez vous' },
    { url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?q=80&w=1200',    title: '🏪 Ouvrez Votre Boutique !',  subtitle: 'Inscription 100% gratuite — Gardez 100% de vos ventes' },
    { url: 'https://images.unsplash.com/photo-1573408301185-9519f94816b5?q=80&w=1200', title: '📈 Développez Votre Activité', subtitle: 'Touchez des milliers de clients au Congo' },
    { url: 'https://images.unsplash.com/photo-1553729459-efe14ef6055d?q=80&w=1200',    title: '💰 Zéro Commission !',         subtitle: 'Vendez plus, gagnez plus — Rejoignez Marché Moboro' },
    { url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=1200', title: '🤝 Rejoignez Notre Communauté', subtitle: '500 FCFA/sem seulement — Inscrivez-vous maintenant !' }
  ];

  let bannerImages = [...defaultSlides];

  // ── Charger les slides personnalisés depuis Supabase ────────
  try {
    const { data: supaSlides } = await db.from(TABLES.BANNER_SLIDES).select('*').order('id');
    if (supaSlides && supaSlides.length > 0) {
// Remplacer uniquement les positions présentes dans Supabase (1-10)
      supaSlides.forEach(s => {
        const idx = s.id - 1; // position 1 → index 0, etc.
        if (idx >= 0 && idx < bannerImages.length) {
          bannerImages[idx] = {
            url:      s.url      || defaultSlides[idx].url,
            title:    s.title    || defaultSlides[idx].title,
            subtitle: s.subtitle || defaultSlides[idx].subtitle
          };
        }
      });
    }
  } catch(e) {
    console.warn('Banner: fallback Unsplash (Supabase inaccessible)', e.message);
  }

  let currentSlide = 0;
  let autoSlide;

  const bannerImg      = document.getElementById('bannerImg');
  const bannerTitle    = document.getElementById('bannerTitle');
  const bannerSubtitle = document.getElementById('bannerSubtitle');
  const dotsContainer  = document.getElementById('bannerDots');

  if (!bannerImg) return;

  // Précharger les images
  bannerImages.forEach(slide => { const img = new Image(); img.src = slide.url; });

  // Créer les points de navigation
  if (dotsContainer) {
    dotsContainer.innerHTML = bannerImages.map((_, i) =>
      `<span class="dot ${i === 0 ? 'active' : ''}" onclick="goToSlide(${i})"></span>`
    ).join('');
  }

  function updateBanner(index) {
    const slide = bannerImages[index];
    bannerImg.style.opacity = '0';
    setTimeout(() => {
      bannerImg.src            = slide.url;
      if (bannerTitle)    bannerTitle.innerText    = slide.title;
      if (bannerSubtitle) bannerSubtitle.innerText = slide.subtitle;
      bannerImg.style.opacity  = '1';
    }, 300);
    document.querySelectorAll('.dot').forEach((dot, i) => {
      dot.classList.toggle('active', i === index);
    });
  }

  function resetAutoSlide() {
    clearInterval(autoSlide);
    autoSlide = setInterval(() => {
      currentSlide = (currentSlide + 1) % bannerImages.length;
      updateBanner(currentSlide);
    }, 4000);
  }

  // ── Fonctions globales exposées ──────────────────────────────
  window.goToSlide = function(i) {
    currentSlide = i;
    updateBanner(currentSlide);
    resetAutoSlide();
  };

  // ✅ Boutons avant / arrière
  window.bannerPrev = function() {
    currentSlide = (currentSlide - 1 + bannerImages.length) % bannerImages.length;
    updateBanner(currentSlide);
    resetAutoSlide();
  };

  window.bannerNext = function() {
    currentSlide = (currentSlide + 1) % bannerImages.length;
    updateBanner(currentSlide);
    resetAutoSlide();
  };

  // Démarrer le défilement automatique
  resetAutoSlide();

  // Swipe tactile
  let touchStartX = 0;
  bannerImg.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; }, {passive:true});
  bannerImg.addEventListener('touchend', e => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) window.bannerNext();
      else          window.bannerPrev();
    }
  }, {passive:true});
}

// ================================================================
// ADMIN
// ================================================================
function openAdmin() {
  // ✅ Vérifier que showPage est bien chargé (défini dans index.html)
  if (typeof showPage !== 'function') {
    console.error('openAdmin: showPage non défini — index.html pas encore chargé');
    return;
  }
  showPage('adminLoginPage');
}
// ================================================================
// MODIFIER PIN
// ================================================================
async function saveNewPin() {
  const pin1 = document.getElementById('newPinInput').value.trim();
  const pin2 = document.getElementById('newPinConfirm').value.trim();
  const errEl = document.getElementById('changePinError');
  errEl.style.display = 'none';

  if (pin1.length < 4) { errEl.innerText = 'PIN trop court (minimum 4 chiffres)'; errEl.style.display = 'block'; return; }
  if (pin1 !== pin2)   { errEl.innerText = 'Les PIN ne correspondent pas';         errEl.style.display = 'block'; return; }

  try {
    const sellerCode  = localStorage.getItem('seller_code');
    const livreurCode = localStorage.getItem('livreur_code');

    if (!sellerCode && !livreurCode) {
      errEl.innerText = 'Session expirée, reconnectez-vous';
      errEl.style.display = 'block';
      return;
    }

    if (livreurCode) {
      // ── Livreur ──
      const { data: livreur } = await db.from('delivery_agents')
        .select('*').eq('code', livreurCode).single();
      if (!livreur) { errEl.innerText = 'Compte introuvable'; errEl.style.display = 'block'; return; }
      const { error } = await db.from('delivery_agents')
        .update({ pin_hash: await hashPin(pin1) }).eq('id', livreur.id);
      if (error) { errEl.innerText = 'Erreur: ' + error.message; errEl.style.display = 'block'; return; }
    } else {
      // ── Vendeur / Grossiste / Fournisseur ──
      const { data: seller } = await db.from(TABLES.SELLERS)
        .select('*').eq('code', sellerCode).single();
      if (!seller) { errEl.innerText = 'Compte introuvable'; errEl.style.display = 'block'; return; }
      const { error } = await db.from(TABLES.SELLERS)
        .update({ pin_hash: await hashPin(pin1) }).eq('id', seller.id);
      if (error) { errEl.innerText = 'Erreur: ' + error.message; errEl.style.display = 'block'; return; }
    }

    showToast('PIN modifié avec succès ✓', 'success');
    document.getElementById('newPinInput').value = '';
    document.getElementById('newPinConfirm').value = '';
    showPage('profilePage');
  } catch(e) {
    errEl.innerText = 'Erreur: ' + (e.message || '');
    errEl.style.display = 'block';
  }
}

// ================================================================
// Afficher/masquer les champs quantité selon le type de compte
// Appelé au clic sur "Publier un produit"
// ================================================================
function openPublishPage() {
  if (!currentSeller) { showPage('loginPage'); return; }

  const isGrossiste = ['independant_grossiste','vip_grossiste','fournisseur_export']
    .includes(currentSeller.account_type);

  const qteSection = document.getElementById('pubQteSection');
  if (qteSection) qteSection.style.display = isGrossiste ? 'block' : 'none';

  // Choix "mon groupe" vs "Boutique & Vendeur" — pas pour fournisseur_export
  const canChooseGroup = ['independant_grossiste','vip_grossiste','independant_service']
    .includes(currentSeller.account_type);
  const groupSection = document.getElementById('pubGroupChoiceSection');
  if (groupSection) {
    groupSection.style.display = canChooseGroup ? 'block' : 'none';
    if (canChooseGroup) {
      const ownLabel = document.getElementById('pubGroupChoiceOwnLabel');
      if (ownLabel) {
        ownLabel.innerText = currentSeller.account_type === 'independant_service'
          ? '⭐ Dans mon groupe (Multi-Services & Commerces)'
          : '🏭 Dans mon groupe (Grossiste & Importateur)';
      }
      const ownRadio = document.getElementById('pubGroupChoiceOwn');
      if (ownRadio) ownRadio.checked = true;
      populatePubRetailCategories();
    }
  }

  populatePubOwnCategories();
  updatePubGroupChoice();

  showPage('publishPage');
}

// Remplit la liste "ma catégorie" selon le type de compte :
// - Boutique & Vendeur → uniquement la grille Boutique & Vendeur (TREE_B2)
// - Grossiste & Importateur (+ Fournisseur Export) → grille Grossiste (TREE_A)
// - Multi-Services & Commerces → grille Multi-Services (TREE_B1)
function populatePubOwnCategories() {
  const select = document.getElementById('pubOwnCategory');
  if (!select) return;

  let tree = null;
  if (currentSeller.account_type === 'independant_vendeur' || currentSeller.account_type === 'vip_vendeur') {
    tree = typeof TREE_B2 !== 'undefined' ? TREE_B2 : null;
  } else if (['independant_grossiste','vip_grossiste','fournisseur_export'].includes(currentSeller.account_type)) {
    tree = typeof TREE_A !== 'undefined' ? TREE_A : null;
  } else if (currentSeller.account_type === 'independant_service') {
    tree = typeof TREE_B1 !== 'undefined' ? TREE_B1 : null;
  }

  select.innerHTML = '<option value="">Choisir une catégorie *</option>';
  if (tree) {
    tree.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.label;
      select.appendChild(opt);
    });
  }
}

function populatePubRetailCategories() {
  const select = document.getElementById('pubRetailCategory');
  if (!select || select.dataset.filled === '1') return;
  if (typeof TREE_B2 === 'undefined') return;
  TREE_B2.forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.label;
    select.appendChild(opt);
  });
  select.dataset.filled = '1';
}

// Bascule entre "ma catégorie" (TREE_A ou TREE_B1) et "catégorie détail" (TREE_B2)
function updatePubGroupChoice() {
  const retailRadio  = document.getElementById('pubGroupChoiceRetail');
  const retailSelect = document.getElementById('pubRetailCategory');
  const ownSelect     = document.getElementById('pubOwnCategory');
  const isRetail = !!(retailRadio && retailRadio.checked);

  if (retailSelect) retailSelect.style.display = isRetail ? 'block' : 'none';
  if (ownSelect)     ownSelect.style.display     = isRetail ? 'none'  : 'block';
}

window.populatePubOwnCategories    = populatePubOwnCategories;
window.populatePubRetailCategories = populatePubRetailCategories;
window.updatePubGroupChoice        = updatePubGroupChoice;
// pour que le wrapper safeAsync() dans index.html puisse les trouver
window.saveNewPin       = saveNewPin;
window.openPublishPage  = openPublishPage;
window.initBanner       = initBanner;
window.openAdmin        = openAdmin;
