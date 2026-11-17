import { reactive, ref, watch } from "vue";
import { api, getAuthToken, setAuthToken } from "../api/client";
import type {
  AnswerRecordInput,
  LearningContent,
  Profile,
  User,
} from "../types";

function createDefaults(): Profile {
  return {
    lang: "en",
    theme: "system",
    size: 10,
    course: "general",
    preference: "content",
    records: [],
    sessions: {},
    total: 0,
    correct: 0,
  };
}

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}

function profileStorageKey(user: User | null): string {
  return user ? `lingua-v1:user:${user.id}` : "lingua-v1:guest";
}

function favoritesStorageKey(user: User | null): string {
  return user
    ? `lingua-bbc-favorites-v1:user:${user.id}`
    : "lingua-bbc-favorites-v1:guest";
}

// Migrate legacy single-device keys into guest namespace once.
if (
  !localStorage.getItem("lingua-v1:guest") &&
  localStorage.getItem("lingua-v1")
) {
  localStorage.setItem("lingua-v1:guest", localStorage.getItem("lingua-v1")!);
}
if (
  !localStorage.getItem("lingua-bbc-favorites-v1:guest") &&
  localStorage.getItem("lingua-bbc-favorites-v1")
) {
  localStorage.setItem(
    "lingua-bbc-favorites-v1:guest",
    localStorage.getItem("lingua-bbc-favorites-v1")!,
  );
}

export const currentUser = ref<User | null>(null);
export const authReady = ref(false);
export const placementNudgeDismissed = ref(false);

export const profile = reactive<Profile>({
  ...createDefaults(),
  ...read<Partial<Profile>>("lingua-v1:guest", {}),
});
export const favorites = ref<string[]>(
  read("lingua-bbc-favorites-v1:guest", []),
);
export const content = ref<LearningContent | null>(null);
export const syncState = ref("已保存");
export const toastMessage = ref("");

let saveTimer: ReturnType<typeof setTimeout> | undefined;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
let hydrating = false;

export function toast(text: string) {
  toastMessage.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastMessage.value = ""), 3000);
}

function applyProfileData(
  stateData: Partial<Profile> | null,
  favs: string[] | null,
) {
  hydrating = true;
  try {
    const next = { ...createDefaults(), ...(stateData || {}) };
    if (content.value && !content.value.courses[next.course]) {
      next.course = "general";
    }
    Object.assign(profile, next);
    favorites.value = Array.isArray(favs) ? [...favs] : [];
  } finally {
    hydrating = false;
  }
}

function persistLocalSnapshot() {
  const pKey = profileStorageKey(currentUser.value);
  const fKey = favoritesStorageKey(currentUser.value);
  localStorage.setItem(pKey, JSON.stringify(profile));
  localStorage.setItem(fKey, JSON.stringify(favorites.value));
  if (!currentUser.value) {
    localStorage.setItem("lingua-v1", JSON.stringify(profile));
    localStorage.setItem(
      "lingua-bbc-favorites-v1",
      JSON.stringify(favorites.value),
    );
  }
}

export async function loadLearnerProfile() {
  const user = currentUser.value;
  const pKey = profileStorageKey(user);
  const fKey = favoritesStorageKey(user);
  const hasLocal = !!localStorage.getItem(pKey);

  try {
    const { profile: saved } = await api.profile();
    if (saved) {
      applyProfileData(saved.state, saved.favorites);
      persistLocalSnapshot();
    } else if (hasLocal) {
      applyProfileData(
        read<Partial<Profile>>(pKey, {}),
        read<string[]>(fKey, []),
      );
      await api.saveProfile(profile, favorites.value);
    } else {
      applyProfileData(null, []);
      await api.saveProfile(profile, favorites.value);
      persistLocalSnapshot();
    }
    syncState.value = user ? "已同步账号" : "已同步本机";
  } catch {
    if (hasLocal) {
      applyProfileData(
        read<Partial<Profile>>(pKey, {}),
        read<string[]>(fKey, []),
      );
    } else {
      applyProfileData(null, []);
    }
    syncState.value = "离线暂存本地";
  }
}

export async function initialize() {
  const [loadedContent, meRes] = await Promise.all([
    api.content(),
    api.auth.me().catch(() => ({ user: null })),
  ]);
  content.value = loadedContent;
  currentUser.value = meRes.user;
  if (!meRes.user && getAuthToken()) {
    setAuthToken(null);
  }
  authReady.value = true;
  await loadLearnerProfile();
}

export async function applyAuthSession(user: User, token: string) {
  clearTimeout(saveTimer);
  setAuthToken(token);
  currentUser.value = user;
  placementNudgeDismissed.value = false;
  await loadLearnerProfile();
}

export async function logoutSession() {
  clearTimeout(saveTimer);
  try {
    await api.auth.logout();
  } catch {
    // Ignore network errors on logout
  }
  setAuthToken(null);
  currentUser.value = null;
  placementNudgeDismissed.value = false;
  await loadLearnerProfile();
}

export async function saveProfileNow(keepalive = false) {
  clearTimeout(saveTimer);
  persistLocalSnapshot();
  try {
    await api.saveProfile(profile, favorites.value, keepalive);
    syncState.value = currentUser.value ? "已同步账号" : "已同步本机";
  } catch {
    syncState.value = "本地已保存，待同步";
  }
}

export function recordAnswerHistory(entry: AnswerRecordInput) {
  return api.learning.saveAnswer(entry).catch(() => null);
}

watch(
  [() => profile, favorites],
  () => {
    if (hydrating) return;
    persistLocalSnapshot();
    syncState.value = "正在保存…";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      void saveProfileNow();
    }, 250);
  },
  { deep: true },
);

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && content.value) {
      void saveProfileNow(true);
    }
  });
  window.addEventListener("pagehide", () => {
    if (content.value) {
      void saveProfileNow(true);
    }
  });
}

export function toggleFavorite(id: string) {
  favorites.value = favorites.value.includes(id)
    ? favorites.value.filter((x) => x !== id)
    : [...favorites.value, id];
  toast(favorites.value.includes(id) ? "已收藏本集" : "已取消收藏");
}
