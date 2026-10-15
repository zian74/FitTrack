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
    hint: 'Sur un pied jusqu\u2019à échec (2 essais/pied)', good: 40, mid: 20, max: 300, min: 0 },
  { id: 'balance_closed', name: 'Équilibre yeux fermés (s)', unit: 's', group: 'rest',
    hint: '', good: 10, mid: 5, max: 120, min: 0 },
  { id: 'reach', name: 'Sit-and-reach (cm atteints)', unit: 'cm', group: 'rest',
    hint: '0 = orteils, négatif = avant, positif = au-delà',
    good: 0, mid: -10, max: 40, min: -40 },
  { id: 'grip', name: 'Poigne — meilleure main (kg)', unit: 'kg', group: 'strength',
    hint: '2–3 essais par main, 30 s de repos entre essais',
    good: 45, mid: 35, max: 100, min: 5,
    gender: { H: { good: 45, mid: 35 }, F: { good: 30, mid: 20 } } },
  { id: 'pushups', name: 'Pompes maximales', unit: 'rép.', group: 'strength',
    hint: 'Sans pause, technique correcte',
    good: 35, mid: 20, max: 200, min: 0,
    gender: { H: { good: 35, mid: 20 }, F: { good: 20, mid: 10 } } },
  { id: 'plank', name: 'Gainage planche (s)', unit: 's', group: 'strength',
    hint: 'Dos plat, tenue maximale', good: 120, mid: 60, max: 600, min: 0 },
  { id: 'chair', name: 'Chaise 30 s (répétitions)', unit: 'rép.', group: 'strength',
    hint: 'Bras croisés, se lever/asseoir pendant 30 s', good: 17, mid: 12, max: 40, min: 0,
    gender: { H: { good: 17, mid: 12 }, F: { good: 16, mid: 11 } } },
  { id: 'stair_pulse', name: 'Test escalier — pouls à 1 min', unit: 'bpm', group: 'cardio', rev: true,
    hint: '3 min de montées (24/min), pouls 1 min après', good: 100, mid: 110, max: 200, min: 50 },
  { id: 'cooper', name: 'Cooper — distance 12 min (m)', unit: 'm', group: 'cardio',
    hint: 'Personnes actives uniquement', good: 2400, mid: 2200, max: 5000, min: 200,
    gender: { H: { good: 2400, mid: 2200 }, F: { good: 2000, mid: 1800 } } },
];

const byId = id => TESTS.find(t => t.id === id);
const GROUP_LABELS = { rest: 'Repos & mobilité', strength: 'Force', cardio: 'Cardio' };
// Groups présents par type de session
const SESSION_GROUPS = {
  rest: ['rest'],
  strength: ['strength'],
  cardio: ['cardio'],
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
const RETEST = { rest: 1, strength: 3, cardio: 3 };

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
}));

function showView(name) {
  $$('nav button').find?.(x => x.dataset.view === name)?.click?.();
}

// ---------- Dashboard ----------
function renderDashboard() {
  const profile = getProfile();
  $('#no-profile-warning').classList.toggle('hidden', !!profile);

  // Score global : moyenne des statuts des 5 tests prédictifs
  const PREDICTIVE = ['fc', 'waist', 'grip', 'stair_pulse', 'balance_open']; // ordre fixe: FC, taille, poigne, escalier, équilibre
  const lv = latestValues();
  const scoreEl = $('#score-global-content');
  const scored = PREDICTIVE.filter(id => lv[id]);
  if (!scored.length) {
    scoreEl.innerHTML = '<p>Aucune mesure enregistrée. Commencez par une <b>session de test</b>.</p>';
  } else {
    const pts = { good: 100, mid: 60, low: 25 };
    const rows = scored.map(id => {
      const t = byId(id);
      const st = statusOf(t, lv[id].value, profile);
      return `<li>${t.name} — ${lv[id].value} ${t.unit} <span class="badge ${st}">${STATUS_LABEL[st]}</span></li>`;
    });
    const avg = Math.round(scored.reduce((a, id) => {
      const t = byId(id);
      return a + pts[statusOf(t, lv[id].value, profile)];
    }, 0) / scored.length);
    scoreEl.innerHTML = `<p style="font-size:2em;font-weight:700;color:var(--accent)">${avg}<span style="font-size:.6em"> /100</span></p>
      <ul class="list">${rows.join('')}</ul>
      <p class="small">Basé sur les 5 mesures les plus prédictives (littérature) : poigne, tour de taille, FC repos, cardio sous-max, équilibre.</p>`;
  }

  // Tests dus
  const due = [];
  for (const [group, months] of Object.entries(RETEST)) {
    const ids = TESTS.filter(t => t.group === group).map(t => t.id);
    const last = ids.map(id => lv[id]?.date).filter(Boolean).sort().pop();
    const label = GROUP_LABELS[group];
    if (!last) due.push(`<li><b>${label}</b> — jamais effectué <span class="badge low">à faire</span></li>`);
    else {
      const m = monthsSince(last);
      const lastFr = last.split('-').reverse().join('/');
      if (m >= months) due.push(`<li><b>${label}</b> — dernier : ${lastFr} <span class="badge low">à refaire (${m} mois)</span></li>`);
      else due.push(`<li><b>${label}</b> — dernier : ${lastFr} <span class="badge good">à jour</span></li>`);
    }
  }
  $('#due-tests').innerHTML = due.join('');

  // Alertes de tendance : dégradation ou stagnation sur 2 sessions
  const alerts = [];
  const THRESH = { rest: 0.03, strength: 0.05, cardio: 0.05 };
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
  if (sessions.length === 0) compEl.innerHTML = '<p>Aucune donnée.</p>';
  else {
    const last2 = sessions.slice(-2).reverse(); // la plus récente d'abord [0], précédente [1]
    const frDate = d => d.split('-').reverse().join('/');
    // tous les tests présents dans les 2 dernières sessions
    const ids = [];
    for (const s of last2) for (const id of Object.keys(s.values || {})) {
      if (s.values[id] != null && s.values[id] !== '' && !ids.includes(id)) ids.push(id);
    }
    let html = '<table class="last3-table">';
    html += '<tr><th>Test</th>' + last2.map((s, i) => `<th>${i === 0 ? '📍 ' : ''}${frDate(s.date)}</th>`).join('') + '<th>Δ</th></tr>';
    for (const id of ids) {
      const t = byId(id);
      const cur = last2[0].values?.[id];   // plus récente
      const prv = last2[1]?.values?.[id];   // précédente
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
      html += `<tr><td class="test-name">${t.name}</td>`;
      html += hasCur
        ? `<td class="num">${cur} <button class="edit-btn" title="Corriger cette mesure" data-edit-id="${last2[0].id || ''}" data-edit-date="${last2[0].date}" data-edit-test="${id}">✏️</button></td>`
        : '<td class="num muted">—</td>';
      html += hasPrv
        ? `<td class="num">${prv} <button class="edit-btn" title="Corriger cette mesure" data-edit-id="${last2[1].id || ''}" data-edit-date="${last2[1].date}" data-edit-test="${id}">✏️</button></td>`
        : '<td class="num muted">—</td>';
      html += deltaCell + '</tr>';
    }
    html += '</table>';
    compEl.innerHTML = html;
  }
}

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

function findSession(ctx) {
  const sessions = getSessions();
  if (ctx.id) {
    const bySid = sessions.find(s => s.id === ctx.id);
    if (bySid) return bySid;
  }
  return sessions.find(s => s.date === ctx.date && s.values?.[ctx.testId] != null);
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
  const s = findSession(editCtx);
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
  const s = findSession(editCtx);
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

function renderSessionFields() {
  const type = currentSessionType;
  const groups = SESSION_GROUPS[type];
  const container = $('#session-fields');
  container.innerHTML = '';
  for (const g of groups) {
    const block = document.createElement('div');
    block.className = 'session-block';
    block.innerHTML = `<h3>${GROUP_LABELS[g]}</h3>`;
    for (const t of TESTS.filter(x => x.group === g)) {
      const row = document.createElement('div');
      row.className = 'field-row';
      const chronoBtn = chronoBtns.includes(t.id)
        ? `<button class="chrono-btn" data-chrono-target="${t.id}">⏱</button>` : '';
      const last = latestValues()[t.id];
      const lastInfo = last != null
        ? `<div class="field-last">Dernier : <b>${last}</b> ${t.unit}</div>` : '';
      row.innerHTML = `
        <label>${t.name}
          <div class="field-hint">${t.hint || ''}</div>
          ${lastInfo}
        </label>
        <input type="number" step="any" min="${t.min ?? 0}" max="${t.max ?? 999}"
               data-test="${t.id}" placeholder="${t.unit}">
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
  if (type === 'cardio' && profile && (profile.smoke || profile.cardiacHistory || profile.sedentaryRisk)) {
    const w = document.createElement('div');
    w.className = 'warning';
    w.innerHTML = '⚠️ <b>Test de Cooper déconseillé</b> : facteurs de risque cardio déclarés dans votre profil. Avis médical recommandé avant un test maximal.';
    container.prepend(w);
  }
}

function updateFieldValidity(t, inp) {
  const raw = inp.value.trim();
  const num = raw === '' ? null : parseFloat(raw.replace(',', '.'));
  const invalid = raw !== '' && (isNaN(num) || (t.min != null && num < t.min) || (t.max != null && num > t.max));
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

$('#save-session').addEventListener('click', () => {
  const values = {};
  let any = false;
  $$('#session-fields input[data-test]').forEach(inp => {
    const v = inp.value.trim();
    if (v !== '' && !inp.classList.contains('invalid')) {
      const num = parseFloat(v.replace(',', '.'));
      if (isNaN(num)) return;
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
  $$('#session-fields input').forEach(i => i.value = '');
  renderLastSession();
});

// ---------- Chronomètre ----------
let chronoTimer = null, chronoStart = 0, chronoElapsed = 0;
function chronoFmt(ms) {
  const s = ms / 1000;
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
function openChrono(targetId) {
  $('#chrono').classList.remove('hidden');
  $('#chrono-target').innerHTML = TESTS.filter(t => chronoBtns.includes(t.id))
    .map(t => `<option value="${t.id}" ${t.id === targetId ? 'selected' : ''}>${t.name}</option>`).join('');
}
function chronoUpdate() {
  chronoElapsed = Date.now() - chronoStart;
  $('#chrono-display').textContent = chronoFmt(chronoElapsed);
}
$('#chrono-start').addEventListener('click', () => {
  if (chronoTimer) return;
  chronoStart = Date.now() - chronoElapsed;
  chronoTimer = setInterval(chronoUpdate, 100);
});
$('#chrono-stop').addEventListener('click', () => {
  clearInterval(chronoTimer); chronoTimer = null;
});
$('#chrono-reset').addEventListener('click', () => {
  clearInterval(chronoTimer); chronoTimer = null; chronoElapsed = 0;
  $('#chrono-display').textContent = '00:00.0';
});
$('#chrono-send').addEventListener('click', () => {
  const target = $('#chrono-target').value;
  const inp = $(`#session-fields input[data-test="${target}"]`);
  if (inp) {
    inp.value = Math.round(chronoElapsed / 100) / 10;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  }
  $('#chrono').classList.add('hidden');
});
document.addEventListener('click', e => {
  const b = e.target.closest('.chrono-btn');
  if (b) openChrono(b.dataset.chronoTarget);
});

// ---------- Historique & graphiques ----------
function renderHistory() {
  // sélecteur de métrique
  const sel = $('#chart-metric');
  const withData = TESTS.filter(t => seriesOf(t.id).length > 0);
  if (withData.length) {
    sel.innerHTML = withData.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
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
$('#export-csv').addEventListener('click', () => {
  const ids = TESTS.map(t => t.id);
  const head = ['date', 'type', ...ids.map(id => byId(id).name)].join(';');
  const lines = getSessions().map(s =>
    [s.date, GROUP_LABELS[s.type], ...ids.map(id => s.values?.[id] ?? '')].join(';'));
  download([head, ...lines].join('\n'), 'fittrack_export.csv', 'text/csv');
});
$('#export-json').addEventListener('click', () => {
  download(JSON.stringify({ profile: getProfile(), sessions: getSessions() }, null, 2),
    'fittrack_export.json', 'application/json');
});

// ---------- Profil ----------
function renderProfileForm() {
  const p = getProfile();
  if (!p) return;
  $('#p-sex').value = p.sex || 'H';
  $('#p-birth').value = p.birthYear || '';
  $('#p-height').value = p.height || '';
  $('#p-activity').value = p.activity || 'sedentary';
  $('#p-smoke').checked = !!p.smoke;
  $('#p-sedentaryrisk').checked = !!p.sedentaryRisk;
  $('#p-history').checked = !!p.cardiacHistory;
}

$('#save-profile').addEventListener('click', () => {
  const p = {
    sex: $('#p-sex').value,
    birthYear: parseInt($('#p-birth').value) || null,
    height: parseFloat($('#p-height').value) || null,
    activity: $('#p-activity').value,
    smoke: $('#p-smoke').checked,
    sedentaryRisk: $('#p-sedentaryrisk').checked,
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
    html += `<tr><td>${t.name}</td><td>${rev ? '≤ ' : '≥ '}${good}</td><td>${rev ? '≤ ' : '≥ '}${mid}</td><td>${rev ? '> ' : '< '}${mid} ${t.unit}</td></tr>`;
  }
  html += '</table>';
  $('#reference-table').innerHTML = html;
}

$('#wipe-data').addEventListener('click', () => {
  if (confirm('Effacer TOUTES les données (profil + mesures) ? Action irréversible.')) {
    Object.keys(localStorage).filter(k => k.startsWith('ft_')).forEach(k => localStorage.removeItem(k));
    renderProfileForm(); renderReferenceTable();
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

  const PREDICTIVE = ['fc', 'waist', 'grip', 'stair_pulse', 'balance_open']; // ordre fixe: FC, taille, poigne, escalier, équilibre
  const pts = { good: 100, mid: 60, low: 25 };
  const scored = PREDICTIVE.filter(id => lv[id]);
  const score = scored.length
    ? Math.round(scored.reduce((a, id) => a + pts[statusOf(byId(id), lv[id].value, profile)], 0) / scored.length)
    : null;

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
// Enregistrement du service worker (PWA)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
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
