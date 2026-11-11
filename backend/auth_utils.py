"""
PayPilot AI – JWT helpers.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Cookie, Header, HTTPException, status

SECRET = os.environ.get("SESSION_SECRET", "")
ALGORITHM = "HS256"
COOKIE_NAME = "paypilot_session"
ACCESS_EXPIRES = timedelta(hours=24)


def _require_secret() -> str:
    secret = os.environ.get("SESSION_SECRET") or SECRET
    if not secret:
        raise RuntimeError("SESSION_SECRET is not set – refusing to operate.")
    return secret


def create_token(user_id: str, role: str) -> str:
    secret = _require_secret()
    payload = {
        "sub": user_id,
        "role": role,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + ACCESS_EXPIRES,
    }
    return jwt.encode(payload, secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    secret = _require_secret()
    try:
        return jwt.decode(token, secret, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired.")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session.")


def get_current_user_id(
    paypilot_session: str | None = Cookie(default=None),
    authorization: str | None = Header(default=None),
) -> str:
    token = paypilot_session
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization[7:].strip()
        else:
            token = authorization.strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated.")
    payload = decode_token(token)
    return payload["sub"]
