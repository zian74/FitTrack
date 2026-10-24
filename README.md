# HealthTest

Ensemble de tests simples pour évaluer ton état de santé globale.

## FitTrack — webapp de suivi (v0.1)

Webapp offline-first (HTML/CSS/JS vanilla, zéro dépendance) qui couvre le plan de test complet :

- **Tests au repos** (mensuel) : FC de repos, pression artérielle, tour de taille, poids/IMC, ratio taille/hauteur
- **Mobilité & équilibre** : unipodal yeux ouverts/fermés, sit-and-reach
- **Force** (trimestriel) : préhension, pompes, gainage planche, chaise 30 s
- **Cardio** (trimestriel) : test escalier (pouls de récupération), Cooper 12 min ou demi-Cooper 6 min (distance normalisée ×2)
- **Activité & sédentarité** (trimestriel) : questionnaire **IPAQ court** (7 questions, score MET-min/semaine calculé automatiquement : niveau d'activité + temps assis/jour)
- **Sommeil & récupération** (hebdomadaire) : questionnaire **5 questions** sur les 7 derniers jours (durée, qualité, latence, réveils, sensation au réveil), **score de sommeil /100** calculé automatiquement
- **Alimentation** (hebdomadaire) : questionnaire **7 questions** sur les 7 derniers jours (fruits & légumes ⓘ, boissons sucrées, ultra-transformés, petit-déjeuner, repas maison, hydratation, alcool), **score alimentaire /100** calculé automatiquement

### Fonctionnalités

- Statut automatique 🟢/🟠/🔴 selon repères âge/sexe
- Score global /100 basé sur les 5 mesures prédictives (préhension, tour de taille, FC repos, cardio sous-max, équilibre), historisé jour par jour et visible en haut des graphiques
- Alertes de tendance (dégradation/stagnation sur 2 sessions)
- **Onglet Analyse** : Indice FitTrack Global (/100) pondéré sur 7 dimensions — **calculé uniquement lorsque les 7 dimensions sont connues** (sinon « Complétez les tests », liste « à faire ») — inclut **Sommeil & récupération** 🌙, 10 %, et **Alimentation** 🍽, 5 %),
  radar, priorités, évolution, corrélation activité ↔ forme et
  nuages Sommeil ↔ IFG et Alimentation ↔ IFG avec coefficient de Pearson (r, libellé qualitatif)
- Calendrier de re-test (mensuel / trimestriel)
- Chronomètre intégré (planche, équilibre)
- ⏳ Timer compte à rebours générique (panneau flottant, bip de fin) : chaise 30 s, escalier 3 min (durée réglable), Cooper 12/6 min
- 🫁 Test Cooper : estimations croisées **VMA / VO2max** affichées en direct (VMA = distance ÷ 200 ; VO2max = 3,5 × VMA ; VO2max = (distance − 504,9) ÷ 44,73 — formules ACSM / Léger & Mercier citées dans les sources)
- **Session Cardio flexible** : enregistrement possible avec **uniquement** la VMA, la VO2max ou la distance Cooper (au moins un des 3 champs suffit)
- **VMA / VO2max dans les repères du Profil** : lignes dédiées (n°17-18) avec seuils sexe (H/F) et valeur courante affichée (« estimé Cooper » ou saisie directe)
- **Dimension Endurance (IFG)** : le Cooper ne sert qu'à produire la VMA/VO2max estimée — on retient la **dernière VMA/VO2max estimée ou renseignée** (par date, VMA préférée à VO2max à date égale), à défaut le test escalier (méthode 1 > 2 > 3) — un seul indicateur retenu
- Graphiques SVG par indicateur avec zones objectif
- Export CSV / JSON, données 100 % locales (localStorage)
- ⌚ **Import montre connectée** : CSV Garmin Connect / générique, TCX, GPX — FC de repos, durée de sommeil, pas, activité (IPAQ estimé), 100 % local (drag & drop ou sélection fichier)
- Avertissement médical avant test maximal si facteurs de risque déclarés
- Suivi du niveau d'activité (IPAQ court) avec repères OMS : ≥ 600 MET-min/sem, objectif ≥ 3000

### Lancer

```bash
python3 -m http.server 8080
# ouvrir http://localhost:8080
```

Aucun build, aucune dépendance runtime. Fonctionne aussi en ouvrant `index.html` directement.

### Tests

Smoke tests [jsdom](https://github.com/jsdom/jsdom) (chargement de l'app, navigation, formulaires, modale info 100 % DOM) — exécutés en CI à chaque push/PR :

```bash
npm ci     # installe jsdom (devDependency)
npm test   # lance tests/smoke/run.js (tous les *.test.js)
```

**PWA installable** : servie via HTTP(S), l'app peut être installée sur mobile/desktop (manifest + service worker, fonctionne hors ligne).

**Démo en ligne (GitHub Pages)** : à activer via *Settings → Pages → Deploy from a branch → `main` / racine*. L'URL sera `https://zian74.github.io/HealthTest/`. Tous les chemins (`./sw.js`, `./manifest.webmanifest`, icônes) sont relatifs, donc compatibles avec un sous-chemin.

### Documentation

- [Méthodes de calcul & références scientifiques](docs/methodes-de-calcul.md) : toutes les formules de tous les indicateurs, scores (IPAQ, sommeil, alimentation, score global, Indice FitTrack Global, IMC), alertes et import montre, avec les références publiées (Craig 2003, OMS 2020, Cooper 1968, Léger & Mercier 1983, ACSM, ESC/ESH, ESC 2021/SCORE2, Rikli & Jones 1999, Kodama 2009, PSQI Buysse 1989, NSF, Cappuccio 2011, NOVA Monteiro 2019, Sofi 2010, Widmer 2015, Malik…)
- [Spécifications fonctionnelles](docs/specs.md)
- [Points d'évaluation](docs/evaluation-points.md)

## Roadmap

- [x] Onboarding guidé
- [x] PWA installable (manifest + service worker)
- [x] Export PDF de la fiche de score
- [x] Export CSV/JSON avec le profil · import JSON/CSV (restauration, fusion)
- [x] Rappels de re-test 🔔 (notification quotidienne à heure choisie, fonctionne app fermée via PeriodicSync)
- [x] ⓘ Sources scientifiques accessibles en bas de l'onglet Profil (références IPAQ, OMS, Cooper, Rikli & Jones, Kodama…)
- [x] Facteurs de risque cardio complets dans le Profil (tabagisme, antécédents personnels/familiaux, HTA, diabète, dyslipidémie, alcool, stress) + IMC calculé depuis la dernière mesure de poids + récapitulatif du niveau de risque + avertissement renforcé avant test maximal
- [x] 🌙 Mode sombre (sélecteur Système / Clair / Sombre dans le Profil, persistant, respecte `prefers-color-scheme`, thème des graphiques SVG et `theme-color` mobile adaptés)
- [x] CI GitHub Actions (syntaxe + validation JSON)
- [x] ⏳ Timers compte à rebours : chaise 30 s, escalier 3 min (réglable), Cooper 12/6 min (radios)
- [x] 🏁 VMA / VO2max estimées (Cooper/demi-Cooper) : affichage croisé, persistance, repères Profil (n°17-18) + dimension Endurance IFG (dernière VMA/VO2max estimée ou renseignée, sinon escalier)
- [x] CI GitHub Actions : syntaxe JS (`node --check`) + validation JSON (package.json, manifest) à chaque push/PR
- [x] 🔔 Notifications in-app : toasts non bloquants (succès/erreur/info, `aria-live`) + modale de confirmation maison (`alertdialog`) — remplacent les `alert()`/`confirm()` natifs ; Échap ferme la modale ; le toast se décale au-dessus du chrono/timer
- [x] 📱 Modales scrollables sur mobile : contenu défile dans la pop-up, bouton « Compris » toujours visible (max-height 100dvh + flex column + overflow-y auto)
- [x] ⚙️ Nouvel onglet **Paramètres** (dernier onglet, icône roue crantée) : regroupe le choix du **Thème** (Système/Clair/Sombre), les **Rappels de re-test** et les **Sources scientifiques** (déplacés depuis l'onglet Profil) ; libellés raccourcis sur mobile
- [x] ⏳ Test escalier : après les 3 min de montées, un **compte à rebours de 1 min se lance automatiquement** pour indiquer le délai avant la mesure du pouls (chaînage auto du timer générique, annulable via ✕ ou ↺)
- [x] 💾 Session Cardio : enregistrement avec VMA seule, VO2max seule ou distance Cooper (au moins un des 3 champs)
- [x] 🏃 Refonte UI du test de Cooper (6 changements) : suppression du bouton ⏳ timer, suppression des formules de calcul dans le bloc d'estimation (déjà dans les sources scientifiques), renommage « 6 min (demi-Cooper) » (sans ×2), champ distance placé après le choix 12/6 min, phrase « Au moins un des 3 champs… » déplacée après les champs VMA/VO2max, et la distance Cooper n'apparaît plus dans le bloc d'estimation quand VMA ou VO2max est saisie
- [x] 🐛 Correction : suppression d'une mesure via le stylo ✏️ rafraîchit désormais le tableau « Dernière session » (ainsi que l'historique et l'analyse si actifs) — la valeur supprimée n'apparaît plus
- [x] 🪜 Test escalier : **3 méthodes au choix** (sélecteur radio) — Méthode 1 = pouls à 1 min (3 min, existante) · Méthode 2 = **marches gravis en 60 s** (timer 60 s, seuils ≥80/60/40) · Méthode 3 = **4 étages chronométrés** (chrono ⏱, seuils ≤45/≤60/>90 s, inversé) ; seule la méthode active est saisie/enregistrée, l'analyse (score global + IFG endurance) utilise la méthode disponible avec priorité méthode 1 > 2 > 3
- [x] 🥁 Test escalier méthode 1 : **métronome 96 bpm** (bouton 🥁 dans le timer) — 1 bip toutes les 625 ms, soit **4 bips = 1 aller-retour** (montée + descente en 2,5 s = 24 montées/min), démarre/pause/s'arrête avec le timer, activé par défaut et désactivable
- [x] 📱 PWA **plein écran mobile** (simulation app native) : `display: fullscreen` + `display_override` dans le manifest, `viewport-fit=cover`, meta `mobile-web-app-capable` / `apple-mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style: black-translucent`, et `env(safe-area-inset-*)` sur le header/main/chrono/timer (encoche iPhone + barre d'accueil)
- [x] ⓘ Pop-up d'info pour le **test 9 Préhension** (dynamométrie) : échauffement, position debout coude à 90°, réglage sur la 2ᵉ phalange, serrage max 2–3 s, 2–3 essais/main avec 30 s de repos, meilleure valeur retenue, respiration (éviter Valsalva), arrêt en cas de douleur
- [x] ✏️ Test 9 renommé « **Préhension** — meilleure main (kg) » (alias « Poigne » conservé pour l'import des anciens exports CSV)
- [x] 🌙 **Sommeil & récupération** : questionnaire 5 questions (durée, qualité, latence, réveils, sensation au réveil), score /100, nouvelle dimension IFG (10 %), bilan hebdomadaire
- [x] ⌚ **Import montre connectée** : parseur CSV Garmin Connect/générique + TCX + GPX, mapping FC repos / sommeil / IPAQ, drag & drop, 100 % local
- [x] 📊 **Corrélation Sommeil ↔ IFG** : nuage de points (score sommeil/100 ↔ IFG recalculé à chaque date de sommeil, repères 80/60) + coefficient de Pearson r avec libellé (forte/modérée/faible/négligeable), ⓘ explicatif
- [x] 🍽 **Alimentation** : questionnaire 7 questions scorées (N7 alcool inclus, repère OMS ≤ 10 verres/sem), score /100, nouvelle dimension IFG (5 %, cardio au repos ramené à 20 %), bilan hebdomadaire, corrélation Alimentation ↔ IFG (nuage + Pearson), habitudes alimentaires déclaratives dans le Profil
- [x] ⌚ **Badge provenance dans l'historique** : les mesures importées d'une montre connectée portent un badge « ⌚ montre » (avec le sport si connu, ex. Running pour un TCX) dans la colonne Type
- [x] ♿ **Accessibilité** : revue UX des formulaires (labels explicites, focus visible renforcé, messages d'erreur textuels + `aria-invalid`/`aria-describedby`) · audit complet WCAG — contraste corrigé (thèmes clair & sombre ≥ 4,5:1), skip link, focus trap + restauration du focus dans les modales, `role="img"` + `aria-label` sur les 6 graphiques SVG, `<caption>` + `scope="col"/"row"` sur tous les tableaux, `aria-label` sur tous les boutons icône seule (timers, chrono, édition, métronome), régions nommées pour le chrono/timer, `.sr-only` pour les captions · smoke test `a11y-audit` (105 checks) en CI

### Pistes gardées pour plus tard

Toutes les pistes ci-dessous sont réalisées (PR #85 et #86) :

- [x] Migrer les 2 contenus statiques de la modale info (`#info-modal-body`) vers du DOM — dernier morceau 100 % DOM (PR #85)
- [x] Revue UX des formulaires (labels, focus visible, messages d'erreur) (PR #86)
- [x] Tests automatisés dans le repo — smoke tests jsdom intégrés, exécutés en CI à chaque push/PR (PR #85)
- [x] Audit accessibilité complet (contraste, navigation clavier, lecteur d'écran) (PR #86)

Par design, l'app est **mono-profil** : une seule personne, données uniquement locales sur l'appareil.
