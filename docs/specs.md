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
| 9 | Préhension (dynamomètre) | force | trimestriel | H 45–55 / F 30–35 kg |
| 10 | Pompes maximales | force | trimestriel | H > 35 / F > 20 |
| 11 | Gainage planche | force | trimestriel | 2 min |
| 12 | Chaise 30 s | force | trimestriel | H 12–17 / F 11–16 |
| 13 | Test escalier — méthode 1 (pouls 1 min) | cardio | trimestriel | ≤ 100 / ≤ 110 (inversé) |
| 14 | Test escalier — méthode 2 (marches en 60 s) | cardio | trimestriel | ≥ 80 / ≥ 60 |
| 15 | Test escalier — méthode 3 (4 étages chronométrés) | cardio | trimestriel | ≤ 45 / ≤ 60 (inversé) |
| 16 | Cooper (12 min) ou demi-Cooper (6 min, distance ×2) | cardio | trimestriel | H > 2400 / F > 2000 m (équiv. 12 min) |
| 17 | IPAQ court — score activité (MET-min/sem) | activité | trimestriel | ≥ 600 (OMS) / ≥ 3000 (élevé) |
| 18 | IPAQ court — temps assis (min/jour de semaine) | activité | trimestriel | ≤ 240 (4 h) / alerte > 480 (8 h) |
| 19 | Score de sommeil (questionnaire 5 items) | sommeil | hebdomadaire | ≥ 80 bon / 60–79 moyen / < 60 perturbé |
| 20 | Durée moyenne de sommeil (h) | sommeil | hebdomadaire | 7–9 h (NSF) |
| 21 | Score alimentaire (questionnaire 6 items) | alimentation | hebdomadaire | ≥ 80 équilibré / 60–79 moyen / < 60 à améliorer |

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
- Saisie des mesures par session datée (6 types : repos, force, cardio, activité, sommeil, alimentation)
- Questionnaire **IPAQ court** (7 questions sur les 7 derniers jours) : score calculé
  automatiquement en MET-min/semaine (8×intensif + 4×modéré + 3,3×marche), niveau
  faible/modéré/élevé selon seuils 600/3000, et temps assis quotidien (Q7)
- Questionnaire **Alimentation** (7 questions scorées sur les 7 derniers jours, alcool N7 inclus) : score /100
  calculé automatiquement (poids total 110 : fruits & légumes 25, boissons sucrées 20,
  ultra-transformés 20, petit-déjeuner 10, repas maison 15, hydratation 10, alcool 10),
  niveau équilibré/moyen/à améliorer selon seuils 80/60 ; repères OMS (≥ 5 portions
  de fruits & légumes/jour, limiter les boissons sucrées, les ultra-transformés NOVA
  et l'alcool ≤ 10 verres/semaine)
- Statut automatique par mesure selon repères sexe/âge
- Score global /100 : moyenne des 5 tests prédictifs
- Historique du score global (1 valeur/jour) consultable dans les graphiques par indicateur
- Onglet **Analyse** : Indice FitTrack Global (IFG, /100) = moyenne pondérée de
  7 dimensions — cardio au repos & métabolisme (20 %), endurance (20 %),
  force (20 %), équilibre & mobilité (15 %), habitudes d'activité (10 %),
  sommeil & récupération (10 %), alimentation (5 %) ;
  **règle 7/7 : aucune valeur IFG tant que les 7 dimensions ne sont pas connues**
  (au moins une mesure scorée par dimension) — l'onglet affiche alors
  « Complétez les tests pour connaître votre Indice FitTrack Global (X/7
  dimensions connues) » avec la liste « à faire » (radar : croix grise au centre,
  légende : badge « à faire ») ; l'historique IFG, les nuages de corrélation
  (IPAQ/sommeil/alimentation ↔ IFG) et les périodes de calcul appliquent la
  même règle ;
  historisé 1×/jour ; radar des dimensions, point fort/faible + conseil,
  courbe d'évolution, tendances 30 jours, nuage de points IPAQ ↔ IFG,
  nuage Sommeil ↔ IFG (score sommeil/100 en X, IFG recalculé à chaque date
  de sommeil en Y, repères 80/60) + coefficient de corrélation de Pearson r
  avec libellé qualitatif (forte ≥ 0,70 / modérée ≥ 0,40 / faible ≥ 0,20) ;
  nuage Alimentation ↔ IFG (même principe : score alimentaire/100 en X, IFG en Y,
  repères 80/60 + Pearson r) ;
  **période de calcul au choix** (dernière session / 1 sem / 1 mois / 1 an / toutes
  les valeurs) s'applique à l'IFG, aux dimensions et aux points forts/priorités
- Alertes tendance : dégradation > 3–5 % ou stagnation sur 2 sessions
- Calendrier de re-test : badges « à jour / à refaire »
- Rappels de re-test : notification quotidienne à heure choisie (in-app via setTimeout + PeriodicSync SW pour app fermée, rattrapage au démarrage si l'heure est passée)
- Onglet **Paramètres** (⚙️) : carte « Sources scientifiques » avec lien ⓘ listant les références utilisées (IPAQ court — Craig 2003 ; OMS 2020 ; Cooper 1968 ; seuils OMS/IDF tour de taille ; ESC/ESH pression artérielle ; Rikli & Jones Senior Fitness Test 1999 ; Kodama 2009 / Lee méta-analyses mortalité ; seuils sédentarité IPAQ/OMS ; alimentation — OMS fruits & légumes ≥ 400 g/j, NOVA Monteiro 2019, Sofi 2010 / Widmer 2015 régime méditerranéen), avec mention « repères indicatifs, pas d'avis médical »
- Onglet **Profil** : facteurs de risque cardiovasculaire — tabagisme, antécédents cardiaques personnels, antécédents familiaux précoces (1ᵉʳ degré < 55/65 ans), hypertension connue, diabète connu, dyslipidémie/statine, stress chronique/dépression ; ⓘ explicatif (cadre ESC 2021 / SCORE2). L'alcool (verres/semaine) est saisi dans le questionnaire Alimentation (N7) et alimente ce récapitulatif
- **IMC** affiché dans le Profil (taille du profil + dernière mesure de poids des sessions) avec badge OMS (maigreur/surpoids/obésité) ; IMC ≥ 30 = facteur de risque majeur
- **Habitudes alimentaires** dans le Profil (déclaratives, contextuelles) : régime
  particulier (végétarien/végétalien/sans gluten), nombre de repas/jour, grignotage
  fréquent — exportées dans le CSV, importées en retour
- **Récapitulatif des facteurs de risque** dans le Profil : liste, badges « majeur », niveau global (faible/modéré/élevé selon le nombre de facteurs majeurs)
- **Avertissement avant test maximal (Cooper)** déclenché par tout facteur majeur (déclaré ou IMC ≥ 30), avec conseil de privilégier le test de l'escalier (sous-maximal) ; les facteurs non majeurs (antécédents familiaux, alcool < 14, surpoids, IMC 25–29,9) n'affichent pas l'avertissement
- Chronomètre intégré pour les tests chronométrés
- ⏳ **Timer compte à rebours générique** (panneau flottant : démarrage/pause, reset ↺, fermeture ✕, arrêt auto à 00:00 avec bip sonore + état « finished » vert, compatible mode sombre, décale au-dessus du chrono si les deux sont ouverts) :
  - test 12 « Chaise 30 s » : 30 s fixe (compter les répétitions)
  - test 13 « Escalier — méthode 1 » : **3 min par défaut, durée réglable** en minutes (montées à 24/min) ; **à la fin des 3 min, un compte à rebours de 1 min se lance automatiquement** (« Escalier — mesure du pouls dans 1 min (asseyez-vous) ») pour indiquer le délai avant la prise du pouls — chaînage auto du timer générique via `data-timer-next-ms` / `data-timer-next-label`, annulable par fermeture (✕) ou reset (↺) ; **métronome 96 bpm** 🥁 (bouton `#timer-metronome` dans le timer, `data-timer-metronome="1"` sur le `.timer-btn`) : 1 bip aigu (1320 Hz) toutes les 625 ms, soit **4 bips = 1 aller-retour** (montée + descente en 2,5 s = 24 montées/min), synchronisé avec le timer (démarre/pause/s'arrête/reset/fermeture), activé par défaut et désactivable d'un clic
  - test 14 « Escalier — méthode 2 » : **60 s fixe** (compter les marches gravis), pas de chaînage
  - test 15 « Escalier — méthode 3 » : **chronomètre ⏱** (pas de timer ⏳) — reporte le temps écoulé dans le champ
  - ~~test 14 « Cooper »~~ : **timer ⏳ supprimé** (le Cooper n'a plus de compte à rebours)
- ⓘ instructions du test chaise (position mur, bras croisés, cuisses parallèles au sol)
- ⓘ instructions du test préhension n°9 (dynamométrie : échauffement mains/avant-bras, debout coude fléchi à 90° avant-bras neutre, réglage poignée sur la 2ᵉ phalange, serrage progressif max 2–3 s sans bouger le bras, 2–3 essais par main avec 30 s de repos, meilleure valeur des deux mains retenue, respiration normale sans Valsalva, arrêt en cas de douleur)
- Test 9 renommé « **Préhension** — meilleure main (kg) » ; propriété `aliases: ['Poigne — meilleure main (kg)']` pour que l'import CSV reconnaisse aussi l'ancien nom de colonne
- **Test escalier — 3 méthodes au choix** (sélecteur radio pilules « Méthode 1 — Pouls à 1 min » / « Méthode 2 — Marches en 60 s » / « Méthode 3 — 4 étages chronométrés ») :
  - Seule la **méthode active** est visible et son input `enabled` ; les 2 autres rows sont masquées (`.hidden`) et leurs inputs `disabled` (ignorés à la sauvegarde et dans `updateSaveState`/`updateFieldValidity`)
  - **Méthode 1** (`stair_pulse`, n°13) : pouls à 1 min après 3 min de montées — seuils inversés ≤ 100 / ≤ 110 bpm — timer ⏳ 3 min (réglable) + chaînage auto 1 min
  - **Méthode 2** (`stair_steps`, n°14) : nombre de marches gravis en 60 s — seuils ≥ 80 (bon) / ≥ 60 (moyen) / < 40 (bas) — timer ⏳ 60 s fixe
  - **Méthode 3** (`stair_4floors`, n°15) : temps pour monter 4 étages — seuils inversés ≤ 45 (très bon) / ≤ 60 (bon) / > 90 (mauvais) — chronomètre ⏱ avec report dans le champ
  - **Analyse** : `stairIndicator(lv)` retourne l'indicateur escalier retenu (priorité méthode 1 > 2 > 3) ; utilisé par `enduranceIndicator` (dimension Endurance IFG) et `computeGlobalScore` (remplace `stair_pulse` dans `PREDICTIVE`)
- **Test 16 Cooper — refonte UI (6 changements)** :
  - **Ordre des champs** : label → choix de durée (radios pilules « 12 min (complet) » / « 6 min (demi-Cooper) ») → champ distance (m) → bloc estimation VMA/VO2max
  - **Bloc estimation VMA/VO2max** : champs VMA (km/h) + VO2max (ml/kg/min) en premier, puis la phrase « Au moins un des 3 champs (distance, VMA ou VO2max) suffit à enregistrer la session. », puis le bloc de résultats
  - **Formules supprimées du bloc d'estimation** : les formules (VMA = distance ÷ 200, VO2max = 3,5 × VMA, VO2max = (distance − 504,9) ÷ 44,73, VMA = VO2max ÷ 3,5) ne sont plus affichées à côté des valeurs estimées — elles restent disponibles dans la pop-up « Sources scientifiques » (onglet Paramètres)
  - **Distance masquée quand VMA/VO2max saisie** : si VMA ou VO2max est renseignée, la ligne « Distance Cooper » n'apparaît plus dans le bloc d'estimation (évite la redondance — seules les estimations croisées VMA↔VO2max sont affichées). La distance réapparaît si VMA et VO2max sont effacées
  - **Renommage** : « 6 min (demi-Cooper ×2) » → « 6 min (demi-Cooper) » (radio, hint du test, placeholder du champ en 6 min « m en 6 min »)
  - En demi-Cooper (6 min), la distance saisie est **automatiquement ×2** (équiv. 12 min) avant calcul et affichage (« 1200 m → équiv. 12 min : 2400 m »), et le stockage applique le même ×2
- **Onglet Paramètres (⚙️)** : 6e et dernier onglet de la nav (après Profil), icône roue crantée seule (aria-label « Paramètres »). Regroupe 3 cartes déplacées depuis l'onglet Profil :
  - **Thème** : radios Système / Clair / Sombre (persistant `ft_theme`, `prefers-color-scheme`, `theme-color` adaptatif)
  - **Rappels de re-test** 🔔 : activation + heure de notification quotidienne (in-app setTimeout + PeriodicSync SW)
  - **Sources scientifiques** : bouton ⓘ ouvrant la modale `__sources__` (références IPAQ, OMS, Cooper, Rikli & Jones, Kodama, ESC/SCORE2…)
  - L'onglet Profil conserve : Mon profil (sexe, naissance, taille, IMC), Facteurs de risque cardio, Repères applicables, Données (effacer)
  - `renderSettings()` initialise le sélecteur de thème au boot et à chaque visite de l'onglet (indépendamment du profil) ; `renderRemindersForm()` appelé à l'ouverture de l'onglet
  - Sur mobile (≤ 640 px) : libellés raccourcis (Accueil, Session, Analyse, Hist., Profil) + icône ⚙️ pour gagner de la place dans la nav
- **Modales accessibles sur mobile** : `.modal` en `flex-direction: column` avec `max-height: calc(100dvh - 32px)` (viewport dynamique, tient compte de la barre d'adresse) ; le corps (`.info-body`) a `overflow-y: auto` + `-webkit-overflow-scrolling: touch` → **le contenu défile dans la pop-up, le titre et les boutons (« Compris », « Enregistrer ») restent toujours visibles**. `.modal-overlay` a aussi `overflow-y: auto` (filet de sécurité). S'applique à la modale ⓘ infos, à l'onboarding et à la modale d'édition
- **Tests** : CI GitHub Actions (`.github/workflows/ci.yml`) — `node --check` sur `app.js` et `sw.js`, présence des fichiers essentiels, validation JSON de `package.json` et `manifest.webmanifest` à chaque push/PR
- **Session Cardio flexible** : le bouton « Enregistrer la session » s'active dès qu'**au moins un** des 3 champs Cooper est rempli et valide (distance m, VMA km/h, VO2max ml/kg/min). La VMA seule ou la VO2max seule suffit — la distance Cooper n'est plus obligatoire. Les valeurs VMA/VO2max saisies sont persistées dans la session (`values.vma` / `values.vo2max`) même sans distance. Contrôle des bornes actif (VMA 4–30 km/h, VO2max 10–90 ml/kg/min) : hors bornes → bouton désactivé + tooltip
- **VMA / VO2max dans les Repères applicables (Profil)** : 2 lignes dédiées (n°17 VMA, n°18 VO2max) avec seuils sexe (H : VMA ≥ 14/12 km/h, VO2max ≥ 45/35 ml/kg/min ; F : VMA ≥ 12/10, VO2max ≥ 38/30) et valeur courante affichée (« vous : 12,0 km/h · estimé Cooper » ou saisie directe, ou « aucune mesure Cooper »)
- **Dimension Endurance (IFG) — dernière VMA/VO2max estimée ou renseignée** : le Cooper ne sert qu'à produire la VMA/VO2max estimée (VMA = dist/200, VO2max = 3,5 × VMA ou ACSM) et n'est **jamais retenu brut**. On retient la VMA/VO2max la plus **récente** (estimée depuis le Cooper ou renseignée dans le bloc Cooper ; à date égale, VMA préférée à VO2max), à défaut le test escalier (méthode 1 > 2 > 3). Une saisie ancienne ne peut plus écraser une estimation Cooper plus récente. `IFG_DIMENSIONS.endurance.tests` = escalier uniquement. Les tendances 30 j et les périodes de calcul appliquent la même règle
- Historique, graphique par indicateur avec zones objectif/seuil ; badge de
  provenance « ⌚ montre » (sport affiché si connu, TCX) sur les sessions
  importées d'une montre connectée (`source: 'import'`, champ `_sport`)
- Export CSV / JSON (le CSV embarque le profil en lignes « # profil ») ; import JSON/CSV avec fusion (profil, sessions par date+type, historiques) pour restaurer après plantage ; effacement complet des données
- **Import montre connectée** (CSV Garmin Connect / générique, TCX, GPX) : parsing 100 % local (FileReader, aucun serveur). Mapping : FC de repos ← min(FC) journée, durée sommeil + score provisoire ← colonne Sleep, IPAQ estimé ← pas/durée/FC (3,3×marche + 4×modéré + 8×intense). Fusion par date+type (valeurs importées prioritaires). Détection auto du format (extension + contenu). Zone de drag & drop + sélecteur fichier (.csv, .tcx, .gpx)
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

- PWA installable (manifest, service worker) ✅ — **plein écran mobile** (simulation app native) : `display: fullscreen` + `display_override: [fullscreen, standalone, minimal-ui]`, `viewport-fit=cover`, meta `mobile-web-app-capable` / `apple-mobile-web-app-capable` / `apple-mobile-web-app-status-bar-style: black-translucent` / `apple-mobile-web-app-title: FitTrack`, et `env(safe-area-inset-top/bottom)` sur header, main, chrono et timer (encoche iPhone + barre d'accueil)
- Notifications de rappel des tests ✅ (checkbox + heure dans Profil ; setTimeout in-app + PeriodicSync SW app fermée ; rattrapage au démarrage ; clic → ouvre l'app)
- Mode sombre ✅ (sélecteur 3 états dans le Profil : système / clair / sombre ; persistant ; respecte `prefers-color-scheme` ; `theme-color` mis à jour)
- Intégration HealthKit / Google Fit
