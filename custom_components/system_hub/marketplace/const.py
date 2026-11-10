"""Constants of the Marketplace module."""

from __future__ import annotations

from typing import Final

from ..const import DOMAIN

MARKETPLACE_DOMAIN: Final = "marketplace"

CONF_SCAN_INTERVAL: Final = "scan_interval"
CONF_BACKUP_BEFORE_INSTALL: Final = "backup_before_install"
# Hours between two automatic checks; 0 turns the automatic check off.
DEFAULT_SCAN_INTERVAL: Final = 24
MAX_SCAN_INTERVAL: Final = 168

# Repositories refreshed at the same time: the Marketplace itself fetches them one by one,
# a few in parallel keeps a large install quick without hammering the GitHub API.
PARALLEL_REFRESHES: Final = 4

SERVICE_CHECK_UPDATES: Final = "marketplace_check_updates"
SERVICE_CHECK_REPOSITORY: Final = "marketplace_check_repository"
SERVICE_INSTALL_UPDATES: Final = "marketplace_install_updates"

# Fired when a full check finds updates that the previous one didn't.
EVENT_UPDATES_FOUND: Final = f"{DOMAIN}_marketplace_updates_found"

STATE_IDLE: Final = "idle"
STATE_RUNNING: Final = "running"
STATE_ERROR: Final = "error"


# Name of the backup in the list of updates that could not be installed ("<name>: <error>"), in Home Assistant's
# language: the backup failed, so nothing was installed.
BACKUP_FAILED: Final = {
    "en": "Backup before installing",
    "fr": "Sauvegarde avant l'installation",
    "de": "Backup vor der Installation",
    "es": "Copia de seguridad antes de instalar",
    "sr": "Резервна копија пре инсталације",
    "sr-Latn": "Rezervna kopija pre instalacije",
    "it": "Backup prima dell'installazione",
    "nl": "Back-up vóór de installatie",
    "pt": "Cópia de segurança antes da instalação",
    "pt-BR": "Backup antes da instalação",
    "pl": "Kopia zapasowa przed instalacją",
    "ro": "Copie de rezervă înainte de instalare",
    "da": "Backup før installation",
    "sv": "Säkerhetskopia före installation",
    "bg": "Резервно копие преди инсталиране",
    "ru": "Резервная копия перед установкой",
    "uk": "Резервна копія перед встановленням",
    "hu": "Biztonsági mentés telepítés előtt",
    "sk": "Záloha pred inštaláciou",
    "cs": "Záloha před instalací",
    "sl": "Varnostna kopija pred namestitvijo",
    "lv": "Rezerves kopija pirms instalēšanas",
    "el": "Αντίγραφο ασφαλείας πριν από την εγκατάσταση",
}
