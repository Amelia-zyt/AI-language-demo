"""通过服务器密钥调用英语口语老师。"""
import os
import httpx
from typing import Literal
from pydantic import BaseModel, Field
from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/speaking")
PROVIDERS = {
    "deepseek": ("DeepSeek", "https://api.deepseek.com"),
    "openai": ("ChatGPT / OpenAI", "https://api.openai.com/v1"),
    "gemini": ("Gemini", "https://generativelanguage.googleapis.com/v1beta/openai"),
    "qwen": ("千问", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
}
SYSTEM = "You are a supportive English speaking teacher. Speak mainly English, adapt to the learner, keep replies under 100 words, gently correct one important mistake with an example, and ask one follow-up question. Explain in Chinese when requested. Never assess pronunciation from text."

class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=6000)

class Chat(BaseModel):
    provider: Literal["deepseek", "openai", "gemini", "qwen"]
    messages: list[Message] = Field(min_length=1, max_length=40)

@router.get("/providers")
def providers():
    return [{"id": k, "name": v[0], "ready": bool(os.getenv(k.upper()+"_API_KEY") and os.getenv(k.upper()+"_MODEL"))} for k,v in PROVIDERS.items()]

@router.post("/chat")
async def chat(body: Chat):
    prefix = body.provider.upper()
    key, model = os.getenv(prefix+"_API_KEY"), os.getenv(prefix+"_MODEL")
    if not key or not model:
        raise HTTPException(503, "请先在服务器配置该提供商的 API Key 和模型名称。")
    if body.messages[-1].role != "user":
        raise HTTPException(422, "最后一条消息必须来自用户")
    base = os.getenv(prefix+"_BASE_URL", PROVIDERS[body.provider][1]).rstrip("/")
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(base+"/chat/completions", headers={"Authorization":"Bearer "+key}, json={"model":model,"messages":[{"role":"system","content":SYSTEM}]+[m.model_dump() for m in body.messages]})
        if response.status_code != 200:
            raise HTTPException(502,"模型请求失败，请检查密钥、模型权限和额度。")
        text = response.json()["choices"][0]["message"]["content"]
        if not isinstance(text,str) or not text.strip():
            raise ValueError()
        return {"text":text,"provider":body.provider,"model":model}
    except (httpx.HTTPError, ValueError, KeyError, IndexError):
        raise HTTPException(502,"模型暂不可用，请稍后重试。")
