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
  list.forEach(s => out[s.id] = s.label);
  return out;
}

// ================================================================
// ARBRE "IMPORTATEUR & GROSSISTE" (Liste A)
// Chaque catégorie porte un champ "section" (regroupement affiché dans
// la sidebar de filtres). Généré à partir de la liste fournie le 29/08/2026.
// ================================================================
const TREE_A = [
  {id:'riz-farine', label:'Riz & Farine', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'farine-de-mais', label:'Farine de Mais', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'mais-en-gros', label:'Maïs en Gros', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'spaghetti', label:'Spaghetti', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'sucre-lait', label:'Sucre & Lait', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'huile-d-arachide', label:'Huile d\'Arachide', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'huile-d-olive', label:'Huile d\'Olive', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'huile-de-palme', label:'Huile de Palme', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'epices-condiments-en-gros', label:'Épices & Condiments en Gros', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'oufs-en-carton', label:'Oufs en Carton', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'sel', label:'Sel', section:'🥫 ALIMENTAIRE DE BASE'},
  {id:'produits-congeles', label:'Produits Congelés', section:'🥶  CONGELÉS + so'},
  {id:'bisi-ya-mayi-en-gros', label:'Bisi ya mayi en Gros', section:'🥶  CONGELÉS + so'},
  {id:'makayabo-poisson-sale-en-gros', label:'Makayabo / Poisson Salé en Gros', section:'🥶  CONGELÉS + so'},
  {id:'mokalou-poisson-fume-en-gros', label:'Mokalou / Poisson Fumé en Gros', section:'🥶  CONGELÉS + so'},
  {id:'poisson-de-mer-en-gros', label:'Poisson de Mer en Gros', section:'🥶  CONGELÉS + so'},
  {id:'niama-zamba-en-gros', label:'Niama zamba en Gros', section:'🥶  CONGELÉS + so'},
  {id:'fruits-en-gros', label:'Fruits en Gros', section:'🥶  CONGELÉS + so'},
  {id:'miel', label:'Miel', section:'🥶  CONGELÉS + so'},
  {id:'boissons-sans-alcool-en-gros', label:'Boissons sans Alcool en Gros', section:'🥤 BOISSONS'},
  {id:'vins-boissons-alcoolisees-en-gros', label:'Vins & Boissons Alcoolisées en Gros', section:'🥤 BOISSONS'},
  {id:'sachets-d-eau-minerale-en-gros', label:'Sachets d\'Eau Minérale en Gros', section:'🥤 BOISSONS'},
  {id:'ballot-de-friperie', label:'Ballot de Friperie', section:'👗 TEXTILE & MODE GROS'},
  {id:'ballot-de-tissus-pagnes', label:'Ballot de Tissus & Pagnes', section:'👗 TEXTILE & MODE GROS'},
  {id:'vetements-en-gros', label:'Vetements en Gros', section:'👗 TEXTILE & MODE GROS'},
  {id:'chaussures-en-carton', label:'Chaussures en Carton', section:'👗 TEXTILE & MODE GROS'},
  {id:'accessoires-mode-en-gros', label:'Accessoires Mode en Gros', section:'👗 TEXTILE & MODE GROS'},
  {id:'ciment-fer-carrelage-en-gros', label:'Ciment, Fer, Carrelage en Gros', section:'🏠 MAISON, BTP & ÉNERGIE'},
  {id:'quincaillerie-en-gros', label:'Quincaillerie en Gros', section:'🏠 MAISON, BTP & ÉNERGIE'},
  {id:'peinture', label:'Peinture', section:'🏠 MAISON, BTP & ÉNERGIE'},
  {id:'bois-en-gros', label:'Bois en Gros', section:'🏠 MAISON, BTP & ÉNERGIE'},
  {id:'charbon-de-bois-en-gros', label:'Charbon de Bois en Gros', section:'🏠 MAISON, BTP & ÉNERGIE'},
  {id:'gaz-combustible-en-gros', label:'Gaz & Combustible en Gros', section:'🏠 MAISON, BTP & ÉNERGIE'},
  {id:'energie-solaire-en-gros', label:'Énergie Solaire en Gros', section:'🏠 MAISON, BTP & ÉNERGIE'},
  {id:'produits-d-entretien-pro', label:'Produits d\'Entretien Pro', section:'🏠 MAISON, BTP & ÉNERGIE'},
  {id:'emballage-en-gros', label:'Emballage en Gros', section:'🏠 MAISON, BTP & ÉNERGIE'},
  {id:'autre', label:'Autre', section:'🏠 MAISON, BTP & ÉNERGIE'},
  {id:'telephone-en-gros', label:'Téléphone en Gros', section:'📱 TECH, AUTO & INDUSTRIE'},
  {id:'electromenager-en-gros', label:'Électroménager en Gros', section:'📱 TECH, AUTO & INDUSTRIE'},
  {id:'materiel-informatique-en-gros', label:'Matériel Informatique en Gros', section:'📱 TECH, AUTO & INDUSTRIE'},
  {id:'pneus-automobile-pieces-detachees-en-gros', label:'Pneus, Automobile & Pièces Détachées en Gros', section:'📱 TECH, AUTO & INDUSTRIE'},
  {id:'essence-gasoil-en-fut', label:'Essence & Gasoil en Fut', section:'📱 TECH, AUTO & INDUSTRIE'},
  {id:'autre-tech-auto-in', label:'Autre', section:'📱 TECH, AUTO & INDUSTRIE'},
  {id:'couches-produits-bebe-en-gros', label:'Couches & Produits Bébé en Gros', section:'👶 BÉBÉ, FETE & DIVERS'},
  {id:'papeterie-fournitures-scolaires-en-gros', label:'Papeterie & Fournitures Scolaires en Gros', section:'👶 BÉBÉ, FETE & DIVERS'},
  {id:'jouets-articles-de-fete-en-gros', label:'Jouets & Articles de Fete en Gros', section:'👶 BÉBÉ, FETE & DIVERS'},
  {id:'objets-celebration-en-gros', label:'Objets Célébration en Gros', section:'👶 BÉBÉ, FETE & DIVERS'},
  {id:'autre-bebe-fete-di', label:'Autre', section:'👶 BÉBÉ, FETE & DIVERS'},
  {id:'produits-agricoles-en-gros', label:'Produits Agricoles en Gros', section:'🌾 AGRICULTURE, PECHE & LOISIRS'},
  {id:'materiaux-et-produits-de-peche-en-gros', label:'Matériaux et Produits de Peche en Gros', section:'🌾 AGRICULTURE, PECHE & LOISIRS'},
  {id:'materiaux-de-chasse-en-gros', label:'Matériaux de Chasse en Gros', section:'🌾 AGRICULTURE, PECHE & LOISIRS'},
  {id:'materiaux-du-sport-en-gros', label:'Matériaux du Sport en Gros', section:'🌾 AGRICULTURE, PECHE & LOISIRS'},
  {id:'materiaux-de-musique-en-gros', label:'Matériaux de Musique en Gros', section:'🌾 AGRICULTURE, PECHE & LOISIRS'},
  {id:'materiaux-du-multimedia-en-gros', label:'Matériaux du Multimédia en Gros', section:'🌾 AGRICULTURE, PECHE & LOISIRS'},
  {id:'autre-agriculture-', label:'Autre', section:'🌾 AGRICULTURE, PECHE & LOISIRS'},
];
const TREE_A_IDS = new Set(TREE_A.map(c => c.id));


// ================================================================
// ARBRE "MULTI SERVICE & COMMERCE" (Liste B.1)
// ================================================================
const TREE_B1 = [
  {id:'plombier', label:'Plombier', section:'🏠 MAISON & BTP'},
  {id:'electricien', label:'Électricien', section:'🏠 MAISON & BTP'},
  {id:'macon', label:'MaÇon', section:'🏠 MAISON & BTP'},
  {id:'peintre', label:'Peintre', section:'🏠 MAISON & BTP'},
  {id:'menuisier', label:'Menuisier', section:'🏠 MAISON & BTP'},
  {id:'jardinier-paysagiste', label:'Jardinier / Paysagiste', section:'🏠 MAISON & BTP'},
  {id:'architecture', label:'Architecture', section:'🏠 MAISON & BTP'},
  {id:'climatisation-froid', label:'Climatisation & Froid', section:'🏠 MAISON & BTP'},
  {id:'serrurerie', label:'Serrurerie', section:'🏠 MAISON & BTP'},
  {id:'soudure-ferronnerie', label:'Soudure & Ferronnerie', section:'🏠 MAISON & BTP'},
  {id:'location-de-materiel-de-chantier', label:'Location de Matériel de Chantier', section:'🏠 MAISON & BTP'},
  {id:'chambre-froide', label:'Chambre Froide', section:'🏠 MAISON & BTP'},
  {id:'magasin-de-stockage', label:'Magasin de Stockage', section:'🏠 MAISON & BTP'},
  {id:'autre', label:'Autre', section:'🏠 MAISON & BTP'},
  {id:'garage-auto-mecanique', label:'Garage Auto & Mécanique', section:'🚗 AUTO & TRANSPORT'},
  {id:'depannage-auto-a-domicile', label:'Dépannage Auto à Domicile', section:'🚗 AUTO & TRANSPORT'},
  {id:'lavage-parking-auto', label:'Lavage & Parking Auto', section:'🚗 AUTO & TRANSPORT'},
  {id:'vulcanisation', label:'Vulcanisation', section:'🚗 AUTO & TRANSPORT'},
  {id:'taulier-carrossier', label:'Taulier & Carrossier', section:'🚗 AUTO & TRANSPORT'},
  {id:'auto-ecole', label:'Auto-École', section:'🚗 AUTO & TRANSPORT'},
  {id:'transport-local-moto-taxi-bus', label:'Transport local : Moto, Taxi, Bus', section:'🚗 AUTO & TRANSPORT'},
  {id:'location-de-camion-transport', label:'Location de Camion & Transport', section:'🚗 AUTO & TRANSPORT'},
  {id:'voyage-en-bateau', label:'Voyage en Bateau', section:'🚗 AUTO & TRANSPORT'},
  {id:'voyage-en-baleiniere', label:'Voyage en Baleinière', section:'🚗 AUTO & TRANSPORT'},
  {id:'voyage-en-camion', label:'Voyage en Camion', section:'🚗 AUTO & TRANSPORT'},
  {id:'agence-de-voyage', label:'Agence de Voyage', section:'🚗 AUTO & TRANSPORT'},
  {id:'guide-touristique', label:'Guide Touristique', section:'🚗 AUTO & TRANSPORT'},
  {id:'autre-auto-transpo', label:'Autre', section:'🚗 AUTO & TRANSPORT'},
  {id:'hopital-clinique', label:'Hopital & Clinique', section:'🏥 SANTÉ & SOCIAL'},
  {id:'laboratoire-d-analyse', label:'Laboratoire d\'Analyse', section:'🏥 SANTÉ & SOCIAL'},
  {id:'pharmacie', label:'Pharmacie', section:'🏥 SANTÉ & SOCIAL'},
  {id:'cabinet-dentaire', label:'Cabinet Dentaire', section:'🏥 SANTÉ & SOCIAL'},
  {id:'opticien', label:'Opticien', section:'🏥 SANTÉ & SOCIAL'},
  {id:'nounou-garde-d-enfant', label:'Nounou & Garde d\'Enfant', section:'🏥 SANTÉ & SOCIAL'},
  {id:'garderie', label:'Garderie', section:'🏥 SANTÉ & SOCIAL'},
  {id:'aide-a-domicile', label:'Aide à Domicile', section:'🏥 SANTÉ & SOCIAL'},
  {id:'service-de-menage', label:'Service de Ménage', section:'🏥 SANTÉ & SOCIAL'},
  {id:'blanchisserie-pressing', label:'Blanchisserie & Pressing', section:'🏥 SANTÉ & SOCIAL'},
  {id:'pompes-funebres', label:'Pompes Funèbres', section:'🏥 SANTÉ & SOCIAL'},
  {id:'autre-sante-social', label:'Autre', section:'🏥 SANTÉ & SOCIAL'},
  {id:'salon-de-coiffure', label:'Salon de Coiffure', section:'💄 BEAUTÉ & MODE'},
  {id:'institut-de-beaute', label:'Institut de Beauté', section:'💄 BEAUTÉ & MODE'},
  {id:'coach-sportif-fitness', label:'Coach Sportif & Fitness', section:'💄 BEAUTÉ & MODE'},
  {id:'couture-styliste', label:'Couture & Styliste', section:'💄 BEAUTÉ & MODE'},
  {id:'broderie-personnalisation', label:'Broderie & Personnalisation', section:'💄 BEAUTÉ & MODE'},
  {id:'reparation-chaussure', label:'Réparation Chaussure', section:'💄 BEAUTÉ & MODE'},
  {id:'bijouterie', label:'Bijouterie', section:'💄 BEAUTÉ & MODE'},
  {id:'horlogerie', label:'Horlogerie', section:'💄 BEAUTÉ & MODE'},
  {id:'autre-beaute-mode', label:'Autre', section:'💄 BEAUTÉ & MODE'},
  {id:'salle-de-fete', label:'Salle de Fete', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'decoration-mariage', label:'Décoration Mariage', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'dj-sonorisation', label:'DJ & Sonorisation', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'photographe-videaste', label:'Photographe & Vidéaste', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'location-chaise-tente-autres', label:'Location Chaise, Tente & Autres', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'traiteur', label:'Traiteur', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'patisserie', label:'Patisserie', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'restaurant', label:'Restaurant', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'hotel', label:'Hotel', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'jardin-lieu-touristique', label:'Jardin & Lieu Touristique', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'autre-evenementiel', label:'Autre', section:'🎉 ÉVÉNEMENTIEL & LOISIRS'},
  {id:'developpement-web-app', label:'Développement Web & App', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'marketing-digital', label:'Marketing Digital', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'service-comptabilite', label:'Service Comptabilité', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'imprimerie', label:'Imprimerie', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'cyber-photocopie', label:'Cyber & Photocopie', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'centre-de-formation', label:'Centre de Formation', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'cours-de-soutien-a-domicile-repetiteur', label:'Cours de Soutien à domicile & Répétiteur', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'reparation-telephone-tablette', label:'Réparation Téléphone & Tablette', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'reparation-ordinateur', label:'Réparation Ordinateur', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'reparation-television-electromenager', label:'Réparation Télévision & Électroménager', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'recharge-telephonique-forfaits', label:'Recharge Téléphonique & Forfaits', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'autre-services-aux', label:'Autre', section:'💼 SERVICES AUX ENTREPRISES & TECH'},
  {id:'agence-immobiliere', label:'Agence Immobilière', section:'🛒 COMMERCE & AUTRES SERVICES'},
  {id:'location-bureau-boutique', label:'Location Bureau & Boutique', section:'🛒 COMMERCE & AUTRES SERVICES'},
  {id:'vente-terrain-maison', label:'Vente Terrain / Maison', section:'🛒 COMMERCE & AUTRES SERVICES'},
  {id:'vente-de-gaz', label:'Vente de Gaz', section:'🛒 COMMERCE & AUTRES SERVICES'},
  {id:'vente-de-meubles', label:'Vente de Meubles', section:'🛒 COMMERCE & AUTRES SERVICES'},
  {id:'elevage-volaille-porcs-chevres', label:'Élevage : Volaille, Porcs, Chèvres', section:'🛒 COMMERCE & AUTRES SERVICES'},
  {id:'service-de-peche', label:'Service de Peche', section:'🛒 COMMERCE & AUTRES SERVICES'},
  {id:'gardiennage-securite', label:'Gardiennage & Sécurité', section:'🛒 COMMERCE & AUTRES SERVICES'},
  {id:'service-de-demenagement', label:'Service de Déménagement', section:'🛒 COMMERCE & AUTRES SERVICES'},
  {id:'autre-commerce-aut', label:'Autre', section:'🛒 COMMERCE & AUTRES SERVICES'},
];
const TREE_B1_IDS = new Set(TREE_B1.map(c => c.id));

// ================================================================
// ARBRE "BOUTIQUE & VENDEUR" (Liste B.2)
// ================================================================
const TREE_B2 = [
  {id:'robe', label:'Robe', section:'👗 MODE FEMME'},
  {id:'robe-de-soiree', label:'Robe de Soirée', section:'👗 MODE FEMME'},
  {id:'jupe', label:'Jupe', section:'👗 MODE FEMME'},
  {id:'pantalon-femme', label:'Pantalon Femme', section:'👗 MODE FEMME'},
  {id:'costume-femme', label:'Costume Femme', section:'👗 MODE FEMME'},
  {id:'lingerie-femme', label:'Lingerie Femme', section:'👗 MODE FEMME'},
  {id:'basin-femme', label:'Basin Femme', section:'👗 MODE FEMME'},
  {id:'pret-a-porter', label:'Pret à Porter', section:'👗 MODE FEMME'},
  {id:'super-wax', label:'Super Wax', section:'👗 MODE FEMME'},
  {id:'lipouta-tenues-traditionnelles', label:'Lipouta & Tenues Traditionnelles', section:'👗 MODE FEMME'},
  {id:'lacoste-femme', label:'Lacoste Femme', section:'👗 MODE FEMME'},
  {id:'sous-vetements', label:'Sous-Vetements', section:'👗 MODE FEMME'},
  {id:'maillot-de-bain', label:'Maillot de Bain', section:'👗 MODE FEMME'},
  {id:'autre', label:'Autre', section:'👗 MODE FEMME'},
  {id:'chemise', label:'Chemise', section:'👔 MODE HOMME'},
  {id:'polo', label:'Polo', section:'👔 MODE HOMME'},
  {id:'lacoste-homme', label:'Lacoste Homme', section:'👔 MODE HOMME'},
  {id:'djine', label:'Djine', section:'👔 MODE HOMME'},
  {id:'pantalon-jogging', label:'Pantalon Jogging', section:'👔 MODE HOMME'},
  {id:'pantalon-tissu', label:'Pantalon Tissu', section:'👔 MODE HOMME'},
  {id:'costume-homme', label:'Costume Homme', section:'👔 MODE HOMME'},
  {id:'chaussures-de-luxe', label:'Chaussures de Luxe', section:'👔 MODE HOMME'},
  {id:'la-sape-mode-ambianceur', label:'La Sape (Mode Ambianceur)', section:'👔 MODE HOMME'},
  {id:'vareuse', label:'Vareuse', section:'👔 MODE HOMME'},
  {id:'basin-homme', label:'Basin Homme', section:'👔 MODE HOMME'},
  {id:'short', label:'Short', section:'👔 MODE HOMME'},
  {id:'maillot-de-bain-mode-homme', label:'Maillot de Bain', section:'👔 MODE HOMME'},
  {id:'autre-mode-homme', label:'Autre', section:'👔 MODE HOMME'},
  {id:'vetements-bebe', label:'Vetements Bébé', section:'👶 ENFANT & BÉBÉ'},
  {id:'vetements-garcon', label:'Vetements GarÇon', section:'👶 ENFANT & BÉBÉ'},
  {id:'vetements-fille', label:'Vetements Fille', section:'👶 ENFANT & BÉBÉ'},
  {id:'chaussures-enfant', label:'Chaussures Enfant', section:'👶 ENFANT & BÉBÉ'},
  {id:'jouets', label:'Jouets', section:'👶 ENFANT & BÉBÉ'},
  {id:'autre-enfant-bebe', label:'Autre', section:'👶 ENFANT & BÉBÉ'},
  {id:'chaussures-homme', label:'Chaussures Homme', section:'👟 CHAUSSURES'},
  {id:'talons', label:'Talons', section:'👟 CHAUSSURES'},
  {id:'chaussures-enfants', label:'Chaussures Enfants', section:'👟 CHAUSSURES'},
  {id:'basket', label:'Basket', section:'👟 CHAUSSURES'},
  {id:'securite', label:'Sécurité', section:'👟 CHAUSSURES'},
  {id:'sandales-homme', label:'Sandales Homme', section:'👟 CHAUSSURES'},
  {id:'sandales-femme', label:'Sandales Femme', section:'👟 CHAUSSURES'},
  {id:'bottes', label:'Bottes', section:'👟 CHAUSSURES'},
  {id:'autre-chaussures', label:'Autre', section:'👟 CHAUSSURES'},
  {id:'sacs-a-main', label:'Sacs à Main', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'sacs-de-voyage', label:'Sacs de Voyage', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'sacs-de-sortie', label:'Sacs de Sortie', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'ceinture', label:'Ceinture', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'cravate', label:'Cravate', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'chapeau', label:'Chapeau', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'montre', label:'Montre', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'chainette', label:'Chainette', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'montre-intelligent', label:'Montre Intelligent', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'bijoux', label:'Bijoux', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'perles', label:'Perles', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'bijoux-traditionnels', label:'Bijoux Traditionnels', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'foulard', label:'Foulard', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'chaussettes', label:'Chaussettes', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'sous-vetements-accessoires-', label:'Sous-vetements', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'autre-accessoires-', label:'Autre', section:'👜👔 ACCESSOIRES & BIJOUX'},
  {id:'beaute-cosmetiques', label:'Beauté & Cosmétiques', section:'💄 BEAUTÉ & BIEN-ETRE'},
  {id:'parfums-de-luxe', label:'Parfums de Luxe', section:'💄 BEAUTÉ & BIEN-ETRE'},
  {id:'savon-artisanal', label:'Savon Artisanal', section:'💄 BEAUTÉ & BIEN-ETRE'},
  {id:'produits-eclaircissants', label:'Produits Éclaircissants', section:'💄 BEAUTÉ & BIEN-ETRE'},
  {id:'perruques-meches', label:'Perruques & Mèches', section:'💄 BEAUTÉ & BIEN-ETRE'},
  {id:'produit-capillaire', label:'Produit Capillaire', section:'💄 BEAUTÉ & BIEN-ETRE'},
  {id:'produit-de-bain', label:'Produit de Bain', section:'💄 BEAUTÉ & BIEN-ETRE'},
  {id:'sante-bien-etre-femme', label:'Santé & Bien-etre Femme', section:'💄 BEAUTÉ & BIEN-ETRE'},
  {id:'autres', label:'Autres', section:'💄 BEAUTÉ & BIEN-ETRE'},
  {id:'telephone', label:'Téléphone', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'ordinateur', label:'Ordinateur', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'tablette', label:'Tablette', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'television', label:'Télévision', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'casque-ecouteurs', label:'Casque & Écouteurs', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'chargeur', label:'Chargeur', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'etui-telephone', label:'Étui Téléphone', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'console-jeux-video', label:'Console & Jeux Vidéo', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'drones-camera', label:'Drones & Caméra', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'electronique', label:'Électronique', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'pieces-accessoires', label:'Pièces & Accessoires', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'composants-electroniques', label:'Composants Électroniques', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'panneaux-solaires-kits-detail', label:'Panneaux Solaires & Kits (Détail)', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'cartes-sim', label:'Cartes SIM', section:'📱 TECH & ÉLECTRONIQUE'},
  {id:'meubles', label:'Meubles', section:'🏠 PRODUITS DE DÉCORATION'},
  {id:'electromenager', label:'Électroménager', section:'🏠 PRODUITS DE DÉCORATION'},
  {id:'cuisine-vaisselle', label:'Cuisine & Vaisselle', section:'🏠 PRODUITS DE DÉCORATION'},
  {id:'literie', label:'Literie', section:'🏠 PRODUITS DE DÉCORATION'},
  {id:'decoration-maison', label:'Décoration Maison', section:'🏠 PRODUITS DE DÉCORATION'},
  {id:'rideau-tapis', label:'Rideau & Tapis', section:'🏠 PRODUITS DE DÉCORATION'},
  {id:'plastique-menager', label:'Plastique Ménager', section:'🏠 PRODUITS DE DÉCORATION'},
  {id:'eponge', label:'Éponge', section:'🏠 PRODUITS DE DÉCORATION'},
  {id:'autre-produits-de-', label:'Autre', section:'🏠 PRODUITS DE DÉCORATION'},
  {id:'epicerie', label:'Épicerie', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'fruits-legumes', label:'Fruits & Légumes', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'boucherie-poissonnerie', label:'Boucherie & Poissonnerie', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'boulangerie', label:'Boulangerie', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'patisserie', label:'Patisserie', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'boissons-sans-alcool-p-jus', label:'Boissons sans alcool p& Jus', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'produits-bio', label:'Produits Bio', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'manioc-chikwangue-foufou', label:'Manioc, Chikwangue & Foufou', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'feuilles-de-manioc-legumes-locaux', label:'Feuilles de Manioc & Légumes Locaux', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'poisson-sale-fume', label:'Poisson Salé & Fumé', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'chenilles-sechees', label:'Chenilles Séchées', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'escargots', label:'Escargots', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'safou', label:'Safou', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'bananes-plantain-igname-taro', label:'Bananes Plantain, Igname & Taro', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'arachides-pate-d-arachide', label:'Arachides & Pate d\'Arachide', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'piment-local', label:'Piment Local', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'vin-de-palme', label:'Vin de Palme', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'miel-local', label:'Miel Local', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'condiments-ou-en-epice-detail', label:'Condiments ou en epice Détail', section:'🛒 ALIMENTAIRE & MARCHÉ LOCAL'},
  {id:'accessoires-auto', label:'Accessoires Auto', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'pieces-detachees-auto', label:'Pièces Détachées Auto', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'location-voiture', label:'Location Voiture', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'voiture-en-vente', label:'Voiture en Vente', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'vente-des-motos', label:'Vente des Motos', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'vente-des-velos', label:'Vente des Vélos', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'patin-skate', label:'Patin & Skate', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'articles-de-sport', label:'Articles de Sport', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'objets-de-peche-camping', label:'Objets de Peche & Camping', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'instrument-de-musique', label:'Instrument de Musique', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'autre-auto-sport-l', label:'Autre', section:'🚗 AUTO, SPORT & LOISIRS'},
  {id:'tissus-au-metre', label:'Tissus au Mètre', section:'🧵 TISSUS & DIVERS'},
  {id:'occasion-d-europe', label:'Occasion d\'Europe', section:'🧵 TISSUS & DIVERS'},
  {id:'habit-de-travail', label:'Habit de Travail', section:'🧵 TISSUS & DIVERS'},
  {id:'artisanat-local-monde', label:'Artisanat Local & Monde', section:'🧵 TISSUS & DIVERS'},
  {id:'articles-religieux', label:'Articles Religieux', section:'🧵 TISSUS & DIVERS'},
  {id:'librairie', label:'Librairie', section:'🧵 TISSUS & DIVERS'},
  {id:'cahiers', label:'Cahiers', section:'🧵 TISSUS & DIVERS'},
  {id:'tenue-cousue', label:'Tenue Cousue', section:'🧵 TISSUS & DIVERS'},
  {id:'anniversaire-objet-jetable', label:'Anniversaire & Objet Jetable', section:'🧵 TISSUS & DIVERS'},
  {id:'charbon-de-bois', label:'Charbon de Bois', section:'🧵 TISSUS & DIVERS'},
  {id:'bois-de-chauffe', label:'Bois de Chauffe', section:'🧵 TISSUS & DIVERS'},
  {id:'petrole-lampant-essence-au-detail', label:'Pétrole Lampant & Essence au Détail', section:'🧵 TISSUS & DIVERS'},
  {id:'planche', label:'Planche', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'fer', label:'Fer', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'carreau', label:'Carreau', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'marbre', label:'Marbre', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'peinture', label:'Peinture', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'ciment', label:'Ciment', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'brique', label:'Brique', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'bidet', label:'Bidet', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'baignoire', label:'Baignoire', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'tapis', label:'Tapis', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'contreplaque', label:'Contreplaqué', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'tole', label:'Tole', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
  {id:'autres-articles-couleur-different-tout-les-autres', label:'Autres articles (couleur différent  tout les Autres)', section:'🧱 MATÉRIAUX DE CONSTRUCTION'},
];
const TREE_B2_IDS = new Set(TREE_B2.map(c => c.id));


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