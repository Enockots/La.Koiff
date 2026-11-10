#!/usr/bin/env bash
# La.Koiff : mise à jour du site sur le VPS (garde la base et les réglages).
# Utilisation (en root, depuis le nouveau dossier lakoiff-app) : bash deploy/update.sh
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"; APP=/opt/lakoiff/app
rsync -a --delete --exclude node_modules --exclude data --exclude .env "$SRC/" "$APP/"
cd "$APP" && npm install --omit=dev --no-audit --no-fund
chown -R lakoiff:lakoiff /opt/lakoiff
systemctl restart lakoiff
echo "Mise à jour terminée."
