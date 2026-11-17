import type { Cue, TimestampWord } from "../types";
export function formatTime(value: number) {
  const n = Math.max(0, Math.floor(value || 0));
  return n >= 3600
    ? `${Math.floor(n / 3600)}:${String(Math.floor(n / 60) % 60).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`
    : `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}
export function dateText(value: string, withTime = true) {
  return new Date(value).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime
      ? { hour: "2-digit" as const, minute: "2-digit" as const }
      : {}),
    timeZone: "Asia/Shanghai",
  });
}
export function officialCues(lines: string[]): Cue[] {
  return lines
    .filter(
      (s) =>
        !/^Note:|not a word-for-word|^TRANSCRIPT$/i.test(s) &&
        !(/^[A-Z][a-z]+(?: [A-Z][a-z]+)?$/.test(s) && s.length < 30),
    )
    .flatMap((s) => s.match(/[^.!?]+(?:[.!?]+|$)/g) || [s])
    .map((text) => ({ text: text.trim(), start: null, end: null }))
    .filter((c) => c.text);
}
export function sentencesFromWords(words: TimestampWord[]): Cue[] {
  const output: Cue[] = [];
  let sentence: Cue | null = null;
  for (const word of words) {
    const [start, end] = word.timestamp;
    if (start === null || !Number.isFinite(start) || !word.text.trim())
      continue;
    const finish =
      end !== null && Number.isFinite(end)
        ? Math.max(start + 0.01, end)
        : start + 0.1;
    if (!sentence) sentence = { text: word.text.trim(), start, end: finish };
    else {
      sentence.text += (/^\s/.test(word.text) ? "" : " ") + word.text;
      sentence.end = Math.max(sentence.end!, finish);
    }
    if (
      /[.!?]["'”’)]*$/.test(word.text.trim()) ||
      sentence.end! - sentence.start! > 18
    ) {
      output.push(sentence);
      sentence = null;
    }
  }
  if (sentence) output.push(sentence);
  return output;
}
export function activeCue(cues: Cue[], time: number) {
  let low = 0,
    high = cues.length - 1,
    found = -1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    if (cues[mid].start !== null && cues[mid].start! <= time) {
      found = mid;
      low = mid + 1;
    } else high = mid - 1;
  }
  return found >= 0 && cues[found].end !== null && time < cues[found].end!
    ? found
    : -1;
}
export function transcriptPdf(links: string[]) {
  return (
    links.find((x) => /transcript/i.test(x)) ||
    links.find(
      (x) => !/(worksheet|exercise|quiz|activity|lesson[_-]?plan)/i.test(x),
    ) ||
    null
  );
}
export function sentenceEnd(cues: Cue[], index: number) {
  const cue = cues[index];
  if (!cue || cue.start === null) return null;
  const ends = [cue.end, cues[index + 1]?.start].filter(
    (x): x is number =>
      typeof x === "number" && Number.isFinite(x) && x > cue.start!,
  );
  return ends.length ? Math.min(...ends) : null;
}
