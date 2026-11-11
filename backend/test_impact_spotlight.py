"""
PayPilot AI – PayPilot Impact & Spotlight integration tests.
Tests Impact revenue allocation from PayPal Sandbox payments, badge awards,
admin solvency checks, Spotlight package purchases, UTC expiration, and SQLite migrations.
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(__file__))

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from db import (
    Base,
    ClientProfile,
    FreelancerProfile,
    ImpactBadge,
    ImpactContribution,
    ImpactFundTransaction,
    Milestone,
    Payment,
    Project,
    SpotlightPurchase,
    User,
    _migrate_users_is_admin,
    init_default_records,
)
from impact_service import ImpactService
from routes_payments import capture_milestone_order, create_milestone_order
from spotlight_service import SpotlightService


def _make_memory_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _fk_on(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = SessionLocal()
    init_default_records(session)
    return engine, session


class ImpactAndSpotlightTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine, self.db = _make_memory_db()
        now = datetime.now(timezone.utc)

        self.client_user = User(
            id=str(uuid.uuid4()),
            name="Morgan Client",
            email="morgan@example.com",
            password_hash="hashed",
            role="client",
            is_admin=False,
            created_at=now,
        )
        self.admin_user = User(
            id=str(uuid.uuid4()),
            name="Admin User",
            email="admin@paypilot.ai",
            password_hash="hashed",
            role="client",
            is_admin=True,
            created_at=now,
        )
        self.freelancer_user = User(
            id=str(uuid.uuid4()),
            name="Elena Freelancer",
            email="elena@example.com",
            password_hash="hashed",
            role="freelancer",
            is_admin=False,
            created_at=now,
        )
        self.db.add_all([self.client_user, self.admin_user, self.freelancer_user])
        self.db.add(ClientProfile(user_id=self.client_user.id))
        self.db.add(ClientProfile(user_id=self.admin_user.id))
        self.db.add(FreelancerProfile(user_id=self.freelancer_user.id, onboarding_completed="true"))

        self.project = Project(
            id=str(uuid.uuid4()),
            client_id=self.client_user.id,
            freelancer_id=self.freelancer_user.id,
            title="Editorial Platform",
            description="Design and build",
            skills=["React", "TypeScript"],
            budget_min=Decimal("10000.00"),
            budget_max=Decimal("10000.00"),
            currency="USD",
            pricing_type="fixed",
            status="active",
        )
        self.db.add(self.project)
        self.db.flush()

        # $8,000 milestone -> 5% fee = $400 -> 30% impact = $120 (12,000 cents >= Starter $100)
        self.milestone = Milestone(
            id=str(uuid.uuid4()),
            project_id=self.project.id,
            title="Full Delivery",
            acceptance_criteria=["All pages shipped"],
            amount=Decimal("8000.00"),
            status="accepted",
        )
        self.db.add(self.milestone)
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_paypal_capture_records_impact_allocation_and_badge(self) -> None:
        with patch("routes_payments.create_order") as mock_create, patch(
            "routes_payments.capture_order"
        ) as mock_capture:
            mock_create.return_value = {"id": "ORDER-IMP-1", "status": "CREATED"}
            mock_capture.return_value = {
                "id": "ORDER-IMP-1",
                "status": "COMPLETED",
                "purchase_units": [
                    {
                        "payments": {
                            "captures": [
                                {
                                    "id": "CAP-IMP-1",
                                    "status": "COMPLETED",
                                    "amount": {"currency_code": "USD", "value": "8000.00"},
                                }
                            ]
                        }
                    }
                ],
            }

            asyncio.run(
                create_milestone_order(
                    milestone_id=self.milestone.id,
                    user_id=self.client_user.id,
                    db=self.db,
                )
            )
            res = asyncio.run(
                capture_milestone_order(
                    order_id="ORDER-IMP-1",
                    user_id=self.client_user.id,
                    db=self.db,
                )
            )
            self.assertEqual(res["status"], "paid_sandbox")

            # Verify Impact Fund transaction (30% of 5% of $8,000 = $120 = 12,000 cents)
            tx = (
                self.db.query(ImpactFundTransaction)
                .filter_by(source_type="platform_fee")
                .first()
            )
            self.assertIsNotNone(tx)
            self.assertEqual(tx.gross_amount_cents, 800000)
            self.assertEqual(tx.platform_revenue_cents, 40000)
            self.assertEqual(tx.allocated_amount_cents, 12000)

            # Verify verified contribution & Starter badge
            contrib = (
                self.db.query(ImpactContribution)
                .filter_by(user_id=self.client_user.id)
                .first()
            )
            self.assertIsNotNone(contrib)
            self.assertEqual(contrib.amount_cents, 12000)

            badges = ImpactService(self.db).get_user_badges(self.client_user.id)
            self.assertEqual([b.badge_type for b in badges], ["starter"])

            # Idempotency: re-running allocation on the same payment does not duplicate
            payment = self.db.query(Payment).filter_by(paypal_order_id="ORDER-IMP-1").first()
            ImpactService(self.db).record_platform_fee_allocation(payment)
            self.assertEqual(
                self.db.query(ImpactFundTransaction).filter_by(source_type="platform_fee").count(),
                1,
            )

    def test_spotlight_purchase_ownership_expiration_and_impact(self) -> None:
        svc = SpotlightService(self.db)
        pkgs = svc.get_packages("project")
        self.assertGreaterEqual(len(pkgs), 3)

        # Freelancer cannot spotlight someone else's project
        with self.assertRaises(HTTPException) as err:
            svc.purchase_spotlight(
                user_id=self.freelancer_user.id,
                target_type="project",
                target_id=self.project.id,
                package_id="pkg_featured",
            )
        self.assertEqual(err.exception.status_code, 400)

        # Client purchases Featured Spotlight ($49 -> 20% = $9.80 = 980 cents to Impact)
        purchase = svc.purchase_spotlight(
            user_id=self.client_user.id,
            target_type="project",
            target_id=self.project.id,
            package_id="pkg_featured",
        )
        self.assertTrue(purchase["is_active"])
        self.assertEqual(purchase["impact_allocated_cents"], 980)

        # Duplicate active spotlight blocked with 409
        with self.assertRaises(HTTPException) as dup_err:
            svc.purchase_spotlight(
                user_id=self.client_user.id,
                target_type="project",
                target_id=self.project.id,
                package_id="pkg_quick",
            )
        self.assertEqual(dup_err.exception.status_code, 409)

        # Expired purchase no longer active
        row = self.db.query(SpotlightPurchase).filter_by(id=purchase["id"]).first()
        row.expires_at = datetime.now(timezone.utc) - timedelta(minutes=5)
        self.db.commit()
        active, _ = svc.is_target_spotlighted("project", self.project.id)
        self.assertFalse(active)

    def test_impact_disbursement_solvency_check(self) -> None:
        svc = ImpactService(self.db)
        with self.assertRaises(HTTPException) as err:
            svc.record_disbursement(
                initiative_id="init_digital_literacy",
                amount_cents=9999999,
                recipient="Test Org",
                reference_id="DISB-TEST-OVER",
            )
        self.assertEqual(err.exception.status_code, 400)

    def test_sqlite_users_is_admin_migration(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "legacy_users.db")
            legacy_engine = create_engine(f"sqlite:///{db_path}")
            with legacy_engine.begin() as conn:
                conn.exec_driver_sql(
                    """
                    CREATE TABLE users (
                        id VARCHAR(36) NOT NULL PRIMARY KEY,
                        name VARCHAR(100) NOT NULL,
                        email VARCHAR(254) NOT NULL UNIQUE,
                        password_hash VARCHAR(256) NOT NULL,
                        role VARCHAR(10) NOT NULL,
                        headline VARCHAR(255),
                        organization VARCHAR(255),
                        created_at DATETIME
                    )
                    """
                )
                conn.exec_driver_sql(
                    """
                    INSERT INTO users (id, name, email, password_hash, role)
                    VALUES ('u1', 'Demo', 'demo@example.com', 'hash', 'client')
                    """
                )

            _migrate_users_is_admin(legacy_engine)

            with legacy_engine.begin() as conn:
                row = conn.exec_driver_sql("SELECT is_admin FROM users WHERE id = 'u1'").fetchone()
                self.assertEqual(row[0], 0)
            legacy_engine.dispose()


if __name__ == "__main__":
    unittest.main()

