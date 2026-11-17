<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  initialize,
  content,
  currentUser,
  syncState,
  toastMessage,
} from "./composables/useProfile";
import { toggleTheme } from "./composables/useTheme";
import PlayerDock from "./components/PlayerDock.vue";

const route = useRoute();
const error = ref("");

const links = [
  { name: "learn", to: "/", icon: "◈", label: "学习" },
  { name: "articles", to: "/articles", icon: "▤", label: "文章" },
  { name: "corner", to: "/corner", icon: "◉", label: "语言角" },
  { name: "my", to: "/my", icon: "▥", label: "我的" },
  { name: "settings", to: "/settings", icon: "⚙", label: "设置" },
];

const isActive = (name: string) =>
  name === "corner"
    ? ["corner", "bbc", "favorites", "episode"].includes(String(route.name))
    : name === "articles"
      ? ["articles", "article-detail"].includes(String(route.name))
      : route.name === name;

const userInitial = computed(() => {
  if (!currentUser.value) return "游";
  const name = currentUser.value.displayName || currentUser.value.username;
  return name.slice(0, 1).toUpperCase();
});

async function load() {
  error.value = "";
  try {
    await initialize();
  } catch (e) {
    error.value = e instanceof Error ? e.message : "服务未启动";
  }
}

onMounted(load);
</script>

<template>
  <aside>
    <RouterLink class="brand" to="/">
      <span class="logo">言</span>
      <span class="brand-name">言序</span>
    </RouterLink>
    <nav aria-label="主导航">
      <RouterLink
        v-for="link in links"
        :key="link.name"
        :to="link.to"
        custom
        v-slot="{ navigate }"
      >
        <button
          :data-page="link.name"
          :class="{ active: isActive(link.name) }"
          @click="navigate"
        >
          {{ link.icon }} <span>{{ link.label }}</span>
        </button>
      </RouterLink>
    </nav>
    <div class="side-bottom">
      <RouterLink
        :to="currentUser ? '/my' : '/auth'"
        class="profile-link"
      >
        <div class="profile">
          <b>{{ userInitial }}</b>
          <span class="profile-meta">
            {{ currentUser ? currentUser.displayName : "游客模式" }}
            <small v-if="currentUser?.englishLevel">
              英语等级 {{ currentUser.englishLevel }}
            </small>
            <small v-else>
              {{ currentUser ? "点击查看档案" : "登录 / 注册保存进度" }}
            </small>
          </span>
          <span>↗</span>
        </div>
      </RouterLink>
    </div>
  </aside>

  <main>
    <header>
      <span class="header-title">{{ route.meta.title }}</span>
      <div class="header-actions">
        <RouterLink
          :to="currentUser ? '/my' : '/auth'"
          class="header-user-pill"
        >
          <span class="pill-dot">{{ userInitial }}</span>
          <span>{{ currentUser ? currentUser.displayName : "登录 / 注册" }}</span>
        </RouterLink>
        <span class="status" :title="syncState">● {{ syncState }}</span>
        <button aria-label="切换明暗" title="切换深浅色" @click="toggleTheme">
          ◐
        </button>
      </div>
    </header>

    <div id="app">
      <RouterView v-if="content" />
      <section v-else class="card loading-card">
        <h2>{{ error ? "暂时无法连接学习服务" : "正在进入言序…" }}</h2>
        <p class="sub">{{ error || "正在加载课程与档案" }}</p>
        <button v-if="error" class="primary" @click="load">重试连接</button>
      </section>
    </div>
  </main>

  <PlayerDock />

  <div
    id="toast"
    role="status"
    :style="{ display: toastMessage ? 'block' : 'none' }"
  >
    {{ toastMessage }}
  </div>
</template>
