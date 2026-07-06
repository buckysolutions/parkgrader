#!/usr/bin/env bash
#
# deploy.sh — Pull latest code, install deps, migrate, build, restart.
#
# Run on the droplet after pushing to GitHub:
#   ssh root@<IP> 'bash /opt/parkgrader/scripts/deploy.sh'
#

set -euo pipefail

APP_DIR="/opt/parkgrader"
cd "$APP_DIR"

echo "=== Deploying ParkGrader ==="
echo ""

echo "[1/5] Pulling latest code..."
git pull origin main

echo "[2/5] Installing dependencies..."
npm install

echo "[3/5] Generating Prisma client..."
npx prisma generate

echo "[4/5] Running database migrations..."
npx prisma migrate deploy

echo "[5/5] Building and restarting..."
npm run build
pm2 restart parkgrader

echo ""
echo "=== Deploy complete! ==="
pm2 status
