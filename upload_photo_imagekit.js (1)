// ================================================================
// upload_photo.js — Marché Moboro
// Service : ImageKit.io
// Compression JS intégrée (Canvas) → max 100ko
// ================================================================

const IMAGEKIT_URL        = 'https://ik.imagekit.io/smkdohkm8';
const IMAGEKIT_PUBLIC_KEY = 'public_pJNeKaHWN8mcFS49bpw1Rn3mysI=';
const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

// ================================================================
// Compression image (Canvas) — max 100ko
// ================================================================
async function compressImage(file, maxKB = 100) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;

        // Redimensionner si largeur > 800px
        if (w > 800) { h = Math.round(h * 800 / w); w = 800; }

        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);

        // Compression itérative jusqu'à maxKB
        let quality = 0.8;
        let result;
        do {
          result  = canvas.toDataURL('image/jpeg', quality);
          quality -= 0.05;
        } while (result.length > maxKB * 1024 * 1.37 && quality > 0.1);

        // Convertir dataURL en File
        const arr   = result.split(',');
        const bstr  = atob(arr[1]);
        const u8arr = new Uint8Array(bstr.length);
        for (let i = 0; i < bstr.length; i++) {
          u8arr[i] = bstr.charCodeAt(i);
        }

        const compressed = new File([u8arr], file.name, { type: 'image/jpeg' });
        console.log(`Compression: ${(file.size/1024).toFixed(0)}ko → ${(compressed.size/1024).toFixed(0)}ko`);
        resolve(compressed);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ================================================================
// Upload vers ImageKit.io
// ================================================================
async function uploadPhoto(file, folder = 'sellers') {
  if (!file) return null;

  // Vérifications type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    showToast('Format non supporté. JPG, PNG ou WEBP uniquement.', 'error');
    return null;
  }

  // Vérification taille avant compression
  if (file.size > 10 * 1024 * 1024) {
    showToast('Image trop lourde (max 10 MB)', 'error');
    return null;
  }

  try {
    
    // Compression selon le type de dossier
    const maxKB      = folder === 'sellers' ? 80 : 100;
    const compressed = await compressImage(file, maxKB);


    // Préparer FormData pour ImageKit
  const fileName = folder + '_' + Date.now() + '_' +
                 Math.random().toString(36).slice(2) + '.jpg';

const formData = new FormData();
formData.append('file',      compressed);
formData.append('fileName',  fileName);
formData.append('folder',    '/moboro/' + folder);

const authRes = await fetch('https://frvzrorqndozglxczatv.supabase.co/functions/v1/imagekit-auth', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + SUPABASE_KEY
  }
});
const auth = await authRes.json();

console.log('ImageKit auth OK — expire:', auth.expire);

const res = await fetch(IMAGEKIT_UPLOAD_URL, {
  method: 'POST',
  body: (() => {
    formData.append('publicKey',  IMAGEKIT_PUBLIC_KEY);
    formData.append('signature',  auth.signature);
formData.append('expire',     String(auth.expire));
    formData.append('token',      auth.token);
    return formData;
  })()
});
    const data = await res.json();

if (!data.url) {
  console.error('ImageKit upload error:', data);
const msg =
  data.message ||
  (data.error && data.error.message) ||
  res.status;

showToast('Erreur upload image: ' + msg, 'error');
  return null;
}

    // URL optimisée avec transformations ImageKit
    const optimizedUrl = getOptimizedUrl(data.url, folder);
    return optimizedUrl;

  } catch (e) {
    console.error('uploadPhoto exception:', e);
    showToast('Erreur réseau lors de l\'upload', 'error');
    return null;
  }
}

// ================================================================
// URL optimisée selon le type
// ================================================================
function getOptimizedUrl(url, folder) {
  if (!url) return url;

  const transforms = {
    sellers:  'tr:w-400,h-400,c-maintain_ratio,q-80,f-auto',
    products: 'tr:w-800,h-800,c-maintain_ratio,q-80,f-auto',
    promos:   'tr:w-800,h-600,c-maintain_ratio,q-80,f-auto'
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