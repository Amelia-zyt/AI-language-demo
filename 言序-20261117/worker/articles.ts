import articlesData from "../backend/data/articles.json";

export interface ArticleParagraph {
  en: string;
  zh: string;
}

export interface ArticleKeyPoint {
  phrase: string;
  meaning: string;
  note: string;
}

export interface Article {
  id: string;
  order: number;
  level: string;
  difficultyLabel: string;
  grade: string;
  title: string;
  titleZh: string;
  source: string;
  sourceUrl: string;
  summary: string;
  wordCount: number;
  paragraphs: ArticleParagraph[];
  keyPoints: ArticleKeyPoint[];
}

const ARTICLES: Article[] = [...(articlesData.articles as Article[])].sort(
  (a, b) => a.order - b.order,
);
const ARTICLES_BY_ID = new Map(ARTICLES.map((a) => [a.id, a]));

export function listArticles(): Article[] {
  return ARTICLES;
}

export function findArticle(id: string): Article | undefined {
  return ARTICLES_BY_ID.get(id);
}

export async function explainArticleWithDeepSeek(
  apiKey: string,
  model: string,
  baseUrl: string,
  article: Article,
  scope: "overview" | "paragraph" | "question",
  paragraphIndex: number,
  question: string,
): Promise<string> {
  if (!apiKey) {
    throw new Error("未配置 DeepSeek API 密钥，暂无法生成 AI 讲解");
  }

  const fullText = article.paragraphs
    .map((p, i) => `[第${i + 1}段] ${p.en}`)
    .join("\n");

  const systemPrompt = `你是一位擅长中国大陆中小学及高中英语教材教学的 AI 英语老师。请用清晰、简洁、鼓励性的中文讲解。
要求：
1. 紧扣所给课文内容与学生学段（${article.grade} · ${article.level}），不要编造课文中不存在的句子。
2. 排版使用简洁 Markdown（小标题 + 要点列表），方便手机阅读。
3. 讲解重点词汇（标出含义和常见搭配）、核心语法/句型拆解，以及实用记忆或朗读建议。`;

  let userPrompt = "";
  if (scope === "paragraph") {
    const target = article.paragraphs[paragraphIndex];
    if (!target) throw new Error("段落序号超出范围");
    userPrompt = `课文：《${article.title}》（${article.grade}）
请重点精讲第 ${paragraphIndex + 1} 段：
原文：${target.en}
参考译文：${target.zh}

请按以下结构讲解：
### 句意与语境
### 核心词汇与短语
### 关键语法与句型拆解`;
  } else if (scope === "question") {
    userPrompt = `课文：《${article.title}》（${article.grade}）
课文内容：
${fullText}
学生提问：${question.trim()}

请结合课文直接回答学生的疑问，若涉及语法或词汇请给出简单例句。`;
  } else {
    userPrompt = `课文：《${article.title}》（${article.grade}）
全文：
${fullText}

请对这篇课文做一次完整的精讲，包含：
### 1. 文章主旨与结构
### 2. 必掌握词汇与搭配（4-6个）
### 3. 核心语法与长难句解析（2-3个）
### 4. 学习与朗读小建议`;
  }

  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    }),
    signal: AbortSignal.timeout(55000),
  });

  if (!resp.ok) {
    throw new Error(`DeepSeek 服务暂时不可用（HTTP ${resp.status}）`);
  }

  const data = (await resp.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = (data.choices?.[0]?.message?.content || "").trim();
  if (!content) {
    throw new Error("AI 暂未生成有效讲解，请重试");
  }
  return content;
}
