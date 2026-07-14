// ================================================================
// SERVICE WORKER — Marché Moboro
// Cache optimisé — fichiers statiques + données réseau
// ================================================================

const CACHE_STATIC  = 'moboro-static-v12';
const CACHE_DYNAMIC = 'moboro-dynamic-v12';
const CACHE_API     = 'moboro-api-v12';

// Fichiers statiques — cachés à l'installation
const ASSETS_TO_CACHE = [
  '/Congomarket/',
  '/Congomarket/index.html',
  '/Congomarket/style.css',
  '/Congomarket/supabase.js',
  '/Congomarket/app.js',
  '/Congomarket/auth_upload.js',
  '/Congomarket/sellers.js',
  '/Congomarket/search.js',
  '/Congomarket/cart.js',
  '/Congomarket/products_upload.js',
  '/Congomarket/upload_photo_imagekit.js',
  '/Congomarket/admin.js',
  '/Congomarket/icon-192.png',
  '/Congomarket/icon-512.png',
  '/Congomarket/manifest.json'
];

// Durée du cache API Supabase — 15 minutes
const API_CACHE_TTL = 15 * 60 * 1000;

// ── Installation ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

// ── Activation — nettoyage anciens caches ─────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => ![CACHE_STATIC, CACHE_DYNAMIC, CACHE_API].includes(k))
            .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // ── 1. Toujours ignorer admin.html
  if (url.includes('admin.html')) return;

  // ── 2. Requêtes Supabase — Network first + cache 15min ──
  if (url.includes('supabase.co')) {
    // Ne cacher que les GET (pas les POST/PATCH/DELETE)
    if (event.request.method !== 'GET') return;

    event.respondWith(
      fetch(event.request.clone())
        .then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_API).then(cache => {
            cache.put(event.request, clone);
          });
          return response;
        })
        .catch(() => {
          // Réseau indisponible → fallback cache
          return caches.match(event.request);
        })
    );
    return;
  }

  // ── 3. Images ImageKit — Cache first longue durée ──
  if (url.includes('imagekit.io') || url.includes('ik.imagekit.io')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (!response || response.status !== 200) return response;
          const clone = response.clone();
          caches.open(CACHE_DYNAMIC).then(cache => {
            cache.put(event.request, clone);
          });
          return response;
        });
      })
    );
    return;
  }

  // ── 4. Ressources externes — réseau direct ──
  if (url.includes('unsplash.com')   ||
      url.includes('googleapis.com') ||
      url.includes('jsdelivr.net')   ||
      url.includes('esm.sh')         ||
      url.includes('jsr.io')) {
    return;
  }

  // ── 5. Fichiers statiques — Cache first ──
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_STATIC).then(cache => {
          cache.put(event.request, clone);
        });
        return response;
      });
    }).catch(() => caches.match('/Congomarket/index.html'))
  );
});

// ── Nettoyage cache API expiré ────────────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'CLEAR_API_CACHE') {
    caches.delete(CACHE_API).then(() => {
      console.log('[SW] Cache API vidé');
    });
  }
});

// ── Notifications Push (Option B) ──────────────────────────────
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const title = data.title || '🛒 Nouvelle commande !';
  const options = {
    body: data.body || 'Vous avez reçu une nouvelle commande sur Marché Moboro.',
    icon: '/Congomarket/icon-192.png',
    badge: '/Congomarket/icon-192.png',
    data: { url: data.url || '/Congomarket/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/Congomarket/';
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('/Congomarket/') && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});