from typing import Any, Literal
from pydantic import BaseModel, Field


class ProfilePayload(BaseModel):
    state: dict[str, Any]
    favorites: list[str] = Field(default_factory=list, max_length=10000)


class AssessmentInput(BaseModel):
    reference: str = Field(min_length=1, max_length=15000)
    transcript: str = Field(min_length=1, max_length=15000)
    episode_id: str | None = Field(default=None, max_length=1000)
    save: bool = True


class TokenMatch(BaseModel):
    text: str
    matched: bool | None


class GrammarHint(BaseModel):
    original: str
    correction: str
    explanation: str
    examples: list[str]


class AssessmentResult(BaseModel):
    score: int
    referenceWords: int
    spokenWords: int
    edits: int
    alignment: list[TokenMatch]
    hints: list[GrammarHint]
    metric: Literal["transcript_match"] = "transcript_match"
    attempt_id: int | None = None
