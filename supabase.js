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
  PRODUCT_REVIEWS:  'product_reviews',
  SELLER_REVIEWS:   'seller_reviews',
  BANNER_SLIDES:    'banner_slides',
  PAYMENTS:         'payments',
  SETTINGS:         'settings',
  WHATSAPP_CLICKS:  'whatsapp_clicks',
  DELIVERY_AGENTS:  'delivery_agents',
  ADMIN_NOTIFICATIONS: 'admin_notifications'
};

// ================================================================
// TARIFS D'ABONNEMENT PAR TYPE DE COMPTE
// ================================================================
const TARIFS = {
  livreur:               { label: '🚚 Livreur',                 mensuel: 1000, trimestriel: 2700, annuel: 10000 },
  independant_vendeur:   { label: '🛍️ Vendeur Indépendant',      mensuel: 1000, trimestriel: 2700, annuel: 10000 },
  vip_vendeur:           { label: '👑 Vendeur VIP',               mensuel: 1000, trimestriel: 2700, annuel: 10000, commission: 3 },
  independant_grossiste: { label: '🏭 Grossiste Indépendant',     mensuel: 1000, trimestriel: 2700, annuel: 10000 },
  vip_grossiste:         { label: '👑 Grossiste VIP',              mensuel: 1000, trimestriel: 2700, annuel: 10000, commission: 3 },
  fournisseur_export:    { label: '📦 Fournisseur Export',        commission: 10 }
};
// Note : "commission" = % prélevé par vente/transaction, en plus (VIP) ou à la place (fournisseur_export)
// de l'abonnement mensuel. Le prélèvement de la commission n'est pas automatisé — à gérer manuellement
// ou via un futur module de paiement.

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

// ================================================================
// ARBRE "IMPORTATEUR & GROSSISTE" (Liste A)
// ================================================================
const TREE_A = [
  {id:'ag1', label:'🌾 Riz, Céréales en Sac'},
  {id:'ag2', label:'🛢️ Huile en Carton'},
  {id:'ag3', label:'🥛 Sucre, Farine, Lait'},
  {id:'ag4', label:'🥤 Boissons en Palette'},
  {id:'ag5', label:'🧊 Produits Congelés'},
  {id:'ag6', label:'🥚 Œufs par Carton'},
  {id:'ag7', label:'🥫 Pâtes, Conserves'},
  {id:'ag8', label:'🌶️ Épices & Condiments en Gros'},
  {id:'tg1', label:'👕 Ballot de Friperie'},
  {id:'tg2', label:'🧵 Ballot de Tissus/Pagnes'},
  {id:'tg3', label:'👗 Vêtements en Gros'},
  {id:'tg4', label:'👟 Chaussures en Carton'},
  {id:'tg5', label:'👜 Accessoires Mode en Gros'},
  {id:'te1', label:'📱 Téléphone en Carton'},
  {id:'te2', label:'🔌 Électroménager en Gros'},
  {id:'te3', label:'💻 Matériel Informatique'},
  {id:'te4', label:'☀️ Énergie Solaire en Gros'},
  {id:'bm1', label:'🧱 Ciment, Fer, Carrelage'},
  {id:'bm2', label:'⚡ Groupe Électrogène'},
  {id:'bm3', label:'🔩 Quincaillerie'},
  {id:'bm4', label:'🎨 Peinture Pro'},
  {id:'bs1', label:'💄 Produits Cosmétiques en Gros'},
  {id:'bs2', label:'💊 Médicaments Importation'},
  {id:'bs3', label:"🧴 Produits d'Entretien Pro"},
  {id:'bo1', label:'🥤 Boissons Non Alcoolisées en Gros'},
  {id:'bb1', label:'👶 Couches & Produits Bébé en Gros'},
  {id:'gc1', label:'🔥 Gaz & Combustible en Gros'},
  {id:'pf1', label:'📓 Papeterie & Fournitures Scolaires en Gros'},
  {id:'jf1', label:'🎈 Jouets & Articles de Fête en Gros'},
  {id:'ec1', label:'📦 Emballage & Consommables en Gros'},
  {id:'ia1', label:'🌱 Intrants Agricoles en Gros'},
  {id:'pp1', label:'🛞 Pneus & Pièces Détachées en Gros'},
  {id:'bs4', label:'➕ Autre'},
];
const TREE_A_IDS = new Set(TREE_A.map(c => c.id));

// ================================================================
// ARBRE "MULTI SERVICE & COMMERCE" (Liste B.1)
// ================================================================
const TREE_B1 = [
  {id:'immo', label:'🏠 Agence Immobilière'},
  {id:'loc-bureau', label:'🏢 Location Bureau & Boutique'},
  {id:'vente-terrain', label:'🏡 Vente Terrain/Maison'},
  {id:'gestion-locative', label:'📋 Gestion Locative'},
  {id:'coiffure', label:'✂️ Salon de Coiffure'},
  {id:'institut-beaute', label:'💅 Institut de Beauté'},
  {id:'onglerie', label:'💎 Onglerie'},
  {id:'coach-sportif', label:'🏋️ Coach Sportif & Fitness'},
  {id:'hotel', label:'🏨 Hôtel'},
  {id:'restaurant', label:'🍽️ Restaurant'},
  {id:'patisserie-service', label:'🎂 Patisserie'},
  {id:'traiteur', label:'🍱 Traiteur'},
  {id:'jardin-touristique', label:'🌳 Jardin & Lieu Touristique'},
  {id:'agence-voyage', label:'✈️ Agence de Voyage'},
  {id:'guide-touristique', label:'🗺️ Guide Touristique'},
  {id:'deco-mariage', label:'💍 Décoration Mariage'},
  {id:'salle-fete', label:'🎉 Salle de Fête'},
  {id:'dj-sono', label:'🎧 DJ & Sonorisation'},
  {id:'photoShop', label:'📸 Photographe & Vidéaste'},
  {id:'location-chaise', label:'🪑 Location Chaise, Tente & Autres'},
  {id:'menage', label:'🧹 Service de Ménage'},
  {id:'blanchisserie', label:'🧺 Blanchisserie & Pressing'},
  {id:'demenagement', label:'🚛 Déménagement'},
  {id:'gardiennage', label:'🛡️ Gardiennage & Sécurité'},
  {id:'nounou', label:"🍼 Nounou & Garde d'Enfant"},
  {id:'aide-domicile', label:'🧑\u200d🦳 Aide à Domicile / Personnes Âgées'},
  {id:'auto', label:'🔧 Garage Auto & Mécanique'},
  {id:'depannage-auto', label:'🚨 Dépannage Auto'},
  {id:'lavage-auto', label:'🚿 Lavage Auto'},
  {id:'moto-taxi', label:'🏍️ Moto-Taxi'},
  {id:'auto-ecole', label:'🚦 Auto-École'},
  {id:'ambulance', label:'🚑 Taxi & Ambulance'},
  {id:'couture', label:'🧵 Couture & Styliste'},
  {id:'broderie', label:'🪡 Broderie & Personnalisation'},
  {id:'reparation-chaussure', label:'👞 Réparation Chaussure'},
  {id:'hopital', label:'🏥 Hôpital & Clinique'},
  {id:'labo-analyse', label:"🔬 Laboratoire d'Analyse"},
  {id:'pharmacie', label:'💊 Pharmacie'},
  {id:'dentaire', label:'🦷 Cabinet Dentaire'},
  {id:'opticien', label:'👓 Opticien'},
  {id:'chambre-froide', label:'❄️ Chambre Froide'},
  {id:'magasin-stockage', label:'📦 Magasin de Stockage'},
  {id:'plombier', label:'🚰 Plombier'},
  {id:'architecture', label:'🏛️ Architecture & Design'},
  {id:'electricien', label:'💡 Électricien'},
  {id:'macon', label:'🧱 Maçon'},
  {id:'peintre', label:'🎨 Peintre'},
  {id:'jardinier', label:'🌿 Jardinier/Paysagiste'},
  {id:'menuisier', label:'🪚 Menuisier'},
  {id:'climatisation', label:'❄️ Climatisation & Froid'},
  {id:'construction', label:'🏗️ Matériaux de Construction'},
  {id:'imprimerie', label:'🖨️ Imprimerie'},
  {id:'cyber', label:'🖥️ Cyber & Photocopie'},
  {id:'formation-langue', label:'🎓 Formation & Centre de Langue'},
  {id:'comptabilite', label:'🧮 Service Comptabilité'},
  {id:'dev-web', label:'💻 Développement Web & App'},
  {id:'marketing-digital', label:'📢 Marketing Digital'},
  {id:'autre-b1', label:'➕ Autre'},
];
const TREE_B1_IDS = new Set(TREE_B1.map(c => c.id));

function flattenTree(list) {
  const out = {};
  list.forEach(s => out[s.id] = s.label);
  return out;
}

// Toutes les catégories
// ================================================================
// ARBRE "BOUTIQUE & VENDEUR" (Liste B.2)
// ================================================================
const TREE_B2 = [
  {id:'chemise', label:'👚 Chemise'},
  {id:'polo', label:'👕 Polo'},
  {id:'lacoste-h', label:'🐊 Lacoste Homme'},
  {id:'djine', label:'👖 Djine'},
  {id:'basin-h', label:'🧵 Basin Homme'},
  {id:'pantalon-djokingue', label:'🧶 Pantalon Djokingue'},
  {id:'pantalon-tissu', label:'🪡 Pantalon Tissu'},
  {id:'costume-h', label:'🤵 Costume Homme'},
  {id:'vareuse', label:'🧥 Vareuse'},
  {id:'jogging', label:'🏃 Jogging'},
  {id:'short', label:'🩳 Short'},
  {id:'maillot-bain-h', label:'🩱 Maillot de Bain'},
  {id:'ceinture', label:'🪢 Ceinture'},
  {id:'cravate', label:'👔 Cravate'},
  {id:'chapeau', label:'🎩 Chapeau'},
  {id:'montre-chainette', label:'🔗 Montre, Chainette & Autres'},
  {id:'chaussettes', label:'🧦 Chaussettes'},
  {id:'sous-vetements-h', label:'🩲 Sous-vêtements'},
  {id:'c18', label:'🕴️ Veste & Chaussures de Luxe'},
  {id:'c4', label:'👗 Prêt à Porter'},
  {id:'robe', label:'👘 Robe'},
  {id:'basin-f', label:'🥻 Basin Femme'},
  {id:'jupe', label:'🎀 Jupe'},
  {id:'pantalon-f', label:'🎽 Pantalon Femme'},
  {id:'costume-f', label:'👩\u200d💼 Costume Femme'},
  {id:'c12', label:'🎗️ Lingerie Femme'},
  {id:'super-wax', label:'🎨 Super Wax'},
  {id:'lacoste-f', label:'🦎 Lacoste Femme'},
  {id:'maillot-bain-f', label:'👙 Maillot de Bain Femme'},
  {id:'c6', label:'👜 Sacs à Main'},
  {id:'sacs-voyage', label:'🧳 Sacs de Voyage'},
  {id:'valisette', label:'💼 Valisette'},
  {id:'bijoux', label:'💍 Bijoux'},
  {id:'foulard', label:'🧣 Foulard'},
  {id:'robe-soiree', label:'💃 Robe de Soirée'},
  {id:'chaussures-h', label:'👞 Chaussures Homme'},
  {id:'c5', label:'👠 Chaussures Femme'},
  {id:'chaussures-enfant', label:'🩰 Chaussures Enfant'},
  {id:'c1', label:'👟 Basket'},
  {id:'mannequin-h', label:'🧍\u200d♂️ Mannequin Homme'},
  {id:'mannequin-f', label:'🧍\u200d♀️ Mannequin Femme'},
  {id:'mannequin-enfant', label:'🧒 Mannequin Enfant'},
  {id:'sandales-h', label:'🩴 Sandales Homme'},
  {id:'sandales-f', label:'👡 Sandales Femme'},
  {id:'talons', label:'🥿 Talons'},
  {id:'bottes', label:'🥾 Bottes'},
  {id:'c10', label:'👶 Vêtements Bébé'},
  {id:'vetements-garcon', label:'👦 Vêtements Garçon'},
  {id:'vetements-fille', label:'👧 Vêtements Fille'},
  {id:'jouets', label:'🧸 Jouets'},
  {id:'velo-enfant', label:'🚲 Vélo'},
  {id:'c3', label:'💄 Beauté & Cosmétiques'},
  {id:'c9', label:'🌸 Parfums de Luxe'},
  {id:'c8', label:'🧼 Savon Artisanal'},
  {id:'c11', label:'💇 Perruques & Mèches'},
  {id:'produit-bain', label:'🛁 Produit de Bain'},
  {id:'produit-capillaire', label:'💆 Produit Capillaire'},
  {id:'c13', label:'💊 Santé & Bien-être Femme'},
  {id:'telephone', label:'📱 Téléphone'},
  {id:'ordinateur', label:'💻 Ordinateur'},
  {id:'tablette', label:'📟 Tablette'},
  {id:'chargeur', label:'🔌 Chargeur'},
  {id:'casque-ecouteurs', label:'🎧 Casque & Écouteurs'},
  {id:'c2', label:'🛡️ Étui Téléphone'},
  {id:'montre-connectee', label:'⌚ Montre Connectée'},
  {id:'television', label:'📺 Télévision'},
  {id:'ventilateur', label:'🌀 Ventilateur'},
  {id:'console-jeux', label:'🎮 Console & Jeux Vidéo'},
  {id:'drones-camera', label:'🚁 Drones & Caméra'},
  {id:'c20', label:'🔋 Électronique'},
  {id:'meubles', label:'🛋️ Meubles'},
  {id:'electromenager', label:'🍳 Électroménager'},
  {id:'cuisine-vaisselle', label:'🍽️ Cuisine & Vaisselle'},
  {id:'literie', label:'🛏️ Literie'},
  {id:'c7', label:'🏠 Décoration Maison'},
  {id:'rideau-tapis', label:'🪟 Rideau & Tapis'},
  {id:'c19', label:'🧴 Plastique Ménager'},
  {id:'eponge', label:'🧽 Éponge'},
  {id:'c22', label:'🎉 Anniversaire & Objet Jetable'},
  {id:'alimentation', label:'🛒 Épicerie'},
  {id:'fruits-legumes', label:'🍎 Fruits & Légumes'},
  {id:'boucherie-poissonnerie', label:'🥩 Boucherie & Poissonnerie'},
  {id:'boulangerie', label:'🥖 Boulangerie'},
  {id:'boissons-jus', label:'🧃 Boissons & Jus'},
  {id:'produits-bio', label:'🌱 Produits Bio'},
  {id:'c17', label:'🎂 Pâtisserie'},
  {id:'c15', label:'📏 Tissus au Mètre'},
  {id:'pagnes', label:'🌺 Pagnes'},
  {id:'c14', label:'♻️ Friperie'},
  {id:'c16', label:"🚢 Occasion d'Europe"},
  {id:'habit-travail', label:'🦺 Habit de Travail'},
  {id:'artisanat-local', label:'🪘 Artisanat Local & Monde'},
  {id:'accessoires-auto', label:'🚗 Accessoires Auto'},
  {id:'pieces-auto', label:'🔧 Pièces Détachées Auto'},
  {id:'location-voiture', label:'🚙 Location Voiture'},
  {id:'voiture-vente', label:'🚘 Voiture en Vente'},
  {id:'moto-vente', label:'🏍️ Vente des Motos'},
  {id:'velo-vente', label:'🚴 Vente des Vélos'},
  {id:'patin-skate', label:'🛼 Patin & Skate'},
  {id:'articles-sport', label:'⚽ Articles de Sport'},
  {id:'librairie', label:'📚 Librairie'},
  {id:'instrument-musique', label:'🎸 Instrument de Musique'},
  {id:'peche-camping', label:'🎣 Objets de Pêche & Camping'},
  {id:'articles-religieux', label:'📿 Articles Religieux'},
  {id:'sacs-scolaires', label:'🎒 Sacs'},
  {id:'cahiers', label:'📓 Cahiers'},
  {id:'tenue-cousue', label:'✂️ Tenue Cousue'},
  {id:'autre-b2', label:'➕ Autre'},
];

const ALL_CATEGORIES = { ...CATEGORIES_A, ...CATEGORIES_B, ...flattenTree(TREE_A), ...flattenTree(TREE_B1), ...flattenTree(TREE_B2) };

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
