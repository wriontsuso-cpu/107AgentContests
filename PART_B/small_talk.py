"""Deterministic replies shared with the frontend's offline demo."""

import json
from pathlib import Path
import unicodedata


def _normalize_message(message: str) -> str:
    return "".join(
        char
        for char in unicodedata.normalize("NFKC", message).lower()
        if not char.isspace()
        and not unicodedata.category(char).startswith("P")
        and char != "~"
    )


_RULES_PATH = (
    Path(__file__).resolve().parent.parent
    / "frontend" / "src" / "data" / "raw" / "assistantSmallTalk.json"
)
_REPLIES = {
    _normalize_message(phrase): rule["reply"]
    for rule in json.loads(_RULES_PATH.read_text(encoding="utf-8"))
    for phrase in rule["phrases"]
}


def small_talk_reply(message: str) -> str | None:
    # Whole-message matching keeps greetings attached to real questions searchable.
    return _REPLIES.get(_normalize_message(message))
