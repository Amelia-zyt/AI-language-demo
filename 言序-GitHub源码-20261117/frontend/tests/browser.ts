/** 开发测试专用入口，不进入生产构建。用合成音轨验证真实录音组件，不访问真人麦克风。 */
import { createApp, defineComponent, h, provide, ref } from "vue";
import RecorderDialog from "../src/components/RecorderDialog.vue";
import {
  ENGINE_KEY,
  speechEngine,
  monoAudio,
  type SpeechEngine,
} from "../src/composables/useSpeechEngine";
import { player, playback } from "../src/composables/usePlayer";
import type { Episode, Cue } from "../src/types";
import "../src/styles/style.css";
import "../src/styles/bbc.css";
import "../src/styles/coach.css";
import "../src/styles/refactor.css";
const counts = { warmups: 0, transcriptions: 0, streams: [] as MediaStream[] },
  state = ref("尚未开始"),
  realBusy = ref(false);
let prepared = false;
const fake: SpeechEngine = {
  async warmup() {
    if (!prepared) {
      counts.warmups++;
      prepared = true;
    }
  },
  async transcribe() {
    counts.transcriptions++;
    await new Promise((resolve) => setTimeout(resolve, 600));
    return [{ text: "Hello world.", timestamp: [0, 0.5] }];
  },
  async review() {
    return { feedback: "Test review", issues: [], examples: ["Hello again."] };
  },
};
Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
  value: async () => {
    const context = new AudioContext();
    const oscillator = context.createOscillator(),
      gain = context.createGain(),
      destination = context.createMediaStreamDestination();
    gain.gain.value = 0.1;
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start();
    const stream = destination.stream;
    counts.streams.push(stream);
    stream.getTracks().forEach((track) => {
      const stopTrack = track.stop.bind(track);
      track.stop = () => {
        if (track.readyState === "ended") return;
        stopTrack();
        oscillator.stop();
        void context.close();
      };
    });
    return stream;
  },
});
// 两秒可解码 WAV，用于验证当前句播放到 0.65 秒即暂停。
const bytes = new ArrayBuffer(44 + 32000 * 2),
  view = new DataView(bytes);
function tag(offset: number, text: string) {
  [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
}
tag(0, "RIFF");
view.setUint32(4, bytes.byteLength - 8, true);
tag(8, "WAVE");
tag(12, "fmt ");
view.setUint32(16, 16, true);
view.setUint16(20, 1, true);
view.setUint16(22, 1, true);
view.setUint32(24, 16000, true);
view.setUint32(28, 32000, true);
view.setUint16(32, 2, true);
view.setUint16(34, 16, true);
tag(36, "data");
view.setUint32(40, 64000, true);
for (let i = 0; i < 32000; i++)
  view.setInt16(
    44 + i * 2,
    Math.sin((i / 16000) * 440 * Math.PI * 2) * 1800,
    true,
  );
const episode: Episode = {
  id: "browser-fixture",
  series: "Test",
  title: "录音与单句播放验证",
  published: "2026-11-09",
  duration: 2,
  page: "https://www.bbc.co.uk/learningenglish/",
  audio: URL.createObjectURL(new Blob([bytes], { type: "audio/wav" })),
};
const cues: Cue[] = [
  { text: "Hello world.", start: 0.1, end: 0.65 },
  { text: "Another sentence.", start: 0.7, end: 1.5 },
];
createApp(
  defineComponent({
    setup() {
      provide(ENGINE_KEY, fake);
      const open = ref(false);
      async function realWhisper() {
        realBusy.value = true;
        try {
          state.value = "准备真实 Whisper 模型…";
          await speechEngine.warmup({ status: (text) => (state.value = text) });
          const response = await fetch(
            "/api/bbc/audio?vpid=p0pll9yk&quality=standard&page=" +
              encodeURIComponent(
                "https://www.bbc.co.uk/learningenglish/english/features/real-easy-english/261106",
              ),
          );
          if (!response.ok) throw Error(await response.text());
          const { samples } = await monoAudio(await response.arrayBuffer());
          state.value = "真实 Whisper 推理中…";
          const words = await speechEngine.transcribe(
            samples.slice(16000 * 5, 16000 * 15),
            { status: (text) => (state.value = text) },
          );
          state.value = "真实 Whisper 结果：" + JSON.stringify(words);
        } catch (error) {
          state.value = String(error);
        } finally {
          realBusy.value = false;
        }
      }
      async function realGrammar() {
        realBusy.value = true;
        try {
          state.value = "准备真实 Qwen 模型…";
          const result = await speechEngine.review(
            "She goes to school.",
            "She go to school.",
            { status: (text) => (state.value = text) },
          );
          state.value = "真实语法模型结果：" + JSON.stringify(result);
        } catch (error) {
          state.value = String(error);
        } finally {
          realBusy.value = false;
        }
      }
      return () =>
        h("main", { style: "padding:24px;max-width:1000px;margin:auto" }, [
          h("h1", "开发验证：真实组件 + 合成录音"),
          h(
            "p",
            "本页不访问真人麦克风。评分使用真实 FastAPI；Whisper / Qwen 按钮单独运行真实模型。",
          ),
          h(
            "button",
            {
              class: "primary",
              onClick: () => {
                player.load(episode);
                open.value = true;
              },
            },
            "打开跟读测试",
          ),
          h(
            "button",
            {
              class: "bbc-secondary",
              onClick: () =>
                (state.value = JSON.stringify({
                  ...counts,
                  streams: counts.streams.map((s) =>
                    s.getTracks().map((t) => t.readyState),
                  ),
                  position: playback.position,
                  paused: playback.paused,
                })),
            },
            "读取测试指标",
          ),
          h(
            "button",
            {
              class: "bbc-secondary",
              disabled: realBusy.value,
              onClick: realWhisper,
            },
            "运行真实 Whisper",
          ),
          h(
            "button",
            {
              class: "bbc-secondary",
              disabled: realBusy.value,
              onClick: realGrammar,
            },
            "运行真实语法模型",
          ),
          h(
            "pre",
            { style: "white-space:pre-wrap", role: "status" },
            state.value,
          ),
          open.value
            ? h(RecorderDialog, {
                episode,
                sentence: cues[0]!,
                cues,
                index: 0,
                onClose: () => (open.value = false),
              })
            : null,
        ]);
    },
  }),
).mount("#app");
