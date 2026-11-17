"""可重现的文本匹配评分，不把 ASR 结果冒充声学发音评测。"""

import re
import unicodedata
import math


def tokens(text):
    normalized = unicodedata.normalize("NFKC", text).lower().replace("’", "'")
    return re.findall(r"[^\W_]+(?:'[^\W\d_]+)?", normalized, re.UNICODE)


def grammar_hints(text):
    forms = dict(
        go="goes",
        do="does",
        have="has",
        want="wants",
        like="likes",
        need="needs",
        work="works",
        play="plays",
        study="studies",
        live="lives",
        speak="speaks",
    )
    output = []
    for match in re.finditer(
        r"\b(he|she|it)\s+(go|do|have|want|like|need|work|play|study|live|speak)\b",
        text,
        re.I,
    ):
        before = text[max(0, match.start() - 20) : match.start()]
        if re.search(
            r"\b(does|did|can|could|will|would|should|must|may|might|doesn't|didn't)\s*$",
            before,
            re.I,
        ):
            continue
        output.append(
            {
                "original": match[0],
                "correction": match[1] + " " + forms[match[2].lower()],
                "explanation": "一般现在时中 he / she / it 后实义动词通常使用第三人称单数形式；需结合语境核对。",
                "examples": [
                    "He works in a small library.",
                    "She studies English every evening.",
                ],
            }
        )
    return output[:5]


def assess(reference, transcript):
    a, b = tokens(reference), tokens(transcript)
    dp = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) + 1):
        dp[i][0] = i
    for j in range(len(b) + 1):
        dp[0][j] = j
    for i in range(1, len(a) + 1):
        for j in range(1, len(b) + 1):
            dp[i][j] = min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + (a[i - 1] != b[j - 1]),
            )
    matches = [False] * len(a)
    i, j = len(a), len(b)
    while i or j:
        if i and j and dp[i][j] == dp[i - 1][j - 1] + (a[i - 1] != b[j - 1]):
            matches[i - 1] = a[i - 1] == b[j - 1]
            i -= 1
            j -= 1
        elif i and dp[i][j] == dp[i - 1][j] + 1:
            i -= 1
        else:
            j -= 1
    segments = re.split(r"([^\W_]+(?:['’][^\W\d_]+)?)", reference)
    alignment, cursor = [], 0
    for segment in filter(None, segments):
        has_word = bool(tokens(segment))
        alignment.append(
            {
                "text": segment,
                "matched": (
                    matches[cursor] if has_word and cursor < len(matches) else None
                ),
            }
        )
        if has_word:
            cursor += 1
    edits = dp[-1][-1]
    score = (
        max(0, math.floor((1 - edits / max(len(a), len(b))) * 100 + 0.5)) if a else 0
    )
    return {
        "score": score,
        "referenceWords": len(a),
        "spokenWords": len(b),
        "edits": edits,
        "alignment": alignment,
        "hints": grammar_hints(transcript),
        "metric": "transcript_match",
    }
