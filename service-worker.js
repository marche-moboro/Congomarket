// ================================================================
// SERVICE WORKER — Marché Moboro
// Cache optimisé — fichiers statiques + données réseau
// ================================================================

const CACHE_STATIC = 'moboro-static-v38';
const CACHE_DYNAMIC = 'moboro-dynamic-v38';
const CACHE_API     = 'moboro-api-v38';

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
  '/Congomarket/assistant.js',
  '/Congomarket/notifications.js',
  '/Congomarket/products_upload.js',
  '/Congomarket/upload_photo_imagekit.js',
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
      .then(cache => {
        // ✅ Chaque fichier est mis en cache individuellement — si l'un
        // d'eux échoue (réseau instable, fichier temporairement absent),
        // ça ne fait plus échouer TOUTE l'installation du service worker
        // (contrairement à cache.addAll, qui est tout-ou-rien).
        return Promise.all(
          ASSETS_TO_CACHE.map(url =>
            cache.add(url).catch(e => console.warn('[SW] Échec cache pour', url, e))
          )
        );
      })
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

  // ── 4b. Ouverture depuis une notification (…/Congomarket/?produit=ID) :
  //        on sert index.html (cache + mise à jour en arrière-plan),
  //        sans créer une entrée de cache par produit.
  if (event.request.mode === 'navigate' && new URL(url).search) {
    event.respondWith(
      caches.match('/Congomarket/index.html').then(cached => {
        const net = fetch('/Congomarket/index.html').then(r => {
          if (r && r.status === 200) {
            const c = r.clone();
            caches.open(CACHE_STATIC).then(ca => ca.put('/Congomarket/index.html', c));
          }
          return r;
        }).catch(() => cached || Response.error());
        return cached || net;
      })
    );
    return;
  }

  // ── 5. Fichiers statiques (HTML/JS/CSS/manifest) — Cache d'abord pour un
  //       chargement instantané, MAIS mise à jour silencieuse en arrière-plan
  //       à chaque requête (stale-while-revalidate). Le meilleur des deux :
  //       rapide comme le cache, mais jamais bloqué longtemps sur une
  //       ancienne version (le prochain chargement aura la nouvelle).
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchAndUpdate = fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_STATIC).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached || caches.match('/Congomarket/index.html') || Response.error());

      return cached || fetchAndUpdate;
    })
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

// ── Notifications Push ─────────────────────────────────────────
// Sert à la fois aux commandes (vendeurs) et aux alertes visiteurs
// (nouveautés toutes les 2 h, nouveau vendeur, nouveau Taxi).
const PUSH_SUPABASE_URL = 'https://frvzrorqndozglxczatv.supabase.co';
const PUSH_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydnpyb3JxbmRvemdseGN6YXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTc0NTEsImV4cCI6MjA5NTQ3MzQ1MX0.g3ETfxBw_i0keZYDrnGYudnbs4m23AJ_dFoxXV0ZJEE';
const PUSH_VAPID_KEY    = 'BETaKCUXbi_24cmp2qv-8v5xHrhW-gMCYlWCxNljiqO_Cp5TjZmxgLPYcymD4m21aypPaqlrq5eJn8FFuFrlp7k';

function pushB64ToU8(b64) {
  const pad = '='.repeat((4 - b64.length % 4) % 4);
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

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
  if (data.image) options.image = data.image;          // grande photo du produit
  if (data.tag) { options.tag = data.tag; options.renotify = true; }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  let url = (event.notification.data && event.notification.data.url) || '/Congomarket/';
  if (url === '/') url = '/Congomarket/';
  const target = new URL(url, self.location.origin).href;
  event.waitUntil((async () => {
    const list = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of list) {
      if (client.url.includes('/Congomarket/') && 'focus' in client) {
        await client.focus();
        client.postMessage({ type: 'notif-open', url: target });   // la page ouvre le produit / le formulaire
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});

// Si le navigateur renouvelle l'abonnement, on se réabonne et on le réenregistre
// (l'abonnement visiteur reste ainsi actif sans action de l'utilisateur).
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pushB64ToU8(PUSH_VAPID_KEY)
      });
      await fetch(PUSH_SUPABASE_URL + '/functions/v1/push-subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + PUSH_SUPABASE_KEY },
        body: JSON.stringify({ action: 'subscribe', subscription: sub.toJSON() })
      });
    } catch (e) { /* on réessaiera à la prochaine visite */ }
  })());
});
