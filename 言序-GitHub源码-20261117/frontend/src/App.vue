<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import {
  initialize,
  content,
  syncState,
  toastMessage,
} from "./composables/useProfile";
import { toggleTheme } from "./composables/useTheme";
import PlayerDock from "./components/PlayerDock.vue";
const route = useRoute(),
  error = ref("");
const links = [
{name:"speaking",to:"/speaking",icon:"♬",label:"口语",english:"SPEAK"},
  { name: "learn", to: "/", icon: "◈", label: "学习", english: "LEARN" },
  {
    name: "corner",
    to: "/corner",
    icon: "◉",
    label: "语言角",
    english: "CORNER",
  },
  { name: "my", to: "/my", icon: "▥", label: "我的", english: "MY SPACE" },
  {
    name: "settings",
    to: "/settings",
    icon: "⚙",
    label: "设置",
    english: "SETTINGS",
  },
];
const isActive = (name: string) =>
  name === "corner"
    ? ["corner", "bbc", "favorites", "episode"].includes(String(route.name))
    : route.name === name;
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
    <RouterLink class="brand" to="/"
      ><span class="logo">言</span>言序 <small>LINGUA</small></RouterLink
    >
    <div class="aside-label">你的语言自习室</div>
    <nav>
      <RouterLink
        v-for="link in links"
        :key="link.name"
        :to="link.to"
        custom
        v-slot="{ navigate }"
        ><button
          :data-page="link.name"
          :class="{ active: isActive(link.name) }"
          @click="navigate"
        >
          {{ link.icon }} <span>{{ link.label }}</span
          ><small>{{ link.english }}</small>
        </button></RouterLink
      >
    </nav>
    <div class="side-bottom">
      <div class="tiny-orbit">✧</div>
      <p>语言，让世界近一点。</p>
      <small>A little every day. A world away.</small>
      <div class="profile">
        <b>初</b><span>语言探索者<small>保持好奇，慢慢生长</small></span
        ><span>↗</span>
      </div>
    </div>
  </aside>
  <main>
    <header>
      <span>自习室 <i>/</i> {{ route.meta.title }}</span>
      <div>
        <button aria-label="切换明暗" @click="toggleTheme">◐</button
        ><span class="status">● {{ syncState }}</span>
      </div>
    </header>
    <div id="app">
      <RouterView v-if="content || route.name === 'speaking'" />
      <section v-else class="card loading-card">
        <h2>{{ error ? "暂时无法连接学习服务" : "正在打开自习室…" }}</h2>
        <p class="sub">{{ error || "正在读取学习内容" }}</p>
        <button v-if="error" class="primary" @click="load">重试连接</button>
      </section>
    </div>
    <footer>
      <span>言序 LINGUA</span><span>每一次重复，都在靠近更大的世界。</span
      ><span>按自己的节奏，慢慢来 ↗</span>
    </footer>
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

