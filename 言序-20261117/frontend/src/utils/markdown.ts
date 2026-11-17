function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInline(raw: string): string {
  let s = escapeHtml(raw);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return s;
}

/**
 * Converts simple Markdown (headings, bullet/numbered lists, bold, inline code)
 * into sanitized HTML with all raw tags escaped first.
 */
export function renderSimpleMarkdown(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let inList: "ul" | "ol" | null = null;

  const closeList = () => {
    if (inList) {
      html.push(`</${inList}>`);
      inList = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeList();
      continue;
    }
    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = Math.min(4, Math.max(2, heading[1].length));
      html.push(`<h${level}>${formatInline(heading[2])}</h${level}>`);
      continue;
    }
    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (inList !== "ul") {
        closeList();
        inList = "ul";
        html.push("<ul>");
      }
      html.push(`<li>${formatInline(ul[1])}</li>`);
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (inList !== "ol") {
        closeList();
        inList = "ol";
        html.push("<ol>");
      }
      html.push(`<li>${formatInline(ol[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${formatInline(line)}</p>`);
  }
  closeList();
  return html.join("");
}
