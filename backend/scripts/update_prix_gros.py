"""
One-time script: update prix_gros on produits from PRIX GROS.xlsx

Usage (from the backend/ directory):
    python -m scripts.update_prix_gros
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import openpyxl
from sqlmodel import Session, select
from app.database import engine
from app.models.produit import Produit

XLSX_PATH = "/Users/yazidmekhtoub/Downloads/PRIX GROS.xlsx"


def run():
    wb = openpyxl.load_workbook(XLSX_PATH)
    ws = wb.active

    # Build map: code_produit -> prix_gros (skip header row)
    prix_map: dict[str, float] = {}
    for row in ws.iter_rows(min_row=2, values_only=True):
        code, _, prix = row[0], row[1], row[2]
        if code and prix is not None:
            prix_map[str(code).strip()] = float(prix)

    print(f"Loaded {len(prix_map)} prices from Excel")

    updated = 0
    not_found = []

    with Session(engine) as session:
        for code, prix in prix_map.items():
            produit = session.get(Produit, code)
            if produit:
                produit.prix_gros = prix
                session.add(produit)
                updated += 1
            else:
                not_found.append(code)

        session.commit()

    print(f"Updated: {updated}")
    if not_found:
        print(f"Not found in DB ({len(not_found)}): {not_found}")


if __name__ == "__main__":
    run()
