/* jscpd:ignore-start */
// ── Card picker: light previews ──────────────────────────────────────────────
// Home Assistant's card picker builds a live preview of every card registered with `preview: true`, all at once and
// with no lazy loading. A preview here is drawn only once it scrolls into view: the picker calls getStubConfig() right
// before it creates the preview, which marks the next instance of that card; once connected under <hui-card-picker>,
// that instance holds Home Assistant's state (no render, no history, no animation) until it is visible. Anywhere else
// (a dashboard, the card editor) the card behaves as before. Editors and other elements are defined unchanged.
function pickerDefine(tag, Card, options) {
  const isCard = !tag.endsWith("-editor") && (typeof Card.getStubConfig === "function" || typeof Card.getConfigElement === "function");
  if (!isCard || typeof IntersectionObserver !== "function") return customElements.define(tag, Card, options);
  let marks = [];
  const lazy = class extends Card {
    static getStubConfig(...args) {
      marks.push(Date.now());
      return Card.getStubConfig ? Card.getStubConfig(...args) : {};
    }

    constructor() {
      super();
      const now = Date.now();
      marks = marks.filter((t) => now - t < 5000);
      if (marks.length) {
        marks.shift();
        this._plHold = true;
      }
    }

    set hass(hass) {
      if (this._plHold) this._plHass = hass;
      else super.hass = hass;
    }

    get hass() {
      return this._plHold ? this._plHass : super.hass;
    }

    connectedCallback() {
      if (!this._plHold) return super.connectedCallback?.();
      if (this.getRootNode()?.host?.localName !== "hui-card-picker") return this._plRelease();
      if (this._plIo) return;
      // A custom element is inline until its styles arrive: a block of a card's height keeps the cells apart, so
      // that only the previews actually on screen intersect.
      this.style.display = "block";
      this.style.minHeight = "120px";
      this._plIo = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && this._plRelease(), {
        rootMargin: "200px",
      });
      this._plIo.observe(this);
    }

    disconnectedCallback() {
      if (this._plHold) return;
      super.disconnectedCallback?.();
    }

    _plRelease() {
      this._plIo?.disconnect();
      this._plIo = null;
      this._plHold = false;
      this.style.display = "";
      this.style.minHeight = "";
      if (this._plHass !== undefined) super.hass = this._plHass;
      this._plHass = undefined;
      if (this.isConnected) super.connectedCallback?.();
    }
  };
  return customElements.define(tag, lazy, options);
}
/* jscpd:ignore-end */

/*
 * System Monitor Card for Home Assistant
 * Shipped with System Hub (https://github.com/juju35/ha-system-hub), which adds it to the dashboard resources.
 *
 * Lovelace cards for the System Monitor integration
 * (https://www.home-assistant.io/integrations/systemmonitor/), showing the health of the
 * machine running Home Assistant. Entities are discovered automatically through the entity
 * registry (platform "systemmonitor" and translation key), whatever the language.
 */

// The release writes System Hub's version here (scripts/split-frontend.mjs).
const VERSION = "__VERSION__";

const ICONS = {
  monitor_dashboard:
    "M21,16V4H3V16H21M21,2A2,2 0 0,1 23,4V16A2,2 0 0,1 21,18H14V20H16V22H8V20H10V18H3C1.89,18 1,17.1 1,16V4C1,2.89 1.89,2 3,2H21M5,6H14V11H5V6M15,6H19V8H15V6M19,9V14H15V9H19M5,12H9V14H5V12M10,12H14V14H10V12Z",
  cpu: "M6,4H18V5H21V7H18V9H21V11H18V13H21V15H18V17H21V19H18V20H6V19H3V17H6V15H3V13H6V11H3V9H6V7H3V5H6V4M11,15V18H12V15H11M13,15V18H14V15H13M15,15V18H16V15H15Z",
  ram: "M17,17H7V7H17M21,11V9H19V7C19,5.89 18.1,5 17,5H15V3H13V5H11V3H9V5H7C5.89,5 5,5.89 5,7V9H3V11H5V13H3V15H5V17A2,2 0 0,0 7,19H9V21H11V19H13V21H15V19H17A2,2 0 0,0 19,17V15H21V13H19V11M13,13H11V11H13M15,9H9V15H15V9Z",
  temp: "M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z",
  down: "M9,4H15V12H19.84L12,19.84L4.16,12H9V4Z",
  up: "M15,20H9V12H4.16L12,4.16L19.84,12H15V20Z",
  disk: "M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M12,4A6,6 0 0,0 6,10C6,13.31 8.69,16 12.1,16L11.22,13.77C10.95,13.29 11.11,12.68 11.59,12.4L12.45,11.9C12.93,11.63 13.54,11.79 13.82,12.27L15.74,14.69C17.12,13.59 18,11.9 18,10A6,6 0 0,0 12,4M12,9A1,1 0 0,1 13,10A1,1 0 0,1 12,11A1,1 0 0,1 11,10A1,1 0 0,1 12,9M7,18A1,1 0 0,0 6,19A1,1 0 0,0 7,20A1,1 0 0,0 8,19A1,1 0 0,0 7,18M12.09,13.27L14.58,19.58L17.17,18.08L12.95,12.77L12.09,13.27Z",
  database: "M12,3C7.58,3 4,4.79 4,7C4,9.21 7.58,11 12,11C16.42,11 20,9.21 20,7C20,4.79 16.42,3 12,3M4,9V12C4,14.21 7.58,16 12,16C16.42,16 20,14.21 20,12V9C20,11.21 16.42,13 12,13C7.58,13 4,11.21 4,9M4,14V17C4,19.21 7.58,21 12,21C16.42,21 20,19.21 20,17V14C20,16.21 16.42,18 12,18C7.58,18 4,16.21 4,14Z",
  timer: "M12,20A7,7 0 0,1 5,13A7,7 0 0,1 12,6A7,7 0 0,1 19,13A7,7 0 0,1 12,20M19.03,7.39L20.45,5.97C20,5.46 19.55,5 19.04,4.56L17.62,6C16.07,4.74 14.12,4 12,4A9,9 0 0,0 3,13A9,9 0 0,0 12,22C17,22 21,17.97 21,13C21,10.88 20.26,8.93 19.03,7.39M11,14H13V8H11M15,1H9V3H15V1Z",
  network: "M13,19H14A1,1 0 0,1 15,20H22V22H15A1,1 0 0,1 14,23H10A1,1 0 0,1 9,22H2V20H9A1,1 0 0,1 10,19H11V17H4A1,1 0 0,1 3,16V12A1,1 0 0,1 4,11H20A1,1 0 0,1 21,12V16A1,1 0 0,1 20,17H13V19M4,3H20A1,1 0 0,1 21,4V8A1,1 0 0,1 20,9H4A1,1 0 0,1 3,8V4A1,1 0 0,1 4,3M9,7H10V5H9V7M9,15H10V13H9V15M5,5V7H7V5H5M5,13V15H7V13H5Z",
  load: "M3,14L3.5,14.07L8.07,9.5C7.89,8.85 8.06,8.11 8.59,7.59C9.37,6.8 10.63,6.8 11.41,7.59C11.94,8.11 12.11,8.85 11.93,9.5L14.5,12.07L15,12C15.18,12 15.35,12 15.5,12.07L19.07,8.5C19,8.35 19,8.18 19,8A2,2 0 0,1 21,6A2,2 0 0,1 23,8A2,2 0 0,1 21,10C20.82,10 20.65,10 20.5,9.93L16.93,13.5C17,13.65 17,13.82 17,14A2,2 0 0,1 15,16A2,2 0 0,1 13,14L13.07,13.5L10.5,10.93C10.18,11 9.82,11 9.5,10.93L4.93,15.5L5,16A2,2 0 0,1 3,18A2,2 0 0,1 1,16A2,2 0 0,1 3,14Z",
  ip: "M17,3H7A2,2 0 0,0 5,5V21L12,18L19,21V5C19,3.89 18.1,3 17,3M12,7A2,2 0 0,1 14,9A2,2 0 0,1 12,11A2,2 0 0,1 10,9A2,2 0 0,1 12,7Z",
  process: "M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M15,18V16H6V18H15M18,14V12H6V14H18Z",
  swap: "M21,9L17,5V8H10V10H17V13M7,11L3,15L7,19V16H14V14H7V11Z",
  close: "M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z",
  chevron: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  // mdi:backup-restore, for the backups.
  backup: "M12,3A9,9 0 0,0 3,12H0L4,16L8,12H5A7,7 0 0,1 12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19C10.5,19 9.09,18.5 7.94,17.7L6.5,19.14C8.04,20.3 9.94,21 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3M14,12A2,2 0 0,0 12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12Z",
  // mdi:arrow-expand and mdi:arrow-collapse, for the zoom button of the mini card.
  expand: "M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z",
  // mdi:reload, mdi:restart and mdi:power-cycle, mdi:alert-circle-outline and mdi:check-circle-outline: show_actions.
  reload: "M2 12C2 16.97 6.03 21 11 21C13.39 21 15.68 20.06 17.4 18.4L15.9 16.9C14.63 18.25 12.86 19 11 19C4.76 19 1.64 11.46 6.05 7.05C10.46 2.64 18 5.77 18 12H15L19 16H19.1L23 12H20C20 7.03 15.97 3 11 3C6.03 3 2 7.03 2 12Z",
  restart:
    "M12,4C14.1,4 16.1,4.8 17.6,6.3C20.7,9.4 20.7,14.5 17.6,17.6C15.8,19.5 13.3,20.2 10.9,19.9L11.4,17.9C13.1,18.1 14.9,17.5 16.2,16.2C18.5,13.9 18.5,10.1 16.2,7.7C15.1,6.6 13.5,6 12,6V10.6L7,5.6L12,0.6V4M6.3,17.6C3.7,15 3.3,11 5.1,7.9L6.6,9.4C5.5,11.6 5.9,14.4 7.8,16.2C8.3,16.7 8.9,17.1 9.6,17.4L9,19.4C8,19 7.1,18.4 6.3,17.6Z",
  reboot: "M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A9,9 0 0,0 21,12A9,9 0 0,0 12,3M12,19A7,7 0 0,1 5,12A7,7 0 0,1 12,5A7,7 0 0,1 19,12A7,7 0 0,1 12,19M13,17H11V7H13V17Z",
  alert:
    "M11,15H13V17H11V15M11,7H13V13H11V7M12,2C6.47,2 2,6.5 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,20A8,8 0 0,1 4,12A8,8 0 0,1 12,4A8,8 0 0,1 20,12A8,8 0 0,1 12,20Z",
  check:
    "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20M16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z",
  collapse: "M19.5,3.09L15,7.59V4H13V11H20V9H16.41L20.91,4.5L19.5,3.09M4,13V15H7.59L3.09,19.5L4.5,20.91L9,16.41V20H11V13H4Z",
};

const STRINGS = {
  en: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disk",
    temperature: "Temp.",
    swap: "Swap",
    database: "Database",
    network: "Network",
    storage: "Storage",
    processes: "Processes",
    uptime: "Uptime:",
    load: "Load:",
    download: "Download",
    upload: "Upload",
    total: "Total",
    used: "used",
    of: "of",
    hours: "h",
    days: "d",
    minutes: "min",
    running: "Running",
    up_to_date: "Up to date",
    update: "Update",
    no_sm: "No System Monitor entities found. Is the System Monitor integration installed and are its sensors enabled?",
    procs_ok: "Processes running",
    procs_one: "1 process stopped",
    procs_many: "{n} processes stopped",
    st_unknown: "Unknown",
    st_running: "Running",
    st_stopped_one: "1 stopped",
    st_stopped: "{n} stopped",
    zoom_in: "Show the full card",
    zoom_out: "Back to the compact view",
    // Editor
    title: "Title (optional, defaults to Home Assistant)",
    show_system: "Show system (CPU, RAM, disk, temperature)",
    show_disk: "Show the disk gauge (also in Storage)",
    show_title: "Show title",
    show_subtitle: "Show subtitle",
    show_network: "Show network",
    show_history: "Show 24 h history",
    cpu_warning: "CPU warning (%)",
    cpu_critical: "CPU critical (%)",
    ram_warning: "RAM warning (%)",
    ram_critical: "RAM critical (%)",
    disk_warning: "Disk warning (% used)",
    disk_critical: "Disk critical (% used)",
    temp_warning: "Temperature warning (°C)",
    temp_critical: "Temperature critical (°C)",
    swap_warning: "Swap warning (% used)",
    swap_critical: "Swap critical (% used)",
    backup: "Backup",
    backup_none: "No backup yet",
    backup_failed: "Last attempt failed",
    backup_running: "Backing up…",
    backup_next: "Next {when}",
    show_backups: "Show backups",
    backup_warning: "Backup warning (days without backup)",
    backup_critical: "Backup critical (days without backup)",
    show_storage: "Show storage",
    show_processes: "Show processes",
    zoom: "Zoom button",
    zoom_helper: "Switches the card to the full card and back",
    interface: "Network interface (optional, all by default)",
    entities: "Sensors of your choice (instead of System Monitor's)",
    ent_processor_use: "CPU usage (%)",
    ent_processor_temperature: "CPU temperature",
    ent_memory_use_percent: "RAM usage (%)",
    ent_swap_use_percent: "Swap usage (%)",
    ent_last_boot: "Last boot",
    language: "Language",
    lang_auto: "Automatic",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Show the reload and restart buttons",
    show_actions_helper: "Administrators only. Rebooting the host needs Home Assistant OS or Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Show the uptime",
    show_load: "Show the load",
    show_ip: "Show the IP address",
    tap_action: "Tap action",
    tap_action_helper: "On a gauge, tile or line: open the entity's details, or nothing (the buttons still work)",
    // gauge_style and the level colours (#131)
    gauge_style: "System gauges",
    gauge_ring: "Rings",
    gauge_bar: "Lines with bars",
    ok_color: "Normal level colour",
    warning_color: "Warning level colour",
    critical_color: "Critical level colour",
    ok_color_helper: "A Home Assistant colour or any CSS colour; the levels follow the thresholds below",
    ha_reload: "Reload configuration",
    ha_restart: "Restart Home Assistant",
    ha_reboot: "Reboot the host",
    ha_reload_title: "Reload the configuration?",
    ha_reload_text: "Every YAML configuration Home Assistant can reload (automations, scripts, scenes, templates, groups…) is read again, without a restart.",
    ha_restart_title: "Restart Home Assistant?",
    ha_restart_text: "Home Assistant stops then starts again: it is unavailable for a moment and its automations do not run meanwhile.",
    ha_reboot_title: "Reboot the host?",
    ha_reboot_text: "The machine running Home Assistant restarts, with Home Assistant and every add-on: everything is unavailable for a few minutes.",
    ha_checking: "Checking the configuration…",
    ha_valid: "The configuration is valid.",
    ha_invalid: "The configuration is invalid: fix it before restarting.",
    ha_restarting: "Home Assistant is restarting…",
    ha_rebooting: "The host is rebooting…",
    sc_file_editor: "File editor",
    sc_marketplace: "Marketplace",
    sc_settings: "Settings",
    sc_integrations: "Integrations",
    sc_logs: "Logs",
    sc_developer_tools: "Developer tools",
    ha_cancel: "Cancel",
    ha_failed: "Failed: {error}",
  },
  fr: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disque",
    temperature: "Temp.",
    swap: "Swap",
    database: "Base de données",
    network: "Réseau",
    storage: "Stockage",
    processes: "Processus",
    uptime: "Temps de fonctionnement :",
    load: "Charge :",
    download: "Réception",
    upload: "Envoi",
    total: "Total",
    used: "utilisés",
    of: "sur",
    hours: "h",
    days: "j",
    minutes: "min",
    running: "En marche",
    up_to_date: "À jour",
    update: "Mise à jour",
    no_sm: "Aucune entité System Monitor trouvée. L'intégration System Monitor est-elle installée et ses capteurs activés ?",
    procs_ok: "Processus en marche",
    procs_one: "1 processus arrêté",
    procs_many: "{n} processus arrêtés",
    st_unknown: "Inconnu",
    st_running: "En marche",
    st_stopped_one: "1 arrêté",
    st_stopped: "{n} arrêtés",
    zoom_in: "Afficher la carte complète",
    zoom_out: "Revenir à la vue compacte",
    title: "Titre (facultatif, Home Assistant par défaut)",
    show_system: "Afficher le système (CPU, RAM, disque, température)",
    show_disk: "Afficher la jauge du disque (aussi dans Stockage)",
    show_title: "Afficher le titre",
    show_subtitle: "Afficher le sous-titre",
    show_network: "Afficher le réseau",
    show_history: "Afficher l’historique 24 h",
    cpu_warning: "Seuil d’alerte CPU (%)",
    cpu_critical: "Seuil critique CPU (%)",
    ram_warning: "Seuil d’alerte RAM (%)",
    ram_critical: "Seuil critique RAM (%)",
    disk_warning: "Seuil d’alerte disque (% utilisé)",
    disk_critical: "Seuil critique disque (% utilisé)",
    temp_warning: "Seuil d’alerte température (°C)",
    temp_critical: "Seuil critique température (°C)",
    swap_warning: "Seuil d’alerte swap (% utilisé)",
    swap_critical: "Seuil critique swap (% utilisé)",
    backup: "Sauvegarde",
    backup_none: "Aucune sauvegarde",
    backup_failed: "Dernière tentative échouée",
    backup_running: "Sauvegarde en cours…",
    backup_next: "Prochaine {when}",
    show_backups: "Afficher les sauvegardes",
    backup_warning: "Alerte sauvegarde (jours sans sauvegarde)",
    backup_critical: "Sauvegarde critique (jours sans sauvegarde)",
    show_storage: "Afficher le stockage",
    show_processes: "Afficher les processus",
    zoom: "Bouton zoom",
    zoom_helper: "Bascule la carte en carte complète, et inversement",
    interface: "Interface réseau (facultatif, toutes par défaut)",
    entities: "Capteurs de votre choix (au lieu de ceux de System Monitor)",
    ent_processor_use: "Utilisation du processeur (%)",
    ent_processor_temperature: "Température du processeur",
    ent_memory_use_percent: "Utilisation de la RAM (%)",
    ent_swap_use_percent: "Utilisation du swap (%)",
    ent_last_boot: "Dernier démarrage",
    language: "Langue",
    lang_auto: "Automatique",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Afficher les boutons de rechargement et de redémarrage",
    show_actions_helper: "Administrateurs uniquement. Le redémarrage de l'hôte demande Home Assistant OS ou Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Afficher le temps de fonctionnement",
    show_load: "Afficher la charge",
    show_ip: "Afficher l'adresse IP",
    tap_action: "Action au toucher",
    tap_action_helper: "Sur une jauge, une tuile ou une ligne : ouvrir le détail de l'entité, ou rien (les boutons restent actifs)",
    // gauge_style and the level colours (#131)
    gauge_style: "Jauges système",
    gauge_ring: "Anneaux",
    gauge_bar: "Lignes avec barres",
    ok_color: "Couleur du niveau normal",
    warning_color: "Couleur du niveau d’alerte",
    critical_color: "Couleur du niveau critique",
    ok_color_helper: "Une couleur de Home Assistant ou toute couleur CSS ; les niveaux suivent les seuils ci-dessous",
    ha_reload: "Recharger la configuration",
    ha_restart: "Redémarrer Home Assistant",
    ha_reboot: "Redémarrer l'hôte",
    ha_reload_title: "Recharger la configuration ?",
    ha_reload_text: "Toute la configuration YAML que Home Assistant sait recharger (automatisations, scripts, scènes, modèles, groupes…) est relue, sans redémarrage.",
    ha_restart_title: "Redémarrer Home Assistant ?",
    ha_restart_text: "Home Assistant s'arrête puis redémarre : il est indisponible un moment et ses automatisations ne tournent pas pendant ce temps.",
    ha_reboot_title: "Redémarrer l'hôte ?",
    ha_reboot_text: "La machine qui fait tourner Home Assistant redémarre, avec Home Assistant et tous les add-ons : tout est indisponible quelques minutes.",
    ha_checking: "Vérification de la configuration…",
    ha_valid: "La configuration est valide.",
    ha_invalid: "La configuration n'est pas valide : corrigez-la avant de redémarrer.",
    ha_restarting: "Home Assistant redémarre…",
    ha_rebooting: "L'hôte redémarre…",
    sc_file_editor: "Éditeur de fichiers",
    sc_marketplace: "Marketplace",
    sc_settings: "Paramètres",
    sc_integrations: "Intégrations",
    sc_logs: "Journaux",
    sc_developer_tools: "Outils de développement",
    ha_cancel: "Annuler",
    ha_failed: "Échec : {error}",
  },
  de: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Datenträger",
    temperature: "Temp.",
    swap: "Swap",
    database: "Datenbank",
    network: "Netzwerk",
    storage: "Speicher",
    processes: "Prozesse",
    uptime: "Laufzeit:",
    load: "Last:",
    download: "Download",
    upload: "Upload",
    total: "Gesamt",
    used: "belegt",
    of: "von",
    hours: "Std.",
    days: "Tg.",
    minutes: "Min.",
    running: "Läuft",
    up_to_date: "Aktuell",
    update: "Update",
    no_sm: "Keine System Monitor-Entitäten gefunden. Ist die System Monitor-Integration installiert und sind ihre Sensoren aktiviert?",
    procs_ok: "Prozesse laufen",
    procs_one: "1 Prozess gestoppt",
    procs_many: "{n} Prozesse gestoppt",
    st_unknown: "Unbekannt",
    st_running: "Läuft",
    st_stopped_one: "1 gestoppt",
    st_stopped: "{n} gestoppt",
    zoom_in: "Vollständige Karte anzeigen",
    zoom_out: "Zurück zur kompakten Ansicht",
    title: "Titel (optional, standardmäßig Home Assistant)",
    show_system: "System anzeigen (CPU, RAM, Datenträger, Temperatur)",
    show_disk: "Festplattenanzeige anzeigen (auch unter Speicher)",
    show_title: "Titel anzeigen",
    show_subtitle: "Untertitel anzeigen",
    show_network: "Netzwerk anzeigen",
    show_history: "24-h-Verlauf anzeigen",
    cpu_warning: "CPU-Warnschwelle (%)",
    cpu_critical: "Kritische CPU-Schwelle (%)",
    ram_warning: "RAM-Warnschwelle (%)",
    ram_critical: "Kritische RAM-Schwelle (%)",
    disk_warning: "Datenträger-Warnschwelle (% belegt)",
    disk_critical: "Kritische Datenträgerschwelle (% belegt)",
    temp_warning: "Temperatur-Warnschwelle (°C)",
    temp_critical: "Kritische Temperaturschwelle (°C)",
    swap_warning: "Swap-Warnschwelle (% belegt)",
    swap_critical: "Kritische Swap-Schwelle (% belegt)",
    backup: "Backup",
    backup_none: "Noch kein Backup",
    backup_failed: "Letzter Versuch fehlgeschlagen",
    backup_running: "Backup läuft…",
    backup_next: "Nächstes {when}",
    show_backups: "Backups anzeigen",
    backup_warning: "Backup-Warnung (Tage ohne Backup)",
    backup_critical: "Backup kritisch (Tage ohne Backup)",
    show_storage: "Speicher anzeigen",
    show_processes: "Prozesse anzeigen",
    zoom: "Zoom-Schaltfläche",
    zoom_helper: "Schaltet zwischen kompakter und vollständiger Karte um",
    interface: "Netzwerkschnittstelle (optional, standardmäßig alle)",
    entities: "Sensoren Ihrer Wahl (statt der von System Monitor)",
    ent_processor_use: "CPU-Auslastung (%)",
    ent_processor_temperature: "CPU-Temperatur",
    ent_memory_use_percent: "RAM-Auslastung (%)",
    ent_swap_use_percent: "Swap-Auslastung (%)",
    ent_last_boot: "Letzter Start",
    language: "Sprache",
    lang_auto: "Automatisch",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Schaltflächen zum Neuladen und Neustarten anzeigen",
    show_actions_helper: "Nur für Administratoren. Der Neustart des Hosts erfordert Home Assistant OS oder Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Laufzeit anzeigen",
    show_load: "Last anzeigen",
    show_ip: "IP-Adresse anzeigen",
    tap_action: "Tippaktion",
    tap_action_helper: "Auf einer Anzeige, Kachel oder Zeile: die Details der Entität öffnen oder nichts (die Schaltflächen funktionieren weiterhin)",
    // gauge_style and the level colours (#131)
    gauge_style: "Systemanzeigen",
    gauge_ring: "Ringe",
    gauge_bar: "Zeilen mit Balken",
    ok_color: "Farbe der Normalstufe",
    warning_color: "Farbe der Warnstufe",
    critical_color: "Farbe der kritischen Stufe",
    ok_color_helper: "Eine Home-Assistant-Farbe oder eine beliebige CSS-Farbe; die Stufen folgen den Schwellen unten",
    ha_reload: "Konfiguration neu laden",
    ha_restart: "Home Assistant neu starten",
    ha_reboot: "Host neu starten",
    ha_reload_title: "Konfiguration neu laden?",
    ha_reload_text: "Jede YAML-Konfiguration, die Home Assistant neu laden kann (Automationen, Skripte, Szenen, Templates, Gruppen…), wird ohne Neustart neu eingelesen.",
    ha_restart_title: "Home Assistant neu starten?",
    ha_restart_text: "Home Assistant wird beendet und wieder gestartet: Es ist kurz nicht erreichbar und seine Automationen laufen in dieser Zeit nicht.",
    ha_reboot_title: "Host neu starten?",
    ha_reboot_text: "Der Rechner, auf dem Home Assistant läuft, startet neu, mit Home Assistant und allen Add-ons: Alles ist einige Minuten nicht erreichbar.",
    ha_checking: "Konfiguration wird geprüft…",
    ha_valid: "Die Konfiguration ist gültig.",
    ha_invalid: "Die Konfiguration ist ungültig: Bitte vor dem Neustart korrigieren.",
    ha_restarting: "Home Assistant wird neu gestartet…",
    ha_rebooting: "Der Host wird neu gestartet…",
    sc_file_editor: "Datei-Editor",
    sc_marketplace: "Marketplace",
    sc_settings: "Einstellungen",
    sc_integrations: "Integrationen",
    sc_logs: "Protokolle",
    sc_developer_tools: "Entwicklerwerkzeuge",
    ha_cancel: "Abbrechen",
    ha_failed: "Fehlgeschlagen: {error}",
  },
  es: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disco",
    temperature: "Temp.",
    swap: "Swap",
    database: "Base de datos",
    network: "Red",
    storage: "Almacenamiento",
    processes: "Procesos",
    uptime: "Activo desde hace",
    load: "Carga:",
    download: "Descarga",
    upload: "Subida",
    total: "Total",
    used: "usados",
    of: "de",
    hours: "h",
    days: "d",
    minutes: "min",
    running: "En ejecución",
    up_to_date: "Actualizado",
    update: "Actualización",
    no_sm: "No se encontraron entidades de System Monitor. ¿Está instalada la integración System Monitor y están activados sus sensores?",
    procs_ok: "Procesos en ejecución",
    procs_one: "1 proceso detenido",
    procs_many: "{n} procesos detenidos",
    st_unknown: "Desconocido",
    st_running: "En ejecución",
    st_stopped_one: "1 detenido",
    st_stopped: "{n} detenidos",
    zoom_in: "Mostrar la tarjeta completa",
    zoom_out: "Volver a la vista compacta",
    title: "Título (opcional, Home Assistant por defecto)",
    show_system: "Mostrar el sistema (CPU, RAM, disco, temperatura)",
    show_disk: "Mostrar el indicador del disco (también en Almacenamiento)",
    show_title: "Mostrar el título",
    show_subtitle: "Mostrar el subtítulo",
    show_network: "Mostrar la red",
    show_history: "Mostrar el historial de 24 h",
    cpu_warning: "Umbral de aviso de CPU (%)",
    cpu_critical: "Umbral crítico de CPU (%)",
    ram_warning: "Umbral de aviso de RAM (%)",
    ram_critical: "Umbral crítico de RAM (%)",
    disk_warning: "Umbral de aviso de disco (% usado)",
    disk_critical: "Umbral crítico de disco (% usado)",
    temp_warning: "Umbral de aviso de temperatura (°C)",
    temp_critical: "Umbral crítico de temperatura (°C)",
    swap_warning: "Umbral de aviso de swap (% usado)",
    swap_critical: "Umbral crítico de swap (% usado)",
    backup: "Copia de seguridad",
    backup_none: "Aún sin copia",
    backup_failed: "Último intento fallido",
    backup_running: "Copiando…",
    backup_next: "Próxima {when}",
    show_backups: "Mostrar las copias de seguridad",
    backup_warning: "Aviso de copia (días sin copia)",
    backup_critical: "Copia crítica (días sin copia)",
    show_storage: "Mostrar el almacenamiento",
    show_processes: "Mostrar los procesos",
    zoom: "Botón de zoom",
    zoom_helper: "Alterna entre la tarjeta completa y la vista compacta",
    interface: "Interfaz de red (opcional, todas por defecto)",
    entities: "Sensores a su elección (en lugar de los de System Monitor)",
    ent_processor_use: "Uso de CPU (%)",
    ent_processor_temperature: "Temperatura de la CPU",
    ent_memory_use_percent: "Uso de RAM (%)",
    ent_swap_use_percent: "Uso de swap (%)",
    ent_last_boot: "Último arranque",
    language: "Idioma",
    lang_auto: "Automático",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Mostrar los botones de recarga y reinicio",
    show_actions_helper: "Solo administradores. Reiniciar el host requiere Home Assistant OS o Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Mostrar el tiempo activo",
    show_load: "Mostrar la carga",
    show_ip: "Mostrar la dirección IP",
    tap_action: "Acción al tocar",
    tap_action_helper: "En un indicador, mosaico o línea: abrir los detalles de la entidad, o nada (los botones siguen funcionando)",
    // gauge_style and the level colours (#131)
    gauge_style: "Indicadores del sistema",
    gauge_ring: "Anillos",
    gauge_bar: "Líneas con barras",
    ok_color: "Color del nivel normal",
    warning_color: "Color del nivel de aviso",
    critical_color: "Color del nivel crítico",
    ok_color_helper: "Un color de Home Assistant o cualquier color CSS; los niveles siguen los umbrales de abajo",
    ha_reload: "Recargar la configuración",
    ha_restart: "Reiniciar Home Assistant",
    ha_reboot: "Reiniciar el host",
    ha_reload_title: "¿Recargar la configuración?",
    ha_reload_text: "Toda la configuración YAML que Home Assistant puede recargar (automatizaciones, scripts, escenas, plantillas, grupos…) se vuelve a leer, sin reiniciar.",
    ha_restart_title: "¿Reiniciar Home Assistant?",
    ha_restart_text: "Home Assistant se detiene y vuelve a arrancar: no estará disponible durante un momento y sus automatizaciones no se ejecutan mientras tanto.",
    ha_reboot_title: "¿Reiniciar el host?",
    ha_reboot_text: "La máquina que ejecuta Home Assistant se reinicia, con Home Assistant y todos los complementos: todo deja de estar disponible unos minutos.",
    ha_checking: "Comprobando la configuración…",
    ha_valid: "La configuración es válida.",
    ha_invalid: "La configuración no es válida: corrígela antes de reiniciar.",
    ha_restarting: "Home Assistant se está reiniciando…",
    ha_rebooting: "El host se está reiniciando…",
    sc_file_editor: "Editor de archivos",
    sc_marketplace: "Marketplace",
    sc_settings: "Ajustes",
    sc_integrations: "Integraciones",
    sc_logs: "Registros",
    sc_developer_tools: "Herramientas para desarrolladores",
    ha_cancel: "Cancelar",
    ha_failed: "Error: {error}",
  },
  sr: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Диск",
    temperature: "Темп.",
    swap: "Swap",
    database: "База података",
    network: "Мрежа",
    storage: "Складиште",
    processes: "Процеси",
    uptime: "Време рада:",
    load: "Оптерећење:",
    download: "Преузимање",
    upload: "Слање",
    total: "Укупно",
    used: "искоришћено",
    of: "од",
    hours: "h",
    days: "d",
    minutes: "min",
    running: "Покренуто",
    up_to_date: "Ажурирано",
    update: "Ажурирај",
    no_sm: "Нису пронађени ентитети за System Monitor. Да ли је интеграција System Monitor инсталирана и да ли су њени сензори омогућени?",
    procs_ok: "Процеси покренути",
    procs_one: "1 процес заустављен",
    procs_many: "Заустављени процеси: {n}",
    st_unknown: "Непознато",
    st_running: "Покренуто",
    st_stopped_one: "1 заустављен",
    st_stopped: "Заустављени: {n}",
    zoom_in: "Прикажи целу картицу",
    zoom_out: "Назад на компактни приказ",
    // Editor
    title: "Наслов (опционо, подразумевано је Home Assistant)",
    show_system: "Прикажи систем (CPU, RAM, диск, температура)",
    show_disk: "Прикажи мерач диска (и у Складишту)",
    show_title: "Прикажи наслов",
    show_subtitle: "Прикажи поднаслов",
    show_network: "Прикажи мрежу",
    show_history: "Прикажи историју за 24 ч",
    cpu_warning: "Праг упозорења ЦПУ (%)",
    cpu_critical: "Критични праг ЦПУ (%)",
    ram_warning: "Праг упозорења РАМ (%)",
    ram_critical: "Критични праг РАМ (%)",
    disk_warning: "Праг упозорења диска (% заузето)",
    disk_critical: "Критични праг диска (% заузето)",
    temp_warning: "Праг упозорења температуре (°)",
    temp_critical: "Критични праг температуре (°)",
    swap_warning: "Праг упозорења свопа (% заузето)",
    swap_critical: "Критични праг свопа (% заузето)",
    backup: "Резервна копија",
    backup_none: "Још нема копије",
    backup_failed: "Последњи покушај није успео",
    backup_running: "Прављење копије…",
    backup_next: "Следећа {when}",
    show_backups: "Прикажи резервне копије",
    backup_warning: "Упозорење за копију (дана без копије)",
    backup_critical: "Критично за копију (дана без копије)",
    show_storage: "Прикажи складиште",
    show_processes: "Прикажи процесе",
    zoom: "Дугме за увећање",
    zoom_helper: "Пребацује картицу на пун приказ и назад",
    interface: "Мрежни интерфејс (опционо, подразумевано сви)",
    entities: "Сензори по вашем избору (уместо оних из System Monitor-а)",
    ent_processor_use: "Искоришћеност процесора (%)",
    ent_processor_temperature: "Температура процесора",
    ent_memory_use_percent: "Искоришћеност RAM-а (%)",
    ent_swap_use_percent: "Искоришћеност swap-а (%)",
    ent_last_boot: "Последње покретање",
    language: "Језик",
    lang_auto: "Аутоматски",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Прикажи дугмад за поновно учитавање и рестарт",
    show_actions_helper: "Само за администраторе. Рестарт хоста захтева Home Assistant OS или Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Прикажи време рада",
    show_load: "Прикажи оптерећење",
    show_ip: "Прикажи IP адресу",
    tap_action: "Радња на додир",
    tap_action_helper: "На мерачу, плочици или реду: отвори детаље ентитета или ништа (дугмад и даље раде)",
    // gauge_style and the level colours (#131)
    gauge_style: "Мерачи система",
    gauge_ring: "Прстенови",
    gauge_bar: "Редови са тракама",
    ok_color: "Боја нормалног нивоа",
    warning_color: "Боја нивоа упозорења",
    critical_color: "Боја критичног нивоа",
    ok_color_helper: "Боја Home Assistant-а или било која CSS боја; нивои прате прагове испод",
    ha_reload: "Поново учитај конфигурацију",
    ha_restart: "Поново покрени Home Assistant",
    ha_reboot: "Рестартуј хост",
    ha_reload_title: "Поново учитати конфигурацију?",
    ha_reload_text: "Сва YAML конфигурација коју Home Assistant може поново да учита (аутоматизације, скрипте, сцене, шаблони, групе…) чита се поново, без поновног покретања.",
    ha_restart_title: "Поново покренути Home Assistant?",
    ha_restart_text: "Home Assistant се зауставља и поново покреће: на тренутак је недоступан и његове аутоматизације у међувремену не раде.",
    ha_reboot_title: "Рестартовати хост?",
    ha_reboot_text: "Рачунар на коме ради Home Assistant се поново покреће, заједно са Home Assistant-ом и свим додацима: све је недоступно неколико минута.",
    ha_checking: "Провера конфигурације…",
    ha_valid: "Конфигурација је исправна.",
    ha_invalid: "Конфигурација није исправна: исправите је пре поновног покретања.",
    ha_restarting: "Home Assistant се поново покреће…",
    ha_rebooting: "Хост се рестартује…",
    sc_file_editor: "Уређивач датотека",
    sc_marketplace: "Marketplace",
    sc_settings: "Подешавања",
    sc_integrations: "Интеграције",
    sc_logs: "Дневници",
    sc_developer_tools: "Алати за програмере",
    ha_cancel: "Откажи",
    ha_failed: "Неуспех: {error}",
  },
  "sr-Latn": {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disk",
    temperature: "Temp.",
    swap: "Swap",
    database: "Baza podataka",
    network: "Mreža",
    storage: "Skladište",
    processes: "Procesi",
    uptime: "Vreme rada:",
    load: "Opterećenje:",
    download: "Preuzimanje",
    upload: "Slanje",
    total: "Ukupno",
    used: "iskorišćeno",
    of: "od",
    hours: "h",
    days: "d",
    minutes: "min",
    running: "Pokrenuto",
    up_to_date: "Ažurirano",
    update: "Ažuriraj",
    no_sm: "Nisu pronađeni entiteti za System Monitor. Da li je integracija System Monitor instalirana i da li su njeni senzori omogućeni?",
    procs_ok: "Procesi pokrenuti",
    procs_one: "1 proces zaustavljen",
    procs_many: "Zaustavljeni procesi: {n}",
    st_unknown: "Nepoznato",
    st_running: "Pokrenuto",
    st_stopped_one: "1 zaustavljen",
    st_stopped: "Zaustavljeni: {n}",
    zoom_in: "Prikaži celu karticu",
    zoom_out: "Nazad na kompaktni prikaz",
    // Editor
    title: "Naslov (opciono, podrazumevano je Home Assistant)",
    show_system: "Prikaži sistem (CPU, RAM, disk, temperatura)",
    show_disk: "Prikaži merač diska (i u Skladištu)",
    show_title: "Prikaži naslov",
    show_subtitle: "Prikaži podnaslov",
    show_network: "Prikaži mrežu",
    show_history: "Prikaži istoriju za 24 č",
    cpu_warning: "Prag upozorenja CPU (%)",
    cpu_critical: "Kritični prag CPU (%)",
    ram_warning: "Prag upozorenja RAM (%)",
    ram_critical: "Kritični prag RAM (%)",
    disk_warning: "Prag upozorenja diska (% zauzeto)",
    disk_critical: "Kritični prag diska (% zauzeto)",
    temp_warning: "Prag upozorenja temperature (°C)",
    temp_critical: "Kritični prag temperature (°C)",
    swap_warning: "Prag upozorenja swapa (% zauzeto)",
    swap_critical: "Kritični prag swapa (% zauzeto)",
    backup: "Rezervna kopija",
    backup_none: "Još nema kopije",
    backup_failed: "Poslednji pokušaj nije uspeo",
    backup_running: "Pravljenje kopije…",
    backup_next: "Sledeća {when}",
    show_backups: "Prikaži rezervne kopije",
    backup_warning: "Upozorenje za kopiju (dana bez kopije)",
    backup_critical: "Kritično za kopiju (dana bez kopije)",
    show_storage: "Prikaži skladište",
    show_processes: "Prikaži procese",
    zoom: "Dugme za uvećanje",
    zoom_helper: "Prebacuje karticu na pun prikaz i nazad",
    interface: "Mrežni interfejs (opciono, podrazumevano svi)",
    entities: "Senzori po vašem izboru (umesto onih iz System Monitor-a)",
    ent_processor_use: "Iskorišćenost procesora (%)",
    ent_processor_temperature: "Temperatura procesora",
    ent_memory_use_percent: "Iskorišćenost RAM-a (%)",
    ent_swap_use_percent: "Iskorišćenost swap-a (%)",
    ent_last_boot: "Poslednje pokretanje",
    language: "Jezik",
    lang_auto: "Automatski",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Prikaži dugmad za ponovno učitavanje i restart",
    show_actions_helper: "Samo za administratore. Restart hosta zahteva Home Assistant OS ili Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Prikaži vreme rada",
    show_load: "Prikaži opterećenje",
    show_ip: "Prikaži IP adresu",
    tap_action: "Radnja na dodir",
    tap_action_helper: "Na meraču, pločici ili redu: otvori detalje entiteta ili ništa (dugmad i dalje rade)",
    // gauge_style and the level colours (#131)
    gauge_style: "Merači sistema",
    gauge_ring: "Prstenovi",
    gauge_bar: "Redovi sa trakama",
    ok_color: "Boja normalnog nivoa",
    warning_color: "Boja nivoa upozorenja",
    critical_color: "Boja kritičnog nivoa",
    ok_color_helper: "Boja Home Assistant-a ili bilo koja CSS boja; nivoi prate pragove ispod",
    ha_reload: "Ponovo učitaj konfiguraciju",
    ha_restart: "Ponovo pokreni Home Assistant",
    ha_reboot: "Restartuj host",
    ha_reload_title: "Ponovo učitati konfiguraciju?",
    ha_reload_text: "Sva YAML konfiguracija koju Home Assistant može ponovo da učita (automatizacije, skripte, scene, šabloni, grupe…) čita se ponovo, bez ponovnog pokretanja.",
    ha_restart_title: "Ponovo pokrenuti Home Assistant?",
    ha_restart_text: "Home Assistant se zaustavlja i ponovo pokreće: na trenutak je nedostupan i njegove automatizacije u međuvremenu ne rade.",
    ha_reboot_title: "Restartovati host?",
    ha_reboot_text: "Računar na kome radi Home Assistant se ponovo pokreće, zajedno sa Home Assistant-om i svim dodacima: sve je nedostupno nekoliko minuta.",
    ha_checking: "Provera konfiguracije…",
    ha_valid: "Konfiguracija je ispravna.",
    ha_invalid: "Konfiguracija nije ispravna: ispravite je pre ponovnog pokretanja.",
    ha_restarting: "Home Assistant se ponovo pokreće…",
    ha_rebooting: "Host se restartuje…",
    sc_file_editor: "Uređivač datoteka",
    sc_marketplace: "Marketplace",
    sc_settings: "Podešavanja",
    sc_integrations: "Integracije",
    sc_logs: "Dnevnici",
    sc_developer_tools: "Alati za programere",
    ha_cancel: "Otkaži",
    ha_failed: "Neuspeh: {error}",
  },
  it: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disco",
    temperature: "Temp.",
    swap: "Swap",
    database: "Database",
    network: "Rete",
    storage: "Archiviazione",
    processes: "Processi",
    uptime: "Tempo di attività:",
    load: "Carico:",
    download: "Download",
    upload: "Upload",
    total: "Totale",
    used: "usati",
    of: "di",
    hours: "h",
    days: "g",
    minutes: "min",
    running: "In esecuzione",
    up_to_date: "Aggiornato",
    update: "Update",
    no_sm: "Nessuna entità System Monitor trovata. L'integrazione System Monitor è installata e i suoi sensori sono abilitati?",
    procs_ok: "Processi in esecuzione",
    procs_one: "1 processo arrestato",
    procs_many: "{n} processi arrestati",
    st_unknown: "Sconosciuto",
    st_running: "In esecuzione",
    st_stopped_one: "1 arrestato",
    st_stopped: "{n} arrestati",
    zoom_in: "Mostra la scheda completa",
    zoom_out: "Torna alla vista compatta",
    // Editor
    title: "Titolo (facoltativo, predefinito: Home Assistant)",
    show_system: "Mostra il sistema (CPU, RAM, disco, temperatura)",
    show_disk: "Mostra l'indicatore del disco (anche in Archiviazione)",
    show_title: "Mostra il titolo",
    show_subtitle: "Mostra il sottotitolo",
    show_network: "Mostra la rete",
    show_history: "Mostra lo storico 24 h",
    cpu_warning: "Soglia di avviso CPU (%)",
    cpu_critical: "Soglia critica CPU (%)",
    ram_warning: "Soglia di avviso RAM (%)",
    ram_critical: "Soglia critica RAM (%)",
    disk_warning: "Soglia di avviso disco (% usato)",
    disk_critical: "Soglia critica disco (% usato)",
    temp_warning: "Soglia di avviso temperatura (°C)",
    temp_critical: "Soglia critica temperatura (°C)",
    swap_warning: "Soglia di avviso swap (% usato)",
    swap_critical: "Soglia critica swap (% usato)",
    backup: "Backup",
    backup_none: "Nessun backup",
    backup_failed: "Ultimo tentativo fallito",
    backup_running: "Backup in corso…",
    backup_next: "Prossimo {when}",
    show_backups: "Mostra i backup",
    backup_warning: "Avviso backup (giorni senza backup)",
    backup_critical: "Backup critico (giorni senza backup)",
    show_storage: "Mostra l'archiviazione",
    show_processes: "Mostra i processi",
    zoom: "Pulsante zoom",
    zoom_helper: "Passa alla scheda completa e viceversa",
    interface: "Interfaccia di rete (facoltativa, predefinito: tutte)",
    entities: "Sensori a scelta (al posto di quelli di System Monitor)",
    ent_processor_use: "Uso della CPU (%)",
    ent_processor_temperature: "Temperatura della CPU",
    ent_memory_use_percent: "Uso della RAM (%)",
    ent_swap_use_percent: "Uso dello swap (%)",
    ent_last_boot: "Ultimo avvio",
    language: "Lingua",
    lang_auto: "Automatico",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Mostra i pulsanti di ricarica e riavvio",
    show_actions_helper: "Solo amministratori. Il riavvio dell'host richiede Home Assistant OS o Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Mostra il tempo di attività",
    show_load: "Mostra il carico",
    show_ip: "Mostra l'indirizzo IP",
    tap_action: "Azione al tocco",
    tap_action_helper: "Su un indicatore, un riquadro o una riga: apre i dettagli dell'entità, o niente (i pulsanti funzionano comunque)",
    // gauge_style and the level colours (#131)
    gauge_style: "Indicatori di sistema",
    gauge_ring: "Anelli",
    gauge_bar: "Righe con barre",
    ok_color: "Colore del livello normale",
    warning_color: "Colore del livello di avviso",
    critical_color: "Colore del livello critico",
    ok_color_helper: "Un colore di Home Assistant o qualsiasi colore CSS; i livelli seguono le soglie qui sotto",
    ha_reload: "Ricarica la configurazione",
    ha_restart: "Riavvia Home Assistant",
    ha_reboot: "Riavvia l'host",
    ha_reload_title: "Ricaricare la configurazione?",
    ha_reload_text: "Tutta la configurazione YAML che Home Assistant può ricaricare (automazioni, script, scene, template, gruppi…) viene riletta, senza riavvio.",
    ha_restart_title: "Riavviare Home Assistant?",
    ha_restart_text: "Home Assistant si arresta e riparte: non è disponibile per un momento e le sue automazioni non vengono eseguite nel frattempo.",
    ha_reboot_title: "Riavviare l'host?",
    ha_reboot_text: "La macchina su cui gira Home Assistant si riavvia, con Home Assistant e tutti gli add-on: tutto resta non disponibile per qualche minuto.",
    ha_checking: "Verifica della configurazione…",
    ha_valid: "La configurazione è valida.",
    ha_invalid: "La configurazione non è valida: correggila prima di riavviare.",
    ha_restarting: "Home Assistant si sta riavviando…",
    ha_rebooting: "L'host si sta riavviando…",
    sc_file_editor: "Editor di file",
    sc_marketplace: "Marketplace",
    sc_settings: "Impostazioni",
    sc_integrations: "Integrazioni",
    sc_logs: "Registri",
    sc_developer_tools: "Strumenti per sviluppatori",
    ha_cancel: "Annulla",
    ha_failed: "Errore: {error}",
  },
  nl: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Schijf",
    temperature: "Temp.",
    swap: "Swap",
    database: "Database",
    network: "Netwerk",
    storage: "Opslag",
    processes: "Processen",
    uptime: "Uptime:",
    load: "Belasting:",
    download: "Download",
    upload: "Upload",
    total: "Totaal",
    used: "gebruikt",
    of: "van",
    hours: "u",
    days: "d",
    minutes: "min",
    running: "Actief",
    up_to_date: "Up-to-date",
    update: "Update",
    no_sm: "Geen System Monitor-entiteiten gevonden. Is de System Monitor-integratie geïnstalleerd en zijn de sensoren ingeschakeld?",
    procs_ok: "Processen actief",
    procs_one: "1 proces gestopt",
    procs_many: "{n} processen gestopt",
    st_unknown: "Onbekend",
    st_running: "Actief",
    st_stopped_one: "1 gestopt",
    st_stopped: "{n} gestopt",
    zoom_in: "Volledige kaart tonen",
    zoom_out: "Terug naar de compacte weergave",
    // Editor
    title: "Titel (optioneel, standaard Home Assistant)",
    show_system: "Systeem tonen (CPU, RAM, schijf, temperatuur)",
    show_disk: "Schijfmeter tonen (ook onder Opslag)",
    show_title: "Titel tonen",
    show_subtitle: "Ondertitel tonen",
    show_network: "Netwerk tonen",
    show_history: "24-uursgeschiedenis weergeven",
    cpu_warning: "Waarschuwingsdrempel CPU (%)",
    cpu_critical: "Kritieke drempel CPU (%)",
    ram_warning: "Waarschuwingsdrempel RAM (%)",
    ram_critical: "Kritieke drempel RAM (%)",
    disk_warning: "Waarschuwingsdrempel schijf (% gebruikt)",
    disk_critical: "Kritieke drempel schijf (% gebruikt)",
    temp_warning: "Waarschuwingsdrempel temperatuur (°C)",
    temp_critical: "Kritieke drempel temperatuur (°C)",
    swap_warning: "Waarschuwingsdrempel swap (% gebruikt)",
    swap_critical: "Kritieke drempel swap (% gebruikt)",
    backup: "Back-up",
    backup_none: "Nog geen back-up",
    backup_failed: "Laatste poging mislukt",
    backup_running: "Back-up bezig…",
    backup_next: "Volgende {when}",
    show_backups: "Back-ups tonen",
    backup_warning: "Back-upwaarschuwing (dagen zonder back-up)",
    backup_critical: "Back-up kritiek (dagen zonder back-up)",
    show_storage: "Opslag tonen",
    show_processes: "Processen tonen",
    zoom: "Zoomknop",
    zoom_helper: "Schakelt tussen de volledige kaart en de compacte weergave",
    interface: "Netwerkinterface (optioneel, standaard alle)",
    entities: "Sensoren naar keuze (in plaats van die van System Monitor)",
    ent_processor_use: "CPU-gebruik (%)",
    ent_processor_temperature: "CPU-temperatuur",
    ent_memory_use_percent: "RAM-gebruik (%)",
    ent_swap_use_percent: "Swap-gebruik (%)",
    ent_last_boot: "Laatste start",
    language: "Taal",
    lang_auto: "Automatisch",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Knoppen voor herladen en herstarten tonen",
    show_actions_helper: "Alleen beheerders. Het herstarten van de host vereist Home Assistant OS of Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Bedrijfstijd tonen",
    show_load: "Belasting tonen",
    show_ip: "IP-adres tonen",
    tap_action: "Tikactie",
    tap_action_helper: "Op een meter, tegel of regel: de details van de entiteit openen, of niets (de knoppen blijven werken)",
    // gauge_style and the level colours (#131)
    gauge_style: "Systeemmeters",
    gauge_ring: "Ringen",
    gauge_bar: "Regels met balken",
    ok_color: "Kleur van het normale niveau",
    warning_color: "Kleur van het waarschuwingsniveau",
    critical_color: "Kleur van het kritieke niveau",
    ok_color_helper: "Een Home Assistant-kleur of een willekeurige CSS-kleur; de niveaus volgen de drempels hieronder",
    ha_reload: "Configuratie herladen",
    ha_restart: "Home Assistant herstarten",
    ha_reboot: "Host herstarten",
    ha_reload_title: "Configuratie herladen?",
    ha_reload_text: "Alle YAML-configuratie die Home Assistant kan herladen (automatiseringen, scripts, scènes, sjablonen, groepen…) wordt opnieuw ingelezen, zonder herstart.",
    ha_restart_title: "Home Assistant herstarten?",
    ha_restart_text: "Home Assistant stopt en start opnieuw: het is even niet beschikbaar en de automatiseringen draaien in die tijd niet.",
    ha_reboot_title: "Host herstarten?",
    ha_reboot_text: "De machine waarop Home Assistant draait start opnieuw op, met Home Assistant en alle add-ons: alles is een paar minuten niet beschikbaar.",
    ha_checking: "Configuratie controleren…",
    ha_valid: "De configuratie is geldig.",
    ha_invalid: "De configuratie is ongeldig: corrigeer deze voor het herstarten.",
    ha_restarting: "Home Assistant wordt herstart…",
    ha_rebooting: "De host wordt herstart…",
    sc_file_editor: "Bestandseditor",
    sc_marketplace: "Marketplace",
    sc_settings: "Instellingen",
    sc_integrations: "Integraties",
    sc_logs: "Logboeken",
    sc_developer_tools: "Ontwikkelhulpmiddelen",
    ha_cancel: "Annuleren",
    ha_failed: "Mislukt: {error}",
  },
  pt: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disco",
    temperature: "Temp.",
    swap: "Swap",
    database: "Base de dados",
    network: "Rede",
    storage: "Armazenamento",
    processes: "Processos",
    uptime: "Tempo de atividade:",
    load: "Carga:",
    download: "Transferência",
    upload: "Envio",
    total: "Total",
    used: "usados",
    of: "de",
    hours: "h",
    days: "d",
    minutes: "min",
    running: "Em execução",
    up_to_date: "Atualizado",
    update: "Atualização",
    no_sm: "Nenhuma entidade do System Monitor encontrada. A integração System Monitor está instalada e os respetivos sensores estão ativados?",
    procs_ok: "Processos em execução",
    procs_one: "1 processo parado",
    procs_many: "{n} processos parados",
    st_unknown: "Desconhecido",
    st_running: "Em execução",
    st_stopped_one: "1 parado",
    st_stopped: "{n} parados",
    zoom_in: "Mostrar o cartão completo",
    zoom_out: "Voltar à vista compacta",
    // Editor
    title: "Título (opcional, Home Assistant por predefinição)",
    show_system: "Mostrar o sistema (CPU, RAM, disco, temperatura)",
    show_disk: "Mostrar o indicador do disco (também em Armazenamento)",
    show_title: "Mostrar o título",
    show_subtitle: "Mostrar o subtítulo",
    show_network: "Mostrar a rede",
    show_history: "Mostrar o histórico de 24 h",
    cpu_warning: "Limiar de aviso da CPU (%)",
    cpu_critical: "Limiar crítico da CPU (%)",
    ram_warning: "Limiar de aviso da RAM (%)",
    ram_critical: "Limiar crítico da RAM (%)",
    disk_warning: "Limiar de aviso do disco (% usado)",
    disk_critical: "Limiar crítico do disco (% usado)",
    temp_warning: "Limiar de aviso de temperatura (°C)",
    temp_critical: "Limiar crítico de temperatura (°C)",
    swap_warning: "Limiar de aviso do swap (% usado)",
    swap_critical: "Limiar crítico do swap (% usado)",
    backup: "Cópia de segurança",
    backup_none: "Ainda sem cópia",
    backup_failed: "Última tentativa falhou",
    backup_running: "A copiar…",
    backup_next: "Próxima {when}",
    show_backups: "Mostrar as cópias de segurança",
    backup_warning: "Aviso de cópia (dias sem cópia)",
    backup_critical: "Cópia crítica (dias sem cópia)",
    show_storage: "Mostrar o armazenamento",
    show_processes: "Mostrar os processos",
    zoom: "Botão de zoom",
    zoom_helper: "Alterna entre o cartão completo e a vista compacta",
    interface: "Interface de rede (opcional, todas por predefinição)",
    entities: "Sensores à sua escolha (em vez dos do System Monitor)",
    ent_processor_use: "Utilização da CPU (%)",
    ent_processor_temperature: "Temperatura da CPU",
    ent_memory_use_percent: "Utilização da RAM (%)",
    ent_swap_use_percent: "Utilização do swap (%)",
    ent_last_boot: "Último arranque",
    language: "Idioma",
    lang_auto: "Automático",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Mostrar os botões de recarregar e reiniciar",
    show_actions_helper: "Apenas administradores. Reiniciar o anfitrião requer o Home Assistant OS ou Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Mostrar o tempo de atividade",
    show_load: "Mostrar a carga",
    show_ip: "Mostrar o endereço IP",
    tap_action: "Ação ao tocar",
    tap_action_helper: "Num indicador, mosaico ou linha: abrir os detalhes da entidade, ou nada (os botões continuam a funcionar)",
    // gauge_style and the level colours (#131)
    gauge_style: "Indicadores do sistema",
    gauge_ring: "Anéis",
    gauge_bar: "Linhas com barras",
    ok_color: "Cor do nível normal",
    warning_color: "Cor do nível de aviso",
    critical_color: "Cor do nível crítico",
    ok_color_helper: "Uma cor do Home Assistant ou qualquer cor CSS; os níveis seguem os limiares abaixo",
    ha_reload: "Recarregar a configuração",
    ha_restart: "Reiniciar o Home Assistant",
    ha_reboot: "Reiniciar o anfitrião",
    ha_reload_title: "Recarregar a configuração?",
    ha_reload_text: "Toda a configuração YAML que o Home Assistant consegue recarregar (automações, scripts, cenas, modelos, grupos…) é lida de novo, sem reiniciar.",
    ha_restart_title: "Reiniciar o Home Assistant?",
    ha_restart_text: "O Home Assistant para e volta a arrancar: fica indisponível por um momento e as suas automações não são executadas entretanto.",
    ha_reboot_title: "Reiniciar o anfitrião?",
    ha_reboot_text: "A máquina onde corre o Home Assistant reinicia, com o Home Assistant e todos os add-ons: tudo fica indisponível durante alguns minutos.",
    ha_checking: "A verificar a configuração…",
    ha_valid: "A configuração é válida.",
    ha_invalid: "A configuração não é válida: corrija-a antes de reiniciar.",
    ha_restarting: "O Home Assistant está a reiniciar…",
    ha_rebooting: "O anfitrião está a reiniciar…",
    sc_file_editor: "Editor de ficheiros",
    sc_marketplace: "Marketplace",
    sc_settings: "Definições",
    sc_integrations: "Integrações",
    sc_logs: "Registos",
    sc_developer_tools: "Ferramentas de programador",
    ha_cancel: "Cancelar",
    ha_failed: "Falhou: {error}",
  },
  pl: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Dysk",
    temperature: "Temp.",
    swap: "Swap",
    database: "Baza danych",
    network: "Sieć",
    storage: "Pamięć masowa",
    processes: "Procesy",
    uptime: "Czas pracy:",
    load: "Obciążenie:",
    download: "Pobieranie",
    upload: "Wysyłanie",
    total: "Łącznie",
    used: "użyte",
    of: "z",
    hours: "godz.",
    days: "d",
    minutes: "min",
    running: "Działa",
    up_to_date: "Aktualne",
    update: "Aktualizacja",
    no_sm: "Nie znaleziono encji System Monitor. Czy integracja System Monitor jest zainstalowana, a jej sensory włączone?",
    procs_ok: "Procesy działają",
    procs_one: "1 proces zatrzymany",
    procs_many: "Zatrzymane procesy: {n}",
    st_unknown: "Nieznany",
    st_running: "Działa",
    st_stopped_one: "1 zatrzymany",
    st_stopped: "Zatrzymane: {n}",
    zoom_in: "Pokaż pełną kartę",
    zoom_out: "Wróć do widoku kompaktowego",
    // Editor
    title: "Tytuł (opcjonalny, domyślnie Home Assistant)",
    show_system: "Pokaż system (CPU, RAM, dysk, temperatura)",
    show_disk: "Pokaż wskaźnik dysku (także w Pamięci)",
    show_title: "Pokaż tytuł",
    show_subtitle: "Pokaż podtytuł",
    show_network: "Pokaż sieć",
    show_history: "Pokaż historię z 24 h",
    cpu_warning: "Próg ostrzeżenia CPU (%)",
    cpu_critical: "Próg krytyczny CPU (%)",
    ram_warning: "Próg ostrzeżenia RAM (%)",
    ram_critical: "Próg krytyczny RAM (%)",
    disk_warning: "Próg ostrzeżenia dysku (% zajęte)",
    disk_critical: "Próg krytyczny dysku (% zajęte)",
    temp_warning: "Próg ostrzeżenia temperatury (°C)",
    temp_critical: "Próg krytyczny temperatury (°C)",
    swap_warning: "Próg ostrzeżenia swap (% zajęte)",
    swap_critical: "Próg krytyczny swap (% zajęte)",
    backup: "Kopia zapasowa",
    backup_none: "Brak kopii",
    backup_failed: "Ostatnia próba nieudana",
    backup_running: "Tworzenie kopii…",
    backup_next: "Następna {when}",
    show_backups: "Pokaż kopie zapasowe",
    backup_warning: "Ostrzeżenie kopii (dni bez kopii)",
    backup_critical: "Kopia krytyczna (dni bez kopii)",
    show_storage: "Pokaż pamięć masową",
    show_processes: "Pokaż procesy",
    zoom: "Przycisk powiększenia",
    zoom_helper: "Przełącza między pełną kartą a widokiem kompaktowym",
    interface: "Interfejs sieciowy (opcjonalny, domyślnie wszystkie)",
    entities: "Wybrane czujniki (zamiast tych z System Monitor)",
    ent_processor_use: "Użycie procesora (%)",
    ent_processor_temperature: "Temperatura procesora",
    ent_memory_use_percent: "Użycie RAM (%)",
    ent_swap_use_percent: "Użycie swap (%)",
    ent_last_boot: "Ostatnie uruchomienie",
    language: "Język",
    lang_auto: "Automatycznie",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Pokaż przyciski przeładowania i ponownego uruchomienia",
    show_actions_helper: "Tylko administratorzy. Ponowne uruchomienie hosta wymaga Home Assistant OS lub Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Pokaż czas działania",
    show_load: "Pokaż obciążenie",
    show_ip: "Pokaż adres IP",
    tap_action: "Akcja dotknięcia",
    tap_action_helper: "Na wskaźniku, kafelku lub wierszu: otwórz szczegóły encji albo nic (przyciski nadal działają)",
    // gauge_style and the level colours (#131)
    gauge_style: "Wskaźniki systemu",
    gauge_ring: "Pierścienie",
    gauge_bar: "Wiersze z paskami",
    ok_color: "Kolor poziomu normalnego",
    warning_color: "Kolor poziomu ostrzeżenia",
    critical_color: "Kolor poziomu krytycznego",
    ok_color_helper: "Kolor Home Assistant lub dowolny kolor CSS; poziomy wynikają z progów poniżej",
    ha_reload: "Przeładuj konfigurację",
    ha_restart: "Uruchom ponownie Home Assistant",
    ha_reboot: "Uruchom ponownie hosta",
    ha_reload_title: "Przeładować konfigurację?",
    ha_reload_text: "Cała konfiguracja YAML, którą Home Assistant potrafi przeładować (automatyzacje, skrypty, sceny, szablony, grupy…), zostanie wczytana ponownie, bez restartu.",
    ha_restart_title: "Uruchomić ponownie Home Assistant?",
    ha_restart_text: "Home Assistant zatrzyma się i uruchomi ponownie: przez chwilę będzie niedostępny, a jego automatyzacje w tym czasie nie działają.",
    ha_reboot_title: "Uruchomić ponownie hosta?",
    ha_reboot_text: "Komputer, na którym działa Home Assistant, uruchamia się ponownie wraz z Home Assistant i wszystkimi dodatkami: wszystko jest niedostępne przez kilka minut.",
    ha_checking: "Sprawdzanie konfiguracji…",
    ha_valid: "Konfiguracja jest poprawna.",
    ha_invalid: "Konfiguracja jest niepoprawna: popraw ją przed ponownym uruchomieniem.",
    ha_restarting: "Home Assistant uruchamia się ponownie…",
    ha_rebooting: "Host uruchamia się ponownie…",
    sc_file_editor: "Edytor plików",
    sc_marketplace: "Marketplace",
    sc_settings: "Ustawienia",
    sc_integrations: "Integracje",
    sc_logs: "Logi",
    sc_developer_tools: "Narzędzia deweloperskie",
    ha_cancel: "Anuluj",
    ha_failed: "Błąd: {error}",
  },
  ro: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disc",
    temperature: "Temp.",
    swap: "Swap",
    database: "Bază de date",
    network: "Rețea",
    storage: "Stocare",
    processes: "Procese",
    uptime: "Timp de funcționare:",
    load: "Sarcină:",
    download: "Descărcare",
    upload: "Încărcare",
    total: "Total",
    used: "utilizați",
    of: "din",
    hours: "h",
    days: "z",
    minutes: "min",
    running: "Rulează",
    up_to_date: "La zi",
    update: "Actualizare",
    no_sm: "Nu s-au găsit entități System Monitor. Integrarea System Monitor este instalată și senzorii ei sunt activați?",
    procs_ok: "Procese în execuție",
    procs_one: "1 proces oprit",
    procs_many: "Procese oprite: {n}",
    st_unknown: "Necunoscut",
    st_running: "Rulează",
    st_stopped_one: "1 oprit",
    st_stopped: "Oprite: {n}",
    zoom_in: "Afișează cardul complet",
    zoom_out: "Înapoi la vizualizarea compactă",
    // Editor
    title: "Titlu (opțional, implicit Home Assistant)",
    show_system: "Afișează sistemul (CPU, RAM, disc, temperatură)",
    show_disk: "Afișează indicatorul discului (și în Stocare)",
    show_title: "Afișează titlul",
    show_subtitle: "Afișează subtitlul",
    show_network: "Afișează rețeaua",
    show_history: "Afișează istoricul pe 24 h",
    cpu_warning: "Prag de avertizare CPU (%)",
    cpu_critical: "Prag critic CPU (%)",
    ram_warning: "Prag de avertizare RAM (%)",
    ram_critical: "Prag critic RAM (%)",
    disk_warning: "Prag de avertizare disc (% utilizat)",
    disk_critical: "Prag critic disc (% utilizat)",
    temp_warning: "Prag de avertizare temperatură (°C)",
    temp_critical: "Prag critic temperatură (°C)",
    swap_warning: "Prag de avertizare swap (% utilizat)",
    swap_critical: "Prag critic swap (% utilizat)",
    backup: "Copie de rezervă",
    backup_none: "Nicio copie încă",
    backup_failed: "Ultima încercare a eșuat",
    backup_running: "Se face copia…",
    backup_next: "Următoarea {when}",
    show_backups: "Afișează copiile de rezervă",
    backup_warning: "Avertizare copie (zile fără copie)",
    backup_critical: "Copie critică (zile fără copie)",
    show_storage: "Afișează stocarea",
    show_processes: "Afișează procesele",
    zoom: "Buton de zoom",
    zoom_helper: "Comută între cardul complet și vizualizarea compactă",
    interface: "Interfață de rețea (opțional, implicit toate)",
    entities: "Senzori la alegere (în locul celor din System Monitor)",
    ent_processor_use: "Utilizare procesor (%)",
    ent_processor_temperature: "Temperatura procesorului",
    ent_memory_use_percent: "Utilizare RAM (%)",
    ent_swap_use_percent: "Utilizare swap (%)",
    ent_last_boot: "Ultima pornire",
    language: "Limbă",
    lang_auto: "Automat",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Afișează butoanele de reîncărcare și repornire",
    show_actions_helper: "Doar administratori. Repornirea gazdei necesită Home Assistant OS sau Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Afișează timpul de funcționare",
    show_load: "Afișează încărcarea",
    show_ip: "Afișează adresa IP",
    tap_action: "Acțiune la atingere",
    tap_action_helper: "Pe un indicator, o placă sau un rând: deschide detaliile entității sau nimic (butoanele funcționează în continuare)",
    // gauge_style and the level colours (#131)
    gauge_style: "Indicatoare de sistem",
    gauge_ring: "Inele",
    gauge_bar: "Rânduri cu bare",
    ok_color: "Culoarea nivelului normal",
    warning_color: "Culoarea nivelului de avertizare",
    critical_color: "Culoarea nivelului critic",
    ok_color_helper: "O culoare Home Assistant sau orice culoare CSS; nivelurile urmează pragurile de mai jos",
    ha_reload: "Reîncarcă configurația",
    ha_restart: "Repornește Home Assistant",
    ha_reboot: "Repornește gazda",
    ha_reload_title: "Reîncărcați configurația?",
    ha_reload_text: "Toată configurația YAML pe care Home Assistant o poate reîncărca (automatizări, scripturi, scene, șabloane, grupuri…) este citită din nou, fără repornire.",
    ha_restart_title: "Reporniți Home Assistant?",
    ha_restart_text: "Home Assistant se oprește și pornește din nou: este indisponibil pentru un moment, iar automatizările sale nu rulează între timp.",
    ha_reboot_title: "Repornești gazda?",
    ha_reboot_text: "Mașina pe care rulează Home Assistant repornește, cu Home Assistant și toate suplimentele: totul este indisponibil câteva minute.",
    ha_checking: "Se verifică configurația…",
    ha_valid: "Configurația este validă.",
    ha_invalid: "Configurația nu este validă: corectați-o înainte de repornire.",
    ha_restarting: "Home Assistant repornește…",
    ha_rebooting: "Gazda repornește…",
    sc_file_editor: "Editor de fișiere",
    sc_marketplace: "Marketplace",
    sc_settings: "Setări",
    sc_integrations: "Integrări",
    sc_logs: "Jurnale",
    sc_developer_tools: "Instrumente pentru dezvoltatori",
    ha_cancel: "Anulează",
    ha_failed: "Eșuat: {error}",
  },
  da: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disk",
    temperature: "Temp.",
    swap: "Swap",
    database: "Database",
    network: "Netværk",
    storage: "Lager",
    processes: "Processer",
    uptime: "Oppetid:",
    load: "Belastning:",
    download: "Download",
    upload: "Upload",
    total: "I alt",
    used: "brugt",
    of: "af",
    hours: "t",
    days: "d",
    minutes: "min",
    running: "Kører",
    up_to_date: "Opdateret",
    update: "Opdatering",
    no_sm: "Ingen System Monitor-entiteter fundet. Er System Monitor-integrationen installeret, og er dens sensorer aktiveret?",
    procs_ok: "Processer kører",
    procs_one: "1 proces stoppet",
    procs_many: "{n} processer stoppet",
    st_unknown: "Ukendt",
    st_running: "Kører",
    st_stopped_one: "1 stoppet",
    st_stopped: "{n} stoppet",
    zoom_in: "Vis hele kortet",
    zoom_out: "Tilbage til kompakt visning",
    // Editor
    title: "Titel (valgfri, Home Assistant som standard)",
    show_system: "Vis system (CPU, RAM, disk, temperatur)",
    show_disk: "Vis diskmåleren (også under Lager)",
    show_title: "Vis titel",
    show_subtitle: "Vis undertitel",
    show_network: "Vis netværk",
    show_history: "Vis 24-timers historik",
    cpu_warning: "Advarselsgrænse for CPU (%)",
    cpu_critical: "Kritisk grænse for CPU (%)",
    ram_warning: "Advarselsgrænse for RAM (%)",
    ram_critical: "Kritisk grænse for RAM (%)",
    disk_warning: "Advarselsgrænse for disk (% brugt)",
    disk_critical: "Kritisk grænse for disk (% brugt)",
    temp_warning: "Advarselsgrænse for temperatur (°C)",
    temp_critical: "Kritisk grænse for temperatur (°C)",
    swap_warning: "Advarselsgrænse for swap (% brugt)",
    swap_critical: "Kritisk grænse for swap (% brugt)",
    backup: "Backup",
    backup_none: "Ingen backup endnu",
    backup_failed: "Seneste forsøg mislykkedes",
    backup_running: "Tager backup…",
    backup_next: "Næste {when}",
    show_backups: "Vis backups",
    backup_warning: "Backup-advarsel (dage uden backup)",
    backup_critical: "Backup kritisk (dage uden backup)",
    show_storage: "Vis lager",
    show_processes: "Vis processer",
    zoom: "Zoomknap",
    zoom_helper: "Skifter mellem hele kortet og kompakt visning",
    interface: "Netværksinterface (valgfrit, alle som standard)",
    entities: "Sensorer efter eget valg (i stedet for System Monitors)",
    ent_processor_use: "CPU-forbrug (%)",
    ent_processor_temperature: "CPU-temperatur",
    ent_memory_use_percent: "RAM-forbrug (%)",
    ent_swap_use_percent: "Swap-forbrug (%)",
    ent_last_boot: "Seneste opstart",
    language: "Sprog",
    lang_auto: "Automatisk",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Vis knapperne til genindlæsning og genstart",
    show_actions_helper: "Kun administratorer. Genstart af værten kræver Home Assistant OS eller Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Vis oppetid",
    show_load: "Vis belastning",
    show_ip: "Vis IP-adresse",
    tap_action: "Tryk-handling",
    tap_action_helper: "På en måler, et felt eller en linje: åbn enhedens detaljer eller intet (knapperne virker stadig)",
    // gauge_style and the level colours (#131)
    gauge_style: "Systemmålere",
    gauge_ring: "Ringe",
    gauge_bar: "Linjer med bjælker",
    ok_color: "Farve for normalt niveau",
    warning_color: "Farve for advarselsniveau",
    critical_color: "Farve for kritisk niveau",
    ok_color_helper: "En Home Assistant-farve eller en vilkårlig CSS-farve; niveauerne følger tærsklerne nedenfor",
    ha_reload: "Genindlæs konfiguration",
    ha_restart: "Genstart Home Assistant",
    ha_reboot: "Genstart værten",
    ha_reload_title: "Genindlæs konfigurationen?",
    ha_reload_text: "Al YAML-konfiguration, som Home Assistant kan genindlæse (automatiseringer, scripts, scener, skabeloner, grupper…), læses igen uden genstart.",
    ha_restart_title: "Genstart Home Assistant?",
    ha_restart_text: "Home Assistant stopper og starter igen: det er utilgængeligt et øjeblik, og dets automatiseringer kører ikke imens.",
    ha_reboot_title: "Genstart værten?",
    ha_reboot_text: "Maskinen, der kører Home Assistant, genstarter med Home Assistant og alle tilføjelser: alt er utilgængeligt i et par minutter.",
    ha_checking: "Kontrollerer konfigurationen…",
    ha_valid: "Konfigurationen er gyldig.",
    ha_invalid: "Konfigurationen er ugyldig: ret den før genstart.",
    ha_restarting: "Home Assistant genstarter…",
    ha_rebooting: "Værten genstarter…",
    sc_file_editor: "Fileditor",
    sc_marketplace: "Marketplace",
    sc_settings: "Indstillinger",
    sc_integrations: "Integrationer",
    sc_logs: "Logfiler",
    sc_developer_tools: "Udviklerværktøjer",
    ha_cancel: "Annuller",
    ha_failed: "Mislykkedes: {error}",
  },
  sv: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disk",
    temperature: "Temp.",
    swap: "Swap",
    database: "Databas",
    network: "Nätverk",
    storage: "Lagring",
    processes: "Processer",
    uptime: "Drifttid:",
    load: "Belastning:",
    download: "Mottagning",
    upload: "Sändning",
    total: "Totalt",
    used: "använt",
    of: "av",
    hours: "h",
    days: "d",
    minutes: "min",
    running: "Körs",
    up_to_date: "Uppdaterad",
    update: "Uppdatering",
    no_sm: "Inga System Monitor-entiteter hittades. Är System Monitor-integrationen installerad och är dess sensorer aktiverade?",
    procs_ok: "Processer körs",
    procs_one: "1 process stoppad",
    procs_many: "{n} processer stoppade",
    st_unknown: "Okänd",
    st_running: "Körs",
    st_stopped_one: "1 stoppad",
    st_stopped: "{n} stoppade",
    zoom_in: "Visa hela kortet",
    zoom_out: "Tillbaka till kompakt vy",
    // Editor
    title: "Titel (valfri, Home Assistant som standard)",
    show_system: "Visa system (CPU, RAM, disk, temperatur)",
    show_disk: "Visa diskmätaren (även under Lagring)",
    show_title: "Visa rubrik",
    show_subtitle: "Visa underrubrik",
    show_network: "Visa nätverk",
    show_history: "Visa 24 h-historik",
    cpu_warning: "Varningsgräns för CPU (%)",
    cpu_critical: "Kritisk gräns för CPU (%)",
    ram_warning: "Varningsgräns för RAM (%)",
    ram_critical: "Kritisk gräns för RAM (%)",
    disk_warning: "Varningsgräns för disk (% använt)",
    disk_critical: "Kritisk gräns för disk (% använt)",
    temp_warning: "Varningsgräns för temperatur (°C)",
    temp_critical: "Kritisk gräns för temperatur (°C)",
    swap_warning: "Varningsgräns för swap (% använt)",
    swap_critical: "Kritisk gräns för swap (% använt)",
    backup: "Säkerhetskopia",
    backup_none: "Ingen säkerhetskopia än",
    backup_failed: "Senaste försöket misslyckades",
    backup_running: "Säkerhetskopierar…",
    backup_next: "Nästa {when}",
    show_backups: "Visa säkerhetskopior",
    backup_warning: "Varning säkerhetskopia (dagar utan)",
    backup_critical: "Kritisk säkerhetskopia (dagar utan)",
    show_storage: "Visa lagring",
    show_processes: "Visa processer",
    zoom: "Zoomknapp",
    zoom_helper: "Växlar mellan hela kortet och kompakt vy",
    interface: "Nätverksgränssnitt (valfritt, alla som standard)",
    entities: "Valfria sensorer (i stället för System Monitors)",
    ent_processor_use: "CPU-användning (%)",
    ent_processor_temperature: "CPU-temperatur",
    ent_memory_use_percent: "RAM-användning (%)",
    ent_swap_use_percent: "Swap-användning (%)",
    ent_last_boot: "Senaste start",
    language: "Språk",
    lang_auto: "Automatiskt",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Visa knapparna för omläsning och omstart",
    show_actions_helper: "Endast administratörer. Omstart av värden kräver Home Assistant OS eller Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Visa drifttid",
    show_load: "Visa belastning",
    show_ip: "Visa IP-adress",
    tap_action: "Tryckåtgärd",
    tap_action_helper: "På en mätare, en ruta eller en rad: öppna entitetens detaljer eller ingenting (knapparna fungerar fortfarande)",
    // gauge_style and the level colours (#131)
    gauge_style: "Systemmätare",
    gauge_ring: "Ringar",
    gauge_bar: "Rader med staplar",
    ok_color: "Färg för normal nivå",
    warning_color: "Färg för varningsnivå",
    critical_color: "Färg för kritisk nivå",
    ok_color_helper: "En Home Assistant-färg eller valfri CSS-färg; nivåerna följer tröskelvärdena nedan",
    ha_reload: "Läs om konfigurationen",
    ha_restart: "Starta om Home Assistant",
    ha_reboot: "Starta om värden",
    ha_reload_title: "Läsa om konfigurationen?",
    ha_reload_text: "All YAML-konfiguration som Home Assistant kan läsa om (automationer, skript, scener, mallar, grupper…) läses in igen, utan omstart.",
    ha_restart_title: "Starta om Home Assistant?",
    ha_restart_text: "Home Assistant stoppas och startar igen: det är otillgängligt en stund och dess automationer körs inte under tiden.",
    ha_reboot_title: "Starta om värden?",
    ha_reboot_text: "Datorn som kör Home Assistant startar om, med Home Assistant och alla tillägg: allt är otillgängligt i några minuter.",
    ha_checking: "Kontrollerar konfigurationen…",
    ha_valid: "Konfigurationen är giltig.",
    ha_invalid: "Konfigurationen är ogiltig: rätta den innan omstart.",
    ha_restarting: "Home Assistant startar om…",
    ha_rebooting: "Värden startar om…",
    sc_file_editor: "Filredigerare",
    sc_marketplace: "Marketplace",
    sc_settings: "Inställningar",
    sc_integrations: "Integrationer",
    sc_logs: "Loggar",
    sc_developer_tools: "Utvecklarverktyg",
    ha_cancel: "Avbryt",
    ha_failed: "Misslyckades: {error}",
  },
  bg: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Диск",
    temperature: "Темп.",
    swap: "Swap",
    database: "База данни",
    network: "Мрежа",
    storage: "Хранилище",
    processes: "Процеси",
    uptime: "Време на работа:",
    load: "Натоварване:",
    download: "Изтегляне",
    upload: "Качване",
    total: "Общо",
    used: "използвани",
    of: "от",
    hours: "ч",
    days: "д",
    minutes: "мин",
    running: "Работи",
    up_to_date: "Актуално",
    update: "Нова версия",
    no_sm: "Не са открити обекти на System Monitor. Инсталирана ли е интеграцията System Monitor и активирани ли са сензорите ѝ?",
    procs_ok: "Процесите работят",
    procs_one: "1 спрян процес",
    procs_many: "{n} спрени процеса",
    st_unknown: "Неизвестно",
    st_running: "Работи",
    st_stopped_one: "1 спрян",
    st_stopped: "{n} спрени",
    zoom_in: "Показване на цялата карта",
    zoom_out: "Обратно към компактния изглед",
    // Editor
    title: "Заглавие (по избор, по подразбиране Home Assistant)",
    show_system: "Показване на системата (CPU, RAM, диск, температура)",
    show_disk: "Показване на индикатора на диска (и в Хранилище)",
    show_title: "Показване на заглавието",
    show_subtitle: "Показване на подзаглавието",
    show_network: "Показване на мрежата",
    show_history: "Показване на 24-часовата история",
    cpu_warning: "Праг за предупреждение за CPU (%)",
    cpu_critical: "Критичен праг за CPU (%)",
    ram_warning: "Праг за предупреждение за RAM (%)",
    ram_critical: "Критичен праг за RAM (%)",
    disk_warning: "Праг за предупреждение за диска (% заето)",
    disk_critical: "Критичен праг за диска (% заето)",
    temp_warning: "Праг за предупреждение за температура (°C)",
    temp_critical: "Критичен праг за температура (°C)",
    swap_warning: "Праг за предупреждение за swap (% заето)",
    swap_critical: "Критичен праг за swap (% заето)",
    backup: "Резервно копие",
    backup_none: "Още няма копие",
    backup_failed: "Последният опит е неуспешен",
    backup_running: "Създава се копие…",
    backup_next: "Следващо {when}",
    show_backups: "Показване на резервните копия",
    backup_warning: "Предупреждение за копие (дни без копие)",
    backup_critical: "Критично за копие (дни без копие)",
    show_storage: "Показване на хранилището",
    show_processes: "Показване на процесите",
    zoom: "Бутон за мащабиране",
    zoom_helper: "Превключва между цялата карта и компактния изглед",
    interface: "Мрежов интерфейс (по избор, по подразбиране всички)",
    entities: "Сензори по ваш избор (вместо тези на System Monitor)",
    ent_processor_use: "Натоварване на процесора (%)",
    ent_processor_temperature: "Температура на процесора",
    ent_memory_use_percent: "Използване на RAM (%)",
    ent_swap_use_percent: "Използване на swap (%)",
    ent_last_boot: "Последно стартиране",
    language: "Език",
    lang_auto: "Автоматично",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Показване на бутоните за презареждане и рестартиране",
    show_actions_helper: "Само за администратори. Рестартирането на хоста изисква Home Assistant OS или Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Показване на времето на работа",
    show_load: "Показване на натоварването",
    show_ip: "Показване на IP адреса",
    tap_action: "Действие при докосване",
    tap_action_helper: "При индикатор, плочка или ред: отваряне на подробностите за обекта или нищо (бутоните продължават да работят)",
    // gauge_style and the level colours (#131)
    gauge_style: "Системни индикатори",
    gauge_ring: "Пръстени",
    gauge_bar: "Редове с ленти",
    ok_color: "Цвят на нормалното ниво",
    warning_color: "Цвят на нивото на предупреждение",
    critical_color: "Цвят на критичното ниво",
    ok_color_helper: "Цвят на Home Assistant или произволен CSS цвят; нивата следват праговете по-долу",
    ha_reload: "Презареждане на конфигурацията",
    ha_restart: "Рестартиране на Home Assistant",
    ha_reboot: "Рестартиране на хоста",
    ha_reload_title: "Презареждане на конфигурацията?",
    ha_reload_text: "Цялата YAML конфигурация, която Home Assistant може да презареди (автоматизации, скриптове, сцени, шаблони, групи…), се прочита отново, без рестартиране.",
    ha_restart_title: "Рестартиране на Home Assistant?",
    ha_restart_text: "Home Assistant спира и стартира отново: за момент е недостъпен и автоматизациите му не работят междувременно.",
    ha_reboot_title: "Рестартиране на хоста?",
    ha_reboot_text: "Машината, на която работи Home Assistant, се рестартира заедно с Home Assistant и всички добавки: всичко е недостъпно за няколко минути.",
    ha_checking: "Проверка на конфигурацията…",
    ha_valid: "Конфигурацията е валидна.",
    ha_invalid: "Конфигурацията не е валидна: коригирайте я преди рестартиране.",
    ha_restarting: "Home Assistant се рестартира…",
    ha_rebooting: "Хостът се рестартира…",
    sc_file_editor: "Редактор на файлове",
    sc_marketplace: "Marketplace",
    sc_settings: "Настройки",
    sc_integrations: "Интеграции",
    sc_logs: "Журнали",
    sc_developer_tools: "Инструменти за разработчици",
    ha_cancel: "Отказ",
    ha_failed: "Неуспех: {error}",
  },
  ru: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Диск",
    temperature: "Темп.",
    swap: "Swap",
    database: "База данных",
    network: "Сеть",
    storage: "Хранилище",
    processes: "Процессы",
    uptime: "Время работы:",
    load: "Нагрузка:",
    download: "Получение",
    upload: "Отправка",
    total: "Всего",
    used: "занято",
    of: "из",
    hours: "ч",
    days: "д",
    minutes: "мин",
    running: "Работает",
    up_to_date: "Актуально",
    update: "Обновление",
    no_sm: "Объекты System Monitor не найдены. Установлена ли интеграция System Monitor и включены ли её сенсоры?",
    procs_ok: "Процессы работают",
    procs_one: "1 процесс остановлен",
    procs_many: "Остановленные процессы: {n}",
    st_unknown: "Неизвестно",
    st_running: "Работает",
    st_stopped_one: "1 остановлен",
    st_stopped: "Остановлены: {n}",
    zoom_in: "Показать полную карточку",
    zoom_out: "Вернуться к компактному виду",
    // Editor
    title: "Заголовок (необязательно, по умолчанию Home Assistant)",
    show_system: "Показывать систему (CPU, RAM, диск, температура)",
    show_disk: "Показывать индикатор диска (также в разделе Хранилище)",
    show_title: "Показывать заголовок",
    show_subtitle: "Показывать подзаголовок",
    show_network: "Показывать сеть",
    show_history: "Показать историю за 24 ч",
    cpu_warning: "Порог предупреждения CPU (%)",
    cpu_critical: "Критический порог CPU (%)",
    ram_warning: "Порог предупреждения RAM (%)",
    ram_critical: "Критический порог RAM (%)",
    disk_warning: "Порог предупреждения диска (% занято)",
    disk_critical: "Критический порог диска (% занято)",
    temp_warning: "Порог предупреждения температуры (°C)",
    temp_critical: "Критический порог температуры (°C)",
    swap_warning: "Порог предупреждения swap (% занято)",
    swap_critical: "Критический порог swap (% занято)",
    backup: "Резервная копия",
    backup_none: "Копий ещё нет",
    backup_failed: "Последняя попытка не удалась",
    backup_running: "Создание копии…",
    backup_next: "Следующая {when}",
    show_backups: "Показывать резервные копии",
    backup_warning: "Предупреждение копии (дней без копии)",
    backup_critical: "Критично для копии (дней без копии)",
    show_storage: "Показывать хранилище",
    show_processes: "Показывать процессы",
    zoom: "Кнопка масштабирования",
    zoom_helper: "Переключает между полной карточкой и компактным видом",
    interface: "Сетевой интерфейс (необязательно, по умолчанию все)",
    entities: "Датчики на выбор (вместо датчиков System Monitor)",
    ent_processor_use: "Загрузка процессора (%)",
    ent_processor_temperature: "Температура процессора",
    ent_memory_use_percent: "Использование ОЗУ (%)",
    ent_swap_use_percent: "Использование swap (%)",
    ent_last_boot: "Последний запуск",
    language: "Язык",
    lang_auto: "Автоматически",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Показывать кнопки перезагрузки конфигурации и перезапуска",
    show_actions_helper: "Только для администраторов. Перезагрузка хоста требует Home Assistant OS или Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Показывать время работы",
    show_load: "Показывать нагрузку",
    show_ip: "Показывать IP-адрес",
    tap_action: "Действие при нажатии",
    tap_action_helper: "На индикаторе, плитке или строке: открыть сведения об объекте или ничего (кнопки по-прежнему работают)",
    // gauge_style and the level colours (#131)
    gauge_style: "Индикаторы системы",
    gauge_ring: "Кольца",
    gauge_bar: "Строки с полосами",
    ok_color: "Цвет нормального уровня",
    warning_color: "Цвет уровня предупреждения",
    critical_color: "Цвет критического уровня",
    ok_color_helper: "Цвет Home Assistant или любой цвет CSS; уровни следуют порогам ниже",
    ha_reload: "Перезагрузить конфигурацию",
    ha_restart: "Перезапустить Home Assistant",
    ha_reboot: "Перезагрузить хост",
    ha_reload_title: "Перезагрузить конфигурацию?",
    ha_reload_text: "Вся YAML-конфигурация, которую Home Assistant умеет перезагружать (автоматизации, скрипты, сцены, шаблоны, группы…), будет прочитана заново, без перезапуска.",
    ha_restart_title: "Перезапустить Home Assistant?",
    ha_restart_text: "Home Assistant остановится и запустится снова: какое-то время он будет недоступен, а его автоматизации в это время не работают.",
    ha_reboot_title: "Перезагрузить хост?",
    ha_reboot_text: "Компьютер, на котором работает Home Assistant, перезагружается вместе с Home Assistant и всеми дополнениями: всё недоступно несколько минут.",
    ha_checking: "Проверка конфигурации…",
    ha_valid: "Конфигурация корректна.",
    ha_invalid: "Конфигурация некорректна: исправьте её перед перезапуском.",
    ha_restarting: "Home Assistant перезапускается…",
    ha_rebooting: "Хост перезагружается…",
    sc_file_editor: "Редактор файлов",
    sc_marketplace: "Marketplace",
    sc_settings: "Настройки",
    sc_integrations: "Интеграции",
    sc_logs: "Журналы",
    sc_developer_tools: "Панель разработчика",
    ha_cancel: "Отмена",
    ha_failed: "Ошибка: {error}",
  },
  uk: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Диск",
    temperature: "Темп.",
    swap: "Swap",
    database: "База даних",
    network: "Мережа",
    storage: "Сховище",
    processes: "Процеси",
    uptime: "Час роботи:",
    load: "Навантаження:",
    download: "Отримання",
    upload: "Відправка",
    total: "Усього",
    used: "зайнято",
    of: "з",
    hours: "год",
    days: "д",
    minutes: "хв",
    running: "Працює",
    up_to_date: "Актуально",
    update: "Оновлення",
    no_sm: "Сутності System Monitor не знайдено. Чи встановлено інтеграцію System Monitor і чи увімкнено її сенсори?",
    procs_ok: "Процеси працюють",
    procs_one: "1 процес зупинено",
    procs_many: "Зупинені процеси: {n}",
    st_unknown: "Невідомо",
    st_running: "Працює",
    st_stopped_one: "1 зупинено",
    st_stopped: "Зупинено: {n}",
    zoom_in: "Показати повну картку",
    zoom_out: "Повернутися до компактного вигляду",
    // Editor
    title: "Заголовок (необов’язково, типово Home Assistant)",
    show_system: "Показувати систему (CPU, RAM, диск, температура)",
    show_disk: "Показувати індикатор диска (також у розділі Сховище)",
    show_title: "Показувати заголовок",
    show_subtitle: "Показувати підзаголовок",
    show_network: "Показувати мережу",
    show_history: "Показати історію за 24 год",
    cpu_warning: "Поріг попередження CPU (%)",
    cpu_critical: "Критичний поріг CPU (%)",
    ram_warning: "Поріг попередження RAM (%)",
    ram_critical: "Критичний поріг RAM (%)",
    disk_warning: "Поріг попередження диска (% зайнято)",
    disk_critical: "Критичний поріг диска (% зайнято)",
    temp_warning: "Поріг попередження температури (°C)",
    temp_critical: "Критичний поріг температури (°C)",
    swap_warning: "Поріг попередження swap (% зайнято)",
    swap_critical: "Критичний поріг swap (% зайнято)",
    backup: "Резервна копія",
    backup_none: "Копій ще немає",
    backup_failed: "Остання спроба не вдалася",
    backup_running: "Створення копії…",
    backup_next: "Наступна {when}",
    show_backups: "Показувати резервні копії",
    backup_warning: "Попередження копії (днів без копії)",
    backup_critical: "Критично для копії (днів без копії)",
    show_storage: "Показувати сховище",
    show_processes: "Показувати процеси",
    zoom: "Кнопка масштабування",
    zoom_helper: "Перемикає між повною карткою та компактним виглядом",
    interface: "Мережевий інтерфейс (необов’язково, типово всі)",
    entities: "Датчики на вибір (замість датчиків System Monitor)",
    ent_processor_use: "Завантаження процесора (%)",
    ent_processor_temperature: "Температура процесора",
    ent_memory_use_percent: "Використання ОЗП (%)",
    ent_swap_use_percent: "Використання swap (%)",
    ent_last_boot: "Останній запуск",
    language: "Мова",
    lang_auto: "Автоматично",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Показувати кнопки перезавантаження конфігурації та перезапуску",
    show_actions_helper: "Лише для адміністраторів. Перезавантаження хоста потребує Home Assistant OS або Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Показувати час роботи",
    show_load: "Показувати навантаження",
    show_ip: "Показувати IP-адресу",
    tap_action: "Дія при натисканні",
    tap_action_helper: "На індикаторі, плитці чи рядку: відкрити відомості про об'єкт або нічого (кнопки й далі працюють)",
    // gauge_style and the level colours (#131)
    gauge_style: "Індикатори системи",
    gauge_ring: "Кільця",
    gauge_bar: "Рядки зі смугами",
    ok_color: "Колір нормального рівня",
    warning_color: "Колір рівня попередження",
    critical_color: "Колір критичного рівня",
    ok_color_helper: "Колір Home Assistant або будь-який колір CSS; рівні визначаються порогами нижче",
    ha_reload: "Перезавантажити конфігурацію",
    ha_restart: "Перезапустити Home Assistant",
    ha_reboot: "Перезавантажити хост",
    ha_reload_title: "Перезавантажити конфігурацію?",
    ha_reload_text: "Уся YAML-конфігурація, яку Home Assistant уміє перезавантажувати (автоматизації, скрипти, сцени, шаблони, групи…), буде прочитана знову, без перезапуску.",
    ha_restart_title: "Перезапустити Home Assistant?",
    ha_restart_text: "Home Assistant зупиниться й запуститься знову: деякий час він буде недоступний, а його автоматизації тим часом не працюють.",
    ha_reboot_title: "Перезавантажити хост?",
    ha_reboot_text: "Комп'ютер, на якому працює Home Assistant, перезавантажується разом із Home Assistant і всіма доповненнями: усе недоступне кілька хвилин.",
    ha_checking: "Перевірка конфігурації…",
    ha_valid: "Конфігурація коректна.",
    ha_invalid: "Конфігурація некоректна: виправте її перед перезапуском.",
    ha_restarting: "Home Assistant перезапускається…",
    ha_rebooting: "Хост перезавантажується…",
    sc_file_editor: "Редактор файлів",
    sc_marketplace: "Marketplace",
    sc_settings: "Налаштування",
    sc_integrations: "Інтеграції",
    sc_logs: "Журнали",
    sc_developer_tools: "Інструменти розробника",
    ha_cancel: "Скасувати",
    ha_failed: "Помилка: {error}",
  },
  hu: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Lemez",
    temperature: "Hőm.",
    swap: "Swap",
    database: "Adatbázis",
    network: "Hálózat",
    storage: "Tárhely",
    processes: "Folyamatok",
    uptime: "Üzemidő:",
    load: "Terhelés:",
    download: "Letöltés",
    upload: "Feltöltés",
    total: "Össz.",
    used: "foglalt",
    of: "/",
    hours: "ó",
    days: "n",
    minutes: "p",
    running: "Fut",
    up_to_date: "Naprakész",
    update: "Frissítés",
    no_sm: "Nem található System Monitor entitás. Telepítve van a System Monitor integráció, és engedélyezve vannak az érzékelői?",
    procs_ok: "A folyamatok futnak",
    procs_one: "1 folyamat leállt",
    procs_many: "{n} folyamat leállt",
    st_unknown: "Ismeretlen",
    st_running: "Fut",
    st_stopped_one: "1 leállt",
    st_stopped: "{n} leállt",
    zoom_in: "Teljes kártya megjelenítése",
    zoom_out: "Vissza a kompakt nézethez",
    // Editor
    title: "Cím (nem kötelező, alapértelmezés: Home Assistant)",
    show_system: "Rendszer megjelenítése (CPU, RAM, lemez, hőmérséklet)",
    show_disk: "Lemezmérő megjelenítése (a Tárhelyben is)",
    show_title: "Cím megjelenítése",
    show_subtitle: "Alcím megjelenítése",
    show_network: "Hálózat megjelenítése",
    show_history: "24 órás előzmények megjelenítése",
    cpu_warning: "CPU figyelmeztetési küszöb (%)",
    cpu_critical: "CPU kritikus küszöb (%)",
    ram_warning: "RAM figyelmeztetési küszöb (%)",
    ram_critical: "RAM kritikus küszöb (%)",
    disk_warning: "Lemez figyelmeztetési küszöb (% foglalt)",
    disk_critical: "Lemez kritikus küszöb (% foglalt)",
    temp_warning: "Hőmérséklet figyelmeztetési küszöb (°C)",
    temp_critical: "Hőmérséklet kritikus küszöb (°C)",
    swap_warning: "Swap figyelmeztetési küszöb (% foglalt)",
    swap_critical: "Swap kritikus küszöb (% foglalt)",
    backup: "Biztonsági mentés",
    backup_none: "Még nincs mentés",
    backup_failed: "Az utolsó kísérlet sikertelen",
    backup_running: "Mentés folyamatban…",
    backup_next: "Következő: {when}",
    show_backups: "Biztonsági mentések megjelenítése",
    backup_warning: "Mentési figyelmeztetés (napok mentés nélkül)",
    backup_critical: "Mentés kritikus (napok mentés nélkül)",
    show_storage: "Tárhely megjelenítése",
    show_processes: "Folyamatok megjelenítése",
    zoom: "Nagyítás gomb",
    zoom_helper: "Vált a teljes kártya és a kompakt nézet között",
    interface: "Hálózati interfész (nem kötelező, alapértelmezés: mind)",
    entities: "Választott érzékelők (a System Monitor érzékelői helyett)",
    ent_processor_use: "Processzorhasználat (%)",
    ent_processor_temperature: "Processzorhőmérséklet",
    ent_memory_use_percent: "RAM-használat (%)",
    ent_swap_use_percent: "Swap-használat (%)",
    ent_last_boot: "Utolsó indítás",
    language: "Nyelv",
    lang_auto: "Automatikus",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Az újratöltés és újraindítás gombjainak megjelenítése",
    show_actions_helper: "Csak rendszergazdáknak. A gazdagép újraindításához Home Assistant OS vagy Supervised szükséges",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Üzemidő megjelenítése",
    show_load: "Terhelés megjelenítése",
    show_ip: "IP-cím megjelenítése",
    tap_action: "Koppintási művelet",
    tap_action_helper: "Mérőn, csempén vagy soron: az entitás részleteinek megnyitása, vagy semmi (a gombok továbbra is működnek)",
    // gauge_style and the level colours (#131)
    gauge_style: "Rendszermérők",
    gauge_ring: "Gyűrűk",
    gauge_bar: "Sorok sávokkal",
    ok_color: "A normál szint színe",
    warning_color: "A figyelmeztetési szint színe",
    critical_color: "A kritikus szint színe",
    ok_color_helper: "Egy Home Assistant-szín vagy bármely CSS-szín; a szintek az alábbi küszöböket követik",
    ha_reload: "Konfiguráció újratöltése",
    ha_restart: "Home Assistant újraindítása",
    ha_reboot: "Gazdagép újraindítása",
    ha_reload_title: "Újratölti a konfigurációt?",
    ha_reload_text: "Minden YAML-konfiguráció, amelyet a Home Assistant újra tud tölteni (automatizálások, szkriptek, jelenetek, sablonok, csoportok…), újra beolvasásra kerül, újraindítás nélkül.",
    ha_restart_title: "Újraindítja a Home Assistantot?",
    ha_restart_text: "A Home Assistant leáll, majd újraindul: egy ideig nem érhető el, és az automatizálásai addig nem futnak.",
    ha_reboot_title: "Újraindítod a gazdagépet?",
    ha_reboot_text: "A Home Assistantot futtató gép újraindul a Home Assistanttal és az összes bővítménnyel együtt: néhány percig semmi sem érhető el.",
    ha_checking: "Konfiguráció ellenőrzése…",
    ha_valid: "A konfiguráció érvényes.",
    ha_invalid: "A konfiguráció érvénytelen: javítsa ki újraindítás előtt.",
    ha_restarting: "A Home Assistant újraindul…",
    ha_rebooting: "A gazdagép újraindul…",
    sc_file_editor: "Fájlszerkesztő",
    sc_marketplace: "Marketplace",
    sc_settings: "Beállítások",
    sc_integrations: "Integrációk",
    sc_logs: "Naplók",
    sc_developer_tools: "Fejlesztői eszközök",
    ha_cancel: "Mégse",
    ha_failed: "Sikertelen: {error}",
  },
  sk: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disk",
    temperature: "Tepl.",
    swap: "Swap",
    database: "Databáza",
    network: "Sieť",
    storage: "Úložisko",
    processes: "Procesy",
    uptime: "Doba prevádzky:",
    load: "Zaťaženie:",
    download: "Sťahovanie",
    upload: "Odosielanie",
    total: "Celkom",
    used: "využité",
    of: "z",
    hours: "h",
    days: "d",
    minutes: "min",
    running: "Beží",
    up_to_date: "Aktuálne",
    update: "Aktualizácia",
    no_sm: "Nenašli sa žiadne entity System Monitor. Je integrácia System Monitor nainštalovaná a sú jej senzory povolené?",
    procs_ok: "Procesy bežia",
    procs_one: "1 proces zastavený",
    procs_many: "Zastavené procesy: {n}",
    st_unknown: "Neznáme",
    st_running: "Beží",
    st_stopped_one: "1 zastavený",
    st_stopped: "Zastavené: {n}",
    zoom_in: "Zobraziť celú kartu",
    zoom_out: "Späť na kompaktné zobrazenie",
    // Editor
    title: "Názov (voliteľný, predvolene Home Assistant)",
    show_system: "Zobraziť systém (CPU, RAM, disk, teplota)",
    show_disk: "Zobraziť ukazovateľ disku (aj v Úložisku)",
    show_title: "Zobraziť názov",
    show_subtitle: "Zobraziť podnázov",
    show_network: "Zobraziť sieť",
    show_history: "Zobraziť 24 h históriu",
    cpu_warning: "Prah upozornenia CPU (%)",
    cpu_critical: "Kritický prah CPU (%)",
    ram_warning: "Prah upozornenia RAM (%)",
    ram_critical: "Kritický prah RAM (%)",
    disk_warning: "Prah upozornenia disku (% obsadené)",
    disk_critical: "Kritický prah disku (% obsadené)",
    temp_warning: "Prah upozornenia teploty (°C)",
    temp_critical: "Kritický prah teploty (°C)",
    swap_warning: "Prah upozornenia swapu (% obsadené)",
    swap_critical: "Kritický prah swapu (% obsadené)",
    backup: "Záloha",
    backup_none: "Zatiaľ bez zálohy",
    backup_failed: "Posledný pokus zlyhal",
    backup_running: "Zálohuje sa…",
    backup_next: "Ďalšia {when}",
    show_backups: "Zobraziť zálohy",
    backup_warning: "Upozornenie zálohy (dni bez zálohy)",
    backup_critical: "Kritická záloha (dni bez zálohy)",
    show_storage: "Zobraziť úložisko",
    show_processes: "Zobraziť procesy",
    zoom: "Tlačidlo priblíženia",
    zoom_helper: "Prepína medzi celou kartou a kompaktným zobrazením",
    interface: "Sieťové rozhranie (voliteľné, predvolene všetky)",
    entities: "Senzory podľa vlastného výberu (namiesto tých zo System Monitor)",
    ent_processor_use: "Využitie procesora (%)",
    ent_processor_temperature: "Teplota procesora",
    ent_memory_use_percent: "Využitie RAM (%)",
    ent_swap_use_percent: "Využitie swapu (%)",
    ent_last_boot: "Posledné spustenie",
    language: "Jazyk",
    lang_auto: "Automaticky",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Zobraziť tlačidlá opätovného načítania a reštartu",
    show_actions_helper: "Iba pre správcov. Reštart hostiteľa vyžaduje Home Assistant OS alebo Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Zobraziť dobu prevádzky",
    show_load: "Zobraziť zaťaženie",
    show_ip: "Zobraziť IP adresu",
    tap_action: "Akcia pri ťuknutí",
    tap_action_helper: "Na ukazovateli, dlaždici alebo riadku: otvoriť podrobnosti entity alebo nič (tlačidlá naďalej fungujú)",
    // gauge_style and the level colours (#131)
    gauge_style: "Ukazovatele systému",
    gauge_ring: "Prstence",
    gauge_bar: "Riadky s pruhmi",
    ok_color: "Farba normálnej úrovne",
    warning_color: "Farba úrovne upozornenia",
    critical_color: "Farba kritickej úrovne",
    ok_color_helper: "Farba Home Assistant alebo ľubovoľná farba CSS; úrovne sa riadia prahmi nižšie",
    ha_reload: "Znovu načítať konfiguráciu",
    ha_restart: "Reštartovať Home Assistant",
    ha_reboot: "Reštartovať hostiteľa",
    ha_reload_title: "Znovu načítať konfiguráciu?",
    ha_reload_text: "Celá konfigurácia YAML, ktorú Home Assistant dokáže znovu načítať (automatizácie, skripty, scény, šablóny, skupiny…), sa načíta znova, bez reštartu.",
    ha_restart_title: "Reštartovať Home Assistant?",
    ha_restart_text: "Home Assistant sa zastaví a znova spustí: na chvíľu bude nedostupný a jeho automatizácie medzitým nebežia.",
    ha_reboot_title: "Reštartovať hostiteľa?",
    ha_reboot_text: "Počítač, na ktorom beží Home Assistant, sa reštartuje spolu s Home Assistant a všetkými doplnkami: všetko je na niekoľko minút nedostupné.",
    ha_checking: "Kontrola konfigurácie…",
    ha_valid: "Konfigurácia je platná.",
    ha_invalid: "Konfigurácia nie je platná: pred reštartom ju opravte.",
    ha_restarting: "Home Assistant sa reštartuje…",
    ha_rebooting: "Hostiteľ sa reštartuje…",
    sc_file_editor: "Editor súborov",
    sc_marketplace: "Marketplace",
    sc_settings: "Nastavenia",
    sc_integrations: "Integrácie",
    sc_logs: "Záznamy",
    sc_developer_tools: "Nástroje pre vývojárov",
    ha_cancel: "Zrušiť",
    ha_failed: "Zlyhalo: {error}",
  },
  cs: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disk",
    temperature: "Tepl.",
    swap: "Swap",
    database: "Databáze",
    network: "Síť",
    storage: "Úložiště",
    processes: "Procesy",
    uptime: "Doba provozu:",
    load: "Zatížení:",
    download: "Stahování",
    upload: "Odesílání",
    total: "Celkem",
    used: "využito",
    of: "z",
    hours: "h",
    days: "d",
    minutes: "min",
    running: "Běží",
    up_to_date: "Aktuální",
    update: "Aktualizace",
    no_sm: "Nebyly nalezeny žádné entity System Monitor. Je integrace System Monitor nainstalovaná a jsou její senzory povolené?",
    procs_ok: "Procesy běží",
    procs_one: "1 proces zastaven",
    procs_many: "Zastavené procesy: {n}",
    st_unknown: "Neznámý",
    st_running: "Běží",
    st_stopped_one: "1 zastaven",
    st_stopped: "Zastaveno: {n}",
    zoom_in: "Zobrazit celou kartu",
    zoom_out: "Zpět na kompaktní zobrazení",
    // Editor
    title: "Název (volitelný, výchozí Home Assistant)",
    show_system: "Zobrazit systém (CPU, RAM, disk, teplota)",
    show_disk: "Zobrazit ukazatel disku (také v Úložišti)",
    show_title: "Zobrazit název",
    show_subtitle: "Zobrazit podnázev",
    show_network: "Zobrazit síť",
    show_history: "Zobrazit 24h historii",
    cpu_warning: "Práh varování CPU (%)",
    cpu_critical: "Kritický práh CPU (%)",
    ram_warning: "Práh varování RAM (%)",
    ram_critical: "Kritický práh RAM (%)",
    disk_warning: "Práh varování disku (% obsazeno)",
    disk_critical: "Kritický práh disku (% obsazeno)",
    temp_warning: "Práh varování teploty (°C)",
    temp_critical: "Kritický práh teploty (°C)",
    swap_warning: "Práh varování swapu (% obsazeno)",
    swap_critical: "Kritický práh swapu (% obsazeno)",
    backup: "Záloha",
    backup_none: "Zatím bez zálohy",
    backup_failed: "Poslední pokus selhal",
    backup_running: "Zálohuje se…",
    backup_next: "Další {when}",
    show_backups: "Zobrazit zálohy",
    backup_warning: "Upozornění zálohy (dny bez zálohy)",
    backup_critical: "Kritická záloha (dny bez zálohy)",
    show_storage: "Zobrazit úložiště",
    show_processes: "Zobrazit procesy",
    zoom: "Tlačítko přiblížení",
    zoom_helper: "Přepíná mezi celou kartou a kompaktním zobrazením",
    interface: "Síťové rozhraní (volitelné, výchozí všechna)",
    entities: "Senzory dle vlastního výběru (místo těch ze System Monitor)",
    ent_processor_use: "Využití procesoru (%)",
    ent_processor_temperature: "Teplota procesoru",
    ent_memory_use_percent: "Využití RAM (%)",
    ent_swap_use_percent: "Využití swapu (%)",
    ent_last_boot: "Poslední spuštění",
    language: "Jazyk",
    lang_auto: "Automaticky",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Zobrazit tlačítka opětovného načtení a restartu",
    show_actions_helper: "Pouze pro správce. Restart hostitele vyžaduje Home Assistant OS nebo Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Zobrazit dobu provozu",
    show_load: "Zobrazit zatížení",
    show_ip: "Zobrazit IP adresu",
    tap_action: "Akce při klepnutí",
    tap_action_helper: "Na ukazateli, dlaždici nebo řádku: otevřít podrobnosti entity, nebo nic (tlačítka dál fungují)",
    // gauge_style and the level colours (#131)
    gauge_style: "Ukazatele systému",
    gauge_ring: "Prstence",
    gauge_bar: "Řádky s pruhy",
    ok_color: "Barva normální úrovně",
    warning_color: "Barva úrovně varování",
    critical_color: "Barva kritické úrovně",
    ok_color_helper: "Barva Home Assistant nebo libovolná barva CSS; úrovně se řídí prahy níže",
    ha_reload: "Znovu načíst konfiguraci",
    ha_restart: "Restartovat Home Assistant",
    ha_reboot: "Restartovat hostitele",
    ha_reload_title: "Znovu načíst konfiguraci?",
    ha_reload_text: "Veškerá konfigurace YAML, kterou Home Assistant umí znovu načíst (automatizace, skripty, scény, šablony, skupiny…), se načte znovu, bez restartu.",
    ha_restart_title: "Restartovat Home Assistant?",
    ha_restart_text: "Home Assistant se zastaví a znovu spustí: na chvíli bude nedostupný a jeho automatizace mezitím neběží.",
    ha_reboot_title: "Restartovat hostitele?",
    ha_reboot_text: "Počítač, na kterém běží Home Assistant, se restartuje spolu s Home Assistant a všemi doplňky: vše je na několik minut nedostupné.",
    ha_checking: "Kontrola konfigurace…",
    ha_valid: "Konfigurace je platná.",
    ha_invalid: "Konfigurace není platná: před restartem ji opravte.",
    ha_restarting: "Home Assistant se restartuje…",
    ha_rebooting: "Hostitel se restartuje…",
    sc_file_editor: "Editor souborů",
    sc_marketplace: "Marketplace",
    sc_settings: "Nastavení",
    sc_integrations: "Integrace",
    sc_logs: "Záznamy",
    sc_developer_tools: "Vývojářské nástroje",
    ha_cancel: "Zrušit",
    ha_failed: "Selhalo: {error}",
  },
  sl: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disk",
    temperature: "Temp.",
    swap: "Swap",
    database: "Zbirka podatkov",
    network: "Omrežje",
    storage: "Shramba",
    processes: "Procesi",
    uptime: "Čas delovanja:",
    load: "Obremenitev:",
    download: "Prejemanje",
    upload: "Pošiljanje",
    total: "Skupaj",
    used: "uporabljeno",
    of: "od",
    hours: "h",
    days: "d",
    minutes: "min",
    running: "Teče",
    up_to_date: "Posodobljeno",
    update: "Posodobitev",
    no_sm: "Ni najdenih entitet System Monitor. Ali je integracija System Monitor nameščena in so njeni senzorji omogočeni?",
    procs_ok: "Procesi tečejo",
    procs_one: "1 proces ustavljen",
    procs_many: "Ustavljeni procesi: {n}",
    st_unknown: "Neznano",
    st_running: "Teče",
    st_stopped_one: "1 ustavljen",
    st_stopped: "Ustavljeni: {n}",
    zoom_in: "Prikaži celotno kartico",
    zoom_out: "Nazaj na strnjen pogled",
    // Editor
    title: "Naslov (neobvezno, privzeto Home Assistant)",
    show_system: "Prikaži sistem (CPU, RAM, disk, temperatura)",
    show_disk: "Prikaži merilnik diska (tudi v Shrambi)",
    show_title: "Prikaži naslov",
    show_subtitle: "Prikaži podnaslov",
    show_network: "Prikaži omrežje",
    show_history: "Prikaži 24-urno zgodovino",
    cpu_warning: "Prag opozorila CPU (%)",
    cpu_critical: "Kritični prag CPU (%)",
    ram_warning: "Prag opozorila RAM (%)",
    ram_critical: "Kritični prag RAM (%)",
    disk_warning: "Prag opozorila diska (% zasedeno)",
    disk_critical: "Kritični prag diska (% zasedeno)",
    temp_warning: "Prag opozorila temperature (°C)",
    temp_critical: "Kritični prag temperature (°C)",
    swap_warning: "Prag opozorila swapa (% zasedeno)",
    swap_critical: "Kritični prag swapa (% zasedeno)",
    backup: "Varnostna kopija",
    backup_none: "Še ni kopije",
    backup_failed: "Zadnji poskus ni uspel",
    backup_running: "Varnostno kopiranje…",
    backup_next: "Naslednja {when}",
    show_backups: "Prikaži varnostne kopije",
    backup_warning: "Opozorilo kopije (dni brez kopije)",
    backup_critical: "Kritična kopija (dni brez kopije)",
    show_storage: "Prikaži shrambo",
    show_processes: "Prikaži procese",
    zoom: "Gumb za povečavo",
    zoom_helper: "Preklaplja med celotno kartico in strnjenim pogledom",
    interface: "Omrežni vmesnik (neobvezno, privzeto vsi)",
    entities: "Senzorji po vaši izbiri (namesto tistih iz System Monitor)",
    ent_processor_use: "Uporaba procesorja (%)",
    ent_processor_temperature: "Temperatura procesorja",
    ent_memory_use_percent: "Uporaba RAM (%)",
    ent_swap_use_percent: "Uporaba swapa (%)",
    ent_last_boot: "Zadnji zagon",
    language: "Jezik",
    lang_auto: "Samodejno",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Prikaži gumba za ponovno nalaganje in ponovni zagon",
    show_actions_helper: "Samo skrbniki. Ponovni zagon gostitelja zahteva Home Assistant OS ali Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Prikaži čas delovanja",
    show_load: "Prikaži obremenitev",
    show_ip: "Prikaži naslov IP",
    tap_action: "Dejanje ob dotiku",
    tap_action_helper: "Na merilniku, ploščici ali vrstici: odpri podrobnosti entitete ali nič (gumbi še vedno delujejo)",
    // gauge_style and the level colours (#131)
    gauge_style: "Sistemski merilniki",
    gauge_ring: "Obroči",
    gauge_bar: "Vrstice s pasovi",
    ok_color: "Barva običajne ravni",
    warning_color: "Barva ravni opozorila",
    critical_color: "Barva kritične ravni",
    ok_color_helper: "Barva Home Assistanta ali katera koli barva CSS; ravni sledijo pragovom spodaj",
    ha_reload: "Znova naloži konfiguracijo",
    ha_restart: "Znova zaženi Home Assistant",
    ha_reboot: "Znova zaženi gostitelja",
    ha_reload_title: "Znova naložiti konfiguracijo?",
    ha_reload_text: "Vsa konfiguracija YAML, ki jo Home Assistant zna znova naložiti (avtomatizacije, skripte, scene, predloge, skupine…), se prebere znova, brez ponovnega zagona.",
    ha_restart_title: "Znova zagnati Home Assistant?",
    ha_restart_text: "Home Assistant se ustavi in znova zažene: za trenutek ni na voljo, njegove avtomatizacije pa medtem ne tečejo.",
    ha_reboot_title: "Znova zagnati gostitelja?",
    ha_reboot_text: "Računalnik, na katerem teče Home Assistant, se znova zažene skupaj s Home Assistant in vsemi dodatki: vse je nekaj minut nedosegljivo.",
    ha_checking: "Preverjanje konfiguracije…",
    ha_valid: "Konfiguracija je veljavna.",
    ha_invalid: "Konfiguracija ni veljavna: popravite jo pred ponovnim zagonom.",
    ha_restarting: "Home Assistant se znova zaganja…",
    ha_rebooting: "Gostitelj se znova zaganja…",
    sc_file_editor: "Urejevalnik datotek",
    sc_marketplace: "Marketplace",
    sc_settings: "Nastavitve",
    sc_integrations: "Integracije",
    sc_logs: "Dnevniki",
    sc_developer_tools: "Orodja za razvijalce",
    ha_cancel: "Prekliči",
    ha_failed: "Ni uspelo: {error}",
  },
  lv: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Disks",
    temperature: "Temp.",
    swap: "Swap",
    database: "Datubāze",
    network: "Tīkls",
    storage: "Krātuve",
    processes: "Procesi",
    uptime: "Darbības laiks:",
    load: "Slodze:",
    download: "Saņemšana",
    upload: "Sūtīšana",
    total: "Kopā",
    used: "izmantoti",
    of: "no",
    hours: "st.",
    days: "d.",
    minutes: "min",
    running: "Darbojas",
    up_to_date: "Atjaunināts",
    update: "Jauna versija",
    no_sm: "Netika atrastas System Monitor vienības. Vai integrācija System Monitor ir instalēta un tās sensori ir iespējoti?",
    procs_ok: "Procesi darbojas",
    procs_one: "1 process apturēts",
    procs_many: "Apturēti procesi: {n}",
    st_unknown: "Nezināms",
    st_running: "Darbojas",
    st_stopped_one: "1 apturēts",
    st_stopped: "Apturēti: {n}",
    zoom_in: "Rādīt pilno karti",
    zoom_out: "Atpakaļ uz kompakto skatu",
    // Editor
    title: "Virsraksts (neobligāts, pēc noklusējuma Home Assistant)",
    show_system: "Rādīt sistēmu (CPU, RAM, disks, temperatūra)",
    show_disk: "Rādīt diska rādītāju (arī Krātuvē)",
    show_title: "Rādīt virsrakstu",
    show_subtitle: "Rādīt apakšvirsrakstu",
    show_network: "Rādīt tīklu",
    show_history: "Rādīt 24 h vēsturi",
    cpu_warning: "CPU brīdinājuma slieksnis (%)",
    cpu_critical: "CPU kritiskais slieksnis (%)",
    ram_warning: "RAM brīdinājuma slieksnis (%)",
    ram_critical: "RAM kritiskais slieksnis (%)",
    disk_warning: "Diska brīdinājuma slieksnis (% aizņemts)",
    disk_critical: "Diska kritiskais slieksnis (% aizņemts)",
    temp_warning: "Temperatūras brīdinājuma slieksnis (°C)",
    temp_critical: "Temperatūras kritiskais slieksnis (°C)",
    swap_warning: "Swap brīdinājuma slieksnis (% aizņemts)",
    swap_critical: "Swap kritiskais slieksnis (% aizņemts)",
    backup: "Rezerves kopija",
    backup_none: "Vēl nav kopijas",
    backup_failed: "Pēdējais mēģinājums neizdevās",
    backup_running: "Veido kopiju…",
    backup_next: "Nākamā {when}",
    show_backups: "Rādīt rezerves kopijas",
    backup_warning: "Kopijas brīdinājums (dienas bez kopijas)",
    backup_critical: "Kopija kritiska (dienas bez kopijas)",
    show_storage: "Rādīt krātuvi",
    show_processes: "Rādīt procesus",
    zoom: "Tālummaiņas poga",
    zoom_helper: "Pārslēdz starp pilno karti un kompakto skatu",
    interface: "Tīkla saskarne (neobligāta, pēc noklusējuma visas)",
    entities: "Jūsu izvēlēti sensori (System Monitor sensoru vietā)",
    ent_processor_use: "Procesora noslodze (%)",
    ent_processor_temperature: "Procesora temperatūra",
    ent_memory_use_percent: "RAM izmantojums (%)",
    ent_swap_use_percent: "Swap izmantojums (%)",
    ent_last_boot: "Pēdējā palaišana",
    language: "Valoda",
    lang_auto: "Automātiski",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Rādīt pārlādes un restartēšanas pogas",
    show_actions_helper: "Tikai administratoriem. Resursdatora restartēšanai nepieciešams Home Assistant OS vai Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Rādīt darbības laiku",
    show_load: "Rādīt slodzi",
    show_ip: "Rādīt IP adresi",
    tap_action: "Pieskāriena darbība",
    tap_action_helper: "Uz mērītāja, flīzes vai rindas: atvērt entītijas informāciju vai neko (pogas joprojām darbojas)",
    // gauge_style and the level colours (#131)
    gauge_style: "Sistēmas mērītāji",
    gauge_ring: "Gredzeni",
    gauge_bar: "Rindas ar joslām",
    ok_color: "Normāla līmeņa krāsa",
    warning_color: "Brīdinājuma līmeņa krāsa",
    critical_color: "Kritiskā līmeņa krāsa",
    ok_color_helper: "Home Assistant krāsa vai jebkura CSS krāsa; līmeņi atbilst tālāk norādītajiem sliekšņiem",
    ha_reload: "Pārlādēt konfigurāciju",
    ha_restart: "Restartēt Home Assistant",
    ha_reboot: "Restartēt resursdatoru",
    ha_reload_title: "Pārlādēt konfigurāciju?",
    ha_reload_text: "Visa YAML konfigurācija, ko Home Assistant spēj pārlādēt (automatizācijas, skripti, ainas, veidnes, grupas…), tiek nolasīta no jauna, bez restartēšanas.",
    ha_restart_title: "Restartēt Home Assistant?",
    ha_restart_text: "Home Assistant apstājas un atkal startē: brīdi tas nav pieejams, un tā automatizācijas šajā laikā nedarbojas.",
    ha_reboot_title: "Restartēt resursdatoru?",
    ha_reboot_text: "Dators, kurā darbojas Home Assistant, tiek restartēts kopā ar Home Assistant un visiem papildinājumiem: viss uz dažām minūtēm nav pieejams.",
    ha_checking: "Pārbauda konfigurāciju…",
    ha_valid: "Konfigurācija ir derīga.",
    ha_invalid: "Konfigurācija nav derīga: izlabojiet to pirms restartēšanas.",
    ha_restarting: "Home Assistant restartējas…",
    ha_rebooting: "Resursdators tiek restartēts…",
    sc_file_editor: "Failu redaktors",
    sc_marketplace: "Marketplace",
    sc_settings: "Iestatījumi",
    sc_integrations: "Integrācijas",
    sc_logs: "Žurnāli",
    sc_developer_tools: "Izstrādātāja rīki",
    ha_cancel: "Atcelt",
    ha_failed: "Neizdevās: {error}",
  },
  el: {
    cpu: "CPU",
    ram: "RAM",
    disk: "Δίσκος",
    temperature: "Θερμ.",
    swap: "Swap",
    database: "Βάση δεδομένων",
    network: "Δίκτυο",
    storage: "Αποθήκευση",
    processes: "Διεργασίες",
    uptime: "Χρόνος λειτουργίας:",
    load: "Φόρτος:",
    download: "Λήψη",
    upload: "Αποστολή",
    total: "Σύνολο",
    used: "σε χρήση",
    of: "από",
    hours: "ώρ.",
    days: "ημ.",
    minutes: "λεπ.",
    running: "Εκτελείται",
    up_to_date: "Ενημερωμένο",
    update: "Ενημέρωση",
    no_sm: "Δεν βρέθηκαν οντότητες System Monitor. Είναι εγκατεστημένη η ενσωμάτωση System Monitor και ενεργοποιημένοι οι αισθητήρες της;",
    procs_ok: "Οι διεργασίες εκτελούνται",
    procs_one: "1 διεργασία σταματημένη",
    procs_many: "{n} διεργασίες σταματημένες",
    st_unknown: "Άγνωστο",
    st_running: "Εκτελείται",
    st_stopped_one: "1 σταματημένη",
    st_stopped: "{n} σταματημένες",
    zoom_in: "Εμφάνιση πλήρους κάρτας",
    zoom_out: "Επιστροφή στη συμπαγή προβολή",
    // Editor
    title: "Τίτλος (προαιρετικός, προεπιλογή Home Assistant)",
    show_system: "Εμφάνιση συστήματος (CPU, RAM, δίσκος, θερμοκρασία)",
    show_disk: "Εμφάνιση του δείκτη δίσκου (και στον Αποθηκευτικό χώρο)",
    show_title: "Εμφάνιση τίτλου",
    show_subtitle: "Εμφάνιση υπότιτλου",
    show_network: "Εμφάνιση δικτύου",
    show_history: "Εμφάνιση ιστορικού 24 ωρών",
    cpu_warning: "Όριο προειδοποίησης CPU (%)",
    cpu_critical: "Κρίσιμο όριο CPU (%)",
    ram_warning: "Όριο προειδοποίησης RAM (%)",
    ram_critical: "Κρίσιμο όριο RAM (%)",
    disk_warning: "Όριο προειδοποίησης δίσκου (% σε χρήση)",
    disk_critical: "Κρίσιμο όριο δίσκου (% σε χρήση)",
    temp_warning: "Όριο προειδοποίησης θερμοκρασίας (°C)",
    temp_critical: "Κρίσιμο όριο θερμοκρασίας (°C)",
    swap_warning: "Όριο προειδοποίησης swap (% σε χρήση)",
    swap_critical: "Κρίσιμο όριο swap (% σε χρήση)",
    backup: "Αντίγραφο ασφαλείας",
    backup_none: "Δεν υπάρχει ακόμη αντίγραφο",
    backup_failed: "Η τελευταία προσπάθεια απέτυχε",
    backup_running: "Δημιουργία αντιγράφου…",
    backup_next: "Επόμενο {when}",
    show_backups: "Εμφάνιση αντιγράφων ασφαλείας",
    backup_warning: "Προειδοποίηση αντιγράφου (ημέρες χωρίς)",
    backup_critical: "Κρίσιμο αντίγραφο (ημέρες χωρίς)",
    show_storage: "Εμφάνιση αποθήκευσης",
    show_processes: "Εμφάνιση διεργασιών",
    zoom: "Κουμπί μεγέθυνσης",
    zoom_helper: "Εναλλάσσει μεταξύ πλήρους κάρτας και συμπαγούς προβολής",
    interface: "Διεπαφή δικτύου (προαιρετική, προεπιλογή όλες)",
    entities: "Αισθητήρες της επιλογής σας (αντί για του System Monitor)",
    ent_processor_use: "Χρήση CPU (%)",
    ent_processor_temperature: "Θερμοκρασία CPU",
    ent_memory_use_percent: "Χρήση RAM (%)",
    ent_swap_use_percent: "Χρήση swap (%)",
    ent_last_boot: "Τελευταία εκκίνηση",
    language: "Γλώσσα",
    lang_auto: "Αυτόματα",
    // Reload, restart and reboot (show_actions); the panel's strings
    show_actions: "Εμφάνιση των κουμπιών επαναφόρτωσης και επανεκκίνησης",
    show_actions_helper: "Μόνο για διαχειριστές. Η επανεκκίνηση του κεντρικού υπολογιστή απαιτεί Home Assistant OS ή Supervised",
    // Lines of the System section (show_uptime, show_load, show_ip) and tap_action: none (#129)
    show_uptime: "Εμφάνιση χρόνου λειτουργίας",
    show_load: "Εμφάνιση φόρτου",
    show_ip: "Εμφάνιση διεύθυνσης IP",
    tap_action: "Ενέργεια πατήματος",
    tap_action_helper: "Σε δείκτη, πλακίδιο ή γραμμή: άνοιγμα των λεπτομερειών της οντότητας ή τίποτα (τα κουμπιά εξακολουθούν να λειτουργούν)",
    // gauge_style and the level colours (#131)
    gauge_style: "Δείκτες συστήματος",
    gauge_ring: "Δακτύλιοι",
    gauge_bar: "Γραμμές με μπάρες",
    ok_color: "Χρώμα κανονικού επιπέδου",
    warning_color: "Χρώμα επιπέδου προειδοποίησης",
    critical_color: "Χρώμα κρίσιμου επιπέδου",
    ok_color_helper: "Ένα χρώμα του Home Assistant ή οποιοδήποτε χρώμα CSS· τα επίπεδα ακολουθούν τα παρακάτω όρια",
    ha_reload: "Επαναφόρτωση ρυθμίσεων",
    ha_restart: "Επανεκκίνηση του Home Assistant",
    ha_reboot: "Επανεκκίνηση του κεντρικού υπολογιστή",
    ha_reload_title: "Επαναφόρτωση των ρυθμίσεων;",
    ha_reload_text: "Όλες οι ρυθμίσεις YAML που μπορεί να επαναφορτώσει το Home Assistant (αυτοματισμοί, σενάρια, σκηνές, πρότυπα, ομάδες…) διαβάζονται ξανά, χωρίς επανεκκίνηση.",
    ha_restart_title: "Επανεκκίνηση του Home Assistant;",
    ha_restart_text: "Το Home Assistant σταματά και ξεκινά ξανά: δεν είναι διαθέσιμο για λίγο και οι αυτοματισμοί του δεν εκτελούνται στο μεταξύ.",
    ha_reboot_title: "Επανεκκίνηση του κεντρικού υπολογιστή;",
    ha_reboot_text: "Ο υπολογιστής που εκτελεί το Home Assistant επανεκκινείται, μαζί με το Home Assistant και όλα τα πρόσθετα: τίποτα δεν είναι διαθέσιμο για λίγα λεπτά.",
    ha_checking: "Έλεγχος ρυθμίσεων…",
    ha_valid: "Οι ρυθμίσεις είναι έγκυρες.",
    ha_invalid: "Οι ρυθμίσεις δεν είναι έγκυρες: διορθώστε τες πριν από την επανεκκίνηση.",
    ha_restarting: "Το Home Assistant επανεκκινείται…",
    ha_rebooting: "Ο κεντρικός υπολογιστής επανεκκινείται…",
    sc_file_editor: "Επεξεργαστής αρχείων",
    sc_marketplace: "Marketplace",
    sc_settings: "Ρυθμίσεις",
    sc_integrations: "Ενσωματώσεις",
    sc_logs: "Αρχεία καταγραφής",
    sc_developer_tools: "Εργαλεία προγραμματιστή",
    ha_cancel: "Ακύρωση",
    ha_failed: "Αποτυχία: {error}",
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);


const lang = (hass, config) => {
  const l = (config?.language) || (hass && (hass.locale?.language || hass.language)) || "en";
  return STRINGS[l] ? l : STRINGS[l.split("-")[0]] ? l.split("-")[0] : "en";
};

// Locale for Intl: Home Assistant's full locale when its base matches the card's resolved language (keeps the region,
// e.g. pt-BR or de-CH), otherwise the resolved language. Home Assistant's "pt" is European Portuguese, which Intl would
// format as Brazilian, so bare "pt" becomes "pt-PT". sr-Latn stays as resolved.
const fmtLang = (hass, config) => {
  const l = lang(hass, config);
  const ha = hass && (hass.locale?.language || hass.language);
  const loc = ha && ha.split("-")[0] === l ? ha : l;
  return loc === "pt" ? "pt-PT" : loc;
};

/** A number with `min` to `max` decimals in the locale's notation (decimal comma in French), without grouping. */
const fmtNum = (v, loc, max, min = max) => {
  try {
    return new Intl.NumberFormat(loc, { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false }).format(v);
  } catch {
    return new Intl.NumberFormat("en", { minimumFractionDigits: min, maximumFractionDigits: max, useGrouping: false }).format(v);
  }
};

const t = (hass, config, key) => STRINGS[lang(hass, config)][key] ?? STRINGS.en[key] ?? key;

const num = (s) => {
  if (!s) return null;
  const v = parseFloat(s.state);
  return Number.isFinite(v) ? v : null;
};

// Data sizes: SI prefixes are powers of 1000, binary prefixes (KiB, MiB…) powers of 1024.
const SIZE_FACTORS = {
  bit: 1 / 8, kbit: 125, Mbit: 125e3, Gbit: 125e6,
  B: 1, kB: 1e3, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15,
  KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4, PiB: 1024 ** 5,
};

const toBytes = (s) => {
  const v = num(s);
  if (v === null) return null;
  return v * (SIZE_FACTORS[s.attributes.unit_of_measurement || "B"] ?? 1);
};

/** Data rate sensor in bytes per second (System Monitor reports MB/s by default). */
const toBps = (s) => {
  const v = num(s);
  if (v === null) return null;
  const unit = String(s.attributes.unit_of_measurement || "B/s").replace(/\/s$/, "");
  return v * (SIZE_FACTORS[unit] ?? 1);
};

/** Sizes in powers of 1024, with binary prefixes as Home Assistant shows them (System Monitor reports MiB and GiB). */
const fmtBytes = (b, loc = "en") => {
  if (b === null || b === undefined) return "—";
  const units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB"];
  let i = 0;
  while (b >= 1024 && i < units.length - 1) {
    b /= 1024;
    i++;
  }
  // Up to 2 decimals under 10, 1 under 100, none above; trailing zeros dropped ("1.5 KiB", "20 GiB").
  return `${fmtNum(b, loc, b >= 100 || i === 0 ? 0 : b >= 10 ? 1 : 2, 0)} ${units[i]}`;
};

// "used / total" label: the unit of used is dropped only when it matches the total's ("12.3 / 62.5 GiB", "980 MiB / 62.5 GiB").
const fmtBytesPair = (used, total, loc = "en") => {
  const u = fmtBytes(used, loc).split(" ");
  const t = fmtBytes(total, loc).split(" ");
  return `${u[1] === t[1] ? u[0] : u.join(" ")} / ${t.join(" ")}`;
};

const fmtRate = (bps, loc = "en") => {
  if (bps === null || bps === undefined) return "—";
  const units = ["B/s", "kB/s", "MB/s", "GB/s"];
  let i = 0;
  while (bps >= 1000 && i < units.length - 1) {
    bps /= 1000;
    i++;
  }
  return `${fmtNum(bps, loc, bps >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
};

const fmtUptime = (sec, hass, config) => {
  if (sec === null) return "—";
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} ${t(hass, config, "days")} ${h} ${t(hass, config, "hours")}`;
  if (h > 0) return `${h} ${t(hass, config, "hours")} ${m} ${t(hass, config, "minutes")}`;
  return `${m} ${t(hass, config, "minutes")}`;
};

/** Seconds since the "Last boot" / "Uptime" sensor (a boot timestamp, or a duration). */
const DURATION_FACTORS = { s: 1, min: 60, h: 3600, d: 86400 };
const uptimeSec = (s) => {
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s.state)) return parseFloat(s.state) * (DURATION_FACTORS[s.attributes.unit_of_measurement] ?? 1);
  const boot = Date.parse(s.state);
  return Number.isFinite(boot) ? Math.max(0, (Date.now() - boot) / 1000) : null;
};

/**
 * CPU temperature: Home Assistant converts it to the user's unit (unit system, or the sensor's display unit). The value
 * is shown in that unit, the warning levels and the gauge use it converted to °C.
 */
const TO_CELSIUS = { "°C": (v) => v, "°F": (v) => ((v - 32) * 5) / 9, K: (v) => v - 273.15 };
const temperature = (s, hass) => {
  const v = num(s);
  if (v === null) return { c: null, display: "—", max: 100 };
  const unit = s.attributes?.unit_of_measurement || hass?.config?.unit_system?.temperature || "°C";
  const c = (TO_CELSIUS[unit] || TO_CELSIUS["°C"])(v);
  // The top of its 24 h curve: 100 °C in the sensor's unit (its statistics are in that unit).
  const max = unit === "°F" ? 212 : unit === "K" ? 373.15 : 100;
  return { c, display: `${Math.round(v)}${unit.startsWith("°") ? unit : ` ${unit}`}`, max };
};

const level = (v, warn, crit) => (v === null ? "" : v >= crit ? "crit" : v >= warn ? "warn" : "ok");

// Default warning / critical thresholds: percentages, the CPU temperature in °C. Each can be set in the card options
// (`cpu_warning`, `cpu_critical`, `ram_warning`…).
const THRESHOLDS = {
  cpu_warning: 70,
  cpu_critical: 90,
  ram_warning: 80,
  ram_critical: 95,
  disk_warning: 80,
  disk_critical: 90,
  temp_warning: 75,
  temp_critical: 90,
  swap_warning: 50,
  swap_critical: 80,
  // Days since the last successful automatic backup.
  backup_warning: 2,
  backup_critical: 7,
};

/** A threshold option as a number, or its default when unset or not a number. */
const threshold = (config, key) => {
  const v = config?.[key];
  const n = v === "" || v === null || v === undefined ? Number.NaN : Number(v);
  return Number.isFinite(n) ? n : THRESHOLDS[key];
};

/** The level ("ok", "warn", "crit") of a metric's value against the thresholds of the card's config. */
const metricLevel = (config, metric, v) => level(v, threshold(config, `${metric}_warning`), threshold(config, `${metric}_critical`));

// Home Assistant's theme colour names (the ui_color selector of the visual editor), drawn as `var(--<name>-color)`
// with Home Assistant's default value as fallback (a theme that leaves one out).
const UI_COLORS = {
  primary: "#03a9f4", accent: "#ff9800", red: "#f44336", pink: "#e91e63", purple: "#926bc7", "deep-purple": "#6e41ab",
  indigo: "#3f51b5", blue: "#2196f3", "light-blue": "#03a9f4", cyan: "#00bcd4", teal: "#009688", green: "#4caf50",
  "light-green": "#8bc34a", lime: "#cddc39", yellow: "#ffeb3b", amber: "#ffc107", orange: "#ff9800", "deep-orange": "#ff6f22",
  brown: "#795548", "light-grey": "#bdbdbd", grey: "#9e9e9e", "dark-grey": "#606060", "blue-grey": "#607d8b", black: "#000000",
  white: "#ffffff", disabled: "#bdbdbd",
};

/**
 * A level colour option (ok_color, warning_color, critical_color, #131) as a CSS colour: a Home Assistant colour name,
 * an `[r, g, b]` list (the RGB selector) or any CSS colour (`#43a047`, `rgb(…)`, `var(--x)`); null when unset or
 * unusable (a value that could leave the property is ignored).
 */
const levelColor = (v) => {
  if (Array.isArray(v) && v.length === 3 && v.every((n) => Number.isFinite(Number(n)))) return `rgb(${v.map(Number).join(", ")})`;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || /[;{}<>"'\\]/.test(s)) return null;
  return Object.hasOwn(UI_COLORS, s) ? `var(--${s}-color, ${UI_COLORS[s]})` : s;
};

// The custom property each level colour option sets on the card.
const LEVEL_COLORS = { ok_color: "--sm-level-ok", warning_color: "--sm-warn", critical_color: "--sm-crit" };

const svgIcon = (path, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24"><path d="${path}"/></svg>`;

const pct = (used, free) => (used !== null && free !== null && used + free > 0 ? (used / (used + free)) * 100 : null);

// ---------------------------------------------------------------------------
// Entity discovery
// ---------------------------------------------------------------------------

// Translation keys of the System Monitor sensors that carry an argument (mount point,
// interface or process name), shown at the end of their name.
const ARG_KEYS = {
  disk_free: "disk",
  disk_use: "disk",
  disk_use_percent: "disk",
  network_in: "net",
  network_out: "net",
  throughput_network_in: "net",
  throughput_network_out: "net",
  packets_in: "net",
  packets_out: "net",
  ipv4_address: "net",
  ipv6_address: "net",
  process: "proc",
};
const SCALAR_KEYS = [
  "processor_use",
  "processor_temperature",
  "memory_use_percent",
  "memory_use",
  "memory_free",
  "swap_use_percent",
  "swap_use",
  "swap_free",
  "load_1m",
  "load_5m",
  "load_15m",
  "last_boot",
];
// Alternative translation keys of the same sensors.
const ALIASES = { uptime: "last_boot" };

// Fallback when the entity registry is not available: English entity ids
// (sensor.system_monitor_<name>), as created on an English install.
const FALLBACK = [
  ["throughput_network_in", /^network_throughput_in_(.+)$/],
  ["throughput_network_out", /^network_throughput_out_(.+)$/],
  ["network_in", /^network_in_(.+)$/],
  ["network_out", /^network_out_(.+)$/],
  ["packets_in", /^packets_in_(.+)$/],
  ["packets_out", /^packets_out_(.+)$/],
  ["ipv4_address", /^ipv4_address_(.+)$/],
  ["ipv6_address", /^ipv6_address_(.+)$/],
  ["disk_use_percent", /^disk_usage(?:_(.+))?$/],
  ["disk_use", /^disk_use(?:_(.+))?$/],
  ["disk_free", /^disk_free(?:_(.+))?$/],
  ["processor_use", /^processor_use$/],
  ["processor_temperature", /^processor_temperature$/],
  ["memory_use_percent", /^memory_usage$/],
  ["memory_use", /^memory_use$/],
  ["memory_free", /^memory_free$/],
  ["swap_use_percent", /^swap_usage$/],
  ["swap_use", /^swap_use$/],
  ["swap_free", /^swap_free$/],
  ["load_1m", /^load_1m$/],
  ["load_5m", /^load_5m$/],
  ["load_15m", /^load_15m$/],
  ["last_boot", /^(?:last_boot|uptime)$/],
  ["process", /^process_(.+)$/],
];

// Virtual interfaces hidden by default from the network section.
const VIRTUAL_IF = /^(lo|docker\d*|hassio|veth.*|br-.*|virbr\d*|tun\d*|tap\d*|wg\d*|vlan.*|dummy\d*|tailscale.*)$/;

/**
 * Caches a scan of the entity registry per hass.entities / hass.devices object: Home Assistant
 * replaces them only when a registry changes, whereas hass.states changes with every state.
 * `scan(hass, missing)` adds to `missing` the entities it skipped for lack of a state; the
 * cached result is dropped as soon as one of them gets one. Without the registry (very old
 * Home Assistant), the scan is cached per hass.states as before.
 */
const registryCache = (scan) => {
  const cache = new WeakMap();
  return (hass) => {
    const key = hass.entities || hass.states;
    const hit = cache.get(key);
    if (hit && hit.devices === hass.devices && (hit.states === hass.states || !hit.missing.some((id) => hass.states[id])))
      return hit.value;
    const missing = [];
    const value = scan(hass, missing);
    cache.set(key, { devices: hass.devices, states: hass.states, missing, value });
    return value;
  };
};

/** Words shared at the start (resp. end) of two lists of words. */
const commonPrefix = (a, b) => {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
};
const commonSuffix = (a, b) => {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
};

/** Most frequent of non-zero lengths (the smallest on a tie), or 0 when there is none. */
const modeOf = (lengths) => {
  const count = new Map();
  for (const n of lengths) if (n > 0) count.set(n, (count.get(n) || 0) + 1);
  let best = 0;
  for (const [n, c] of count) if (!best || c > count.get(best) || (c === count.get(best) && n < best)) best = n;
  return best;
};

/** Home Assistant's slugify, which entity ids are made of: lowercase ASCII words joined by "_". */
const slugify = (s) =>
  String(s)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
const objectId = (id) => id.slice(id.indexOf(".") + 1);

// The English entity ids of the sensors with an argument, wherever the device name puts them.
const ENGLISH_IDS = Object.fromEntries(
  FALLBACK.filter(([key]) => ARG_KEYS[key]).map(([key, re]) => [key, new RegExp(`(?:^|_)${re.source.slice(1)}`)])
);

/**
 * Arguments (mount point, interface, process name) of the System Monitor sensors: entity id → argument.
 * `args` are the sensors with an argument ({key, group, id, tokens: words of the friendly name,
 * renamed: a name given in the entity settings}), `plain` the other ones ({id, tokens, renamed}).
 *
 * 1. The name. A friendly name is "<device> <label> <argument>", and the device name is what it
 *    shares with the sensors of the other groups. A mount point starts at the first word starting
 *    with "/" (it may contain spaces: "/mnt/My Passport"), an interface is the last word (Linux
 *    forbids spaces in them), a process is what follows the one-word label ("Process") or the
 *    label the other processes share. A name renamed in the entity settings is not read, nor one
 *    that does not start with the device name (customized: "WAN up").
 * 2. The entity id. Home Assistant made it from the original name, "<base>_<slug of the argument>"
 *    (the base alone for "/"), and renaming a sensor keeps it. The names whose slug ends their id
 *    give the base of their key and the known arguments of their group, by slug.
 * 3. A name is kept unless its id names another known argument: the base of its key followed by
 *    that slug, or, without a base, an id ending with it. So an entity id changed by the user
 *    does not override a right name.
 * 4. A sensor without a name to read takes the argument of its id, mapped back to the known
 *    argument of that slug (the slug is lossy: "/mnt/My Passport" → "mnt_my_passport", "eth0.100"
 *    → "eth0_100"): the rest after the base of its key; without a base (every sensor of the key
 *    renamed), the English id, else the base that makes the most ids of the key end with a known
 *    argument, else the structure of the ids (the words they do not share with the other ids of
 *    the key, or share at their end with the ids of the other keys), else "/" for a mount point,
 *    the last word for an interface, what follows the device and the label for a process.
 */
const resolveArgs = (args, plain = []) => {
  const named = [...args, ...plain].filter((e) => !e.renamed);
  for (const e of args) e.words = objectId(e.id).split("_");

  /** The argument read from the name, or null. */
  const fromName = (e) => {
    if (e.renamed) return null;
    const t = e.tokens;
    const others = named.filter((o) => o.id !== e.id && o.group !== e.group);
    const mates = named.filter((o) => o.id !== e.id && o.group === e.group && o.key !== e.key);
    const device = modeOf(others.map((o) => commonPrefix(t, o.tokens)));
    // A name that does not start like the others was customized ("WAN up"): it says nothing.
    if (!device && (others.length || (mates.length && !modeOf(mates.map((o) => commonPrefix(t, o.tokens)))))) return null;
    const start = device ? device + 1 : 1;
    if (e.group === "disk") {
      const i = t.findIndex((w, j) => j >= start && w.startsWith("/"));
      return i < 0 ? null : t.slice(i).join(" ");
    }
    if (e.group === "net") return t.length > start ? t[t.length - 1] : null;
    const procs = named.filter((o) => o.group === "proc" && o.id !== e.id && o.tokens.join(" ") !== t.join(" "));
    let label = modeOf(procs.map((o) => commonPrefix(t, o.tokens)));
    if (device && (!label || device + 1 < label)) label = device + 1;
    return label && label < t.length ? t.slice(label).join(" ") : null;
  };
  for (const e of args) e.name = fromName(e);

  // Base of each key: the one most of its names agree on (the shortest on a tie).
  const votes = {};
  for (const e of args) {
    if (e.name === null) continue;
    const s = slugify(e.name);
    const o = objectId(e.id);
    const base = !s ? o : o.endsWith(`_${s}`) ? o.slice(0, -s.length - 1) : null;
    if (base === null) continue;
    const m = (votes[e.key] ??= new Map());
    m.set(base, (m.get(base) || 0) + 1);
  }
  const bases = {};
  for (const [key, m] of Object.entries(votes)) bases[key] = [...m].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0];
  /** The slug of the argument after the base of the key in the entity id, or null when it does not start with it. */
  const restOf = (e) => {
    const b = bases[e.key];
    const o = objectId(e.id);
    if (b === undefined) return null;
    const r = o === b ? "" : o.startsWith(`${b}_`) ? o.slice(b.length + 1) : null;
    return r === "" && e.group !== "disk" ? null : r;
  };
  // Known arguments of each group, by slug: the names that their id confirms.
  const known = {};
  for (const e of args) {
    if (e.name === null || restOf(e) !== slugify(e.name)) continue;
    const k = (known[e.group] ??= new Map());
    if (!k.has(slugify(e.name))) k.set(slugify(e.name), e.name);
  }
  const isKnown = (e, r) => !!known[e.group]?.has(r) && (r !== "" || e.group === "disk");

  /** An argument from its slug: the known one, else the end of the sensor's own name of that slug, else the slug itself ("/" and its words for a mount). */
  const fromSlug = (e, r) => {
    const a = known[e.group]?.get(r);
    if (a !== undefined) return a;
    // A name given in the entity settings is not the original one.
    for (let i = e.tokens.length - 1; i >= 0 && !e.renamed; i--) {
      const tail = e.tokens.slice(i).join(" ");
      if (slugify(tail) === r && (e.group !== "disk" || tail.startsWith("/"))) return tail;
    }
    return e.group === "disk" ? `/${r.replace(/_/g, "/")}` : r;
  };

  /** The slug of the argument in an id without the base of its key that only an English id or a known argument tells for sure, or null. */
  const sureSlug = (e) => {
    const m = objectId(e.id).match(ENGLISH_IDS[e.key]);
    if (m) return m[1] ?? "";
    // The base (a start of this id) that makes the most ids of the key end with a known argument; on a tie, the longest argument.
    const ids = args.filter((x) => x.key === e.key);
    let best = null;
    for (let n = 0; n <= e.words.length; n++) {
      const base = e.words.slice(0, n);
      const r = e.words.slice(n).join("_");
      if (!isKnown(e, r)) continue;
      const score = ids.filter((x) => commonPrefix(x.words, base) === n && isKnown(e, x.words.slice(n).join("_"))).length;
      if (!best || score > best.score || (score === best.score && r.length > best.r.length)) best = { score, r };
    }
    return best ? best.r : null;
  };

  /** The slug of the argument read from the structure of the ids, or null. */
  const shapeSlug = (e) => {
    const w = e.words;
    // The words the id does not share with the other ids of its key ("" for "/", the only argument without slug).
    const p = args.filter((x) => x.key === e.key && x.id !== e.id).map((x) => commonPrefix(w, x.words));
    let r1 = null;
    if (p.length && Math.min(...p) > 0) {
      const n = Math.min(...p);
      if (n < w.length || e.group === "disk") r1 = w.slice(n).join("_");
    }
    // The words it shares at its end with the ids of the other keys of its group, the most of them agree on.
    const n2 = modeOf(
      [...new Set(args.filter((x) => x.group === e.group && x.key !== e.key).map((x) => x.key))].map((k) =>
        Math.max(0, ...args.filter((x) => x.key === k).map((x) => commonSuffix(w, x.words)))
      )
    );
    const r2 = n2 && n2 < w.length ? w.slice(-n2).join("_") : null;
    if (r1 === null) return r2;
    return r2 !== null && r2.length > r1.length ? r2 : r1;
  };

  /** The last resort: "/" for a mount, the last word for an interface, what follows the device and the label for a process. */
  const lastSlug = (e) => {
    if (e.group === "disk") return "";
    if (e.group === "net") return e.words[e.words.length - 1];
    const device = modeOf([...args, ...plain].filter((o) => o.group !== "proc").map((o) => commonPrefix(e.words, objectId(o.id).split("_"))));
    return device && device + 1 < e.words.length ? e.words.slice(device + 1).join("_") : e.words[e.words.length - 1];
  };

  const out = new Map();
  for (const e of args) {
    const r = restOf(e);
    let arg;
    if (e.name !== null) {
      // The name, unless its id names another known argument (the name was customized but still reads like one).
      const id = r ?? (bases[e.key] === undefined ? sureSlug(e) : null);
      arg = id !== null && id !== slugify(e.name) && isKnown(e, id) ? fromSlug(e, id) : e.name;
    } else arg = fromSlug(e, r ?? sureSlug(e) ?? shapeSlug(e) ?? lastSlug(e));
    out.set(e.id, arg);
  }
  return out;
};

/** Map the System Monitor entities to a structured object of entity ids. */
const discovered = registryCache((hass, missing) => {
  const sm = { scalars: {}, disks: {}, nets: {}, procs: {}, found: false };
  const args = []; // Sensors with an argument, resolved once all the names are known.
  const plain = []; // The other ones, whose names tell the device name.
  const add = (key, id) => {
    sm.found = true;
    const group = ARG_KEYS[key];
    const name = hass.states[id]?.attributes?.friendly_name || "";
    // A name given in the entity settings: it no longer says the argument.
    const sensor = { key, group: group || "scalar", id, tokens: name.split(" "), renamed: !!hass.entities?.[id]?.name };
    if (group) args.push(sensor);
    else {
      sm.scalars[key] ??= id;
      plain.push(sensor);
    }
  };

  const registry = hass.entities ? Object.values(hass.entities).filter((e) => e.platform === "systemmonitor") : [];
  if (registry.length) {
    for (const e of registry.sort((a, b) => a.entity_id.localeCompare(b.entity_id))) {
      if (e.hidden) continue;
      if (!hass.states[e.entity_id]) {
        missing.push(e.entity_id);
        continue;
      }
      const key = ALIASES[e.translation_key] || e.translation_key;
      if (ARG_KEYS[key] || SCALAR_KEYS.includes(key)) add(key, e.entity_id);
      // The "Last boot" sensor has no translation key (it is named after its "uptime" device class).
      else if (!e.translation_key && hass.states[e.entity_id].attributes.device_class === "uptime") add("last_boot", e.entity_id);
    }
  } else {
    for (const id of Object.keys(hass.states).sort()) {
      const m = id.match(/^(?:sensor|binary_sensor)\.system_monitor_(.+)$/);
      if (!m) continue;
      for (const [key, re] of FALLBACK) {
        const f = m[1].match(re);
        if (f) {
          add(key, id);
          break;
        }
      }
    }
  }

  const resolved = resolveArgs(args, plain);
  for (const e of args) {
    const a = resolved.get(e.id);
    if (e.group === "proc") sm.procs[a] ??= e.id;
    else ((e.group === "disk" ? sm.disks : sm.nets)[a] ??= {})[e.key] ??= e.id;
  }

  // Home Assistant update entities, for the header (Core / OS versions).
  // From the states as before, and from the registry so that one without a state yet is picked up when it gets one.
  for (const id of new Set([...Object.keys(hass.states), ...Object.keys(hass.entities || {})])) {
    const key = /^update\.home_assistant_core(_|$)/.test(id) ? "core_update" : /^update\.home_assistant_operating_system(_|$)/.test(id) ? "os_update" : null;
    if (!key) continue;
    if (!hass.states[id]) missing.push(id);
    else sm[key] ??= id;
  }

  return sm;
});

// The `entities` option: sensors of the user's choice, for a value System Monitor does not give or gives under
// another name (a disk of another integration, a sensor of their own). Scalars by their key, disks by name
// (a usage % sensor, or { use_percent, use, free }), interfaces by name ({ in, out, ipv4 }). They replace the
// discovered ones of the same key or name, and are added to the others.
const DISK_KEYS = { use_percent: "disk_use_percent", use: "disk_use", free: "disk_free" };
const NET_KEYS = { in: "throughput_network_in", out: "throughput_network_out", ipv4: "ipv4_address" };
const isEntityId = (v) => typeof v === "string" && /^[a-z_]+\.[a-z0-9_]+$/.test(v);

const withEntities = (sm, entities) => {
  if (!entities || typeof entities !== "object") return sm;
  const out = { ...sm, scalars: { ...sm.scalars }, disks: { ...sm.disks }, nets: { ...sm.nets }, procs: { ...sm.procs } };
  for (const key of SCALAR_KEYS) if (isEntityId(entities[key])) out.scalars[key] = entities[key];
  const group = (value, keys, plain) => {
    if (isEntityId(value)) return { [plain]: value };
    if (!value || typeof value !== "object") return null;
    const ids = Object.fromEntries(Object.entries(keys).filter(([k]) => isEntityId(value[k])).map(([k, key]) => [key, value[k]]));
    return Object.keys(ids).length ? ids : null;
  };
  for (const [name, value] of Object.entries(entities.disks || {})) {
    const ids = group(value, DISK_KEYS, "disk_use_percent");
    if (ids) out.disks[name] = ids;
  }
  for (const [name, value] of Object.entries(entities.interfaces || {})) {
    const ids = group(value, NET_KEYS, "throughput_network_in");
    if (ids) out.nets[name] = ids;
  }
  out.found = sm.found || Object.keys(out.scalars).length > 0 || Object.keys(out.disks).length > 0;
  return out;
};

// The discovery with the card's `entities`, one result per discovery and option (a stable object while neither
// changes, as the discovery itself).
const withEntitiesCache = new WeakMap();
const discover = (hass, config) => {
  const sm = discovered(hass);
  const entities = config?.entities;
  if (!entities) return sm;
  const key = JSON.stringify(entities);
  const hit = withEntitiesCache.get(sm);
  if (hit?.key === key) return hit.result;
  const result = withEntities(sm, entities);
  withEntitiesCache.set(sm, { key, result });
  return result;
};

/** Network interfaces to display: the configured one, else the physical ones with a throughput sensor. */
const interfaces = (sm, config) => {
  const all = Object.keys(sm.nets).filter((i) => sm.nets[i].throughput_network_in || sm.nets[i].throughput_network_out);
  if (config.interface) return all.includes(config.interface) ? [config.interface] : [];
  const physical = all.filter((i) => !VIRTUAL_IF.test(i));
  return physical.length ? physical : all;
};

/** Main IPv4 address: the one of the first displayed interface, else the first physical one. */
const mainIp = (hass, sm, config) => {
  const order = [...interfaces(sm, config), ...Object.keys(sm.nets).filter((i) => !VIRTUAL_IF.test(i))];
  for (const i of order) {
    const s = hass.states[sm.nets[i]?.ipv4_address];
    if (s?.state && !["unknown", "unavailable"].includes(s.state)) return s;
  }
  return null;
};

/** Used/total bytes and percentage of a mount point. */
const diskUsage = (hass, d) => {
  const used = toBytes(hass.states[d.disk_use]);
  const free = toBytes(hass.states[d.disk_free]);
  const p = num(hass.states[d.disk_use_percent]) ?? pct(used, free);
  return { used, total: used !== null && free !== null ? used + free : null, pct: p };
};

const memUsage = (hass, sc, prefix) => {
  const used = toBytes(hass.states[sc[`${prefix}_use`]]);
  const free = toBytes(hass.states[sc[`${prefix}_free`]]);
  const p = num(hass.states[sc[`${prefix}_use_percent`]]) ?? pct(used, free);
  return { used, total: used !== null && free !== null ? used + free : null, pct: p };
};

/** A state that tells nothing: the entity is unavailable (integration failed or unloaded) or not reported yet. */
const isUnknown = (s) => !s || s.state === "unavailable" || s.state === "unknown";

/**
 * Core / OS update status: the update entity with a pending update, else the first one that is unavailable
 * (Supervisor unreachable, for example), which tells nothing: neither "up to date" nor "running".
 */
const updateStatus = (core, os) => {
  const pending = [core, os].find((s) => s && s.state === "on");
  return { pending, unknown: !pending && [core, os].find((s) => s && isUnknown(s)) };
};

/** Registry entries of a platform that have a state; the others are listed in `missing`. */
const platformEntities = (hass, platform, missing) =>
  Object.values(hass.entities || {}).filter((e) => {
    if (e.platform !== platform) return false;
    if (!hass.states[e.entity_id]) missing.push(e.entity_id);
    return !!hass.states[e.entity_id];
  });

/**
 * Size of the Home Assistant database (recorder), from the File Size integration
 * (platform "filesize") watching the "home-assistant_v2.db" file: its size sensor, in MB.
 */
const discoverDatabase = registryCache((hass, missing) => {
  for (const e of platformEntities(hass, "filesize", missing)) {
    if (!e.entity_id.startsWith("sensor.") || e.hidden) continue;
    const s = hass.states[e.entity_id];
    // The size sensor ("size"), not the one in bytes ("size_bytes") nor the timestamps.
    if (e.translation_key ? e.translation_key !== "size" : s.attributes.device_class !== "data_size" || s.attributes.unit_of_measurement === "B") continue;
    const dev = hass.devices?.[e.device_id];
    const name = `${dev?.name || ""} ${e.entity_id} ${s.attributes.friendly_name || ""}`;
    if (/home.assistant_v2[._]db/i.test(name)) return e.entity_id;
  }
  return null;
});

/**
 * Home Assistant's own backup sensors (platform "backup", Home Assistant 2025.2+): the manager's state and the
 * last successful, last attempted and next scheduled automatic backups, by translation key.
 */
const BACKUP_KEYS = ["backup_manager_state", "last_successful_automatic_backup", "last_attempted_automatic_backup", "next_scheduled_automatic_backup"];
const discoverBackup = registryCache((hass, missing) => {
  const found = {};
  for (const e of platformEntities(hass, "backup", missing)) {
    if (e.entity_id.startsWith("sensor.") && BACKUP_KEYS.includes(e.translation_key)) found[e.translation_key] = e.entity_id;
  }
  return found.last_successful_automatic_backup || found.next_scheduled_automatic_backup ? found : null;
});

/** Relative time of a date ("2 days ago", "in 5 hours"), in minutes, hours or days. */
const fmtRelative = (ms, loc) => {
  const sec = (ms - Date.now()) / 1000;
  const abs = Math.abs(sec);
  const [v, unit] = abs < 3600 ? [sec / 60, "minute"] : abs < 172800 ? [sec / 3600, "hour"] : [sec / 86400, "day"];
  try {
    return new Intl.RelativeTimeFormat(loc, { numeric: "auto" }).format(Math.round(v), unit);
  } catch {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(Math.round(v), unit);
  }
};

const dateOf = (s) => {
  const ms = isUnknown(s) ? Number.NaN : Date.parse(s.state);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * Where the automatic backups stand: the entity to open, the level ("ok", "warn", "crit") and what to show. A backup
 * older than `backup_warning` days is a warning, older than `backup_critical` days (or never made, or the last attempt
 * failed) is critical; one running is neither.
 */
const backupStatus = (hass, config, b) => {
  const st = (k) => (b[k] ? hass.states[b[k]] : undefined);
  const last = dateOf(st("last_successful_automatic_backup"));
  const attempt = dateOf(st("last_attempted_automatic_backup"));
  const next = dateOf(st("next_scheduled_automatic_backup"));
  const running = ["create_backup", "receive_backup", "restore_backup"].includes(st("backup_manager_state")?.state);
  // An attempt more than a minute after the last success did not succeed (the success is stamped at its end).
  const failed = !running && attempt !== null && (last === null || attempt - last > 60000);
  const days = last === null ? null : (Date.now() - last) / 86400000;
  const lvl = running ? "ok" : failed || last === null ? "crit" : level(days, threshold(config, "backup_warning"), threshold(config, "backup_critical"));
  return { id: b.last_successful_automatic_backup || b.next_scheduled_automatic_backup, last, next, running, failed, level: lvl };
};

/** Entity ids a card reads its states from: a change of any other state doesn't re-render it. */
const trackedIds = (hass, config) => {
  const sm = discover(hass, config);
  const ids = [...Object.values(sm.scalars), ...Object.values(sm.procs), sm.core_update, sm.os_update];
  for (const group of [sm.disks, sm.nets]) for (const g of Object.values(group)) ids.push(...Object.values(g));
  ids.push(discoverDatabase(hass), ...Object.values(discoverBackup(hass) || {}));
  return ids;
};

/**
 * What a render depends on besides the card's own state: the tracked states (compared by
 * identity, Home Assistant replaces a state object when it changes), the registries, the user,
 * the language, and the current minute for the uptime and the relative times ("2 minutes ago").
 */
const renderSignature = (hass, config) => [
  hass.entities,
  !!hass.themes?.darkMode,
  hass.devices,
  hass.user,
  hass.language,
  hass.locale,
  hass.config,
  Math.floor(Date.now() / 60000),
  ...trackedIds(hass, config).map((id) => hass.states[id]),
];

const sameSignature = (a, b) => !!a && a.length === b.length && a.every((v, i) => v === b[i]);


/** CSS attribute selector matching an attribute value exactly. */
const attrSel = (name, value) => `[${name}="${String(value).replace(/["\\]/g, "\\$&")}"]`;

/** Selector finding the same clickable element again after a re-render, from its data-* attributes. */
const focusSelector = (el) => {
  const d = el?.dataset;
  // Buttons, and rows or tiles that open an entity from the keyboard.
  const entityButton = d?.entity && el.getAttribute?.("role") === "button";
  if (!d?.action && !entityButton) return null;
  const sel = ["action", "target", "path", "entity"]
    .filter((k) => d[k] !== undefined)
    .map((k) => attrSel(`data-${k}`, d[k]))
    .join("");
  return d.action ? sel : `[role="button"]${sel}`;
};

const fireMoreInfo = (node, entityId) => {
  if (!entityId) return;
  node.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
};

/** `tap_action: none` (or `{ action: none }`, as the visual editor saves it): a click on the card opens no entity. */
const tapNone = (config) => (config?.tap_action?.action ?? config?.tap_action) === "none";

/**
 * With `tap_action: none`, the elements that only open an entity (gauges, tiles, rows, pills) are no longer buttons:
 * no entity to open, no role, no tab stop, no pointer. The ones that also act (a fold, the zoom) keep their action.
 */
const inertHtml = (html) =>
  html.replace(/<[a-z][\w-]*\s[^>]*\bdata-entity="[^"]*"[^>]*>/g, (tag) =>
    /\bdata-action="/.test(tag)
      ? tag.replace(/\s*\bdata-entity="[^"]*"/, "")
      : tag
          .replace(/\s*\bdata-entity="[^"]*"/, "")
          .replace(/\s*\brole="button"/, "")
          .replace(/\s*\btabindex="0"/, "")
          .replace(/(\bclass="[^"]*?)\bclickable\b ?/, "$1")
  );

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------


const BASE_STYLE = `
  /* A block host: in Home Assistant the card sits in hui-card (no display), and an inline host has no size of its own. */
  /* Home Assistant's <ha-icon> is inline: as a box of its own, its icon is centred in its badge */
  ha-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; line-height: 0; }
  :host { display: block; }
  /* ok_color / warning_color / critical_color (#131) set --sm-level-ok, --sm-warn and --sm-crit on the host itself. */
  :host { --sm-blue: #18bcf2; --sm-ok: var(--success-color, #43a047); --sm-warn: var(--warning-color, #ffa600); --sm-crit: var(--error-color, #db4437);
          --sm-focus: var(--primary-color, #03a9f4); }
  /* Status colours tint pills, dots, bars, rings and icons; text in a status colour is mixed with the text colour
     (45 %), so that it reads at 4.5:1 or more on its tinted background in light and dark themes alike. */
  ha-card { overflow: hidden; position: relative; }
  ha-card.dialog-open { min-height: 220px; }
  .icon { width: 18px; height: 18px; fill: currentColor; flex: none; }
  .muted { color: var(--secondary-text-color); --c: var(--secondary-text-color); }
  .clickable { cursor: pointer; }
  .clickable:focus-visible, [role="button"]:focus-visible { outline: 2px solid var(--sm-focus); outline-offset: -2px; }
  .ok { --c: var(--sm-level-ok, var(--sm-blue)); } .warn { --c: var(--sm-warn); } .crit { --c: var(--sm-crit); } .good { --c: var(--sm-ok); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c, var(--sm-ok)); flex: none; display: inline-block; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500;
          background: color-mix(in srgb, var(--c, var(--sm-ok)) 15%, transparent); color: color-mix(in srgb, var(--c, var(--sm-ok)) 45%, var(--primary-text-color)); }
  .bar { height: 4px; border-radius: 3px; background: var(--divider-color, rgba(127,127,127,.25)); overflow: hidden; }
  .bar > div { height: 100%; border-radius: 3px; background: var(--c, var(--sm-blue)); }
  .header { display: flex; align-items: center; gap: 10px; padding: 12px 12px 8px; container: sm-header / inline-size; }
  /* The title keeps 4 letters and its ellipsis ("Home…", 6.5ch of the 16 px title): the block measures its minimum in the
     title's font (its other lines set their own sizes). */
  .titles { flex: 1 1 0; min-width: 6.5ch; font-size: 16px; }
  /* The status pill shares the title's line, centred on it whatever the subtitle or the logo size. The title grows
     from 0 (flex-basis 0): the pill keeps its whole text while the title can still give way, down to a few letters
     (then an ellipsis); only then is the pill cut, and on a narrow header it shows its dot only (its text stays in
     title and aria-label). The buttons never shrink. */
  .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Round icon of the showcase site, tinted with the status colour like the pill. */
  .logo { flex: none; border-radius: 50%; display: grid; place-items: center;
          background: color-mix(in srgb, var(--c, var(--sm-ok)) 16%, transparent); }
  .logo .icon { width: 24px; height: 24px; fill: currentColor; color: var(--c, var(--sm-ok)); }
  /* The status pill: on the title row, 8 px after the title, only when the whole title and the pill's whole label fit
     there; otherwise on its own line under the subtitle, which then keeps one line; its dot alone at 200 px or less
     or when its label does not fit the title block (its text stays in its title and for screen readers). Measured
     after each render (_fitPill), in every language, never by a fixed width. */
  .title-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; }
  .title-row > .name { flex: 0 1 auto; min-width: 0; }
  .title-row > .chip { flex: none; min-width: auto; max-width: none; overflow: visible; align-self: center; margin-top: 0; }
  .title-row > .chip .chip-text { min-width: auto; overflow: visible; white-space: nowrap; display: inline; -webkit-line-clamp: none; line-clamp: none; }
  .titles.pill-below { display: flex; flex-direction: column; align-items: stretch; }
  .titles.pill-below > * { order: 3; }
  .titles.pill-below > .title-row { display: contents; }
  .titles.pill-below > .sub { order: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .titles.pill-below > .title-row > .chip { order: 2; align-self: flex-start; margin-top: 2px; }
  .titles.pill-dot > .title-row > .chip { padding: 4px; gap: 0; }
  .titles.pill-dot > .title-row > .chip .dot { display: block; }
  .titles.pill-dot > .title-row > .chip .chip-text { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  /* Under the cards' minimum width (6 columns of a 320 px screen, 132 px inside the header), as in a flex row of two
     cards: the logo gives its room, so that the title keeps 4 letters and the zoom button stays inside. */
  @container sm-header (max-width: 131px) {
    .header .logo { display: none; }
  }
  .warning { padding: 16px; color: color-mix(in srgb, var(--sm-warn) 45%, var(--primary-text-color)); }
  /* Zoom button of the mini card: in the card's top right corner (24 px, round); the header keeps clear of it. */
  .zoom { all: unset; position: absolute; z-index: 2; top: 5px; right: 5px; cursor: pointer; width: 24px; height: 24px; border-radius: 50%;
          display: grid; place-items: center; color: var(--secondary-text-color);
          background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); }
  .header:has(> .zoom) { padding-right: 38px; }
  .zoom .icon { width: 16px; height: 16px; }
  .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color: var(--primary-text-color); }
  .zoom:focus-visible { outline: 2px solid var(--sm-focus); outline-offset: 1px; }
  :host([hide-title]) .titles .name, :host([hide-subtitle]) .titles > .sub { display: none; }
`;

// Sparkline of a series of [time (ms), value] points (24 h of 5-minute means), on a real time axis: x is the
// point's time over the 24 h window ending at `end`, y its value scaled from 0 to `max` (100 for a percentage), else
// to the series' peak. Points more than
// two periods apart are not joined: the curve breaks where the recorder has no data. Runs of a single point are not
// drawn; nothing at all without a run of two points.
const HIST_REFRESH = 5 * 60000;
const HIST_WINDOW = 864e5;
const HIST_PERIOD = 5 * 60000;
function spark(points, end, max) {
  if (!points || points.length < 2) return "";
  const start = end - HIST_WINDOW;
  const inWindow = points.filter(([at]) => at >= start && at <= end).sort((a, b) => a[0] - b[0]);
  const runs = [];
  let run = [];
  for (const p of inWindow) {
    if (run.length && p[0] - run[run.length - 1][0] > 2 * HIST_PERIOD) {
      runs.push(run);
      run = [];
    }
    run.push(p);
  }
  runs.push(run);
  const drawn = runs.filter((r) => r.length >= 2);
  if (!drawn.length) return "";
  const peak = max || Math.max(...drawn.flat().map(([, v]) => v)) || 1;
  const x = (at) => (((at - start) / HIST_WINDOW) * 100).toFixed(2);
  const y = (v) => (30 - (Math.min(Math.max(0, v), peak) / peak) * 28).toFixed(2);
  const lines = drawn.map((r) => `M${r.map(([at, v]) => `${x(at)},${y(v)}`).join("L")}`);
  const areas = drawn.map((r, i) => `M${x(r[0][0])},30L${lines[i].slice(1)}L${x(r[r.length - 1][0])},30Z`);
  return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><path class="spark-a" d="${areas.join("")}"/><path class="spark-l" d="${lines.join(
    ""
  )}"/></svg>`;
}

/** Time of a recorder statistics row in ms: a number (Home Assistant 2023.3 and later) or an ISO date string. */
const statTime = (p) => (typeof p.start === "number" ? p.start : Date.parse(p.start));

// The parts of the header that hold the status pill (see _fitPill).
const SM_PILL = { block: ".titles", row: ".title-row", name: ".name", chip: ".chip", sub: ".sub" };

// ── Illustrated header (same as the Status card's, system-hub-card.js) ──
// A 90 px banner wraps the card's own header (icon, title, status pill, subtitle, buttons): the card's picture at its
// right (this card's part of the Status picture, large, in the card's tone), a 10 px concrete floor edge to
// edge under it, the header on the open background at its left and its buttons as small frosted buttons in the top
// right corner. Night: illustration_theme, else the dark theme. `illustration: false`
// keeps the classic header. Applied to the rendered markup, so that it fits every card's own render.
var SHB_COLORS = { good: '#43a047', warn: '#f5a623', bad: '#e5484d', info: '#2f80ed', idle: '#8a96a6' };
var SHB_TONES = { ok: 'good', good: 'good', clean: 'good', success: 'good', up_to_date: 'good', warn: 'warn', warning: 'warn', pending: 'warn', dirty: 'warn',
  alert: 'bad', crit: 'bad', critical: 'bad', error: 'bad', bad: 'bad', failed: 'bad', fail: 'bad', na: 'idle', muted: 'idle', unknown: 'idle', idle: 'idle', info: 'info' };
var SHB_GLYPHS = {
  git: 'M13,14C9.64,14 8.54,15.35 8.18,16.24C9.25,16.7 10,17.76 10,19A3,3 0 0,1 7,22A3,3 0 0,1 4,19C4,17.69 4.83,16.58 6,16.17V7.83C4.83,7.42 4,6.31 4,5A3,3 0 0,1 7,2A3,3 0 0,1 10,5C10,6.31 9.17,7.42 8,7.83V13.12C8.88,12.47 10.16,12 12,12C14.67,12 15.56,10.66 15.85,9.77C14.77,9.32 14,8.25 14,7A3,3 0 0,1 17,4A3,3 0 0,1 20,7C20,8.34 19.12,9.5 17.91,9.86C17.65,11.29 16.68,14 13,14M7,18A1,1 0 0,0 6,19A1,1 0 0,0 7,20A1,1 0 0,0 8,19A1,1 0 0,0 7,18M7,4A1,1 0 0,0 6,5A1,1 0 0,0 7,6A1,1 0 0,0 8,5A1,1 0 0,0 7,4M17,6A1,1 0 0,0 16,7A1,1 0 0,0 17,8A1,1 0 0,0 18,7A1,1 0 0,0 17,6Z',
  orphans: 'M13.04 19.61C12.67 18.55 11.68 17.8 10.5 17.8C9 17.8 7.8 19 7.8 20.5V22H4C2.9 22 2 21.11 2 20V16.2H3.5C5 16.2 6.2 15 6.2 13.5S5 10.8 3.5 10.8H2V7C2 5.9 2.9 5 4 5H8V3.5C8 2.12 9.12 1 10.5 1S13 2.12 13 3.5V5H17C18.1 5 19 5.89 19 7V11H20.5C21.88 11 23 12.12 23 13.5C23 13.82 22.94 14.12 22.83 14.39C21.79 13.53 20.46 13 19 13C15.69 13 13 15.69 13 19C13 19.2 13 19.41 13.04 19.61M21.12 15.46L19 17.59L16.88 15.46L15.47 16.88L17.59 19L15.47 21.12L16.88 22.54L19 20.41L21.12 22.54L22.54 21.12L20.41 19L22.54 16.88L21.12 15.46Z',
  automations: 'M17.5 15.5C17.5 16.61 16.61 17.5 15.5 17.5S13.5 16.61 13.5 15.5 14.4 13.5 15.5 13.5 17.5 14.4 17.5 15.5M8.5 13.5C7.4 13.5 6.5 14.4 6.5 15.5S7.4 17.5 8.5 17.5 10.5 16.61 10.5 15.5 9.61 13.5 8.5 13.5M23 15V18C23 18.55 22.55 19 22 19H21V20C21 21.11 20.11 22 19 22H5C3.9 22 3 21.11 3 20V19H2C1.45 19 1 18.55 1 18V15C1 14.45 1.45 14 2 14H3C3 10.13 6.13 7 10 7H11V5.73C10.4 5.39 10 4.74 10 4C10 2.9 10.9 2 12 2S14 2.9 14 4C14 4.74 13.6 5.39 13 5.73V7H14C17.87 7 21 10.13 21 14H22C22.55 14 23 14.45 23 15M21 16H19V14C19 11.24 16.76 9 14 9H10C7.24 9 5 11.24 5 14V16H3V17H5V20H19V17H21V16Z',
};

function shbIsNight(hass, config) {
  if (config?.illustration_theme === 'night') return true;
  if (config?.illustration_theme === 'day') return false;
  return !!hass?.themes?.darkMode;
}

// The card's part of the Status picture as a small scene of its own, drawn like the Status one: a main piece in the
// colour of the card's status, the pieces it watches around it on dashed links. The top right corner stays clear
// for the header's buttons.
function shbScene(scene, tone, n) {
  var c = SHB_COLORS[tone] || SHB_COLORS.good;
  var good = SHB_COLORS.good;
  var blue = '#2f80ed';
  var ok = tone === 'good' || tone === 'info';
  var bad = tone === 'bad';
  var line = n ? '#2e3a4e' : '#c9d2de';
  var face = n ? '#3a4456' : '#fff';
  var edge = n ? '#55617a' : '#c9d2de';
  var ink = n ? '#e6e9ee' : '#2a3038';
  var dim = n ? '#2e3a4e' : '#dfe6ef';
  var cell = n ? '#8fa3c4' : '#5f6b7a';
  var at = (x, y, body, s) => `<g transform="translate(${x} ${y})${s ? ` scale(${s})` : ''}">${body}</g>`;
  var tile = (w, h, inner, stroke) => `<rect x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="${Math.min(5, h / 4)}" fill="${face}" stroke="${stroke || edge}"/>${inner || ''}`;
  var icon = (d, col, size) => `<path transform="translate(${-size / 2} ${-size / 2}) scale(${size / 24})" d="${d}" fill="${col}"/>`;
  var led = (x, y, col, blink) => `<circle${blink ? ' class="shb-blink"' : ''} cx="${x}" cy="${y}" r="1.5" fill="${col}"/>`;
  var links = (...l) => `<g stroke="${line}" stroke-width="1" stroke-dasharray="2 2">${l.map(([a, b, x, y]) => `<line x1="${a}" y1="${b}" x2="${x}" y2="${y}"/>`).join('')}</g>`;
  var ping = (r) => (ok ? `<circle class="shb-ping" r="${r}" fill="none" stroke="${good}" stroke-width=".8"/>` : '');
  var pop = (x, y, text) => `<g class="shb-pop"><circle cx="${x}" cy="${y}" r="4" fill="${c}"/><text x="${x}" y="${y + 1.8}" text-anchor="middle" font-size="5.4" font-weight="700" fill="#fff" font-family="sans-serif">${text}</text></g>`;
  var battery = (lv, col, blink) =>
    `<rect x="-6" y="-10" width="12" height="20" rx="2" fill="${face}" stroke="${cell}" stroke-width="1.4"/><rect x="-2" y="-12" width="4" height="2" fill="${cell}"/><rect${blink ? ' class="shb-blink"' : ''} x="-4" y="${8 - lv}" width="8" height="${lv}" rx="1" fill="${col}"/>`;
  var mark = bad ? 'M-2 -2.6 l4 4 M2 -2.6 l-4 4' : tone === 'warn' ? 'M0 -3 v2.8 M0 2 v.2' : 'M-2.2 -.4 l1.6 1.6 l3 -3.2';
  var shield = `<path d="M0 -8 l6.4 2.4 v4.4 c0 4 -2.8 6.6 -6.4 8.2 c-3.6 -1.6 -6.4 -4.2 -6.4 -8.2 v-4.4z" fill="${c}" stroke="${n ? '#1c2230' : '#fff'}" stroke-width=".8"/><path d="${mark}" stroke="#fff" stroke-width="1.5" stroke-linecap="round" fill="none"/>`;
  // The pieces around the main one: left top, left bottom, right bottom; the main one sits at (142 50).
  var hub = (inner, w = 34, h = 30) => at(142, 50, tile(w, h, inner, bad ? c : edge));
  var around = links([125, 44, 110, 30], [125, 56, 112, 60], [159, 54, 168, 57]);
  var body;
  if (scene === 'watchdog') {
    var piece = (col, blink, spin) =>
      tile(20, 18, `${icon(SHB_PUZZLE, n ? '#8fa3c4' : '#7a8899', 10)}${led(6.5, 5, col, blink)}${spin ? `<path class="shb-spin" d="M-10 -13.5 a4.5 4.5 0 1 1 -4.5 4.5" stroke="${col}" stroke-width="1.3" fill="none" stroke-linecap="round"/>` : ''}`);
    body = `${around}${at(100, 26, piece(good))}${at(100, 60, piece(ok ? good : c, !ok, !ok))}${at(178, 58, piece(good))}${at(142, 50, `${shield}${ping(10)}`, 1.9)}`;
  } else if (scene === 'batteries') {
    var level = bad ? 3 : tone === 'warn' ? 6 : 14;
    body = `${at(98, 61, battery(15, good), 0.75)}${at(118, 58, battery(11, good), 0.95)}${at(146, 50, battery(level, c, bad), 1.45)}${at(176, 59, battery(13, good), 0.85)}${ok ? at(146, 50, ping(16)) : ''}`;
  } else if (scene === 'marketplace') {
    var arrow = (col) => `<circle r="7" fill="${face}" stroke="${col}"/><path class="shb-up" d="M0 3 v-6 m-3 3 l3 -3 l3 3" stroke="${col}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
    body = `${around}${at(100, 26, arrow(blue))}${at(100, 60, arrow(ok ? blue : c))}${at(178, 58, arrow(blue))}${hub(`${icon(SHB_STORE, blue, 18)}${ok ? '' : pop(15, -13, '!')}`)}${ok ? at(142, 50, ping(19)) : ''}`;
  } else if (scene === 'system') {
    var fill = bad ? 92 : tone === 'warn' ? 70 : 38;
    var chip = tile(18, 18, `<rect x="-4.5" y="-4.5" width="9" height="9" rx="1.5" fill="${blue}"/><g stroke="${edge}" stroke-width="1">${[-3, 0, 3].map((v) => `<line x1="${v}" y1="-9" x2="${v}" y2="-11"/><line x1="${v}" y1="9" x2="${v}" y2="11"/>`).join('')}</g>`);
    var spark = tile(24, 15, `<path d="M-9 3 l4 -3 l3 2 l4 -6 l3 4 l4 -2" stroke="${blue}" stroke-width="1.3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    var bars = [6, 10, 7].map((h, i) => `<rect x="${-8 + i * 6}" y="${-h}" width="4.4" height="${h}" rx="1" fill="${i === 1 ? c : blue}"/>`).join('');
    body = `${links([128, 42, 110, 30], [126, 56, 113, 60], [158, 54, 168, 57])}${at(100, 26, chip)}${at(100, 60, spark)}${at(178, 64, bars)}${at(142, 50, `<circle r="15" fill="${face}" stroke="${dim}" stroke-width="4.5"/><circle class="shb-gauge" r="15" fill="none" stroke="${c}" stroke-width="4.5" stroke-dasharray="${((fill * 94.2) / 100).toFixed(1)} 100" transform="rotate(-90)"/><path d="M-6 3 l3.5 -4 l3 2.5 l5 -6.5" stroke="${ink}" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)}`;
  } else if (scene === 'git') {
    var commit = (x, y, col, r = 3.2) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${col || face}" stroke="${col || cell}" stroke-width="1.2"/>`;
    var file = tile(18, 21, `<g stroke="${edge}" stroke-width="1.2" stroke-linecap="round"><line x1="-4.5" y1="-4" x2="4.5" y2="-4"/><line x1="-4.5" y1="0" x2="2.5" y2="0"/><line x1="-4.5" y1="4" x2="3.5" y2="4"/></g>`);
    body = `<g stroke="${cell}" stroke-width="1.4" fill="none"><path d="M92 62 H186"/><path d="M122 62 C130 62 130 42 140 42 H152 C162 42 162 62 170 62"/></g>${commit(98, 62)}${commit(122, 62)}${commit(146, 62)}${commit(170, 62)}${commit(140, 42, blue)}${at(156, 42, `<circle class="${ok ? '' : 'shb-blink'}" r="4.6" fill="${c}" stroke="${n ? '#1c2230' : '#fff'}" stroke-width="1"/>${ping(7)}`)}${links([108, 32, 132, 41])}${at(100, 26, `${file}${ok ? '' : pop(8, -9, '±')}`)}`;
  } else if (scene === 'orphans') {
    var loose = (col, blink) => `<rect x="-10" y="-9" width="20" height="18" rx="4.5" fill="none" stroke="${edge}" stroke-dasharray="2 2"/><g${blink ? ' class="shb-blink"' : ''}>${icon(SHB_PUZZLE, col, 11)}</g>`;
    body = `${around}${at(100, 26, loose(ok ? good : c, !ok))}${at(100, 60, loose(ok ? good : c))}${at(178, 58, loose(good))}${hub(`${icon(SHB_PUZZLE, blue, 18)}${led(12, 10, ok ? good : c, !ok)}`)}${ok ? at(142, 50, ping(19)) : ''}`;
  } else {
    var bolt = tile(16, 16, `<path d="M1.5 -5.5 L-3 1 H0 L-1.5 5.5 L3 -1 H0z" fill="#f5b400"/>`);
    var gear = tile(16, 16, `<circle r="3.6" fill="none" stroke="${cell}" stroke-width="2.4" stroke-dasharray="1.6 1.2"/><circle r="1.4" fill="${cell}"/>`);
    var bulb = tile(16, 16, `<circle cy="-1" r="3.4" fill="${ok ? '#f5b400' : face}" stroke="${ok ? '#f5b400' : cell}"/><rect x="-1.6" y="2.6" width="3.2" height="2.2" fill="${cell}"/>`);
    body = `${around}${at(100, 26, bolt)}${at(100, 60, gear)}${at(178, 58, bulb)}${hub(`${icon(SHB_GLYPHS[scene] || SHB_GLYPHS.automations, blue, 18)}${led(12, 10, ok ? good : c, !ok)}`)}${ok ? at(142, 50, ping(19)) : ''}`;
  }
  return `<svg class="shb-scene" viewBox="0 0 200 80" preserveAspectRatio="xMaxYMax meet" aria-hidden="true" focusable="false">${body}</svg>`;
}
var SHB_PUZZLE =
  'M20.5,11H19V7C19,5.89 18.1,5 17,5H13V3.5A2.5,2.5 0 0,0 10.5,1A2.5,2.5 0 0,0 8,3.5V5H4A2,2 0 0,0 2,7V10.8H3.5C5,10.8 6.2,12 6.2,13.5C6.2,15 5,16.2 3.5,16.2H2V20A2,2 0 0,0 4,22H7.8V20.5C7.8,19 9,17.8 10.5,17.8C12,17.8 13.2,19 13.2,20.5V22H17A2,2 0 0,0 19,20V16H20.5A2.5,2.5 0 0,0 23,13.5A2.5,2.5 0 0,0 20.5,11Z';
var SHB_STORE = 'M12,18H6V14H12M21,14V12L20,7H4L3,12V14H4V20H14V14H18V20H20V14M20,4H4V6H20V4Z';

// The editor's two fields for the illustrated header, labelled with the integration's strings (the Status card's).
function shbLocal(hass, key, fallback) {
  try {
    return hass?.localize?.(`component.system_hub.selector.panel.options.${key}`) || fallback;
  } catch (_err) {
    return fallback;
  }
}
function shbFields(hass) {
  var themes = { auto: 'Automatic (sun or dark theme)', day: 'Day', night: 'Night' };
  return [
    { name: 'illustration', selector: { boolean: {} } },
    { name: 'illustration_theme', selector: { select: { mode: 'dropdown', options: ['auto', 'day', 'night'].map((v) => ({ value: v, label: shbLocal(hass, `card_theme_${v}`, themes[v]) })) } } },
  ];
}
function shbLabel(hass, name) {
  if (name === 'illustration') return shbLocal(hass, 'card_illustration', 'Illustration');
  if (name === 'illustration_theme') return shbLocal(hass, 'card_illustration_theme', 'Illustration theme');
  return null;
}

function shbData(data) {
  return { illustration: true, illustration_theme: 'auto', ...data };
}
// Keeps the YAML minimal: the illustrated header's options left at their default are dropped.
function shbClean(config) {
  if (config && config.illustration === true) delete config.illustration;
  if (config && (!config.illustration_theme || config.illustration_theme === 'auto')) delete config.illustration_theme;
  return config;
}

// The end of the element opened at `start` (balanced <div>s), or -1.
function shbClose(html, start) {
  var re = /<div\b|<\/div>/g;
  re.lastIndex = start;
  var depth = 0;
  var m;
  while ((m = re.exec(html))) {
    depth += m[0] === '</div>' ? -1 : 1;
    if (!depth) return m.index + 6;
  }
  return -1;
}

// Wraps the card's header in the banner. o: { hass, config, scene, tone?, pad? } — pad: the card's padding ('12px' or
// '12px 16px'), cancelled so that the banner runs edge to edge.
function shBanner(html, o) {
  if (o.config?.illustration === false) return html;
  var card = /<ha-card\b[^>]*>/.exec(html);
  if (!card) return html;
  var head = /<div class="(head|header|mini)(?:\s[^"]*)?">/g;
  head.lastIndex = card.index + card[0].length;
  var m = head.exec(html);
  if (!m || /\bpopup\b/.test(card[0])) return html;
  var end = shbClose(html, m.index);
  if (end < 0) return html;
  var tone = o.tone;
  if (!tone) {
    var word = /\b(?:lvl|st)-(\w+)/.exec(card[0])?.[1] || /class="(?:logo|badge) (\w+)/.exec(html.slice(m.index, end))?.[1];
    tone = SHB_TONES[word] || 'good';
  }
  var night = shbIsNight(o.hass, o.config);
  var [py, px = py] = String(o.pad || '12px').split(/\s+/);
  var banner = `<div class="banner sh-banner shb-${tone}${night ? ' night' : ''}" style="--shb-py:${py};--shb-px:${px}">${shbScene(o.scene, tone, night)}<div class="shb-ground"></div><div class="shb-htext">${html.slice(m.index, end)}</div></div>`;
  return `${html.slice(0, m.index)}${banner}${html.slice(end)}<style>${SHB_STYLE}</style>`;
}

var SHB_STYLE = `
  .sh-banner { position:relative; overflow:hidden; height:90px; flex:none; box-sizing:border-box; display:flex; align-items:center;
               margin:calc(-1 * var(--shb-py)) calc(-1 * var(--shb-px)) 8px; padding:0 calc(min(200px, 62%) * .62) 10px 14px;
               border-radius:var(--ha-card-border-radius, 12px) var(--ha-card-border-radius, 12px) 0 0;
               background:linear-gradient(90deg, #f4f7fb 0%, #eef2f7 45%, #e4eaf2 100%); color:#0d2a45; container:shb / inline-size; --shb-tone:${SHB_COLORS.good}; }
  /* Nothing under the banner (a mini card folded): the card ends on its ground strip */
  .sh-banner:last-child { margin-bottom:calc(-1 * var(--shb-py)); }
  .sh-banner.night { background:linear-gradient(90deg, #222a3a 0%, #1c2230 50%, #161b27 100%); color:#fff; }
  .sh-banner.shb-warn { --shb-tone:${SHB_COLORS.warn}; } .sh-banner.shb-bad { --shb-tone:${SHB_COLORS.bad}; }
  .sh-banner.shb-info { --shb-tone:${SHB_COLORS.info}; } .sh-banner.shb-idle { --shb-tone:${SHB_COLORS.idle}; }
  .shb-scene { position:absolute; right:0; bottom:10px; height:80px; width:min(200px, 62%); pointer-events:none;
               -webkit-mask-image:linear-gradient(90deg, transparent 0, #000 18%); mask-image:linear-gradient(90deg, transparent 0, #000 18%); }
  .shb-ground { position:absolute; left:0; right:0; bottom:0; height:10px; background:#9aa1a9; box-shadow:inset 0 2px 0 #b5bbc2; }
  .night .shb-ground { background:#2c323b; box-shadow:none; }
  .shb-htext { flex:1 1 auto; min-width:0; }
  .shb-htext > *, .sh-banner .head, .sh-banner .header { position:static !important; margin:0 !important; padding:0 !important; min-height:0 !important;
               background:none !important; border:0 !important; box-shadow:none !important; }
  .sh-banner :is(.badge, .logo) { width:40px !important; height:40px !important; flex:none; border-radius:50% !important; display:grid !important; place-items:center;
               background:rgba(255,255,255,.62) !important; box-shadow:inset 0 0 0 1px color-mix(in srgb, var(--shb-tone) 22%, transparent) !important;
               color:var(--shb-tone) !important; fill:var(--shb-tone) !important; --mdc-icon-size:24px; }
  .sh-banner.night :is(.badge, .logo) { background:rgba(255,255,255,.12) !important; }
  .sh-banner :is(.title, .name) { color:inherit !important; }
  .sh-banner :is(.subtitle, .sub) { color:#3b5b78 !important; }
  .sh-banner.night :is(.subtitle, .sub) { color:rgba(255,255,255,.78) !important; }
  .sh-banner :is(.head, .header, .mini) > :is(button, ha-icon-button, a.btn), .sh-banner .mini .head > :is(button, ha-icon-button) {
               position:absolute !important; z-index:2; top:5px; right:5px; width:24px !important; height:24px !important; min-width:0 !important; margin:0 !important;
               padding:0 !important; border:0 !important; border-radius:50% !important; display:grid !important; place-items:center; cursor:pointer;
               background:rgba(255,255,255,.55) !important; box-shadow:inset 0 0 0 1px rgba(255,255,255,.7) !important; backdrop-filter:blur(4px);
               color:#33506b !important; fill:#33506b !important; --mdc-icon-size:16px; }
  .sh-banner :is(button, ha-icon-button) :is(svg, ha-icon) { width:16px !important; height:16px !important; }
  .sh-banner :is(.head, .header, .mini) > :is(button, ha-icon-button):nth-last-of-type(2) { right:33px; }
  .sh-banner :is(.head, .header, .mini) > :is(button, ha-icon-button):nth-last-of-type(3) { right:61px; }
  .sh-banner.night :is(.head, .header, .mini) > :is(button, ha-icon-button) { background:rgba(255,255,255,.12) !important; box-shadow:inset 0 0 0 1px rgba(255,255,255,.2) !important; color:#fff !important; fill:#fff !important; }
  /* The chips on one line: one that does not fit wraps out of sight instead of being cut (the full view has them all);
     a single chip too long for the line ends in an ellipsis */
  .sh-banner .rs { flex-wrap:wrap !important; align-items:center; row-gap:40px !important; max-height:22px; overflow:hidden; margin-top:3px !important; }
  .sh-banner .rs > * { flex:none; max-width:100%; }
  @container shb (max-width: 170px) { .shb-scene { display:none; } .sh-banner { padding-right:14px; } }
  .shb-blink { animation:shb-bl 1.2s steps(2) infinite; }
  .shb-gauge, .shb-pop { animation:shb-bl 3s ease-in-out infinite; }
  .shb-up { animation:shb-up 1.4s ease-in-out infinite; }
  .shb-spin { transform-box:fill-box; transform-origin:center; animation:shb-spin 2s linear infinite; }
  @keyframes shb-spin { to { transform:rotate(360deg); } }
  .shb-ping { transform-box:fill-box; transform-origin:center; animation:shb-ping 2.4s ease-out infinite; }
  @keyframes shb-bl { 50% { opacity:.3; } }
  @keyframes shb-up { 50% { transform:translateY(-1.5px); } }
  @keyframes shb-ping { from { opacity:.8; transform:scale(.7); } to { opacity:0; transform:scale(1.25); } }
  @media (prefers-reduced-motion: reduce) { .shb-scene * { animation:none !important; } }
`;

class SystemMonitorBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    holdUnderPress(this, () => this._update());
    this._html = "";
    this._procsOpen = false;
    this.shadowRoot.addEventListener("click", (ev) => {
      const path = ev.composedPath();
      // A shortcut (show_actions): Home Assistant's own navigation, without reloading the page; a new tab as a link.
      const nav = path.find((n) => n.dataset?.nav);
      if (nav && !ev.ctrlKey && !ev.metaKey && !ev.shiftKey && ev.button !== 1) {
        ev.preventDefault();
        history.pushState(null, "", nav.dataset.nav);
        window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
        return;
      }
      const action = path.find((n) => n.dataset?.action);
      if (action?.dataset.action === "zoom") return this._zoomClick?.(ev);
      if (action?.dataset.action.startsWith("ha_")) return this._haAction?.(action.dataset.action);
      if (action) {
        // With a process stopped, the list stays unfolded.
        if (action.dataset.action === "procs" && !this._procsKo()) this._procsOpen = !this._procsOpen;
        this._update();
        return;
      }
      const el = path.find((n) => n.dataset?.entity);
      if (el && !tapNone(this._config)) fireMoreInfo(this, el.dataset.entity);
    });
    // Keyboard: Enter / Space on an element with role="button" (gauges, tiles and rows open their entity).
    this.shadowRoot.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target?.getAttribute?.("role") === "button") {
        ev.preventDefault();
        ev.target.click();
      }
    });
  }

  connectedCallback() {
    // The uptime and the relative times ("2 minutes ago") depend on the current minute: without a
    // state change, `set hass` doesn't come, so check the render signature (it includes the minute).
    this._minuteTimer = setInterval(() => this._maybeRender(), 30 * 1000);
    this._watchPill();
    // A tap or click elsewhere on the page folds the processes list (as in ha-carburants-france), unless a process is
    // stopped. On the release, not the press: folding on press would shift the layout under the pointer.
    this._outside ??= watchOutside(this, () => {
      if (!this._procsOpen) return;
      this._procsOpen = false;
      this._update();
    });
    this._outside.on();
  }

  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $SM_PILL names the parts.
  _fitPill() {
    const S = SM_PILL;
    for (const t of this.shadowRoot?.querySelectorAll?.(S.block) || []) {
      const row = [...(t.children || [])].find((n) => n.matches?.(S.row));
      const name = row && [...row.children].find((n) => n.matches?.(S.name));
      const chips = row ? [...row.children].filter((n) => n.matches?.(S.chip)) : [];
      if (!name?.getBoundingClientRect || !chips.length) continue;
      t.classList.remove("pill-below", "pill-dot");
      if (this.getBoundingClientRect().width <= 200) t.classList.add("pill-dot");
      // The title's whole width (scrollWidth is rounded: 1 px more, so that a title that fits is never cut).
      const need = chips.reduce((w, c) => w + 8 + c.getBoundingClientRect().width, name.scrollWidth + 1);
      if (need <= row.getBoundingClientRect().width + 0.5) continue;
      t.classList.add("pill-below");
      const box = t.closest(".banner")?.getBoundingClientRect();
      const right = t.getBoundingClientRect().right;
      const out = [name, ...chips, ...[...t.children].filter((n) => n.matches?.(S.sub))].some((n) => {
        const r = n.getBoundingClientRect();
        return r.height > 0 && (r.right > right + 0.5 || (box && (r.top < box.top - 0.5 || r.bottom > box.bottom - 10.5)));
      });
      if (out) t.classList.add("pill-dot");
    }
  }

  // Fitted again on a new width, a new content (a render) and once the web font is loaded, in the next frame.
  _watchPill() {
    if (this._pillWatch || typeof ResizeObserver !== "function") return;
    const fit = () => {
      cancelAnimationFrame(this._pillFrame);
      this._pillFrame = requestAnimationFrame(() => {
        this._fitPill();
        this._fitActs?.();
      });
    };
    this._pillWatch = [new ResizeObserver(fit), typeof MutationObserver === "function" ? new MutationObserver(fit) : null];
    this._pillWatch[0].observe(this);
    if (this.shadowRoot) this._pillWatch[1]?.observe(this.shadowRoot, { childList: true, subtree: true, characterData: true });
    document.fonts?.ready?.then(fit);
    fit();
  }

  _unwatchPill() {
    for (const o of this._pillWatch || []) o?.disconnect();
    this._pillWatch = null;
  }

  disconnectedCallback() {
    this._unwatchPill();
    clearInterval(this._minuteTimer);
    this._outside?.off();
    this._dropPress();
    // Left (another dashboard view, a conditional card hidden): the processes list comes back folded, a confirmation
    // of show_actions is dropped.
    this._procsOpen = false;
    this._haConfirm = null;
    this._haCheck = null;
  }

  set hass(hass) {
    this._hass = hass;
    this._loadStoppable();
    this._maybeRender();
  }

  /**
   * The processes that may be stopped, chosen in System Hub's System settings: read once, then not counted as stopped
   * (grey chip). Without System Hub loaded, none.
   */
  _loadStoppable() {
    if (this._stoppableAsked || !this._hass?.callWS) return;
    this._stoppableAsked = true;
    this._hass
      .callWS({ type: "system_hub/stoppable_processes" })
      .then((ids) => {
        this._stoppable = new Set(Array.isArray(ids) ? ids : []);
        if (!this._stoppable.size) return;
        this._sig = null;
        this._maybeRender();
      })
      .catch(() => {});
  }

  /** Home Assistant sets hass on every state change of the instance: render only when one the card shows changed. */
  _maybeRender() {
    if (!this._hass) return;
    const sig = renderSignature(this._hass, this._config);
    if (sameSignature(this._sig, sig)) return;
    this._sig = sig;
    this._update();
  }

  get hass() {
    return this._hass;
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    // show_title / show_subtitle: the header"s title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.("hide-title", config.show_title === false);
    this.toggleAttribute?.("hide-subtitle", config.show_subtitle === false);
    // ok_color / warning_color / critical_color (#131): on the host, over the stylesheet's defaults.
    for (const [key, prop] of Object.entries(LEVEL_COLORS)) {
      const color = levelColor(config[key]);
      if (color) this.style?.setProperty(prop, color);
      else this.style?.removeProperty(prop);
    }
    this._html = "";
    this._update();
  }

  _t(key) {
    return t(this._hass, this._config, key);
  }

  /** Locale of the card's numbers (decimal separator). */
  _loc() {
    return fmtLang(this._hass, this._config);
  }

  _s(id) {
    return id ? this._hass.states[id] : undefined;
  }

  _update() {
    if (!this._hass || !this._config) return;
    // Held under a press (see holdUnderPress), drawn after its click.
    if (this._pressing) {
      this._dirty = true;
      return;
    }
    this._dirty = false;
    const banner = shBanner(this._render(), { hass: this._hass, config: this._config, scene: 'system', pad: '0' });
    const html = tapNone(this._config) ? inertHtml(banner) : banner;
    if (html !== this._html) {
      // Re-rendering replaces the buttons: keep the focus, without scrolling the page back to the card
      // (a mouse click focuses gauges and rows too).
      const active = this.shadowRoot.activeElement;
      const focused = keepsFocus(this, active) && focusSelector(active);
      this._html = html;
      this.shadowRoot.innerHTML = html;
      if (focused) this.shadowRoot.querySelector(focused)?.focus({ preventScroll: true });
    }
  }

  // 24 h of 5-minute means from the recorder's statistics, fetched again every 5 minutes. Returns what is
  // already there (nothing at first): the card renders again when the answer comes.
  _history(ids) {
    const key = ids.join(",");
    if (key && this._hass.callWS && (this._histKey !== key || Date.now() - this._histAt > HIST_REFRESH)) {
      const end = Date.now();
      this._histKey = key;
      this._histAt = end;
      this._hass
        .callWS({
          type: "recorder/statistics_during_period",
          start_time: new Date(end - HIST_WINDOW).toISOString(),
          statistic_ids: ids,
          period: "5minute",
          types: ["mean"],
        })
        .then((r) => {
          if (this._histKey !== key) return;
          // [time, mean] pairs; the window ends at the request time, so the curves stay put until the next fetch.
          const series = ids.map((id) => [id, (r?.[id] || []).map((p) => [statTime(p), p.mean]).filter(([at, v]) => Number.isFinite(at) && Number.isFinite(v))]);
          this._hist = { ...Object.fromEntries(series), end };
          this._update();
        })
        // No statistics (sensor without state_class, recorder off): try again in a minute, no curve meanwhile.
        .catch(() => {
          this._histAt = Date.now() - HIST_REFRESH + 60000;
        });
    }
    return this._histKey === key ? this._hist : null;
  }

  /**
   * The 24 h history of the CPU and RAM percentages, the CPU temperature and the given rate sensors, in one
   * statistics query (null with `show_history: false`). RAM only from its percentage sensor.
   */
  _histFor(sm, rateIds = []) {
    if (this._config.show_history === false) return null;
    const sc = sm.scalars;
    return this._history([sc.processor_use, sc.memory_use_percent, sc.processor_temperature, ...rateIds].filter(Boolean));
  }

  _header(sm, aside = "") {
    const c = this._config;
    const core = this._s(sm.core_update);
    const os = this._s(sm.os_update);
    const coreVersion = core?.attributes.installed_version || this._hass.config?.version;
    const osVersion = os?.attributes.installed_version;
    const sub = [coreVersion ? `Core ${coreVersion}` : null, osVersion ? `OS ${osVersion}` : null].filter(Boolean).join(" · ");
    // Status chip: pending Core / OS update, else "up to date" (or "running" without update entities).
    const { pending, unknown } = updateStatus(core, os);
    // Its full text stays in title and aria-label: on a narrow header the pill is cut, then shows its dot only.
    const pill = (cls, entity, text) =>
      `<span class="chip ${cls}" data-entity="${entity || ""}"${entity ? ' role="button" tabindex="0"' : ""} title="${esc(text)}" aria-label="${esc(text)}"><span class="dot"></span><span class="chip-text">${esc(text)}</span></span>`;
    // The header icon takes the status colour of the pill: green up to date, orange update pending, grey unknown.
    // A subclass may tint it red instead (the compact view of the mini card, while a process is stopped).
    const iconCls = this._logoAlert(sm) ? "crit" : pending ? "warn" : unknown ? "muted" : "good";
    let chip;
    // The icon red for stopped processes (compact mini card): the pill says so, in the same colour.
    const stopped = iconCls === "crit" ? this._stopped(sm) : [];
    if (stopped.length) chip = pill("clickable crit", stopped[0], this._t(stopped.length === 1 ? "st_stopped_one" : "st_stopped").replace("{n}", stopped.length));
    else if (pending) {
      const text = `${this._t("update")} ${pending.attributes.latest_version || ""}`.trim();
      chip = pill("clickable warn", pending.entity_id, text);
    } else if (unknown) chip = pill("clickable muted", unknown.entity_id, this._t("st_unknown"));
    else chip = pill(`good ${core ? "clickable" : ""}`, core?.entity_id, this._t(core ? "up_to_date" : "running"));
    return `
      <div class="header">
        <span class="logo ${iconCls}" aria-hidden="true">${svgIcon(ICONS.monitor_dashboard)}</span>
        <div class="titles">
          <div class="title-row"><div class="name">${esc(c.title || "Home Assistant")}</div>${chip}</div>
          <div class="sub" title="${esc(sub)}">${esc(sub)}</div>
        </div>
        ${aside}
      </div>`;
  }

  /** Whether the header icon turns red whatever the update status: never on the full card. */
  _logoAlert() {
    return false;
  }

  /**
   * Monitored processes that are stopped (process binary sensors off). An unavailable or unknown sensor says nothing
   * about its process: it is not counted (grey chip, see `_unknownProcs`).
   */
  _stopped(sm) {
    return Object.values(sm.procs).filter((id) => this._s(id)?.state === "off" && !this._stoppable?.has(id));
  }

  /** Monitored processes whose sensor is neither on nor off (unavailable, unknown, missing). */
  _unknownProcs(sm) {
    return Object.values(sm.procs).filter((id) => !["on", "off"].includes(this._s(id)?.state));
  }

  _procsKo() {
    return this._stopped(discover(this._hass, this._config)).length > 0;
  }

  /**
   * The processes section is always unfolded while a process is stopped. Otherwise it is folded
   * by default, unfolds on a click and folds again on a click elsewhere.
   */
  _procsUnfolded() {
    return this._procsKo() || !!this._procsOpen;
  }

  /** Processes status tile: all running, or how many are stopped. */
  _procsStat(sm) {
    if (this._config.show_processes === false || !Object.keys(sm.procs).length) return "";
    const n = this._stopped(sm).length;
    // None stopped but some not reported: the tile does not claim they all run.
    if (!n && this._unknownProcs(sm).length) {
      const unknown = this._t("st_unknown");
      return this._stat("procs", ICONS.process, this._t("processes"), unknown, "muted", `${this._t("processes")}: ${unknown}`);
    }
    const text = n === 0 ? this._t("procs_ok") : n === 1 ? this._t("procs_one") : this._t("procs_many").replace("{n}", n);
    const value = n === 0 ? this._t("st_running") : this._t(n === 1 ? "st_stopped_one" : "st_stopped").replace("{n}", n);
    return this._stat("procs", ICONS.process, this._t("processes"), value, n ? "crit" : "good", text);
  }

  /**
   * A status tile of the row under the header: section icon and name, status in its color; a click folds or unfolds that section.
   * Returns its status class with its HTML, so that callers don't have to read the status back from the markup.
   */
  _stat(action, icon, label, value, cls, title) {
    return {
      cls,
      html: `<div class="stat clickable ${cls}" data-action="${action}" role="button" tabindex="0" title="${esc(title)}" aria-label="${esc(title)}">
        <div class="k">${svgIcon(icon)}<span>${esc(label)}</span></div><div class="v">${esc(value)}</div>
      </div>`,
    };
  }

  /** Status tiles shown: processes. */
  _stats(sm) {
    return [this._procsStat(sm)].filter(Boolean);
  }

  /** Overall statuses (processes), under the header. */
  _statusRow(sm) {
    const stats = this._stats(sm);
    return stats.length ? `<div class="stats" style="--n:${stats.length}">${stats.map((x) => x.html).join("")}</div>` : "";
  }

  _noSm() {
    return `<style>${BASE_STYLE}</style><ha-card><div class="warning">${esc(this._t("no_sm"))}</div></ha-card>`;
  }
}

// ---------------------------------------------------------------------------
// Full card
// ---------------------------------------------------------------------------


const ring = (p) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  const v = p === null ? 0 : Math.max(0, Math.min(100, p));
  return `<svg class="ring" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="${r}" class="track"/>
    <circle cx="32" cy="32" r="${r}" class="value" stroke-dasharray="${((v / 100) * c).toFixed(1)} ${c.toFixed(1)}"/>
  </svg>`;
};

/** Status tiles under the header of the full card. */
const TILES_STYLE = `
  /* Tiles of equal width side by side while they fit. A label or a status takes two lines (never a cut word) before its
     tile goes down to a second row, whose tiles share its width; the tiles of a row keep the same height. */
  .stats { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 12px 10px; }
  .stat { flex: 1 1 0; display: flex; flex-direction: column; gap: 0; padding: 6px 8px; border-radius: 10px; min-width: min-content; max-width: 100%;
          box-sizing: border-box; background: color-mix(in srgb, var(--c, var(--sm-ok)) 12%, var(--secondary-background-color, transparent)); }
  .stat .k { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color); min-width: 0; }
  .stat .k span, .stat .v { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; overflow-wrap: normal; }
  .stat .k .icon { width: 16px; height: 16px; color: var(--c, var(--sm-ok)); }
  .stat .v { font-size: 13px; font-weight: 500; color: color-mix(in srgb, var(--c, var(--sm-ok)) 45%, var(--primary-text-color)); }
`;

const FULL_STYLE = `
  .logo { height: 40px; width: 40px; }
  /* A narrow card (under ~255 px) gives the pill the logo's last 8 px and 4 px of its gap: "Update 2026.10.3" stays
     beside 4 letters of the title at 245 px. */
  @container sm-header (max-width: 230px) {
    .logo { height: 32px; width: 32px; }
    .logo .icon { width: 20px; height: 20px; }
    .title-row { gap: 4px; }
  }
  /* Still too narrow for the pill beside 4 letters of the title (a longer label, or the zoom button of a zoomed mini
     card in a narrow masonry column): the pill goes under the title, whole, instead of being cut. */
  .title-row { flex-wrap: wrap; row-gap: 2px; }
  .section-title.toggle { cursor: pointer; margin-bottom: 0; user-select: none; }
  .section-title .count { margin-left: auto; text-transform: none; letter-spacing: 0; font-weight: 400; }
  .section-title.closed .chevron { transform: rotate(-90deg); }
  .section-title .chip { text-transform: none; letter-spacing: 0; padding: 0 8px; }
  .content { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 12px; container: sm-content / inline-size; }
  .section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; text-transform: uppercase;
                   letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 6px; }
  .section-title .icon { width: 16px; height: 16px; }
  /* Narrow cards, long names: the name gives way with an ellipsis (full text in title); the pills, the count and the
     chevron keep their size. */
  .section-title > * { flex: none; }
  .section-title > .label, .section-title > .arg { flex: 0 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Phone width (6 columns of a 320 px screen, 132 px inside): the section icon goes and the gaps shrink, so that the
     pills, the count and the chevron stay inside the card with the name. */
  @container sm-content (max-width: 160px) {
    .section-title { gap: 4px; }
    .section-title > .icon:first-child { display: none; }
  }
  .gauges { display: grid; grid-template-columns: repeat(var(--n, 3), minmax(0, 1fr)); gap: 6px; container-type: inline-size; }
  .gauge { display: flex; flex-direction: column; align-items: center; min-width: 0; position: relative; border-radius: 10px; overflow: hidden; }
  /* 24 h curve of the CPU and RAM gauges, behind the whole gauge (0 % at its bottom, 100 % at its top). */
  .gauge > :not(.spark) { position: relative; }
  .gauge .spark { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
  .dial { position: relative; width: 100%; max-width: 60px; aspect-ratio: 1; }
  .ring { width: 100%; height: 100%; transform: rotate(-90deg); display: block; }
  .ring circle { fill: none; stroke-width: 6; }
  .ring .track { stroke: var(--divider-color, rgba(127,127,127,.25)); }
  .ring .value { stroke: var(--c, var(--sm-blue)); stroke-linecap: round; }
  .dial .val { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .dial .val b { font-size: 14px; font-weight: 500; }
  .dial .val .icon { width: 12px; height: 12px; color: var(--secondary-text-color); }
  .gauge .lbl { font-size: 12px; color: var(--secondary-text-color); margin-top: 0; text-align: center; max-width: 100%; overflow: hidden; text-overflow: ellipsis; }
  /* Used / total: on two lines (at the slash) rather than over the next gauge. */
  .gauge .lbl2 { font-size: 11px; color: var(--secondary-text-color); text-align: center; }
  /* Four gauges on a narrow card: a size smaller, so that the longest labels (Datenträger) still fit. */
  @container (max-width: 300px) { .gauge .lbl { font-size: 11px; } .gauge .lbl2 { font-size: 10px; } }
  .section-title .arg { text-transform: none; letter-spacing: 0; }
  .facts { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 12px; margin-top: 6px; }
  .facts > span { display: inline-flex; align-items: center; gap: 4px; }
  .facts .icon { width: 14px; height: 14px; color: var(--secondary-text-color); }
  .vol { margin-bottom: 8px; display: grid; grid-template-columns: minmax(0, 1fr) auto; column-gap: 8px; align-items: center; }
  .vol .row { grid-column: 1; grid-row: 1; }
  .vol:last-child { margin-bottom: 0; }
  .row { display: flex; align-items: center; gap: 8px; font-size: 13px; }
  .row .icon { color: var(--secondary-text-color); }
  .row .grow { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .row .tag { font-size: 11px; padding: 1px 6px; border-radius: 6px; background: var(--secondary-background-color, rgba(127,127,127,.12));
              color: var(--secondary-text-color); }
  .vol .bar { margin: 4px 0 0; grid-column: 1 / -1; grid-row: 2; }
  .vol.backup.warn .when, .vol.backup.crit .when { color: color-mix(in srgb, var(--c) 45%, var(--primary-text-color)); font-weight: 600; }
  .vol .detail { font-size: 11px; color: var(--secondary-text-color); display: flex; justify-content: flex-end; grid-column: 2; grid-row: 1; gap: 8px; }
  /* Narrow card: the mount point (the main information) keeps the whole line, the used / total size goes under the bar. */
  @container sm-content (max-width: 300px) {
    .vol .row { grid-column: 1 / -1; }
    .vol .detail { grid-column: 1 / -1; grid-row: 3; margin-top: 2px; }
  }
  .procs { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
  .procs .chip { font-weight: 400; }
  /* gauge_style: bar (#131): the System section's metrics as lines, like the mini card's, with the used / total size
     before the value. One grid for every line: the label and size columns widen for the longest, the same for all. */
  .lines { display: grid; gap: 8px min(8px, 3%);
           grid-template-columns: 18px minmax(min(64px, 30%), max-content) minmax(16px, 1fr) max-content minmax(max-content, 44px); }
  .line { grid-column: 1 / -1; display: grid; grid-template-columns: subgrid; align-items: center; font-size: 13px; position: relative; }
  .line > :not(.spark) { position: relative; }
  .line .spark { position: absolute; inset: -2px -4px; width: calc(100% + 8px); height: calc(100% + 4px); pointer-events: none; }
  .line .icon { color: var(--secondary-text-color); }
  .line .l { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .line .d { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; text-align: right; }
  .line .v { text-align: right; font-weight: 500; white-space: nowrap; }
  /* A narrow card: the used / total size gives its room to the bar (its column goes, the value stays last). */
  @container sm-content (max-width: 300px) {
    .line .d { display: none; }
    .lines { column-gap: 6px; grid-template-columns: 18px minmax(min(64px, 30%), max-content) minmax(16px, 1fr) minmax(max-content, 44px); }
  }
`;

// show_actions: what each button runs, its icon, and whether it is shown as dangerous (red).
const HA_ACTIONS = {
  reload: { service: ["homeassistant", "reload_all"], icon: ICONS.reload, danger: false },
  restart: { service: ["homeassistant", "restart"], icon: ICONS.restart, danger: true },
  reboot: { service: ["hassio", "host_reboot"], icon: ICONS.reboot, danger: true },
};

// show_actions: the shortcuts `shortcuts` may list, each shown only when its page is in Home Assistant — the File
// editor (else Studio Code Server) and the Marketplace when in the sidebar (#133, #144); `path`: a page inside the panel.
const HA_SHORTCUTS = [
  { key: "file_editor", panels: ["core_configurator", "a0d7b954_vscode"], icon: "M8,12H16V14H8V12M10,20H6V4H13V9H18V12.1L20,10.1V8L14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H10V20M8,18H12.1L13,17.1V16H8V18M20.2,13C20.3,13 20.5,13.1 20.6,13.2L21.9,14.5C22.1,14.7 22.1,15.1 21.9,15.3L20.9,16.3L18.8,14.2L19.8,13.2C19.9,13.1 20,13 20.2,13M20.2,16.9L14.1,23H12V20.9L18.1,14.8L20.2,16.9Z" },
  { key: "marketplace", panels: ["marketplace"], icon: "M5.06 3C4.63 3 4.22 3.14 3.84 3.42S3.24 4.06 3.14 4.5L2.11 8.91C1.86 10 2.06 10.95 2.72 11.77L3 12.05V19C3 19.5 3.2 20 3.61 20.39S4.5 21 5 21H19C19.5 21 20 20.8 20.39 20.39S21 19.5 21 19V12.05L21.28 11.77C21.94 10.95 22.14 10 21.89 8.91L20.86 4.5C20.73 4.06 20.5 3.7 20.13 3.42C19.77 3.14 19.38 3 18.94 3H5.06M18.89 4.97L19.97 9.38C20.06 9.81 19.97 10.2 19.69 10.55C19.44 10.86 19.13 11 18.75 11C18.44 11 18.17 10.9 17.95 10.66C17.73 10.43 17.61 10.16 17.58 9.84L16.97 5L18.89 4.97M5.06 5H7.03L6.42 9.84C6.3 10.63 5.91 11 5.25 11C4.84 11 4.53 10.86 4.31 10.55C4.03 10.2 3.94 9.81 4.03 9.38L5.06 5M9.05 5H11V9.7C11 10.05 10.89 10.35 10.64 10.62C10.39 10.88 10.08 11 9.7 11C9.36 11 9.07 10.88 8.84 10.59S8.5 10 8.5 9.66V9.5L9.05 5M13 5H14.95L15.5 9.5C15.58 9.92 15.5 10.27 15.21 10.57C14.95 10.87 14.61 11 14.2 11C13.89 11 13.61 10.88 13.36 10.62C13.11 10.35 13 10.05 13 9.7V5M7.45 12.05C8.08 12.67 8.86 13 9.8 13C10.64 13 11.38 12.67 12 12.05C12.69 12.67 13.45 13 14.3 13C15.17 13 15.92 12.67 16.55 12.05C17.11 12.67 17.86 13 18.8 13H19.03V19H5V13H5.25C6.16 13 6.89 12.67 7.45 12.05Z" },
  { key: "settings", panels: ["config"], path: "/config/dashboard", icon: "M12,15.5A3.5,3.5 0 0,1 8.5,12A3.5,3.5 0 0,1 12,8.5A3.5,3.5 0 0,1 15.5,12A3.5,3.5 0 0,1 12,15.5M19.43,12.97C19.47,12.65 19.5,12.33 19.5,12C19.5,11.67 19.47,11.34 19.43,11L21.54,9.37C21.73,9.22 21.78,8.95 21.66,8.73L19.66,5.27C19.54,5.05 19.27,4.96 19.05,5.05L16.56,6.05C16.04,5.66 15.5,5.32 14.87,5.07L14.5,2.42C14.46,2.18 14.25,2 14,2H10C9.75,2 9.54,2.18 9.5,2.42L9.13,5.07C8.5,5.32 7.96,5.66 7.44,6.05L4.95,5.05C4.73,4.96 4.46,5.05 4.34,5.27L2.34,8.73C2.21,8.95 2.27,9.22 2.46,9.37L4.57,11C4.53,11.34 4.5,11.67 4.5,12C4.5,12.33 4.53,12.65 4.57,12.97L2.46,14.63C2.27,14.78 2.21,15.05 2.34,15.27L4.34,18.73C4.46,18.95 4.73,19.03 4.95,18.95L7.44,17.94C7.96,18.34 8.5,18.68 9.13,18.93L9.5,21.58C9.54,21.82 9.75,22 10,22H14C14.25,22 14.46,21.82 14.5,21.58L14.87,18.93C15.5,18.67 16.04,18.34 16.56,17.94L19.05,18.95C19.27,19.03 19.54,18.95 19.66,18.73L21.66,15.27C21.78,15.05 21.73,14.78 21.54,14.63L19.43,12.97Z" },
  { key: "integrations", panels: ["config"], path: "/config/integrations/dashboard", icon: "M22,13.5C22,15.26 20.7,16.72 19,16.96V20A2,2 0 0,1 17,22H13.2V21.7A2.7,2.7 0 0,0 10.5,19C9,19 7.8,20.21 7.8,21.7V22H4A2,2 0 0,1 2,20V16.2H2.3C3.79,16.2 5,15 5,13.5C5,12 3.79,10.8 2.3,10.8H2V7A2,2 0 0,1 4,5H7.04C7.28,3.3 8.74,2 10.5,2C12.26,2 13.72,3.3 13.96,5H17A2,2 0 0,1 19,7V10.04C20.7,10.28 22,11.74 22,13.5M17,15H18.5A1.5,1.5 0 0,0 20,13.5A1.5,1.5 0 0,0 18.5,12H17V7H12V5.5A1.5,1.5 0 0,0 10.5,4A1.5,1.5 0 0,0 9,5.5V7H4V9.12C5.76,9.8 7,11.5 7,13.5C7,15.5 5.75,17.2 4,17.88V20H6.12C6.8,18.25 8.5,17 10.5,17C12.5,17 14.2,18.25 14.88,20H17V15Z" },
  { key: "logs", panels: ["config"], path: "/config/logs", icon: "M18 7C16.9 7 16 7.9 16 9V15C16 16.1 16.9 17 18 17H20C21.1 17 22 16.1 22 15V11H20V15H18V9H22V7H18M2 7V17H8V15H4V7H2M11 7C9.9 7 9 7.9 9 9V15C9 16.1 9.9 17 11 17H13C14.1 17 15 16.1 15 15V9C15 7.9 14.1 7 13 7H11M11 9H13V15H11V9Z" },
  { key: "developer_tools", panels: ["developer-tools"], path: "/developer-tools/state", icon: "M2 19.63L13.43 8.2L12.72 7.5L14.14 6.07L12 3.89C13.2 2.7 15.09 2.7 16.27 3.89L19.87 7.5L18.45 8.91H21.29L22 9.62L18.45 13.21L17.74 12.5V9.62L16.27 11.04L15.56 10.33L4.13 21.76L2 19.63Z" },
];
// The shortcuts shown when `shortcuts` is not set.
const HA_DEFAULT_SHORTCUTS = ["file_editor", "marketplace", "settings"];

const ACTIONS_STYLE = `
  .ha-acts { display: flex; flex-wrap: wrap; justify-content: flex-end; align-items: center; gap: 6px; }
  .ha-msg { flex: 1 1 100%; font-size: 12px; text-align: right; }
  .ha-main { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; max-width: 100%; }
  .ha-main.icons .ha-btn { padding: 4px 10px; }
  .ha-main.icons .ha-btn > span { display: none; }
  .ha-msg.crit { color: color-mix(in srgb, var(--sm-crit) 45%, var(--primary-text-color)); }
  .ha-btn { all: unset; box-sizing: border-box; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; min-height: 32px;
            padding: 4px 12px; border-radius: 16px; font-size: 13px; font-weight: 500; --c: var(--sm-focus);
            color: color-mix(in srgb, var(--c) 45%, var(--primary-text-color)); background: color-mix(in srgb, var(--c) 12%, transparent); }
  .ha-btn.danger { --c: var(--sm-crit); }
  .ha-btn.sc { padding: 4px 8px; text-decoration: none; }
  .ha-btn .icon { width: 16px; height: 16px; color: var(--c); }
  .ha-btn:hover { background: color-mix(in srgb, var(--c) 20%, transparent); }
  .ha-btn:focus-visible { outline: 2px solid var(--sm-focus); outline-offset: 1px; }
  .ha-btn[disabled] { cursor: default; opacity: .5; }
  .ha-confirm { padding: 10px 12px; border-radius: 10px; background: color-mix(in srgb, var(--c) 8%, transparent); }
  .ha-confirm.ok { --c: var(--sm-focus); }
  .ha-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
  .ha-title .icon { color: var(--c); }
  .ha-confirm p { margin: 8px 0; font-size: 13px; line-height: 1.4; color: var(--secondary-text-color); }
  .ha-check { display: flex; gap: 6px; align-items: flex-start; font-size: 12px; margin-bottom: 8px;
              color: color-mix(in srgb, var(--c) 45%, var(--primary-text-color)); }
  .ha-check .icon { width: 16px; height: 16px; color: var(--c); }
  .ha-check pre { margin: 4px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; max-height: 120px; overflow: auto; font-size: 11px; }
`;

class SystemMonitorCard extends SystemMonitorBase {
  static getConfigElement() {
    return document.createElement("sh-system-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  getCardSize() {
    return 7;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _render() {
    const sm = discover(this._hass, this._config);
    if (!sm.found) return this._noSm();
    const c = this._config;
    const parts = [];
    const ifs = c.show_network !== false ? interfaces(sm, c) : [];
    const hist = this._histFor(sm, ifs.flatMap((i) => [sm.nets[i].throughput_network_in, sm.nets[i].throughput_network_out]));
    if (c.show_system !== false) parts.push(this._system(sm, hist));
    if (c.show_network !== false) parts.push(this._network(sm, ifs, hist));
    if (c.show_storage !== false) parts.push(this._storage(sm));
    if (c.show_processes !== false) parts.push(this._processes(sm));
    parts.push(this._actions());
    return `<style>${BASE_STYLE}${TILES_STYLE}${FULL_STYLE}${NET_STYLE}${ACTIONS_STYLE}</style>
      <ha-card>
        ${this._header(sm)}
        ${this._statusRow(sm)}
        <div class="content">${parts.filter(Boolean).join("")}</div>
      </ha-card>`;
  }

  /** Name of a section title: cut with an ellipsis when the card is too narrow, its full text in title. */
  _label(key) {
    const text = esc(this._t(key));
    return `<span class="label" title="${text}">${text}</span>`;
  }

  _gauge(id, label, icon, value, display, cls, detail = "", hist = null, max = 100) {
    return `<div class="gauge clickable ${cls}" data-entity="${id || ""}" role="button" tabindex="0">${spark(hist?.[id], hist?.end, max)}
      <div class="dial">${ring(value)}<div class="val">${svgIcon(icon)}<b>${display}</b></div></div>
      <div class="lbl" title="${label}">${label}</div>
      ${detail ? `<div class="lbl2">${detail}</div>` : ""}
    </div>`;
  }

  /** A metric of the System section as a line (gauge_style: bar, #131): icon, label, bar, used / total, value. */
  _line(id, label, icon, value, display, cls, detail = "", hist = null, max = 100) {
    const p = value === null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
    return `<div class="line clickable ${cls}" data-entity="${id || ""}" role="button" tabindex="0">${spark(hist?.[id], hist?.end, max)}
      ${svgIcon(icon)}<span class="l" title="${label}">${label}</span>
      <div class="bar"><div style="width:${p}%"></div></div>
      <span class="d">${detail}</span><span class="v">${display}</span>
    </div>`;
  }

  _system(sm, hist) {
    const c = this._config;
    const sc = sm.scalars;
    const gauges = [];
    const lines = c.gauge_style === "bar";
    const gauge = (...args) => (lines ? this._line(...args) : this._gauge(...args));
    const cpu = num(this._s(sc.processor_use));
    if (sc.processor_use)
      gauges.push(gauge(sc.processor_use, this._t("cpu"), ICONS.cpu, cpu, cpu === null ? "—" : `${Math.round(cpu)}%`, metricLevel(this._config, "cpu", cpu), "", hist));

    const mem = memUsage(this._hass, sc, "memory");
    if (sc.memory_use_percent || (sc.memory_use && sc.memory_free)) {
      const detail = mem.used !== null && mem.total !== null ? fmtBytesPair(mem.used, mem.total, this._loc()) : "";
      gauges.push(
        gauge(sc.memory_use_percent || sc.memory_use, this._t("ram"), ICONS.ram, mem.pct, mem.pct === null ? "—" : `${Math.round(mem.pct)}%`, metricLevel(this._config, "ram", mem.pct), detail, hist)
      );
    }

    // Root file system, else the first mount point; `show_disk: false` leaves it to the Storage section.
    const mount = sm.disks["/"] ? "/" : Object.keys(sm.disks)[0];
    if (mount && this._config.show_disk !== false) {
      const d = sm.disks[mount];
      const u = diskUsage(this._hass, d);
      const detail = u.used !== null && u.total !== null ? fmtBytesPair(u.used, u.total, this._loc()) : "";
      gauges.push(
        gauge(d.disk_use_percent || d.disk_use || d.disk_free, `${this._t("disk")} ${esc(mount)}`, ICONS.disk, u.pct, u.pct === null ? "—" : `${Math.round(u.pct)}%`, metricLevel(this._config, "disk", u.pct), detail)
      );
    }

    const temp = temperature(this._s(sc.processor_temperature), this._hass);
    if (sc.processor_temperature)
      gauges.push(
        gauge(sc.processor_temperature, `${this._t("temperature")} ${this._t("cpu")}`, ICONS.temp, temp.c, esc(temp.display), metricLevel(this._config, "temp", temp.c), "", hist, temp.max)
      );

    const facts = [];
    // show_uptime / show_load / show_ip: each line of the System section can be left out (#129).
    const up = c.show_uptime !== false ? uptimeSec(this._s(sc.last_boot)) : null;
    if (up !== null)
      facts.push(
        `<span class="clickable" data-entity="${sc.last_boot}" role="button" tabindex="0">${svgIcon(ICONS.timer)}${this._t("uptime")} ${fmtUptime(up, this._hass, this._config)}</span>`
      );
    const loads = c.show_load !== false ? ["load_1m", "load_5m", "load_15m"].filter((k) => sc[k]) : [];
    if (loads.length)
      facts.push(
        `<span class="clickable" data-entity="${sc[loads[0]]}" role="button" tabindex="0">${svgIcon(ICONS.load)}${this._t("load")} ${loads
          .map((k) => {
            const v = num(this._s(sc[k]));
            return v === null ? "—" : fmtNum(v, this._loc(), 2);
          })
          .join(" · ")}</span>`
      );
    const ip = c.show_ip !== false ? mainIp(this._hass, sm, this._config) : null;
    if (ip) facts.push(`<span class="clickable" data-entity="${ip.entity_id}" role="button" tabindex="0">${svgIcon(ICONS.ip)}${esc(ip.state)}</span>`);

    if (!gauges.length && !facts.length) return "";
    return `<div>
      ${gauges.length ? (lines ? `<div class="lines">${gauges.join("")}</div>` : `<div class="gauges" style="--n:${gauges.length}">${gauges.join("")}</div>`) : ""}
      ${facts.length ? `<div class="facts">${facts.join("")}</div>` : ""}
    </div>`;
  }

  /**
   * show_actions, administrators only: Reload the configuration, Restart Home Assistant and, with the Supervisor,
   * Reboot the host, as in the System tab of System Hub's panel. Each is confirmed in the card itself (not in an
   * overlay, which the dashboard's containers could hold in); the restart checks the configuration first, as Home
   * Assistant's own dialog does, and is refused while it is invalid.
   */
  _actions() {
    if (this._config.show_actions !== true || !this._hass.user?.is_admin) return "";
    if (this._haConfirm) return this._haConfirmBox(this._haConfirm);
    // `buttons` (#146): the ones listed, in their own order (reload, restart, reboot); all three when not set
    const chosen = Array.isArray(this._config.buttons) ? this._config.buttons : Object.keys(HA_ACTIONS);
    const kinds = Object.keys(HA_ACTIONS).filter((k) => chosen.includes(k) && (k !== "reboot" || this._hass.config?.components?.includes("hassio")));
    const msg = this._haMsg ? `<div class="ha-msg ${this._haMsg.tone}" role="status">${esc(this._haMsg.text)}</div>` : "";
    // Icons only when the buttons with their labels would take more than one line (a phone, #129): see _fitActs.
    const buttons = this._haShortcuts() + kinds.map((k) => this._haButton(`ha_ask:${k}`, k, this._t(`ha_${k}`), k === "reload" && this._haBusy, true)).join("");
    if (!buttons && !msg) return "";
    return `<div class="ha-acts">${msg}<div class="ha-main${this._actsIcons ? " icons" : ""}">${buttons}</div></div>`;
  }

  /** The shortcuts of show_actions, in the order of `shortcuts`: a round icon per page found, before the reload, restart and reboot buttons. */
  _haShortcuts() {
    const panels = this._hass.panels || {};
    const chosen = Array.isArray(this._config.shortcuts) ? this._config.shortcuts : HA_DEFAULT_SHORTCUTS;
    return chosen.map((key) => {
      const sc = HA_SHORTCUTS.find((s) => s.key === key);
      const panel = sc?.panels.find((p) => panels[p]);
      if (!panel) return "";
      const path = sc.path || `/${panel}`;
      const label = esc(this._t(`sc_${sc.key}`));
      return `<a class="ha-btn sc" href="${path}" data-nav="${path}" title="${label}" aria-label="${label}">${svgIcon(sc.icon)}</a>`;
    }).join("");
  }

  /** A button of show_actions; `named`: its label also in title and aria-label, for when only its icon shows. */
  _haButton(action, kind, label, disabled = false, named = false) {
    const cls = HA_ACTIONS[kind]?.danger ? "danger" : "";
    const icon = HA_ACTIONS[kind]?.icon ?? ICONS.close;
    const name = named ? ` title="${esc(label)}" aria-label="${esc(label)}"` : "";
    return `<button type="button" class="ha-btn ${cls}" data-action="${action}"${name}${disabled ? " disabled" : ""}>${svgIcon(icon)}<span>${esc(label)}</span></button>`;
  }

  /**
   * The reload, restart and reboot buttons stay on one line: with their labels while they fit, else as icons only
   * (their labels in title and aria-label). Measured with the labels on each fit, never by a fixed width.
   */
  _fitActs() {
    const row = this.shadowRoot?.querySelector?.(".ha-main");
    const buttons = row ? [...row.children] : [];
    if (buttons.length < 2 || !buttons[0].getBoundingClientRect) return;
    row.classList.remove("icons");
    const tops = buttons.map((b) => Math.round(b.getBoundingClientRect().top));
    this._actsIcons = tops.some((top) => top !== tops[0]);
    row.classList.toggle("icons", this._actsIcons);
  }

  _haConfirmBox(kind) {
    const check = kind === "restart" ? this._haCheck : null;
    let status = "";
    if (check?.checking) status = `<div class="ha-check muted" role="status">${esc(this._t("ha_checking"))}</div>`;
    else if (check?.invalid)
      status = `<div class="ha-check crit" role="alert">${svgIcon(ICONS.alert)}<div><b>${esc(this._t("ha_invalid"))}</b>${check.errors ? `<pre>${esc(check.errors)}</pre>` : ""}</div></div>`;
    else if (check?.valid) status = `<div class="ha-check good" role="status">${svgIcon(ICONS.check)}<span>${esc(this._t("ha_valid"))}</span></div>`;
    const blocked = Boolean(check?.checking || check?.invalid);
    return `<div class="ha-confirm ${HA_ACTIONS[kind].danger ? "crit" : "ok"}" role="alertdialog" aria-labelledby="sm-ha-title" aria-describedby="sm-ha-text">
      <div class="ha-title" id="sm-ha-title">${svgIcon(HA_ACTIONS[kind].icon)}<span>${esc(this._t(`ha_${kind}_title`))}</span></div>
      <p id="sm-ha-text">${esc(this._t(`ha_${kind}_text`))}</p>${status}
      <div class="ha-acts">${this._haButton("ha_cancel", "cancel", this._t("ha_cancel"))}${this._haButton(`ha_ok:${kind}`, kind, this._t(`ha_${kind}`), blocked)}</div>
    </div>`;
  }

  async _haAction(action) {
    const [name, kind] = action.split(":");
    if (name === "ha_cancel") {
      this._haConfirm = null;
      this._haCheck = null;
      this._update();
      this.shadowRoot.querySelector('.ha-btn[data-action^="ha_ask:"]')?.focus?.({ preventScroll: true });
      return;
    }
    if (!HA_ACTIONS[kind]) return;
    if (name === "ha_ask") {
      this._haConfirm = kind;
      this._haMsg = null;
      this._haCheck = kind === "restart" ? { checking: true } : null;
      this._update();
      this.shadowRoot.querySelector('[data-action="ha_cancel"]')?.focus?.({ preventScroll: true });
      if (kind !== "restart") return;
      let check;
      try {
        const result = await this._hass.callApi("POST", "config/core/check_config");
        check = result?.result === "invalid" ? { invalid: true, errors: result.errors || "" } : { valid: result?.result === "valid" };
      } catch (_err) {
        // No check (the configuration panel off): Home Assistant still checks before it restarts.
        check = {};
      }
      if (this._haConfirm !== "restart") return;
      this._haCheck = check;
      this._update();
      return;
    }
    if (name !== "ha_ok" || this._haConfirm !== kind || (kind === "restart" && (this._haCheck?.checking || this._haCheck?.invalid))) return;
    this._haConfirm = null;
    this._haCheck = null;
    const [domain, service] = HA_ACTIONS[kind].service;
    const drops = kind !== "reload";
    this._haMsg = drops ? { text: this._t(kind === "reboot" ? "ha_rebooting" : "ha_restarting"), tone: "muted" } : null;
    this._haBusy = !drops;
    this._update();
    try {
      await this._hass.callService(domain, service, {});
    } catch (err) {
      const text = err?.message || err?.code || (typeof err === "string" ? err : JSON.stringify(err));
      // The restart and the reboot drop the connection: no failure to report then, Home Assistant's own banner takes over.
      if (!drops || !/connection|lost|closed/i.test(String(text))) this._haMsg = { text: this._t("ha_failed").replace("{error}", String(text)), tone: "crit" };
    }
    this._haBusy = false;
    this._update();
  }

  _network(sm, ifs, hist) {
    if (!ifs.length) return "";
    const multi = ifs.length > 1;
    const rows = ifs.map((i) => this._netRow(sm.nets[i], hist, multi ? ` · ${i}` : ""));
    return `<div>
      <div class="section-title">${svgIcon(ICONS.network)}${this._label("network")}${multi ? "" : `<span class="arg" title="${esc(ifs[0])}">· ${esc(ifs[0])}</span>`}</div>
      ${rows.join("")}
    </div>`;
  }

  // The download and upload tiles of an interface, each with its 24 h curve behind the rate when `hist` has it.
  _netRow(n, hist, sfx = "") {
    const tile = (rateKey, totalKey, cls, icon, label) => {
      const id = n[rateKey];
      const total = toBytes(this._s(n[totalKey]));
      return `<div class="tile clickable ${cls}" data-entity="${id || ""}" role="button" tabindex="0">${spark(hist?.[id], hist?.end)}${svgIcon(icon)}<div style="min-width:0">
        <div class="k" title="${esc(label)}">${esc(label)}</div>
        <div class="v">${fmtRate(toBps(this._s(id)), this._loc())}</div>
        ${total !== null ? `<div class="t">${this._t("total")} ${fmtBytes(total, this._loc())}</div>` : ""}
      </div></div>`;
    };
    return `<div class="net">
        ${tile("throughput_network_in", "network_in", "down", ICONS.down, this._t("download") + sfx)}
        ${tile("throughput_network_out", "network_out", "up", ICONS.up, this._t("upload") + sfx)}
      </div>`;
  }

  _bar(id, icon, label, u, metric) {
    const cls = metricLevel(this._config, metric, u.pct);
    return `<div class="vol clickable ${cls}" data-entity="${id || ""}" role="button" tabindex="0">
      <div class="row">${svgIcon(icon)}<span class="grow">${esc(label)}</span></div>
      <div class="bar"><div style="width:${u.pct === null ? 0 : Math.max(0, Math.min(100, u.pct))}%"></div></div>
      <div class="detail">
        <span>${u.used !== null ? `${fmtBytes(u.used, this._loc())} ${this._t("used")}${u.total !== null ? ` ${this._t("of")} ${fmtBytes(u.total, this._loc())}` : ""}` : ""}</span>
        <span>${u.pct === null ? "" : `${Math.round(u.pct)}%`}</span>
      </div>
    </div>`;
  }

  _storage(sm) {
    const rows = Object.entries(sm.disks).map(([mount, d]) =>
      this._bar(d.disk_use || d.disk_use_percent || d.disk_free, ICONS.disk, mount, diskUsage(this._hass, d), "disk")
    );
    const sc = sm.scalars;
    if (sc.swap_use_percent || (sc.swap_use && sc.swap_free)) {
      const u = memUsage(this._hass, sc, "swap");
      if (u.total !== 0) rows.push(this._bar(sc.swap_use_percent || sc.swap_use, ICONS.swap, this._t("swap"), u, "swap"));
    }
    const db = discoverDatabase(this._hass);
    if (db)
      rows.push(`<div class="vol clickable" data-entity="${db}" role="button" tabindex="0">
        <div class="row">${svgIcon(ICONS.database)}<span class="grow">${this._t("database")}</span></div>
        <div class="detail"><span>${fmtBytes(toBytes(this._s(db)), this._loc())}</span></div>
      </div>`);
    const bk = this._config.show_backups !== false ? discoverBackup(this._hass) : null;
    if (bk) {
      const b = backupStatus(this._hass, this._config, bk);
      const loc = this._loc();
      const when = b.last === null ? this._t("backup_none") : fmtRelative(b.last, loc);
      const detail = b.running ? this._t("backup_running") : b.failed ? this._t("backup_failed") : b.next !== null ? this._t("backup_next").replace("{when}", fmtRelative(b.next, loc)) : "";
      rows.push(`<div class="vol clickable backup ${b.level}" data-entity="${b.id}" role="button" tabindex="0">
        <div class="row">${svgIcon(ICONS.backup)}<span class="grow">${this._t("backup")}</span></div>
        <div class="detail">${detail ? `<span>${esc(detail)}</span>` : ""}<span class="when">${esc(when)}</span></div>
      </div>`);
    }
    if (!rows.length) return "";
    return `<div><div class="section-title">${svgIcon(ICONS.database)}${this._label("storage")}</div>${rows.join("")}</div>`;
  }

  _processes(sm) {
    const entries = Object.entries(sm.procs);
    if (!entries.length) return "";
    const n = this._stopped(sm).length;
    const open = this._procsUnfolded();
    const head = `<div class="section-title toggle ${open ? "" : "closed"}" data-action="procs" role="button" tabindex="0" aria-expanded="${open}">
        ${svgIcon(ICONS.process)}${this._label("processes")}
        ${n ? `<span class="chip crit"><span class="dot"></span>${n}</span>` : ""}
        <span class="count">${entries.length}</span>${svgIcon(ICONS.chevron, "chevron")}
      </div>`;
    // Hidden while every process runs, unless unfolded from the status tile; shown as soon as one stops.
    if (!open) return "";
    // Running green, stopped red, unavailable / unknown grey (its state in the tooltip).
    const chips = entries.map(([name, id]) => {
      const state = this._s(id)?.state;
      // Stopped as allowed in System Hub's System settings: grey, no alert
      const cls = state === "on" ? "good" : state === "off" && !this._stoppable?.has(id) ? "crit" : "muted";
      const title = cls === "muted" ? ` title="${esc(`${name}: ${this._t("st_unknown")}`)}"` : "";
      return `<span class="chip clickable ${cls}" data-entity="${id}" role="button" tabindex="0"${title}><span class="dot"></span>${esc(name)}</span>`;
    });
    return `<div>${head}<div class="procs">${chips.join("")}</div></div>`;
  }
}

// ---------------------------------------------------------------------------
// Zoomable compact card (mini)
// ---------------------------------------------------------------------------

/** A click inside a dialog (more-info opened from the card, say) is not a click outside the card. */
const inDialog = (ev) => ev.composedPath().some((n) => ["ha-more-info-dialog", "ha-dialog", "dialog"].includes(n.localName));

// A click or tap outside of the card, and not in a Home Assistant dialog opened from it.
const isOutside = (card, ev) => !ev.composedPath().includes(card) && !inDialog(ev);

// "A click elsewhere" is caught on the pointer, not only on the click event: on iOS (Safari and the companion app)
// a tap on something that is not clickable (the background, an empty spot, a card with no action) sends no click to
// the page. It counts when the press and the release are both outside the card (a slider dragged out of the card
// does not fold it), and a scroll does not count (the browser cancels the pointer). Keyboard clicks still go through
// the click event.
const watchOutside = (card, handler) => {
  let downOutside = false;
  const onDown = (ev) => {
    downOutside = isOutside(card, ev);
  };
  const onUp = (ev) => {
    if (downOutside && isOutside(card, ev)) handler(ev);
    downOutside = false;
  };
  const onClick = (ev) => {
    if (ev.detail === 0 && isOutside(card, ev)) handler(ev);
  };
  return {
    on() {
      document.addEventListener("pointerdown", onDown, true);
      document.addEventListener("pointerup", onUp, true);
      document.addEventListener("click", onClick, true);
    },
    // A tap (press and release at the same spot), for the tests.
    tap(ev) {
      onDown(ev);
      onUp(ev);
    },
    off() {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("click", onClick, true);
    },
  };
};

// No rewrite of the card between a press and its click: Home Assistant updates the card several times a second, and a
// rewrite under the pointer replaces the element pressed, so that the click lands on the card itself and does nothing
// (a button or a row that does not react). While a press is in progress (`_pressing`), a render is left pending
// (`_dirty`): it is done at the click, or right after the release when no click follows (a drag, a scroll).
// `_byPointer` tells a mouse or touch use from the keyboard: after a rewrite, the focus is put back only for the
// keyboard (no focus ring after a click), and always in a text field.
const holdUnderPress = (card, render) => {
  const root = card.shadowRoot;
  card._onPressEnd = () => {
    window.removeEventListener?.("pointerup", card._onPressEnd, true);
    window.removeEventListener?.("pointercancel", card._onPressEnd, true);
    setTimeout(() => card._endPress(), 0);
  };
  card._endPress = () => {
    card._pressing = false;
    if (!card._dirty) return;
    card._dirty = false;
    render();
  };
  // Left in the middle of a press (see disconnectedCallback).
  card._dropPress = () => {
    card._pressing = false;
    card._dirty = false;
    window.removeEventListener?.("pointerup", card._onPressEnd, true);
    window.removeEventListener?.("pointercancel", card._onPressEnd, true);
  };
  root.addEventListener?.("pointerdown", () => {
    card._byPointer = true;
    card._pressing = true;
    window.addEventListener?.("pointerup", card._onPressEnd, true);
    window.addEventListener?.("pointercancel", card._onPressEnd, true);
  });
  root.addEventListener?.("keydown", () => {
    card._byPointer = false;
  });
  // At the click (capture: before the card acts on it) the press is over, and what the click changes is drawn at once.
  card._pressClick = (ev) => {
    card._pressing = false;
    if (ev.detail === 0) card._byPointer = false;
  };
  root.addEventListener?.("click", card._pressClick, true);
};

// Whether the focus goes back to `el` after a rewrite (see holdUnderPress).
const keepsFocus = (card, el) => !card._byPointer || typeof el?.selectionStart === "number";

/**
 * A compact card with a zoom button at the far right of its header (`zoom: false` removes it): the
 * button switches it to the full card, with the same config, and back; a click anywhere outside the
 * card brings the compact view back too. Subclasses render their compact view in `_compactRender()`
 * and give its size in `_compactSize()`.
 */
class SystemMonitorZoomCard extends SystemMonitorCard {
  constructor() {
    super();
    // A click outside the card (or a dialog opened from it) brings it back to the compact view.
    this._unzoom = watchOutside(this, () => {
      if (this._zoomed) this._setZoom(false);
    });
  }

  connectedCallback() {
    this._unzoom.on();
    super.connectedCallback();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._unzoom.off();
    // Back to the compact view once off the screen.
    this._zoomed = false;
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : this._compactSize();
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 };
  }

  /** Full card, or back to the compact view (its processes list folded again). */
  _setZoom(zoomed) {
    this._zoomed = zoomed;
    if (!zoomed) this._procsOpen = false;
    this._update();
  }

  _zoomClick(ev) {
    ev.stopPropagation(); // no other action of the header
    this._setZoom(!this._zoomed);
    // Keyboard use (Enter / Space: no click count) keeps the focus on the button that replaced this one.
    if (ev.detail === 0) this.shadowRoot.querySelector(".zoom")?.focus({ preventScroll: true });
  }

  /** The header of both views, with the zoom button at its far right. */
  _header(sm, aside = "") {
    if (this._config.zoom === false) return super._header(sm, aside);
    const title = esc(this._t(this._zoomed ? "zoom_out" : "zoom_in"));
    const button = `<button class="zoom" data-action="zoom" title="${title}" aria-label="${title}">${svgIcon(this._zoomed ? ICONS.collapse : ICONS.expand)}</button>`;
    return super._header(sm, aside + button);
  }

  _render() {
    return this._zoomed ? super._render() : this._compactRender();
  }
}

// ---------------------------------------------------------------------------
// Mini card
// ---------------------------------------------------------------------------

// Download / upload tiles with their 24 h curve: the network section of the full card, the rates row of the mini card.
const NET_STYLE = `
  .net { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
  .net + .net { margin-top: 6px; }
  .tile { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 10px; min-width: 0;
          background: var(--secondary-background-color, rgba(127,127,127,.08)); position: relative; overflow: hidden; }
  .tile > :not(.spark) { position: relative; }
  .tile .spark { position: absolute; left: 0; bottom: 0; width: 100%; height: 55%; pointer-events: none; }
  .spark-a { fill: color-mix(in srgb, var(--c, var(--sm-blue)) 12%, transparent); }
  .spark-l { fill: none; stroke: color-mix(in srgb, var(--c, var(--sm-blue)) 50%, transparent); stroke-width: 1.2; vector-effect: non-scaling-stroke; }
  .tile .icon { color: var(--c, var(--sm-blue)); }
  .tile .k { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tile .v { font-size: 14px; font-weight: 500; }
  .tile .t { font-size: 11px; color: var(--secondary-text-color); }
  .tile.up { --c: var(--info-color, #039be5); }
  .tile.down { --c: var(--sm-ok); }
  /* A narrow card (a mini card on 6 columns of a phone): one tile per line, so that each rate keeps its whole text. */
  @container (max-width: 260px) { .net { grid-template-columns: minmax(0, 1fr); } }
`;

const MINI_STYLE = `
  /* The full card's logo size: the compact view does not shrink it. */
  .logo { height: 40px; width: 40px; align-self: flex-start; }
  .name { font-size: 16px; }
  /* One grid for every metric: the label column widens for the longest label (Datenträger), the same for all rows.
     At phone width (6 columns of a 320 px screen, 132 px inside) the gaps and the label give way (ellipsis), the bar
     keeps a few pixels and the value its whole text ("130°F"): no container query, the grid itself is the card. */
  .content { padding: 0 12px 12px; display: grid; gap: 8px min(8px, 3%);
             grid-template-columns: 18px minmax(min(64px, 30%), max-content) minmax(16px, 1fr) minmax(max-content, 56px); }
  .content > * { grid-column: 1 / -1; }
  .metric { display: grid; grid-template-columns: subgrid; align-items: center; font-size: 13px; }
  .metric .icon { color: var(--secondary-text-color); }
  .metric .v { text-align: right; font-weight: 500; white-space: nowrap; }
  .metric > span:not(.v) { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .foot { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 4px 8px; font-size: 12px; color: var(--secondary-text-color); margin-top: 2px; }
  .foot span { display: inline-flex; align-items: center; gap: 2px; }
  .foot .icon { width: 14px; height: 14px; }
  .foot .rates { flex-wrap: wrap; column-gap: 8px; }
  .foot .stopped { font-weight: 500; color: color-mix(in srgb, var(--sm-crit) 45%, var(--primary-text-color)); }
  /* 24 h curve of the CPU and RAM rows, behind the whole row. */
  .metric { position: relative; }
  .metric > :not(.spark) { position: relative; }
  .metric .spark { position: absolute; inset: -2px -4px; width: calc(100% + 8px); height: calc(100% + 4px); pointer-events: none; }
`;

/**
 * Compact card: CPU, RAM, disk and temperature bars, Core / OS status, network and uptime.
 * Its zoom button (top right, `zoom: false` removes it) switches it to the full card and back.
 */
class SystemMonitorMiniCard extends SystemMonitorZoomCard {
  static getConfigElement() {
    return document.createElement("sh-system-mini-card-editor");
  }

  _compactSize() {
    return 3;
  }

  /** The compact view tints its header icon red while a monitored process is stopped. */
  _logoAlert(sm) {
    return !this._zoomed && this._config.show_processes !== false && this._stopped(sm).length > 0;
  }

  _metric(id, icon, label, p, display, cls, hist = null, max = 100) {
    return `<div class="metric clickable ${cls}" data-entity="${id || ""}" role="button" tabindex="0">${spark(hist?.[id], hist?.end, max)}
      ${svgIcon(icon)}<span>${label}</span>
      <div class="bar"><div style="width:${p === null ? 0 : Math.max(0, Math.min(100, p))}%"></div></div>
      <span class="v">${display}</span>
    </div>`;
  }

  _compactRender() {
    const sm = discover(this._hass, this._config);
    if (!sm.found) return this._noSm();
    const c = this._config;
    const sc = sm.scalars;
    const ifs = c.show_network !== false ? interfaces(sm, c) : [];
    const net = ifs.length ? sm.nets[ifs[0]] : null;
    // One statistics query: the CPU and RAM rows and the rates of the first interface.
    const hist = this._histFor(sm, net ? [net.throughput_network_in, net.throughput_network_out] : []);
    const rows = [];
    const cpu = num(this._s(sc.processor_use));
    if (sc.processor_use)
      rows.push(this._metric(sc.processor_use, ICONS.cpu, this._t("cpu"), cpu, cpu === null ? "—" : `${Math.round(cpu)}%`, metricLevel(this._config, "cpu", cpu), hist));
    const mem = memUsage(this._hass, sc, "memory");
    if (sc.memory_use_percent || (sc.memory_use && sc.memory_free))
      rows.push(
        this._metric(sc.memory_use_percent || sc.memory_use, ICONS.ram, this._t("ram"), mem.pct, mem.pct === null ? "—" : `${Math.round(mem.pct)}%`, metricLevel(this._config, "ram", mem.pct), hist)
      );
    if (c.show_storage !== false) {
      const mount = sm.disks["/"] ? "/" : Object.keys(sm.disks)[0];
      if (mount) {
        const d = sm.disks[mount];
        const u = diskUsage(this._hass, d);
        rows.push(
          this._metric(d.disk_use_percent || d.disk_use || d.disk_free, ICONS.disk, this._t("disk"), u.pct, u.pct === null ? "—" : `${Math.round(u.pct)}%`, metricLevel(this._config, "disk", u.pct))
        );
      }
    }
    const temp = temperature(this._s(sc.processor_temperature), this._hass);
    if (sc.processor_temperature)
      rows.push(this._metric(sc.processor_temperature, ICONS.temp, this._t("temperature"), temp.c, esc(temp.display), metricLevel(this._config, "temp", temp.c), hist, temp.max));

    const foot = [];
    const core = this._s(sm.core_update);
    const { pending, unknown } = updateStatus(core, this._s(sm.os_update));
    const status = (pending || unknown || core)?.entity_id;
    foot.push(
      `<span class="clickable ${pending ? "warn" : unknown ? "muted" : "good"}" data-entity="${status || ""}"${status ? ' role="button" tabindex="0"' : ""}><span class="dot"></span>&nbsp;${esc(
        pending
          ? `${this._t("update")} ${pending.attributes.latest_version || ""}`.trim()
          : this._t(unknown ? "st_unknown" : core ? "up_to_date" : "running")
      )}</span>`
    );
    // Stopped processes: a red item, whose click shows the full card (its processes list unfolded), or, without the
    // zoom button, the first stopped process.
    const stopped = c.show_processes !== false ? this._stopped(sm) : [];
    if (stopped.length) {
      const text = this._t(stopped.length === 1 ? "st_stopped_one" : "st_stopped").replace("{n}", stopped.length);
      const title = esc(stopped.length === 1 ? this._t("procs_one") : this._t("procs_many").replace("{n}", stopped.length));
      const target = c.zoom === false ? `data-entity="${stopped[0]}"` : `data-action="zoom"`;
      foot.push(
        `<span class="clickable crit stopped" ${target} role="button" tabindex="0" title="${title}" aria-label="${title}"><span class="dot"></span>&nbsp;${esc(text)}</span>`
      );
    }
    // Backups too old, missing or failed: an item of their level, opening the backup sensor.
    const bk = c.show_backups !== false ? discoverBackup(this._hass) : null;
    const b = bk ? backupStatus(this._hass, this._config, bk) : null;
    if (b && (b.level === "warn" || b.level === "crit")) {
      const text = b.failed ? this._t("backup_failed") : b.last === null ? this._t("backup_none") : `${this._t("backup")} ${fmtRelative(b.last, this._loc())}`;
      foot.push(`<span class="clickable ${b.level}" data-entity="${b.id}" role="button" tabindex="0"><span class="dot"></span>&nbsp;${esc(text)}</span>`);
    }
    // With their 24 h curves, the rates of the first interface get the full card's tiles above the footer (like the
    // NAS and internet box mini cards); without, they stay in the footer.
    let netRow = "";
    if (net && c.show_history !== false) {
      netRow = this._netRow(net, hist);
    } else if (net) {
      const n = net;
      // One span per direction: each rate opens its own sensor.
      const rate = (id, cls, icon) => `<span class="clickable ${cls}" data-entity="${id || ""}"${id ? ' role="button" tabindex="0"' : ""}>${svgIcon(icon)}<span>${fmtRate(toBps(this._s(id)), this._loc())}</span></span>`;
      foot.push(
        `<span class="rates">${rate(n.throughput_network_in, "down", ICONS.down)}${rate(n.throughput_network_out, "up", ICONS.up)}</span>`
      );
    }
    const up = c.show_uptime !== false ? uptimeSec(this._s(sc.last_boot)) : null;
    if (up !== null)
      foot.push(`<span class="clickable" data-entity="${sc.last_boot}" role="button" tabindex="0">${svgIcon(ICONS.timer)}${fmtUptime(up, this._hass, this._config)}</span>`);
    return `<style>${BASE_STYLE}${MINI_STYLE}${NET_STYLE}</style>
      <ha-card>
        ${this._header(sm)}
        <div class="content">
          ${rows.join("")}
          ${netRow}
          ${foot.length ? `<div class="foot">${foot.join("")}</div>` : ""}
        </div>
      </ha-card>`;
  }
}

// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------

// The values whose sensor the visual editor lets the user choose (`entities`).
const EDITOR_ENTITIES = ["processor_use", "processor_temperature", "memory_use_percent", "swap_use_percent", "last_boot"];

class SystemMonitorEditorBase extends HTMLElement {
  static get toggles() {
    return [];
  }

  /** Boolean options off by default (show_actions). */
  static get offToggles() {
    return [];
  }

  /** Boolean options, all on by default but the offToggles. */
  _booleans() {
    return ["show_title", "show_subtitle", ...this.constructor.toggles];
  }

  _offBooleans() {
    return this.constructor.offToggles;
  }

  setConfig(config) {
    this._config = { ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _schema() {
    const tr = (k) => t(this._hass, this._config, k);
    const sm = this._hass ? discover(this._hass, this._config) : { nets: {} };
    const ifOptions = Object.keys(sm.nets)
      .filter((i) => sm.nets[i].throughput_network_in || sm.nets[i].throughput_network_out)
      .map((i) => ({ value: i, label: i }));
    return [
      { name: "title", selector: { text: {} } },
      ...shbFields(this._hass),
      {
        type: "grid",
        name: "",
        schema: [
          ...[...this._booleans(), ...this._offBooleans()].map((name) => ({ name, selector: { boolean: {} } })),
        ],
      },
      // tap_action (#129): open the entity's details (default) or nothing.
      { name: "tap_action", selector: { ui_action: { actions: ["more-info", "none"], default_action: "more-info" } } },
      // gauge_style (#131): the System section's gauges as rings (default) or as lines with bars.
      {
        name: "gauge_style",
        selector: { select: { mode: "dropdown", options: [{ value: "ring", label: tr("gauge_ring") }, { value: "bar", label: tr("gauge_bar") }] } },
      },
      // Level colours (#131): Home Assistant's colours, any CSS colour in YAML.
      { type: "grid", name: "", schema: Object.keys(LEVEL_COLORS).map((name) => ({ name, selector: { ui_color: {} } })) },
      // Warning / critical thresholds, shown at their default values.
      {
        type: "grid",
        name: "",
        schema: Object.keys(THRESHOLDS).map((name) => ({
          name,
          selector: {
            number: {
              min: 0,
              max: name.startsWith("temp") ? 150 : name.startsWith("backup") ? 365 : 100,
              step: 1,
              mode: "box",
              unit_of_measurement: name.startsWith("temp") ? "°C" : name.startsWith("backup") ? "d" : "%",
            },
          },
        })),
      },
      {
        name: "interface",
        selector: { select: { mode: "dropdown", custom_value: true, options: [{ value: "", label: tr("lang_auto") }, ...ifOptions] } },
      },
      // Sensors of the user's choice for the main values (the disks and interfaces are set in YAML), saved under
      // `entities`, as the YAML option.
      {
        type: "expandable",
        name: "entities",
        title: tr("entities"),
        schema: EDITOR_ENTITIES.map((key) => ({ name: key, selector: { entity: { domain: "sensor" } } })),
      },
      {
        name: "language",
        selector: {
          select: {
            mode: "dropdown",
            options: [
              { value: "", label: tr("lang_auto") },
              { value: "en", label: "English" },
              { value: "fr", label: "Français" },
              { value: "de", label: "Deutsch" },
              { value: "es", label: "Español" },
              { value: "sr", label: "Српски" },
              { value: "sr-Latn", label: "Srpski (latinica)" },
              { value: "it", label: "Italiano" },
              { value: "nl", label: "Nederlands" },
              { value: "pt", label: "Português (Portugal)" },
              { value: "pl", label: "Polski" },
              { value: "ro", label: "Română" },
              { value: "da", label: "Dansk" },
              { value: "sv", label: "Svenska" },
              { value: "bg", label: "Български" },
              { value: "ru", label: "Русский" },
              { value: "uk", label: "Українська" },
              { value: "hu", label: "Magyar" },
              { value: "sk", label: "Slovenčina" },
              { value: "cs", label: "Čeština" },
              { value: "sl", label: "Slovenščina" },
              { value: "lv", label: "Latviešu" },
              { value: "el", label: "Ελληνικά" },
            ],
          },
        },
      },
    ];
  }

  _render() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => shbLabel(this._hass, s.name) ?? t(this._hass, this._config, EDITOR_ENTITIES.includes(s.name) ? `ent_${s.name}` : s.name);
      this._form.computeHelper = (s) => {
        const key = `${s.name}_helper`;
        const text = t(this._hass, this._config, key);
        return text === key ? undefined : text;
      };
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        // The sensors chosen in the editor, merged into the YAML ones (disks, interfaces); emptied ones dropped.
        if (config.entities && typeof config.entities === "object") {
          const entities = Object.fromEntries(Object.entries(config.entities).filter(([, v]) => v !== "" && v !== undefined && v !== null));
          config.entities = Object.keys(entities).length ? entities : undefined;
        }
        // tap_action at its default (more-info) is left out of the YAML.
        if (config.tap_action && !tapNone(config)) delete config.tap_action;
        for (const [k, v] of Object.entries(config)) {
          // Keep the YAML minimal: drop empty values, toggles left at their default (true) and default thresholds.
          if (
            v === "" ||
            v === undefined ||
            v === null ||
            (this._booleans().includes(k) && v === true) ||
            (this._offBooleans().includes(k) && v === false) ||
            THRESHOLDS[k] === v ||
            (k === "gauge_style" && v === "ring")
          )
            delete config[k];
        }
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: shbClean(config) }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    // ha-form renders again on a new data or schema object: rebuild them only when the config, the language or the
    // network interfaces change, not on every state change of Home Assistant.
    if (this._formConfig !== this._config) {
      this._formConfig = this._config;
      const data = { ...THRESHOLDS, ...this._config };
      for (const name of this._booleans()) if (data[name] === undefined) data[name] = true;
      for (const name of this._offBooleans()) if (data[name] === undefined) data[name] = false;
      if (data.gauge_style === undefined) data.gauge_style = "ring";
      // `tap_action: none` written in YAML as a plain string: the action selector reads an object.
      if (typeof data.tap_action === "string") data.tap_action = { action: data.tap_action };
      this._form.data = shbData(data);
    }
    const schema = this._schema();
    const key = JSON.stringify(schema);
    if (key !== this._schemaKey) {
      this._schemaKey = key;
      this._form.schema = schema;
    }
  }
}

class SystemMonitorCardEditor extends SystemMonitorEditorBase {
  static get toggles() {
    return ["show_system", "show_disk", "show_uptime", "show_load", "show_ip", "show_network", "show_history", "show_storage", "show_backups", "show_processes"];
  }

  static get offToggles() {
    return ["show_actions"];
  }
}

class SystemMonitorMiniCardEditor extends SystemMonitorEditorBase {
  // The full card's sections too: the zoom button shows the full card with this same configuration.
  static get toggles() {
    return ["show_storage", "show_backups", "show_network", "show_history", "show_uptime", "zoom", "show_system", "show_disk", "show_load", "show_ip", "show_processes"];
  }

  static get offToggles() {
    return ["show_actions"];
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const define = (name, cls) => {
  if (!customElements.get(name)) pickerDefine(name, cls);
};
define("sh-system-card", SystemMonitorCard);
define("sh-system-mini-card", SystemMonitorMiniCard);
define("sh-system-card-editor", SystemMonitorCardEditor);
define("sh-system-mini-card-editor", SystemMonitorMiniCardEditor);

window.systemHubCards = window.systemHubCards || [];
for (const card of [
  {
    type: "sh-system-card",
    name: "System Monitor Card",
    description: "Monitor the machine running Home Assistant: CPU, RAM, disk, temperature, network, storage and processes.",
  },
  {
    type: "sh-system-mini-card",
    name: "System Monitor Mini Card",
    description: "Compact Home Assistant host overview: CPU, RAM, disk, temperature, network and uptime.",
  },
]) {
  if (!window.systemHubCards.some((c) => c.type === card.type))
    window.systemHubCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-system-hub#system-monitor-cards" });
}

console.info(
  `%c SYSTEM-MONITOR-CARD %c v${VERSION} `,
  "color: white; background: #18bcf2; font-weight: 700;",
  "color: #18bcf2; background: white; font-weight: 700;"
);
