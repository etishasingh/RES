"""
PayPilot AI – PayPal Sandbox REST API v2 integration service.
"""
from __future__ import annotations

import logging
import os
import threading
import time
from decimal import Decimal
from typing import Any

import httpx

logger = logging.getLogger(__name__)

DEFAULT_SANDBOX_BASE_URL = "https://api-m.sandbox.paypal.com"

_token_lock = threading.Lock()
_cached_token: dict[str, Any] = {
    "key": None,
    "access_token": None,
    "expires_at": 0.0,
}


class PayPalConfigError(RuntimeError):
    """Raised when PayPal Sandbox credentials are missing."""


class PayPalAPIError(RuntimeError):
    """Raised when PayPal Sandbox returns an unexpected error response."""

    def __init__(self, message: str, status_code: int = 502, details: Any = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details


def get_client_id() -> str:
    return os.environ.get("PAYPAL_CLIENT_ID", "").strip()


def get_client_secret() -> str:
    return os.environ.get("PAYPAL_CLIENT_SECRET", "").strip()


def get_base_url() -> str:
    return (os.environ.get("PAYPAL_BASE_URL") or DEFAULT_SANDBOX_BASE_URL).strip().rstrip("/")


def is_configured() -> bool:
    return bool(get_client_id() and get_client_secret())


def clear_token_cache() -> None:
    with _token_lock:
        _cached_token["key"] = None
        _cached_token["access_token"] = None
        _cached_token["expires_at"] = 0.0


def _require_credentials() -> tuple[str, str, str]:
    client_id = get_client_id()
    client_secret = get_client_secret()
    if not client_id or not client_secret:
        raise PayPalConfigError(
            "PayPal Sandbox is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env."
        )
    return client_id, client_secret, get_base_url()


def _extract_error_message(response: httpx.Response, fallback: str) -> str:
    try:
        payload = response.json()
    except Exception:
        return fallback
    if isinstance(payload, dict):
        if payload.get("error_description"):
            return str(payload["error_description"])
        details = payload.get("details")
        if isinstance(details, list) and details:
            first = details[0]
            if isinstance(first, dict) and first.get("description"):
                return str(first["description"])
        if payload.get("message"):
            return str(payload["message"])
    return fallback


def get_access_token() -> str:
    client_id, client_secret, base_url = _require_credentials()
    cache_key = (base_url, client_id)
    now = time.time()

    with _token_lock:
        if (
            _cached_token["key"] == cache_key
            and _cached_token["access_token"]
            and now < float(_cached_token["expires_at"])
        ):
            return str(_cached_token["access_token"])

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                f"{base_url}/v1/oauth2/token",
                auth=(client_id, client_secret),
                headers={"Accept": "application/json", "Accept-Language": "en_US"},
                data={"grant_type": "client_credentials"},
            )
    except httpx.HTTPError as exc:
        logger.error("PayPal OAuth request failed: %s", exc)
        raise PayPalAPIError("Unable to reach PayPal Sandbox authentication service.") from exc

    if resp.status_code >= 400:
        msg = _extract_error_message(resp, f"PayPal authentication failed ({resp.status_code}).")
        logger.error("PayPal OAuth error %s: %s", resp.status_code, msg)
        raise PayPalAPIError(msg, status_code=502)

    data = resp.json()
    token = data.get("access_token")
    if not token:
        raise PayPalAPIError("PayPal authentication did not return an access token.")

    expires_in = int(data.get("expires_in", 300) or 300)
    with _token_lock:
        _cached_token["key"] = cache_key
        _cached_token["access_token"] = token
        _cached_token["expires_at"] = time.time() + max(30, expires_in - 60)

    return str(token)


def create_order(
    amount: Decimal,
    currency: str,
    custom_id: str,
    description: str,
) -> dict[str, Any]:
    _, _, base_url = _require_credentials()
    token = get_access_token()
    formatted_amount = f"{Decimal(amount).quantize(Decimal('0.01'))}"
    clean_currency = (currency or "USD").upper()
    clean_description = (description or "PayPilot milestone payment").strip()[:127]

    payload = {
        "intent": "CAPTURE",
        "purchase_units": [
            {
                "custom_id": custom_id[:127],
                "description": clean_description,
                "amount": {
                    "currency_code": clean_currency,
                    "value": formatted_amount,
                },
            }
        ],
        "application_context": {
            "shipping_preference": "NO_SHIPPING",
            "user_action": "PAY_NOW",
        },
    }

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                f"{base_url}/v2/checkout/orders",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
    except httpx.HTTPError as exc:
        logger.error("PayPal create_order request failed: %s", exc)
        raise PayPalAPIError("Unable to reach PayPal Sandbox to create order.") from exc

    if resp.status_code >= 400:
        msg = _extract_error_message(resp, f"PayPal failed to create order ({resp.status_code}).")
        logger.error("PayPal create_order error %s: %s", resp.status_code, msg)
        raise PayPalAPIError(msg, status_code=502)

    order = resp.json()
    if not order.get("id"):
        raise PayPalAPIError("PayPal create order response did not contain an order ID.")
    return order


def capture_order(order_id: str) -> dict[str, Any]:
    _, _, base_url = _require_credentials()
    token = get_access_token()

    try:
        with httpx.Client(timeout=20.0) as client:
            resp = client.post(
                f"{base_url}/v2/checkout/orders/{order_id}/capture",
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                },
                json={},
            )
    except httpx.HTTPError as exc:
        logger.error("PayPal capture_order request failed: %s", exc)
        raise PayPalAPIError("Unable to reach PayPal Sandbox to capture order.") from exc

    if resp.status_code >= 400:
        msg = _extract_error_message(resp, f"PayPal failed to capture order ({resp.status_code}).")
        logger.error("PayPal capture_order error %s: %s", resp.status_code, msg)
        raise PayPalAPIError(msg, status_code=502)

    return resp.json()

