// ================================================================
// notifications.js — Marché Moboro
// Alertes visiteurs : abonnement automatique, préférences (catégories /
// vendeurs), badge « nouveautés » sur le bouton ☰, liens profonds
// (?produit=ID , ?inscription=vendeur|taxi).
// Dépend de : supabase.js (db, TABLES, SUPABASE_URL, SUPABASE_KEY,
//             TREE_A/TREE_B1/TREE_B2), index.html (openLightbox, ...)
// ================================================================
(function () {
  'use strict';

  const VAPID_KEY = 'BETaKCUXbi_24cmp2qv-8v5xHrhW-gMCYlWCxNljiqO_Cp5TjZmxgLPYcymD4m21aypPaqlrq5eJn8FFuFrlp7k';
  const FN_URL    = SUPABASE_URL + '/functions/v1/push-subscribe';
  const LS_PREFS  = 'mbr_notif_prefs';
  const LS_SEEN   = 'mbr_news_seen';
  const LS_ASKED  = 'mbr_notif_asked';
  const LS_MEMBER = 'mbr_member';
  const MAX_SELLERS = 30;

  // ---------- petits outils ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };

  function urlB64ToU8(b64) {
    const pad = '='.repeat((4 - b64.length % 4) % 4);
    const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
  }

  // ---------- préférences ----------
  function loadPrefs() {
    try {
      const p = JSON.parse(lsGet(LS_PREFS) || 'null');
      if (p && typeof p === 'object') {
        return {
          all: p.all !== false,
          cats: Array.isArray(p.cats) ? p.cats : [],
          sellers: Array.isArray(p.sellers) ? p.sellers : []
        };
      }
    } catch (e) {}
    return { all: true, cats: [], sellers: [] };
  }
  let prefs = loadPrefs();
  function savePrefs() {
    lsSet(LS_PREFS, JSON.stringify(prefs));
    syncPrefsToServer();
    refreshBadge();
  }
  // Appareil d'un vendeur / Taxi inscrit (connecté ici, ou déjà reconnu avant) :
  // il ne reçoit plus les messages « nouveau vendeur / Taxi, rejoignez-nous ».
  function isMember() {
    if (lsGet(LS_MEMBER) === '1') return true;
    let m = false;
    try { m = !!((typeof currentSeller !== 'undefined' && currentSeller) || window._currentLivreur); } catch (e) {}
    if (m) lsSet(LS_MEMBER, '1');
    return m;
  }
  function watchMembership() {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (isMember()) { clearInterval(t); syncPrefsToServer(); }
      else if (tries > 40) clearInterval(t);          // ~2 minutes ; sinon à la prochaine visite
    }, 3000);
  }
  const prefsPayload = () => {
    const p = { all: prefs.all, cats: prefs.cats, sellers: prefs.sellers.map((s) => s.id) };
    if (isMember()) p.member = true;
    return p;
  };

  // ---------- abonnement push ----------
  const supported = () =>
    'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  async function callFn(body) {
    const res = await fetch(FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
      body: JSON.stringify(body)
    });
    return res.json().catch(() => ({}));
  }

  async function getRegistration() {
    return navigator.serviceWorker.ready;
  }

  // askIfNeeded = true : on déclenche la demande d'autorisation du navigateur
  async function ensureSubscription(askIfNeeded) {
    if (!supported()) return 'unsupported';
    let perm = Notification.permission;
    if (perm === 'denied') return 'denied';
    if (perm === 'default') {
      if (!askIfNeeded) return 'default';
      lsSet(LS_ASKED, String(Date.now()));
      try { perm = await Notification.requestPermission(); } catch (e) { perm = 'default'; }
      if (perm !== 'granted') return perm === 'denied' ? 'denied' : 'default';
    }
    try {
      const reg = await getRegistration();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlB64ToU8(VAPID_KEY)
        });
      }
      // (re)enregistre à chaque visite : l'abonnement reste vivant, sans date d'expiration chez nous
      await callFn({ action: 'subscribe', subscription: sub.toJSON(), prefs: prefsPayload() });
      return 'granted';
    } catch (e) {
      console.warn('ensureSubscription:', e);
      return 'error';
    }
  }

  async function syncPrefsToServer() {
    if (!supported() || Notification.permission !== 'granted') return;
    try {
      const reg = await getRegistration();
      const sub = await reg.pushManager.getSubscription();
      if (sub) await callFn({ action: 'prefs', subscription: { endpoint: sub.endpoint }, prefs: prefsPayload() });
    } catch (e) { console.warn('syncPrefs:', e); }
  }

  // Démarrage automatique : silencieux si déjà autorisé ; sinon une seule
  // demande (du navigateur), après la première interaction du visiteur.
  function autoStart() {
    if (!supported()) return;
    if (Notification.permission === 'granted') {
      ensureSubscription(false).then(renderSection);
      return;
    }
    if (Notification.permission === 'denied') return;
    const last = Number(lsGet(LS_ASKED) || 0);
    if (Date.now() - last < 24 * 3600 * 1000) return; // pas plus d'une demande par jour
    const ask = () => {
      window.removeEventListener('pointerdown', ask, true);
      setTimeout(() => ensureSubscription(true).then(() => { renderSection(); refreshBadge(); }), 1500);
    };
    setTimeout(() => window.addEventListener('pointerdown', ask, true), 2500);
  }

  // ---------- nouveautés (fonctionne SANS autorisation) ----------
  let _newsCount = 0, _newsList = [];

  function seenSince() {
    const floor = Date.now() - 7 * 24 * 3600 * 1000;           // jamais plus de 7 jours en arrière
    let seen = Number(lsGet(LS_SEEN) || 0);
    if (!seen) { seen = Date.now(); lsSet(LS_SEEN, String(seen)); }
    return new Date(Math.max(seen, floor)).toISOString();
  }

  function applyPrefsFilter(q) {
    if (prefs.all) return q;
    const parts = [];
    if (prefs.cats.length) parts.push('seller_category.in.(' + prefs.cats.map((c) => '"' + c + '"').join(',') + ')');
    if (prefs.sellers.length) parts.push('seller_id.in.(' + prefs.sellers.map((s) => '"' + s.id + '"').join(',') + ')');
    return parts.length ? q.or(parts.join(',')) : null;
  }

  async function refreshBadge() {
    try {
      let q = db.from(TABLES.PRODUCTS)
        .select('id, name, price, image, seller_name, created_at', { count: 'exact' })
        .eq('is_active', true).gt('created_at', seenSince());
      q = applyPrefsFilter(q);                       // filtre d'abord, tri/limite ensuite
      if (q) q = q.order('created_at', { ascending: false }).limit(8);
      if (!q) { _newsCount = 0; _newsList = []; }
      else {
        const { data, count, error } = await q;
        if (error) throw error;
        _newsList = data || [];
        _newsCount = count != null ? count : _newsList.length;
      }
    } catch (e) { _newsCount = 0; _newsList = []; console.warn('refreshBadge:', e); }
    setBadges();
    renderNews();
  }

  function markSeen() {
    lsSet(LS_SEEN, String(Date.now()));
    _newsCount = 0; _newsList = [];
    setBadges();
  }

  function setBadges() {
    document.querySelectorAll('.menu-btn-badge').forEach((b) => {
      b.textContent = _newsCount > 99 ? '99+' : String(_newsCount);
      b.style.display = _newsCount > 0 ? 'flex' : 'none';
    });
    const sc = $('sbNotifCount');
    if (sc) sc.textContent = _newsCount > 0 ? '(' + (_newsCount > 99 ? '99+' : _newsCount) + ')' : '';
  }

  // ---------- section « Notifications » dans le panneau ----------
  function statusHtml() {
    if (!supported()) {
      return '<div class="notif-status">ℹ️ Votre navigateur ne gère pas les alertes. Les nouveautés s\'affichent ici à chaque visite.</div>';
    }
    const p = Notification.permission;
    if (p === 'granted') {
      return '<div class="notif-status ok">✅ Alertes actives sur cet appareil<br><span>Vous êtes prévenu à chaque nouvelle publication, même site fermé.</span></div>';
    }
    if (p === 'denied') {
      return '<div class="notif-status warn">🔕 Alertes bloquées dans votre navigateur.<br><span>Vous voyez quand même les nouveautés ici. Pour les réactiver : cadenas près de l\'adresse → Notifications → Autoriser (dans l\'application : Réglages Android → Applis → Marché Moboro → Notifications).</span></div>';
    }
    return '<div class="notif-status">🔔 Alertes non activées.<br><button class="notif-btn" onclick="notifActivate()">Activer les alertes</button></div>';
  }

  function newsHtml() {
    if (!_newsList.length) return '<div class="notif-empty">Aucune nouveauté pour le moment.</div>';
    const items = _newsList.slice(0, 4).map((p) => {
      const price = Number(p.price) > 0 ? String(Math.round(p.price)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' FCFA' : 'Prix négociable';
      return '<div class="notif-news-item" onclick="notifOpenNews()">' +
        '<img src="' + esc(p.image || '') + '" alt="" onerror="this.style.visibility=\'hidden\'">' +
        '<div><b>' + esc(p.name) + '</b><span>' + price + (p.seller_name ? ' · ' + esc(p.seller_name) : '') + '</span></div></div>';
    }).join('');
    const all = '<button type="button" class="notif-all-news" onclick="notifOpenNews()">Voir les ' + _newsCount + ' nouveauté' + (_newsCount > 1 ? 's' : '') + ' →</button>';
    return items + all;
  }

  function renderNews() {
    const el = $('notifNews');
    if (el) el.innerHTML = newsHtml();
  }

  function allSections() {
    const trees = [typeof TREE_B2 !== 'undefined' ? TREE_B2 : [], typeof TREE_A !== 'undefined' ? TREE_A : [], typeof TREE_B1 !== 'undefined' ? TREE_B1 : []];
    const secs = [], seen = new Set();
    trees.forEach((t, ti) => {
      const prefix = ti === 1 ? '🏭 ' : ti === 2 ? '🔧 ' : '';
      t.forEach((c) => {
        if (seen.has(c.id) || /^sans-categorie/.test(c.id)) return;
        seen.add(c.id);
        const name = prefix + String(c.section || '').trim();
        let s = secs.find((x) => x.name === name);
        if (!s) { s = { name, items: [] }; secs.push(s); }
        s.items.push(c);
      });
    });
    return secs;
  }

  function catsHtml() {
    return allSections().map((s) => {
      const n = s.items.filter((c) => prefs.cats.includes(c.id)).length;
      return '<details class="notif-cat-group"><summary>' + esc(s.name) + (n ? ' <i>(' + n + ')</i>' : '') + '</summary>' +
        s.items.map((c) => '<label class="notif-check"><input type="checkbox" ' + (prefs.cats.includes(c.id) ? 'checked ' : '') +
          'onchange="notifToggleCat(\'' + esc(c.id) + '\', this.checked)"> ' + esc(c.label) + '</label>').join('') +
        '</details>';
    }).join('');
  }

  function sellersHtml() {
    const chips = prefs.sellers.map((s) =>
      '<span class="notif-chip">' + esc(s.name) + ' <button onclick="notifRemoveSeller(\'' + esc(s.id) + '\')">✕</button></span>').join('');
    return '<div class="notif-chips">' + (chips || '<span class="notif-empty">Aucun vendeur suivi</span>') + '</div>' +
      '<input id="notifSellerSearch" class="notif-input" placeholder="🔍 Chercher un vendeur…" oninput="notifSearchSellers(this.value)" autocomplete="off">' +
      '<div id="notifSellerResults"></div>';
  }

  function persoHtml() {
    return '<label class="notif-check notif-all"><input type="checkbox" ' + (prefs.all ? 'checked ' : '') +
      'onchange="notifToggleAll(this.checked)"> Recevoir toutes les nouveautés</label>' +
      '<div id="notifPersoBody" style="' + (prefs.all ? 'display:none' : '') + '">' +
      '<div class="notif-sub">📂 Mes catégories</div><div id="notifCats">' + catsHtml() + '</div>' +
      '<div class="notif-sub">🏪 Mes vendeurs</div><div id="notifSellers">' + sellersHtml() + '</div></div>';
  }

  function renderSection() {
    const host = $('notifSectionBody');
    if (!host) return;
    const openPerso = host.querySelector('#notifPerso') && host.querySelector('#notifPerso').open;
    host.innerHTML =
      statusHtml() +
      '<div class="notif-sub">🆕 Nouveautés</div><div id="notifNews">' + newsHtml() + '</div>' +
      '<details id="notifPerso" class="notif-perso"' + (openPerso ? ' open' : '') + '><summary>⚙️ Personnaliser mes alertes</summary>' + persoHtml() + '</details>';
  }

  // ---------- actions appelées depuis le HTML ----------
  window.notifActivate = async function () {
    const r = await ensureSubscription(true);
    if (r === 'granted') { if (typeof showToast === 'function') showToast('🔔 Alertes activées !', 'success'); }
    renderSection();
  };
  window.notifToggleAll = function (v) {
    prefs.all = !!v;
    const b = $('notifPersoBody'); if (b) b.style.display = prefs.all ? 'none' : '';
    savePrefs();
  };
  window.notifToggleCat = function (id, on) {
    prefs.cats = prefs.cats.filter((c) => c !== id);
    if (on) prefs.cats.push(id);
    savePrefs();
  };
  window.notifRemoveSeller = function (id) {
    prefs.sellers = prefs.sellers.filter((s) => s.id !== id);
    savePrefs();
    const el = $('notifSellers'); if (el) el.innerHTML = sellersHtml();
  };
  window.notifAddSeller = function (id, name) {
    if (!prefs.sellers.some((s) => s.id === id)) {
      if (prefs.sellers.length >= MAX_SELLERS) { if (typeof showToast === 'function') showToast('Maximum ' + MAX_SELLERS + ' vendeurs', 'error'); return; }
      prefs.sellers.push({ id: id, name: name });
      savePrefs();
    }
    const el = $('notifSellers'); if (el) el.innerHTML = sellersHtml();
  };
  let _searchTimer = null;
  window.notifSearchSellers = function (q) {
    clearTimeout(_searchTimer);
    const box = $('notifSellerResults');
    q = String(q || '').trim();
    if (q.length < 2) { if (box) box.innerHTML = ''; return; }
    _searchTimer = setTimeout(async () => {
      try {
        const { data } = await db.from(TABLES.SELLERS).select('id, full_name, is_blocked')
          .ilike('full_name', '%' + q.replace(/[%_,()"]/g, ' ') + '%').limit(8);
        const rows = (data || []).filter((s) => !s.is_blocked);
        if (box) box.innerHTML = rows.length
          ? rows.map((s) => '<button class="notif-result" data-id="' + esc(s.id) + '" data-name="' + esc(s.full_name) +
              '" onclick="notifAddSeller(this.dataset.id, this.dataset.name)">＋ ' + esc(s.full_name) + '</button>').join('')
          : '<div class="notif-empty">Aucun vendeur trouvé</div>';
      } catch (e) { if (box) box.innerHTML = ''; }
    }, 300);
  };
  // Page spéciale : tous les nouveaux produits (depuis la dernière visite du menu)
  window.notifOpenNews = async function () {
    const since = seenSince();                       // à lire AVANT la fermeture du menu (qui marque « vu »)
    if (typeof closeHomeSidebar === 'function') closeHomeSidebar();
    showPage('newsPage');
    const list = $('newsProductsList');
    if (!list) return;
    list.innerHTML = '<div class="loading" style="grid-column:1/-1;">Chargement...</div>';
    try {
      let q = db.from(TABLES.PRODUCTS)
        .select('id, name, price, description, image, seller_id, is_active, created_at, qte_min, prix_min, qte_max, prix_max, taille, couleur, matiere, seller_category, sellers!inner(id, full_name, phone, quartier, ville, is_blocked, is_active, account_type, photo, description, stars, badge)')
        .eq('is_active', true).eq('sellers.is_blocked', false).gt('created_at', since);
      q = applyPrefsFilter(q);
      const res = q ? await q.order('created_at', { ascending: false }).limit(60) : { data: [] };
      if (res.error) throw res.error;
      const data = res.data || [];
      const t = $('newsTitle'); if (t) t.textContent = '🆕 Nouveautés' + (data.length ? ' (' + data.length + ')' : '');
      if (!data.length) { list.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:30px;color:#888;">Aucune nouveauté pour le moment.</p>'; return; }
      list.innerHTML = data.map((p) => _productCardHtml(p, true)).join('');
      data.forEach((p) => { if (typeof loadProductReviewsSummary === 'function') loadProductReviewsSummary(p.id); });
    } catch (e) {
      console.warn('notifOpenNews:', e);
      list.innerHTML = '<p style="grid-column:1/-1;text-align:center;padding:30px;color:#888;">Erreur de chargement.</p>';
    }
  };
  window.notifOpenProduct = function (id) {
    if (typeof closeHomeSidebar === 'function') closeHomeSidebar();
    openLightbox('', id, '', '');
  };

  // ---------- liens profonds ----------
  function handleLink(href) {
    let u;
    try { u = new URL(href, location.href); } catch (e) { return false; }
    const prod = u.searchParams.get('produit');
    const insc = u.searchParams.get('inscription');
    if (prod) {
      if (typeof closeHomeSidebar === 'function') closeHomeSidebar();
      openLightbox('', prod, '', '');
      return true;
    }
    if (insc === 'vendeur' && typeof openIndependantVenteService === 'function') { openIndependantVenteService(); return true; }
    if (insc === 'taxi' && typeof openDeliveryAgentRegister === 'function') { openDeliveryAgentRegister(); return true; }
    return false;
  }
  window.notifHandleLink = handleLink;

  function handleStartupLink() {
    const p = new URLSearchParams(location.search);
    if (!p.get('produit') && !p.get('inscription')) return;
    handleLink(location.href);
    // on nettoie l'adresse pour qu'un rechargement ne rouvre pas la même chose
    try { history.replaceState(history.state, '', location.pathname + location.hash); } catch (e) {}
  }

  // ---------- ouverture / fermeture du panneau ----------
  window.notifOnPanelOpen = function () {
    renderSection();
    refreshBadge();
  };
  window.notifOnPanelClose = function () {
    markSeen();
  };

  // ---------- démarrage ----------
  function start() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'notif-open' && e.data.url) handleLink(e.data.url);
      });
    }
    renderSection();
    refreshBadge();
    autoStart();
    watchMembership();
    setTimeout(handleStartupLink, 900);   // laisse l'accueil se charger d'abord
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
