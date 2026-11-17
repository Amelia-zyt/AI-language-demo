import { reactive, ref } from "vue";
import { api, apiUrl } from "../api/client";
import { cache } from "../api/cache";
import type {
  Episode,
  Feed,
  OfficialDocument,
  Cue,
  TimestampWord,
} from "../types";
import { sentencesFromWords, transcriptPdf } from "../domain/transcript";
import { monoAudio, speechEngine } from "./useSpeechEngine";
import { player, sourceUrl } from "./usePlayer";
export const episodes = ref<Episode[]>([]),
  feeds = ref<Feed[]>([]),
  catalogStatus = ref("正在读取节目目录…"),
  catalogBusy = ref(false);
export const catalogFilters = reactive({ collection: "all", catalog: "all" });
let pending: Promise<void> | null = null;
export async function loadCatalog(refresh = false) {
  if (pending) return pending;
  catalogBusy.value = true;
  pending = (async () => {
    try {
      const data = await api.catalog(refresh);
      episodes.value = data.episodes;
      feeds.value = data.feeds;
      catalogStatus.value = data.failed_feeds
        ? `${data.failed_feeds} 个栏目暂未更新，已保留目录。`
        : "官方节目目录已就绪";
      localStorage.setItem("lingua-vue-catalog", JSON.stringify(data));
    } catch (error) {
      try {
        const data = JSON.parse(
          localStorage.getItem("lingua-vue-catalog") || "null",
        );
        if (data) {
          episodes.value = data.episodes;
          feeds.value = data.feeds;
        }
      } catch {}
      catalogStatus.value =
        error instanceof Error ? error.message : "目录加载失败";
    } finally {
      catalogBusy.value = false;
      pending = null;
    }
  })();
  return pending;
}
export async function getDocument(episode: Episode) {
  const key = "document:" + episode.id;
  // 单集文稿基本不变；返回详情时先用缓存，避免手机每次等 BBC 网络响应。
  const saved = await cache<OfficialDocument>(key);
  if (saved && (saved.lines.length || saved.links.length)) return saved;
  try {
    const document = await api.document(episode.page);
    await cache(key, document);
    return document;
  } catch (error) {
    if (saved) return saved;
    throw error;
  }
}
export async function downloadPdf(episode: Episode, links: string[]) {
  const pdf = transcriptPdf(links);
  if (!pdf) throw Error("本集没有可用的官方 PDF");
  const mirror = pdf.replace("downloads.bbc.co.uk", "downloads.bbci.co.uk");
  for (const url of [
    mirror,
    pdf,
    apiUrl("/bbc/pdf?url=" + encodeURIComponent(pdf)),
  ]) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) continue;
      const bytes = await response.arrayBuffer();
      if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") continue;
      const object = URL.createObjectURL(
        new Blob([bytes], { type: "application/pdf" }),
      );
      const link = document.createElement("a");
      link.href = object;
      link.download = episode.title.replace(/[\\/:*?"<>|]/g, "_") + ".pdf";
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(object), 60000);
      return;
    } catch {}
  }
  throw Error("下载失败，可点击 BBC官方PDF 打开原文件。");
}
export async function timedTranscript(
  episode: Episode,
  signal: AbortSignal,
  status: (text: string) => void,
  onCues: (cues: Cue[]) => void,
  force = false,
) {
  status("正在读取音频，准备原声时间码…");
  let response = await fetch(sourceUrl(episode), { signal });
  if (!response.ok) response = await fetch(episode.audio, { signal });
  if (!response.ok) throw Error("音频暂时无法读取，请先阅读官方文稿。");
  const bytes = await response.arrayBuffer();
  if (signal.aborted) throw new DOMException("已取消", "AbortError");
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  const key =
    "timed:" +
    episode.id +
    ":" +
    Array.from(new Uint8Array(hash), (v) =>
      v.toString(16).padStart(2, "0"),
    ).join("");
  const saved = force ? null : await cache<Cue[]>(key);
  await player.installBlob(bytes, episode.id);
  if (saved) {
    onCues(saved);
    status("原声时间码已就绪（本机缓存）");
    return;
  }
  const { samples, duration } = await monoAudio(bytes);
  const words: TimestampWord[] = [];
  const total = Math.ceil(duration / 25);
  for (let i = 0; i < total; i++) {
    if (signal.aborted) throw new DOMException("已取消", "AbortError");
    const start = i * 25,
      end = Math.min(duration, (i + 1) * 25),
      a = Math.max(0, start - 2),
      b = Math.min(duration, end + 2);
    status(`正在生成原声时间码 ${i + 1} / ${total} 段…`);
    const result = await speechEngine.transcribe(
      samples.slice(Math.floor(a * 16000), Math.ceil(b * 16000)),
      { signal, status },
    );
    for (const word of result) {
      const [x, y] = word.timestamp;
      if (x === null) continue;
      const first = x + a,
        last = y === null ? null : y + a,
        middle = (first + (last ?? first)) / 2;
      if (middle >= start && middle < end)
        words.push({ text: word.text, timestamp: [first, last] });
    }
    words.sort((x, y) => x.timestamp[0]! - y.timestamp[0]!);
    onCues(sentencesFromWords(words));
  }
  const cues = sentencesFromWords(words);
  if (!cues.length) throw Error("没有识别到可用语音，请对照官方文稿。");
  await cache(key, cues);
  status("自动转写完成 · 点击句子可跳播 BBC 原声。");
}
