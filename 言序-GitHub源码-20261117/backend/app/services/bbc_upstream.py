"""BBC 上游读取与解析；供 FastAPI 路由调用，不承担页面或 HTTP 服务启动。"""

from __future__ import annotations

import html
import json
import re
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

SERIES = {
    "p0hsrwv5",
    "p0h6ffwg",
    "p02pc9tn",
    "p02pc9wq",
    "p02pc9xz",
    "p02pc9zn",
    "p05hw4bq",
    "p02pc9s1",
}
BBC_PAGES = {"www.bbc.co.uk", "bbc.co.uk", "feeds.bbci.co.uk"}
DOWNLOAD_HOSTS = {"downloads.bbc.co.uk", "downloads.bbci.co.uk"}
MAX_DOCUMENT = 8 * 1024 * 1024
MAX_PDF = 25 * 1024 * 1024


class UpstreamError(Exception):
    """BBC 当前不可访问或响应格式无效。"""


def valid_url(value: str, hosts: set[str], prefix: str = "/", suffix: str = "") -> bool:
    try:
        u = urlsplit(value)
        return (
            u.scheme == "https"
            and u.hostname in hosts
            and not u.username
            and not u.password
            and u.port is None
            and u.path.startswith(prefix)
            and u.path.endswith(suffix)
            and not any(c in value for c in "\r\n")
        )
    except (ValueError, TypeError):
        return False


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def open_upstream(url: str, hosts: set[str], *, headers=None, method="GET", timeout=20):
    """每一步跳转都核对 HTTPS 和主机；不接受任意 URL 代理。调用方负责关闭响应。"""
    opener = build_opener(NoRedirect())
    for _ in range(6):
        if not valid_url(url, hosts):
            raise UpstreamError("不允许的 BBC 下载地址")
        request = Request(
            url,
            headers={
                "User-Agent": "LinguaStudyStudio/1.0",
                "Accept-Encoding": "identity",
                **(headers or {}),
            },
            method=method,
        )
        try:
            response = opener.open(request, timeout=timeout)
        except HTTPError as error:
            response = error
        if response.status in (301, 302, 303, 307, 308):
            destination = response.headers.get("Location")
            response.close()
            if not destination:
                raise UpstreamError("BBC 跳转地址为空")
            url = urljoin(url, destination)
            continue
        return response
    raise UpstreamError("BBC 跳转次数过多")


def read_bytes(response, limit=MAX_DOCUMENT):
    if not 200 <= response.status < 300:
        raise UpstreamError(f"BBC HTTP {response.status}")
    data = response.read(limit + 1)
    if len(data) > limit:
        raise UpstreamError("BBC 文件超过允许大小")
    return data


def replace_host(url: str, host: str) -> str:
    u = urlsplit(url)
    return urlunsplit((u.scheme, host, u.path, u.query, ""))


def public_document(url: str) -> str:
    for candidate in (replace_host(url, "feeds.bbci.co.uk"), url):
        try:
            with open_upstream(candidate, BBC_PAGES) as response:
                return read_bytes(response).decode("utf-8", errors="replace")
        except (OSError, URLError, UpstreamError):
            continue
    raise UpstreamError("BBC 官方文稿暂时无法获取")


def parse_document(source: str, url: str) -> dict:
    links = list(
        dict.fromkeys(
            html.unescape(s)
            for s in re.findall(
                r'https://downloads\.bbc\.co\.uk/learningenglish/[^"<>\s]+\.pdf', source
            )
        )
    )
    marker = re.search(
        r"<(?:strong|h[1-6])\b[^>]*>\s*transcript\s*</(?:strong|h[1-6])>", source, re.I
    )
    lines = []
    if marker:
        fragment = source[marker.end() :].split("</div>", 1)[0][:100000]
        fragment = re.sub(
            r"<(?:script|style)\b[^>]*>[\s\S]*?</(?:script|style)>",
            "",
            fragment,
            flags=re.I,
        )
        fragment = re.sub(r"<br\s*/?\s*>|</(?:p|h[1-6])>", "\n", fragment, flags=re.I)
        text = html.unescape(re.sub(r"<[^>]+>", "", fragment))
        lines = [line.strip() for line in text.splitlines() if line.strip()]
    return {"source": url, "links": links, "lines": lines}


def pdf_bytes(url: str) -> bytes:
    for candidate in (replace_host(url, "downloads.bbci.co.uk"), url):
        try:
            with open_upstream(candidate, DOWNLOAD_HOSTS, timeout=15) as response:
                data = read_bytes(response, MAX_PDF)
                if data.startswith(b"%PDF-"):
                    return data
        except (OSError, URLError, UpstreamError):
            continue
    raise UpstreamError("BBC 官方 PDF 暂时无法获取，请点击 BBC官方PDF 打开原文件。")


def select_audio(vpid: str, quality: str, method: str, range_header: str):
    mediaset = (
        "audio-nondrm-download-rss"
        if quality == "standard"
        else "audio-nondrm-download-rss-low"
    )
    url = f"https://open.live.bbc.co.uk/mediaselector/6/select/version/2.0/mediaset/{mediaset}/vpid/{vpid}/format/json"
    with open_upstream(url, {"open.live.bbc.co.uk"}) as response:
        data = json.loads(read_bytes(response))
    for media in data.get("media", []):
        if media.get("kind") != "audio" or media.get("type") != "audio/mpeg":
            continue
        for connection in media.get("connection", []):
            target = connection.get("href", "")
            if connection.get("protocol") == "https" and valid_url(
                target, {"bbc.pdn.tritondigital.com"}
            ):
                result = open_upstream(
                    target,
                    {"bbc.pdn.tritondigital.com"},
                    method=method,
                    headers={"Range": range_header} if range_header else {},
                )
                if 200 <= result.status < 300 or result.status == 416:
                    return result
                result.close()
    raise UpstreamError("BBC 原声地址暂时不可用")


def audio_response(vpid: str, quality: str, page: str, method: str, range_header: str):
    try:
        return select_audio(vpid, quality, method, range_header)
    except (OSError, URLError, UpstreamError, ValueError, TypeError):
        pass
    if valid_url(page, {"bbc.co.uk", "www.bbc.co.uk"}, "/learningenglish/"):
        document = public_document(page)
        links = list(
            dict.fromkeys(
                re.findall(
                    r'https://downloads\.bbc\.co\.uk/learningenglish/[^"<>\s]+\.mp3',
                    document,
                )
            )
        )
        links.sort(key=lambda link: not link.endswith("_download.mp3"))
        for link in links:
            for candidate in (replace_host(link, "downloads.bbci.co.uk"), link):
                try:
                    response = open_upstream(
                        candidate,
                        DOWNLOAD_HOSTS,
                        method=method,
                        headers={"Range": range_header} if range_header else {},
                    )
                    if 200 <= response.status < 300 or response.status == 416:
                        return response
                    response.close()
                except (OSError, URLError, UpstreamError):
                    continue
    raise UpstreamError(
        "BBC 当前不允许读取该集音频，且未找到公开下载文件，请在 BBC 官网收听。"
    )
