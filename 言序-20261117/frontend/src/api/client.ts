import type {
  AnswerRecord,
  AnswerRecordInput,
  AnswerStats,
  Article,
  ArticleExplainResponse,
  Assessment,
  Attempt,
  AuthResponse,
  Catalog,
  LearningContent,
  OfficialDocument,
  PlacementQuestion,
  PlacementResult,
  Profile,
  User,
} from "../types";

const TOKEN_KEY = "lingua-auth-token";
const DEVICE_KEY = "lingua-device-id";

let identity = localStorage.getItem(DEVICE_KEY);
if (!identity) {
  identity = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, identity);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getDeviceId(): string {
  return identity!;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Learner-ID": identity!,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await fetch(
    (import.meta.env.VITE_API_BASE || "") + "/api" + path,
    {
      ...init,
      credentials: "include",
      headers: {
        ...headers,
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: init.signal || AbortSignal.timeout(45000),
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw Error(
      typeof body.detail === "string"
        ? body.detail
        : body.error || "服务暂时无法访问",
    );
  }
  return response.json() as Promise<T>;
}

export const api = {
  auth: {
    register: (username: string, password: string, displayName?: string) =>
      request<AuthResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ username, password, displayName }),
      }),
    login: (username: string, password: string) =>
      request<AuthResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    logout: () =>
      request<{ ok: boolean }>("/auth/logout", {
        method: "POST",
      }),
    me: () => request<{ user: User | null }>("/auth/me"),
  },
  placement: {
    test: () =>
      request<{
        questions: PlacementQuestion[];
        totalQuestions: number;
        estimatedMinutes: number;
      }>("/placement/test"),
    submit: (answers: { questionId: string; selectedIndex: number }[]) =>
      request<{ result: PlacementResult; user: User | null }>(
        "/placement/submit",
        {
          method: "POST",
          body: JSON.stringify({ answers }),
        },
      ),
    latest: () =>
      request<{ latest: PlacementResult | null }>("/placement/latest"),
  },
  learning: {
    saveAnswer: (record: AnswerRecordInput) =>
      request<{ id: number; createdAt: string }>("/learning/answers", {
        method: "POST",
        body: JSON.stringify(record),
      }),
    answers: (params?: {
      limit?: number;
      offset?: number;
      filter?: "all" | "wrong";
    }) => {
      const qs = new URLSearchParams();
      if (params?.limit) qs.set("limit", String(params.limit));
      if (params?.offset) qs.set("offset", String(params.offset));
      if (params?.filter) qs.set("filter", params.filter);
      const q = qs.toString();
      return request<{ records: AnswerRecord[]; stats: AnswerStats }>(
        "/learning/answers" + (q ? "?" + q : ""),
      );
    },
  },
  articles: {
    list: () =>
      request<{ articles: Article[]; aiConfigured: boolean }>("/articles"),
    explain: (payload: {
      articleId: string;
      scope: "overview" | "paragraph" | "question";
      paragraphIndex?: number;
      question?: string;
      refresh?: boolean;
    }) =>
      request<ArticleExplainResponse>("/articles/explain", {
        method: "POST",
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(65000),
      }),
  },
  content: () => request<LearningContent>("/learning/content"),
  catalog: (refresh = false) =>
    request<Catalog>("/bbc/episodes?refresh=" + refresh),
  document: (url: string) =>
    request<OfficialDocument>("/bbc/document?url=" + encodeURIComponent(url)),
  profile: () =>
    request<{ profile: { state: Profile; favorites: string[] } | null }>(
      "/profile",
    ),
  saveProfile: (state: Profile, favorites: string[], keepalive = false) =>
    request<{ saved: boolean }>("/profile", {
      method: "PUT",
      keepalive,
      body: JSON.stringify({ state, favorites }),
    }),
  assess: (reference: string, transcript: string, episode_id?: string) =>
    request<Assessment>("/assessment/text", {
      method: "POST",
      body: JSON.stringify({ reference, transcript, episode_id }),
    }),
  attempts: () => request<{ attempts: Attempt[] }>("/attempts"),
};

export function apiUrl(path: string) {
  return (import.meta.env.VITE_API_BASE || "") + "/api" + path;
}
