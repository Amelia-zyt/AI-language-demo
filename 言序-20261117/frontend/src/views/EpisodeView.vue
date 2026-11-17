<script setup lang="ts">
import {
  computed,
  onMounted,
  onBeforeUnmount,
  ref,
  watch,
  nextTick,
} from "vue";
import { useRoute } from "vue-router";
import {
  episodes,
  feeds,
  loadCatalog,
  getDocument,
  downloadPdf,
  timedTranscript,
} from "../composables/useCatalog";
import { playback, player } from "../composables/usePlayer";
import { favorites, toggleFavorite, toast } from "../composables/useProfile";
import {
  officialCues,
  activeCue,
  dateText,
  formatTime,
  transcriptPdf,
} from "../domain/transcript";
import type { Cue, OfficialDocument, Episode } from "../types";
import TranscriptRow from "../components/TranscriptRow.vue";
import RecorderDialog from "../components/RecorderDialog.vue";
const route = useRoute(),
  episode = computed(() =>
    episodes.value.find((e) => e.id === String(route.params.id)),
  ),
  document = ref<OfficialDocument | null>(null),
  timed = ref<Cue[]>([]),
  status = ref("正在查找官方文稿…"),
  error = ref(false),
  busy = ref(false),
  downloading = ref(false),
  follow = ref(false),
  box = ref<HTMLElement | null>(null),
  selected = ref<{ sentence: Cue; cues: Cue[]; index: number } | null>(null);
const cues = computed(() =>
    timed.value.length
      ? timed.value
      : officialCues(document.value?.lines || []),
  ),
  current = computed(() => activeCue(cues.value, playback.position)),
  pdf = computed(() => transcriptPdf(document.value?.links || [])),
  series = computed(
    () =>
      feeds.value.find((f) => f.id === episode.value?.series)?.name ||
      "BBC Learning English",
  ),
  isPlaying = computed(
    () => playback.episode?.id === episode.value?.id && !playback.paused,
  );
const frequency = computed(() => {
  const labels: Record<string, string> = {
    weekly: "每周更新",
    daily: "每日更新",
    monthly: "每月更新",
    fortnightly: "每两周更新",
  };
  return (
    labels[episode.value?.frequency || ""] ||
    episode.value?.frequency ||
    "官方未提供"
  );
});
let generation: AbortController | undefined,
  version = 0;
function mobile() {
  return matchMedia("(max-width:700px), (pointer:coarse)").matches;
}
async function initialize(e: Episode) {
  const own = ++version;
  generation?.abort();
  timed.value = [];
  document.value = null;
  selected.value = null;
  follow.value = false;
  busy.value = false;
  player.load(e);
  error.value = false;
  status.value = "正在读取官方文稿…";
  try {
    const result = await getDocument(e);
    if (own !== version) return;
    document.value = result;
    status.value = result.lines.length
      ? "官方文稿已就绪 · 无需等待识别模型。精确跳播需生成原声时间码。"
      : "本集暂无在线文字，可查看官方PDF或生成原声时间码。";
  } catch (reason) {
    if (own === version) {
      error.value = true;
      status.value =
        reason instanceof Error ? reason.message : "官方文稿加载失败";
    }
  }
}
async function generate(force = true) {
  if (!episode.value) return;
  generation?.abort();
  const controller = (generation = new AbortController()),
    own = version;
  busy.value = true;
  error.value = false;
  try {
    await timedTranscript(
      episode.value,
      controller.signal,
      (text) => {
        if (own === version) status.value = text;
      },
      (value) => {
        if (own === version) timed.value = value;
      },
      force,
    );
  } catch (reason) {
    if (!controller.signal.aborted && own === version) {
      error.value = true;
      status.value =
        reason instanceof Error ? reason.message : "转写失败，可先阅读官方文稿";
    }
  } finally {
    if (generation === controller) busy.value = false;
  }
}
function cancel() {
  generation?.abort();
  busy.value = false;
  status.value = "转写已停止，已生成的文本仍可跟读。";
}
async function download() {
  if (!episode.value) return;
  downloading.value = true;
  try {
    await downloadPdf(episode.value, document.value?.links || []);
    toast("官方 PDF 已准备好，已发起下载。");
  } catch (reason) {
    toast(reason instanceof Error ? reason.message : "下载失败");
  } finally {
    downloading.value = false;
  }
}
async function playRow(index: number) {
  const cue = cues.value[index];
  if (cue.start === null) {
    toast("这句是官方文稿，暂无原声时间码；可以先跟读，或生成时间码。");
    return;
  }
  player.seek(cue.start);
  await player.play();
}
function record(index: number) {
  selected.value = {
    sentence: { ...cues.value[index] },
    cues: cues.value.map((c) => ({ ...c })),
    index,
  };
}
watch(
  () => episode.value?.id,
  () => {
    const e = episode.value;
    if (e) {
      void initialize(e).then(() => {
        if (!mobile() && episode.value?.id === e.id) void generate(false);
      });
    }
  },
  { immediate: true },
);
watch(current, async (index) => {
  if (!follow.value || index < 0 || !playback.playing) return;
  await nextTick();
  const container = box.value,
    element = container?.querySelector<HTMLElement>(
      `[data-cue-index="${index}"]`,
    );
  if (!container || !element) return;
  const a = element.getBoundingClientRect(),
    b = container.getBoundingClientRect();
  if (a.top >= b.top + 18 && a.bottom <= b.bottom - 18) return;
  container.scrollTo({
    top:
      container.scrollTop +
      a.top -
      b.top -
      (container.clientHeight - a.height) / 2,
    behavior: "smooth",
  });
});
onMounted(() => {
  if (!episodes.value.length) void loadCatalog();
});
onBeforeUnmount(() => {
  version++;
  generation?.abort();
  player.stopSentence();
});
</script>
<template>
  <div v-if="episode" class="bbc-episode-page">
    <div class="bbc-header">
      <RouterLink
        class="link"
        :to="route.query.from === 'favorites' ? '/favorites' : '/bbc'"
        >←
        {{
          route.query.from === "favorites" ? "返回收藏夹" : "返回节目列表"
        }}</RouterLink
      >
    </div>
    <section class="card bbc-episode-hero">
      <div class="eyebrow">{{ series }}</div>
      <h1>{{ episode.title }}</h1>
      <div class="bbc-detail-actions">
        <button
          class="primary"
          @click="
            player.load(episode);
            player.toggle();
          "
        >
          {{ isPlaying ? "Ⅱ 暂停播放" : "▶ 播放本集" }}</button
        ><button
          class="bbc-secondary"
          :disabled="!pdf || downloading"
          @click="download"
        >
          {{ downloading ? "正在获取 PDF…" : "↓ 下载文字稿" }}</button
        ><button
          class="bbc-secondary"
          :aria-pressed="favorites.includes(episode.id)"
          @click="toggleFavorite(episode.id)"
        >
          {{ favorites.includes(episode.id) ? "★ 已收藏" : "☆ 收藏音频" }}
        </button>
      </div>
      <a
        class="bbc-detail-source"
        :href="episode.page"
        target="_blank"
        rel="noopener noreferrer"
        >BBC官网音频 ↗</a
      ><span v-if="pdf" class="bbc-pdf-links"
        ><a
          class="bbc-detail-source"
          :href="pdf"
          target="_blank"
          rel="noopener noreferrer"
          >BBC官方PDF ↗</a
        ></span
      >
      <p class="coach-note">
        {{
          pdf
            ? "下载文字稿将保存 BBC 官方 PDF。"
            : "暂未发现官方 PDF，可通过官网音频查看。"
        }}
      </p>
    </section>
    <section class="bbc-reading card">
      <div class="bbc-reading-top">
        <h2>音频文本</h2>
      </div>
      <div class="bbc-reading-controls">
        <label><input type="checkbox" v-model="follow" /> 跟随播放滚动</label
        ><button class="link" :disabled="busy" @click="generate()">
          {{ mobile() ? "生成原声时间码" : "重新生成跟读文本" }}</button
        ><button v-if="busy" class="link" @click="cancel">停止转写</button
        ><button
          v-if="error && !busy"
          class="link"
          @click="initialize(episode)"
        >
          重试加载文稿
        </button>
      </div>
      <p class="bbc-transcript-label">
        带时间码的句子可跳播 BBC 原声；点击麦克风跟读。官方文稿无原声时间码。
      </p>
      <div class="bbc-transcript-status" :class="{ error }" role="status">
        {{ status }}
      </div>
      <div
        ref="box"
        class="bbc-transcript"
        aria-label="音频文本"
        @wheel.passive="follow = false"
        @touchmove.passive="follow = false"
      >
        <TranscriptRow
          v-for="(cue, index) in cues"
          :key="index"
          :cue="cue"
          :index="index"
          :active="index === current"
          @play="playRow"
          @record="record"
        />
        <p v-if="!cues.length" class="sub">
          暂无可显示文字，可重试加载、打开官方PDF或生成原声时间码。
        </p>
      </div>
    </section>
    <section class="card bbc-overview">
      <h2>本集概述</h2>
      <p>{{ episode.description || "官方订阅暂未提供本集介绍。" }}</p>
      <dl class="bbc-info-grid">
        <div>
          <dt>节目</dt>
          <dd>{{ series }}</dd>
        </div>
        <div>
          <dt>频道 / 出品方</dt>
          <dd>{{ episode.channel || "BBC Learning English" }}</dd>
        </div>
        <div>
          <dt>更新频率</dt>
          <dd>{{ frequency }}</dd>
        </div>
        <div>
          <dt>发布时间（北京时间）</dt>
          <dd>{{ dateText(episode.published) }}</dd>
        </div>
        <div>
          <dt>音频时长</dt>
          <dd>
            {{
              formatTime(
                playback.episode?.id === episode.id
                  ? playback.duration
                  : episode.duration,
              )
            }}
          </dd>
        </div>
        <div>
          <dt>来源</dt>
          <dd>
            <a :href="episode.page" target="_blank" rel="noopener noreferrer"
              >BBC 官方单集 ↗</a
            >
          </dd>
        </div>
      </dl>
    </section>
    <RecorderDialog
      v-if="selected"
      :sentence="selected.sentence"
      :cues="selected.cues"
      :index="selected.index"
      :episode="episode"
      @close="selected = null"
    />
  </div>
  <section v-else class="card loading-card">
    <p>正在读取单集…</p>
    <RouterLink to="/bbc" class="link">返回节目列表</RouterLink>
  </section>
</template>
