from fastapi import APIRouter

from app.api.routes.ai_analysis import router as ai_analysis_router
from app.api.routes.applications import router as applications_router
from app.api.routes.auth import router as auth_router
from app.api.routes.invitations import router as invitations_router
from app.api.routes.profile import router as profile_router
from app.api.routes.users import router as users_router
from app.api.routes.workspaces import router as workspaces_router

api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(invitations_router)
api_router.include_router(applications_router)
api_router.include_router(ai_analysis_router)
api_router.include_router(profile_router)
api_router.include_router(users_router)
api_router.include_router(workspaces_router)
