<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import {
  content,
  currentUser,
  logoutSession,
  profile,
  toast,
} from "../composables/useProfile";
import { courseKey } from "../domain/learning";
import { api } from "../api/client";
import { dateText } from "../domain/transcript";
import type {
  AnswerRecord,
  AnswerStats,
  Attempt,
  PlacementResult,
} from "../types";

const router = useRouter();
const tab = ref<"all" | "wrong" | "rounds" | "shadowing">("all");
const records = ref<AnswerRecord[]>([]);
const stats = ref<AnswerStats>({ total: 0, correct: 0, wrong: 0, today: 0 });
const loadingRecords = ref(false);
const hasMore = ref(false);
const attempts = ref<Attempt[]>([]);
const latestPlacement = ref<PlacementResult | null>(null);

const modeLabels: Record<string, string> = {
  new: "新词",
  spelling: "拼写",
  listening: "听力",
  reverse: "选词",
};

const totalAnswered = computed(() =>
  Math.max(stats.value.total, profile.total),
);
const accuracyRate = computed(() => {
  if (stats.value.total > 0) {
    return Math.round((stats.value.correct / stats.value.total) * 100);
  }
  return profile.total
    ? Math.round((profile.correct / profile.total) * 100)
    : 0;
});

function selectCourse(key: string) {
  profile.course = key;
  profile.preference = "content";
  if (key !== "general") profile.lang = "en";
  toast("已选择 " + content.value!.courses[key].name);
}

async function fetchAnswerRecords(resetList = true) {
  loadingRecords.value = true;
  try {
    const filter = tab.value === "wrong" ? "wrong" : "all";
    const offset = resetList ? 0 : records.value.length;
    const res = await api.learning.answers({ limit: 20, offset, filter });
    stats.value = res.stats;
    if (resetList) {
      records.value = res.records;
    } else {
      records.value.push(...res.records);
    }
    hasMore.value = res.records.length === 20;
  } catch {
    // Offline fallback silently keeps existing list
  } finally {
    loadingRecords.value = false;
  }
}

function switchTab(nextTab: "all" | "wrong" | "rounds" | "shadowing") {
  tab.value = nextTab;
  if (nextTab === "all" || nextTab === "wrong") {
    void fetchAnswerRecords(true);
  }
}

async function handleLogout() {
  await logoutSession();
  toast("已退出登录");
  await fetchAnswerRecords(true);
  latestPlacement.value = null;
}

onMounted(async () => {
  await Promise.all([
    fetchAnswerRecords(true),
    api
      .attempts()
      .then((res) => (attempts.value = res.attempts))
      .catch(() => {}),
    api.placement
      .latest()
      .then((res) => (latestPlacement.value = res.latest))
      .catch(() => {}),
  ]);
});
</script>

<template>
  <div class="my-wrap">
    <section class="card account-banner">
      <div class="account-info">
        <div class="account-title-row">
          <h2>
            {{
              currentUser
                ? `${currentUser.displayName} (@${currentUser.username})`
                : "游客学习空间"
            }}
          </h2>
          <span v-if="currentUser?.englishLevel || latestPlacement" class="tag">
            英语水平 {{ currentUser?.englishLevel || latestPlacement?.level }}
          </span>
        </div>
        <p class="sub">
          <template v-if="currentUser && currentUser.assessmentCompleted">
            推荐词库：{{
              content?.courses[
                currentUser.recommendedCourse || latestPlacement?.recommendedCourse || "general"
              ]?.name || "日常生活"
            }}
            <template v-if="latestPlacement"> · 评测得分 {{ latestPlacement.score }} 分</template>
          </template>
          <template v-else-if="currentUser">
            尚未完成新用户英语水平评测，评测后可获得针对性词库推荐。
          </template>
          <template v-else>
            当前以本机游客身份学习。注册账号可自动保存答题记录与水平评测报告。
          </template>
        </p>
      </div>

      <div class="account-actions">
        <RouterLink to="/placement" class="primary">
          {{
            currentUser?.assessmentCompleted || latestPlacement
              ? "重新评测水平"
              : "英语水平评测 →"
          }}
        </RouterLink>
        <button v-if="currentUser" class="bbc-secondary" @click="handleLogout">
          退出登录
        </button>
        <RouterLink v-else to="/auth" class="bbc-secondary">
          登录 / 注册
        </RouterLink>
      </div>
    </section>

    <section class="stats-strip">
      <div class="stat-tile">
        <b>{{ totalAnswered }}</b>
        <small>累计答题</small>
      </div>
      <div class="stat-tile">
        <b>{{ accuracyRate }}%</b>
        <small>总体正确率</small>
      </div>
      <div class="stat-tile">
        <b>{{ stats.today }}</b>
        <small>今日答题</small>
      </div>
      <div class="stat-tile">
        <b>{{ profile.records.length }}</b>
        <small>完成轮次</small>
      </div>
    </section>

    <section class="card">
      <div class="card-title">
        <h2>学习内容与偏好</h2>
        <span class="tag">{{ content!.courses[courseKey(profile)].name }}</span>
      </div>

      <div class="preference-fields compact-fields">
        <div>
          <label for="language">学习语言</label>
          <select id="language" v-model="profile.lang">
            <option
              v-for="(language, key) in content!.languages"
              :key="key"
              :value="key"
            >
              {{ language[0] }} · {{ language[1] }}
            </option>
          </select>
        </div>

        <div>
          <label for="vocabularySource">词库模式</label>
          <select id="vocabularySource" v-model="profile.preference">
            <option value="foundation">基础日常词库</option>
            <option value="content">跟随选定课程</option>
          </select>
        </div>

        <div>
          <label for="size">每轮词数</label>
          <select
            id="size"
            v-model.number="profile.size"
            @change="toast('将在下一轮生效')"
          >
            <option v-for="size in [10, 15, 20]" :key="size" :value="size">
              {{ size }} 词
            </option>
          </select>
        </div>
      </div>

      <div class="course-chips" role="group" aria-label="课程选择">
        <button
          v-for="(course, key) in content!.courses"
          :key="key"
          class="course-chip"
          :class="{ chosen: profile.course === key }"
          @click="selectCourse(key)"
        >
          <b>{{ course.name }}</b>
          <small>{{ course.description }}</small>
        </button>
      </div>

      <div class="course-go-row">
        <button class="primary" @click="router.push('/')">开始学习 →</button>
      </div>
    </section>

    <section class="card">
      <div class="history-header">
        <h2>持久化答题记录</h2>
        <div class="history-tabs" role="tablist">
          <button
            :class="{ active: tab === 'all' }"
            @click="switchTab('all')"
          >
            全部 ({{ stats.total }})
          </button>
          <button
            :class="{ active: tab === 'wrong' }"
            @click="switchTab('wrong')"
          >
            错题 ({{ stats.wrong }})
          </button>
          <button
            :class="{ active: tab === 'rounds' }"
            @click="switchTab('rounds')"
          >
            完成轮次 ({{ profile.records.length }})
          </button>
          <button
            v-if="attempts.length"
            :class="{ active: tab === 'shadowing' }"
            @click="switchTab('shadowing')"
          >
            跟读 ({{ attempts.length }})
          </button>
        </div>
      </div>

      <template v-if="tab === 'all' || tab === 'wrong'">
        <div v-if="records.length" class="answer-log">
          <article
            v-for="item in records"
            :key="item.id"
            class="answer-log-row"
          >
            <div class="answer-log-main">
              <div class="answer-log-word">
                <b>{{ item.word }}</b>
                <span class="micro">{{ item.meaning }}</span>
                <span class="tag">{{ modeLabels[item.mode] || item.mode }}</span>
              </div>
              <div class="answer-log-meta">
                <span v-if="!item.isCorrect" class="wrong-detail">
                  作答：{{ item.userAnswer || "—" }} · 正确：{{ item.correctAnswer }}
                </span>
                <span v-else class="micro">
                  {{ content?.courses[item.course]?.name || "日常生活" }}
                </span>
              </div>
            </div>
            <div class="answer-log-right">
              <span :class="item.isCorrect ? 'status-ok' : 'status-bad'">
                {{ item.isCorrect ? "✓ 正确" : "✕ 错误" }}
              </span>
              <time class="micro">{{ dateText(item.createdAt) }}</time>
            </div>
          </article>
        </div>
        <p v-else class="sub empty-note">
          {{
            loadingRecords
              ? "正在加载答题记录…"
              : tab === "wrong"
                ? "暂无错题记录，继续保持。"
                : "还没有答题记录，去学习页完成第一题吧。"
          }}
        </p>

        <button
          v-if="hasMore"
          class="bbc-load-more"
          :disabled="loadingRecords"
          @click="fetchAnswerRecords(false)"
        >
          {{ loadingRecords ? "加载中…" : "加载更多记录" }}
        </button>
      </template>

      <template v-else-if="tab === 'rounds'">
        <div v-if="profile.records.length" class="table-scroll">
          <table class="history">
            <thead>
              <tr>
                <th>完成时间</th>
                <th>内容</th>
                <th>词数</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(record, i) in profile.records" :key="i">
                <td>{{ record.date }}</td>
                <td>
                  {{ content!.languages[record.lang][0] }} ·
                  {{ content!.courses[record.course]?.name || "日常生活" }}
                </td>
                <td>{{ record.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="sub empty-note">
          完成整轮词汇（每个词连续答对 3 次）后会在此生成完成记录。
        </p>
      </template>

      <template v-else>
        <article
          v-for="attempt in attempts.slice(0, 20)"
          :key="attempt.id"
          class="attempt-row"
        >
          <span>{{ attempt.reference }}</span>
          <b>{{ attempt.assessment.score }} <small>/ 100</small></b>
        </article>
      </template>
    </section>
  </div>
</template>
