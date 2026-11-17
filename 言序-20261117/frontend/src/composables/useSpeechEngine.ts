import type { InjectionKey } from "vue";
import type {
  GrammarReview,
  ModelMessage,
  ModelResult,
  TimestampWord,
} from "../types";
export interface EngineOptions {
  signal?: AbortSignal;
  status?: (message: string) => void;
}
export interface SpeechEngine {
  warmup: (options?: EngineOptions) => Promise<void>;
  transcribe: (
    audio: Float32Array,
    options?: EngineOptions,
  ) => Promise<TimestampWord[]>;
  review: (
    reference: string,
    transcript: string,
    options?: EngineOptions,
  ) => Promise<GrammarReview>;
}
export const ENGINE_KEY: InjectionKey<SpeechEngine> = Symbol("speech-engine");
function client() {
  let worker: Worker | null = null,
    sequence = 0;
  const pending = new Map<
    number,
    {
      resolve: (data: ModelResult) => void;
      reject: (error: Error) => void;
      cleanup: () => void;
      status?: EngineOptions["status"];
    }
  >();
  function dispose(error: Error) {
    worker?.terminate();
    worker = null;
    for (const p of pending.values()) {
      p.cleanup();
      p.reject(error);
    }
    pending.clear();
  }
  return (
    message:
      | Omit<Extract<ModelMessage, { type: "warmup" }>, "jobId">
      | Omit<Extract<ModelMessage, { type: "transcribe" }>, "jobId">
      | Omit<Extract<ModelMessage, { type: "review" }>, "jobId">,
    options: EngineOptions = {},
  ): Promise<ModelResult> => {
    if (!worker) {
      worker = new Worker(
        new URL("../workers/speech.worker.ts", import.meta.url),
        { type: "module" },
      );
      worker.onmessage = ({ data }: { data: ModelResult }) => {
        const p = pending.get(data.jobId);
        if (!p) return;
        if (data.type === "status") {
          p.status?.(data.message || "处理中…");
          return;
        }
        p.cleanup();
        pending.delete(data.jobId);
        if (data.type === "error") p.reject(Error(data.message));
        else p.resolve(data);
      };
      worker.onerror = () =>
        dispose(Error("本机模型未能加载，请检查网络或浏览器支持。"));
    }
    const jobId = ++sequence;
    return new Promise((resolve, reject) => {
      const abort = () => {
        const p = pending.get(jobId);
        if (p) {
          p.cleanup();
          pending.delete(jobId);
        }
        reject(new DOMException("已取消", "AbortError"));
      };
      const timer = setTimeout(
        () => {
          pending.delete(jobId);
          options.signal?.removeEventListener("abort", abort);
          reject(
            Error(
              message.type === "review"
                ? "语法建议等待超时，请稍后重试；录音和评分已保留。"
                : "识别等待超时，请保留录音后重试。",
            ),
          );
        },
        message.type === "review" ? 600000 : 180000,
      );
      const cleanup = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
      };
      pending.set(jobId, { resolve, reject, cleanup, status: options.status });
      if (options.signal?.aborted) {
        abort();
        return;
      }
      options.signal?.addEventListener("abort", abort, { once: true });
      const payload = { ...message, jobId };
      worker!.postMessage(
        payload,
        message.type === "transcribe"
          ? [message.audio.buffer as ArrayBuffer]
          : [],
      );
    });
  };
}
const speechRequest = client(),
  grammarRequest = client();
let warm: Promise<void> | null = null;
export function parseGrammar(raw: string): GrammarReview {
  if (!raw.trim()) throw Error("AI 没有返回建议，请稍后重试。");
  const start = raw.indexOf("{"),
    end = raw.lastIndexOf("}");
  let value: unknown;
  try {
    value = JSON.parse(raw.slice(start, end + 1));
  } catch {
    // 小模型不总能遵循 JSON 格式；展示实际生成文字，不伪造结构化点评。
    return {
      feedback: "AI 返回了文字建议，请结合原文核对：\n" + raw.slice(0, 4000),
      issues: [],
      examples: [],
    };
  }
  if (!value || typeof value !== "object") throw Error("语法建议格式无效");
  const data = value as Partial<GrammarReview>;
  return {
    feedback:
      typeof data.feedback === "string" ? data.feedback : "请结合原文核对。",
    issues: Array.isArray(data.issues)
      ? data.issues
          .filter(
            (i) =>
              i &&
              typeof i.original === "string" &&
              typeof i.correction === "string",
          )
          .map((i) => ({
            ...i,
            explanation: typeof i.explanation === "string" ? i.explanation : "",
            examples: Array.isArray(i.examples)
              ? i.examples.filter((x) => typeof x === "string")
              : [],
          }))
          .slice(0, 3)
      : [],
    examples: Array.isArray(data.examples)
      ? data.examples.filter((x) => typeof x === "string").slice(0, 3)
      : [],
  };
}
export const speechEngine: SpeechEngine = {
  warmup(options = {}) {
    if (!warm)
      warm = speechRequest({ type: "warmup" }, options)
        .then(() => {})
        .catch((error) => {
          warm = null;
          throw error;
        });
    return warm;
  },
  async transcribe(audio, options = {}) {
    await speechEngine.warmup();
    const result = await speechRequest({ type: "transcribe", audio }, options);
    return result.words || [];
  },
  async review(reference, transcript, options = {}) {
    const result = await grammarRequest(
      { type: "review", reference, transcript },
      options,
    );
    return parseGrammar(result.raw || "");
  },
};
export async function monoAudio(bytes: ArrayBuffer) {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(bytes.slice(0));
    const offline = new OfflineAudioContext(
      1,
      Math.ceil(decoded.duration * 16000),
      16000,
    );
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    return {
      samples: (await offline.startRendering()).getChannelData(0).slice(),
      duration: decoded.duration,
    };
  } finally {
    await context.close();
  }
}
