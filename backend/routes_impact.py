"""
PayPilot AI – FastAPI Impact Router.
Provides public transparency overview, initiative discovery, user contribution tracking,
reputation badges, and authorized administrator fund disbursement operations.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from db import User, get_db
from auth_utils import get_current_user_id
from impact_service import ImpactService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/impact", tags=["impact"])


# ── Pydantic Request Models ──────────────────────────────────────────────────

class CreateInitiativeRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)
    category: str = Field(..., min_length=3, max_length=64)
    target_amount_cents: int = Field(..., gt=0)
    organization_name: str = Field(..., min_length=2, max_length=255)
    image_url: Optional[str] = None
    evidence_url: Optional[str] = None


class CreateDisbursementRequest(BaseModel):
    initiative_id: str
    amount_cents: int = Field(..., gt=0)
    recipient: str = Field(..., min_length=3, max_length=255)
    reference_id: str = Field(..., min_length=3, max_length=128)
    evidence_url: Optional[str] = None
    notes: Optional[str] = None


class BadgeVisibilityRequest(BaseModel):
    badge_type: str
    visibility: str = Field(..., pattern="^(public|private)$")


class UpdateImpactSettingsRequest(BaseModel):
    fee_allocation_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    spotlight_allocation_pct: Optional[float] = Field(None, ge=0.0, le=100.0)
    subscription_allocation_pct: Optional[float] = Field(None, ge=0.0, le=100.0)


# ── Dependencies ─────────────────────────────────────────────────────────────

def get_impact_service(db: Session = Depends(get_db)) -> ImpactService:
    return ImpactService(db)


def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found.")
    return user


def require_admin_user(user: User = Depends(get_current_user)) -> User:
    if not user.is_administrator():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required to perform this action.",
        )
    return user


# ── Public & Authenticated Endpoints ─────────────────────────────────────────

@router.get("/overview", summary="Get platform-wide PayPilot Impact overview metrics")
def get_impact_overview(service: ImpactService = Depends(get_impact_service)) -> Dict[str, Any]:
    return service.get_overview()


@router.get("/initiatives", summary="List verified social impact initiatives")
def list_initiatives(
    category: Optional[str] = Query(None),
    service: ImpactService = Depends(get_impact_service),
) -> List[Dict[str, Any]]:
    return service.get_initiatives(category=category)


@router.get("/initiatives/{initiative_id}", summary="Get detailed initiative breakdown")
def get_initiative_detail(
    initiative_id: str,
    service: ImpactService = Depends(get_impact_service),
) -> Dict[str, Any]:
    return service.get_initiative(initiative_id)


@router.get("/my-contributions", summary="Get authenticated user's contribution history and total")
def get_my_contributions(
    user: User = Depends(get_current_user),
    service: ImpactService = Depends(get_impact_service),
) -> Dict[str, Any]:
    return service.get_user_contributions(user.id)


@router.get("/my-badges", summary="Get authenticated user's verified impact badges")
def get_my_badges(
    user: User = Depends(get_current_user),
    service: ImpactService = Depends(get_impact_service),
) -> List[Dict[str, Any]]:
    badges = service.get_user_badges(user.id)
    return [b.to_dict() for b in badges]


@router.put("/badge-visibility", summary="Update public/private visibility of earned badge")
def update_badge_visibility(
    req: BadgeVisibilityRequest,
    user: User = Depends(get_current_user),
    service: ImpactService = Depends(get_impact_service),
) -> Dict[str, Any]:
    badge = service.set_badge_visibility(user.id, req.badge_type, req.visibility)
    return badge.to_dict()


@router.get("/settings", summary="Get prototype revenue allocation settings")
def get_impact_settings(service: ImpactService = Depends(get_impact_service)) -> Dict[str, Any]:
    return service.get_settings().to_dict()


# ── Admin Operations ─────────────────────────────────────────────────────────

@router.post("/initiatives", status_code=status.HTTP_201_CREATED, summary="Create a new verified impact initiative (Admin)")
def create_initiative(
    req: CreateInitiativeRequest,
    admin: User = Depends(require_admin_user),
    service: ImpactService = Depends(get_impact_service),
) -> Dict[str, Any]:
    initiative = service.create_initiative(
        title=req.title,
        description=req.description,
        category=req.category,
        target_amount_cents=req.target_amount_cents,
        organization_name=req.organization_name,
        image_url=req.image_url,
        evidence_url=req.evidence_url,
    )
    return initiative.to_dict()


@router.post("/disbursements", status_code=status.HTTP_201_CREATED, summary="Record a verified disbursement to an organization (Admin)")
def record_disbursement(
    req: CreateDisbursementRequest,
    admin: User = Depends(require_admin_user),
    service: ImpactService = Depends(get_impact_service),
) -> Dict[str, Any]:
    disbursement = service.record_disbursement(
        initiative_id=req.initiative_id,
        amount_cents=req.amount_cents,
        recipient=req.recipient,
        reference_id=req.reference_id,
        evidence_url=req.evidence_url,
        notes=req.notes,
    )
    return disbursement.to_dict()


@router.get("/ledger", summary="View complete impact fund ledger (Admin)")
def get_impact_ledger(
    limit: int = Query(50, ge=1, le=200),
    admin: User = Depends(require_admin_user),
    service: ImpactService = Depends(get_impact_service),
) -> List[Dict[str, Any]]:
    return service.get_ledger(limit=limit)


@router.put("/settings", summary="Update revenue allocation percentages (Admin)")
def update_impact_settings(
    req: UpdateImpactSettingsRequest,
    admin: User = Depends(require_admin_user),
    service: ImpactService = Depends(get_impact_service),
) -> Dict[str, Any]:
    updated = service.update_settings(
        fee_allocation_pct=req.fee_allocation_pct,
        spotlight_allocation_pct=req.spotlight_allocation_pct,
        subscription_allocation_pct=req.subscription_allocation_pct,
    )
    return updated.to_dict()
