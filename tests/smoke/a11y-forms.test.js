// Smoke test a11y formulaires : labels, focus visible (CSS), messages d'erreur ARIA.
const fs = require('fs');
const path = require('path');
const { loadApp, check, summary, exit, ROOT } = require('./helpers');

const { window, document } = loadApp();
const css = fs.readFileSync(path.join(ROOT, 'style.css'), 'utf8');

// --- 1. Labels : tous les champs visibles ont un nom accessible ---
function accessibleName(el) {
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  if (el.getAttribute('aria-labelledby')) {
    return el.getAttribute('aria-labelledby').split(' ')
      .map(id => document.getElementById(id)?.textContent).join(' ');
  }
  const label = el.closest('label');
  if (label) return label.textContent.trim();
  // label[for]
  if (el.id) {
    const forLabel = document.querySelector(`label[for="${el.id}"]`);
    if (forLabel) return forLabel.textContent.trim();
  }
  return null;
}

const visibleFields = Array.from(document.querySelectorAll('input, select, textarea'))
  .filter(el => !el.closest('.hidden') && el.type !== 'hidden' && !el.disabled);

check(visibleFields.length > 10, `${visibleFields.length} champs visibles à tester`);

for (const el of visibleFields) {
  const name = accessibleName(el);
  check(!!name && name.length > 0,
    `champ #${el.id || el.name || el.dataset.test || '?'} a un nom accessible${name ? ` ("${name.slice(0, 40)}")` : ' — MANQUANT'}`);
}

// --- 2. Focus visible : règles CSS présentes ---
check(/:focus-visible/.test(css) && /outline:\s*2px solid var\(--accent\)/.test(css),
  'CSS :focus-visible avec outline 2px accent présent');
check(/input:focus, select:focus/.test(css) && /box-shadow/.test(css),
  'CSS :focus avec halo (box-shadow) présent');
check(/input\.invalid:focus/.test(css) && /var\(--bad\)/.test(css),
  'CSS : champ invalide a un focus renforcé (rouge)');
check(!/outline:\s*none|outline:\s*0/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')),
  'aucun outline:none/0 qui supprimerait le focus');

// --- 3. Classe .field-error définie ---
check(/\.field-error\s*\{/.test(css) && /color:\s*var\(--bad\)/.test(css),
  'CSS .field-error : message d\'erreur textuel en rouge');

// --- 4. Champs de session : aria-invalid initial ---
document.querySelector('nav button[data-view="session"]').click();
const sessionInputs = document.querySelectorAll('#session-fields input[data-test]');
check(sessionInputs.length > 0, `${sessionInputs.length} champs de session rendus`);
for (const inp of sessionInputs) {
  check(inp.getAttribute('aria-invalid') === 'false',
    `champ session #${inp.dataset.test} a aria-invalid="false" initial`);
}

// --- 5. Saisie invalide -> aria-invalid=true + message d'erreur textuel ---
const fcInput = document.querySelector('input[data-test="fc"]');
fcInput.disabled = false;
fcInput.value = '999'; // hors bornes (max 120)
fcInput.dispatchEvent(new window.Event('input', { bubbles: true }));
check(fcInput.getAttribute('aria-invalid') === 'true', 'saisie invalide -> aria-invalid="true"');
check(fcInput.classList.contains('invalid'), 'saisie invalide -> classe .invalid');
const errEl = fcInput.closest('.field-row').querySelector('.field-error');
check(!!errEl && errEl.textContent.length > 0, `message d'erreur textuel présent ("${errEl?.textContent?.slice(0, 60)}")`);
check(errEl && errEl.getAttribute('role') === 'alert', 'message d\'erreur a role="alert"');
check(fcInput.getAttribute('aria-describedby')?.includes(errEl?.id), 'aria-describedby pointe vers le message d\'erreur');

// --- 6. Saisie valide -> aria-invalid=false + message effacé ---
fcInput.value = '62';
fcInput.dispatchEvent(new window.Event('input', { bubbles: true }));
check(fcInput.getAttribute('aria-invalid') === 'false', 'saisie valide -> aria-invalid="false"');
check(!fcInput.classList.contains('invalid'), 'saisie valide -> classe .invalid retirée');
check(errEl && errEl.textContent === '', 'saisie valide -> message d\'erreur effacé');

// --- 7. Champs IPAQ : aria-invalid + message d'erreur ---
document.querySelector('.session-type-btn[data-type="activity"]').click();
const ipaqInput = document.querySelector('#session-fields input[data-ipaq="vig_days"]');
check(!!ipaqInput, 'champ IPAQ Q1 présent');
if (ipaqInput) {
  check(ipaqInput.getAttribute('aria-invalid') === 'false', 'IPAQ Q1 aria-invalid="false" initial');
  ipaqInput.value = '99'; // max 7
  ipaqInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  check(ipaqInput.getAttribute('aria-invalid') === 'true', 'IPAQ Q1 invalide -> aria-invalid="true"');
  const err = ipaqInput.closest('.field-row').querySelector('.field-error');
  check(!!err && err.textContent.includes('hors bornes'), 'IPAQ Q1 : message d\'erreur affiché');
}

// --- 8. Champs Cooper VMA/VO2 : aria-invalid ---
document.querySelector('.session-type-btn[data-type="cardio"]').click();
const vmaInput = document.querySelector('#cooper-vma');
check(!!vmaInput, 'champ Cooper VMA présent');
if (vmaInput) {
  check(vmaInput.getAttribute('aria-invalid') === 'false', 'Cooper VMA aria-invalid="false" initial');
  vmaInput.value = '99'; // max 30
  vmaInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  check(vmaInput.getAttribute('aria-invalid') === 'true', 'Cooper VMA invalide -> aria-invalid="true"');
  check(vmaInput.classList.contains('invalid'), 'Cooper VMA invalide -> classe .invalid');
}

exit(summary('a11y-forms.test.js'));
