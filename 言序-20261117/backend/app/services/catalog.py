from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
import html
import json
import re
import threading
import time
import xml.etree.ElementTree as ET
from ..config import DATA
from .bbc_upstream import open_upstream, read_bytes

FEEDS = [
    {"id": key, "name": name}
    for key, name in [
        ("p0hsrwv5", "Learning Easy English"),
        ("p0h6ffwg", "Learning English For Work"),
        ("p02pc9tn", "6 Minute English"),
        ("p02pc9wq", "Learning English Grammar"),
        ("p02pc9xz", "Learning English Vocabulary"),
        ("p02pc9zn", "Learning English Conversations"),
        ("p05hw4bq", "Learning English from the News"),
        ("p02pc9s1", "Learning English Stories"),
    ]
]
_episodes = json.loads((DATA / "bbc-catalog.json").read_text(encoding="utf-8-sig"))[
    "episodes"
]
_last_checked = 0.0
_lock = threading.Lock()


def local_name(tag):
    return tag.rsplit("}", 1)[-1].split(":")[-1]


def child(element, name):
    return next((c for c in element if local_name(c.tag) == name), None)


def text(element, name):
    found = child(element, name)
    return (found.text or "").strip() if found is not None else ""


def parse_feed(xml, series):
    root = ET.fromstring(xml)
    channel = child(root, "channel")
    if channel is None:
        return []
    details = child(channel, "seriesDetails")
    output = []
    for item in channel:
        if local_name(item.tag) != "item":
            continue
        enclosure = child(item, "enclosureSecure")
        if enclosure is None:
            enclosure = child(item, "enclosure")
        audio = enclosure.get("url", "") if enclosure is not None else ""
        if not audio.startswith(("https://", "http://")):
            continue
        audio = audio.replace("http://", "https://", 1).replace(
            "/proto/http/", "/proto/https/"
        )
        description = html.unescape(text(item, "description"))
        links = re.findall(r'href=["\']([^"\']+)', description)
        page = next(
            (
                u
                for u in links
                if re.match(r"https://(?:www\.)?bbc\.co\.uk/learningenglish/", u)
            ),
            text(item, "link"),
        )
        paragraphs = re.findall(r"<p[^>]*>(.*?)</p>", description, re.S | re.I)
        intro = (
            re.sub(r"<[^>]*>", "", paragraphs[0] if paragraphs else description)
            .split("FIND BBC LEARNING ENGLISH")[0]
            .strip()[:2500]
        )
        try:
            published = (
                parsedate_to_datetime(text(item, "pubDate"))
                .astimezone(timezone.utc)
                .isoformat()
            )
            duration = 0
            for part in text(item, "duration").split(":"):
                duration = duration * 60 + int(part or "0")
            output.append(
                {
                    "id": text(item, "guid"),
                    "series": series,
                    "title": text(item, "title"),
                    "published": published,
                    "duration": duration,
                    "audio": audio,
                    "page": page,
                    "description": intro,
                    "channel": text(channel, "author") or "BBC",
                    "frequency": (
                        details.get("frequency", "") if details is not None else ""
                    ),
                }
            )
        except (ValueError, TypeError):
            continue
    return output


def fetch_series(series):
    with open_upstream(
        f"https://podcasts.files.bbci.co.uk/{series}.rss", {"podcasts.files.bbci.co.uk"}
    ) as response:
        return parse_feed(read_bytes(response), series)


def episodes(refresh=False):
    global _episodes, _last_checked
    failures = 0
    if refresh and time.time() - _last_checked > 60 and _lock.acquire(blocking=False):
        try:
            merged = {item["id"]: item for item in _episodes}
            with ThreadPoolExecutor(max_workers=8) as pool:
                tasks = [pool.submit(fetch_series, feed["id"]) for feed in FEEDS]
                for task in tasks:
                    try:
                        for item in task.result():
                            if item["id"]:
                                merged[item["id"]] = item
                    except Exception:
                        failures += 1
            _episodes = sorted(
                merged.values(), key=lambda e: e["published"], reverse=True
            )
            _last_checked = time.time()
        finally:
            _lock.release()
    return {
        "episodes": _episodes,
        "feeds": FEEDS,
        "failed_feeds": failures,
        "checked_at": _last_checked,
    }
