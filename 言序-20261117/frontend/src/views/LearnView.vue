<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import {
  content,
  currentUser,
  placementNudgeDismissed,
  profile,
  recordAnswerHistory,
  toast,
} from "../composables/useProfile";
import {
  advance,
  courseKey,
  createSession,
  entries,
  normalize,
  options,
  recordAnswer,
  sessionKey,
} from "../domain/learning";
import { dictate, speak } from "../composables/useSpeech";
import ProgressDots from "../components/ProgressDots.vue";
import WordDetails from "../components/WordDetails.vue";
import type { PracticeMode } from "../types";

const words = computed(() => entries(content.value!, profile));
const session = computed(() => {
  const key = sessionKey(profile);
  let s = profile.sessions[key];
  if (!s) s = profile.sessions[key] = createSession(profile.size);
  if (s.formatVersion !== 2) {
    s.counts = s.counts.map((n) => (n === 3 ? 3 : 0));
    s.formatVersion = 2;
  }
  return s;
});
const entry = computed(() => words.value[session.value.index]);

const mode = ref<PracticeMode>("new");
const choice = ref<number | null>(null);
const feedback = ref<{ ok: boolean; text: string } | null>(null);
const reveal = ref(false);
const answer = ref("");
const showWords = ref(false);
const studyCardRef = ref<HTMLElement | null>(null);

const names: Record<PracticeMode, string> = {
  new: "新词学习",
  spelling: "拼写练习",
  listening: "听力练习",
  reverse: "释义选词",
};

const done = computed(() => session.value.counts.filter((n) => n === 3).length);
const course = computed(() => content.value!.courses[courseKey(profile)]);
const languageName = computed(
  () => content.value?.languages[profile.lang][0] || "英语",
);
const accuracy = computed(() =>
  profile.total ? Math.round((profile.correct / profile.total) * 100) : 0,
);
const progressPercent = computed(() =>
  session.value.counts.length
    ? Math.round((done.value / session.value.counts.length) * 100)
    : 0,
);
const showPlacementNudge = computed(
  () =>
    !!currentUser.value &&
    !currentUser.value.assessmentCompleted &&
    !placementNudgeDismissed.value,
);

let cancelDictation: (() => void) | undefined;

watch(mode, (value) => {
  if (
    value === "new" &&
    !session.value.done &&
    session.value.counts[session.value.index] === 3
  ) {
    session.value.index = session.value.counts.findIndex((n) => n < 3);
  }
});

function scrollToQuestion() {
  const el = studyCardRef.value;
  if (!el) return;
  const isMobileOrTouch = window.matchMedia(
    "(max-width: 850px), (pointer: coarse)",
  ).matches;
  const rect = el.getBoundingClientRect();
  if (isMobileOrTouch || rect.top < 12 || rect.top > window.innerHeight * 0.45) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function reset() {
  choice.value = null;
  feedback.value = null;
  reveal.value = false;
  answer.value = "";
}

function submit() {
  if (feedback.value) return;
  let ok = false;
  let userAnswer = "";
  let correctAnswer = entry.value.meaning;

  if (mode.value === "spelling") {
    if (!answer.value.trim()) {
      toast("请先输入答案或使用语音输入");
      return;
    }
    userAnswer = answer.value.trim();
    correctAnswer = entry.value.word;
    ok = normalize(userAnswer) === normalize(entry.value.word);
  } else {
    if (choice.value === null) return;
    ok = choice.value === session.value.index;
    if (mode.value === "reverse") {
      userAnswer = words.value[choice.value].word;
      correctAnswer = entry.value.word;
    } else {
      userAnswer = words.value[choice.value].meaning;
      correctAnswer = entry.value.meaning;
    }
  }

  if (mode.value === "new") recordAnswer(session.value, ok);
  profile.total++;
  if (ok) profile.correct++;

  void recordAnswerHistory({
    lang: profile.lang,
    course: courseKey(profile),
    mode: mode.value,
    word: entry.value.word,
    meaning: entry.value.meaning,
    userAnswer,
    correctAnswer,
    isCorrect: ok,
  });

  feedback.value = {
    ok,
    text: ok
      ? "✓ 回答正确" +
        (session.value.counts[session.value.index] === 3
          ? " · 该词已掌握"
          : "")
      : mode.value === "new"
        ? "✕ 再记一次（已重置掌握点）"
        : "✕ 再练一次，看看下方详解",
  };
  reveal.value = !ok;
}

function select(index: number) {
  if (feedback.value) return;
  choice.value = index;
  submit();
}

async function next() {
  if (!feedback.value) return;
  (document.activeElement as HTMLElement | null)?.blur?.();
  if (mode.value === "new") {
    const previous = session.value.done;
    advance(session.value);
    if (!previous && session.value.done) {
      profile.records.unshift({
        date: new Date().toLocaleString("zh-CN"),
        lang: profile.lang,
        course: courseKey(profile),
        count: session.value.counts.length,
      });
    }
  } else {
    session.value.index =
      (session.value.index + 1) % session.value.counts.length;
  }
  reset();
  await nextTick();
  scrollToQuestion();
}

async function newRound() {
  (document.activeElement as HTMLElement | null)?.blur?.();
  profile.sessions[sessionKey(profile)] = createSession(
    profile.size,
    session.value.round + 1,
  );
  mode.value = "new";
  reset();
  await nextTick();
  scrollToQuestion();
}

function speechInput() {
  cancelDictation?.();
  cancelDictation = dictate((text) => (answer.value = text));
}

onBeforeUnmount(() => cancelDictation?.());
</script>

<template>
  <div class="learn-shell">
    <div v-if="showPlacementNudge" class="placement-nudge">
      <span>还未完成英语水平评测？约 2 分钟为你推荐合适词库</span>
      <div class="nudge-actions">
        <RouterLink to="/placement" class="primary nudge-btn">立即评测</RouterLink>
        <button
          class="link"
          aria-label="暂不评测"
          @click="placementNudgeDismissed = true"
        >
          ×
        </button>
      </div>
    </div>

    <div class="learn-bar">
      <RouterLink to="/my" class="course-pill">
        <span>{{ languageName }} · {{ course.name }}</span>
        <small>第 {{ session.round }} 轮</small>
      </RouterLink>

      <select v-model="mode" aria-label="练习形式" @change="reset">
        <option v-for="(name, key) in names" :key="key" :value="key">
          {{ name }}
        </option>
      </select>
    </div>

    <section ref="studyCardRef" class="study study-focused">
      <div class="progress-track slim">
        <div
          class="progress-fill"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>

      <div v-if="session.done && mode === 'new'" class="success">
        <div class="eyebrow">ROUND COMPLETE</div>
        <h2>这一轮，稳稳记住了。</h2>
        <p class="sub">
          已掌握 {{ session.counts.length }} 个词 · 累计正确率 {{ accuracy }}%
        </p>
        <div class="success-actions">
          <button class="primary" @click="newRound">再练一轮 →</button>
          <button
            class="bbc-secondary"
            @click="
              mode = 'spelling';
              reset();
            "
          >
            练练拼写
          </button>
          <RouterLink to="/my" class="link">查看答题记录</RouterLink>
        </div>
      </div>

      <template v-else>
        <div class="study-top compact">
          <div class="study-meta-left">
            <span class="tag">{{ names[mode] }}</span>
            <span class="micro">已掌握 {{ done }} / {{ session.counts.length }}</span>
          </div>
          <span class="micro">
            {{ String(session.index + 1).padStart(2, "0") }} /
            {{ session.counts.length }} · 正确率 {{ accuracy }}%
          </span>
        </div>

        <div class="question compact-question">
          <div class="question-label">
            {{
              mode === "spelling"
                ? "根据释义拼写单词"
                : mode === "listening"
                  ? "听发音选出正确释义"
                  : mode === "reverse"
                    ? "选择这个释义对应的单词"
                    : "选择正确释义"
            }}
          </div>

          <div
            class="word"
            :class="{ 'listening-prompt': mode === 'listening' }"
          >
            {{
              mode === "spelling" || mode === "reverse"
                ? entry.meaning
                : mode === "listening"
                  ? "听音识词"
                  : entry.word
            }}
          </div>

          <div class="phonetic">
            <span v-if="mode === 'new' && entry.ipa">{{ entry.ipa }}</span>
            <button
              class="audio"
              aria-label="播放单词发音"
              @click="speak(entry.word)"
            >
              ♪
            </button>
          </div>

          <ProgressDots :count="session.counts[session.index]" />

          <div v-if="mode === 'spelling'" class="entry">
            <input
              v-model="answer"
              aria-label="词语答案"
              autocomplete="off"
              autocapitalize="off"
              spellcheck="false"
              :readonly="!!feedback"
              placeholder="输入答案，回车提交"
              @keydown.enter="!$event.isComposing && (feedback ? next() : submit())"
            />
            <button class="audio" aria-label="语音输入" @click="speechInput">
              ♩
            </button>
          </div>

          <div v-else class="answers" :class="{ revealed: reveal }">
            <button
              v-for="(index, k) in options(session.index, words.length)"
              :key="index"
              class="answer"
              :class="{
                selected: choice === index,
                correct: feedback && index === session.index,
                wrong: feedback && choice === index && index !== session.index,
              }"
              @click="select(index)"
              @dblclick="reveal = true"
            >
              <em>{{ "ABCD"[k] }}</em>
              <span class="option-text">
                <span>{{
                  mode === "reverse" ? words[index].word : words[index].meaning
                }}</span>
                <small class="option-other">
                  {{
                    mode === "reverse"
                      ? words[index].meaning
                      : words[index].word
                  }}
                  <span>{{ words[index].ipa }}</span>
                </small>
              </span>
            </button>
          </div>

          <div v-if="feedback" class="feedback-bar">
            <span
              class="feedback-pill"
              :class="feedback.ok ? 'ok' : 'bad'"
              role="status"
            >
              {{ feedback.text }}
            </span>
            <button
              v-if="mode !== 'spelling'"
              class="link"
              @click="reveal = !reveal"
            >
              {{ reveal ? "隐藏词义对照" : "展开词义对照" }}
            </button>
          </div>

          <WordDetails v-if="feedback" :entry="entry" />
        </div>

        <div v-if="feedback || mode === 'spelling'" class="study-bottom compact">
          <span class="micro">
            {{ feedback ? "点击继续下一题" : "提交后查看详解" }}
          </span>
          <button class="primary" @click="feedback ? next() : submit()">
            {{ feedback ? "下一题 →" : "提交拼写 →" }}
          </button>
        </div>
      </template>
    </section>

    <div class="wordlist-drawer">
      <button class="drawer-toggle" @click="showWords = !showWords">
        <span>本轮词表（{{ done }} / {{ session.counts.length }} 已掌握）</span>
        <span>{{ showWords ? "收起 ▴" : "展开 ▾" }}</span>
      </button>

      <div v-if="showWords" class="wordlist compact-wordlist">
        <div
          v-for="(count, index) in session.counts"
          :key="index"
          class="miniword"
          :class="{ current: index === session.index }"
        >
          <b>{{ words[index].word }}</b>
          <small>{{ words[index].meaning }}</small>
          <ProgressDots :count="count" />
        </div>
      </div>
    </div>
  </div>
</template>
