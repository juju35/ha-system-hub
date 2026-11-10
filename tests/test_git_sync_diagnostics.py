"""Diagnostics: settings and status, with credentials and personal data redacted."""

from __future__ import annotations

import json
from pathlib import Path

from homeassistant.core import HomeAssistant

from custom_components.system_hub.const import DOMAIN
from custom_components.system_hub.diagnostics import async_get_config_entry_diagnostics
from custom_components.system_hub.git_sync.const import (
    CONF_AUTHOR_EMAIL,
    CONF_AUTHOR_NAME,
    CONF_COMMIT_INTERVAL,
    CONF_EXPORT_DIR,
    CONF_EXPORT_ENABLED,
    CONF_FETCH_INTERVAL,
    CONF_REMOTE,
    CONF_REPO_PATH,
    CONF_SSH_KEY,
)

from .conftest import git_sync_entry

TOKEN = "ghp_SuperSecretToken123"


async def test_diagnostics_redacts_secrets(hass: HomeAssistant, repo: Path, tmp_path: Path) -> None:
    ssh_key = str(tmp_path / ".ssh" / "id_ed25519")
    entry = git_sync_entry(
        domain=DOMAIN,
        unique_id=str(repo),
        data={CONF_REPO_PATH: str(repo), CONF_REMOTE: "origin", CONF_SSH_KEY: ssh_key},
        options={
            CONF_COMMIT_INTERVAL: 0,
            CONF_FETCH_INTERVAL: 0,
            CONF_EXPORT_ENABLED: False,
            CONF_EXPORT_DIR: str(tmp_path / "export"),
            CONF_AUTHOR_NAME: "Jane Doe",
            CONF_AUTHOR_EMAIL: "jane@example.com",
        },
    )
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    # As if the remote were an HTTPS URL carrying a token, and an error had quoted it.
    state = entry.runtime_data.git_sync.data
    state.remote_url = f"https://juju:{TOKEN}@github.com/me/config.git"
    state.last_error = f"git push failed: unable to access 'https://{TOKEN}@github.com/me/config.git/'"

    result = await async_get_config_entry_diagnostics(hass, entry)
    dumped = json.dumps(result, default=str)
    for secret in (TOKEN, "juju:", ssh_key, "id_ed25519", "jane@example.com", "Jane Doe"):
        assert secret not in dumped

    assert result["entry"]["options"]["git_sync"][CONF_SSH_KEY] == "**REDACTED**"
    assert result["entry"]["options"]["git_sync"][CONF_REPO_PATH] == str(repo)
    assert result["entry"]["options"]["git_sync"][CONF_AUTHOR_EMAIL] == "**REDACTED**"
    assert result["entry"]["options"]["git_sync"][CONF_AUTHOR_NAME] == "**REDACTED**"
    assert result["git_sync"]["data"]["remote_url"] == "https://github.com/me/config.git"
    assert "github.com/me/config.git" in result["git_sync"]["data"]["last_error"]
    assert result["git_sync"]["data"]["status"] == "clean"
    assert result["git_sync"]["data"]["git"]["branch"] == "main"
    assert result["git_sync"]["last_update_success"] is True

    assert await hass.config_entries.async_unload(entry.entry_id)
