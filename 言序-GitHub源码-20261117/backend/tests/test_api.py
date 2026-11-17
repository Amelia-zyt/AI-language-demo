import io
from email.message import Message
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app import config
from app.domain.assessment import assess, grammar_hints
from app.services.catalog import parse_feed


class Response(io.BytesIO):
    def __init__(self, data=b"", status=200, headers=None):
        super().__init__(data)
        self.status = status
        self.headers = Message()
        for key, value in (headers or {}).items():
            self.headers[key] = value


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(config, "DATABASE", tmp_path / "test.sqlite3")
    with TestClient(app) as client:
        yield client


def test_health_content_and_catalog(client):
    assert client.get("/api/health").json()["backend"] == "FastAPI"
    content = client.get("/api/learning/content").json()
    assert len(content["courses"]) == 7
    assert len(content["words"]["en"]) == 20
    assert all(
        len(content["basePhonetics"][lang]) == 20 for lang in content["languages"]
    )
    catalog = client.get("/api/bbc/episodes").json()
    assert len(catalog["episodes"]) >= 2871
    assert len(catalog["feeds"]) == 8


def test_profile_isolation_and_old_progress(client):
    original = {
        "state": {
            "lang": "en",
            "sessions": {
                "en": {
                    "counts": [1] * 10,
                    "index": 4,
                    "round": 1,
                    "done": False,
                    "formatVersion": 2,
                }
            },
        },
        "favorites": ["episode-1"],
    }
    assert (
        client.put(
            "/api/profile", headers={"X-Learner-ID": "device-a"}, json=original
        ).status_code
        == 200
    )
    assert (
        client.get("/api/profile", headers={"X-Learner-ID": "device-a"}).json()[
            "profile"
        ]
        == original
    )
    assert (
        client.get("/api/profile", headers={"X-Learner-ID": "device-b"}).json()[
            "profile"
        ]
        is None
    )


def test_scores_alignment_and_history(client):
    response = client.post(
        "/api/assessment/text",
        headers={"X-Learner-ID": "device-a"},
        json={
            "reference": "She goes to school.",
            "transcript": "She go to school.",
            "episode_id": "bbc1",
        },
    )
    assert response.status_code == 200
    result = response.json()
    assert result["score"] == 75 and result["edits"] == 1
    assert [
        word["text"] for word in result["alignment"] if word["matched"] is False
    ] == ["goes"]
    assert result["hints"][0]["correction"] == "She goes"
    assert result["metric"] == "transcript_match"
    assert (
        len(
            client.get("/api/attempts", headers={"X-Learner-ID": "device-a"}).json()[
                "attempts"
            ]
        )
        == 1
    )
    assert (
        client.get("/api/attempts", headers={"X-Learner-ID": "other"}).json()[
            "attempts"
        ]
        == []
    )
    assert assess("Hello, WORLD!", "hello world")["score"] == 100
    assert assess("I really like it.", "I like it")["score"] == 75
    assert assess("It’s fine.", "it's fine")["score"] == 100
    assert grammar_hints("Does she go home?") == []


def test_scoring_input_bounds(client):
    assert (
        client.post(
            "/api/assessment/text", json={"reference": "Hi", "transcript": ""}
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/assessment/text",
            json={"reference": "word-" * 501, "transcript": "hi"},
        ).status_code
        == 422
    )


@patch("app.services.bbc_upstream.open_upstream")
def test_rejects_unknown_urls_before_fetch(upstream, client):
    for path in [
        "/api/bbc/feed?series=nope",
        "/api/bbc/audio?vpid=invalid",
        "/api/bbc/pdf?url=https://evil.example/learningenglish/a.pdf",
        "/api/bbc/document?url=https://www.bbc.co.uk:443/learningenglish/x",
        "/api/bbc/audio?vpid=p0pldlfg",
    ]:
        headers = {"Range": "bytes=-"} if path.endswith("p0pldlfg") else {}
        assert client.get(path, headers=headers).status_code == 400
    upstream.assert_not_called()


@patch("app.services.bbc_upstream.open_upstream")
def test_pdf_validation_and_fallback(upstream, client):
    upstream.side_effect = [
        Response(b"<html>error</html>"),
        Response(b"%PDF-1.7\nfixture"),
    ]
    response = client.get(
        "/api/bbc/pdf",
        params={"url": "https://downloads.bbc.co.uk/learningenglish/a.pdf"},
    )
    assert response.status_code == 200 and response.content.startswith(b"%PDF-")
    assert "attachment" in response.headers["content-disposition"]
    assert upstream.call_count == 2


@patch("app.services.bbc_upstream.public_document")
def test_official_document(document, client):
    document.return_value = '<a href="https://downloads.bbc.co.uk/learningenglish/a.pdf">PDF</a><h3>TRANSCRIPT</h3><p>Neil</p><p>Hello &amp; welcome.</p></div><p>Outside</p>'
    response = client.get(
        "/api/bbc/document",
        params={"url": "https://www.bbc.co.uk/learningenglish/english/test"},
    )
    assert response.json()["lines"] == ["Neil", "Hello & welcome."]


@patch("app.api.bbc.upstream.audio_response")
def test_audio_range_stream(upstream, client):
    upstream.return_value = Response(
        b"abcd",
        206,
        {
            "Content-Length": "4",
            "Content-Range": "bytes 0-3/100",
            "Accept-Ranges": "bytes",
        },
    )
    response = client.get(
        "/api/bbc/audio?vpid=p0pldlfg", headers={"Range": "bytes=0-3"}
    )
    assert response.status_code == 206 and response.content == b"abcd"
    assert response.headers["content-range"] == "bytes 0-3/100"
    assert upstream.call_args.args[-1] == "bytes=0-3"


def test_rss_parser_contract():
    xml = """<rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"><channel><itunes:author>BBC</itunes:author><item><guid>id1</guid><title>Title</title><pubDate>Thu, 05 Nov 2026 12:00:00 GMT</pubDate><itunes:duration>6:39</itunes:duration><enclosure url="https://example.bbci.co.uk/audio.mp3"/><description><![CDATA[<p>Introduction</p><a href="https://www.bbc.co.uk/learningenglish/english/test">BBC</a>]]></description><link>https://www.bbc.co.uk/programmes/id1</link></item></channel></rss>"""
    result = parse_feed(xml, "p02pc9tn")[0]
    assert result["duration"] == 399 and result["description"] == "Introduction"
    assert "/learningenglish/" in result["page"]
