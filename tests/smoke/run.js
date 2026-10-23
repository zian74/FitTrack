// Lance tous les smoke tests du dossier tests/smoke/*.test.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dir = __dirname;
const files = fs.readdirSync(dir)
  .filter(f => f.endsWith('.test.js'))
  .sort();

if (!files.length) {
  console.error('Aucun test trouvé dans', dir);
  process.exit(1);
}

console.log(`Smoke tests FitTrack — ${files.length} fichier(s)\n`);
let failed = 0;
for (const f of files) {
  console.log(`=== ${f} ===`);
  try {
    execFileSync(process.execPath, [path.join(dir, f)], { stdio: 'inherit' });
  } catch {
    failed++;
  }
  console.log('');
}

if (failed) {
  console.error(`${failed}/${files.length} fichier(s) en échec`);
  process.exit(1);
}
console.log(`Tous les smoke tests passent (${files.length}/${files.length})`);
