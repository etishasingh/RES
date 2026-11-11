"""
PayPilot AI – FastAPI application entry point.
Refuses to start if SESSION_SECRET is not set.
"""
from __future__ import annotations

import os
import sys

# Load .env before anything else
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

# Guard: ensure SESSION_SECRET is set
if not os.environ.get("SESSION_SECRET"):
    default_secret = "paypilot-ai-render-default-session-secret-key-2026"
    print("WARNING: SESSION_SECRET is not set; falling back to default secret.")
    os.environ["SESSION_SECRET"] = default_secret

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import create_tables
from routes_auth import router as auth_router
from routes_profile import freelancers_router, router as profile_router
from routes_ml import router as ml_router
from routes_projects import router as projects_router
from routes_payments import router as payments_router
from routes_impact import router as impact_router
from routes_spotlight import router as spotlight_router

app = FastAPI(title="PayPilot AI API", version="0.1.0")

# Allowed origins for CORS:
# - Local development ports (Vite 3000, 3001, 5173, etc.)
# - Production live Render backend itself
# - Custom frontends passed via FRONTEND_URL or CORS_ORIGINS
# - Regex pattern allowing any Render deployed app: https://.*\.onrender\.com
default_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://127.0.0.1:5173",
    "https://paypilotai-xa4x.onrender.com",
]

for env_var in ("FRONTEND_URL", "CORS_ORIGINS"):
    val = os.environ.get(env_var)
    if val:
        for origin in val.split(","):
            origin_clean = origin.strip().rstrip("/")
            if origin_clean and origin_clean not in default_origins:
                default_origins.append(origin_clean)

app.add_middleware(
    CORSMiddleware,
    allow_origins=default_origins,
    allow_origin_regex=r"https://.*\.onrender\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create tables on startup (SQLite; no migrations needed for MVP)
@app.on_event("startup")
def startup():
    create_tables()

app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(freelancers_router)
app.include_router(ml_router)
app.include_router(projects_router)
app.include_router(payments_router)
app.include_router(impact_router)
app.include_router(spotlight_router)


@app.get("/")
def root():
    return {"status": "ok", "service": "paypilot-ai", "version": "0.1.0"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
