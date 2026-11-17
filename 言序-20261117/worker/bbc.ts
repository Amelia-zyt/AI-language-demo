export interface FeedInfo {
  id: string;
  name: string;
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

export const FEEDS: FeedInfo[] = [
  { id: "p0hsrwv5", name: "Learning Easy English" },
  { id: "p0h6ffwg", name: "Learning English For Work" },
  { id: "p02pc9tn", name: "6 Minute English" },
  { id: "p02pc9wq", name: "Learning English Grammar" },
  { id: "p02pc9xz", name: "Learning English Vocabulary" },
  { id: "p02pc9zn", name: "Learning English Conversations" },
  { id: "p05hw4bq", name: "Learning English from the News" },
  { id: "p02pc9s1", name: "Learning English Stories" },
];

const ALLOWED_SERIES = new Set(FEEDS.map((f) => f.id));
const BBC_PAGES = new Set(["www.bbc.co.uk", "bbc.co.uk", "feeds.bbci.co.uk"]);
const DOWNLOAD_HOSTS = new Set(["downloads.bbc.co.uk", "downloads.bbci.co.uk"]);
const PODCAST_HOSTS = new Set(["podcasts.files.bbci.co.uk"]);
const SELECTOR_HOSTS = new Set(["open.live.bbc.co.uk"]);
const TRITON_HOSTS = new Set(["bbc.pdn.tritondigital.com"]);

const MAX_DOCUMENT = 8 * 1024 * 1024;
const MAX_PDF = 25 * 1024 * 1024;

let cachedEpisodes: Episode[] | null = null;
let lastCheckedMs = 0;
let refreshPromise: Promise<number> | null = null;

export class UpstreamError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function validUrl(
  value: string,
  hosts: Set<string>,
  prefix = "/",
  suffix = "",
): boolean {
  if (!value || /[\r\n]/.test(value)) return false;
  try {
    const u = new URL(value);
    const hasExplicitPort = u.port !== "";
    return (
      u.protocol === "https:" &&
      hosts.has(u.hostname.toLowerCase()) &&
      !u.username &&
      !u.password &&
      !hasExplicitPort &&
      u.pathname.startsWith(prefix) &&
      u.pathname.endsWith(suffix)
    );
  } catch {
    return false;
  }
}

export async function openUpstream(
  url: string,
  hosts: Set<string>,
  opts: { method?: string; headers?: Record<string, string>; timeoutMs?: number } = {},
): Promise<Response> {
  let current = url;
  const method = opts.method || "GET";
  const timeoutMs = opts.timeoutMs || 20000;

  for (let hop = 0; hop < 6; hop++) {
    if (!validUrl(current, hosts)) {
      throw new UpstreamError("不允许的 BBC 下载地址");
    }
    const resp = await fetch(current, {
      method,
      redirect: "manual",
      headers: {
        "User-Agent": "LinguaStudyStudio/2.0",
        "Accept-Encoding": "identity",
        ...(opts.headers || {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });

    if ([301, 302, 303, 307, 308].includes(resp.status)) {
      const location = resp.headers.get("Location");
      try {
        await resp.body?.cancel();
      } catch {}
      if (!location) throw new UpstreamError("BBC 跳转地址为空");
      current = new URL(location, current).toString();
      continue;
    }
    return resp;
  }
  throw new UpstreamError("BBC 跳转次数过多");
}

async function readBytes(resp: Response, limit = MAX_DOCUMENT): Promise<Uint8Array> {
  if (resp.status < 200 || resp.status >= 300) {
    throw new UpstreamError(`BBC HTTP ${resp.status}`);
  }
  const buf = new Uint8Array(await resp.arrayBuffer());
  if (buf.byteLength > limit) {
    throw new UpstreamError("BBC 文件超过允许大小");
  }
  return buf;
}

function replaceHost(rawUrl: string, host: string): string {
  const u = new URL(rawUrl);
  u.hostname = host;
  u.hash = "";
  return u.toString();
}

function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16)),
    );
}

export async function publicDocument(url: string): Promise<string> {
  for (const candidate of [replaceHost(url, "feeds.bbci.co.uk"), url]) {
    try {
      const resp = await openUpstream(candidate, BBC_PAGES);
      const bytes = await readBytes(resp);
      return new TextDecoder("utf-8").decode(bytes);
    } catch {
      continue;
    }
  }
  throw new UpstreamError("BBC 官方文稿暂时无法获取");
}

export function parseDocument(source: string, url: string) {
  const rawLinks =
    source.match(/https:\/\/downloads\.bbc\.co\.uk\/learningenglish\/[^"<>\s]+\.pdf/g) ||
    [];
  const links = Array.from(new Set(rawLinks.map(unescapeHtml)));
  const marker = source.match(
    /<(?:strong|h[1-6])\b[^>]*>\s*transcript\s*<\/(?:strong|h[1-6])>/i,
  );
  let lines: string[] = [];
  if (marker && marker.index !== undefined) {
    let fragment = source
      .slice(marker.index + marker[0].length)
      .split("</div>", 1)[0]
      .slice(0, 100000);
    fragment = fragment.replace(
      /<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/gi,
      "",
    );
    fragment = fragment.replace(/<br\s*\/?\s*>|<\/(?:p|h[1-6])>/gi, "\n");
    const text = unescapeHtml(fragment.replace(/<[^>]+>/g, ""));
    lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
  }
  return { source: url, links, lines };
}

export async function pdfBytes(url: string): Promise<Uint8Array> {
  for (const candidate of [replaceHost(url, "downloads.bbci.co.uk"), url]) {
    try {
      const resp = await openUpstream(candidate, DOWNLOAD_HOSTS, {
        timeoutMs: 15000,
      });
      const data = await readBytes(resp, MAX_PDF);
      if (
        data.byteLength >= 5 &&
        new TextDecoder().decode(data.slice(0, 5)) === "%PDF-"
      ) {
        return data;
      }
    } catch {
      continue;
    }
  }
  throw new UpstreamError(
    "BBC 官方 PDF 暂时无法获取，请点击 BBC官方PDF 打开原文件。",
  );
}

export async function audioResponse(
  vpid: string,
  quality: string,
  page: string,
  method: string,
  rangeHeader: string,
): Promise<Response> {
  const reqHeaders = rangeHeader ? { Range: rangeHeader } : undefined;
  try {
    const mediaset =
      quality === "standard"
        ? "audio-nondrm-download-rss"
        : "audio-nondrm-download-rss-low";
    const selUrl = `https://open.live.bbc.co.uk/mediaselector/6/select/version/2.0/mediaset/${mediaset}/vpid/${vpid}/format/json`;
    const selResp = await openUpstream(selUrl, SELECTOR_HOSTS);
    const data = JSON.parse(
      new TextDecoder().decode(await readBytes(selResp)),
    ) as {
      media?: {
        kind?: string;
        type?: string;
        connection?: { href?: string; protocol?: string }[];
      }[];
    };
    for (const media of data.media || []) {
      if (media.kind !== "audio" || media.type !== "audio/mpeg") continue;
      for (const conn of media.connection || []) {
        const target = conn.href || "";
        if (conn.protocol === "https" && validUrl(target, TRITON_HOSTS)) {
          const r = await openUpstream(target, TRITON_HOSTS, {
            method,
            headers: reqHeaders,
          });
          if ((r.status >= 200 && r.status < 300) || r.status === 416) {
            return r;
          }
          try {
            await r.body?.cancel();
          } catch {}
        }
      }
    }
  } catch {
    // fallback to page scraping
  }

  if (
    validUrl(page, new Set(["bbc.co.uk", "www.bbc.co.uk"]), "/learningenglish/")
  ) {
    try {
      const doc = await publicDocument(page);
      const links = Array.from(
        new Set(
          doc.match(
            /https:\/\/downloads\.bbc\.co\.uk\/learningenglish\/[^"<>\s]+\.mp3/g,
          ) || [],
        ),
      ).sort(
        (a, b) =>
          Number(!a.endsWith("_download.mp3")) -
          Number(!b.endsWith("_download.mp3")),
      );
      for (const link of links) {
        for (const candidate of [replaceHost(link, "downloads.bbci.co.uk"), link]) {
          try {
            const r = await openUpstream(candidate, DOWNLOAD_HOSTS, {
              method,
              headers: reqHeaders,
            });
            if ((r.status >= 200 && r.status < 300) || r.status === 416) {
              return r;
            }
            try {
              await r.body?.cancel();
            } catch {}
          } catch {
            continue;
          }
        }
      }
    } catch {
      // fall through to error
    }
  }
  throw new UpstreamError(
    "BBC 当前不允许读取该集音频，且未找到公开下载文件，请在 BBC 官网收听。",
  );
}

function extractTag(block: string, tagName: string): string {
  const re = new RegExp(
    `<(?:[a-z0-9_-]+:)?${tagName}\\b[^>]*>([\\s\\S]*?)<\\/(?:[a-z0-9_-]+:)?${tagName}>`,
    "i",
  );
  const m = block.match(re);
  if (!m) return "";
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .trim();
}

export function parseFeed(xml: string, series: string): Episode[] {
  const channelMatch = xml.match(/<channel\b[^>]*>([\s\S]*?)<\/channel>/i);
  if (!channelMatch) return [];
  const channelBody = channelMatch[1];
  const headerPart = channelBody.split(/<item\b/i, 1)[0];
  const channelAuthor =
    unescapeHtml(extractTag(headerPart, "author")) || "BBC";
  const freqMatch = headerPart.match(
    /<(?:[a-z0-9_-]+:)?seriesDetails\b[^>]*\bfrequency=["']([^"']*)["']/i,
  );
  const frequency = freqMatch ? freqMatch[1] : "";

  const output: Episode[] = [];
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/gi;
  let itemMatch: RegExpExecArray | null;
  while ((itemMatch = itemRe.exec(channelBody)) !== null) {
    const item = itemMatch[1];
    const encMatch =
      item.match(/<(?:[a-z0-9_-]+:)?enclosureSecure\b[^>]*\burl=["']([^"']+)["']/i) ||
      item.match(/<enclosure\b[^>]*\burl=["']([^"']+)["']/i);
    let audio = encMatch ? encMatch[1] : "";
    if (!audio.startsWith("https://") && !audio.startsWith("http://")) continue;
    audio = audio
      .replace(/^http:\/\//, "https://")
      .replace("/proto/http/", "/proto/https/");

    const description = unescapeHtml(extractTag(item, "description"));
    const hrefMatches = Array.from(
      description.matchAll(/href=["']([^"']+)/g),
      (m) => m[1],
    );
    const page =
      hrefMatches.find((u) =>
        /^https:\/\/(?:www\.)?bbc\.co\.uk\/learningenglish\//.test(u),
      ) || extractTag(item, "link");

    const paraMatch = description.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const intro = (paraMatch ? paraMatch[1] : description)
      .replace(/<[^>]*>/g, "")
      .split("FIND BBC LEARNING ENGLISH")[0]
      .trim()
      .slice(0, 2500);

    const pubRaw = extractTag(item, "pubDate");
    const pubTime = Date.parse(pubRaw);
    if (!Number.isFinite(pubTime)) continue;

    let duration = 0;
    const durRaw = extractTag(item, "duration");
    if (durRaw) {
      let validDur = true;
      for (const part of durRaw.split(":")) {
        const n = Number(part || "0");
        if (!Number.isFinite(n)) {
          validDur = false;
          break;
        }
        duration = duration * 60 + Math.floor(n);
      }
      if (!validDur) continue;
    }

    output.push({
      id: extractTag(item, "guid"),
      series,
      title: unescapeHtml(extractTag(item, "title")),
      published: new Date(pubTime).toISOString(),
      duration,
      audio,
      page,
      description: intro,
      channel: channelAuthor,
      frequency,
    });
  }
  return output;
}

async function ensureSeedCatalog(assets: Fetcher): Promise<Episode[]> {
  if (cachedEpisodes) return cachedEpisodes;
  const resp = await assets.fetch("https://assets.local/seed/bbc-catalog.json");
  if (!resp.ok) {
    cachedEpisodes = [];
    return cachedEpisodes;
  }
  const text = (await resp.text()).replace(/^\uFEFF/, "");
  const parsed = JSON.parse(text) as { episodes?: Episode[] };
  cachedEpisodes = parsed.episodes || [];
  return cachedEpisodes;
}

export async function getEpisodesCatalog(
  assets: Fetcher,
  refresh: boolean,
): Promise<{
  episodes: Episode[];
  feeds: FeedInfo[];
  failed_feeds: number;
  checked_at: number;
}> {
  const current = await ensureSeedCatalog(assets);
  let failures = 0;

  if (refresh && Date.now() - lastCheckedMs > 60_000) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const merged = new Map<string, Episode>();
        for (const ep of current) merged.set(ep.id, ep);
        let failed = 0;
        const results = await Promise.allSettled(
          FEEDS.map(async (feed) => {
            const resp = await openUpstream(
              `https://podcasts.files.bbci.co.uk/${feed.id}.rss`,
              PODCAST_HOSTS,
            );
            const xml = new TextDecoder().decode(await readBytes(resp));
            return parseFeed(xml, feed.id);
          }),
        );
        for (const r of results) {
          if (r.status === "fulfilled") {
            for (const ep of r.value) {
              if (ep.id) merged.set(ep.id, ep);
            }
          } else {
            failed++;
          }
        }
        cachedEpisodes = Array.from(merged.values()).sort((a, b) =>
          b.published.localeCompare(a.published),
        );
        lastCheckedMs = Date.now();
        return failed;
      })().finally(() => {
        refreshPromise = null;
      });
    }
    failures = await refreshPromise;
  }

  return {
    episodes: cachedEpisodes || [],
    feeds: FEEDS,
    failed_feeds: failures,
    checked_at: lastCheckedMs ? lastCheckedMs / 1000 : 0,
  };
}

export function isAllowedSeries(series: string): boolean {
  return ALLOWED_SERIES.has(series);
}

export { PODCAST_HOSTS };
