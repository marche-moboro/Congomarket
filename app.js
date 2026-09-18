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
        if (s.id === 10) return; // position 10 = promo plein écran, ne fait pas partie du carrousel
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

  const section = window._pubSection || 'B2'; // 'B2' Boutique | 'A' Grossiste | 'B1' Service
  const isGrossiste = (section === 'A');

  const qteSection = document.getElementById('pubQteSection');
  if (qteSection) qteSection.style.display = isGrossiste ? 'block' : 'none';

  populatePubOwnCategories();

  showPage('publishPage');
}

// Remplit la liste "catégorie" selon la section choisie juste avant
// (window._pubSection, défini par choosePubSection()) :
// - 'B2' → grille Boutique & Vendeur (TREE_B2)
// - 'A'  → grille Grossiste (TREE_A)
// - 'B1' → grille Service (TREE_B1)
function populatePubOwnCategories() {
  const picker = document.getElementById('pubCategoryPicker');
  const label  = document.getElementById('pubOwnCategoryLabel');
  const hidden = document.getElementById('pubOwnCategory');
  if (!picker || !hidden) return;

  // Réinitialise la sélection à chaque ouverture d'une nouvelle section
  hidden.value = '';
  if (label) { label.textContent = 'Choisir une catégorie *'; label.style.color = '#888'; }
  const arrowEl = document.getElementById('pubOwnCategoryArrow');
  if (arrowEl) arrowEl.style.transform = '';
  picker.style.display = 'none';

  const section = window._pubSection || 'B2';
  let tree = null;
  if (section === 'B2')      tree = typeof TREE_B2 !== 'undefined' ? TREE_B2 : null;
  else if (section === 'A')  tree = typeof TREE_A  !== 'undefined' ? TREE_A  : null;
  else if (section === 'B1') tree = typeof TREE_B1 !== 'undefined' ? TREE_B1 : null;

  if (!tree) { picker.innerHTML = ''; return; }

  // Regroupe en tiroirs repliables (accordéon) par section, comme le tiroir
  // catégories côté client (même style, même comportement).
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

  picker.innerHTML = sections.map((s, i) => {
    const secId = `pubCatDrawer${i}`;
    return `
      <button type="button" class="cat-sidebar-subcat-drawer-toggle" onclick="_togglePubCatDrawer('${secId}', this)">
        <span>${escapeHtml(s.title)}</span>
        <span class="cat-sidebar-subcat-drawer-arrow">›</span>
      </button>
      <div id="${secId}" class="cat-sidebar-subcat-drawer-body" style="display:none;">
        ${s.items.map(c =>
          `<button type="button" class="cat-sidebar-subcat-btn" onclick="_selectPubCategory('${c.id}', '${escapeHtml(c.label).replace(/'/g, "\\'")}')">${escapeHtml(c.label)}</button>`
        ).join('')}
      </div>
    `;
  }).join('');
}

// Ouvre/ferme le panneau de choix de catégorie du formulaire de publication
function _togglePubCategoryList() {
  const picker = document.getElementById('pubCategoryPicker');
  const arrowEl = document.getElementById('pubOwnCategoryArrow');
  if (!picker) return;
  const willOpen = picker.style.display === 'none';
  picker.style.display = willOpen ? 'block' : 'none';
  if (arrowEl) arrowEl.style.transform = willOpen ? 'rotate(90deg)' : '';
}

// Accordéon des sections à l'intérieur du panneau — un seul tiroir ouvert à la fois
function _togglePubCatDrawer(secId, btn) {
  const body = document.getElementById(secId);
  if (!body) return;
  const wasOpen = body.style.display === 'block';

  const container = document.getElementById('pubCategoryPicker');
  if (container) {
    container.querySelectorAll('.cat-sidebar-subcat-drawer-body').forEach(el => el.style.display = 'none');
    container.querySelectorAll('.cat-sidebar-subcat-drawer-toggle').forEach(el => el.classList.remove('open'));
  }

  if (!wasOpen) {
    body.style.display = 'block';
    if (btn) btn.classList.add('open');
  }
}

// Sélection d'une catégorie précise → referme le panneau
function _selectPubCategory(id, label) {
  const hidden = document.getElementById('pubOwnCategory');
  const labelEl = document.getElementById('pubOwnCategoryLabel');
  if (hidden) hidden.value = id;
  if (labelEl) { labelEl.textContent = label; labelEl.style.color = '#1a1a1a'; }
  _togglePubCategoryList();
}
window._togglePubCategoryList = _togglePubCategoryList;
window._togglePubCatDrawer    = _togglePubCatDrawer;
window._selectPubCategory     = _selectPubCategory;

// ================================================================
// SÉLECTEUR DE SECTION — Publier / Mes publications / Envoyer en promo / Mes
// promos passent tous par ce choix (Boutique & Vendeur / Grossiste / Service)
// avant d'atteindre leur page cible.
// ================================================================
let _pendingPubAction = null;

const _dashActionTitles = {
  publish:    'Publier — choisir une section',
  myproducts: 'Mes publications — choisir une section',
  sendpromo:  'Envoyer en promo — choisir une section',
  mypromos:   'Mes promos — choisir une section',
};

function _dashAction(action) {
  if (!currentSeller) { showPage('loginPage'); return; }
  _pendingPubAction = action;
  const titleEl = document.getElementById('pubSectionChoiceTitle');
  if (titleEl) titleEl.innerText = _dashActionTitles[action] || 'Choisir une section';
  showPage('pubSectionChoicePage');
}

function choosePubSection(section) {
  window._pubSection = section; // 'B2' Boutique | 'A' Grossiste | 'B1' Service
  // ⚠️ On NE remet PAS _pendingPubAction à null ici : si l'utilisateur revient
  // sur cette page de choix (bouton retour) sans repasser par _dashAction(),
  // il doit pouvoir choisir une section à nouveau avec la même action.
  const action = _pendingPubAction;
  if (action === 'publish')          openPublishPage();
  else if (action === 'myproducts')  viewMyProducts();
  else if (action === 'sendpromo')   openSendToPromo();
  else if (action === 'mypromos')    viewMyPromos();
}

window._dashAction      = _dashAction;
window.choosePubSection = choosePubSection;

window.populatePubOwnCategories    = populatePubOwnCategories;
// pour que le wrapper safeAsync() dans index.html puisse les trouver
window.saveNewPin       = saveNewPin;
window.openPublishPage  = openPublishPage;
window.initBanner       = initBanner;
window.openAdmin        = openAdmin;

// ================================================================
// PROMO PLEIN ÉCRAN — utilise la position 10 du banner (banner_slides)
// Cette position n'entre jamais dans le carrousel (voir initBanner) ;
// si elle contient une photo et/ou un texte, on l'affiche en avant-plan,
// une seule fois par visiteur, jusqu'à ce qu'elle soit modifiée ou
// restaurée par défaut (= supprimée) côté admin.
// ================================================================
async function showAdminPromoIfAny() {
  try {
    const { data, error } = await db.from(TABLES.BANNER_SLIDES).select('*').eq('id', 10).maybeSingle();
    if (error) { console.error('[promo] erreur lecture banner_slides #10:', error); return; }
    if (!data || (!data.url && !data.title && !data.subtitle)) { console.log('[promo] position 10 vide — rien à afficher'); return; }

    const freshKey = String(data.updated_at || data.url || data.title || '');
    const seenKey  = localStorage.getItem('moboro_seen_promo10');
    if (seenKey === freshKey) { console.log('[promo] déjà vue sur cet appareil'); return; }

    const overlay = document.getElementById('adminPromoOverlay');
    const imgEl   = document.getElementById('adminPromoImage');
    const textEl  = document.getElementById('adminPromoText');
    if (!overlay || !imgEl || !textEl) { console.error('[promo] élément(s) HTML manquant(s)'); return; }

    if (data.url) { imgEl.src = data.url; imgEl.style.display = 'block'; }
    else { imgEl.style.display = 'none'; }
    textEl.innerText = [data.title, data.subtitle].filter(Boolean).join('\n');
    overlay.style.display = 'flex';
    console.log('[promo] affichée (position 10)');

    localStorage.setItem('moboro_seen_promo10', freshKey);

    // Compteur de vues — stocké dans settings, best effort
    try {
      const { data: viewsRow } = await db.from(TABLES.SETTINGS).select('value').eq('key', 'promo10_views').maybeSingle();
      const newCount = (parseInt(viewsRow && viewsRow.value, 10) || 0) + 1;
      db.from(TABLES.SETTINGS).upsert({ key: 'promo10_views', value: String(newCount) }, { onConflict: 'key' }).catch(() => {});
    } catch (e) { /* compteur non bloquant */ }
  } catch (e) {
    console.error('[promo] erreur inattendue:', e);
  }
}

function closeAdminPromo() {
  const overlay = document.getElementById('adminPromoOverlay');
  if (overlay) overlay.style.display = 'none';
}

window.showAdminPromoIfAny = showAdminPromoIfAny;
window.closeAdminPromo     = closeAdminPromo;

// ================================================================
// TIROIR CATÉGORIES — ouverture/fermeture par glissement (drag)
// en plus du simple tap sur la bande visible
// ================================================================
function initHomeSidebarSwipe() {
  const sidebar = document.getElementById('homeCatSidebar');
  if (!sidebar) return;

  const PEEK = 26; // doit correspondre à style.css
  let startX = null, startY = null, dragging = false, isOpenAtStart = false, sidebarWidth = 0;

  function closedX() { return -(sidebarWidth - PEEK); }

  sidebar.addEventListener('pointerdown', (e) => {
    isOpenAtStart = sidebar.classList.contains('open');
    sidebarWidth  = sidebar.getBoundingClientRect().width;
    startX = e.clientX;
    startY = e.clientY;
    dragging = false;
  });

  sidebar.addEventListener('pointermove', (e) => {
    if (startX === null) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (!dragging) {
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 8) { startX = null; return; } // geste vertical → on laisse défiler
      if (Math.abs(dx) < 8) return; // pas encore assez de mouvement pour trancher
      dragging = true;
      sidebar.style.transition = 'none';
    }

    let tx = isOpenAtStart ? (0 + dx) : (closedX() + dx);
    tx = Math.min(0, Math.max(closedX(), tx));
    sidebar.style.transform = `translateX(${tx}px)`;
    e.preventDefault();
  });

  function endDrag(e) {
    if (startX === null) return;
    if (dragging) {
      const dx = (e.clientX || 0) - startX;
      const threshold = (sidebarWidth - PEEK) / 2;
      const openNow = isOpenAtStart ? (dx > -threshold) : (dx > threshold);
      sidebar.style.transition = '';
      sidebar.style.transform  = '';
      if (openNow) openHomeSidebar(); else closeHomeSidebar();
    } else if (!isOpenAtStart) {
      // simple tap sur la bande visible, sans glissement → on ouvre
      openHomeSidebar();
    }
    startX = null;
    dragging = false;
  }

  sidebar.addEventListener('pointerup', endDrag);
  sidebar.addEventListener('pointercancel', endDrag);
}
window.initHomeSidebarSwipe = initHomeSidebarSwipe;


