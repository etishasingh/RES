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

# Guard: refuse to start without a real secret
if not os.environ.get("SESSION_SECRET"):
    sys.exit("ERROR: SESSION_SECRET is not set in backend/.env – cannot start.")

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

# CORS: Vite dev server only. In production, remove this and serve via same origin.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
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


@app.get("/api/health")
def health():
    return {"status": "ok"}
