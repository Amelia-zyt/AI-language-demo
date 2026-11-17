import json
from fastapi import APIRouter, Header, HTTPException
from ..config import DATA
from ..schemas import ProfilePayload, AssessmentInput, AssessmentResult
from ..domain.assessment import assess, tokens
from .. import storage

router = APIRouter()
CONTENT = json.loads((DATA / "learning.json").read_text(encoding="utf-8"))


def learner_id(x_learner_id: str = Header(default="local-device", max_length=100)):
    return x_learner_id


@router.get("/learning/content")
def learning_content():
    return CONTENT


@router.get("/profile")
def get_profile(x_learner_id: str = Header(default="local-device", max_length=100)):
    return {"profile": storage.get_profile(x_learner_id)}


@router.put("/profile")
def save_profile(
    payload: ProfilePayload,
    x_learner_id: str = Header(default="local-device", max_length=100),
):
    if len(json.dumps(payload.model_dump())) > 2_000_000:
        raise HTTPException(413, "学习档案过大")
    storage.put_profile(x_learner_id, payload.model_dump())
    return {"saved": True}


@router.post("/assessment/text", response_model=AssessmentResult)
def assessment(
    payload: AssessmentInput,
    x_learner_id: str = Header(default="local-device", max_length=100),
):
    # 上限限制动态规划成本；长篇按句提交，不能任意占用服务内存。
    if len(tokens(payload.reference)) > 500 or len(tokens(payload.transcript)) > 500:
        raise HTTPException(422, "请按句或短段提交，每次不超过 500 个词。")
    result = assess(payload.reference, payload.transcript)
    if payload.save:
        result["attempt_id"] = storage.add_attempt(
            x_learner_id,
            {
                "reference": payload.reference,
                "transcript": payload.transcript,
                "episode_id": payload.episode_id,
                "assessment": result.copy(),
            },
        )
    return result


@router.get("/attempts")
def attempts(x_learner_id: str = Header(default="local-device", max_length=100)):
    return {"attempts": storage.get_attempts(x_learner_id)}
