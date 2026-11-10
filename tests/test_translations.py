"""Every translation has exactly the keys and placeholders of the English one."""

from __future__ import annotations

import json
import re
import string
from pathlib import Path

import pytest

TRANSLATIONS = Path(__file__).parent.parent / "custom_components" / "system_hub" / "translations"
LANGUAGES = [
    "bg",
    "cs",
    "da",
    "de",
    "el",
    "es",
    "fr",
    "hu",
    "it",
    "lv",
    "nl",
    "pl",
    "pt",
    "pt-BR",
    "ro",
    "ru",
    "sk",
    "sl",
    "sr",
    "sr-Latn",
    "sv",
    "uk",
]


def _flatten(data: dict, prefix: str = "") -> dict[str, str]:
    flat: dict[str, str] = {}
    for key, value in data.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            flat.update(_flatten(value, path))
        else:
            flat[path] = value
    return flat


def _load(language: str) -> dict[str, str]:
    return _flatten(json.loads((TRANSLATIONS / f"{language}.json").read_text(encoding="utf-8")))


def _placeholders(text: str) -> set[str]:
    return {name for _, name, _, _ in string.Formatter().parse(text) if name is not None}


def test_all_languages_are_tested():
    """A new translations/*.json file is added to LANGUAGES."""
    assert sorted(p.stem for p in TRANSLATIONS.glob("*.json")) == sorted(["en", *LANGUAGES])


@pytest.mark.parametrize("language", LANGUAGES)
def test_translation_parity(language: str):
    """Same keys as en.json, same placeholders in each string, nothing empty."""
    english, other = _load("en"), _load(language)
    assert sorted(other) == sorted(english)
    for key, text in english.items():
        assert other[key].strip(), key
        assert _placeholders(other[key]) == _placeholders(text), key


# Serbian: no Cyrillic letter in sr-Latn; the Latin words left in sr are names and terms taken from en.json
# (Home Assistant, Git, commit, push, JSON, Watchdog…).


def test_serbian_latin_has_no_cyrillic():
    for key, text in _load("sr-Latn").items():
        assert not re.search(r"[\u0400-\u04ff]", text), key


def test_serbian_cyrillic_keeps_latin_for_names_only():
    english = " ".join(_load("en").values()).lower()
    for key, text in _load("sr").items():
        for word in re.findall(r"[A-Za-z]+", text):
            assert word.lower() in english, f"{key}: {word}"
