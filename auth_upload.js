// ================================================================
// auth.js — MARCHÉ MOBORO (avec upload photo)
// ================================================================

let currentSeller = null;
// Identifiant du compte connecté — ne change qu'au login/logout
// Distinct de window.currentViewedSeller (vendeur consulté en tant que client)
let _loggedSellerCode = null;

// ================================================================
// HASH PIN — Gestionnaire VIP (table vip_managers)
// ⚠️  Formule différente de hashPin() qui sert aux vendeurs standards.
// ================================================================
function openSellerLogin(){ showPage('loginPage');    }



// ================================================================
// NOTIFICATION ADMIN WHATSAPP — désactivée
// ================================================================
function notifyAdmin(seller) {
  // Notification WhatsApp désactivée
}

// ================================================================
// CONNEXION VENDEUR STANDARD
// ================================================================
async function sellerLogin() {
  const code = document.getElementById('loginCode').value.trim().toUpperCase();
  const pin  = document.getElementById('loginPin').value.trim();

  if (!code || !pin) {
    showToast('Remplissez tous les champs', 'error');
    return;
  }

  try {
    // ✅ Vérifier d'abord si c'est un gestionnaire VIP
const vipRes = await verifyPin(code, pin, 'vip_managers');
if (vipRes.ok) {
  const vipMgr = vipRes.account;
  _vipManagerConnected = true;
  _vipManagerCode = code;
  sessionStorage.setItem('vip_manager', code);
  sessionStorage.setItem('vip_session_token', vipRes.session_token);
  const welcome = document.getElementById('vipManagerWelcome');
  if (welcome) welcome.innerText = vipMgr.full_name || code;
  showToast('Bienvenue dans l\'espace VIP 👑', 'success');
  showPage('adminDashboard');
  return;
}

if (code.startsWith('MBRL')) {
  const livRes = await verifyPin(code, pin, 'delivery_agents');
  if (!livRes.ok) { showToast('Code ou PIN incorrect', 'error'); return; }
  const livreur = livRes.account;
      if (livreur.is_blocked) {
        showToast('Compte bloqué. Contactez l\'admin.', 'error');
        document.getElementById('blockedModal').style.display = 'flex';
        return;
      }

      // ── Vérification abonnement livreur ──
      if (isSubscriptionActive()) {
        const statut = checkSubscriptionExpiry(livreur.subscription_end);
        if (statut === 'expire') {
          await autoBlockExpired(livreur.code, 'delivery_agents');
          showAbonnementExpireModal(livreur.full_name, livreur.subscription_end);
          return;
        }
      }

      window._currentLivreur = {
        fullName: livreur.full_name, phone: livreur.phone,
        ville: livreur.ville, quartier: livreur.quartier,
        moyen: livreur.moyen, description: livreur.description,
        photoUrl: livreur.photo, code: livreur.code, id: livreur.id,
        subscription_end: livreur.subscription_end,
        tarif_1_de: livreur.tarif_1_de, tarif_1_a: livreur.tarif_1_a, tarif_1_prix: livreur.tarif_1_prix,
        tarif_2_de: livreur.tarif_2_de, tarif_2_a: livreur.tarif_2_a, tarif_2_prix: livreur.tarif_2_prix,
        tarif_3_de: livreur.tarif_3_de, tarif_3_a: livreur.tarif_3_a, tarif_3_prix: livreur.tarif_3_prix,
      };
      localStorage.setItem('livreur_code', code);
      localStorage.setItem('livreur_session_token', livRes.session_token);
      showToast('Bienvenue ' + livreur.full_name, 'success');
      openLivreurDashboard();
      return;
    }

    // ── Connexion vendeur / grossiste / VIP / fournisseur ───────
    const selRes = await verifyPin(code, pin, 'sellers');
if (!selRes.ok) { showToast('Code ou PIN incorrect', 'error'); return; }
const seller = selRes.account;

    if (seller.is_blocked) {
      showToast('Compte bloqué. Contactez l\'admin.', 'error');
      document.getElementById('blockedModal').style.display = 'flex';
      return;
    }

    // ── Vérification abonnement vendeur ──
    if (isSubscriptionActive()) {
      const statut = checkSubscriptionExpiry(seller.subscription_end);
      if (statut === 'expire') {
        await autoBlockExpired(seller.code, 'sellers');
        showAbonnementExpireModal(seller.full_name, seller.subscription_end);
        return;
      }
    }

    currentSeller = seller;
_loggedSellerCode = seller.code; // ← mémoriser le code du compte connecté
subscribeSellerOrderNotifications(seller.id);
localStorage.setItem('seller_code', code);
localStorage.setItem('seller_session_token', selRes.session_token);
    showToast('Bienvenue ' + seller.full_name, 'success');

    if (seller.account_type === 'fournisseur_export') {
      localStorage.setItem('export_code', code);
      openFournisseurDashboard();
    } else if (seller.account_type && seller.account_type.startsWith('vip')) {
      openVIPClientDashboard();
    } else {
      openSellerDashboard();
    }

  } catch (e) {
    console.error('sellerLogin exception:', e);
    showToast('Erreur réseau. Réessayez.', 'error');
  }
}

// ================================================================
// MODAL ABONNEMENT EXPIRÉ
// ================================================================
function showAbonnementExpireModal(nom, dateExpiration) {
  const dateStr = dateExpiration
    ? new Date(dateExpiration).toLocaleDateString('fr-FR')
    : 'inconnue';
  const code = localStorage.getItem('seller_code') || localStorage.getItem('livreur_code') || '';
  const msg  = encodeURIComponent(
    `Bonjour, mon abonnement Marché Moboro a expiré le ${dateStr}.\nCode : ${code}\nJe souhaite renouveler.`
  );
  const modal = document.getElementById('abonnementExpireModal');
  if (modal) {
    document.getElementById('expireNom').innerText  = nom;
    document.getElementById('expireDate').innerText = dateStr;
    document.getElementById('expireWaBtn').href = `https://wa.me/${ADMIN_PHONE}?text=${msg}`;
    modal.style.display = 'flex';
  } else {
    alert(`⛔ Abonnement expiré le ${dateStr}.\nContactez l'admin pour renouveler.\nCode : ${code}`);
  }
}

function closeAbonnementExpireModal() {
  const modal = document.getElementById('abonnementExpireModal');
  if (modal) modal.style.display = 'none';
}
// ================================================================
// SESSION
// ✅ CORRIGÉ : la session n'est plus restaurée à partir d'un simple code
// stocké en clair (usurpable par quiconque connaît le code public d'un
// vendeur). Elle exige désormais un session_token valide, vérifié
// côté serveur via account-actions / check_session.
// ================================================================
async function checkSession() {
  try {
    // ── Charger le flag système abonnement ──
    await loadSubscriptionSetting();

    // ── Session vendeur / grossiste / VIP / fournisseur ──
    const savedCode = localStorage.getItem('seller_code');
    // ── Si export_code existe et seller_code aussi, export_code prend priorité ──
    const savedExportCode = localStorage.getItem('export_code');

    const codeToUse = savedExportCode || savedCode;

    if (codeToUse) {
      const sellerSessionToken = localStorage.getItem('seller_session_token');
      let seller = null;

      if (sellerSessionToken) {
        try {
          const res = await fetch(SUPABASE_URL + '/functions/v1/account-actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
            body: JSON.stringify({ action: 'check_session', table: 'sellers', session_token: sellerSessionToken })
          });
          const result = await res.json();
          seller = result.ok ? result.account : null;
        } catch (e) {
          console.error('check_session (seller) error:', e);
          seller = null;
        }
      }

      if (seller && !seller.is_blocked) {
        let expired = false;
        if (isSubscriptionActive()) {
          const statut = checkSubscriptionExpiry(seller.subscription_end);
          if (statut === 'expire') {
            expired = true;
            await autoBlockExpired(seller.code, 'sellers');
            localStorage.removeItem('seller_code');
            localStorage.removeItem('export_code');
            localStorage.removeItem('seller_session_token');
          }
        }
        if (!expired) {
          currentSeller = seller;
          _loggedSellerCode = seller.code; // ← sync au rechargement
          updateProfileIcon();
          subscribeSellerOrderNotifications(seller.id);
          // ✅ Déjà connecté : direct au tableau de bord, pas la page d'accueil
          if (seller.account_type === 'fournisseur_export') openFournisseurDashboard();
          else if (seller.account_type && seller.account_type.startsWith('vip')) openVIPClientDashboard();
          else openSellerDashboard();
        }
      } else {
        localStorage.removeItem('seller_code');
        localStorage.removeItem('export_code');
        localStorage.removeItem('seller_session_token');
      }
    }

    // ── Session livreur ──
    const savedLivreurCode = localStorage.getItem('livreur_code');
    const livreurSessionToken = localStorage.getItem('livreur_session_token');

    if (savedLivreurCode && livreurSessionToken) {
      let livreur = null;
      try {
        const livRes = await fetch(SUPABASE_URL + '/functions/v1/account-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
          body: JSON.stringify({ action: 'check_session', table: 'delivery_agents', session_token: livreurSessionToken })
        });
        const livResult = await livRes.json();
        livreur = livResult.ok ? livResult.account : null;
      } catch (e) {
        console.error('check_session (livreur) error:', e);
        livreur = null;
      }

      if (livreur && !livreur.is_blocked) {
        let expired = false;
        if (isSubscriptionActive()) {
          const statut = checkSubscriptionExpiry(livreur.subscription_end);
          if (statut === 'expire') {
            expired = true;
            await autoBlockExpired(livreur.code, 'delivery_agents');
            localStorage.removeItem('livreur_code');
            localStorage.removeItem('livreur_session_token');
          }
        }
        if (!expired) {
          window._currentLivreur = {
            fullName: livreur.full_name, phone: livreur.phone,
            ville: livreur.ville, quartier: livreur.quartier,
            moyen: livreur.moyen, description: livreur.description,
            photoUrl: livreur.photo, code: livreur.code, id: livreur.id,
            subscription_end: livreur.subscription_end,
            tarif_1_de: livreur.tarif_1_de, tarif_1_a: livreur.tarif_1_a, tarif_1_prix: livreur.tarif_1_prix,
            tarif_2_de: livreur.tarif_2_de, tarif_2_a: livreur.tarif_2_a, tarif_2_prix: livreur.tarif_2_prix,
            tarif_3_de: livreur.tarif_3_de, tarif_3_a: livreur.tarif_3_a, tarif_3_prix: livreur.tarif_3_prix,
          };
          // ✅ Déjà connecté : direct au tableau de bord
          openLivreurDashboard();
        }
      } else {
        localStorage.removeItem('livreur_code');
        localStorage.removeItem('livreur_session_token');
      }
    } else if (savedLivreurCode && !livreurSessionToken) {
      // Ancien localStorage sans token (avant migration) — on force une reconnexion propre
      localStorage.removeItem('livreur_code');
    }

  } catch(e) {
    console.error('checkSession error:', e);
  }
}

function logoutSeller() {
  unsubscribeSellerOrderNotifications();

  const sellerToken = localStorage.getItem('seller_session_token');
  const livreurToken = localStorage.getItem('livreur_session_token');

  if (sellerToken) {
    fetch(SUPABASE_URL + '/functions/v1/account-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout', table: 'sellers', session_token: sellerToken })
    }).catch(() => {});
  }
  if (livreurToken) {
    fetch(SUPABASE_URL + '/functions/v1/account-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'logout', table: 'delivery_agents', session_token: livreurToken })
    }).catch(() => {});
  }

  currentSeller = null;
  _loggedSellerCode = null;
  localStorage.removeItem('seller_code');
  localStorage.removeItem('livreur_code');
  localStorage.removeItem('export_code');
  localStorage.removeItem('seller_session_token');
  localStorage.removeItem('livreur_session_token');
  sessionStorage.removeItem('vip_session_token');
  window._currentLivreur = null;
  window.currentViewedSeller = null;
  showPage('homePage');
  showToast('Déconnecté', 'info');
}

// ================================================================
// ICÔNE PROFIL
// ================================================================
function updateProfileIcon() {
  const icon = document.getElementById('profileIcon');
  if (!icon) return;
  if (currentSeller) {
    icon.style.display    = 'flex';
    icon.style.background = '#1677FF';
    icon.innerHTML = currentSeller.photo
      ? `<img src="${escapeHtml(currentSeller.photo)}"
             style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : escapeHtml(currentSeller.full_name.charAt(0).toUpperCase());
  } else {
    icon.style.display = 'none';
  }
}

// Bug 3 fix — Exposer les fonctions de auth_upload.js sur window
window.sellerLogin                 = sellerLogin;
window.checkSession                = checkSession;
window.logoutSeller                = logoutSeller;
window.openSellerLogin             = openSellerLogin;
window.showAbonnementExpireModal   = showAbonnementExpireModal;
window.closeAbonnementExpireModal  = closeAbonnementExpireModal;
window.updateProfileIcon           = updateProfileIcon;
