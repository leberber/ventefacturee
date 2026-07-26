"""
Seed the produits table from distinct product data in the ventes table.

Usage (from the backend/ directory):
    python -m scripts.seed_produits
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlmodel import Session, select, text
from app.database import engine
from app.models.vente import Vente
from app.models.produit import Produit


def seed():
    with Session(engine) as session:
        # Ensure table exists
        from sqlmodel import SQLModel
        from app.models import produit  # noqa — registers the model
        SQLModel.metadata.create_all(engine)

        # Fetch distinct products from ventes (skip rows without a code)
        rows = session.exec(
            select(
                Vente.code_produit,
                Vente.description_produit,
                Vente.famille,
                Vente.sous_famille,
                Vente.uom_vente,
                Vente.uom_principale,
            )
            .where(Vente.code_produit.is_not(None))
            .distinct()
        ).all()

        if not rows:
            print("No products found in ventes table. Import ventes data first.")
            return

        inserted = 0
        skipped = 0

        for row in rows:
            code = row.code_produit
            existing = session.get(Produit, code)
            if existing:
                # Update description/famille if they were blank
                changed = False
                if not existing.description_produit and row.description_produit:
                    existing.description_produit = row.description_produit
                    changed = True
                if not existing.famille and row.famille:
                    existing.famille = row.famille
                    changed = True
                if not existing.sous_famille and row.sous_famille:
                    existing.sous_famille = row.sous_famille
                    changed = True
                if not existing.uom_vente and row.uom_vente:
                    existing.uom_vente = row.uom_vente
                    changed = True
                if not existing.uom_principale and row.uom_principale:
                    existing.uom_principale = row.uom_principale
                    changed = True
                if changed:
                    session.add(existing)
                skipped += 1
            else:
                session.add(Produit(
                    code_produit=code,
                    description_produit=row.description_produit,
                    famille=row.famille,
                    sous_famille=row.sous_famille,
                    uom_vente=row.uom_vente,
                    uom_principale=row.uom_principale,
                ))
                inserted += 1

        session.commit()
        print(f"Done — {inserted} inserted, {skipped} already existed.")


if __name__ == "__main__":
    seed()
