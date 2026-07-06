#!/usr/bin/env bash
#
# setup-droplet.sh — One-command setup for a fresh DigitalOcean droplet.
#
# Run this ONCE after creating the droplet:
#   ssh root@<IP> "bash -s" < scripts/setup-droplet.sh
#
# Or copy it to the droplet and run:
#   scp scripts/setup-droplet.sh root@<IP>:/root/
#   ssh root@<IP> bash /root/setup-droplet.sh
#
# What it does:
#   1. Install Node.js 22 + npm (if not already installed)
#   2. Install PM2 for process management
#   3. Clone the repo from GitHub
#   4. Set up .env.local (you'll need to paste your env vars)
#   5. Run database migrations
#   6. Build the Next.js app
#   7. Start with PM2
#   8. Configure cron for monitoring worker
#   9. Set up nginx + certbot for SSL
#

set -euo pipefail

APP_DIR="/opt/parkgrader"
REPO_URL="${REPO_URL:-git@github.com:YOUR_USERNAME/parkgrader.git}"
DOMAIN="${DOMAIN:-parkgrader.com}"
MONITORING_SECRET="${MONITORING_SECRET:-change-me-to-a-random-string}"

echo "=== ParkGrader Droplet Setup ==="
echo ""

# ── 1. System packages ──────────────────────────────────────────────
echo "[1/8] Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git nginx certbot python3-certbot-nginx

# ── 2. Node.js ──────────────────────────────────────────────────────
echo "[2/8] Setting up Node.js..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
echo "  Node $(node -v), npm $(npm -v)"

# ── 3. PM2 ──────────────────────────────────────────────────────────
echo "[3/8] Installing PM2..."
npm install -g pm2 2>/dev/null || true

# ── 4. Clone repo ───────────────────────────────────────────────────
echo "[4/8] Cloning repository..."
if [ -d "$APP_DIR" ]; then
  echo "  $APP_DIR already exists — pulling latest..."
  cd "$APP_DIR"
  git pull origin main || true
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 5. Environment ──────────────────────────────────────────────────
echo "[5/8] Setting up environment..."
if [ ! -f "$APP_DIR/.env.local" ]; then
  echo "  Creating .env.local from example..."
  cp "$APP_DIR/.env.local.example" "$APP_DIR/.env.local" 2>/dev/null || true
  echo ""
  echo "  ⚠️  IMPORTANT: Edit $APP_DIR/.env.local with your real values."
  echo "  You MUST set: SUPABASE_DB_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,"
  echo "  BYPASS_KEY, APP_BASE_URL, SES_*, and MONITORING_SECRET"
  echo "  The monitoring worker won't run without MONITORING_SECRET."
fi

# Ensure MONITORING_SECRET exists in env.
if ! grep -q "MONITORING_SECRET" "$APP_DIR/.env.local" 2>/dev/null; then
  echo "MONITORING_SECRET=$MONITORING_SECRET" >> "$APP_DIR/.env.local"
fi

# ── 6. Build ────────────────────────────────────────────────────────
echo "[6/8] Installing dependencies and building..."
cd "$APP_DIR"
npm install
npx prisma generate
npm run build

# ── 7. PM2 start ────────────────────────────────────────────────────
echo "[7/8] Starting app with PM2..."
cd "$APP_DIR"
pm2 delete parkgrader 2>/dev/null || true
pm2 start npm --name parkgrader -- start
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ── 8. Cron for monitoring ──────────────────────────────────────────
echo "[8/8] Configuring cron..."
CRON_CMD="*/5 * * * * curl -s -X POST http://localhost:3000/api/monitoring/run -H 'x-monitoring-key: ${MONITORING_SECRET}' >> /var/log/parkgrader-monitor.log 2>&1"
(crontab -l 2>/dev/null | grep -v "monitoring/run" || true; echo "$CRON_CMD") | crontab -

# ── Nginx + SSL ─────────────────────────────────────────────────────
echo ""
echo "=== Setting up nginx + SSL ==="

cat > /etc/nginx/sites-available/parkgrader << 'NGINX'
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
    }

    # Increase body size for lead API payloads.
    client_max_body_size 10m;
}
NGINX

ln -sf /etc/nginx/sites-available/parkgrader /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# Try SSL — will only work if DOMAIN resolves to this droplet.
echo "  Attempting SSL for $DOMAIN..."
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos --email "brian@buckysolutions.com" || echo "  SSL setup skipped (domain may not point here yet). Run: certbot --nginx"

echo ""
echo "=== Setup complete! ==="
echo ""
echo "App:    https://$DOMAIN"
echo "PM2:    pm2 status"
echo "Logs:   pm2 logs parkgrader"
echo "Cron:   crontab -l"
echo "Monitor log: tail -f /var/log/parkgrader-monitor.log"
echo ""
echo "Next steps:"
echo "  1. Edit $APP_DIR/.env.local with real values"
echo "  2. Run: pm2 restart parkgrader"
echo "  3. Run: certbot --nginx  (once DNS is pointing here)"
