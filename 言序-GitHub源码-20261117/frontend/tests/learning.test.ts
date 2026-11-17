import { test } from "node:test";
import assert from "node:assert/strict";
import {
  advance,
  createSession,
  recordAnswer,
  normalize,
} from "../src/domain/learning";
import {
  activeCue,
  sentenceEnd,
  sentencesFromWords,
  transcriptPdf,
} from "../src/domain/transcript";
test("ten words cycle by rounds, reset on error, complete only at three correct answers", () => {
  const s = createSession(10);
  for (let i = 0; i < 10; i++) {
    assert.equal(s.index, i);
    recordAnswer(s, true);
    advance(s);
  }
  assert.equal(s.index, 0);
  assert.equal(s.cycle, 2);
  assert.deepEqual(s.counts, Array(10).fill(1));
  recordAnswer(s, false);
  assert.equal(s.counts[0], 0);
  advance(s);
  for (let i = 0; i < 60 && !s.done; i++) {
    recordAnswer(s, true);
    advance(s);
  }
  assert(s.done);
  assert(s.counts.every((n) => n === 3));
  assert.equal(createSession(2).counts.length, 10);
});
test("normalization and timing maintain expected behavior", () => {
  assert.equal(normalize(" Hello, world！"), "helloworld");
  const cues = sentencesFromWords([
    { text: "Hello", timestamp: [0, 0.5] },
    { text: " world.", timestamp: [0.5, 1] },
    { text: "Next.", timestamp: [1.2, 2] },
  ]);
  assert.equal(cues.length, 2);
  assert.equal(activeCue(cues, 0.8), 0);
  assert.equal(activeCue(cues, 1.1), -1);
  assert.equal(sentenceEnd(cues, 0), 1);
  assert.equal(
    sentenceEnd([{ text: "Untimed", start: null, end: null }], 0),
    null,
  );
  assert.equal(
    transcriptPdf(["worksheet.pdf", "episode_transcript.pdf"]),
    "episode_transcript.pdf",
  );
  assert.equal(transcriptPdf(["worksheet.pdf"]), null);
});
