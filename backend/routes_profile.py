"""
PayPilot AI – /api/profile routes.
"""
from __future__ import annotations

from typing import Literal
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, field_validator
from sqlalchemy.orm import Session

from auth_utils import get_current_user_id
from db import ClientProfile, FreelancerProfile, User, get_db

router = APIRouter(prefix="/api/profile", tags=["profile"])
freelancers_router = APIRouter(prefix="/api", tags=["freelancers"])


class ProfileUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    headline: str | None = None
    skills: list[str] | None = None
    skill_proficiency: dict[str, str] | None = None
    experience_level: str | None = None
    experience_years: float | None = None
    primary_role: str | None = None
    desired_role: str | None = None
    career_goals: list[str] | None = None
    preferred_work_type: list[str] | None = None
    remote_preference: str | None = None
    budget: float | None = None
    available_hours_per_week: float | None = None
    onboarding_completed: bool | None = None
    onboardingCompleted: bool | None = None
    hourly_rate: float | None = None
    availability_status: Literal["available", "limited", "unavailable"] | None = None
    bio: str | None = None
    location: str | None = None
    organization: str | None = None
    industry: str | None = None
    website: str | None = None
    about: str | None = None

    @field_validator("headline", "organization", "industry", "location", "bio", "about")
    @classmethod
    def string_lengths(cls, value: str | None, info) -> str | None:
        if value is None:
            return value
        value = value.strip()
        maximum = {
            "headline": 255,
            "organization": 255,
            "industry": 100,
            "location": 100,
            "bio": 2_000,
            "about": 2_000,
        }[info.field_name]
        if len(value) > maximum:
            raise ValueError(f"{info.field_name} must be at most {maximum} characters.")
        return value

    @field_validator("website")
    @classmethod
    def website_is_http_url(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if len(value) > 2_048:
            raise ValueError("website must be at most 2048 characters.")
        if value:
            parsed = urlparse(value)
            if parsed.scheme not in {"http", "https"} or not parsed.netloc:
                raise ValueError("website must be a valid http(s) URL.")
        return value

    @field_validator("hourly_rate")
    @classmethod
    def hourly_rate_is_valid(cls, value: float | None) -> float | None:
        if value is not None and not 0 <= value <= 1_000_000:
            raise ValueError("hourly_rate must be between 0 and 1000000.")
        return value


class FreelancerDirectoryItem(BaseModel):
    id: str
    name: str
    headline: str
    skills: list[str]
    experience_level: str | None
    availability_status: Literal["available", "limited", "unavailable"] | None
    hourly_rate: float | None
    location: str | None
    rating: float | None
    completed_projects: int


def _client_fields(user: User, profile: ClientProfile | None) -> dict:
    return {
        "organization": user.organization or "",
        "industry": profile.industry if profile else "",
        "website": profile.website if profile else "",
        "location": profile.location if profile else "",
        "about": profile.about if profile else "",
    }


@router.get("/me")
def get_profile(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Current user no longer exists.")

    result = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "headline": user.headline,
        "organization": user.organization,
    }

    if user.role == "freelancer":
        fp = db.query(FreelancerProfile).filter(FreelancerProfile.user_id == user_id).first()
        if fp:
            result["profile"] = fp.get_profile()
            result["onboardingCompleted"] = fp.onboarding_completed == "true"
        else:
            result["profile"] = {}
            result["onboardingCompleted"] = False
    else:
        client_profile = db.query(ClientProfile).filter(ClientProfile.user_id == user_id).first()
        result.update(_client_fields(user, client_profile))

    return result


@router.patch("/me")
def update_profile(
    body: ProfileUpdateBody,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="Current user no longer exists.")

    updates = body.model_dump(exclude_none=True)
    freelancer_fields = {
        "headline", "skills", "skill_proficiency", "experience_level", "experience_years",
        "primary_role", "desired_role", "career_goals", "preferred_work_type",
        "remote_preference", "budget", "available_hours_per_week", "onboarding_completed",
        "onboardingCompleted", "hourly_rate", "availability_status", "bio", "location",
    }
    client_fields = {"organization", "industry", "website", "location", "about"}
    allowed_fields = freelancer_fields if user.role == "freelancer" else client_fields
    invalid_fields = sorted(set(updates) - allowed_fields)
    if invalid_fields:
        raise HTTPException(
            status_code=422,
            detail=f"{user.role} profiles cannot update: {', '.join(invalid_fields)}.",
        )

    if user.role == "client":
        client_profile = db.query(ClientProfile).filter(ClientProfile.user_id == user_id).first()
        if not client_profile:
            client_profile = ClientProfile(user_id=user_id)
            db.add(client_profile)
        if "organization" in updates:
            user.organization = updates["organization"]
        for field in ("industry", "website", "location", "about"):
            if field in updates:
                setattr(client_profile, field, updates[field])
        db.commit()
        return {**_client_fields(user, client_profile), "message": "Profile updated."}

    fp = db.query(FreelancerProfile).filter(FreelancerProfile.user_id == user_id).first()
    if not fp:
        fp = FreelancerProfile(user_id=user_id, profile_json="{}", onboarding_completed="false")
        db.add(fp)

    current = fp.get_profile()
    onboarding_done = updates.pop("onboarding_completed", None)
    if onboarding_done is None:
        onboarding_done = updates.pop("onboardingCompleted", None)
    else:
        updates.pop("onboardingCompleted", None)

    current.update(updates)
    fp.set_profile(current)

    if body.headline is not None:
        user.headline = body.headline

    if onboarding_done is not None:
        fp.onboarding_completed = "true" if onboarding_done else "false"

    db.commit()
    return {"profile": fp.get_profile(), "onboardingCompleted": fp.onboarding_completed == "true", "message": "Profile updated."}


@freelancers_router.get("/freelancers", response_model=list[FreelancerDirectoryItem])
def list_freelancers(
    q: str | None = Query(default=None, max_length=255),
    skill: str | None = Query(default=None, max_length=100),
    availability: Literal["available", "limited", "unavailable"] | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    _: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    results = []
    query_text = q.strip().lower() if q else ""
    skill_text = skill.strip().lower() if skill else ""
    profiles = (
        db.query(FreelancerProfile, User)
        .join(User, User.id == FreelancerProfile.user_id)
        .filter(User.role == "freelancer", FreelancerProfile.onboarding_completed == "true")
        .all()
    )
    for profile, user in profiles:
        data = profile.get_profile()
        skills = data.get("skills") if isinstance(data.get("skills"), list) else []
        normalized_skills = [item for item in skills if isinstance(item, str)]
        headline = user.headline or data.get("headline") or ""
        if query_text and query_text not in user.name.lower() and query_text not in headline.lower():
            continue
        if skill_text and not any(skill_text in item.lower() for item in normalized_skills):
            continue
        if availability and data.get("availability_status") != availability:
            continue
        reviews = [r for r in user.reviews_received if r.final_score is not None or r.client_score is not None]
        if reviews:
            avg_score = sum(float(r.final_score if r.final_score is not None else r.client_score) for r in reviews) / len(reviews)
            rating = round(avg_score / 20.0, 1)
        else:
            rating = None
        completed_count = sum(1 for p in user.freelancer_projects if p.status == "completed")

        results.append({
            "id": user.id,
            "name": user.name,
            "headline": headline,
            "skills": normalized_skills,
            "experience_level": data.get("experience_level"),
            "availability_status": data.get("availability_status"),
            "hourly_rate": data.get("hourly_rate"),
            "location": data.get("location"),
            "rating": rating,
            "completed_projects": completed_count,
        })
        if len(results) >= limit:
            break
    return results
