from fastapi import APIRouter, Depends
from app.api.api_v1.endpoints import clients, chauffeurs, livreurs, bons, auth, users
from app.api.deps import get_current_user

api_router = APIRouter()

# Public — no auth required
api_router.include_router(auth.router,  prefix="/auth",  tags=["Auth"])

# Protected — valid JWT required
api_router.include_router(users.router,     prefix="/users",     tags=["Users"],               dependencies=[Depends(get_current_user)])
api_router.include_router(clients.router,   prefix="/clients",   tags=["Clients"],             dependencies=[Depends(get_current_user)])
api_router.include_router(chauffeurs.router, prefix="/chauffeurs", tags=["Chauffeurs"],         dependencies=[Depends(get_current_user)])
api_router.include_router(livreurs.router,  prefix="/livreurs",  tags=["Livreurs"],            dependencies=[Depends(get_current_user)])
api_router.include_router(bons.router,      prefix="/bls",       tags=["Bons de Livraison"],   dependencies=[Depends(get_current_user)])
