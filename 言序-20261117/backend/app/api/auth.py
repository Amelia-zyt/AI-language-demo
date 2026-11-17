import re
import sqlite3
import uuid
from fastapi import APIRouter, Header, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from .. import auth, storage
from ..schemas import LoginInput, RegisterInput

router = APIRouter(prefix="/auth")
USERNAME_RE = re.compile(r"^[a-zA-Z0-9_-]{3,32}$")


@router.post("/register", status_code=201)
def register(payload: RegisterInput, request: Request):
    uname = payload.username.strip()
    password = payload.password
    dname = (payload.displayName or "").strip() or uname
    if not USERNAME_RE.fullmatch(uname):
        raise HTTPException(400, "用户名需为 3–32 位字母、数字、下划线或短横线")
    if len(password) < 6 or len(password) > 72:
        raise HTTPException(400, "密码长度需为 6–72 个字符")
    if len(dname) > 32:
        raise HTTPException(400, "昵称不能超过 32 个字符")
    if storage.get_user_auth_row(uname):
        raise HTTPException(409, "用户名已存在")

    uid = str(uuid.uuid4())
    normalized = uname.lower()
    pw_hash = auth.hash_password(password)
    try:
        user = storage.create_user(uid, normalized, dname, pw_hash)
    except sqlite3.IntegrityError:
        raise HTTPException(409, "用户名已存在")

    token = auth.sign_jwt(uid, normalized, auth.get_jwt_secret())
    resp = JSONResponse({"user": user, "token": token}, status_code=201)
    auth.set_session_cookie(resp, request, token, 30 * 24 * 3600)
    return resp


@router.post("/login")
def login(payload: LoginInput, request: Request):
    uname = payload.username.strip()
    password = payload.password
    row = storage.get_user_auth_row(uname)
    if not row or not auth.verify_password(password, row["password_hash"]):
        raise HTTPException(401, "用户名或密码错误")

    user = {
        "id": row["id"],
        "username": row["username"],
        "displayName": row["display_name"],
        "englishLevel": row["english_level"],
        "recommendedCourse": row["recommended_course"],
        "assessmentCompleted": row["assessment_completed"] != 0,
        "createdAt": row["created_at"],
    }
    token = auth.sign_jwt(user["id"], user["username"], auth.get_jwt_secret())
    resp = JSONResponse({"user": user, "token": token}, status_code=200)
    auth.set_session_cookie(resp, request, token, 30 * 24 * 3600)
    return resp


@router.post("/logout")
def logout(request: Request, response: Response):
    auth.set_session_cookie(response, request, "", 0)
    return {"ok": True}


@router.get("/me")
def me(request: Request, x_learner_id: str = Header(default="local-device", max_length=100)):
    learner = auth.resolve_learner(request, x_learner_id)
    resp = JSONResponse({"user": learner.user})
    if learner.stale_cookie:
        auth.set_session_cookie(resp, request, "", 0)
    return resp
