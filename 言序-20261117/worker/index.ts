import learningData from "../backend/data/learning.json";
import {
  explainArticleWithDeepSeek,
  findArticle,
  listArticles,
} from "./articles";
import { assess, tokens } from "./assessment";
import { hashPassword, signJwt, verifyJwt, verifyPassword } from "./auth";
import {
  audioResponse,
  getEpisodesCatalog,
  isAllowedSeries,
  openUpstream,
  parseDocument,
  pdfBytes,
  PODCAST_HOSTS,
  publicDocument,
  UpstreamError,
  validUrl,
} from "./bbc";
import { evaluatePlacement, placementQuestions } from "./placement";

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  JWT_SECRET?: string;
  CORS_ORIGINS?: string;
  DEEPSEEK_API_KEY?: string;
  DEEPSEEK_MODEL?: string;
  DEEPSEEK_BASE_URL?: string;
}

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  english_level: string;
  recommended_course: string;
  assessment_completed: number;
  created_at: string;
}

interface UserPublic {
  id: string;
  username: string;
  displayName: string;
  englishLevel: string;
  recommendedCourse: string;
  assessmentCompleted: boolean;
  createdAt: string;
}

const SESSION_COOKIE = "lingua_session";
const USERNAME_RE = /^[a-zA-Z0-9_-]{3,32}$/;
const VPID_RE = /^[bp][a-z0-9]{7}$/;
const RANGE_RE = /^bytes=\d*-\d*$/;
const DEFAULT_ORIGINS = new Set([
  "https://lingua.exhan.dpdns.org",
  "http://lingua.exhan.dpdns.org",
  "http://127.0.0.1:5173",
  "http://localhost:5173",
  "http://127.0.0.1:8787",
  "http://localhost:8787",
]);

const LEARNING_JSON_TEXT = JSON.stringify(learningData);

function toPublicUser(row: UserRow): UserPublic {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    englishLevel: row.english_level,
    recommendedCourse: row.recommended_course,
    assessmentCompleted: row.assessment_completed !== 0,
    createdAt: row.created_at,
  };
}

function allowedOrigins(env: Env): Set<string> {
  if (!env.CORS_ORIGINS) return DEFAULT_ORIGINS;
  return new Set(
    env.CORS_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function corsHeaders(request: Request, env: Env): Record<string, string> {
  const origin = request.headers.get("Origin");
  if (!origin || !allowedOrigins(env).has(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    Vary: "Origin",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, HEAD, POST, PUT, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Learner-ID, Range",
    "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges",
  };
}

function jsonResp(
  data: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

function errorResp(
  msg: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return jsonResp({ error: msg, detail: msg }, status, extraHeaders);
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

function sessionCookieHeader(
  request: Request,
  token: string,
  maxAge: number,
): string {
  const isHttps =
    new URL(request.url).protocol === "https:" ||
    request.headers.get("X-Forwarded-Proto") === "https";
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    "Path=/",
    `Max-Age=${maxAge}`,
    "HttpOnly",
    "SameSite=Lax",
  ];
  if (isHttps) parts.push("Secure");
  return parts.join("; ");
}

async function getJwtSecret(env: Env): Promise<string> {
  if (env.JWT_SECRET && env.JWT_SECRET.trim()) return env.JWT_SECRET.trim();
  const row = await env.DB.prepare(
    "SELECT value FROM app_meta WHERE key = 'jwt_secret'",
  ).first<{ value: string }>();
  if (row?.value) return row.value;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const generated = Array.from(bytes, (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  await env.DB.prepare(
    "INSERT INTO app_meta(key, value) VALUES ('jwt_secret', ?) ON CONFLICT(key) DO NOTHING",
  )
    .bind(generated)
    .run();
  const after = await env.DB.prepare(
    "SELECT value FROM app_meta WHERE key = 'jwt_secret'",
  ).first<{ value: string }>();
  return after?.value || generated;
}

async function resolveLearner(
  request: Request,
  env: Env,
  secret: string,
): Promise<{ key: string; user: UserPublic | null; staleCookie: boolean }> {
  let token: string | null = null;
  let fromCookie = false;
  const authz = request.headers.get("Authorization");
  if (authz && authz.startsWith("Bearer ")) {
    token = authz.slice(7).trim();
  } else {
    token = parseCookie(request.headers.get("Cookie"), SESSION_COOKIE);
    fromCookie = !!token;
  }

  if (token) {
    const claims = await verifyJwt(token, secret);
    if (claims) {
      const row = await env.DB.prepare(
        `SELECT id, username, display_name, password_hash, english_level, recommended_course, assessment_completed, created_at
         FROM users WHERE id = ?`,
      )
        .bind(claims.sub)
        .first<UserRow>();
      if (row) {
        return {
          key: `user:${row.id}`,
          user: toPublicUser(row),
          staleCookie: false,
        };
      }
    }
  }

  const rawGuest = (
    request.headers.get("X-Learner-ID") || "local-device"
  )
    .trim()
    .slice(0, 100);
  return {
    key: `guest:${rawGuest || "local-device"}`,
    user: null,
    staleCookie: fromCookie,
  };
}

async function readJsonBody<T>(request: Request, maxBytes: number): Promise<T> {
  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new Error("PAYLOAD_TOO_LARGE");
  }
  return JSON.parse(new TextDecoder().decode(buf)) as T;
}

function shanghaiDayStartIso(): string {
  const now = new Date();
  const cstMs = now.getTime() + 8 * 3600 * 1000;
  const cstDate = new Date(cstMs);
  const startUtcMs =
    Date.UTC(
      cstDate.getUTCFullYear(),
      cstDate.getUTCMonth(),
      cstDate.getUTCDate(),
      0,
      0,
      0,
    ) -
    8 * 3600 * 1000;
  return new Date(startUtcMs).toISOString();
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    try {
      const resp = await handleApi(request, url, env);
      const merged = new Headers(resp.headers);
      for (const [k, v] of Object.entries(cors)) merged.set(k, v);
      return new Response(resp.body, {
        status: resp.status,
        statusText: resp.statusText,
        headers: merged,
      });
    } catch (err) {
      if (err instanceof UpstreamError) {
        return errorResp(err.message, 502, cors);
      }
      if (err instanceof Error && err.message === "PAYLOAD_TOO_LARGE") {
        return errorResp("学习档案过大", 413, cors);
      }
      return errorResp("服务暂时发生异常，请稍后重试。", 500, cors);
    }
  },
};

async function handleApi(
  request: Request,
  url: URL,
  env: Env,
): Promise<Response> {
  const path = url.pathname;
  const method = request.method;

  if (method === "GET" && path === "/api/health") {
    return jsonResp({
      status: "ok",
      backend: "Cloudflare Workers",
      domain: "lingua.exhan.dpdns.org",
    });
  }

  if (method === "GET" && path === "/api/learning/content") {
    return new Response(LEARNING_JSON_TEXT, {
      status: 200,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  }

  if (method === "GET" && path === "/api/articles") {
    return jsonResp({
      articles: listArticles(),
      aiConfigured: !!(env.DEEPSEEK_API_KEY && env.DEEPSEEK_API_KEY.trim()),
    });
  }

  if (method === "POST" && path === "/api/articles/explain") {
    let body: {
      articleId?: string;
      scope?: string;
      paragraphIndex?: number;
      question?: string;
      refresh?: boolean;
    };
    try {
      body = await readJsonBody(request, 32 * 1024);
    } catch {
      return errorResp("请求格式无效", 400);
    }
    const article = findArticle((body.articleId || "").trim());
    if (!article) return errorResp("未找到对应课文", 404);

    const scope: "overview" | "paragraph" | "question" =
      body.scope === "paragraph" || body.scope === "question"
        ? body.scope
        : "overview";
    const paragraphIndex = Number(body.paragraphIndex ?? 0);
    const question = (body.question || "").trim();

    let cacheKey = "";
    if (scope === "paragraph") {
      if (
        !Number.isInteger(paragraphIndex) ||
        paragraphIndex < 0 ||
        paragraphIndex >= article.paragraphs.length
      ) {
        return errorResp("段落索引无效", 422);
      }
      cacheKey = `${article.id}:para:${paragraphIndex}`;
    } else if (scope === "question") {
      if (!question || Array.from(question).length > 400) {
        return errorResp("请输入 1–400 字以内的提问", 422);
      }
    } else {
      cacheKey = `${article.id}:overview`;
    }

    if (cacheKey && !body.refresh) {
      const cached = await env.DB.prepare(
        "SELECT model, content, created_at FROM article_ai_notes WHERE cache_key=?",
      )
        .bind(cacheKey)
        .first<{ model: string; content: string; created_at: string }>();
      if (cached) {
        return jsonResp({
          explanation: cached.content,
          model: cached.model,
          cached: true,
          scope,
          createdAt: cached.created_at,
        });
      }
    }

    const model = (env.DEEPSEEK_MODEL || "").trim() || "deepseek-flash";
    const baseUrl =
      (env.DEEPSEEK_BASE_URL || "").trim() || "https://api.deepseek.com";
    const apiKey = (env.DEEPSEEK_API_KEY || "").trim();
    try {
      const explanation = await explainArticleWithDeepSeek(
        apiKey,
        model,
        baseUrl,
        article,
        scope,
        paragraphIndex,
        question,
      );
      const createdAt = new Date().toISOString();
      if (cacheKey) {
        await env.DB.prepare(
          `INSERT INTO article_ai_notes(cache_key, article_id, scope, model, content, created_at)
           VALUES (?, ?, ?, ?, ?, ?)
           ON CONFLICT(cache_key) DO UPDATE SET model=excluded.model, content=excluded.content, created_at=excluded.created_at`,
        )
          .bind(cacheKey, article.id, scope, model, explanation, createdAt)
          .run();
      }
      return jsonResp({
        explanation,
        model,
        cached: false,
        scope,
        createdAt,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "AI 讲解生成失败，请稍后重试";
      return errorResp(msg, 502);
    }
  }

  const secret = await getJwtSecret(env);

  if (method === "POST" && path === "/api/auth/register") {
    let body: { username?: string; password?: string; displayName?: string };
    try {
      body = await readJsonBody(request, 32 * 1024);
    } catch {
      return errorResp("请求格式无效", 400);
    }
    const uname = (body.username || "").trim();
    const password = body.password || "";
    const dname = (body.displayName || "").trim() || uname;
    if (!USERNAME_RE.test(uname)) {
      return errorResp("用户名需为 3–32 位字母、数字、下划线或短横线", 400);
    }
    if (password.length < 6 || password.length > 72) {
      return errorResp("密码长度需为 6–72 个字符", 400);
    }
    if (Array.from(dname).length > 32) {
      return errorResp("昵称不能超过 32 个字符", 400);
    }
    const existing = await env.DB.prepare(
      "SELECT id FROM users WHERE username = ? COLLATE NOCASE",
    )
      .bind(uname)
      .first();
    if (existing) return errorResp("用户名已存在", 409);

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const normalized = uname.toLowerCase();
    const passwordHash = await hashPassword(password);
    try {
      await env.DB.prepare(
        `INSERT INTO users(id, username, display_name, password_hash, english_level, recommended_course, assessment_completed, created_at)
         VALUES (?, ?, ?, ?, '', '', 0, ?)`,
      )
        .bind(id, normalized, dname, passwordHash, now)
        .run();
    } catch {
      return errorResp("用户名已存在", 409);
    }
    const user: UserPublic = {
      id,
      username: normalized,
      displayName: dname,
      englishLevel: "",
      recommendedCourse: "",
      assessmentCompleted: false,
      createdAt: now,
    };
    const token = await signJwt({ sub: id, username: normalized }, secret);
    return jsonResp({ user, token }, 201, {
      "Set-Cookie": sessionCookieHeader(request, token, 30 * 24 * 3600),
    });
  }

  if (method === "POST" && path === "/api/auth/login") {
    let body: { username?: string; password?: string };
    try {
      body = await readJsonBody(request, 32 * 1024);
    } catch {
      return errorResp("请求格式无效", 400);
    }
    const uname = (body.username || "").trim();
    const password = body.password || "";
    if (!uname || !password) return errorResp("用户名或密码错误", 401);

    const row = await env.DB.prepare(
      `SELECT id, username, display_name, password_hash, english_level, recommended_course, assessment_completed, created_at
       FROM users WHERE username = ? COLLATE NOCASE`,
    )
      .bind(uname)
      .first<UserRow>();
    if (!row || !(await verifyPassword(password, row.password_hash))) {
      return errorResp("用户名或密码错误", 401);
    }
    const user = toPublicUser(row);
    const token = await signJwt({ sub: user.id, username: user.username }, secret);
    return jsonResp({ user, token }, 200, {
      "Set-Cookie": sessionCookieHeader(request, token, 30 * 24 * 3600),
    });
  }

  if (method === "POST" && path === "/api/auth/logout") {
    return jsonResp({ ok: true }, 200, {
      "Set-Cookie": sessionCookieHeader(request, "", -1),
    });
  }

  if (method === "GET" && path === "/api/auth/me") {
    const learner = await resolveLearner(request, env, secret);
    const extra: Record<string, string> = learner.staleCookie
      ? { "Set-Cookie": sessionCookieHeader(request, "", -1) }
      : {};
    return jsonResp({ user: learner.user }, 200, extra);
  }

  if (method === "GET" && path === "/api/placement/test") {
    const questions = placementQuestions();
    return jsonResp({
      questions,
      totalQuestions: questions.length,
      estimatedMinutes: 2,
    });
  }

  if (method === "POST" && path === "/api/placement/submit") {
    const learner = await resolveLearner(request, env, secret);
    let body: { answers?: { questionId: string; selectedIndex: number }[] };
    try {
      body = await readJsonBody(request, 64 * 1024);
    } catch {
      return errorResp("提交格式无效", 400);
    }
    if (!Array.isArray(body.answers) || body.answers.length === 0) {
      return errorResp("请至少作答一题再提交评测", 422);
    }
    const evaluated = evaluatePlacement(body.answers);
    const now = new Date().toISOString();
    const payloadObj = { ...evaluated, createdAt: now };
    const insertRes = await env.DB.prepare(
      `INSERT INTO placement_assessments(learner, score, total, level, level_label, recommended_course, payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        learner.key,
        evaluated.score,
        evaluated.totalQuestions,
        evaluated.level,
        evaluated.levelLabel,
        evaluated.recommendedCourse,
        JSON.stringify(payloadObj),
        now,
      )
      .run();

    const result = {
      id: insertRes.meta.last_row_id,
      ...payloadObj,
    };

    let updatedUser: UserPublic | null = null;
    if (learner.user) {
      await env.DB.prepare(
        "UPDATE users SET english_level=?, recommended_course=?, assessment_completed=1 WHERE id=?",
      )
        .bind(evaluated.level, evaluated.recommendedCourse, learner.user.id)
        .run();
      const row = await env.DB.prepare(
        `SELECT id, username, display_name, password_hash, english_level, recommended_course, assessment_completed, created_at
         FROM users WHERE id = ?`,
      )
        .bind(learner.user.id)
        .first<UserRow>();
      if (row) updatedUser = toPublicUser(row);
    }
    return jsonResp({ result, user: updatedUser });
  }

  if (method === "GET" && path === "/api/placement/latest") {
    const learner = await resolveLearner(request, env, secret);
    const row = await env.DB.prepare(
      "SELECT id, payload_json, created_at FROM placement_assessments WHERE learner=? ORDER BY id DESC LIMIT 1",
    )
      .bind(learner.key)
      .first<{ id: number; payload_json: string; created_at: string }>();
    if (!row) return jsonResp({ latest: null });
    return jsonResp({
      latest: {
        ...JSON.parse(row.payload_json),
        id: row.id,
        createdAt: row.created_at,
      },
    });
  }

  if (method === "GET" && path === "/api/profile") {
    const learner = await resolveLearner(request, env, secret);
    const row = await env.DB.prepare(
      "SELECT payload FROM profiles WHERE learner=?",
    )
      .bind(learner.key)
      .first<{ payload: string }>();
    return jsonResp({ profile: row ? JSON.parse(row.payload) : null });
  }

  if (method === "PUT" && path === "/api/profile") {
    const learner = await resolveLearner(request, env, secret);
    const body = await readJsonBody<{
      state?: Record<string, unknown>;
      favorites?: string[];
    }>(request, 2_000_000);
    if (!body.state || typeof body.state !== "object") {
      return errorResp("缺少 state 字段", 422);
    }
    const favs = Array.isArray(body.favorites) ? body.favorites : [];
    if (favs.length > 10000) return errorResp("收藏数量超出限制", 422);
    const encoded = JSON.stringify({ state: body.state, favorites: favs });
    if (encoded.length > 2_000_000) return errorResp("学习档案过大", 413);
    await env.DB.prepare(
      `INSERT INTO profiles(learner, payload, updated) VALUES (?, ?, ?)
       ON CONFLICT(learner) DO UPDATE SET payload=excluded.payload, updated=excluded.updated`,
    )
      .bind(learner.key, encoded, new Date().toISOString())
      .run();
    return jsonResp({ saved: true });
  }

  if (method === "POST" && path === "/api/learning/answers") {
    const learner = await resolveLearner(request, env, secret);
    let body: {
      lang?: string;
      course?: string;
      mode?: string;
      word?: string;
      meaning?: string;
      userAnswer?: string;
      correctAnswer?: string;
      isCorrect?: boolean;
    };
    try {
      body = await readJsonBody(request, 32 * 1024);
    } catch {
      return errorResp("答题记录格式无效", 400);
    }
    const word = (body.word || "").trim();
    const correctAnswer = (body.correctAnswer || "").trim();
    const userAnswer = body.userAnswer || "";
    if (!word || !correctAnswer || word.length > 500 || userAnswer.length > 500) {
      return errorResp("答题记录内容无效", 422);
    }
    const now = new Date().toISOString();
    const res = await env.DB.prepare(
      `INSERT INTO answer_records(learner, lang, course, mode, word, meaning, user_answer, correct_answer, is_correct, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        learner.key,
        body.lang || "en",
        body.course || "general",
        body.mode || "new",
        word,
        body.meaning || "",
        userAnswer,
        correctAnswer,
        body.isCorrect ? 1 : 0,
        now,
      )
      .run();
    return jsonResp(
      { id: res.meta.last_row_id, createdAt: now },
      201,
    );
  }

  if (method === "GET" && path === "/api/learning/answers") {
    const learner = await resolveLearner(request, env, secret);
    const filter = url.searchParams.get("filter") === "wrong" ? "wrong" : "all";
    const limit = Math.min(
      100,
      Math.max(1, Number(url.searchParams.get("limit")) || 30),
    );
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

    const agg = await env.DB.prepare(
      `SELECT COUNT(*) as total,
              COALESCE(SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END), 0) as correct,
              COALESCE(SUM(CASE WHEN is_correct=0 THEN 1 ELSE 0 END), 0) as wrong
       FROM answer_records WHERE learner=?`,
    )
      .bind(learner.key)
      .first<{ total: number; correct: number; wrong: number }>();

    const todayRow = await env.DB.prepare(
      "SELECT COUNT(*) as today FROM answer_records WHERE learner=? AND created_at >= ?",
    )
      .bind(learner.key, shanghaiDayStartIso())
      .first<{ today: number }>();

    const sql =
      filter === "wrong"
        ? `SELECT id, lang, course, mode, word, meaning, user_answer, correct_answer, is_correct, created_at
           FROM answer_records WHERE learner=? AND is_correct=0 ORDER BY id DESC LIMIT ? OFFSET ?`
        : `SELECT id, lang, course, mode, word, meaning, user_answer, correct_answer, is_correct, created_at
           FROM answer_records WHERE learner=? ORDER BY id DESC LIMIT ? OFFSET ?`;

    const { results } = await env.DB.prepare(sql)
      .bind(learner.key, limit, offset)
      .all<{
        id: number;
        lang: string;
        course: string;
        mode: string;
        word: string;
        meaning: string;
        user_answer: string;
        correct_answer: string;
        is_correct: number;
        created_at: string;
      }>();

    const records = (results || []).map((r) => ({
      id: r.id,
      lang: r.lang,
      course: r.course,
      mode: r.mode,
      word: r.word,
      meaning: r.meaning,
      userAnswer: r.user_answer,
      correctAnswer: r.correct_answer,
      isCorrect: r.is_correct !== 0,
      createdAt: r.created_at,
    }));

    return jsonResp({
      records,
      stats: {
        total: agg?.total || 0,
        correct: agg?.correct || 0,
        wrong: agg?.wrong || 0,
        today: todayRow?.today || 0,
      },
    });
  }

  if (method === "POST" && path === "/api/assessment/text") {
    const learner = await resolveLearner(request, env, secret);
    let body: {
      reference?: string;
      transcript?: string;
      episode_id?: string | null;
      save?: boolean;
    };
    try {
      body = await readJsonBody(request, 64 * 1024);
    } catch {
      return errorResp("请求内容格式无效", 422);
    }
    const reference = body.reference || "";
    const transcript = body.transcript || "";
    if (
      reference.length < 1 ||
      reference.length > 15000 ||
      transcript.length < 1 ||
      transcript.length > 15000
    ) {
      return errorResp("参考句与识别文本长度需在 1–15000 字符以内", 422);
    }
    if (body.episode_id && body.episode_id.length > 1000) {
      return errorResp("episode_id 过长", 422);
    }
    if (tokens(reference).length > 500 || tokens(transcript).length > 500) {
      return errorResp("请按句或短段提交，每次不超过 500 个词。", 422);
    }

    const result = assess(reference, transcript);
    if (body.save !== false) {
      const payload = JSON.stringify({
        reference,
        transcript,
        episode_id: body.episode_id ?? null,
        assessment: result,
      });
      const res = await env.DB.prepare(
        "INSERT INTO attempts(learner, payload, created) VALUES (?, ?, ?)",
      )
        .bind(learner.key, payload, new Date().toISOString())
        .run();
      result.attempt_id = res.meta.last_row_id;
    }
    return jsonResp(result);
  }

  if (method === "GET" && path === "/api/attempts") {
    const learner = await resolveLearner(request, env, secret);
    const { results } = await env.DB.prepare(
      "SELECT id, payload, created FROM attempts WHERE learner=? ORDER BY id DESC LIMIT 50",
    )
      .bind(learner.key)
      .all<{ id: number; payload: string; created: string }>();
    const attempts = (results || []).map((row) => ({
      id: row.id,
      created: row.created,
      ...JSON.parse(row.payload),
    }));
    return jsonResp({ attempts });
  }

  // BBC routes
  if (method === "GET" && path === "/api/bbc/episodes") {
    const refresh = url.searchParams.get("refresh") === "true";
    const catalog = await getEpisodesCatalog(env.ASSETS, refresh);
    return jsonResp(catalog);
  }

  if ((method === "GET" || method === "HEAD") && path === "/api/bbc/feed") {
    const series = url.searchParams.get("series") || "";
    if (!isAllowedSeries(series)) return errorResp("Unknown BBC series", 400);
    const resp = await openUpstream(
      `https://podcasts.files.bbci.co.uk/${series}.rss`,
      PODCAST_HOSTS,
    );
    const bytes = new Uint8Array(await resp.arrayBuffer());
    return new Response(method === "GET" ? (bytes.buffer as ArrayBuffer) : null, {
      status: 200,
      headers: {
        "Content-Type": "application/rss+xml",
        "Content-Length": String(bytes.byteLength),
      },
    });
  }

  if (method === "GET" && path === "/api/bbc/document") {
    const targetUrl = url.searchParams.get("url") || "";
    if (
      !validUrl(
        targetUrl,
        new Set(["bbc.co.uk", "www.bbc.co.uk"]),
        "/learningenglish/",
      )
    ) {
      return errorResp(
        "Only official BBC Learning English pages are supported",
        400,
      );
    }
    const html = await publicDocument(targetUrl);
    return jsonResp(parseDocument(html, targetUrl));
  }

  if ((method === "GET" || method === "HEAD") && path === "/api/bbc/pdf") {
    const targetUrl = url.searchParams.get("url") || "";
    if (
      !validUrl(
        targetUrl,
        new Set(["downloads.bbc.co.uk"]),
        "/learningenglish/",
        ".pdf",
      )
    ) {
      return errorResp("Only BBC transcript PDFs are supported", 400);
    }
    const data = await pdfBytes(targetUrl);
    return new Response(method === "GET" ? (data.buffer as ArrayBuffer) : null, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="BBC-transcript.pdf"',
        "Content-Length": String(data.byteLength),
      },
    });
  }

  if ((method === "GET" || method === "HEAD") && path === "/api/bbc/audio") {
    const vpid = url.searchParams.get("vpid") || "";
    const page = url.searchParams.get("page") || "";
    const quality = url.searchParams.get("quality") || "";
    if (!VPID_RE.test(vpid)) {
      return errorResp("Invalid BBC audio identifier", 400);
    }
    const byteRange = request.headers.get("Range") || "";
    if (
      byteRange &&
      (!RANGE_RE.test(byteRange) || byteRange === "bytes=-")
    ) {
      return errorResp("Invalid byte range", 400);
    }
    try {
      const upstream = await audioResponse(vpid, quality, page, method, byteRange);
      const outHeaders = new Headers();
      outHeaders.set("Content-Type", "audio/mpeg");
      for (const k of ["Content-Length", "Content-Range", "Accept-Ranges"]) {
        const v = upstream.headers.get(k);
        if (v) outHeaders.set(k, v);
      }
      return new Response(method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        headers: outHeaders,
      });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "BBC 音频暂时无法读取";
      return errorResp(msg, 424);
    }
  }

  return errorResp("接口不存在", 404);
}
