<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { api } from "../api/client";
import { toast } from "../composables/useProfile";
import { speak } from "../composables/useSpeech";
import { renderSimpleMarkdown } from "../utils/markdown";
import type { Article, ArticleExplainResponse } from "../types";

const route = useRoute();
const router = useRouter();

const articles = ref<Article[]>([]);
const aiConfigured = ref(false);
const loading = ref(true);
const loadError = ref("");
const stage = ref<"all" | "primary" | "junior" | "senior">("all");

const showZh = ref(true);
const showKeyPoints = ref(true);
const speakingAll = ref(false);

const aiBusy = ref(false);
const aiError = ref("");
const aiResponse = ref<ArticleExplainResponse | null>(null);
const aiTargetLabel = ref("全文精讲");
const activeParaIndex = ref(0);
const questionInput = ref("");
const aiPanelRef = ref<HTMLElement | null>(null);

const activeArticle = computed(() => {
  const id = route.params.id ? String(route.params.id) : "";
  if (!id) return null;
  return articles.value.find((a) => a.id === id) || null;
});

const filteredArticles = computed(() => {
  if (stage.value === "all") return articles.value;
  if (stage.value === "primary") {
    return articles.value.filter((a) => a.grade.includes("小学"));
  }
  if (stage.value === "junior") {
    return articles.value.filter((a) => a.grade.includes("初中"));
  }
  return articles.value.filter((a) => a.grade.includes("高中"));
});

const aiHtml = computed(() =>
  aiResponse.value ? renderSimpleMarkdown(aiResponse.value.explanation) : "",
);

async function fetchArticles() {
  loading.value = true;
  loadError.value = "";
  try {
    const res = await api.articles.list();
    articles.value = res.articles;
    aiConfigured.value = res.aiConfigured;
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : "文章加载失败";
  } finally {
    loading.value = false;
  }
}

function stopSpeech() {
  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
  }
  speakingAll.value = false;
}

function toggleReadAll() {
  if (!activeArticle.value) return;
  if (speakingAll.value) {
    stopSpeech();
    return;
  }
  const text = activeArticle.value.paragraphs.map((p) => p.en).join(" ");
  speakingAll.value = true;
  speak(text, "en-GB", 0.88);
}

function readParagraph(text: string) {
  speakingAll.value = false;
  speak(text, "en-GB", 0.88);
}

async function scrollToAI() {
  await nextTick();
  aiPanelRef.value?.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function requestAI(
  scope: "overview" | "paragraph" | "question",
  opts: { paragraphIndex?: number; question?: string; refresh?: boolean } = {},
) {
  if (!activeArticle.value) return;
  if (scope === "question" && !opts.question?.trim()) {
    toast("请先输入你的问题");
    return;
  }

  aiBusy.value = true;
  aiError.value = "";
  if (scope === "overview") aiTargetLabel.value = "全文精讲";
  else if (scope === "paragraph") {
    activeParaIndex.value = opts.paragraphIndex ?? 0;
    aiTargetLabel.value = `第 ${activeParaIndex.value + 1} 段精讲`;
  } else {
    aiTargetLabel.value = `问题解答：${opts.question!.trim().slice(0, 24)}`;
  }

  void scrollToAI();

  try {
    const res = await api.articles.explain({
      articleId: activeArticle.value.id,
      scope,
      paragraphIndex: opts.paragraphIndex,
      question: opts.question,
      refresh: opts.refresh,
    });
    aiResponse.value = res;
    if (scope === "question") questionInput.value = "";
  } catch (err) {
    aiError.value =
      err instanceof Error ? err.message : "DeepSeek AI 讲解生成失败";
  } finally {
    aiBusy.value = false;
  }
}

function refreshCurrentAI() {
  if (!aiResponse.value) return;
  if (aiResponse.value.scope === "paragraph") {
    void requestAI("paragraph", {
      paragraphIndex: activeParaIndex.value,
      refresh: true,
    });
  } else if (aiResponse.value.scope === "overview") {
    void requestAI("overview", { refresh: true });
  }
}

watch(
  () => route.params.id,
  () => {
    stopSpeech();
    aiResponse.value = null;
    aiError.value = "";
    questionInput.value = "";
    aiTargetLabel.value = "全文精讲";
  },
);

onMounted(fetchArticles);
onBeforeUnmount(stopSpeech);
</script>

<template>
  <div class="articles-wrap">
    <section v-if="loading" class="card">
      <p class="sub">正在加载教材文章…</p>
    </section>

    <section v-else-if="loadError" class="card">
      <h2>文章加载失败</h2>
      <p class="sub">{{ loadError }}</p>
      <button class="primary" @click="fetchArticles">重试</button>
    </section>

    <template v-else-if="route.params.id && !activeArticle">
      <section class="card">
        <h2>未找到该文章</h2>
        <p class="sub">请返回文章列表重新选择。</p>
        <RouterLink to="/articles" class="primary">返回文章列表</RouterLink>
      </section>
    </template>

    <!-- Reader Detail View -->
    <template v-else-if="activeArticle">
      <div class="article-topbar">
        <RouterLink to="/articles" class="link">← 返回文章列表</RouterLink>
        <span class="tag">
          Lv.{{ activeArticle.order }} · {{ activeArticle.difficultyLabel }}
        </span>
      </div>

      <section class="card article-header-card">
        <div class="article-meta-row">
          <span class="micro">{{ activeArticle.grade }}</span>
          <a
            class="micro article-source-link"
            :href="activeArticle.sourceUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ activeArticle.source }} ↗
          </a>
        </div>

        <h1>{{ activeArticle.title }}</h1>
        <p class="article-title-zh">{{ activeArticle.titleZh }}</p>

        <div class="article-toolbar">
          <button
            class="primary"
            :disabled="aiBusy"
            @click="requestAI('overview')"
          >
            ✦ AI 全文精讲
          </button>
          <button class="bbc-secondary" @click="toggleReadAll">
            {{ speakingAll ? "Ⅱ 停止朗读" : "♪ 朗读全文" }}
          </button>
          <label class="zh-toggle">
            <input type="checkbox" v-model="showZh" />
            <span>显示译文</span>
          </label>
        </div>
      </section>

      <section class="article-paragraphs">
        <article
          v-for="(para, idx) in activeArticle.paragraphs"
          :key="idx"
          class="card para-card"
        >
          <p class="para-en">{{ para.en }}</p>
          <p v-if="showZh" class="para-zh">{{ para.zh }}</p>
          <div class="para-actions">
            <button class="link" @click="readParagraph(para.en)">
              ♪ 朗读本段
            </button>
            <button
              class="link ai-para-btn"
              :disabled="aiBusy"
              @click="requestAI('paragraph', { paragraphIndex: idx })"
            >
              ✦ AI 讲解第 {{ idx + 1 }} 段
            </button>
          </div>
        </article>
      </section>

      <section class="card">
        <button
          class="drawer-toggle compact-kp-toggle"
          @click="showKeyPoints = !showKeyPoints"
        >
          <span>课本核心知识点（{{ activeArticle.keyPoints.length }} 条）</span>
          <span>{{ showKeyPoints ? "收起 ▴" : "展开 ▾" }}</span>
        </button>

        <div v-if="showKeyPoints" class="kp-list">
          <div
            v-for="(kp, i) in activeArticle.keyPoints"
            :key="i"
            class="kp-item"
          >
            <div class="kp-head">
              <b>{{ kp.phrase }}</b>
              <span>{{ kp.meaning }}</span>
            </div>
            <p class="sub">{{ kp.note }}</p>
          </div>
        </div>
      </section>

      <section ref="aiPanelRef" class="card ai-panel">
        <div class="ai-panel-head">
          <div>
            <h2>DeepSeek AI 老师讲解</h2>
            <p class="micro">
              当前模式：{{ aiTargetLabel }}
              <template v-if="aiResponse?.cached"> · 已缓存</template>
            </p>
          </div>
          <button
            v-if="aiResponse && aiResponse.scope !== 'question'"
            class="link"
            :disabled="aiBusy"
            @click="refreshCurrentAI"
          >
            ↻ 重新生成
          </button>
        </div>

        <form
          class="ai-ask-form"
          @submit.prevent="
            requestAI('question', { question: questionInput })
          "
        >
          <input
            v-model="questionInput"
            maxlength="400"
            placeholder="对某个单词、句子或语法有疑问？直接向 DeepSeek 提问…"
            :disabled="aiBusy"
          />
          <button class="primary" type="submit" :disabled="aiBusy">
            {{ aiBusy ? "思考中…" : "提问 →" }}
          </button>
        </form>

        <div v-if="aiBusy" class="ai-loading" role="status">
          DeepSeek 正在整理词汇与语法讲解，请稍候…
        </div>
        <p v-else-if="aiError" class="auth-error" role="alert">
          {{ aiError }}
        </p>
        <div
          v-else-if="aiResponse"
          class="ai-markdown"
          v-html="aiHtml"
        ></div>
        <p v-else class="sub">
          点击上方「✦ AI 全文精讲」或任意段落下的「✦ AI 讲解」，即可由 DeepSeek 为你拆解词汇与句型。
          <template v-if="!aiConfigured">
            （提示：当前服务端未检测到 DeepSeek 密钥，请检查配置。）
          </template>
        </p>
      </section>
    </template>

    <!-- Graded List View -->
    <template v-else>
      <div class="articles-head">
        <div>
          <h1>分级英语课文</h1>
          <p class="sub">
            精选中国大陆人教版教材阅读（参考 ChinaTextbook），从小学到高中由浅入深，配 DeepSeek AI 精讲。
          </p>
        </div>
      </div>

      <div class="stage-tabs" role="tablist">
        <button
          :class="{ active: stage === 'all' }"
          @click="stage = 'all'"
        >
          全部 ({{ articles.length }})
        </button>
        <button
          :class="{ active: stage === 'primary' }"
          @click="stage = 'primary'"
        >
          小学
        </button>
        <button
          :class="{ active: stage === 'junior' }"
          @click="stage = 'junior'"
        >
          初中
        </button>
        <button
          :class="{ active: stage === 'senior' }"
          @click="stage = 'senior'"
        >
          高中
        </button>
      </div>

      <div class="articles-list">
        <article
          v-for="item in filteredArticles"
          :key="item.id"
          class="card article-card"
          tabindex="0"
          @click="router.push(`/articles/${item.id}`)"
          @keydown.enter.prevent="router.push(`/articles/${item.id}`)"
        >
          <div class="article-card-top">
            <span class="tag">{{ item.level }} · {{ item.difficultyLabel }}</span>
            <span class="micro">约 {{ item.wordCount }} 词</span>
          </div>
          <h2>{{ item.order }}. {{ item.title }}</h2>
          <div class="article-card-zh">{{ item.titleZh }} · {{ item.grade }}</div>
          <p class="sub">{{ item.summary }}</p>
          <div class="article-card-footer">
            <span class="micro">含译文 · 朗读 · AI 精讲</span>
            <span class="article-go">开始阅读 →</span>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>
