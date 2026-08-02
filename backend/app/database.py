from sqlalchemy import text
from sqlmodel import Session, SQLModel, create_engine
from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"options": "-c timezone=utc"},
)


def create_db_and_tables() -> None:
    SQLModel.metadata.create_all(engine)
    # Fix float-coerced client codes (e.g. "3530010000001.0" → "3530010000001")
    with engine.connect() as conn:
        conn.execute(text(
            "UPDATE ventes SET code_client = regexp_replace(code_client, '\\.0$', '') "
            "WHERE code_client ~ '^[0-9]+\\.0$'"
        ))
        conn.commit()


def get_session():
    with Session(engine) as session:
        yield session
