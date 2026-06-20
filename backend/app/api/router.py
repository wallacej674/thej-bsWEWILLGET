from fastapi import APIRouter

from app.api.routes.applications import router as applications_router
from app.api.routes.auth import router as auth_router
from app.api.routes.users import router as users_router
from app.api.routes.workspaces import router as workspaces_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(applications_router)
api_router.include_router(users_router)
api_router.include_router(workspaces_router)
