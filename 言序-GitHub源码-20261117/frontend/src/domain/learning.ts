import type { LearningContent, Profile, WordEntry, Session } from "../types";
export const courseKey = (state: Profile) =>
  state.preference === "foundation" || state.lang !== "en"
    ? "general"
    : state.course;
export const sessionKey = (state: Profile) =>
  courseKey(state) === "general"
    ? state.lang
    : state.lang + ":" + courseKey(state);
export function entries(content: LearningContent, state: Profile): WordEntry[] {
  const selected = content.courses[courseKey(state)];
  if (selected.entries)
    return selected.entries.map(([word, meaning, ipa, text, translation]) => ({
      word,
      meaning,
      ipa,
      example: content.citedExamples[content.wordCitation[word]] || {
        text,
        translation,
        source: "原创练习例句",
        url: null,
      },
    }));
  return content.words[state.lang].map((word, i) => ({
    word,
    meaning: state.lang === "zh" ? content.words.en[i] : content.meanings[i],
    ipa: content.basePhonetics[state.lang][i],
    example:
      state.lang === "en" && content.wordCitation[word]
        ? content.citedExamples[content.wordCitation[word]]
        : {
            text: content.baseExamples[state.lang][i][0],
            translation: content.baseExamples[state.lang][i][1],
            source: "原创练习例句",
            url: null,
          },
  }));
}
export function createSession(size: number, round = 1): Session {
  return {
    counts: Array(Math.min(20, Math.max(10, size))).fill(0),
    index: 0,
    round,
    done: false,
    formatVersion: 2,
    cycle: 1,
  };
}
export function recordAnswer(session: Session, correct: boolean) {
  session.counts[session.index] = correct
    ? Math.min(3, session.counts[session.index] + 1)
    : 0;
}
export function advance(session: Session) {
  if (session.counts.every((x) => x === 3)) {
    session.done = true;
    return;
  }
  let next = (session.index + 1) % session.counts.length;
  while (session.counts[next] === 3) next = (next + 1) % session.counts.length;
  if (next <= session.index) session.cycle = (session.cycle || 1) + 1;
  session.index = next;
}
export const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\p{P}\p{Z}\s]/gu, "");
export function options(index: number, length: number) {
  return [
    index,
    (index + 3) % length,
    (index + 7) % length,
    (index + 11) % length,
  ].sort((a, b) => ((a * 7 + index * 3) % 23) - ((b * 7 + index * 3) % 23));
}
