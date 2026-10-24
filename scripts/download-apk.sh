#!/usr/bin/env bash
# ============================================================
# download-apk.sh — télécharge le dernier APK debug généré par la CI
#
# Ce que fait le script :
#   1. Vérifie que la CLI `gh` est installée et authentifiée
#   2. Liste les derniers runs du workflow build-apk.yml
#   3. Sélectionne automatiquement le dernier run terminé avec succès
#   4. Vérifie que l'artifact fittrack-debug-apk existe et n'est pas expiré
#   5. Télécharge l'artifact dans le dossier choisi (défaut : dossier courant)
#   6. Affiche le chemin du fichier app-debug.apk
#
# Usage :
#   ./scripts/download-apk.sh                 # télécharge dans le dossier courant
#   ./scripts/download-apk.sh ~/Downloads     # télécharge dans ~/Downloads
#   ./scripts/download-apk.sh --run 40080969261   # force un run précis
#   ./scripts/download-apk.sh --list          # liste les runs sans télécharger
#   ./scripts/download-apk.sh --help          # aide
# ============================================================
set -euo pipefail

REPO="zian74/HealthTest"
WORKFLOW="build-apk.yml"
ARTIFACT="fittrack-debug-apk"
APK_NAME="app-debug.apk"

TARGET_DIR="."
TARGET_DIR_SET=0
FORCED_RUN=""
LIST_ONLY=0

# ---------- Aide ----------
usage() {
  cat <<EOF
download-apk.sh — télécharge le dernier APK debug généré par la CI

Usage :
  $0 [dossier]                  Télécharge dans <dossier> (défaut : .)
  $0 --run <ID> [dossier]       Force le run <ID> (ex: 40080969261)
  $0 --list                     Liste les 10 derniers runs sans télécharger
  $0 --help                     Affiche cette aide

Exemples :
  $0
  $0 ~/Downloads
  $0 --run 40080969261 /tmp
  $0 --list

Prérequis : la CLI gh (https://cli.github.com/) authentifiée (gh auth login).
L'APK est un build DEBUG non signé — installation manuelle « sources inconnues ».
EOF
}

# ---------- Parsing des arguments ----------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --help|-h) usage; exit 0 ;;
    --list|-l) LIST_ONLY=1; shift ;;
    --run|-r)
      FORCED_RUN="${2:?--run nécessite un ID}"
      shift 2
      ;;
    *)
      if [[ $TARGET_DIR_SET -eq 0 ]]; then
        TARGET_DIR="$1"
        TARGET_DIR_SET=1
      else
        echo "❌ Argument inattendu : $1" >&2
        usage >&2
        exit 1
      fi
      shift
      ;;
  esac
done

# ---------- Vérification de gh ----------
if ! command -v gh >/dev/null 2>&1; then
  echo "❌ La CLI 'gh' n'est pas installée."
  echo "   Installation : https://cli.github.com/"
  echo "   Puis : gh auth login"
  exit 1
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "❌ La CLI 'gh' n'est pas authentifiée."
  echo "   Lance : gh auth login"
  exit 1
fi

# ---------- Lister les runs (mode --list ou pour trouver le dernier succès) ----------
echo "🔍 Recherche des runs du workflow '$WORKFLOW' sur $REPO..."

RUNS_JSON=$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --limit 10 --json databaseId,status,conclusion,event,headBranch,createdAt 2>/dev/null) \
  || { echo "❌ Impossible de lister les runs (vérifie l'accès au repo $REPO)."; exit 1; }

if [[ -z "$RUNS_JSON" || "$RUNS_JSON" == "[]" ]]; then
  echo "❌ Aucun run trouvé pour le workflow '$WORKFLOW'."
  echo "   Le workflow n'a peut-être jamais tourné. Déclenche-le :"
  echo "   gh workflow run $WORKFLOW --repo $REPO --ref main"
  exit 1
fi

# ---------- Mode --list ----------
if [[ $LIST_ONLY -eq 1 ]]; then
  echo ""
  echo "📋 10 derniers runs :"
  echo "$RUNS_JSON" | python3 -c "
import json, sys
runs = json.load(sys.stdin)
for r in runs:
    icon = '✓' if r['conclusion'] == 'success' else ('✗' if r['conclusion'] == 'failure' else '…')
    print(f\"  {icon}  {r['databaseId']}  {r['status']:<10}  {r['event']:<15}  {r['headBranch']:<40}  {r['createdAt'][:10]}\")
"
  exit 0
fi

# ---------- Sélection du run ----------
if [[ -n "$FORCED_RUN" ]]; then
  RUN_ID="$FORCED_RUN"
  echo "🎯 Run forcé : $RUN_ID"
else
  # Sélectionner le premier run terminé avec succès (conclusion == success)
  RUN_ID=$(echo "$RUNS_JSON" | python3 -c "
import json, sys
runs = json.load(sys.stdin)
for r in runs:
    if r['conclusion'] == 'success':
        print(r['databaseId'])
        break
else:
    print('')
")
  if [[ -z "$RUN_ID" ]]; then
    echo "❌ Aucun run terminé avec succès trouvé."
    echo "   Lance un build : gh workflow run $WORKFLOW --repo $REPO --ref main"
    exit 1
  fi
  echo "✅ Dernier run réussi trouvé : $RUN_ID"
fi

# ---------- Vérifier que l'artifact existe ----------
echo "📦 Vérification de l'artifact '$ARTIFACT'..."
ARTIFACT_JSON=$(gh api "repos/$REPO/actions/runs/$RUN_ID/artifacts" --jq ".artifacts[] | select(.name == \"$ARTIFACT\") | {name, size_in_bytes, expired}" 2>/dev/null) \
  || { echo "❌ Impossible de vérifier les artifacts du run $RUN_ID."; exit 1; }

if [[ -z "$ARTIFACT_JSON" ]]; then
  echo "❌ L'artifact '$ARTIFACT' n'existe pas pour le run $RUN_ID."
  echo "   Le build a peut-être échoué avant l'upload."
  exit 1
fi

EXPIRED=$(echo "$ARTIFACT_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['expired'])")
SIZE=$(echo "$ARTIFACT_JSON" | python3 -c "import json,sys; print(json.load(sys.stdin)['size_in_bytes'])")

if [[ "$EXPIRED" == "True" ]]; then
  echo "❌ L'artifact a expiré (rétention 30 jours dépassée)."
  echo "   Relance un build : gh workflow run $WORKFLOW --repo $REPO --ref main"
  exit 1
fi

SIZE_MO=$(python3 -c "print(round($SIZE / 1024 / 1024, 2))")
echo "   Artifact trouvé : $SIZE_MO Mo, non expiré."

# ---------- Créer le dossier cible ----------
mkdir -p "$TARGET_DIR"
ABS_DIR=$(cd "$TARGET_DIR" && pwd)

# ---------- Télécharger ----------
# On récupère l'URL de téléchargement de l'artifact, puis on la télécharge
# avec gh api (l'artifact est un zip contenant l'APK).
echo "⬇️  Téléchargement dans $ABS_DIR ..."
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

ARTIFACT_ID=$(gh api "repos/$REPO/actions/runs/$RUN_ID/artifacts" --jq ".artifacts[] | select(.name == \"$ARTIFACT\") | .id" 2>/dev/null) \
  || { echo "❌ Impossible de récupérer l'ID de l'artifact."; exit 1; }

if [[ -z "$ARTIFACT_ID" ]]; then
  echo "❌ Artifact '$ARTIFACT' introuvable pour le run $RUN_ID."
  exit 1
fi

# gh api ne supporte pas --output : on redirige la sortie binaire vers un fichier.
# L'endpoint renvoie une redirection 302 ; gh api suit les redirections.
if ! gh api "repos/$REPO/actions/artifacts/$ARTIFACT_ID/zip" > "$TMP_DIR/artifact.zip" 2>/dev/null; then
  echo "❌ Échec du téléchargement de l'artifact (run $RUN_ID, artifact $ARTIFACT_ID)."
  echo "   Le token gh n'a peut-être pas le scope 'actions:read' ou l'artifact a expiré."
  echo "   Relance : gh auth login  (ou gh auth refresh -s actions:read)"
  exit 1
fi

# ---------- Extraire l'APK du zip ----------
if command -v unzip >/dev/null 2>&1; then
  unzip -o -q "$TMP_DIR/artifact.zip" -d "$TMP_DIR/extracted" \
    || { echo "❌ Échec de l'extraction du zip."; exit 1; }
elif command -v python3 >/dev/null 2>&1; then
  python3 -c "import zipfile; zipfile.ZipFile('$TMP_DIR/artifact.zip').extractall('$TMP_DIR/extracted')" \
    || { echo "❌ Échec de l'extraction du zip."; exit 1; }
else
  echo "❌ Ni 'unzip' ni 'python3' disponibles pour extraire le zip."
  exit 1
fi

# ---------- Déplacer l'APK ----------
APK_SRC="$TMP_DIR/extracted/$APK_NAME"
if [[ ! -f "$APK_SRC" ]]; then
  echo "❌ L'APK '$APK_NAME' n'a pas été trouvé dans l'artifact téléchargé."
  echo "   Contenu de l'artifact :"
  find "$TMP_DIR/extracted" -type f 2>/dev/null | head -20
  exit 1
fi

FINAL_PATH="$ABS_DIR/$APK_NAME"
mv "$APK_SRC" "$FINAL_PATH"

# ---------- Récapitulatif ----------
APK_SIZE=$(du -h "$FINAL_PATH" | cut -f1)
echo ""
echo "✅ APK téléchargé avec succès !"
echo "   📁 Fichier : $FINAL_PATH"
echo "   📏 Taille  : $APK_SIZE"
echo "   🏷️  Run     : $RUN_ID"
echo ""
echo "📱 Installation sur Android :"
echo "   1. Transfère $APK_NAME sur ton téléphone (USB, email, cloud...)"
echo "   2. Paramètres → Sécurité → Autoriser « sources inconnues »"
echo "   3. Ouvre le fichier APK → Installer"
echo "   Ou en ligne de commande : adb install $FINAL_PATH"
