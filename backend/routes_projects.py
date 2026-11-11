"""Project lifecycle API routes."""
from __future__ import annotations

import logging
import math
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy.orm import Session

from auth_utils import get_current_user_id
from db import Invitation, Milestone, Project, ProjectRequest, Review, Submission, User, get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects", tags=["projects"])


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class MilestoneInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10_000)
    acceptance_criteria: list[str] = Field(default_factory=list, max_length=100)
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title cannot be empty or whitespace.")
        return v

    @field_validator("due_date", mode="before")
    @classmethod
    def empty_due_date_to_none(cls, v):
        if v == "" or v is None:
            return None
        return v


class ProjectCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=20_000)
    skills: list[str] = Field(default_factory=list, max_length=100)
    budget_min: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    budget_max: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    hourly_rate: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    currency: str = Field(default="USD", min_length=3, max_length=3)
    pricing_type: Literal["fixed", "hourly", "negotiable"] | None = None
    status: Literal["draft", "open"] = "open"
    milestones: list[MilestoneInput] = Field(default_factory=list, max_length=100)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("title cannot be empty or whitespace.")
        return v

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, v: list[str]) -> list[str]:
        return [s.strip() for s in v if isinstance(s, str) and s.strip()][:100]

    @model_validator(mode="after")
    def budget_range_is_valid(self):
        if self.budget_min is not None and self.budget_max is not None and self.budget_max < self.budget_min:
            raise ValueError("budget_max must be greater than or equal to budget_min.")
        return self


class ProjectUpdateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = Field(default=None, min_length=1, max_length=20_000)
    skills: list[str] | None = Field(default=None, max_length=100)
    budget_min: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    budget_max: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    hourly_rate: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    pricing_type: Literal["fixed", "hourly", "negotiable"] | None = None
    status: Literal["draft", "open", "cancelled"] | None = None

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, v: str | None) -> str | None:
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("title cannot be empty or whitespace.")
        return v

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        return value.upper() if value is not None else value

    @field_validator("skills")
    @classmethod
    def clean_skills(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        return [s.strip() for s in v if isinstance(s, str) and s.strip()][:100]


class InvitationCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    freelancer_id: str


class ProjectRequestBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str | None = Field(default=None, max_length=2000)


class SubmissionCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    deliverable_url: str | None = Field(default=None, max_length=2048)
    deliverable_text: str | None = Field(default=None, max_length=20_000)
    deliverable_metadata: dict | None = None
    notes: str | None = Field(default=None, max_length=10_000)
    evaluation_result: dict | None = None

    @model_validator(mode="after")
    def has_deliverable(self):
        if not self.deliverable_url and not self.deliverable_text:
            raise ValueError("A deliverable_url or deliverable_text is required.")
        return self


class ReviewCreateBody(BaseModel):
    model_config = ConfigDict(extra="forbid")

    client_score: Decimal = Field(ge=0, le=100, max_digits=5, decimal_places=2)
    feedback: str | None = Field(default=None, max_length=10_000)
    decision: Literal["accepted", "changes_requested", "rejected"] = "accepted"


def _current_user(user_id: str, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current user no longer exists.")
    return user


def _require_role(user: User, role: str) -> None:
    if user.role != role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{role.capitalize()} access required.")


def _project_or_404(project_id: str, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return project


def _owned_project_or_404(project_id: str, user_id: str, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.client_id == user_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    return project


def _decimal(value: Decimal | None) -> float | None:
    return float(value) if value is not None else None


def _timestamp(value) -> str | None:
    return value.isoformat() if value else None


def _milestone_data(milestone: Milestone, include_submissions: bool = False) -> dict:
    paid_payment = next(
        (p for p in (milestone.payments or []) if p.status == "paid_sandbox"),
        None,
    )
    data = {
        "id": milestone.id,
        "project_id": milestone.project_id,
        "title": milestone.title,
        "description": milestone.description,
        "acceptance_criteria": milestone.acceptance_criteria or [],
        "amount": _decimal(milestone.amount),
        "status": milestone.status,
        "due_date": milestone.due_date.isoformat() if milestone.due_date else None,
        "payment_reference": (paid_payment.paypal_capture_id or paid_payment.paypal_order_id) if paid_payment else None,
        "paid_at": _timestamp(paid_payment.paid_at) if paid_payment else None,
        "created_at": _timestamp(milestone.created_at),
        "updated_at": _timestamp(milestone.updated_at),
    }
    if include_submissions:
        data["submissions"] = [_submission_data(item) for item in milestone.submissions]
    return data


def _project_data(project: Project, include_milestones: bool = True) -> dict:
    data = {
        "id": project.id,
        "client_id": project.client_id,
        "freelancer_id": project.freelancer_id,
        "title": project.title,
        "description": project.description,
        "skills": project.skills or [],
        "budget_min": _decimal(project.budget_min),
        "budget_max": _decimal(project.budget_max),
        "hourly_rate": _decimal(project.hourly_rate),
        "currency": project.currency,
        "pricing_type": project.pricing_type,
        "status": project.status,
        "created_at": _timestamp(project.created_at),
        "updated_at": _timestamp(project.updated_at),
    }
    if include_milestones:
        data["milestones"] = [_milestone_data(item) for item in project.milestones]
    return data


def _open_project_data(project: Project) -> dict:
    data = _project_data(project)
    data.pop("client_id")
    data.pop("freelancer_id")
    return data


def _invitation_data(invitation: Invitation) -> dict:
    return {
        "id": invitation.id,
        "project_id": invitation.project_id,
        "client_id": invitation.client_id,
        "freelancer_id": invitation.freelancer_id,
        "status": invitation.status,
        "created_at": _timestamp(invitation.created_at),
        "updated_at": _timestamp(invitation.updated_at),
        "project": _project_data(invitation.project) if invitation.project else None,
    }


def _project_request_data(req: ProjectRequest, db: Session | None = None) -> dict:
    freelancer_data = None
    if req.freelancer:
        profile = req.freelancer.freelancer_profile.get_profile() if req.freelancer.freelancer_profile else {}
        name = req.freelancer.name
        avatar_text = "".join([part[0] for part in name.split() if part])[:2].upper() or "FL"
        freelancer_data = {
            "id": req.freelancer.id,
            "name": name,
            "email": req.freelancer.email,
            "avatarText": avatar_text,
            "headline": req.freelancer.headline or profile.get("headline") or "Independent Specialist",
            "skills": profile.get("skills") or [],
            "rating": profile.get("rating"),
            "completed_projects": profile.get("completed_projects", 0),
            "hourly_rate": profile.get("hourly_rate"),
        }

    project_data = None
    if req.project:
        project_data = {
            "id": req.project.id,
            "title": req.project.title,
            "description": req.project.description,
            "skills": req.project.skills or [],
            "budget_min": _decimal(req.project.budget_min),
            "budget_max": _decimal(req.project.budget_max),
            "status": req.project.status,
        }

    return {
        "id": req.id,
        "project_id": req.project_id,
        "freelancer_id": req.freelancer_id,
        "client_id": req.client_id,
        "status": req.status,
        "message": req.message,
        "created_at": _timestamp(req.created_at),
        "updated_at": _timestamp(req.updated_at),
        "project": project_data,
        "freelancer": freelancer_data,
    }


def _submission_data(submission: Submission) -> dict:
    return {
        "id": submission.id,
        "milestone_id": submission.milestone_id,
        "freelancer_id": submission.freelancer_id,
        "deliverable_url": submission.deliverable_url,
        "deliverable_text": submission.deliverable_text,
        "deliverable_metadata": submission.deliverable_metadata,
        "notes": submission.notes,
        "evaluation_result": submission.evaluation_result,
        "status": submission.status,
        "submitted_at": _timestamp(submission.submitted_at),
        "created_at": _timestamp(submission.created_at),
        "updated_at": _timestamp(submission.updated_at),
    }


def _review_data(review: Review) -> dict:
    return {
        "id": review.id,
        "project_id": review.project_id,
        "milestone_id": review.milestone_id,
        "client_id": review.client_id,
        "freelancer_id": review.freelancer_id,
        "client_score": _decimal(review.client_score),
        "model_score": _decimal(review.model_score),
        "final_score": _decimal(review.final_score),
        "feedback": review.feedback,
        "evaluation_result": review.evaluation_result,
        "created_at": _timestamp(review.created_at),
        "updated_at": _timestamp(review.updated_at),
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(
    body: ProjectCreateBody,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")
    project = Project(client_id=user.id, **body.model_dump(exclude={"milestones"}))
    project.milestones = [Milestone(**item.model_dump()) for item in body.milestones]
    try:
        db.add(project)
        db.commit()
        db.refresh(project)
    except Exception:
        db.rollback()
        raise
    return _project_data(project)


@router.get("/mine")
def list_my_projects(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")
    projects = db.query(Project).filter(Project.client_id == user.id).order_by(Project.created_at.desc()).all()
    return [_project_data(project) for project in projects]


@router.get("/open")
def browse_open_projects(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "freelancer")
    projects = db.query(Project).filter(Project.status == "open", Project.freelancer_id.is_(None)).order_by(Project.created_at.desc()).all()
    return [_open_project_data(project) for project in projects]


@router.get("/assigned")
def list_assigned_projects(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "freelancer")
    projects = db.query(Project).filter(Project.freelancer_id == user.id).order_by(Project.created_at.desc()).all()
    return [_project_data(project) for project in projects]


@router.get("/invitations")
def list_my_invitations(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "freelancer")
    invitations = db.query(Invitation).filter(Invitation.freelancer_id == user.id).order_by(Invitation.created_at.desc()).all()
    return [_invitation_data(invitation) for invitation in invitations]


@router.get("/journey")
def get_journey(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    if user.role == "client":
        projects = db.query(Project).filter(Project.client_id == user.id).order_by(Project.created_at.desc()).all()
        reviews = db.query(Review).filter(Review.client_id == user.id).order_by(Review.created_at.desc()).all()
    else:
        projects = db.query(Project).filter(Project.freelancer_id == user.id).order_by(Project.created_at.desc()).all()
        reviews = db.query(Review).filter(Review.freelancer_id == user.id).order_by(Review.created_at.desc()).all()
    return {"projects": [_project_data(project) for project in projects], "reviews": [_review_data(review) for review in reviews]}


@router.get("/requests/incoming")
def list_incoming_requests(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")
    requests = db.query(ProjectRequest).filter(
        ProjectRequest.client_id == user.id
    ).order_by(ProjectRequest.created_at.desc()).all()
    return [_project_request_data(req, db) for req in requests]


@router.get("/requests/mine")
def list_my_requests(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "freelancer")
    requests = db.query(ProjectRequest).filter(
        ProjectRequest.freelancer_id == user.id
    ).order_by(ProjectRequest.created_at.desc()).all()
    return [_project_request_data(req, db) for req in requests]


@router.post("/requests/{request_id}/accept")
def accept_project_request(
    request_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")
    req = db.query(ProjectRequest).filter(
        ProjectRequest.id == request_id,
        ProjectRequest.client_id == user.id,
    ).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")

    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot accept request with status '{req.status}'.",
        )

    project = req.project
    if not project or project.status in {"completed", "cancelled"} or project.freelancer_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Project is no longer available or already assigned.",
        )

    req.status = "accepted"
    req.updated_at = _utcnow()

    # Initiate existing invitation/engagement workflow
    invitation = db.query(Invitation).filter(
        Invitation.project_id == project.id,
        Invitation.freelancer_id == req.freelancer_id,
    ).first()
    if invitation:
        invitation.status = "pending"
        invitation.updated_at = _utcnow()
    else:
        invitation = Invitation(
            project_id=project.id,
            client_id=user.id,
            freelancer_id=req.freelancer_id,
            status="pending",
        )
        db.add(invitation)

    if project.status == "open":
        project.status = "invited"

    try:
        db.commit()
        db.refresh(req)
    except Exception:
        db.rollback()
        raise
    return _project_request_data(req, db)


@router.post("/requests/{request_id}/decline")
def decline_project_request(
    request_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")
    req = db.query(ProjectRequest).filter(
        ProjectRequest.id == request_id,
        ProjectRequest.client_id == user.id,
    ).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found.")

    if req.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot decline request with status '{req.status}'.",
        )

    req.status = "declined"
    req.updated_at = _utcnow()

    try:
        db.commit()
        db.refresh(req)
    except Exception:
        db.rollback()
        raise
    return _project_request_data(req, db)


@router.get("/{project_id}")
def get_project(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    project = _project_or_404(project_id, db)
    if user.role == "client":
        if project.client_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
        return _project_data(project)

    # Freelancer role
    if project.freelancer_id == user.id:
        return _project_data(project)
    if project.status == "open":
        return _open_project_data(project)

    # Check if the freelancer has an invitation to this project
    invitation = db.query(Invitation).filter(
        Invitation.project_id == project.id,
        Invitation.freelancer_id == user.id,
    ).first()
    if invitation:
        return _open_project_data(project)

    # Check if the freelancer has a request for this project
    req = db.query(ProjectRequest).filter(
        ProjectRequest.project_id == project.id,
        ProjectRequest.freelancer_id == user.id,
    ).first()
    if req:
        return _open_project_data(project)

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")


@router.get("/{project_id}/my-request")
def get_my_project_request(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "freelancer")
    req = db.query(ProjectRequest).filter(
        ProjectRequest.project_id == project_id,
        ProjectRequest.freelancer_id == user.id,
    ).first()
    if not req:
        return None
    return _project_request_data(req, db)


@router.post("/{project_id}/requests", status_code=status.HTTP_201_CREATED)
def request_to_work_on_project(
    project_id: str,
    body: ProjectRequestBody = ProjectRequestBody(),
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "freelancer")
    project = _project_or_404(project_id, db)

    # Validate project availability: prevent requests for closed, completed or unavailable projects
    if project.status != "open" or project.freelancer_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This project is {project.status} and not currently open for requests.",
        )

    # Prevent duplicate requests from the same freelancer for the same project
    existing_req = db.query(ProjectRequest).filter(
        ProjectRequest.project_id == project.id,
        ProjectRequest.freelancer_id == user.id,
    ).first()
    if existing_req:
        if existing_req.status == "pending":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already submitted a request for this project.",
            )
        if existing_req.status == "accepted":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Your request for this project was already accepted.",
            )
        if existing_req.status == "declined":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Your request for this project was previously declined.",
            )
        existing_req.status = "pending"
        existing_req.message = body.message
        existing_req.updated_at = _utcnow()
        req = existing_req
    else:
        req = ProjectRequest(
            project_id=project.id,
            freelancer_id=user.id,
            client_id=project.client_id,
            status="pending",
            message=body.message,
        )
        db.add(req)

    try:
        db.commit()
        db.refresh(req)
    except Exception:
        db.rollback()
        raise
    return _project_request_data(req, db)


@router.patch("/{project_id}")
def update_project(
    project_id: str,
    body: ProjectUpdateBody,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")
    project = _owned_project_or_404(project_id, user.id, db)
    if project.status in {"completed", "cancelled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot modify a {project.status} project.",
        )
    updates = body.model_dump(exclude_unset=True)
    if project.freelancer_id and updates.get("status") in {"draft", "open"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Assigned projects cannot be reopened or drafted.")
    budget_min = updates.get("budget_min", project.budget_min)
    budget_max = updates.get("budget_max", project.budget_max)
    if budget_min is not None and budget_max is not None and budget_max < budget_min:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="budget_max must be greater than or equal to budget_min.")
    
    new_status = updates.get("status")
    for field, value in updates.items():
        setattr(project, field, value)

    if new_status == "cancelled":
        for inv in project.invitations:
            if inv.status == "pending":
                inv.status = "cancelled"
        for req in project.requests:
            if req.status == "pending":
                req.status = "cancelled"
        for m in project.milestones:
            if m.status not in {"accepted", "paid"}:
                m.status = "cancelled"

    try:
        db.commit()
        db.refresh(project)
    except Exception:
        db.rollback()
        raise
    return _project_data(project)


@router.post("/{project_id}/invitations", status_code=status.HTTP_201_CREATED)
def invite_freelancer(
    project_id: str,
    body: InvitationCreateBody,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")
    project = _owned_project_or_404(project_id, user.id, db)
    if project.status in {"completed", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot invite to a {project.status} project.")
    if project.freelancer_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project already has an assigned freelancer.")
    freelancer = db.query(User).filter(User.id == body.freelancer_id, User.role == "freelancer").first()
    if not freelancer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Freelancer not found.")
    
    invitation = db.query(Invitation).filter(
        Invitation.project_id == project.id,
        Invitation.freelancer_id == freelancer.id,
    ).first()

    if invitation:
        if invitation.status == "pending":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Freelancer has already been invited to this project.")
        if invitation.status == "accepted":
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Freelancer has already accepted an invitation to this project.")
        # Reactivate previously declined, cancelled, or expired invitation
        invitation.status = "pending"
        invitation.updated_at = _utcnow()
    else:
        invitation = Invitation(project_id=project.id, client_id=user.id, freelancer_id=freelancer.id)
        db.add(invitation)

    if project.status == "open":
        project.status = "invited"

    try:
        db.commit()
        db.refresh(invitation)
    except Exception:
        db.rollback()
        raise
    return _invitation_data(invitation)


@router.get("/{project_id}/invitations")
def list_project_invitations(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")
    _owned_project_or_404(project_id, user.id, db)
    invitations = db.query(Invitation).filter(Invitation.project_id == project_id).order_by(Invitation.created_at.desc()).all()
    return [_invitation_data(invitation) for invitation in invitations]


@router.post("/invitations/{invitation_id}/accept")
def accept_invitation(
    invitation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "freelancer")
    invitation = db.query(Invitation).filter(Invitation.id == invitation_id, Invitation.freelancer_id == user.id).first()
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
    project = invitation.project
    if invitation.status != "pending" or project.client_id != invitation.client_id or project.freelancer_id or project.status in {"completed", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation can no longer be accepted.")
    invitation.status = "accepted"
    project.freelancer_id = user.id
    project.status = "active"
    for other in project.invitations:
        if other.id != invitation.id and other.status == "pending":
            other.status = "cancelled"
    # Transition first not_started milestone to in_progress
    for m in project.milestones:
        if m.status == "not_started":
            m.status = "in_progress"
            break
    try:
        db.commit()
        db.refresh(invitation)
    except Exception:
        db.rollback()
        raise
    return _invitation_data(invitation)


@router.post("/invitations/{invitation_id}/decline")
def decline_invitation(
    invitation_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "freelancer")
    invitation = db.query(Invitation).filter(Invitation.id == invitation_id, Invitation.freelancer_id == user.id).first()
    if not invitation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found.")
    if invitation.status != "pending" or invitation.project.client_id != invitation.client_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Invitation can no longer be declined.")
    invitation.status = "declined"
    project = invitation.project
    if project.status == "invited" and not any(other.status == "pending" for other in project.invitations if other.id != invitation.id):
        project.status = "open"
    try:
        db.commit()
        db.refresh(invitation)
    except Exception:
        db.rollback()
        raise
    return _invitation_data(invitation)


@router.post("/milestones/{milestone_id}/submissions", status_code=status.HTTP_201_CREATED)
def submit_deliverable(
    milestone_id: str,
    body: SubmissionCreateBody,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "freelancer")
    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone or milestone.project.freelancer_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found.")
    project = milestone.project
    if project.status not in {"active", "in_review"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Project is not active.")
    if milestone.status in {"accepted", "paid", "cancelled"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"Cannot submit work for an {milestone.status} milestone.")

    # Calculate authoritative evaluation result server-side using database criteria.
    # Never trust browser-supplied evaluation_result, AI scores, or final scores.
    authoritative_evaluation = None
    text_to_eval = (body.deliverable_text or body.notes or "").strip()
    if text_to_eval:
        try:
            from ml_service import get_relevancy_evaluator
            evaluator = get_relevancy_evaluator()
            client_req = (milestone.description or project.description or project.title).strip()
            criteria = milestone.acceptance_criteria or []
            category = "Software Engineering and Web Development"
            eval_input = {
                "client_request": client_req,
                "acceptance_criteria": criteria,
                "deliverable_text": text_to_eval[:20000],
                "work_category": category,
            }
            raw_eval = evaluator(**eval_input)
            if isinstance(raw_eval, dict):
                score = raw_eval.get("overall_score")
                if score is not None:
                    try:
                        val = float(score)
                        if not math.isnan(val) and not math.isinf(val) and 0 <= val <= 100:
                            raw_eval["overall_score"] = round(val, 1)
                        else:
                            raw_eval["overall_score"] = None
                    except (ValueError, TypeError):
                        raw_eval["overall_score"] = None
                authoritative_evaluation = raw_eval
        except Exception as e:
            logger.warning(f"Server-side evaluation error: {e}")
            authoritative_evaluation = {
                "overall_score": None,
                "dimension_scores": {},
                "requirement_assessments": [],
                "limitations": ["Automatic evaluation was unavailable during submission."],
                "evaluation_method": "fallback_manual_review",
            }

    submission = Submission(
        milestone_id=milestone.id,
        freelancer_id=user.id,
        deliverable_url=body.deliverable_url,
        deliverable_text=body.deliverable_text,
        deliverable_metadata=body.deliverable_metadata,
        notes=body.notes,
        evaluation_result=authoritative_evaluation,
    )
    milestone.status = "submitted"
    project.status = "in_review"
    try:
        db.add(submission)
        db.commit()
        db.refresh(submission)
    except Exception:
        db.rollback()
        raise
    return _submission_data(submission)


@router.get("/{project_id}/submissions")
def list_project_submissions(
    project_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    project = _project_or_404(project_id, db)
    if user.role == "client":
        if project.client_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    elif user.role == "freelancer":
        if project.freelancer_id != user.id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
    else:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")

    submissions = []
    for milestone in project.milestones:
        for submission in milestone.submissions:
            if submission.freelancer_id == project.freelancer_id:
                submissions.append(_submission_data(submission))
    return submissions


@router.post("/submissions/{submission_id}/review", status_code=status.HTTP_201_CREATED)
def review_submission(
    submission_id: str,
    body: ReviewCreateBody,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    milestone = submission.milestone
    project = milestone.project
    if project.client_id != user.id or project.freelancer_id != submission.freelancer_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Submission not found.")
    if submission.status in {"accepted", "rejected"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Submission has already been reviewed.")
    if milestone.status in {"accepted", "paid"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Milestone has already been accepted.")

    # Validate client_score is finite and within [0, 100]
    if body.client_score is None or not body.client_score.is_finite() or not (0 <= body.client_score <= 100):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="client_score must be between 0 and 100.")

    # Authoritative model_score read only from persisted submission.evaluation_result
    evaluation = submission.evaluation_result
    raw_model_score = evaluation.get("overall_score") if isinstance(evaluation, dict) else None
    model_score = None
    if raw_model_score is not None:
        try:
            num = float(raw_model_score)
            if not math.isnan(num) and not math.isinf(num) and 0 <= num <= 100:
                model_score = Decimal(str(round(num, 2)))
        except (ValueError, TypeError):
            model_score = None

    # Calculate final_score using standard 50/50 policy:
    # 50% model + 50% client if model_score exists, else 100% client_score
    if model_score is not None:
        final_score = ((model_score * Decimal("0.5")) + (body.client_score * Decimal("0.5"))).quantize(Decimal("0.01"))
    else:
        final_score = body.client_score.quantize(Decimal("0.01"))

    review = Review(
        project_id=project.id,
        milestone_id=milestone.id,
        client_id=user.id,
        freelancer_id=submission.freelancer_id,
        client_score=body.client_score,
        model_score=model_score,
        final_score=final_score,
        feedback=body.feedback,
        evaluation_result=evaluation,
    )
    submission.status = body.decision
    if body.decision == "accepted":
        milestone.status = "accepted"
        if project.milestones and all(item.status in {"accepted", "paid"} for item in project.milestones):
            project.status = "completed"
        elif any(item.status in {"submitted", "under_review"} for item in project.milestones if item.id != milestone.id):
            project.status = "in_review"
        else:
            project.status = "active"
        # Advance next not_started milestone to in_progress
        for next_m in project.milestones:
            if next_m.status == "not_started":
                next_m.status = "in_progress"
                break
    elif body.decision == "rejected":
        milestone.status = "rejected"
        project.status = "active"
    else:  # changes_requested
        milestone.status = "in_progress"
        project.status = "active"

    try:
        db.add(review)
        db.commit()
        db.refresh(review)
    except Exception:
        db.rollback()
        raise
    return {"review": _review_data(review), "submission": _submission_data(submission)}
