#!/usr/bin/env bash
# Run on your own machine to create the repo and push to GitHub.
# Usage: bash scripts/init-git.sh https://github.com/<you>/memo-system.git
set -e
REMOTE="${1:-}"
cd "$(dirname "$0")/.."
git init
git add .
git commit -m "MEMO Management System"
git branch -M main
if [ -n "$REMOTE" ]; then
  git remote add origin "$REMOTE"
  git push -u origin main
  echo "Pushed to $REMOTE"
else
  echo "Repo ready. Add a remote and push:"
  echo "  git remote add origin https://github.com/<you>/memo-system.git"
  echo "  git push -u origin main"
fi
