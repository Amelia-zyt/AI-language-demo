import { watch } from "vue";
import { profile } from "./useProfile";
const media = matchMedia("(prefers-color-scheme: dark)");
function apply() {
  document.body.dataset.theme =
    profile.theme === "system"
      ? media.matches
        ? "dark"
        : "light"
      : profile.theme;
}
watch(() => profile.theme, apply, { immediate: true });
media.addEventListener("change", apply);
export function toggleTheme() {
  profile.theme = document.body.dataset.theme === "dark" ? "light" : "dark";
}
