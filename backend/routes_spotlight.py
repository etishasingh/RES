"""
PayPilot AI – FastAPI Spotlight Router.
Exposes paid visibility packages, sandbox checkout/activation, active target lookups,
and user purchase history. Guarantees strict isolation from AI scoring algorithms.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from db import User, get_db
from auth_utils import get_current_user_id
from spotlight_service import SpotlightService, FAIRNESS_DISCLAIMER

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/spotlight", tags=["spotlight"])


# ── Pydantic Request Models ──────────────────────────────────────────────────

class PurchaseSpotlightRequest(BaseModel):
    target_type: str = Field(..., pattern="^(proposal|project)$")
    target_id: str = Field(..., min_length=1)
    package_id: str = Field(..., min_length=1)
    payment_reference: Optional[str] = None


class UpdateSpotlightSettingsRequest(BaseModel):
    enabled: Optional[bool] = None
    default_visibility_duration: Optional[int] = Field(None, gt=0)
    allow_proposal_spotlight: Optional[bool] = None
    allow_project_spotlight: Optional[bool] = None


# ── Dependencies ─────────────────────────────────────────────────────────────

def get_spotlight_service(db: Session = Depends(get_db)) -> SpotlightService:
    return SpotlightService(db)


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


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/packages", summary="List available Spotlight visibility packages")
def list_packages(
    target_type: Optional[str] = Query(None, pattern="^(proposal|project)$"),
    service: SpotlightService = Depends(get_spotlight_service),
) -> List[Dict[str, Any]]:
    return service.get_packages(target_type=target_type)


@router.post("/purchase", status_code=status.HTTP_201_CREATED, summary="Purchase temporary Spotlight visibility")
def purchase_spotlight(
    req: PurchaseSpotlightRequest,
    user: User = Depends(get_current_user),
    service: SpotlightService = Depends(get_spotlight_service),
) -> Dict[str, Any]:
    purchase = service.purchase_spotlight(
        user_id=user.id,
        target_type=req.target_type,
        target_id=req.target_id,
        package_id=req.package_id,
        payment_reference=req.payment_reference,
    )
    return purchase


@router.get("/my-purchases", summary="Get authenticated user's Spotlight purchase history")
def get_my_purchases(
    user: User = Depends(get_current_user),
    service: SpotlightService = Depends(get_spotlight_service),
) -> List[Dict[str, Any]]:
    return service.get_user_purchases(user.id)


@router.get("/active", summary="List currently active Spotlight items")
def get_active_spotlights(
    target_type: Optional[str] = Query(None, pattern="^(proposal|project)$"),
    service: SpotlightService = Depends(get_spotlight_service),
) -> Dict[str, Any]:
    active_items = service.get_active_spotlights(target_type=target_type)
    return {
        "active_items": active_items,
        "count": len(active_items),
        "fairness_notice": FAIRNESS_DISCLAIMER,
    }


@router.get("/target/{target_type}/{target_id}", summary="Check if a specific project or proposal is currently Spotlight-featured")
def check_target_spotlight(
    target_type: str,
    target_id: str,
    service: SpotlightService = Depends(get_spotlight_service),
) -> Dict[str, Any]:
    if target_type not in ("proposal", "project"):
        raise HTTPException(status_code=400, detail="Invalid target_type. Must be 'proposal' or 'project'.")
    is_active, purchase = service.is_target_spotlighted(target_type, target_id)
    return {
        "target_type": target_type,
        "target_id": target_id,
        "is_spotlight_active": is_active,
        "purchase": purchase.to_dict() if purchase else None,
        "fairness_notice": FAIRNESS_DISCLAIMER,
    }


@router.get("/settings", summary="Get platform Spotlight settings")
def get_spotlight_settings(service: SpotlightService = Depends(get_spotlight_service)) -> Dict[str, Any]:
    return service.get_settings().to_dict()


@router.put("/settings", summary="Update platform Spotlight settings (Admin)")
def update_spotlight_settings(
    req: UpdateSpotlightSettingsRequest,
    admin: User = Depends(require_admin_user),
    service: SpotlightService = Depends(get_spotlight_service),
) -> Dict[str, Any]:
    updated = service.update_settings(
        enabled=req.enabled,
        default_visibility_duration=req.default_visibility_duration,
        allow_proposal_spotlight=req.allow_proposal_spotlight,
        allow_project_spotlight=req.allow_project_spotlight,
    )
    return updated.to_dict()
