#!/bin/bash

# Usage: ./restore.sh dev|prod <backup_file>

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/.env"

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: ./restore.sh dev|prod <backup_file>"
  echo ""
  echo "Examples:"
  echo "  ./restore.sh dev ../backups/prod_backup_20260726.dump"
  echo "  ./restore.sh prod ../backups/prod_backup_20260726.dump"
  exit 1
fi

BACKUP_FILE="$2"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: File not found: $BACKUP_FILE"
  exit 1
fi

case "$1" in
  dev)
    HOST="$DEV_HOST"; PORT="$DEV_PORT"; USER="$DEV_USER"; PASS="$DEV_PASS"; DB="$DEV_DB"
    echo ""
    echo "WARNING: This will overwrite the DEV database!"
    read -p "Are you sure? (y/N): " confirm
    if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
      echo "Aborted."
      exit 0
    fi
    ;;
  prod)
    HOST="$PROD_HOST"; PORT="$PROD_PORT"; USER="$PROD_USER"; PASS="$PROD_PASS"; DB="$PROD_DB"
    echo ""
    echo "!!! DANGER: This will overwrite PRODUCTION !!!"
    read -p "Type 'yes-restore-prod' to confirm: " confirm
    if [ "$confirm" != "yes-restore-prod" ]; then
      echo "Aborted."
      exit 0
    fi
    ;;
  *)
    echo "Invalid option: $1. Use 'dev' or 'prod'"
    exit 1
    ;;
esac

echo ""
echo "=== Restoring $1 database ==="
echo "Host: $HOST"
echo "Database: $DB"
echo "From: $BACKUP_FILE"

if [[ "$BACKUP_FILE" == *.dump ]]; then
  PGPASSWORD="$PASS" "$PG_BIN/psql" \
    -h "$HOST" -p "$PORT" -U "$USER" -d "$DB" \
    -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

  PGPASSWORD="$PASS" "$PG_BIN/pg_restore" \
    -h "$HOST" \
    -p "$PORT" \
    -U "$USER" \
    -d "$DB" \
    --no-owner \
    --no-privileges \
    "$BACKUP_FILE"
else
  PGPASSWORD="$PASS" "$PG_BIN/psql" \
    -h "$HOST" \
    -p "$PORT" \
    -U "$USER" \
    -d "$DB" \
    -f "$BACKUP_FILE"
fi

echo ""
echo "Restore complete!"
