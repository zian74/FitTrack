/* ============================================================
 * FitTrack — moteur applicatif (vanilla JS, offline-first)
 * Stockage : localStorage
 * ============================================================ */

// ---------- Utilitaires ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('ft_' + k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem('ft_' + k, JSON.stringify(v)); }
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ---------- Thème (mode sombre) ----------
// 3 états : 'system' (suit prefers-color-scheme), 'light', 'dark'.
// Persisté dans localStorage (ft_theme). Appliqué sur <html> (classe .dark)
// + meta theme-color mise à jour pour la barre d'adresse mobile.
const THEME_KEY = 'theme';
const THEME_META_LIGHT = '#1F4E79';
const THEME_META_DARK = '#12181f';
function getTheme() { return store.get(THEME_KEY, 'system'); }
function isDarkTheme() {
  const t = getTheme();
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
}
function applyTheme() {
  const dark = isDarkTheme();
  document.documentElement.classList.toggle('dark', dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? THEME_META_DARK : THEME_META_LIGHT);
}
function setTheme(mode) {
  store.set(THEME_KEY, mode);
  applyTheme();
}
// Changement de préférence système (mode « system » uniquement)
if (window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    if (getTheme() === 'system') applyTheme();
  });
}
applyTheme(); // appliqué avant le 1er rendu (évite le flash de thème clair)

// ---------- Définition des tests ----------
// type : lower-is-better si rev : true (plus bas = mieux)
const TESTS = [
  { id: 'fc', name: 'FC de repos (bpm)', unit: 'bpm', group: 'rest', rev: true,
    hint: 'Pouls 60 s au réveil, avant de se lever', good: 60, mid: 70,
    max: 120, min: 25 },
  { id: 'pa_sys', name: 'PA systolique (mmHg)', unit: 'mmHg', group: 'rest', rev: true,
    hint: 'Bras au repos, 2 mesures', good: 120, mid: 130, max: 250, min: 60 },
  { id: 'pa_dia', name: 'PA diastolique (mmHg)', unit: 'mmHg', group: 'rest', rev: true,
    hint: '', good: 80, mid: 85, max: 150, min: 40 },
  { id: 'waist', name: 'Tour de taille (cm)', unit: 'cm', group: 'rest', rev: true,
    hint: 'Mètre au nombril, sans rentrer le ventre', good: 94, mid: 102, max: 200, min: 40,
    gender: { H: { good: 94, mid: 102 }, F: { good: 80, mid: 88 } } },
  { id: 'weight', name: 'Poids (kg)', unit: 'kg', group: 'rest', rev: null,
    hint: 'Le matin à jeun', max: 300, min: 25 },
  { id: 'balance_open', name: 'Équilibre unipodal yeux ouverts (s)', unit: 's', group: 'rest',
    hint: 'Sur un pied jusqu\u2019à échec (2 essais/pied)', good: 40, mid: 20, max: 300, min: 0,
    info: `<ul>
      <li>Debout, mains sur les hanches, pieds joints.</li>
      <li>Décollez un pied du sol (talon contre la cheville de l'autre jambe) et tenez en équilibre.</li>
      <li>Regardez droit devant vous ; le pied levé ne doit pas toucher le sol.</li>
      <li><b>2 essais par pied</b> : faites les deux côtés, on retient le <b>meilleur temps</b>.</li>
      <li>Arrêtez dès que vous perdez l'équilibre (pied au sol ou appui des mains).</li>
      <li>Prévoyez un appui à proximité en cas de déséquilibre.</li>
    </ul>` },
  { id: 'balance_closed', name: 'Équilibre yeux fermés (s)', unit: 's', group: 'rest',
    hint: '', good: 10, mid: 5, max: 120, min: 0,
    info: `<ul>
      <li>Même position que le test yeux ouverts : debout, mains sur les hanches, un pied décollé.</li>
      <li><b>Fermez les yeux</b> et tenez le plus longtemps possible sans les rouvrir.</li>
      <li><b>2 essais</b> : on retient le <b>meilleur temps</b>.</li>
      <li>Ce test est nettement plus difficile : restez à proximité d'un mur ou d'une chaise et arrêtez au moindre déséquilibre pour éviter la chute.</li>
      <li>Ne rouvrez les yeux qu'après avoir posé le pied au sol.</li>
    </ul>` },
  { id: 'reach', name: 'Sit-and-reach (cm atteints)', unit: 'cm', group: 'rest',
    hint: '0 = orteils, négatif = avant, positif = au-delà',
    good: 0, mid: -10, max: 40, min: -40,
    info: `<ul>
      <li>Assis au sol, <b>jambes tendues</b>, pieds à plat contre un repère vertical (mur ou boîte).</li>
      <li>Avancez les deux mains le long d'une règle posée au sol, <b>sans plier les genoux</b>, jusqu'au maximum confortable.</li>
      <li>Maintenez la position 2 secondes.</li>
      <li><b>2 essais</b> : on retient la <b>meilleure distance</b>.</li>
      <li>Cotation : <b>0</b> = bout des orteils, <b>négatif</b> = orteils non atteints, <b>positif</b> = au-delà des orteils.</li>
      <li>Échauffez le dos (flexions douces) avant de commencer.</li>
    </ul>` },
  { id: 'grip', name: 'Poigne — meilleure main (kg)', unit: 'kg', group: 'strength',
    hint: '2–3 essais par main, 30 s de repos entre essais',
    good: 45, mid: 35, max: 100, min: 5,
    gender: { H: { good: 45, mid: 35 }, F: { good: 30, mid: 20 } } },
  { id: 'pushups', name: 'Pompes maximales', unit: 'rép.', group: 'strength',
    hint: 'Sans pause, technique correcte',
    good: 35, mid: 20, max: 200, min: 0,
    gender: { H: { good: 35, mid: 20 }, F: { good: 20, mid: 10 } },
    info: `<ul>
      <li>Position de départ : <b>planche haute</b>, mains à plat au sol à la largeur des épaules, bras tendus, corps bien aligné (tête, hanches, talons).</li>
      <li><b>Descendez</b> en pliant les coudes jusqu'à ce que la poitrine frôle presque le sol, coudes près du corps (pas écartés à 90°).</li>
      <li><b>Remontez</b> en poussant dans les mains, bras tendus en haut. Ne verrouillez pas les coudes.</li>
      <li>Gardez le <b>dos plat</b> et les <b>fessiers serrés</b> : ne creusez pas les lombaires, ne cambrez pas.</li>
      <li>Enchaînez <b>sans pause</b> jusqu'à échec musculaire (dernière répétition propre). Comptez uniquement les répétitions <b>techniquement correctes</b>.</li>
      <li>Échauffez les épaules et les poignets 2–3 min avant. Variante si besoin : pompes sur les genoux ou mains surélevé (comptoir).</li>
      <li>Respirez : inspirez en descendant, expirez en montant.</li>
    </ul>` },
  { id: 'plank', name: 'Gainage planche (s)', unit: 's', group: 'strength',
    hint: 'Dos plat, tenue maximale', good: 120, mid: 60, max: 600, min: 0,
    info: `<ul>
      <li>Position : <b>appui sur les avant-bras</b> (coudes sous les épaules), pointes de pieds au sol, corps aligné de la tête aux talons.</li>
      <li>Contractez les <b>abdominaux</b> (rentrez l'ombilic vers la colonne) et serrez les <b>fessiers</b> : le dos doit rester <b>plat</b>, ni creusé ni cambré.</li>
      <li>Regardez le sol devant vous, nuque neutre (ne levez pas la tête).</li>
      <li>Tenez <b>le plus longtemps possible</b> en gardant la position correcte. Le chronomètre ⏱ à côté du champ vous assiste.</li>
      <li>Arrêtez dès que la forme se dégrade (hanches qui tombent ou remontent) : notez le temps jusqu'à ce moment-là.</li>
      <li>Respirez normalement, ne retenez pas votre souffle. Variante : genoux au sol si besoin.</li>
      <li>Échauffez le core 2–3 min avant (gainage ventral léger, mobilité du bassin).</li>
    </ul>` },
  { id: 'chair', name: 'Chaise 30 s (répétitions)', unit: 'rép.', group: 'strength',
    hint: 'Bras croisés, se lever/asseoir pendant 30 s', good: 17, mid: 12, max: 40, min: 0,
    gender: { H: { good: 17, mid: 12 }, F: { good: 16, mid: 11 } },
    info: `<ul>
      <li>Adossé(e) à un mur, <b>pieds écartés de la largeur des hanches</b>, à environ 50 cm du mur.</li>
      <li>Glissez le dos le long du mur jusqu'à ce que les <b>cuisses soient parallèles au sol</b> (angle 90° aux genoux), <b>bras croisés sur la poitrine</b>.</li>
      <li>Le bouton <b>⏳</b> à côté du champ ouvre un <b>compte à rebours de 30 s</b> : pendant ce temps, <b>levez-vous et rasseyez-vous</b> complètement, bras toujours croisés.</li>
      <li>Comptez vos répétitions complètes (descente + remontée = 1) et reportez le total dans le champ.</li>
      <li>Respirez normalement ; arrêtez si vous ressentez une douleur au genou ou au dos.</li>
    </ul>` },
  { id: 'stair_pulse', name: 'Test escalier — pouls à 1 min', unit: 'bpm', group: 'cardio', rev: true,
    hint: '3 min de montées (24/min), pouls 1 min après', good: 100, mid: 110, max: 200, min: 50,
    info: `<ul>
      <li>Échauffez-vous 5 min (marche sur place, montées lentes) avant de commencer.</li>
      <li>Montez et descendez un escalier à allure régulière : <b>24 montées par minute</b> (comptez-vous ou suivez un métronome à 96 bpm = 24 cycles montée+descente/min).</li>
      <li>Durée totale : <b>3 minutes</b> de montée/descente continue. Le bouton <b>⏳</b> ouvre un <b>compte à rebours de 3 min</b> (durée réglable) pour vous guider.</li>
      <li>Dès la fin, <b>asseyez-vous immédiatement</b> et prenez votre pouls pendant 60 s, <b>1 minute après l'arrêt</b> (comptez 15 s × 4 et multipliez par 4, ou 60 s complet).</li>
      <li>Notez ce pouls à 1 min : c'est votre résultat. Plus il est bas, meilleure est votre récupération cardiaque.</li>
      <li>Arrêtez en cas de douleur thoracique, vertiges ou essoufflement excessif — consultez un médecin avant de recommencer.</li>
      <li>Test sous-maximal : évitez si vous avez des antécédents cardiaques ou un traitement bêtabloquant (voir avertissement dans l'onglet Session).</li>
    </ul>` },
  { id: 'cooper', name: 'Cooper — distance (m, équiv. 12 min)', unit: 'm', group: 'cardio',
    hint: '12 min à allure soutenue, ou 6 min (demi-Cooper)', good: 2400, mid: 2200, max: 5000, min: 200,
    gender: { H: { good: 2400, mid: 2200 }, F: { good: 2000, mid: 1800 } },
    info: `<ul>
      <li><b>Cooper complet (12 min)</b> : couvrez la plus grande distance possible en 12 minutes, à allure soutenue et régulière.</li>
      <li><b>Demi-Cooper (6 min)</b> : même principe sur 6 minutes. La distance saisie est <b>automatiquement doublée (×2)</b> : elle est affichée en équivalent 12 min dans les estimations VMA/VO2max et stockée ×2 pour rester comparable aux repères 12 min.</li>
      <li><b>VMA &amp; VO2max</b> : renseignez au choix la distance, la VMA (km/h) ou la VO2max (ml/kg/min) — les deux autres valeurs sont <b>calculées et affichées</b> en dessous (formules détaillées dans les sources scientifiques, onglet Paramètres).</li>
      <li>Échauffez-vous 5–10 min avant, sur terrain plat et mesuré, chaussures adaptées.</li>
      <li>Test maximal : arrêtez en cas de douleur thoracique, essoufflement excessif ou vertiges.</li>
    </ul>` },
  { id: 'ipaq', name: 'IPAQ court — niveau d’activité', unit: 'MET-min/sem', group: 'activity',
    hint: 'Questionnaire sur les 7 derniers jours (score calculé automatiquement)',
    good: 3000, mid: 600, max: 30000, min: 0 },
  { id: 'sit', name: 'Temps assis (jour de semaine)', unit: 'min', group: 'activity', rev: true,
    hint: 'Question IPAQ n°7 — temps passé assis un jour de semaine habituel',
    good: 240, mid: 480, max: 1440, min: 0 },
  // --- Indicateurs dérivés (non saisis directement) ---
  // VMA et VO2max estimées : calculées depuis la dernière session Cooper/demi-Cooper
  // (champs VMA/VO2max du bloc d'estimation). Utilisées pour les repères du Profil
  // et la dimension « Endurance cardio » de l'analyse (prioritaires sur Cooper).
  { id: 'vma', name: 'VMA estimée (km/h)', unit: 'km/h', group: 'cardio', rev: null,
    hint: 'Calculée automatiquement depuis la dernière session Cooper',
    good: 14, mid: 12, max: 30, min: 4,
    gender: { H: { good: 14, mid: 12 }, F: { good: 12, mid: 10 } },
    info: `<ul>
      <li><b>VMA</b> = Vitesse Maximale Aérobie : la vitesse la plus élevée que vous pouvez tenir en utilisant principalement votre consommation d'oxygène.</li>
      <li>Elle est <b>estimée automatiquement</b> à partir de votre dernière session Cooper ou demi-Cooper : VMA = distance (équiv. 12 min) ÷ 200.</li>
      <li>Vous pouvez aussi la renseigner directement dans le bloc Cooper (onglet Session) — la valeur saisie est alors reprise ici.</li>
      <li>Repères indicatifs (adultes) : VMA ≥ 14 km/h (H) / ≥ 12 km/h (F) = bonne endurance ; 12–13,9 (H) / 10–11,9 (F) = moyenne.</li>
    </ul>` },
  { id: 'vo2max', name: 'VO2max estimée (ml/kg/min)', unit: 'ml/kg/min', group: 'cardio', rev: null,
    hint: 'Calculée automatiquement depuis la dernière session Cooper',
    good: 45, mid: 35, max: 90, min: 10,
    gender: { H: { good: 45, mid: 35 }, F: { good: 38, mid: 30 } },
    info: `<ul>
      <li><b>VO2max</b> = consommation maximale d'oxygène : quantité maximale d'oxygène que votre corps peut utiliser par minute et par kg (ml/kg/min). C'est l'indicateur de référence de la capacité cardio-respiratoire.</li>
      <li>Elle est <b>estimée automatiquement</b> à partir de votre dernière session Cooper/demi-Cooper (VO2max = 3,5 × VMA, ou formule ACSM depuis la distance), ou reprise du champ VO2max saisi dans le bloc Cooper.</li>
      <li>Repères indicatifs (adultes) : ≥ 45 (H) / ≥ 38 (F) ml/kg/min = bonne forme ; 35–44,9 (H) / 30–37,9 (F) = moyenne.</li>
      <li>Une VO2max élevée est associée à une meilleure santé cardiovasculaire et une mortalité réduite (Kodama et al., JAMA 2009).</li>
    </ul>` },
];

// ---------- Dérivées VMA / VO2max depuis les sessions ----------
// À partir de la dernière session cardio contenant cooper (distance déjà normalisée
// équiv. 12 min, demi-Cooper ×2) ou les champs vma/vo2max saisis dans le bloc Cooper.
// Priorité : vma/vo2max saisis directement > dérivation depuis la distance Cooper.
function derivedVMA(lvArg) {
  const lv = lvArg || latestValues();
  if (lv.vma?.value != null) return { value: lv.vma.value, source: 'saisie' };
  if (lv.cooper?.value != null) return { value: cooperVMAFromDist(lv.cooper.value), source: 'cooper' };
  return null;
}
function derivedVO2(lvArg) {
  const lv = lvArg || latestValues();
  if (lv.vo2max?.value != null) return { value: lv.vo2max.value, source: 'saisie' };
  if (lv.vma?.value != null) return { value: vo2FromVMA(lv.vma.value), source: 'saisie-vma' };
  if (lv.cooper?.value != null) return { value: vo2FromCooperDist(lv.cooper.value), source: 'cooper' };
  return null;
}

// ---------- Questionnaire IPAQ court (évaluation de la sédentarité) ----------
// 7 questions sur les 7 derniers jours. Q1/Q3/Q5 : jours + minutes (effort vigorous/modéré/marche).
// Q2/Q4/Q6 : minutes de marche/transports. Q7 : minutes assis (jour de semaine).
const IPAQ_QUESTIONS = [
  { id: 'vig_days', label: 'Q1 — Effort intense (course, vélo rapide, aérobic…) : combien de jours ?', unit: 'jours', min: 0, max: 7 },
  { id: 'vig_min', label: 'Q2 — Un jour type, combien de minutes d’effort intense ?', unit: 'min', min: 0, max: 720 },
  { id: 'mod_days', label: 'Q3 — Effort modéré (vélo tranquille, jardinage, ménage…) : combien de jours ?', unit: 'jours', min: 0, max: 7 },
  { id: 'mod_min', label: 'Q4 — Un jour type, combien de minutes d’effort modéré ?', unit: 'min', min: 0, max: 720 },
  { id: 'walk_days', label: 'Q5 — Marche (au moins 10 min d’affilée : travail, loisirs, déplacements…) : combien de jours ?', unit: 'jours', min: 0, max: 7 },
  { id: 'walk_min', label: 'Q6 — Un jour type, combien de minutes de marche ?', unit: 'min', min: 0, max: 720 },
  { id: 'sit_min', label: 'Q7 — Un jour de semaine habituel, combien de temps passé assis ?', unit: 'min', min: 0, max: 1440 },
];

// Score IPAQ court (protocole de cotation standard, Craig et al. 2003) :
// MET-min/semaine = 8×min intense + 4×min modérée + 3,3×min marche (somme sur les jours)
// Niveau : < 600 = inactif (sédentaire), 600–2999 = modéré, ≥ 3000 = élevé
function ipaqScore(a) {
  const vig = (a.vig_days || 0) * (a.vig_min || 0);
  const mod = (a.mod_days || 0) * (a.mod_min || 0);
  const walk = (a.walk_days || 0) * (a.walk_min || 0);
  return Math.round(8 * vig + 4 * mod + 3.3 * walk);
}

function ipaqLevel(met) {
  if (met >= 3000) return { key: 'high', short: 'Élevé', label: '🟢 Niveau élevé (actif)' };
  if (met >= 600) return { key: 'mid', short: 'Modéré', label: '🟠 Niveau modéré' };
  return { key: 'low', short: 'Faible', label: '🔴 Niveau faible (sédentaire)' };
}

const byId = id => TESTS.find(t => t.id === id);
// Numéro du test dans l'ordre de réalisation (1-based), ex. « 1. FC de repos (bpm) »
const testNum = id => {
  const i = TESTS.findIndex(t => t.id === id);
  return i >= 0 ? `${i + 1}. ` : '';
};
const GROUP_LABELS = { rest: 'Repos & mobilité', strength: 'Force', cardio: 'Cardio', activity: 'Activité & sédentarité' };
// Groups présents par type de session
const SESSION_GROUPS = {
  rest: ['rest'],
  strength: ['strength'],
  cardio: ['cardio'],
  activity: ['activity'],
};

// ---------- Interprétation ----------
function thresholds(t, profile) {
  if (t.gender && profile && profile.sex) {
    const g = t.gender[profile.sex];
    if (g) return { good: g.good, mid: g.mid, rev: t.rev };
  }
  return { good: t.good, mid: t.mid, rev: t.rev };
}

function statusOf(t, value, profile) {
  if (value == null || t.good == null) return null;
  const { good, mid, rev } = thresholds(t, profile);
  if (good == null) return null;
  if (rev) {
    // plus bas = mieux : good = seuil bon, mid = seuil alerte
    if (value <= good) return 'good';
    if (value <= mid) return 'mid';
    return 'low';
  } else {
    // plus haut = mieux
    if (value >= good) return 'good';
    if (value >= mid) return 'mid';
    return 'low';
  }
}

const STATUS_LABEL = { good: '🟢 Bon', mid: '🟠 Moyen', low: '🔴 Faible' };

// ---------- Données ----------
function getProfile() { return store.get('profile', null); }
function getSessions() { return store.get('sessions', []); }
function addSession(session) {
  const s = getSessions();
  if (!session.id) session.id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  s.push(session);
  s.sort((a, b) => a.date < b.date ? -1 : 1);
  store.set('sessions', s);
}

// dernière valeur par test
function latestValues() {
  const out = {};
  for (const s of getSessions()) {
    for (const [k, v] of Object.entries(s.values || {})) {
      if (v != null && v !== '') out[k] = { value: v, date: s.date };
    }
  }
  // Indicateurs dérivés VMA / VO2max : saisis directement (champs Cooper) ou
  // calculés depuis la dernière distance Cooper (déjà normalisée équiv. 12 min).
  // Ils alimentent les repères du Profil et la dimension « Endurance » de l'IFG.
  // Une saisie directe conserve son propre drapeau (pas de `derived`) ; seules les
  // valeurs calculées portent `derived` ('cooper' / 'saisie-vma' / 'saisie').
  const vmaSaisie = out.vma?.value != null;
  const vo2Saisie = out.vo2max?.value != null;
  const dVma = derivedVMA(out);
  const dVo2 = derivedVO2(out);
  if (dVma && !vmaSaisie) out.vma = { value: Math.round(dVma.value * 10) / 10, date: out.cooper?.date || out.vma?.date || null, derived: dVma.source };
  else if (dVma && vmaSaisie && out.vma.derived == null) out.vma = { ...out.vma, derived: 'saisie' };
  if (dVo2 && !vo2Saisie) out.vo2max = { value: Math.round(dVo2.value * 10) / 10, date: out.cooper?.date || out.vma?.date || out.vo2max?.date || null, derived: dVo2.source };
  else if (dVo2 && vo2Saisie && out.vo2max.derived == null) out.vo2max = { ...out.vo2max, derived: 'saisie' };
  return out;
}

// ---------- IMC (à partir de la taille du profil + dernière mesure de poids) ----------
// IMC = poids (kg) / taille (m)² — seuils OMS : < 18,5 maigreur · 18,5–24,9 normal ·
// 25–29,9 surpoids · 30–34,9 obésité modérée · 35–39,9 obésité sévère · ≥ 40 obésité morbide
function computeIMC(profile) {
  if (!profile || !profile.height) return null;
  const w = latestValues().weight?.value;
  if (!w) return null;
  const imc = w / (profile.height / 100) ** 2;
  return Math.round(imc * 10) / 10;
}
function imcBadge(imc) {
  if (imc == null) return null;
  if (imc < 18.5) return { cls: 'mid', label: 'Maigreur' };
  if (imc < 25) return { cls: 'good', label: 'Normal' };
  if (imc < 30) return { cls: 'mid', label: 'Surpoids' };
  if (imc < 35) return { cls: 'low', label: 'Obésité modérée' };
  if (imc < 40) return { cls: 'low', label: 'Obésité sévère' };
  return { cls: 'low', label: 'Obésité morbide' };
}
function renderIMC() {
  const el = $('#profile-imc');
  if (!el) return;
  const profile = getProfile();
  const imc = computeIMC(profile);
  const badge = imcBadge(imc);
  const bEl = $('#profile-imc-badge');
  if (imc == null) {
    el.textContent = '— (aucune mesure de poids enregistrée)';
    bEl.classList.add('hidden');
    return;
  }
  el.textContent = imc.toFixed(1).replace('.', ',');
  bEl.textContent = badge.label;
  bEl.className = 'badge ' + badge.cls;
  bEl.classList.remove('hidden');
}

// ---------- Facteurs de risque cardiovasculaire (onglet Profil) ----------
// Liste des facteurs cochés/rénseignés + IMC dérivé. Sert au récapitulatif Profil
// et à l'avertissement avant test maximal.
function riskFactors(profile) {
  const p = profile || getProfile() || {};
  const out = [];
  if (p.smoke) out.push({ key: 'smoke', label: 'Tabagisme', major: true });
  if (p.cardiacHistory) out.push({ key: 'cardiacHistory', label: 'Antécédents cardiaques personnels', major: true });
  if (p.familyHistory) out.push({ key: 'familyHistory', label: 'Antécédents familiaux précoces', major: false });
  if (p.hypertension) out.push({ key: 'hypertension', label: 'Hypertension artérielle connue', major: true });
  if (p.diabetes) out.push({ key: 'diabetes', label: 'Diabète connu', major: true });
  if (p.dyslipidemia) out.push({ key: 'dyslipidemia', label: 'Dyslipidémie / statine', major: true });
  const alcohol = Number(p.alcohol);
  if (alcohol >= 14) out.push({ key: 'alcohol', label: `Alcool : ${alcohol} verres/semaine (≥ 14)`, major: true });
  else if (alcohol > 0) out.push({ key: 'alcohol', label: `Alcool : ${alcohol} verre${alcohol > 1 ? 's' : ''}/semaine`, major: false });
  if (p.stress === 'yes') out.push({ key: 'stress', label: 'Stress chronique / dépression', major: true });
  const imc = computeIMC(p);
  if (imc != null && imc >= 30) out.push({ key: 'imc', label: `IMC ${imc.toFixed(1).replace('.', ',')} (obésité)`, major: true });
  else if (imc != null && imc >= 25) out.push({ key: 'imc', label: `IMC ${imc.toFixed(1).replace('.', ',')} (surpoids)`, major: false });
  return out;
}
function hasMajorRisk(profile) {
  return riskFactors(profile).some(r => r.major);
}
function renderRiskSummary() {
  const el = $('#risk-summary');
  if (!el) return;
  const factors = riskFactors();
  const majors = factors.filter(f => f.major);
  if (!factors.length) {
    el.innerHTML = 'Aucun facteur de risque déclaré. <span class="small">(Renseignez-les ci-dessus si votre situation a évolué.)</span>';
    return;
  }
  const level = majors.length >= 3 ? { cls: 'low', txt: 'Risque élevé' }
    : majors.length >= 1 ? { cls: 'mid', txt: 'Risque modéré' }
    : { cls: 'good', txt: 'Risque faible' };
  const items = factors.map(f => `<li>${f.label}${f.major ? ' <span class="badge low">majeur</span>' : ''}</li>`).join('');
  el.innerHTML = `<b>${factors.length} facteur${factors.length > 1 ? 's' : ''} déclaré${factors.length > 1 ? 's' : ''}</b> · niveau : <span class="badge ${level.cls}">${level.txt}</span> (${majors.length} majeur${majors.length > 1 ? 's' : ''})
    <ul class="list" style="margin:6px 0 0">${items}</ul>
    <p class="small" style="margin-top:6px">Ce récapitulatif est indicatif et ne remplace pas une évaluation médicale (scores SCORE2 / Framingham).</p>`;
}

// ---------- Période de calcul de l'IFG (onglet Analyse) ----------
// last = dernière valeur de chaque test · week/month/year = moyenne des valeurs
// sur la période glissante (fenêtre calendaire) · all = moyenne de toutes les valeurs.
const IFG_PERIODS = {
  last:  { label: 'Dernière session', days: null, mode: 'last' },
  week:  { label: '1 semaine',        days: 7,    mode: 'avg' },
  month: { label: '1 mois',           days: 30,   mode: 'avg' },
  year:  { label: '1 an',             days: 365,  mode: 'avg' },
  all:   { label: 'Toutes les valeurs', days: null, mode: 'avg' },
};

// Valeurs agrégées par test pour une période donnée (pour computeIFGPeriod)
function valuesForPeriod(periodKey) {
  const p = IFG_PERIODS[periodKey] || IFG_PERIODS.last;
  if (p.mode === 'last') return latestValues();
  const sessions = getSessions();
  const out = {};
  // borne de début de la fenêtre (mode avg)
  let cutoff = null;
  if (p.days != null) {
    const c = new Date(); c.setDate(c.getDate() - p.days);
    cutoff = c.toISOString().slice(0, 10);
  }
  // collecte de toutes les valeurs par test dans la fenêtre
  const byTest = {};
  for (const s of sessions) {
    if (cutoff && s.date < cutoff) continue;
    for (const [k, v] of Object.entries(s.values || {})) {
      if (v == null || v === '') continue;
      (byTest[k] = byTest[k] || []).push({ value: v, date: s.date });
    }
  }
  for (const [k, arr] of Object.entries(byTest)) {
    const vals = arr.map(x => x.value);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    const lastDate = arr.map(x => x.date).sort().pop();
    out[k] = { value: Math.round(avg * 100) / 100, date: lastDate, count: arr.length };
  }
  // Indicateurs dérivés VMA / VO2max sur la période : moyenne des distances Cooper
  // de la fenêtre → dérivation (cohérent avec latestValues en mode « last »).
  const coopVals = byTest.cooper?.map(x => x.value) || [];
  const vmaVals = byTest.vma?.map(x => x.value) || [];
  const vo2Vals = byTest.vo2max?.map(x => x.value) || [];
  const coopAvg = coopVals.length ? coopVals.reduce((a, b) => a + b, 0) / coopVals.length : null;
  const vmaAvg = vmaVals.length ? vmaVals.reduce((a, b) => a + b, 0) / vmaVals.length : null;
  const vo2Avg = vo2Vals.length ? vo2Vals.reduce((a, b) => a + b, 0) / vo2Vals.length : null;
  const vmaVal = vmaAvg != null ? vmaAvg : (coopAvg != null ? cooperVMAFromDist(coopAvg) : null);
  const vo2Val = vo2Avg != null ? vo2Avg : (vmaVal != null ? vo2FromVMA(vmaVal) : (coopAvg != null ? vo2FromCooperDist(coopAvg) : null));
  const lastDate = out.cooper?.date || out.vma?.date || out.vo2max?.date || null;
  if (vmaVal != null) out.vma = { value: Math.round(vmaVal * 10) / 10, date: lastDate, count: (vmaVals.length || coopVals.length || 0), derived: vmaAvg != null ? 'saisie' : 'cooper' };
  if (vo2Val != null) out.vo2max = { value: Math.round(vo2Val * 10) / 10, date: lastDate, count: (vo2Vals.length || vmaVals.length || coopVals.length || 0), derived: vo2Avg != null ? 'saisie' : (vmaAvg != null ? 'saisie-vma' : 'cooper') };
  return out;
}

// ---------- Dimension « Endurance cardio » (IFG) ----------
// Priorité selon ce qui est renseigné : VMA saisie > VO2max saisie > Cooper/demi-Cooper
// (ou VMA/VO2max dérivées de la distance) > test escalier.
// Un seul indicateur est retenu par dimension (le plus fiable disponible), pour ne pas
// compter deux fois la même capacité. Renvoie { id, value } ou null.
function enduranceIndicator(lv) {
  // Priorité aux saisies directes (VMA > VO2max), quelle que soit leur date.
  if (lv.vma?.value != null && lv.vma.derived === 'saisie') return { id: 'vma', value: lv.vma.value };
  if (lv.vo2max?.value != null && lv.vo2max.derived === 'saisie') return { id: 'vo2max', value: lv.vo2max.value };
  // Puis aux valeurs dérivées du Cooper (VMA préférée à VO2max, déjà ×2 si demi-Cooper).
  if (lv.vma?.value != null && lv.vma.derived === 'cooper') return { id: 'vma', value: lv.vma.value };
  if (lv.vo2max?.value != null && lv.vo2max.derived === 'cooper') return { id: 'vo2max', value: lv.vo2max.value };
  // Distance Cooper brute (pas de dérivation possible) ou test escalier.
  if (lv.cooper?.value != null) return { id: 'cooper', value: lv.cooper.value };
  if (lv.stair_pulse?.value != null) return { id: 'stair_pulse', value: lv.stair_pulse.value };
  return null;
}

// Tests réellement scorés pour une dimension IFG (endurance = 1 seul indicateur)
function scoredTestsForDim(d, lv) {
  if (d.key === 'endurance') {
    const ind = enduranceIndicator(lv);
    return ind ? [ind.id] : [];
  }
  return d.tests.filter(id => lv[id]);
}

// IFG calculé sur une période donnée (même pondération que computeIFG)
function computeIFGPeriod(profile, periodKey) {
  const lv = valuesForPeriod(periodKey);
  const dims = [];
  let total = 0, totalWeight = 0;
  for (const d of IFG_DIMENSIONS) {
    const scored = scoredTestsForDim(d, lv);
    if (!scored.length) continue;
    const pts = scored.map(id => SCORE_PTS[statusOf(byId(id), lv[id].value, profile)]);
    const avg = Math.round(pts.reduce((a, b) => a + b, 0) / pts.length);
    dims.push({ ...d, score: avg, count: scored.length });
    total += avg * d.weight;
    totalWeight += d.weight;
  }
  if (!dims.length) return null;
  return { score: Math.round(total / totalWeight), dims };
}

// Libellé de la période affichée à côté du sélecteur
function ifgPeriodDesc(periodKey) {
  const p = IFG_PERIODS[periodKey] || IFG_PERIODS.last;
  if (p.mode === 'last') return 'Dernière valeur de chaque test';
  if (p.days == null) return 'Moyenne de toutes les valeurs enregistrées';
  return `Moyenne des ${p.days === 7 ? '7 derniers jours' : p.days === 30 ? '30 derniers jours' : '12 derniers mois'}`;
}

// valeurs par test, ordonnées par date
function seriesOf(testId) {
  return getSessions()
    .map(s => ({ date: s.date, value: s.values?.[testId] }))
    .filter(x => x.value != null && x.value !== '');
}

// Fréquence de re-test (en mois)
const RETEST = { rest: 1, strength: 3, cardio: 3, activity: 3 };

// Groupes de tests dus (réutilisé par le dashboard et les rappels de notification)
// Retourne [{ group, label, due, last, monthsDue }] — due=true si à refaire ou jamais fait
function dueGroups() {
  const lv = latestValues();
  const out = [];
  for (const [group, months] of Object.entries(RETEST)) {
    const ids = TESTS.filter(t => t.group === group).map(t => t.id);
    const last = ids.map(id => lv[id]?.date).filter(Boolean).sort().pop();
    const label = GROUP_LABELS[group];
    if (!last) { out.push({ group, label, due: true, last: null, monthsDue: Infinity }); continue; }
    const m = monthsSince(last);
    out.push({ group, label, due: m >= months, last, monthsDue: m });
  }
  return out;
}

function monthsSince(dateStr) {
  const d = new Date(dateStr), n = new Date();
  return (n.getFullYear() - d.getFullYear()) * 12 + (n.getMonth() - d.getMonth());
}

// ---------- Rendu : navigation ----------
$$('nav button').forEach(b => b.addEventListener('click', () => {
  $$('nav button').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + b.dataset.view).classList.add('active');
  if (b.dataset.view === 'dashboard') renderDashboard();
  if (b.dataset.view === 'session') renderLastSession();
  if (b.dataset.view === 'history') renderHistory();
  if (b.dataset.view === 'analysis') renderAnalysis();
  if (b.dataset.view === 'settings') { renderSettings(); renderRemindersForm(); }
}));

function showView(name) {
  $$('nav button').find?.(x => x.dataset.view === name)?.click?.();
}

// ---------- Score global ----------
// Score /100 : moyenne des statuts des 5 tests prédictifs (ordre fixe : FC, taille, poigne, escalier, équilibre)
const PREDICTIVE = ['fc', 'waist', 'grip', 'stair_pulse', 'balance_open'];
const SCORE_PTS = { good: 100, mid: 60, low: 25 };

function computeGlobalScore(profile) {
  const lv = latestValues();
  const scored = PREDICTIVE.filter(id => lv[id]);
  if (!scored.length) return null;
  const avg = Math.round(scored.reduce((a, id) => a + SCORE_PTS[statusOf(byId(id), lv[id].value, profile)], 0) / scored.length);
  const rows = scored.map(id => {
    const t = byId(id);
    const st = statusOf(t, lv[id].value, profile);
    return `<li>${t.name} — ${lv[id].value} ${t.unit} <span class="badge ${st}">${STATUS_LABEL[st]}</span></li>`;
  });
  return { score: avg, rows };
}

// Persiste le score global du jour (1 valeur par date, la dernière écrase)
function recordGlobalScore() {
  const result = computeGlobalScore(getProfile());
  if (!result) return;
  const history = store.get('scoreHistory', []);
  const today = todayStr();
  const existing = history.find(h => h.date === today);
  if (existing) existing.value = result.score;
  else history.push({ date: today, value: result.score });
  history.sort((a, b) => a.date < b.date ? -1 : 1);
  store.set('scoreHistory', history);
}

function scoreSeries() {
  return store.get('scoreHistory', [])
    .filter(h => h.value != null)
    .sort((a, b) => a.date < b.date ? -1 : 1);
}

// ---------- Indice FitTrack Global (IFG) ----------
// Score /100 par dimension à partir des 16 mesures, pondéré selon la littérature
// (mortalité cardiovasculaire et toutes causes). Mêmes statuts/repères que l'app.
const IFG_DIMENSIONS = [
  { key: 'cardio_rest', label: 'Cardio au repos & métabolisme', weight: 0.30, icon: '🫀',
    tests: ['fc', 'pa_sys', 'pa_dia', 'waist'] },
  { key: 'endurance', label: 'Endurance cardio', weight: 0.20, icon: '🫁',
    tests: ['stair_pulse', 'cooper'] },
  { key: 'strength', label: 'Force musculaire', weight: 0.20, icon: '💪',
    tests: ['grip', 'pushups', 'plank', 'chair'] },
  { key: 'balance', label: 'Équilibre & mobilité', weight: 0.15, icon: '⚖️',
    tests: ['balance_open', 'balance_closed', 'reach'] },
  { key: 'activity', label: "Habitudes d'activité", weight: 0.15, icon: '🏃',
    tests: ['ipaq', 'sit'] },
];

function computeIFG(profile) {
  const lv = latestValues();
  const dims = [];
  let total = 0, totalWeight = 0;
  for (const d of IFG_DIMENSIONS) {
    const scored = scoredTestsForDim(d, lv);
    if (!scored.length) continue; // dimension sans donnée : exclue du calcul
    const pts = scored.map(id => SCORE_PTS[statusOf(byId(id), lv[id].value, profile)]);
    const avg = Math.round(pts.reduce((a, b) => a + b, 0) / pts.length);
    dims.push({ ...d, score: avg, count: scored.length });
    total += avg * d.weight;
    totalWeight += d.weight;
  }
  if (!dims.length) return null;
  return { score: Math.round(total / totalWeight), dims };
}

// Persiste l'IFG du jour (1 valeur par date, la dernière écrase)
function recordIFG() {
  const result = computeIFG(getProfile());
  if (!result) return;
  const history = store.get('ifgHistory', []);
  const today = todayStr();
  const existing = history.find(h => h.date === today);
  if (existing) existing.value = result.score;
  else history.push({ date: today, value: result.score });
  history.sort((a, b) => a.date < b.date ? -1 : 1);
  store.set('ifgHistory', history);
}

function ifgSeries() {
  return store.get('ifgHistory', [])
    .filter(h => h.value != null)
    .sort((a, b) => a.date < b.date ? -1 : 1);
}

// ---------- Dashboard ----------
function renderDashboard() {
  const profile = getProfile();
  $('#no-profile-warning').classList.toggle('hidden', !!profile);

  recordGlobalScore();

  const lv = latestValues();
  const scoreEl = $('#score-global-content');
  const result = computeGlobalScore(profile);
  if (!result) {
    scoreEl.innerHTML = '<p>Aucune mesure enregistrée. Commencez par une <b>session de test</b>.</p>';
  } else {
    // Barre de niveau : 5 paliers colorés, le remplissage correspond au score /100
    const pct = Math.max(0, Math.min(100, result.score));
    const fill = `linear-gradient(to right, var(--bad) 0%, var(--bad) 20%, var(--warn) 20%, var(--warn) 40%, #f9a825 40%, #f9a825 60%, #9e9d24 60%, #9e9d24 80%, var(--ok) 80%, var(--ok) 100%)`;
    scoreEl.innerHTML = `<p style="font-size:2em;font-weight:700;color:var(--accent)">${result.score}<span style="font-size:.6em"> /100</span></p>
      <div class="score-bar" role="progressbar" aria-valuenow="${result.score}" aria-valuemin="0" aria-valuemax="100" title="${result.score}/100">
        <div class="score-bar-track"><div class="score-bar-fill" style="width:${pct}%;background:${fill}"></div></div>
        <div class="score-bar-labels small"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
      </div>
      <p class="small">Basé sur les 5 mesures les plus prédictives selon la littérature scientifique.</p>
      <ul class="list">${result.rows.join('')}</ul>`;
  }

  // Tests dus (logique factorisée dans dueGroups(), aussi utilisée par les rappels)
  const due = dueGroups().map(d => {
    if (!d.last) return `<li><b>${d.label}</b> — jamais effectué <span class="badge low">à faire</span></li>`;
    const lastFr = d.last.split('-').reverse().join('/');
    return d.due
      ? `<li><b>${d.label}</b> — dernier : ${lastFr} <span class="badge low">à refaire (${d.monthsDue} mois)</span></li>`
      : `<li><b>${d.label}</b> — dernier : ${lastFr} <span class="badge good">à jour</span></li>`;
  });
  $('#due-tests').innerHTML = due.join('');

  // Alertes de tendance : dégradation ou stagnation sur 2 sessions
  const alerts = [];
  const THRESH = { rest: 0.03, strength: 0.05, cardio: 0.05, activity: 0.10 };
  for (const t of TESTS) {
    if (t.good == null) continue;
    const series = seriesOf(t.id);
    if (series.length < 2) continue;
    const [prev, last] = series.slice(-2);
    const delta = (last.value - prev.value) / Math.max(prev.value, 1);
    const bad = t.rev ? delta > THRESH[t.group] : delta < -THRESH[t.group];
    const stagnant = Math.abs(delta) <= 0.01;
    if (bad) alerts.push(`<li>🔴 <b>${t.name}</b> : ${prev.value} → ${last.value} ${t.unit} (dégradation). Ajustez l'entraînement${['fc','pa_sys','pa_dia'].includes(t.id) ? ' ou consultez' : ''}.</li>`);
    else if (stagnant && series.length >= 3) alerts.push(`<li>🟠 <b>${t.name}</b> : stable sur 2 sessions. Pensez à varier l'entraînement.</li>`);
  }
  $('#alerts').innerHTML = alerts.length ? alerts.join('') : '<li>Aucune alerte. 👍</li>';
}

// La carte « Dernière session » vit dans l'onglet Session de test
function renderLastSession() {
  const sessions = getSessions();
  const compEl = $('#last-comparison');
  if (sessions.length === 0) { compEl.innerHTML = '<p>Aucune donnée.</p>'; return; }
  const frDate = d => d.split('-').reverse().join('/');
  // regrouper les sessions par date (une colonne par date, sessions multiples fusionnées)
  const byDate = [];
  for (const s of sessions.slice().reverse()) {
    let col = byDate.find(c => c.date === s.date);
    if (!col) { col = { date: s.date, sessions: [] }; byDate.push(col); }
    col.sessions.push(s);
  }
  const cols = byDate.slice(0, 2); // les 2 dates les plus récentes
  // tous les tests présents dans ces colonnes, triés dans l'ordre de TESTS
  // (= ordre de présentation dans les sessions : repos & mobilité, force, cardio, activité)
  const ids = [];
  for (const c of cols) for (const s of c.sessions) for (const id of Object.keys(s.values || {})) {
    if (s.values[id] != null && s.values[id] !== '' && !ids.includes(id)) ids.push(id);
  }
  ids.sort((a, b) => TESTS.findIndex(t => t.id === a) - TESTS.findIndex(t => t.id === b));
  let html = '<table class="last3-table">';
  html += '<tr><th>Test</th>' + cols.map(c => `<th>${frDate(c.date)} <button class="delete-session-btn" title="Supprimer les sessions de cette date" data-del-session="${c.sessions[0].id || ''}" data-del-date="${c.date}">🗑️</button></th>`).join('') + '<th>Δ</th></tr>';
  for (const id of ids) {
    const t = byId(id);
    // valeur d'une colonne = celle de la session qui contient ce test (la plus récente si plusieurs)
    const valOf = c => {
      for (const s of c.sessions) if (s.values?.[id] != null && s.values[id] !== '') return s;
      return null;
    };
    const curS = valOf(cols[0]);
    const prvS = cols[1] ? valOf(cols[1]) : null;
    const cur = curS?.values?.[id];
    const prv = prvS?.values?.[id];
    const hasCur = cur != null && cur !== '';
    const hasPrv = prv != null && prv !== '';
    // delta : significatif seulement si les deux valeurs existent
    let deltaCell = '<td class="num muted">—</td>';
    if (hasCur && hasPrv) {
      const d = cur - prv;
      const sign = d > 0 ? '+' : '';
      // poids : couleur basée sur la trajectoire IMC (vert = vers meilleure zone IMC)
      const cls = d === 0 ? 'muted'
        : (t.id === 'weight' ? weightDeltaClass(cur, prv)
        : (t.rev ? (d < 0 ? 'up' : 'down') : (d > 0 ? 'up' : 'down')));
      deltaCell = `<td class="num ${cls}">${sign}${Math.round(d * 10) / 10}</td>`;
    }
    html += `<tr><td class="test-name"><span class="test-num">${testNum(id)}</span>${t.name}</td>`;
    // IPAQ : la valeur est complétée du badge de niveau (élevé/modéré/faible)
    const valueCell = (v, s) => {
      if (v == null || v === '') return '<td class="num muted">—</td>';
      const badge = id === 'ipaq'
        ? ` <span class="badge ${ipaqLevel(v).key === 'high' ? 'good' : ipaqLevel(v).key === 'mid' ? 'mid' : 'low'}">${ipaqLevel(v).short}</span>`
        : '';
      return `<td class="num">${v}${badge} <button class="edit-btn" title="Corriger cette mesure" data-edit-id="${s.id || ''}" data-edit-date="${s.date}" data-edit-test="${id}">✏️</button></td>`;
    };
    html += valueCell(cur, curS);
    html += valueCell(prv, prvS);
    html += deltaCell + '</tr>';
  }
  html += '</table>';
  compEl.innerHTML = html;
}

document.addEventListener('click', e => {
  const btn = e.target.closest('.delete-session-btn');
  if (!btn) return;
  const { delSession: id, delDate: date } = btn.dataset;
  const ofDate = getSessions().filter(s => s.date === date);
  const n = ofDate.reduce((acc, s) => acc + Object.keys(s.values || {}).length, 0);
  if (!confirm(`Supprimer ${ofDate.length > 1 ? `les ${ofDate.length} sessions` : 'la session'} du ${date.split('-').reverse().join('/')} (${n} mesure${n > 1 ? 's' : ''}) ?\nCette action est définitive.`)) return;
  store.set('sessions', getSessions().filter(s => s.date !== date));
  renderDashboard();
  renderLastSession();
});

// Couleur du delta de poids selon la trajectoire IMC
// vert = se rapproche de la zone saine [18.5, 25], rouge = s'en éloigne, gris = stable ou taille inconnue
function weightDeltaClass(curW, prvW) {
  const profile = getProfile();
  const h = profile?.height;
  if (!h || h < 100) return 'muted'; // taille non renseignée : pas d'interprétation
  const imc = w => w / (h / 100) ** 2;
  const dist = m => m < 18.5 ? 18.5 - m : (m > 25 ? m - 25 : 0);
  const dc = dist(imc(curW)), dp = dist(imc(prvW));
  if (dc === 0 && dp === 0) return 'muted'; // reste dans la zone saine
  if (dc < dp) return 'up';
  if (dc > dp) return 'down';
  return 'muted';
}

// ---------- Édition d'une mesure (crayon ✏️) ----------
let editCtx = null; // { id, date, testId }

function findSession(ctx, sessions) {
  const list = sessions || getSessions();
  if (ctx.id) {
    const bySid = list.find(s => s.id === ctx.id);
    if (bySid) return bySid;
  }
  return list.find(s => s.date === ctx.date && s.values?.[ctx.testId] != null);
}

function openEditModal(ctx) {
  const t = byId(ctx.testId);
  const session = findSession(ctx);
  if (!session || session.values[ctx.testId] == null) return;
  editCtx = { id: session.id, date: session.date, testId: ctx.testId };
  $('#edit-title').textContent = `${t.name}`;
  const dateFr = session.date.split('-').reverse().join('/');
  $('#edit-info').textContent = `Mesure du ${dateFr} — corrigez la valeur si elle a été mal saisie.`;
  $('#edit-value').value = session.values[ctx.testId];
  $('#edit-value').min = t.min ?? 0;
  $('#edit-value').max = t.max ?? 999;
  $('#edit-value').placeholder = t.unit;
  $('#edit-modal').classList.remove('hidden');
  $('#edit-value').focus();
  $('#edit-value').select();
}

function closeEditModal() {
  editCtx = null;
  $('#edit-modal').classList.add('hidden');
}

$('#edit-cancel').addEventListener('click', closeEditModal);
$('#edit-modal').addEventListener('click', e => {
  if (e.target === $('#edit-modal')) closeEditModal();
});

document.addEventListener('click', e => {
  const btn = e.target.closest('.edit-btn');
  if (btn) openEditModal({ id: btn.dataset.editId, date: btn.dataset.editDate, testId: btn.dataset.editTest });
});

$('#edit-save').addEventListener('click', () => {
  if (!editCtx) return;
  const t = byId(editCtx.testId);
  const raw = $('#edit-value').value.trim().replace(',', '.');
  const num = parseFloat(raw);
  if (raw === '' || isNaN(num)) { alert('Valeur invalide.'); return; }
  if (t.max != null && num > t.max) { alert(`Valeur trop élevée (max ${t.max} ${t.unit}).`); return; }
  if (t.min != null && num < t.min) { alert(`Valeur trop faible (min ${t.min} ${t.unit}).`); return; }
  const sessions = getSessions();
  const s = findSession(editCtx, sessions);
  if (!s) { closeEditModal(); return; }
  s.values[editCtx.testId] = num;
  store.set('sessions', sessions);
  closeEditModal();
  // re-rendu des vues actives
  renderDashboard();
  renderLastSession();
  if ($('#view-history').classList.contains('active')) renderHistory();
});

$('#edit-delete').addEventListener('click', () => {
  if (!editCtx) return;
  if (!confirm('Supprimer définitivement cette mesure ?')) return;
  const sessions = getSessions();
  const s = findSession(editCtx, sessions);
  if (s) {
    const idx = sessions.indexOf(s);
    delete sessions[idx].values[editCtx.testId];
    if (Object.keys(sessions[idx].values).length === 0) sessions.splice(idx, 1);
    store.set('sessions', sessions);
  }
  closeEditModal();
  renderDashboard();
});

// ---------- Session ----------
const chronoBtns = ['plank', 'balance_open', 'balance_closed'];

let currentSessionType = 'rest';

// Bloc questionnaire IPAQ court : 7 champs, score MET-min/sem calculé en direct
function renderIpaqBlock(block) {
  const last = latestValues();
  const lastIpaq = last['ipaq']?.value;
  const lastSit = last['sit']?.value;
  block.innerHTML += `
    <p class="small">Pensez aux <b>7 derniers jours</b>. Répondez aux 7 questions, le score se calcule automatiquement.</p>
    <div id="ipaq-questions"></div>
    <div id="ipaq-result" class="card" style="background:var(--accent-light);margin-top:10px"></div>
    <input type="hidden" data-test="ipaq" id="ipaq-score-input">
    <input type="hidden" data-test="sit" id="ipaq-sit-input">`;
  const qWrap = block.querySelector('#ipaq-questions');
  const answers = {};
  IPAQ_QUESTIONS.forEach(q => {
    const row = document.createElement('div');
    row.className = 'field-row';
    row.innerHTML = `
      <label>${q.label}
        <input type="number" step="1" min="${q.min}" max="${q.max}"
               data-ipaq="${q.id}" placeholder="${q.unit}" style="width:110px"> <span class="small">${q.unit}</span>
      </label>`;
    qWrap.appendChild(row);
    const inp = row.querySelector('input[data-ipaq]');
    inp.addEventListener('input', () => {
      const raw = inp.value.trim();
      const num = raw === '' ? null : parseInt(raw, 10);
      const invalid = raw !== '' && (isNaN(num) || num < q.min || num > q.max);
      inp.classList.toggle('invalid', invalid);
      answers[q.id] = invalid ? null : num;
      updateIpaqResult(answers);
      updateSaveState();
    });
  });
  updateIpaqResult(answers);
  function updateIpaqResult(a) {
    const resultEl = block.querySelector('#ipaq-result');
    const answered = IPAQ_QUESTIONS.filter(q => a[q.id] != null).length;
    const complete = answered === IPAQ_QUESTIONS.length;
    if (!complete) {
      resultEl.innerHTML = `<b>Questionnaire incomplet</b> (${answered}/7) — le score nécessite les 7 réponses.`;
      block.querySelector('#ipaq-score-input').value = '';
      block.querySelector('#ipaq-sit-input').value = '';
      return;
    }
    const met = ipaqScore(a);
    const lvl = ipaqLevel(met);
    const sitH = Math.floor((a.sit_min || 0) / 60), sitM = (a.sit_min || 0) % 60;
    resultEl.innerHTML = `
      <b>Score IPAQ : ${met} MET-min/semaine</b> — ${lvl.label}<br>
      <span class="small">Détail : intense ${Math.round((a.vig_days||0)*(a.vig_min||0))} min/j ×8 · modéré ${Math.round((a.mod_days||0)*(a.mod_min||0))} min/j ×4 · marche ${Math.round((a.walk_days||0)*(a.walk_min||0))} min/j ×3,3 (par semaine)</span><br>
      <span class="small">Temps assis (jour de semaine) : <b>${a.sit_min} min</b> (${sitH} h ${String(sitM).padStart(2,'0')})${a.sit_min > 480 ? ' — au-delà de 8 h : pensez à vous lever régulièrement' : ''}</span>
      <div class="small" style="margin-top:4px">Repères OMS : ≥ 600 MET-min/sem (ou 150 min d’activité modérée/sem) · objectif haut : ≥ 3000</div>`;
    block.querySelector('#ipaq-score-input').value = met;
    block.querySelector('#ipaq-sit-input').value = a.sit_min;
  }
  if (lastIpaq != null || lastSit != null) {
    const info = document.createElement('div');
    info.className = 'field-last';
    info.innerHTML = 'Dernier : ' + [
      lastIpaq != null ? `<b>${lastIpaq}</b> MET-min/sem` : null,
      lastSit != null ? `assis <b>${lastSit}</b> min/j` : null,
    ].filter(Boolean).join(' · ');
    block.insertBefore(info, block.querySelector('#ipaq-questions'));
  }
}

function renderSessionFields() {
  const type = currentSessionType;
  const groups = SESSION_GROUPS[type];
  const container = $('#session-fields');
  container.innerHTML = '';
  for (const g of groups) {
    const block = document.createElement('div');
    block.className = 'session-block';
    block.innerHTML = `<h3>${GROUP_LABELS[g]}</h3>`;
    if (g === 'activity') {
      renderIpaqBlock(block);
      container.appendChild(block);
      updateSaveState();
      return;
    }
    container.appendChild(block); // dans le DOM avant les rows (initCooperEstim fait des querySelector globaux)
    for (const t of TESTS.filter(x => x.group === g && x.id !== 'vma' && x.id !== 'vo2max')) {
      const row = document.createElement('div');
      row.className = 'field-row';
      const chronoBtn = chronoBtns.includes(t.id)
        ? `<button class="chrono-btn" data-chrono-target="${t.id}">⏱</button>` : '';
      // Timer compte à rebours à durée fixe : chaise 30 s (compter les répétitions)
      const chairTimerBtn = t.id === 'chair'
        ? `<button class="timer-btn" data-timer-ms="30000" data-timer-label="Chaise 30 s — répétitions" title="Compte à rebours 30 s pour compter les répétitions">⏳</button>` : '';
      // Timer compte à rebours 3 min par défaut (durée réglable) pour le test escalier.
      // À la fin des 3 min, un compte à rebours de 1 min se lance automatiquement
      // pour indiquer le délai avant la mesure du pouls (1 min après l'arrêt).
      const stairTimerBtn = t.id === 'stair_pulse'
        ? `<button class="timer-btn" data-timer-ms="180000" data-timer-editable="1" data-timer-label="Test escalier — montées (24/min)" data-timer-next-ms="60000" data-timer-next-label="Escalier — mesure du pouls dans 1 min (asseyez-vous)" title="Compte à rebours 3 min pour les montées d'escalier (durée réglable), puis 1 min auto avant la mesure du pouls">⏳</button>` : '';
      const infoBtn = t.info
        ? `<button class="info-btn" data-info-test="${t.id}" title="Comment réaliser ce test ?" aria-label="Informations sur ${t.name}">ⓘ</button>` : '';
      const last = latestValues()[t.id]?.value;
      const lastInfo = last != null
        ? `<div class="field-last">Dernier : <b>${last}</b> ${t.unit}</div>` : '';
      // Choix de durée pour le Cooper en boutons radio (12 min ou demi-Cooper 6 min, normalisé ×2)
      const cooperSelect = t.id === 'cooper'
        ? `<span class="row ifg-period-group" id="cooper-duration" title="Durée du test" style="margin:0">
             <label class="ifg-period-opt"><input type="radio" name="cooper-duration" value="12" checked> 12 min (complet)</label>
             <label class="ifg-period-opt"><input type="radio" name="cooper-duration" value="6"> 6 min (demi-Cooper)</label>
           </span>` : '';
      // Bloc d'estimation VMA / VO2max pour le Cooper (champs optionnels + calculs croisés)
      const cooperEstim = t.id === 'cooper'
        ? `<div class="cooper-estim">
             <div class="row" style="margin:6px 0">
               <label>VMA (km/h) : <input type="number" id="cooper-vma" step="0.1" min="4" max="30" placeholder="ex. 12,5" style="width:90px"></label>
               <label>VO2max (ml/kg/min) : <input type="number" id="cooper-vo2" step="0.1" min="10" max="90" placeholder="ex. 44" style="width:90px"></label>
             </div>
             <div class="field-hint">Au moins un des 3 champs (distance, VMA ou VO2max) suffit à enregistrer la session.</div>
             <div id="cooper-estim-result" class="estimation-box hidden"></div>
           </div>` : '';
      row.innerHTML = `
        <label><span class="test-num">${testNum(t.id)}</span>${t.name}
          ${infoBtn}
          <div class="field-hint">${t.hint || ''}</div>
          ${lastInfo}
        </label>
        ${cooperSelect}
        <input type="number" step="any" min="${t.min ?? 0}" max="${t.max ?? 999}"
               data-test="${t.id}" placeholder="${t.unit}">
        ${chronoBtn}
        ${chairTimerBtn}
        ${stairTimerBtn}
        ${cooperEstim}`;
      block.appendChild(row); // ← le row DOIT être dans le DOM avant initCooperEstim
      const inp = row.querySelector('input[data-test]');
      inp.addEventListener('input', () => updateFieldValidity(t, inp));
      if (t.id === 'cooper') initCooperEstim(inp);
    }
  }
  updateSaveState();
  // Avertissement Cooper si facteurs de risque majeurs
  const profile = getProfile();
  if (type === 'cardio' && hasMajorRisk(profile)) {
    const n = riskFactors(profile).filter(f => f.major).length;
    const w = document.createElement('div');
    w.className = 'warning';
    w.innerHTML = `⚠️ <b>Test de Cooper déconseillé</b> : ${n} facteur${n > 1 ? 's' : ''} de risque cardio majeur${n > 1 ? 's' : ''} déclaré${n > 1 ? 's' : ''} dans votre profil. Avis médical recommandé avant un test maximal (privilégiez le test de l'escalier, sous-maximal).`;
    container.prepend(w);
  }
}

// ---------- Pop-up d'aide à la réalisation d'un test (icône ⓘ) ----------
// Contenu statique pour les explications hors tests (id commençant par « __ »)
const STATIC_INFOS = {
  __trends__: {
    name: 'Tendances par dimension',
    info: `<ul>
      <li>Le <b>score moyen</b> est la moyenne des points de statut de chaque mesure de la dimension : 🟢 bon = 100, 🟠 moyen = 60, 🔴 faible = 25.</li>
      <li>Il va de <b>25</b> (tout est faible) à <b>100</b> (tout est bon).</li>
      <li><b>Score moyen (30 j)</b> = mesures des 30 derniers jours ; <b>Avant</b> = mesures antérieures à cette période.</li>
      <li><b>▲ en hausse</b> : +3 points ou plus · <b>▼ en baisse</b> : −3 points ou plus · <b>= stable</b> : entre −2 et +2 · <b>nouveau</b> : pas de mesure avant.</li>
      <li>Ce score est propre à chaque dimension — il n'est pas l'IFG (qui pondère les 5 dimensions entre elles).</li>
    </ul>`
  },
  __ipaq__: {
    name: 'IPAQ court — MET-min/semaine',
    info: `<ul>
      <li><b>IPAQ</b> = International Physical Activity Questionnaire (version courte, 7 questions sur les 7 derniers jours).</li>
      <li><b>MET</b> = Metabolic Equivalent of Task : 1 MET = la dépense énergétique au repos (assis, calme).</li>
      <li><b>MET-min/semaine</b> = minutes d'activité × intensité en MET, sommées sur la semaine :
        <ul>
          <li>Effort <b>intense</b> (course, vélo rapide…) = <b>8 MET</b></li>
          <li>Effort <b>modéré</b> (vélo tranquille, jardinage…) = <b>4 MET</b></li>
          <li><b>Marche</b> (≥ 10 min d'affilée) = <b>3,3 MET</b></li>
        </ul>
      </li>
      <li>Formule : <b>8 × min intense + 4 × min modérées + 3,3 × min de marche</b> (en multipliant d'abord par le nombre de jours).</li>
      <li><b>Niveaux</b> : &lt; 600 = faible (sédentaire) · 600–2999 = modéré · ≥ 3000 = élevé (actif).</li>
      <li><b>Repère OMS</b> : ≥ 600 MET-min/sem, soit environ 150 min d'activité modérée par semaine.</li>
      <li>Dans ce graphique, chaque point croise votre score IPAQ (activité déclarée) avec votre IFG (forme mesurée) à la même date — un écart important signale un déséquilibre à creuser.</li>
    </ul>`
  },
  __sources__: {
    name: 'Sources scientifiques',
    info: `<ul>
      <li><b>IPAQ court (activité physique)</b> : Craig CL et al., « International physical activity questionnaire: 12-country reliability and validity », <i>Med Sci Sports Exerc</i>, 2003 — cotation MET-min/sem (8×intense, 4×modéré, 3,3×marche) et seuils 600 / 3000.</li>
      <li><b>Recommandations activité physique</b> : OMS, « Lignes directrices de l'OMS sur l'activité physique et la sédentarité », 2020 — ≥ 150 min d'activité modérée/semaine (≈ 600 MET-min/sem).</li>
      <li><b>Test de Cooper (endurance)</b> : Cooper KH, « A means of assessing maximal power output », <i>JAMA</i>, 1968 — distance maximale en 12 min, repères cardio-respiratoires adultes (H/F). Le demi-Cooper (6 min ×2) suit la même logique de normalisation.</li>
      <li><b>VMA &amp; VO2max estimées</b> : VMA = distance Cooper (m) ÷ 200 (Cooper 1968, relation distance/vitesse) ; VO2max = 3,5 × VMA (Léger &amp; Mercier, 1983) ; VO2max = (distance − 504,9) ÷ 44,73 (ACSM, <i>Guidelines for Exercise Testing and Prescription</i>) ; inverse : VMA = VO2max ÷ 3,5.</li>
      <li><b>Tour de taille (risque métabolique)</b> : seuils OMS/IDF — ≥ 94 cm (H) / ≥ 80 cm (F) : risque accru ; ≥ 102 / ≥ 88 cm : risque substantiellement accru.</li>
      <li><b>Pression artérielle</b> : seuils de référence usuels (ESC/ESH) — normale &lt; 120/80 mmHg, élevée 130–139/85–89 mmHg.</li>
      <li><b>Facteurs de risque cardiovasculaire</b> (tabagisme, antécédents personnels/familiaux, hypertension, diabète, dyslipidémie, alcool, stress, IMC) : cadre des recommandations <b>ESC 2021</b> sur la prévention cardiovasculaire et du score <b>SCORE2</b> (âge, sexe, tabagisme, pression artérielle systolique, cholestérol, antécédents familiaux).</li>
      <li><b>Force musculaire (poigne, pompes, chaise 30 s, gainage)</b> : repères issus des batteries de tests de forme fonctionnelle pour adultes (Rikli &amp; Jones, « Senior Fitness Test », 1999, pour la chaise 30 s ; protocoles communautaires usuels pour les autres).</li>
      <li><b>Équilibre unipodal &amp; Sit-and-reach</b> : protocoles standardisés de la littérature (test unipodal yeux ouverts/fermés, Senior Fitness Test pour la souplesse).</li>
      <li><b>Score global &amp; IFG (pondération des dimensions)</b> : pondérations fondées sur les associations littérature entre condition physique (FC de repos, tour de taille, force, endurance, équilibre) et mortalité cardiovasculaire et toutes causes (ex. : Kodama et al., <i>JAMA</i> 2009, méta-analyse marche/course et mortalité ; Lee et al., méta-analyses fitness/mortalité). Les 5 mesures du score global sont celles les plus prédictives selon cette littérature.</li>
      <li><b>Temps assis</b> : seuils de sédentarité de la littérature IPAQ/OMS (objectif &lt; 4 h/jour ; alerte &gt; 8 h/jour).</li>
    </ul>
    <p class="small" style="margin-top:8px">Ces repères sont indicatifs : ils situent vos résultats dans des fourchettes publiées, sans remplacer un avis médical. L'app compare avant tout vos mesures à vous-même dans le temps.</p>`,
  },
  __risk__: {
    name: 'Facteurs de risque cardiovasculaire',
    info: `<ul>
      <li>Les <b>facteurs de risque cardiovasculaire</b> sont les éléments qui augmentent la probabilité d'un événement cardiaque (infarctus, AVC…). Les scores cliniques usuels (SCORE2, Framingham) en combinent plusieurs.</li>
      <li><b>Non modifiables</b> : âge, sexe, <b>antécédents familiaux précoces</b> (parent/fratrie ayant eu un événement cardiaque avant 55 ans chez l'homme, 65 ans chez la femme).</li>
      <li><b>Modifiables</b> : tabagisme, hypertension artérielle, dyslipidémie (cholestérol), diabète, obésité/surpoids (IMC), sédentarité, alimentation déséquilibrée, alcool, stress chronique.</li>
      <li><b>Dans FitTrack</b> : ces facteurs servent à <b>adapter l'avertissement avant les tests maximaux</b> (Cooper) et à afficher un récapitulatif. Ils ne modifient pas votre score.</li>
      <li>Le <b>nombre de facteurs « majeurs »</b> (tabagisme, antécédents personnels, hypertension, diabète, dyslipidémie, IMC ≥ 30, alcool ≥ 14 verres/sem, stress chronique) pilote le niveau de prudence affiché.</li>
      <li>Sources : recommandations ESC 2021 sur la prévention cardiovasculaire, score SCORE2 (ESC 2021), OMS — facteurs de risque des maladies cardiovasculaires.</li>
    </ul>`,
  },
};
document.addEventListener('click', e => {
  const btn = e.target.closest('.info-btn');
  if (!btn) return;
  const key = btn.dataset.infoTest;
  if (key.startsWith('__')) {
    const s = STATIC_INFOS[key];
    if (!s) return;
    $('#info-modal-title').textContent = s.name;
    $('#info-modal-body').innerHTML = s.info;
    $('#info-modal').classList.remove('hidden');
    return;
  }
  const t = byId(key);
  if (!t || !t.info) return;
  $('#info-modal-title').textContent = t.name;
  $('#info-modal-body').innerHTML = t.info;
  $('#info-modal').classList.remove('hidden');
});

function closeInfoModal() {
  $('#info-modal').classList.add('hidden');
}
$('#info-modal-close').addEventListener('click', closeInfoModal);
$('#info-modal').addEventListener('click', e => {
  if (e.target === $('#info-modal')) closeInfoModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeInfoModal();
});

function updateFieldValidity(t, inp) {
  const raw = inp.value.trim();
  const num = raw === '' ? null : parseFloat(raw.replace(',', '.'));
  // Bornes effectives : attributs min/max du champ (le demi-Cooper les resserre à 100–2500)
  const min = inp.min !== '' ? parseFloat(inp.min) : t.min;
  const max = inp.max !== '' ? parseFloat(inp.max) : t.max;
  const invalid = raw !== '' && (isNaN(num) || (min != null && num < min) || (max != null && num > max));
  inp.classList.toggle('invalid', invalid);
  updateSaveState();
}

// VMA / VO2max saisis dans le bloc Cooper (session cardio uniquement) :
// valides si remplis et dans les bornes (VMA 4–30 km/h, VO2max 10–90 ml/kg/min).
function cooperEstimValid() {
  if (currentSessionType !== 'cardio') return { filled: false, invalid: false, count: 0 };
  let filled = false, invalid = false, count = 0;
  for (const sel of ['#cooper-vma', '#cooper-vo2']) {
    const el = $(sel);
    if (!el) continue;
    const raw = el.value.trim();
    if (raw === '') continue;
    const num = parseFloat(raw.replace(',', '.'));
    const min = el.min !== '' ? parseFloat(el.min) : null;
    const max = el.max !== '' ? parseFloat(el.max) : null;
    if (isNaN(num) || (min != null && num < min) || (max != null && num > max)) { invalid = true; continue; }
    filled = true; count++;
  }
  return { filled, invalid, count };
}

function updateSaveState() {
  const btn = $('#save-session');
  const filled = $$('#session-fields input[data-test]').some(i => i.value.trim() !== '' && !i.classList.contains('invalid'));
  const invalid = $$('#session-fields input[data-test]').some(i => i.classList.contains('invalid'));
  // Bloc Cooper : VMA ou VO2max seul suffit à enregistrer la session cardio
  const estim = cooperEstimValid();
  btn.disabled = !(filled || estim.filled);
  const count = $$('#session-fields input[data-test]').filter(i => i.value.trim() !== '' && !i.classList.contains('invalid')).length + estim.count;
  $('#session-progress').textContent = count > 0 ? `${count} mesure${count > 1 ? 's' : ''} saisie${count > 1 ? 's' : ''}` : '';
  btn.title = (invalid || estim.invalid) ? 'Corrigez les valeurs hors bornes' : '';
}

$$('.session-type-btn').forEach(b => b.addEventListener('click', () => {
  $$('.session-type-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  currentSessionType = b.dataset.type;
  renderSessionFields();
}));

// Demi-Cooper (6 min) : le champ accepte 100–2500 m (×2 = 200–5000 m équiv. 12 min)
// Le choix de durée est un groupe de radios name="cooper-duration" (12 / 6).
function cooperSelectedDuration() {
  return (document.querySelector('input[name="cooper-duration"]:checked') || {}).value || '12';
}
document.addEventListener('change', e => {
  if (e.target.name !== 'cooper-duration') return;
  const inp = $('#session-fields input[data-test="cooper"]');
  if (!inp) return;
  if (e.target.value === '6') { inp.min = 100; inp.max = 2500; inp.placeholder = 'm en 6 min'; }
  else { inp.min = 200; inp.max = 5000; inp.placeholder = 'm'; }
  updateFieldValidity(byId('cooper'), inp);
});

// ---------- Formules VMA / VO2max (test Cooper + indicateurs dérivés) ----------
// Formules usuelles :
//   VMA (km/h) depuis la distance Cooper 12 min :  VMA = distance(m) / 200
//   VO2max estimée depuis la VMA (Léger & Mercier) :  VO2max = 3,5 × VMA
//   VO2max estimée directement depuis la distance Cooper (ACSM) :
//     VO2max = (distance(m) − 504,9) / 44,73   (équivalent à 3,5 × VMA − 3,5)
//   VMA depuis la VO2max :  VMA = VO2max / 3,5
// Le champ distance du Cooper stocke déjà l'équivalent 12 min (demi-Cooper ×2),
// donc les formules s'appliquent telles quelles quelle que soit la durée choisie.
function cooperVMAFromDist(distM) { return distM / 200; }
function vo2FromVMA(vma) { return 3.5 * vma; }
function vo2FromCooperDist(distM) { return (distM - 504.9) / 44.73; }
function vmaFromVo2(vo2) { return vo2 / 3.5; }
const fmt1 = n => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');

// Met à jour le bloc d'estimation selon les 3 saisies possibles :
// distance (m, équiv. 12 min), VMA (km/h), VO2max (ml/kg/min).
function updateCooperEstim() {
  const out = $('#cooper-estim-result');
  if (!out) return;
  const distRaw = $('#session-fields input[data-test="cooper"]')?.value.trim();
  const vmaRaw = $('#cooper-vma')?.value.trim();
  const vo2Raw = $('#cooper-vo2')?.value.trim();
  const dist = distRaw ? parseFloat(distRaw.replace(',', '.')) : null;
  const vma = vmaRaw ? parseFloat(vmaRaw.replace(',', '.')) : null;
  const vo2 = vo2Raw ? parseFloat(vo2Raw.replace(',', '.')) : null;
  const lines = [];
  const hasVma = vma != null && !isNaN(vma);
  const hasVo2 = vo2 != null && !isNaN(vo2);
  if (hasVma) {
    lines.push(`<b>VMA renseignée :</b> ${fmt1(vma)} km/h`);
    lines.push(`<b>VO2max estimée :</b> ${fmt1(vo2FromVMA(vma))} ml/kg/min`);
  }
  if (hasVo2) {
    lines.push(`<b>VO2max renseignée :</b> ${fmt1(vo2)} ml/kg/min`);
    lines.push(`<b>VMA estimée :</b> ${fmt1(vmaFromVo2(vo2))} km/h`);
  }
  // La distance Cooper n'est affichée dans le bloc d'estimation que si ni VMA
  // ni VO2max n'est renseignée (évite la redondance avec les tuiles VMA/VO2max).
  if (dist != null && !isNaN(dist) && !hasVma && !hasVo2) {
    // En demi-Cooper (6 min), la distance saisie est automatiquement ×2
    // pour obtenir l'équivalent 12 min avant tout calcul.
    const isHalf = cooperSelectedDuration() === '6';
    const dist12 = isHalf ? dist * 2 : dist;
    const vmaD = cooperVMAFromDist(dist12);
    const vo2D = vo2FromCooperDist(dist12);
    const distLabel = isHalf
      ? `<b>Distance saisie (6 min) :</b> ${Math.round(dist)} m → <b>équiv. 12 min : ${Math.round(dist12)} m</b>`
      : `<b>Distance Cooper (équiv. 12 min) :</b> ${Math.round(dist12)} m`;
    lines.push(distLabel);
    lines.push(`<b>VMA estimée :</b> ${fmt1(vmaD)} km/h`);
    lines.push(`<b>VO2max estimée :</b> ${fmt1(vo2D)} ml/kg/min`);
  }
  if (!lines.length) { out.classList.add('hidden'); out.innerHTML = ''; return; }
  out.innerHTML = lines.join('<br>');
  out.classList.remove('hidden');
}

// À l'ouverture du bloc Cooper : branche les 3 champs + le sélecteur de durée
// sur le recalcul.
function initCooperEstim(distInput) {
  // Le row est déjà dans le DOM (appendChild ci-dessus) : querySelector global OK.
  const vmaInp = document.querySelector('#cooper-vma');
  const vo2Inp = document.querySelector('#cooper-vo2');
  const sync = () => {
    updateCooperEstim();
    updateSaveState(); // VMA/VO2max seuls activent le bouton « Enregistrer »
  };
  distInput.addEventListener('input', updateCooperEstim);
  vmaInp?.addEventListener('input', sync);
  vo2Inp?.addEventListener('input', sync);
  // Délégation : les radios sont re-rendus à chaque affichage de la session
  document.addEventListener('change', e => {
    if (e.target.name === 'cooper-duration') sync();
  });
  sync();
}

$('#save-session').addEventListener('click', () => {
  const values = {};
  let any = false;
  // Demi-Cooper : la distance 6 min est stockée en équivalent 12 min (×2)
  const cooperDuration = cooperSelectedDuration() === '6' ? 2 : 1;
  $$('#session-fields input[data-test]').forEach(inp => {
    const v = inp.value.trim();
    if (v !== '' && !inp.classList.contains('invalid')) {
      let num = parseFloat(v.replace(',', '.'));
      if (isNaN(num)) return;
      if (inp.dataset.test === 'cooper') num = Math.round(num * cooperDuration);
      values[inp.dataset.test] = num;
      any = true;
    }
  });
  // Champs VMA / VO2max du bloc Cooper (hors #session-fields input[data-test]) :
  // on les persiste comme indicateurs dérivés de la session cardio.
  if (currentSessionType === 'cardio') {
    const vmaRaw = $('#cooper-vma')?.value.trim();
    const vo2Raw = $('#cooper-vo2')?.value.trim();
    const vma = vmaRaw ? parseFloat(vmaRaw.replace(',', '.')) : null;
    const vo2 = vo2Raw ? parseFloat(vo2Raw.replace(',', '.')) : null;
    if (vma != null && !isNaN(vma)) { values.vma = Math.round(vma * 10) / 10; any = true; }
    if (vo2 != null && !isNaN(vo2)) { values.vo2max = Math.round(vo2 * 10) / 10; any = true; }
  }
  if (!any) { alert('Aucune valeur saisie.'); return; }
  const session = { date: $('#session-date').value || todayStr(), type: currentSessionType, values };
  // fusion avec session existante à la même date ? Non : on garde tout l'historique.
  addSession(session);
  const msg = $('#session-saved-msg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
  $$('#session-fields input').forEach(i => { i.value = ''; i.classList.remove('invalid'); });
  // Efface aussi les champs VMA/VO2max du bloc Cooper
  ['#cooper-vma', '#cooper-vo2'].forEach(sel => { const el = $(sel); if (el) el.value = ''; });
  const estimBox = $('#cooper-estim-result'); if (estimBox) { estimBox.classList.add('hidden'); estimBox.innerHTML = ''; }
  updateSaveState();
  renderLastSession();
  renderDashboard(); // met à jour l'historique du score global
  recordIFG(); // idem pour l'indice FitTrack Global
  renderIMC(); renderRiskSummary(); // le poids saisi peut changer l'IMC et les facteurs de risque
  renderReferenceTable(); // VMA/VO2max peuvent avoir changé
});

// ---------- Chronomètre ----------
let chronoTimer = null, chronoStart = 0, chronoElapsed = 0, chronoTargetId = null;

// ---------- Timer compte à rebours générique ----------
// Utilisé par les tests à durée fixe : chaise 30 s (compter les répétitions),
// escalier 3 min (montées à 24/min), Cooper 12 min (ou 6 min demi-Cooper).
// Le timer démarre/pause/reset manuellement, s'arrête seul à 00:00 avec un bip.
const DEFAULT_TIMER_MS = 30000; // 30 s (chaise)
let timerId = null, timerRemaining = DEFAULT_TIMER_MS, timerRunning = false, timerDuration = DEFAULT_TIMER_MS;
let timerLabel = 'Compte à rebours';
// Chaînage automatique : quand un timer se termine, lance le suivant (ex. escalier :
// 3 min de montées → 1 min de pause avant la mesure du pouls). { ms, label } ou null.
let timerNext = null;
function timerFmt(ms) {
  const total = Math.max(0, ms);
  const m = Math.floor(total / 60000);
  const s = (total % 60000) / 1000;
  return m > 0
    ? `${m}:${String(Math.floor(s)).padStart(2, '0')},${Math.floor((s % 1) * 10)}`
    : `${s.toFixed(1).replace('.', ',')} s`;
}
function timerBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 880;
    g.gain.setValueAtTime(0.25, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.5);
    setTimeout(() => ctx.close(), 600);
  } catch { /* audio indisponible : pas de bip */ }
}
function timerUpdate() {
  timerRemaining -= 100;
  if (timerRemaining <= 0) {
    timerRemaining = 0;
    timerStop(true);
    // Chaînage : si un timer suivant est prévu, le lancer automatiquement
    if (timerNext) {
      const next = timerNext;
      timerNext = null;
      openTimer(next.ms, next.label, false);
      timerToggle(); // démarre tout de suite
    }
  }
  $('#timer-display').textContent = timerFmt(timerRemaining);
}
function timerSetBtn(running) {
  const b = $('#timer-startstop');
  b.textContent = running ? '⏸' : '▶';
  b.title = running ? 'Pause' : 'Démarrer le compte à rebours';
  b.classList.toggle('running', running);
}
function timerStop(finished = false) {
  clearInterval(timerId);
  timerId = null;
  timerRunning = false;
  timerSetBtn(false);
  $('#timer').classList.toggle('finished', finished);
  if (finished) timerBeep();
}
function timerToggle() {
  if (timerId) {
    clearInterval(timerId); timerId = null; timerRunning = false;
    timerSetBtn(false);
    $('#timer').classList.remove('finished');
  } else {
    timerRunning = true;
    timerSetBtn(true);
    $('#timer').classList.remove('finished');
    timerId = setInterval(timerUpdate, 100);
  }
}
function timerReset() {
  clearInterval(timerId); timerId = null; timerRunning = false;
  timerRemaining = timerDuration;
  $('#timer-display').textContent = timerFmt(timerRemaining);
  timerSetBtn(false);
  $('#timer').classList.remove('finished');
  timerNext = null; // reset annule aussi le chaînage prévu
}
// Ouvre le timer pour un test donné : durée en ms, libellé, et mode de saisie de la durée.
// durationEditable=true → l'utilisateur peut régler la durée (en minutes) avant de lancer.
function openTimer(durationMs, label, durationEditable = false, next = null) {
  const el = $('#timer');
  if (!el) return;
  timerDuration = durationMs;
  timerLabel = label;
  timerNext = next; // chaînage auto à la fin (ex. escalier → pouls 1 min)
  $('#timer-label').textContent = label;
  // Indice visuel : un timer suivant est prévu (ex. « puis 1 min avant le pouls »)
  const nextHint = $('#timer-next-hint');
  if (nextHint) {
    if (next) {
      nextHint.textContent = `puis ${timerFmt(next.ms)} — ${next.label}`;
      nextHint.classList.remove('hidden');
    } else {
      nextHint.classList.add('hidden');
    }
  }
  $('#timer-duration-wrap').classList.toggle('hidden', !durationEditable);
  const durInput = $('#timer-duration-min');
  if (durationEditable) durInput.value = Math.round(durationMs / 60000);
  el.classList.remove('hidden');
  // Si le chrono est aussi ouvert, on décale le timer au-dessus
  if (!$('#chrono').classList.contains('hidden')) el.classList.add('above-chrono');
  if (!timerRunning) {
    timerRemaining = timerDuration;
    $('#timer-display').textContent = timerFmt(timerRemaining);
  }
}
$('#timer-startstop').addEventListener('click', timerToggle);
$('#timer-reset').addEventListener('click', timerReset);
$('#timer-close').addEventListener('click', () => {
  timerStop();
  timerNext = null; // fermeture annule aussi le chaînage prévu
  const el = $('#timer');
  el.classList.add('hidden');
  el.classList.remove('above-chrono');
});
// Changement de la durée (tests à durée réglable, ex. escalier 3 min par défaut)
document.addEventListener('change', e => {
  if (e.target.id !== 'timer-duration-min') return;
  const min = parseFloat(e.target.value);
  if (isNaN(min) || min <= 0) return;
  timerDuration = Math.round(min * 60000);
  if (!timerRunning) {
    timerRemaining = timerDuration;
    $('#timer-display').textContent = timerFmt(timerRemaining);
  }
});
document.addEventListener('click', e => {
  const b = e.target.closest('.timer-btn');
  if (!b) return;
  const dur = parseInt(b.dataset.timerMs || '30000', 10);
  const editable = b.dataset.timerEditable === '1';
  // data-timer-next-ms + data-timer-next-label : timer lancé automatiquement à la fin
  // (ex. escalier : 3 min de montées → 1 min avant la mesure du pouls)
  const nextMs = parseInt(b.dataset.timerNextMs || '0', 10);
  const next = nextMs > 0
    ? { ms: nextMs, label: b.dataset.timerNextLabel || 'Suite du test' }
    : null;
  openTimer(dur, b.dataset.timerLabel || 'Compte à rebours', editable, next);
});
function chronoFmt(ms) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
// Chaque bouton ⏱ ouvre un chrono dédié à son test (cible mémorisée, plus de sélecteur)
function openChrono(targetId) {
  chronoTargetId = targetId;
  const t = byId(targetId);
  $('#chrono-target-name').textContent = t ? t.name : '';
  $('#chrono').classList.remove('hidden');
  // Si le timer est aussi ouvert, on le décale au-dessus du chrono
  if (!$('#timer').classList.contains('hidden')) $('#timer').classList.add('above-chrono');
}
function chronoUpdate() {
  chronoElapsed = Date.now() - chronoStart;
  $('#chrono-display').textContent = chronoFmt(chronoElapsed);
}
function chronoSetToggleBtn(running) {
  const b = $('#chrono-startstop');
  b.textContent = running ? '⏹' : '▶';
  b.title = running ? 'Arrêter' : 'Démarrer';
  b.classList.toggle('running', running);
}
function chronoToggle() {
  if (chronoTimer) {
    clearInterval(chronoTimer); chronoTimer = null;
    chronoSetToggleBtn(false);
  } else {
    chronoStart = Date.now() - chronoElapsed;
    chronoTimer = setInterval(chronoUpdate, 100);
    chronoSetToggleBtn(true);
  }
}
function chronoReset() {
  clearInterval(chronoTimer); chronoTimer = null; chronoElapsed = 0;
  $('#chrono-display').textContent = '00:00.0';
  chronoSetToggleBtn(false);
}
$('#chrono-startstop').addEventListener('click', chronoToggle);
$('#chrono-reset').addEventListener('click', chronoReset);
$('#chrono-send').addEventListener('click', () => {
  const inp = $(`#session-fields input[data-test="${chronoTargetId}"]`);
  if (inp) {
    inp.value = Math.round(chronoElapsed / 100) / 10;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
  $('#chrono').classList.add('hidden');
  $('#timer').classList.remove('above-chrono');
  chronoReset(); // le temps reporté est consommé : le chrono repart à zéro
});
document.addEventListener('click', e => {
  const b = e.target.closest('.chrono-btn');
  if (b) openChrono(b.dataset.chronoTarget);
});

// ---------- Onglet Analyse (IFG) ----------
const IFG_PALIERS = [
  { max: 20, color: 'var(--bad)', label: 'Faible' },
  { max: 40, color: 'var(--warn)', label: 'En dessous' },
  { max: 60, color: '#f9a825', label: 'En progrès' },
  { max: 80, color: '#9e9d24', label: 'Bon' },
  { max: 100, color: 'var(--ok)', label: 'Excellent' },
];

function ifgPalier(score) {
  return IFG_PALIERS.find(p => score <= p.max);
}

function ifgBarHtml(score) {
  const palier = ifgPalier(score);
  const fill = `linear-gradient(to right, var(--bad) 0%, var(--bad) 20%, var(--warn) 20%, var(--warn) 40%, #f9a825 40%, #f9a825 60%, #9e9d24 60%, #9e9d24 80%, var(--ok) 80%, var(--ok) 100%)`;
  return `<div class="score-bar" role="progressbar" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100" title="${score}/100">
    <div class="score-bar-track"><div class="score-bar-fill" style="width:${score}%;background:${fill}"></div></div>
    <div class="score-bar-labels small"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
  </div>`;
}

function renderAnalysis() {
  recordIFG();
  const profile = getProfile();
  const periodKey = (document.querySelector('input[name="ifg-period"]:checked') || {}).value || 'last';
  $('#ifg-period-label').textContent = ifgPeriodDesc(periodKey);
  const result = computeIFGPeriod(profile, periodKey);
  if (!result) {
    $('#ifg-content').innerHTML = '<p>Enregistrez des sessions de test pour calculer votre indice.</p>';
    $('#ifg-radar').innerHTML = '';
    $('#ifg-radar-legend').textContent = '';
    $('#ifg-strengths').innerHTML = '';
    $('#ifg-advice').style.display = 'none';
    $('#ifg-chart').innerHTML = '';
    $('#ifg-chart-stats').textContent = '';
    $('#ifg-trends').innerHTML = '';
    $('#ifg-scatter').innerHTML = '';
    return;
  }

  // 1. IFG + barre + delta vs mesure précédente (historique IFG, indépendant de la période choisie)
  const series = ifgSeries();
  const prev = series.length >= 2 ? series[series.length - 2].value : null;
  const delta = prev != null ? result.score - prev : null;
  const palier = ifgPalier(result.score);
  const deltaHtml = delta == null ? ''
    : delta > 0 ? `<span class="badge good">▲ +${delta} pts depuis la dernière mesure</span>`
    : delta < 0 ? `<span class="badge low">▼ ${delta} pts depuis la dernière mesure</span>`
    : `<span class="badge mid">= stable depuis la dernière mesure</span>`;
  const periodBadge = periodKey === 'last' ? ''
    : ` <span class="badge mid">${IFG_PERIODS[periodKey].label}</span>`;
  $('#ifg-content').innerHTML = `
    <p style="font-size:2em;font-weight:700;color:${palier.color}">${result.score}<span style="font-size:.6em"> /100</span>
      <span class="badge ${result.score >= 80 ? 'good' : result.score >= 60 ? 'mid' : 'low'}">${palier.label}</span>${periodBadge}</p>
    ${ifgBarHtml(result.score)}
    ${deltaHtml}
    <p class="small">Moyenne pondérée de 5 dimensions : cardio au repos &amp; métabolisme (30 %), endurance (20 %), force (20 %), équilibre &amp; mobilité (15 %), habitudes d'activité (15 %).</p>`;

  // 2. Radar des 5 dimensions (SVG)
  renderIfgRadar(result.dims);

  // 3. Points forts / faibles + conseil
  const sorted = result.dims.slice().sort((a, b) => b.score - a.score);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  $('#ifg-strengths').innerHTML = `
    <li>💪 <b>Point fort</b> : ${best.icon} ${best.label} — <b>${best.score}/100</b></li>
    <li>🎯 <b>À travailler</b> : ${worst.icon} ${worst.label} — <b>${worst.score}/100</b></li>`;
  const advice = $('#ifg-advice');
  if (worst.score < 60) {
    const tips = {
      cardio_rest: 'Priorisez la FC de repos et la tension artérielle : marchez 30 min/jour, limitez le sel, consultez si la tension reste élevée.',
      endurance: '2 séances de 20–30 min d\'endurance modérée par semaine (vélo, marche rapide, natation) font progresser vite.',
      strength: '2 séances de renforcement par semaine : pompes, gainage et chaise 30 s suffisent à démarrer.',
      balance: 'Travaillez l\'équilibre 5 min/jour (unipodal, yeux ouverts puis fermés) et la souplesse des jambes.',
      activity: 'Levez-vous toutes les heures et visez 150 min d\'activité modérée par semaine (marche comprise).',
    };
    advice.innerHTML = `💡 <b>Conseil</b> : ${tips[worst.key] || 'Travaillez cette dimension en priorité.'}`;
    advice.style.display = '';
  } else advice.style.display = 'none';

  // 4. Courbe d'évolution de l'IFG
  renderIfgChart(series);

  // 5. Tendances par dimension (vs 30 jours avant)
  renderIfgTrends(profile);

  // 6. Nuage de points IPAQ ↔ IFG
  renderIfgScatter();
}

// Changement de période de calcul de l'IFG (boutons radio) → re-rendu complet de l'onglet Analyse
document.querySelectorAll('input[name="ifg-period"]').forEach(r =>
  r.addEventListener('change', () => renderAnalysis()));

function renderIfgRadar(dims) {
  const W = 320, H = 280, CX = W / 2, CY = H / 2 + 6, R = 100;
  const n = IFG_DIMENSIONS.length;
  const angle = i => -Math.PI / 2 + i * 2 * Math.PI / n;
  const pt = (i, ratio) => `${CX + Math.cos(angle(i)) * R * ratio},${CY + Math.sin(angle(i)) * R * ratio}`;
  const dimByKey = Object.fromEntries(dims.map(d => [d.key, d]));
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:340px">`;
  // anneaux de fond 25/50/75/100
  for (const r of [0.25, 0.5, 0.75, 1]) {
    svg += `<polygon points="${IFG_DIMENSIONS.map((_, i) => pt(i, r)).join(' ')}" fill="none" stroke="var(--border)" stroke-width="1"/>`;
  }
  // axes + labels
  IFG_DIMENSIONS.forEach((d, i) => {
    svg += `<line x1="${CX}" y1="${CY}" x2="${pt(i, 1).split(',')[0]}" y2="${pt(i, 1).split(',')[1]}" stroke="var(--border)"/>`;
    const lx = CX + Math.cos(angle(i)) * (R + 26), ly = CY + Math.sin(angle(i)) * (R + 26);
    svg += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="11" fill="var(--text)">${d.icon} ${d.label.split(' ')[0]}</text>`;
  });
  // polygone des scores (dimensions manquantes ignorées : on trace sur les présentes)
  const present = IFG_DIMENSIONS.map((d, i) => ({ i, score: dimByKey[d.key]?.score })).filter(x => x.score != null);
  if (present.length >= 3) {
    const poly = present.map(x => pt(x.i, x.score / 100)).join(' ');
    svg += `<polygon points="${poly}" fill="var(--accent)" opacity="0.25" stroke="var(--accent)" stroke-width="2"/>`;
    present.forEach(x => {
      const [px, py] = pt(x.i, x.score / 100).split(',');
      svg += `<circle cx="${px}" cy="${py}" r="4" fill="var(--accent)"/>`;
    });
  }
  svg += '</svg>';
  $('#ifg-radar').innerHTML = svg;
  $('#ifg-radar-legend').innerHTML = dims.map(d =>
    `<div class="ifg-legend-item">${d.icon} ${d.label} : <b>${d.score}</b></div>`).join('');
}

function renderIfgChart(series) {
  const data = series;
  if (!data.length) { $('#ifg-chart').innerHTML = '<p class="small">Pas encore d\'historique.</p>'; $('#ifg-chart-stats').textContent = ''; return; }
  const W = 700, H = 220, PAD = 40;
  const xs = data.map(d => new Date(d.date).getTime());
  const minT = Math.min(...xs), maxT = Math.max(...xs);
  const rangeT = Math.max(maxT - minT, 86400000);
  const X = tm => PAD + (tm - minT) / rangeT * (W - 2 * PAD);
  const Y = v => H - PAD - v / 100 * (H - 2 * PAD);
  let svg = `<svg viewBox="0 0 ${W} ${H}">`;
  // zones 60 et 80
  svg += `<rect x="${PAD}" y="${Y(100)}" width="${W - 2 * PAD}" height="${Y(80) - Y(100)}" fill="var(--ok-bg)" opacity="0.7"/>`;
  svg += `<rect x="${PAD}" y="${Y(80)}" width="${W - 2 * PAD}" height="${Y(60) - Y(80)}" fill="var(--mid-bg)" opacity="0.7"/>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(80)}" y2="${Y(80)}" stroke="var(--ok)" stroke-dasharray="4 4"/>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(60)}" y2="${Y(60)}" stroke="var(--warn)" stroke-dasharray="2 4"/>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${H - PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  svg += `<line x1="${PAD}" x2="${PAD}" y1="${PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  const pts = data.map(d => `${X(new Date(d.date).getTime())},${Y(d.value)}`).join(' ');
  if (data.length > 1) svg += `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  data.forEach(d => {
    svg += `<circle cx="${X(new Date(d.date).getTime())}" cy="${Y(d.value)}" r="4" fill="var(--accent)"/>`;
    if (data.length <= 8 || d === data[0] || d === data[data.length - 1])
      svg += `<text x="${X(new Date(d.date).getTime())}" y="${H - PAD + 16}" text-anchor="middle" font-size="10" fill="var(--muted)">${d.date.slice(5)}</text>`;
  });
  svg += '</svg>';
  $('#ifg-chart').innerHTML = svg;
  const first = data[0].value, lastV = data[data.length - 1].value;
  const delta = lastV - first;
  $('#ifg-chart-stats').innerHTML = `Dernière valeur : <b>${lastV}/100</b> · Évolution depuis la 1re mesure : <b>${delta > 0 ? '+' : ''}${delta} pts</b>`;
}

// Tendance d'une dimension : compare la moyenne des sessions des 30 derniers jours
// à celle de la période précédente (mêmes mesures présentes dans les deux périodes)
function renderIfgTrends(profile) {
  const sessions = getSessions();
  if (!sessions.length) { $('#ifg-trends').innerHTML = '<p class="small">Aucune donnée.</p>'; return; }
  const today = new Date();
  const cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 30);
  const cutoffStr = cutoff.toISOString().slice(0, 10); // « 30 derniers jours » = date >= J-30
  const recent = sessions.filter(s => s.date >= cutoffStr);
  const previous = sessions.filter(s => s.date < cutoffStr);
  const avgDim = (sessList, dim) => {
    const vals = [];
    for (const s of sessList) {
      if (dim.key === 'endurance') {
        // Endurance : un seul indicateur par session (VMA > VO2max > Cooper > escalier),
        // dérivé si besoin — identique à la logique IFG pour éviter de compter 2 fois.
        const lv = {};
        for (const [k, v] of Object.entries(s.values || {})) {
          if (v != null && v !== '') lv[k] = { value: v, date: s.date };
        }
        const dVma = derivedVMA(lv);
        const dVo2 = derivedVO2(lv);
        if (dVma) lv.vma = { value: dVma.value };
        if (dVo2) lv.vo2max = { value: dVo2.value };
        const ind = enduranceIndicator(lv);
        if (ind) vals.push(SCORE_PTS[statusOf(byId(ind.id), ind.value, profile)]);
        continue;
      }
      for (const id of dim.tests) {
        const v = s.values?.[id];
        if (v != null && v !== '') vals.push(SCORE_PTS[statusOf(byId(id), v, profile)]);
      }
    }
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };
  let html = '<table><tr><th>Dimension</th><th>Score moyen (30 j)</th><th>Avant</th><th>Tendance</th></tr>';
  for (const d of IFG_DIMENSIONS) {
    const r = avgDim(recent, d), p = avgDim(previous, d);
    if (r == null && p == null) continue;
    let trend;
    if (r == null) trend = '<td class="muted">—</td>';
    else if (p == null) trend = '<td class="muted">nouveau</td>';
    else if (r > p + 2) trend = '<td class="up">▲ en hausse</td>';
    else if (r < p - 2) trend = '<td class="down">▼ en baisse</td>';
    else trend = '<td class="muted">= stable</td>';
    html += `<tr><td>${d.icon} ${d.label}</td><td><b>${r ?? '—'}</b></td><td>${p ?? '—'}</td>${trend}</tr>`;
  }
  $('#ifg-trends').innerHTML = html + '</table>';
}

// Nuage de points : IPAQ (X) ↔ IFG au moment de la mesure (Y)
// On recalcule l'IFG à chaque date de session où IPAQ est présent
function renderIfgScatter() {
  const sessions = getSessions().sort((a, b) => a.date < b.date ? -1 : 1);
  const ipaqDates = sessions.filter(s => s.values?.ipaq != null && s.values.ipaq !== '');
  if (ipaqDates.length < 2) { $('#ifg-scatter').innerHTML = '<p class="small">Effectuez au moins 2 questionnaires IPAQ pour voir la corrélation.</p>'; return; }
  const points = [];
  for (const s of ipaqDates) {
    // IFG recalculé avec les données disponibles à cette date
    const upTo = sessions.filter(x => x.date <= s.date);
    const lv = {};
    for (const sess of upTo) for (const [k, v] of Object.entries(sess.values || {})) {
      if (v != null && v !== '') lv[k] = { value: v, date: sess.date };
    }
    const snapshotSessions = store.get('sessions', []);
    store.set('sessions', upTo);
    const res = computeIFG(getProfile());
    store.set('sessions', snapshotSessions);
    if (res) points.push({ date: s.date, ipaq: s.values.ipaq, ifg: res.score });
  }
  if (points.length < 2) { $('#ifg-scatter').innerHTML = '<p class="small">Données insuffisantes.</p>'; return; }

  const W = 420, H = 260, PAD = 44;
  const xs = points.map(p => p.ipaq), ys = points.map(p => p.ifg);
  let xLo = Math.min(...xs), xHi = Math.max(...xs);
  let yLo = Math.min(...ys), yHi = Math.max(...ys);
  const xPad = (xHi - xLo) * 0.1 || 500, yPad = (yHi - yLo) * 0.1 || 5;
  xLo -= xPad; xHi += xPad; yLo -= yPad; yHi += yPad;
  const X = v => PAD + (v - xLo) / (xHi - xLo) * (W - 2 * PAD);
  const Y = v => H - PAD - (v - yLo) / (yHi - yLo) * (H - 2 * PAD);
  let svg = `<svg viewBox="0 0 ${W} ${H}">`;
  // repère OMS 600 MET-min
  if (xLo <= 600 && 600 <= xHi)
    svg += `<line x1="${X(600)}" x2="${X(600)}" y1="${PAD}" y2="${H - PAD}" stroke="var(--ok)" stroke-dasharray="4 4"/><text x="${X(600)}" y="${PAD - 4}" text-anchor="middle" font-size="10" fill="var(--ok)">600 (OMS)</text>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${H - PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  svg += `<line x1="${PAD}" x2="${PAD}" y1="${PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  // axes labels
  svg += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--muted)">IPAQ (MET-min/sem)</text>`;
  svg += `<text x="12" y="${H / 2}" text-anchor="middle" font-size="11" fill="var(--muted)" transform="rotate(-90 12 ${H / 2})">IFG /100</text>`;
  points.forEach(p => {
    svg += `<circle cx="${X(p.ipaq)}" cy="${Y(p.ifg)}" r="5" fill="var(--accent)"><title>${p.date.split('-').reverse().join('/')} : IPAQ ${p.ipaq} · IFG ${p.ifg}</title></circle>`;
  });
  svg += '</svg>';
  $('#ifg-scatter').innerHTML = svg;
}

// ---------- Historique & graphiques ----------
function renderHistory() {
  // sélecteur de métrique : score global en haut de liste s'il a un historique
  const sel = $('#chart-metric');
  const scores = scoreSeries();
  const withData = TESTS.filter(t => t.id !== 'vma' && t.id !== 'vo2max' && seriesOf(t.id).length > 0);
  const options = [];
  if (scores.length) options.push('<option value="__score__">★ Score global (/100)</option>');
  options.push(...withData.map(t => `<option value="${t.id}">${testNum(t.id)}${t.name}</option>`));
  if (options.length) {
    sel.innerHTML = options.join('');
    drawChart(sel.value);
  } else {
    sel.innerHTML = '<option value="">— aucune donnée —</option>';
    $('#chart').innerHTML = '<p class="small">Enregistrez une session pour voir les graphiques.</p>';
    $('#chart-stats').textContent = '';
  }
  renderHistoryTable();
}

$('#chart-metric').addEventListener('change', () => drawChart($('#chart-metric').value));

function drawChart(testId) {
  // Le score global n'est pas un test : rendu dédié (échelle 0–100, pas de statut)
  if (testId === '__score__') return drawScoreChart();
  const t = byId(testId);
  const data = seriesOf(testId);
  if (!t || data.length === 0) return;
  const profile = getProfile();
  const { good, mid, rev } = thresholds(t, profile);

  const W = 700, H = 260, PAD = 40;
  const xs = data.map(d => new Date(d.date).getTime());
  const minT = Math.min(...xs), maxT = Math.max(...xs);
  const rangeT = Math.max(maxT - minT, 86400000);
  const vals = data.map(d => d.value);
  let lo = Math.min(...vals, mid ?? Infinity, good ?? Infinity);
  let hi = Math.max(...vals, mid ?? -Infinity, good ?? -Infinity);
  const pad = (hi - lo) * 0.15 || 1;
  lo -= pad; hi += pad;
  const X = tm => PAD + (tm - minT) / rangeT * (W - 2 * PAD);
  const Y = v => H - PAD - (v - lo) / (hi - lo) * (H - 2 * PAD);

  let svg = `<svg viewBox="0 0 ${W} ${H}">`;
  // zones de repère
  if (good != null && mid != null) {
    const a = Y(Math.max(good, mid)), b = Y(Math.min(good, mid));
    svg += `<rect x="${PAD}" y="${a}" width="${W - 2 * PAD}" height="${Math.max(b - a, 0)}" fill="var(--mid-bg)" opacity="0.7"/>`;
    const yGood = rev ? Y(good) : Y(good);
    const yEdge = rev ? lo : hi;
    svg += `<rect x="${PAD}" y="${rev ? Y(hi) : Y(hi)}" width="${W - 2 * PAD}" height="${Math.max(Y(good) - (rev ? Y(hi) : Y(hi)), 0)}" fill="var(--ok-bg)" opacity="0.7"/>`;
  }
  // lignes repères
  if (good != null) svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(good)}" y2="${Y(good)}" stroke="var(--ok)" stroke-dasharray="4 4"/><text x="${W - PAD}" y="${Y(good) - 4}" text-anchor="end" font-size="11" fill="var(--ok)">objectif ${good}${t.unit}</text>`;
  if (mid != null) svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(mid)}" y2="${Y(mid)}" stroke="var(--warn)" stroke-dasharray="2 4"/><text x="${W - PAD}" y="${Y(mid) - 4}" text-anchor="end" font-size="11" fill="var(--warn)">seuil ${mid}${t.unit}</text>`;
  // axes
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${H - PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  svg += `<line x1="${PAD}" x2="${PAD}" y1="${PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  // points + segments
  const pts = data.map(d => `${X(new Date(d.date).getTime())},${Y(d.value)}`).join(' ');
  if (data.length > 1) svg += `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  data.forEach(d => {
    svg += `<circle cx="${X(new Date(d.date).getTime())}" cy="${Y(d.value)}" r="4" fill="var(--accent)"/>`;
  });
  // labels date
  data.forEach((d, i) => {
    if (data.length <= 8 || i === 0 || i === data.length - 1)
      svg += `<text x="${X(new Date(d.date).getTime())}" y="${H - PAD + 16}" text-anchor="middle" font-size="10" fill="var(--muted)">${d.date.slice(5)}</text>`;
  });
  svg += '</svg>';
  $('#chart').innerHTML = svg;

  // stats
  const first = data[0].value, lastV = data[data.length - 1].value;
  const delta = lastV - first;
  const pct = (delta / Math.max(first, 1) * 100).toFixed(1);
  const st = statusOf(t, lastV, profile);
  $('#chart-stats').innerHTML = `Dernière valeur : <b>${lastV} ${t.unit}</b> ${st ? STATUS_LABEL[st] : ''} · Évolution depuis la 1re mesure : <b>${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${t.unit} (${pct} %)</b>`;
}

// Graphique dédié au score global : échelle fixe 0–100, repères 60/80, pas de statut individuel
function drawScoreChart() {
  const data = scoreSeries();
  if (data.length === 0) return;

  const W = 700, H = 260, PAD = 40;
  const xs = data.map(d => new Date(d.date).getTime());
  const minT = Math.min(...xs), maxT = Math.max(...xs);
  const rangeT = Math.max(maxT - minT, 86400000);
  const lo = 0, hi = 100; // échelle fixe
  const X = tm => PAD + (tm - minT) / rangeT * (W - 2 * PAD);
  const Y = v => H - PAD - (v - lo) / (hi - lo) * (H - 2 * PAD);

  let svg = `<svg viewBox="0 0 ${W} ${H}">`;
  // zones de repère : ≥ 80 bon, 60–79 moyen, < 60 faible
  svg += `<rect x="${PAD}" y="${Y(100)}" width="${W - 2 * PAD}" height="${Y(80) - Y(100)}" fill="var(--ok-bg)" opacity="0.7"/>`;
  svg += `<rect x="${PAD}" y="${Y(80)}" width="${W - 2 * PAD}" height="${Y(60) - Y(80)}" fill="var(--mid-bg)" opacity="0.7"/>`;
  // lignes repères
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(80)}" y2="${Y(80)}" stroke="var(--ok)" stroke-dasharray="4 4"/><text x="${W - PAD}" y="${Y(80) - 4}" text-anchor="end" font-size="11" fill="var(--ok)">80 — bon</text>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(60)}" y2="${Y(60)}" stroke="var(--warn)" stroke-dasharray="2 4"/><text x="${W - PAD}" y="${Y(60) - 4}" text-anchor="end" font-size="11" fill="var(--warn)">60 — seuil</text>`;
  // axes
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${H - PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  svg += `<line x1="${PAD}" x2="${PAD}" y1="${PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  // points + segments
  const pts = data.map(d => `${X(new Date(d.date).getTime())},${Y(d.value)}`).join(' ');
  if (data.length > 1) svg += `<polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/>`;
  data.forEach(d => {
    svg += `<circle cx="${X(new Date(d.date).getTime())}" cy="${Y(d.value)}" r="4" fill="var(--accent)"/>`;
  });
  // labels date
  data.forEach((d, i) => {
    if (data.length <= 8 || i === 0 || i === data.length - 1)
      svg += `<text x="${X(new Date(d.date).getTime())}" y="${H - PAD + 16}" text-anchor="middle" font-size="10" fill="var(--muted)">${d.date.slice(5)}</text>`;
  });
  svg += '</svg>';
  $('#chart').innerHTML = svg;

  // stats
  const first = data[0].value, lastV = data[data.length - 1].value;
  const delta = lastV - first;
  const pct = (delta / Math.max(first, 1) * 100).toFixed(1);
  const st = lastV >= 80 ? 'good' : lastV >= 60 ? 'mid' : 'low';
  $('#chart-stats').innerHTML = `Dernière valeur : <b>${lastV} /100</b> <span class="badge ${st}">${STATUS_LABEL[st]}</span> · Évolution depuis la 1re mesure : <b>${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts (${pct} %)</b>`;
}

function renderHistoryTable() {
  const sessions = getSessions().slice().reverse();
  const el = $('#history-table');
  if (!sessions.length) { el.innerHTML = '<p class="small">Aucune mesure.</p>'; return; }
  let html = '<table><tr><th>Date</th><th>Type</th><th>Résultats</th></tr>';
  for (const s of sessions) {
    const results = Object.entries(s.values || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([id, v]) => {
        const t = byId(id) || { name: id, unit: '' };
        return `${t.name} : <b>${v}</b> ${t.unit}
          <button class="edit-btn" title="Corriger cette mesure" data-edit-id="${s.id || ''}" data-edit-date="${s.date}" data-edit-test="${id}">✏️</button>`;
      })
      .join(' · ');
    html += `<tr><td>${s.date}</td><td>${GROUP_LABELS[s.type] || s.type}</td><td>${results}</td></tr>`;
  }
  html += '</table>';
  el.innerHTML = html;
}

// ---------- Exports ----------
function download(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
// En-tête profil (métadonnées) : lignes préfixées « # » avant les sessions
const PROFILE_CSV_KEYS = [
  ['sex', 'Sexe', p => p.sex === 'F' ? 'Femme' : 'Homme'],
  ['birthYear', 'Année de naissance', p => p.birthYear ?? ''],
  ['height', 'Taille (cm)', p => p.height ?? ''],
  ['smoke', 'Tabagisme', p => p.smoke ? 'oui' : 'non'],
  ['cardiacHistory', 'Antécédents cardiaques', p => p.cardiacHistory ? 'oui' : 'non'],
  ['familyHistory', 'Antécédents familiaux précoces', p => p.familyHistory ? 'oui' : 'non'],
  ['hypertension', 'Hypertension artérielle connue', p => p.hypertension ? 'oui' : 'non'],
  ['diabetes', 'Diabète connu', p => p.diabetes ? 'oui' : 'non'],
  ['dyslipidemia', 'Dyslipidémie / statine', p => p.dyslipidemia ? 'oui' : 'non'],
  ['alcohol', 'Alcool (verres/semaine)', p => p.alcohol ?? ''],
  ['stress', 'Stress chronique / dépression', p => p.stress === 'yes' ? 'oui' : (p.stress === 'no' ? 'non' : '')],
];
function profileCsvLines(profile) {
  if (!profile) return [];
  return PROFILE_CSV_KEYS
    .filter(([key]) => profile[key] != null && profile[key] !== '')
    .map(([key, label, fmt]) => `# profil;${label};${fmt(profile)}`);
}

$('#export-csv').addEventListener('click', () => {
  const ids = TESTS.filter(t => t.id !== 'vma' && t.id !== 'vo2max').map(t => t.id);
  const head = ['date', 'type', ...ids.map(id => byId(id).name)].join(';');
  const lines = getSessions().map(s =>
    [s.date, GROUP_LABELS[s.type], ...ids.map(id => s.values?.[id] ?? '')].join(';'));
  download([...profileCsvLines(getProfile()), head, ...lines].join('\n'), 'fittrack_export.csv', 'text/csv');
});
$('#export-json').addEventListener('click', () => {
  download(JSON.stringify({
    profile: getProfile(),
    sessions: getSessions(),
    scoreHistory: store.get('scoreHistory', []),
    ifgHistory: store.get('ifgHistory', []),
  }, null, 2), 'fittrack_export.json', 'application/json');
});

// ---------- Import (JSON / CSV) ----------
// Fusionne le fichier avec les données actuelles : profil écrasé si présent dans
// le fichier, sessions fusionnées par (date, type) — la valeur du fichier l'emporte.
function showImportMsg(text, ok = true) {
  const el = $('#import-msg');
  el.textContent = text;
  el.className = ok ? 'ok' : 'err';
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 4000);
}

function applyImportedData(data) {
  if (!data || typeof data !== 'object') throw new Error('Fichier invalide.');

  let imported = 0;
  if (data.profile && typeof data.profile === 'object') {
    const cur = getProfile() || {};
    store.set('profile', { ...cur, ...data.profile });
    imported++;
  }
  if (Array.isArray(data.sessions)) {
    const sessions = getSessions();
    const index = new Map(sessions.map((s, i) => [s.date + '|' + s.type, i]));
    for (const s of data.sessions) {
      if (!s || !s.date || !s.type) continue;
      const key = s.date + '|' + s.type;
      if (index.has(key)) {
        const i = index.get(key);
        sessions[i] = { ...sessions[i], ...s, values: { ...sessions[i].values, ...s.values } };
      } else {
        if (!s.id) s.id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        sessions.push(s);
        index.set(key, sessions.length - 1);
      }
    }
    sessions.sort((a, b) => a.date < b.date ? -1 : 1);
    store.set('sessions', sessions);
    imported += data.sessions.length;
  }
  if (Array.isArray(data.scoreHistory)) {
    store.set('scoreHistory', mergeHistory(store.get('scoreHistory', []), data.scoreHistory));
    imported += data.scoreHistory.length;
  }
  if (Array.isArray(data.ifgHistory)) {
    store.set('ifgHistory', mergeHistory(store.get('ifgHistory', []), data.ifgHistory));
    imported += data.ifgHistory.length;
  }
  if (!imported) throw new Error('Aucune donnée reconnue (profil, sessions, historiques).');

  // Rafraîchit l'affichage
  renderProfileForm(); renderReferenceTable();
  if ($('#view-dashboard').classList.contains('active')) renderDashboard();
  if ($('#view-history').classList.contains('active')) renderHistory();
  if ($('#view-analysis').classList.contains('active')) renderAnalysis();
  return imported;
}

function mergeHistory(cur, inc) {
  const byDate = new Map(cur.map(h => [h.date, h]));
  for (const h of inc) { if (h && h.date) byDate.set(h.date, h); }
  return Array.from(byDate.values()).sort((a, b) => a.date < b.date ? -1 : 1);
}

function parseImportCsv(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const data = { sessions: [] };
  let head = null;
  for (const line of lines) {
    if (line.startsWith('#')) {
      // Métadonnée profil : « # profil;Champ;valeur »
      const parts = line.slice(1).split(';');
      if (parts[0].trim() !== 'profil' || parts.length < 3) continue;
      if (!data.profile) data.profile = {};
      const label = parts[1].trim(), value = parts.slice(2).join(';').trim();
      const row = PROFILE_CSV_KEYS.find(([, l]) => l === label);
      if (!row) continue;
      const [key] = row;
      if (key === 'sex') data.profile.sex = value === 'Femme' ? 'F' : 'H';
      else if (key === 'smoke' || key === 'cardiacHistory' || key === 'familyHistory'
        || key === 'hypertension' || key === 'diabetes' || key === 'dyslipidemia') data.profile[key] = value === 'oui';
      else if (key === 'stress') data.profile.stress = value === 'oui' ? 'yes' : (value === 'non' ? 'no' : null);
      else data.profile[key] = value === '' ? null : Number(value);
      continue;
    }
    const cols = line.split(';');
    if (!head) { head = cols; continue; }
    const typeLabel = cols[1];
    const type = Object.keys(GROUP_LABELS).find(k => GROUP_LABELS[k] === typeLabel) || typeLabel;
    const values = {};
    head.slice(2).forEach((name, i) => {
      const id = TESTS.find(t => t.name === name)?.id;
      const raw = (cols[i + 2] ?? '').trim();
      if (id && raw !== '') values[id] = Number(raw);
    });
    data.sessions.push({ date: cols[0], type, values });
  }
  return data;
}

$('#import-btn').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const text = String(reader.result);
      const data = file.name.toLowerCase().endsWith('.csv') ? parseImportCsv(text) : JSON.parse(text);
      const n = applyImportedData(data);
      showImportMsg(`✅ Import réussi : ${n} élément(s) fusionné(s).`);
    } catch (err) {
      showImportMsg(`❌ Import impossible : ${err.message || 'fichier illisible'}`, false);
    }
  };
  reader.onerror = () => showImportMsg('❌ Lecture du fichier impossible.', false);
  reader.readAsText(file);
});

// ---------- Paramètres (onglet ⚙️) ----------
// Le sélecteur de thème vit dans l'onglet Paramètres : toujours initialisé,
// même sans profil (le thème est indépendant des données personnelles).
function renderSettings() {
  const themeRadio = document.querySelector(`input[name="theme"][value="${getTheme()}"]`);
  if (themeRadio) themeRadio.checked = true;
}

// ---------- Profil ----------
function renderProfileForm() {
  const p = getProfile();
  if (!p) return;
  $('#p-sex').value = p.sex || 'H';
  $('#p-birth').value = p.birthYear || '';
  $('#p-height').value = p.height || '';
  $('#p-smoke').checked = !!p.smoke;
  $('#p-history').checked = !!p.cardiacHistory;
  $('#p-family').checked = !!p.familyHistory;
  $('#p-hypertension').checked = !!p.hypertension;
  $('#p-diabetes').checked = !!p.diabetes;
  $('#p-dyslipidemia').checked = !!p.dyslipidemia;
  $('#p-alcohol').value = p.alcohol ?? '';
  $('#p-stress').value = p.stress || '';
  renderIMC();
  renderRiskSummary();
}

// Sélecteur de thème (Système / Clair / Sombre)
document.addEventListener('change', e => {
  if (e.target.name !== 'theme') return;
  setTheme(e.target.value);
});

$('#save-profile').addEventListener('click', () => {
  const p = {
    sex: $('#p-sex').value,
    birthYear: parseInt($('#p-birth').value) || null,
    height: parseFloat($('#p-height').value) || null,
    smoke: $('#p-smoke').checked,
    cardiacHistory: $('#p-history').checked,
    familyHistory: $('#p-family').checked,
    hypertension: $('#p-hypertension').checked,
    diabetes: $('#p-diabetes').checked,
    dyslipidemia: $('#p-dyslipidemia').checked,
    alcohol: parseInt($('#p-alcohol').value) || 0,
    stress: $('#p-stress').value || null,
  };
  store.set('profile', p);
  const msg = $('#profile-saved-msg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
  renderIMC();
  renderRiskSummary();
  renderReferenceTable();
});

function renderReferenceTable() {
  const profile = getProfile();
  let html = '<table><tr><th>Test</th><th>Bon</th><th>Moyen</th><th>Faible</th></tr>';
  for (const t of TESTS) {
    if (t.good == null || t.id === 'vma' || t.id === 'vo2max') continue; // rendus plus bas (avec valeur courante)
    const { good, mid, rev } = thresholds(t, profile);
    html += `<tr><td><span class="test-num">${testNum(t.id)}</span>${t.name}</td><td>${rev ? '≤ ' : '≥ '}${good}</td><td>${rev ? '≤ ' : '≥ '}${mid}</td><td>${rev ? '> ' : '< '}${mid} ${t.unit}</td></tr>`;
  }
  // Indicateurs dérivés VMA / VO2max : repères avec la dernière valeur connue
  const lv = latestValues();
  for (const id of ['vma', 'vo2max']) {
    const t = byId(id);
    if (!t) continue;
    const { good, mid } = thresholds(t, profile);
    const cur = lv[id]?.value;
    const curTxt = cur != null
      ? ` <span class="small">(vous : <b>${fmt1(cur)}</b> ${t.unit}${lv[id].derived === 'cooper' ? ' · estimé Cooper' : ''})</span>`
      : ' <span class="small">(aucune mesure Cooper)</span>';
    html += `<tr><td><span class="test-num">${testNum(id)}</span>${t.name}${curTxt}</td><td>≥ ${good}</td><td>≥ ${mid}</td><td>&lt; ${mid} ${t.unit}</td></tr>`;
  }
  html += '</table>';
  $('#reference-table').innerHTML = html;
}

$('#wipe-data').addEventListener('click', () => {
  if (confirm('Effacer TOUTES les données (profil + mesures) ? Action irréversible.')) {
    Object.keys(localStorage).filter(k => k.startsWith('ft_')).forEach(k => localStorage.removeItem(k));
    renderProfileForm(); renderReferenceTable();
    if ($('#view-history').classList.contains('active')) renderHistory();
    alert('Données effacées.');
  }
});

// ---------- Export PDF (fiche de score imprimable) ----------
$('#export-pdf').addEventListener('click', () => {
  const profile = getProfile();
  const lv = latestValues();
  const sessions = getSessions();
  if (!sessions.length) { alert('Aucune donnée à exporter.'); return; }

  let rows = '';
  for (const t of TESTS) {
    const v = lv[t.id];
    if (!v) continue;
    const st = statusOf(t, v.value, profile);
    rows += `<tr><td>${t.name}</td><td>${v.value} ${t.unit}</td><td>${v.date}</td><td>${st ? STATUS_LABEL[st] : '—'}</td></tr>`;
  }

  const result = computeGlobalScore(profile);
  const score = result ? result.score : null;

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
  <title>FitTrack — Fiche de score</title>
  <style>
    body { font-family: system-ui, sans-serif; color: #222; margin: 30px; }
    h1 { color: #1F4E79; margin-bottom: 2px; }
    .sub { color: #666; margin-top: 0; }
    .score { font-size: 2em; font-weight: 700; color: #1F4E79; margin: 10px 0; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; font-size: .95em; }
    th, td { border: 1px solid #c9d6e2; padding: 6px 10px; text-align: left; }
    th { background: #1F4E79; color: #fff; }
    @media print { body { margin: 10mm; } }
  </style></head><body>
  <h1>Fiche de score — FitTrack</h1>
  <p class="sub">Édité le ${new Date().toLocaleDateString('fr-FR')}${profile ? ` · ${profile.sex === 'H' ? 'Homme' : 'Femme'}${profile.birthYear ? ', ' + (new Date().getFullYear() - profile.birthYear) + ' ans' : ''}` : ''}</p>
  ${score != null ? `<div class="score">Score global : ${score}/100</div>` : ''}
  <table><tr><th>Test</th><th>Dernière valeur</th><th>Date</th><th>Statut</th></tr>${rows}</table>
  <p class="sub" style="font-size:.8em">Logique principale : comparaison à soi-même dans le temps. Un indicateur dégradé sur 2 sessions consécutives doit alerter.</p>
  <script>window.onload = () => setTimeout(() => window.print(), 200);</` + `script>
  </body></html>`;

  const w = window.open('', '_blank');
  if (!w) { alert('Autorisez les pop-ups pour générer le PDF.'); return; }
  w.document.write(html);
  w.document.close();
});

// ---------- Init ----------
// Enregistrement du service worker (PWA) + inscription au PeriodicSync (rappels app fermée)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    // PeriodicSync : rappel quotidien même quand l'app est fermée (Android/desktop)
    if ('periodicSync' in reg) {
      reg.periodicSync.register('fittrack-reminder', { minInterval: 24 * 60 * 60 * 1000 }).catch(() => {});
    }
  }).catch(() => {});
}

// Onboarding au premier lancement
if (!store.get('profile', null) && !store.get('onboarded', false)) {
  $('#onboarding').classList.remove('hidden');
}
$('#onboarding-go').addEventListener('click', () => {
  $('#onboarding').classList.add('hidden');
  store.set('onboarded', true);
  showView('profile');
});
$('#onboarding-skip').addEventListener('click', () => {
  $('#onboarding').classList.add('hidden');
  store.set('onboarded', true);
});

$('#session-date').value = todayStr();
renderSessionFields();
renderProfileForm();
renderReferenceTable();
renderSettings();
renderDashboard();

// ---------- Rappels de re-test (notifications) ----------
// Principe : setTimeout pour l'heure choisie quand l'app est ouverte ;
// PeriodicSync (service worker) pour le rappel même app fermée (Android/desktop).
// Le SW lit les groupes dus depuis un cache alimenté par la page.
const REMIND_KEY = 'reminders'; // { enabled, hour, lastShown: 'YYYY-MM-DD' }
function getReminders() { return store.get(REMIND_KEY, { enabled: false, hour: 9, lastShown: null }); }

let remindTimer = null;

// Envoie les groupes dus au service worker (pour le PeriodicSync hors-ligne)
function syncRemindersToSW() {
  if (!('serviceWorker' in navigator)) return;
  const reg = navigator.serviceWorker.controller || navigator.serviceWorker.ready?.then?.(r => r);
  if (!reg || !reg.then) return;
  reg.then(r => r && r.active && r.active.postMessage({
    type: 'reminders-data',
    due: dueGroups().filter(d => d.due).map(d => d.label),
    enabled: getReminders().enabled,
  })).catch(() => {});
}

// Programme le prochain rappel à l'heure choisie (aujourd'hui si l'heure est passée → demain)
function scheduleReminder() {
  clearTimeout(remindTimer);
  const cfg = getReminders();
  if (!cfg.enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  const target = new Date(now);
  target.setHours(cfg.hour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const delay = target - now;
  remindTimer = setTimeout(() => {
    const due = dueGroups().filter(d => d.due);
    if (!due.length) { scheduleReminder(); return; } // rien à faire → reprogramme
    const cfg2 = getReminders();
    if (cfg2.lastShown === todayStr()) { scheduleReminder(); return; } // déjà affiché aujourd'hui
    const body = due.map(d => d.label).join(', ');
    new Notification('FitTrack — tests à refaire 🔔', {
      body: `${due.length} groupe${due.length > 1 ? 's' : ''} : ${body}`,
      icon: './icon-192.png',
      tag: 'fittrack-reminder',
    });
    store.set(REMIND_KEY, { ...cfg2, lastShown: todayStr() });
    scheduleReminder(); // reprogramme pour le lendemain
  }, delay);
  syncRemindersToSW();
}

// Demande la permission si l'utilisateur active les rappels
function ensureNotificationPermission() {
  if (!('Notification' in window)) return Promise.resolve('unsupported');
  if (Notification.permission === 'granted') return Promise.resolve('granted');
  if (Notification.permission === 'denied') return Promise.resolve('denied');
  return Notification.requestPermission();
}

$('#reminders-enabled').addEventListener('change', async e => {
  const cfg = getReminders();
  cfg.enabled = e.target.checked;
  store.set(REMIND_KEY, cfg);
  const status = $('#reminders-status');
  if (cfg.enabled) {
    const perm = await ensureNotificationPermission();
    if (perm !== 'granted') {
      cfg.enabled = false;
      store.set(REMIND_KEY, cfg);
      e.target.checked = false;
      status.textContent = 'Permission refusée — activez les notifications pour FitTrack dans les réglages du navigateur.';
      status.className = 'err';
      status.classList.remove('hidden');
      return;
    }
    status.textContent = `Rappels actifs — notification quotidienne à ${String(cfg.hour).padStart(2, '0')}:00 si des tests sont dus.`;
    status.className = 'ok';
    status.classList.remove('hidden');
  } else {
    status.classList.add('hidden');
  }
  scheduleReminder();
  syncRemindersToSW();
});
$('#reminders-hour').addEventListener('change', e => {
  const cfg = getReminders();
  cfg.hour = parseInt(e.target.value) || 9;
  store.set(REMIND_KEY, cfg);
  scheduleReminder();
});

// Au démarrage : rattrapage si l'app n'a pas tourné à l'heure prévue (ex. fermée à 9h)
function catchUpReminder() {
  const cfg = getReminders();
  if (!cfg.enabled || !('Notification' in window) || Notification.permission !== 'granted') return;
  if (cfg.lastShown === todayStr()) return; // déjà notifié aujourd'hui
  const now = new Date();
  const dueAt = new Date(now); dueAt.setHours(cfg.hour, 0, 0, 0);
  if (now < dueAt) return; // l'heure n'est pas encore passée → le timer prendra le relais
  const due = dueGroups().filter(d => d.due);
  if (!due.length) return;
  new Notification('FitTrack — tests à refaire 🔔', {
    body: `${due.length} groupe${due.length > 1 ? 's' : ''} en retard : ${due.map(d => d.label).join(', ')}`,
    icon: './icon-192.png',
    tag: 'fittrack-reminder',
  });
  store.set(REMIND_KEY, { ...cfg, lastShown: todayStr() });
}

function renderRemindersForm() {
  const cfg = getReminders();
  $('#reminders-enabled').checked = cfg.enabled;
  $('#reminders-hour').value = cfg.hour;
  const supported = 'Notification' in window;
  const perm = supported ? Notification.permission : 'unsupported';
  const note = $('#reminders-note');
  if (!supported) {
    note.textContent = 'Les notifications ne sont pas disponibles sur ce navigateur.';
    note.classList.remove('hidden');
    $('#reminders-enabled').disabled = true;
    $('#reminders-hour').disabled = true;
  } else if (perm === 'denied') {
    note.textContent = 'Permission refusée — activez les notifications pour FitTrack dans les réglages du navigateur.';
    note.classList.remove('hidden');
    $('#reminders-enabled').disabled = true;
  } else {
    note.classList.add('hidden');
    $('#reminders-enabled').disabled = false;
    $('#reminders-hour').disabled = !cfg.enabled;
  }
  if (cfg.enabled && supported && perm === 'granted') {
    const status = $('#reminders-status');
    status.textContent = `Rappels actifs — notification quotidienne à ${String(cfg.hour).padStart(2, '0')}:00 si des tests sont dus.`;
    status.className = 'ok';
    status.classList.remove('hidden');
  }
}

renderRemindersForm();
scheduleReminder();
catchUpReminder();
syncRemindersToSW();
