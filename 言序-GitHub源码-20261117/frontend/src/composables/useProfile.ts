import { reactive, ref, watch } from "vue";
import { api } from "../api/client";
import type { LearningContent, Profile } from "../types";
const defaults: Profile = {
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
function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") || fallback;
  } catch {
    return fallback;
  }
}
const hadLocal = !!localStorage.getItem("lingua-v1");
export const profile = reactive<Profile>({
  ...defaults,
  ...read<Partial<Profile>>("lingua-v1", {}),
});
export const favorites = ref<string[]>(read("lingua-bbc-favorites-v1", []));
export const content = ref<LearningContent | null>(null);
export const syncState = ref("本地进度已保存");
export const toastMessage = ref("");
let timer: ReturnType<typeof setTimeout>,
  toastTimer: ReturnType<typeof setTimeout>;
export function toast(text: string) {
  toastMessage.value = text;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastMessage.value = ""), 3000);
}
export async function initialize() {
  content.value = await api.content();
  if (!content.value.courses[profile.course]) profile.course = "general";
  try {
    const { profile: saved } = await api.profile();
    if (!hadLocal && saved) {
      Object.assign(profile, saved.state);
      favorites.value = saved.favorites;
    } else await api.saveProfile(profile, favorites.value);
    syncState.value = "学习档案已同步";
  } catch {
    syncState.value = "已保存本地，服务同步稍后重试";
  }
}
watch(
  [() => profile, favorites],
  () => {
    localStorage.setItem("lingua-v1", JSON.stringify(profile));
    localStorage.setItem(
      "lingua-bbc-favorites-v1",
      JSON.stringify(favorites.value),
    );
    syncState.value = "本地进度已保存";
    clearTimeout(timer);
    timer = setTimeout(
      () =>
        api
          .saveProfile(profile, favorites.value)
          .then(() => (syncState.value = "学习档案已同步"))
          .catch(() => (syncState.value = "已保存本地，暂未同步")),
      600,
    );
  },
  { deep: true },
);
export function toggleFavorite(id: string) {
  favorites.value = favorites.value.includes(id)
    ? favorites.value.filter((x) => x !== id)
    : [...favorites.value, id];
  toast(favorites.value.includes(id) ? "已收藏本集" : "已取消收藏");
}
