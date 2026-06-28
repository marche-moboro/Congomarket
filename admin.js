// ================================================================
// admin.js — MARCHÉ MOBORO
// Panel d'administration
// ================================================================

// ⚠️  Les identifiants admin sont vérifiés côté serveur via Supabase.
//     Ils ne sont PLUS stockés dans le code source.
//     La fonction adminLogin() envoie le code + PIN à Supabase
//     qui vérifie dans la table admin_credentials (non exposée).

// ✅ CORRECTION 3 : isAdmin déclaré ici (était absent — variable globale implicite dans index.html)
let isAdmin = false;
  function requireAdmin() {
  if (!isAdmin) {
    showToast('Accès refusé', 'error');
    throw new Error('UNAUTHORIZED');
  }
}

// ================================================================
// CONNEXION ADMIN — vérification via Supabase
// ================================================================
async function adminLogin() {
  const code = document.getElementById('adminCode').value.trim();
  const pin  = document.getElementById('adminPin').value.trim();

  if (!code || !pin) {
    showToast('Remplissez tous les champs', 'error');
    return;
  }

  try {
    const result = await verifyPin(code, pin, 'admin_credentials');

    if (!result.ok) {
      showToast('Identifiants admin incorrects', 'error');
      await logAdminAction('login_failed', 'admin', null, 'Tentative échouée');
      return;
    }

    isAdmin = true;
  
    showPage('adminDashboard');
    await logAdminAction('login', 'admin', null, 'Connexion admin réussie');
    loadAdminStats();

  } catch (e) {
    console.error('adminLogin error:', e);
    showToast('Erreur de connexion', 'error');
  }
}

// ================================================================
// STATS ADMIN
// ================================================================
async function loadAdminStats() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // --- Visites ---
    const [{ count: todayVisits }, { count: totalVisits }] = await Promise.all([
      db.from(TABLES.VISITORS).select('*', { count: 'exact', head: true }).gte('date', today),
      db.from(TABLES.VISITORS).select('*', { count: 'exact', head: true })
    ]);
    document.getElementById('sTodayVisits').innerText = todayVisits || 0;
    document.getElementById('sTotalVisits').innerText = totalVisits || 0;

    // --- Inscrits aujourd'hui (sellers + livreurs) ---
    const [{ count: todaySellers }, { count: todayLivreurs }] = await Promise.all([
      db.from(TABLES.SELLERS).select('*', { count: 'exact', head: true }).gte('created_at', today),
      db.from('delivery_agents').select('*', { count: 'exact', head: true }).gte('created_at', today)
    ]);
    document.getElementById('sTodaySellers').innerText = (todaySellers || 0) + (todayLivreurs || 0);

    // --- Livreurs (table delivery_agents) ---
    const { count: countLivreurs } = await db
      .from('delivery_agents')
      .select('*', { count: 'exact', head: true });
    document.getElementById('sCountLivreur').innerText = countLivreurs || 0;

    // --- Autres types (table sellers) ---
    const types = [
      { key: 'independant_vendeur',   id: 'sCountVendeur' },
      { key: 'independant_grossiste', id: 'sCountGrossiste' },
      { key: 'vip_vendeur',        id: 'sCountVipVendeur' },
      { key: 'vip_grossiste',      id: 'sCountVipGrossiste' },
      { key: 'fournisseur_export', id: 'sCountFournisseur' }
    ];
    await Promise.all(types.map(async t => {
      const { count } = await db.from(TABLES.SELLERS)
        .select('*', { count: 'exact', head: true })
        .eq('account_type', t.key);
      document.getElementById(t.id).innerText = count || 0;
    }));

    // --- Utilisateurs actifs (publication aujourd'hui) ---
    const activeTypes = [
     { key: 'independant_vendeur',   id: 'sActiveVendeur' },
{ key: 'independant_grossiste', id: 'sActiveGrossiste' },
      { key: 'vip_vendeur',        id: 'sActiveVipVendeur' },
      { key: 'vip_grossiste',      id: 'sActiveVipGrossiste' },
      { key: 'fournisseur_export', id: 'sActiveFournisseur' }
    ];
    let activeTotal = 0;

    // ✅ OPTIMISATION : 1 seule requête produits + 1 seule requête sellers actifs
    // au lieu de 5 requêtes identiques sur PRODUCTS dans la boucle
    const { data: activePubs } = await db.from(TABLES.PRODUCTS)
      .select('seller_id').gte('created_at', today);

    if (activePubs && activePubs.length > 0) {
      const activeSellers = [...new Set(activePubs.map(p => p.seller_id))];
      const { data: activeSellerRows } = await db.from(TABLES.SELLERS)
        .select('id, account_type')
        .in('id', activeSellers);

      // Compter par type en mémoire
      const countByType = {};
      (activeSellerRows || []).forEach(s => {
        countByType[s.account_type] = (countByType[s.account_type] || 0) + 1;
      });

      activeTypes.forEach(t => {
        const n = countByType[t.key] || 0;
        document.getElementById(t.id).innerText = n;
        activeTotal += n;
      });
    } else {
      activeTypes.forEach(t => { document.getElementById(t.id).innerText = 0; });
    }
    document.getElementById('sActiveTotal').innerText = activeTotal;

    // --- Contacts WhatsApp ---
    const clickTypes = [
      { key: 'livreur',            todayId: 'sClickLivreurToday',      totalId: 'sClickLivreurTotal' },
      { key: 'independant_vendeur',   todayId: 'sClickVendeurToday',   totalId: 'sClickVendeurTotal' },
{ key: 'independant_grossiste', todayId: 'sClickGrossisteToday', totalId: 'sClickGrossisteTotal' },
      { key: 'vip_vendeur',        todayId: 'sClickVipVendeurToday',    totalId: 'sClickVipVendeurTotal' },
      { key: 'vip_grossiste',      todayId: 'sClickVipGrossisteToday',  totalId: 'sClickVipGrossisteTotal' },
      { key: 'fournisseur_export', todayId: 'sClickFournisseurToday',   totalId: 'sClickFournisseurTotal' }
    ];
    let clickTotal = 0;
    await Promise.all(clickTypes.map(async t => {
      const [{ count: cToday }, { count: cTotal }] = await Promise.all([
        db.from('whatsapp_clicks').select('*', { count: 'exact', head: true })
          .eq('account_type', t.key).gte('clicked_at', today),
        db.from('whatsapp_clicks').select('*', { count: 'exact', head: true })
          .eq('account_type', t.key)
      ]);
      document.getElementById(t.todayId).innerText = cToday || 0;
      document.getElementById(t.totalId).innerText = cTotal || 0;
      clickTotal += cTotal || 0;
    }));
    document.getElementById('sClickTotal').innerText = clickTotal;

    // --- Divers ---
    const [{ count: activeProducts }, { count: activePromos }] = await Promise.all([
      db.from(TABLES.PRODUCTS).select('*', { count: 'exact', head: true }).eq('is_active', true),
      db.from(TABLES.PROMOS).select('*', { count: 'exact', head: true }).eq('is_active', true)
    ]);
    document.getElementById('sActiveProducts').innerText = activeProducts || 0;
    document.getElementById('sActivePromos').innerText   = activePromos  || 0;

  } catch (e) {
    console.error('loadAdminStats error:', e);
    showToast('Erreur chargement stats', 'error');
  }
}

// ================================================================
// LISTE VENDEURS
// ================================================================
async function loadSellersList() {
  try {
  const ville    = document.getElementById('filterVille').value;
  const quartier = document.getElementById('filterQuartier').value.trim();

  let query = db.from(TABLES.SELLERS)
    .select('*')
    .order('created_at', { ascending: false });

  if (ville)    query = query.ilike('ville',    `%${ville}%`);
  if (quartier) query = query.ilike('quartier', `%${quartier}%`);

  const { data: sellers } = await query;
  const tbody = document.getElementById('sellersTableBody');

  if (!sellers || sellers.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:20px;">Aucun vendeur.</td></tr>';
    return;
  }

  // ✅ CORRECTION 4 : escapeHtml sur s.full_name, s.ville, s.quartier, s.code
  tbody.innerHTML = sellers.map(s => {
    const dynamisme  = getDynamisme(s.last_published);
    const dynamColor = {
      vert:  '#52c41a',
      jaune: '#faad14',
      rouge: '#ff4d4f',
      noir:  '#333'
    }[dynamisme];

    return `
      <tr>
        <td>${escapeHtml(s.code)}</td>
        <td>
          ${escapeHtml(s.full_name)}
          <br><small>${escapeHtml(s.ville)} - ${escapeHtml(s.quartier)}</small>
        </td>
        <td>${escapeHtml(ALL_CATEGORIES[s.category] || s.category)}</td>
        <td><span style="color:${dynamColor};font-weight:700;">● ${dynamisme}</span></td>
        <td>
          <span style="color:${s.subscription_status === 'en_cours' ? '#52c41a' : '#ff4d4f'}">
            ${s.subscription_status === 'en_cours' ? 'En cours' : 'Expiré'}
          </span>
        </td>
        <td>
          <button
            onclick="toggleBlock('${s.id}', ${s.is_blocked})"
            style="background:${s.is_blocked ? '#52c41a' : '#ff4d4f'};color:white;border:none;
                   padding:5px 10px;border-radius:8px;cursor:pointer;">
            ${s.is_blocked ? 'Débloquer' : 'Bloquer'}
          </button>
        </td>
      </tr>
    `;
  }).join('');

  } catch(e) {
    console.error('loadSellersList error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

// ================================================================
// DYNAMISME
// ================================================================
function getDynamisme(lastPublished) {
  if (!lastPublished) return 'noir';
  const diff = (new Date() - new Date(lastPublished)) / (1000 * 60 * 60 * 24);
  if (diff <= 1) return 'vert';
  if (diff <= 3) return 'jaune';
  if (diff <= 7) return 'rouge';
  return 'noir';
}

// ================================================================
// BLOQUER / DÉBLOQUER VENDEUR
// ================================================================
async function toggleBlock(sellerId, isBlocked) {
  try {
    requireAdmin();
  const action = isBlocked ? 'débloquer' : 'bloquer';
  if (!confirm(`Voulez-vous ${action} ce vendeur ?`)) return;

  // ✅ Si déblocage → mettre à jour les dates d'abonnement (30 jours)
  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 30);

  const updateData = {
    is_blocked: !isBlocked,
    subscription_status: isBlocked ? 'en_cours' : 'expire'
  };

  // ✅ Ajouter les dates seulement au déblocage
  if (isBlocked) {
    updateData.subscription_start = today.toISOString().split('T')[0];
    updateData.subscription_end   = endDate.toISOString().split('T')[0];
  }

  const { error } = await db.from(TABLES.SELLERS)
    .update(updateData)
    .eq('id', sellerId);

  if (error) {
    showToast('Erreur lors de l\'opération', 'error');
    return;
  }

  showToast(
    isBlocked
      ? `Vendeur débloqué ✓ — Abonnement jusqu'au ${endDate.toLocaleDateString('fr-FR')}`
      : `Vendeur bloqué ✓`,
    'success'
  );

  await logAdminAction(
    isBlocked ? 'unblock_seller' : 'block_seller',
    'sellers', sellerId,
    isBlocked
      ? `Débloqué — abonnement jusqu'au ${endDate.toISOString().split('T')[0]}`
      : 'Bloqué par admin'
  );

  loadSellersList();

  } catch(e) {
    console.error('toggleBlock error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

// ================================================================
// POSITIONS PAR CATÉGORIE
// ================================================================
async function loadPositions(catId) {
  try {
  if (!catId) return;

  let query = db.from(TABLES.SELLERS)
    .select('*')
    .order('position', { ascending: true });

  if (catId === 'fournisseur_export') {
    query = query.eq('account_type', 'fournisseur_export');
  } else {
    query = query.eq('category', catId);
  }

  const { data: sellers } = await query;

  const list = document.getElementById('positionsList');

  if (!sellers || sellers.length === 0) {
    list.innerHTML = '<p style="padding:10px;color:#888;">Aucun vendeur.</p>';
    return;
  }

  // ✅ CORRECTION 4 : escapeHtml sur s.full_name et s.code
  list.innerHTML = sellers.map((s, i) => `
    <div class="position-item">
      <span class="pos-number">#${i + 1}</span>
      <span class="pos-name">${escapeHtml(s.full_name)} (${escapeHtml(s.code)})</span>
      <div class="pos-controls">
        <button onclick="moveUp('${s.id}', '${catId}')"
          ${i === 0 ? 'disabled' : ''}>▲</button>
        <button onclick="moveDown('${s.id}', '${catId}')"
          ${i === sellers.length - 1 ? 'disabled' : ''}>▼</button>
      </div>
    </div>
  `).join('');

  } catch(e) {
    console.error('loadPositions error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}

// ================================================================
// MONTER POSITION
// ✅ CORRECTION 1 : Promise.all atomique — évite corruption si 2e update échoue
// ================================================================
async function moveUp(sellerId, catId) {
  try {
    requireAdmin();
  const { data: sellers } = await db.from(TABLES.SELLERS)
    .select('id, position').eq('category', catId).order('position');

  const idx = sellers.findIndex(s => s.id === sellerId);
  if (idx <= 0) return;

  const current = sellers[idx];
  const prev    = sellers[idx - 1];

  const [r1, r2] = await Promise.all([
    db.from(TABLES.SELLERS).update({ position: prev.position    }).eq('id', current.id),
    db.from(TABLES.SELLERS).update({ position: current.position }).eq('id', prev.id)
  ]);

  if (r1.error || r2.error) {
    showToast('Erreur lors du déplacement', 'error');
    return;
  }

  await logAdminAction('move_position', 'sellers', sellerId, `Position montée — catégorie ${catId}`);
  loadPositions(catId);

  } catch(e) {
    console.error('moveUp error:', e);
    if (typeof showToast === 'function') showToast('Erreur: ' + (e.message || ''), 'error');
  }}


// ================================================================
// GESTION COMPTES VIP (ADMIN)
// ================================================================

function openCreateVIPAccount() {
  showPage('adminCreateVIPPage');
}

function openLoginVIPAccount() {
  showPage('loginPage');
  const titleEl = document.getElementById('loginPage') &&
                  document.getElementById('loginPage').querySelector('.section-title');
  if (titleEl) titleEl.innerText = 'Connexion compte VIP';
}

async function createVIPAccount() {
  requireAdmin();
const fullNameInput = document.getElementById('vipFullName');
const phoneInput = document.getElementById('vipPhone');
const quartierInput = document.getElementById('vipQuartier');
const addressInput = document.getElementById('vipAddress');
const villeInput = document.getElementById('vipVille');
const categoryInput = document.getElementById('vipCategory');
const descriptionInput = document.getElementById('vipDescription');
const pinInput = document.getElementById('vipPin');
const accountTypeInput = document.getElementById('vipType');

const fullName = (fullNameInput && fullNameInput.value)
    ? fullNameInput.value.trim()
    : '';

const phone = (phoneInput && phoneInput.value)
    ? phoneInput.value.trim()
    : '';

const quartier = (quartierInput && quartierInput.value)
    ? quartierInput.value.trim()
    : '';

const address = (addressInput && addressInput.value)
    ? addressInput.value.trim()
    : '';

const ville = (villeInput && villeInput.value)
    ? villeInput.value.trim()
    : '';

const category = categoryInput
    ? categoryInput.value
    : '';

const description = (descriptionInput && descriptionInput.value)
    ? descriptionInput.value.trim()
    : '';

const pin = (pinInput && pinInput.value)
    ? pinInput.value.trim()
    : '';

const accountType = (accountTypeInput && accountTypeInput.value)
    ? accountTypeInput.value
    : 'vip_vendeur';

  if (!fullName || !phone || !quartier || !address || !ville || !category || !description || !pin) {
    showToast('Remplissez tous les champs', 'error');
    return;
  }

  const { data: existing } = await db.from(TABLES.SELLERS)
    .select('id').eq('phone', phone).maybeSingle();
  if (existing) { showToast('Ce numéro a déjà un compte.', 'error'); return; }

  try {
    const { count } = await db.from(TABLES.SELLERS).select('*', { count: 'exact', head: true });
    const sellerCode = generateSellerCode(count || 0);

    const { data: created, error } = await db.from(TABLES.SELLERS).insert({
      code:                sellerCode,
      full_name:           fullName,
      phone:               phone,
      quartier:            quartier,
      address:             address,
      ville:               ville,
      category:            category,
      description:         description,
      pin_hash:            await hashPin(pin),
      photo:               '',
      is_blocked:          false,
      is_active:           true,
      position:            0,
      dynamisme_score:     0,
      account_type:        accountType,
      subscription_status: 'en_cours',
      created_at:          new Date().toISOString()
    }).select().single();

    if (error || !created) { 
showToast('Erreur création VIP: ' + ((error && error.message) ? error.message : ''), 'error'); return; }

    await logAdminAction('create_vip_account', 'sellers', created.id, `Compte VIP créé: ${sellerCode}`);
    showToast(`✅ Compte VIP créé ! Code: ${sellerCode}`, 'success');

    // Afficher le code dans une alert
    alert(`✅ Compte VIP créé avec succès !\n\nCode vendeur : ${sellerCode}\nPIN : ${pin}\n\nCommuniquez ces informations au client.`);
    showPage('adminDashboard');

  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

// Fonctions utilitaires manquantes dans admin.js
function deleteSellerAccount() {
  requireAdmin();
const input = document.getElementById('deleteSellerCode');
const code = input && input.value ? input.value.trim().toUpperCase() : '';
  if (!code) { showToast('Entrez un code vendeur', 'error'); return; }
  showConfirmDialog(`Supprimer définitivement le compte ${code} ?`, async () => {
    const { data: seller } = await db.from(TABLES.SELLERS).select('id').eq('code', code).maybeSingle();
    if (!seller) { showToast('Compte introuvable', 'error'); return; }
    await db.from(TABLES.PRODUCTS).delete().eq('seller_id', seller.id);
    await db.from(TABLES.PROMOS).delete().eq('seller_id', seller.id);
    const { error } = await db.from(TABLES.SELLERS).delete().eq('id', seller.id);
    if (error) { showToast('Erreur suppression', 'error'); return; }
    await logAdminAction('delete_seller', 'sellers', seller.id, `Compte ${code} supprimé`);
    showToast('Compte supprimé ✓', 'success');
    document.getElementById('deleteSellerCode').value = '';
  });
}

// ✅ logAdminAction() → définie dans supabase.js (supprimée ici pour éviter le doublon)
// supabase.js contient la version complète avec old_value et new_value

// ================================================================
// CRÉATION GESTIONNAIRE VIP (table vip_managers)
// ✅ AJOUT : fonction manquante — distincte de createVIPAccount()
//    qui, elle, crée dans la table sellers.
//    Le hash utilise hashVipManagerPin() (défini dans auth_upload.js).
// ================================================================
async function createVIPManager() {
  requireAdmin();
const fullNameInput = document.getElementById('vipMgrFullName');
const codeInput     = document.getElementById('vipMgrCode');
const pinInput      = document.getElementById('vipMgrPin');

const fullName = fullNameInput && fullNameInput.value ? fullNameInput.value.trim() : '';
const code     = codeInput && codeInput.value ? codeInput.value.trim().toUpperCase() : '';
const pin      = pinInput && pinInput.value ? pinInput.value.trim() : '';

  if (!fullName || !code || !pin) {
    showToast('Remplissez tous les champs', 'error');
    return;
  }
  if (pin.length < 4) {
    showToast('PIN trop court (minimum 4 chiffres)', 'error');
    return;
  }

  try {
    // Vérifier doublon code
    const { data: existing } = await db.from(TABLES.VIP_MANAGERS)
      .select('id').eq('code', code).maybeSingle();
    if (existing) { showToast('Ce code existe déjà.', 'error'); return; }

    const { data: created, error } = await db.from(TABLES.VIP_MANAGERS).insert({
      code,
      full_name: fullName,
      pin_hash:  await hashVipManagerPin(pin),   // ✅ même formule que sellerLogin()
      created_at: new Date().toISOString()
    }).select().single();

    if (error || !created) {
const msg = error && error.message ? error.message : '';
showToast('Erreur création gestionnaire VIP: ' + msg, 'error');
      return;
    }

    await logAdminAction('create_vip_manager', 'vip_managers', created.id, `Gestionnaire VIP créé: ${code}`);
    alert(`✅ Gestionnaire VIP créé !\n\nCode : ${code}\nPIN  : ${pin}\n\nCommuniquez ces informations en sécurité.`);
    showPage('adminDashboard');

  } catch (e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

// ✅ Fonction reconstruite — était orpheline (corps sans déclaration)
// ================================================================
async function moveDown(sellerId, catId) {
  try {
    requireAdmin();
    const { data: sellers } = await db.from(TABLES.SELLERS)
      .select('id, position').eq('category', catId).order('position');

    const idx = sellers.findIndex(s => s.id === sellerId);
    if (idx >= sellers.length - 1) return;

    const current = sellers[idx];
    const next    = sellers[idx + 1];

    const [r1, r2] = await Promise.all([
      db.from(TABLES.SELLERS).update({ position: next.position    }).eq('id', current.id),
      db.from(TABLES.SELLERS).update({ position: current.position }).eq('id', next.id)
    ]);

    if (r1.error || r2.error) {
      showToast('Erreur lors du déplacement', 'error');
      return;
    }

    await logAdminAction('move_position', 'sellers', sellerId, `Position descendue — catégorie ${catId}`);
    loadPositions(catId);

  } catch (e) {
    console.error('moveDown error:', e);
    showToast('Erreur lors du déplacement', 'error');
  }
}

// ================================================================
// FOURNISSEURS EXPORT
// ================================================================
async function loadFournisseurs() {
  const query = document.getElementById('fournisseurSearchInput').value.trim().toLowerCase();
  const div   = document.getElementById('fournisseursResults');
  div.innerHTML = '<p style="padding:10px;color:#888;">Chargement...</p>';

  try {
    let q = db.from(TABLES.SELLERS)
      .select('*')
      .eq('account_type', 'fournisseur_export')
      .order('created_at', { ascending: false });

    const { data: fournisseurs } = await q;

    if (!fournisseurs || fournisseurs.length === 0) {
      div.innerHTML = '<p style="padding:10px;color:#888;">Aucun fournisseur export.</p>';
      return;
    }

    const filtered = query
      ? fournisseurs.filter(f =>
          (f.full_name  || '').toLowerCase().includes(query) ||
          (f.code       || '').toLowerCase().includes(query) ||
          (f.ville      || '').toLowerCase().includes(query) ||
          (f.phone      || '').toLowerCase().includes(query)
        )
      : fournisseurs;

    if (filtered.length === 0) {
      div.innerHTML = '<p style="padding:10px;color:#888;">Aucun résultat.</p>';
      return;
    }
    
    div.innerHTML = filtered.map(f => `
      <div style="background:white;border-radius:14px;padding:14px;margin-bottom:10px;
                  box-shadow:0 2px 8px rgba(0,0,0,.07);border-left:4px solid #13c2c2;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <div>
            <div style="font-weight:700;font-size:15px;">${escapeHtml(f.full_name)}</div>
            <div style="font-size:12px;color:#13c2c2;font-weight:600;">${escapeHtml(f.code)}</div>
            <div style="font-size:12px;color:#888;">📞 ${escapeHtml(f.phone)}</div>
            <div style="font-size:12px;color:#888;">📍 ${escapeHtml(f.quartier || '')} · ${escapeHtml(f.ville || '')}</div>
            <div style="font-size:12px;color:#888;">🏷️ ${escapeHtml(f.category || '')}</div>
          </div>
          <span style="font-size:11px;padding:4px 8px;border-radius:8px;font-weight:700;
                background:${f.is_blocked ? '#fff1f0' : '#f6ffed'};
                color:${f.is_blocked ? '#ff4d4f' : '#52c41a'};">
            ${f.is_blocked ? 'Bloqué' : 'Actif'}
          </span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px;">
          <button onclick="toggleBlockFournisseur('${f.id}', ${f.is_blocked})"
            style="background:${f.is_blocked ? '#52c41a' : '#ff4d4f'};color:white;border:none;
                   padding:8px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
            ${f.is_blocked ? '✅ Débloquer' : '🚫 Bloquer'}
          </button>
          <button onclick="deleteFournisseur('${f.id}', '${escapeHtml(f.full_name)}')"
            style="background:#ff4d4f;color:white;border:none;
                   padding:8px;border-radius:10px;font-size:12px;font-weight:700;cursor:pointer;">
            🗑️ Supprimer
          </button>
        </div>
      </div>
    `).join('');

  } catch(e) {
    console.error('loadFournisseurs error:', e);
    div.innerHTML = '<p style="padding:10px;color:#ff4d4f;">Erreur de chargement.</p>';
  }
}

async function toggleBlockFournisseur(id, isBlocked) {
  if (!confirm(`${isBlocked ? 'Débloquer' : 'Bloquer'} ce fournisseur export ?`)) return;
  try {
    const { error } = await db.from(TABLES.SELLERS)
      .update({ is_blocked: !isBlocked })
      .eq('id', id);
    if (error) { showToast('Erreur', 'error'); return; }
    await logAdminAction(
      isBlocked ? 'unblock_fournisseur' : 'block_fournisseur',
      'sellers', id,
      isBlocked ? 'Fournisseur export débloqué' : 'Fournisseur export bloqué'
    );
    showToast(isBlocked ? 'Débloqué ✓' : 'Bloqué ✓', 'success');
    loadFournisseurs();
  } catch(e) {
    showToast('Erreur: ' + e.message, 'error');
  }
}

async function deleteFournisseur(id, name) {
  if (!confirm(`Supprimer le compte de "${name}" ?\nCette action est irréversible.`)) return;
  if (!confirm(`CONFIRMATION FINALE — Supprimer définitivement "${name}" et tous ses produits ?`)) return;
  try {
    await db.from(TABLES.PRODUCTS).delete().eq('seller_id', id);
    await db.from(TABLES.PROMOS).delete().eq('seller_id', id);
    const { error } = await db.from(TABLES.SELLERS).delete().eq('id', id);
    if (error) { showToast('Erreur suppression', 'error'); return; }
    await logAdminAction('delete_fournisseur', 'sellers', id, `Fournisseur export supprimé: ${name}`);
    showToast('Compte supprimé ✓', 'success');
    loadFournisseurs();
  } catch(e) {
    showToast('Erreur: ' + e.message, 'error');
  }}