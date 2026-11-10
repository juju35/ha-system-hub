"""Export Lovelace dashboards from .storage to a plain directory."""

from __future__ import annotations

import hashlib
import json
import logging
from collections.abc import Iterable, Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

_LOGGER = logging.getLogger(__name__)


def _digest(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def _file_digest(file: Path) -> str | None:
    try:
        return _digest(file.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError):
        return None


def export_dir_allowed(export_dir: str, config_dir: str, allowlist: Iterable[str]) -> bool:
    """Whether the export may write to export_dir (blocking: resolves the path, symlinks followed).

    Only inside the configuration folder or an allowlist_external_dirs folder, outside hidden folders such as
    .storage: elsewhere, a folder such as /media would hand the dashboards to every user of the media browser.
    """
    try:
        target = Path(export_dir).resolve()
        roots = [Path(config_dir).resolve(), *(Path(d).resolve() for d in allowlist)]
    except OSError:
        return False
    root = next((r for r in roots if target.is_relative_to(r)), None)
    return root is not None and not any(part.startswith(".") for part in target.relative_to(root).parts)


def _dashboard_config(raw: str) -> Any | None:
    """Extract the dashboard configuration from a .storage lovelace file."""
    try:
        document = json.loads(raw)
    except json.JSONDecodeError:
        return None
    data = document.get("data") if isinstance(document, dict) else None
    if isinstance(data, dict) and "config" in data:
        return data["config"]
    return data


@dataclass(slots=True)
class ExportResult:
    """Outcome of an export.

    files: the exported file names (written or already up to date).
    managed: the files of the export folder written by the integration, with the SHA-256 of what it wrote, to
    pass as `previous` to the next export: `files` plus the YAML kept for a dashboard that could not be read.
    skipped: the names left alone because a file of the user, not written by the integration, has them.
    """

    files: list[str] = field(default_factory=list)
    managed: dict[str, str] = field(default_factory=dict)
    skipped: list[str] = field(default_factory=list)


def export_dashboards(
    storage_dir: str,
    export_dir: str,
    export_format: str,
    previous: Mapping[str, str] | None = None,
    *,
    adopt: bool = False,
) -> ExportResult:
    """Copy every lovelace* file from storage_dir into export_dir.

    export_format:
      - json: raw copy of the .storage files (same as `cp .storage/lovelace*`)
      - yaml: dashboard config only, as readable YAML
      - both: the two side by side

    previous: the files an earlier export wrote into this folder with their hash (its `managed`). Those that
    this export does not produce (a deleted dashboard, a format no longer exported) are removed, so they do not
    stay in the repository forever, but only while their content is still what the export wrote: a file the
    user edited (reused as a YAML-mode dashboard) is left in place and forgotten. Any other file of the folder,
    such as a YAML-mode dashboard of the user named `lovelace-energy.yaml`, is never deleted, and never
    overwritten either when it has the name of an export (it is reported in `skipped`).

    adopt: overwrite the existing files with an export name although `previous` does not list them, for the
    first export after an update from a version that kept no manifest (they are its own old exports).
    """
    previous = previous or {}
    source = Path(storage_dir)
    target = Path(export_dir)
    target.mkdir(parents=True, exist_ok=True)

    result = ExportResult()
    written = 0

    def export(name: str, content: str) -> None:
        nonlocal written
        file = target / name
        if file.exists():
            if _file_digest(file) == _digest(content):
                result.files.append(name)
                result.managed[name] = _digest(content)
                return
            if name not in previous and not adopt:
                # Not written by the integration: a file of the user that happens to have this name.
                _LOGGER.warning("Not exporting %s: %s is not a file the export wrote, it is left as is", name, file)
                result.skipped.append(name)
                return
        file.write_text(content, encoding="utf-8")
        written += 1
        result.files.append(name)
        result.managed[name] = _digest(content)

    for file in sorted(source.glob("lovelace*")):
        if not file.is_file():
            continue
        raw = file.read_text(encoding="utf-8")

        if export_format in ("json", "both"):
            export(file.name, raw)

        if export_format in ("yaml", "both"):
            name = f"{file.name}.yaml"
            config = _dashboard_config(raw)
            if config is None:
                # Unreadable now: keep the YAML of the last good export, still the integration's.
                if name in previous and (target / name).is_file():
                    result.managed[name] = previous[name]
                continue
            export(
                name, yaml.safe_dump(config, allow_unicode=True, sort_keys=False, default_flow_style=False, width=120)
            )

    stale = {name: digest for name, digest in previous.items() if name not in result.managed}
    removed = _remove_stale(source, target, stale)
    _LOGGER.debug(
        "Exported %d dashboard files to %s (%d changed, %d removed)", len(result.files), target, written, removed
    )
    return result


def _remove_stale(source: Path, target: Path, stale: Mapping[str, str]) -> int:
    """Delete the files of an earlier export that this one no longer produces, if still as it wrote them."""
    if target.resolve() == source.resolve():
        # Exporting into .storage itself: its lovelace* files are the dashboards, never delete them.
        return 0
    removed = 0
    for name, digest in stale.items():
        file = target / name
        # Only plain names of this folder: a corrupted manifest must not reach another directory.
        if Path(name).name != name or not name.startswith("lovelace") or not file.is_file():
            continue
        if _file_digest(file) != digest:
            # Edited since the export wrote it: the user's file now (a YAML-mode dashboard), never deleted.
            _LOGGER.info("Keeping %s: changed since it was exported", file)
            continue
        file.unlink()
        removed += 1
    return removed
