// ==================== ASSISTANT.JS ====================
// Assistant Moboro
//  • Vendeur : dès que la photo est choisie (et compressée), l'IA remplit nom, catégorie,
//    description, taille. Jamais le prix ni la matière. Si l'IA est coupée, l'assistant
//    propose les choix les plus fréquents (mémoire).
//  • Visiteur : propositions de produits et de catégories avec photos sous les résultats
//    de recherche, et apprentissage à partir des recherches / clics.
// Tout passe par l'Edge Function "ai-assistant" (jamais d'écriture directe en base).
(function () {
  'use strict';

  const AI_TIMEOUT_MS = 14000;
  const PENDING_KEY = 'moboro_ai_pending';

  // ---------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------
  function esc(s) { return (typeof escapeHtml === 'function') ? escapeHtml(s) : String(s == null ? '' : s); }

  function deviceId() {
    try {
      let d = localStorage.getItem('moboro_device');
      if (!d || !/^[a-z0-9-]{8,64}$/.test(d)) {
        d = (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12)).toLowerCase();
        localStorage.setItem('moboro_device', d);
      }
      return d;
    } catch (e) {
      return window._moboroTmpDev || (window._moboroTmpDev = 't' + Math.random().toString(36).slice(2, 12) + '-0000');
    }
  }

  async function callAssistant(action, payload, opts) {
    opts = opts || {};
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeout || AI_TIMEOUT_MS);
    try {
      const body = { action, payload: payload || {} };
      if (opts.auth) body.session_token = localStorage.getItem('seller_session_token') || '';
      const r = await fetch(SUPABASE_URL + '/functions/v1/ai-assistant', {
        method: 'POST', signal: ctrl.signal, keepalive: !!opts.keepalive,
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + SUPABASE_KEY },
        body: JSON.stringify(body),
      });
      return await r.json();
    } catch (e) {
      return { ok: false, error: 'timeout' };
    } finally {
      clearTimeout(timer);
    }
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  // ---------------------------------------------------------------
  // CÔTÉ VENDEUR
  // ---------------------------------------------------------------
  const S = { initial: null, aiCat: '', chipUsed: false, photoToken: 0, chipData: null, nameTimer: null, lastNameQ: '' };

  function pubTree() {
    const s = window._pubSection || 'B2';
    return s === 'A' ? TREE_A : (s === 'B1' ? TREE_B1 : TREE_B2);
  }
  function isGeneric(id) { return /^(sans-categorie|autre)/.test(id); }
  function treeEntry(id) { return pubTree().find(c => c.id === id) || null; }
  function candidateCategories() {
    return pubTree().filter(c => !isGeneric(c.id)).map(c => ({
      id: c.id, label: c.label,
      group: String(c.section || '').replace(/^[^A-Za-zÀ-ÿ]+/, '').trim(),
    }));
  }

  function setStatus(html, kind) {
    const el = document.getElementById('aiStatus');
    if (!el) return;
    if (!html) { el.style.display = 'none'; el.innerHTML = ''; return; }
    const colors = { info: ['#f0f7ff', '#1677FF'], ok: ['#f6ffed', '#389e0d'], warn: ['#fffbe6', '#ad6800'] }[kind || 'info'];
    el.style.cssText = 'display:block;margin:8px 0;padding:8px 10px;border-radius:10px;font-size:12px;font-weight:600;background:' + colors[0] + ';color:' + colors[1] + ';';
    el.innerHTML = html;
  }

  function canFill(el) { return !!el && (el.value === '' || el.dataset.ai === '1'); }
  function clearMark(e) { const el = e.target; delete el.dataset.ai; el.style.boxShadow = ''; }
  function setField(id, val) {
    const el = document.getElementById(id);
    if (!val || !canFill(el)) return false;
    el.value = val;
    el.dataset.ai = '1';
    el.style.boxShadow = '0 0 0 2px #cfe3ff';
    el.addEventListener('input', clearMark, { once: true });
    return true;
  }
  function setCategory(id, fromAi) {
    const c = treeEntry(id);
    const hidden = document.getElementById('pubOwnCategory');
    const label = document.getElementById('pubOwnCategoryLabel');
    if (!c || !hidden || !label) return false;
    if (hidden.value && hidden.value !== S.aiCat) return false;   // le vendeur a déjà choisi : on n'écrase pas
    hidden.value = id;
    label.textContent = (fromAi ? '✨ ' : '') + c.label;
    label.style.color = '#1a1a1a';
    if (fromAi) S.aiCat = id;
    return true;
  }

  function fillForm(s) {
    const filled = [];
    if (setField('pubName', s.name)) filled.push('nom');
    if (s.category_id && setCategory(s.category_id, true)) filled.push('catégorie');
    if (setField('pubDescription', s.description)) filled.push('description');
    if (setField('pubTaille', s.taille)) filled.push('taille');
    if (typeof updatePubPreview === 'function') updatePubPreview();
    return filled;
  }

  async function assistantOnPhotoSelected(file) {
    if (!file || !localStorage.getItem('seller_session_token')) return;
    const token = ++S.photoToken;
    S.initial = null; S.chipUsed = false;
    renderChips(null);
    setStatus('✨ Analyse de la photo en cours…', 'info');
    let res = null;
    try {
      let small = file;
      try { small = await compressImage(file, 100); } catch (e) { /* on garde l'original */ }
      const b64 = await fileToBase64(small);
      res = await callAssistant('analyze', { image_base64: b64, mime: 'image/jpeg', categories: candidateCategories() }, { auth: true, timeout: AI_TIMEOUT_MS });
    } catch (e) { res = null; }
    if (token !== S.photoToken) return;            // une autre photo a été choisie entre-temps
    const sg = res && res.ok && res.suggestion;
    if (sg && (sg.name || sg.category_id)) {
      S.initial = sg;
      const filled = fillForm(sg);
      setStatus(filled.length
        ? '✨ Rempli par l\'IA : ' + filled.join(', ') + '. Vérifiez, saisissez le prix, puis publiez.'
        : '✨ Analyse terminée. Vos champs sont déjà remplis, rien n\'a été modifié.', 'ok');
    } else {
      setStatus(res && res.error === 'limite'
        ? 'La limite de l\'IA est atteinte pour aujourd\'hui. Choisissez rapidement ci-dessous.'
        : 'L\'IA n\'a pas répondu. Choisissez rapidement ci-dessous.', 'warn');
      showFallbackChips();
    }
  }

  function assistantOnPhotoRemoved() {
    S.photoToken++; S.initial = null;
    setStatus('');
    renderChips(null);
  }

  // ---------- Propositions (mémoire) : boutons de secours + frappe du nom ----------
  function cacheKey() { return 'moboro_ai_cache_' + (window._pubSection || 'B2'); }

  async function fetchSuggest(name) {
    const res = await callAssistant('suggest', { name: name || '' }, { auth: true, timeout: 7000 });
    if (res && res.ok) {
      if (!name) { try { localStorage.setItem(cacheKey(), JSON.stringify(res)); } catch (e) {} }
      return res;
    }
    if (!name) { try { const c = JSON.parse(localStorage.getItem(cacheKey()) || 'null'); if (c) return c; } catch (e) {} }
    return null;
  }

  async function showFallbackChips() {
    const data = await fetchSuggest('');
    renderChips(data, 'Choisissez rapidement :');
  }

  function assistantOnNameTyping() {
    clearTimeout(S.nameTimer);
    const q = (document.getElementById('pubName') || {}).value || '';
    if (q.trim().length < 2) { if (!S.initial) renderChips(null); return; }
    if (!localStorage.getItem('seller_session_token')) return;
    S.nameTimer = setTimeout(async () => {
      if (q === S.lastNameQ) return;
      S.lastNameQ = q;
      const data = await fetchSuggest(q.trim());
      if (((document.getElementById('pubName') || {}).value || '') !== q) return;   // le vendeur a continué à taper
      renderChips(data, 'Propositions :');
    }, 550);
  }

  function renderChips(data, title) {
    const box = document.getElementById('aiChips');
    if (!box) return;
    S.chipData = null;
    if (!data) { box.style.display = 'none'; box.innerHTML = ''; return; }
    const ids = new Set(pubTree().map(c => c.id));
    const cats = (data.categories || []).filter(c => ids.has(c.id) && !isGeneric(c.id)).slice(0, 3);
    const names = (data.names || []).filter(n => ids.has(n.category_id) && !isGeneric(n.category_id)).slice(0, 2);
    const hasTaille = !((document.getElementById('pubTaille') || {}).value || '');
    const tailles = hasTaille ? (data.tailles || []).slice(0, 4) : [];
    if (!cats.length && !names.length && !tailles.length) { box.style.display = 'none'; box.innerHTML = ''; return; }
    S.chipData = { cats, names, tailles };
    const chip = 'display:inline-block;margin:3px 4px 3px 0;padding:7px 12px;border-radius:99px;border:1.5px solid #cfe3ff;background:#fff;color:#1677FF;font-size:12px;font-weight:600;cursor:pointer;';
    let html = '<div style="font-size:12px;color:#888;margin-bottom:2px;">' + esc(title || 'Propositions :') + '</div>';
    names.forEach((n, i) => {
      const c = treeEntry(n.category_id);
      html += '<button type="button" style="' + chip + '" onclick="assistantPickName(' + i + ')">' + esc(n.name) + (c ? ' · ' + esc(c.label) : '') + '</button>';
    });
    cats.forEach((c, i) => {
      const e = treeEntry(c.id);
      html += '<button type="button" style="' + chip + '" onclick="assistantPickCategory(' + i + ')">📂 ' + esc(e ? e.label : c.id) + '</button>';
    });
    tailles.forEach((t, i) => {
      html += '<button type="button" style="' + chip + '" onclick="assistantPickTaille(' + i + ')">' + esc(t) + '</button>';
    });
    box.style.display = 'block';
    box.innerHTML = html;
  }

  function assistantPickCategory(i) {
    const c = S.chipData && S.chipData.cats[i];
    if (!c) return;
    const hidden = document.getElementById('pubOwnCategory');
    if (hidden) hidden.value = '';             // un clic volontaire remplace toujours
    setCategory(c.id, false);
    S.chipUsed = true;
  }
  function assistantPickName(i) {
    const n = S.chipData && S.chipData.names[i];
    if (!n) return;
    const nameEl = document.getElementById('pubName');
    if (nameEl) { nameEl.value = n.name; delete nameEl.dataset.ai; nameEl.style.boxShadow = ''; }
    const hidden = document.getElementById('pubOwnCategory');
    if (hidden) hidden.value = '';
    setCategory(n.category_id, false);
    if (n.taille) setField('pubTaille', n.taille);
    if (n.description) setField('pubDescription', n.description);
    S.chipUsed = true;
    if (typeof updatePubPreview === 'function') updatePubPreview();
  }
  function assistantPickTaille(i) {
    const t = S.chipData && S.chipData.tailles[i];
    if (!t) return;
    const el = document.getElementById('pubTaille');
    if (el && !el.value) { el.value = t; S.chipUsed = true; }
  }

  // ---------- Apprentissage après publication ----------
  function pendingList() { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || '[]'); } catch (e) { return []; } }
  function savePending(list) { try { localStorage.setItem(PENDING_KEY, JSON.stringify(list.slice(-20))); } catch (e) {} }

  async function flushPendingLearning() {
    if (!localStorage.getItem('seller_session_token')) return;
    const list = pendingList();
    if (!list.length) return;
    const keep = [];
    for (const p of list) {
      const res = await callAssistant('learn', p, { auth: true, timeout: 12000 });
      if (!(res && res.ok) && res && res.error !== 'non autorisé') keep.push(p);
    }
    savePending(keep);
  }

  async function assistantLearnFromPublication(fin) {
    try {
      const ini = S.initial;
      const source = ini ? 'ai' : (S.chipUsed ? 'chip' : 'manual');
      let pid = '';
      try {
        if (fin.imageUrl && window.currentSeller) {
          const { data } = await db.from(TABLES.PRODUCTS).select('id').eq('seller_id', currentSeller.id)
            .eq('image', fin.imageUrl).order('created_at', { ascending: false }).limit(1);
          if (data && data[0]) pid = String(data[0].id);
        }
      } catch (e) { /* sans importance */ }
      const payload = {
        initial: ini ? { name: ini.name, category_id: ini.category_id } : null,
        final: { name: fin.name, category_id: fin.category_id || '', taille: fin.taille || '', description: fin.description || '', keywords: (ini && ini.keywords) || [] },
        source, product_id: pid,
      };
      const res = await callAssistant('learn', payload, { auth: true, timeout: 12000 });
      if (!(res && res.ok)) savePending(pendingList().concat([payload]));
    } catch (e) {
      /* l'apprentissage ne doit jamais gêner la publication */
    } finally {
      assistantReset();
    }
  }

  function assistantReset() {
    S.photoToken++; S.initial = null; S.aiCat = ''; S.chipUsed = false; S.lastNameQ = '';
    setStatus('');
    renderChips(null);
    ['pubName', 'pubDescription', 'pubTaille'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { delete el.dataset.ai; el.style.boxShadow = ''; }
    });
  }

  // ---------------------------------------------------------------
  // CÔTÉ VISITEUR
  // ---------------------------------------------------------------
  let _queue = [], _flushTimer = null, _curQ = '', _searchTimer = null;

  async function flushLog() {
    if (!_queue.length) return;
    const events = _queue.splice(0, 20);
    await callAssistant('log', { device_id: deviceId(), events }, { timeout: 8000, keepalive: true });
  }
  function assistantLog(ev) {
    _queue.push(ev);
    if (_queue.length >= 10) { flushLog(); return; }
    clearTimeout(_flushTimer);
    _flushTimer = setTimeout(flushLog, 4000);
  }

  function searchBox() {
    let box = document.getElementById('aiSearchBox');
    const host = document.getElementById('searchResults');
    if (!box && host && host.parentNode) {
      box = document.createElement('div');
      box.id = 'aiSearchBox';
      host.parentNode.appendChild(box);
    }
    return box;
  }
  function assistantClearSearchBox() {
    const box = document.getElementById('aiSearchBox');
    if (box) box.innerHTML = '';
  }

  function treeTypeFor(catId) {
    if (typeof TREE_B2_IDS !== 'undefined' && TREE_B2_IDS.has(catId)) return 'B';
    return 'A';
  }

  // Appelé par performSearch (search.js) : on attend que la saisie se stabilise
  function assistantTrackSearch(q) {
    q = String(q || '').trim();
    _curQ = q;
    clearTimeout(_searchTimer);
    assistantClearSearchBox();
    if (q.length < 2) return;
    _searchTimer = setTimeout(async () => {
      if (_curQ !== q) return;
      assistantLog({ k: 'search', q });
      const res = await callAssistant('search', { q, device_id: deviceId() }, { timeout: 8000 });
      if (_curQ !== q) return;
      if (!res || !res.ok) { noResultMessage(); return; }
      renderSearchSuggestions(q, res);
    }, 1100);
  }

  // Si les résultats directs sont vides ET que l'assistant n'a rien trouvé : message honnête
  function noResultMessage() {
    const host = document.getElementById('searchResults');
    if (host && /cherche des produits proches/.test(host.textContent || '')) {
      host.innerHTML = '<p style="text-align:center;padding:30px;color:#888;">Aucun résultat trouvé.<br>Essayez un autre mot-clé.</p>';
    }
  }

  function renderSearchSuggestions(q, res) {
    const box = searchBox();
    if (!box) return;
    const shown = new Set(((window._searchResults || (typeof _searchResults !== 'undefined' ? _searchResults : null)) || { products: [] }).products.map(p => String(p.id)));
    const products = (res.products || []).filter(p => !shown.has(String(p.id))).slice(0, 12);
    const cats = (res.categories || []).slice(0, 3);
    if (!products.length && !cats.length) { box.innerHTML = ''; noResultMessage(); return; }

    let html = '<h3 style="padding:14px 0 8px;font-size:16px;color:#1677FF;">💡 L\'assistant vous propose</h3>';
    if (cats.length) {
      html += '<div style="display:flex;gap:10px;overflow-x:auto;padding:4px 0 12px;">' + cats.map(c => {
        const label = (typeof ALL_CATEGORIES !== 'undefined' && ALL_CATEGORIES[c.id]) || c.id;
        return '<button type="button" data-ai-cat="' + esc(c.id) + '" onclick="assistantOpenCategory(\'' + esc(c.id) + '\')" ' +
          'style="flex:0 0 auto;width:96px;border:none;background:none;cursor:pointer;text-align:center;padding:0;">' +
          '<img src="' + esc(c.photo) + '" onerror="this.style.visibility=\'hidden\'" style="width:76px;height:76px;border-radius:50%;object-fit:cover;border:2px solid #cfe3ff;">' +
          '<div style="font-size:11px;font-weight:600;color:#333;margin-top:4px;line-height:1.2;">' + esc(label) + '</div></button>';
      }).join('') + '</div>';
    }
    box.innerHTML = html;
    if (products.length) {
      const wrap = document.createElement('div');
      box.appendChild(wrap);
      const card = (typeof window._searchProductCardHtml === 'function') ? window._searchProductCardHtml : null;
      if (card) {
        wrap.innerHTML = products.map(card).join('');
        products.forEach(p => { if (typeof loadProductReviewsSummary === 'function') loadProductReviewsSummary(p.id, 'reviews-search-' + p.id); });
      }
    }
  }

  function assistantOpenCategory(catId) {
    assistantLog({ k: 'chip', q: _curQ, cat: catId });
    if (typeof openCategory === 'function') openCategory(catId, treeTypeFor(catId));
  }

  // Clics dans les résultats (produit ouvert, WhatsApp) -> l'assistant apprend
  document.addEventListener('click', function (e) {
    const t = e.target;
    if (!t || !t.closest || !_curQ) return;
    const card = t.closest('#searchResults [data-ai-pid], #aiSearchBox [data-ai-pid]');
    if (!card) return;
    const pid = card.getAttribute('data-ai-pid');
    const cat = card.getAttribute('data-ai-cat') || '';
    if (t.closest('a.contact-btn-product')) assistantLog({ k: 'whatsapp', q: _curQ, pid, cat });
    else if (t.closest('img')) assistantLog({ k: 'click', q: _curQ, pid, cat });
  }, true);

  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') flushLog(); });
  window.addEventListener('pagehide', flushLog);
  window.addEventListener('online', flushPendingLearning);
  setTimeout(flushPendingLearning, 4000);

  // ---------------------------------------------------------------
  // Exposition globale
  // ---------------------------------------------------------------
  Object.assign(window, {
    assistantOnPhotoSelected, assistantOnPhotoRemoved, assistantOnNameTyping,
    assistantPickCategory, assistantPickName, assistantPickTaille,
    assistantLearnFromPublication, assistantReset,
    assistantTrackSearch, assistantOpenCategory, assistantClearSearchBox,
  });
})();
