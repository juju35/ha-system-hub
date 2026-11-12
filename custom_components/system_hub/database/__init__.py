"""Database module: the recorder's database — its size, its retention, and the entities that write the most.

The panel asks with system_hub/database. The size is the file's (SQLite, with its write-ahead log); another engine
shows no size. The entities that wrote the most states in the last 24 hours are counted by a query run in the
recorder's own thread, kept for an hour (the query reads every state of the day). No entities of its own.
"""

from __future__ import annotations

import os
import time
from typing import Any, Final

from homeassistant.core import HomeAssistant

RECORDER_DOMAIN: Final = "recorder"
CONF_MAX_SIZE: Final = "max_size"
# GiB: beyond it, the Status tab warns
DEFAULT_MAX_SIZE: Final = 2
CACHE_SECONDS: Final = 3600
TOP: Final = 12
CACHE_KEY: Final = "database_cache"


def settings(options: Any) -> dict[str, Any]:
    """The module's settings, with their defaults."""
    options = options if isinstance(options, dict) else {}
    return {CONF_MAX_SIZE: float(options.get(CONF_MAX_SIZE) or DEFAULT_MAX_SIZE)}


def _size(db_url: str) -> int | None:
    """The size of a SQLite database file and its write-ahead log, in bytes; None for another engine."""
    if not db_url.startswith("sqlite:///"):
        return None
    path = db_url.removeprefix("sqlite:///").split("?")[0]
    try:
        return sum(os.path.getsize(f) for f in (path, f"{path}-wal") if os.path.exists(f))
    except OSError:
        return None


def _count(instance: Any, since: float) -> tuple[int, list[tuple[str, int]]]:
    """Run in the recorder's thread: the states written since `since`, and the entities that wrote the most."""
    from homeassistant.components.recorder.util import session_scope  # noqa: PLC0415
    from sqlalchemy import text  # noqa: PLC0415

    with session_scope(session=instance.get_session(), read_only=True) as session:
        total = (
            session.execute(
                text("SELECT COUNT(*) FROM states WHERE last_updated_ts > :since"), {"since": since}
            ).scalar()
            or 0
        )
        rows = session.execute(
            text(
                "SELECT states_meta.entity_id, COUNT(*) AS n FROM states"
                " JOIN states_meta ON states.metadata_id = states_meta.metadata_id"
                " WHERE states.last_updated_ts > :since GROUP BY states_meta.entity_id ORDER BY n DESC LIMIT :top"
            ),
            {"since": since, "top": TOP},
        ).all()
    return int(total), [(str(entity_id), int(n)) for entity_id, n in rows]


async def database_state(hass: HomeAssistant, store: dict[str, Any], force: bool = False) -> dict[str, Any]:
    """The database: engine, size, retention, the states of the last 24 hours and the entities that wrote the most."""
    from homeassistant.components.recorder import get_instance  # noqa: PLC0415

    instance = get_instance(hass)
    size = await hass.async_add_executor_job(_size, str(instance.db_url))
    cached = store.get(CACHE_KEY)
    if force or not cached or time.time() - cached["at"] > CACHE_SECONDS:
        total, top = await instance.async_add_executor_job(_count, instance, time.time() - 86400)
        cached = store[CACHE_KEY] = {"at": time.time(), "total": total, "top": top}
    recorded = instance.entity_filter
    return {
        "engine": str(getattr(instance, "dialect_name", None) or str(instance.db_url).split(":")[0]),
        "size": size,
        "keep_days": instance.keep_days,
        "auto_purge": instance.auto_purge,
        "total_day": cached["total"],
        "counted_at": cached["at"],
        "top": [
            {
                "entity_id": entity_id,
                "count": n,
                "name": (state.name if (state := hass.states.get(entity_id)) else entity_id),
                # Already left out of the recorder by its configuration: its states stop
                "excluded": bool(recorded and not recorded(entity_id)),
            }
            for entity_id, n in cached["top"]
        ],
    }
