"""认证、PBKDF2 密码哈希、HMAC-SHA256 JWT 及学习者身份解析。"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass
from fastapi import Request, Response
from . import config, storage

SESSION_COOKIE = "lingua_session"
PBKDF2_ITERATIONS = 100_000


def _b64u_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64u_decode(text: str) -> bytes:
    pad = "=" * ((4 - len(text) % 4) % 4)
    return base64.urlsafe_b64decode(text + pad)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS, dklen=32)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    parts = stored.split("$")
    if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
        return False
    try:
        iterations = int(parts[1])
        salt = bytes.fromhex(parts[2])
        expected = bytes.fromhex(parts[3])
    except ValueError:
        return False
    if iterations < 10_000 or iterations > 100_000:
        return False
    actual = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, iterations, dklen=len(expected)
    )
    return hmac.compare_digest(actual, expected)


def get_jwt_secret() -> str:
    env_secret = os.getenv("JWT_SECRET", "").strip() or config.JWT_SECRET
    if env_secret:
        return env_secret
    existing = storage.get_meta("jwt_secret")
    if existing:
        return existing
    generated = secrets.token_hex(32)
    storage.set_meta("jwt_secret", generated)
    return generated


def sign_jwt(user_id: str, username: str, secret: str) -> str:
    now = int(time.time())
    header = _b64u_encode(json.dumps({"alg": "HS256", "typ": "JWT"}, separators=(",", ":")).encode("utf-8"))
    payload = _b64u_encode(
        json.dumps(
            {"sub": user_id, "username": username, "iat": now, "exp": now + 30 * 24 * 3600},
            separators=(",", ":"),
        ).encode("utf-8")
    )
    signing_input = f"{header}.{payload}".encode("ascii")
    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64u_encode(sig)}"


def verify_jwt(token: str, secret: str) -> dict | None:
    parts = token.split(".")
    if len(parts) != 3:
        return None
    try:
        signing_input = f"{parts[0]}.{parts[1]}".encode("ascii")
        expected_sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
        actual_sig = _b64u_decode(parts[2])
        if not hmac.compare_digest(actual_sig, expected_sig):
            return None
        claims = json.loads(_b64u_decode(parts[1]).decode("utf-8"))
        exp = claims.get("exp")
        if not claims.get("sub") or not isinstance(exp, int) or exp < int(time.time()):
            return None
        return {"sub": claims["sub"], "username": claims.get("username", "")}
    except Exception:
        return None


def set_session_cookie(response: Response, request: Request, token: str, max_age: int) -> None:
    is_https = request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie(
        key=SESSION_COOKIE,
        value=token,
        max_age=max(0, max_age),
        path="/",
        httponly=True,
        samesite="lax",
        secure=is_https,
    )


@dataclass
class LearnerIdentity:
    key: str
    user: dict | None
    stale_cookie: bool


def resolve_learner(request: Request, x_learner_id: str = "local-device") -> LearnerIdentity:
    token: str | None = None
    from_cookie = False
    authz = request.headers.get("authorization", "")
    if authz.startswith("Bearer "):
        token = authz[7:].strip()
    else:
        token = request.cookies.get(SESSION_COOKIE)
        from_cookie = bool(token)

    if token:
        claims = verify_jwt(token, get_jwt_secret())
        if claims:
            user = storage.get_user_by_id(claims["sub"])
            if user:
                return LearnerIdentity(key=f"user:{user['id']}", user=user, stale_cookie=False)

    guest = (x_learner_id or "local-device").strip()[:100] or "local-device"
    return LearnerIdentity(key=f"guest:{guest}", user=None, stale_cookie=from_cookie)
