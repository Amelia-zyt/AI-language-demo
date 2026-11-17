import json
from fastapi import APIRouter, Header, HTTPException, Query, Request
from ..config import DATA
from ..schemas import (
    AnswerRecordCreate,
    AssessmentInput,
    AssessmentResult,
    ProfilePayload,
)
from ..domain.assessment import assess, tokens
from .. import auth, storage

router = APIRouter()
CONTENT = json.loads((DATA / "learning.json").read_text(encoding="utf-8"))


@router.get("/learning/content")
def learning_content():
    return CONTENT


@router.get("/profile")
def get_profile(
    request: Request,
    x_learner_id: str = Header(default="local-device", max_length=100),
):
    learner = auth.resolve_learner(request, x_learner_id)
    return {"profile": storage.get_profile(learner.key)}


@router.put("/profile")
def save_profile(
    payload: ProfilePayload,
    request: Request,
    x_learner_id: str = Header(default="local-device", max_length=100),
):
    if len(json.dumps(payload.model_dump())) > 2_000_000:
        raise HTTPException(413, "学习档案过大")
    learner = auth.resolve_learner(request, x_learner_id)
    storage.put_profile(learner.key, payload.model_dump())
    return {"saved": True}


@router.post("/learning/answers", status_code=201)
def save_answer_record(
    payload: AnswerRecordCreate,
    request: Request,
    x_learner_id: str = Header(default="local-device", max_length=100),
):
    learner = auth.resolve_learner(request, x_learner_id)
    row_id, created_at = storage.add_answer_record(learner.key, payload.model_dump())
    return {"id": row_id, "createdAt": created_at}


@router.get("/learning/answers")
def list_answer_records(
    request: Request,
    filter: str = Query(default="all"),
    limit: int = Query(default=30, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    x_learner_id: str = Header(default="local-device", max_length=100),
):
    learner = auth.resolve_learner(request, x_learner_id)
    filter_mode = "wrong" if filter == "wrong" else "all"
    return storage.get_answer_records(learner.key, filter_mode, limit, offset)


@router.post("/assessment/text", response_model=AssessmentResult)
def assessment(
    payload: AssessmentInput,
    request: Request,
    x_learner_id: str = Header(default="local-device", max_length=100),
):
    # 上限限制动态规划成本；长篇按句提交，不能任意占用服务内存。
    if len(tokens(payload.reference)) > 500 or len(tokens(payload.transcript)) > 500:
        raise HTTPException(422, "请按句或短段提交，每次不超过 500 个词。")
    learner = auth.resolve_learner(request, x_learner_id)
    result = assess(payload.reference, payload.transcript)
    if payload.save:
        result["attempt_id"] = storage.add_attempt(
            learner.key,
            {
                "reference": payload.reference,
                "transcript": payload.transcript,
                "episode_id": payload.episode_id,
                "assessment": result.copy(),
            },
        )
    return result


@router.get("/attempts")
def attempts(
    request: Request,
    x_learner_id: str = Header(default="local-device", max_length=100),
):
    learner = auth.resolve_learner(request, x_learner_id)
    return {"attempts": storage.get_attempts(learner.key)}
