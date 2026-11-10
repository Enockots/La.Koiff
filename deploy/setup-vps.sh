#!/usr/bin/env bash
# La.Koiff : installation complète sur un VPS Hostinger (Ubuntu 22.04 ou 24.04).
# Utilisation (en root, depuis le dossier lakoiff-app envoyé sur le VPS) :
#   bash deploy/setup-vps.sh votre-domaine.com votre@email.com
# Avant de lancer : dans hPanel, le domaine et www doivent pointer vers l'adresse IP du VPS.
set -euo pipefail

DOMAIN="${1:-}"; EMAIL="${2:-}"
if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Utilisation : bash deploy/setup-vps.sh votre-domaine.com votre@email.com"; exit 1
fi
DOMAIN="${DOMAIN#http://}"; DOMAIN="${DOMAIN#https://}"; DOMAIN="${DOMAIN#www.}"; DOMAIN="${DOMAIN%/}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP=/opt/lakoiff/app
DATA=/var/lib/lakoiff

echo "==> 1/7 Mise à jour du système et outils"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl ca-certificates nginx certbot python3-certbot-nginx ufw rsync

echo "==> 2/7 Node.js 22"
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(".").map(Number).reduce((a,v,i)=>a+v*[1e6,1e3,1][i],0)')" -lt 22013000 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> 3/7 Copie de l'application dans $APP"
id lakoiff >/dev/null 2>&1 || useradd --system --home-dir /opt/lakoiff --create-home --shell /usr/sbin/nologin lakoiff
mkdir -p "$APP" "$DATA"
rsync -a --delete --exclude node_modules --exclude data --exclude .env "$SRC/" "$APP/"
cd "$APP" && npm install --omit=dev --no-audit --no-fund

echo "==> 4/7 Réglages (.env)"
if [[ ! -f "$APP/.env" ]]; then
  if [[ -f "$SRC/.env" ]]; then cp "$SRC/.env" "$APP/.env"; else cp "$APP/.env.example" "$APP/.env"; fi
fi
set_env(){ grep -q "^$1=" "$APP/.env" && sed -i "s|^$1=.*|$1=$2|" "$APP/.env" || echo "$1=$2" >> "$APP/.env"; }
set_env BASE_URL "https://$DOMAIN"
set_env PORT 3000
set_env HOST 127.0.0.1
set_env DB_FILE "$DATA/lakoiff.db"
if grep -q '^WHATSAPP_VERIFY_TOKEN=choisissez-un-mot-de-passe' "$APP/.env"; then set_env WHATSAPP_VERIFY_TOKEN "$(openssl rand -hex 16)"; fi
chown -R lakoiff:lakoiff /opt/lakoiff "$DATA"; chmod 600 "$APP/.env"

echo "==> 5/7 Démarrage automatique (service lakoiff)"
cat > /etc/systemd/system/lakoiff.service <<UNIT
[Unit]
Description=La.Koiff
After=network.target

[Service]
User=lakoiff
WorkingDirectory=$APP
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now lakoiff
systemctl restart lakoiff

echo "==> 6/7 Serveur web (nginx) et pare-feu"
cat > /etc/nginx/sites-available/lakoiff <<NGINX
server {
  listen 80;
  server_name $DOMAIN www.$DOMAIN;
  client_max_body_size 2m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header Connection "";
    proxy_buffering off;          # suivi en direct
    proxy_read_timeout 1h;
  }
}
NGINX
ln -sf /etc/nginx/sites-available/lakoiff /etc/nginx/sites-enabled/lakoiff
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
ufw allow OpenSSH >/dev/null; ufw allow 'Nginx Full' >/dev/null; ufw --force enable >/dev/null

echo "==> 7/7 Certificat HTTPS (Let's Encrypt)"
if certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect -m "$EMAIL" --agree-tos -n; then
  echo ""
  echo "La.Koiff est en ligne : https://$DOMAIN"
else
  echo ""
  echo "Le site tourne, mais le HTTPS n'a pas pu être activé."
  echo "Vérifiez dans hPanel que $DOMAIN et www.$DOMAIN pointent vers l'IP de ce VPS, attendez quelques minutes, puis lancez :"
  echo "  certbot --nginx -d $DOMAIN -d www.$DOMAIN --redirect -m $EMAIL --agree-tos -n"
fi
echo ""
echo "Réglages : $APP/.env (clés WhatsApp). Après une modification : systemctl restart lakoiff"
echo "Journal du site : journalctl -u lakoiff -f"
