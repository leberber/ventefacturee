from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"options": "-c timezone=utc"},
)


def create_db_and_tables() -> None:
    # If objectifs table exists with wrong schema, drop it before create_all
    with engine.connect() as pre_conn:
        try:
            pre_conn.execute(text("SELECT mois, annee, code_produit FROM objectifs LIMIT 1"))
        except Exception:
            pre_conn.rollback()
            pre_conn.execute(text("DROP TABLE IF EXISTS objectifs CASCADE"))
            pre_conn.commit()

    SQLModel.metadata.create_all(engine)
    with engine.connect() as conn:
        # Fix float-coerced client codes (e.g. "3530010000001.0" → "3530010000001")
        conn.execute(text(
            "UPDATE ventes SET code_client = regexp_replace(code_client, '\\.0$', '') "
            "WHERE code_client ~ '^[0-9]+\\.0$'"
        ))

        # Add canal column if not present (existing databases)
        conn.execute(text(
            "ALTER TABLE ventes ADD COLUMN IF NOT EXISTS canal VARCHAR(2)"
        ))

        # Composite indexes for drilldown performance
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_ventes_annee_mois_code_fdv "
            "ON ventes (annee_mois, code_fdv)"
        ))
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_ventes_annee_mois_canal "
            "ON ventes (annee_mois, canal)"
        ))

        # Backfill canal from code_fdv for existing rows
        conn.execute(text(
            "UPDATE ventes SET canal = CASE "
            "  WHEN code_fdv ILIKE '%VH%' THEN 'VH' "
            "  WHEN code_fdv ILIKE '%VD%' THEN 'VD' "
            "END "
            "WHERE canal IS NULL AND code_fdv IS NOT NULL"
        ))

        # Rename prix → prix_dd on produits (idempotent)
        conn.execute(text(
            "DO $$ BEGIN "
            "  IF EXISTS (SELECT 1 FROM information_schema.columns "
            "             WHERE table_name='produits' AND column_name='prix') THEN "
            "    ALTER TABLE produits RENAME COLUMN prix TO prix_dd; "
            "  END IF; "
            "END $$"
        ))
        # Add prix_promotion and prix_gros columns if not present
        conn.execute(text(
            "ALTER TABLE produits ADD COLUMN IF NOT EXISTS prix_promotion FLOAT"
        ))
        conn.execute(text(
            "ALTER TABLE produits ADD COLUMN IF NOT EXISTS prix_club FLOAT"
        ))

        conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
