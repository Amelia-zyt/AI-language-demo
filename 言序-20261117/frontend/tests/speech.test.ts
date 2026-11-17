import test from "node:test";
import assert from "node:assert/strict";
import { parseGrammar } from "../src/composables/useSpeechEngine";

test("grammar output validates JSON and preserves real plain-text model advice", () => {
  const structured = parseGrammar(
    '```json\n{"feedback":"Check agreement.","issues":[{"original":"She go","correction":"She goes","examples":["He works.",123]}],"examples":["It rains."]}\n```',
  );
  assert.equal(structured.issues[0]?.correction, "She goes");
  assert.deepEqual(structured.issues[0]?.examples, ["He works."]);
  assert.equal(
    parseGrammar('Use "goes" with "she".').feedback.includes('Use "goes"'),
    true,
  );
  assert.deepEqual(parseGrammar('Incomplete {"feedback":').issues, []);
  assert.throws(() => parseGrammar("  "), /没有返回/);
});
