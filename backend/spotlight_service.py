"""
PayPilot AI – PayPilot Spotlight Business Service & Anti-Manipulation Engine.

Core Principles:
1. Spotlight is a paid visibility feature (temporary visual prominence).
2. It is NOT a hiring guarantee and NEVER alters:
   - AI matching scores
   - TF-IDF or skill similarity scores
   - VLM / multimodal evaluation scores
   - Client review ratings
3. Ordinary proposals and projects are never hidden or suppressed.
4. Expirations are enforced strictly via UTC timestamps.
5. Each completed Spotlight purchase automatically contributes a configured portion to PayPilot Impact.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_

from db import (
    SpotlightPackage,
    SpotlightPurchase,
    SpotlightSettings,
    Project,
    Submission,
    User,
)
from impact_service import ImpactService

logger = logging.getLogger(__name__)

FAIRNESS_DISCLAIMER = (
    "Notice: PayPilot Spotlight provides temporary visual prominence only. "
    "It does not alter ML relevance scores, skill rankings, proposal evaluations, "
    "or guarantee client selection. All bids remain equally accessible for review."
)


class SpotlightService:
    def __init__(self, db: Session):
        self.db = db
        self.impact_service = ImpactService(db)

    def get_settings(self) -> SpotlightSettings:
        settings = self.db.query(SpotlightSettings).filter_by(id="default").first()
        if not settings:
            settings = SpotlightSettings(
                id="default",
                enabled=True,
                default_visibility_duration=6,
                allow_proposal_spotlight=True,
                allow_project_spotlight=True,
            )
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        return settings

    def update_settings(
        self,
        enabled: Optional[bool] = None,
        default_visibility_duration: Optional[int] = None,
        allow_proposal_spotlight: Optional[bool] = None,
        allow_project_spotlight: Optional[bool] = None,
    ) -> SpotlightSettings:
        settings = self.get_settings()
        if enabled is not None:
            settings.enabled = enabled
        if default_visibility_duration is not None:
            if default_visibility_duration <= 0:
                raise HTTPException(status_code=400, detail="Duration must be positive.")
            settings.default_visibility_duration = default_visibility_duration
        if allow_proposal_spotlight is not None:
            settings.allow_proposal_spotlight = allow_proposal_spotlight
        if allow_project_spotlight is not None:
            settings.allow_project_spotlight = allow_project_spotlight
        self.db.commit()
        self.db.refresh(settings)
        return settings

    def get_packages(self, target_type: Optional[str] = None) -> List[Dict[str, Any]]:
        q = self.db.query(SpotlightPackage).filter(SpotlightPackage.active == True)
        if target_type:
            q = q.filter(or_(SpotlightPackage.target_type == target_type, SpotlightPackage.target_type == "both"))
        packages = q.order_by(SpotlightPackage.price_cents.asc()).all()
        return [p.to_dict() for p in packages]

    def validate_target_ownership(
        self, user_id: str, target_type: str, target_id: str
    ) -> Tuple[bool, str]:
        """
        Validates that the user owns the target item and that the item is currently eligible.
        """
        if target_type == "project":
            project = self.db.query(Project).filter_by(id=target_id).first()
            if not project:
                return False, f"Project {target_id} not found."
            if project.client_id != user_id:
                return False, "You can only spotlight projects you created as the client."
            if project.status in ("cancelled", "completed"):
                return False, f"Cannot spotlight project in {project.status} status."
            return True, project.title

        elif target_type == "proposal":
            submission = self.db.query(Submission).filter_by(id=target_id).first()
            if not submission:
                return False, f"Proposal/submission {target_id} not found."
            if submission.freelancer_id != user_id:
                return False, "You can only spotlight your own proposal."
            if submission.status in ("rejected", "withdrawn"):
                return False, f"Cannot spotlight proposal in {submission.status} status."
            return True, f"Proposal for milestone {submission.milestone_id}"

        return False, f"Unsupported target type: {target_type}."

    def is_target_spotlighted(
        self, target_type: str, target_id: str
    ) -> Tuple[bool, Optional[SpotlightPurchase]]:
        """
        Checks if an active, unexpired completed purchase exists for this target.
        """
        now = datetime.now(timezone.utc)
        purchases = (
            self.db.query(SpotlightPurchase)
            .filter(
                SpotlightPurchase.target_type == target_type,
                SpotlightPurchase.target_id == target_id,
                SpotlightPurchase.payment_status == "COMPLETED",
            )
            .order_by(SpotlightPurchase.expires_at.desc())
            .all()
        )
        for p in purchases:
            exp = p.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now:
                return True, p
        return False, None

    def purchase_spotlight(
        self,
        user_id: str,
        target_type: str,
        target_id: str,
        package_id: str,
        payment_reference: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Executes a simulated or sandbox Spotlight purchase.
        - Enforces ownership & eligibility.
        - Prevents duplicate active spotlight on the same target.
        - Sets UTC timestamps.
        - Automatically creates Impact Fund allocation and user contribution.
        """
        settings = self.get_settings()
        if not settings.enabled:
            raise HTTPException(status_code=403, detail="Spotlight feature is currently disabled by administrator.")

        if target_type == "proposal" and not settings.allow_proposal_spotlight:
            raise HTTPException(status_code=403, detail="Proposal spotlight is currently disabled.")
        if target_type == "project" and not settings.allow_project_spotlight:
            raise HTTPException(status_code=403, detail="Project spotlight is currently disabled.")

        # 1. Ownership & eligibility validation
        is_valid, reason = self.validate_target_ownership(user_id, target_type, target_id)
        if not is_valid:
            raise HTTPException(status_code=400, detail=reason)

        # 2. Check for existing active spotlight on same target
        already_active, existing_p = self.is_target_spotlighted(target_type, target_id)
        if already_active:
            raise HTTPException(
                status_code=409,
                detail=f"This {target_type} already has an active Spotlight running until {existing_p.expires_at.isoformat() if existing_p else 'soon'}.",
            )

        # 3. Fetch package
        pkg = self.db.query(SpotlightPackage).filter_by(id=package_id, active=True).first()
        if not pkg:
            raise HTTPException(status_code=404, detail="Selected Spotlight package not found or inactive.")

        # 4. Create authoritative purchase record
        now = datetime.now(timezone.utc)
        expires_at = now + timedelta(hours=pkg.duration_hours)
        ref = payment_reference or f"SPOTLIGHT-SANDBOX-{uuid.uuid4().hex[:10].upper()}"

        purchase = SpotlightPurchase(
            user_id=user_id,
            target_type=target_type,
            target_id=target_id,
            package_id=pkg.id,
            amount_cents=pkg.price_cents,
            currency=pkg.currency,
            payment_status="COMPLETED",
            payment_reference=ref,
            purchased_at=now,
            starts_at=now,
            expires_at=expires_at,
        )
        self.db.add(purchase)
        self.db.commit()
        self.db.refresh(purchase)

        # 5. Automatically allocate portion to PayPilot Impact
        impact_tx = self.impact_service.record_spotlight_allocation(
            purchase_id=purchase.id,
            user_id=user_id,
            gross_amount_cents=purchase.amount_cents,
            currency=purchase.currency,
        )

        res = purchase.to_dict()
        res["impact_allocated_cents"] = impact_tx.allocated_amount_cents
        res["fairness_notice"] = FAIRNESS_DISCLAIMER
        return res

    def get_user_purchases(self, user_id: str) -> List[Dict[str, Any]]:
        purchases = (
            self.db.query(SpotlightPurchase)
            .filter_by(user_id=user_id)
            .order_by(SpotlightPurchase.created_at.desc())
            .all()
        )
        return [p.to_dict() for p in purchases]

    def get_active_spotlights(self, target_type: Optional[str] = None) -> List[Dict[str, Any]]:
        now = datetime.now(timezone.utc)
        q = self.db.query(SpotlightPurchase).filter(
            SpotlightPurchase.payment_status == "COMPLETED",
            SpotlightPurchase.expires_at > now,
        )
        if target_type:
            q = q.filter(SpotlightPurchase.target_type == target_type)
        items = q.order_by(SpotlightPurchase.expires_at.desc()).all()
        return [i.to_dict() for i in items]
