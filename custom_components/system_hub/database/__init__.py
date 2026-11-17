"""Database module: the recorder's database — its size, its tables, its retention, and the devices that write the most.

The panel asks with system_hub/database. The size is the file's for SQLite (with its write-ahead log), the schema's
for MariaDB / MySQL (information_schema) and the database's for PostgreSQL (pg_database_size). The tables (rows,
size) and the space a repack would free, and the states each entity wrote in the last 24 hours, are read by queries
run in the recorder's own thread, kept for an hour (the count reads every state of the day, SQLite counts the rows);
the states are added up by device, an entity without a device counting on its own, and each device lists its
entities, the ones that write the most first. A sensor follows the size, read every 15 minutes, so that the
recorder keeps its history: the tab draws the growth from its statistics.
"""

from __future__ import annotations

import os
import time
from typing import Any, Final

from homeassistant.core import HomeAssistant
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

RECORDER_DOMAIN: Final = "recorder"
CONF_MAX_SIZE: Final = "max_size"
# GiB: beyond it, the Status tab warns
DEFAULT_MAX_SIZE: Final = 2
CACHE_SECONDS: Final = 3600
# Devices (or entities without a device) listed
TOP: Final = 12
# Entities listed under a device, the ones that write the most
TOP_ENTITIES: Final = 10
# Counted by entity, all of them, since 2.5.0 (the 12 entities that wrote the most before)
CACHE_KEY: Final = "database_cache_by_entity"
# The tables and the space to free, kept with the count
TABLES_KEY: Final = "database_tables"


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


def engine(instance: Any) -> str:
    """sqlite, mysql (MariaDB too), postgresql, or the scheme of the database's URL."""
    return str(getattr(instance, "dialect_name", None) or str(instance.db_url).split(":")[0].split("+")[0])


def _server_size(instance: Any) -> int | None:
    """Run in the recorder's thread: the size of a MariaDB / MySQL schema or of a PostgreSQL database, in bytes."""
    from homeassistant.components.recorder.util import session_scope  # noqa: PLC0415
    from sqlalchemy import text  # noqa: PLC0415

    query = {
        "mysql": (
            "SELECT SUM(data_length + index_length) FROM information_schema.tables WHERE table_schema = DATABASE()"
        ),
        "postgresql": "SELECT pg_database_size(current_database())",
    }.get(engine(instance))
    if query is None:
        return None
    with session_scope(session=instance.get_session(), read_only=True) as session:
        size = session.execute(text(query)).scalar()
    return None if size is None else int(size)


async def async_size(hass: HomeAssistant, instance: Any) -> int | None:
    """The database's size in bytes, whatever its engine; None when it cannot be told."""
    url = str(instance.db_url)
    if url.startswith("sqlite"):
        return await hass.async_add_executor_job(_size, url)
    return await instance.async_add_executor_job(_server_size, instance)


def _tables(instance: Any) -> dict[str, Any]:
    """Run in the recorder's thread: each table's rows and size (bytes, None when the engine cannot tell), the
    biggest first, and the space a repack would free (None when unknown). MariaDB / MySQL and PostgreSQL give
    estimated row counts, SQLite counts them."""
    from homeassistant.components.recorder.util import session_scope  # noqa: PLC0415
    from sqlalchemy import text  # noqa: PLC0415
    from sqlalchemy.exc import SQLAlchemyError  # noqa: PLC0415

    kind = engine(instance)
    free: int | None = None
    with session_scope(session=instance.get_session(), read_only=True) as session:
        if kind == "mysql":
            rows = session.execute(
                text(
                    "SELECT table_name, table_rows, data_length + index_length, data_free"
                    " FROM information_schema.tables WHERE table_schema = DATABASE()"
                )
            ).all()
            tables = [(str(name), int(n or 0), int(size or 0)) for name, n, size, _ in rows]
            free = sum(int(f or 0) for *_, f in rows)
        elif kind == "postgresql":
            rows = session.execute(
                text("SELECT relname, n_live_tup, pg_total_relation_size(relid) FROM pg_stat_user_tables")
            ).all()
            tables = [(str(name), int(n or 0), int(size or 0)) for name, n, size in rows]
        elif kind == "sqlite":
            page = int(session.execute(text("PRAGMA page_size")).scalar() or 0)
            free = int(session.execute(text("PRAGMA freelist_count")).scalar() or 0) * page
            names = [
                str(name)
                for (name,) in session.execute(
                    text("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
                ).all()
            ]
            sizes: dict[str, int] = {}
            try:
                # The dbstat table, when SQLite is built with it: the pages of each table and of its indexes
                sizes = {
                    str(name): int(size or 0)
                    for name, size in session.execute(
                        text(
                            "SELECT m.tbl_name, SUM(s.pgsize) FROM dbstat AS s"
                            " JOIN sqlite_master AS m ON s.name = m.name GROUP BY m.tbl_name"
                        )
                    ).all()
                }
            except SQLAlchemyError:
                sizes = {}
            tables = [
                (name, int(session.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar() or 0), sizes.get(name))
                for name in names
            ]
        else:
            tables = []
    listed = [{"name": name, "rows": n, "size": size} for name, n, size in tables]
    listed.sort(key=lambda t: (-(t["size"] or 0), -t["rows"]))
    return {"tables": listed, "free": free}


def _count(instance: Any, since: float) -> tuple[int, list[tuple[str, int]]]:
    """Run in the recorder's thread: the states written since `since`, and those of each entity, the most first."""
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
                " WHERE states.last_updated_ts > :since GROUP BY states_meta.entity_id ORDER BY n DESC"
            ),
            {"since": since},
        ).all()
    return int(total), [(str(entity_id), int(n)) for entity_id, n in rows]


def _by_device(hass: HomeAssistant, counts: list[tuple[str, int]]) -> list[dict[str, Any]]:
    """The entities' counts added up by device, the devices that write the most first; an entity without a device
    (or whose device is gone) is a row of its own, with no device_id."""
    entities = er.async_get(hass)
    devices = dr.async_get(hass)
    areas = ar.async_get(hass)
    recorded = _recorder_filter(hass)
    groups: dict[str, dict[str, Any]] = {}
    for entity_id, n in counts:
        state = hass.states.get(entity_id)
        item = {
            "entity_id": entity_id,
            "count": n,
            "name": state.name if state else entity_id,
            # Already left out of the recorder by its configuration: its states stop
            "excluded": bool(recorded and not recorded(entity_id)),
        }
        entry = entities.async_get(entity_id)
        device = devices.async_get(entry.device_id) if entry and entry.device_id else None
        key = device.id if device else entity_id
        group = groups.get(key)
        if group is None:
            area_id = (entry.area_id if entry else None) or (device.area_id if device else None)
            area = areas.async_get_area(area_id) if area_id else None
            group = groups[key] = {
                "device_id": device.id if device else None,
                "name": (device.name_by_user or device.name or device.id) if device else item["name"],
                "area": area.name if area else None,
                "count": 0,
                "entities": [],
            }
        group["count"] += n
        group["entities"].append(item)
    rows = sorted(groups.values(), key=lambda g: -g["count"])[:TOP]
    for row in rows:
        # The counts come the most first: so do a device's entities
        # Every entity of the device that wrote, for its purge and its recorder exclusion; the first ones in detail
        row["entity_ids"] = [e["entity_id"] for e in row["entities"]]
        row["excluded"] = sum(1 for e in row["entities"] if e["excluded"])
        row["entities"] = row["entities"][:TOP_ENTITIES]
    return rows


def _recorder_filter(hass: HomeAssistant) -> Any:
    from homeassistant.components.recorder import get_instance  # noqa: PLC0415

    return get_instance(hass).entity_filter


async def database_state(hass: HomeAssistant, store: dict[str, Any], force: bool = False) -> dict[str, Any]:
    """The database: engine, size, retention, the states of the last 24 hours and the devices that wrote the most."""
    from homeassistant.components.recorder import get_instance  # noqa: PLC0415

    instance = get_instance(hass)
    size = await async_size(hass, instance)
    cached = store.get(CACHE_KEY)
    tables = store.get(TABLES_KEY)
    if force or not cached or not tables or time.time() - cached["at"] > CACHE_SECONDS:
        total, top = await instance.async_add_executor_job(_count, instance, time.time() - 86400)
        cached = store[CACHE_KEY] = {"at": time.time(), "total": total, "top": top}
        tables = store[TABLES_KEY] = await instance.async_add_executor_job(_tables, instance)
    return {
        "engine": engine(instance),
        "size": size,
        "free": tables["free"],
        "tables": tables["tables"],
        "keep_days": instance.keep_days,
        "auto_purge": instance.auto_purge,
        "total_day": cached["total"],
        "counted_at": cached["at"],
        "top": _by_device(hass, cached["top"]),
    }
