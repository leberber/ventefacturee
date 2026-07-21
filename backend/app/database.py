from sqlmodel import Session, SQLModel, create_engine, text
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"options": "-c timezone=utc"},
)


def run_migrations() -> None:
    """Rename legacy tables/columns to new naming convention."""
    with engine.connect() as conn:
        conn.execute(text("""
            DO $$
            BEGIN
                -- Rename main table (only if target doesn't already exist)
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'bons_de_livraison')
                   AND NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'expeditions') THEN
                    ALTER TABLE bons_de_livraison RENAME TO expeditions;
                END IF;

                -- Rename bl_id -> expedition_id in expedition_clients
                IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expedition_clients' AND column_name = 'bl_id') THEN
                    ALTER TABLE expedition_clients RENAME COLUMN bl_id TO expedition_id;
                END IF;

                -- Rename bl_id -> expedition_id in livraison_details
                IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'livraison_details' AND column_name = 'bl_id') THEN
                    ALTER TABLE livraison_details RENAME COLUMN bl_id TO expedition_id;
                END IF;

                -- Rename expedition_number -> bl_number if created mid-refactor
                IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'expeditions' AND column_name = 'expedition_number') THEN
                    ALTER TABLE expeditions RENAME COLUMN expedition_number TO bl_number;
                END IF;

                -- Add palette_dette columns to retours if table exists but columns are missing
                IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'retours')
                   AND NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'retours' AND column_name = 'palette_dette_plastique') THEN
                    ALTER TABLE retours ADD COLUMN palette_dette_plastique integer NOT NULL DEFAULT 0;
                    ALTER TABLE retours ADD COLUMN palette_dette_bois integer NOT NULL DEFAULT 0;
                END IF;
            END $$;
        """))
        conn.commit()


def create_db_and_tables() -> None:
    run_migrations()
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
