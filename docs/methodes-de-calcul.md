# Méthodes de calcul — FitTrack

Ce document décrit **toutes les méthodes de calcul** de tous les indicateurs, scores et
alertes de l'application, avec leurs **références scientifiques**. Il complète
[`docs/specs.md`](specs.md) (fonctionnalités) et reprend la liste des sources affichée
dans l'app (onglet Paramètres → ⓘ « Sources scientifiques »).

> **Avertissement** : ces méthodes situent vos résultats dans des fourchettes publiées.
> Elles ne remplacent pas un avis médical. L'application compare avant tout vos mesures
> **à vous-même dans le temps**.

---

## 1. Principe général d'un indicateur

Chaque test de l'onglet **Session** est défini dans `TESTS` (`app.js`) avec :

| Champ | Rôle |
|---|---|
| `good` | Seuil « bon » 🟢 |
| `mid` | Seuil « moyen » 🟡 (au-delà = « faible » 🔴) |
| `rev` | `true` = **plus bas = mieux** (ex. FC de repos) ; `false`/absent = **plus haut = mieux** |
| `gender` | Seuils spécifiques H/F (prioritaires sur `good`/`mid` si le sexe du profil est renseigné) |
| `min` / `max` | Bornes de saisie (contrôle de cohérence) |

### 1.1 Statut d'une valeur — `statusOf(t, value, profile)`

```
Si rev = true  (plus bas = mieux) :  value ≤ good → 🟢 bon · value ≤ mid → 🟡 moyen · sinon 🔴 faible
Si rev = false (plus haut = mieux) : value ≥ good → 🟢 bon · value ≥ mid → 🟡 moyen · sinon 🔴 faible
```

Les seuils sexe (`t.gender.H` / `t.gender.F`) remplacent `good`/`mid` quand `profile.sex` est connu.

### 1.2 Points de statut — `SCORE_PTS`

| Statut | Points |
|---|---|
| 🟢 bon | **100** |
| 🟡 moyen | **60** |
| 🔴 faible | **25** |

Ces points alimentent le **score global**, l'**IFG** et les **tendances par dimension**.

---

## 2. Indicateurs mesurés (onglet Session)

### 2.1 Repos & mobilité

| # | Test | Unité | Sens | 🟢 Bon | 🟡 Moyen | Seuils sexe (H / F) |
|---|---|---|---|---|---|---|
| 1 | FC de repos | bpm | ↓ | ≤ 60 | ≤ 70 | — |
| 2 | PA systolique | mmHg | ↓ | ≤ 120 | ≤ 130 | — |
| 3 | PA diastolique | mmHg | ↓ | ≤ 80 | ≤ 85 | — |
| 4 | Tour de taille | cm | ↓ | ≤ 94 | ≤ 102 | H : 94/102 · F : 80/88 |
| 5 | Poids | kg | — (pas de statut) | — | — | — |
| 6 | Équilibre unipodal yeux ouverts | s | ↑ | ≥ 40 | ≥ 20 | — |
| 7 | Équilibre unipodal yeux fermés | s | ↑ | ≥ 10 | ≥ 5 | — |
| 8 | Sit-and-reach | cm | ↑ | ≥ 0 | ≥ −10 | — |

**Références** : seuils de tension ESC/ESH (normale < 120/80, élevée 130–139/85–89 mmHg) ;
tour de taille OMS/IDF (risque accru ≥ 94 cm H / ≥ 80 cm F, substantiellement accru
≥ 102 / ≥ 88 cm) ; protocoles standardisés d'équilibre unipodal et de souplesse
(Senior Fitness Test, Rikli & Jones 1999, pour la souplesse).

### 2.2 Force musculaire

| # | Test | Unité | Sens | 🟢 Bon | 🟡 Moyen | Seuils sexe (H / F) |
|---|---|---|---|---|---|---|
| 9 | Préhension (meilleure main) | kg | ↑ | ≥ 45 | ≥ 35 | H : 45/35 · F : 30/20 |
| 10 | Pompes maximales | rép. | ↑ | ≥ 35 | ≥ 20 | H : 35/20 · F : 20/10 |
| 11 | Gainage planche | s | ↑ | ≥ 120 | ≥ 60 | — |
| 12 | Chaise 30 s | rép. | ↑ | ≥ 17 | ≥ 12 | H : 17/12 · F : 16/11 |

**Référence** : batterie de tests de forme fonctionnelle pour adultes — Rikli & Jones,
*Senior Fitness Test* (1999) pour la chaise 30 s ; protocoles communautaires usuels
pour les autres.

### 2.3 Cardio

| # | Test | Unité | Sens | 🟢 Bon | 🟡 Moyen | Seuils sexe (H / F) |
|---|---|---|---|---|---|---|
| 13 | Test escalier — pouls à 1 min (méthode 1) | bpm | ↓ | ≤ 100 | ≤ 110 | — |
| 14 | Test escalier — marches en 60 s (méthode 2) | marches | ↑ | ≥ 80 | ≥ 60 | — |
| 15 | Test escalier — 4 étages chronométrés (méthode 3) | s | ↓ | ≤ 45 | ≤ 60 | — |
| 16 | Cooper — distance (équiv. 12 min) | m | ↑ | ≥ 2400 | ≥ 2200 | H : 2400/2200 · F : 2000/1800 |
| 17 | VMA estimée | km/h | ↑ | ≥ 14 | ≥ 12 | H : 14/12 · F : 12/10 |
| 18 | VO2max estimée | ml/kg/min | ↑ | ≥ 45 | ≥ 35 | H : 45/35 · F : 38/30 |

#### 2.3.1 Test de Cooper et demi-Cooper

- **Cooper complet** : distance maximale couverte en **12 minutes** à allure soutenue (Cooper, *JAMA*, 1968).
- **Demi-Cooper** : 6 minutes ; la distance saisie est **doublée (×2)** au moment de
  l'enregistrement pour rester exprimée en équivalent 12 min.
- Le Cooper **ne sert qu'à produire les estimations VMA / VO2max** — il n'est **jamais
  retenu brut** comme indicateur d'endurance (voir §4.3).

#### 2.3.2 Formules VMA / VO2max

| Formule | Expression | Source |
|---|---|---|
| VMA depuis la distance Cooper | `VMA (km/h) = distance (m) ÷ 200` | Cooper 1968 (relation distance/vitesse) |
| VO2max depuis la VMA | `VO2max (ml/kg/min) = 3,5 × VMA` | Léger & Mercier, 1983 |
| VO2max depuis la distance Cooper | `VO2max = (distance − 504,9) ÷ 44,73` | ACSM, *Guidelines for Exercise Testing and Prescription* |
| VMA depuis la VO2max (inverse) | `VMA = VO2max ÷ 3,5` | (inverse de Léger & Mercier) |

> Les deux formules de VO2max (Léger & Mercier vs ACSM) sont des **approximations publiées** ;
> l'écart entre les deux est d'environ +2,3 ml/kg/min à 2 800 m (ACSM − Léger). L'app affiche
> les deux estimations croisées dans le bloc Cooper.

#### 2.3.3 Tests escalier

- **Méthode 1 — Récupération cardiaque** : 3 min de montées à allure régulière
  (**24 montées/min**, soit 1 aller-retour toutes les 2,5 s — métronome 96 bpm,
  4 bips = 1 aller-retour), pouls mesuré **1 min après l'arrêt**. Plus le pouls est bas,
  meilleure est la récupération.
- **Méthode 2 — Marches en 60 s** : nombre de marches gravis en 60 s.
  Interprétation : ≥ 80 bonne à très bonne endurance · 60–79 moyenne · 40–59 faible à
  modérée · < 40 basse.
- **Méthode 3 — 4 étages chronométrés** : temps pour monter 4 étages.
  Interprétation : < 45 s très bon · 45–60 s bon · 60–90 s moyen · > 90 s mauvais.

#### 2.3.4 Règle de l'indicateur escalier — `stairIndicator(lv)`

Si plusieurs méthodes escalier coexistent, une seule est retenue (pour ne pas compter
deux fois la même capacité), par priorité : **méthode 1 (pouls) > méthode 2 (marches) > méthode 3 (4 étages)**.

### 2.4 Activité & sédentarité

| # | Test | Unité | Sens | 🟢 Bon | 🟡 Moyen |
|---|---|---|---|---|---|
| 19 | IPAQ court — niveau d'activité | MET-min/sem | ↑ | ≥ 3000 | ≥ 600 |
| 20 | Temps assis (jour de semaine) | min | ↓ | ≤ 240 | ≤ 480 |

Voir §3.1 pour le calcul IPAQ. Temps assis : seuils de sédentarité IPAQ/OMS
(objectif < 4 h/jour ; alerte > 8 h/jour).

### 2.5 Sommeil

| # | Test | Unité | Sens | 🟢 Bon | 🟡 Moyen |
|---|---|---|---|---|---|
| 21 | Score de sommeil | /100 | ↑ | ≥ 80 | ≥ 60 |
| 22 | Durée moyenne de sommeil | h | ↑ | ≥ 8 | ≥ 7 |

Voir §3.2 pour le calcul du score de sommeil.

### 2.6 Alimentation

| # | Test | Unité | Sens | 🟢 Bon | 🟡 Moyen |
|---|---|---|---|---|---|
| 23 | Score alimentaire | /100 | ↑ | ≥ 80 | ≥ 60 |

Voir §3.3 pour le calcul du score alimentaire. L'alcool (N7) est aussi persisté comme
mesure `alcohol` (verres/semaine) et alimente le **risque cardiovasculaire** (§6).

---

## 3. Questionnaires calculés

### 3.1 IPAQ court — `ipaqScore(a)` (Craig et al., 2003)

7 questions sur les 7 derniers jours. **MET-min/semaine** (protocole de cotation standard) :

```
MET-min/sem = 8 × (jours × min d'effort intense)
            + 4 × (jours × min d'effort modéré)
            + 3,3 × (jours × min de marche ≥ 10 min d'affilée)
```

| Intensité | MET |
|---|---|
| Effort intense (course, vélo rapide…) | **8** |
| Effort modéré (vélo tranquille, jardinage…) | **4** |
| Marche (≥ 10 min d'affilée) | **3,3** |

**Niveaux** (`ipaqLevel`) : < 600 = 🔴 faible (sédentaire) · 600–2999 = 🟡 modéré · ≥ 3000 = 🟢 élevé (actif).

**Repère OMS 2020** : ≥ 150 min d'activité modérée/semaine ≈ 600 MET-min/sem.

### 3.2 Score de sommeil — `sleepScore(a)` (inspiré du PSQI, Buysse 1989)

5 questions sur les 7 derniers jours. Chaque item est noté **0–100**, puis le score
/100 est la **moyenne pondérée** (poids total = 100) :

| Item | Poids | Cotation 0–100 |
|---|---|---|
| S1 — Durée (h) | **30 %** | 7–9 h = 100 · 6–7 h ou 9–10 h = 80 · 5–6 h ou 10–11 h = 50 · < 5 h ou > 11 h = 10 |
| S2 — Qualité subjective (/5) | **25 %** | `round((v − 1) / 4 × 100)` |
| S3 — Latence d'endormissement (min) | **15 %** | < 15 = 100 · 15–30 = 80 · 30–45 = 50 · 45–60 = 30 · > 60 = 10 |
| S4 — Réveils nocturnes (fois) | **15 %** | 0 = 100 · 1 = 80 · 2 = 50 · 3 = 30 · ≥ 4 = 10 |
| S5 — Sensation au réveil (/5) | **15 %** | `round((v − 1) / 4 × 100)` |

**Niveaux** (`sleepLevel`) : ≥ 80 = 🟢 bon · 60–79 = 🟡 moyen · < 60 = 🔴 perturbé.

**Repères** : NSF — 7–9 h/nuit pour un adulte (18–64 ans), 7–8 h à 65 ans et + ;
l'OMS associe un sommeil < 6 h à un risque accru de maladies cardiovasculaires,
d'obésité et de troubles métaboliques (Cappuccio et al., *Eur Heart J*, 2011).

### 3.3 Score alimentaire — `nutritionScore(a)` (repères OMS + NOVA)

7 questions sur les 7 derniers jours. Chaque item est noté **0–100**, puis le score
/100 est la **moyenne pondérée** (poids total = **110**) :

| Item | Poids | Cotation 0–100 |
|---|---|---|
| N1 — Fruits & légumes (portions/j) | **25** | ≥ 5 = 100 · 3–4 = 80 · 2 = 60 · 1 = 40 · 0 = 20 |
| N2 — Boissons sucrées (verres/j) | **20** | 0 = 100 · ≤ 0,5 = 80 · ≤ 1 = 60 · ≤ 2 = 40 · ≥ 3 = 20 |
| N3 — Ultra-transformés (fois/sem) | **20** | ≤ 1 = 100 · 2–3 = 80 · 4–6 = 60 · 7–10 = 40 · > 10 = 20 |
| N4 — Petit-déjeuner régulier (/5) | **10** | `round((v − 1) / 4 × 100)` |
| N5 — Repas maison (/5) | **15** | `round((v − 1) / 4 × 100)` |
| N6 — Hydratation (verres d'eau/j) | **10** | ≥ 8 = 100 · 5–7 = 80 · 3–4 = 60 · 1–2 = 40 · 0 = 20 |
| N7 — Alcool (verres/sem) | **10** | 0 = 100 · ≤ 2 = 90 · ≤ 5 = 80 · ≤ 7 = 60 · ≤ 10 = 40 · ≤ 13 = 20 · ≥ 14 = **0** |

**Niveaux** (`nutritionLevel`) : ≥ 80 = 🟢 équilibrée · 60–79 = 🟡 moyenne · < 60 = 🔴 à améliorer.

**Repères** : OMS — ≥ 400 g/j de fruits & légumes (5 portions), limiter les boissons
sucrées et l'alcool (repère OMS/SPF : ≤ 10 verres/semaine ; ≥ 14 = seuil de risque) ;
classification **NOVA** des aliments ultra-transformés (Monteiro et al., 2019).

---

## 4. Scores agrégés

### 4.1 Dernières valeurs connues — `latestValues()`

Pour chaque indicateur, on retient la **valeur de la session la plus récente** (par date).
Les indicateurs dérivés VMA/VO2max suivent une règle spécifique (§4.3).

### 4.2 Score global — `computeGlobalScore(profile)`

**5 mesures prédictives**, toujours affichées (badge « à faire » si sans valeur) :

```
FC de repos · Tour de taille · Préhension · Escalier (méthode effectivement disponible) · Équilibre yeux ouverts
```

```
Score global /100 = moyenne des SCORE_PTS (100/60/25) des 5 mesures
                    (calculée uniquement sur celles qui ont une valeur)
```

- Si **aucune** des 5 mesures n'a de valeur → pas de score, mais les 5 lignes « à faire » s'affichent.
- Le score du jour est persisté dans `scoreHistory` (1 valeur par date, la dernière écrase).
- **Justification** : ces 5 mesures sont celles les plus prédictives de la mortalité
  cardiovasculaire et toutes causes selon la littérature (Kodama et al., *JAMA* 2009 ;
  Lee et al., méta-analyses fitness/mortalité).

### 4.3 Règle de l'endurance — `enduranceIndicator(lv)` + `latestEnduranceEstimate(lv)`

Le **Cooper ne sert qu'à produire la VMA/VO2max estimées** — il n'est **jamais retenu brut**.

```
1. Dernière VMA/VO2max estimée ou renseignée (par date décroissante ;
   à date égale, VMA préférée à VO2max)     → indicateur retenu
2. Sinon, test escalier (méthode 1 > 2 > 3) → indicateur retenu
3. Sinon, aucun indicateur d'endurance
```

Dans `latestValues()` / `valuesForPeriod()`, chaque indicateur (VMA, VO2max) garde
**sa propre date** : on retient pour chacun le **plus récent** entre la valeur saisie
(dans le bloc Cooper) et la dérivation depuis la dernière distance Cooper. Une saisie
ancienne ne peut donc plus écraser une estimation Cooper plus récente.

### 4.4 Indice FitTrack Global (IFG) — `computeIFG(profile)`

**7 dimensions**, pondérées selon la littérature (mortalité cardiovasculaire et toutes causes) :

| Dimension | Poids | Tests scorés |
|---|---|---|
| 🫀 Cardio au repos & métabolisme | **20 %** | FC repos, PA sys, PA dia, tour de taille |
| 🏃 Endurance cardio | **20 %** | 1 seul indicateur : dernière VMA/VO2max estimée/renseignée, sinon escalier (§4.3) |
| 💪 Force musculaire | **20 %** | Préhension, pompes, gainage, chaise 30 s |
| ⚖️ Équilibre & mobilité | **15 %** | Équilibre yeux ouverts/fermés, sit-and-reach |
| 🏃 Habitudes d'activité | **10 %** | IPAQ, temps assis |
| 🌙 Sommeil & récupération | **10 %** | Score de sommeil, durée de sommeil |
| 🍽 Alimentation | **5 %** | Score alimentaire |

**Score d'une dimension** = moyenne des SCORE_PTS de ses tests scorés
(25 à 100).

**IFG /100** = Σ (score de la dimension × poids de la dimension), arrondi à l'entier.

#### Règle 7/7 — `ifgReadiness(lv, profile)`

> L'IFG **n'est proposé que lorsque les 7 dimensions sont connues** (au moins une mesure
> scorée par dimension). Tant que des dimensions manquent, l'onglet Analyse affiche
> « Complétez les tests pour connaître votre Indice FitTrack Global (X/7 dimensions connues) »
> avec la liste des dimensions « à faire ». La pondération est **fixe** (pas de
> renormalisation sur les dimensions manquantes).

#### Périodes — `computeIFGPeriod(profile, periodKey)`

| Période | Mode |
|---|---|
| Dernière session | `latestValues()` (dernière valeur de chaque test) |
| 1 semaine / 1 mois / 1 an | Moyenne des valeurs de la fenêtre glissante (7/30/365 jours) |
| Toutes les valeurs | Moyenne de toutes les valeurs enregistrées |

Pour les périodes en moyenne, VMA/VO2max suivent la règle « plus récent entre saisie et
dérivation Cooper » (§4.3), et non une moyenne des distances Cooper.

L'IFG du jour est persisté dans `ifgHistory` (1 valeur par date ; **rien n'est enregistré
tant que la règle 7/7 n'est pas satisfaite**).

#### Tendances par dimension (30 j) — `renderIfgTrends(profile)`

Pour chaque dimension : score moyen des mesures des **30 derniers jours** vs **avant** cette
période :

- **▲ en hausse** : +3 points ou plus
- **▼ en baisse** : −3 points ou plus
- **= stable** : entre −2 et +2
- **nouveau** : pas de mesure avant

> Ce score est propre à chaque dimension — ce n'est **pas** l'IFG (qui pondère les
> dimensions entre elles).

---

## 5. IMC — `computeIMC(profile)`

```
IMC = poids (kg) ÷ taille (m)²        (taille du profil, poids = dernière mesure)
```

| IMC | Catégorie |
|---|---|
| < 18,5 | Maigreur |
| 18,5 – 24,9 | Normal 🟢 |
| 25 – 29,9 | Surpoids 🟡 |
| 30 – 34,9 | Obésité modérée 🔴 |
| 35 – 39,9 | Obésité sévère 🔴 |
| ≥ 40 | Obésité morbide 🔴 |

Seuils **OMS**. L'IMC ≥ 30 est un **facteur de risque majeur** (§6) ; l'IMC ≥ 25 un
facteur non majeur.

---

## 6. Facteurs de risque cardiovasculaire — `riskFactors(profile)`

Récapitulatif indicatif (onglet Profil), qui **ne modifie pas les scores** mais pilote
l'avertissement avant les tests maximaux. Cadre : recommandations **ESC 2021** sur la
prévention cardiovasculaire et score **SCORE2** (âge, sexe, tabagisme, PA systolique,
cholestérol, antécédents familiaux).

| Facteur | Majeur ? | Source |
|---|---|---|
| Tabagisme | ✅ | profil |
| Antécédents cardiaques personnels | ✅ | profil |
| Antécédents familiaux précoces | ❌ | profil (parent/fratrie < 55 ans H, < 65 ans F) |
| Hypertension artérielle connue | ✅ | profil |
| Diabète connu | ✅ | profil |
| Dyslipidémie / statine | ✅ | profil |
| Alcool ≥ 14 verres/semaine | ✅ | dernière mesure `alcohol` (questionnaire N7) |
| Alcool > 0 et < 14 verres/sem | ❌ | idem |
| Stress chronique / dépression | ✅ | profil |
| IMC ≥ 30 (obésité) | ✅ | IMC dérivé (§5) |
| IMC ≥ 25 (surpoids) | ❌ | idem |

**Niveau de prudence affiché** : ≥ 3 facteurs majeurs = 🔴 risque élevé · ≥ 1 majeur =
🟡 risque modéré · 0 majeur = 🟢 risque faible.

---

## 7. Alertes de tendance (dashboard)

Pour chaque test ayant un statut (`good` renseigné), sur les **2 dernières sessions** :

```
delta = (dernière − précédente) / max(précédente, 1)
```

| Règle | Seuil de dégradation (par groupe) |
|---|---|
| 🔴 **Dégradation** | sens défavorable au-delà du seuil : `rest` 3 % · `strength` 5 % · `cardio` 5 % · `activity` 10 % · `sleep` 10 % · `nutrition` 10 % |
| 🟡 **Stagnation** | \|delta\| ≤ 1 % **et** au moins 3 sessions → « stable sur 2 sessions, pensez à varier l'entraînement » |

Le sens défavorable dépend de `rev` : pour un test « plus bas = mieux » (`rev: true`),
une **hausse** au-delà du seuil déclenche l'alerte ; pour un test « plus haut = mieux »,
c'est une **baisse**.

## 8. Corrélation de Pearson — `pearsonCorrelation(xs, ys)`

Utilisée dans les 3 nuages de points de l'onglet Analyse (IPAQ ↔ IFG, Sommeil ↔ IFG,
Alimentation ↔ IFG). L'IFG est **recalculé à chaque date** de mesure avec les données
disponibles à cette date (règle 7/7 appliquée).

```
        Σ (xi − x̄)(yi − ȳ)
r = ─────────────────────────────
    √[ Σ (xi − x̄)² · Σ (yi − ȳ)² ]
```

**Seuils usuels** : |r| ≥ 0,7 = forte · 0,4–0,7 = modérée · 0,2–0,4 = faible · < 0,2 = négligeable.

---

## 9. Import montre connectée

100 % local (FileReader, jamais envoyé sur un serveur). Formats : **CSV Garmin Connect**,
**CSV générique**, **TCX** (Training Center XML), **GPX**.

| Mesure FitTrack | Mapping depuis la montre |
|---|---|
| FC de repos (`fc`) | `Resting HR` si disponible, sinon **min des FC min** de la journée (bornes 25–120 bpm) |
| Durée de sommeil (`sleep_hours`) | Somme des durées de sommeil de la journée (h) |
| Score de sommeil (`sleep_score`) | Score **provisoire** = item « durée » seul (`sleepItemScore`, échelle 0–100, sans pondération) |
| IPAQ (`ipaq`) | Estimation MET-min : **3,3 × min de marche** (≥ 90 pas/min) + **8 × min intense** (FC moy ≥ 130) + **4 × min modéré** (FC moy ≥ 100) ; sans FC, repli par calories (~0,1 kcal/min/MET × 70 kg) |

- **TCX** : FC min → `fc` ; distance/durée/calories conservées en champs internes `_distanceKm`, `_durationMin`, `_calories` (affichage « ⌚ montre »).
- **GPX** : durée = écart entre le 1er et le dernier point horodaté ; distance totale par
  **formule de Haversine** (R = 6371 km) ; FC min → `fc` si présente.
- Les champs internes préfixés `_` sont retirés du stockage à l'import final.

---

## 10. Fréquence de re-test (rappels)

| Groupe | Cadence |
|---|---|
| Repos & mobilité | tous les **1 mois** |
| Force | tous les **3 mois** |
| Cardio | tous les **3 mois** |
| Activité & sédentarité | tous les **3 mois** |
| Sommeil | tous les **7 jours** (bilan hebdomadaire) |
| Alimentation | tous les **7 jours** (bilan hebdomadaire) |

Un groupe est « à refaire » quand la dernière mesure de l'un de ses tests date de plus
que la cadence (ou n'existe pas → « jamais effectué »).

---

## 11. Références scientifiques

1. **Craig CL et al.** — « International physical activity questionnaire: 12-country
   reliability and validity », *Med Sci Sports Exerc*, 2003. → IPAQ court, cotation
   MET-min/sem (8×intense, 4×modéré, 3,3×marche), seuils 600 / 3000.
2. **OMS** — « Lignes directrices de l'OMS sur l'activité physique et la sédentarité », 2020.
   → ≥ 150 min d'activité modérée/semaine (≈ 600 MET-min/sem).
3. **Cooper KH** — « A means of assessing maximal power output », *JAMA*, 1968.
   → Test de Cooper (12 min), repères cardio-respiratoires adultes H/F, relation
   distance/vitesse (VMA = distance ÷ 200).
4. **Léger LA & Mercier J** — 1983. → VO2max = 3,5 × VMA.
5. **ACSM** — *Guidelines for Exercise Testing and Prescription*. → VO2max =
   (distance − 504,9) ÷ 44,73 depuis le Cooper.
6. **OMS / IDF** — seuils de tour de taille (risque métabolique) : ≥ 94 cm (H) /
   ≥ 80 cm (F) risque accru ; ≥ 102 / ≥ 88 cm risque substantiellement accru.
7. **ESC / ESH** — seuils de pression artérielle : normale < 120/80 mmHg,
   élevée 130–139/85–89 mmHg.
8. **ESC 2021** — recommandations sur la prévention cardiovasculaire ; score **SCORE2**
   (âge, sexe, tabagisme, PA systolique, cholestérol, antécédents familiaux).
9. **Rikli RE & Jones CJ** — *Senior Fitness Test*, 1999. → chaise 30 s, souplesse
   (sit-and-reach), protocoles standardisés.
10. **Kodama S et al.** — méta-analyse, *JAMA*, 2009. → marche/course et mortalité
    (VO2max élevée = mortalité réduite).
11. **Lee IM et al.** — méta-analyses. → condition physique (fitness) et mortalité
    cardiovasculaire / toutes causes.
12. **Buysse DJ et al.** — *Pittsburgh Sleep Quality Index (PSQI)*, *Psychiatry Research*,
    1989. → questionnaire de sommeil (abrégé à 5 items, pondérations 30/25/15/15/15).
13. **National Sleep Foundation (NSF)** — 7–9 h/nuit (18–64 ans), 7–8 h (65 ans et +).
14. **Cappuccio FP et al.** — *European Heart Journal*, 2011. → méta-analyse
    sommeil court/qualité et mortalité cardiovasculaire.
15. **OMS** — recommandations alimentaires : ≥ 400 g/j de fruits & légumes,
    limiter les boissons sucrées, limiter l'alcool (repère OMS/SPF ≤ 10 verres/semaine).
16. **Monteiro CA et al.** — classification **NOVA** des aliments ultra-transformés, 2019.
17. **Sofi F et al.** — *Am J Clin Nutr*, 2010 ; **Widmer RJ et al.** — *Am J Med*, 2015.
    → régime méditerranéen et réduction du risque cardiovasculaire.
18. **Malik VS et al.** — méta-analyses. → boissons sucrées et surpoids / diabète de type 2.

---

## 12. Tableau récapitulatif des fonctions (`app.js`)

| Fonction | Rôle |
|---|---|
| `statusOf(t, value, profile)` | Statut 🟢/🟡/🔴 d'une valeur (seuils + sexe + sens) |
| `thresholds(t, profile)` | Seuils effectifs (avec override sexe) |
| `ipaqScore(a)` / `ipaqLevel(met)` | IPAQ MET-min/sem + niveau |
| `sleepItemScore(q, v)` / `sleepScore(a)` / `sleepLevel(s)` | Score de sommeil /100 + niveau |
| `nutritionItemScore(q, v)` / `nutritionScore(a)` / `nutritionLevel(s)` | Score alimentaire /100 + niveau |
| `cooperVMAFromDist(d)` | VMA = distance ÷ 200 |
| `vo2FromVMA(v)` | VO2max = 3,5 × VMA |
| `vo2FromCooperDist(d)` | VO2max = (distance − 504,9) ÷ 44,73 |
| `vmaFromVo2(v)` | VMA = VO2max ÷ 3,5 |
| `derivedVMA(lv)` / `derivedVO2(lv)` | Dernière VMA/VO2max connue `{value, date, source}` |
| `latestValues()` | Dernière valeur de chaque indicateur (+ VMA/VO2max par date) |
| `valuesForPeriod(periodKey)` | Valeurs agrégées sur une période (IFG) |
| `latestEnduranceEstimate(lv)` | Dernière VMA/VO2max estimée/renseignée (date décroissante) |
| `stairIndicator(lv)` | Indicateur escalier retenu (méthode 1 > 2 > 3) |
| `enduranceIndicator(lv)` | Indicateur d'endurance (dernière estimée/renseignée, sinon escalier) |
| `scoredTestsForDim(d, lv)` | Tests réellement scorés d'une dimension IFG |
| `ifgReadiness(lv, profile)` | Règle 7/7 + scores par dimension |
| `computeIFG(profile)` / `computeIFGPeriod(profile, periodKey)` | IFG /100 (règle 7/7) |
| `computeGlobalScore(profile)` | Score global /100 (5 mesures prédictives) |
| `computeIMC(profile)` / `imcBadge(imc)` | IMC + catégorie OMS |
| `riskFactors(profile)` / `hasMajorRisk(profile)` | Facteurs de risque cardiovasculaire |
| `dueGroups()` | Groupes de tests dus (cadence de re-test) |
| `pearsonCorrelation(xs, ys)` | Corrélation de Pearson (nuages de points) |
| `parseGarminCsv` / `parseTcx` / `parseGpx` / `parseWatchFile` | Import montre connectée |
| `applyImportedData(data)` / `parseImportCsv(text)` | Import/export JSON/CSV FitTrack |
