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
    gender: { H: { good: 17, mid: 12 }, F: { good: 16, mid: 11 } } },
  { id: 'stair_pulse', name: 'Test escalier — pouls à 1 min', unit: 'bpm', group: 'cardio', rev: true,
    hint: '3 min de montées (24/min), pouls 1 min après', good: 100, mid: 110, max: 200, min: 50,
    info: `<ul>
      <li>Échauffez-vous 5 min (marche sur place, montées lentes) avant de commencer.</li>
      <li>Montez et descendez un escalier à allure régulière : <b>24 montées par minute</b> (comptez-vous ou suivez un métronome à 96 bpm = 24 cycles montée+descente/min).</li>
      <li>Durée totale : <b>3 minutes</b> de montée/descente continue.</li>
      <li>Dès la fin, <b>asseyez-vous immédiatement</b> et prenez votre pouls pendant 60 s, <b>1 minute après l'arrêt</b> (comptez 15 s × 4 et multipliez par 4, ou 60 s complet).</li>
      <li>Notez ce pouls à 1 min : c'est votre résultat. Plus il est bas, meilleure est votre récupération cardiaque.</li>
      <li>Arrêtez en cas de douleur thoracique, vertiges ou essoufflement excessif — consultez un médecin avant de recommencer.</li>
      <li>Test sous-maximal : évitez si vous avez des antécédents cardiaques ou un traitement bêtabloquant (voir avertissement dans l'onglet Session).</li>
    </ul>` },
  { id: 'cooper', name: 'Cooper — distance (m, équiv. 12 min)', unit: 'm', group: 'cardio',
    hint: '12 min à allure soutenue, ou 6 min (demi-Cooper ×2)', good: 2400, mid: 2200, max: 5000, min: 200,
    gender: { H: { good: 2400, mid: 2200 }, F: { good: 2000, mid: 1800 } },
    info: `<ul>
      <li><b>Cooper complet (12 min)</b> : couvrez la plus grande distance possible en 12 minutes, à allure soutenue et régulière.</li>
      <li><b>Demi-Cooper (6 min)</b> : même principe sur 6 minutes. La distance saisie est <b>automatiquement doublée</b> pour rester comparable aux repères 12 min.</li>
      <li>Échauffez-vous 5–10 min avant, sur terrain plat et mesuré, chaussures adaptées.</li>
      <li>Test maximal : arrêtez en cas de douleur thoracique, essoufflement excessif ou vertiges.</li>
    </ul>` },
  { id: 'ipaq', name: 'IPAQ court — niveau d’activité', unit: 'MET-min/sem', group: 'activity',
    hint: 'Questionnaire sur les 7 derniers jours (score calculé automatiquement)',
    good: 3000, mid: 600, max: 30000, min: 0 },
  { id: 'sit', name: 'Temps assis (jour de semaine)', unit: 'min', group: 'activity', rev: true,
    hint: 'Question IPAQ n°7 — temps passé assis un jour de semaine habituel',
    good: 240, mid: 480, max: 1440, min: 0 },
];

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
  return out;
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
    const scored = d.tests.filter(id => lv[id]);
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
    const fill = `linear-gradient(to right, #b71c1c 0%, #b71c1c 20%, #e65100 20%, #e65100 40%, #f9a825 40%, #f9a825 60%, #9e9d24 60%, #9e9d24 80%, #2e7d32 80%, #2e7d32 100%)`;
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
    for (const t of TESTS.filter(x => x.group === g)) {
      const row = document.createElement('div');
      row.className = 'field-row';
      const chronoBtn = chronoBtns.includes(t.id)
        ? `<button class="chrono-btn" data-chrono-target="${t.id}">⏱</button>` : '';
      const infoBtn = t.info
        ? `<button class="info-btn" data-info-test="${t.id}" title="Comment réaliser ce test ?" aria-label="Informations sur ${t.name}">ⓘ</button>` : '';
      const last = latestValues()[t.id]?.value;
      const lastInfo = last != null
        ? `<div class="field-last">Dernier : <b>${last}</b> ${t.unit}</div>` : '';
      // Sélecteur de durée pour le Cooper (12 min ou demi-Cooper 6 min, normalisé ×2)
      const cooperSelect = t.id === 'cooper'
        ? `<select id="cooper-duration" title="Durée du test">
             <option value="12" selected>12 min (complet)</option>
             <option value="6">6 min (demi-Cooper ×2)</option>
           </select>` : '';
      row.innerHTML = `
        <label><span class="test-num">${testNum(t.id)}</span>${t.name}
          ${infoBtn}
          <div class="field-hint">${t.hint || ''}</div>
          ${lastInfo}
        </label>
        <input type="number" step="any" min="${t.min ?? 0}" max="${t.max ?? 999}"
               data-test="${t.id}" placeholder="${t.unit}">
        ${cooperSelect}
        ${chronoBtn}`;
      block.appendChild(row);
      const inp = row.querySelector('input[data-test]');
      inp.addEventListener('input', () => updateFieldValidity(t, inp));
    }
    container.appendChild(block);
  }
  updateSaveState();
  // Avertissement Cooper si facteurs de risque
  const profile = getProfile();
  if (type === 'cardio' && profile && (profile.smoke || profile.cardiacHistory)) {
    const w = document.createElement('div');
    w.className = 'warning';
    w.innerHTML = '⚠️ <b>Test de Cooper déconseillé</b> : facteurs de risque cardio déclarés dans votre profil. Avis médical recommandé avant un test maximal.';
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

function updateSaveState() {
  const btn = $('#save-session');
  const filled = $$('#session-fields input[data-test]').some(i => i.value.trim() !== '' && !i.classList.contains('invalid'));
  const invalid = $$('#session-fields input[data-test]').some(i => i.classList.contains('invalid'));
  btn.disabled = !filled;
  const count = $$('#session-fields input[data-test]').filter(i => i.value.trim() !== '' && !i.classList.contains('invalid')).length;
  $('#session-progress').textContent = count > 0 ? `${count} mesure${count > 1 ? 's' : ''} saisie${count > 1 ? 's' : ''}` : '';
  btn.title = invalid ? 'Corrigez les valeurs hors bornes' : '';
}

$$('.session-type-btn').forEach(b => b.addEventListener('click', () => {
  $$('.session-type-btn').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  currentSessionType = b.dataset.type;
  renderSessionFields();
}));

// Demi-Cooper (6 min) : le champ accepte 100–2500 m (×2 = 200–5000 m équiv. 12 min)
document.addEventListener('change', e => {
  if (e.target.id !== 'cooper-duration') return;
  const inp = $('#session-fields input[data-test="cooper"]');
  if (!inp) return;
  if (e.target.value === '6') { inp.min = 100; inp.max = 2500; inp.placeholder = 'm en 6 min (×2)'; }
  else { inp.min = 200; inp.max = 5000; inp.placeholder = 'm'; }
  updateFieldValidity(byId('cooper'), inp);
});

$('#save-session').addEventListener('click', () => {
  const values = {};
  let any = false;
  // Demi-Cooper : la distance 6 min est stockée en équivalent 12 min (×2)
  const cooperDuration = $('#cooper-duration')?.value === '6' ? 2 : 1;
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
  if (!any) { alert('Aucune valeur saisie.'); return; }
  const session = { date: $('#session-date').value || todayStr(), type: currentSessionType, values };
  // fusion avec session existante à la même date ? Non : on garde tout l'historique.
  addSession(session);
  const msg = $('#session-saved-msg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
  $$('#session-fields input').forEach(i => { i.value = ''; i.classList.remove('invalid'); });
  updateSaveState();
  renderLastSession();
  renderDashboard(); // met à jour l'historique du score global
  recordIFG(); // idem pour l'indice FitTrack Global
});

// ---------- Chronomètre ----------
let chronoTimer = null, chronoStart = 0, chronoElapsed = 0, chronoTargetId = null;
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
  chronoReset(); // le temps reporté est consommé : le chrono repart à zéro
});
document.addEventListener('click', e => {
  const b = e.target.closest('.chrono-btn');
  if (b) openChrono(b.dataset.chronoTarget);
});

// ---------- Onglet Analyse (IFG) ----------
const IFG_PALIERS = [
  { max: 20, color: '#b71c1c', label: 'Faible' },
  { max: 40, color: '#e65100', label: 'En dessous' },
  { max: 60, color: '#f9a825', label: 'En progrès' },
  { max: 80, color: '#9e9d24', label: 'Bon' },
  { max: 100, color: '#2e7d32', label: 'Excellent' },
];

function ifgPalier(score) {
  return IFG_PALIERS.find(p => score <= p.max);
}

function ifgBarHtml(score) {
  const palier = ifgPalier(score);
  const fill = `linear-gradient(to right, #b71c1c 0%, #b71c1c 20%, #e65100 20%, #e65100 40%, #f9a825 40%, #f9a825 60%, #9e9d24 60%, #9e9d24 80%, #2e7d32 80%, #2e7d32 100%)`;
  return `<div class="score-bar" role="progressbar" aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100" title="${score}/100">
    <div class="score-bar-track"><div class="score-bar-fill" style="width:${score}%;background:${fill}"></div></div>
    <div class="score-bar-labels small"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
  </div>`;
}

function renderAnalysis() {
  recordIFG();
  const profile = getProfile();
  const result = computeIFG(profile);
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

  // 1. IFG + barre + delta vs mois dernier
  const series = ifgSeries();
  const prev = series.length >= 2 ? series[series.length - 2].value : null;
  const delta = prev != null ? result.score - prev : null;
  const palier = ifgPalier(result.score);
  const deltaHtml = delta == null ? ''
    : delta > 0 ? `<span class="badge good">▲ +${delta} pts depuis la dernière mesure</span>`
    : delta < 0 ? `<span class="badge low">▼ ${delta} pts depuis la dernière mesure</span>`
    : `<span class="badge mid">= stable depuis la dernière mesure</span>`;
  $('#ifg-content').innerHTML = `
    <p style="font-size:2em;font-weight:700;color:${palier.color}">${result.score}<span style="font-size:.6em"> /100</span>
      <span class="badge ${result.score >= 80 ? 'good' : result.score >= 60 ? 'mid' : 'low'}">${palier.label}</span></p>
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

function renderIfgRadar(dims) {
  const W = 320, H = 280, CX = W / 2, CY = H / 2 + 6, R = 100;
  const n = IFG_DIMENSIONS.length;
  const angle = i => -Math.PI / 2 + i * 2 * Math.PI / n;
  const pt = (i, ratio) => `${CX + Math.cos(angle(i)) * R * ratio},${CY + Math.sin(angle(i)) * R * ratio}`;
  const dimByKey = Object.fromEntries(dims.map(d => [d.key, d]));
  let svg = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:340px">`;
  // anneaux de fond 25/50/75/100
  for (const r of [0.25, 0.5, 0.75, 1]) {
    svg += `<polygon points="${IFG_DIMENSIONS.map((_, i) => pt(i, r)).join(' ')}" fill="none" stroke="#dde5ec" stroke-width="1"/>`;
  }
  // axes + labels
  IFG_DIMENSIONS.forEach((d, i) => {
    svg += `<line x1="${CX}" y1="${CY}" x2="${pt(i, 1).split(',')[0]}" y2="${pt(i, 1).split(',')[1]}" stroke="#dde5ec"/>`;
    const lx = CX + Math.cos(angle(i)) * (R + 26), ly = CY + Math.sin(angle(i)) * (R + 26);
    svg += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="11" fill="#444">${d.icon} ${d.label.split(' ')[0]}</text>`;
  });
  // polygone des scores (dimensions manquantes ignorées : on trace sur les présentes)
  const present = IFG_DIMENSIONS.map((d, i) => ({ i, score: dimByKey[d.key]?.score })).filter(x => x.score != null);
  if (present.length >= 3) {
    const poly = present.map(x => pt(x.i, x.score / 100)).join(' ');
    svg += `<polygon points="${poly}" fill="rgba(31,78,121,.25)" stroke="#1F4E79" stroke-width="2"/>`;
    present.forEach(x => {
      const [px, py] = pt(x.i, x.score / 100).split(',');
      svg += `<circle cx="${px}" cy="${py}" r="4" fill="#1F4E79"/>`;
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
  svg += `<rect x="${PAD}" y="${Y(100)}" width="${W - 2 * PAD}" height="${Y(80) - Y(100)}" fill="#e5f3e5" opacity="0.7"/>`;
  svg += `<rect x="${PAD}" y="${Y(80)}" width="${W - 2 * PAD}" height="${Y(60) - Y(80)}" fill="#fff1e0" opacity="0.7"/>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(80)}" y2="${Y(80)}" stroke="#2e7d32" stroke-dasharray="4 4"/>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(60)}" y2="${Y(60)}" stroke="#e65100" stroke-dasharray="2 4"/>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${H - PAD}" y2="${H - PAD}" stroke="#999"/>`;
  svg += `<line x1="${PAD}" x2="${PAD}" y1="${PAD}" y2="${H - PAD}" stroke="#999"/>`;
  const pts = data.map(d => `${X(new Date(d.date).getTime())},${Y(d.value)}`).join(' ');
  if (data.length > 1) svg += `<polyline points="${pts}" fill="none" stroke="#1F4E79" stroke-width="2"/>`;
  data.forEach(d => {
    svg += `<circle cx="${X(new Date(d.date).getTime())}" cy="${Y(d.value)}" r="4" fill="#1F4E79"/>`;
    if (data.length <= 8 || d === data[0] || d === data[data.length - 1])
      svg += `<text x="${X(new Date(d.date).getTime())}" y="${H - PAD + 16}" text-anchor="middle" font-size="10" fill="#555">${d.date.slice(5)}</text>`;
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
    svg += `<line x1="${X(600)}" x2="${X(600)}" y1="${PAD}" y2="${H - PAD}" stroke="#2e7d32" stroke-dasharray="4 4"/><text x="${X(600)}" y="${PAD - 4}" text-anchor="middle" font-size="10" fill="#2e7d32">600 (OMS)</text>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${H - PAD}" y2="${H - PAD}" stroke="#999"/>`;
  svg += `<line x1="${PAD}" x2="${PAD}" y1="${PAD}" y2="${H - PAD}" stroke="#999"/>`;
  // axes labels
  svg += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="#555">IPAQ (MET-min/sem)</text>`;
  svg += `<text x="12" y="${H / 2}" text-anchor="middle" font-size="11" fill="#555" transform="rotate(-90 12 ${H / 2})">IFG /100</text>`;
  points.forEach(p => {
    svg += `<circle cx="${X(p.ipaq)}" cy="${Y(p.ifg)}" r="5" fill="#1F4E79"><title>${p.date.split('-').reverse().join('/')} : IPAQ ${p.ipaq} · IFG ${p.ifg}</title></circle>`;
  });
  svg += '</svg>';
  $('#ifg-scatter').innerHTML = svg;
}

// ---------- Historique & graphiques ----------
function renderHistory() {
  // sélecteur de métrique : score global en haut de liste s'il a un historique
  const sel = $('#chart-metric');
  const scores = scoreSeries();
  const withData = TESTS.filter(t => seriesOf(t.id).length > 0);
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
    svg += `<rect x="${PAD}" y="${a}" width="${W - 2 * PAD}" height="${Math.max(b - a, 0)}" fill="#fff1e0" opacity="0.7"/>`;
    const yGood = rev ? Y(good) : Y(good);
    const yEdge = rev ? lo : hi;
    svg += `<rect x="${PAD}" y="${rev ? Y(hi) : Y(hi)}" width="${W - 2 * PAD}" height="${Math.max(Y(good) - (rev ? Y(hi) : Y(hi)), 0)}" fill="#e5f3e5" opacity="0.7"/>`;
  }
  // lignes repères
  if (good != null) svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(good)}" y2="${Y(good)}" stroke="#2e7d32" stroke-dasharray="4 4"/><text x="${W - PAD}" y="${Y(good) - 4}" text-anchor="end" font-size="11" fill="#2e7d32">objectif ${good}${t.unit}</text>`;
  if (mid != null) svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(mid)}" y2="${Y(mid)}" stroke="#e65100" stroke-dasharray="2 4"/><text x="${W - PAD}" y="${Y(mid) - 4}" text-anchor="end" font-size="11" fill="#e65100">seuil ${mid}${t.unit}</text>`;
  // axes
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${H - PAD}" y2="${H - PAD}" stroke="#999"/>`;
  svg += `<line x1="${PAD}" x2="${PAD}" y1="${PAD}" y2="${H - PAD}" stroke="#999"/>`;
  // points + segments
  const pts = data.map(d => `${X(new Date(d.date).getTime())},${Y(d.value)}`).join(' ');
  if (data.length > 1) svg += `<polyline points="${pts}" fill="none" stroke="#1F4E79" stroke-width="2"/>`;
  data.forEach(d => {
    svg += `<circle cx="${X(new Date(d.date).getTime())}" cy="${Y(d.value)}" r="4" fill="#1F4E79"/>`;
  });
  // labels date
  data.forEach((d, i) => {
    if (data.length <= 8 || i === 0 || i === data.length - 1)
      svg += `<text x="${X(new Date(d.date).getTime())}" y="${H - PAD + 16}" text-anchor="middle" font-size="10" fill="#555">${d.date.slice(5)}</text>`;
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
  svg += `<rect x="${PAD}" y="${Y(100)}" width="${W - 2 * PAD}" height="${Y(80) - Y(100)}" fill="#e5f3e5" opacity="0.7"/>`;
  svg += `<rect x="${PAD}" y="${Y(80)}" width="${W - 2 * PAD}" height="${Y(60) - Y(80)}" fill="#fff1e0" opacity="0.7"/>`;
  // lignes repères
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(80)}" y2="${Y(80)}" stroke="#2e7d32" stroke-dasharray="4 4"/><text x="${W - PAD}" y="${Y(80) - 4}" text-anchor="end" font-size="11" fill="#2e7d32">80 — bon</text>`;
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${Y(60)}" y2="${Y(60)}" stroke="#e65100" stroke-dasharray="2 4"/><text x="${W - PAD}" y="${Y(60) - 4}" text-anchor="end" font-size="11" fill="#e65100">60 — seuil</text>`;
  // axes
  svg += `<line x1="${PAD}" x2="${W - PAD}" y1="${H - PAD}" y2="${H - PAD}" stroke="#999"/>`;
  svg += `<line x1="${PAD}" x2="${PAD}" y1="${PAD}" y2="${H - PAD}" stroke="#999"/>`;
  // points + segments
  const pts = data.map(d => `${X(new Date(d.date).getTime())},${Y(d.value)}`).join(' ');
  if (data.length > 1) svg += `<polyline points="${pts}" fill="none" stroke="#1F4E79" stroke-width="2"/>`;
  data.forEach(d => {
    svg += `<circle cx="${X(new Date(d.date).getTime())}" cy="${Y(d.value)}" r="4" fill="#1F4E79"/>`;
  });
  // labels date
  data.forEach((d, i) => {
    if (data.length <= 8 || i === 0 || i === data.length - 1)
      svg += `<text x="${X(new Date(d.date).getTime())}" y="${H - PAD + 16}" text-anchor="middle" font-size="10" fill="#555">${d.date.slice(5)}</text>`;
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
];
function profileCsvLines(profile) {
  if (!profile) return [];
  return PROFILE_CSV_KEYS
    .filter(([key]) => profile[key] != null && profile[key] !== '')
    .map(([key, label, fmt]) => `# profil;${label};${fmt(profile)}`);
}

$('#export-csv').addEventListener('click', () => {
  const ids = TESTS.map(t => t.id);
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
      else if (key === 'smoke' || key === 'cardiacHistory') data.profile[key] = value === 'oui';
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

// ---------- Profil ----------
function renderProfileForm() {
  const p = getProfile();
  if (!p) return;
  $('#p-sex').value = p.sex || 'H';
  $('#p-birth').value = p.birthYear || '';
  $('#p-height').value = p.height || '';
  $('#p-smoke').checked = !!p.smoke;
  $('#p-history').checked = !!p.cardiacHistory;
}

$('#save-profile').addEventListener('click', () => {
  const p = {
    sex: $('#p-sex').value,
    birthYear: parseInt($('#p-birth').value) || null,
    height: parseFloat($('#p-height').value) || null,
    smoke: $('#p-smoke').checked,
    cardiacHistory: $('#p-history').checked,
  };
  store.set('profile', p);
  const msg = $('#profile-saved-msg');
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 2500);
  renderReferenceTable();
});

function renderReferenceTable() {
  const profile = getProfile();
  let html = '<table><tr><th>Test</th><th>Bon</th><th>Moyen</th><th>Faible</th></tr>';
  for (const t of TESTS) {
    if (t.good == null) continue;
    const { good, mid, rev } = thresholds(t, profile);
    html += `<tr><td><span class="test-num">${testNum(t.id)}</span>${t.name}</td><td>${rev ? '≤ ' : '≥ '}${good}</td><td>${rev ? '≤ ' : '≥ '}${mid}</td><td>${rev ? '> ' : '< '}${mid} ${t.unit}</td></tr>`;
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
  $$('#view-profile').classList.add('active');
  $$('#view-dashboard').classList.remove('active');
  $$('nav button').forEach(x => x.classList.remove('active'));
  $$('nav button').find(x => x.dataset.view === 'profile')?.classList.add('active');
});
$('#onboarding-skip').addEventListener('click', () => {
  $('#onboarding').classList.add('hidden');
  store.set('onboarded', true);
});

$('#session-date').value = todayStr();
renderSessionFields();
renderProfileForm();
renderReferenceTable();
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
