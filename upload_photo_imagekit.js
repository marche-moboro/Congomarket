// ================================================================
// upload_photo.js — Marché Moboro
// Service : ImageKit.io
// Compression JS intégrée (Canvas) → max 100ko
// ================================================================

const IMAGEKIT_URL        = 'https://ik.imagekit.io/smkdohkm8';
const IMAGEKIT_PUBLIC_KEY = 'public_pJNeKaHWN8mcFS49bpw1Rn3mysI=';
const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

// ================================================================
// Outils : délai maximum sur une opération (évite le blocage infini)
// ================================================================
function _withTimeout(promise, ms, msg) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg || 'Délai dépassé')), ms);
    promise.then(v => { clearTimeout(t); resolve(v); },
                 e => { clearTimeout(t); reject(e); });
  });
}
async function _fetchTimeout(url, options, ms) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, Object.assign({}, options, { signal: ctrl.signal })); }
  finally { clearTimeout(t); }
}

// ================================================================
// Décodage d'une photo (avec échec clair au lieu d'un blocage)
// ================================================================
function _decodeImage(file) {
  return _withTimeout(new Promise(async (resolve, reject) => {
    try {
      if (window.createImageBitmap) {
        try { return resolve(await createImageBitmap(file)); } catch (e) { /* on essaie l'autre méthode */ }
      }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Photo illisible')); };
      img.src = url;
    } catch (e) { reject(e); }
  }), 20000, 'Photo trop lente à lire');
}

function _canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Compression impossible')), 'image/jpeg', quality);
  });
}

// ================================================================
// Compression image (Canvas) — max 100ko, proportions conservées
// ================================================================
async function compressImage(file, maxKB = 100) {
  const src = await _decodeImage(file);
  let w = src.width, h = src.height;
  if (!w || !h) throw new Error('Photo illisible');

  // Redimensionner si largeur > 800px
  if (w > 800) { h = Math.round(h * 800 / w); w = 800; }

  const maxBytes = maxKB * 1024;
  let blob = null;
  for (let essai = 0; essai < 4; essai++) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';               // fond blanc pour les PNG transparents
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);

    let quality = 0.8;
    do {
      blob = await _canvasToBlob(canvas, quality);
      quality -= 0.1;
    } while (blob.size > maxBytes && quality > 0.3);

    if (blob.size <= maxBytes) break;
    // Encore trop lourd : on réduit les dimensions de 20 % et on recommence
    w = Math.round(w * 0.8); h = Math.round(h * 0.8);
  }
  if (src.close) src.close();

  const compressed = new File([blob], file.name || 'photo.jpg', { type: 'image/jpeg' });
  console.log(`Compression: ${(file.size/1024).toFixed(0)}ko → ${(compressed.size/1024).toFixed(0)}ko`);
  return compressed;
}

// ================================================================
// Upload vers ImageKit.io
// ================================================================
async function uploadPhoto(file, folder = 'sellers') {
  if (!file) return null;

  // Taille avant compression (les photos de téléphone récents dépassent souvent 10 Mo)
  if (file.size > 30 * 1024 * 1024) {
    showToast('Photo trop lourde (max 30 Mo)', 'error');
    return null;
  }

  // NB : certains téléphones donnent un type vide ou « image/heic ».
  // On ne refuse donc plus sur le type : si la photo ne peut pas être lue, on le dit clairement.
  let compressed;
  try {
    const maxKB = folder === 'sellers' ? 80 : 100;
    compressed = await compressImage(file, maxKB);
  } catch (e) {
    console.error('compressImage:', e);
    showToast('Photo illisible. Choisissez une photo JPG ou PNG, ou reprenez-la avec l\'appareil photo.', 'error');
    return null;
  }

  const fileName = folder + '_' + Date.now() + '_' +
                   Math.random().toString(36).slice(2) + '.jpg';

  // 2 essais en cas de coupure réseau
  let derniereErreur = '';
  for (let essai = 1; essai <= 2; essai++) {
    try {
      const authRes = await _fetchTimeout('https://frvzrorqndozglxczatv.supabase.co/functions/v1/imagekit-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUPABASE_KEY
        }
      }, 15000);
      const auth = await authRes.json();
      if (!authRes.ok || !auth.signature) {
        console.error('imagekit-auth:', authRes.status, auth);
        derniereErreur = 'autorisation refusée (' + authRes.status + ')';
        continue;
      }

      const formData = new FormData();
      formData.append('file',      compressed);
      formData.append('fileName',  fileName);
      formData.append('folder',    '/moboro/' + folder);
      formData.append('publicKey', IMAGEKIT_PUBLIC_KEY);
      formData.append('signature', auth.signature);
      formData.append('expire',    String(auth.expire));
      formData.append('token',     auth.token);

      const res  = await _fetchTimeout(IMAGEKIT_UPLOAD_URL, { method: 'POST', body: formData }, 45000);
      const data = await res.json();

      if (!data.url) {
        console.error('ImageKit upload error:', data);
        derniereErreur = data.message || (data.error && data.error.message) || res.status;
        continue;
      }
      return getOptimizedUrl(data.url, folder);

    } catch (e) {
      console.error('uploadPhoto exception (essai ' + essai + '):', e);
      derniereErreur = e.name === 'AbortError' ? 'connexion trop lente' : 'réseau';
    }
  }
  showToast('Envoi de la photo impossible (' + derniereErreur + '). Vérifiez votre connexion et réessayez.', 'error');
  return null;
}

// ================================================================
// URL optimisée selon le type
// ================================================================
function getOptimizedUrl(url, folder) {
  if (!url) return url;

  const transforms = {
    sellers:  'tr:w-400,h-400,c-maintain_ratio,q-80,f-auto',
    products: 'tr:w-800,h-800,c-at_max,q-80,f-auto',
    promos:   'tr:w-800,h-600,c-at_max,q-80,f-auto'
  };

  const transform = transforms[folder] || transforms.products;

  // Insérer la transformation dans l'URL ImageKit
  return url.replace(
    'https://ik.imagekit.io/smkdohkm8/',
    `https://ik.imagekit.io/smkdohkm8/${transform}/`
  );
}

// ================================================================
// Prévisualiser une image avant upload
// ✅ CORRECTION : onchange au lieu de addEventListener
//    — évite la duplication d'événements si la fonction
//      est appelée plusieurs fois sur le même élément
// ================================================================
function previewImage(inputId, previewId) {
  const input   = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  if (!input || !preview) return;

  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.src           = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);
  };
}

// ================================================================
// Supprimer une photo ImageKit
// (nécessite backend — ignoré en frontend pur)
// ================================================================
async function deleteOldPhoto(photoUrl) {
  console.warn('deleteOldPhoto: suppression impossible en frontend. URL:', photoUrl);
  return false;
}

// ================================================================
// Nettoyage images orphelines ImageKit
// À appeler depuis admin.html
// ================================================================
async function cleanOrphanImages() {
  try {
    // Récupérer toutes les URLs d'images utilisées
    const { data: products } = await db.from(TABLES.PRODUCTS)
      .select('image')
      .eq('is_active', true);

    const { data: promos } = await db.from(TABLES.PROMOS)
      .select('image')
      .eq('is_active', true);

    const { data: sellers } = await db.from(TABLES.SELLERS)
      .select('photo')
      .eq('is_active', true);

    // Construire liste des URLs actives
    const activeUrls = new Set();

if (Array.isArray(products)) {
  products.forEach(function (p) {
    if (p && p.image) activeUrls.add(p.image);
  });
}

if (Array.isArray(promos)) {
  promos.forEach(function (p) {
    if (p && p.image) activeUrls.add(p.image);
  });
}

if (Array.isArray(sellers)) {
  sellers.forEach(function (s) {
    if (s && s.photo) activeUrls.add(s.photo);
  });
}

    console.log('Images actives:', activeUrls.size);
    // Note: suppression ImageKit nécessite clé privée côté serveur
    // Les URLs orphelines dans Supabase sont nettoyées par le cron SQL

    return activeUrls.size;

  } catch (e) {
    console.error('cleanOrphanImages error:', e);
    return 0;
  }
}
window.uploadPhoto = uploadPhoto

// ================================================================
// Anciennes photos : leur URL contient « c-maintain_ratio » qui RECADRE
// la photo en carré côté ImageKit (partie coupée définitivement perdue).
// On remplace par « c-at_max » (photo entière, ratio respecté) dès qu'une
// image est ajoutée à la page. (Le SQL de correction en base fait la même
// chose une fois pour toutes ; ceci est le filet de sécurité.)
// ================================================================
(function () {
  var BAD = /(tr:w-800,h-(?:800|600),)c-maintain_ratio/;
  function fix(img) {
    var s = img.getAttribute && img.getAttribute('src');
    if (s && BAD.test(s)) img.setAttribute('src', s.replace(BAD, '$1c-at_max'));
  }
  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.tagName === 'IMG') fix(node);
    else if (node.querySelectorAll) node.querySelectorAll('img').forEach(fix);
  }
  try {
    new MutationObserver(function (muts) {
      muts.forEach(function (m) {
        if (m.type === 'attributes') fix(m.target);
        else m.addedNodes.forEach(scan);
      });
    }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
  } catch (e) {}
})();
