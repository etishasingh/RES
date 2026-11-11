"""
PayPilot AI – PayPal Sandbox payment routes.
"""
from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from auth_utils import get_current_user_id
from db import Milestone, Payment, Project, User, get_db
from paypal_service import (
    PayPalAPIError,
    PayPalConfigError,
    capture_order,
    create_order,
    get_client_id,
    is_configured,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/payments", tags=["payments"])

_paypal_executor = ThreadPoolExecutor(max_workers=4)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _current_user(user_id: str, db: Session) -> User:
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Current user no longer exists.")
    return user


def _require_role(user: User, role: str) -> None:
    if user.role != role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{role.capitalize()} access required.")


def _payment_data(payment: Payment, milestone_number: int = 1) -> dict[str, Any]:
    timestamp = payment.paid_at or payment.created_at
    return {
        "id": payment.id,
        "projectId": payment.project_id,
        "projectTitle": payment.project.title if payment.project else "Untitled Project",
        "milestoneId": payment.milestone_id,
        "milestoneTitle": payment.milestone.title if payment.milestone else "Milestone",
        "milestoneNumber": milestone_number,
        "amount": float(payment.amount),
        "currency": payment.currency,
        "date": timestamp.strftime("%Y-%m-%d") if timestamp else "",
        "status": payment.status,
        "sandboxReference": payment.paypal_capture_id or payment.paypal_order_id,
        "paypalOrderId": payment.paypal_order_id,
        "paypalCaptureId": payment.paypal_capture_id,
        "paidAt": payment.paid_at.isoformat() if payment.paid_at else None,
        "createdAt": payment.created_at.isoformat() if payment.created_at else None,
    }


def _extract_capture_info(capture_payload: dict[str, Any]) -> tuple[str | None, Decimal | None, str | None]:
    purchase_units = capture_payload.get("purchase_units") or []
    if not isinstance(purchase_units, list) or not purchase_units:
        return None, None, None
    payments = purchase_units[0].get("payments") or {}
    captures = payments.get("captures") or []
    if not isinstance(captures, list) or not captures:
        return None, None, None
    first_capture = captures[0] or {}
    capture_id = first_capture.get("id")
    amount_obj = first_capture.get("amount") or {}
    raw_value = amount_obj.get("value")
    currency_code = amount_obj.get("currency_code")
    parsed_value = None
    if raw_value is not None:
        try:
            parsed_value = Decimal(str(raw_value)).quantize(Decimal("0.01"))
        except Exception:
            parsed_value = None
    return capture_id, parsed_value, currency_code


@router.get("/config")
def get_payment_config(user_id: str = Depends(get_current_user_id), db: Session = Depends(get_db)):
    _current_user(user_id, db)
    configured = is_configured()
    return {
        "configured": configured,
        "clientId": get_client_id() if configured else None,
        "mode": "sandbox",
        "currency": "USD",
    }


@router.post("/milestones/{milestone_id}/create-order", status_code=status.HTTP_201_CREATED)
async def create_milestone_order(
    milestone_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")

    milestone = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found.")
    project = milestone.project
    if not project or project.client_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found.")

    if milestone.status == "paid":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Milestone has already been paid.")
    if milestone.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Milestone must be accepted before payment authorization.",
        )

    existing_paid = (
        db.query(Payment)
        .filter(Payment.milestone_id == milestone.id, Payment.status == "paid_sandbox")
        .first()
    )
    if existing_paid:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Milestone has already been paid.")

    amount = Decimal(milestone.amount).quantize(Decimal("0.01"))
    if amount <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Milestone amount must be greater than zero.")

    currency = (project.currency or "USD").upper()
    description = f"{project.title} - {milestone.title}"

    loop = asyncio.get_running_loop()
    try:
        order = await loop.run_in_executor(
            _paypal_executor,
            lambda: create_order(
                amount=amount,
                currency=currency,
                custom_id=milestone.id,
                description=description,
            ),
        )
    except PayPalConfigError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except PayPalAPIError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    payment = Payment(
        project_id=project.id,
        milestone_id=milestone.id,
        client_id=user.id,
        freelancer_id=project.freelancer_id,
        amount=amount,
        currency=currency,
        provider="paypal_sandbox",
        paypal_order_id=order["id"],
        status="created",
        raw_response=order,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)

    return {
        "orderId": payment.paypal_order_id,
        "paymentId": payment.id,
        "amount": float(payment.amount),
        "currency": payment.currency,
    }


@router.post("/orders/{order_id}/capture")
async def capture_milestone_order(
    order_id: str,
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)
    _require_role(user, "client")

    payment = db.query(Payment).filter(Payment.paypal_order_id == order_id).first()
    if not payment or payment.client_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment order not found.")

    if payment.status == "paid_sandbox":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Payment order has already been captured.")

    milestone = payment.milestone
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Milestone not found.")
    if milestone.status == "paid":
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Milestone has already been paid.")
    if milestone.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Milestone must be accepted before payment capture.",
        )

    loop = asyncio.get_running_loop()
    try:
        capture_payload = await loop.run_in_executor(
            _paypal_executor,
            lambda: capture_order(order_id),
        )
    except PayPalConfigError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except PayPalAPIError as exc:
        payment.status = "failed"
        payment.raw_response = {"error": str(exc)}
        db.commit()
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    if capture_payload.get("status") != "COMPLETED":
        payment.status = "failed"
        payment.raw_response = capture_payload
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"PayPal order capture did not complete (status: {capture_payload.get('status')}).",
        )

    capture_id, captured_amount, captured_currency = _extract_capture_info(capture_payload)
    expected_amount = Decimal(payment.amount).quantize(Decimal("0.01"))
    if captured_amount is not None and captured_amount != expected_amount:
        payment.status = "failed"
        payment.raw_response = capture_payload
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Captured amount did not match milestone amount.",
        )
    if captured_currency is not None and captured_currency.upper() != payment.currency.upper():
        payment.status = "failed"
        payment.raw_response = capture_payload
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Captured currency did not match milestone currency.",
        )

    now = _utcnow()
    payment.status = "paid_sandbox"
    payment.paypal_capture_id = capture_id
    payment.paid_at = now
    payment.raw_response = capture_payload
    milestone.status = "paid"

    db.commit()
    db.refresh(payment)

    try:
        from impact_service import ImpactService
        ImpactService(db).record_platform_fee_allocation(payment)
    except Exception as impact_err:
        logger.error("Failed to record Impact allocation for payment %s: %s", payment.id, impact_err)

    project = payment.project
    milestone_num = 1
    if project and project.milestones:
        for idx, item in enumerate(project.milestones, start=1):
            if item.id == milestone.id:
                milestone_num = idx
                break

    return {
        "status": "paid_sandbox",
        "orderId": payment.paypal_order_id,
        "captureId": payment.paypal_capture_id,
        "milestoneId": milestone.id,
        "payment": _payment_data(payment, milestone_number=milestone_num),
    }


@router.get("/mine")
def list_my_payments(
    user_id: str = Depends(get_current_user_id),
    db: Session = Depends(get_db),
):
    user = _current_user(user_id, db)

    if user.role == "client":
        settled_payments = (
            db.query(Payment)
            .filter(Payment.client_id == user.id, Payment.status == "paid_sandbox")
            .order_by(Payment.paid_at.desc(), Payment.created_at.desc())
            .all()
        )
        paid_milestone_ids = {p.milestone_id for p in settled_payments}

        client_projects = db.query(Project).filter(Project.client_id == user.id).all()
        milestone_numbers: dict[str, int] = {}
        pending_items: list[dict[str, Any]] = []

        for proj in client_projects:
            for idx, m in enumerate(proj.milestones, start=1):
                milestone_numbers[m.id] = idx
                if m.status == "accepted" and m.id not in paid_milestone_ids:
                    pending_items.append(
                        {
                            "id": f"pending-{m.id}",
                            "projectId": proj.id,
                            "projectTitle": proj.title,
                            "milestoneId": m.id,
                            "milestoneTitle": m.title,
                            "milestoneNumber": idx,
                            "amount": float(m.amount),
                            "currency": proj.currency or "USD",
                            "date": m.updated_at.strftime("%Y-%m-%d") if m.updated_at else "",
                            "status": "pending_approval",
                            "sandboxReference": "Awaiting PayPal checkout",
                            "paypalOrderId": None,
                            "paypalCaptureId": None,
                        }
                    )

        settled_items = [
            _payment_data(p, milestone_number=milestone_numbers.get(p.milestone_id, 1))
            for p in settled_payments
        ]
        return {"payments": settled_items + pending_items}

    # Freelancer view: settled sandbox payments for projects assigned to this freelancer
    received_payments = (
        db.query(Payment)
        .filter(Payment.freelancer_id == user.id, Payment.status == "paid_sandbox")
        .order_by(Payment.paid_at.desc(), Payment.created_at.desc())
        .all()
    )
    items = []
    for p in received_payments:
        m_num = 1
        if p.project and p.project.milestones:
            for idx, item in enumerate(p.project.milestones, start=1):
                if item.id == p.milestone_id:
                    m_num = idx
                    break
        items.append(_payment_data(p, milestone_number=m_num))
    return {"payments": items}

