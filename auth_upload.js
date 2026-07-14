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

async function openRegister() {
  const { data } = await db.from('settings').select('value').eq('key','inscription_vendeur_independant').maybeSingle();
  if (data && data.value === 'off') {
    document.getElementById('inscriptionBloqueeModal').style.display = 'flex';
    return;
  }
  showPage('termsPage');
}
function refuseTerms()    { showPage('homePage');     }
async function acceptTerms() {
  const { data } = await db.from('settings').select('value').eq('key','inscription_vendeur_independant').maybeSingle();
  if (data && data.value === 'off') {
    document.getElementById('inscriptionBloqueeModal').style.display = 'flex';
    return;
  }
  showPage('registerPage');
}
function openSellerLogin(){ showPage('loginPage');    }

function initRegisterPage() {
  previewImage('regPhotoFile', 'regPhotoPreview');
}

// ================================================================
// INSCRIPTION — Étape 1 : formulaire
// ================================================================
async function registerSeller() {
  const fullName    = document.getElementById('regFullName').value.trim();
  const countryCode = document.getElementById('regCountryCode').value.trim();
  const rawPhone    = document.getElementById('regPhone').value.trim().replace(/^0+/, '');
  const phone       = countryCode + rawPhone;
  const quartier    = document.getElementById('regQuartier').value.trim();
  const address     = document.getElementById('regAddress').value.trim();
  const ville       = document.getElementById('regVille').value.trim();
  const category    = document.getElementById('regCategory').value;
  const description = document.getElementById('regDescription').value.trim();
const photoInput = document.getElementById('regPhotoFile');
const photoFile = photoInput && photoInput.files ? photoInput.files[0] : undefined;

  if (!fullName || !phone || !quartier || !address || !ville || !category || !description) {
    showToast('Veuillez remplir tous les champs', 'error');
    return;
  }

  // Validation format téléphone international (indicatif + numéro)
  if (!countryCode) {
    showToast('Veuillez sélectionner votre indicatif pays', 'error');
    return;
  }
  const phoneClean = phone.replace(/[\s\-().]/g, '');
  if (!/^\d{11,15}$/.test(phoneClean)) {
    showToast('Numéro invalide. Entrez votre numéro sans le 0 initial.', 'error');
    return;
  }
  const phoneNorm = phoneClean;

  try {
    const { data: blocked } = await db.from(TABLES.BLOCKED_PHONES)
      .select('id').eq('phone', phoneNorm).maybeSingle();
    if (blocked) {
      showToast('Ce numéro est banni de la plateforme.', 'error');
      return;
    }

    const { data: existing } = await db.from(TABLES.SELLERS)
      .select('id').eq('phone', phoneNorm).maybeSingle();
    if (existing) {
      showToast('Ce numéro a déjà un compte.', 'error');
      return;
    }

    let photoUrl = '';
    if (photoFile) {
      showToast('Upload photo en cours...', 'info');
      photoUrl = await uploadPhoto(photoFile, 'sellers') || '';
    }

    window._pendingSellerData = {
      fullName, phone: phoneNorm, quartier, address,
      ville, category, description, photoUrl
    };
    showPage('pinPage');

  } catch (e) {
    console.error('registerSeller exception:', e);
    showToast('Erreur réseau. Réessayez.', 'error');
  }
}

// ================================================================
// INSCRIPTION — Étape 2 : PIN + création compte
// ================================================================
async function validatePin() {
  const pin        = document.getElementById('pinInput').value.trim();
  const pinConfirm = document.getElementById('pinConfirmInput').value.trim();

  if (pin.length < 4) {
    showToast('PIN trop court (minimum 4 chiffres)', 'error');
    return;
  }
  if (pin !== pinConfirm) {
    showToast('Les PINs ne correspondent pas', 'error');
    return;
  }

  const data = window._pendingSellerData;
  if (!data) { showPage('registerPage'); return; }

  try {
    const { count: _sellerCount } = await db.from(TABLES.SELLERS)
  .select('*', { count: 'exact', head: true });
const sellerCode = generateSellerCode(_sellerCount || 0);

    const { data: sysSetting } = await db.from('settings').select('value').eq('key','subscription_system').maybeSingle();
    const sysOn = sysSetting && sysSetting.value === 'on';
    const today = new Date();
    const freeMonthEnd = new Date(today);
    freeMonthEnd.setDate(freeMonthEnd.getDate() + 30);

    const newSeller = {
      code:                sellerCode,
      full_name:           data.fullName,
      phone:               data.phone,
      quartier:            data.quartier,
      address:             data.address,
      ville:               data.ville,
      category:            data.category,
      description:         data.description,
      pin_hash:            await hashPin(pin),
      photo:               data.photoUrl,
      is_blocked:          false,
      is_active:           true,
      position:            0,
      dynamisme_score:     0,
      last_published:      null,
      subscription_status: 'en_cours',
   subscription_start:  sysOn ? today.toISOString().split('T')[0] : null,
      subscription_end:    sysOn ? freeMonthEnd.toISOString().split('T')[0] : null, // 🎉 30 jours offerts si système actif
      created_at:          new Date().toISOString()
    };

    const { data: created, error } = await db.from(TABLES.SELLERS)
      .insert(newSeller).select().single();

    if (error || !created) {
      console.error('validatePin error:', JSON.stringify(error));
      showToast('Erreur lors de la création du compte', 'error');
      return;
    }

    notifyAdmin(created);

    document.getElementById('notifName').innerText = data.fullName;
    document.getElementById('notifCode').innerText = sellerCode;
    document.getElementById('notifTarif').innerText = 'Frais : Période promo.';
    showPage('registerSuccessPage');
    window._pendingSellerData = null;

  } catch (e) {
    console.error('validatePin exception:', e);
    showToast('Erreur lors de la création du compte', 'error');
  }
}

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
          await autoBlockExpired(livreur.id, 'delivery_agents');
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
        await autoBlockExpired(seller.id, 'sellers');
        showAbonnementExpireModal(seller.full_name, seller.subscription_end);
        return;
      }
    }

    currentSeller = seller;
_loggedSellerCode = seller.code; // ← mémoriser le code du compte connecté
subscribeSellerOrderNotifications(seller.id);
localStorage.setItem('seller_code', code);
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
      const { data: seller } = await db.from(TABLES.SELLERS)
        .select('*').eq('code', codeToUse).maybeSingle();

      if (seller && !seller.is_blocked) {
        if (isSubscriptionActive()) {
          const statut = checkSubscriptionExpiry(seller.subscription_end);
          if (statut === 'expire') {
            await autoBlockExpired(seller.id, 'sellers');
            localStorage.removeItem('seller_code');
            localStorage.removeItem('export_code');
          } else {
            currentSeller = seller;
         _loggedSellerCode = seller.code; // ← sync au rechargement
            updateProfileIcon();
            subscribeSellerOrderNotifications(seller.id);
          }
        } else {
           currentSeller = seller;
          _loggedSellerCode = seller.code; // ← sync au rechargement
          updateProfileIcon();
          subscribeSellerOrderNotifications(seller.id);
        }
      } else {
        localStorage.removeItem('seller_code');
        localStorage.removeItem('export_code');
      }
    }

    // ── Session livreur ──
    const savedLivreurCode = localStorage.getItem('livreur_code');
    if (savedLivreurCode) {
      const { data: livreur } = await db.from('delivery_agents')
        .select('*').eq('code', savedLivreurCode).maybeSingle();
      if (livreur && !livreur.is_blocked) {
        if (isSubscriptionActive()) {
          const statut = checkSubscriptionExpiry(livreur.subscription_end);
          if (statut === 'expire') {
            await autoBlockExpired(livreur.id, 'delivery_agents');
            localStorage.removeItem('livreur_code');
          } else {
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
          }
        } else {
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
        }
      } else {
        localStorage.removeItem('livreur_code');
      }
    }

  } catch(e) {
    console.error('checkSession error:', e);
  }
}

function logoutSeller() {
  unsubscribeSellerOrderNotifications();
  currentSeller = null;
  _loggedSellerCode = null; // ← reset
  localStorage.removeItem('seller_code');
  localStorage.removeItem('livreur_code');
  localStorage.removeItem('export_code');
  window._currentLivreur = null;
  window.currentViewedSeller = null; // ← reset vendeur consulté
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
window.registerSeller              = registerSeller;
window.validatePin                 = validatePin;
window.sellerLogin                 = sellerLogin;
window.checkSession                = checkSession;
window.logoutSeller                = logoutSeller;
window.openRegister                = openRegister;
window.acceptTerms                 = acceptTerms;
window.openSellerLogin             = openSellerLogin;
window.showAbonnementExpireModal   = showAbonnementExpireModal;
window.closeAbonnementExpireModal  = closeAbonnementExpireModal;
window.updateProfileIcon           = updateProfileIcon;
