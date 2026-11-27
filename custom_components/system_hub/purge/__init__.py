"""Purge module: the files older than a number of days, deleted from a list of folders once a day.

By default the folder of the configuration backups written by the Home Assistant MCP server (mcp_backups, one
sub-folder per snapshot). A folder is relative to the configuration folder, or absolute when Home Assistant allows it
(allowlist_external_dirs). The configuration folder itself, a folder that holds it and Home Assistant's own folders
(.storage, custom_components…) are refused. The sub-folders left empty by the purge are removed, never the folder set.
"""

from __future__ import annotations

import os
import time
from collections.abc import Callable
from pathlib import Path
from typing import Any, Final

CONF_DIRECTORIES: Final = "directories"
CONF_MAX_AGE: Final = "max_age"
DEFAULT_DIRECTORIES: Final = ("mcp_backups",)
DEFAULT_MAX_AGE: Final = 30
MAX_AGE_LIMIT: Final = 3650
SERVICE_PURGE: Final = "purge_files"
ATTR_DRY_RUN: Final = "dry_run"

# Folders of the configuration folder never purged, nor anything in them.
PROTECTED: Final = frozenset({".storage", ".cloud", "custom_components", "deps", "blueprints", "tts", ".git"})
# Why a folder is refused: the configuration folder (or one holding it), a protected folder, a folder not allowed.
REFUSED_ROOT: Final = "root"
REFUSED_PROTECTED: Final = "protected"
REFUSED_OUTSIDE: Final = "outside"
# The errors kept per folder, so that a folder full of locked files does not fill the state.
MAX_ERRORS: Final = 5


def settings(options: Any) -> dict[str, Any]:
    """The module's settings, with their defaults (no folder at all when the list was emptied on purpose)."""
    options = options if isinstance(options, dict) else {}
    directories = options.get(CONF_DIRECTORIES)
    if not isinstance(directories, list):
        directories = list(DEFAULT_DIRECTORIES)
    max_age = options.get(CONF_MAX_AGE)
    return {
        CONF_DIRECTORIES: list(dict.fromkeys(str(d).strip() for d in directories if str(d).strip())),
        CONF_MAX_AGE: min(MAX_AGE_LIMIT, max(1, int(max_age))) if max_age else DEFAULT_MAX_AGE,
    }


def resolve(config_dir: str, directory: str, allowed: Callable[[str], bool]) -> tuple[Path, str | None]:
    """The folder's real path and why it is refused (None when it may be purged). Blocking: reads symlinks."""
    root = Path(os.path.realpath(config_dir))
    path = Path(os.path.expanduser(directory))
    real = Path(os.path.realpath(path if path.is_absolute() else root / path))
    if real == root or root.is_relative_to(real):
        return real, REFUSED_ROOT
    if real.is_relative_to(root):
        if real.relative_to(root).parts[0] in PROTECTED:
            return real, REFUSED_PROTECTED
        return real, None
    return real, None if allowed(str(real)) else REFUSED_OUTSIDE


def purge(directory: Path, max_age: int, dry_run: bool) -> dict[str, Any]:
    """Delete the files of the folder (and of its sub-folders) not modified for max_age days. Blocking.

    Symbolic links are deleted as files, never followed. With dry_run nothing is deleted: the counts say what would be.
    """
    cutoff = time.time() - max_age * 86400
    result: dict[str, Any] = {
        "exists": directory.is_dir(),
        "files": 0,
        "size": 0,
        "old_files": 0,
        "old_size": 0,
        "oldest": None,
        "deleted": 0,
        "freed": 0,
        "folders_removed": 0,
        "errors": [],
    }
    if not result["exists"]:
        return result
    errors: list[str] = result["errors"]

    def _error(err: OSError) -> None:
        if len(errors) < MAX_ERRORS:
            errors.append(f"{err.filename}: {err.strerror}" if err.filename else str(err))

    emptied: set[str] = set()
    for folder, _dirs, names in os.walk(directory, onerror=_error):
        for name in names:
            path = os.path.join(folder, name)
            try:
                stat = os.lstat(path)
            except OSError as err:
                _error(err)
                continue
            result["files"] += 1
            result["size"] += stat.st_size
            if stat.st_mtime >= cutoff:
                continue
            result["old_files"] += 1
            result["old_size"] += stat.st_size
            if result["oldest"] is None or stat.st_mtime < result["oldest"]:
                result["oldest"] = stat.st_mtime
            if dry_run:
                continue
            try:
                os.unlink(path)
            except OSError as err:
                _error(err)
                continue
            result["deleted"] += 1
            result["freed"] += stat.st_size
            emptied.add(folder)
    if dry_run:
        return result
    # The sub-folders left empty, deepest first: those a file was deleted from, or not modified since the cutoff
    for folder, _dirs, _names in os.walk(directory, topdown=False, onerror=_error):
        if folder == str(directory):
            continue
        try:
            if os.listdir(folder) or (folder not in emptied and os.lstat(folder).st_mtime >= cutoff):
                continue
            os.rmdir(folder)
        except OSError as err:
            _error(err)
            continue
        result["folders_removed"] += 1
        emptied.add(os.path.dirname(folder))
    return result
