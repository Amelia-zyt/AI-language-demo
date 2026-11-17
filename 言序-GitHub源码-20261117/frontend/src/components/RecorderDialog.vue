<script setup lang="ts">
import {
  computed,
  inject,
  onMounted,
  onBeforeUnmount,
  ref,
  nextTick,
} from "vue";
import type { Assessment, Cue, Episode, GrammarReview } from "../types";
import { api } from "../api/client";
import {
  ENGINE_KEY,
  speechEngine,
  monoAudio,
} from "../composables/useSpeechEngine";
import { playback, player } from "../composables/usePlayer";
import { speak } from "../composables/useSpeech";
const props = defineProps<{
    sentence: Cue;
    cues: Cue[];
    index: number;
    episode: Episode;
  }>(),
  emit = defineEmits<{ close: [] }>(),
  engine = inject(ENGINE_KEY, speechEngine);
const phase = ref<"preparing" | "recording" | "analyzing" | "ready" | "error">(
    "preparing",
  ),
  message = ref("正在准备麦克风…"),
  assessment = ref<Assessment | null>(null),
  review = ref<GrammarReview | null>(null),
  grammarBusy = ref(false),
  recognized = ref(""),
  recordingUrl = ref(""),
  ownPlaying = ref(false),
  originalPlaying = ref(false),
  dialog = ref<HTMLElement | null>(null),
  canvas = ref<HTMLCanvasElement | null>(null),
  recordedAudio = ref<HTMLAudioElement | null>(null);
const isRecording = computed(() => phase.value === "recording"),
  processing = computed(
    () => phase.value === "analyzing" || phase.value === "preparing",
  );
let media: MediaStream | null = null,
  recorder: MediaRecorder | null = null,
  waveContext: AudioContext | null = null,
  frame = 0,
  request = 0,
  controller: AbortController | null = null,
  focusReturn: HTMLElement | null = null;
function pauseOwn() {
  recordedAudio.value?.pause();
  ownPlaying.value = false;
}
function stopOriginal() {
  player.stopSentence();
  originalPlaying.value = false;
}
function stopWave() {
  cancelAnimationFrame(frame);
  frame = 0;
  void waveContext?.close().catch(() => {});
  waveContext = null;
}
function meter(stream: MediaStream) {
  stopWave();
  waveContext = new AudioContext();
  const analyser = waveContext.createAnalyser();
  analyser.fftSize = 256;
  waveContext.createMediaStreamSource(stream).connect(analyser);
  void waveContext.resume();
  const samples = new Uint8Array(analyser.fftSize);
  function draw() {
    if (!isRecording.value || !canvas.value) return;
    const ctx = canvas.value.getContext("2d");
    if (!ctx) return;
    analyser.getByteTimeDomainData(samples);
    ctx.clearRect(0, 0, 640, 100);
    ctx.lineWidth = 3;
    ctx.strokeStyle =
      getComputedStyle(dialog.value!).getPropertyValue("--accent").trim() ||
      "#d5e8a2";
    ctx.beginPath();
    samples.forEach((value, i) => {
      const x = (i / (samples.length - 1)) * 640,
        y = 50 + ((value - 128) / 128) * 46;
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.stroke();
    frame = requestAnimationFrame(draw);
  }
  draw();
}
async function start() {
  const own = ++request;
  controller?.abort();
  controller = new AbortController();
  stopOriginal();
  pauseOwn();
  if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value);
  recordingUrl.value = "";
  assessment.value = null;
  review.value = null;
  recognized.value = "";
  phase.value = "preparing";
  message.value = "正在准备麦克风…";
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
      throw Error("当前浏览器不支持录音，请使用 HTTPS 或本机浏览器。");
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    if (own !== request) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    media = stream;
    const parts: BlobPart[] = [],
      owned = new MediaRecorder(stream);
    recorder = owned;
    owned.ondataavailable = (event) => {
      if (event.data.size) parts.push(event.data);
    };
    owned.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      if (media === stream) media = null;
      if (own !== request) return;
      stopWave();
      playback.recording = false;
      const blob = new Blob(parts, { type: owned.mimeType || "audio/webm" });
      recordingUrl.value = URL.createObjectURL(blob);
      void analyze(blob, own, controller!.signal);
    };
    owned.start(1000);
    phase.value = "recording";
    playback.recording = true;
    message.value = "正在录音，读完点击波浪线停止。";
    void engine.warmup().catch(() => {});
    await nextTick();
    try {
      meter(stream);
    } catch {
      message.value = "正在录音，点击下方区域停止。";
    }
  } catch (error) {
    if (own !== request) return;
    media?.getTracks().forEach((track) => track.stop());
    media = null;
    phase.value = "error";
    message.value = error instanceof Error ? error.message : "麦克风启动失败";
    playback.recording = false;
  }
}
async function analyze(blob: Blob, own: number, signal: AbortSignal) {
  phase.value = "analyzing";
  message.value = "正在分析这次跟读，可以先回放录音。";
  try {
    const { samples } = await monoAudio(await blob.arrayBuffer());
    if (own !== request) return;
    const words = await engine.transcribe(samples, {
      signal,
      status: (text) => {
        if (own === request) message.value = text + "，可先回放录音。";
      },
    });
    if (own !== request) return;
    const text = words
      .map((word) => word.text)
      .join("")
      .trim();
    if (!text) throw Error("未识别到语音，请回放检查后重试。");
    recognized.value = text;
    const result = await api.assess(
      props.sentence.text,
      text,
      props.episode.id,
    );
    if (own !== request) return;
    assessment.value = result;
    phase.value = "ready";
    message.value =
      "跟读分析完成。绿色为识别匹配，红色为未匹配，请对照原声重试。";
  } catch (error) {
    if (own === request && !signal.aborted) {
      phase.value = "error";
      message.value =
        (error instanceof Error ? error.message : "识别失败") +
        "。录音仍可回放。";
    }
  }
}
function stop() {
  if (recorder?.state === "recording") recorder.stop();
}
async function replay() {
  const audio = recordedAudio.value;
  if (!audio) return;
  if (!audio.paused) {
    audio.pause();
    return;
  }
  stopOriginal();
  player.pause();
  try {
    await audio.play();
  } catch {
    message.value = "回放未能开始，请再点一次。";
  }
}
async function original() {
  if (originalPlaying.value) {
    stopOriginal();
    return;
  }
  pauseOwn();
  originalPlaying.value = true;
  const result = await player.playSentence(
    props.cues,
    props.index,
    () => (originalPlaying.value = false),
  );
  if (result !== true) {
    originalPlaying.value = false;
    message.value =
      typeof result === "string"
        ? result
        : "本句原声暂时无法播放，请稍后重试。";
  }
}
async function grammar() {
  if (!recognized.value) return;
  grammarBusy.value = true;
  const own = request;
  try {
    const result = await engine.review(props.sentence.text, recognized.value, {
      signal: controller?.signal,
      status: (text) => (message.value = text),
    });
    if (own === request) {
      review.value = result;
      message.value = "语法建议已生成，请结合原文核对。";
    }
  } catch (error) {
    if (own === request)
      message.value =
        error instanceof Error ? error.message : "语法建议暂不可用";
  } finally {
    if (own === request) grammarBusy.value = false;
  }
}
function trap(event: KeyboardEvent) {
  if (event.key === "Escape") {
    event.preventDefault();
    emit("close");
    return;
  }
  if (event.key !== "Tab") return;
  const nodes = [
    ...dialog.value!.querySelectorAll<HTMLButtonElement>(
      "button:not([disabled])",
    ),
  ].filter((node) => node.offsetParent !== null);
  if (event.shiftKey && document.activeElement === nodes[0]) {
    event.preventDefault();
    nodes.at(-1)?.focus();
  } else if (!event.shiftKey && document.activeElement === nodes.at(-1)) {
    event.preventDefault();
    nodes[0]?.focus();
  }
}
onMounted(() => {
  focusReturn = document.activeElement as HTMLElement;
  document.body.classList.add("shadow-open");
  player.pause();
  dialog.value?.querySelector<HTMLButtonElement>(".shadow-close")?.focus();
  void start();
});
onBeforeUnmount(() => {
  request++;
  controller?.abort();
  stopOriginal();
  pauseOwn();
  if (recorder?.state === "recording") recorder.stop();
  media?.getTracks().forEach((track) => track.stop());
  stopWave();
  playback.recording = false;
  if (recordingUrl.value) URL.revokeObjectURL(recordingUrl.value);
  document.body.classList.remove("shadow-open");
  focusReturn?.isConnected && focusReturn.focus();
});
</script>
<template>
  <Teleport to="body"
    ><div class="shadow-overlay">
      <section
        ref="dialog"
        class="shadow-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shadowTitle"
        @keydown="trap"
      >
        <button
          class="shadow-close"
          aria-label="关闭跟读"
          @click="emit('close')"
        >
          ×</button
        ><span class="eyebrow">SHADOW · LISTEN TO YOURSELF</span>
        <h2 id="shadowTitle">跟读这一句</h2>
        <p class="shadow-words">
          <template v-if="assessment"
            ><template
              v-for="(segment, index) in assessment.alignment"
              :key="index"
              ><span
                v-if="segment.matched !== null"
                :class="segment.matched ? 'shadow-good' : 'shadow-miss'"
                :title="segment.matched ? '识别匹配' : '未匹配，请重听原声'"
                >{{ segment.text }}</span
              ><template v-else>{{ segment.text }}</template></template
            ></template
          ><template v-else>{{ sentence.text }}</template>
        </p>
        <p id="shadowPrompt">
          {{
            isRecording
              ? "请清晰读出上方句子，读完点击波浪线停止录音。"
              : processing
                ? "录音已保存，可以先听听自己的录音。"
                : assessment
                  ? "对照红色部分，听原声后再试一次。"
                  : "请允许麦克风权限，或稍后重新录制。"
          }}
        </p>
        <button
          v-if="isRecording"
          class="shadow-wave"
          aria-label="停止录音并评分"
          @click="stop"
        >
          <canvas
            ref="canvas"
            width="640"
            height="100"
            aria-hidden="true"
          ></canvas
          ><span>点击波浪线停止录音</span>
        </button>
        <p id="shadowStatus" role="status">{{ message }}</p>
        <div v-if="assessment" id="shadowScore">
          <strong>{{ assessment.score }}<small> / 100</small></strong>
          <p>AI 识别一致度</p>
          <p class="shadow-legend">
            <span>绿色 · 识别匹配</span><span>红色 · 未匹配</span>
          </p>
          <p class="coach-note">识别结果：{{ recognized }}</p>
        </div>
        <audio
          v-if="recordingUrl"
          ref="recordedAudio"
          :src="recordingUrl"
          preload="metadata"
          hidden
          @play="ownPlaying = true"
          @pause="ownPlaying = false"
          @ended="ownPlaying = false"
        ></audio>
        <div class="shadow-actions">
          <button
            class="bbc-secondary"
            :disabled="isRecording || !recordingUrl"
            @click="replay"
          >
            {{ ownPlaying ? "Ⅱ 暂停回放" : "▷ 回放我的录音" }}</button
          ><button
            v-if="!isRecording && !processing"
            class="primary"
            @click="start"
          >
            重新跟读</button
          ><button
            class="bbc-secondary"
            :disabled="isRecording || processing"
            @click="original"
          >
            {{ originalPlaying ? "Ⅱ 暂停本句原声" : "听 BBC 原声" }}
          </button>
        </div>
        <details v-if="assessment" class="grammar-details">
          <summary>语法与表达建议</summary>
          <article
            v-for="(hint, i) in assessment.hints"
            :key="i"
            class="coach-issue"
          >
            <p>
              {{ hint.original }} → <strong>{{ hint.correction }}</strong>
            </p>
            <p>{{ hint.explanation }}</p>
          </article>
          <button
            class="bbc-secondary"
            :disabled="grammarBusy"
            @click="grammar"
          >
            {{ grammarBusy ? "正在生成语法建议…" : "生成 AI 语法建议" }}
          </button>
          <div v-if="review">
            <p>{{ review.feedback }}</p>
            <article v-for="(issue, i) in review.issues" :key="i">
              <p>{{ issue.original }} → {{ issue.correction }}</p>
              <p>{{ issue.explanation }}</p>
              <div
                v-for="example in issue.examples"
                :key="example"
                class="coach-example"
              >
                <p>{{ example }}</p>
                <button class="example-audio" @click="speak(example, 'en-GB')">
                  ♪ 朗读
                </button>
              </div>
            </article>
            <div
              v-for="example in review.examples"
              :key="example"
              class="coach-example"
            >
              <p>{{ example }}</p>
              <button class="example-audio" @click="speak(example, 'en-GB')">
                ♪ 朗读
              </button>
            </div>
          </div>
        </details>
        <p class="coach-note">
          逐词颜色依据 AI
          识别文字与原句比对，并非音素级发音测评。录音在浏览器处理；识别文字与评分保存在当前学习档案中。
        </p>
      </section>
    </div></Teleport
  >
</template>
