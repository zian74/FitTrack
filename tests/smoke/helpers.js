// Helpers communs aux smoke tests jsdom : charge l'app dans un DOM factice.
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');

function loadApp() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');

  const dom = new JSDOM(html, { runScripts: 'outside-only', pretendToBeVisual: true, url: 'https://localhost/' });
  const { window } = dom;
  const { document } = window;

  // localStorage en mémoire
  const mem = {};
  window.localStorage.getItem = k => (k in mem ? mem[k] : null);
  window.localStorage.setItem = (k, v) => { mem[k] = String(v); };
  window.localStorage.removeItem = k => { delete mem[k]; };
  window.localStorage.clear = () => { for (const k of Object.keys(mem)) delete mem[k]; };

  // API navigateur absentes de jsdom
  window.Notification = { permission: 'default', requestPermission: () => Promise.resolve('granted') };
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }));

  // Expose les const du scope script (jsdom : const/let ne fuient pas sur window)
  window.eval(js + '\n;window.__TESTS = TESTS; window.__STATIC_INFOS = STATIC_INFOS; window.__byId = byId; window.__store = store;');

  return { window, document, dom, js, html };
}

// Mini framework de test
let failures = 0;
let passes = 0;
function check(cond, msg) {
  if (cond) { passes++; console.log('  ok  -', msg); }
  else { failures++; console.error('  FAIL-', msg); }
}
function summary(name) {
  console.log(failures === 0 ? `\n${name} PASSED (${passes} checks)` : `\n${name} FAILED (${failures} échec(s) / ${passes} ok)`);
  return failures === 0;
}
function exit(ok) { process.exit(ok ? 0 : 1); }

module.exports = { loadApp, check, summary, exit, ROOT };
