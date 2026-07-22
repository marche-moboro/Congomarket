// ================================================================
// products.js — MARCHÉ MOBORO (avec upload photo)
// ================================================================

// ✅ CORRECTION 2 : transferToPromoFromBtn remplace l'injection de p.name dans onclick
function transferToPromoFromBtn(btn) {
  transferToPromo(btn.dataset.id, btn.dataset.name, btn.dataset.image);
}

// ================================================================
// Recalcul automatique de la grille qté min/max en promo
// Appelé à chaque saisie dans le champ "prix promo"
// ================================================================
function recalcPromoGrid(productId, qteMin, qteMax) {
  const promoPriceInput = document.getElementById('promoPrice_' + productId);
  const promoPrice = promoPriceInput ? Number(promoPriceInput.value) : 0;

  if (qteMin && promoPrice > 0) {
    const totalMin = qteMin * promoPrice;
    const elMin = document.querySelector('.promoGridMinPrice_' + productId);
    if (elMin) elMin.textContent = formatPrice(totalMin) + ' FCFA';
  }
  if (qteMax && promoPrice > 0) {
    const totalMax = qteMax * promoPrice;
    const elMax = document.querySelector('.promoGridMaxPrice_' + productId);
    if (elMax) elMax.textContent = formatPrice(totalMax) + ' FCFA';
  }
}
window.recalcPromoGrid = recalcPromoGrid;

// ================================================================
// BANNIÈRE ABONNEMENT — J-7 ou expiré
// ================================================================
function getBanniereAbonnement(seller) {
  if (!isSubscriptionActive() || !seller.subscription_end) return '';
  const statut  = checkSubscriptionExpiry(seller.subscription_end);
  const dateStr = new Date(seller.subscription_end).toLocaleDateString('fr-FR');
  const now     = new Date();
  const endDate = new Date(seller.subscription_end);
  const jours   = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
  const msg     = encodeURIComponent(
    `Bonjour, mon abonnement Marché Moboro expire le ${dateStr}.\nCode : ${seller.code}\nJe souhaite renouveler.`
  );
  const waLink = `https://wa.me/${ADMIN_PHONE}?text=${msg}`;

  if (statut === 'expire') {
    return `<div style="background:#fff1f0;border:1.5px solid #ff4d4f;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:13px;">
      ⛔ <strong>Abonnement expiré le ${dateStr}</strong><br>
      <span style="color:#666;">Votre compte a été suspendu. Contactez l'admin pour renouveler.</span><br>
      <a href="${waLink}" target="_blank" style="display:inline-block;margin-top:8px;background:#25D366;color:white;padding:7px 14px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;">
        📲 Renouveler via WhatsApp
      </a>
    </div>`;
  }
  if (statut === 'expire_bientot') {
    return `<div style="background:#fffbe6;border:1.5px solid #faad14;border-radius:12px;padding:12px 14px;margin-bottom:14px;font-size:13px;">
      ⚠️ <strong>Abonnement expire dans ${jours} jour${jours > 1 ? 's' : ''} (${dateStr})</strong><br>
      <span style="color:#666;">Renouvelez maintenant pour éviter la suspension.</span><br>
      <a href="${waLink}" target="_blank" style="display:inline-block;margin-top:8px;background:#faad14;color:white;padding:7px 14px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;">
        📲 Renouveler via WhatsApp
      </a>
    </div>`;
  }
  return `<div style="background:#f6ffed;border:1.5px solid #52c41a;border-radius:12px;padding:10px 14px;margin-bottom:14px;font-size:13px;color:#389e0d;">
    ✅ <strong>Abonnement actif jusqu'au ${dateStr}</strong>
  </div>`;
}

// ================================================================
// Dashboard vendeur
// ================================================================
async function openSellerDashboard() {
  try {
  if (!currentSeller) { showPage('loginPage'); return; }

  const { data: seller } = await db.from(TABLES.SELLERS)
.select('*').eq('id', currentSeller.id).maybeSingle();
  if (seller) currentSeller = seller;

  document.getElementById('dashSellerName').innerText     = currentSeller.full_name;
  document.getElementById('dashSellerCode').innerText     = currentSeller.code;
  document.getElementById('dashSellerCategory').innerText =
    ALL_CATEGORIES[currentSeller.category] || currentSeller.category;

  if (currentSeller.photo) {
    document.getElementById('dashPhoto').src = currentSeller.photo;
  }

  // ── Bannière abonnement ──
  const banniereEl = document.getElementById('dashAbonnementBanniere');
  if (banniereEl) banniereEl.innerHTML = getBanniereAbonnement(currentSeller);

  showFournisseurExportBtn();
  loadAccountNotifications(currentSeller.account_type, currentSeller.code);
  showPage('dashboardPage');
  updateProfileIcon();

  } catch(e) {
    console.error('openSellerDashboard error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

// ================================================================
// Dashboard Fournisseur Export
// ================================================================
async function openFournisseurDashboard() {
  try {
    if (!currentSeller) { showPage('loginPage'); return; }
    const { data: seller } = await db.from(TABLES.SELLERS)
      .select('*').eq('id', currentSeller.id).maybeSingle();
    if (seller) currentSeller = seller;

    document.getElementById('fournisseurName').innerText     = currentSeller.full_name;
    document.getElementById('fournisseurCode').innerText     = currentSeller.code;
    document.getElementById('fournisseurCategory').innerText =
      ALL_CATEGORIES[currentSeller.category] || currentSeller.category;
    if (currentSeller.photo) {
      document.getElementById('fournisseurPhoto').src = currentSeller.photo;
    }

    // ── Bannière abonnement ──
    const banniereEl = document.getElementById('fournisseurAbonnementBanniere');
    if (banniereEl) banniereEl.innerHTML = getBanniereAbonnement(currentSeller);

    showFournisseurExportBtn();
    showPage('fournisseurDashboard');
    updateProfileIcon();
  } catch(e) {
    console.error('openFournisseurDashboard error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }
}

// ================================================================
// Profil vendeur
// ================================================================
function openProfile() {
  if (!currentSeller) { showPage('loginPage'); return; }

  document.getElementById('profileName').innerText     = currentSeller.full_name;
  document.getElementById('profileCode').innerText     = currentSeller.code;
  document.getElementById('profilePhone').innerText    = currentSeller.phone;
  document.getElementById('profileQuartier').innerText = currentSeller.quartier;
  document.getElementById('profileVille').innerText    = currentSeller.ville;
  document.getElementById('profileCategory').innerText =
    ALL_CATEGORIES[currentSeller.category] || currentSeller.category;

  if (currentSeller.photo) {
    document.getElementById('profilePhoto').src = currentSeller.photo;
  }

  previewImage('profilePhotoFile', 'profilePhotoPreview');
  showPage('profilePage');
}

// Mettre à jour photo profil via upload
async function updatePhoto() {
  try {
const photoInput = document.getElementById('profilePhotoFile');
const urlInput   = document.getElementById('photoUrl');

const photoFile = (photoInput && photoInput.files && photoInput.files.length > 0)
  ? photoInput.files[0]
  : null;

const photoUrl = urlInput && urlInput.value
  ? urlInput.value.trim()
  : '';

  let newUrl = '';

  if (photoFile) {
    showToast('Upload en cours...', 'info');
    if (currentSeller.photo) await deleteOldPhoto(currentSeller.photo);
    newUrl = await uploadPhoto(photoFile, 'sellers');
    if (!newUrl) return;
  } else if (photoUrl) {
    newUrl = photoUrl;
  } else {
    showToast('Choisissez une photo ou entrez une URL', 'error');
    return;
  }

  const { error } = await db.from(TABLES.SELLERS)
    .update({ photo: newUrl }).eq('id', currentSeller.id);

  if (error) {
    showToast('Erreur mise à jour photo', 'error');
    return;
  }

  currentSeller.photo = newUrl;
  updateProfileIcon();
  showToast('Photo mise à jour ✓', 'success');

  } catch(e) {
    console.error('updatePhoto error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

// ================================================================
// Publier un produit — avec upload photo
// ================================================================
function openPublishProduct() {
  previewImage('pubPhotoFile', 'pubPhotoPreview');
  openPublishPage(); // ✅ affiche/masque pubQteSection selon account_type
}

// ================================================================
// Statut de commande — visible côté vendeur (Mes commandes)
// ================================================================
const ORDER_STATUS_LABELS = {
  en_preparation: { label: '🟡 En préparation', color: '#faad14' },
  expedie:        { label: '🔵 Expédié',        color: '#1677FF' },
  livre:          { label: '🟢 Livré',          color: '#52c41a' }
};

async function viewMyOrders() {
  markOrdersNotificationsRead();
  try {
    if (!currentSeller) { showPage('loginPage'); return; }
    const { data: orders, error } = await db.from(TABLES.ORDERS)
      .select('*')
      .eq('seller_id', currentSeller.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('viewMyOrders error:', JSON.stringify(error));
      const container = document.getElementById('myOrdersResults');
      if (container) container.innerHTML = '<p style="text-align:center;padding:30px;color:#ff4d4f;">Erreur de chargement des commandes.</p>';
      showPage('myOrdersPage');
      showToast('Erreur chargement commandes', 'error');
      return;
    }

    const container = document.getElementById('myOrdersResults');
    if (!container) return;

    if (!orders || orders.length === 0) {
      container.innerHTML = `<p style="text-align:center;color:#888;padding:30px 0;">Aucune commande pour le moment.</p>`;
      showPage('myOrdersPage');
      return;
    }

    container.innerHTML = orders.map(o => {
      const status  = ORDER_STATUS_LABELS[o.status || 'en_preparation'];
      const dateStr = new Date(o.created_at).toLocaleDateString('fr-FR');
      const itemsList = (o.items || []).map(it => `${it.quantity} x ${escapeHtml(it.name)}`).join(', ');

      let nextBtn = '';
      if ((o.status || 'en_preparation') === 'en_preparation') {
        nextBtn = `<button class="action-btn" style="background:#1677FF;color:white;" onclick="updateOrderStatus('${o.id}','expedie')">🔵 Marquer expédié</button>`;
      } else if (o.status === 'expedie') {
        nextBtn = `<button class="action-btn" style="background:#52c41a;color:white;" onclick="updateOrderStatus('${o.id}','livre')">🟢 Marquer livré</button>`;
      }

      return `<div style="background:white;border:1px solid #eee;border-radius:12px;padding:12px 14px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <strong style="font-size:14px;">${escapeHtml(o.client_name)}</strong>
          <span style="font-size:11px;color:#999;">${dateStr}</span>
        </div>
        <div style="font-size:12px;color:#666;margin-bottom:4px;">📞 ${escapeHtml(o.client_phone)} · 📍 ${escapeHtml(o.client_quartier)}</div>
        <div style="font-size:12px;color:#666;margin-bottom:6px;">${itemsList}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:12px;font-weight:700;color:${status.color};">${status.label}</span>
          <strong style="font-size:13px;color:#1677FF;">${formatPrice(o.total)} FCFA</strong>
        </div>
        ${nextBtn ? `<div style="margin-top:8px;">${nextBtn}</div>` : ''}
      </div>`;
    }).join('');

    showPage('myOrdersPage');
  } catch (e) {
    console.error('viewMyOrders error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + e.message, 'error');
  }
}

async function updateOrderStatus(orderId, newStatus) {
  try {
    const { error } = await db.from(TABLES.ORDERS).update({ status: newStatus }).eq('id', orderId);
    if (error) { showToast('Erreur mise à jour statut', 'error'); return; }
    showToast('Statut mis à jour ✓', 'success');
    viewMyOrders();
  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

let _publishingProduct = false;
let _transferring  = false;
let _promosAll     = [];
let _promosPage    = 0;
let _promosType    = '';
const PROMOS_PER_PAGE = 8;
let _myProductsAll  = [];
let _myProductsPage = 0;
const MY_PRODUCTS_PER_PAGE = 15;
let _myPromosAll    = [];
let _myPromosPage   = 0;
const MY_PROMOS_PER_PAGE = 15;

async function publishProduct() {
  if (!currentSeller) return;
  if (_publishingProduct) return;

  // ── Vérification abonnement avant publication ──
  if (isSubscriptionActive()) {
    const statut = checkSubscriptionExpiry(currentSeller.subscription_end);
    if (statut === 'expire') {
      await autoBlockExpired(currentSeller.id, 'sellers');
      showToast('Abonnement expiré — publication impossible', 'error');
      showAbonnementExpireModal(currentSeller.full_name, currentSeller.subscription_end);
      return;
    }
  }

  _publishingProduct = true;

  const btn = document.querySelector('[onclick="publishProduct()"]');
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }

  try {
const name        = document.getElementById('pubName').value.trim();
const price       = document.getElementById('pubPrice').value.trim();
const description = document.getElementById('pubDescription').value.trim();
const qte_min     = document.getElementById('pubQteMin')?.value.trim() || null;
const prix_min    = document.getElementById('pubPrixMin')?.value.trim() || null;
const qte_max     = document.getElementById('pubQteMax')?.value.trim() || null;
const prix_max    = document.getElementById('pubPrixMax')?.value.trim() || null;
const taille      = document.getElementById('pubTaille')?.value.trim()  || null;
const matiere     = document.getElementById('pubMatiere')?.value.trim() || null;

    // ✅ Utiliser pubPhotosFiles[] (système multi-photos) — minimum 1 photo suffisante
    const photoFiles = window.pubPhotosFiles || [];

   
if (!name || !price) {
      showToast('Nom et prix sont obligatoires', 'error');
      return;
    }

    // Catégorie de publication — obligatoire, dépend du compte / du choix de groupe
    const retailRadioEl = document.getElementById('pubGroupChoiceRetail');
    const retailCatEl   = document.getElementById('pubRetailCategory');
    const ownCatEl       = document.getElementById('pubOwnCategory');
    const useRetail = !!(retailRadioEl && retailRadioEl.checked);

    let sellerCategoryToUse;
    if (useRetail) {
      if (!retailCatEl || !retailCatEl.value) {
        showToast('Choisissez une catégorie détail', 'error');
        return;
      }
      sellerCategoryToUse = retailCatEl.value;
    } else {
      if (!ownCatEl || !ownCatEl.value) {
        showToast('Choisissez une catégorie', 'error');
        return;
      }
      sellerCategoryToUse = ownCatEl.value;
    }
    if (isNaN(Number(price)) || Number(price) <= 0) {
      showToast('Prix invalide', 'error');
      return;
    }

    // ✅ Au moins 1 photo sur 3 suffit
    if (photoFiles.length === 0) {
      showToast('Ajoutez au moins 1 photo', 'error');
      return;
    }

    // Uploader toutes les photos sélectionnées (1, 2 ou 3)
    showToast(`Upload ${photoFiles.length} photo(s)...`, 'info');
    const imageUrls = [];
    for (const file of photoFiles) {
      const url = await uploadPhoto(file, 'products');
      if (url) imageUrls.push(url);
    }

    if (imageUrls.length === 0) {
      showToast('Échec upload photo', 'error');
      return;
    }

    // Stocker : image principale = première photo, images = tableau complet
    const { error } = await db.from(TABLES.PRODUCTS).insert({
  seller_id:       currentSeller.id,
  seller_name:     currentSeller.full_name,
  seller_phone:    currentSeller.phone,
  seller_category: sellerCategoryToUse,
  name,
  price:           Number(price),
  description,
  qte_min:         qte_min  ? Number(qte_min)  : null,
  prix_min:        prix_min ? Number(prix_min) : null,
  qte_max:         qte_max  ? Number(qte_max)  : null,
  prix_max:        prix_max ? Number(prix_max) : null,
  taille,
  matiere,
  image:           imageUrls[0],
  images:          imageUrls,
  is_active:       true,
  created_at:      new Date().toISOString()
});

    if (error) {
      console.error('publishProduct error:', JSON.stringify(error));
      showToast('Erreur lors de la publication', 'error');
      return;
    }

   // Score cumulatif — augmente à chaque publication, jamais réduit
    const _currentScore = currentSeller.dynamisme_score || 0;
    await db.from(TABLES.SELLERS)
      .update({
        last_published:  new Date().toISOString(),
        dynamisme_score: _currentScore + 1
      })
      .eq('id', currentSeller.id);
    currentSeller.dynamisme_score = _currentScore + 1;

    showToast(`Produit publié avec ${imageUrls.length} photo(s) ✓`, 'success');

    // Réinitialiser le formulaire
   ['pubName','pubPrice','pubDescription','pubQteMin','pubPrixMin','pubQteMax','pubPrixMax','pubTaille','pubMatiere'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.value = '';
});
const ownRadioReset = document.getElementById('pubGroupChoiceOwn');
if (ownRadioReset) { ownRadioReset.checked = true; if (typeof updatePubGroupChoice === 'function') updatePubGroupChoice(); }
const ownCatReset = document.getElementById('pubOwnCategory');
if (ownCatReset) ownCatReset.value = '';
const retailCatReset = document.getElementById('pubRetailCategory');
if (retailCatReset) retailCatReset.value = '';
    const titlePreview = document.getElementById('pubTitlePreview');
    if (titlePreview) titlePreview.style.display = 'none';

    // Vider les photos
    window.pubPhotosFiles = [];
    const preview = document.getElementById('pubPhotosPreview');
    if (preview) preview.innerHTML = '';
    const count = document.getElementById('pubPhotoCount');
    if (count) count.innerText = '0 photos';
    const btns = document.getElementById('pubPhotoButtons');
    if (btns) btns.style.display = 'grid';

  } catch(e) {
    console.error('publishProduct exception:', e);
    showToast('Erreur: ' + e.message, 'error');
  } finally {
    _publishingProduct = false;
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }
}

// ================================================================
// Mes publications
// ================================================================
async function viewMyProducts() {
  try {
  if (!currentSeller) return;

  const { data: products, error } = await db.from(TABLES.PRODUCTS)
    .select('id, name, price, description, image, seller_id, is_active, created_at, qte_min, prix_min, qte_max, prix_max, taille, couleur, matiere')
    .eq('seller_id', currentSeller.id)
    .eq('is_active',  true)
    .order('created_at', { ascending: false });

  if (error) console.error('viewMyProducts error:', JSON.stringify(error));

  _myProductsAll  = products || [];
  _myProductsPage = 0;
  const list = document.getElementById('myProductsList');
  list.innerHTML  = '';

  if (!_myProductsAll.length) {
    list.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Aucune publication.</p>';
  } else {
    _appendMyProducts();
  }

  showPage('myProductsPage');

  } catch(e) {
    console.error('viewMyProducts error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

function _appendMyProducts() {
  const list  = document.getElementById('myProductsList');
  const isGrossiste = ['independant_grossiste','vip_grossiste','fournisseur_export']
    .includes(currentSeller.account_type);
  const start = _myProductsPage * MY_PRODUCTS_PER_PAGE;
  const slice = _myProductsAll.slice(start, start + MY_PRODUCTS_PER_PAGE);
  const oldBtn = document.getElementById('loadMoreMyProducts');
  if (oldBtn) oldBtn.remove();

  list.insertAdjacentHTML('beforeend', slice.map(p => `
    <div class="my-product-card">
      <img src="${escapeHtml(p.image)}"
        onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'">
      <div class="my-product-info">
       <div class="my-product-info">
        <strong>${escapeHtml(p.name)}</strong>
        <span>${formatPrice(p.price)} FCFA / unité</span>
        ${renderSpecsHtml(p)}
        ${isGrossiste ? renderQuantityTiers(p.price, p.qte_min, p.prix_min, p.qte_max, p.prix_max) : ''}
        <div style="display:flex;gap:8px;margin-top:6px;">
          <button class="edit-btn" onclick="openEditProduct('${p.id}')">✏️ Modifier</button>
          <button class="delete-btn" onclick="deleteProduct('${p.id}')">🗑 Supprimer</button>
        </div>
      </div>
    </div>
  `).join(''));

  const loaded = start + slice.length;
  if (loaded < _myProductsAll.length) {
    list.insertAdjacentHTML('beforeend', `
      <div id="loadMoreMyProducts" style="text-align:center;padding:16px;">
        <button onclick="loadMoreMyProducts()" style="background:#1677FF;color:white;border:none;padding:12px 32px;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer;">
          Voir plus 
        </button>
      </div>
    `);
  }
}

function loadMoreMyProducts() {
  _myProductsPage++;
  _appendMyProducts();
}

// Supprimer publication
async function deleteProduct(productId) {
  try {
  // ✅ CORRECTION 1 : on relit l'image depuis la base plutôt que de la passer en onclick
  showConfirmDialog('Voulez-vous supprimer ce produit ?', async () => {
    const { data: prod } = await db.from(TABLES.PRODUCTS)
      .select('image').eq('id', productId).single();

    const { error } = await db.from(TABLES.PRODUCTS)
      .update({ is_active: false }).eq('id', productId);

    if (error) {
      console.error('deleteProduct error:', JSON.stringify(error));
      showToast('Erreur lors de la suppression', 'error');
      return;
    }

if (prod && prod.image && prod.image.includes('/photos/')) {
      await deleteOldPhoto(prod.image);
    }

    showToast('Publication supprimée ✓', 'success');
    viewMyProducts();
  });

  } catch(e) {
    console.error('deleteProduct error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

// ================================================================
// Modifier une publication
// ================================================================
async function openEditProduct(productId) {
  try {
    const { data: p } = await db.from(TABLES.PRODUCTS)
      .select('*').eq('id', productId).maybeSingle();
    if (!p) { showToast('Produit introuvable', 'error'); return; }

    const isGrossiste = ['independant_grossiste','vip_grossiste','fournisseur_export']
      .includes(currentSeller.account_type);

    document.getElementById('editProductId').value      = p.id;
    document.getElementById('editPubName').value        = p.name        || '';
    document.getElementById('editPubPrice').value       = p.price       || '';
    document.getElementById('editPubDescription').value = p.description || '';
    document.getElementById('editPubTaille').value      = p.taille      || '';
    document.getElementById('editPubMatiere').value     = p.matiere     || '';

    // Champs quantité — uniquement grossiste/fournisseur
    const qteSection = document.getElementById('editQteSection');
    if (qteSection) {
      qteSection.style.display = isGrossiste ? 'block' : 'none';
      if (isGrossiste) {
        document.getElementById('editPubQteMin').value  = p.qte_min  || '';
        document.getElementById('editPubPrixMin').value = p.prix_min || '';
        document.getElementById('editPubQteMax').value  = p.qte_max  || '';
        document.getElementById('editPubPrixMax').value = p.prix_max || '';
      }
    }

    showPage('editProductPage');
  } catch(e) {
    console.error('openEditProduct error:', e);
    showToast('Erreur: ' + e.message, 'error');
  }
}

async function saveEditProduct() {
  try {
    const productId   = document.getElementById('editProductId').value;
    const name        = document.getElementById('editPubName').value.trim();
    const price       = document.getElementById('editPubPrice').value.trim();
    const description = document.getElementById('editPubDescription').value.trim();

    if (!name || !price) {
      showToast('Nom et prix sont obligatoires', 'error');
      return;
    }

    const isGrossiste = ['independant_grossiste','vip_grossiste','fournisseur_export']
      .includes(currentSeller.account_type);

    const updateData = {
      name,
      price:       Number(price),
      description,
      taille:  document.getElementById('editPubTaille')?.value.trim()  || null,
      matiere: document.getElementById('editPubMatiere')?.value.trim() || null,
    };

    if (isGrossiste) {
      const qte_min  = document.getElementById('editPubQteMin').value.trim()  || null;
      const prix_min = document.getElementById('editPubPrixMin').value.trim() || null;
      const qte_max  = document.getElementById('editPubQteMax').value.trim()  || null;
      const prix_max = document.getElementById('editPubPrixMax').value.trim() || null;
      updateData.qte_min  = qte_min  ? Number(qte_min)  : null;
      updateData.prix_min = prix_min ? Number(prix_min) : null;
      updateData.qte_max  = qte_max  ? Number(qte_max)  : null;
      updateData.prix_max = prix_max ? Number(prix_max) : null;
    }

    const { error } = await db.from(TABLES.PRODUCTS)
      .update(updateData).eq('id', productId);

    if (error) {
      console.error('saveEditProduct error:', JSON.stringify(error));
      showToast('Erreur lors de la modification', 'error');
      return;
    }

    showToast('Publication modifiée ✓', 'success');
    viewMyProducts();
  } catch(e) {
    console.error('saveEditProduct error:', e);
    showToast('Erreur: ' + e.message, 'error');
  }
}
// ================================================================
// Envoyer en promo
// ================================================================
async function openSendToPromo() {
  try {
  if (!currentSeller) return;

const { data: products } = await db.from(TABLES.PRODUCTS)
.select('id, name, price, image, is_active, qte_min, prix_min, qte_max, prix_max')
  .eq('seller_id', currentSeller.id)
  .eq('is_active', true)
  .order('created_at', { ascending: false });

  const list = document.getElementById('promoSelectList');

  if (!products || products.length === 0) {
    list.innerHTML =
      '<p style="text-align:center;padding:20px;color:#888;">Aucune publication à promouvoir.</p>';
  } else {
list.innerHTML = products.map(p => `
      <div class="promo-select-card">
        <img src="${escapeHtml(p.image)}"
          onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'">
        <div class="promo-select-info">
          <strong>${escapeHtml(p.name)}</strong>
          <div class="promo-prices">
            <div class="price-input-group">
              <label>Prix unitaire original :</label>
              <input type="number" id="origPrice_${p.id}" value="${p.price}" min="0"
                readonly
                style="background:#f5f5f5;color:#888;cursor:not-allowed;border:1px solid #ddd;">
            </div>
            <div class="price-input-group">
              <label>Nouveau prix promo :</label>
              <input type="number" id="promoPrice_${p.id}" placeholder="Saisir prix promo" min="0"
                oninput="recalcPromoGrid('${p.id}', ${p.qte_min || 'null'}, ${p.qte_max || 'null'})">
            </div>
          </div>
          ${(p.qte_min || p.qte_max) ? `
          <div id="promoGrid_${p.id}" style="margin:6px 0;padding:6px 8px;background:#f5f7fb;border-radius:8px;font-size:12px;">
            ${p.qte_min ? `<div id="promoGridMin_${p.id}" style="color:#52c41a;font-weight:600;">Qté min : ${p.qte_min} → <span class="promoGridMinPrice_${p.id}">${formatPrice(p.prix_min)} FCFA</span></div>` : ''}
            ${p.qte_max ? `<div id="promoGridMax_${p.id}" style="color:#1677FF;font-weight:600;">Qté max : ${p.qte_max} → <span class="promoGridMaxPrice_${p.id}">${formatPrice(p.prix_max)} FCFA</span></div>` : ''}
          </div>` : ''}
          <button class="promo-transfer-btn"
            data-id="${p.id}"
            data-name="${escapeHtml(p.name)}"
            data-image="${escapeHtml(p.image)}"
            data-original-price="${p.price}"
            data-qte-min="${p.qte_min || ''}"
            data-prix-min="${p.prix_min || ''}"
            data-qte-max="${p.qte_max || ''}"
            data-prix-max="${p.prix_max || ''}"
            onclick="transferToPromoFromBtn(this)">
            Transférer en promo ➜
          </button>
        </div>
      </div>
    `).join('');
  }
  showPage('sendToPromoPage');

  } catch(e) {
    console.error('openSendToPromo error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

// Transférer en promo
async function transferToPromo(productId, name, image) {
  if (_transferring) return;
  _transferring = true;
  const btn = document.querySelector(`.promo-transfer-btn[data-id="${productId}"]`);
  if (btn) { btn.disabled = true; btn.style.opacity = '0.6'; }
  try {
// Prix original lu depuis data-original-price — impossible à modifier via l'input readonly
const originalPrice   = btn ? btn.dataset.originalPrice : '';
const promoPriceInput = document.getElementById('promoPrice_' + productId);
const promoPrice      = promoPriceInput ? promoPriceInput.value : '';

  if (!promoPrice || Number(promoPrice) >= Number(originalPrice)) {
    showToast('Le prix promo doit être inférieur au prix original', 'error');
    return;
  }

  const type = currentSeller.account_type === 'fournisseur_export'
    ? 'A'
    : (Object.keys(CATEGORIES_A).includes(currentSeller.category) ? 'A' : 'B');

  const qteMin  = btn ? btn.dataset.qteMin  : '';
  const prixMin = btn ? btn.dataset.prixMin : '';
  const qteMax  = btn ? btn.dataset.qteMax  : '';
  const prixMax = btn ? btn.dataset.prixMax : '';

  // ── Recalcul des prix grille avec le nouveau prix promo ──
  const promoPriceNum   = Number(promoPrice);
  const promoQteMinPrix = qteMin ? Math.round(Number(qteMin) * promoPriceNum) : null;
  const promoQteMaxPrix = qteMax ? Math.round(Number(qteMax) * promoPriceNum) : null;

  const { error } = await db.from(TABLES.PROMOS).insert({
    seller_id:           currentSeller.id,
    seller_name:         currentSeller.full_name,
    seller_phone:        currentSeller.phone,
    seller_category:     currentSeller.category,
    seller_account_type: currentSeller.account_type || 'independant_vendeur',
    promo_type:          type,
    product_id:      productId,
    name,
    image,
    original_price:  Number(originalPrice),
    promo_price:     promoPriceNum,
    qte_min:         qteMin  ? Number(qteMin)  : null,
    prix_min:        promoQteMinPrix,
    qte_max:         qteMax  ? Number(qteMax)  : null,
    prix_max:        promoQteMaxPrix,
    is_active:       true,
    created_at:      new Date().toISOString()
  });

  if (error) {
    console.error('transferToPromo error:', JSON.stringify(error));
    showToast('Erreur lors du transfert', 'error');
    return;
  }

  // ── Désactiver le produit en base après transfert ──
  await db.from(TABLES.PRODUCTS).update({ is_active: false }).eq('id', productId);

  showToast('Produit transféré en promotion ✓', 'success');

  // ── Masquer la carte du produit transféré sans recharger la page ──
  const card = btn ? btn.closest('.promo-select-card') : null;
  if (card) {
    card.style.transition = 'opacity 0.3s';
    card.style.opacity = '0';
    setTimeout(() => card.remove(), 320);
  }

  } catch(e) {
    console.error('transferToPromo error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  } finally {
    _transferring = false;
    if (btn) { btn.disabled = false; btn.style.opacity = '1'; }
  }}

// ================================================================
// Mes promos
// ================================================================
async function viewMyPromos() {
  try {
  if (!currentSeller) return;

  const { data: promos, error } = await db.from(TABLES.PROMOS)
      .select('*').eq('seller_id', currentSeller.id).eq('is_active', true)
      .order('created_at', { ascending: false });

  if (error) console.error('viewMyPromos error:', JSON.stringify(error));

  _myPromosAll  = promos || [];
  _myPromosPage = 0;
  const list = document.getElementById('myPromosList');
  list.innerHTML = '';

  if (!_myPromosAll.length) {
    list.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Aucune promotion.</p>';
  } else {
    _appendMyPromos();
  }

  showPage('myPromosPage');

  } catch(e) {
    console.error('viewMyPromos error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

function _appendMyPromos() {
  const list  = document.getElementById('myPromosList');
  const start = _myPromosPage * MY_PROMOS_PER_PAGE;
  const slice = _myPromosAll.slice(start, start + MY_PROMOS_PER_PAGE);
  const oldBtn = document.getElementById('loadMoreMyPromos');
  if (oldBtn) oldBtn.remove();

  list.insertAdjacentHTML('beforeend', slice.map(p => `
    <div class="my-product-card">
      <img src="${escapeHtml(p.image)}"
        onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=400'">
      <div class="my-product-info">
        <strong>${escapeHtml(p.name)}</strong>
        <span style="text-decoration:line-through;color:#999;">${formatPrice(p.original_price)} FCFA</span>
        <span style="color:#ff4d4f;font-weight:700;">${formatPrice(p.promo_price)} FCFA</span>
        ${p.qte_min ? `<span style="font-size:12px;color:#52c41a;font-weight:600;">Qté min : ${p.qte_min} → ${formatPrice(p.prix_min !== null ? p.prix_min : p.qte_min * p.promo_price)} FCFA</span>` : ''}
        ${p.qte_max ? `<span style="font-size:12px;color:#1677FF;font-weight:600;">Qté max : ${p.qte_max} → ${formatPrice(p.prix_max !== null ? p.prix_max : p.qte_max * p.promo_price)} FCFA</span>` : ''}
        <button class="delete-btn" onclick="deletePromo('${p.id}')">🗑 Supprimer</button>
      </div>
    </div>
  `).join(''));

  const loaded = start + slice.length;
  if (loaded < _myPromosAll.length) {
    list.insertAdjacentHTML('beforeend', `
      <div id="loadMoreMyPromos" style="text-align:center;padding:16px;">
        <button onclick="loadMoreMyPromos()" style="background:#fa8c16;color:white;border:none;padding:12px 32px;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer;">
          Voir plus 
        </button>
      </div>
    `);
  }
}

function loadMoreMyPromos() {
  _myPromosPage++;
  _appendMyPromos();
}

// Supprimer promo
async function deletePromo(promoId) {
  try {
  showConfirmDialog('Voulez-vous supprimer cette promotion ?', async () => {
    const { error } = await db.from(TABLES.PROMOS)
      .update({ is_active: false }).eq('id', promoId);

    if (error) {
      console.error('deletePromo error:', JSON.stringify(error));
      showToast('Erreur lors de la suppression', 'error');
      return;
    }

    showToast('Promotion supprimée ✓', 'success');
    viewMyPromos();
  });

  } catch(e) {
    console.error('deletePromo error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }
}
// ================================================================
// Promos publiques
// ================================================================
async function loadPromos(type) {
  try {
    _promosType = type;
    _promosPage = 0;
    document.getElementById('promosTitle').innerText =
      type === 'A' ? 'Promos Catégorie A' : 'Promos Catégorie B';
    showPage('promosPage');

    const { data: promos, error } = await db.from(TABLES.PROMOS)
      .select('*').eq('promo_type', type).eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) console.error('loadPromos error:', JSON.stringify(error));

    _promosAll = promos || [];
    const list = document.getElementById('promosList');

    if (!_promosAll.length) {
      list.innerHTML = '<p style="text-align:center;padding:20px;color:#888;">Aucune promotion.</p>';
      return;
    }
    list.innerHTML = '';
    _appendPromos();

  } catch(e) {
    console.error('loadPromos error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }
}

function _appendPromos() {
  const list  = document.getElementById('promosList');
  const start = _promosPage * PROMOS_PER_PAGE;
  const slice = _promosAll.slice(start, start + PROMOS_PER_PAGE);
  const oldBtn = document.getElementById('loadMorePromos');
  if (oldBtn) oldBtn.remove();

  list.insertAdjacentHTML('beforeend', slice.map(p => `
    <div class="promo-card">
      <img src="${escapeHtml(p.image)}"
        onerror="this.src='https://images.unsplash.com/photo-1556740749-887f6717d7e4?q=80&w=600'">
      <div class="promo-content">
        <h3>${escapeHtml(p.name)}</h3>
        <p class="promo-seller">Vendeur: ${escapeHtml(p.seller_name)}</p>
        <div class="promo-prices-display">
          <span class="old-price">${formatPrice(p.original_price)} FCFA</span>
          <span class="new-price">${formatPrice(p.promo_price)} FCFA</span>
          <span class="discount">
            -${Math.round((1 - p.promo_price / p.original_price) * 100)}%
          </span>
       </div>
        ${p.qte_min ? `<p style="font-size:12px;color:#52c41a;margin:4px 0;">Qté min : ${p.qte_min} → ${formatPrice(p.prix_min !== null ? p.prix_min : p.qte_min * p.promo_price)} FCFA</p>` : ''}
        ${p.qte_max ? `<p style="font-size:12px;color:#1677FF;margin:4px 0;">Qté max : ${p.qte_max} → ${formatPrice(p.prix_max !== null ? p.prix_max : p.qte_max * p.promo_price)} FCFA</p>` : ''}
        <a href="https://wa.me/${p.seller_phone}?text=Bonjour, je suis intéressé(e) par: ${encodeURIComponent(p.name)}"
           target="_blank" class="whatsapp-promo-btn">
          Commander via WhatsApp
        </a>
      </div>
    </div>
  `).join(''));

  const loaded = start + slice.length;
  if (loaded < _promosAll.length) {
    list.insertAdjacentHTML('beforeend', `
      <div id="loadMorePromos" style="text-align:center;padding:16px;">
        <button onclick="loadMorePromos()" style="background:#fa8c16;color:white;border:none;padding:12px 32px;border-radius:99px;font-size:14px;font-weight:600;cursor:pointer;">
          Voir plus
        </button>
      </div>
    `);
  }
}

function loadMorePromos() {
  _promosPage++;
  _appendPromos();
}

async function viewMyStats() {
  if (!currentSeller) { showPage('loginPage'); return; }

  // Afficher la page d'abord, puis charger les données
  showPage('myStatsPage');
  document.getElementById('statTotalViews').innerText  = '…';
  document.getElementById('statTotalClicks').innerText = '…';
  document.getElementById('statTopProduct').innerText  = '…';

  try {
    const { data: views } = await db.from(TABLES.PRODUCT_VIEWS)
      .select('type, product_id').eq('seller_id', currentSeller.id)
      .limit(1000);

const safeViews = Array.isArray(views) ? views : [];

const viewList = safeViews.filter(v => v && v.type === 'view');
const clickList = safeViews.filter(v => v && v.type === 'click');

const totalViews  = viewList.length;
const totalClicks = clickList.length;

const viewsByProduct = {};

viewList.forEach(v => {
  const id = v && v.product_id;
  if (id) {
    viewsByProduct[id] = (viewsByProduct[id] || 0) + 1;
  }
});

const sortedEntries = Object.entries(viewsByProduct)
  .sort(function (a, b) {
    return b[1] - a[1];
  });

const topProductId = sortedEntries.length > 0 ? sortedEntries[0][0] : null;

let topProductName = '—';

if (topProductId) {
  const { data: prod } = await db
    .from(TABLES.PRODUCTS)
    .select('name')
    .eq('id', topProductId)
    .maybeSingle();

  topProductName = (prod && prod.name) ? prod.name : '—';
}

  document.getElementById('statTotalViews').innerText  = totalViews;
    document.getElementById('statTotalClicks').innerText = totalClicks;
    document.getElementById('statTopProduct').innerText  = topProductName;

  } catch (e) {
    console.error('viewMyStats error:', e);
    if (typeof showToast === 'function') showToast('Erreur chargement stats', 'error');
  }
}
// Bug 3 fix — Exposer les fonctions de products_upload.js sur window
window.publishProduct              = publishProduct;
window.viewMyProducts              = viewMyProducts;
window.deleteProduct               = deleteProduct;
window.openSendToPromo             = openSendToPromo;
window.transferToPromo             = transferToPromo;
window.viewMyPromos                = viewMyPromos;
window.deletePromo                 = deletePromo;
window.loadPromos                  = loadPromos;
window.loadMorePromos              = loadMorePromos;
window.loadMoreMyProducts          = loadMoreMyProducts;
window.loadMoreMyPromos            = loadMoreMyPromos;
window.openSellerDashboard         = openSellerDashboard;
window.openFournisseurDashboard    = openFournisseurDashboard;
window.viewMyStats                 = viewMyStats;
window.saveEditProduct             = saveEditProduct;
window.openEditProduct             = openEditProduct;
window.openProfile             = openProfile;
window.transferToPromoFromBtn  = transferToPromoFromBtn;
window.openPublishProduct      = openPublishProduct;
window.viewMyOrders            = viewMyOrders;
window.updateOrderStatus       = updateOrderStatus;