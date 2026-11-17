import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSimpleMarkdown } from "../src/utils/markdown";

test("renderSimpleMarkdown escapes raw HTML and formats headings, lists, bold, and code", () => {
  const html = renderSimpleMarkdown(
    "### 核心语法\n- **lower and lower**：`越来越低`\n<script>alert(1)</script>",
  );
  assert.equal(html.includes("<script>"), false);
  assert.equal(html.includes("&lt;script&gt;"), true);
  assert.equal(html.includes("<h3>核心语法</h3>"), true);
  assert.equal(
    html.includes("<li><strong>lower and lower</strong>：<code>越来越低</code></li>"),
    true,
  );
});
