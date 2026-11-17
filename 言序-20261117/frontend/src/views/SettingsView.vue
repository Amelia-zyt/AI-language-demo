<script setup lang="ts">
import {
  currentUser,
  favorites,
  logoutSession,
  profile,
  toast,
} from "../composables/useProfile";
import type { Theme } from "../types";

const themes: { key: Theme; name: string; color: string }[] = [
  { key: "system", name: "跟随系统", color: "#969d8e" },
  { key: "dark", name: "深色质感", color: "#171c17" },
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

async function logout() {
  await logoutSession();
  toast("已退出登录");
}
</script>

<template>
  <div class="settings-wrap">
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
    </section>

    <section class="card">
      <h2>数据与账号</h2>
      <p class="sub">
        {{
          currentUser
            ? `已登录账号：${currentUser.displayName}（@${currentUser.username}），所有答题记录与课程进度均已云端持久化。`
            : "当前处于游客模式，数据保存在本机并同步至服务端设备档案；注册登录后可跨设备同步。"
        }}
      </p>
      <div class="settings-actions">
        <button class="primary" @click="exportData">导出学习档案 JSON ↓</button>
        <button v-if="currentUser" class="bbc-secondary" @click="logout">
          退出账号
        </button>
        <RouterLink v-else to="/auth" class="bbc-secondary">
          登录 / 注册
        </RouterLink>
      </div>
      <p class="micro settings-domain">站点域名：lingua.exhan.dpdns.org</p>
    </section>
  </div>
</template>
