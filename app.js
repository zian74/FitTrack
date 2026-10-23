/* ============================================================
 * FitTrack — moteur applicatif (vanilla JS, offline-first)
 * Stockage : localStorage
 * ============================================================ */

// ---------- Utilitaires ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
// ---------- Helper DOM sécurisé (migration innerHTML → création de nœuds) ----------
// h(tag, attrs, ...children) : crée un élément. attrs = { class, id, text, html,
//   style (objet CSS), on (objet event→handler), ...attributs HTML }.
// - text : inséré via textContent (sûr, jamais interprété comme HTML)
// - html : inséré via innerHTML (à réserver au contenu statique interne, ex. SVG)
// - tout nœud enfant est appendé tel quel ; les chaînes sont converties en text nodes.
//   ⚠ null/false/undefined sont ignorés (sinon append/replaceChildren les
//   convertirait en text nodes « null »/« undefined » visibles — bug corrigé ici).
const nodes = (...list) => list.flat(Infinity).filter(c => c != null && c !== false);
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'on' && typeof v === 'object') for (const [ev, fn] of Object.entries(v)) el.addEventListener(ev, fn);
    else if (k === 'dataset' && typeof v === 'object') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const c of nodes(...children)) {
    el.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
  }
  return el;
}
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('ft_' + k)) ?? d; } catch { return d; } },
  set(k, v) { localStorage.setItem('ft_' + k, JSON.stringify(v)); }
};

function todayStr() { return new Date().toISOString().slice(0, 10); }

// ---------- Notifications in-app (remplacent alert/confirm natifs) ----------
// Toast non bloquant en bas d'écran : type 'ok' | 'err' | 'info'.
function toast(msg, type = 'info', ms = 3500) {
  let wrap = $('#toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'toast-wrap';
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  // Décale le toast au-dessus du chrono/timer flottants s'ils sont ouverts
  const widgetOpen = !$('#chrono')?.classList.contains('hidden') || !$('#timer')?.classList.contains('hidden');
  wrap.classList.toggle('above-widgets', !!widgetOpen);
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', type === 'err' ? 'alert' : 'status');
  el.textContent = msg;
  wrap.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, ms);
}

// Modale de confirmation (remplace confirm natif) — retourne une Promise<boolean>.
// options.danger : bouton de confirmation en rouge (action irréversible).
function confirmDialog(msg, { danger = false } = {}) {
  return new Promise(resolve => {
    const ov = $('#confirm-modal');
    $('#confirm-modal-msg').textContent = msg;
    $('#confirm-modal-ok').classList.toggle('danger', danger);
    $('#confirm-modal-ok').classList.toggle('primary', !danger);
    ov.classList.remove('hidden');
    $('#confirm-modal-ok').focus();
    const cleanup = v => {
      ov.classList.add('hidden');
      $('#confirm-modal-ok').removeEventListener('click', onOk);
      $('#confirm-modal-cancel').removeEventListener('click', onCancel);
      ov.removeEventListener('click', onOverlay);
      document.removeEventListener('keydown', onKey);
      resolve(v);
    };
    const onOk = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlay = e => { if (e.target === ov) cleanup(false); };
    const onKey = e => { if (e.key === 'Escape') cleanup(false); };
    $('#confirm-modal-ok').addEventListener('click', onOk);
    $('#confirm-modal-cancel').addEventListener('click', onCancel);
    ov.addEventListener('click', onOverlay);
    document.addEventListener('keydown', onKey);
  });
}

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
  { id: 'grip', name: 'Préhension — meilleure main (kg)', aliases: ['Poigne — meilleure main (kg)'], unit: 'kg', group: 'strength',
    hint: '2–3 essais par main, 30 s de repos entre essais',
    good: 45, mid: 35, max: 100, min: 5,
    gender: { H: { good: 45, mid: 35 }, F: { good: 30, mid: 20 } },
    info: `<ul>
      <li>Échauffez vos <b>mains et avant-bras</b> 2–3 min avant (flexions des doigts, ouverture/fermeture, rotations des poignets).</li>
      <li>Position <b>debout</b>, bras le long du corps, <b>coude fléchi à 90°</b>, avant-bras en position neutre (pouce vers le haut). Le bras ne doit pas toucher le corps.</li>
      <li>Réglez le dynamomètre à la taille de votre main : la poignée repose sur la <b>2ᵉ phalange des doigts</b> (ni trop serrée, ni trop lâche).</li>
      <li>Saisissez le dynamomètre, puis <b>serrez progressivement au maximum</b> pendant <b>2–3 secondes</b>, sans bouger le bras ni l'épaule. Ne secouez pas la main.</li>
      <li>Relâchez complètement, <b>reposez-vous 30 s</b>, puis recommencez. Faites <b>2–3 essais par main</b> en alternant.</li>
      <li>Notez la <b>meilleure valeur de chaque main</b> et reportez la <b>meilleure des deux</b> dans le champ.</li>
      <li><b>Respirez normalement</b> pendant l'effort : ne retenez pas votre souffle (évitez la manœuvre de Valsalva).</li>
      <li>Arrêtez en cas de <b>douleur</b> au poignet, au coude ou à l'épaule.</li>
    </ul>` },
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
  { id: 'stair_pulse', name: 'Test escalier — pouls à 1 min (méthode 1)', unit: 'bpm', group: 'cardio', rev: true,
    hint: '3 min de montées (24/min), pouls 1 min après', good: 100, mid: 110, max: 200, min: 50,
    info: `<ul>
      <li><b>Méthode 1</b> — <b>Récupération cardiaque</b> : 3 min de montées à allure régulière, puis mesure du pouls 1 min après l'arrêt.</li>
      <li>Échauffez-vous 5 min (marche sur place, montées lentes) avant de commencer.</li>
      <li>Montez et descendez un escalier à allure régulière : <b>24 montées par minute</b> (un cycle montée+descente toutes les 2,5 s).</li>
      <li>Durée totale : <b>3 minutes</b> de montée/descente continue. Le bouton <b>⏳</b> ouvre un <b>compte à rebours de 3 min</b> (durée réglable) pour vous guider ; le bouton <b>🥁 96 bpm</b> dans le timer active un <b>métronome sonore</b> (1 bip par cycle, 96 bpm = 24 montées/min) qui démarre, pause et s'arrête avec le timer. À la fin des 3 min, un <b>compte à rebours de 1 min</b> se lance automatiquement pour la mesure du pouls.</li>
      <li>Dès la fin, <b>asseyez-vous immédiatement</b> et prenez votre pouls pendant 60 s, <b>1 minute après l'arrêt</b> (comptez 15 s × 4 et multipliez par 4, ou 60 s complet).</li>
      <li>Notez ce pouls à 1 min : c'est votre résultat. Plus il est bas, meilleure est votre récupération cardiaque.</li>
      <li>Arrêtez en cas de douleur thoracique, vertiges ou essoufflement excessif — consultez un médecin avant de recommencer.</li>
      <li>Test sous-maximal : évitez si vous avez des antécédents cardiaques ou un traitement bêtabloquant (voir avertissement dans l'onglet Session).</li>
    </ul>` },
  { id: 'stair_steps', name: 'Test escalier — marches en 60 s (méthode 2)', unit: 'marches', group: 'cardio',
    hint: 'Comptez les marches gravis en 60 secondes', good: 80, mid: 60, max: 200, min: 5,
    info: `<ul>
      <li><b>Méthode 2</b> — <b>Nombre de marches en 60 s</b> : capacité fonctionnelle brute.</li>
      <li>Échauffez-vous 5 min (marche sur place, montées lentes) avant de commencer.</li>
      <li>Placez-vous au bas d'un escalier. Le bouton <b>⏳</b> ouvre un <b>compte à rebours de 60 s</b> : montez les marches <b>aussi vite que possible</b> (une marche à la fois, en sécurité).</li>
      <li>À la fin des 60 s, <b>comptez le nombre total de marches gravis</b> et reportez-le dans le champ.</li>
      <li>Interprétation : <b>≥ 80</b> bonne à très bonne endurance · <b>60–79</b> condition moyenne, marge d'amélioration · <b>40–59</b> capacité cardiorespiratoire faible à modérée · <b>&lt; 40</b> capacité fonctionnelle basse.</li>
      <li>Arrêtez en cas de douleur thoracique, vertiges ou essoufflement excessif.</li>
    </ul>` },
  { id: 'stair_4floors', name: 'Test escalier — 4 étages chronométrés (méthode 3)', unit: 's', group: 'cardio', rev: true,
    hint: 'Chronométrez le temps pour monter 4 étages', good: 45, mid: 60, max: 300, min: 5,
    info: `<ul>
      <li><b>Méthode 3</b> — <b>Temps pour monter 4 étages</b> : capacité d'effort fonctionnel.</li>
      <li>Échauffez-vous 5 min (marche sur place, montées lentes) avant de commencer.</li>
      <li>Placez-vous au bas de l'escalier (étage 0). Le bouton <b>⏱</b> ouvre un <b>chronomètre</b> : démarrez-le en partant, montez <b>4 étages complets</b> à allure soutenue mais sécurisée, arrêtez le chrono en haut.</li>
      <li>Reportez le temps affiché (en secondes) dans le champ. <i>Plus le temps est court, meilleur est le niveau.</i></li>
      <li>Interprétation : <b>&lt; 45 s</b> très bon niveau de capacité d'effort · <b>45–60 s</b> bon niveau fonctionnel (si aucun symptôme anormal) · <b>60–90 s</b> niveau moyen · <b>&gt; 90 s</b> mauvais.</li>
      <li>Arrêtez en cas de douleur thoracique, vertiges ou essoufflement excessif.</li>
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
  // --- Groupe Sommeil (questionnaire 7 derniers jours, score calculé) ---
  { id: 'sleep_score', name: 'Score de sommeil', unit: '/100', group: 'sleep',
    hint: 'Score calculé automatiquement depuis le questionnaire (5 questions sur les 7 derniers jours)',
    good: 80, mid: 60, max: 100, min: 0,
    info: `<ul>
      <li>Le <b>score de sommeil</b> (/100) est calculé automatiquement à partir de 5 questions sur vos 7 derniers jours : durée, qualité, latence d'endormissement, réveils nocturnes et sensation au réveil.</li>
      <li><b>Interprétation</b> : ≥ 80 bon sommeil · 60–79 moyen, marge d'amélioration · &lt; 60 sommeil perturbé — pensez à en parler à un professionnel de santé si cela dure.</li>
      <li>Repères (NSF) : un adulte dort en moyenne <b>7 à 9 h</b> par nuit.</li>
    </ul>` },
  { id: 'sleep_hours', name: 'Durée moyenne de sommeil', unit: 'h', group: 'sleep', rev: null,
    hint: 'Moyenne sur les 7 derniers jours',
    good: 8, mid: 7, max: 14, min: 1,
    gender: { H: { good: 8, mid: 7 }, F: { good: 8, mid: 7 } } },
  // --- Groupe Alimentation (questionnaire 7 derniers jours, score calculé) ---
  { id: 'nutrition_score', name: 'Score alimentaire', unit: '/100', group: 'nutrition',
    hint: 'Score calculé automatiquement depuis le questionnaire (6 questions scorées + alcool N7 contextuel, sur les 7 derniers jours)',
    good: 80, mid: 60, max: 100, min: 0,
    info: `<ul>
      <li>Le <b>score alimentaire</b> (/100) est calculé automatiquement à partir de <b>6 questions</b> sur vos 7 derniers jours : fruits &amp; légumes, boissons sucrées, produits ultra-transformés, petit-déjeuner, repas maison et hydratation. La question <b>N7 (alcool)</b> est <b>contextuelle</b> : elle n'entre pas dans le score mais alimente le récapitulatif des facteurs de risque cardio (onglet Profil).</li>
      <li><b>Interprétation</b> : ≥ 80 alimentation équilibrée · 60–79 moyenne, marge d'amélioration · &lt; 60 alimentation à améliorer.</li>
      <li><b>Repères OMS</b> : au moins 400 g de fruits et légumes par jour (5 portions), limiter les boissons sucrées et les aliments ultra-transformés.</li>
    </ul>` },
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
  // --- Mesure contextuelle (hors score, alimente le risque cardio) ---
  { id: 'alcohol', name: 'Alcool (verres/semaine)', unit: 'verres/sem', group: 'nutrition', rev: true,
    hint: 'Saisi dans le questionnaire Alimentation (N7) — informatif, hors score alimentaire',
    good: 0, mid: 7, max: 60, min: 0,
    info: `<ul>
      <li>Consommation d'alcool déclarée dans le <b>questionnaire Alimentation</b> (question N7, sur les 7 derniers jours).</li>
      <li>Cette mesure est <b>contextuelle</b> : elle ne participe pas au score alimentaire, mais alimente le <b>recapitulatif des facteurs de risque cardiovasculaire</b> (onglet Profil).</li>
      <li>Repères OMS : au-delà de <b>14 verres/semaine</b>, la consommation est considérée comme à risque (facteur majeur).</li>
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

// Entoure les segments entre parenthèses d'un <span class="paren"> pour les
// afficher plus petits et en italique (explications, ex. « (course, vélo rapide…) »)
// Entoure les segments entre parenthèses d'un <span class="paren"> (petit, italique).
// Retourne un tableau de nœuds/strings (migration innerHTML → DOM).
function wrapParens(text) {
  const parts = String(text).split(/(\([^()]*\))/g);
  return parts.map(p =>
    p.length > 1 && p.startsWith('(') && p.endsWith(')')
      ? h('span', { class: 'paren' }, p)
      : p
  );
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

// ---------- Questionnaire Sommeil (évaluation de la qualité du sommeil) ----------
// 5 questions sur les 7 derniers jours. Score /100 pondéré :
//   durée 30 % · qualité subjective 25 % · latence 15 % · réveils 15 % · sensation au réveil 15 %
// Repères NSF : 7–9 h par nuit pour un adulte (18–64 ans).
const SLEEP_QUESTIONS = [
  { id: 'hours', label: 'S1 — En moyenne, combien d\'heures dormez-vous par nuit ?', unit: 'h', type: 'number', min: 1, max: 14, step: 0.5, weight: 30 },
  { id: 'quality', label: 'S2 — Comment évaluez-vous la qualité de votre sommeil ?', unit: '/5', type: 'stars', min: 1, max: 5, weight: 25 },
  { id: 'latency', label: 'S3 — Combien de minutes mettez-vous en général à vous endormir ?', unit: 'min', type: 'number', min: 0, max: 180, step: 5, weight: 15 },
  { id: 'awakenings', label: 'S4 — Combien de fois vous réveillez-vous en moyenne par nuit ?', unit: 'fois', type: 'number', min: 0, max: 10, step: 1, weight: 15 },
  { id: 'rested', label: 'S5 — Au réveil, vous sentez-vous reposé(e) ?', unit: '/5', type: 'stars', min: 1, max: 5, weight: 15 },
];

// Score d'un item individuel (0–100) puis pondération pour le score global /100.
function sleepItemScore(q, value) {
  switch (q.id) {
    case 'hours':
      // 7–9 h = 100 · 6–7 h ou 9–10 h = 70 · 5–6 h ou 10–11 h = 40 · < 5 h ou > 11 h = 10
      if (value >= 7 && value <= 9) return 100;
      if (value >= 6 && value < 7) return 80;
      if (value > 9 && value <= 10) return 80;
      if (value >= 5 && value < 6) return 50;
      if (value > 10 && value <= 11) return 50;
      return 10;
    case 'quality':
      // Échelle 1–5 → 0–100 (5 = 100, 1 = 0)
      return Math.round(((value - 1) / 4) * 100);
    case 'latency':
      // < 15 min = 100 · 15–30 = 80 · 30–45 = 50 · 45–60 = 30 · > 60 = 10
      if (value < 15) return 100;
      if (value <= 30) return 80;
      if (value <= 45) return 50;
      if (value <= 60) return 30;
      return 10;
    case 'awakenings':
      // 0 = 100 · 1 = 80 · 2 = 50 · 3 = 30 · ≥ 4 = 10
      if (value === 0) return 100;
      if (value === 1) return 80;
      if (value === 2) return 50;
      if (value === 3) return 30;
      return 10;
    case 'rested':
      // Échelle 1–5 → 0–100
      return Math.round(((value - 1) / 4) * 100);
    default:
      return 0;
  }
}

// Score de sommeil /100 (moyenne pondérée des 5 items, poids total = 100).
function sleepScore(a) {
  let total = 0, weight = 0;
  for (const q of SLEEP_QUESTIONS) {
    const v = a[q.id];
    if (v == null) continue;
    total += sleepItemScore(q, v) * q.weight;
    weight += q.weight;
  }
  if (!weight) return null;
  return Math.round(total / weight);
}

function sleepLevel(score) {
  if (score >= 80) return { key: 'good', short: 'Bon', label: '🟢 Bon sommeil' };
  if (score >= 60) return { key: 'mid', short: 'Moyen', label: '🟠 Sommeil moyen' };
  return { key: 'low', short: 'Faible', label: '🔴 Sommeil perturbé' };
}

// ---------- Questionnaire Alimentation (évaluation des habitudes alimentaires) ----------
// 6 questions sur les 7 derniers jours. Score /100 pondéré :
//   fruits & légumes 25 % · boissons sucrées 20 % · ultra-transformés 20 %
//   petit-déjeuner 10 % · repas maison 15 % · hydratation 10 %
// Repères OMS : ≥ 400 g/j de fruits & légumes (5 portions), limiter les boissons
// sucrées et les aliments ultra-transformés (classification NOVA, Monteiro 2019).
const NUTRITION_QUESTIONS = [
  { id: 'veg', label: 'N1 — En moyenne, combien de portions de fruits & légumes par jour ?', unit: 'portions', type: 'number', min: 0, max: 15, step: 0.5, weight: 25,
    infoKey: '__portion__', infoTitle: 'Qu’est-ce qu’une portion de fruits & légumes ?' },
  { id: 'sugary', label: 'N2 — Combien de boissons sucrées (sodas, jus, boissons énergisantes) par jour ?', unit: 'verres', type: 'number', min: 0, max: 15, step: 0.5, weight: 20 },
  { id: 'ultra', label: 'N3 — Combien de fois par semaine consommez-vous des produits ultra-transformés (snacks, fast-food, plats industriels) ?', unit: 'fois/sem', type: 'number', min: 0, max: 21, step: 1, weight: 20 },
  { id: 'breakfast', label: 'N4 — Prenez-vous un petit-déjeuner régulièrement ?', unit: '/5', type: 'stars', min: 1, max: 5, weight: 10 },
  { id: 'homecooked', label: 'N5 — Vos repas sont-ils majoritairement préparés maison ?', unit: '/5', type: 'stars', min: 1, max: 5, weight: 15 },
  { id: 'water', label: 'N6 — Combien de verres d’eau buvez-vous par jour ?', unit: 'verres', type: 'number', min: 0, max: 20, step: 1, weight: 10 },
  { id: 'alcohol', label: 'N7 — Combien de verres d’alcool consommez-vous par semaine ?', unit: 'verres/sem', type: 'number', min: 0, max: 60, step: 1, weight: 0, contextual: true },
];

// Score d'un item individuel (0–100) puis pondération pour le score global /100.
function nutritionItemScore(q, value) {
  switch (q.id) {
    case 'veg':
      // ≥ 5 portions = 100 · 3–4 = 80 · 2 = 60 · 1 = 40 · 0 = 20 (repère OMS : 5/jour)
      if (value >= 5) return 100;
      if (value >= 3) return 80;
      if (value >= 2) return 60;
      if (value >= 1) return 40;
      return 20;
    case 'sugary':
      // 0 = 100 · ≤ 0,5 = 80 · ≤ 1 = 60 · ≤ 2 = 40 · ≥ 3 = 20 (à limiter, OMS)
      if (value === 0) return 100;
      if (value <= 0.5) return 80;
      if (value <= 1) return 60;
      if (value <= 2) return 40;
      return 20;
    case 'ultra':
      // 0–1 fois/sem = 100 · 2–3 = 80 · 4–6 = 60 · 7–10 = 40 · > 10 = 20
      if (value <= 1) return 100;
      if (value <= 3) return 80;
      if (value <= 6) return 60;
      if (value <= 10) return 40;
      return 20;
    case 'breakfast':
      // Échelle 1–5 → 0–100
      return Math.round(((value - 1) / 4) * 100);
    case 'homecooked':
      // Échelle 1–5 → 0–100
      return Math.round(((value - 1) / 4) * 100);
    case 'water':
      // 8 verres (≈ 1,5–2 L) = 100 · 5–7 = 80 · 3–4 = 60 · 1–2 = 40 · 0 = 20
      if (value >= 8) return 100;
      if (value >= 5) return 80;
      if (value >= 3) return 60;
      if (value >= 1) return 40;
      return 20;
    default:
      return 0;
  }
}

// Score alimentaire /100 (moyenne pondérée des 6 items, poids total = 100).
function nutritionScore(a) {
  let total = 0, weight = 0;
  for (const q of NUTRITION_QUESTIONS) {
    if (q.contextual) continue; // N7 alcool : informatif, hors score
    const v = a[q.id];
    if (v == null) continue;
    total += nutritionItemScore(q, v) * q.weight;
    weight += q.weight;
  }
  if (!weight) return null;
  return Math.round(total / weight);
}

function nutritionLevel(score) {
  if (score >= 80) return { key: 'good', short: 'Bon', label: '🟢 Alimentation équilibrée' };
  if (score >= 60) return { key: 'mid', short: 'Moyen', label: '🟠 Alimentation moyenne' };
  return { key: 'low', short: 'Faible', label: '🔴 Alimentation à améliorer' };
}

const byId = id => TESTS.find(t => t.id === id);
// Numéro du test dans l'ordre de réalisation (1-based), ex. « 1. FC de repos (bpm) »
const testNum = id => {
  const i = TESTS.findIndex(t => t.id === id);
  return i >= 0 ? `${i + 1}. ` : '';
};
const GROUP_LABELS = { rest: 'Repos & mobilité', strength: 'Force', cardio: 'Cardio', activity: 'Activité & sédentarité', sleep: 'Sommeil & récupération', nutrition: 'Alimentation' };
// Groups présents par type de session
const SESSION_GROUPS = {
  rest: ['rest'],
  strength: ['strength'],
  cardio: ['cardio'],
  activity: ['activity'],
  sleep: ['sleep'],
  nutrition: ['nutrition'],
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
  // Alcool : saisi dans le questionnaire Alimentation (N7), persisté comme mesure
  // 'alcohol' dans les sessions — la dernière valeur connue alimente le risque.
  const alcohol = Number(latestValues().alcohol?.value ?? 0);
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
    el.replaceChildren(
      'Aucun facteur de risque déclaré. ',
      h('span', { class: 'small' }, '(Renseignez-les ci-dessus si votre situation a évolué.)')
    );
    return;
  }
  const level = majors.length >= 3 ? { cls: 'low', txt: 'Risque élevé' }
    : majors.length >= 1 ? { cls: 'mid', txt: 'Risque modéré' }
    : { cls: 'good', txt: 'Risque faible' };
  const items = factors.map(f => h('li', {},
    f.label,
    f.major ? ' ' : null,
    f.major ? h('span', { class: 'badge low' }, 'majeur') : null
  ));
  el.replaceChildren(
    h('b', {}, `${factors.length} facteur${factors.length > 1 ? 's' : ''} déclaré${factors.length > 1 ? 's' : ''}`),
    ` · niveau : `,
    h('span', { class: `badge ${level.cls}` }, level.txt),
    ` (${majors.length} majeur${majors.length > 1 ? 's' : ''})`,
    h('ul', { class: 'list', style: { margin: '6px 0 0' } }, items),
    h('p', { class: 'small', style: { marginTop: '6px' } }, 'Ce récapitulatif est indicatif et ne remplace pas une évaluation médicale (scores SCORE2 / Framingham).')
  );
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
  const stair = stairIndicator(lv);
  if (stair) return stair;
  return null;
}

// Indicateur escalier retenu parmi les 3 méthodes (priorité : pouls > marches > 4 étages)
function stairIndicator(lv) {
  if (lv.stair_pulse?.value != null) return { id: 'stair_pulse', value: lv.stair_pulse.value };
  if (lv.stair_steps?.value != null) return { id: 'stair_steps', value: lv.stair_steps.value };
  if (lv.stair_4floors?.value != null) return { id: 'stair_4floors', value: lv.stair_4floors.value };
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

// Fréquence de re-test (en mois). Le sommeil a une cadence hebdomadaire (gérée en jours
// via RETEST_DAYS ci-dessous, pas en mois).
const RETEST = { rest: 1, strength: 3, cardio: 3, activity: 3 };
// Groupes à cadence journalière (en jours) — sommeil : bilan hebdomadaire
const RETEST_DAYS = { sleep: 7, nutrition: 7 };

// Groupes de tests dus (réutilisé par le dashboard et les rappels de notification)
// Retourne [{ group, label, due, last, monthsDue }] — due=true si à refaire ou jamais fait
function dueGroups() {
  const lv = latestValues();
  const out = [];
  const groups = { ...RETEST, ...Object.fromEntries(Object.keys(RETEST_DAYS).map(g => [g, null])) };
  for (const group of Object.keys(groups)) {
    const ids = TESTS.filter(t => t.group === group).map(t => t.id);
    const last = ids.map(id => lv[id]?.date).filter(Boolean).sort().pop();
    const label = GROUP_LABELS[group];
    if (!last) { out.push({ group, label, due: true, last: null, monthsDue: Infinity }); continue; }
    if (RETEST_DAYS[group] != null) {
      const days = Math.floor((Date.now() - new Date(last).getTime()) / 86400000);
      out.push({ group, label, due: days >= RETEST_DAYS[group], last, monthsDue: days / 30, daysDue: days, unit: 'jours' });
    } else {
      const m = monthsSince(last);
      out.push({ group, label, due: m >= RETEST[group], last, monthsDue: m });
    }
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
// Score /100 : moyenne des statuts des 5 tests prédictifs (ordre fixe : FC, taille, préhension, escalier, équilibre)
const PREDICTIVE = ['fc', 'waist', 'grip', 'stair_pulse', 'balance_open'];
const SCORE_PTS = { good: 100, mid: 60, low: 25 };

function computeGlobalScore(profile) {
  const lv = latestValues();
  // Remplace stair_pulse par l'indicateur escalier effectivement disponible (3 méthodes)
  const predictive = PREDICTIVE.map(id => {
    if (id !== 'stair_pulse') return id;
    const stair = stairIndicator(lv);
    return stair ? stair.id : null;
  }).filter(Boolean);
  const scored = predictive.filter(id => lv[id]);
  if (!scored.length) return null;
  const avg = Math.round(scored.reduce((a, id) => a + SCORE_PTS[statusOf(byId(id), lv[id].value, profile)], 0) / scored.length);
  const rows = scored.map(id => {
    const t = byId(id);
    const st = statusOf(t, lv[id].value, profile);
    return h('li', {},
      `${t.name} — ${lv[id].value} ${t.unit} `,
      h('span', { class: `badge ${st}` }, STATUS_LABEL[st])
    );
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
// Score /100 par dimension à partir des mesures objectives, pondéré selon la littérature
// (mortalité cardiovasculaire et toutes causes). Mêmes statuts/repères que l'app.
const IFG_DIMENSIONS = [
  { key: 'cardio_rest', label: 'Cardio au repos & métabolisme', weight: 0.20, icon: '🪀',
    tests: ['fc', 'pa_sys', 'pa_dia', 'waist'] },
  { key: 'endurance', label: 'Endurance cardio', weight: 0.20, icon: '🏃',
    tests: ['stair_pulse', 'stair_steps', 'stair_4floors', 'cooper'] },
  { key: 'strength', label: 'Force musculaire', weight: 0.20, icon: '💪',
    tests: ['grip', 'pushups', 'plank', 'chair'] },
  { key: 'balance', label: 'Équilibre & mobilité', weight: 0.15, icon: '⚖️',
    tests: ['balance_open', 'balance_closed', 'reach'] },
  { key: 'activity', label: "Habitudes d'activité", weight: 0.10, icon: '🏃',
    tests: ['ipaq', 'sit'] },
  { key: 'sleep', label: 'Sommeil & récupération', weight: 0.10, icon: '🌙',
    tests: ['sleep_score', 'sleep_hours'] },
  { key: 'nutrition', label: 'Alimentation', weight: 0.05, icon: '🍽',
    tests: ['nutrition_score'] },
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
    scoreEl.replaceChildren(
      h('p', {}, 'Aucune mesure enregistrée. Commencez par une ', h('b', {}, 'session de test'), '.')
    );
  } else {
    // Barre de niveau : 5 paliers colorés, le remplissage correspond au score /100
    const pct = Math.max(0, Math.min(100, result.score));
    const fill = `linear-gradient(to right, var(--bad) 0%, var(--bad) 20%, var(--warn) 20%, var(--warn) 40%, #f9a825 40%, #f9a825 60%, #9e9d24 60%, #9e9d24 80%, var(--ok) 80%, var(--ok) 100%)`;
    scoreEl.replaceChildren(
      h('p', { style: { fontSize: '2em', fontWeight: '700', color: 'var(--accent)' } },
        String(result.score),
        h('span', { style: { fontSize: '.6em' } }, ' /100')
      ),
      h('div', { class: 'score-bar', role: 'progressbar', 'aria-valuenow': result.score, 'aria-valuemin': '0', 'aria-valuemax': '100', title: `${result.score}/100` },
        h('div', { class: 'score-bar-track' },
          h('div', { class: 'score-bar-fill', style: { width: `${pct}%`, background: fill } })
        ),
        h('div', { class: 'score-bar-labels small' },
          h('span', {}, '0'), h('span', {}, '20'), h('span', {}, '40'),
          h('span', {}, '60'), h('span', {}, '80'), h('span', {}, '100')
        )
      ),
      h('p', { class: 'small' }, 'Basé sur les 5 mesures les plus prédictives selon la littérature scientifique.'),
      h('ul', { class: 'list' }, result.rows)
    );
  }

  // Tests dus (logique factorisée dans dueGroups(), aussi utilisée par les rappels)
  const due = dueGroups().map(d => {
    if (!d.last) return h('li', {}, h('b', {}, d.label), ' — jamais effectué ', h('span', { class: 'badge low' }, 'à faire'));
    const lastFr = d.last.split('-').reverse().join('/');
    const dueLabel = d.unit === 'jours' ? `à refaire (${d.daysDue} j)` : `à refaire (${d.monthsDue} mois)`;
    return d.due
      ? h('li', {}, h('b', {}, d.label), ` — dernier : ${lastFr} `, h('span', { class: 'badge low' }, dueLabel))
      : h('li', {}, h('b', {}, d.label), ` — dernier : ${lastFr} `, h('span', { class: 'badge good' }, 'à jour'));
  });
  $('#due-tests').replaceChildren(...nodes(...due));

  // Alertes de tendance : dégradation ou stagnation sur 2 sessions
  const alerts = [];
  const THRESH = { rest: 0.03, strength: 0.05, cardio: 0.05, activity: 0.10, sleep: 0.10, nutrition: 0.10 };
  for (const t of TESTS) {
    if (t.good == null) continue;
    const series = seriesOf(t.id);
    if (series.length < 2) continue;
    const [prev, last] = series.slice(-2);
    const delta = (last.value - prev.value) / Math.max(prev.value, 1);
    const bad = t.rev ? delta > THRESH[t.group] : delta < -THRESH[t.group];
    const stagnant = Math.abs(delta) <= 0.01;
    if (bad) alerts.push(h('li', {}, '🔴 ', h('b', {}, t.name), ` : ${prev.value} → ${last.value} ${t.unit} (dégradation). Ajustez l'entraînement${['fc','pa_sys','pa_dia'].includes(t.id) ? ' ou consultez' : ''}.`));
    else if (stagnant && series.length >= 3) alerts.push(h('li', {}, '🟠 ', h('b', {}, t.name), ` : stable sur 2 sessions. Pensez à varier l'entraînement.`));
  }
  $('#alerts').replaceChildren(...(alerts.length ? alerts : [h('li', {}, 'Aucune alerte. 👍')]));
}

// La carte « Dernière session » vit dans l'onglet Session de test
function renderLastSession() {
  const sessions = getSessions();
  const compEl = $('#last-comparison');
  if (sessions.length === 0) { compEl.replaceChildren(h('p', {}, 'Aucune donnée.')); return; }
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
  const ids = [];
  for (const c of cols) for (const s of c.sessions) for (const id of Object.keys(s.values || {})) {
    if (s.values[id] != null && s.values[id] !== '' && !ids.includes(id)) ids.push(id);
  }
  ids.sort((a, b) => TESTS.findIndex(t => t.id === a) - TESTS.findIndex(t => t.id === b));

  // En-tête : Test | <date + bouton supprimer> × colonnes | Δ
  const headerCells = cols.map(c => h('th', {},
    frDate(c.date), ' ',
    h('button', {
      class: 'delete-session-btn',
      title: 'Supprimer les sessions de cette date',
      dataset: { delSession: c.sessions[0].id || '', delDate: c.date },
    }, '🗑️')
  ));
  const thead = h('tr', {}, h('th', {}, 'Test'), ...headerCells, h('th', {}, 'Δ'));

  const bodyRows = [];
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
    let deltaTd;
    if (hasCur && hasPrv) {
      const d = cur - prv;
      const sign = d > 0 ? '+' : '';
      // poids : couleur basée sur la trajectoire IMC (vert = vers meilleure zone IMC)
      const cls = d === 0 ? 'muted'
        : (t.id === 'weight' ? weightDeltaClass(cur, prv)
        : (t.rev ? (d < 0 ? 'up' : 'down') : (d > 0 ? 'up' : 'down')));
      deltaTd = h('td', { class: `num ${cls}` }, `${sign}${Math.round(d * 10) / 10}`);
    } else {
      deltaTd = h('td', { class: 'num muted' }, '—');
    }

    // IPAQ/sommeil/nutrition : la valeur est complétée du badge de niveau
    const valueCell = (v, s) => {
      if (v == null || v === '') return h('td', { class: 'num muted' }, '—');
      let badge = null;
      if (id === 'ipaq') {
        const lv = ipaqLevel(v);
        badge = h('span', { class: `badge ${lv.key === 'high' ? 'good' : lv.key === 'mid' ? 'mid' : 'low'}` }, lv.short);
      } else if (id === 'sleep_score') {
        const lv = sleepLevel(v);
        badge = h('span', { class: `badge ${lv.key}` }, lv.short);
      } else if (id === 'nutrition_score') {
        const lv = nutritionLevel(v);
        badge = h('span', { class: `badge ${lv.key}` }, lv.short);
      }
      return h('td', { class: 'num' },
        String(v),
        badge ? ' ' : null,
        badge,
        ' ',
        h('button', {
          class: 'edit-btn',
          title: 'Corriger cette mesure',
          dataset: { editId: s.id || '', editDate: s.date, editTest: id },
        }, '✏️')
      );
    };

    bodyRows.push(h('tr', {},
      h('td', { class: 'test-name' },
        h('span', { class: 'test-num' }, testNum(id)),
        t.name
      ),
      valueCell(cur, curS),
      valueCell(prv, prvS),
      deltaTd
    ));
  }

  compEl.replaceChildren(h('table', { class: 'last3-table' }, thead, ...nodes(...bodyRows)));
}

document.addEventListener('click', async e => {
  const btn = e.target.closest('.delete-session-btn');
  if (!btn) return;
  const { delSession: id, delDate: date } = btn.dataset;
  const ofDate = getSessions().filter(s => s.date === date);
  const n = ofDate.reduce((acc, s) => acc + Object.keys(s.values || {}).length, 0);
  const ok = await confirmDialog(`Supprimer ${ofDate.length > 1 ? `les ${ofDate.length} sessions` : 'la session'} du ${date.split('-').reverse().join('/')} (${n} mesure${n > 1 ? 's' : ''}) ? Cette action est définitive.`, { danger: true });
  if (!ok) return;
  store.set('sessions', getSessions().filter(s => s.date !== date));
  toast('Session supprimée.', 'ok', 2500);
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
  if (raw === '' || isNaN(num)) { toast('Valeur invalide.', 'err'); return; }
  if (t.max != null && num > t.max) { toast(`Valeur trop élevée (max ${t.max} ${t.unit}).`, 'err'); return; }
  if (t.min != null && num < t.min) { toast(`Valeur trop faible (min ${t.min} ${t.unit}).`, 'err'); return; }
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

$('#edit-delete').addEventListener('click', async () => {
  if (!editCtx) return;
  const ok = await confirmDialog('Supprimer définitivement cette mesure ?', { danger: true });
  if (!ok) return;
  const sessions = getSessions();
  const s = findSession(editCtx, sessions);
  if (s) {
    const idx = sessions.indexOf(s);
    delete sessions[idx].values[editCtx.testId];
    if (Object.keys(sessions[idx].values).length === 0) sessions.splice(idx, 1);
    store.set('sessions', sessions);
  }
  closeEditModal();
  // re-rendu des vues actives (même liste que edit-save : la mesure supprimée
  // ne doit plus apparaître dans « Dernière session » ni l'historique)
  renderDashboard();
  renderLastSession();
  if ($('#view-history').classList.contains('active')) renderHistory();
  if ($('#view-analysis').classList.contains('active')) renderAnalysis();
});

// ---------- Session ----------
const chronoBtns = ['plank', 'balance_open', 'balance_closed', 'stair_4floors'];
// Méthodes du test escalier : 1 = pouls à 1 min (3 min), 2 = marches en 60 s, 3 = 4 étages chronométrés
const STAIR_METHODS = ['stair_pulse', 'stair_steps', 'stair_4floors'];

let currentSessionType = 'rest';

// Bloc questionnaire IPAQ court : 7 champs, score MET-min/sem calculé en direct
function renderIpaqBlock(block) {
  const last = latestValues();
  const lastIpaq = last['ipaq']?.value;
  const lastSit = last['sit']?.value;
  const qWrap = h('div', { id: 'ipaq-questions' });
  const resultEl = h('div', { id: 'ipaq-result', class: 'card', style: { background: 'var(--accent-light)', marginTop: '10px' } });
  const scoreInput = h('input', { type: 'hidden', dataset: { test: 'ipaq' }, id: 'ipaq-score-input' });
  const sitInput = h('input', { type: 'hidden', dataset: { test: 'sit' }, id: 'ipaq-sit-input' });
  block.append(
    h('p', { class: 'small' }, 'Pensez aux ', h('b', {}, '7 derniers jours'), '. Répondez aux 7 questions, le score se calcule automatiquement.'),
    qWrap,
    resultEl,
    scoreInput,
    sitInput
  );
  const answers = {};
  IPAQ_QUESTIONS.forEach(q => {
    const inp = h('input', {
      type: 'number', step: '1', min: String(q.min), max: String(q.max),
      dataset: { ipaq: q.id }, placeholder: q.unit, style: { width: '110px' },
    });
    const row = h('div', { class: 'field-row' },
      h('label', {}, ...wrapParens(q.label), inp, ' ', h('span', { class: 'small' }, q.unit))
    );
    qWrap.appendChild(row);
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
    const answered = IPAQ_QUESTIONS.filter(q => a[q.id] != null).length;
    const complete = answered === IPAQ_QUESTIONS.length;
    if (!complete) {
      resultEl.replaceChildren(
        h('b', {}, 'Questionnaire incomplet'),
        ` (${answered}/7) — le score nécessite les 7 réponses.`
      );
      scoreInput.value = '';
      sitInput.value = '';
      return;
    }
    const met = ipaqScore(a);
    const lvl = ipaqLevel(met);
    const sitH = Math.floor((a.sit_min || 0) / 60), sitM = (a.sit_min || 0) % 60;
    resultEl.replaceChildren(
      h('b', {}, `Score IPAQ : ${met} MET-min/semaine`),
      ` — ${lvl.label}`,
      h('br'),
      h('span', { class: 'small' },
        `Détail : intense ${Math.round((a.vig_days || 0) * (a.vig_min || 0))} min/j ×8 · modéré ${Math.round((a.mod_days || 0) * (a.mod_min || 0))} min/j ×4 · marche ${Math.round((a.walk_days || 0) * (a.walk_min || 0))} min/j ×3,3 `,
        ...wrapParens('(par semaine)')
      ),
      h('br'),
      h('span', { class: 'small' },
        ...wrapParens('Temps assis (jour de semaine)'),
        ' : ',
        h('b', {}, `${a.sit_min} min`),
        ' ',
        ...wrapParens(`(${sitH} h ${String(sitM).padStart(2, '0')})`),
        a.sit_min > 480 ? ' — au-delà de 8 h : pensez à vous lever régulièrement' : ''
      ),
      h('div', { class: 'small', style: { marginTop: '4px' } },
        'Repères OMS : ≥ 600 MET-min/sem ',
        ...wrapParens("(ou 150 min d'activité modérée/sem)"),
        ' · objectif haut : ≥ 3000'
      )
    );
    scoreInput.value = met;
    sitInput.value = a.sit_min;
  }
  if (lastIpaq != null || lastSit != null) {
    const info = h('div', { class: 'field-last' }, 'Dernier : ',
      lastIpaq != null ? [h('b', {}, String(lastIpaq)), ' MET-min/sem'] : null,
      lastIpaq != null && lastSit != null ? ' · ' : null,
      lastSit != null ? ['assis ', h('b', {}, String(lastSit)), ' min/j'] : null
    );
    block.insertBefore(info, qWrap);
  }
}

// Bloc questionnaire Sommeil : 5 questions, score /100 calculé en direct.
// Le score est persisté dans un input hidden data-test="sleep_score" ;
// la durée moyenne (heures) est aussi persistée (data-test="sleep_hours").
function renderSleepBlock(block) {
  const last = latestValues();
  const lastScore = last['sleep_score']?.value;
  const lastHours = last['sleep_hours']?.value;
  const qWrap = h('div', { id: 'sleep-questions' });
  const resultEl = h('div', { id: 'sleep-result', class: 'card', style: { background: 'var(--accent-light)', marginTop: '10px' } });
  const scoreInput = h('input', { type: 'hidden', dataset: { test: 'sleep_score' }, id: 'sleep-score-input' });
  const hoursInput = h('input', { type: 'hidden', dataset: { test: 'sleep_hours' }, id: 'sleep-hours-input' });
  block.append(
    h('p', { class: 'small' }, 'Pensez aux ', h('b', {}, '7 derniers jours'), '. Répondez aux 5 questions, le score se calcule automatiquement.'),
    qWrap,
    resultEl,
    scoreInput,
    hoursInput
  );
  const answers = {};
  SLEEP_QUESTIONS.forEach(q => {
    const row = h('div', { class: 'field-row' });
    if (q.type === 'stars') {
      const starsWrap = h('div', { class: 'sleep-stars', dataset: { sleepQ: q.id } });
      const starBtns = [1, 2, 3, 4, 5].map(n => h('button', {
        type: 'button', class: 'sleep-star', dataset: { star: String(n) },
        title: `${n}/5`, 'aria-label': `${n} sur 5`, text: '\u2606',
      }));
      starsWrap.append(...starBtns);
      row.append(h('label', {}, q.label, starsWrap));
      qWrap.appendChild(row);
      starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const n = parseInt(btn.dataset.star, 10);
          answers[q.id] = n;
          starBtns.forEach(b => {
            const v = parseInt(b.dataset.star, 10);
            b.classList.toggle('active', v <= n);
            b.textContent = v <= n ? '\u2605' : '\u2606';
          });
          updateSleepResult(answers);
          updateSaveState();
        });
      });
    } else {
      const inp = h('input', {
        type: 'number', step: String(q.step), min: String(q.min), max: String(q.max),
        dataset: { sleep: q.id }, placeholder: q.unit, style: { width: '110px' },
      });
      row.append(h('label', {}, q.label, inp, ' ', h('span', { class: 'small' }, q.unit)));
      qWrap.appendChild(row);
      inp.addEventListener('input', () => {
        const raw = inp.value.trim();
        const num = raw === '' ? null : parseFloat(raw.replace(',', '.'));
        const invalid = raw !== '' && (isNaN(num) || num < q.min || num > q.max);
        inp.classList.toggle('invalid', invalid);
        answers[q.id] = invalid ? null : num;
        updateSleepResult(answers);
        updateSaveState();
      });
    }
  });
  updateSleepResult(answers);
  function updateSleepResult(a) {
    const answered = SLEEP_QUESTIONS.filter(q => a[q.id] != null).length;
    const complete = answered === SLEEP_QUESTIONS.length;
    if (!complete) {
      resultEl.replaceChildren(
        h('b', {}, 'Questionnaire incomplet'),
        ` (${answered}/5) — le score nécessite les 5 réponses.`
      );
      scoreInput.value = '';
      hoursInput.value = '';
      return;
    }
    const score = sleepScore(a);
    const lvl = sleepLevel(score);
    const hrs = a.hours;
    const hFmt = hrs % 1 === 0 ? hrs.toFixed(0) : hrs.toFixed(1).replace('.', ',');
    resultEl.replaceChildren(
      h('b', {}, `Score de sommeil : ${score}/100`),
      ` — ${lvl.label}`,
      h('br'),
      h('span', { class: 'small' },
        'Durée moyenne : ', h('b', {}, `${hFmt} h`),
        ` · qualité ${a.quality}/5 · endormissement ${a.latency} min · ${a.awakenings} réveil${a.awakenings > 1 ? 's' : ''}/nuit · reposé ${a.rested}/5`
      ),
      h('div', { class: 'small', style: { marginTop: '4px' } },
        'Repères NSF : 7–9 h par nuit pour un adulte · ≥ 80 bon · 60–79 moyen · < 60 perturbé'
      )
    );
    scoreInput.value = score;
    hoursInput.value = hrs;
  }
  if (lastScore != null || lastHours != null) {
    const info = h('div', { class: 'field-last' }, 'Dernier : ',
      lastScore != null ? ['score ', h('b', {}, `${lastScore}`), '/100'] : null,
      lastScore != null && lastHours != null ? ' · ' : null,
      lastHours != null ? [h('b', {}, `${lastHours} h`)] : null
    );
    block.insertBefore(info, qWrap);
  }
}

// Bloc questionnaire Alimentation : 6 questions scorées + N7 alcool (contextuelle), score /100 calculé en direct.
// Le score est persisté dans un input hidden data-test="nutrition_score".
function renderNutritionBlock(block) {
  const last = latestValues();
  const lastScore = last['nutrition_score']?.value;
  const qWrap = h('div', { id: 'nutrition-questions' });
  const resultEl = h('div', { id: 'nutrition-result', class: 'card', style: { background: 'var(--accent-light)', marginTop: '10px' } });
  const scoreInput = h('input', { type: 'hidden', dataset: { test: 'nutrition_score' }, id: 'nutrition-score-input' });
  const alcoholInput = h('input', { type: 'hidden', dataset: { test: 'alcohol' }, id: 'nutrition-alcohol-input' });
  block.append(
    h('p', { class: 'small' }, 'Pensez aux ', h('b', {}, '7 derniers jours'), '. Répondez aux 6 questions, le score se calcule automatiquement (la question N7 sur l’alcool est facultative et hors score).'),
    qWrap,
    resultEl,
    scoreInput,
    alcoholInput
  );
  const answers = {};
  // N7 alcool : informatif — prérempli avec la dernière valeur connue
  const lastAlcohol = latestValues()['alcohol']?.value;
  if (lastAlcohol != null) answers.alcohol = lastAlcohol;
  NUTRITION_QUESTIONS.forEach(q => {
    const row = h('div', { class: 'field-row' });
    const infoBtn = q.infoKey
      ? h('button', {
          type: 'button', class: 'info-btn', dataset: { infoTest: q.infoKey },
          title: q.infoTitle, 'aria-label': q.infoTitle, text: 'ⓘ',
        })
      : null;
    if (q.type === 'stars') {
      const starsWrap = h('div', { class: 'sleep-stars', dataset: { nutritionQ: q.id } });
      const starBtns = [1, 2, 3, 4, 5].map(n => h('button', {
        type: 'button', class: 'sleep-star', dataset: { star: String(n) },
        title: `${n}/5`, 'aria-label': `${n} sur 5`, text: '\u2606',
      }));
      starsWrap.append(...starBtns);
      row.append(h('label', {}, q.label, infoBtn ? ' ' : null, infoBtn, starsWrap));
      qWrap.appendChild(row);
      starBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const n = parseInt(btn.dataset.star, 10);
          answers[q.id] = n;
          starBtns.forEach(b => {
            const v = parseInt(b.dataset.star, 10);
            b.classList.toggle('active', v <= n);
            b.textContent = v <= n ? '\u2605' : '\u2606';
          });
          updateNutritionResult(answers);
          updateSaveState();
        });
      });
    } else {
      const inp = h('input', {
        type: 'number', step: String(q.step), min: String(q.min), max: String(q.max),
        dataset: { nutrition: q.id }, placeholder: q.unit, style: { width: '110px' },
      });
      if (q.id === 'alcohol' && lastAlcohol != null) inp.value = lastAlcohol;
      row.append(h('label', {}, q.label, infoBtn ? ' ' : null, infoBtn, inp, ' ', h('span', { class: 'small' }, q.unit)));
      qWrap.appendChild(row);
      inp.addEventListener('input', () => {
        const raw = inp.value.trim();
        const num = raw === '' ? null : parseFloat(raw.replace(',', '.'));
        const invalid = raw !== '' && (isNaN(num) || num < q.min || num > q.max);
        inp.classList.toggle('invalid', invalid);
        answers[q.id] = invalid ? null : num;
        updateNutritionResult(answers);
        updateSaveState();
      });
    }
  });
  updateNutritionResult(answers);
  function updateNutritionResult(a) {
    // Le score porte sur les 6 questions pondérées ; N7 (alcool) est informatif et optionnel
    const scored = NUTRITION_QUESTIONS.filter(q => !q.contextual);
    const answered = scored.filter(q => a[q.id] != null).length;
    const complete = answered === scored.length;
    if (!complete) {
      resultEl.replaceChildren(
        h('b', {}, 'Questionnaire incomplet'),
        ` (${answered}/6) — le score nécessite les 6 réponses.`
      );
      scoreInput.value = '';
    } else {
      const score = nutritionScore(a);
      const lvl = nutritionLevel(score);
      const alcoholTxt = a.alcohol != null ? ` · alcool ${a.alcohol} verre${a.alcohol > 1 ? 's' : ''}/sem` : '';
      resultEl.replaceChildren(
        h('b', {}, `Score alimentaire : ${score}/100`),
        ` — ${lvl.label}`,
        h('br'),
        h('span', { class: 'small' },
          `Fruits & légumes ${a.veg} portion${a.veg > 1 ? 's' : ''}/j · boissons sucrées ${a.sugary}/j · ultra-transformés ${a.ultra} fois/sem · petit-déjeuner ${a.breakfast}/5 · maison ${a.homecooked}/5 · eau ${a.water} verre${a.water > 1 ? 's' : ''}/j${alcoholTxt}`
        ),
        h('div', { class: 'small', style: { marginTop: '4px' } },
          'Repères OMS : ≥ 5 portions de fruits & légumes/jour · limiter les boissons sucrées · ≥ 80 équilibré · 60–79 moyen · < 60 à améliorer'
        )
      );
      scoreInput.value = score;
    }
    // N7 alcool persisté dès qu'elle est saisie (hors score, alimente le risque cardio)
    alcoholInput.value = a.alcohol != null ? a.alcohol : '';
  }
  if (lastScore != null) {
    const info = h('div', { class: 'field-last' }, 'Dernier : score ', h('b', {}, `${lastScore}`), '/100');
    block.insertBefore(info, qWrap);
  }
}

function renderSessionFields() {
  const type = currentSessionType;
  const groups = SESSION_GROUPS[type];
  const container = $('#session-fields');
  container.replaceChildren();
  for (const g of groups) {
    const block = document.createElement('div');
    block.className = 'session-block';
    block.replaceChildren(h('h3', {}, GROUP_LABELS[g]));
    if (g === 'activity') {
      renderIpaqBlock(block);
      container.appendChild(block);
      updateSaveState();
      return;
    }
    if (g === 'sleep') {
      renderSleepBlock(block);
      container.appendChild(block);
      updateSaveState();
      return;
    }
    if (g === 'nutrition') {
      renderNutritionBlock(block);
      container.appendChild(block);
      updateSaveState();
      return;
    }
    container.appendChild(block); // dans le DOM avant les rows (initCooperEstim fait des querySelector globaux)
    for (const t of TESTS.filter(x => x.group === g && x.id !== 'vma' && x.id !== 'vo2max')) {
      // --- Test escalier : 3 méthodes au choix (sélecteur radio + un seul row actif) ---
      if (STAIR_METHODS.includes(t.id)) {
        // Le sélecteur n'est rendu qu'une fois (avec la 1re méthode)
        if (t.id === 'stair_pulse') {
          const sel = h('div', { class: 'stair-method-select' },
            h('span', { class: 'row ifg-period-group', id: 'stair-method', title: 'Méthode de mesure', style: { margin: '0 0 6px' } },
              h('label', { class: 'ifg-period-opt' },
                h('input', { type: 'radio', name: 'stair-method', value: 'stair_pulse', checked: true }),
                ' Méthode 1 — Pouls à 1 min'),
              h('label', { class: 'ifg-period-opt' },
                h('input', { type: 'radio', name: 'stair-method', value: 'stair_steps' }),
                ' Méthode 2 — Marches en 60 s'),
              h('label', { class: 'ifg-period-opt' },
                h('input', { type: 'radio', name: 'stair-method', value: 'stair_4floors' }),
                ' Méthode 3 — 4 étages chronométrés')));
          block.appendChild(sel);
        }
        const row = document.createElement('div');
        row.className = 'field-row stair-method-row';
        row.dataset.stairMethod = t.id;
        const chronoBtn = chronoBtns.includes(t.id)
          ? h('button', { class: 'chrono-btn', dataset: { chronoTarget: t.id }, text: '⏱' }) : null;
        // Timer 3 min (méthode 1, avec chaînage 1 min) ou 60 s (méthode 2)
        const stairTimerBtn = t.id === 'stair_pulse'
          ? h('button', {
              class: 'timer-btn',
              dataset: {
                timerMs: '180000', timerEditable: '1', timerMetronome: '1',
                timerLabel: 'Test escalier — montées (24/min)',
                timerNextMs: '60000',
                timerNextLabel: 'Escalier — mesure du pouls dans 1 min (asseyez-vous)'
              },
              title: 'Compte à rebours 3 min pour les montées d’escalier (durée réglable, métronome 96 bpm disponible), puis 1 min auto avant la mesure du pouls',
              text: '⏳'
            })
          : t.id === 'stair_steps'
            ? h('button', {
                class: 'timer-btn',
                dataset: { timerMs: '60000', timerLabel: 'Escalier — marches en 60 s' },
                title: 'Compte à rebours 60 s pour compter les marches',
                text: '⏳'
              })
            : null;
        const infoBtn = t.info
          ? h('button', { class: 'info-btn', dataset: { infoTest: t.id }, title: 'Comment réaliser ce test ?', 'aria-label': `Informations sur ${t.name}`, text: 'ⓘ' }) : null;
        const last = latestValues()[t.id]?.value;
        const lastInfo = last != null
          ? h('div', { class: 'field-last' }, 'Dernier : ', h('b', {}, `${last}`), ` ${t.unit}`) : null;
        row.replaceChildren(...nodes(
          h('label', {},
            h('span', { class: 'test-num', text: testNum(t.id) }), t.name, ' ',
            infoBtn,
            h('div', { class: 'field-hint', text: t.hint || '' }),
            lastInfo),
          h('input', {
            type: 'number', step: 'any', min: String(t.min ?? 0), max: String(t.max ?? 999),
            dataset: { test: t.id }, placeholder: t.unit,
            ...(t.id !== 'stair_pulse' ? { disabled: true } : {})
          }),
          chronoBtn,
          stairTimerBtn));
        block.appendChild(row);
        const inp = row.querySelector('input[data-test]');
        inp.addEventListener('input', () => updateFieldValidity(t, inp));
        continue; // saute le rendu générique ci-dessous
      }
      const row = document.createElement('div');
      row.className = 'field-row';
      const chronoBtn = chronoBtns.includes(t.id)
        ? h('button', { class: 'chrono-btn', dataset: { chronoTarget: t.id }, text: '⏱' }) : null;
      // Timer compte à rebours à durée fixe : chaise 30 s (compter les répétitions)
      const chairTimerBtn = t.id === 'chair'
        ? h('button', {
            class: 'timer-btn',
            dataset: { timerMs: '30000', timerLabel: 'Chaise 30 s — répétitions' },
            title: 'Compte à rebours 30 s pour compter les répétitions',
            text: '⏳'
          }) : null;
      const infoBtn = t.info
        ? h('button', { class: 'info-btn', dataset: { infoTest: t.id }, title: 'Comment réaliser ce test ?', 'aria-label': `Informations sur ${t.name}`, text: 'ⓘ' }) : null;
      const last = latestValues()[t.id]?.value;
      const lastInfo = last != null
        ? h('div', { class: 'field-last' }, 'Dernier : ', h('b', {}, `${last}`), ` ${t.unit}`) : null;
      // Choix de durée pour le Cooper en boutons radio (12 min ou demi-Cooper 6 min, normalisé ×2)
      const cooperSelect = t.id === 'cooper'
        ? h('span', { class: 'row ifg-period-group', id: 'cooper-duration', title: 'Durée du test', style: { margin: '0' } },
            h('label', { class: 'ifg-period-opt' },
              h('input', { type: 'radio', name: 'cooper-duration', value: '12', checked: true }),
              ' 12 min (complet)'),
            h('label', { class: 'ifg-period-opt' },
              h('input', { type: 'radio', name: 'cooper-duration', value: '6' }),
              ' 6 min (demi-Cooper)'))
        : null;
      // Bloc d'estimation VMA / VO2max pour le Cooper (champs optionnels + calculs croisés)
      const cooperEstim = t.id === 'cooper'
        ? h('div', { class: 'cooper-estim' },
            h('div', { class: 'row', style: { margin: '6px 0' } },
              h('label', {},
                'VMA (km/h) : ',
                h('input', { type: 'number', id: 'cooper-vma', step: '0.1', min: '4', max: '30', placeholder: 'ex. 12,5', style: { width: '90px' } })),
              h('label', {},
                'VO2max (ml/kg/min) : ',
                h('input', { type: 'number', id: 'cooper-vo2', step: '0.1', min: '10', max: '90', placeholder: 'ex. 44', style: { width: '90px' } }))),
            h('div', { class: 'field-hint', text: 'Au moins un des 3 champs (distance, VMA ou VO2max) suffit à enregistrer la session.' }),
            h('div', { id: 'cooper-estim-result', class: 'estimation-box hidden' }))
        : null;
      row.replaceChildren(...nodes(
        h('label', {},
          h('span', { class: 'test-num', text: testNum(t.id) }), t.name, ' ',
          infoBtn,
          h('div', { class: 'field-hint', text: t.hint || '' }),
          lastInfo),
        cooperSelect,
        h('input', {
          type: 'number', step: 'any', min: String(t.min ?? 0), max: String(t.max ?? 999),
          dataset: { test: t.id }, placeholder: t.unit
        }),
        chronoBtn,
        chairTimerBtn,
        cooperEstim));
      block.appendChild(row); // ← le row DOIT être dans le DOM avant initCooperEstim
      const inp = row.querySelector('input[data-test]');
      inp.addEventListener('input', () => updateFieldValidity(t, inp));
      if (t.id === 'cooper') initCooperEstim(inp);
    }
  }
  // --- Test escalier : activer/désactiver les inputs selon la méthode choisie ---
  if (type === 'cardio') initStairMethod();
  updateSaveState();
  // Avertissement Cooper si facteurs de risque majeurs
  const profile = getProfile();
  if (type === 'cardio' && hasMajorRisk(profile)) {
    const n = riskFactors(profile).filter(f => f.major).length;
    const s = n > 1 ? 's' : '';
    const w = h('div', { class: 'warning' },
      '⚠️ ',
      h('b', {}, 'Test de Cooper déconseillé'),
      ` : ${n} facteur${s} de risque cardio majeur${s} déclaré${s} dans votre profil. Avis médical recommandé avant un test maximal (privilégiez le test de l’escalier, sous-maximal).`);
    container.prepend(w);
  }
}

// ---------- Test escalier : sélecteur de méthode (1/2/3) ----------
// Affiche uniquement le row de la méthode choisie ; les inputs des autres méthodes
// sont désactivés (ignorés à la sauvegarde) et leurs timers/chronos masqués.
function initStairMethod() {
  const apply = () => {
    const checked = document.querySelector('input[name="stair-method"]:checked');
    const active = checked ? checked.value : 'stair_pulse';
    document.querySelectorAll('.stair-method-row').forEach(row => {
      const isActive = row.dataset.stairMethod === active;
      row.classList.toggle('hidden', !isActive);
      const inp = row.querySelector('input[data-test]');
      if (inp) inp.disabled = !isActive;
    });
  };
  // Délégation : les radios sont re-rendus à chaque affichage de la session
  document.addEventListener('change', e => {
    if (e.target.name === 'stair-method') apply();
  });
  apply();
}

// ---------- Pop-up d'aide à la réalisation d'un test (icône ⓘ) ----------
// Contenu statique pour les explications hors tests (id commençant par « __ »)
const STATIC_INFOS = {
  __portion__: {
    name: 'Qu’est-ce qu’une portion de fruits & légumes ?',
    info: `<ul>
      <li>Une <b>portion</b> ≈ <b>80–100 g</b> de fruits ou de légumes, soit environ une poignée.</li>
      <li><b>Exemples</b> : 1 pomme, 1 banane, 1 orange, 1 poignée de raisins, 1 bol de soupe de légumes, 1 assiette de légumes crus ou cuits, 1 verre de jus de fruit (100 % pur, sans sucre ajouté — compte pour 1 portion max/jour).</li>
      <li><b>Repère OMS</b> : au moins <b>5 portions par jour</b> (≈ 400 g), idéalement variées et de saison.</li>
      <li>Les <b>légumineuses</b> (lentilles, pois chiches, haricots) comptent comme une portion de légumes <i>et</i> apportent des protéines.</li>
      <li>Les <b>fruits secs</b> (abricots, raisins secs…) : une petite poignée = 1 portion (30 g), à modérer (caloriques).</li>
      <li>Les <b>pommes de terre</b> et autres féculents ne comptent pas comme des légumes.</li>
    </ul>`
  },
  __trends__: {
    name: 'Tendances par dimension',
    info: `<ul>
      <li>Le <b>score moyen</b> est la moyenne des points de statut de chaque mesure de la dimension : 🟢 bon = 100, 🟠 moyen = 60, 🔴 faible = 25.</li>
      <li>Il va de <b>25</b> (tout est faible) à <b>100</b> (tout est bon).</li>
      <li><b>Score moyen (30 j)</b> = mesures des 30 derniers jours ; <b>Avant</b> = mesures antérieures à cette période.</li>
      <li><b>▲ en hausse</b> : +3 points ou plus · <b>▼ en baisse</b> : −3 points ou plus · <b>= stable</b> : entre −2 et +2 · <b>nouveau</b> : pas de mesure avant.</li>
      <li>Ce score est propre à chaque dimension — il n'est pas l'IFG (qui pondère les dimensions entre elles).</li>
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
  __sleep__: {
    name: 'Score de sommeil ↔ Indice FitTrack Global',
    info: `<ul>
      <li>Ce graphique croise votre <b>score de sommeil</b> (/100, axe horizontal) avec votre <b>Indice FitTrack Global</b> (IFG, axe vertical) à la même date.</li>
      <li>Chaque point est une date où un bilan de sommeil a été enregistré. L'IFG est recalculé avec toutes les données disponibles à cette date.</li>
      <li><b>Repères verticaux</b> : <span style="color:var(--ok)">80 = bon sommeil</span> (ligne pleine) · <span style="color:var(--warn)">60 = seuil moyen</span> (ligne pointillée).</li>
      <li><b>Corrélation de Pearson</b> (r entre −1 et +1) : mesure la force du lien linéaire entre les deux séries.
        <ul>
          <li><b>r proche de +1</b> : quand le sommeil s'améliore, l'IFG monte aussi (corrélation positive forte).</li>
          <li><b>r proche de 0</b> : pas de lien linéaire apparent.</li>
          <li><b>r proche de −1</b> : corrélation négative (rare ici).</li>
        </ul>
      </li>
      <li>Seuils usuels : |r| ≥ 0,7 = forte · 0,4–0,7 = modérée · 0,2–0,4 = faible · &lt; 0,2 = négligeable.</li>
      <li><b>Interprétation</b> : un sommeil de qualité favorise la récupération musculaire, la régulation hormonale et la performance cardiovasculaire. Une corrélation positive suggère que vos nuits influencent votre forme mesurée — pensez à surveiller votre sommeil autant que votre activité.</li>
      <li>Sources : PSQI (Buysse 1989), NSF (7–9 h), Cappuccio 2011 (méta-analyse sommeil/mortalité cardiovasculaire).</li>
    </ul>`
  },
  __diet__: {
    name: 'Habitudes alimentaires (profil)',
    info: `<ul>
      <li>Ces champs sont <b>déclaratifs</b> : ils ne participent pas au score, ils contextualisent votre bilan alimentaire hebdomadaire (onglet <b>Session → Alimentation</b>).</li>
      <li><b>Régime particulier</b> (végétarien, végétalien, sans gluten) : précise vos repères pour interpréter le score.</li>
      <li><b>Repas par jour</b> et <b>grignotage</b> : la régularité des repas et le grignotage influencent l'énergie, le poids et la récupération.</li>
      <li>Toutes ces données restent <b>100 % locales</b> sur votre appareil.</li>
    </ul>`
  },
  __nutrition__: {
    name: 'Score alimentaire ↔ Indice FitTrack Global',
    info: `<ul>
      <li>Ce graphique croise votre <b>score alimentaire</b> (/100, axe horizontal) avec votre <b>Indice FitTrack Global</b> (IFG, axe vertical) à la même date.</li>
      <li>Chaque point est une date où un bilan alimentaire a été enregistré. L'IFG est recalculé avec toutes les données disponibles à cette date.</li>
      <li><b>Repères verticaux</b> : <span style="color:var(--ok)">80 = alimentation équilibrée</span> (ligne pleine) · <span style="color:var(--warn)">60 = seuil moyen</span> (ligne pointillée).</li>
      <li><b>Corrélation de Pearson</b> (r entre −1 et +1) : mesure la force du lien linéaire entre les deux séries.
        <ul>
          <li><b>r proche de +1</b> : quand l'alimentation s'améliore, l'IFG monte aussi (corrélation positive forte).</li>
          <li><b>r proche de 0</b> : pas de lien linéaire apparent.</li>
        </ul>
      </li>
      <li>Seuils usuels : |r| ≥ 0,7 = forte · 0,4–0,7 = modérée · 0,2–0,4 = faible · &lt; 0,2 = négligeable.</li>
      <li><b>Interprétation</b> : l'alimentation influence le poids, le tour de taille, la tension, l'énergie et la récupération. Une corrélation positive suggère que vos habitudes alimentaires influencent votre forme mesurée.</li>
      <li>Sources : recommandations OMS (fruits &amp; légumes ≥ 400 g/j, limiter les boissons sucrées), classification NOVA des aliments ultra-transformés (Monteiro et al., 2019), études régime méditerranéen &amp; santé cardiovasculaire (Sofi et al., 2010 ; Widmer et al., 2015).</li>
    </ul>`
  },
  __sources__: {
    name: 'Sources scientifiques',
    info: `<ul>
      <li><b>IPAQ court (activité physique)</b> : Craig CL et al., « International physical activity questionnaire: 12-country reliability and validity », <i>Med Sci Sports Exerc</i>, 2003 — cotation MET-min/sem (8×intense, 4×modéré, 3,3×marche) et seuils 600 / 3000.</li>
      <li><b>Recommandations activité physique</b> : OMS, « Lignes directrices de l'OMS sur l'activité physique et la sédentarité », 2020 — ≥ 150 min d'activité modérée/semaine (≈ 600 MET-min/sem).</li>
      <li><b>Test escalier — méthode 1 (pouls à 1 min)</b> : test sous-maximal de récupération cardiaque — 3 min de montées à 24/min, pouls mesuré 1 min après l'arrêt (protocoles de step-test sous-maximaux).</li>
      <li><b>Test escalier — méthode 2 (marches en 60 s)</b> : test fonctionnel de capacité — nombre de marches gravis en 60 s. Interprétation : ≥ 80 bonne à très bonne endurance · 60–79 moyenne · 40–59 faible à modérée · &lt; 40 basse (pratiquant occasionnel).</li>
      <li><b>Test escalier — méthode 3 (4 étages chronométrés)</b> : test fonctionnel de capacité d'effort — temps pour monter 4 étages. Interprétation : &lt; 45 s très bon · 45–60 s bon · 60–90 s moyen · &gt; 90 s mauvais.</li>
      <li><b>Test de Cooper (endurance)</b> : Cooper KH, « A means of assessing maximal power output », <i>JAMA</i>, 1968 — distance maximale en 12 min, repères cardio-respiratoires adultes (H/F). Le demi-Cooper (6 min ×2) suit la même logique de normalisation.</li>
      <li><b>VMA &amp; VO2max estimées</b> : VMA = distance Cooper (m) ÷ 200 (Cooper 1968, relation distance/vitesse) ; VO2max = 3,5 × VMA (Léger &amp; Mercier, 1983) ; VO2max = (distance − 504,9) ÷ 44,73 (ACSM, <i>Guidelines for Exercise Testing and Prescription</i>) ; inverse : VMA = VO2max ÷ 3,5.</li>
      <li><b>Tour de taille (risque métabolique)</b> : seuils OMS/IDF — ≥ 94 cm (H) / ≥ 80 cm (F) : risque accru ; ≥ 102 / ≥ 88 cm : risque substantiellement accru.</li>
      <li><b>Pression artérielle</b> : seuils de référence usuels (ESC/ESH) — normale &lt; 120/80 mmHg, élevée 130–139/85–89 mmHg.</li>
      <li><b>Facteurs de risque cardiovasculaire</b> (tabagisme, antécédents personnels/familiaux, hypertension, diabète, dyslipidémie, alcool, stress, IMC) : cadre des recommandations <b>ESC 2021</b> sur la prévention cardiovasculaire et du score <b>SCORE2</b> (âge, sexe, tabagisme, pression artérielle systolique, cholestérol, antécédents familiaux).</li>
      <li><b>Force musculaire (préhension, pompes, chaise 30 s, gainage)</b> : repères issus des batteries de tests de forme fonctionnelle pour adultes (Rikli &amp; Jones, « Senior Fitness Test », 1999, pour la chaise 30 s ; protocoles communautaires usuels pour les autres).</li>
      <li><b>Équilibre unipodal &amp; Sit-and-reach</b> : protocoles standardisés de la littérature (test unipodal yeux ouverts/fermés, Senior Fitness Test pour la souplesse).</li>
      <li><b>Score global &amp; IFG (pondération des dimensions)</b> : cardio au repos &amp; métabolisme 20 %, endurance 20 %, force 20 %, équilibre &amp; mobilité 15 %, habitudes d'activité 10 %, sommeil &amp; récupération 10 %, alimentation 5 % — pondérations fondées sur les associations littérature entre condition physique (FC de repos, tour de taille, force, endurance, équilibre) et mortalité cardiovasculaire et toutes causes (ex. : Kodama et al., <i>JAMA</i> 2009, méta-analyse marche/course et mortalité ; Lee et al., méta-analyses fitness/mortalité). Les 5 mesures du score global sont celles les plus prédictives selon cette littérature.</li>
      <li><b>Temps assis</b> : seuils de sédentarité de la littérature IPAQ/OMS (objectif &lt; 4 h/jour ; alerte &gt; 8 h/jour).</li>
      <li><b>Score de sommeil (questionnaire 5 items)</b> : durée, qualité subjective, latence d'endormissement, réveils nocturnes et sensation au réveil — inspiré du <b>PSQI</b> (Buysse DJ et al., <i>Psychiatry Research</i>, 1989), abrégé pour un usage régulier. Pondération : durée 30 %, qualité 25 %, latence 15 %, réveils 15 %, réveil 15 %.</li>
      <li><b>Durée de sommeil recommandée</b> : <b>NSF (National Sleep Foundation)</b> — 7–9 h par nuit pour un adulte (18–64 ans), 7–8 h pour 65 ans et +. <b>OMS</b> : le sommeil insuffisant (&lt; 6 h) est associé à un risque accru de maladies cardiovasculaires, d'obésité et de troubles métaboliques.</li>
      <li><b>Import montre connectée</b> : les formats CSV (Garmin Connect, générique), TCX (Training Center XML) et GPX sont lus localement (FileReader). Le mapping estime la FC de repos (min de la journée), la durée de sommeil et un score provisoire, ainsi qu'un score IPAQ approximatif depuis les pas, la durée et la FC moyenne (3,3 MET×marche + 4×modérée + 8×intense, protocole IPAQ court Craig 2003).</li>
      <li><b>Sommeil et récupération</b> : un sommeil de qualité est un pilier de la récupération musculaire et de la régulation hormonale (métabolisme, sensibilité à l'insuline). Les méta-analyses associent un sommeil court ou de mauvaise qualité à une mortalité cardiovasculaire et toutes causes accrue (ex. : Cappuccio FP et al., <i>European Heart Journal</i>, 2011).</li>
      <li><b>Score alimentaire (questionnaire 6 items)</b> : fruits &amp; légumes, boissons sucrées, produits ultra-transformés, petit-déjeuner, repas maison et hydratation — inspiré des repères <b>OMS</b> (≥ 400 g/j de fruits &amp; légumes, limiter les boissons sucrées) et de la classification <b>NOVA</b> des aliments ultra-transformés (Monteiro CA et al., 2019). Pondération : fruits &amp; légumes 25 %, boissons sucrées 20 %, ultra-transformés 20 %, petit-déjeuner 10 %, repas maison 15 %, hydratation 10 %.</li>
      <li><b>Alimentation et santé cardiovasculaire</b> : les méta-analyses associent le régime méditerranéen et une alimentation riche en fruits/légumes à une réduction du risque cardiovasculaire (Sofi F et al., <i>Am J Clin Nutr</i>, 2010 ; Widmer RJ et al., <i>Am J Med</i>, 2015) ; les boissons sucrées sont associées au surpoids et au diabète de type 2 (Malik VS et al., méta-analyses).</li>
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
  if (e.key !== 'Escape') return;
  if (!$('#info-modal').classList.contains('hidden')) closeInfoModal();
  else if (!$('#edit-modal').classList.contains('hidden')) closeEditModal();
  else if (!$('#confirm-modal').classList.contains('hidden')) $('#confirm-modal-cancel').click();
});

function updateFieldValidity(t, inp) {
  if (inp.disabled) { inp.classList.remove('invalid'); return; } // méthode escalier inactive
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
  // Ignore les inputs disabled (méthodes escalier inactives)
  const activeInputs = $$('#session-fields input[data-test]').filter(i => !i.disabled);
  const filled = activeInputs.some(i => i.value.trim() !== '' && !i.classList.contains('invalid'));
  const invalid = activeInputs.some(i => i.classList.contains('invalid'));
  // Bloc Cooper : VMA ou VO2max seul suffit à enregistrer la session cardio
  const estim = cooperEstimValid();
  btn.disabled = !(filled || estim.filled);
  const count = activeInputs.filter(i => i.value.trim() !== '' && !i.classList.contains('invalid')).length + estim.count;
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
  const lines = []; // chaque entrée = [node <b>, texte]
  const hasVma = vma != null && !isNaN(vma);
  const hasVo2 = vo2 != null && !isNaN(vo2);
  if (hasVma) {
    lines.push([h('b', {}, 'VMA renseignée :'), ` ${fmt1(vma)} km/h`]);
    lines.push([h('b', {}, 'VO2max estimée :'), ` ${fmt1(vo2FromVMA(vma))} ml/kg/min`]);
  }
  if (hasVo2) {
    lines.push([h('b', {}, 'VO2max renseignée :'), ` ${fmt1(vo2)} ml/kg/min`]);
    lines.push([h('b', {}, 'VMA estimée :'), ` ${fmt1(vmaFromVo2(vo2))} km/h`]);
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
      ? [h('b', {}, 'Distance saisie (6 min) :'), ` ${Math.round(dist)} m → `, h('b', {}, `équiv. 12 min : ${Math.round(dist12)} m`)]
      : [h('b', {}, 'Distance Cooper (équiv. 12 min) :'), ` ${Math.round(dist12)} m`];
    lines.push(distLabel);
    lines.push([h('b', {}, 'VMA estimée :'), ` ${fmt1(vmaD)} km/h`]);
    lines.push([h('b', {}, 'VO2max estimée :'), ` ${fmt1(vo2D)} ml/kg/min`]);
  }
  if (!lines.length) { out.classList.add('hidden'); out.replaceChildren(); return; }
  const els = [];
  lines.forEach((line, i) => {
    if (i > 0) els.push(h('br'));
    els.push(...line);
  });
  out.replaceChildren(...els);
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
    if (inp.disabled) return; // méthode escalier inactive : ignorée
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
  if (!any) { toast('Aucune valeur saisie.', 'err'); return; }
  const session = { date: $('#session-date').value || todayStr(), type: currentSessionType, values };
  // fusion avec session existante à la même date ? Non : on garde tout l'historique.
  addSession(session);
  const msg = $('#session-saved-msg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
  $$('#session-fields input').forEach(i => { i.value = ''; i.classList.remove('invalid'); });
  // Efface aussi les champs VMA/VO2max du bloc Cooper
  ['#cooper-vma', '#cooper-vo2'].forEach(sel => { const el = $(sel); if (el) el.value = ''; });
  const estimBox = $('#cooper-estim-result'); if (estimBox) { estimBox.classList.add('hidden'); estimBox.replaceChildren(); }
  updateSaveState();
  renderLastSession();
  renderDashboard(); // met à jour l'historique du score global
  recordIFG(); // idem pour l'indice FitTrack Global
  renderIMC(); renderRiskSummary(); // poids saisi → IMC ; alcool N7 → facteurs de risque
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
// Métronome 96 bpm (24 montées/min) pour le test escalier méthode 1 :
// bip court toutes les 625 ms, synchronisé avec le timer (démarre/pause/arrêt avec lui).
let metroId = null, metroAudioCtx = null, metroEnabled = false;
const METRO_BPM = 96;
const METRO_INTERVAL_MS = 60000 / METRO_BPM; // 625 ms
function metroTick() {
  try {
    const ctx = metroAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    metroAudioCtx = ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 1320; // bip aigu, distinct du bip de fin (880 Hz)
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.08);
  } catch { /* audio indisponible */ }
}
function metroStart() {
  if (metroId) return;
  metroTick(); // bip immédiat au démarrage
  metroId = setInterval(metroTick, METRO_INTERVAL_MS);
}
function metroStop() {
  clearInterval(metroId); metroId = null;
}
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
  metroStop(); // le métronome s'arrête avec le timer
  if (finished) timerBeep();
}
function timerToggle() {
  if (timerId) {
    clearInterval(timerId); timerId = null; timerRunning = false;
    timerSetBtn(false);
    $('#timer').classList.remove('finished');
    metroStop(); // pause du métronome
  } else {
    timerRunning = true;
    timerSetBtn(true);
    $('#timer').classList.remove('finished');
    timerId = setInterval(timerUpdate, 100);
    if (metroEnabled) metroStart(); // le métronome démarre avec le timer
  }
}
function timerReset() {
  clearInterval(timerId); timerId = null; timerRunning = false;
  timerRemaining = timerDuration;
  $('#timer-display').textContent = timerFmt(timerRemaining);
  timerSetBtn(false);
  $('#timer').classList.remove('finished');
  timerNext = null; // reset annule aussi le chaînage prévu
  metroStop(); // reset arrête aussi le métronome
}
// Ouvre le timer pour un test donné : durée en ms, libellé, et mode de saisie de la durée.
// durationEditable=true → l'utilisateur peut régler la durée (en minutes) avant de lancer.
function openTimer(durationMs, label, durationEditable = false, next = null, metronome = false) {
  const el = $('#timer');
  if (!el) return;
  timerDuration = durationMs;
  timerLabel = label;
  timerNext = next; // chaînage auto à la fin (ex. escalier → pouls 1 min)
  metroEnabled = metronome; // métronome 96 bpm réservé au test escalier méthode 1
  const metroBtn = $('#timer-metronome');
  if (metroBtn) {
    metroBtn.classList.toggle('hidden', !metronome);
    metroBtn.classList.toggle('active', metronome);
    metroBtn.title = metronome
      ? 'Métronome 96 bpm actif — cliquez pour le couper'
      : 'Métronome 96 bpm (24 montées/min) — cliquez pour l\'activer';
  }
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
  metroEnabled = false; // fermeture désactive le métronome
  $('#timer-metronome')?.classList.add('hidden');
  const el = $('#timer');
  el.classList.add('hidden');
  el.classList.remove('above-chrono');
});
// Métronome 96 bpm : bouton affiché uniquement pour le test escalier méthode 1
$('#timer-metronome').addEventListener('click', () => {
  metroEnabled = !metroEnabled;
  const btn = $('#timer-metronome');
  btn.classList.toggle('active', metroEnabled);
  btn.title = metroEnabled
    ? 'Métronome 96 bpm actif — cliquez pour le couper'
    : 'Métronome 96 bpm (24 montées/min) — cliquez pour l\'activer';
  if (metroEnabled && timerRunning) metroStart();
  else metroStop();
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
  // data-timer-metronome="1" : active le métronome 96 bpm (test escalier méthode 1)
  const metronome = b.dataset.timerMetronome === '1';
  openTimer(dur, b.dataset.timerLabel || 'Compte à rebours', editable, next, metronome);
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

function ifgBarNodes(score) {
  const fill = `linear-gradient(to right, var(--bad) 0%, var(--bad) 20%, var(--warn) 20%, var(--warn) 40%, #f9a825 40%, #f9a825 60%, #9e9d24 60%, #9e9d24 80%, var(--ok) 80%, var(--ok) 100%)`;
  return h('div', {
    class: 'score-bar', role: 'progressbar', 'aria-valuenow': String(score),
    'aria-valuemin': '0', 'aria-valuemax': '100', title: `${score}/100`
  },
    h('div', { class: 'score-bar-track' },
      h('div', { class: 'score-bar-fill', style: { width: `${score}%`, background: fill } })),
    h('div', { class: 'score-bar-labels small' },
      h('span', { text: '0' }), h('span', { text: '20' }), h('span', { text: '40' }),
      h('span', { text: '60' }), h('span', { text: '80' }), h('span', { text: '100' })));
}

function renderAnalysis() {
  recordIFG();
  const profile = getProfile();
  const periodKey = (document.querySelector('input[name="ifg-period"]:checked') || {}).value || 'last';
  $('#ifg-period-label').textContent = ifgPeriodDesc(periodKey);
  const result = computeIFGPeriod(profile, periodKey);
  if (!result) {
    $('#ifg-content').replaceChildren(h('p', { text: 'Enregistrez des sessions de test pour calculer votre indice.' }));
    $('#ifg-radar').replaceChildren();
    $('#ifg-radar-legend').textContent = '';
    $('#ifg-strengths').replaceChildren();
    $('#ifg-advice').style.display = 'none';
    $('#ifg-chart').replaceChildren();
    $('#ifg-chart-stats').textContent = '';
    $('#ifg-trends').replaceChildren();
    $('#ifg-scatter').replaceChildren();
    $('#ifg-sleep-scatter').replaceChildren();
    $('#ifg-nutrition-scatter').replaceChildren();
    return;
  }

  // 1. IFG + barre + delta vs mesure précédente (historique IFG, indépendant de la période choisie)
  const series = ifgSeries();
  const prev = series.length >= 2 ? series[series.length - 2].value : null;
  const delta = prev != null ? result.score - prev : null;
  const palier = ifgPalier(result.score);
  const deltaBadge = delta == null ? null
    : delta > 0 ? h('span', { class: 'badge good', text: `▲ +${delta} pts depuis la dernière mesure` })
    : delta < 0 ? h('span', { class: 'badge low', text: `▼ ${delta} pts depuis la dernière mesure` })
    : h('span', { class: 'badge mid', text: '= stable depuis la dernière mesure' });
  const periodBadge = periodKey === 'last' ? null
    : h('span', { class: 'badge mid', text: IFG_PERIODS[periodKey].label });
  const scoreP = h('p', { style: { fontSize: '2em', fontWeight: '700', color: palier.color } },
    String(result.score),
    h('span', { style: { fontSize: '.6em' } }, ' /100'),
    ' ',
    h('span', { class: `badge ${result.score >= 80 ? 'good' : result.score >= 60 ? 'mid' : 'low'}`, text: palier.label }),
    periodBadge ? ' ' : null,
    periodBadge);
  $('#ifg-content').replaceChildren(...nodes(
    scoreP,
    ifgBarNodes(result.score),
    deltaBadge,
    h('p', { class: 'small', text: 'Moyenne pondérée de 7 dimensions : cardio au repos & métabolisme (20 %), endurance (20 %), force (20 %), équilibre & mobilité (15 %), habitudes d’activité (10 %), sommeil & récupération (10 %), alimentation (5 %).' })
  ));

  // 2. Radar des dimensions (SVG)
  renderIfgRadar(result.dims);

  // 3. Points forts / faibles + conseil
  const sorted = result.dims.slice().sort((a, b) => b.score - a.score);
  const best = sorted[0], worst = sorted[sorted.length - 1];
  $('#ifg-strengths').replaceChildren(
    h('li', {}, '💪 ', h('b', {}, 'Point fort'), ` : ${best.icon} ${best.label} — `, h('b', {}, `${best.score}/100`)),
    h('li', {}, '🎯 ', h('b', {}, 'À travailler'), ` : ${worst.icon} ${worst.label} — `, h('b', {}, `${worst.score}/100`))
  );
  const advice = $('#ifg-advice');
  if (worst.score < 60) {
    const tips = {
      cardio_rest: 'Priorisez la FC de repos et la tension artérielle : marchez 30 min/jour, limitez le sel, consultez si la tension reste élevée.',
      endurance: '2 séances de 20–30 min d\'endurance modérée par semaine (vélo, marche rapide, natation) font progresser vite.',
      strength: '2 séances de renforcement par semaine : pompes, gainage et chaise 30 s suffisent à démarrer.',
      balance: 'Travaillez l\'équilibre 5 min/jour (unipodal, yeux ouverts puis fermés) et la souplesse des jambes.',
      activity: 'Levez-vous toutes les heures et visez 150 min d\'activité modérée par semaine (marche comprise).',
      sleep: 'Visez 7–9 h de sommeil par nuit, avec des horaires réguliers — le sommeil régule l\'appétit et la récupération.',
      nutrition: 'Ciblez 5 portions de fruits & légumes par jour, limitez les boissons sucrées et cuisinez maison la majorité du temps.',
    };
    advice.replaceChildren(
      '💡 ',
      h('b', {}, 'Conseil'),
      ` : ${tips[worst.key] || 'Travaillez cette dimension en priorité.'}`
    );
    advice.style.display = '';
  } else advice.style.display = 'none';

  // 4. Courbe d'évolution de l'IFG
  renderIfgChart(series);

  // 5. Tendances par dimension (vs 30 jours avant)
  renderIfgTrends(profile);

  // 6. Nuage de points IPAQ ↔ IFG
  renderIfgScatter();

  // 7. Nuage de points Sommeil ↔ IFG
  renderIfgSleepScatter();

  // 8. Nuage de points Alimentation ↔ IFG
  renderIfgNutritionScatter();
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
  $('#ifg-radar').innerHTML = svg; // SVG : innerHTML conservé (pas de createElementNS fiable ici)
  $('#ifg-radar-legend').replaceChildren(...nodes(...dims.map(d =>
    h('div', { class: 'ifg-legend-item' }, `${d.icon} ${d.label} : `, h('b', {}, String(d.score)))
  )));
}

function renderIfgChart(series) {
  const data = series;
  if (!data.length) { $('#ifg-chart').replaceChildren(h('p', { class: 'small', text: 'Pas encore d’historique.' })); $('#ifg-chart-stats').textContent = ''; return; }
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
  $('#ifg-chart').replaceChildren();
  $('#ifg-chart').insertAdjacentHTML('beforeend', svg); // SVG : innerHTML conservé
  const first = data[0].value, lastV = data[data.length - 1].value;
  const delta = lastV - first;
  $('#ifg-chart-stats').replaceChildren(
    'Dernière valeur : ',
    h('b', {}, `${lastV}/100`),
    ' · Évolution depuis la 1re mesure : ',
    h('b', {}, `${delta > 0 ? '+' : ''}${delta} pts`)
  );
}

// Tendance d'une dimension : compare la moyenne des sessions des 30 derniers jours
// à celle de la période précédente (mêmes mesures présentes dans les deux périodes)
function renderIfgTrends(profile) {
  const sessions = getSessions();
  if (!sessions.length) { $('#ifg-trends').replaceChildren(h('p', { class: 'small', text: 'Aucune donnée.' })); return; }
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
  const rows = [h('tr', {},
    h('th', { text: 'Dimension' }), h('th', { text: 'Score moyen (30 j)' }),
    h('th', { text: 'Avant' }), h('th', { text: 'Tendance' }))];
  for (const d of IFG_DIMENSIONS) {
    const r = avgDim(recent, d), p = avgDim(previous, d);
    if (r == null && p == null) continue;
    let trend;
    if (r == null) trend = h('td', { class: 'muted', text: '—' });
    else if (p == null) trend = h('td', { class: 'muted', text: 'nouveau' });
    else if (r > p + 2) trend = h('td', { class: 'up', text: '▲ en hausse' });
    else if (r < p - 2) trend = h('td', { class: 'down', text: '▼ en baisse' });
    else trend = h('td', { class: 'muted', text: '= stable' });
    rows.push(h('tr', {},
      h('td', {}, `${d.icon} ${d.label}`),
      h('td', {}, h('b', {}, r != null ? String(r) : '—')),
      h('td', {}, p != null ? String(p) : '—'),
      trend));
  }
  $('#ifg-trends').replaceChildren(h('table', {}, ...nodes(...rows)));
}

// Nuage de points : IPAQ (X) ↔ IFG au moment de la mesure (Y)
// On recalcule l'IFG à chaque date de session où IPAQ est présent
function renderIfgScatter() {
  const sessions = getSessions().sort((a, b) => a.date < b.date ? -1 : 1);
  const ipaqDates = sessions.filter(s => s.values?.ipaq != null && s.values.ipaq !== '');
  if (ipaqDates.length < 2) { $('#ifg-scatter').replaceChildren(h('p', { class: 'small', text: 'Effectuez au moins 2 questionnaires IPAQ pour voir la corrélation.' })); return; }
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
  if (points.length < 2) { $('#ifg-scatter').replaceChildren(h('p', { class: 'small', text: 'Données insuffisantes.' })); return; }

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
  // Corrélation de Pearson
  const r = pearsonCorrelation(points.map(p => p.ipaq), points.map(p => p.ifg));
  const corrP = r != null
    ? h('p', { class: 'small', style: { marginTop: '6px' } }, '📊 ', correlationLabel(r))
    : null;
  $('#ifg-scatter').replaceChildren();
  $('#ifg-scatter').insertAdjacentHTML('beforeend', svg); // SVG : innerHTML conservé
  if (corrP) $('#ifg-scatter').appendChild(corrP);
}

// Coefficient de corrélation de Pearson entre deux séries appariées.
// Retourne un nombre entre -1 et 1, ou null si < 2 points ou variance nulle.
function pearsonCorrelation(xs, ys) {
  const n = xs.length;
  if (n < 2 || n !== ys.length) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  if (denom === 0) return null;
  return num / denom;
}

// Libellé qualitatif d'un coefficient de corrélation
function correlationLabel(r) {
  if (r == null) return '';
  const a = Math.abs(r);
  const dir = r > 0 ? 'positive' : 'négative';
  const rf = r.toFixed(2).replace('.', ',');
  if (a >= 0.7) return `Corrélation ${dir} forte (r = ${rf})`;
  if (a >= 0.4) return `Corrélation ${dir} modérée (r = ${rf})`;
  if (a >= 0.2) return `Corrélation ${dir} faible (r = ${rf})`;
  return `Pas de corrélation (r = ${rf})`;
}

// Nuage de points : Sommeil (X) ↔ IFG au moment de la mesure (Y)
// X = score de sommeil /100, repère vertical à 80 (seuil « bon sommeil »)
function renderIfgSleepScatter() {
  const el = $('#ifg-sleep-scatter');
  if (!el) return;
  const sessions = getSessions().sort((a, b) => a.date < b.date ? -1 : 1);
  const sleepDates = sessions.filter(s => s.values?.sleep_score != null && s.values.sleep_score !== '');
  if (sleepDates.length < 2) { el.replaceChildren(h('p', { class: 'small', text: 'Enregistrez au moins 2 bilans de sommeil pour voir la corrélation.' })); return; }
  const points = [];
  for (const s of sleepDates) {
    // IFG recalculé avec les données disponibles à cette date
    const upTo = sessions.filter(x => x.date <= s.date);
    const snapshotSessions = store.get('sessions', []);
    store.set('sessions', upTo);
    const res = computeIFG(getProfile());
    store.set('sessions', snapshotSessions);
    if (res) points.push({
      date: s.date,
      sleep: s.values.sleep_score,
      sleepHours: s.values.sleep_hours ?? null,
      ifg: res.score,
    });
  }
  if (points.length < 2) { el.replaceChildren(h('p', { class: 'small', text: 'Données insuffisantes.' })); return; }

  // Corrélation de Pearson
  const r = pearsonCorrelation(points.map(p => p.sleep), points.map(p => p.ifg));

  const W = 420, H = 260, PAD = 44;
  const xs = points.map(p => p.sleep), ys = points.map(p => p.ifg);
  let xLo = Math.min(...xs), xHi = Math.max(...xs);
  let yLo = Math.min(...ys), yHi = Math.max(...ys);
  // Bornes X toujours dans [0, 100] pour un score /100 lisible
  xLo = Math.max(0, Math.min(xLo, 50) - 5);
  xHi = Math.min(100, Math.max(xHi, 80) + 5);
  const xPad = (xHi - xLo) * 0.05 || 5, yPad = (yHi - yLo) * 0.1 || 5;
  yLo -= yPad; yHi += yPad;
  const X = v => PAD + (v - xLo) / (xHi - xLo) * (W - 2 * PAD);
  const Y = v => H - PAD - (v - yLo) / (yHi - yLo) * (H - 2 * PAD);
  let svg = `<svg viewBox="0 0 ${W} ${H}">`;
  // repère vertical à 80 (seuil « bon sommeil »)
  if (xLo <= 80 && 80 <= xHi)
    svg += `<line x1="${X(80)}" x2="${X(80)}" y1="${PAD}" y2="${H - PAD}" stroke="var(--ok)" stroke-dasharray="4 4"/><text x="${X(80)}" y="${PAD - 4}" text-anchor="middle" font-size="10" fill="var(--ok)">80 (bon)</text>`;
  // repère vertical à 60 (seuil « moyen »)
  if (xLo <= 60 && 60 <= xHi)
    svg += `<line x1="${X(60)}" x2="${X(60)}" y1="${PAD}" y2="${H - PAD}" stroke="var(--warn)" stroke-dasharray="2 4"/><text x="${X(60)}" y="${H - PAD + 12}" text-anchor="middle" font-size="9" fill="var(--warn)">60</text>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${H - PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  svg += `<line x1="${PAD}" x2="${PAD}" y1="${PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  // axes labels
  svg += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--muted)">Score de sommeil /100</text>`;
  svg += `<text x="12" y="${H / 2}" text-anchor="middle" font-size="11" fill="var(--muted)" transform="rotate(-90 12 ${H / 2})">IFG /100</text>`;
  points.forEach(p => {
    const durTxt = p.sleepHours != null ? ` · ${String(p.sleepHours).replace('.', ',')} h` : '';
    svg += `<circle cx="${X(p.sleep)}" cy="${Y(p.ifg)}" r="5" fill="#7c5cbf"><title>${p.date.split('-').reverse().join('/')} : sommeil ${p.sleep}/100${durTxt} · IFG ${p.ifg}</title></circle>`;
  });
  svg += '</svg>';
  const corrP = r != null
    ? h('p', { class: 'small', style: { marginTop: '6px' } }, '📊 ', correlationLabel(r))
    : null;
  el.replaceChildren();
  el.insertAdjacentHTML('beforeend', svg); // SVG : innerHTML conservé
  if (corrP) el.appendChild(corrP);
}

// Nuage de points : Alimentation (X) ↔ IFG au moment de la mesure (Y)
// X = score alimentaire /100, repères verticaux à 80 (bon) et 60 (moyen)
function renderIfgNutritionScatter() {
  const el = $('#ifg-nutrition-scatter');
  if (!el) return;
  const sessions = getSessions().sort((a, b) => a.date < b.date ? -1 : 1);
  const nutDates = sessions.filter(s => s.values?.nutrition_score != null && s.values.nutrition_score !== '');
  if (nutDates.length < 2) { el.replaceChildren(h('p', { class: 'small', text: 'Enregistrez au moins 2 bilans alimentaires pour voir la corrélation.' })); return; }
  const points = [];
  for (const s of nutDates) {
    // IFG recalculé avec les données disponibles à cette date
    const upTo = sessions.filter(x => x.date <= s.date);
    const snapshotSessions = store.get('sessions', []);
    store.set('sessions', upTo);
    const res = computeIFG(getProfile());
    store.set('sessions', snapshotSessions);
    if (res) points.push({ date: s.date, nutrition: s.values.nutrition_score, ifg: res.score });
  }
  if (points.length < 2) { el.replaceChildren(h('p', { class: 'small', text: 'Données insuffisantes.' })); return; }

  // Corrélation de Pearson
  const r = pearsonCorrelation(points.map(p => p.nutrition), points.map(p => p.ifg));

  const W = 420, H = 260, PAD = 44;
  const xs = points.map(p => p.nutrition), ys = points.map(p => p.ifg);
  let xLo = Math.min(...xs), xHi = Math.max(...xs);
  let yLo = Math.min(...ys), yHi = Math.max(...ys);
  // Bornes X toujours dans [0, 100] pour un score /100 lisible
  xLo = Math.max(0, Math.min(xLo, 50) - 5);
  xHi = Math.min(100, Math.max(xHi, 80) + 5);
  const xPad = (xHi - xLo) * 0.05 || 5, yPad = (yHi - yLo) * 0.1 || 5;
  yLo -= yPad; yHi += yPad;
  const X = v => PAD + (v - xLo) / (xHi - xLo) * (W - 2 * PAD);
  const Y = v => H - PAD - (v - yLo) / (yHi - yLo) * (H - 2 * PAD);
  let svg = `<svg viewBox="0 0 ${W} ${H}">`;
  // repère vertical à 80 (seuil « alimentation équilibrée »)
  if (xLo <= 80 && 80 <= xHi)
    svg += `<line x1="${X(80)}" x2="${X(80)}" y1="${PAD}" y2="${H - PAD}" stroke="var(--ok)" stroke-dasharray="4 4"/><text x="${X(80)}" y="${PAD - 4}" text-anchor="middle" font-size="10" fill="var(--ok)">80 (bon)</text>`;
  // repère vertical à 60 (seuil « moyen »)
  if (xLo <= 60 && 60 <= xHi)
    svg += `<line x1="${X(60)}" x2="${X(60)}" y1="${PAD}" y2="${H - PAD}" stroke="var(--warn)" stroke-dasharray="2 4"/><text x="${X(60)}" y="${H - PAD + 12}" text-anchor="middle" font-size="9" fill="var(--warn)">60</text>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${H - PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  svg += `<line x1="${PAD}" x2="${PAD}" y1="${PAD}" y2="${H - PAD}" stroke="var(--faint)"/>`;
  // axes labels
  svg += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="var(--muted)">Score alimentaire /100</text>`;
  svg += `<text x="12" y="${H / 2}" text-anchor="middle" font-size="11" fill="var(--muted)" transform="rotate(-90 12 ${H / 2})">IFG /100</text>`;
  points.forEach(p => {
    svg += `<circle cx="${X(p.nutrition)}" cy="${Y(p.ifg)}" r="5" fill="#2e8b57"><title>${p.date.split('-').reverse().join('/')} : alimentation ${p.nutrition}/100 · IFG ${p.ifg}</title></circle>`;
  });
  svg += '</svg>';
  const corrP = r != null
    ? h('p', { class: 'small', style: { marginTop: '6px' } }, '📊 ', correlationLabel(r))
    : null;
  el.replaceChildren();
  el.insertAdjacentHTML('beforeend', svg); // SVG : innerHTML conservé
  if (corrP) el.appendChild(corrP);
}

// ---------- Historique & graphiques ----------
function renderHistory() {
  // sélecteur de métrique : score global en haut de liste s'il a un historique
  const sel = $('#chart-metric');
  const scores = scoreSeries();
  const withData = TESTS.filter(t => t.id !== 'vma' && t.id !== 'vo2max' && seriesOf(t.id).length > 0);
  const options = [];
  if (scores.length) options.push(h('option', { value: '__score__', text: '★ Score global (/100)' }));
  options.push(...withData.map(t => h('option', { value: t.id, text: `${testNum(t.id)}${t.name}` })));
  if (options.length) {
    sel.replaceChildren(...nodes(...options));
    drawChart(sel.value);
  } else {
    sel.replaceChildren(h('option', { value: '', text: '— aucune donnée —' }));
    $('#chart').replaceChildren(h('p', { class: 'small', text: 'Enregistrez une session pour voir les graphiques.' }));
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
  $('#chart').replaceChildren();
  $('#chart').insertAdjacentHTML('beforeend', svg); // SVG : innerHTML conservé

  // stats
  const first = data[0].value, lastV = data[data.length - 1].value;
  const delta = lastV - first;
  const pct = (delta / Math.max(first, 1) * 100).toFixed(1);
  const st = statusOf(t, lastV, profile);
  $('#chart-stats').replaceChildren(...nodes(
    'Dernière valeur : ',
    h('b', {}, `${lastV} ${t.unit}`),
    st ? ` ${STATUS_LABEL[st]}` : null,
    ' · Évolution depuis la 1re mesure : ',
    h('b', {}, `${delta > 0 ? '+' : ''}${delta.toFixed(1)} ${t.unit} (${pct} %)`)
  ));
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
  $('#chart').replaceChildren();
  $('#chart').insertAdjacentHTML('beforeend', svg); // SVG : innerHTML conservé

  // stats
  const first = data[0].value, lastV = data[data.length - 1].value;
  const delta = lastV - first;
  const pct = (delta / Math.max(first, 1) * 100).toFixed(1);
  const st = lastV >= 80 ? 'good' : lastV >= 60 ? 'mid' : 'low';
  $('#chart-stats').replaceChildren(
    'Dernière valeur : ',
    h('b', {}, `${lastV} /100`),
    ' ',
    h('span', { class: `badge ${st}` }, STATUS_LABEL[st]),
    ' · Évolution depuis la 1re mesure : ',
    h('b', {}, `${delta > 0 ? '+' : ''}${delta.toFixed(1)} pts (${pct} %)`)
  );
}

// Le badge « ⌚ montre » est désormais construit en nœuds DOM (voir badgeNodes)
// pour la migration innerHTML → DOM. sessionSourceBadge (string) est supprimé.

function renderHistoryTable() {
  const sessions = getSessions().slice().reverse();
  const el = $('#history-table');
  if (!sessions.length) { el.replaceChildren(h('p', { class: 'small' }, 'Aucune mesure.')); return; }
  const rows = [h('tr', {}, h('th', {}, 'Date'), h('th', {}, 'Type'), h('th', {}, 'Résultats'))];
  for (const s of sessions) {
    const results = Object.entries(s.values || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([id, v]) => {
        const t = byId(id) || { name: id, unit: '' };
        return [
          `${t.name} : `,
          h('b', {}, String(v)),
          ` ${t.unit} `,
          h('button', {
            class: 'edit-btn',
            title: 'Corriger cette mesure',
            dataset: { editId: s.id || '', editDate: s.date, editTest: id },
          }, '✏️'),
        ];
      });
    // Aplatir et intercaler les séparateurs « · » entre les résultats
    const resultsCell = [];
    results.forEach((r, idx) => {
      if (idx > 0) resultsCell.push(' · ');
      resultsCell.push(...r);
    });
    rows.push(h('tr', {},
      h('td', {}, s.date),
      h('td', {}, GROUP_LABELS[s.type] || s.type, badgeNodes(s)),
      h('td', {}, resultsCell)
    ));
  }
  el.replaceChildren(h('table', {}, ...nodes(...rows)));
}

// Construit les nœuds du badge « ⌚ montre » (données importées) pour une session
function badgeNodes(s) {
  if (!s || s.source !== 'import') return null;
  const sport = s._sport ? h('span', { class: 'src-sport' }, ` ${s._sport}`) : null;
  return h('span', { class: 'src-badge', title: 'Données importées d’une montre connectée' }, '⌚ montre', sport);
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
  ['stress', 'Stress chronique / dépression', p => p.stress === 'yes' ? 'oui' : (p.stress === 'no' ? 'non' : '')],
  ['diet', 'Régime alimentaire', p => ({ vegetarian: 'Végétarien', vegan: 'Végétalien', glutenfree: 'Sans gluten', none: 'Aucun' }[p.diet] || '')],
  ['meals', 'Repas par jour', p => p.meals ?? ''],
  ['snacking', 'Grignotage fréquent', p => p.snacking === 'yes' ? 'oui' : (p.snacking === 'no' ? 'non' : '')],
];
function profileCsvLines(profile) {
  if (!profile) return [];
  return PROFILE_CSV_KEYS
    .filter(([key]) => profile[key] != null && profile[key] !== '')
    .map(([key, label, fmt]) => `# profil;${label};${fmt(profile)}`);
}

$('#export-csv').addEventListener('click', () => {
  const ids = TESTS.filter(t => t.id !== 'vma' && t.id !== 'vo2max').map(t => t.id);
  // Anciens exports : la colonne « Alcool (verres/semaine) » était un champ profil.
  // Elle est désormais une mesure (questionnaire Alimentation N7) — on l'ajoute en
  // tête de liste si au moins une session la contient, pour rester lisible.
  const hasAlcohol = getSessions().some(s => s.values?.alcohol != null && s.values.alcohol !== '');
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
      else if (key === 'snacking') data.profile.snacking = value === 'oui' ? 'yes' : (value === 'non' ? 'no' : null);
      else if (key === 'diet') data.profile.diet = ({ 'Végétarien': 'vegetarian', 'Végétalien': 'vegan', 'Sans gluten': 'glutenfree', 'Aucun': 'none' }[value] || null);
      else if (key === 'meals') data.profile.meals = value === '' ? null : value;
      else data.profile[key] = value === '' ? null : Number(value);
      continue;
    }
    const cols = line.split(';');
    if (!head) { head = cols; continue; }
    const typeLabel = cols[1];
    const type = Object.keys(GROUP_LABELS).find(k => GROUP_LABELS[k] === typeLabel) || typeLabel;
    const values = {};
    head.slice(2).forEach((name, i) => {
      // Colonne « Alcool (verres/semaine) » d'un ancien export (champ profil) :
      // on la redirige vers la mesure 'alcohol' (questionnaire Alimentation N7)
      const isLegacyAlcohol = name === 'Alcool (verres/semaine)';
      const id = isLegacyAlcohol ? 'alcohol' : TESTS.find(t => t.name === name || (t.aliases || []).includes(name))?.id;
      const raw = (cols[i + 2] ?? '').trim();
      if (id && raw !== '') values[id] = Number(raw);
    });
    data.sessions.push({ date: cols[0], type, values });
  }
  return data;
}


// ---------- Import montre connectée (Garmin Connect CSV, TCX, GPX) ----------
// Parse un export d'activité d'une montre connectée (Garmin, Fitbit, Polar, Apple
// Health, etc.) et le convertit en sessions FitTrack. 100 % local : le fichier est
// lu côté client, jamais envoyé sur un serveur.
//
// Formats supportés :
//   - CSV Garmin Connect « Activities » (colonnes : Activity Type, Date, Distance,
//     Calories, Duration, Avg HR, Max HR, Avg Pace, ...)
//   - CSV générique (colonnes reconnues : date, distance_km, calories, duree_min,
//     fc_moy, fc_max, pas, sommeil_h, ...)
//   - TCX (Training Center XML) : activités avec FC, distance, durée, calories
//   - GPX : trace avec timestamps (durée, distance, FC optionnelle)
//
// Mapping vers les tests FitTrack :
//   - FC de repos (fc)          ← min(FC) d'une journée (repos nocturne inclus)
//   - Score de sommeil          ← durée de sommeil estimée (Garmin « Sleep » CSV)
//   - Durée moyenne sommeil     ← durée de sommeil (h)
//   - IPAQ (activité)           ← pas + durée d'activité modérée/intense
// Les autres mesures (force, équilibre, Cooper) restent manuelles.

// Parse CSV simple (gère les guillemets "..." avec ; ou , comme séparateur)
function parseCsvGeneric(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ';' || c === ',') { row.push(field.trim()); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim()); field = '';
      if (row.some(f => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field.trim()); rows.push(row); }
  return rows;
}

// Normalise un nom de colonne (minuscules, sans accents/espaces)
function normCol(name) {
  return String(name || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Synonymes de colonnes Garmin Connect / génériques → champ interne
const GARMIN_COL_MAP = {
  date: ['date', 'starttime', 'starttimelocal', 'datetime', 'jour', 'day', 'activitydate'],
  type: ['activitytype', 'type', 'sport', 'activite', 'activity'],
  distanceKm: ['distance', 'distancekm', 'distancekilometers', 'distancem', 'distanceenkm'],
  calories: ['calories', 'kcal', 'cal', 'energy', 'depense'],
  durationMin: ['duration', 'durationmin', 'duree', 'dureemin', 'temps', 'elapsedtime', 'movingtime'],
  avgHr: ['avghr', 'averageheartrate', 'hrmean', 'fcmoyenne', 'fcmoy', 'avgheart rate'],
  maxHr: ['maxhr', 'maximumheartrate', 'hrmax', 'fcmax', 'maxheart rate'],
  minHr: ['minhr', 'minimumheartrate', 'hrmin', 'fcmin'],
  restingHr: ['restinghr', 'restingheartrate', 'fcde repos', 'fc repos', 'resting heart rate'],
  steps: ['steps', 'stepcount', 'pas', 'nombredepas', 'total steps'],
  sleepHours: ['sleephours', 'sleeptime', 'dureedesommeil', 'sommeil', 'sleeptotal', 'duree sommeil', 'sleep'],
  avgSpeed: ['avgspeed', 'averagespeed', 'vitessemoyenne'],
  elevation: ['elevationgain', 'totalascent', 'denivele', 'elevation', 'ascension'],
};

// Construit l'index colonne → champ interne à partir d'une ligne d'en-tête
function buildColIndex(header) {
  const idx = {};
  header.forEach((h, i) => {
    const n = normCol(h);
    for (const [field, synonyms] of Object.entries(GARMIN_COL_MAP)) {
      if (synonyms.some(s => normCol(s) === n)) { idx[field] = i; break; }
    }
  });
  return idx;
}

// Parse une date Garmin ("2024-01-15 08:30:00", "15/01/2024", ISO, etc.)
function parseGarminDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  // ISO : 2024-01-15T08:30:00, 2024-01-15 08:30:00 ou 2024-01-15 (date seule)
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ].*)?$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  // JJ/MM/AAAA ou MM/JJ/AAAA : si le 1er groupe > 12 → c'est JJ/MM (FR),
  // sinon si le 2e > 12 → c'est MM/JJ (US), sinon défaut FR (JJ/MM/AAAA)
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (m) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10), y = m[3];
    if (a > 12) return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`; // JJ/MM
    if (b > 12) return `${y}-${String(a).padStart(2, '0')}-${String(b).padStart(2, '0')}`; // MM/JJ
    return `${y}-${String(b).padStart(2, '0')}-${String(a).padStart(2, '0')}`; // défaut FR
  }
  const d = new Date(s);
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

// Parse un nombre Garmin ("1,234.56", "1 234,56", "12 min", "1:23:45")
function parseGarminNumber(raw) {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim();
  // Durée au format h:mm:ss ou mm:ss → minutes
  const dur = s.match(/^(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (dur) {
    const h = parseInt(dur[1] || '0', 10), m = parseInt(dur[2], 10), sec = parseInt(dur[3], 10);
    return Math.round((h * 60 + m + sec / 60) * 100) / 100;
  }
  // Nombre avec séparateur décimal , ou . (gère "1,234.56" et "1 234,56")
  const cleaned = s.replace(/\s/g, '').replace(/,/g, '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

// Parse un CSV Garmin Connect (ou générique) → sessions FitTrack
function parseGarminCsv(text) {
  const rows = parseCsvGeneric(text);
  if (!rows.length) return { sessions: [] };
  const idx = buildColIndex(rows[0]);
  if (idx.date == null) return { sessions: [] }; // pas de colonne date reconnue (idx.date = 0 est valide)
  const sessions = [];
  const byDate = new Map(); // agrégation par jour

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const date = parseGarminDate(cols[idx.date]);
    if (!date) continue;
    const get = f => (idx[f] != null ? cols[idx[f]] : null);
    const rec = {
      type: (get('type') || '').toLowerCase(),
      distanceKm: parseGarminNumber(get('distanceKm')),
      calories: parseGarminNumber(get('calories')),
      durationMin: parseGarminNumber(get('durationMin')),
      avgHr: parseGarminNumber(get('avgHr')),
      maxHr: parseGarminNumber(get('maxHr')),
      minHr: parseGarminNumber(get('minHr')),
      restingHr: parseGarminNumber(get('restingHr')),
      steps: parseGarminNumber(get('steps')),
      sleepHours: parseGarminNumber(get('sleepHours')),
    };
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push(rec);
  }

  // Agrégation par jour → sessions FitTrack
  for (const [date, recs] of byDate) {
    const values = {};
    // FC de repos = Resting HR si disponible, sinon min des FC min de la journée
    const restingHrs = recs.map(r => r.restingHr).filter(v => v != null);
    const minHrs = recs.map(r => r.minHr).filter(v => v != null);
    const restHr = restingHrs.length
      ? Math.round(Math.min(...restingHrs))
      : (minHrs.length ? Math.round(Math.min(...minHrs)) : null);
    if (restHr != null && restHr >= 25 && restHr <= 120) values.fc = restHr;

    // Sommeil : durée en heures (si colonne sommeil présente)
    const sleepRecs = recs.filter(r => r.sleepHours != null && r.sleepHours > 0);
    if (sleepRecs.length) {
      const totalSleep = sleepRecs.reduce((s, r) => s + r.sleepHours, 0);
      values.sleep_hours = Math.round(totalSleep * 10) / 10;
      // Score de sommeil estimé depuis la durée seule (pondération partielle :
      // durée = 30 % du poids total → score = itemScore × 100/30 normalisé)
      // On stocke un score provisoire basé sur la durée (sera affiné si montre
      // fournit aussi qualité/latence dans un futur format).
      const q = SLEEP_QUESTIONS.find(x => x.id === 'hours');
      // Score provisoire basé sur la durée seule (item 0–100, pondération 30 %).
      // Un import ultérieur avec qualité/latence remplacera cette valeur.
      values.sleep_score = Math.round(sleepItemScore(q, totalSleep));
    }

    // Activité : pas totaux + durée d'effort (modéré si FC avg > 100 ou allure)
    // Estimation IPAQ : 3,3 MET × min de marche (pas) + 4 MET × min modéré + 8 MET × min intense
    // Approximation : 100 pas/min = marche modérée. Activités avec FC avg > 120 = intense.
    let metMin = 0;
    for (const r of recs) {
      if (r.steps && r.durationMin) {
        const pasParMin = r.steps / r.durationMin;
        if (pasParMin >= 90) metMin += 3.3 * r.durationMin; // marche
      }
      if (r.durationMin && r.avgHr) {
        if (r.avgHr >= 130) metMin += 8 * r.durationMin;      // intense
        else if (r.avgHr >= 100) metMin += 4 * r.durationMin; // modéré
      } else if (r.durationMin && r.calories) {
        // Sans FC : estimation par calories (~0,1 kcal/min/MET × poids estimé 70 kg)
        metMin += Math.max(0, (r.calories / 7) - 1) * r.durationMin * 0.5;
      }
    }
    if (metMin > 0) values.ipaq = Math.round(metMin);

    if (Object.keys(values).length) {
      // Type de session : priorité sommeil > repos (fc) > activité
      let type = 'activity';
      if (values.sleep_hours != null) type = 'sleep';
      else if (values.fc != null) type = 'rest';
      sessions.push({ date, type, values, source: 'import' });
    }
  }
  return { sessions };
}

// Parse un fichier TCX (Training Center XML) → sessions FitTrack
function parseTcx(text) {
  const sessions = [];
  // Extraction simple par regex (pas de DOMParser XML fiable hors-ligne sur tous
  // les navigateurs pour du XML embarqué — on reste en vanilla JS pur)
  const activityRe = /<Activity[^>]*Sport="([^"]*)"[^>]*>([\s\S]*?)<\/Activity>/gi;
  let m;
  while ((m = activityRe.exec(text))) {
    const sport = m[1];
    const body = m[2];
    const dateM = body.match(/<Id>(\d{4}-\d{2}-\d{2})T/);
    const date = dateM ? dateM[1] : null;
    if (!date) continue;
    const distM = body.match(/<DistanceMeters>([\d.]+)<\/DistanceMeters>/);
    const durM = body.match(/<TotalTimeSeconds>([\d.]+)<\/TotalTimeSeconds>/);
    const calM = body.match(/<Calories>(\d+)<\/Calories>/);
    const hrValues = [...body.matchAll(/<Value>(\d+)<\/Value>/g)].map(x => parseInt(x[1], 10));
    const values = {};
    if (hrValues.length) {
      const minHr = Math.min(...hrValues);
      if (minHr >= 25 && minHr <= 120) values.fc = minHr;
    }
    if (distM) {
      const km = parseFloat(distM[1]) / 1000;
      if (km > 0) values._distanceKm = Math.round(km * 100) / 100;
    }
    if (durM) values._durationMin = Math.round(parseFloat(durM[1]) / 60 * 100) / 100;
    if (calM) values._calories = parseInt(calM[1], 10);
    if (Object.keys(values).length) {
      sessions.push({ date, type: values.fc != null ? 'rest' : 'activity', values, source: 'import', _sport: sport });
    }
  }
  return { sessions };
}

// Parse un fichier GPX → sessions FitTrack (durée + distance, FC si présente)
function parseGpx(text) {
  const sessions = [];
  const trkptRe = /<trkpt[^>]*lat="([^"]*)"[^>]*lon="([^"]*)"[^>]*>([\s\S]*?)<\/trkpt>/gi;
  const points = [];
  let m;
  while ((m = trkptRe.exec(text))) {
    const body = m[3];
    const timeM = body.match(/<time>([^<]+)<\/time>/);
    const hrM = body.match(/<(?:hr|heartrate|heart_rate)>(?:<[^>]+>)?(\d+)/i);
    const eleM = body.match(/<ele>([^<]+)<\/ele>/);
    if (timeM) {
      points.push({
        time: new Date(timeM[1].trim()),
        hr: hrM ? parseInt(hrM[1], 10) : null,
        ele: eleM ? parseFloat(eleM[1]) : null,
      });
    }
  }
  if (points.length < 2) return { sessions: [] };
  points.sort((a, b) => a.time - b.time);
  const date = points[0].time.toISOString().slice(0, 10);
  const durationMin = (points[points.length - 1].time - points[0].time) / 60000;
  // Distance totale (formule de Haversine) — re-parse lat/lon depuis le texte
  const pts2 = [];
  const re2 = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"/gi;
  while ((m = re2.exec(text))) pts2.push({ lat: parseFloat(m[1]), lon: parseFloat(m[2]) });
  let dist = 0;
  for (let i = 1; i < pts2.length; i++) {
    const R = 6371, dLat = (pts2[i].lat - pts2[i - 1].lat) * Math.PI / 180;
    const dLon = (pts2[i].lon - pts2[i - 1].lon) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(pts2[i - 1].lat * Math.PI / 180)
      * Math.cos(pts2[i].lat * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    dist += 2 * R * Math.asin(Math.sqrt(a));
  }
  const hrVals = points.map(p => p.hr).filter(v => v != null);
  const values = {};
  if (hrVals.length) {
    const minHr = Math.min(...hrVals);
    if (minHr >= 25 && minHr <= 120) values.fc = minHr;
  }
  if (dist > 0) values._distanceKm = Math.round(dist * 100) / 100;
  if (durationMin > 0) values._durationMin = Math.round(durationMin * 100) / 100;
  if (Object.keys(values).length) {
    sessions.push({ date, type: values.fc != null ? 'rest' : 'activity', values, source: 'import' });
  }
  return { sessions };
}

// Supprime les champs internes (préfixe _) d'une session importée — ils servent
// au debug mais ne sont pas des tests FitTrack et ne doivent pas polluer le stockage.
function cleanImportedSession(s) {
  if (!s || !s.values) return s;
  const values = {};
  for (const [k, v] of Object.entries(s.values)) {
    if (!k.startsWith('_') && v != null && v !== '') values[k] = v;
  }
  return { ...s, values };
}

// Détecte le format d'un fichier montre et parse → { sessions }
function parseWatchFile(text, filename) {
  const name = (filename || '').toLowerCase();
  const head = text.slice(0, 500).trim();
  if (name.endsWith('.tcx') || head.startsWith('<?xml') && head.includes('<TrainingCenterDatabase')) {
    return parseTcx(text);
  }
  if (name.endsWith('.gpx') || head.startsWith('<?xml') && head.includes('<gpx')) {
    return parseGpx(text);
  }
  if (name.endsWith('.csv') || head.includes(';') || head.includes(',')) {
    // Essaie d'abord le parseur Garmin, fallback sur le parseur FitTrack existant
    const garmin = parseGarminCsv(text);
    if (garmin.sessions.length) return garmin;
    return { sessions: parseImportCsv(text).sessions || [] };
  }
  if (name.endsWith('.json')) {
    return JSON.parse(text);
  }
  throw new Error('Format non reconnu (attendu : CSV, TCX, GPX, JSON).');
}

// Nettoie les sessions d'un résultat de parse montre (retire les champs internes _xxx)
function cleanWatchSessions(data) {
  if (!data || !Array.isArray(data.sessions)) return data;
  return { ...data, sessions: data.sessions.map(cleanImportedSession) };
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
      const name = file.name.toLowerCase();
      let data;
      // Fichiers montre connectée (Garmin, TCX, GPX, CSV générique)
      if (name.endsWith('.tcx') || name.endsWith('.gpx') || name.endsWith('.fit')) {
        data = cleanWatchSessions(parseWatchFile(text, file.name));
        const n = applyImportedData(data);
        showImportMsg(`✅ Import montre réussi : ${n} session(s) importée(s).`);
        return;
      }
      if (name.endsWith('.csv')) {
        // Essaie d'abord le parseur montre (Garmin Connect), fallback export FitTrack
        const garmin = parseGarminCsv(text);
        if (garmin.sessions.length) {
          const n = applyImportedData(garmin);
          showImportMsg(`✅ Import montre réussi : ${n} session(s) importée(s).`);
          return;
        }
        data = { sessions: parseImportCsv(text).sessions || [] };
      } else {
        data = JSON.parse(text);
      }
      const n = applyImportedData(data);
      showImportMsg(`✅ Import réussi : ${n} élément(s) fusionné(s).`);
    } catch (err) {
      showImportMsg(`❌ Import impossible : ${err.message || 'fichier illisible'}`, false);
    }
  };
  reader.onerror = () => showImportMsg('❌ Lecture du fichier impossible.', false);
  reader.readAsText(file);
});

// ---------- Import montre connectée : bouton dédié + zone de drop ----------
// Même flux que l'import classique, mais avec un file picker acceptant
// .csv, .tcx, .gpx (exports Garmin Connect, Polar, Fitbit, etc.)
$('#import-watch-btn').addEventListener('click', () => $('#import-watch-file').click());
$('#import-watch-file').addEventListener('change', e => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = cleanWatchSessions(parseWatchFile(String(reader.result), file.name));
      const n = applyImportedData(data);
      showImportMsg(`✅ Import montre réussi : ${n} session(s) — FC de repos, sommeil et activité détectés.`, true);
    } catch (err) {
      showImportMsg(`❌ Import montre impossible : ${err.message || 'format non reconnu'}`, false);
    }
  };
  reader.onerror = () => showImportMsg('❌ Lecture du fichier impossible.', false);
  reader.readAsText(file);
});

// Zone de drop pour les fichiers montre (drag & drop sur la carte d'import)
const watchDrop = $('#watch-drop-zone');
if (watchDrop) {
  ['dragenter', 'dragover'].forEach(ev => watchDrop.addEventListener(ev, e => {
    e.preventDefault();
    watchDrop.classList.add('dragover');
  }));
  ['dragleave', 'drop'].forEach(ev => watchDrop.addEventListener(ev, e => {
    e.preventDefault();
    watchDrop.classList.remove('dragover');
  }));
  watchDrop.addEventListener('drop', e => {
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = cleanWatchSessions(parseWatchFile(String(reader.result), file.name));
        const n = applyImportedData(data);
        showImportMsg(`✅ Import montre réussi : ${n} session(s) — FC de repos, sommeil et activité détectés.`, true);
      } catch (err) {
        showImportMsg(`❌ Import montre impossible : ${err.message || 'format non reconnu'}`, false);
      }
    };
    reader.onerror = () => showImportMsg('❌ Lecture du fichier impossible.', false);
    reader.readAsText(file);
  });
}

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
  $('#p-stress').value = p.stress || '';
  $('#p-diet').value = p.diet || '';
  $('#p-meals').value = p.meals || '';
  $('#p-snacking').value = p.snacking || '';
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
    stress: $('#p-stress').value || null,
    diet: $('#p-diet').value || null,
    meals: $('#p-meals').value || null,
    snacking: $('#p-snacking').value || null,
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
  const rows = [h('tr', {}, h('th', {}, 'Test'), h('th', {}, 'Bon'), h('th', {}, 'Moyen'), h('th', {}, 'Faible'))];
  for (const t of TESTS) {
    if (t.good == null || t.id === 'vma' || t.id === 'vo2max') continue; // rendus plus bas (avec valeur courante)
    const { good, mid, rev } = thresholds(t, profile);
    rows.push(h('tr', {},
      h('td', {}, h('span', { class: 'test-num' }, testNum(t.id)), t.name),
      h('td', {}, `${rev ? '≤ ' : '≥ '}${good}`),
      h('td', {}, `${rev ? '≤ ' : '≥ '}${mid}`),
      h('td', {}, `${rev ? '> ' : '< '}${mid} ${t.unit}`)
    ));
  }
  // Indicateurs dérivés VMA / VO2max : repères avec la dernière valeur connue
  const lv = latestValues();
  for (const id of ['vma', 'vo2max']) {
    const t = byId(id);
    if (!t) continue;
    const { good, mid } = thresholds(t, profile);
    const cur = lv[id]?.value;
    const curSpan = cur != null
      ? h('span', { class: 'small' }, '(vous : ', h('b', {}, fmt1(cur)), ` ${t.unit}${lv[id].derived === 'cooper' ? ' · estimé Cooper' : ''})`)
      : h('span', { class: 'small' }, '(aucune mesure Cooper)');
    rows.push(h('tr', {},
      h('td', {}, h('span', { class: 'test-num' }, testNum(id)), t.name, ' ', curSpan),
      h('td', {}, `≥ ${good}`),
      h('td', {}, `≥ ${mid}`),
      h('td', {}, `< ${mid} ${t.unit}`)
    ));
  }
  $('#reference-table').replaceChildren(h('table', {}, ...rows));
}

$('#wipe-data').addEventListener('click', async () => {
  const ok = await confirmDialog('Effacer TOUTES les données (profil + mesures) ? Action irréversible.', { danger: true });
  if (!ok) return;
  Object.keys(localStorage).filter(k => k.startsWith('ft_')).forEach(k => localStorage.removeItem(k));
  renderProfileForm(); renderReferenceTable();
  if ($('#view-history').classList.contains('active')) renderHistory();
  toast('Données effacées.', 'ok', 2500);
});

// ---------- Export PDF (fiche de score imprimable) ----------
$('#export-pdf').addEventListener('click', () => {
  const profile = getProfile();
  const lv = latestValues();
  const sessions = getSessions();
  if (!sessions.length) { toast('Aucune donnée à exporter.', 'err'); return; }

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
  if (!w) { toast('Autorisez les pop-ups pour générer le PDF.', 'err'); return; }
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
