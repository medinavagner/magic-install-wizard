#!/usr/bin/env bash
# Backup diário do PostgreSQL → /var/backups/deployconsole
set -euo pipefail
cd "$( dirname "$0" )/.."
set -a; source .env; set +a

OUT_DIR="/var/backups/deployconsole"
sudo mkdir -p "$OUT_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
FILE="$OUT_DIR/db-${STAMP}.sql.gz"

docker compose exec -T db \
  pg_dumpall -U postgres | gzip > "/tmp/db-${STAMP}.sql.gz"
sudo mv "/tmp/db-${STAMP}.sql.gz" "$FILE"
echo "Backup salvo em $FILE"

# mantém últimos 14 dias
sudo find "$OUT_DIR" -type f -name 'db-*.sql.gz' -mtime +14 -delete
