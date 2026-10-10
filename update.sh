#!/bin/bash

# Update the Cima checkout and restart its PM2 process.
set -euo pipefail

CIMA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$CIMA_DIR"

git pull --ff-only origin main
npm install
pm2 restart ecosystem.config.js --update-env
pm2 save
pm2 status cima
