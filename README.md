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
- [x] CI GitHub Actions (syntaxe + validation JSON)
Par design, l'app est **mono-profil** : une seule personne, données uniquement locales sur l'appareil.
- [ ] Intégration GPS pour le Cooper
