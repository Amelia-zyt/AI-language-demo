<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/client";
import {
  content,
  currentUser,
  placementNudgeDismissed,
  profile,
  saveProfileNow,
  toast,
} from "../composables/useProfile";
import { speak } from "../composables/useSpeech";
import type { PlacementQuestion, PlacementResult } from "../types";

const router = useRouter();
const questions = ref<PlacementQuestion[]>([]);
const index = ref(0);
const selections = ref<Record<string, number>>({});
const loading = ref(true);
const submitting = ref(false);
const result = ref<PlacementResult | null>(null);
const showReview = ref(false);
const errorMsg = ref("");
const cardRef = ref<HTMLElement | null>(null);

const currentQuestion = computed(() => questions.value[index.value]);
const total = computed(() => questions.value.length);
const answeredCount = computed(() => Object.keys(selections.value).length);
const selectedForCurrent = computed(() =>
  currentQuestion.value ? selections.value[currentQuestion.value.id] ?? null : null,
);

function scrollToCardTop() {
  const el = cardRef.value;
  if (!el) return;
  const isMobile = window.matchMedia("(max-width: 850px), (pointer: coarse)").matches;
  const rect = el.getBoundingClientRect();
  if (isMobile || rect.top < 12 || rect.top > window.innerHeight * 0.45) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

async function loadTest() {
  loading.value = true;
  errorMsg.value = "";
  try {
    const data = await api.placement.test();
    questions.value = data.questions;
    index.value = 0;
    selections.value = {};
    result.value = null;
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : "评测题目加载失败";
  } finally {
    loading.value = false;
  }
}

function chooseOption(optIndex: number) {
  if (!currentQuestion.value) return;
  selections.value[currentQuestion.value.id] = optIndex;
}

async function prevQuestion() {
  if (index.value <= 0) return;
  (document.activeElement as HTMLElement | null)?.blur?.();
  index.value--;
  await nextTick();
  scrollToCardTop();
}

async function nextQuestion() {
  if (!currentQuestion.value) return;
  if (selectedForCurrent.value === null) {
    toast("请先选择一个选项");
    return;
  }
  (document.activeElement as HTMLElement | null)?.blur?.();
  if (index.value < total.value - 1) {
    index.value++;
    await nextTick();
    scrollToCardTop();
    return;
  }
  await submitTest();
}

async function submitTest() {
  submitting.value = true;
  errorMsg.value = "";
  try {
    const answers = questions.value.map((q) => ({
      questionId: q.id,
      selectedIndex: selections.value[q.id] ?? -1,
    }));
    const res = await api.placement.submit(answers);
    result.value = res.result;
    if (res.user) {
      currentUser.value = res.user;
    }
    await nextTick();
    scrollToCardTop();
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : "提交失败，请重试";
  } finally {
    submitting.value = false;
  }
}

async function applyRecommendedCourse() {
  if (!result.value) return;
  const course = result.value.recommendedCourse;
  profile.lang = "en";
  if (course === "general") {
    profile.course = "general";
    profile.preference = "foundation";
  } else if (content.value?.courses[course]) {
    profile.course = course;
    profile.preference = "content";
  }
  await saveProfileNow();
  toast(`已为你切换至「${result.value.courseName}」`);
  await router.push("/");
}

function skipForNow() {
  placementNudgeDismissed.value = true;
  void router.push("/");
}

function playListening(rate = 0.9) {
  if (!currentQuestion.value?.audioText) return;
  speak(currentQuestion.value.audioText, "en-GB", rate);
}

onMounted(loadTest);
</script>

<template>
  <div class="placement-wrap">
    <section v-if="loading" class="card study-focused">
      <p class="sub">正在准备英语水平评测题目…</p>
    </section>

    <section v-else-if="errorMsg && !result && !questions.length" class="card study-focused">
      <h2>评测加载失败</h2>
      <p class="sub">{{ errorMsg }}</p>
      <button class="primary" @click="loadTest">重新加载</button>
    </section>

    <section v-else-if="result" ref="cardRef" class="card study-focused placement-result">
      <div class="placement-badge-row">
        <span class="tag">水平评测报告</span>
        <span class="micro">{{ result.correctCount }} / {{ result.totalQuestions }} 题正确</span>
      </div>

      <div class="placement-score-hero">
        <div class="level-pill">{{ result.level }}</div>
        <div>
          <h2>{{ result.levelLabel }}</h2>
          <p class="sub">{{ result.summary }}</p>
        </div>
        <div class="score-num">
          <strong>{{ result.score }}</strong><small> / 100</small>
        </div>
      </div>

      <div class="skill-bars">
        <div v-for="skill in result.skills" :key="skill.skill" class="skill-row">
          <div class="skill-meta">
            <span>{{ skill.label }}</span>
            <small>{{ skill.percent }}%</small>
          </div>
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: skill.percent + '%' }"></div>
          </div>
        </div>
      </div>

      <div class="recommend-box">
        <div>
          <span class="micro">推荐起步词库</span>
          <strong>{{ result.courseName }}</strong>
        </div>
        <div class="recommend-actions">
          <button class="primary" @click="applyRecommendedCourse">
            应用推荐并开始学习 →
          </button>
          <button class="bbc-secondary" @click="loadTest">重新评测</button>
        </div>
      </div>

      <button class="link toggle-review-btn" @click="showReview = !showReview">
        {{ showReview ? "收起题目解析 ▴" : `查看逐题解析（${result.review.length} 题）▾` }}
      </button>

      <div v-if="showReview" class="review-list">
        <article
          v-for="(item, idx) in result.review"
          :key="item.questionId"
          class="review-item"
          :class="{ ok: item.isCorrect, bad: !item.isCorrect }"
        >
          <div class="review-head">
            <span>第 {{ idx + 1 }} 题 · {{ item.skillLabel }} ({{ item.level }})</span>
            <b>{{ item.isCorrect ? "✓ 正确" : "✕ 未对" }}</b>
          </div>
          <p class="review-prompt">{{ item.prompt }}</p>
          <p v-if="item.passage" class="review-passage">{{ item.passage }}</p>
          <p v-if="item.audioText" class="review-passage">听力原文：{{ item.audioText }}</p>
          <p class="review-answer">
            你的选择：{{
              item.selectedIndex >= 0 ? item.options[item.selectedIndex] : "未作答"
            }}
            <template v-if="!item.isCorrect">
              · 正确答案：<strong>{{ item.options[item.correctIndex] }}</strong>
            </template>
          </p>
          <p class="sub">{{ item.explanation }}</p>
        </article>
      </div>
    </section>

    <section
      v-else-if="currentQuestion"
      ref="cardRef"
      class="study study-focused placement-card"
    >
      <div class="progress-track slim">
        <div
          class="progress-fill"
          :style="{ width: ((index + 1) / total) * 100 + '%' }"
        ></div>
      </div>

      <div class="study-top compact">
        <div class="study-meta-left">
          <span class="tag">{{ currentQuestion.skillLabel }}</span>
          <span class="micro">难度 {{ currentQuestion.level }}</span>
        </div>
        <span class="micro">第 {{ index + 1 }} / {{ total }} 题</span>
      </div>

      <div class="question compact-question">
        <p class="placement-prompt">{{ currentQuestion.prompt }}</p>

        <blockquote v-if="currentQuestion.passage" class="placement-passage">
          {{ currentQuestion.passage }}
        </blockquote>

        <div v-if="currentQuestion.audioText" class="placement-audio-box">
          <button type="button" class="primary" @click="playListening(0.95)">
            ♪ 播放题目语音
          </button>
          <button
            type="button"
            class="bbc-secondary"
            @click="playListening(0.75)"
          >
            慢速再听一遍
          </button>
        </div>

        <div class="placement-options">
          <button
            v-for="(option, optIdx) in currentQuestion.options"
            :key="optIdx"
            type="button"
            class="answer"
            :class="{ selected: selectedForCurrent === optIdx }"
            @click="chooseOption(optIdx)"
          >
            <em>{{ "ABCD"[optIdx] }}</em>
            <span class="option-text">{{ option }}</span>
          </button>
        </div>

        <p v-if="errorMsg" class="auth-error">{{ errorMsg }}</p>
      </div>

      <div class="study-bottom compact">
        <div class="placement-nav-left">
          <button
            v-if="index > 0"
            type="button"
            class="link"
            @click="prevQuestion"
          >
            ← 上一题
          </button>
          <button
            v-else
            type="button"
            class="link"
            @click="skipForNow"
          >
            暂先跳过
          </button>
          <span class="micro">已答 {{ answeredCount }} / {{ total }}</span>
        </div>

        <button
          type="button"
          class="primary"
          :disabled="submitting"
          @click="nextQuestion"
        >
          {{
            submitting
              ? "正在生成报告…"
              : index === total - 1
                ? "提交评测 →"
                : "下一题 →"
          }}
        </button>
      </div>
    </section>
  </div>
</template>
