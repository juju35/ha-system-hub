"""Settings of the Git Sync module: the repository (checked before it is saved) and the options."""

from __future__ import annotations

from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant
from homeassistant.helpers import selector

from .const import (
    COMMIT_LANGUAGES,
    CONF_AI_TASK_ENTITY,
    CONF_ALLOW_SENSITIVE,
    CONF_AUTHOR_EMAIL,
    CONF_AUTHOR_NAME,
    CONF_BRANCH,
    CONF_COMMIT_BEFORE_UPDATE,
    CONF_COMMIT_INTERVAL,
    CONF_COMMIT_LANGUAGE,
    CONF_EXPORT_BEFORE_COMMIT,
    CONF_EXPORT_DIR,
    CONF_EXPORT_ENABLED,
    CONF_EXPORT_FORMAT,
    CONF_EXPORT_TIME,
    CONF_FETCH_INTERVAL,
    CONF_NOTIFY_IMAGE,
    CONF_NOTIFY_SERVICE,
    CONF_PULL_BEFORE_PUSH,
    CONF_REMOTE,
    CONF_REPO_PATH,
    CONF_SSH_KEY,
    CONF_STATUS_INTERVAL,
    DEFAULT_ALLOW_SENSITIVE,
    DEFAULT_BRANCH,
    DEFAULT_COMMIT_INTERVAL,
    DEFAULT_COMMIT_LANGUAGE,
    DEFAULT_EXPORT_DIR,
    DEFAULT_EXPORT_FORMAT,
    DEFAULT_EXPORT_TIME,
    DEFAULT_FETCH_INTERVAL,
    DEFAULT_PULL_BEFORE_PUSH,
    DEFAULT_REMOTE,
    DEFAULT_REPO_PATH,
    DEFAULT_SSH_KEY,
    DEFAULT_STATUS_INTERVAL,
    EXPORT_FORMATS,
)
from .export import export_dir_allowed
from .git import GitRepo

_TEXT = selector.TextSelector()
_EMAIL = selector.TextSelector(selector.TextSelectorConfig(type=selector.TextSelectorType.EMAIL))
_URL = selector.TextSelector(selector.TextSelectorConfig(type=selector.TextSelectorType.URL))


def _number(minimum: int, maximum: int, unit: str) -> selector.NumberSelector:
    return selector.NumberSelector(
        selector.NumberSelectorConfig(
            min=minimum,
            max=maximum,
            step=1,
            unit_of_measurement=unit,
            mode=selector.NumberSelectorMode.BOX,
        )
    )


def _choice(options: list[str], key: str) -> selector.SelectSelector:
    return selector.SelectSelector(
        selector.SelectSelectorConfig(options=options, translation_key=key, mode=selector.SelectSelectorMode.DROPDOWN)
    )


# Optional text fields that can be emptied. The frontend leaves an emptied field out of the submitted data, and a
# `default=` would then bring the old value back: they get a suggested value instead, and an empty string when missing.
REPOSITORY_OPTIONAL = (CONF_BRANCH, CONF_AUTHOR_NAME, CONF_AUTHOR_EMAIL)
OPTIONS_OPTIONAL = (CONF_NOTIFY_SERVICE, CONF_NOTIFY_IMAGE)


def _suggested(value: Any) -> dict[str, Any] | None:
    return {"suggested_value": value} if value else None


def fill_empty(user_input: dict[str, Any], keys: tuple[str, ...]) -> dict[str, Any]:
    for key in keys:
        user_input.setdefault(key, "")
    return user_input


def repository_schema(defaults: dict[str, Any]) -> vol.Schema:
    return vol.Schema(
        {
            vol.Required(CONF_REPO_PATH, default=defaults.get(CONF_REPO_PATH, DEFAULT_REPO_PATH)): _TEXT,
            vol.Required(CONF_REMOTE, default=defaults.get(CONF_REMOTE, DEFAULT_REMOTE)): _TEXT,
            vol.Optional(CONF_BRANCH, description=_suggested(defaults.get(CONF_BRANCH, DEFAULT_BRANCH))): _TEXT,
            vol.Required(CONF_SSH_KEY, default=defaults.get(CONF_SSH_KEY, DEFAULT_SSH_KEY)): _TEXT,
            vol.Optional(CONF_AUTHOR_NAME, description=_suggested(defaults.get(CONF_AUTHOR_NAME))): _TEXT,
            vol.Optional(CONF_AUTHOR_EMAIL, description=_suggested(defaults.get(CONF_AUTHOR_EMAIL))): _EMAIL,
        }
    )


def _default_ai_task(hass: HomeAssistant) -> str | None:
    """The AI task entity, when there is exactly one: preselected rather than left empty."""
    entities = hass.states.async_entity_ids("ai_task")
    return entities[0] if len(entities) == 1 else None


def _default_language(hass: HomeAssistant) -> str:
    """Home Assistant's language when commit messages can be written in it, else English.

    The full tag first (sr-Latn, stored lowercase as sr-latn), then its language (pt-BR gives pt).
    """
    language = (hass.config.language or "").lower()
    for candidate in (language, language.split("-")[0]):
        if candidate in COMMIT_LANGUAGES:
            return candidate
    return DEFAULT_COMMIT_LANGUAGE


def default_options(hass: HomeAssistant) -> dict[str, Any]:
    """Options of a new entry: the only AI task and Home Assistant's language."""
    options: dict[str, Any] = {CONF_COMMIT_LANGUAGE: _default_language(hass)}
    if ai_task := _default_ai_task(hass):
        options[CONF_AI_TASK_ENTITY] = ai_task
    return options


def options_schema(hass: HomeAssistant, options: dict[str, Any]) -> vol.Schema:
    # Never set (entries before 0.1.1): suggest the only AI task. Emptied on purpose: stored as None, stays empty.
    ai_task = options[CONF_AI_TASK_ENTITY] if CONF_AI_TASK_ENTITY in options else _default_ai_task(hass)
    return vol.Schema(
        {
            vol.Optional(
                CONF_AI_TASK_ENTITY,
                description={"suggested_value": ai_task} if ai_task else None,
            ): selector.EntitySelector(selector.EntitySelectorConfig(domain="ai_task")),
            vol.Required(
                CONF_COMMIT_LANGUAGE,
                default=options.get(CONF_COMMIT_LANGUAGE, _default_language(hass)),
            ): _choice(COMMIT_LANGUAGES, CONF_COMMIT_LANGUAGE),
            vol.Required(
                CONF_COMMIT_INTERVAL,
                default=options.get(CONF_COMMIT_INTERVAL, DEFAULT_COMMIT_INTERVAL),
            ): _number(0, 1440, "min"),
            vol.Required(
                CONF_STATUS_INTERVAL,
                default=options.get(CONF_STATUS_INTERVAL, DEFAULT_STATUS_INTERVAL),
            ): _number(10, 3600, "s"),
            vol.Required(
                CONF_FETCH_INTERVAL,
                default=options.get(CONF_FETCH_INTERVAL, DEFAULT_FETCH_INTERVAL),
            ): _number(0, 1440, "min"),
            vol.Required(
                CONF_PULL_BEFORE_PUSH, default=options.get(CONF_PULL_BEFORE_PUSH, DEFAULT_PULL_BEFORE_PUSH)
            ): selector.BooleanSelector(),
            vol.Required(
                CONF_COMMIT_BEFORE_UPDATE, default=options.get(CONF_COMMIT_BEFORE_UPDATE, False)
            ): selector.BooleanSelector(),
            vol.Required(
                CONF_ALLOW_SENSITIVE, default=options.get(CONF_ALLOW_SENSITIVE, DEFAULT_ALLOW_SENSITIVE)
            ): selector.BooleanSelector(),
            vol.Optional(CONF_NOTIFY_SERVICE, description=_suggested(options.get(CONF_NOTIFY_SERVICE))): _TEXT,
            vol.Optional(CONF_NOTIFY_IMAGE, description=_suggested(options.get(CONF_NOTIFY_IMAGE))): _URL,
            vol.Required(
                CONF_EXPORT_ENABLED, default=options.get(CONF_EXPORT_ENABLED, True)
            ): selector.BooleanSelector(),
            vol.Required(
                CONF_EXPORT_TIME, default=options.get(CONF_EXPORT_TIME, DEFAULT_EXPORT_TIME)
            ): selector.TimeSelector(),
            vol.Required(CONF_EXPORT_DIR, default=options.get(CONF_EXPORT_DIR, DEFAULT_EXPORT_DIR)): _TEXT,
            vol.Required(CONF_EXPORT_FORMAT, default=options.get(CONF_EXPORT_FORMAT, DEFAULT_EXPORT_FORMAT)): _choice(
                EXPORT_FORMATS, CONF_EXPORT_FORMAT
            ),
            vol.Required(
                CONF_EXPORT_BEFORE_COMMIT, default=options.get(CONF_EXPORT_BEFORE_COMMIT, False)
            ): selector.BooleanSelector(),
        }
    )


async def validate(data: dict[str, Any]) -> dict[str, str]:
    """Check that the path is a git work tree with the given remote, and that git knows the commit author."""
    repo = GitRepo(
        data[CONF_REPO_PATH],
        remote=data[CONF_REMOTE],
        branch=data.get(CONF_BRANCH, ""),
        ssh_key=data[CONF_SSH_KEY],
        author_name=data.get(CONF_AUTHOR_NAME) or "",
        author_email=data.get(CONF_AUTHOR_EMAIL) or "",
    )
    if not await repo.is_repository():
        return {CONF_REPO_PATH: "not_a_repository"}
    if await repo.remote_url() is None:
        return {CONF_REMOTE: "unknown_remote"}
    # A name git refuses ("main..", "a b", "-x") would only fail at the first push, after the setup succeeded.
    if not await repo.valid_branch():
        return {CONF_BRANCH: "invalid_branch"}
    # The Home Assistant container does not see the `git config --global` made in the Terminal add-on: without
    # an identity, every commit would fail with "Author identity unknown".
    if not await repo.has_identity():
        return {CONF_AUTHOR_NAME if data.get(CONF_AUTHOR_EMAIL) else CONF_AUTHOR_EMAIL: "author_required"}
    return {}


def notify_service_exists(hass: HomeAssistant, service: str) -> bool:
    """Same reading as the notification sent after a commit: "notify.name", "domain.name" or "name"."""
    domain, _, name = service.strip().partition(".")
    if not name:
        domain, name = "notify", domain
    return hass.services.has_service(domain, name)


async def options_errors(hass: HomeAssistant, user_input: dict[str, Any]) -> dict[str, str]:
    """Normalize the options submitted (numbers, emptied fields) and check the notify action and export folder."""
    for key in (CONF_COMMIT_INTERVAL, CONF_STATUS_INTERVAL, CONF_FETCH_INTERVAL):
        user_input[key] = int(user_input[key])
    # An emptied field is left out of user_input: store it empty so it isn't suggested again.
    user_input.setdefault(CONF_AI_TASK_ENTITY, None)
    fill_empty(user_input, OPTIONS_OPTIONAL)
    errors: dict[str, str] = {}
    service = user_input[CONF_NOTIFY_SERVICE].strip()
    if service and not notify_service_exists(hass, service):
        errors[CONF_NOTIFY_SERVICE] = "unknown_notify_service"
    if not await hass.async_add_executor_job(
        export_dir_allowed,
        hass.config.path(user_input[CONF_EXPORT_DIR]),
        hass.config.config_dir,
        hass.config.allowlist_external_dirs,
    ):
        errors[CONF_EXPORT_DIR] = "export_dir_not_allowed"
    return errors
