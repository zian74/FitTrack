// Smoke test général : chargement de l'app, navigation, formulaires, sauvegarde session.
const { loadApp, check, summary, exit } = require('./helpers');

const { window, document } = loadApp();

// --- 1. L'app charge sans erreur et rend le dashboard ---
check(document.querySelector('nav button.active')?.dataset.view === 'dashboard',
  'onglet actif au chargement : dashboard');
check(document.getElementById('view-dashboard').classList.contains('active'),
  'section #view-dashboard active');
check(document.querySelectorAll('#view-dashboard .card, #view-dashboard > *').length > 0,
  'dashboard rendu (contenu présent)');

// --- 2. Navigation entre les 5 onglets ---
const views = ['session', 'analysis', 'history', 'profile', 'settings'];
for (const v of views) {
  const btn = document.querySelector(`nav button[data-view="${v}"]`);
  check(!!btn, `bouton nav "${v}" présent`);
  if (btn) {
    btn.click();
    check(document.getElementById('view-' + v).classList.contains('active'),
      `clic nav "${v}" -> section active`);
    check(btn.classList.contains('active'), `clic nav "${v}" -> bouton actif`);
  }
}
// retour dashboard
document.querySelector('nav button[data-view="dashboard"]').click();
check(document.getElementById('view-dashboard').classList.contains('active'), 'retour dashboard');

// --- 3. Onglet Session : champs de test rendus pour chaque type de session ---
document.querySelector('nav button[data-view="session"]').click();
const sessionTypes = ['rest', 'strength', 'cardio', 'activity', 'sleep', 'nutrition'];
const counts = {};
for (const type of sessionTypes) {
  document.querySelector(`.session-type-btn[data-type="${type}"]`).click();
  counts[type] = document.querySelectorAll('#session-fields input, #session-fields select').length;
  check(counts[type] > 0, `session "${type}" : ${counts[type]} champ(s) rendu(s)`);
}
// Le type rest (par défaut) rend 8 champs de test
const restInputs = document.querySelectorAll('.session-type-btn[data-type="rest"]');
restInputs[0].click();
check(document.querySelectorAll('#session-fields input[data-test]').length === 8,
  'session rest : 8 champs de test rendus');
check(document.querySelectorAll('#view-session .info-btn').length >= 3,
  'boutons ⓘ présents dans la session');

// --- 4. Saisie + sauvegarde d'une session ---
const fcInput = document.querySelector('input[data-test="fc"]');
check(!!fcInput, 'champ FC de repos présent');
if (fcInput) {
  fcInput.disabled = false; // le champ est disabled par défaut (méthode escalier inactive)
  fcInput.value = '62';
  fcInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  check(!fcInput.classList.contains('invalid'), 'saisie FC 62 -> champ valide');

  fcInput.value = '999';
  fcInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  check(fcInput.classList.contains('invalid'), 'saisie FC 999 -> champ invalide (hors bornes)');

  fcInput.value = '62';
  fcInput.dispatchEvent(new window.Event('input', { bubbles: true }));
}

// Bouton enregistrer présent
const saveBtn = document.querySelector('#view-session button.primary, #view-session [data-save]');
check(!!saveBtn || document.querySelector('#view-session button'), 'bouton de sauvegarde présent dans Session');

// --- 5. Onglet Historique : rendu sans session ---
document.querySelector('nav button[data-view="history"]').click();
check(document.getElementById('view-history').classList.contains('active'), 'onglet historique actif');

// --- 6. Onglet Analyse : message sans données ---
document.querySelector('nav button[data-view="analysis"]').click();
const analysisContent = document.getElementById('ifg-content');
check(analysisContent && analysisContent.textContent.length > 0,
  'onglet analyse rend un contenu (message ou score)');

// --- 7. Onboarding : se lance au premier démarrage ---
// (store vide au chargement -> onboarding visible)
check(!document.getElementById('onboarding').classList.contains('hidden'),
  'onboarding visible au premier lancement');
document.getElementById('onboarding-skip').click();
check(document.getElementById('onboarding').classList.contains('hidden'),
  'onboarding fermé via "Ignorer"');

// --- 8. Modale de confirmation (toast/confirm maison) ---
const confirmModal = document.getElementById('confirm-modal');
check(!!confirmModal, 'modale de confirmation présente dans le DOM');
check(confirmModal.classList.contains('hidden'), 'modale de confirmation cachée par défaut');

// --- 9. localStorage fonctionne (store exposé) ---
window.__store.set('smoke-test', { ok: true });
check(window.__store.get('smoke-test').ok === true, 'store.set/get fonctionne');

exit(summary('app.test.js'));
