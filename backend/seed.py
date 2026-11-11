"""Create idempotent fictional PayPilot demo accounts.

Requires DEMO_PASSWORD in the environment. The password is never displayed.
"""
from __future__ import annotations

import os
import sys
import uuid
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

demo_password = os.environ.get("DEMO_PASSWORD", "").strip()
if not demo_password:
    sys.exit("ERROR: DEMO_PASSWORD is not set; refusing to seed.")

from passlib.context import CryptContext

from db import ClientProfile, FreelancerProfile, SessionLocal, User, create_tables

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


def seed() -> None:
    create_tables()
    db = SessionLocal()
    try:
        for record in DEMO_FREELANCERS:
            _upsert_freelancer(db, record)
        for record in DEMO_CLIENTS:
            _upsert_client(db, record)
        db.commit()
        print("Seeded 8 fictional demo freelancers and 3 fictional demo clients.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
