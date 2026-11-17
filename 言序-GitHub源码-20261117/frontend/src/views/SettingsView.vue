<script setup lang="ts">
import { profile, favorites } from "../composables/useProfile";
import type { Theme } from "../types";
import PageIntro from "../components/PageIntro.vue";
const themes: { key: Theme; name: string; color: string }[] = [
  { key: "system", name: "跟随系统", color: "#969d8e" },
  { key: "dark", name: "黑色高级", color: "#171c17" },
  { key: "fresh", name: "小清新", color: "#acdbca" },
  { key: "eye", name: "护眼模式", color: "#c3d0ad" },
  { key: "light", name: "浅色简约", color: "#eeeee4" },
];
function exportData() {
  const object = URL.createObjectURL(
    new Blob(
      [JSON.stringify({ state: profile, favorites: favorites.value }, null, 2)],
      { type: "application/json" },
    ),
  );
  const link = document.createElement("a");
  link.href = object;
  link.download = "言序学习记录.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(object), 1000);
}
</script>
<template>
  <PageIntro
    title="让学习，更合你的心意。"
    subtitle="调整界面外观，管理这台设备上的学习记录。"
    eyebrow="YOUR OWN WAY TO LEARN"
  />
  <div class="settings-grid">
    <section class="card">
      <h2>外观主题</h2>
      <div class="themes">
        <button
          v-for="theme in themes"
          :key="theme.key"
          :class="{ chosen: profile.theme === theme.key }"
          @click="profile.theme = theme.key"
        >
          <i :style="{ background: theme.color }"></i>{{ theme.name }}
        </button>
      </div>
      <p class="sub preference-note">默认跟随手机或浏览器的深色 / 浅色设置。</p>
    </section>
    <section class="card wide">
      <h2>关于你的进度</h2>
      <p class="sub">
        学习记录保存在本机，并同步到当前学习档案。此版本的设备标识不等同于账号登录，更换浏览器不会自动关联。
      </p>
      <button class="primary preference-note" @click="exportData">
        导出学习记录 ↓
      </button>
    </section>
  </div>
</template>
