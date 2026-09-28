from fastapi import APIRouter
from app.api.routes import folders, ai

from app.api.routes import actions, diagnostics, documents, forecasts, jds, profile, records, resumes


api_router = APIRouter()
api_router.include_router(ai.router, prefix="/ai", tags=["AI settings"])
api_router.include_router(folders.router, prefix="/folders", tags=["folders"])
api_router.include_router(profile.router, prefix="/profile", tags=["profile"])
api_router.include_router(records.router, prefix="/records", tags=["career repository"])
api_router.include_router(documents.router, prefix="/documents", tags=["documents"])
api_router.include_router(jds.router, prefix="/job-descriptions", tags=["job descriptions"])
api_router.include_router(actions.router, prefix="/career", tags=["simulation and planning"])
api_router.include_router(forecasts.router, prefix="/forecasts", tags=["forecasting"])
api_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])
api_router.include_router(diagnostics.router, prefix="/diagnostics", tags=["diagnostics"])
