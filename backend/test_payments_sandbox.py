"""
PayPilot AI – PayPal Sandbox payment lifecycle and authorization tests.
Runs against isolated in-memory / temporary SQLite databases with mocked PayPal API calls.
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
import unittest
import uuid
from datetime import datetime, timezone
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
    Milestone,
    Payment,
    Project,
    User,
    _migrate_milestones_paid_status,
)
from routes_payments import (
    capture_milestone_order,
    create_milestone_order,
    get_payment_config,
    list_my_payments,
)


def _make_memory_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _fk_on(dbapi_connection, _connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return engine, SessionLocal()


class PayPalSandboxTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine, self.db = _make_memory_db()
        now = datetime.now(timezone.utc)

        self.client_user = User(
            id=str(uuid.uuid4()),
            name="Client One",
            email="client1@example.com",
            password_hash="hashed",
            role="client",
            created_at=now,
        )
        self.other_client = User(
            id=str(uuid.uuid4()),
            name="Client Two",
            email="client2@example.com",
            password_hash="hashed",
            role="client",
            created_at=now,
        )
        self.freelancer_user = User(
            id=str(uuid.uuid4()),
            name="Freelancer One",
            email="freelancer1@example.com",
            password_hash="hashed",
            role="freelancer",
            created_at=now,
        )
        self.db.add_all([self.client_user, self.other_client, self.freelancer_user])
        self.db.add(ClientProfile(user_id=self.client_user.id))
        self.db.add(ClientProfile(user_id=self.other_client.id))
        self.db.add(FreelancerProfile(user_id=self.freelancer_user.id, onboarding_completed="true"))

        self.project = Project(
            id=str(uuid.uuid4()),
            client_id=self.client_user.id,
            freelancer_id=self.freelancer_user.id,
            title="Checkout Redesign",
            description="Redesign checkout flow",
            skills=["React", "TypeScript"],
            budget_min=Decimal("1000.00"),
            budget_max=Decimal("1000.00"),
            currency="USD",
            pricing_type="fixed",
            status="active",
        )
        self.db.add(self.project)
        self.db.flush()

        self.accepted_milestone = Milestone(
            id=str(uuid.uuid4()),
            project_id=self.project.id,
            title="Design System",
            acceptance_criteria=["Tokens documented"],
            amount=Decimal("450.00"),
            status="accepted",
        )
        self.in_progress_milestone = Milestone(
            id=str(uuid.uuid4()),
            project_id=self.project.id,
            title="Implementation",
            acceptance_criteria=["Tests pass"],
            amount=Decimal("550.00"),
            status="in_progress",
        )
        self.db.add_all([self.accepted_milestone, self.in_progress_milestone])
        self.db.commit()

    def tearDown(self) -> None:
        self.db.close()
        self.engine.dispose()

    def test_payment_config_reflects_env(self) -> None:
        with patch.dict(os.environ, {"PAYPAL_CLIENT_ID": "", "PAYPAL_CLIENT_SECRET": ""}, clear=False):
            cfg = get_payment_config(user_id=self.client_user.id, db=self.db)
            self.assertFalse(cfg["configured"])
            self.assertIsNone(cfg["clientId"])
            self.assertEqual(cfg["mode"], "sandbox")

        with patch.dict(
            os.environ,
            {"PAYPAL_CLIENT_ID": "sb-client-123", "PAYPAL_CLIENT_SECRET": "sb-secret-456"},
            clear=False,
        ):
            cfg = get_payment_config(user_id=self.client_user.id, db=self.db)
            self.assertTrue(cfg["configured"])
            self.assertEqual(cfg["clientId"], "sb-client-123")
            self.assertEqual(cfg["mode"], "sandbox")

    def test_order_and_capture_lifecycle_uses_db_amount(self) -> None:
        with patch("routes_payments.create_order") as mock_create, patch(
            "routes_payments.capture_order"
        ) as mock_capture:
            mock_create.return_value = {"id": "ORDER-SB-001", "status": "CREATED"}
            mock_capture.return_value = {
                "id": "ORDER-SB-001",
                "status": "COMPLETED",
                "purchase_units": [
                    {
                        "payments": {
                            "captures": [
                                {
                                    "id": "CAPTURE-SB-999",
                                    "status": "COMPLETED",
                                    "amount": {"currency_code": "USD", "value": "450.00"},
                                }
                            ]
                        }
                    }
                ],
            }

            created = asyncio.run(
                create_milestone_order(
                    milestone_id=self.accepted_milestone.id,
                    user_id=self.client_user.id,
                    db=self.db,
                )
            )
            self.assertEqual(created["orderId"], "ORDER-SB-001")
            self.assertEqual(created["amount"], 450.0)
            mock_create.assert_called_once()
            self.assertEqual(mock_create.call_args.kwargs["amount"], Decimal("450.00"))
            self.assertEqual(mock_create.call_args.kwargs["currency"], "USD")

            # Pending list should show accepted unpaid milestone before capture
            before_capture = list_my_payments(user_id=self.client_user.id, db=self.db)["payments"]
            self.assertEqual(len(before_capture), 1)
            self.assertEqual(before_capture[0]["status"], "pending_approval")

            captured = asyncio.run(
                capture_milestone_order(
                    order_id="ORDER-SB-001",
                    user_id=self.client_user.id,
                    db=self.db,
                )
            )
            self.assertEqual(captured["status"], "paid_sandbox")
            self.assertEqual(captured["captureId"], "CAPTURE-SB-999")

            self.db.refresh(self.accepted_milestone)
            self.assertEqual(self.accepted_milestone.status, "paid")

            # Client and freelancer ledgers both reflect settled payment
            client_ledger = list_my_payments(user_id=self.client_user.id, db=self.db)["payments"]
            self.assertEqual(len(client_ledger), 1)
            self.assertEqual(client_ledger[0]["status"], "paid_sandbox")
            self.assertEqual(client_ledger[0]["sandboxReference"], "CAPTURE-SB-999")

            freelancer_ledger = list_my_payments(user_id=self.freelancer_user.id, db=self.db)["payments"]
            self.assertEqual(len(freelancer_ledger), 1)
            self.assertEqual(freelancer_ledger[0]["amount"], 450.0)

            # Duplicate capture and duplicate order creation blocked with 409
            with self.assertRaises(HTTPException) as dup_cap:
                asyncio.run(
                    capture_milestone_order(
                        order_id="ORDER-SB-001",
                        user_id=self.client_user.id,
                        db=self.db,
                    )
                )
            self.assertEqual(dup_cap.exception.status_code, 409)

            with self.assertRaises(HTTPException) as dup_ord:
                asyncio.run(
                    create_milestone_order(
                        milestone_id=self.accepted_milestone.id,
                        user_id=self.client_user.id,
                        db=self.db,
                    )
                )
            self.assertEqual(dup_ord.exception.status_code, 409)

    def test_authorization_and_status_guards(self) -> None:
        # Freelancer cannot create payment order
        with self.assertRaises(HTTPException) as fl_err:
            asyncio.run(
                create_milestone_order(
                    milestone_id=self.accepted_milestone.id,
                    user_id=self.freelancer_user.id,
                    db=self.db,
                )
            )
        self.assertEqual(fl_err.exception.status_code, 403)

        # Non-owner client gets 404
        with self.assertRaises(HTTPException) as other_err:
            asyncio.run(
                create_milestone_order(
                    milestone_id=self.accepted_milestone.id,
                    user_id=self.other_client.id,
                    db=self.db,
                )
            )
        self.assertEqual(other_err.exception.status_code, 404)

        # In-progress (not accepted) milestone returns 409
        with self.assertRaises(HTTPException) as status_err:
            asyncio.run(
                create_milestone_order(
                    milestone_id=self.in_progress_milestone.id,
                    user_id=self.client_user.id,
                    db=self.db,
                )
            )
        self.assertEqual(status_err.exception.status_code, 409)

    def test_capture_rejects_mismatched_amount(self) -> None:
        with patch("routes_payments.create_order") as mock_create, patch(
            "routes_payments.capture_order"
        ) as mock_capture:
            mock_create.return_value = {"id": "ORDER-SB-BAD", "status": "CREATED"}
            mock_capture.return_value = {
                "id": "ORDER-SB-BAD",
                "status": "COMPLETED",
                "purchase_units": [
                    {
                        "payments": {
                            "captures": [
                                {
                                    "id": "CAPTURE-BAD",
                                    "status": "COMPLETED",
                                    "amount": {"currency_code": "USD", "value": "1.00"},
                                }
                            ]
                        }
                    }
                ],
            }
            asyncio.run(
                create_milestone_order(
                    milestone_id=self.accepted_milestone.id,
                    user_id=self.client_user.id,
                    db=self.db,
                )
            )
            with self.assertRaises(HTTPException) as err:
                asyncio.run(
                    capture_milestone_order(
                        order_id="ORDER-SB-BAD",
                        user_id=self.client_user.id,
                        db=self.db,
                    )
                )
            self.assertEqual(err.exception.status_code, 400)
            self.db.refresh(self.accepted_milestone)
            self.assertEqual(self.accepted_milestone.status, "accepted")

    def test_sqlite_milestones_paid_migration(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            db_path = os.path.join(tmpdir, "legacy.db")
            legacy_engine = create_engine(f"sqlite:///{db_path}")
            with legacy_engine.begin() as conn:
                conn.exec_driver_sql(
                    "CREATE TABLE projects (id VARCHAR(36) PRIMARY KEY)"
                )
                conn.exec_driver_sql(
                    """
                    CREATE TABLE milestones (
                        id VARCHAR(36) NOT NULL PRIMARY KEY,
                        project_id VARCHAR(36) NOT NULL,
                        title VARCHAR(255) NOT NULL,
                        description TEXT,
                        acceptance_criteria JSON NOT NULL,
                        amount NUMERIC(12, 2) NOT NULL,
                        status VARCHAR(20) NOT NULL,
                        due_date DATE,
                        created_at DATETIME NOT NULL,
                        updated_at DATETIME NOT NULL,
                        CONSTRAINT ck_milestones_status CHECK (status IN ('not_started', 'in_progress', 'submitted', 'under_review', 'accepted', 'rejected', 'cancelled')),
                        CONSTRAINT ck_milestones_amount_nonnegative CHECK (amount >= 0),
                        FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE
                    )
                    """
                )
                conn.exec_driver_sql("INSERT INTO projects (id) VALUES ('p1')")
                conn.exec_driver_sql(
                    """
                    INSERT INTO milestones (id, project_id, title, description, acceptance_criteria, amount, status, due_date, created_at, updated_at)
                    VALUES ('m1', 'p1', 'M1', NULL, '[]', 100.00, 'accepted', NULL, '2026-01-01 00:00:00', '2026-01-01 00:00:00')
                    """
                )

            _migrate_milestones_paid_status(legacy_engine)

            with legacy_engine.begin() as conn:
                conn.exec_driver_sql("UPDATE milestones SET status = 'paid' WHERE id = 'm1'")
                row = conn.exec_driver_sql("SELECT status FROM milestones WHERE id = 'm1'").fetchone()
                self.assertEqual(row[0], "paid")
            legacy_engine.dispose()


if __name__ == "__main__":
    unittest.main()

