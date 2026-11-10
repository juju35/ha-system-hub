"""CSV export of the batteries, shared by the export action and the panel."""

from __future__ import annotations

import csv
from pathlib import Path
from typing import TYPE_CHECKING, Any

from homeassistant.core import HomeAssistant
from homeassistant.exceptions import HomeAssistantError, ServiceValidationError

from ..const import DOMAIN
from .const import DEFAULT_EXPORT_FILE

if TYPE_CHECKING:
    from .monitor import BatteryMonitor


async def async_export(hass: HomeAssistant, monitor: BatteryMonitor, path_value: str | None) -> dict[str, Any]:
    """Write the batteries as a CSV file (the export action and the panel); returns its path and row count.

    Raises ServiceValidationError (the refusal key of `_refused`) and HomeAssistantError.
    """
    path = Path(path_value or DEFAULT_EXPORT_FILE)
    if not path.is_absolute():
        path = Path(hass.config.path(str(path)))
    if refused := await hass.async_add_executor_job(_refused, hass, path):
        raise ServiceValidationError(
            translation_domain=DOMAIN,
            translation_key=f"batteries_{refused}",
            translation_placeholders={"path": str(path)},
        )
    rows = [b.as_row() for b in monitor.batteries]
    try:
        await hass.async_add_executor_job(_write_csv, path, rows)
    except OSError as err:
        raise HomeAssistantError(f"Could not write {path}: {err}") from err
    return {"path": str(path), "batteries": len(rows)}


def _refused(hass: HomeAssistant, path: Path) -> str | None:
    """Why the export may not write `path` (a translation key), None when it may (blocking: resolves the path).

    Only a .csv file (never an existing file of another kind, symlinks followed), outside hidden folders
    such as .storage, inside the configuration folder or an allowlist_external_dirs folder.
    """
    try:
        target = path.resolve()
        config = Path(hass.config.config_dir).resolve()
        roots = [config, *(Path(d).resolve() for d in hass.config.allowlist_external_dirs)]
        exists = target.exists()
    except OSError:
        return "path_not_allowed"
    root = next((r for r in roots if target.is_relative_to(r)), None)
    if root is None:
        return "path_not_allowed"
    if any(part.startswith(".") for part in target.relative_to(root).parts):
        return "path_hidden"
    if target.suffix.lower() != ".csv" or (exists and not target.is_file()):
        return "path_not_csv"
    return None


def _write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    """Write the batteries as a CSV file (header from the first row's keys, UTF-8)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = list(rows[0]) if rows else ["entity_id", "name", "area", "level", "low", "unavailable", "due"]
    with path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns)
        writer.writeheader()
        writer.writerows(rows)
