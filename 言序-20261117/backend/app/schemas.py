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


class RegisterInput(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)
    displayName: str | None = Field(default=None, max_length=64)


class LoginInput(BaseModel):
    username: str = Field(min_length=1, max_length=64)
    password: str = Field(min_length=1, max_length=128)


class PlacementAnswerInput(BaseModel):
    questionId: str = Field(min_length=1, max_length=32)
    selectedIndex: int


class PlacementSubmitInput(BaseModel):
    answers: list[PlacementAnswerInput] = Field(min_length=1, max_length=50)


class AnswerRecordCreate(BaseModel):
    lang: str = Field(default="en", max_length=32)
    course: str = Field(default="general", max_length=64)
    mode: str = Field(default="new", max_length=32)
    word: str = Field(min_length=1, max_length=500)
    meaning: str = Field(default="", max_length=500)
    userAnswer: str = Field(default="", max_length=500)
    correctAnswer: str = Field(min_length=1, max_length=500)
    isCorrect: bool = False


class ArticleExplainInput(BaseModel):
    articleId: str = Field(min_length=1, max_length=100)
    scope: Literal["overview", "paragraph", "question"] = "overview"
    paragraphIndex: int = 0
    question: str = Field(default="", max_length=400)
    refresh: bool = False
