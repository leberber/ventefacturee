# Database Backup & Restore

## Setup

Edit `databases/.env` with your actual credentials:

```env
# Dev Database (Local)
DEV_HOST=localhost
DEV_PORT=5432
DEV_USER=postgres
DEV_PASS=postgres
DEV_DB=ventefacturee

# Production Database (RDS)
PROD_HOST=YOUR_RDS_ENDPOINT
PROD_PORT=5432
PROD_USER=YOUR_DB_USER
PROD_PASS=YOUR_DB_PASSWORD
PROD_DB=ventefacturee

# PostgreSQL tools path
PG_BIN=/Applications/Postgres.app/Contents/Versions/17/bin
```

Make the scripts executable (first time only):

```bash
chmod +x databases/backup.sh databases/restore.sh
```

---

## Backup

```bash
# Backup dev database
./databases/backup.sh dev

# Backup production database
./databases/backup.sh prod
```

Backups are saved to `backups/` at the project root, named:

```
backups/dev_backup_20260726_143000.dump
backups/prod_backup_20260726_143000.dump
```

---

## Restore

```bash
# Restore to dev (will prompt for confirmation)
./databases/restore.sh dev backups/prod_backup_20260726_143000.dump

# Restore to production (requires typing 'yes-restore-prod')
./databases/restore.sh prod backups/prod_backup_20260726_143000.dump
```

**Warning:** Restore drops and recreates the `public` schema. All existing data will be replaced.

---

## Typical workflow: sync prod to dev

```bash
# 1. Backup production
./databases/backup.sh prod

# 2. Restore latest prod backup to dev
./databases/restore.sh dev backups/prod_backup_YYYYMMDD_HHMMSS.dump
```
