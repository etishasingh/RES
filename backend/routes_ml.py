"""
PayPilot AI – ML API routes.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import asyncio
import logging
import math
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, Depends, HTTPException, status
import jsonschema
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from auth_utils import get_current_user_id
from db import FreelancerProfile, Milestone, Project, User, get_db
from ml_service import get_recommender, get_relevancy_evaluator, get_relevancy_schema

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["ml"])

executor = ThreadPoolExecutor(max_workers=4)


class RecommendRequest(BaseModel):
    top_k: int = Field(5, ge=1, le=20)


class EvaluateRequest(BaseModel):
    client_request: str = Field(min_length=1, max_length=20_000)
    acceptance_criteria: list[str] = Field(default_factory=list, max_length=100)
    deliverable_text: str = Field(min_length=1, max_length=20_000)
    work_category: str = Field(default="software", max_length=100)
    validation_evidence: str | None = Field(default=None, max_length=20_000)
    project_id: str | None = None
    milestone_id: str | None = None


def _load_freelancer_profile(user_id: str, db: Session) -> dict:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current user no longer exists.")
    if user.role != "freelancer":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Freelancer profile required.")
    fp = db.query(FreelancerProfile).filter(FreelancerProfile.user_id == user_id).first()
    if not fp:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Freelancer profile not found.")
    return fp.get_profile()


@router.post("/recommend", response_model=dict)
async def recommend(req: RecommendRequest, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    profile = _load_freelancer_profile(user_id, db)
    if not profile.get("skills"):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Missing required profile field: skills")
    try:
        recommender = get_recommender()
    except Exception as e:
        logger.error(f"Failed to load recommender: {e}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Recommendation service is currently unavailable.")
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(executor, lambda: recommender.recommend(profile, top_k=req.top_k))
    except Exception as e:
        logger.error(f"Recommender inference error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to generate recommendations.")
    return result


@router.post("/evaluate", response_model=dict)
async def evaluate(req: EvaluateRequest, user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current user no longer exists.")

    client_req = req.client_request.strip()
    criteria = [c.strip() for c in req.acceptance_criteria if isinstance(c, str) and c.strip()]
    deliverable = req.deliverable_text.strip()[:20000]

    # Milestone/project authorization verification
    if not req.milestone_id and not req.project_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="milestone_id or project_id is required for evaluation.")

    if req.milestone_id:
        milestone = db.query(Milestone).filter(Milestone.id == req.milestone_id).first()
        if not milestone:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found.")
        project = milestone.project
        if req.project_id and milestone.project_id != req.project_id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Milestone does not belong to the specified project.")
        if user.role == "freelancer" and project.freelancer_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this project.")
        if user.role == "client" and project.client_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this project.")
        if user.role not in {"freelancer", "client"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
        if milestone.acceptance_criteria:
            criteria = milestone.acceptance_criteria
        if milestone.description:
            client_req = milestone.description
        elif project.description:
            client_req = project.description
    elif req.project_id:
        project = db.query(Project).filter(Project.id == req.project_id).first()
        if not project:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found.")
        if user.role == "freelancer" and project.freelancer_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not assigned to this project.")
        if user.role == "client" and project.client_id != user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this project.")
        if user.role not in {"freelancer", "client"}:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied.")
        if project.description:
            client_req = project.description

    schema = get_relevancy_schema()
    input_data = {
        "client_request": client_req,
        "acceptance_criteria": criteria,
        "deliverable_text": deliverable,
        "work_category": req.work_category,
        "validation_evidence": req.validation_evidence,
    }
    try:
        jsonschema.validate(instance=input_data, schema=schema)
    except jsonschema.ValidationError:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid evaluation payload structure.")

    try:
        evaluator = get_relevancy_evaluator()
    except Exception as e:
        logger.error(f"Failed to load relevancy evaluator: {e}")
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Evaluation service is currently unavailable.")

    loop = asyncio.get_event_loop()
    try:
        raw_result = await loop.run_in_executor(executor, lambda: evaluator(**input_data))
    except Exception as e:
        logger.error(f"Relevancy inference error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to evaluate deliverable.")

    # Validate finite score within 0–100
    if not isinstance(raw_result, dict):
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Invalid evaluation response format.")

    overall = raw_result.get("overall_score")
    if overall is not None:
        try:
            val = float(overall)
            if math.isnan(val) or math.isinf(val) or not (0 <= val <= 100):
                raw_result["overall_score"] = None
            else:
                raw_result["overall_score"] = round(val, 1)
        except (ValueError, TypeError):
            raw_result["overall_score"] = None

    return raw_result
