#!/bin/bash

# Usage: ./backup.sh dev|prod

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/.env"

BACKUP_DIR="$SCRIPT_DIR/../backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

if [ -z "$1" ]; then
  echo "Usage: ./backup.sh dev|prod"
  exit 1
fi

case "$1" in
  dev)
    HOST="$DEV_HOST"; PORT="$DEV_PORT"; USER="$DEV_USER"; PASS="$DEV_PASS"; DB="$DEV_DB"
    ;;
  prod)
    HOST="$PROD_HOST"; PORT="$PROD_PORT"; USER="$PROD_USER"; PASS="$PROD_PASS"; DB="$PROD_DB"
    ;;
  *)
    echo "Invalid option: $1. Use 'dev' or 'prod'"
    exit 1
    ;;
esac

BACKUP_FILE="$BACKUP_DIR/${1}_backup_${TIMESTAMP}.dump"

echo "=== Backing up $1 database ==="
echo "Host: $HOST"
echo "Database: $DB"

PGPASSWORD="$PASS" "$PG_BIN/pg_dump" \
  -h "$HOST" \
  -p "$PORT" \
  -U "$USER" \
  -d "$DB" \
  -Fc \
  -f "$BACKUP_FILE"

echo "Backup complete!"
echo "File: $BACKUP_FILE"
echo "Size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""
echo "=== Recent backups ==="
ls -lh "$BACKUP_DIR"/*.dump 2>/dev/null | tail -5
