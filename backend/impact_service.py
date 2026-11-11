"""
PayPilot AI – PayPilot Impact Revenue Allocation, Badges, and Governance Service.

Core Principles:
1. Allocations are derived strictly from platform revenue (e.g. 30% of the 5% platform fee).
2. Freelancer earnings are NEVER modified or reduced.
3. Pending, failed, cancelled, or refunded transactions NEVER generate impact allocations.
4. Duplicate allocations are strictly prevented via database unique constraints and idempotency checks.
5. Badges are awarded ONLY on verified cumulative contributions.
6. Disbursements cannot exceed available allocated fund balances.
"""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from db import (
    ImpactFundTransaction,
    ImpactInitiative,
    ImpactContribution,
    ImpactDisbursement,
    ImpactBadge,
    ImpactSettings,
    Payment,
    User,
)

logger = logging.getLogger(__name__)

# Badge threshold definitions in cents (USD/INR equivalent)
# E.g., Starter: $100+ (10,000 cents), Supporter: $500+, Champion: $2,000+, Leader: $5,000+
BADGE_TIERS = [
    ("leader", 500000, "Impact Leader"),
    ("champion", 200000, "Impact Champion"),
    ("supporter", 50000, "Impact Supporter"),
    ("starter", 10000, "Impact Starter"),
]


class ImpactService:
    def __init__(self, db: Session):
        self.db = db

    def get_settings(self) -> ImpactSettings:
        settings = self.db.query(ImpactSettings).filter_by(id="default").first()
        if not settings:
            settings = ImpactSettings(
                id="default",
                fee_allocation_pct=30.0,
                spotlight_allocation_pct=20.0,
                subscription_allocation_pct=15.0,
            )
            self.db.add(settings)
            self.db.commit()
            self.db.refresh(settings)
        return settings

    def update_settings(
        self,
        fee_allocation_pct: Optional[float] = None,
        spotlight_allocation_pct: Optional[float] = None,
        subscription_allocation_pct: Optional[float] = None,
    ) -> ImpactSettings:
        settings = self.get_settings()
        if fee_allocation_pct is not None:
            if not (0 <= fee_allocation_pct <= 100):
                raise HTTPException(status_code=400, detail="Fee allocation % must be between 0 and 100.")
            settings.fee_allocation_pct = fee_allocation_pct
        if spotlight_allocation_pct is not None:
            if not (0 <= spotlight_allocation_pct <= 100):
                raise HTTPException(status_code=400, detail="Spotlight allocation % must be between 0 and 100.")
            settings.spotlight_allocation_pct = spotlight_allocation_pct
        if subscription_allocation_pct is not None:
            if not (0 <= subscription_allocation_pct <= 100):
                raise HTTPException(status_code=400, detail="Subscription allocation % must be between 0 and 100.")
            settings.subscription_allocation_pct = subscription_allocation_pct
        self.db.commit()
        self.db.refresh(settings)
        return settings

    def record_platform_fee_allocation(
        self, payment: Payment
    ) -> Optional[ImpactFundTransaction]:
        """
        Allocates a portion of the platform fee from a completed milestone payment to the Impact Fund.
        - Fails closed if payment is not settled ('paid_sandbox' or 'COMPLETED').
        - Idempotent: Does not create duplicate allocations for the same payment.
        """
        raw_status = getattr(payment.status, "value", payment.status)
        if str(raw_status).lower() not in {"paid_sandbox", "completed"}:
            logger.warning("Skipping Impact allocation: Payment %s is not completed (status=%s)", payment.id, payment.status)
            return None

        # Check existing allocation (idempotency guard)
        existing = (
            self.db.query(ImpactFundTransaction)
            .filter_by(source_type="platform_fee", source_transaction_id=str(payment.id))
            .first()
        )
        if existing:
            return existing

        settings = self.get_settings()
        pct = settings.fee_allocation_pct / 100.0

        # Resolve gross amount in cents and payer ID across both PayPilot Payment schemas
        gross_cents = getattr(payment, "amount_cents", None)
        if gross_cents is None:
            gross_cents = int((Decimal(str(payment.amount or 0)) * 100).quantize(Decimal("1")))

        base_milestone_cents = getattr(payment, "milestone_amount_cents", None) or gross_cents
        platform_fee_cents = getattr(payment, "fee_cents", None) or int(round(base_milestone_cents * 0.05))
        impact_cents = int(round(platform_fee_cents * pct))

        payer_id = getattr(payment, "payer_id", None) or getattr(payment, "client_id", None)
        milestone_obj = getattr(payment, "milestone", None)
        milestone_title = getattr(payment, "milestone_title", None) or (milestone_obj.title if milestone_obj else None) or payment.id

        tx = ImpactFundTransaction(
            source_type="platform_fee",
            source_transaction_id=str(payment.id),
            user_id=payer_id,
            gross_amount_cents=gross_cents,
            platform_revenue_cents=platform_fee_cents,
            allocated_amount_cents=impact_cents,
            currency=payment.currency or "USD",
            allocation_percentage=settings.fee_allocation_pct,
            status="allocated",
            notes=f"Platform fee allocation from milestone: {milestone_title}",
        )
        self.db.add(tx)

        # Credit the payer as a verified contributor
        if payer_id and impact_cents > 0:
            contrib = (
                self.db.query(ImpactContribution)
                .filter_by(source_type="platform_fee", source_transaction_id=str(payment.id))
                .first()
            )
            if not contrib:
                contrib = ImpactContribution(
                    user_id=payer_id,
                    source_type="platform_fee",
                    source_transaction_id=str(payment.id),
                    amount_cents=impact_cents,
                    currency=payment.currency or "USD",
                    status="verified",
                )
                self.db.add(contrib)

        self.db.commit()
        self.db.refresh(tx)

        # Re-evaluate badges for the contributing client
        if payer_id:
            self.evaluate_badges(payer_id)

        return tx

    def record_spotlight_allocation(
        self, purchase_id: str, user_id: str, gross_amount_cents: int, currency: str = "USD"
    ) -> ImpactFundTransaction:
        """
        Allocates configured percentage of completed Spotlight purchase to the Impact fund.
        """
        existing = (
            self.db.query(ImpactFundTransaction)
            .filter_by(source_type="spotlight", source_transaction_id=purchase_id)
            .first()
        )
        if existing:
            return existing

        settings = self.get_settings()
        pct = settings.spotlight_allocation_pct / 100.0
        allocated_cents = int(round(gross_amount_cents * pct))

        tx = ImpactFundTransaction(
            source_type="spotlight",
            source_transaction_id=purchase_id,
            user_id=user_id,
            gross_amount_cents=gross_amount_cents,
            platform_revenue_cents=gross_amount_cents,
            allocated_amount_cents=allocated_cents,
            currency=currency,
            allocation_percentage=settings.spotlight_allocation_pct,
            status="allocated",
            notes=f"Spotlight visibility purchase impact allocation for purchase {purchase_id}",
        )
        self.db.add(tx)

        # Record contribution credit
        contrib = ImpactContribution(
            user_id=user_id,
            source_type="spotlight",
            source_transaction_id=purchase_id,
            amount_cents=allocated_cents,
            currency=currency,
            status="verified",
        )
        self.db.add(contrib)

        self.db.commit()
        self.db.refresh(tx)

        # Re-evaluate badges for user
        self.evaluate_badges(user_id)

        return tx

    def evaluate_badges(self, user_id: str) -> List[ImpactBadge]:
        """
        Recalculates verified cumulative contributions and awards eligible badges.
        Guarantees:
        - Badges are earned ONLY through verified completed transactions.
        - No duplicate badges.
        """
        # Sum verified contributions
        total_cents = (
            self.db.query(func.coalesce(func.sum(ImpactContribution.amount_cents), 0))
            .filter(
                ImpactContribution.user_id == user_id,
                ImpactContribution.status == "verified",
            )
            .scalar()
        )

        awarded: List[ImpactBadge] = []
        for tier_type, min_cents, label in BADGE_TIERS:
            if total_cents >= min_cents:
                # Check if already awarded
                existing = (
                    self.db.query(ImpactBadge)
                    .filter_by(user_id=user_id, badge_type=tier_type)
                    .first()
                )
                if not existing:
                    badge = ImpactBadge(
                        user_id=user_id,
                        badge_type=tier_type,
                        verified_contribution_total_cents=total_cents,
                        visibility="public",
                    )
                    self.db.add(badge)
                    awarded.append(badge)
                else:
                    # Update verified total
                    existing.verified_contribution_total_cents = total_cents
                    awarded.append(existing)

        self.db.commit()
        return self.get_user_badges(user_id)

    def get_user_badges(self, user_id: str) -> List[ImpactBadge]:
        return (
            self.db.query(ImpactBadge)
            .filter_by(user_id=user_id)
            .order_by(ImpactBadge.earned_at.desc())
            .all()
        )

    def set_badge_visibility(self, user_id: str, badge_type: str, visibility: str) -> ImpactBadge:
        if visibility not in ("public", "private"):
            raise HTTPException(status_code=400, detail="Visibility must be 'public' or 'private'.")
        badge = (
            self.db.query(ImpactBadge)
            .filter_by(user_id=user_id, badge_type=badge_type)
            .first()
        )
        if not badge:
            raise HTTPException(status_code=404, detail="Badge not found.")
        badge.visibility = visibility
        self.db.commit()
        self.db.refresh(badge)
        return badge

    def get_user_contributions(self, user_id: str) -> Dict[str, Any]:
        contributions = (
            self.db.query(ImpactContribution)
            .filter_by(user_id=user_id)
            .order_by(ImpactContribution.created_at.desc())
            .all()
        )
        verified_total_cents = sum(
            c.amount_cents for c in contributions if c.status == "verified"
        )
        pending_total_cents = sum(
            c.amount_cents for c in contributions if c.status == "pending"
        )
        badges = self.get_user_badges(user_id)

        return {
            "user_id": user_id,
            "verified_total_cents": verified_total_cents,
            "verified_total": round(verified_total_cents / 100.0, 2),
            "pending_total_cents": pending_total_cents,
            "pending_total": round(pending_total_cents / 100.0, 2),
            "contributions_count": len(contributions),
            "contributions": [c.to_dict() for c in contributions],
            "badges": [b.to_dict() for b in badges],
        }

    def get_overview(self) -> Dict[str, Any]:
        """
        Platform-wide public Impact overview.
        """
        # Sum of all allocated funds
        total_allocated_cents = (
            self.db.query(func.coalesce(func.sum(ImpactFundTransaction.allocated_amount_cents), 0))
            .filter(ImpactFundTransaction.status == "allocated")
            .scalar()
        ) or 0

        # Sum of all disbursed funds
        total_disbursed_cents = (
            self.db.query(func.coalesce(func.sum(ImpactDisbursement.amount_cents), 0))
            .filter(ImpactDisbursement.verification_status == "verified")
            .scalar()
        ) or 0

        # Available balance
        available_balance_cents = max(0, total_allocated_cents - total_disbursed_cents)

        # Count active initiatives
        active_initiatives_count = (
            self.db.query(ImpactInitiative)
            .filter(ImpactInitiative.status == "active")
            .count()
        )

        # Count verified contributors
        verified_contributors_count = (
            self.db.query(ImpactContribution.user_id)
            .filter(ImpactContribution.status == "verified")
            .distinct()
            .count()
        )

        # Recent verified disbursements
        recent_disbursements = (
            self.db.query(ImpactDisbursement)
            .filter(ImpactDisbursement.verification_status == "verified")
            .order_by(ImpactDisbursement.disbursed_at.desc())
            .limit(10)
            .all()
        )

        # Category breakdown
        categories = [
            "digital_literacy",
            "women_empowerment",
            "rural_skills",
            "environmental_sustainability",
            "community_development",
        ]

        return {
            "total_allocated_cents": total_allocated_cents,
            "total_allocated": round(total_allocated_cents / 100.0, 2),
            "total_disbursed_cents": total_disbursed_cents,
            "total_disbursed": round(total_disbursed_cents / 100.0, 2),
            "available_balance_cents": available_balance_cents,
            "available_balance": round(available_balance_cents / 100.0, 2),
            "active_initiatives_count": active_initiatives_count,
            "verified_contributors_count": verified_contributors_count,
            "categories": categories,
            "recent_disbursements": [d.to_dict() for d in recent_disbursements],
        }

    def get_initiatives(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        q = self.db.query(ImpactInitiative)
        if category:
            q = q.filter(ImpactInitiative.category == category)
        initiatives = q.order_by(ImpactInitiative.created_at.asc()).all()
        return [i.to_dict() for i in initiatives]

    def get_initiative(self, initiative_id: str) -> Dict[str, Any]:
        initiative = self.db.query(ImpactInitiative).filter_by(id=initiative_id).first()
        if not initiative:
            raise HTTPException(status_code=404, detail="Initiative not found.")
        data = initiative.to_dict()
        data["disbursements"] = [d.to_dict() for d in initiative.disbursements]
        return data

    def create_initiative(
        self,
        title: str,
        description: str,
        category: str,
        target_amount_cents: int,
        organization_name: str,
        image_url: Optional[str] = None,
        evidence_url: Optional[str] = None,
    ) -> ImpactInitiative:
        if target_amount_cents <= 0:
            raise HTTPException(status_code=400, detail="Target amount must be greater than zero.")
        initiative = ImpactInitiative(
            title=title.strip(),
            description=description.strip(),
            category=category.strip(),
            target_amount_cents=target_amount_cents,
            organization_name=organization_name.strip(),
            image_url=image_url,
            evidence_url=evidence_url,
            status="active",
            verification_status="verified",
        )
        self.db.add(initiative)
        self.db.commit()
        self.db.refresh(initiative)
        return initiative

    def record_disbursement(
        self,
        initiative_id: str,
        amount_cents: int,
        recipient: str,
        reference_id: str,
        evidence_url: Optional[str] = None,
        notes: Optional[str] = None,
    ) -> ImpactDisbursement:
        if amount_cents <= 0:
            raise HTTPException(status_code=400, detail="Disbursement amount must be greater than zero.")

        initiative = self.db.query(ImpactInitiative).filter_by(id=initiative_id).first()
        if not initiative:
            raise HTTPException(status_code=404, detail="Initiative not found.")

        # Check existing reference id
        if self.db.query(ImpactDisbursement).filter_by(reference_id=reference_id).first():
            raise HTTPException(status_code=409, detail=f"Disbursement reference ID {reference_id} already exists.")

        # Solvency check: ensure available fund balance is sufficient
        overview = self.get_overview()
        if amount_cents > overview["available_balance_cents"]:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient available impact funds: requested {amount_cents/100:.2f}, available {overview['available_balance']:.2f}.",
            )

        disbursement = ImpactDisbursement(
            initiative_id=initiative_id,
            amount_cents=amount_cents,
            recipient=recipient.strip(),
            reference_id=reference_id.strip(),
            verification_status="verified",
            evidence_url=evidence_url,
            notes=notes,
        )
        self.db.add(disbursement)

        # Update initiative disbursed amount
        initiative.disbursed_amount_cents = (initiative.disbursed_amount_cents or 0) + amount_cents
        self.db.commit()
        self.db.refresh(disbursement)
        return disbursement

    def get_ledger(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Admin ledger query."""
        txs = (
            self.db.query(ImpactFundTransaction)
            .order_by(ImpactFundTransaction.created_at.desc())
            .limit(limit)
            .all()
        )
        return [tx.to_dict() for tx in txs]
