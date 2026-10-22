# Points à évaluer — mémoire projet

Points gardés en mémoire pour une **future évaluation** de FitTrack.

## 1. Import des données Garmin et autres montres connectées ✅ (fait — v1)

- Import des données d'activité depuis les montres connectées (Garmin, et autres :
  Apple Watch, Fitbit, Polar, etc.)
- Formats à supporter : CSV exporté depuis Garmin Connect / plateforme constructeur,
  FIT, TCX, GPX
- Données cibles : FC (repos, moyenne, max), nombre de pas, distance, calories,
  dénivelé, durée d'activité
- Correspondance avec les mesures existantes : FC de repos (test n°1), données
  cardio complémentaires pour la dimension Endurance de l'IFG
- Respect du design mono-profil / 100 % local : import manuel de fichier, pas de
  connexion compte constructeur en v1

## 2. Évaluation de l'alimentation ✅ (fait — v1)

- Nouvelle dimension d'évaluation de l'alimentation : questionnaire 6 questions
  sur les 7 derniers jours (fruits & légumes, boissons sucrées, ultra-transformés,
  petit-déjeuner, repas maison, hydratation), score /100 pondéré
- Intégration dans l'Indice FitTrack Global : nouvelle dimension **Alimentation (5 %)**
  (cardio au repos & métabolisme ramené de 25 % à 20 %)
- Corrélation Alimentation ↔ IFG (nuage de points + Pearson r, onglet Analyse)
- Bilan hebdomadaire (cadence identique au sommeil), alertes de tendance,
  repères OMS (≥ 400 g/j de fruits & légumes, limiter les boissons sucrées)
- Habitudes alimentaires déclaratives dans le Profil (régime, repas/jour,
  grignotage) — contextuelles, export/import CSV
- Sources : OMS, classification NOVA (Monteiro 2019), Sofi 2010 / Widmer 2015

## 3. Évaluation du sommeil

- Nouvelle dimension d'évaluation du sommeil : durée, qualité, régularité
- Données de sommeil provenant des montres connectées (via l'import du point 1)
  ou saisie manuelle
- Indicateurs possibles : durée totale, heure de coucher/lever, éveils,
  score de qualité constructeur, régularité sur la semaine
- Intégration potentielle dans l'Indice FitTrack Global (nouvelle dimension ou
  sous-dimension de « Habitudes de vie »)
- Sources scientifiques à référencer (recommandations NSF / OMS sur le sommeil
  adulte : 7–9 h)

---

*Ce fichier est un pense-bête projet. Le point 2 (alimentation) est fait en v1 ;
le point 3 (sommeil avancé) n'est pas encore planifié — à réévaluer lors d'une
future revue.*
