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
async function autoBlockExpired(sellerCode, table = 'sellers') {
  try {
    const res = await fetch(SUPABASE_URL + '/functions/v1/account-actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'check_and_block_expired', table, payload: { code: sellerCode } })
    });
    await res.json();
  } catch(e) {
    console.error('autoBlockExpired error:', e);
  }
}

// ================================================================
// CATÉGORIES A (Importateurs & Grossistes) — ancien lexique conservé pour compat
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
// CATÉGORIES B (Vendeurs individuels) — ancien lexique conservé pour compat
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

function flattenTree(list) {
  const out = {};
  list.forEach(s => (s.ids || [s.id]).forEach(i => { out[i] = s.label; }));
  return out;
}

// ================================================================
// ARBRE "IMPORTATEUR & GROSSISTE" (Liste A)
// Chaque catégorie porte un champ "section" (regroupement affiché dans
// la sidebar de filtres). Généré à partir de la liste fournie le 29/08/2026.
// ================================================================
// Chaque catégorie regroupe d'anciennes sous-catégories : "ids" contient l'id de la
// catégorie + les anciens ids de sous-catégories, pour que les produits déjà publiés
// restent visibles sans migration de la base. Les NOUVEAUX produits stockent l'id de la catégorie.
const TREE_A = [
  {id:'cat-g-alimentaire-de-base', icon:'🥫', label:'Alimentaire de base', ids:['cat-g-alimentaire-de-base', 'riz-farine', 'farine-de-mais', 'mais-en-gros', 'spaghetti', 'sucre-lait', 'huile-d-arachide', 'huile-d-olive', 'huile-de-palme', 'epices-condiments-en-gros', 'oufs-en-carton', 'sel']},
  {id:'cat-g-congeles-poissons', icon:'🥶', label:'Congelés & Poissons', ids:['cat-g-congeles-poissons', 'produits-congeles', 'bisi-ya-mayi-en-gros', 'makayabo-poisson-sale-en-gros', 'mokalou-poisson-fume-en-gros', 'poisson-de-mer-en-gros', 'niama-zamba-en-gros', 'fruits-en-gros', 'miel']},
  {id:'cat-g-boissons', icon:'🥤', label:'Boissons', ids:['cat-g-boissons', 'boissons-sans-alcool-en-gros', 'vins-boissons-alcoolisees-en-gros', 'sachets-d-eau-minerale-en-gros']},
  {id:'cat-g-textile-mode-en-gros', icon:'👗', label:'Textile & Mode en Gros', ids:['cat-g-textile-mode-en-gros', 'ballot-de-friperie', 'ballot-de-tissus-pagnes', 'vetements-en-gros', 'chaussures-en-carton', 'accessoires-mode-en-gros']},
  {id:'cat-g-maison-btp-energie', icon:'🏠', label:'Maison, BTP & Énergie', ids:['cat-g-maison-btp-energie', 'ciment-fer-carrelage-en-gros', 'quincaillerie-en-gros', 'peinture', 'bois-en-gros', 'charbon-de-bois-en-gros', 'gaz-combustible-en-gros', 'energie-solaire-en-gros', 'produits-d-entretien-pro', 'emballage-en-gros']},
  {id:'cat-g-tech-auto-industrie', icon:'📱', label:'Tech, Auto & Industrie', ids:['cat-g-tech-auto-industrie', 'telephone-en-gros', 'electromenager-en-gros', 'materiel-informatique-en-gros', 'pneus-automobile-pieces-detachees-en-gros', 'essence-gasoil-en-fut', 'autre-tech-auto-in']},
  {id:'cat-g-beaute-bien-etre', icon:'💄', label:'Beauté & Bien-être', ids:['cat-g-beaute-bien-etre', 'beaute-cosmetiques-en-gros', 'parfums-de-luxe-en-gros', 'savon-artisanal-en-gros', 'produits-eclaircissants-en-gros', 'perruques-meches-en-gros', 'produit-capillaire-en-gros', 'produit-de-bain-en-gros', 'sante-bien-etre-femme-en-gros', 'autre-beaute-bien-etre-gros']},
  {id:'cat-g-bebe-fete-divers', icon:'👶', label:'Bébé, Fête & Divers', ids:['cat-g-bebe-fete-divers', 'couches-produits-bebe-en-gros', 'papeterie-fournitures-scolaires-en-gros', 'jouets-articles-de-fete-en-gros', 'objets-celebration-en-gros', 'autre-bebe-fete-di']},
  {id:'cat-g-agriculture-peche-loisirs', icon:'🌾', label:'Agriculture, Pêche & Loisirs', ids:['cat-g-agriculture-peche-loisirs', 'produits-agricoles-en-gros', 'materiaux-et-produits-de-peche-en-gros', 'materiaux-de-chasse-en-gros', 'materiaux-du-sport-en-gros', 'materiaux-de-musique-en-gros', 'materiaux-du-multimedia-en-gros', 'autre-agriculture-']},
  {id:'sans-categorie-a', icon:'📦', label:'Sans catégorie', ids:['sans-categorie-a', 'autre']},
];

const TREE_B1 = [
  {id:'cat-s-maison-btp', icon:'🏠', label:'Maison & BTP', ids:['cat-s-maison-btp', 'plombier', 'electricien', 'macon', 'peintre', 'menuisier', 'jardinier-paysagiste', 'ingenierie', 'architecture', 'climatisation-froid', 'serrurerie', 'soudure-ferronnerie', 'location-de-materiel-de-chantier', 'chambre-froide', 'magasin-de-stockage']},
  {id:'cat-s-auto-transport', icon:'🚗', label:'Auto & Transport', ids:['cat-s-auto-transport', 'garage-auto-mecanique', 'depannage-auto-a-domicile', 'lavage-parking-auto', 'vulcanisation', 'taulier-carrossier', 'auto-ecole', 'transport-local-moto-taxi-bus', 'location-de-camion-transport', 'voyage-en-bateau', 'voyage-en-baleiniere', 'voyage-en-camion', 'agence-de-voyage', 'guide-touristique', 'autre-auto-transpo']},
  {id:'cat-s-sante-social', icon:'🏥', label:'Santé & Social', ids:['cat-s-sante-social', 'hopital-clinique', 'laboratoire-d-analyse', 'pharmacie', 'cabinet-dentaire', 'opticien', 'nounou-garde-d-enfant', 'garderie', 'aide-a-domicile', 'service-de-menage', 'blanchisserie-pressing', 'pompes-funebres', 'autre-sante-social']},
  {id:'cat-s-beaute-mode', icon:'💄', label:'Beauté & Mode', ids:['cat-s-beaute-mode', 'salon-de-coiffure', 'institut-de-beaute', 'coach-sportif-fitness', 'couture-styliste', 'broderie-personnalisation', 'reparation-chaussure', 'bijouterie', 'horlogerie', 'autre-beaute-mode']},
  {id:'cat-s-evenementiel-loisirs', icon:'🎉', label:'Événementiel & Loisirs', ids:['cat-s-evenementiel-loisirs', 'salle-de-fete', 'decoration-mariage', 'dj-sonorisation', 'photographe-videaste', 'location-chaise-tente-autres', 'traiteur', 'patisserie', 'restaurant', 'hotel', 'jardin-lieu-touristique', 'autre-evenementiel']},
  {id:'cat-s-services-aux-entreprises-tech', icon:'💼', label:'Services aux Entreprises & Tech', ids:['cat-s-services-aux-entreprises-tech', 'developpement-web-app', 'marketing-digital', 'service-comptabilite', 'imprimerie', 'cyber-photocopie', 'centre-de-formation', 'cours-de-soutien-a-domicile-repetiteur', 'reparation-telephone-tablette', 'reparation-ordinateur', 'reparation-television-electromenager', 'recharge-telephonique-forfaits', 'autre-services-aux']},
  {id:'cat-s-commerce-autres-services', icon:'🛒', label:'Commerce & Autres Services', ids:['cat-s-commerce-autres-services', 'agence-immobiliere', 'location-bureau-boutique', 'vente-terrain-maison', 'vente-de-gaz', 'vente-de-meubles', 'elevage-volaille-porcs-chevres', 'service-de-peche', 'gardiennage-securite', 'service-de-demenagement', 'autre-commerce-aut']},
  {id:'sans-categorie-b1', icon:'📦', label:'Sans catégorie', ids:['sans-categorie-b1', 'autre']},
];

const TREE_B2 = [
  {id:'cat-b-mode-femme', icon:'👗', label:'Mode Femme', ids:['cat-b-mode-femme', 'robe', 'robe-de-soiree', 'jupe', 'pantalon-femme', 'costume-femme', 'lingerie-femme', 'basin-femme', 'pret-a-porter', 'super-wax', 'lipouta-tenues-traditionnelles', 'lacoste-femme', 'sous-vetements', 'maillot-de-bain']},
  {id:'cat-b-mode-homme', icon:'👔', label:'Mode Homme', ids:['cat-b-mode-homme', 'chemise', 'polo', 'lacoste-homme', 'djine', 'pantalon-jogging', 'pantalon-tissu', 'costume-homme', 'chaussures-de-luxe', 'la-sape-mode-ambianceur', 'vareuse', 'basin-homme', 'short', 'maillot-de-bain-mode-homme', 'autre-mode-homme']},
  {id:'cat-b-enfant-bebe', icon:'👶', label:'Enfant & Bébé', ids:['cat-b-enfant-bebe', 'vetements-bebe', 'vetements-garcon', 'vetements-fille', 'chaussures-enfant', 'jouets', 'autre-enfant-bebe']},
  {id:'cat-b-chaussures', icon:'👟', label:'Chaussures', ids:['cat-b-chaussures', 'chaussures-homme', 'talons', 'chaussures-enfants', 'basket', 'securite', 'sandales-homme', 'sandales-femme', 'bottes', 'autre-chaussures']},
  {id:'cat-b-accessoires-bijoux', icon:'👜👔', label:'Accessoires & Bijoux', ids:['cat-b-accessoires-bijoux', 'sacs-a-main', 'sacs-de-voyage', 'sacs-de-sortie', 'ceinture', 'cravate', 'chapeau', 'montre', 'chainette', 'montre-intelligent', 'bijoux', 'perles', 'bijoux-traditionnels', 'foulard', 'chaussettes', 'sous-vetements-accessoires-', 'autre-accessoires-']},
  {id:'cat-b-beaute-bien-etre', icon:'💄', label:'Beauté & Bien-être', ids:['cat-b-beaute-bien-etre', 'beaute-cosmetiques', 'parfums-de-luxe', 'savon-artisanal', 'produits-eclaircissants', 'perruques-meches', 'produit-capillaire', 'produit-de-bain', 'sante-bien-etre-femme', 'autres']},
  {id:'cat-b-tech-electronique', icon:'📱', label:'Tech & Électronique', ids:['cat-b-tech-electronique', 'telephone', 'ordinateur', 'tablette', 'television', 'casque-ecouteurs', 'chargeur', 'etui-telephone', 'console-jeux-video', 'drones-camera', 'electronique', 'pieces-accessoires', 'composants-electroniques', 'panneaux-solaires-kits-detail', 'cartes-sim']},
  {id:'cat-b-produits-de-decoration', icon:'🏠', label:'Produits de Décoration', ids:['cat-b-produits-de-decoration', 'meubles', 'electromenager', 'cuisine-vaisselle', 'literie', 'decoration-maison', 'rideau-tapis', 'plastique-menager', 'eponge', 'autre-produits-de-']},
  {id:'cat-b-alimentaire-marche-local', icon:'🛒', label:'Alimentaire & Marché Local', ids:['cat-b-alimentaire-marche-local', 'epicerie', 'fruits-legumes', 'boucherie-poissonnerie', 'boulangerie', 'patisserie', 'boissons-sans-alcool-p-jus', 'produits-bio', 'manioc-chikwangue-foufou', 'feuilles-de-manioc-legumes-locaux', 'poisson-sale-fume', 'chenilles-sechees', 'escargots', 'safou', 'bananes-plantain-igname-taro', 'arachides-pate-d-arachide', 'piment-local', 'vin-de-palme', 'miel-local', 'condiments-ou-en-epice-detail']},
  {id:'cat-b-auto-sport-loisirs', icon:'🚗', label:'Auto, Sport & Loisirs', ids:['cat-b-auto-sport-loisirs', 'accessoires-auto', 'pieces-detachees-auto', 'location-voiture', 'voiture-en-vente', 'vente-des-motos', 'vente-des-velos', 'patin-skate', 'articles-de-sport', 'objets-de-peche-camping', 'instrument-de-musique', 'autre-auto-sport-l']},
  {id:'cat-b-tissus-divers', icon:'🧵', label:'Tissus & Divers', ids:['cat-b-tissus-divers', 'tissus-au-metre', 'occasion-d-europe', 'habit-de-travail', 'artisanat-local-monde', 'articles-religieux', 'librairie', 'cahiers', 'tenue-cousue', 'anniversaire-objet-jetable', 'charbon-de-bois', 'bois-de-chauffe', 'petrole-lampant-essence-au-detail']},
  {id:'cat-b-materiaux-de-construction', icon:'🧱', label:'Matériaux de Construction', ids:['cat-b-materiaux-de-construction', 'planche', 'fer', 'carreau', 'marbre', 'peinture', 'ciment', 'brique', 'bidet', 'baignoire', 'tapis', 'contreplaque', 'tole', 'autres-articles-couleur-different-tout-les-autres']},
  {id:'sans-categorie-b2', icon:'📦', label:'Sans catégorie', ids:['sans-categorie-b2', 'autre']},
];

// Tous les ids pouvant exister en base pour un arbre (catégories + anciens ids)
function treeDbIds(tree) {
  const out = new Set();
  (tree || []).forEach(c => (c.ids || [c.id]).forEach(i => out.add(i)));
  return Array.from(out);
}
const TREE_A_IDS  = new Set(treeDbIds(TREE_A));
const TREE_B1_IDS = new Set(treeDbIds(TREE_B1));
const TREE_B2_IDS = new Set(treeDbIds(TREE_B2));

// Catégorie correspondant à un id (nouvel id OU ancien id de sous-catégorie)
function findCategoryEntry(catId, tree) {
  const trees = tree ? [tree] : [TREE_A, TREE_B1, TREE_B2];
  for (const t of trees) {
    const c = t.find(x => x.id === catId) || t.find(x => (x.ids || []).includes(catId));
    if (c) return c;
  }
  return null;
}
// Ids à chercher en base pour une catégorie donnée
function categoryDbIds(catId, tree) {
  const c = findCategoryEntry(catId, tree);
  return c ? c.ids : [catId];
}
// Catégories triées de A à Z ("Sans catégorie" toujours en dernier)
function sortedCategories(tree) {
  return (tree || []).slice().sort((a, b) => {
    const ag = a.id.indexOf('sans-categorie') === 0, bg = b.id.indexOf('sans-categorie') === 0;
    if (ag !== bg) return ag ? 1 : -1;
    return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });
  });
}



const ALL_CATEGORIES = { ...flattenTree(TREE_A), ...flattenTree(TREE_B1), ...flattenTree(TREE_B2), ...CATEGORIES_A, ...CATEGORIES_B };
// Les ids des catégories elles-mêmes gardent toujours leur libellé
[TREE_A, TREE_B1, TREE_B2].forEach(t => t.forEach(c => { ALL_CATEGORIES[c.id] = c.label; }));

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
    if (!res.ok) return { ok: false, account: null, error: 'Erreur serveur. Réessayez.' };
    return await res.json();
  } catch (e) {
    console.error('verifyPin exception:', e);
    // Une exception ici (fetch qui échoue avant même de recevoir une réponse)
    // signifie presque toujours une absence de connexion internet, jamais
    // un mauvais code/PIN — on ne doit pas laisser croire l'inverse.
    return {
      ok: false,
      account: null,
      error: navigator.onLine === false
        ? 'Pas de connexion internet. Vérifiez votre réseau et réessayez.'
        : 'Erreur de connexion. Vérifiez votre réseau et réessayez.'
    };
  }
}

function formatPrice(price) {
  if (!price || isNaN(Number(price))) return '0';
  return Number(price).toLocaleString('fr-FR');
}

// ── Réduction minimale d'une promotion (en %) ───────────────────
// Toute promo du site doit être d'au moins -15% par rapport au prix d'avant.
const PROMO_MIN_DISCOUNT = 15;
// Prix promo maximum autorisé pour un prix d'avant donné (arrondi vers le bas)
function maxPromoPrice(originalPrice) {
  return Math.floor(Number(originalPrice) * (100 - PROMO_MIN_DISCOUNT) / 100);
}

// ── Prix négociable ─────────────────────────────────────────────
// Convention : un produit dont le prix est 0 (ou vide) est "Prix négociable".
// priceLabel() renvoie le texte à afficher à la place de "X FCFA".
function isPriceNegotiable(price) {
  return !(Number(price) > 0);
}
function priceLabel(price) {
  return isPriceNegotiable(price) ? 'Prix négociable' : formatPrice(price) + ' FCFA';
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
    await callAdminAction('log_event', {
      action,
      target_table: targetTable,
      target_id:    targetId,
      details,
      old_value:    oldValue  ? oldValue  : null,
      new_value:    newValue  ? newValue  : null
    });
  } catch (e) {
    console.error('logAdminAction error:', e);
  }
}