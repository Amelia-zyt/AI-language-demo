<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/client";
import { applyAuthSession, toast } from "../composables/useProfile";

const router = useRouter();
const tab = ref<"login" | "register">("login");
const username = ref("");
const displayName = ref("");
const password = ref("");
const confirmPassword = ref("");
const busy = ref(false);
const errorMsg = ref("");

function switchTab(next: "login" | "register") {
  tab.value = next;
  errorMsg.value = "";
}

async function submit() {
  errorMsg.value = "";
  const u = username.value.trim();
  if (!u || !password.value) {
    errorMsg.value = "请填写用户名和密码";
    return;
  }
  if (tab.value === "register") {
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(u)) {
      errorMsg.value = "用户名需为 3–32 位字母、数字、下划线或短横线";
      return;
    }
    if (password.value.length < 6) {
      errorMsg.value = "密码至少需要 6 个字符";
      return;
    }
    if (password.value !== confirmPassword.value) {
      errorMsg.value = "两次输入的密码不一致";
      return;
    }
  }

  busy.value = true;
  try {
    if (tab.value === "register") {
      const res = await api.auth.register(
        u,
        password.value,
        displayName.value.trim() || undefined,
      );
      await applyAuthSession(res.user, res.token);
      toast("注册成功，开始英语水平评测");
      await router.replace("/placement");
    } else {
      const res = await api.auth.login(u, password.value);
      await applyAuthSession(res.user, res.token);
      toast(`欢迎回来，${res.user.displayName}`);
      if (!res.user.assessmentCompleted) {
        await router.replace("/placement");
      } else {
        await router.replace("/");
      }
    }
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : "操作失败，请重试";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="auth-wrap">
    <section class="card auth-card">
      <div class="auth-tabs" role="tablist">
        <button
          role="tab"
          :aria-selected="tab === 'login'"
          :class="{ active: tab === 'login' }"
          @click="switchTab('login')"
        >
          登录
        </button>
        <button
          role="tab"
          :aria-selected="tab === 'register'"
          :class="{ active: tab === 'register' }"
          @click="switchTab('register')"
        >
          注册新账号
        </button>
      </div>

      <h1>{{ tab === "register" ? "创建你的学习档案" : "回到言序继续学习" }}</h1>
      <p class="sub">
        {{
          tab === "register"
            ? "注册后将为你安排约 2 分钟的英语水平评测，并永久保存所有答题记录。"
            : "登录后可跨设备同步词汇进度、答题记录与水平评测结果。"
        }}
      </p>

      <form class="auth-form" @submit.prevent="submit">
        <div>
          <label for="authUsername">用户名</label>
          <input
            id="authUsername"
            v-model="username"
            autocomplete="username"
            autocapitalize="off"
            spellcheck="false"
            placeholder="3-32位字母、数字、下划线"
            required
          />
        </div>

        <div v-if="tab === 'register'">
          <label for="authDisplay">昵称（可选）</label>
          <input
            id="authDisplay"
            v-model="displayName"
            maxlength="32"
            placeholder="留空则使用用户名"
          />
        </div>

        <div>
          <label for="authPassword">密码</label>
          <input
            id="authPassword"
            v-model="password"
            type="password"
            :autocomplete="tab === 'register' ? 'new-password' : 'current-password'"
            placeholder="至少 6 位字符"
            required
          />
        </div>

        <div v-if="tab === 'register'">
          <label for="authConfirm">确认密码</label>
          <input
            id="authConfirm"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            placeholder="再次输入密码"
            required
          />
        </div>

        <p v-if="errorMsg" class="auth-error" role="alert">{{ errorMsg }}</p>

        <button class="primary auth-submit" type="submit" :disabled="busy">
          {{
            busy
              ? "处理中…"
              : tab === "register"
                ? "注册并开始水平评测 →"
                : "登录 →"
          }}
        </button>
      </form>

      <div class="auth-footer">
        <RouterLink to="/" class="link">先以游客身份体验 →</RouterLink>
      </div>
    </section>
  </div>
</template>
