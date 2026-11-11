"""
PayPilot AI – /api/auth routes.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, field_validator
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from auth_utils import COOKIE_NAME, create_token, get_current_user_id
from db import ClientProfile, FreelancerProfile, User, get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------- schemas ----------

class RegisterBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    headline: str | None = None
    organization: str | None = None
    skills: list[str] | None = None

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("Name must be at least 2 characters.")
        return v

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters.")
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be at most 72 UTF-8 bytes.")
        return v

    @field_validator("role")
    @classmethod
    def valid_role(cls, v: str) -> str:
        if v not in ("freelancer", "client"):
            raise ValueError("role must be 'freelancer' or 'client'.")
        return v


class LoginBody(BaseModel):
    email: EmailStr
    password: str


def _user_dict(user: User, db: Session | None = None) -> dict:
    data = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "headline": user.headline,
        "organization": user.organization,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
    }
    if user.role == "freelancer":
        fp = getattr(user, "freelancer_profile", None)
        if fp is None and db is not None:
            fp = db.query(FreelancerProfile).filter(FreelancerProfile.user_id == user.id).first()
        if fp:
            data["onboardingCompleted"] = (fp.onboarding_completed == "true")
            profile_data = fp.get_profile()
            data["skills"] = profile_data.get("skills", [])
        else:
            data["onboardingCompleted"] = False
            data["skills"] = []
    else:
        data["skills"] = []
    return data


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        secure=False,   # set True behind HTTPS in production
        max_age=86400,  # 24h
        path="/",
    )


# ---------- endpoints ----------

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(body: RegisterBody, response: Response, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == body.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An account with this email already exists.")

    try:
        user = User(
            id=str(uuid.uuid4()),
            name=body.name,
            email=body.email,
            password_hash=pwd_ctx.hash(body.password),
            role=body.role,
            headline=body.headline,
            organization=body.organization,
            created_at=datetime.now(timezone.utc),
        )
        db.add(user)
        # ClientProfile has a foreign key to users. Flush the new user before adding
        # either role profile so SQLite's foreign-key checks see its parent row.
        db.flush()

        if body.role == "freelancer":
            import json
            skills = body.skills or []
            profile_data = {
                "skills": skills,
                "skill_proficiency": {s: "Intermediate" for s in skills},
                "headline": body.headline or "",
            }
            fp = FreelancerProfile(
                user_id=user.id,
                profile_json=json.dumps(profile_data),
                onboarding_completed="false",
            )
            db.add(fp)
        else:
            db.add(ClientProfile(user_id=user.id))

        db.commit()
        db.refresh(user)
    except Exception:
        db.rollback()
        raise

    token = create_token(user.id, user.role)
    _set_cookie(response, token)
    return {"user": _user_dict(user, db), "message": "Account created."}


@router.post("/login")
def login(body: LoginBody, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not pwd_ctx.verify(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    token = create_token(user.id, user.role)
    _set_cookie(response, token)
    return {"user": _user_dict(user, db), "message": "Signed in."}


@router.get("/me")
def me(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return {"user": _user_dict(user, db)}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME, path="/")
    return {"message": "Signed out."}
