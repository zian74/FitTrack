// Smoke test audit accessibilité complet (point 4) :
// contraste (variables CSS), navigation clavier (skip link, focus trap, modales),
// lecteur d'écran (rôles, aria-label, tableaux, graphiques).
const fs = require('fs');
const path = require('path');
const { loadApp, check, summary, exit, ROOT } = require('./helpers');

const { window, document } = loadApp();
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// ============ 1. Contraste : variables corrigées (WCAG AA 4.5:1 minimum) ============
// On vérifie que les anciennes valeurs à problème ne sont plus là et que les
// nouvelles atteignent les ratios (valeurs vérifiées par /tmp/contrast-audit2.js).
const lightVars = {
  '--ok': '#1b5e20',      // sur blanc : 8.6:1
  '--warn': '#c2410c',    // sur blanc : 5.9:1
  '--faint': '#6b7280',   // sur blanc : 4.8:1
};
for (const [k, v] of Object.entries(lightVars)) {
  check(css.includes(`${k}: ${v}`), `variable clair ${k} = ${v} (contraste corrigé)`);
}
check(css.includes('--on-accent:'), 'variable --on-accent définie (texte sur boutons primaires en sombre)');
check(/:root\.dark\s+button\.primary.*color:\s*var\(--on-accent\)/s.test(css.replace(/\n/g, ' ')),
  'boutons primary en sombre utilisent --on-accent');
// Anciennes valeurs à bannir
for (const bad of ['#2e7d32', '#e65100', '--faint: #aaa', '--accent: #6ea8dc', '--faint: #5c6b7a', '--bad: #e06c6c']) {
  check(!css.includes(bad), `ancienne valeur faible contraste absente : ${bad}`);
}
// Bouton nav actif en thème sombre : le texte doit rester lisible sur --surface
// (la règle :root.dark nav button { color: var(--on-accent) } donnait 1.15:1)
check(/:root\.dark\s+nav\s+button\.active\s*\{[^}]*color:\s*var\(--accent\)/s.test(css),
  'thème sombre : nav button.active garde color: var(--accent) (contraste 7.5:1, pas --on-accent)');
check(/:root\.dark\s+nav\s+button,/.test(css) && /:root\.dark\s+nav\s+button[\s\S]{0,200}?color:\s*var\(--on-accent\)/.test(css),
  'thème sombre : nav button (inactif) utilise --on-accent sur fond accent (8.6:1)');
// En-têtes de ligne de tableaux (th[scope="row"]) : lisibles en thème sombre
// (:root.dark th { color: var(--on-accent) } donnait 1.15:1 sur --surface)
check(/:root\.dark\s+th\[scope="row"\]\s*\{[^}]*color:\s*var\(--text\)/s.test(css),
  'thème sombre : th[scope="row"] utilise --text (contraste 13.15:1, pas --on-accent à 1.15:1)');
// last3-table : la 1re colonne (noms de test) est sur 1 ligne (nowrap)
check(/\.last3-table\s*\{\s*table-layout:\s*auto/.test(css),
  'last3-table : table-layout auto (colonne Test s\'adapte au contenu)');
check(/\.last3-table\s+th:first-child[\s\S]{0,150}?white-space:\s*nowrap/.test(css),
  'last3-table : colonne Test sur 1 ligne (white-space: nowrap)');
// ifg-trends : Dimension élargie (30%), Score moyen (30 j) sur max 2 lignes
check(/#ifg-trends\s+th:first-child\s*\{[^}]*width:\s*30%/.test(css),
  'ifg-trends : colonne Dimension élargie à 30% (mots non coupés)');
check(/#ifg-trends\s+th:nth-child\(2\)[\s\S]{0,60}?width:\s*20%/.test(css),
  'ifg-trends : colonne Score moyen (30 j) à 20% (max 2 lignes)');
check(/#ifg-trends\s+th\[scope="col"\]\s*\{\s*overflow-wrap:\s*break-word/.test(css),
  'ifg-trends : th[scope="col"] en break-word (coupe entre les mots, pas au milieu)');
check(/#ifg-trends\s+th\[scope="row"\]\s*\{[^}]*overflow-wrap:\s*break-word/.test(css),
  'ifg-trends : colonne Dimension (th[scope="row"]) coupe entre les mots (break-word)');
// history-table : table-layout auto, Date et Type s'adaptent à leur contenu (nowrap)
check(/#history-table\s+table\s*\{\s*table-layout:\s*auto/.test(css),
  'history-table : table-layout auto (colonnes = largeur du contenu)');
check(/#history-table\s+th:first-child[\s\S]{0,100}?white-space:\s*nowrap/.test(css),
  'history-table : colonne Date en nowrap (largeur exacte de la date)');
check(/#history-table\s+th:nth-child\(2\)[\s\S]{0,100}?white-space:\s*nowrap/.test(css),
  'history-table : colonne Type en nowrap (largeur du plus long libellé)');
check(!/#history-table\s+th:first-child[\s\S]{0,100}?width:\s*110px/.test(css),
  'history-table : colonne Date sans width fixe (s\'adapte au contenu)');
check(!/#history-table\s+th:nth-child\(2\)[\s\S]{0,100}?width:\s*190px/.test(css),
  'history-table : colonne Type sans width fixe (s\'adapte au contenu)');
// reference-table : colonne Test sur 1 ligne (nowrap)
check(/#reference-table\s+table\s*\{\s*table-layout:\s*auto/.test(css),
  'reference-table : table-layout auto (colonne Test s\'adapte au contenu)');
check(/#reference-table\s+th:first-child[\s\S]{0,150}?white-space:\s*nowrap/.test(css),
  'reference-table : colonne Test sur 1 ligne (white-space: nowrap)');

// ============ 2. Navigation clavier ============
// 2a. Skip link
const skip = document.querySelector('.skip-link');
check(!!skip, 'skip link présent');
check(skip && skip.getAttribute('href') === '#main-content', 'skip link pointe vers #main-content');
check(!!document.getElementById('main-content'), 'élément #main-content (cible du skip link) existe');
check(/\.skip-link\s*\{[^}]*position:\s*absolute/s.test(css), 'CSS .skip-link : positionné hors écran');
check(/\.skip-link:focus\s*\{/.test(css), 'CSS .skip-link:focus : visible au focus clavier');

// 2b. Modales : rôle dialog + aria-modal + aria-labelledby
const modals = [
  ['#info-modal', 'dialog', 'info-modal-title'],
  ['#edit-modal', 'dialog', 'edit-title'],
  ['#onboarding', 'dialog', 'onboarding-title'],
  ['#confirm-modal', 'alertdialog', 'confirm-modal-msg'],
];
for (const [sel, role, titleId] of modals) {
  const overlay = document.querySelector(sel);
  const m = overlay && overlay.querySelector('.modal');
  check(!!m, `modale ${sel} : conteneur .modal existe`);
  check(m && m.getAttribute('role') === role, `${sel} a role="${role}"`);
  check(m && m.getAttribute('aria-modal') === 'true', `${sel} a aria-modal="true"`);
  check(m && m.getAttribute('aria-labelledby') === titleId, `${sel} a aria-labelledby="${titleId}"`);
  check(!!document.getElementById(titleId), `titre ${titleId} existe pour ${sel}`);
}

// 2c. Focus trap : fonctions présentes dans app.js
const js = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
check(/function focusableIn\(/.test(js), 'helper focusableIn() présent (focus trap)');
check(/function trapFocus\(/.test(js) && /Tab/.test(js), 'trapFocus() gère Tab/Shift+Tab');
check(/function openModal\(/.test(js) && /function closeModal\(/.test(js), 'openModal/closeModal présents');
check(/modalFocusReturn/.test(js), 'restauration du focus (modalFocusReturn) implémentée');

// 2d. Pas de tabindex négatif abusif ni de suppression du focus
check(!/tabindex="-1"/.test(html.replace(/<svg[\s\S]*?<\/svg>/g, '')),
  'aucun tabindex="-1" dans le HTML statique (hors SVG)');

// ============ 3. Lecteur d'écran ============
// 3a. Conteneurs de graphiques SVG : role=img + aria-label
const charts = ['#ifg-radar', '#ifg-chart', '#ifg-scatter', '#ifg-sleep-scatter', '#ifg-nutrition-scatter', '#chart'];
for (const sel of charts) {
  const el = document.querySelector(sel);
  check(!!el, `conteneur graphique ${sel} existe`);
  const role = el && el.getAttribute('role');
  const label = el && el.getAttribute('aria-label');
  const hidden = el && el.getAttribute('aria-hidden');
  check(role === 'img' && !!label,
    `${sel} a role="img" + aria-label (${label ? label.slice(0, 50) + '…' : 'MANQUANT'})`);
}

// 3b. Widgets flottants : régions nommées
const chrono = document.getElementById('chrono');
const timer = document.getElementById('timer');
check(chrono && chrono.getAttribute('role') === 'region' && !!chrono.getAttribute('aria-label'),
  '#chrono a role="region" + aria-label');
check(timer && timer.getAttribute('role') === 'region' && !!timer.getAttribute('aria-label'),
  '#timer a role="region" + aria-label');

// 3c. Boutons icône seule dans le HTML statique : tous ont aria-label ou title + texte
{
  const iconButtons = Array.from(document.querySelectorAll('button'))
    .filter(b => {
      const t = b.textContent.replace(/&#?\w+;/g, '').trim();
      return t.length > 0 && !/[a-zA-ZÀ-ÿ]/.test(t);
    });
  check(iconButtons.length > 0, `${iconButtons.length} boutons icône seule à vérifier`);
  for (const b of iconButtons) {
    const name = b.getAttribute('aria-label') || b.getAttribute('title');
    check(!!name, `bouton icône #${b.id || b.className} a un nom accessible${name ? ` ("${name.slice(0, 40)}")` : ' — MANQUANT'}`);
  }
}

// 3d. Tableaux dynamiques : caption + scope (vérifié après rendu avec données)
// On injecte 2 sessions pour déclencher les rendus de tableaux.
const store = window.__store;
store.set('sessions', [
  { id: 's1', date: '2025-01-01', type: 'rest', values: { weight: 80, chair: 15 } },
  { id: 's2', date: '2025-01-10', type: 'strength', values: { weight: 79, chair: 18 } },
]);
store.set('profile', { sex: 'H', birth: 1990, height: 180 });

// Re-rendre les vues (les fonctions vivent dans le scope du script évalué)
window.eval(`
  if (typeof renderLastSession === 'function') renderLastSession();
  if (typeof renderHistoryTable === 'function') renderHistoryTable();
  if (typeof renderReferenceTable === 'function') renderReferenceTable();
`);

const tables = document.querySelectorAll('table');
check(tables.length >= 3, `${tables.length} tableaux rendus (attendu ≥ 3)`);
for (const t of tables) {
  const cap = t.querySelector('caption');
  const wrap = t.closest('.table-wrap') || t.parentElement;
  const wrapId = wrap ? wrap.id : '?';
  check(!!cap && cap.textContent.trim().length > 0,
    `tableau dans #${wrapId} a une <caption> non vide`);
  const colScopes = t.querySelectorAll('th[scope="col"]');
  const rowScopes = t.querySelectorAll('th[scope="row"]');
  check(colScopes.length > 0, `tableau #${wrapId} : ${colScopes.length} th scope="col"`);
  check(rowScopes.length > 0, `tableau #${wrapId} : ${rowScopes.length} th scope="row"`);
  // aucun th sans scope
  const bareTh = Array.from(t.querySelectorAll('th')).filter(th => !th.getAttribute('scope'));
  check(bareTh.length === 0, `tableau #${wrapId} : aucun th sans scope`);
}

// 3e. Boutons d'action dynamiques (créés par h()) : aria-label présents
{
  // edit-btn dans last3-table
  const editBtns = document.querySelectorAll('#last-comparison .edit-btn');
  check(editBtns.length > 0, `${editBtns.length} boutons edit dans #last-comparison`);
  for (const b of editBtns) {
    check(!!b.getAttribute('aria-label'), `edit-btn a aria-label ("${(b.getAttribute('aria-label') || '').slice(0, 50)}")`);
  }
  // delete-session-btn
  const delBtns = document.querySelectorAll('#last-comparison .delete-session-btn');
  for (const b of delBtns) {
    check(!!b.getAttribute('aria-label'), `delete-session-btn a aria-label ("${(b.getAttribute('aria-label') || '').slice(0, 50)}")`);
  }
}

// 3f. Timer/chrono boutons dynamiques : aria-label sur tous les .timer-btn rendus
// Les timers (escalier, chaise) vivent dans les types cardio/strength.
document.querySelector('nav button[data-view="session"]').click();
const timerBtns = new Set();
const chronoBtns = new Set();
for (const type of ['cardio', 'strength']) {
  const btn = document.querySelector(`.session-type-btn[data-type="${type}"]`);
  if (btn) btn.click();
  document.querySelectorAll('.timer-btn').forEach(b => timerBtns.add(b));
  document.querySelectorAll('.chrono-btn').forEach(b => chronoBtns.add(b));
}
check(timerBtns.size >= 3, `${timerBtns.size} boutons timer rendus (attendu ≥ 3)`);
for (const b of timerBtns) {
  check(!!b.getAttribute('aria-label'),
    `timer-btn a aria-label ("${(b.getAttribute('aria-label') || '').slice(0, 50)}")`);
}
check(chronoBtns.size > 0, `${chronoBtns.size} boutons chrono rendus`);
for (const b of chronoBtns) {
  check(!!b.getAttribute('aria-label'),
    `chrono-btn a aria-label ("${(b.getAttribute('aria-label') || '').slice(0, 50)}")`);
}

// 3g. Classe .sr-only définie (captions visuellement cachées)
check(/\.sr-only\s*\{[^}]*clip:/s.test(css), 'CSS .sr-only présent (texte réservé aux lecteurs d’écran)');

// 3h. Live regions pour les confirmations (role=status / aria-live)
check(document.querySelectorAll('[role="status"], [aria-live]').length >= 2,
  'régions live (role=status / aria-live) présentes pour les confirmations');

// ============ 4. Service Worker : cache bumpé ============
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
check(/fittrack-v66/.test(sw), 'Service Worker : cache fittrack-v66 (bump history-table table-layout auto)');

summary('a11y-audit');
exit(true);
