import { test } from "node:test";
import assert from "node:assert/strict";
import { assess, grammarHints } from "./assessment";
import { listArticles } from "./articles";
import { evaluatePlacement, placementQuestions } from "./placement";

test("worker assessment matches alignment contracts", () => {
  const res = assess("She goes to school.", "She go to school.");
  assert.equal(res.score, 75);
  assert.equal(res.edits, 1);
  assert.deepEqual(
    res.alignment.filter((x) => x.matched === false).map((x) => x.text),
    ["goes"],
  );
  assert.equal(res.hints[0]?.correction, "She goes");
  assert.equal(assess("Hello, WORLD!", "hello world").score, 100);
  assert.equal(assess("I really like it.", "I like it").score, 75);
  assert.equal(assess("It’s fine.", "it's fine").score, 100);
  assert.deepEqual(grammarHints("Does she go home?"), []);
});

test("worker placement questions sum to 100 and grade A1 through C1", () => {
  const qs = placementQuestions();
  assert.equal(qs.length, 12);
  assert.equal(
    qs.reduce((acc, q) => acc + q.weight, 0),
    100,
  );
  assert.equal("correctIndex" in qs[0]!, false);

  const zero = evaluatePlacement([]);
  assert.equal(zero.score, 0);
  assert.equal(zero.level, "A1");
  assert.equal(zero.recommendedCourse, "general");
});

test("graded textbook articles are ordered from easy to hard", () => {
  const articles = listArticles();
  assert.equal(articles.length, 7);
  assert.equal(articles[0]?.level, "A1");
  assert.equal(articles.at(-1)?.level, "C1");
  for (let i = 1; i < articles.length; i++) {
    assert(articles[i]!.order > articles[i - 1]!.order);
  }
});
