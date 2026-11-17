<script setup lang="ts">
import { computed, ref, onBeforeUnmount, watch } from "vue";
import { content, profile, toast } from "../composables/useProfile";
import {
  entries,
  sessionKey,
  courseKey,
  createSession,
  recordAnswer,
  advance,
  normalize,
  options,
} from "../domain/learning";
import { speak, dictate } from "../composables/useSpeech";
import PageIntro from "../components/PageIntro.vue";
import ProgressDots from "../components/ProgressDots.vue";
import WordDetails from "../components/WordDetails.vue";
import type { PracticeMode } from "../types";
const words = computed(() => entries(content.value!, profile)),
  session = computed(() => {
    const key = sessionKey(profile);
    let s = profile.sessions[key];
    if (!s) s = profile.sessions[key] = createSession(profile.size);
    if (s.formatVersion !== 2) {
      s.counts = s.counts.map((n) => (n === 3 ? 3 : 0));
      s.formatVersion = 2;
    }
    return s;
  }),
  entry = computed(() => words.value[session.value.index]);
const mode = ref<PracticeMode>("new"),
  choice = ref<number | null>(null),
  feedback = ref<{ ok: boolean; text: string } | null>(null),
  reveal = ref(false),
  answer = ref(""),
  showAll = ref(false);
const names: Record<PracticeMode, string> = {
  new: "新词学习",
  spelling: "拼写练习",
  listening: "听力练习",
  reverse: "释义选词",
};
const done = computed(() => session.value.counts.filter((n) => n === 3).length),
  course = computed(() => content.value!.courses[courseKey(profile)]),
  accuracy = computed(() =>
    profile.total ? Math.round((profile.correct / profile.total) * 100) : 0,
  );
let cancelDictation: (() => void) | undefined;
watch(mode, (value) => {
  if (
    value === "new" &&
    !session.value.done &&
    session.value.counts[session.value.index] === 3
  )
    session.value.index = session.value.counts.findIndex((n) => n < 3);
});
function reset() {
  choice.value = null;
  feedback.value = null;
  reveal.value = false;
  answer.value = "";
}
function submit() {
  if (feedback.value) return;
  let ok = false;
  if (mode.value === "spelling") {
    if (!answer.value.trim()) {
      toast("请先输入答案或使用语音输入");
      return;
    }
    ok = normalize(answer.value) === normalize(entry.value.word);
  } else {
    if (choice.value === null) return;
    ok = choice.value === session.value.index;
  }
  if (mode.value === "new") recordAnswer(session.value, ok);
  profile.total++;
  if (ok) profile.correct++;
  feedback.value = {
    ok,
    text: ok
      ? "✓ 回答正确。" +
        (session.value.counts[session.value.index] === 3
          ? "这个词已掌握。"
          : "")
      : mode.value === "new"
        ? "再认识一次，三个小点已重新清零。"
        : "再练一次，看看下面的单词详解。",
  };
  reveal.value = !ok;
}
function select(index: number) {
  if (feedback.value) return;
  choice.value = index;
  submit();
}
function next() {
  if (!feedback.value) return;
  if (mode.value === "new") {
    const previous = session.value.done;
    advance(session.value);
    if (!previous && session.value.done)
      profile.records.unshift({
        date: new Date().toLocaleString("zh-CN"),
        lang: profile.lang,
        course: courseKey(profile),
        count: session.value.counts.length,
      });
  } else
    session.value.index =
      (session.value.index + 1) % session.value.counts.length;
  reset();
}
function newRound() {
  profile.sessions[sessionKey(profile)] = createSession(
    profile.size,
    session.value.round + 1,
  );
  mode.value = "new";
  reset();
}
function speechInput() {
  cancelDictation?.();
  cancelDictation = dictate((text) => (answer.value = text));
}
onBeforeUnmount(() => cancelDictation?.());
</script>
<template>
  <PageIntro
    title="把世界，学成自己的。"
    subtitle="不赶进度，只让每一个词真正留下来。"
    eyebrow="A LITTLE EVERY DAY, A WORLD AWAY."
  />
  <div class="exercise-toolbar">
    <div>
      <span class="tag">{{
        profile.preference === "foundation" ? "基础词库" : course.name
      }}</span
      ><span class="micro">{{
        mode === "new"
          ? "本轮词语依次循环，每个词累计连续答对三次"
          : "补充练习，不改变新词掌握进度"
      }}</span>
    </div>
    <select v-model="mode" aria-label="练习形式" @change="reset">
      <option v-for="(name, key) in names" :key="key" :value="key">
        {{ name }}
      </option>
    </select>
  </div>
  <div class="dashboard">
    <section class="study">
      <div v-if="session.done && mode === 'new'" class="success">
        <div class="eyebrow">ROUND COMPLETE</div>
        <h2>这一轮，稳稳记住了。</h2>
        <p>已掌握 {{ session.counts.length }} 个词，每个词都连续答对三次。</p>
        <button class="primary" @click="newRound">再练一轮 ↗</button
        ><button
          class="link"
          @click="
            mode = 'spelling';
            reset();
          "
        >
          练练拼写 →</button
        ><RouterLink to="/my" class="link">查看学习记录</RouterLink>
      </div>
      <template v-else
        ><div class="study-top">
          <div>
            <span class="tag">{{ names[mode] }}</span
            ><b
              >第 {{ session.round }} 轮 · 第 {{ session.cycle || 1 }} 遍 ·
              {{ course.name }}</b
            >
          </div>
          <span
            >{{ String(session.index + 1).padStart(2, "0") }} /
            {{ session.counts.length }}</span
          >
        </div>
        <div class="question">
          <div class="question-label">
            {{
              mode === "spelling"
                ? "根据释义拼写单词，也可以先听发音"
                : mode === "listening"
                  ? "点击播放，选择听到的词语意思"
                  : mode === "reverse"
                    ? "选择这个释义对应的单词"
                    : "选择这个单词的正确释义"
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
            {{ mode === "new" ? entry.ipa : ""
            }}<button
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
              placeholder="输入答案，或点击麦克风"
              @keydown.enter="!$event.isComposing && submit()"
            /><button class="audio" aria-label="语音输入" @click="speechInput">
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
              <em>{{ "ABCD"[k] }}</em
              ><span class="option-text"
                ><span>{{
                  mode === "reverse" ? words[index].word : words[index].meaning
                }}</span
                ><small class="option-other"
                  >{{
                    mode === "reverse"
                      ? words[index].meaning
                      : words[index].word
                  }}<span>{{ words[index].ipa }}</span></small
                ></span
              >
            </button>
          </div>
          <button
            v-if="feedback && !reveal && mode !== 'spelling'"
            class="link reveal-button"
            @click="reveal = true"
          >
            展开所有选项的词义对照
          </button>
          <div class="feedback" role="status">{{ feedback?.text }}</div>
          <WordDetails v-if="feedback" :entry="entry" />
        </div>
        <div class="study-bottom">
          <span class="hint">{{
            feedback
              ? "双击任一选项，可展开全部词义对照。"
              : mode === "spelling"
                ? "点击音符可听到该释义对应的单词。"
                : "单击即提交 · 双击展开全部词义对照"
          }}</span
          ><button
            v-if="feedback || mode === 'spelling'"
            class="primary"
            @click="feedback ? next() : submit()"
          >
            {{ feedback ? "继续学习" : "提交拼写" }} <span>→</span>
          </button>
        </div></template
      >
    </section>
    <div class="rail">
      <section class="card">
        <div class="card-title">
          本轮目标 <small>{{ session.counts.length }} 个单词</small>
        </div>
        <div
          class="ring"
          :style="{ '--progress': (done / session.counts.length) * 100 + '%' }"
        >
          <div>
            <b
              >{{ done
              }}<span class="count-total">
                / {{ session.counts.length }}</span
              ></b
            ><small>已掌握</small>
          </div>
        </div>
        <div class="stats">
          <div>
            <b>{{ session.counts.reduce((a, b) => a + b, 0) }}</b
            ><small>有效重复</small>
          </div>
          <div>
            <b>{{ accuracy }}%</b><small>累计正确率</small>
          </div>
        </div>
      </section>
      <section class="card tip">
        <span class="spark">✧</span>
        <p>先认得，再表达。</p>
        <small
          >每轮词语依次出现，做完一遍再循环。每个词连续答对三次才掌握，答错重新累计。</small
        >
      </section>
    </div>
  </div>
  <div class="section-heading">
    <h2>本轮词语 <span class="micro"> / 三个小点记录掌握进度</span></h2>
    <button class="link" @click="showAll = !showAll">
      {{ showAll ? "收起" : "查看全部" }} ↗
    </button>
  </div>
  <div class="wordlist">
    <div
      v-for="(count, index) in session.counts.slice(
        0,
        showAll ? session.counts.length : 5,
      )"
      :key="index"
      class="miniword"
      :class="{ current: index === session.index }"
    >
      <b>{{ words[index].word }}</b
      ><small class="mini-ipa">{{ words[index].ipa }}</small
      ><small>{{ words[index].meaning }}</small
      ><ProgressDots :count="count" />
    </div>
  </div>
  <div class="bottom-banner">
    <div>
      ◎ 当前词库：{{ course.name }}<small>{{ course.description }}</small>
    </div>
    <RouterLink to="/my" class="link">切换学习内容 →</RouterLink>
  </div>
</template>
