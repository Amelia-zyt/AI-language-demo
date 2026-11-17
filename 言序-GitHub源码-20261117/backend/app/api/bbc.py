import re
from urllib.error import URLError
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response, StreamingResponse
from ..services import bbc_upstream as upstream
from ..services import catalog

router = APIRouter(prefix="/bbc")


@router.get("/episodes")
def episodes(refresh: bool = False):
    return catalog.episodes(refresh)


@router.api_route("/feed", methods=["GET", "HEAD"])
def feed(series: str, request: Request):
    if series not in upstream.SERIES:
        raise HTTPException(400, "Unknown BBC series")
    with upstream.open_upstream(
        f"https://podcasts.files.bbci.co.uk/{series}.rss", {"podcasts.files.bbci.co.uk"}
    ) as response:
        data = upstream.read_bytes(response)
    return Response(
        data if request.method == "GET" else b"",
        media_type="application/rss+xml",
        headers={"Content-Length": str(len(data))},
    )


@router.get("/document")
def document(url: str):
    if not upstream.valid_url(url, {"bbc.co.uk", "www.bbc.co.uk"}, "/learningenglish/"):
        raise HTTPException(
            400, "Only official BBC Learning English pages are supported"
        )
    return upstream.parse_document(upstream.public_document(url), url)


@router.api_route("/pdf", methods=["GET", "HEAD"])
def pdf(url: str, request: Request):
    if not upstream.valid_url(
        url, {"downloads.bbc.co.uk"}, "/learningenglish/", ".pdf"
    ):
        raise HTTPException(400, "Only BBC transcript PDFs are supported")
    data = upstream.pdf_bytes(url)
    return Response(
        data if request.method == "GET" else b"",
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="BBC-transcript.pdf"',
            "Content-Length": str(len(data)),
        },
    )


@router.api_route("/audio", methods=["GET", "HEAD"])
def audio(vpid: str, request: Request, page: str = "", quality: str = ""):
    if not re.fullmatch(r"[bp][a-z0-9]{7}", vpid):
        raise HTTPException(400, "Invalid BBC audio identifier")
    byte_range = request.headers.get("range", "")
    if byte_range and (
        not re.fullmatch(r"bytes=\d*-\d*", byte_range) or byte_range == "bytes=-"
    ):
        raise HTTPException(400, "Invalid byte range")
    try:
        response = upstream.audio_response(
            vpid, quality, page, request.method, byte_range
        )
    except (OSError, URLError, upstream.UpstreamError) as error:
        raise HTTPException(424, str(error)) from error
    headers = {
        key: response.headers[key]
        for key in ("Content-Length", "Content-Range", "Accept-Ranges")
        if response.headers.get(key)
    }
    if request.method == "HEAD":
        response.close()
        return Response(
            status_code=response.status, headers=headers, media_type="audio/mpeg"
        )

    def chunks():
        with response:
            while chunk := response.read(64 * 1024):
                yield chunk

    return StreamingResponse(
        chunks(), status_code=response.status, media_type="audio/mpeg", headers=headers
    )
