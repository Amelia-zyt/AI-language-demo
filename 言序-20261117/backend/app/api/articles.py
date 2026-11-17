import json
import os
import httpx
from fastapi import APIRouter, HTTPException
from .. import config, storage
from ..schemas import ArticleExplainInput

router = APIRouter(prefix="/articles")

ARTICLES_RAW = json.loads((config.DATA / "articles.json").read_text(encoding="utf-8"))
ARTICLES = sorted(ARTICLES_RAW.get("articles", []), key=lambda a: a.get("order", 0))
ARTICLES_BY_ID = {a["id"]: a for a in ARTICLES}


def _deepseek_settings() -> tuple[str, str, str]:
    api_key = os.getenv("DEEPSEEK_API_KEY", "").strip() or config.DEEPSEEK_API_KEY
    model = os.getenv("DEEPSEEK_MODEL", "").strip() or config.DEEPSEEK_MODEL
    base_url = (os.getenv("DEEPSEEK_BASE_URL", "").strip() or config.DEEPSEEK_BASE_URL).rstrip("/")
    return api_key, model, base_url


async def explain_article_with_deepseek(
    api_key: str,
    model: str,
    base_url: str,
    article: dict,
    scope: str,
    paragraph_index: int,
    question: str,
) -> str:
    if not api_key:
        raise HTTPException(502, "未配置 DeepSeek API 密钥，暂无法生成 AI 讲解")

    paragraphs = article.get("paragraphs", [])
    full_text = "\n".join(f"[第{i + 1}段] {p['en']}" for i, p in enumerate(paragraphs))
    system_prompt = (
        "你是一位擅长中国大陆中小学及高中英语教材教学的 AI 英语老师。请用清晰、简洁、鼓励性的中文讲解。\n"
        "要求：\n"
        f"1. 紧扣所给课文内容与学生学段（{article['grade']} · {article['level']}），不要编造课文中不存在的句子。\n"
        "2. 排版使用简洁 Markdown（小标题 + 要点列表），方便手机阅读。\n"
        "3. 讲解重点词汇（标出含义和常见搭配）、核心语法/句型拆解，以及实用记忆或朗读建议。"
    )

    if scope == "paragraph":
        if paragraph_index < 0 or paragraph_index >= len(paragraphs):
            raise HTTPException(422, "段落序号超出范围")
        target = paragraphs[paragraph_index]
        user_prompt = (
            f"课文：《{article['title']}》（{article['grade']}）\n"
            f"请重点精讲第 {paragraph_index + 1} 段：\n"
            f"原文：{target['en']}\n"
            f"参考译文：{target['zh']}\n\n"
            "请按以下结构讲解：\n"
            "### 句意与语境\n"
            "### 核心词汇与短语\n"
            "### 关键语法与句型拆解"
        )
    elif scope == "question":
        user_prompt = (
            f"课文：《{article['title']}》（{article['grade']}）\n"
            f"课文内容：\n{full_text}\n"
            f"学生提问：{question.strip()}\n\n"
            "请结合课文直接回答学生的疑问，若涉及语法或词汇请给出简单例句。"
        )
    else:
        user_prompt = (
            f"课文：《{article['title']}》（{article['grade']}）\n"
            f"全文：\n{full_text}\n\n"
            "请对这篇课文做一次完整的精讲，包含：\n"
            "### 1. 文章主旨与结构\n"
            "### 2. 必掌握词汇与搭配（4-6个）\n"
            "### 3. 核心语法与长难句解析（2-3个）\n"
            "### 4. 学习与朗读小建议"
        )

    try:
        async with httpx.AsyncClient(timeout=55.0) as client:
            resp = await client.post(
                f"{base_url}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 4096,
                },
            )
        if resp.status_code != 200:
            raise HTTPException(502, f"DeepSeek 服务暂时不可用（HTTP {resp.status_code}）")
        content = (resp.json()["choices"][0]["message"]["content"] or "").strip()
        if not content:
            raise ValueError("Empty response")
        return content
    except HTTPException:
        raise
    except (httpx.HTTPError, ValueError, KeyError, IndexError) as exc:
        raise HTTPException(502, "AI 讲解生成失败，请稍后重试") from exc


@router.get("")
def list_articles():
    api_key, _, _ = _deepseek_settings()
    return {"articles": ARTICLES, "aiConfigured": bool(api_key)}


@router.post("/explain")
async def explain_article(payload: ArticleExplainInput):
    article = ARTICLES_BY_ID.get(payload.articleId.strip())
    if not article:
        raise HTTPException(404, "未找到对应课文")

    cache_key = ""
    if payload.scope == "paragraph":
        if payload.paragraphIndex < 0 or payload.paragraphIndex >= len(article.get("paragraphs", [])):
            raise HTTPException(422, "段落索引无效")
        cache_key = f"{article['id']}:para:{payload.paragraphIndex}"
    elif payload.scope == "question":
        q = payload.question.strip()
        if not q or len(q) > 400:
            raise HTTPException(422, "请输入 1–400 字以内的提问")
    else:
        cache_key = f"{article['id']}:overview"

    if cache_key and not payload.refresh:
        cached = storage.get_article_ai_note(cache_key)
        if cached:
            return {
                "explanation": cached["content"],
                "model": cached["model"],
                "cached": True,
                "scope": payload.scope,
                "createdAt": cached["created_at"],
            }

    api_key, model, base_url = _deepseek_settings()
    explanation = await explain_article_with_deepseek(
        api_key,
        model,
        base_url,
        article,
        payload.scope,
        payload.paragraphIndex,
        payload.question,
    )
    created_at = ""
    if cache_key:
        created_at = storage.put_article_ai_note(cache_key, article["id"], payload.scope, model, explanation)
    else:
        created_at = storage._now_iso()
    return {
        "explanation": explanation,
        "model": model,
        "cached": False,
        "scope": payload.scope,
        "createdAt": created_at,
    }
