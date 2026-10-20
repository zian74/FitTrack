#!/usr/bin/env bash
# ============================================================
# sync.sh — synchronise le dépôt, commit et pousse une branche + PR
# ============================================================
# Automatise les étapes 1 à 5 du workflow git :
#   1. git fetch + retour sur main + pull --ff-only
#   2. création de la branche vibe/<slug>-d59532
#   3. affichage des changements à commiter (git status)
#   4. git add -A + commit
#   5. push -u + création de la PR en brouillon (gh pr create --draft)
#
# Le script peut être lancé de n'importe où : le dépôt est détecté
# depuis l'emplacement du script (racine du dépôt).
# ============================================================
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_SLUG="zian74/HealthTest"
BRANCH_SUFFIX="d59532"

usage() {
  cat <<EOF
sync.sh — synchronise le dépôt, commit et pousse une branche + PR (brouillon)

Usage :
  ./sync.sh <slug> "<message de commit>" "<titre de PR>" [fichier-body.md]

Arguments :
  slug          courte description -> branche vibe/<slug>-d59532
  message       message de commit (convention : type(scope): resume)
  titre         titre de la pull request
  body.md       optionnel : fichier Markdown pour le corps de la PR

Exemples :
  ./sync.sh ipaq-sedentarity \\
    "feat(activity): questionnaire IPAQ court" \\
    "feat(activity): evaluation de la sedentarite - IPAQ court"

  ./sync.sh fix-delta \\
    "fix(session): affichage du delta" \\
    "fix(session): delta" /tmp/pr-body.md

Etapes effectuees :
  1. git fetch + checkout main + pull --ff-only
  2. creation de la branche vibe/<slug>-d59532
  3. affichage des changements (git status)
  4. git add -A + commit
  5. push -u + gh pr create --draft

Astuce : une fois la CI verte, passer la PR en review avec :
  gh pr ready <numero> --repo $REPO_SLUG
EOF
}

if [ $# -lt 3 ] || [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
  exit 0
fi

SLUG="$1"
COMMIT_MSG="$2"
PR_TITLE="$3"
BODY_FILE="${4:-}"
BRANCH="vibe/${SLUG}-${BRANCH_SUFFIX}"

echo "==> 1/5 Synchronisation avec origin/main"
git -C "$REPO_DIR" fetch origin
git -C "$REPO_DIR" checkout main
git -C "$REPO_DIR" pull --ff-only origin main

echo "==> 2/5 Branche ${BRANCH}"
if git -C "$REPO_DIR" show-ref --verify --quiet "refs/heads/${BRANCH}"; then
  echo "    branche existante, reutilisation"
  git -C "$REPO_DIR" checkout "$BRANCH"
else
  git -C "$REPO_DIR" checkout -b "$BRANCH"
fi

echo "==> 3/5 Changements a commiter"
git -C "$REPO_DIR" status --short
git -C "$REPO_DIR" add -A
if git -C "$REPO_DIR" diff --cached --quiet; then
  echo "    Aucun changement - rien a commiter, abandon."
  exit 1
fi

echo "==> 4/5 Commit : ${COMMIT_MSG}"
git -C "$REPO_DIR" commit -m "$COMMIT_MSG"

echo "==> 5/5 Push + PR (brouillon)"
git -C "$REPO_DIR" push -u origin "$BRANCH"

if [ -n "$BODY_FILE" ]; then
  PR_BODY_ARGS=(--body-file "$BODY_FILE")
else
  BODY_TMP="$(mktemp /tmp/pr-body-sync-XXXX.md)"
  { echo "## Summary"; echo "- ${COMMIT_MSG}"; } > "$BODY_TMP"
  PR_BODY_ARGS=(--body-file "$BODY_TMP")
fi

if ! gh pr create --repo "$REPO_SLUG" --draft --head "$BRANCH" \
     --title "$PR_TITLE" "${PR_BODY_ARGS[@]}"; then
  echo "    Echec de la creation de PR (existe-t-elle deja ?) :"
  gh pr view "$BRANCH" --repo "$REPO_SLUG" --json url --jq '.url' || true
fi

echo "==> Termine. Branche : ${BRANCH}"
echo "    Passer en review quand la CI est verte : gh pr ready <numero> --repo ${REPO_SLUG}"
