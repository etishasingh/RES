"""Create idempotent fictional PayPilot demo accounts.

Requires DEMO_PASSWORD in the environment. The password is never displayed.
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import date, datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

demo_password = os.environ.get("DEMO_PASSWORD", "").strip()
if not demo_password:
    sys.exit("ERROR: DEMO_PASSWORD is not set; refusing to seed.")

from passlib.context import CryptContext

from db import (
    ClientProfile,
    FreelancerProfile,
    ImpactContribution,
    ImpactFundTransaction,
    Invitation,
    Milestone,
    Payment,
    Project,
    Review,
    SessionLocal,
    SpotlightPurchase,
    Submission,
    User,
    create_tables,
)

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

DEMO_FREELANCERS = [
    ("Elena Vance", "elena@demo.paypilot", "Editorial designer for digital publications", ["Figma", "Editorial Design", "TypeScript"], "intermediate", "available", 55, "Bengaluru"),
    ("Mira Solen", "mira@demo.paypilot", "Product designer for early-stage teams", ["Product Design", "Figma", "User Research"], "senior", "limited", 75, "Pune"),
    ("Dev Arlen", "dev@demo.paypilot", "Full-stack web developer", ["React", "Python", "PostgreSQL"], "senior", "available", 70, "Hyderabad"),
    ("Niko Hart", "niko@demo.paypilot", "Brand and motion designer", ["Brand Strategy", "After Effects", "Illustration"], "intermediate", "unavailable", 50, "Kochi"),
    ("Rhea Quill", "rhea@demo.paypilot", "Content strategist for B2B products", ["Content Strategy", "SEO", "Copywriting"], "senior", "available", 65, "Mumbai"),
    ("Ishan Vale", "ishan@demo.paypilot", "Mobile app engineer", ["React Native", "JavaScript", "API Integration"], "intermediate", "limited", 60, "Chennai"),
    ("Tara Wynn", "tara@demo.paypilot", "Data visualization specialist", ["Data Visualization", "Python", "Tableau"], "senior", "available", 80, "Delhi"),
    ("Oren Dusk", "oren@demo.paypilot", "UX writer for software products", ["UX Writing", "Content Design", "Information Architecture"], "intermediate", "available", 45, "Jaipur"),
]

DEMO_CLIENTS = [
    ("Morgan Lee", "client@demo.paypilot", "Acme Lantern", "Education technology", "https://acme-lantern.example", "Bengaluru", "A fictional team creating practical learning tools."),
    ("Priya North", "priya@demo.paypilot", "Northwind Studio", "Retail design", "https://northwind-studio.example", "Mumbai", "A fictional studio preparing a storefront redesign."),
    ("Samir Coast", "samir@demo.paypilot", "Coastline Labs", "Climate software", "https://coastline-labs.example", "Chennai", "A fictional product team building tools for field researchers."),
]


def _upsert_freelancer(db, record) -> None:
    name, email, headline, skills, level, availability, rate, location = record
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=str(uuid.uuid4()), name=name, email=email,
            password_hash=pwd_ctx.hash(demo_password), role="freelancer",
            created_at=datetime.now(timezone.utc),
        )
        db.add(user)
    user.name = name
    user.role = "freelancer"
    user.headline = headline
    profile_data = {
        "skills": skills,
        "experience_level": level,
        "availability_status": availability,
        "hourly_rate": rate,
        "location": location,
        "bio": f"Fictional demo freelancer specializing in {skills[0].lower()}.",
    }
    profile = db.query(FreelancerProfile).filter(FreelancerProfile.user_id == user.id).first()
    if not profile:
        profile = FreelancerProfile(user_id=user.id, onboarding_completed="true")
        db.add(profile)
    profile.set_profile(profile_data)
    profile.onboarding_completed = "true"


def _upsert_client(db, record) -> None:
    name, email, organization, industry, website, location, about = record
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            id=str(uuid.uuid4()), name=name, email=email,
            password_hash=pwd_ctx.hash(demo_password), role="client",
            created_at=datetime.now(timezone.utc),
        )
        db.add(user)
    user.name = name
    user.role = "client"
    user.organization = organization
    profile = db.query(ClientProfile).filter(ClientProfile.user_id == user.id).first()
    if not profile:
        profile = ClientProfile(user_id=user.id)
        db.add(profile)
    profile.industry = industry
    profile.website = website
    profile.location = location
    profile.about = about


def _seed_demo_workflow(db) -> None:
    """Seed sample projects, milestones, submissions, client star reviews, payments, and Impact/Spotlight records."""
    client = db.query(User).filter(User.email == "client@demo.paypilot").first()
    elena = db.query(User).filter(User.email == "elena@demo.paypilot").first()
    dev = db.query(User).filter(User.email == "dev@demo.paypilot").first()
    mira = db.query(User).filter(User.email == "mira@demo.paypilot").first()
    if not client or not elena:
        return

    # Skip if demo projects already exist for client@demo.paypilot (preserves existing pre-seeded DB state).
    existing_projects = db.query(Project).filter(Project.client_id == client.id).count()
    if existing_projects > 0:
        return

    now = datetime.now(timezone.utc)

    # 1. Completed project with accepted/paid milestones & client star reviews
    p1 = Project(
        id=str(uuid.uuid4()),
        client_id=client.id,
        freelancer_id=elena.id,
        title="Editorial Design System for Longform Magazine",
        description="Comprehensive editorial typography, modular layout templates, and Figma component tokens.",
        skills=["Figma", "Editorial Design", "TypeScript"],
        budget_min=3600,
        budget_max=3600,
        currency="USD",
        pricing_type="fixed",
        status="completed",
        created_at=now - timedelta(days=14),
        updated_at=now - timedelta(days=2),
    )
    db.add(p1)
    db.flush()

    db.add(Invitation(
        id=str(uuid.uuid4()), project_id=p1.id, client_id=client.id,
        freelancer_id=elena.id, status="accepted",
    ))

    p1_m1 = Milestone(
        id=str(uuid.uuid4()), project_id=p1.id,
        title="Phase 1: Typographic Scale & Tokens",
        acceptance_criteria=["Modular type scale defined", "Figma token library published"],
        amount=1200, status="paid", due_date=date.today() - timedelta(days=7),
    )
    p1_m2 = Milestone(
        id=str(uuid.uuid4()), project_id=p1.id,
        title="Phase 2: Grid Templates & Handoff",
        acceptance_criteria=["Responsive article layouts", "Accessible color contrast checks"],
        amount=2400, status="accepted", due_date=date.today() - timedelta(days=2),
    )
    db.add_all([p1_m1, p1_m2])
    db.flush()

    eval_p1_m1 = {"overall_score": 88.0, "dimension_scores": {"relevance": 90.0, "completeness": 92.0, "technical_quality": 82.0}}
    eval_p1_m2 = {"overall_score": 91.0, "dimension_scores": {"relevance": 93.0, "completeness": 95.0, "technical_quality": 85.0}}
    db.add_all([
        Submission(
            id=str(uuid.uuid4()), milestone_id=p1_m1.id, freelancer_id=elena.id,
            deliverable_text="Published editorial typographic scale and Figma design tokens.",
            notes="Delivered token JSON and Figma style guide.", evaluation_result=eval_p1_m1,
            status="accepted", submitted_at=now - timedelta(days=8),
        ),
        Submission(
            id=str(uuid.uuid4()), milestone_id=p1_m2.id, freelancer_id=elena.id,
            deliverable_text="Completed responsive article grid templates and WCAG AA contrast audit.",
            notes="Ready for final review and PayPal Sandbox release.", evaluation_result=eval_p1_m2,
            status="accepted", submitted_at=now - timedelta(days=3),
        ),
        Review(
            id=str(uuid.uuid4()), project_id=p1.id, milestone_id=p1_m1.id,
            client_id=client.id, freelancer_id=elena.id,
            client_score=96, model_score=88.0, final_score=92.0,
            feedback="Crisp typography hierarchy and clean token handoff.",
            evaluation_result=eval_p1_m1,
        ),
        Review(
            id=str(uuid.uuid4()), project_id=p1.id, milestone_id=p1_m2.id,
            client_id=client.id, freelancer_id=elena.id,
            client_score=98, model_score=91.0, final_score=94.5,
            feedback="Outstanding layout precision and accessibility documentation.",
            evaluation_result=eval_p1_m2,
        ),
    ])

    # Demo Sandbox payment + Impact allocation for p1_m1
    demo_pay_id = str(uuid.uuid4())
    db.add(Payment(
        id=demo_pay_id, project_id=p1.id, milestone_id=p1_m1.id,
        client_id=client.id, freelancer_id=elena.id,
        amount=1200, currency="USD", provider="paypal_sandbox",
        paypal_order_id=f"DEMO-ORDER-{uuid.uuid4().hex[:10].upper()}",
        paypal_capture_id=f"DEMO-CAPTURE-{uuid.uuid4().hex[:10].upper()}",
        status="paid_sandbox", paid_at=now - timedelta(days=6),
    ))
    db.add(ImpactFundTransaction(
        id=str(uuid.uuid4()), source_type="platform_fee", source_transaction_id=demo_pay_id,
        user_id=client.id, gross_amount_cents=120000, platform_revenue_cents=6000,
        allocated_amount_cents=1800, currency="USD", allocation_percentage=30.0,
        status="allocated", notes="Demo platform fee allocation from milestone payment",
    ))
    db.add(ImpactContribution(
        id=str(uuid.uuid4()), user_id=client.id, source_type="platform_fee",
        source_transaction_id=demo_pay_id, amount_cents=1800, currency="USD", status="verified",
    ))

    # 2. Second completed project for client history & freelancer ratings
    if dev:
        p2 = Project(
            id=str(uuid.uuid4()),
            client_id=client.id,
            freelancer_id=dev.id,
            title="Freelancer Payments Dashboard UI",
            description="Responsive payments ledger and milestone checkout interface built with React and TypeScript.",
            skills=["React", "TypeScript", "PostgreSQL"],
            budget_min=2800,
            budget_max=2800,
            currency="USD",
            pricing_type="fixed",
            status="completed",
            created_at=now - timedelta(days=20),
            updated_at=now - timedelta(days=10),
        )
        db.add(p2)
        db.flush()
        p2_m1 = Milestone(
            id=str(uuid.uuid4()), project_id=p2.id,
            title="Ledger Table & PayPal Checkout Integration",
            acceptance_criteria=["Sortable transaction ledger", "PayPal Sandbox capture hook"],
            amount=2800, status="accepted", due_date=date.today() - timedelta(days=10),
        )
        db.add(p2_m1)
        db.flush()
        eval_p2 = {"overall_score": 86.0, "dimension_scores": {"relevance": 89.0, "completeness": 90.0, "technical_quality": 79.0}}
        db.add_all([
            Submission(
                id=str(uuid.uuid4()), milestone_id=p2_m1.id, freelancer_id=dev.id,
                deliverable_text="Implemented payment ledger UI and milestone checkout modal.",
                notes="All unit tests passing.", evaluation_result=eval_p2, status="accepted",
            ),
            Review(
                id=str(uuid.uuid4()), project_id=p2.id, milestone_id=p2_m1.id,
                client_id=client.id, freelancer_id=dev.id,
                client_score=94, model_score=86.0, final_score=90.0,
                feedback="Reliable React implementation and clear API error handling.",
                evaluation_result=eval_p2,
            ),
        ])

    # 3. Active project with an in-progress milestone and an accepted milestone ready for PayPal Sandbox checkout
    p3 = Project(
        id=str(uuid.uuid4()),
        client_id=client.id,
        freelancer_id=elena.id,
        title="Supply Chain Analytics Dashboard",
        description="Interactive analytics workspace visualizing supplier lead times and milestone SLA metrics.",
        skills=["Figma", "TypeScript", "Editorial Design"],
        budget_min=3200,
        budget_max=3200,
        currency="USD",
        pricing_type="fixed",
        status="active",
        created_at=now - timedelta(days=5),
        updated_at=now,
    )
    db.add(p3)
    db.flush()
    db.add(Invitation(
        id=str(uuid.uuid4()), project_id=p3.id, client_id=client.id,
        freelancer_id=elena.id, status="accepted",
    ))
    p3_m1 = Milestone(
        id=str(uuid.uuid4()), project_id=p3.id,
        title="Phase 1: Information Architecture & KPI Wireframes",
        acceptance_criteria=["Executive overview wireframe", "Filter state flows"],
        amount=1400, status="accepted", due_date=date.today() + timedelta(days=3),
    )
    p3_m2 = Milestone(
        id=str(uuid.uuid4()), project_id=p3.id,
        title="Phase 2: Interactive Chart Components",
        acceptance_criteria=["Responsive SVG charts", "CSV export support"],
        amount=1800, status="in_progress", due_date=date.today() + timedelta(days=12),
    )
    db.add_all([p3_m1, p3_m2])

    # 4. Open project (with Spotlight boost) for discovery & invitations
    p4 = Project(
        id=str(uuid.uuid4()),
        client_id=client.id,
        freelancer_id=None,
        title="Figma-to-TypeScript Design Handoff Toolkit",
        description="CLI and UI previewer converting Figma design tokens into typed Tailwind and CSS variables.",
        skills=["Figma", "TypeScript", "Editorial Design"],
        budget_min=2200,
        budget_max=2600,
        currency="USD",
        pricing_type="fixed",
        status="open",
        created_at=now - timedelta(days=1),
        updated_at=now,
    )
    db.add(p4)
    db.flush()

    if mira:
        db.add(Invitation(
            id=str(uuid.uuid4()), project_id=p4.id, client_id=client.id,
            freelancer_id=mira.id, status="pending",
        ))

    db.add(SpotlightPurchase(
        id=str(uuid.uuid4()), user_id=client.id, target_type="project", target_id=p4.id,
        package_id="pkg_featured", amount_cents=4900, currency="USD",
        payment_status="COMPLETED", payment_reference=f"DEMO-SPOTLIGHT-{uuid.uuid4().hex[:8].upper()}",
        purchased_at=now, starts_at=now, expires_at=now + timedelta(days=7),
    ))


def seed() -> None:
    create_tables()
    db = SessionLocal()
    try:
        for record in DEMO_FREELANCERS:
            _upsert_freelancer(db, record)
        for record in DEMO_CLIENTS:
            _upsert_client(db, record)
        db.flush()
        _seed_demo_workflow(db)
        db.commit()
        print("Seeded demo freelancers, clients, projects, milestones, and client reviews.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
