# HealthTest

Ensemble de tests simples pour évaluer ton état de santé globale.

## FitTrack — webapp de suivi (v0.1)

Webapp offline-first (HTML/CSS/JS vanilla, zéro dépendance) qui couvre le plan de test complet :

- **Tests au repos** (mensuel) : FC de repos, pression artérielle, tour de taille, poids/IMC, ratio taille/hauteur
- **Mobilité & équilibre** : unipodal yeux ouverts/fermés, sit-and-reach
- **Force** (trimestriel) : poigne, pompes, gainage planche, chaise 30 s
- **Cardio** (trimestriel) : test escalier (pouls de récupération), Cooper 12 min ou demi-Cooper 6 min (distance normalisée ×2)
- **Activité & sédentarité** (trimestriel) : questionnaire **IPAQ court** (7 questions, score MET-min/semaine calculé automatiquement : niveau d'activité + temps assis/jour)

### Fonctionnalités

- Statut automatique 🟢/🟠/🔴 selon repères âge/sexe
- Score global /100 basé sur les 5 mesures prédictives (poigne, tour de taille, FC repos, cardio sous-max, équilibre), historisé jour par jour et visible en haut des graphiques
- Alertes de tendance (dégradation/stagnation sur 2 sessions)
- **Onglet Analyse** : Indice FitTrack Global (/100) pondéré sur 5 dimensions,
  radar, priorités, évolution et corrélation activité ↔ forme
- Calendrier de re-test (mensuel / trimestriel)
- Chronomètre intégré (planche, équilibre)
- ⏳ Timer compte à rebours générique (panneau flottant, bip de fin) : chaise 30 s, escalier 3 min (durée réglable), Cooper 12/6 min
- 🫁 Test Cooper : estimations croisées **VMA / VO2max** affichées en direct (VMA = distance ÷ 200 ; VO2max = 3,5 × VMA ; VO2max = (distance − 504,9) ÷ 44,73 — formules ACSM / Léger & Mercier citées dans les sources)
- **Session Cardio flexible** : enregistrement possible avec **uniquement** la VMA, la VO2max ou la distance Cooper (au moins un des 3 champs suffit)
- **VMA / VO2max dans les repères du Profil** : lignes dédiées (n°17-18) avec seuils sexe (H/F) et valeur courante affichée (« estimé Cooper » ou saisie directe)
- **Dimension Endurance (IFG)** : priorité **VMA saisie > VO2max saisie > Cooper/demi-Cooper (VMA/VO2max dérivées) > test escalier** — un seul indicateur retenu par session
- Graphiques SVG par indicateur avec zones objectif
- Export CSV / JSON, données 100 % locales (localStorage)
- Avertissement médical avant test maximal si facteurs de risque déclarés
- Suivi du niveau d'activité (IPAQ court) avec repères OMS : ≥ 600 MET-min/sem, objectif ≥ 3000

### Lancer

```bash
python3 -m http.server 8080
# ouvrir http://localhost:8080
```

Aucun build, aucune dépendance. Fonctionne aussi en ouvrant `index.html` directement.

**PWA installable** : servie via HTTP(S), l'app peut être installée sur mobile/desktop (manifest + service worker, fonctionne hors ligne).

**Démo en ligne (GitHub Pages)** : à activer via *Settings → Pages → Deploy from a branch → `main` / racine*. L'URL sera `https://zian74.github.io/HealthTest/`. Tous les chemins (`./sw.js`, `./manifest.webmanifest`, icônes) sont relatifs, donc compatibles avec un sous-chemin.

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
- [x] 🏁 VMA / VO2max estimées (Cooper/demi-Cooper) : affichage croisé, persistance, repères Profil (n°17-18) + dimension Endurance IFG (priorité VMA > VO2max > Cooper > escalier)
- [x] 🧹 Suite de tests jsdom : 31 suites green (test-score-mention.js obsolète remplacé par test-score-global.js, test-analysis.js réparé)
- [x] 📱 Modales scrollables sur mobile : contenu défile dans la pop-up, bouton « Compris » toujours visible (max-height 100dvh + flex column + overflow-y auto)
- [x] ⚙️ Nouvel onglet **Paramètres** (dernier onglet, icône roue crantée) : regroupe le choix du **Thème** (Système/Clair/Sombre), les **Rappels de re-test** et les **Sources scientifiques** (déplacés depuis l'onglet Profil) ; libellés raccourcis sur mobile
- [x] ⏳ Test escalier : après les 3 min de montées, un **compte à rebours de 1 min se lance automatiquement** pour indiquer le délai avant la mesure du pouls (chaînage auto du timer générique, annulable via ✕ ou ↺)
- [x] 💾 Session Cardio : enregistrement avec VMA seule, VO2max seule ou distance Cooper (au moins un des 3 champs)
- [x] 🏃 Refonte UI du test de Cooper (6 changements) : suppression du bouton ⏳ timer, suppression des formules de calcul dans le bloc d'estimation (déjà dans les sources scientifiques), renommage « 6 min (demi-Cooper) » (sans ×2), champ distance placé après le choix 12/6 min, phrase « Au moins un des 3 champs… » déplacée après les champs VMA/VO2max, et la distance Cooper n'apparaît plus dans le bloc d'estimation quand VMA ou VO2max est saisie
- [x] 🐛 Correction : suppression d'une mesure via le stylo ✏️ rafraîchit désormais le tableau « Dernière session » (ainsi que l'historique et l'analyse si actifs) — la valeur supprimée n'apparaît plus
- [x] 🪜 Test escalier : **3 méthodes au choix** (sélecteur radio) — Méthode 1 = pouls à 1 min (3 min, existante) · Méthode 2 = **marches gravis en 60 s** (timer 60 s, seuils ≥80/60/40) · Méthode 3 = **4 étages chronométrés** (chrono ⏱, seuils ≤45/≤60/>90 s, inversé) ; seule la méthode active est saisie/enregistrée, l'analyse (score global + IFG endurance) utilise la méthode disponible avec priorité méthode 1 > 2 > 3
- [x] 🥁 Test escalier méthode 1 : **métronome 96 bpm** (bouton 🥁 dans le timer) — 1 bip par cycle (625 ms = 24 montées/min), démarre/pause/s'arrête avec le timer, activé par défaut et désactivable
Par design, l'app est **mono-profil** : une seule personne, données uniquement locales sur l'appareil.
