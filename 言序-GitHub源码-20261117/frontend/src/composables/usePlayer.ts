import { reactive } from "vue";
import { apiUrl } from "../api/client";
import { toast } from "./useProfile";
import type { Cue, Episode } from "../types";
import { sentenceEnd } from "../domain/transcript";
const audio = new Audio();
audio.preload = "metadata";
const savedRate = Number(localStorage.getItem("lingua-bbc-rate")) || 1;
export const playback = reactive({
  episode: null as Episode | null,
  playing: false,
  paused: true,
  recording: false,
  rate: [0.8, 0.9, 1, 1.3, 1.5].includes(savedRate) ? savedRate : 1,
  position: 0,
  duration: 0,
  status: "",
});
let clipEnd: number | null = null,
  clipTimer: ReturnType<typeof setTimeout> | undefined,
  clipDone: (() => void) | undefined,
  blobUrl: string | null = null;
export function sourceUrl(episode: Episode) {
  const vpid = episode.audio.match(/\/vpid\/([bp][a-z0-9]{7})\.mp3/)?.[1];
  return vpid
    ? apiUrl(
        "/bbc/audio?vpid=" +
          vpid +
          (episode.audio.includes("download-rss/proto")
            ? "&quality=standard"
            : "") +
          "&page=" +
          encodeURIComponent(episode.page),
      )
    : episode.audio;
}
function clearClip(pause = false) {
  clearTimeout(clipTimer);
  const done = clipDone,
    active = clipEnd !== null;
  clipEnd = null;
  clipDone = undefined;
  if (pause && active) audio.pause();
  done?.();
}
function checkClip() {
  clearTimeout(clipTimer);
  if (clipEnd === null || audio.paused) return;
  const remaining = clipEnd - audio.currentTime;
  if (remaining <= 0.015) {
    const end = clipEnd;
    clearClip(true);
    audio.currentTime = end;
    return;
  }
  clipTimer = setTimeout(
    checkClip,
    Math.max(16, Math.min(80, (remaining / audio.playbackRate) * 1000)),
  );
}
async function play(end: number | null = null, done?: () => void) {
  if (playback.recording) {
    toast("请先结束跟读录音");
    return false;
  }
  clearClip();
  speechSynthesis?.cancel();
  clipEnd = end;
  clipDone = done;
  try {
    await audio.play();
    checkClip();
    return true;
  } catch (error) {
    clearClip();
    if (!(error instanceof DOMException && error.name === "AbortError"))
      playback.status = "暂时无法播放，可在单集详情打开 BBC 官网音频。";
    return false;
  }
}
function pause() {
  audio.pause();
  clearClip();
}
function load(episode: Episode) {
  if (playback.episode?.id === episode.id) return;
  pause();
  if (blobUrl) URL.revokeObjectURL(blobUrl);
  blobUrl = null;
  playback.episode = episode;
  playback.position = 0;
  playback.duration = episode.duration;
  playback.status = "";
  audio.src = sourceUrl(episode);
  audio.playbackRate = playback.rate;
  document.body.classList.add("bbc-player-open");
}
function seek(position: number) {
  audio.currentTime = Math.max(
    0,
    Math.min(
      Number.isFinite(audio.duration) ? audio.duration : playback.duration,
      position,
    ),
  );
}
async function playSentence(cues: Cue[], index: number, done?: () => void) {
  const cue = cues[index],
    end = sentenceEnd(cues, index);
  if (!cue || cue.start === null || end === null)
    return "本句暂无完整原声时间码，请先生成原声时间码。";
  clearClip(true);
  seek(cue.start);
  return play(end, done);
}
audio.addEventListener("timeupdate", () => {
  playback.position = audio.currentTime;
  checkClip();
});
audio.addEventListener("loadedmetadata", () => {
  playback.duration = Number.isFinite(audio.duration)
    ? audio.duration
    : playback.duration;
});
audio.addEventListener("play", () => (playback.paused = false));
audio.addEventListener("playing", () => {
  playback.playing = true;
  playback.status = "";
  checkClip();
});
audio.addEventListener("pause", () => {
  playback.paused = true;
  playback.playing = false;
  clearClip();
});
audio.addEventListener("ended", () => {
  playback.paused = true;
  playback.playing = false;
  clearClip();
});
audio.addEventListener("waiting", () => (playback.status = "正在缓冲音频…"));
audio.addEventListener("error", () => {
  clearClip();
  playback.status = "BBC 暂未允许读取此音频，可在详情页打开官网收听。";
});
audio.addEventListener("ratechange", checkClip);
export const player = {
  load,
  play,
  pause,
  seek,
  playSentence,
  stopSentence: () => clearClip(true),
  toggle: () => (audio.paused ? play() : pause()),
  skip: (seconds: number) => {
    clearClip();
    seek(audio.currentTime + seconds);
  },
  setRate: (rate: number) => {
    playback.rate = rate;
    audio.playbackRate = rate;
    localStorage.setItem("lingua-bbc-rate", String(rate));
  },
  async installBlob(bytes: ArrayBuffer, id: string) {
    if (playback.episode?.id !== id) return;
    const position = audio.currentTime,
      wasPlaying = !audio.paused;
    const old = blobUrl;
    blobUrl = URL.createObjectURL(new Blob([bytes], { type: "audio/mpeg" }));
    audio.src = blobUrl;
    audio.playbackRate = playback.rate;
    audio.addEventListener(
      "loadedmetadata",
      () => {
        if (playback.episode?.id === id) {
          seek(position);
          if (wasPlaying) void play();
        }
      },
      { once: true },
    );
    if (old) URL.revokeObjectURL(old);
  },
};
