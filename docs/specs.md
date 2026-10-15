# Cahier des charges — FitTrack

## 1. Contexte et objectifs

Application de suivi de la condition physique fondée sur un plan de test de 14 mesures
objectives (repos, mobilité, force, cardio). Logique première : **comparaison à soi-même
dans le temps** plutôt qu'aux normes.

- v1 : usage individuel (1 profil), données locales
- v2 : multi-profils (famille, coach), synchro optionnelle

## 2. Tests couverts

| # | Test | Groupe | Fréquence | Repères (H/F) |
|---|------|--------|-----------|---------------|
| 1 | FC de repos | repos | mensuel | 50–70 bpm |
| 2 | PA systolique | repos | mensuel | < 130 mmHg |
| 3 | PA diastolique | repos | mensuel | < 85 mmHg |
| 4 | Tour de taille | repos | mensuel | H < 94 / F < 80 cm |
| 5 | Poids / IMC | repos | mensuel | IMC 18,5–25 |
| 6 | Équilibre unipodal (yeux ouverts) | repos | mensuel | > 40 s |
| 7 | Équilibre yeux fermés | repos | mensuel | > 10 s |
| 8 | Sit-and-reach | repos | mensuel | toucher les pieds |
| 9 | Poigne (dynamomètre) | force | trimestriel | H 45–55 / F 30–35 kg |
| 10 | Pompes maximales | force | trimestriel | H > 35 / F > 20 |
| 11 | Gainage planche | force | trimestriel | 2 min |
| 12 | Chaise 30 s | force | trimestriel | H 12–17 / F 11–16 |
| 13 | Test escalier (pouls 1 min) | cardio | trimestriel | < 90–100 |
| 14 | Cooper (12 min) | cardio | trimestriel | H > 2400 / F > 2000 m |

## 3. Exigences fonctionnelles

- Profil : sexe, année de naissance, taille, activité, facteurs de risque cardio
- Saisie des mesures par session datée (3 types : repos, force, cardio)
- Statut automatique par mesure selon repères sexe/âge
- Score global /100 : moyenne des 5 tests prédictifs
- Alertes tendance : dégradation > 3–5 % ou stagnation sur 2 sessions
- Calendrier de re-test : badges « à jour / à refaire »
- Chronomètre intégré pour les tests chronométrés
- Historique, graphique par indicateur avec zones objectif/seuil
- Export CSV / JSON ; effacement complet des données
- Avertissement médical avant test maximal si facteurs de risque

## 4. Exigences non fonctionnelles

- Offline-first, aucune dépendance, aucun backend en v1
- Données locales uniquement (localStorage), export pour réversibilité
- Accessibilité : gros chiffres, contraste élevé (public senior possible)
- Responsive mobile/desktop
- i18n : FR en v1, architecture compatible multilingue

## 5. Jalons

- M1 — Fondations : profil + saisie 14 tests + stockage local ✅
- M2 — Interprétation : scores, statuts, alertes tendance ✅
- M3 — Visualisation : graphes, dashboard, calendrier re-test ✅
- M4 — Export & polish : CSV/JSON ✅, PDF à faire, onboarding à faire

## 6. Backlog v2

- Multi-profils / mode coach
- PWA installable (manifest, service worker)
- GPS pour le Cooper
- Notifications de rappel
- Intégration HealthKit / Google Fit
