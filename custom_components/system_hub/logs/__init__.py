"""Logs module: Home Assistant's own log (the System Log integration) grouped by integration, read by the panel.

The panel reads the log with system_log/list (the warnings and errors kept since Home Assistant started, each with how
many times it came). This module only keeps its settings: how many errors of one integration in 24 hours make a
problem on the Status tab, and the messages ignored (a logger and the start of a message). No entities of its own.
"""

from __future__ import annotations

from typing import Any, Final

SYSTEM_LOG_DOMAIN: Final = "system_log"
CONF_ERROR_THRESHOLD: Final = "error_threshold"
CONF_IGNORED_MESSAGES: Final = "ignored_messages"
DEFAULT_ERROR_THRESHOLD: Final = 10


def settings(options: Any) -> dict[str, Any]:
    """The module's settings, with their defaults."""
    options = options if isinstance(options, dict) else {}
    return {
        CONF_ERROR_THRESHOLD: int(options.get(CONF_ERROR_THRESHOLD) or DEFAULT_ERROR_THRESHOLD),
        CONF_IGNORED_MESSAGES: [str(m) for m in options.get(CONF_IGNORED_MESSAGES) or []],
    }
