import type {
  Assessment,
  Attempt,
  Catalog,
  LearningContent,
  OfficialDocument,
  Profile,
} from "../types";
let identity = localStorage.getItem("lingua-device-id");
if (!identity) {
  identity = crypto.randomUUID();
  localStorage.setItem("lingua-device-id", identity);
}
export async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(
    (import.meta.env.VITE_API_BASE || "") + "/api" + path,
    {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "X-Learner-ID": identity!,
        ...init.headers,
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
  content: () => request<LearningContent>("/learning/content"),
  catalog: (refresh = false) =>
    request<Catalog>("/bbc/episodes?refresh=" + refresh),
  document: (url: string) =>
    request<OfficialDocument>("/bbc/document?url=" + encodeURIComponent(url)),
  profile: () =>
    request<{ profile: { state: Profile; favorites: string[] } | null }>(
      "/profile",
    ),
  saveProfile: (state: Profile, favorites: string[]) =>
    request<{ saved: boolean }>("/profile", {
      method: "PUT",
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
