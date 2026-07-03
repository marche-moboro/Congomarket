// ================================================================
// CONFIGURATION SUPABASE — MARCHÉ MOBORO
// Projet : https://frvzrorqndozglxczatv.supabase.co
// ✅ CORRECTION : suppression du import ESM (incompatible avec <script> classique)
//    → Supabase chargé via CDN global dans index.html :
//      <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//    → accessible via supabase.createClient()
// ================================================================

const SUPABASE_URL = 'https://frvzrorqndozglxczatv.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZydnpyb3JxbmRvemdseGN6YXR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4OTc0NTEsImV4cCI6MjA5NTQ3MzQ1MX0.g3ETfxBw_i0keZYDrnGYudnbs4m23AJ_dFoxXV0ZJEE';

const { createClient } = supabase; // ✅ via CDN global
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ================================================================
// NUMÉRO WHATSAPP ADMIN
// ================================================================
const ADMIN_PHONE = '242050672009';

// ================================================================
// TABLES
// ================================================================
const TABLES = {
  SELLERS:          'sellers',
  PRODUCTS:         'products',
  ORDERS:           'orders',
  PROMOS:           'promos',
  VISITORS:         'visitors',
  BLOCKED_PHONES:   'blocked_phones',
  ADMIN_LOGS:       'admin_logs',
  VIP_MANAGERS:     'vip_managers',
  PRODUCT_VIEWS:    'product_views',
  BANNER_SLIDES:    'banner_slides',
  PAYMENTS:         'payments',
  SETTINGS:         'settings',
  WHATSAPP_CLICKS:  'whatsapp_clicks',
  DELIVERY_AGENTS:  'delivery_agents'
};

// ================================================================
// TARIFS D'ABONNEMENT PAR TYPE DE COMPTE
// ================================================================
const TARIFS = {
  livreur:            { label: '🚚 Livreur',              mensuel: 1500,  trimestriel: 4000,  annuel: 15000  },
  independant_vendeur:   { label: '🛍️ Vendeur Indépendant',  mensuel: 2000,  trimestriel: 5500,  annuel: 20000  },
  vip_vendeur:        { label: '👑 Vendeur VIP',           mensuel: 5000,  trimestriel: 13500, annuel: 50000  },
  independant_grossiste: { label: '🏭 Grossiste Indépendant', mensuel: 5000,  trimestriel: 13500, annuel: 50000  },
  vip_grossiste:      { label: '👑 Grossiste VIP',         mensuel: 10000, trimestriel: 27000, annuel: 100000 },
  fournisseur_export: { label: '📦 Fournisseur Export',    mensuel: 20000, trimestriel: 54000, annuel: 200000 }
};

const DUREES = {
  mensuel:      { label: '1 mois',   mois: 1  },
  trimestriel:  { label: '3 mois',   mois: 3  },
  annuel:       { label: '12 mois',  mois: 12 }
};

// ================================================================
// FLAG SYSTÈME ABONNEMENT
// Chargé depuis Supabase table 'settings' (key: 'subscription_system')
// Valeur par défaut : 'off' (sécurité — pas d'effet tant que non activé)
// ================================================================
let _subscriptionSystemActive = false;

async function loadSubscriptionSetting() {
  try {
    const { data } = await db.from(TABLES.SETTINGS)
      .select('value').eq('key', 'subscription_system').maybeSingle();
    _subscriptionSystemActive = data && data.value === 'on';
    console.log('Système abonnement :', _subscriptionSystemActive ? '🟢 ACTIF' : '🔴 DÉSACTIVÉ');
  } catch(e) {
    _subscriptionSystemActive = false;
    console.warn('loadSubscriptionSetting error:', e.message);
  }
}

function isSubscriptionActive() {
  return _subscriptionSystemActive;
}

// ================================================================
// VÉRIFICATION EXPIRATION
// Retourne : 'ok' | 'expire_bientot' (J-7) | 'expire'
// ================================================================
function checkSubscriptionExpiry(subscriptionEnd) {
  if (!subscriptionEnd) return 'ok';
  const now       = new Date();
  const endDate   = new Date(subscriptionEnd);
  const diffMs    = endDate - now;
  const diffJours = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffJours < 0)  return 'expire';
  if (diffJours <= 7) return 'expire_bientot';
  return 'ok';
}

// ================================================================
// BLOCAGE AUTOMATIQUE EN BASE
// ================================================================
async function autoBlockExpired(sellerId, table = 'sellers') {
  try {
    await db.from(table).update({
      is_blocked:          true,
      subscription_status: 'expire'
    }).eq('id', sellerId);
    await logAdminAction('auto_block', table, sellerId, 'Blocage automatique — abonnement expiré');
  } catch(e) {
    console.error('autoBlockExpired error:', e);
  }
}


// ================================================================
// CATÉGORIES A (Importateurs & Grossistes)
// ================================================================
const CATEGORIES_A = {
  'ig':           'Meilleur Importateurs & Grossistes',
  'immo':         'Immobilier',
  'coiffure':     'Grand Salon de Coiffure',
  'hotel':        'Hôtel, Jardin & Lieu Touristique',
  'deco-mariage': 'Décoration Mariage & Autres',
  'menage':       'Service de Ménage',
  'demenagement': 'Service de Déménagement',
  'couture':      'Couture & Styliste',
  'auto':         'Automobile & Dépannage',
  'pharmacie':    'Pharmacie',
  'priseningue':  'Prinsingue',
  'librairie':    'Librairie & Papeterie',
  'construction': 'Matériaux de Construction',
  'photoShop':    'Photo Shop',
  'alimentation': 'Alimentation',
  'oeufs':      'Grossiste Œufs',
  'ambulance':      'Contactez Taxi ou Ambulances',
  'moto-taxi':      'Véhicule Moto & Taxi',
  'chambre-froide': 'Chambre Froide',
  'hopital':        'Hôpital',
  
}

// ================================================================
// CATÉGORIES B (Vendeurs individuels)
// ================================================================
const CATEGORIES_B = {
  'c1':  'Chaussures & Basket',
  'c2':  'Accessoires Téléphone',
  'c3':  'Beauté & Cosmétiques',
  'c4':  'Vêtements Femme',
  'c5':  'Chaussures Femme',
  'c6':  'Sacs & Accessoires Mode',
  'c7':  'Maison & Décoration',
  'c8':  'Savon Artisanal & Naturel',
  'c9':  'Parfums & Soins Luxe',
  'c10': 'Bébé & Enfants',
  'c11': 'Perruques & Mèches',
  'c12': 'Lingerie, Nuit, Rideau & Tenue',
  'c13': 'Santé & Bien-être Femme',
  'c14': 'Friperie Premium',
  'c15': 'Tissus & Pagnes',
  'c16': "Occasion d'Europe",
  'c17': 'Pâtisserie',
  'c18': 'Veste & Chaussures de Luxe',
  'c19': 'Plastique',
  'c20': 'Électronique',
  'c21': 'Grossiste Œufs',
  'c22': 'Anniversaire & Objet Jetable',
  'meubles': 'Meubles',
};

// Toutes les catégories
const ALL_CATEGORIES = { ...CATEGORIES_A, ...CATEGORIES_B };

// ================================================================
// UTILITAIRES
// ================================================================

function generateSellerCode(count) {
  const number = String(count + 1).padStart(4, '0');
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const randomLetter = letters[Math.floor(Math.random() * letters.length)];
  return 'MBR' + number + randomLetter;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerText = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => toast.className = 'toast', 3000);
}

// ── hashPin — SHA-256 — utilisé uniquement pour INSERT/UPDATE ──
async function hashPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + '_mbr_salt_2024');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hashVipManagerPin(pin) {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + '_vip_mbr_2025');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ── verifyPin — Edge Function — pin_hash reste côté serveur ──────
async function verifyPin(code, pin, table) {
  try {
    const res = await fetch(
      SUPABASE_URL + '/functions/v1/verify-pin',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + SUPABASE_KEY
        },
        body: JSON.stringify({ code, pin, table })
      }
    );
    if (!res.ok) return { ok: false, account: null };
    return await res.json();
  } catch (e) {
    console.error('verifyPin exception:', e);
    return { ok: false, account: null };
  }
}

function formatPrice(price) {
  if (!price || isNaN(Number(price))) return '0';
  return Number(price).toLocaleString('fr-FR');
}

// Bug 5 fix — _selectedVille déclarée ici (chargé avant sellers.js et search.js)
// Elle sera écrasée par index.html si définie là-bas, sans conflit
if (typeof _selectedVille === 'undefined') var _selectedVille = '';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function recordVisit() {
  try {
    const today = new Date().toISOString().split('T')[0];
    await db.from(TABLES.VISITORS).insert({ date: today, type: 'visit' });
  } catch (e) {
    console.error('recordVisit error:', e);
  }
}

// ✅ Version unifiée — utilisée par supabase.js ET admin.js (supprimée dans admin.js)
async function logAdminAction(action, targetTable, targetId = null, details = '', oldValue = null, newValue = null) {
  try {
    await db.from(TABLES.ADMIN_LOGS).insert({
      action,
      target_table: targetTable,
      target_id:    targetId,
      details,
      old_value:    oldValue  ? oldValue  : null,
      new_value:    newValue  ? newValue  : null,
      created_at:   new Date().toISOString()
    });
  } catch (e) {
    console.error('logAdminAction error:', e);
  }
}
