from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.database import create_db_and_tables, engine
from app.api.api_v1.api import api_router
from app.models import produit  # noqa — ensures Produit table is registered

FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist" / "ventefacturee" / "browser"


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    from sqlmodel import Session
    from app.seed_data import run_all
    with Session(engine) as session:
        run_all(session)
    print(f"  {settings.PROJECT_NAME} — démarré")
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve Angular dist (production)
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        file = FRONTEND_DIST / full_path
        if file.exists() and file.is_file():
            return FileResponse(str(file))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
