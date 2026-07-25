from fastapi import APIRouter, Depends
from app.api.api_v1.endpoints import clients, auth, users, config
from app.api.deps import get_current_user

api_router = APIRouter()

# Public — no auth required
api_router.include_router(auth.router,  prefix="/auth",  tags=["Auth"])

# Protected — valid JWT required
api_router.include_router(users.router,   prefix="/users",   tags=["Users"],   dependencies=[Depends(get_current_user)])
api_router.include_router(clients.router, prefix="/clients", tags=["Clients"], dependencies=[Depends(get_current_user)])
api_router.include_router(config.router,  prefix="/config",  tags=["Config"],  dependencies=[Depends(get_current_user)])
