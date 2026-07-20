from fastapi import APIRouter
from app.api.api_v1.endpoints import clients, chauffeurs, bons

api_router = APIRouter()

api_router.include_router(clients.router,   prefix="/clients",   tags=["Clients"])
api_router.include_router(chauffeurs.router, prefix="/chauffeurs", tags=["Chauffeurs"])
api_router.include_router(bons.router,      prefix="/bls",       tags=["Bons de Livraison"])
