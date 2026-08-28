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
    { url: 'images/banner/tour-nabemba.jpg',          title: '🏙️ Tour Nabemba',           subtitle: 'Le symbole de Brazzaville' },
    { url: 'images/banner/tours-jumelles-mpila.jpg',   title: '🌆 Tours Jumelles — Mpila',  subtitle: 'La modernité au cœur du Congo' },
    { url: 'images/banner/pont-nuit.jpg',              title: '🌉 Un Congo qui brille',     subtitle: 'Nos villes s\'illuminent chaque nuit' },
    { url: 'images/banner/marche-total.jpg',           title: '🛒 Marché Total',            subtitle: 'La vie du grand marché local' },
    { url: 'images/banner/marche-vendeuse.jpg',         title: '🤝 Nos Vendeurs Locaux',     subtitle: 'Le vrai visage du commerce congolais' }
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
    bannerImg.style.transition = 'opacity .3s ease, transform .3s ease';
    bannerImg.style.opacity   = '0';
    bannerImg.style.transform = 'translateY(-16px)';
    setTimeout(() => {
      bannerImg.src            = slide.url;
      if (bannerTitle)    bannerTitle.innerText    = slide.title;
      if (bannerSubtitle) bannerSubtitle.innerText = slide.subtitle;
      bannerImg.style.transition = 'none';
      bannerImg.style.transform  = 'translateY(16px)';
      // Forcer le navigateur à appliquer la position de départ avant l'animation
      void bannerImg.offsetWidth;
      bannerImg.style.transition = 'opacity .3s ease, transform .3s ease';
      bannerImg.style.opacity    = '1';
      bannerImg.style.transform  = 'translateY(0)';
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

  // Swipe tactile (vertical : haut ↔ bas)
  let touchStartY = 0;
  bannerImg.addEventListener('touchstart', e => { touchStartY = e.changedTouches[0].screenY; }, {passive:true});
  bannerImg.addEventListener('touchend', e => {
    const diff = touchStartY - e.changedTouches[0].screenY;
    if (Math.abs(diff) > 30) {
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
  const currentPin = document.getElementById('currentPinInput').value.trim();
  const pin1 = document.getElementById('newPinInput').value.trim();
  const pin2 = document.getElementById('newPinConfirm').value.trim();
  const errEl = document.getElementById('changePinError');
  errEl.style.display = 'none';

  if (!currentPin) { errEl.innerText = 'Entrez votre PIN actuel'; errEl.style.display = 'block'; return; }
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

    const table = livreurCode ? 'delivery_agents' : TABLES.SELLERS;
    const code  = livreurCode || sellerCode;

    const res = await fetch(SUPABASE_URL + '/functions/v1/account-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify({ action: 'change_pin', table, code, pin: currentPin, payload: { newPin: pin1 } })
    });
    const result = await res.json();

    if (!result.ok) {
      errEl.innerText = result.error || 'Erreur lors du changement';
      errEl.style.display = 'block';
      return;
    }

    showToast('PIN modifié avec succès ✓', 'success');
    document.getElementById('currentPinInput').value = '';
    document.getElementById('newPinInput').value = '';
    document.getElementById('newPinConfirm').value = '';
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
