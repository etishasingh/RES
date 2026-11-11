"""
Phase 2: Secure AI Evaluation & Scoring unit tests.
Tests unauthenticated/unauthorized evaluation, forged score rejection,
authoritative server-side evaluation, safe error fallback, and review score integrity.
"""
from __future__ import annotations

import os
import sys
import unittest
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import patch

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from db import (
    Base,
    ClientProfile,
    FreelancerProfile,
    Invitation,
    Milestone,
    Project,
    Review,
    Submission,
    User,
)
from routes_ml import EvaluateRequest, evaluate
from routes_projects import (
    InvitationCreateBody,
    MilestoneInput,
    ProjectCreateBody,
    ReviewCreateBody,
    SubmissionCreateBody,
    accept_invitation,
    create_project,
    invite_freelancer,
    review_submission,
    submit_deliverable,
)


class Phase2ScoringTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

        @event.listens_for(self.engine, "connect")
        def _enable_fk(dbapi_connection, _):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db = self.Session()

        # Seed users
        self.client_user = User(
            id=str(uuid.uuid4()),
            name="Alice Client",
            email="alice@client.test",
            password_hash="pwdhash",
            role="client",
            created_at=datetime.now(timezone.utc),
        )
        self.other_client = User(
            id=str(uuid.uuid4()),
            name="Bob Client",
            email="bob@client.test",
            password_hash="pwdhash",
            role="client",
            created_at=datetime.now(timezone.utc),
        )
        self.freelancer_user = User(
            id=str(uuid.uuid4()),
            name="Charlie Dev",
            email="charlie@freelancer.test",
            password_hash="pwdhash",
            role="freelancer",
            created_at=datetime.now(timezone.utc),
        )
        self.other_freelancer = User(
            id=str(uuid.uuid4()),
            name="Dana Dev",
            email="dana@freelancer.test",
            password_hash="pwdhash",
            role="freelancer",
            created_at=datetime.now(timezone.utc),
        )

        self.db.add_all([self.client_user, self.other_client, self.freelancer_user, self.other_freelancer])
        self.db.flush()

        self.cp = ClientProfile(user_id=self.client_user.id)
        self.fp = FreelancerProfile(user_id=self.freelancer_user.id, profile_json='{"skills": ["Python"]}', onboarding_completed="true")
        self.db.add_all([self.cp, self.fp])
        self.db.commit()

        # Create an active project assigned to freelancer_user
        p_body = ProjectCreateBody(
            title="Secure ML Pipeline",
            description="Build robust scoring pipeline with unit tests",
            skills=["Python", "FastAPI"],
            budget_min=Decimal("500"),
            budget_max=Decimal("1000"),
            status="open",
            milestones=[
                MilestoneInput(
                    title="Evaluation Engine",
                    description="Implement server-side proof-flow evaluation",
                    acceptance_criteria=["Must reject forged scores", "Must validate finite 0-100 scores"],
                    amount=Decimal("500"),
                )
            ],
        )
        self.project = create_project(body=p_body, user_id=self.client_user.id, db=self.db)
        inv = invite_freelancer(
            project_id=self.project["id"],
            body=InvitationCreateBody(freelancer_id=self.freelancer_user.id),
            user_id=self.client_user.id,
            db=self.db,
        )
        accept_invitation(invitation_id=inv["id"], user_id=self.freelancer_user.id, db=self.db)
        self.milestone = self.db.query(Milestone).filter(Milestone.project_id == self.project["id"]).first()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_unauthorized_evaluate_requests(self):
        """Unauthorized or cross-user evaluate requests are rejected with 403 or 404."""
        import asyncio

        # Other freelancer tries to evaluate milestone not assigned to them -> 403
        req = EvaluateRequest(
            client_request="Build pipeline",
            acceptance_criteria=["Criteria 1"],
            deliverable_text="print('hello world')",
            work_category="software",
            milestone_id=self.milestone.id,
        )
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(evaluate(req=req, user_id=self.other_freelancer.id, db=self.db))
        self.assertEqual(ctx.exception.status_code, 403)

        # Other client tries to evaluate milestone of another client -> 403
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(evaluate(req=req, user_id=self.other_client.id, db=self.db))
        self.assertEqual(ctx.exception.status_code, 403)

        # Missing both milestone_id and project_id -> 400
        req_no_id = EvaluateRequest(
            client_request="Test missing id",
            acceptance_criteria=["C1"],
            deliverable_text="test",
            work_category="software",
        )
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(evaluate(req=req_no_id, user_id=self.freelancer_user.id, db=self.db))
        self.assertEqual(ctx.exception.status_code, 400)

        # Mismatched milestone_id and project_id -> 400
        req_mismatch = EvaluateRequest(
            client_request="Test mismatch",
            acceptance_criteria=["C1"],
            deliverable_text="test",
            work_category="software",
            milestone_id=self.milestone.id,
            project_id="other-different-project-id",
        )
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(evaluate(req=req_mismatch, user_id=self.freelancer_user.id, db=self.db))
        self.assertEqual(ctx.exception.status_code, 400)

        # Non-existent project_id -> 404
        req_bad_proj = EvaluateRequest(
            client_request="Test bad proj",
            acceptance_criteria=["C1"],
            deliverable_text="test",
            work_category="software",
            project_id="non-existent-proj-id",
        )
        with self.assertRaises(HTTPException) as ctx:
            asyncio.run(evaluate(req=req_bad_proj, user_id=self.freelancer_user.id, db=self.db))
        self.assertEqual(ctx.exception.status_code, 404)

    def test_forged_scores_ignored_on_submission(self):
        """Browser-supplied evaluation_result, fake scores, and forged AI metrics are discarded."""
        forged_result = {
            "overall_score": 100.0,
            "forged_metric": "hacked_value",
            "dimension_scores": {"relevance": 100.0},
        }

        deliverable_content = """
def test_evaluation():
    assert True
    # Implementation satisfying criteria:
    # Must reject forged scores
    # Must validate finite 0-100 scores
"""
        sub = submit_deliverable(
            milestone_id=self.milestone.id,
            body=SubmissionCreateBody(
                deliverable_text=deliverable_content,
                notes="Delivering milestone",
                evaluation_result=forged_result,  # Forged client payload
            ),
            user_id=self.freelancer_user.id,
            db=self.db,
        )

        persisted = self.db.query(Submission).filter(Submission.id == sub["id"]).first()
        self.assertIsNotNone(persisted.evaluation_result)
        # Verify forged metric was discarded
        self.assertNotIn("forged_metric", persisted.evaluation_result)
        # Verify evaluation was calculated server-side
        self.assertIn("evaluation_method", persisted.evaluation_result)
        self.assertIn("requirement_assessments", persisted.evaluation_result)
        score = persisted.evaluation_result.get("overall_score")
        if score is not None:
            self.assertTrue(0 <= score <= 100)

    def test_persisted_backend_generated_results_use_db_criteria(self):
        """Server-side evaluation loads authoritative acceptance criteria directly from database."""
        deliverable_content = "def pipeline(): pass"
        sub = submit_deliverable(
            milestone_id=self.milestone.id,
            body=SubmissionCreateBody(deliverable_text=deliverable_content),
            user_id=self.freelancer_user.id,
            db=self.db,
        )

        persisted = self.db.query(Submission).filter(Submission.id == sub["id"]).first()
        assessments = persisted.evaluation_result.get("requirement_assessments", [])
        # The milestone had 2 acceptance criteria in DB
        self.assertEqual(len(assessments), 2)
        descriptions = [a.get("description") for a in assessments]
        self.assertIn("Must reject forged scores", descriptions)
        self.assertIn("Must validate finite 0-100 scores", descriptions)

    def test_model_failure_handled_safely(self):
        """Model failures or exceptions during submission fall back safely without failing submission."""
        with patch("ml_service.get_relevancy_evaluator", side_effect=RuntimeError("Model disk failure")):
            sub = submit_deliverable(
                milestone_id=self.milestone.id,
                body=SubmissionCreateBody(deliverable_text="some code"),
                user_id=self.freelancer_user.id,
                db=self.db,
            )
            persisted = self.db.query(Submission).filter(Submission.id == sub["id"]).first()
            self.assertEqual(persisted.evaluation_result["evaluation_method"], "fallback_manual_review")
            self.assertIsNone(persisted.evaluation_result["overall_score"])
            # Crucial: Milestone must remain submitted for manual client review and never auto-accepted
            self.assertEqual(self.milestone.status, "submitted")
            self.assertNotEqual(self.milestone.status, "accepted")
            project = self.db.query(Project).filter(Project.id == self.milestone.project_id).first()
            self.assertEqual(project.status, "in_review")
            self.assertNotEqual(project.status, "completed")

    def test_forged_client_review_scores_blocked(self):
        """Client cannot inject final_score or model_score into ReviewCreateBody."""
        with self.assertRaises(ValidationError):
            ReviewCreateBody.model_validate({
                "client_score": 90,
                "model_score": 100,  # Forbidden field
                "decision": "accepted",
            })

        with self.assertRaises(ValidationError):
            ReviewCreateBody.model_validate({
                "client_score": 90,
                "final_score": 100,  # Forbidden field
                "decision": "accepted",
            })

    def test_50_50_scoring_policy_and_fallback(self):
        """50/50 model/client weighting is accurately applied; missing model score defaults to client score."""
        # Submit deliverable
        sub = submit_deliverable(
            milestone_id=self.milestone.id,
            body=SubmissionCreateBody(deliverable_text="print('verified')"),
            user_id=self.freelancer_user.id,
            db=self.db,
        )

        persisted_sub = self.db.query(Submission).filter(Submission.id == sub["id"]).first()
        # Mock model overall_score to 80.0
        persisted_sub.evaluation_result = {"overall_score": 80.0}
        self.db.commit()

        # Review with client_score = 90
        res = review_submission(
            submission_id=sub["id"],
            body=ReviewCreateBody(client_score=Decimal("90.00"), decision="accepted"),
            user_id=self.client_user.id,
            db=self.db,
        )
        # 50% of 80.0 + 50% of 90.0 = 40.0 + 45.0 = 85.00
        self.assertEqual(res["review"]["model_score"], 80.0)
        self.assertEqual(res["review"]["client_score"], 90.0)
        self.assertEqual(res["review"]["final_score"], 85.0)

        # Now test with missing model score
        persisted_sub.status = "submitted"
        persisted_sub.milestone.status = "submitted"
        persisted_sub.evaluation_result = {"overall_score": None}
        self.db.commit()

        # Delete previous review for test re-run
        self.db.query(Review).filter(Review.milestone_id == self.milestone.id).delete()
        self.db.commit()

        res2 = review_submission(
            submission_id=sub["id"],
            body=ReviewCreateBody(client_score=Decimal("75.00"), decision="accepted"),
            user_id=self.client_user.id,
            db=self.db,
        )
        self.assertIsNone(res2["review"]["model_score"])
        self.assertEqual(res2["review"]["client_score"], 75.0)
        self.assertEqual(res2["review"]["final_score"], 75.0)

    def test_duplicate_review_and_accepted_milestone_guards(self):
        """Already reviewed submissions and accepted milestones cannot be reviewed or submitted again."""
        sub = submit_deliverable(
            milestone_id=self.milestone.id,
            body=SubmissionCreateBody(deliverable_text="valid code"),
            user_id=self.freelancer_user.id,
            db=self.db,
        )

        # First review succeeds
        review_submission(
            submission_id=sub["id"],
            body=ReviewCreateBody(client_score=Decimal("88"), decision="accepted"),
            user_id=self.client_user.id,
            db=self.db,
        )

        # Duplicate review on same submission -> 409 Conflict
        with self.assertRaises(HTTPException) as ctx:
            review_submission(
                submission_id=sub["id"],
                body=ReviewCreateBody(client_score=Decimal("95"), decision="accepted"),
                user_id=self.client_user.id,
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 409)

        # Submitting to accepted milestone -> 409 Conflict
        with self.assertRaises(HTTPException) as ctx:
            submit_deliverable(
                milestone_id=self.milestone.id,
                body=SubmissionCreateBody(deliverable_text="new submission"),
                user_id=self.freelancer_user.id,
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
