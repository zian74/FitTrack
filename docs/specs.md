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
  courbe d'évolution, tendances 30 jours, nuage de points IPAQ ↔ IFG ;
  **période de calcul au choix** (dernière session / 1 sem / 1 mois / 1 an / toutes
  les valeurs) s'applique à l'IFG, aux dimensions et aux points forts/priorités
- Alertes tendance : dégradation > 3–5 % ou stagnation sur 2 sessions
- Calendrier de re-test : badges « à jour / à refaire »
- Rappels de re-test : notification quotidienne à heure choisie (in-app via setTimeout + PeriodicSync SW pour app fermée, rattrapage au démarrage si l'heure est passée)
- Onglet **Profil** : lien ⓘ « Sources scientifiques » en bas de page listant les références utilisées (IPAQ court — Craig 2003 ; OMS 2020 ; Cooper 1968 ; seuils OMS/IDF tour de taille ; ESC/ESH pression artérielle ; Rikli & Jones Senior Fitness Test 1999 ; Kodama 2009 / Lee méta-analyses mortalité ; seuils sédentarité IPAQ/OMS), avec mention « repères indicatifs, pas d'avis médical »
- Onglet **Profil** : facteurs de risque cardiovasculaire — tabagisme, antécédents cardiaques personnels, antécédents familiaux précoces (1ᵉʳ degré < 55/65 ans), hypertension connue, diabète connu, dyslipidémie/statine, alcool (verres/semaine), stress chronique/dépression ; ⓘ explicatif (cadre ESC 2021 / SCORE2)
- **IMC** affiché dans le Profil (taille du profil + dernière mesure de poids des sessions) avec badge OMS (maigreur/surpoids/obésité) ; IMC ≥ 30 = facteur de risque majeur
- **Récapitulatif des facteurs de risque** dans le Profil : liste, badges « majeur », niveau global (faible/modéré/élevé selon le nombre de facteurs majeurs)
- **Avertissement avant test maximal (Cooper)** déclenché par tout facteur majeur (déclaré ou IMC ≥ 30), avec conseil de privilégier le test de l'escalier (sous-maximal) ; les facteurs non majeurs (antécédents familiaux, alcool < 14, surpoids, IMC 25–29,9) n'affichent pas l'avertissement
- Chronomètre intégré pour les tests chronométrés
- ⏳ **Timer compte à rebours générique** (panneau flottant : démarrage/pause, reset ↺, fermeture ✕, arrêt auto à 00:00 avec bip sonore + état « finished » vert, compatible mode sombre, décale au-dessus du chrono si les deux sont ouverts) :
  - test 12 « Chaise 30 s » : 30 s fixe (compter les répétitions)
  - test 13 « Escalier » : **3 min par défaut, durée réglable** en minutes (montées à 24/min)
  - test 14 « Cooper » : 12 min, ou 6 min en demi-Cooper (choix par **boutons radio** pilules, synchronisé avec le timer ⏳ et les estimations VMA/VO2max)
- ⓘ instructions du test chaise (position mur, bras croisés, cuisses parallèles au sol)
- **Test 14 Cooper — estimations VMA / VO2max** : 3 champs optionnels (distance m, VMA km/h, VO2max ml/kg/min) avec calculs croisés affichés en direct sous le bloc : VMA = distance ÷ 200 (Cooper 1968) ; VO2max = 3,5 × VMA (Léger & Mercier 1983) ; VO2max = (distance − 504,9) ÷ 44,73 (ACSM) ; VMA = VO2max ÷ 3,5. En demi-Cooper (6 min), la distance saisie est **automatiquement ×2** (équiv. 12 min) avant calcul et affichage (« 1200 m → équiv. 12 min : 2400 m (×2 automatique) »), et le stockage applique le même ×2. Formules citées dans la pop-up « Sources scientifiques »
- **Modales accessibles sur mobile** : `.modal` en `flex-direction: column` avec `max-height: calc(100dvh - 32px)` (viewport dynamique, tient compte de la barre d'adresse) ; le corps (`.info-body`) a `overflow-y: auto` + `-webkit-overflow-scrolling: touch` → **le contenu défile dans la pop-up, le titre et les boutons (« Compris », « Enregistrer ») restent toujours visibles**. `.modal-overlay` a aussi `overflow-y: auto` (filet de sécurité). S'applique à la modale ⓘ infos, à l'onboarding et à la modale d'édition
- **Tests** : 32 suites jsdom couvrant l'ensemble de l'app (sessions, IFG, analyse, timers, Cooper/VMA/VO2max, mode sombre, facteurs de risque, onboarding, import/export, etc.). `test-score-mention.js` (obsolète, testait une mention supprimée puis réintroduite) remplacé par `test-score-global.js` (vérifie la mention « prédictives » actuelle + barre de niveau). `test-analysis.js` réparé : données Cooper 3000 m (VMA 15 ≥ 14 → IFG 100), assertions mises à jour (pondération dans le texte explicatif, colonne « Score moyen (30 j) »), stub `URL.createObjectURL` pour l'export JSON
- **Session Cardio flexible** : le bouton « Enregistrer la session » s'active dès qu'**au moins un** des 3 champs Cooper est rempli et valide (distance m, VMA km/h, VO2max ml/kg/min). La VMA seule ou la VO2max seule suffit — la distance Cooper n'est plus obligatoire. Les valeurs VMA/VO2max saisies sont persistées dans la session (`values.vma` / `values.vo2max`) même sans distance. Contrôle des bornes actif (VMA 4–30 km/h, VO2max 10–90 ml/kg/min) : hors bornes → bouton désactivé + tooltip
- **VMA / VO2max dans les Repères applicables (Profil)** : 2 lignes dédiées (n°17 VMA, n°18 VO2max) avec seuils sexe (H : VMA ≥ 14/12 km/h, VO2max ≥ 45/35 ml/kg/min ; F : VMA ≥ 12/10, VO2max ≥ 38/30) et valeur courante affichée (« vous : 12,0 km/h · estimé Cooper » ou saisie directe, ou « aucune mesure Cooper »)
- **Dimension Endurance (IFG) — priorité VMA > VO2max > Cooper/demi-Cooper > escalier** : un seul indicateur retenu par session pour ne pas compter deux fois la même capacité. Les saisies directes (VMA/VO2max dans le bloc Cooper) sont prioritaires sur les dérivations depuis la distance Cooper (VMA = dist/200), elles-mêmes prioritaires sur le test escalier. Les tendances 30 j et les périodes de calcul appliquent la même règle
- Historique, graphique par indicateur avec zones objectif/seuil
- Export CSV / JSON (le CSV embarque le profil en lignes « # profil ») ; import JSON/CSV avec fusion (profil, sessions par date+type, historiques) pour restaurer après plantage ; effacement complet des données
- Avertissement médical avant test maximal si facteurs de risque

## 4. Exigences non fonctionnelles

- Offline-first, aucune dépendance, aucun backend en v1
- Données locales uniquement (localStorage), export pour réversibilité
- Accessibilité : gros chiffres, contraste élevé (public senior possible)
- Responsive mobile/desktop
- i18n : FR en v1, architecture compatible multilingue
- Thème : clair/sombre/système (`prefers-color-scheme`), persistant (localStorage `ft_theme`), sélecteur dans le Profil, `theme-color` et graphiques SVG adaptés

## 5. Jalons

- M1 — Fondations : profil + saisie 14 tests + stockage local ✅
- M2 — Interprétation : scores, statuts, alertes tendance ✅
- M3 — Visualisation : graphes, dashboard, calendrier re-test ✅
- M4 — Export & polish : CSV/JSON ✅, PDF à faire, onboarding à faire

## 6. Backlog

- PWA installable (manifest, service worker) ✅
- Notifications de rappel des tests ✅ (checkbox + heure dans Profil ; setTimeout in-app + PeriodicSync SW app fermée ; rattrapage au démarrage ; clic → ouvre l'app)
- Mode sombre ✅ (sélecteur 3 états dans le Profil : système / clair / sombre ; persistant ; respecte `prefers-color-scheme` ; `theme-color` mis à jour)
- Intégration HealthKit / Google Fit
