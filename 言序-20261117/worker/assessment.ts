export interface TokenMatch {
  text: string;
  matched: boolean | null;
}

export interface GrammarHint {
  original: string;
  correction: string;
  explanation: string;
  examples: string[];
}

export interface AssessmentResult {
  score: number;
  referenceWords: number;
  spokenWords: number;
  edits: number;
  alignment: TokenMatch[];
  hints: GrammarHint[];
  metric: "transcript_match";
  attempt_id: number | null;
}

const TOKEN_RE = /[\p{L}\p{N}]+(?:'\p{L}+)?/gu;
const SEGMENT_RE = /([\p{L}\p{N}]+(?:['’]\p{L}+)?)/gu;
const THIRD_PERSON_RE =
  /\b(he|she|it)\s+(go|do|have|want|like|need|work|play|study|live|speak)\b/gi;
const MODAL_LOOKBACK_RE =
  /\b(does|did|can|could|will|would|should|must|may|might|doesn't|didn't)\s*$/i;

const THIRD_FORMS: Record<string, string> = {
  go: "goes",
  do: "does",
  have: "has",
  want: "wants",
  like: "likes",
  need: "needs",
  work: "works",
  play: "plays",
  study: "studies",
  live: "lives",
  speak: "speaks",
};

export function tokens(text: string): string[] {
  const normalized = text.normalize("NFKC").toLowerCase().replace(/’/g, "'");
  return normalized.match(TOKEN_RE) || [];
}

export function grammarHints(text: string): GrammarHint[] {
  const output: GrammarHint[] = [];
  THIRD_PERSON_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = THIRD_PERSON_RE.exec(text)) !== null) {
    const start = match.index;
    const before = text.slice(Math.max(0, start - 20), start);
    if (MODAL_LOOKBACK_RE.test(before)) continue;
    const form = THIRD_FORMS[match[2].toLowerCase()];
    if (!form) continue;
    output.push({
      original: match[0],
      correction: `${match[1]} ${form}`,
      explanation:
        "一般现在时中 he / she / it 后实义动词通常使用第三人称单数形式；需结合语境核对。",
      examples: [
        "He works in a small library.",
        "She studies English every evening.",
      ],
    });
    if (output.length >= 5) break;
  }
  return output;
}

export function assess(
  reference: string,
  transcript: string,
): AssessmentResult {
  const a = tokens(reference);
  const b = tokens(transcript);

  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0),
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const sub = a[i - 1] !== b[j - 1] ? 1 : 0;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + sub,
      );
    }
  }

  const matches = Array<boolean>(a.length).fill(false);
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    const sub = i > 0 && j > 0 && a[i - 1] !== b[j - 1] ? 1 : 0;
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + sub) {
      matches[i - 1] = a[i - 1] === b[j - 1];
      i--;
      j--;
    } else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      i--;
    } else {
      j--;
    }
  }

  const segments = reference.split(SEGMENT_RE).filter(Boolean);
  const alignment: TokenMatch[] = [];
  let cursor = 0;
  for (const segment of segments) {
    const hasWord = tokens(segment).length > 0;
    alignment.push({
      text: segment,
      matched: hasWord && cursor < matches.length ? matches[cursor] : null,
    });
    if (hasWord) cursor++;
  }

  const edits = dp[a.length][b.length];
  const denom = Math.max(a.length, b.length);
  const score =
    a.length > 0
      ? Math.max(0, Math.floor((1 - edits / denom) * 100 + 0.5))
      : 0;

  return {
    score,
    referenceWords: a.length,
    spokenWords: b.length,
    edits,
    alignment,
    hints: grammarHints(transcript),
    metric: "transcript_match",
    attempt_id: null,
  };
}
