"""Purge module: the files older than a number of days, deleted from a list of folders once a day.

By default the folder of the configuration backups written by the Home Assistant MCP server (mcp_backups, one
sub-folder per snapshot). Only folders inside the configuration folder, relative to it (an absolute path is accepted
when it is inside). The configuration folder itself, a folder outside it, a hidden folder (.storage, .ssh, .git…) and
Home Assistant's own folders (custom_components, backups…) are refused, whatever the path or link used to reach them.
The sub-folders left empty by the purge are removed, never the folder set.
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Final

CONF_DIRECTORIES: Final = "directories"
CONF_MAX_AGE: Final = "max_age"
DEFAULT_DIRECTORIES: Final = ("mcp_backups",)
DEFAULT_MAX_AGE: Final = 30
MAX_AGE_LIMIT: Final = 3650
SERVICE_PURGE: Final = "purge_files"
ATTR_DRY_RUN: Final = "dry_run"

# Folders of the configuration folder never purged, nor anything in them (a hidden folder never either).
PROTECTED: Final = frozenset({"custom_components", "deps", "blueprints", "tts", "backups", "www/community"})
# Why a folder is refused: the configuration folder (or one holding it), a protected folder, one outside it.
REFUSED_ROOT: Final = "root"
REFUSED_PROTECTED: Final = "protected"
REFUSED_OUTSIDE: Final = "outside"
# The errors kept per folder, so that a folder full of locked files does not fill the state.
MAX_ERRORS: Final = 5
# The folder picker: the files counted per sub-folder at most, so that a huge folder answers fast.
BROWSE_MAX_FILES: Final = 20000


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


def protected(relative: Path) -> bool:
    """A folder of the configuration folder never purged: hidden, one of Home Assistant's own, or inside one."""
    parts = relative.parts
    return any(p.startswith(".") for p in parts) or any(
        parts[: len(Path(item).parts)] == Path(item).parts for item in PROTECTED
    )


def resolve(config_dir: str, directory: str) -> tuple[Path, str | None]:
    """The folder's real path and why it is refused (None when it may be purged). Blocking: reads symlinks."""
    root = Path(os.path.realpath(config_dir))
    path = Path(os.path.expanduser(directory))
    real = Path(os.path.realpath(path if path.is_absolute() else root / path))
    if real == root or root.is_relative_to(real):
        return real, REFUSED_ROOT
    if not real.is_relative_to(root):
        return real, REFUSED_OUTSIDE
    return real, REFUSED_PROTECTED if protected(real.relative_to(root)) else None


def _count(folder: str, cutoff: float) -> dict[str, Any]:
    """The files of a folder and of its sub-folders (up to BROWSE_MAX_FILES), those older than the cutoff."""
    found = {"files": 0, "size": 0, "old_files": 0, "truncated": False}
    for current, _dirs, names in os.walk(folder, onerror=lambda _err: None):
        for name in names:
            try:
                stat = os.lstat(os.path.join(current, name))
            except OSError:
                continue
            found["files"] += 1
            found["size"] += stat.st_size
            found["old_files"] += stat.st_mtime < cutoff
            if found["files"] >= BROWSE_MAX_FILES:
                found["truncated"] = True
                return found
    return found


def _has_folders(folder: str) -> bool:
    try:
        with os.scandir(folder) as items:
            return any(i.is_dir(follow_symlinks=False) for i in items)
    except OSError:
        return False


def browse(config_dir: str, directory: str, max_age: int) -> dict[str, Any]:
    """The sub-folders of a folder of the configuration folder (given relative to it, "" for itself), for the folder
    picker. Blocking.

    Each with its files (and those older than max_age days), when it was modified, whether it holds folders and
    whether it may be purged; symbolic links are left out. Raises ValueError for a folder outside the configuration
    folder or that can't be read.
    """
    root = Path(os.path.realpath(config_dir))
    asked = directory.strip().strip("/")
    target = Path(os.path.realpath(root / asked)) if asked else root
    if not (target == root or target.is_relative_to(root)) or not target.is_dir():
        raise ValueError("outside")
    cutoff = time.time() - max_age * 86400

    def shown(path: Path) -> str:
        return path.relative_to(root).as_posix()

    try:
        items = sorted(os.scandir(target), key=lambda i: i.name.lower())
    except OSError as err:
        raise ValueError("unreadable") from err
    entries = []
    for item in items:
        if not item.is_dir(follow_symlinks=False):
            continue
        path = Path(item.path)
        entry: dict[str, Any] = {
            "name": item.name,
            "path": shown(path),
            "protected": protected(path.relative_to(root)),
        }
        try:
            entry["modified"] = item.stat(follow_symlinks=False).st_mtime
        except OSError:
            entry["modified"] = None
        if not entry["protected"]:
            entry |= _count(item.path, cutoff)
            entry["folders"] = _has_folders(item.path)
        entries.append(entry)
    here = "" if target == root else shown(target)
    # The folder itself (picked from the address bar): what it holds
    current = None if target == root or protected(target.relative_to(root)) else _count(str(target), cutoff)
    return {"path": here, "entries": entries, "current": current}


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
