// Smoke test : modale info 100 % DOM — 24 contenus info, ouverture/fermeture, structure DOM.
const { loadApp, check, summary, exit } = require('./helpers');

const { window, document, js } = loadApp();

// --- 1. Les 24 fonctions info() produisent des nœuds DOM valides ---
const probe = [];
for (const t of window.__TESTS) if (t.info) probe.push({ key: t.id, name: t.name, fn: t.info });
for (const [k, s] of Object.entries(window.__STATIC_INFOS)) probe.push({ key: k, name: s.name, fn: s.info });

check(probe.length === 24, `24 contenus info exposés (trouvé: ${probe.length})`);
for (const p of probe) {
  const node = p.fn();
  const isNode = node && node.nodeType === 1;
  const hasText = isNode && node.textContent.trim().length > 20;
  check(isNode && hasText, `info "${p.key}" -> nœud DOM avec texte (${isNode ? node.tagName : typeof node})`);
}

// --- 2. Structure DOM : vérifications ciblées ---
const byKey = {};
for (const p of probe) byKey[p.key] = p.fn();

check(byKey['balance_open'].querySelector('li b')?.textContent === '2 essais par pied',
  'balance_open : <b>2 essais par pied</b> rendu en nœud <b>');
check(byKey['__sources__'].querySelectorAll('li').length >= 15,
  `__sources__ : liste longue rendue (${byKey['__sources__'].querySelectorAll('li').length} <li>)`);
check(byKey['__sleep__'].querySelector('span[style*="color"]')?.textContent.includes('80 = bon sommeil'),
  '__sleep__ : <span style="color:...">80 = bon sommeil</span> conservé');
check(byKey['__nutrition__'].querySelectorAll('ul li ul li').length === 2
  && Array.from(byKey['__nutrition__'].querySelectorAll('ul li ul li')).some(li => li.textContent.includes('r proche de +1')),
  '__nutrition__ : sous-liste <ul> imbriquée rendue');
check(byKey['stair_4floors'].querySelector('i')?.textContent.includes('Plus le temps est court'),
  'stair_4floors : <i> conservé');
const plankImg = byKey['plank'].querySelector('img.info-illustration');
check(!!plankImg && (plankImg.getAttribute('alt') || '').length > 20
  && (plankImg.getAttribute('src') || '') === './assets/plank-exercise.gif',
  'plank : illustration <img class="info-illustration"> avec alt descriptif + src assets/');
const pushupsImg = byKey['pushups'].querySelector('img.info-illustration');
check(!!pushupsImg && (pushupsImg.getAttribute('alt') || '').length > 20
  && (pushupsImg.getAttribute('src') || '') === './assets/knee-push-up.gif',
  'pushups : illustration <img class="info-illustration"> avec alt descriptif + src assets/');
const stairImg = byKey['stair_pulse'].querySelector('img.info-illustration');
check(!!stairImg && (stairImg.getAttribute('alt') || '').length > 20
  && (stairImg.getAttribute('src') || '') === './assets/stair-step-up.gif',
  'stair_pulse : illustration <img class="info-illustration"> avec alt descriptif + src assets/');
const chairImg = byKey['chair'].querySelector('img.info-illustration');
check(!!chairImg && (chairImg.getAttribute('alt') || '').length > 20
  && (chairImg.getAttribute('src') || '') === './assets/squat-bodyweight.gif',
  'chair (squat) : illustration <img class="info-illustration"> avec alt descriptif + src assets/');
const gripImg = byKey['grip'].querySelector('img.info-illustration');
check(!!gripImg && (gripImg.getAttribute('alt') || '').length > 20
  && (gripImg.getAttribute('src') || '') === './assets/grip-strength.gif',
  'grip (préhension) : illustration <img class="info-illustration"> avec alt descriptif + src assets/');

// --- 3. Ouverture/fermeture de la modale via les boutons présents ---
const body = document.getElementById('info-modal-body');
const title = document.getElementById('info-modal-title');
const modal = document.getElementById('info-modal');
const btns = Array.from(document.querySelectorAll('.info-btn'));
check(btns.length === 10, `${btns.length} boutons .info-btn rendus (7 statiques + 3 tests)`);

for (const btn of btns) {
  const key = btn.dataset.infoTest;
  btn.click();
  const open = !modal.classList.contains('hidden');
  const hasContent = body.childNodes.length > 0;
  const hasTitle = title.textContent.trim().length > 0;
  const isDom = body.firstElementChild && body.firstElementChild.nodeType === 1;
  document.getElementById('info-modal-close').click();
  const closed = modal.classList.contains('hidden');
  check(open && hasContent && hasTitle && closed && isDom, `modale "${key}" : DOM + ouverture + fermeture`);
}

// --- 4. Échap ferme la modale ---
btns[0].click();
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape' }));
check(modal.classList.contains('hidden'), 'Échap ferme la modale info');

// --- 5. Plus aucun innerHTML applicatif (hors SVG + helper h) ---
const innerHtmlLines = js.split('\n').filter(l => l.includes('.innerHTML') && !l.trim().startsWith('//') && !l.includes('el.innerHTML') && !l.includes('- html'));
check(innerHtmlLines.length === 1 && innerHtmlLines[0].includes('ifg-radar'),
  `innerHTML restant : uniquement le SVG radar (trouvé: ${innerHtmlLines.length})`);

exit(summary('info-modal.test.js'));
