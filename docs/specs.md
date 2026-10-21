# Cahier des charges — FitTrack

## 1. Contexte et objectifs

Application de suivi de la condition physique fondée sur un plan de test de 16 mesures
objectives (repos, mobilité, force, cardio, activité/sédentarité). Logique première :
**comparaison à soi-même dans le temps** plutôt qu'aux normes.

- **Mono-profil par design** : l'app gère les données d'une seule personne, stockées
  exclusivement en local sur son appareil (localStorage). Aucun compte, aucun serveur,
  aucun partage — décision produit assumée, hors périmètre.

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
| 14 | Cooper (12 min) ou demi-Cooper (6 min, distance ×2) | cardio | trimestriel | H > 2400 / F > 2000 m (équiv. 12 min) |
| 15 | IPAQ court — score activité (MET-min/sem) | activité | trimestriel | ≥ 600 (OMS) / ≥ 3000 (élevé) |
| 16 | IPAQ court — temps assis (min/jour de semaine) | activité | trimestriel | ≤ 240 (4 h) / alerte > 480 (8 h) |

## 3. Exigences fonctionnelles

### Règles d'interprétation du delta (tableau « Dernière session »)

- Les tests à sens d'amélioration (`rev` : plus bas = mieux, ex. FC, PA, tour de taille)
  affichent un delta vert en cas d'amélioration, rouge en cas de dégradation.
- **Poids — règle basée sur l'IMC** : la couleur du delta de poids dépend de la
  trajectoire vers la zone IMC saine [18,5 ; 25] :
  - **vert** si la variation rapproche de la zone saine (ex. : perte de poids avec IMC > 25,
    prise de poids avec IMC < 18,5)
  - **rouge** si la variation éloigne de la zone saine (ex. : perte de poids avec IMC < 18,5,
    prise de poids avec IMC > 25)
  - **gris** si la variation reste dans la zone saine, si l'IMC ne change pas de distance,
    ou si la taille n'est pas renseignée dans le profil (pas d'interprétation possible).

- Profil : sexe, année de naissance, taille, facteurs de risque cardio
  (tabagisme, antécédents cardiaques — le niveau d'activité est évalué par le
  questionnaire IPAQ, pas de champ déclaratif dans le profil)
- Saisie des mesures par session datée (4 types : repos, force, cardio, activité)
- Questionnaire **IPAQ court** (7 questions sur les 7 derniers jours) : score calculé
  automatiquement en MET-min/semaine (8×intensif + 4×modéré + 3,3×marche), niveau
  faible/modéré/élevé selon seuils 600/3000, et temps assis quotidien (Q7)
- Statut automatique par mesure selon repères sexe/âge
- Score global /100 : moyenne des 5 tests prédictifs
- Historique du score global (1 valeur/jour) consultable dans les graphiques par indicateur
- Onglet **Analyse** : Indice FitTrack Global (IFG, /100) = moyenne pondérée de
  5 dimensions — cardio au repos & métabolisme (30 %), endurance (20 %),
  force (20 %), équilibre & mobilité (15 %), habitudes d'activité (15 %) ;
  historisé 1×/jour ; radar des dimensions, point fort/faible + conseil,
  courbe d'évolution, tendances 30 jours, nuage de points IPAQ ↔ IFG
- Alertes tendance : dégradation > 3–5 % ou stagnation sur 2 sessions
- Calendrier de re-test : badges « à jour / à refaire »
- Rappels de re-test : notification quotidienne à heure choisie (in-app via setTimeout + PeriodicSync SW pour app fermée, rattrapage au démarrage si l'heure est passée)
- Chronomètre intégré pour les tests chronométrés
- Historique, graphique par indicateur avec zones objectif/seuil
- Export CSV / JSON (le CSV embarque le profil en lignes « # profil ») ; import JSON/CSV avec fusion (profil, sessions par date+type, historiques) pour restaurer après plantage ; effacement complet des données
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

## 6. Backlog

- PWA installable (manifest, service worker) ✅
- Notifications de rappel des tests ✅ (checkbox + heure dans Profil ; setTimeout in-app + PeriodicSync SW app fermée ; rattrapage au démarrage ; clic → ouvre l'app)
- Intégration HealthKit / Google Fit
