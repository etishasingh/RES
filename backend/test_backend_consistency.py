"""
PayPilot AI – Backend consistency, schema, and authorization tests.
Runs against an in-memory SQLite database to guarantee total isolation from paypilot.db.
"""
from __future__ import annotations

import os
import sys
import unittest
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal

# Ensure backend directory is in path
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from db import (
    Base,
    ClientProfile,
    FreelancerProfile,
    Invitation,
    Milestone,
    Project,
    ProjectRequest,
    Review,
    Submission,
    User,
)
from routes_projects import (
    InvitationCreateBody,
    MilestoneInput,
    ProjectCreateBody,
    ProjectRequestBody,
    ProjectUpdateBody,
    ReviewCreateBody,
    SubmissionCreateBody,
    accept_invitation,
    accept_project_request,
    create_project,
    decline_invitation,
    decline_project_request,
    get_my_project_request,
    get_project,
    invite_freelancer,
    list_incoming_requests,
    list_my_requests,
    list_project_submissions,
    request_to_work_on_project,
    review_submission,
    submit_deliverable,
    update_project,
)


class BackendConsistencyTests(unittest.TestCase):
    def setUp(self):
        # In-memory SQLite with foreign keys enabled
        self.engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})

        @event.listens_for(self.engine, "connect")
        def _enable_fk(dbapi_connection, _):
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine, autoflush=False, autocommit=False)
        self.db = self.Session()

        # Seed test users
        self.client_user = User(
            id=str(uuid.uuid4()),
            name="Alice Client",
            email="client@test.com",
            password_hash="fakehash",
            role="client",
            created_at=datetime.now(timezone.utc),
        )
        self.client_user2 = User(
            id=str(uuid.uuid4()),
            name="Bob Client",
            email="client2@test.com",
            password_hash="fakehash",
            role="client",
            created_at=datetime.now(timezone.utc),
        )
        self.freelancer_user = User(
            id=str(uuid.uuid4()),
            name="Charlie Dev",
            email="dev@test.com",
            password_hash="fakehash",
            role="freelancer",
            created_at=datetime.now(timezone.utc),
        )
        self.freelancer_user2 = User(
            id=str(uuid.uuid4()),
            name="Dana Dev",
            email="dana@test.com",
            password_hash="fakehash",
            role="freelancer",
            created_at=datetime.now(timezone.utc),
        )

        self.db.add_all([self.client_user, self.client_user2, self.freelancer_user, self.freelancer_user2])
        self.db.flush()

        # Role profiles
        self.cp = ClientProfile(user_id=self.client_user.id, about="Client test about")
        self.fp = FreelancerProfile(user_id=self.freelancer_user.id, profile_json='{"skills": ["Python"]}', onboarding_completed="true")
        self.db.add_all([self.cp, self.fp])
        self.db.commit()

    def tearDown(self):
        self.db.close()
        Base.metadata.drop_all(bind=self.engine)

    def test_orm_relationships_and_foreign_keys(self):
        """User and profiles bidirectional relationships work seamlessly."""
        u_freelancer = self.db.query(User).filter(User.id == self.freelancer_user.id).first()
        self.assertIsNotNone(u_freelancer.freelancer_profile)
        self.assertEqual(u_freelancer.freelancer_profile.user.id, u_freelancer.id)

        u_client = self.db.query(User).filter(User.id == self.client_user.id).first()
        self.assertIsNotNone(u_client.client_profile)
        self.assertEqual(u_client.client_profile.user.id, u_client.id)

    def test_project_creation_transactional(self):
        """Project and milestones are created together transactionally."""
        body = ProjectCreateBody(
            title="API Revamp",
            description="Fix backend consistency",
            skills=["FastAPI", "SQLAlchemy"],
            budget_min=Decimal("500"),
            budget_max=Decimal("1000"),
            pricing_type="fixed",
            status="open",
            milestones=[
                MilestoneInput(title="M1", description="Part 1", amount=Decimal("400"), due_date=date(2026, 11, 1)),
                MilestoneInput(title="M2", description="Part 2", amount=Decimal("600"), due_date=None),
            ],
        )
        res = create_project(body=body, user_id=self.client_user.id, db=self.db)
        self.assertEqual(res["title"], "API Revamp")
        self.assertEqual(len(res["milestones"]), 2)
        self.assertEqual(res["client_id"], self.client_user.id)

        # MilestoneInput validation: empty date string converted to None
        m_input = MilestoneInput(title=" M3 ", amount=Decimal("100"), due_date="")
        self.assertIsNone(m_input.due_date)
        self.assertEqual(m_input.title, "M3")

    def test_project_ownership_and_authorization(self):
        """Clients can only modify own projects; unauthorized access returns 404."""
        body = ProjectCreateBody(title="Client1 Project", description="Secret project", status="draft")
        p = create_project(body=body, user_id=self.client_user.id, db=self.db)

        # Client 2 tries to access Client 1's draft project -> 404
        with self.assertRaises(HTTPException) as ctx:
            get_project(project_id=p["id"], user_id=self.client_user2.id, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

        # Client 2 tries to update Client 1's project -> 404
        with self.assertRaises(HTTPException) as ctx:
            update_project(project_id=p["id"], body=ProjectUpdateBody(title="Hacked"), user_id=self.client_user2.id, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

        # Freelancer tries to access draft project -> 404
        with self.assertRaises(HTTPException) as ctx:
            get_project(project_id=p["id"], user_id=self.freelancer_user.id, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

    def test_invitation_lifecycle_and_reactivation(self):
        """Invitations can be sent, declined, reactivated without unique constraint violation."""
        # Create open project
        p_body = ProjectCreateBody(
            title="Design System",
            description="Build design system",
            status="open",
            milestones=[MilestoneInput(title="Step 1", amount=Decimal("500"))],
        )
        p = create_project(body=p_body, user_id=self.client_user.id, db=self.db)
        proj_id = p["id"]

        # Invite freelancer
        inv = invite_freelancer(
            project_id=proj_id,
            body=InvitationCreateBody(freelancer_id=self.freelancer_user.id),
            user_id=self.client_user.id,
            db=self.db,
        )
        self.assertEqual(inv["status"], "pending")

        # Invited freelancer can now view the project
        proj_view = get_project(project_id=proj_id, user_id=self.freelancer_user.id, db=self.db)
        self.assertEqual(proj_view["title"], "Design System")

        # Freelancer declines invitation
        declined = decline_invitation(invitation_id=inv["id"], user_id=self.freelancer_user.id, db=self.db)
        self.assertEqual(declined["status"], "declined")

        # Project status reverted to "open" because no pending invitations remain
        proj = self.db.query(Project).filter(Project.id == proj_id).first()
        self.assertEqual(proj.status, "open")

        # Client can re-invite freelancer without violating unique constraint
        re_inv = invite_freelancer(
            project_id=proj_id,
            body=InvitationCreateBody(freelancer_id=self.freelancer_user.id),
            user_id=self.client_user.id,
            db=self.db,
        )
        self.assertEqual(re_inv["id"], inv["id"])
        self.assertEqual(re_inv["status"], "pending")

        # Freelancer accepts invitation
        accepted = accept_invitation(invitation_id=re_inv["id"], user_id=self.freelancer_user.id, db=self.db)
        self.assertEqual(accepted["status"], "accepted")

        # Project is now active and first milestone is in_progress
        proj = self.db.query(Project).filter(Project.id == proj_id).first()
        self.assertEqual(proj.status, "active")
        self.assertEqual(proj.freelancer_id, self.freelancer_user.id)
        self.assertEqual(proj.milestones[0].status, "in_progress")

    def test_milestone_submission_and_multi_milestone_review(self):
        """Multi-milestone project advances milestones and correctly computes final scores."""
        # Create project with 2 milestones
        p_body = ProjectCreateBody(
            title="Backend Integration",
            description="Two milestone project",
            status="open",
            milestones=[
                MilestoneInput(title="M1", amount=Decimal("300")),
                MilestoneInput(title="M2", amount=Decimal("700")),
            ],
        )
        p = create_project(body=p_body, user_id=self.client_user.id, db=self.db)
        proj_id = p["id"]

        # Invite and accept
        inv = invite_freelancer(
            project_id=proj_id,
            body=InvitationCreateBody(freelancer_id=self.freelancer_user.id),
            user_id=self.client_user.id,
            db=self.db,
        )
        accept_invitation(invitation_id=inv["id"], user_id=self.freelancer_user.id, db=self.db)

        proj = self.db.query(Project).filter(Project.id == proj_id).first()
        m1 = proj.milestones[0]
        m2 = proj.milestones[1]

        # Freelancer submits M1
        sub_res = submit_deliverable(
            milestone_id=m1.id,
            body=SubmissionCreateBody(
                deliverable_text="Completed code for M1",
                notes="Ready for review",
                evaluation_result={"overall_score": 90},
            ),
            user_id=self.freelancer_user.id,
            db=self.db,
        )
        self.assertEqual(sub_res["status"], "submitted")
        self.assertEqual(m1.status, "submitted")
        self.assertEqual(proj.status, "in_review")

        # Freelancer can view their submissions via list_project_submissions
        submissions = list_project_submissions(project_id=proj_id, user_id=self.freelancer_user.id, db=self.db)
        self.assertEqual(len(submissions), 1)

        # Client reviews and accepts M1
        review_res = review_submission(
            submission_id=sub_res["id"],
            body=ReviewCreateBody(client_score=Decimal("94"), decision="accepted", feedback="Great job"),
            user_id=self.client_user.id,
            db=self.db,
        )
        # Final score = 50% server model score + 50% client (94)
        expected_final = round((float(sub_res["evaluation_result"]["overall_score"]) + 94.0) / 2.0, 2)
        self.assertEqual(review_res["review"]["final_score"], expected_final)
        self.assertEqual(m1.status, "accepted")

        # Crucial bug fix check: project status is "active" (NOT "in_review" or "completed")
        # and next milestone (M2) automatically became "in_progress"!
        self.assertEqual(proj.status, "active")
        self.assertEqual(m2.status, "in_progress")

        # Cannot re-submit deliverable for accepted M1
        with self.assertRaises(HTTPException) as ctx:
            submit_deliverable(
                milestone_id=m1.id,
                body=SubmissionCreateBody(deliverable_text="Duplicate"),
                user_id=self.freelancer_user.id,
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 409)

        # Freelancer submits M2
        sub_m2 = submit_deliverable(
            milestone_id=m2.id,
            body=SubmissionCreateBody(deliverable_text="M2 final delivery"),
            user_id=self.freelancer_user.id,
            db=self.db,
        )

        # Client accepts M2 -> Now all milestones are accepted, project is completed!
        review_m2 = review_submission(
            submission_id=sub_m2["id"],
            body=ReviewCreateBody(client_score=Decimal("98"), decision="accepted"),
            user_id=self.client_user.id,
            db=self.db,
        )
        self.assertEqual(proj.status, "completed")
        self.assertEqual(m2.status, "accepted")

        # Cannot modify a completed project
        with self.assertRaises(HTTPException) as ctx:
            update_project(project_id=proj_id, body=ProjectUpdateBody(title="Modify Done"), user_id=self.client_user.id, db=self.db)
        self.assertEqual(ctx.exception.status_code, 409)

    def test_schema_validations(self):
        """Validation guards prevent invalid budget ranges and empty titles."""
        # budget_max < budget_min
        with self.assertRaises(ValueError):
            ProjectCreateBody(
                title="Bad Budget",
                description="desc",
                budget_min=Decimal("500"),
                budget_max=Decimal("200"),
            )

        # Blank title
        with self.assertRaises(ValueError):
            ProjectCreateBody(
                title="   ",
                description="desc",
            )

        # Empty milestone title
        with self.assertRaises(ValueError):
            MilestoneInput(title="  ", amount=Decimal("100"))

    def test_project_cancellation_cascade(self):
        """Cancelling a project cascades cancellation to pending invitations and unaccepted milestones."""
        p_body = ProjectCreateBody(
            title="Cancelled Project",
            description="Testing cancellation",
            status="open",
            milestones=[MilestoneInput(title="M1", amount=Decimal("100"))],
        )
        p = create_project(body=p_body, user_id=self.client_user.id, db=self.db)
        inv = invite_freelancer(
            project_id=p["id"],
            body=InvitationCreateBody(freelancer_id=self.freelancer_user.id),
            user_id=self.client_user.id,
            db=self.db,
        )

        # Cancel the project
        updated = update_project(
            project_id=p["id"],
            body=ProjectUpdateBody(status="cancelled"),
            user_id=self.client_user.id,
            db=self.db,
        )
        self.assertEqual(updated["status"], "cancelled")

        # Verify invitation and milestone are cancelled
        inv_db = self.db.query(Invitation).filter(Invitation.id == inv["id"]).first()
        self.assertEqual(inv_db.status, "cancelled")
        m_db = self.db.query(Milestone).filter(Milestone.project_id == p["id"]).first()
        self.assertEqual(m_db.status, "cancelled")

    def test_user_serialization(self):
        """_user_dict serializes skills and onboardingCompleted consistently."""
        from routes_auth import _user_dict

        f_dict = _user_dict(self.freelancer_user, self.db)
        self.assertEqual(f_dict["skills"], ["Python"])
        self.assertTrue(f_dict["onboardingCompleted"])

        c_dict = _user_dict(self.client_user, self.db)
        self.assertEqual(c_dict["skills"], [])
        self.assertNotIn("onboardingCompleted", c_dict)


    def test_freelancer_project_request_lifecycle(self):
        """Complete workflow test for freelancer project requests: create, duplicate check, client list, isolation, accept, decline."""
        # 1. Client creates an open project
        p_body = ProjectCreateBody(
            title="Open Web Project",
            description="Looking for fullstack support",
            status="open",
            milestones=[MilestoneInput(title="M1", amount=Decimal("500"))],
        )
        p = create_project(body=p_body, user_id=self.client_user.id, db=self.db)
        proj_id = p["id"]

        # Client 2 also creates a project
        p2_body = ProjectCreateBody(
            title="Client 2 Project",
            description="Other client project",
            status="open",
            milestones=[MilestoneInput(title="M1", amount=Decimal("300"))],
        )
        p2 = create_project(body=p2_body, user_id=self.client_user2.id, db=self.db)

        # 2. Freelancer cannot request on client role
        with self.assertRaises(HTTPException) as ctx:
            request_to_work_on_project(project_id=proj_id, user_id=self.client_user.id, db=self.db)
        self.assertEqual(ctx.exception.status_code, 403)

        # 3. Freelancer requests to work on Client 1's project
        req1 = request_to_work_on_project(
            project_id=proj_id,
            body=ProjectRequestBody(message="I would love to help with this!"),
            user_id=self.freelancer_user.id,
            db=self.db,
        )
        self.assertEqual(req1["status"], "pending")
        self.assertEqual(req1["project_id"], proj_id)
        self.assertEqual(req1["freelancer_id"], self.freelancer_user.id)
        self.assertEqual(req1["client_id"], self.client_user.id)

        # 4. Duplicate request from same freelancer for same project fails with 409
        with self.assertRaises(HTTPException) as ctx:
            request_to_work_on_project(
                project_id=proj_id,
                body=ProjectRequestBody(message="Duplicate attempt"),
                user_id=self.freelancer_user.id,
                db=self.db,
            )
        self.assertEqual(ctx.exception.status_code, 409)
        self.assertIn("already submitted", ctx.exception.detail)

        # 5. Freelancer 2 also requests to work on Client 1's project
        req2 = request_to_work_on_project(
            project_id=proj_id,
            body=ProjectRequestBody(message="Freelancer 2 request"),
            user_id=self.freelancer_user2.id,
            db=self.db,
        )
        self.assertEqual(req2["status"], "pending")

        # 6. Check get_my_project_request
        my_req = get_my_project_request(project_id=proj_id, user_id=self.freelancer_user.id, db=self.db)
        self.assertIsNotNone(my_req)
        self.assertEqual(my_req["id"], req1["id"])

        # 7. Check list_incoming_requests: Client 1 sees both requests, Client 2 sees 0
        c1_reqs = list_incoming_requests(user_id=self.client_user.id, db=self.db)
        self.assertEqual(len(c1_reqs), 2)

        c2_reqs = list_incoming_requests(user_id=self.client_user2.id, db=self.db)
        self.assertEqual(len(c2_reqs), 0)

        # 8. Client 2 cannot accept Client 1's request (404 / ownership check)
        with self.assertRaises(HTTPException) as ctx:
            accept_project_request(request_id=req1["id"], user_id=self.client_user2.id, db=self.db)
        self.assertEqual(ctx.exception.status_code, 404)

        # 9. Client 1 declines req2 (Freelancer 2)
        declined_req = decline_project_request(request_id=req2["id"], user_id=self.client_user.id, db=self.db)
        self.assertEqual(declined_req["status"], "declined")

        # Freelancer 2 cannot re-request once declined
        with self.assertRaises(HTTPException) as ctx:
            request_to_work_on_project(project_id=proj_id, user_id=self.freelancer_user2.id, db=self.db)
        self.assertEqual(ctx.exception.status_code, 409)

        # 10. Client 1 accepts req1 (Freelancer 1)
        accepted_req = accept_project_request(request_id=req1["id"], user_id=self.client_user.id, db=self.db)
        self.assertEqual(accepted_req["status"], "accepted")

        # Verify existing invitation was created in pending status and project became 'invited'
        inv_db = self.db.query(Invitation).filter(
            Invitation.project_id == proj_id,
            Invitation.freelancer_id == self.freelancer_user.id,
        ).first()
        self.assertIsNotNone(inv_db)
        self.assertEqual(inv_db.status, "pending")

        proj_db = self.db.query(Project).filter(Project.id == proj_id).first()
        self.assertEqual(proj_db.status, "invited")

        # 11. Freelancer 1 accepts the generated invitation
        accepted_inv = accept_invitation(invitation_id=inv_db.id, user_id=self.freelancer_user.id, db=self.db)
        self.assertEqual(accepted_inv["status"], "accepted")
        self.assertEqual(proj_db.status, "active")
        self.assertEqual(proj_db.freelancer_id, self.freelancer_user.id)

        # 12. Cannot request on an active/assigned project
        with self.assertRaises(HTTPException) as ctx:
            request_to_work_on_project(project_id=proj_id, user_id=self.freelancer_user2.id, db=self.db)
        self.assertEqual(ctx.exception.status_code, 409)


if __name__ == "__main__":
    unittest.main()
