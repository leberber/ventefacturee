#!/usr/bin/env python3
"""
Import clients from BDD CLIENTS.xls and CLIENT2026.xls into the clients table.
Run from project root: python3 databases/import_clients.py
"""

import os, re, sys
import xlrd
import psycopg2
from datetime import datetime

# ── Config ────────────────────────────────────────────────────────────────────
DB = dict(host='localhost', port=5432, user='postgres', password='postgres', dbname='ventefacturee')
BDD_FILE  = 'data/BDD CLIENTS.xls'
CLI26_FILE = 'data/CLIENT2026.xls'

# ── Helpers ───────────────────────────────────────────────────────────────────
def read_xls(path):
    wb = xlrd.open_workbook(path)
    ws = wb.sheet_by_index(0)
    headers = [str(ws.cell_value(0, c)).strip() for c in range(ws.ncols)]
    rows = []
    for r in range(1, ws.nrows):
        row = {headers[c]: str(ws.cell_value(r, c)).strip() for c in range(ws.ncols)}
        rows.append(row)
    return rows

def norm(s):
    return re.sub(r'\s+', ' ', s.upper().strip())

def clean(s):
    return s.strip() if s and s.strip() else None

def status_int(s):
    if s.startswith('1'): return 1
    if s.startswith('0'): return 0
    return None

def coord(s):
    try: return float(s) if s else None
    except: return None

# ── Load files ────────────────────────────────────────────────────────────────
print("Reading BDD CLIENTS...")
bdd = read_xls(BDD_FILE)
print(f"  {len(bdd)} rows")

print("Reading CLIENT2026...")
cli26 = read_xls(CLI26_FILE)
print(f"  {len(cli26)} rows")

# ── Build CLIENT2026 lookup by normalized Tiers name ─────────────────────────
cli26_by_name = {}
for r in cli26:
    tiers = r.get('Tiers', '').strip()
    code  = r.get('Code', '').strip()
    if tiers and len(code) > 3:          # skip internal entries (000001 etc.)
        cli26_by_name[norm(tiers)] = r

# ── Match function (exact first, then partial) ────────────────────────────────
def find_match(name):
    key = norm(name)
    if key in cli26_by_name:
        return cli26_by_name[key]
    # partial: bdd name contained in sodichn name or vice versa
    if len(key) >= 6:
        for k, r in cli26_by_name.items():
            if key in k or k in key:
                return r
    return None

# ── Connect and import ────────────────────────────────────────────────────────
print("\nConnecting to database...")
conn = psycopg2.connect(**DB)
cur  = conn.cursor()

print("Truncating existing clients...")
cur.execute("TRUNCATE TABLE clients RESTART IDENTITY CASCADE;")

INSERT = """
INSERT INTO clients (
    name, phone, address, commune, wilaya, region,
    type_client, tarification, categorie_bdd, status_bdd,
    latitude, longitude, route_id, vendeur, buid, customer_no,
    code_sodichn, nom_sodichn, rc, nif, ai, activite_sodichn,
    category, is_active, created_at
) VALUES (
    %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s,
    %s, %s, %s, %s, %s, %s,
    'DETAIL', %s, NOW()
)
"""

matched = 0
total   = 0

for r in bdd:
    name = clean(r.get('CustomerNameE', ''))
    if not name:
        continue

    match = find_match(name)
    if match:
        matched += 1

    is_active = status_int(r.get('Status', '')) != 0  # treat unknown as active

    cur.execute(INSERT, (
        name,
        clean(r.get('Tel')),
        clean(r.get('Address')),
        clean(r.get('Commune')),
        clean(r.get('Wilaya')),
        clean(r.get('Region')),
        clean(r.get('Type')),
        clean(r.get('Tarification')),
        clean(r.get('Category')),
        status_int(r.get('Status', '')),
        coord(r.get('Latitude')),
        coord(r.get('Longitude')),
        clean(r.get('RouteID')),
        clean(r.get('Vendeur')),
        clean(r.get('BUID')),
        clean(r.get('CustomerNo')),
        # sodichn fields
        clean(match.get('Code'))       if match else None,
        clean(match.get('Tiers'))      if match else None,
        clean(match.get('RC'))         if match else None,
        clean(match.get('IF'))         if match else None,
        clean(match.get('AI'))         if match else None,
        clean(match.get('Activité'))   if match else None,
        is_active,
    ))
    total += 1

conn.commit()
cur.close()
conn.close()

print(f"\n✅ Imported {total} clients")
print(f"   Matched with CLIENT2026: {matched}")
print(f"   No fiscal match:         {total - matched}")
