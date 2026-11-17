export type Language = "en" | "zh" | "ko" | "ja" | "fr" | "es";
export type Theme = "system" | "dark" | "light" | "fresh" | "eye";
export type PracticeMode = "new" | "spelling" | "listening" | "reverse";
export interface Session {
  counts: number[];
  index: number;
  round: number;
  done: boolean;
  formatVersion: number;
  cycle?: number;
}
export interface LearningRecord {
  date: string;
  lang: Language;
  course: string;
  count: number;
}
export interface Profile {
  lang: Language;
  theme: Theme;
  size: number;
  course: string;
  preference: "foundation" | "content";
  records: LearningRecord[];
  sessions: Record<string, Session>;
  total: number;
  correct: number;
}
export interface Course {
  name: string;
  description: string;
  entries?: [string, string, string, string, string][];
}
export interface Example {
  text: string;
  translation: string;
  source: string;
  url: string | null;
}
export interface LearningContent {
  courses: Record<string, Course>;
  languages: Record<Language, [string, string, string]>;
  meanings: string[];
  words: Record<Language, string[]>;
  basePhonetics: Record<Language, string[]>;
  baseExamples: Record<Language, [string, string][]>;
  citedExamples: Record<string, Example>;
  wordCitation: Record<string, string>;
}
export interface WordEntry {
  word: string;
  meaning: string;
  ipa: string;
  example: Example;
}
export interface Episode {
  id: string;
  series: string;
  title: string;
  published: string;
  duration: number;
  audio: string;
  page: string;
  description?: string;
  channel?: string;
  frequency?: string;
}
export interface Feed {
  id: string;
  name: string;
}
export interface Catalog {
  episodes: Episode[];
  feeds: Feed[];
  failed_feeds: number;
  checked_at: number;
}
export interface OfficialDocument {
  source: string;
  links: string[];
  lines: string[];
}
export interface Cue {
  text: string;
  start: number | null;
  end: number | null;
}
export interface TimestampWord {
  text: string;
  timestamp: [number | null, number | null];
}
export interface GrammarIssue {
  original: string;
  correction: string;
  explanation: string;
  examples: string[];
}
export interface GrammarReview {
  feedback: string;
  issues: GrammarIssue[];
  examples: string[];
}
export interface Assessment {
  score: number;
  referenceWords: number;
  spokenWords: number;
  edits: number;
  alignment: { text: string; matched: boolean | null }[];
  hints: GrammarIssue[];
  metric: "transcript_match";
  attempt_id: number | null;
}
export interface Attempt {
  id: number;
  created: string;
  reference: string;
  transcript: string;
  episode_id: string | null;
  assessment: Assessment;
}
export type ModelMessage =
  | { type: "warmup"; jobId: number }
  | { type: "transcribe"; jobId: number; audio: Float32Array }
  | { type: "review"; jobId: number; reference: string; transcript: string };
export interface ModelResult {
  jobId: number;
  type: "ready" | "result" | "status" | "error";
  words?: TimestampWord[];
  raw?: string;
  message?: string;
}
