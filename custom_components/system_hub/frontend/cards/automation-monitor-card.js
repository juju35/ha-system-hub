/*
 * Automation Monitor Card for Home Assistant
 * Shipped with System Hub (https://github.com/juju35/ha-system-hub), which adds it to the dashboard resources.
 *
 * Lovelace cards for the Automation Monitor integration (https://github.com/olli-dot-dev/ha-automation-monitor).
 * The two sensors of the integration are resolved through the entity registry (platform and
 * translation_key), so the cards work whatever the Home Assistant language or entity ids.
 */

const VERSION = "__VERSION__";
const PLATFORM = "automation_monitor";
const DEFAULT_MAX_ITEMS = 5;

const ICONS = {
  robot_confused:
    "M19 8H20V9H19V8M20 5H19V7H20V6H20.5C20.78 6 21 5.78 21 5.5V3.5C21 3.22 20.78 3 20.5 3H18V4H20V5M17 3H16V7H17V3M13.5 15.5C13.5 16.61 14.4 17.5 15.5 17.5S17.5 16.61 17.5 15.5 16.61 13.5 15.5 13.5 13.5 14.4 13.5 15.5M17 8H16V9H17V8M22 14H21C21 12.5 20.53 11.13 19.74 10H16.97C18.19 10.91 19 12.36 19 14V16H21V17H19V20H5V17H3V16H5V14C5 11.24 7.24 9 10 9H14C14.34 9 14.68 9.04 15 9.1V7.08C14.67 7.03 14.34 7 14 7H13V5.73C13.6 5.39 14 4.74 14 4C14 2.9 13.11 2 12 2S10 2.9 10 4C10 4.74 10.4 5.39 11 5.73V7H10C6.13 7 3 10.13 3 14H2C1.45 14 1 14.45 1 15V18C1 18.55 1.45 19 2 19H3V20C3 21.11 3.9 22 5 22H19C20.11 22 21 21.11 21 20V19H22C22.55 19 23 18.55 23 18V15C23 14.45 22.55 14 22 14M8.5 13.5C7.4 13.5 6.5 14.4 6.5 15.5S7.4 17.5 8.5 17.5 10.5 16.61 10.5 15.5 9.61 13.5 8.5 13.5Z",
  robot_alert:
    "M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z",
  disconnect:
    "M4,1C2.89,1 2,1.89 2,3V7C2,8.11 2.89,9 4,9H1V11H13V9H10C11.11,9 12,8.11 12,7V3C12,1.89 11.11,1 10,1H4M4,3H10V7H4V3M14,13C12.89,13 12,13.89 12,15V19C12,20.11 12.89,21 14,21H11V23H23V21H20C21.11,21 22,20.11 22,19V15C22,13.89 21.11,13 20,13H14M3.88,13.46L2.46,14.88L4.59,17L2.46,19.12L3.88,20.54L6,18.41L8.12,20.54L9.54,19.12L7.41,17L9.54,14.88L8.12,13.46L6,15.59L3.88,13.46M14,15H20V19H14V15Z",
  check: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z",
  alert: "M13 14H11V9H13M13 18H11V16H13M1 21H23L12 2L1 21Z",
  clock:
    "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  step: "M3,3H9V7H3V3M15,10H21V14H15V10M15,17H21V21H15V17M13,13H7V18H13V20H7L5,20V9H7V11H13V13Z",
  repeat: "M17,17H7V14L3,18L7,22V19H19V13H17M7,7H17V10L21,6L17,2V5H5V11H7V7Z",
  trace: "M2,2H4V20H22V22H2V2M7,10H17V13H7V10M11,15H21V18H11V15M6,4H22V8H20V6H8V8H6V4Z",
  edit: "M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z",
  reset: "M12,4C14.1,4 16.1,4.8 17.6,6.3C20.7,9.4 20.7,14.5 17.6,17.6C15.8,19.5 13.3,20.2 10.9,19.9L11.4,17.9C13.1,18.1 14.9,17.5 16.2,16.2C18.5,13.9 18.5,10.1 16.2,7.7C15.1,6.6 13.5,6 12,6V10.6L7,5.6L12,0.6V4M6.3,17.6C3.7,15 3.3,11 5.1,7.9L6.6,9.4C5.5,11.6 5.9,14.4 7.8,16.2C8.3,16.7 8.9,17.1 9.6,17.4L9,19.4C8,19 7.1,18.4 6.3,17.6Z",
  clear: "M5,13H19V11H5M3,17H17V15H3M7,7V9H21V7",
  refresh:
    "M17.65,6.35C16.2,4.9 14.21,4 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20C15.73,20 18.84,17.45 19.73,14H17.65C16.83,16.33 14.61,18 12,18A6,6 0 0,1 6,12A6,6 0 0,1 12,6C13.66,6 15.14,6.69 16.22,7.78L13,11H20V4L17.65,6.35Z",
  automation: "M12,2A2,2 0 0,1 14,4C14,4.74 13.6,5.39 13,5.73V7H14A7,7 0 0,1 21,14H22A1,1 0 0,1 23,15V18A1,1 0 0,1 22,19H21V20A2,2 0 0,1 19,22H5A2,2 0 0,1 3,20V19H2A1,1 0 0,1 1,18V15A1,1 0 0,1 2,14H3A7,7 0 0,1 10,7H11V5.73C10.4,5.39 10,4.74 10,4A2,2 0 0,1 12,2M7.5,13A2.5,2.5 0 0,0 5,15.5A2.5,2.5 0 0,0 7.5,18A2.5,2.5 0 0,0 10,15.5A2.5,2.5 0 0,0 7.5,13M16.5,13A2.5,2.5 0 0,0 14,15.5A2.5,2.5 0 0,0 16.5,18A2.5,2.5 0 0,0 19,15.5A2.5,2.5 0 0,0 16.5,13Z",
  script: "M14.6,16.6L19.2,12L14.6,7.4L16,6L22,12L16,18L14.6,16.6M9.4,16.6L4.8,12L9.4,7.4L8,6L2,12L8,18L9.4,16.6Z",
  scene: "M17.5,12A1.5,1.5 0 0,1 16,10.5A1.5,1.5 0 0,1 17.5,9A1.5,1.5 0 0,1 19,10.5A1.5,1.5 0 0,1 17.5,12M14.5,8A1.5,1.5 0 0,1 13,6.5A1.5,1.5 0 0,1 14.5,5A1.5,1.5 0 0,1 16,6.5A1.5,1.5 0 0,1 14.5,8M9.5,8A1.5,1.5 0 0,1 8,6.5A1.5,1.5 0 0,1 9.5,5A1.5,1.5 0 0,1 11,6.5A1.5,1.5 0 0,1 9.5,8M6.5,12A1.5,1.5 0 0,1 5,10.5A1.5,1.5 0 0,1 6.5,9A1.5,1.5 0 0,1 8,10.5A1.5,1.5 0 0,1 6.5,12M12,3A9,9 0 0,0 3,12A9,9 0 0,0 12,21A1.5,1.5 0 0,0 13.5,19.5C13.5,19.11 13.35,18.76 13.11,18.5C12.88,18.23 12.73,17.88 12.73,17.5A1.5,1.5 0 0,1 14.23,16H16A5,5 0 0,0 21,11C21,6.58 16.97,3 12,3Z",
  chevron_down: "M7.41,8.58L12,13.17L16.59,8.58L18,10L12,16L6,10L7.41,8.58Z",
  chevron_up: "M7.41,15.41L12,10.83L16.59,15.41L18,14L12,8L6,14L7.41,15.41Z",
  // mdi:arrow-expand and mdi:arrow-collapse, the mini card's detail button.
  expand: "M10,21V19H6.41L10.91,14.5L9.5,13.09L5,17.59V14H3V21H10M14.5,10.91L19,6.41V10H21V3H14V5H17.59L13.09,9.5L14.5,10.91Z",
  collapse: "M19.5,3.09L15,7.59V4H13V11H20V9H16.41L20.91,4.5L19.5,3.09M4,13V15H7.59L3.09,19.5L4.5,20.91L9,16.41V20H11V13H4Z",
};

const STRINGS = {
  en: {
    failed_automations: "Failed automations",
    linked_unavailable: "Unavailable linked entities",
    failed_short: "Failed",
    linked_short: "Unavailable",
    all_ok: "All good",
    sensor_unavailable: "Sensor unavailable",
    n_problems: "{n} problems",
    n_problems_one: "{n} problem",
    automations: "{n} automations",
    automations_one: "{n} automation",
    last_failure: "Last failure {when}",
    step: "Step",
    streak: "{n} failures in a row",
    unavailable_since: "Unavailable {when}",
    used_by: "Used by",
    trace: "Trace",
    edit: "Edit",
    reset: "Clear",
    reset_all: "Clear all",
    rebuild: "Refresh",
    rebuild_title: "rebuild the list of entities used by automations, scripts and scenes",
    confirm_reset: "Clear the failure of {name}? It will be reported again on its next failure.",
    confirm_reset_all: "Clear all failed automations? They will be reported again on their next failure.",
    cancel: "Cancel",
    show_more: "Show {n} more",
    show_less: "Show less",
    just_now: "just now",
    zoom_in: "Show the full card",
    zoom_out: "Back to the compact view",
    no_integration: "Automation Monitor not found. Is the Automation Monitor integration installed?",
    unavailable: "The Automation Monitor sensors are unavailable.",
    no_registry: "This card needs Home Assistant 2024.8 or later.",
    // Editor
    title: "Title (optional)",
    show_failed: "Show failed automations",
    show_linked: "Show unavailable linked entities",
    expand_failed: "Failed automations expanded by default",
    expand_linked: "Unavailable linked entities expanded by default",
    show_controls: "Show clear buttons",
    show_details: "Show error details",
    max_items: "Items shown per list",
    exclude_devices: "Ignored devices",
    exclude_entities: "Ignored entities",
    exclude_entities_helper: "Entity ids, or patterns with * and ?: matching automations and entities are left out of the lists, counters and status",
    hide_when_ok: "Hide when all is good",
    hide_when_ok_helper: "The card only appears when an automation failed or a linked entity is unavailable (always shown while editing the dashboard)",
    zoom: "Detail button",
    zoom_helper: "Switches the mini card to the full card and back",
    language: "Language",
    lang_auto: "Automatic",
  },
  fr: {
    failed_automations: "Automatisations en échec",
    linked_unavailable: "Entités liées indisponibles",
    failed_short: "En échec",
    linked_short: "Indisponibles",
    all_ok: "Tout va bien",
    sensor_unavailable: "Capteur indisponible",
    n_problems: "{n} problèmes",
    n_problems_one: "{n} problème",
    automations: "{n} automatisations",
    automations_one: "{n} automatisation",
    last_failure: "Dernier échec {when}",
    step: "Étape",
    streak: "{n} échecs consécutifs",
    unavailable_since: "Indisponible {when}",
    used_by: "Utilisée par",
    trace: "Trace",
    edit: "Modifier",
    reset: "Effacer",
    reset_all: "Tout effacer",
    rebuild: "Actualiser",
    rebuild_title: "reconstruire la liste des entités utilisées par les automatisations, scripts et scènes",
    confirm_reset: "Effacer l'échec de {name} ? Il sera de nouveau signalé au prochain échec.",
    confirm_reset_all: "Effacer toutes les automatisations en échec ? Elles seront de nouveau signalées au prochain échec.",
    cancel: "Annuler",
    show_more: "Afficher {n} de plus",
    show_less: "Afficher moins",
    just_now: "à l'instant",
    zoom_in: "Afficher la carte complète",
    zoom_out: "Revenir à la vue compacte",
    no_integration: "Automation Monitor introuvable. L'intégration Automation Monitor est-elle installée ?",
    unavailable: "Les capteurs d'Automation Monitor sont indisponibles.",
    no_registry: "Cette carte nécessite Home Assistant 2024.8 ou plus récent.",
    // Editor
    title: "Titre (optionnel)",
    show_failed: "Afficher les automatisations en échec",
    show_linked: "Afficher les entités liées indisponibles",
    expand_failed: "Automatisations en échec dépliées par défaut",
    expand_linked: "Entités liées indisponibles dépliées par défaut",
    show_controls: "Afficher les boutons Effacer",
    show_details: "Afficher le détail des erreurs",
    max_items: "Éléments affichés par liste",
    exclude_devices: "Appareils ignorés",
    exclude_entities: "Entités ignorées",
    exclude_entities_helper: "Identifiants d’entité, ou motifs avec * et ? : les automatisations et entités correspondantes sont exclues des listes, des compteurs et du statut",
    hide_when_ok: "Masquer quand tout va bien",
    hide_when_ok_helper: "La carte n’apparaît que si une automatisation a échoué ou si une entité liée est indisponible (toujours visible en modifiant le tableau de bord)",
    zoom: "Bouton de détail",
    zoom_helper: "Bascule la mini-carte en carte complète, et inversement",
    language: "Langue",
    lang_auto: "Automatique",
  },
  de: {
    failed_automations: "Fehlgeschlagene Automatisierungen",
    linked_unavailable: "Nicht verfügbare verknüpfte Entitäten",
    failed_short: "Fehlgeschlagen",
    linked_short: "Nicht verfügbar",
    all_ok: "Alles in Ordnung",
    sensor_unavailable: "Sensor nicht verfügbar",
    n_problems: "{n} Probleme",
    n_problems_one: "{n} Problem",
    automations: "{n} Automatisierungen",
    automations_one: "{n} Automatisierung",
    last_failure: "Letzter Fehler {when}",
    step: "Schritt",
    streak: "{n} Fehler in Folge",
    unavailable_since: "{when} ausgefallen",
    used_by: "Verwendet von",
    trace: "Trace",
    edit: "Bearbeiten",
    reset: "Löschen",
    reset_all: "Alle löschen",
    rebuild: "Aktualisieren",
    rebuild_title: "Liste der von Automatisierungen, Skripten und Szenen verwendeten Entitäten neu erstellen",
    confirm_reset: "Fehler von {name} löschen? Er wird beim nächsten Fehlschlag erneut gemeldet.",
    confirm_reset_all: "Alle fehlgeschlagenen Automatisierungen löschen? Sie werden beim nächsten Fehlschlag erneut gemeldet.",
    cancel: "Abbrechen",
    show_more: "{n} weitere anzeigen",
    show_less: "Weniger anzeigen",
    just_now: "gerade eben",
    zoom_in: "Vollständige Karte anzeigen",
    zoom_out: "Zurück zur kompakten Ansicht",
    no_integration: "Automation Monitor nicht gefunden. Ist die Automation-Monitor-Integration installiert?",
    unavailable: "Die Sensoren von Automation Monitor sind nicht verfügbar.",
    no_registry: "Diese Karte benötigt Home Assistant 2024.8 oder neuer.",
    // Editor
    title: "Titel (optional)",
    show_failed: "Fehlgeschlagene Automatisierungen anzeigen",
    show_linked: "Nicht verfügbare verknüpfte Entitäten anzeigen",
    expand_failed: "Fehlgeschlagene Automatisierungen standardmäßig aufgeklappt",
    expand_linked: "Nicht verfügbare verknüpfte Entitäten standardmäßig aufgeklappt",
    show_controls: "Löschen-Schaltflächen anzeigen",
    show_details: "Fehlerdetails anzeigen",
    max_items: "Angezeigte Elemente pro Liste",
    exclude_devices: "Ignorierte Geräte",
    exclude_entities: "Ignorierte Entitäten",
    exclude_entities_helper: "Entitäts-IDs oder Muster mit * und ?: passende Automatisierungen und Entitäten werden aus Listen, Zählern und Status ausgelassen",
    hide_when_ok: "Ausblenden, wenn alles in Ordnung ist",
    hide_when_ok_helper: "Die Karte erscheint nur, wenn eine Automatisierung fehlgeschlagen oder eine verknüpfte Entität nicht verfügbar ist (beim Bearbeiten des Dashboards immer sichtbar)",
    zoom: "Detail-Schaltfläche",
    zoom_helper: "Wechselt die Mini-Karte zur vollständigen Karte und zurück",
    language: "Sprache",
    lang_auto: "Automatisch",
  },
  es: {
    failed_automations: "Automatizaciones fallidas",
    linked_unavailable: "Entidades vinculadas no disponibles",
    failed_short: "Fallidas",
    linked_short: "No disponibles",
    all_ok: "Todo bien",
    sensor_unavailable: "Sensor no disponible",
    n_problems: "{n} problemas",
    n_problems_one: "{n} problema",
    automations: "{n} automatizaciones",
    automations_one: "{n} automatización",
    last_failure: "Último fallo {when}",
    step: "Paso",
    streak: "{n} fallos seguidos",
    unavailable_since: "No disponible {when}",
    used_by: "Usada por",
    trace: "Traza",
    edit: "Editar",
    reset: "Borrar",
    reset_all: "Borrar todo",
    rebuild: "Actualizar",
    rebuild_title: "reconstruir la lista de entidades usadas por automatizaciones, scripts y escenas",
    confirm_reset: "¿Borrar el fallo de {name}? Se volverá a notificar en su próximo fallo.",
    confirm_reset_all: "¿Borrar todas las automatizaciones fallidas? Se volverán a notificar en su próximo fallo.",
    cancel: "Cancelar",
    show_more: "Mostrar {n} más",
    show_less: "Mostrar menos",
    just_now: "ahora mismo",
    zoom_in: "Mostrar la tarjeta completa",
    zoom_out: "Volver a la vista compacta",
    no_integration: "No se encontró Automation Monitor. ¿Está instalada la integración Automation Monitor?",
    unavailable: "Los sensores de Automation Monitor no están disponibles.",
    no_registry: "Esta tarjeta requiere Home Assistant 2024.8 o posterior.",
    // Editor
    title: "Título (opcional)",
    show_failed: "Mostrar las automatizaciones fallidas",
    show_linked: "Mostrar las entidades vinculadas no disponibles",
    expand_failed: "Automatizaciones fallidas desplegadas por defecto",
    expand_linked: "Entidades vinculadas no disponibles desplegadas por defecto",
    show_controls: "Mostrar los botones Borrar",
    show_details: "Mostrar los detalles de los errores",
    max_items: "Elementos mostrados por lista",
    exclude_devices: "Dispositivos ignorados",
    exclude_entities: "Entidades ignoradas",
    exclude_entities_helper: "IDs de entidad, o patrones con * y ?: las automatizaciones y entidades que coinciden se excluyen de las listas, los contadores y el estado",
    hide_when_ok: "Ocultar cuando todo está bien",
    hide_when_ok_helper: "La tarjeta solo aparece cuando una automatización ha fallado o una entidad vinculada no está disponible (siempre visible al editar el panel)",
    zoom: "Botón de detalle",
    zoom_helper: "Cambia la minitarjeta a la tarjeta completa y viceversa",
    language: "Idioma",
    lang_auto: "Automático",
  },
  sr: {
    failed_automations: "Неуспеле аутоматизације",
    linked_unavailable: "Недоступни повезани ентитети",
    failed_short: "Неуспеле",
    linked_short: "Недоступни",
    all_ok: "Све је у реду",
    sensor_unavailable: "Сензор недоступан",
    n_problems: "{n} проблема",
    n_problems_one: "{n} проблем",
    automations: "{n} аутоматизација",
    automations_one: "{n} аутоматизација",
    automations_few: "{n} аутоматизације",
    last_failure: "Последњи неуспех {when}",
    step: "Корак",
    streak: "{n} неуспеха заредом",
    streak_one: "{n} неуспех заредом",
    unavailable_since: "Недоступно {when}",
    used_by: "Користи се у",
    trace: "Траг",
    edit: "Уреди",
    reset: "Обриши",
    reset_all: "Обриши све",
    rebuild: "Освежи",
    rebuild_title: "поново направи листу ентитета које користе аутоматизације, скрипте и сцене",
    confirm_reset: "Обрисати неуспех за {name}? Биће поново пријављен при следећем неуспеху.",
    confirm_reset_all: "Обрисати све неуспеле аутоматизације? Биће поново пријављене при следећем неуспеху.",
    cancel: "Откажи",
    show_more: "Прикажи још {n}",
    show_less: "Прикажи мање",
    just_now: "управо сада",
    zoom_in: "Прикажи целу картицу",
    zoom_out: "Назад на компактни приказ",
    no_integration: "Automation Monitor није пронађен. Да ли је интеграција Automation Monitor инсталирана?",
    unavailable: "Сензори Automation Monitor-а су недоступни.",
    no_registry: "Ова картица захтева Home Assistant 2024.8 или новији.",
    // Editor
    title: "Наслов (опционо)",
    show_failed: "Прикажи неуспеле аутоматизације",
    show_linked: "Прикажи недоступне повезане ентитете",
    expand_failed: "Неуспеле аутоматизације подразумевано проширене",
    expand_linked: "Недоступни повезани ентитети подразумевано проширени",
    show_controls: "Прикажи дугмад за брисање",
    show_details: "Прикажи детаље грешака",
    max_items: "Број ставки по листи",
    exclude_devices: "Занемарени уређаји",
    exclude_entities: "Занемарени ентитети",
    exclude_entities_helper: "ИД-ови ентитета или обрасци са * и ?: одговарајуће аутоматизације и ентитети се изостављају из листа, бројача и статуса",
    hide_when_ok: "Сакриј када је све у реду",
    hide_when_ok_helper: "Картица се појављује само када аутоматизација не успе или повезани ентитет није доступан (увек видљива током уређивања контролне табле)",
    zoom: "Дугме за детаље",
    zoom_helper: "Пребацује мини картицу на пун приказ и назад",
    language: "Језик",
    lang_auto: "Аутоматски",
  },
  "sr-Latn": {
    failed_automations: "Neuspele automatizacije",
    linked_unavailable: "Nedostupni povezani entiteti",
    failed_short: "Neuspele",
    linked_short: "Nedostupni",
    all_ok: "Sve je u redu",
    sensor_unavailable: "Senzor nedostupan",
    n_problems: "{n} problema",
    n_problems_one: "{n} problem",
    automations: "{n} automatizacija",
    automations_one: "{n} automatizacija",
    automations_few: "{n} automatizacije",
    last_failure: "Poslednji neuspeh {when}",
    step: "Korak",
    streak: "{n} neuspeha zaredom",
    streak_one: "{n} neuspeh zaredom",
    unavailable_since: "Nedostupno {when}",
    used_by: "Koristi se u",
    trace: "Trag",
    edit: "Uredi",
    reset: "Obriši",
    reset_all: "Obriši sve",
    rebuild: "Osveži",
    rebuild_title: "ponovo napravi listu entiteta koje koriste automatizacije, skripte i scene",
    confirm_reset: "Obrisati neuspeh za {name}? Biće ponovo prijavljen pri sledećem neuspehu.",
    confirm_reset_all: "Obrisati sve neuspele automatizacije? Biće ponovo prijavljene pri sledećem neuspehu.",
    cancel: "Otkaži",
    show_more: "Prikaži još {n}",
    show_less: "Prikaži manje",
    just_now: "upravo sada",
    zoom_in: "Prikaži celu karticu",
    zoom_out: "Nazad na kompaktni prikaz",
    no_integration: "Automation Monitor nije pronađen. Da li je integracija Automation Monitor instalirana?",
    unavailable: "Senzori Automation Monitor-a su nedostupni.",
    no_registry: "Ova kartica zahteva Home Assistant 2024.8 ili noviji.",
    // Editor
    title: "Naslov (opciono)",
    show_failed: "Prikaži neuspele automatizacije",
    show_linked: "Prikaži nedostupne povezane entitete",
    expand_failed: "Neuspele automatizacije podrazumevano proširene",
    expand_linked: "Nedostupni povezani entiteti podrazumevano prošireni",
    show_controls: "Prikaži dugmad za brisanje",
    show_details: "Prikaži detalje grešaka",
    max_items: "Broj stavki po listi",
    exclude_devices: "Zanemareni uređaji",
    exclude_entities: "Zanemareni entiteti",
    exclude_entities_helper: "ID-ovi entiteta ili obrasci sa * i ?: odgovarajuće automatizacije i entiteti se izostavljaju iz lista, brojača i statusa",
    hide_when_ok: "Sakrij kada je sve u redu",
    hide_when_ok_helper: "Kartica se pojavljuje samo kada automatizacija ne uspe ili povezani entitet nije dostupan (uvek vidljiva tokom uređivanja kontrolne table)",
    zoom: "Dugme za detalje",
    zoom_helper: "Prebacuje mini karticu na pun prikaz i nazad",
    language: "Jezik",
    lang_auto: "Automatski",
  },
  it: {
    failed_automations: "Automazioni non riuscite",
    linked_unavailable: "Entità collegate non disponibili",
    failed_short: "Non riuscite",
    linked_short: "Non disponibili",
    all_ok: "Tutto a posto",
    sensor_unavailable: "Sensore non disponibile",
    n_problems: "{n} problemi",
    n_problems_one: "{n} problema",
    automations: "{n} automazioni",
    automations_one: "{n} automazione",
    last_failure: "Ultimo errore {when}",
    step: "Passo",
    streak: "{n} errori consecutivi",
    unavailable_since: "Non disponibile {when}",
    used_by: "Usata da",
    trace: "Traccia",
    edit: "Modifica",
    reset: "Cancella",
    reset_all: "Cancella tutto",
    rebuild: "Aggiorna",
    rebuild_title: "ricostruisci l'elenco delle entità usate da automazioni, script e scene",
    confirm_reset: "Cancellare l'errore di {name}? Verrà segnalato di nuovo al prossimo errore.",
    confirm_reset_all: "Cancellare tutte le automazioni non riuscite? Verranno segnalate di nuovo al prossimo errore.",
    cancel: "Annulla",
    show_more: "Mostra altri {n}",
    show_less: "Mostra meno",
    just_now: "adesso",
    zoom_in: "Mostra la scheda completa",
    zoom_out: "Torna alla vista compatta",
    no_integration: "Automation Monitor non trovato. L'integrazione Automation Monitor è installata?",
    unavailable: "I sensori di Automation Monitor non sono disponibili.",
    no_registry: "Questa scheda richiede Home Assistant 2024.8 o successivo.",
    // Editor
    title: "Titolo (facoltativo)",
    show_failed: "Mostra le automazioni non riuscite",
    show_linked: "Mostra le entità collegate non disponibili",
    expand_failed: "Automazioni non riuscite espanse per impostazione predefinita",
    expand_linked: "Entità collegate non disponibili espanse per impostazione predefinita",
    show_controls: "Mostra i pulsanti Cancella",
    show_details: "Mostra i dettagli degli errori",
    max_items: "Elementi mostrati per elenco",
    exclude_devices: "Dispositivi ignorati",
    exclude_entities: "Entità ignorate",
    exclude_entities_helper: "ID di entità, o modelli con * e ?: le automazioni e le entità corrispondenti sono escluse da elenchi, contatori e stato",
    hide_when_ok: "Nascondi quando è tutto a posto",
    hide_when_ok_helper: "La scheda appare solo quando un’automazione non è riuscita o un’entità collegata non è disponibile (sempre visibile durante la modifica della plancia)",
    zoom: "Pulsante di dettaglio",
    zoom_helper: "Passa dalla mini scheda alla scheda completa e viceversa",
    language: "Lingua",
    lang_auto: "Automatica",
  },
  nl: {
    failed_automations: "Mislukte automatiseringen",
    linked_unavailable: "Niet-beschikbare gekoppelde entiteiten",
    failed_short: "Mislukt",
    linked_short: "Niet beschikbaar",
    all_ok: "Alles in orde",
    sensor_unavailable: "Sensor niet beschikbaar",
    n_problems: "{n} problemen",
    n_problems_one: "{n} probleem",
    automations: "{n} automatiseringen",
    automations_one: "{n} automatisering",
    last_failure: "Laatste fout {when}",
    step: "Stap",
    streak: "{n} keer achter elkaar mislukt",
    unavailable_since: "Niet beschikbaar {when}",
    used_by: "Gebruikt door",
    trace: "Trace",
    edit: "Bewerken",
    reset: "Wissen",
    reset_all: "Alles wissen",
    rebuild: "Vernieuwen",
    rebuild_title: "de lijst van entiteiten die door automatiseringen, scripts en scènes worden gebruikt opnieuw opbouwen",
    confirm_reset: "De fout van {name} wissen? Deze wordt bij de volgende fout opnieuw gemeld.",
    confirm_reset_all: "Alle mislukte automatiseringen wissen? Ze worden bij de volgende fout opnieuw gemeld.",
    cancel: "Annuleren",
    show_more: "Nog {n} tonen",
    show_less: "Minder tonen",
    just_now: "zojuist",
    zoom_in: "Volledige kaart tonen",
    zoom_out: "Terug naar de compacte weergave",
    no_integration: "Automation Monitor niet gevonden. Is de Automation Monitor-integratie geïnstalleerd?",
    unavailable: "De sensoren van Automation Monitor zijn niet beschikbaar.",
    no_registry: "Deze kaart vereist Home Assistant 2024.8 of nieuwer.",
    // Editor
    title: "Titel (optioneel)",
    show_failed: "Mislukte automatiseringen tonen",
    show_linked: "Niet-beschikbare gekoppelde entiteiten tonen",
    expand_failed: "Mislukte automatiseringen standaard uitgeklapt",
    expand_linked: "Niet-beschikbare gekoppelde entiteiten standaard uitgeklapt",
    show_controls: "Wisknoppen tonen",
    show_details: "Foutdetails tonen",
    max_items: "Getoonde items per lijst",
    exclude_devices: "Genegeerde apparaten",
    exclude_entities: "Genegeerde entiteiten",
    exclude_entities_helper: "Entiteit-ID’s, of patronen met * en ?: overeenkomende automatiseringen en entiteiten worden weggelaten uit de lijsten, tellers en status",
    hide_when_ok: "Verbergen als alles in orde is",
    hide_when_ok_helper: "De kaart verschijnt alleen als een automatisering is mislukt of een gekoppelde entiteit niet beschikbaar is (altijd zichtbaar tijdens het bewerken van het dashboard)",
    zoom: "Detailknop",
    zoom_helper: "Schakelt de minikaart naar de volledige kaart en terug",
    language: "Taal",
    lang_auto: "Automatisch",
  },
  pt: {
    failed_automations: "Automatizações falhadas",
    linked_unavailable: "Entidades associadas indisponíveis",
    failed_short: "Falhadas",
    linked_short: "Indisponíveis",
    all_ok: "Tudo bem",
    sensor_unavailable: "Sensor indisponível",
    n_problems: "{n} problemas",
    n_problems_one: "{n} problema",
    automations: "{n} automatizações",
    automations_one: "{n} automatização",
    last_failure: "Última falha {when}",
    step: "Passo",
    streak: "{n} falhas seguidas",
    unavailable_since: "Indisponível {when}",
    used_by: "Utilizada por",
    trace: "Rastreio",
    edit: "Editar",
    reset: "Limpar",
    reset_all: "Limpar tudo",
    rebuild: "Atualizar",
    rebuild_title: "reconstruir a lista de entidades utilizadas por automatizações, scripts e cenas",
    confirm_reset: "Limpar a falha de {name}? Voltará a ser comunicada na próxima falha.",
    confirm_reset_all: "Limpar todas as automatizações falhadas? Voltarão a ser comunicadas na próxima falha.",
    cancel: "Cancelar",
    show_more: "Mostrar mais {n}",
    show_less: "Mostrar menos",
    just_now: "agora mesmo",
    zoom_in: "Mostrar o cartão completo",
    zoom_out: "Voltar à vista compacta",
    no_integration: "Automation Monitor não encontrado. A integração Automation Monitor está instalada?",
    unavailable: "Os sensores do Automation Monitor estão indisponíveis.",
    no_registry: "Este cartão requer o Home Assistant 2024.8 ou posterior.",
    // Editor
    title: "Título (opcional)",
    show_failed: "Mostrar as automatizações falhadas",
    show_linked: "Mostrar as entidades associadas indisponíveis",
    expand_failed: "Automatizações falhadas expandidas por predefinição",
    expand_linked: "Entidades associadas indisponíveis expandidas por predefinição",
    show_controls: "Mostrar os botões Limpar",
    show_details: "Mostrar os detalhes dos erros",
    max_items: "Elementos mostrados por lista",
    exclude_devices: "Dispositivos ignorados",
    exclude_entities: "Entidades ignoradas",
    exclude_entities_helper: "IDs de entidade, ou padrões com * e ?: as automações e entidades correspondentes são excluídas das listas, contadores e estado",
    hide_when_ok: "Ocultar quando está tudo bem",
    hide_when_ok_helper: "O cartão só aparece quando uma automação falhou ou uma entidade ligada está indisponível (sempre visível ao editar o painel)",
    zoom: "Botão de detalhe",
    zoom_helper: "Alterna o mini cartão para o cartão completo e vice-versa",
    language: "Idioma",
    lang_auto: "Automático",
  },
  pl: {
    failed_automations: "Nieudane automatyzacje",
    linked_unavailable: "Niedostępne powiązane encje",
    failed_short: "Nieudane",
    linked_short: "Niedostępne",
    all_ok: "Wszystko OK",
    sensor_unavailable: "Czujnik niedostępny",
    n_problems: "{n} problemów",
    n_problems_one: "{n} problem",
    n_problems_few: "{n} problemy",
    automations: "{n} automatyzacji",
    automations_one: "{n} automatyzacja",
    automations_few: "{n} automatyzacje",
    last_failure: "Ostatni błąd {when}",
    step: "Krok",
    streak: "Błędy z rzędu: {n}",
    unavailable_since: "Niedostępna {when}",
    used_by: "Używana przez",
    trace: "Ślad",
    edit: "Edytuj",
    reset: "Wyczyść",
    reset_all: "Wyczyść wszystko",
    rebuild: "Odśwież",
    rebuild_title: "odbuduj listę encji używanych przez automatyzacje, skrypty i sceny",
    confirm_reset: "Wyczyścić błąd {name}? Zostanie ponownie zgłoszony przy następnym błędzie.",
    confirm_reset_all: "Wyczyścić wszystkie nieudane automatyzacje? Zostaną ponownie zgłoszone przy następnym błędzie.",
    cancel: "Anuluj",
    show_more: "Pokaż więcej ({n})",
    show_less: "Pokaż mniej",
    just_now: "przed chwilą",
    zoom_in: "Pokaż pełną kartę",
    zoom_out: "Wróć do widoku kompaktowego",
    no_integration: "Nie znaleziono Automation Monitor. Czy integracja Automation Monitor jest zainstalowana?",
    unavailable: "Sensory Automation Monitor są niedostępne.",
    no_registry: "Ta karta wymaga Home Assistant 2024.8 lub nowszego.",
    // Editor
    title: "Tytuł (opcjonalnie)",
    show_failed: "Pokaż nieudane automatyzacje",
    show_linked: "Pokaż niedostępne powiązane encje",
    expand_failed: "Nieudane automatyzacje domyślnie rozwinięte",
    expand_linked: "Niedostępne powiązane encje domyślnie rozwinięte",
    show_controls: "Pokaż przyciski Wyczyść",
    show_details: "Pokaż szczegóły błędów",
    max_items: "Liczba elementów na liście",
    exclude_devices: "Ignorowane urządzenia",
    exclude_entities: "Ignorowane encje",
    exclude_entities_helper: "Identyfikatory encji lub wzorce z * i ?: pasujące automatyzacje i encje są pomijane na listach, w licznikach i statusie",
    hide_when_ok: "Ukryj, gdy wszystko jest OK",
    hide_when_ok_helper: "Karta pojawia się tylko wtedy, gdy automatyzacja się nie powiodła lub powiązana encja jest niedostępna (zawsze widoczna podczas edycji pulpitu)",
    zoom: "Przycisk szczegółów",
    zoom_helper: "Przełącza minikartę na pełną kartę i z powrotem",
    language: "Język",
    lang_auto: "Automatycznie",
  },
  ro: {
    failed_automations: "Automatizări eșuate",
    linked_unavailable: "Entități legate indisponibile",
    failed_short: "Eșuate",
    linked_short: "Indisponibile",
    all_ok: "Totul în regulă",
    sensor_unavailable: "Senzor indisponibil",
    n_problems: "{n} de probleme",
    n_problems_one: "{n} problemă",
    n_problems_few: "{n} probleme",
    automations: "{n} de automatizări",
    automations_one: "{n} automatizare",
    automations_few: "{n} automatizări",
    last_failure: "Ultimul eșec {when}",
    step: "Pas",
    streak: "{n} de eșecuri consecutive",
    streak_few: "{n} eșecuri consecutive",
    unavailable_since: "Indisponibilă {when}",
    used_by: "Folosită de",
    trace: "Urmărire",
    edit: "Editează",
    reset: "Șterge",
    reset_all: "Șterge tot",
    rebuild: "Reîmprospătează",
    rebuild_title: "reconstruiește lista entităților folosite de automatizări, scripturi și scene",
    confirm_reset: "Ștergi eșecul pentru {name}? Va fi raportat din nou la următorul eșec.",
    confirm_reset_all: "Ștergi toate automatizările eșuate? Vor fi raportate din nou la următorul eșec.",
    cancel: "Anulează",
    show_more: "Afișează încă {n}",
    show_less: "Afișează mai puțin",
    just_now: "chiar acum",
    zoom_in: "Afișează cardul complet",
    zoom_out: "Înapoi la vizualizarea compactă",
    no_integration: "Automation Monitor nu a fost găsit. Integrarea Automation Monitor este instalată?",
    unavailable: "Senzorii Automation Monitor sunt indisponibili.",
    no_registry: "Acest card necesită Home Assistant 2024.8 sau o versiune mai nouă.",
    // Editor
    title: "Titlu (opțional)",
    show_failed: "Afișează automatizările eșuate",
    show_linked: "Afișează entitățile legate indisponibile",
    expand_failed: "Automatizări eșuate extinse implicit",
    expand_linked: "Entități legate indisponibile extinse implicit",
    show_controls: "Afișează butoanele Șterge",
    show_details: "Afișează detaliile erorilor",
    max_items: "Elemente afișate pe listă",
    exclude_devices: "Dispozitive ignorate",
    exclude_entities: "Entități ignorate",
    exclude_entities_helper: "ID-uri de entitate sau modele cu * și ?: automatizările și entitățile potrivite sunt excluse din liste, contoare și stare",
    hide_when_ok: "Ascunde când totul este în regulă",
    hide_when_ok_helper: "Cardul apare doar când o automatizare a eșuat sau o entitate legată este indisponibilă (mereu vizibil în timpul editării tabloului de bord)",
    zoom: "Buton de detalii",
    zoom_helper: "Comută mini-cardul la cardul complet și înapoi",
    language: "Limbă",
    lang_auto: "Automat",
  },
  da: {
    failed_automations: "Mislykkede automatiseringer",
    linked_unavailable: "Utilgængelige tilknyttede entiteter",
    failed_short: "Mislykkede",
    linked_short: "Utilgængelige",
    all_ok: "Alt er i orden",
    sensor_unavailable: "Sensor utilgængelig",
    n_problems: "{n} problemer",
    n_problems_one: "{n} problem",
    automations: "{n} automatiseringer",
    automations_one: "{n} automatisering",
    last_failure: "Seneste fejl {when}",
    step: "Trin",
    streak: "{n} fejl i træk",
    unavailable_since: "Utilgængelig {when}",
    used_by: "Bruges af",
    trace: "Sporing",
    edit: "Rediger",
    reset: "Ryd",
    reset_all: "Ryd alle",
    rebuild: "Opdater",
    rebuild_title: "genopbyg listen over entiteter, der bruges af automatiseringer, scripts og scener",
    confirm_reset: "Ryd fejlen for {name}? Den bliver rapporteret igen ved næste fejl.",
    confirm_reset_all: "Ryd alle mislykkede automatiseringer? De bliver rapporteret igen ved næste fejl.",
    cancel: "Annuller",
    show_more: "Vis {n} flere",
    show_less: "Vis færre",
    just_now: "lige nu",
    zoom_in: "Vis hele kortet",
    zoom_out: "Tilbage til kompakt visning",
    no_integration: "Automation Monitor blev ikke fundet. Er Automation Monitor-integrationen installeret?",
    unavailable: "Automation Monitor-sensorerne er utilgængelige.",
    no_registry: "Dette kort kræver Home Assistant 2024.8 eller nyere.",
    // Editor
    title: "Titel (valgfri)",
    show_failed: "Vis mislykkede automatiseringer",
    show_linked: "Vis utilgængelige tilknyttede entiteter",
    expand_failed: "Mislykkede automatiseringer udvidet som standard",
    expand_linked: "Utilgængelige tilknyttede entiteter udvidet som standard",
    show_controls: "Vis Ryd-knapper",
    show_details: "Vis fejldetaljer",
    max_items: "Elementer vist pr. liste",
    exclude_devices: "Ignorerede enheder",
    exclude_entities: "Ignorerede entiteter",
    exclude_entities_helper: "Entitets-id’er eller mønstre med * og ?: matchende automatiseringer og entiteter udelades af lister, tællere og status",
    hide_when_ok: "Skjul, når alt er i orden",
    hide_when_ok_helper: "Kortet vises kun, når en automatisering er mislykkedes, eller en tilknyttet entitet er utilgængelig (altid synligt under redigering af dashboardet)",
    zoom: "Detaljeknap",
    zoom_helper: "Skifter minikortet til hele kortet og tilbage",
    language: "Sprog",
    lang_auto: "Automatisk",
  },
  sv: {
    failed_automations: "Misslyckade automatiseringar",
    linked_unavailable: "Otillgängliga länkade entiteter",
    failed_short: "Misslyckade",
    linked_short: "Otillgängliga",
    all_ok: "Allt i ordning",
    sensor_unavailable: "Sensor otillgänglig",
    n_problems: "{n} problem",
    n_problems_one: "{n} problem",
    automations: "{n} automatiseringar",
    automations_one: "{n} automatisering",
    last_failure: "Senaste felet {when}",
    step: "Steg",
    streak: "{n} fel i rad",
    unavailable_since: "Otillgänglig {when}",
    used_by: "Används av",
    trace: "Spårning",
    edit: "Redigera",
    reset: "Rensa",
    reset_all: "Rensa alla",
    rebuild: "Uppdatera",
    rebuild_title: "bygg om listan över entiteter som används av automatiseringar, skript och scener",
    confirm_reset: "Rensa felet för {name}? Det rapporteras igen vid nästa fel.",
    confirm_reset_all: "Rensa alla misslyckade automatiseringar? De rapporteras igen vid nästa fel.",
    cancel: "Avbryt",
    show_more: "Visa {n} till",
    show_less: "Visa färre",
    just_now: "nyss",
    zoom_in: "Visa hela kortet",
    zoom_out: "Tillbaka till kompakt vy",
    no_integration: "Automation Monitor hittades inte. Är integrationen Automation Monitor installerad?",
    unavailable: "Automation Monitor-sensorerna är otillgängliga.",
    no_registry: "Det här kortet kräver Home Assistant 2024.8 eller senare.",
    // Editor
    title: "Titel (valfri)",
    show_failed: "Visa misslyckade automatiseringar",
    show_linked: "Visa otillgängliga länkade entiteter",
    expand_failed: "Misslyckade automatiseringar expanderade som standard",
    expand_linked: "Otillgängliga länkade entiteter expanderade som standard",
    show_controls: "Visa Rensa-knappar",
    show_details: "Visa felinformation",
    max_items: "Objekt som visas per lista",
    exclude_devices: "Ignorerade enheter",
    exclude_entities: "Ignorerade entiteter",
    exclude_entities_helper: "Entitets-id:n eller mönster med * och ?: matchande automatiseringar och entiteter utelämnas från listor, räknare och status",
    hide_when_ok: "Dölj när allt är i ordning",
    hide_when_ok_helper: "Kortet visas bara när en automatisering har misslyckats eller en länkad entitet är otillgänglig (visas alltid när instrumentpanelen redigeras)",
    zoom: "Detaljknapp",
    zoom_helper: "Växlar minikortet till hela kortet och tillbaka",
    language: "Språk",
    lang_auto: "Automatiskt",
  },
  bg: {
    failed_automations: "Неуспешни автоматизации",
    linked_unavailable: "Недостъпни свързани обекти",
    failed_short: "Неуспешни",
    linked_short: "Недостъпни",
    all_ok: "Всичко наред",
    sensor_unavailable: "Сензор недостъпен",
    n_problems: "{n} проблема",
    n_problems_one: "{n} проблем",
    automations: "{n} автоматизации",
    automations_one: "{n} автоматизация",
    last_failure: "Последен неуспех {when}",
    step: "Стъпка",
    streak: "{n} поредни неуспеха",
    unavailable_since: "Недостъпен {when}",
    used_by: "Използван от",
    trace: "Следа",
    edit: "Промени",
    reset: "Изчисти",
    reset_all: "Изчисти всички",
    rebuild: "Опресняване",
    rebuild_title: "повторно изграждане на списъка с обекти, използвани от автоматизации, скриптове и сцени",
    confirm_reset: "Да се изчисти ли неуспехът на {name}? Ще бъде докладван отново при следващия неуспех.",
    confirm_reset_all: "Да се изчистят ли всички неуспешни автоматизации? Ще бъдат докладвани отново при следващия неуспех.",
    cancel: "Отказ",
    show_more: "Покажи още {n}",
    show_less: "Покажи по-малко",
    just_now: "току-що",
    zoom_in: "Покажи цялата карта",
    zoom_out: "Обратно към компактния изглед",
    no_integration: "Automation Monitor не е намерен. Инсталирана ли е интеграцията Automation Monitor?",
    unavailable: "Сензорите на Automation Monitor са недостъпни.",
    no_registry: "Тази карта изисква Home Assistant 2024.8 или по-нова версия.",
    // Editor
    title: "Заглавие (по избор)",
    show_failed: "Показване на неуспешните автоматизации",
    show_linked: "Показване на недостъпните свързани обекти",
    expand_failed: "Неуспешните автоматизации разгънати по подразбиране",
    expand_linked: "Недостъпните свързани обекти разгънати по подразбиране",
    show_controls: "Показване на бутоните за изчистване",
    show_details: "Показване на подробности за грешките",
    max_items: "Брой елементи в списък",
    exclude_devices: "Игнорирани устройства",
    exclude_entities: "Игнорирани обекти",
    exclude_entities_helper: "ID на обекти или шаблони с * и ?: съответстващите автоматизации и обекти се изключват от списъците, броячите и състоянието",
    hide_when_ok: "Скриване, когато всичко е наред",
    hide_when_ok_helper: "Картата се показва само когато автоматизация е неуспешна или свързан обект е недостъпен (винаги видима при редактиране на таблото)",
    zoom: "Бутон за подробности",
    zoom_helper: "Превключва мини картата към цялата карта и обратно",
    language: "Език",
    lang_auto: "Автоматично",
  },
  ru: {
    failed_automations: "Автоматизации с ошибками",
    linked_unavailable: "Недоступные связанные объекты",
    failed_short: "С ошибками",
    linked_short: "Недоступны",
    all_ok: "Всё в порядке",
    sensor_unavailable: "Датчик недоступен",
    n_problems: "{n} проблем",
    n_problems_one: "{n} проблема",
    n_problems_few: "{n} проблемы",
    automations: "{n} автоматизаций",
    automations_one: "{n} автоматизация",
    automations_few: "{n} автоматизации",
    last_failure: "Последняя ошибка {when}",
    step: "Шаг",
    streak: "Ошибок подряд: {n}",
    unavailable_since: "Недоступен {when}",
    used_by: "Используется в",
    trace: "След",
    edit: "Изменить",
    reset: "Сбросить",
    reset_all: "Сбросить все",
    rebuild: "Обновить",
    rebuild_title: "заново построить список объектов, используемых автоматизациями, скриптами и сценами",
    confirm_reset: "Сбросить ошибку {name}? О ней снова будет сообщено при следующей ошибке.",
    confirm_reset_all: "Сбросить все автоматизации с ошибками? О них снова будет сообщено при следующей ошибке.",
    cancel: "Отмена",
    show_more: "Показать ещё {n}",
    show_less: "Показать меньше",
    just_now: "только что",
    zoom_in: "Показать полную карточку",
    zoom_out: "Вернуться к компактному виду",
    no_integration: "Automation Monitor не найден. Установлена ли интеграция Automation Monitor?",
    unavailable: "Датчики Automation Monitor недоступны.",
    no_registry: "Для этой карточки требуется Home Assistant 2024.8 или новее.",
    // Editor
    title: "Заголовок (необязательно)",
    show_failed: "Показывать автоматизации с ошибками",
    show_linked: "Показывать недоступные связанные объекты",
    expand_failed: "Автоматизации с ошибками развёрнуты по умолчанию",
    expand_linked: "Недоступные связанные объекты развёрнуты по умолчанию",
    show_controls: "Показывать кнопки «Сбросить»",
    show_details: "Показывать подробности ошибок",
    max_items: "Элементов в списке",
    exclude_devices: "Игнорируемые устройства",
    exclude_entities: "Игнорируемые объекты",
    exclude_entities_helper: "ID объектов или шаблоны с * и ?: подходящие автоматизации и объекты исключаются из списков, счётчиков и статуса",
    hide_when_ok: "Скрывать, когда всё в порядке",
    hide_when_ok_helper: "Карточка появляется, только если автоматизация завершилась ошибкой или связанный объект недоступен (всегда видна при редактировании панели)",
    zoom: "Кнопка подробностей",
    zoom_helper: "Переключает мини-карточку на полную карточку и обратно",
    language: "Язык",
    lang_auto: "Автоматически",
  },
  uk: {
    failed_automations: "Автоматизації з помилками",
    linked_unavailable: "Недоступні пов’язані сутності",
    failed_short: "З помилками",
    linked_short: "Недоступні",
    all_ok: "Усе гаразд",
    sensor_unavailable: "Датчик недоступний",
    n_problems: "{n} проблем",
    n_problems_one: "{n} проблема",
    n_problems_few: "{n} проблеми",
    automations: "{n} автоматизацій",
    automations_one: "{n} автоматизація",
    automations_few: "{n} автоматизації",
    last_failure: "Остання помилка {when}",
    step: "Крок",
    streak: "Помилок поспіль: {n}",
    unavailable_since: "Недоступна {when}",
    used_by: "Використано в",
    trace: "Слід",
    edit: "Змінити",
    reset: "Скинути",
    reset_all: "Скинути все",
    rebuild: "Оновити",
    rebuild_title: "заново побудувати список сутностей, які використовують автоматизації, скрипти та сцени",
    confirm_reset: "Скинути помилку {name}? Про неї знову буде повідомлено під час наступної помилки.",
    confirm_reset_all: "Скинути всі автоматизації з помилками? Про них знову буде повідомлено під час наступної помилки.",
    cancel: "Скасувати",
    show_more: "Показати ще {n}",
    show_less: "Показати менше",
    just_now: "щойно",
    zoom_in: "Показати повну картку",
    zoom_out: "Повернутися до компактного вигляду",
    no_integration: "Automation Monitor не знайдено. Чи встановлено інтеграцію Automation Monitor?",
    unavailable: "Датчики Automation Monitor недоступні.",
    no_registry: "Для цієї картки потрібен Home Assistant 2024.8 або новіший.",
    // Editor
    title: "Заголовок (необов’язково)",
    show_failed: "Показувати автоматизації з помилками",
    show_linked: "Показувати недоступні пов’язані сутності",
    expand_failed: "Автоматизації з помилками розгорнуті за замовчуванням",
    expand_linked: "Недоступні пов’язані сутності розгорнуті за замовчуванням",
    show_controls: "Показувати кнопки «Скинути»",
    show_details: "Показувати деталі помилок",
    max_items: "Елементів у списку",
    exclude_devices: "Ігноровані пристрої",
    exclude_entities: "Ігноровані сутності",
    exclude_entities_helper: "ID сутностей або шаблони з * і ?: відповідні автоматизації та сутності виключаються зі списків, лічильників і статусу",
    hide_when_ok: "Приховувати, коли все гаразд",
    hide_when_ok_helper: "Картка з’являється, лише коли автоматизація завершилася помилкою або пов’язана сутність недоступна (завжди видима під час редагування панелі)",
    zoom: "Кнопка деталей",
    zoom_helper: "Перемикає міні-картку на повну картку й назад",
    language: "Мова",
    lang_auto: "Автоматично",
  },
  hu: {
    failed_automations: "Sikertelen automatizálások",
    linked_unavailable: "Nem elérhető kapcsolt entitások",
    failed_short: "Sikertelen",
    linked_short: "Nem elérhető",
    all_ok: "Minden rendben",
    sensor_unavailable: "Érzékelő nem elérhető",
    n_problems: "{n} probléma",
    n_problems_one: "{n} probléma",
    automations: "{n} automatizálás",
    automations_one: "{n} automatizálás",
    last_failure: "Utolsó hiba: {when}",
    step: "Lépés",
    streak: "{n} egymást követő hiba",
    unavailable_since: "Nem elérhető: {when}",
    used_by: "Használja",
    trace: "Napló",
    edit: "Módosít",
    reset: "Törlés",
    reset_all: "Összes törlése",
    rebuild: "Frissítés",
    rebuild_title: "az automatizálások, szkriptek és jelenetek által használt entitások listájának újraépítése",
    confirm_reset: "Törlöd a(z) {name} hibáját? A következő hibánál újra megjelenik.",
    confirm_reset_all: "Törlöd az összes sikertelen automatizálást? A következő hibánál újra megjelennek.",
    cancel: "Mégse",
    show_more: "Még {n} megjelenítése",
    show_less: "Kevesebb",
    just_now: "épp most",
    zoom_in: "Teljes kártya megjelenítése",
    zoom_out: "Vissza a kompakt nézethez",
    no_integration: "Az Automation Monitor nem található. Telepítve van az Automation Monitor integráció?",
    unavailable: "Az Automation Monitor érzékelői nem elérhetők.",
    no_registry: "Ehhez a kártyához Home Assistant 2024.8 vagy újabb szükséges.",
    // Editor
    title: "Cím (opcionális)",
    show_failed: "Sikertelen automatizálások megjelenítése",
    show_linked: "Nem elérhető kapcsolt entitások megjelenítése",
    expand_failed: "Sikertelen automatizálások alapértelmezetten kibontva",
    expand_linked: "Nem elérhető kapcsolt entitások alapértelmezetten kibontva",
    show_controls: "Törlés gombok megjelenítése",
    show_details: "Hibarészletek megjelenítése",
    max_items: "Listánként megjelenített elemek",
    exclude_devices: "Figyelmen kívül hagyott eszközök",
    exclude_entities: "Figyelmen kívül hagyott entitások",
    exclude_entities_helper: "Entitásazonosítók vagy * és ? karaktert tartalmazó minták: az egyező automatizálások és entitások kimaradnak a listákból, számlálókból és az állapotból",
    hide_when_ok: "Elrejtés, ha minden rendben",
    hide_when_ok_helper: "A kártya csak akkor jelenik meg, ha egy automatizálás sikertelen volt vagy egy kapcsolt entitás nem elérhető (az irányítópult szerkesztése közben mindig látható)",
    zoom: "Részletek gomb",
    zoom_helper: "A mini kártyát teljes kártyára váltja és vissza",
    language: "Nyelv",
    lang_auto: "Automatikus",
  },
  sk: {
    failed_automations: "Neúspešné automatizácie",
    linked_unavailable: "Nedostupné prepojené entity",
    failed_short: "Neúspešné",
    linked_short: "Nedostupné",
    all_ok: "Všetko OK",
    sensor_unavailable: "Senzor nedostupný",
    n_problems: "{n} problémov",
    n_problems_one: "{n} problém",
    n_problems_few: "{n} problémy",
    automations: "{n} automatizácií",
    automations_one: "{n} automatizácia",
    automations_few: "{n} automatizácie",
    last_failure: "Posledné zlyhanie {when}",
    step: "Krok",
    streak: "Zlyhania po sebe: {n}",
    unavailable_since: "Nedostupná {when}",
    used_by: "Použitá v",
    trace: "Stopa",
    edit: "Upraviť",
    reset: "Vymazať",
    reset_all: "Vymazať všetko",
    rebuild: "Obnoviť",
    rebuild_title: "znova zostaviť zoznam entít používaných automatizáciami, skriptmi a scénami",
    confirm_reset: "Vymazať zlyhanie {name}? Pri ďalšom zlyhaní bude znova nahlásené.",
    confirm_reset_all: "Vymazať všetky neúspešné automatizácie? Pri ďalšom zlyhaní budú znova nahlásené.",
    cancel: "Zrušiť",
    show_more: "Zobraziť ďalšie ({n})",
    show_less: "Zobraziť menej",
    just_now: "práve teraz",
    zoom_in: "Zobraziť celú kartu",
    zoom_out: "Späť na kompaktné zobrazenie",
    no_integration: "Automation Monitor sa nenašiel. Je integrácia Automation Monitor nainštalovaná?",
    unavailable: "Senzory Automation Monitor sú nedostupné.",
    no_registry: "Táto karta vyžaduje Home Assistant 2024.8 alebo novší.",
    // Editor
    title: "Názov (voliteľné)",
    show_failed: "Zobraziť neúspešné automatizácie",
    show_linked: "Zobraziť nedostupné prepojené entity",
    expand_failed: "Neúspešné automatizácie predvolene rozbalené",
    expand_linked: "Nedostupné prepojené entity predvolene rozbalené",
    show_controls: "Zobraziť tlačidlá Vymazať",
    show_details: "Zobraziť podrobnosti chýb",
    max_items: "Počet položiek v zozname",
    exclude_devices: "Ignorované zariadenia",
    exclude_entities: "Ignorované entity",
    exclude_entities_helper: "ID entít alebo vzory s * a ?: zodpovedajúce automatizácie a entity sa vynechajú zo zoznamov, počítadiel a stavu",
    hide_when_ok: "Skryť, keď je všetko v poriadku",
    hide_when_ok_helper: "Karta sa zobrazí, len keď automatizácia zlyhala alebo je prepojená entita nedostupná (pri úprave ovládacieho panela je vždy viditeľná)",
    zoom: "Tlačidlo podrobností",
    zoom_helper: "Prepína minikartu na celú kartu a späť",
    language: "Jazyk",
    lang_auto: "Automaticky",
  },
  cs: {
    failed_automations: "Neúspěšné automatizace",
    linked_unavailable: "Nedostupné propojené entity",
    failed_short: "Neúspěšné",
    linked_short: "Nedostupné",
    all_ok: "Vše v pořádku",
    sensor_unavailable: "Senzor nedostupný",
    n_problems: "{n} problémů",
    n_problems_one: "{n} problém",
    n_problems_few: "{n} problémy",
    automations: "{n} automatizací",
    automations_one: "{n} automatizace",
    automations_few: "{n} automatizace",
    last_failure: "Poslední selhání {when}",
    step: "Krok",
    streak: "Selhání za sebou: {n}",
    unavailable_since: "Nedostupná {when}",
    used_by: "Použito v",
    trace: "Trasování",
    edit: "Upravit",
    reset: "Vymazat",
    reset_all: "Vymazat vše",
    rebuild: "Obnovit",
    rebuild_title: "znovu sestavit seznam entit používaných automatizacemi, skripty a scénami",
    confirm_reset: "Vymazat selhání {name}? Při dalším selhání bude znovu nahlášeno.",
    confirm_reset_all: "Vymazat všechny neúspěšné automatizace? Při dalším selhání budou znovu nahlášeny.",
    cancel: "Zrušit",
    show_more: "Zobrazit další ({n})",
    show_less: "Zobrazit méně",
    just_now: "právě teď",
    zoom_in: "Zobrazit celou kartu",
    zoom_out: "Zpět na kompaktní zobrazení",
    no_integration: "Automation Monitor nebyl nalezen. Je integrace Automation Monitor nainstalována?",
    unavailable: "Senzory Automation Monitor jsou nedostupné.",
    no_registry: "Tato karta vyžaduje Home Assistant 2024.8 nebo novější.",
    // Editor
    title: "Název (volitelné)",
    show_failed: "Zobrazit neúspěšné automatizace",
    show_linked: "Zobrazit nedostupné propojené entity",
    expand_failed: "Neúspěšné automatizace ve výchozím stavu rozbalené",
    expand_linked: "Nedostupné propojené entity ve výchozím stavu rozbalené",
    show_controls: "Zobrazit tlačítka Vymazat",
    show_details: "Zobrazit podrobnosti chyb",
    max_items: "Počet položek v seznamu",
    exclude_devices: "Ignorovaná zařízení",
    exclude_entities: "Ignorované entity",
    exclude_entities_helper: "ID entit nebo vzory s * a ?: odpovídající automatizace a entity jsou vynechány ze seznamů, počítadel a stavu",
    hide_when_ok: "Skrýt, když je vše v pořádku",
    hide_when_ok_helper: "Karta se zobrazí, jen když automatizace selhala nebo je propojená entita nedostupná (při úpravách ovládacího panelu je vždy viditelná)",
    zoom: "Tlačítko podrobností",
    zoom_helper: "Přepíná minikartu na celou kartu a zpět",
    language: "Jazyk",
    lang_auto: "Automaticky",
  },
  sl: {
    failed_automations: "Neuspešne avtomatizacije",
    linked_unavailable: "Nedosegljive povezane entitete",
    failed_short: "Neuspešne",
    linked_short: "Nedosegljive",
    all_ok: "Vse je v redu",
    sensor_unavailable: "Senzor ni na voljo",
    n_problems: "{n} težav",
    n_problems_one: "{n} težava",
    n_problems_two: "{n} težavi",
    n_problems_few: "{n} težave",
    automations: "{n} avtomatizacij",
    automations_one: "{n} avtomatizacija",
    automations_two: "{n} avtomatizaciji",
    automations_few: "{n} avtomatizacije",
    last_failure: "Zadnja napaka {when}",
    step: "Korak",
    streak: "Zaporedne napake: {n}",
    unavailable_since: "Nedosegljiva {when}",
    used_by: "Uporabljeno v",
    trace: "Sled",
    edit: "Uredi",
    reset: "Počisti",
    reset_all: "Počisti vse",
    rebuild: "Osveži",
    rebuild_title: "znova sestavi seznam entitet, ki jih uporabljajo avtomatizacije, skripte in scene",
    confirm_reset: "Počistim napako za {name}? Ob naslednji napaki bo znova prijavljena.",
    confirm_reset_all: "Počistim vse neuspešne avtomatizacije? Ob naslednji napaki bodo znova prijavljene.",
    cancel: "Prekliči",
    show_more: "Pokaži še {n}",
    show_less: "Pokaži manj",
    just_now: "pravkar",
    zoom_in: "Pokaži celotno kartico",
    zoom_out: "Nazaj na strnjen pogled",
    no_integration: "Automation Monitor ni bil najden. Ali je integracija Automation Monitor nameščena?",
    unavailable: "Senzorji Automation Monitor niso na voljo.",
    no_registry: "Ta kartica zahteva Home Assistant 2024.8 ali novejši.",
    // Editor
    title: "Naslov (neobvezno)",
    show_failed: "Pokaži neuspešne avtomatizacije",
    show_linked: "Pokaži nedosegljive povezane entitete",
    expand_failed: "Neuspešne avtomatizacije privzeto razširjene",
    expand_linked: "Nedosegljive povezane entitete privzeto razširjene",
    show_controls: "Pokaži gumbe Počisti",
    show_details: "Pokaži podrobnosti napak",
    max_items: "Število elementov na seznamu",
    exclude_devices: "Prezrte naprave",
    exclude_entities: "Prezrte entitete",
    exclude_entities_helper: "ID-ji entitet ali vzorci z * in ?: ustrezne avtomatizacije in entitete so izpuščene iz seznamov, števcev in stanja",
    hide_when_ok: "Skrij, ko je vse v redu",
    hide_when_ok_helper: "Kartica se prikaže le, ko avtomatizacija ne uspe ali povezana entiteta ni na voljo (med urejanjem nadzorne plošče je vedno vidna)",
    zoom: "Gumb za podrobnosti",
    zoom_helper: "Preklopi mini kartico na celotno kartico in nazaj",
    language: "Jezik",
    lang_auto: "Samodejno",
  },
  lv: {
    failed_automations: "Neizdevušās automatizācijas",
    linked_unavailable: "Nepieejamas saistītās vienības",
    failed_short: "Neizdevušās",
    linked_short: "Nepieejamas",
    all_ok: "Viss kārtībā",
    sensor_unavailable: "Sensors nav pieejams",
    n_problems: "{n} problēmas",
    n_problems_one: "{n} problēma",
    n_problems_zero: "{n} problēmu",
    automations: "{n} automatizācijas",
    automations_one: "{n} automatizācija",
    automations_zero: "{n} automatizāciju",
    last_failure: "Pēdējā kļūme {when}",
    step: "Solis",
    streak: "{n} kļūmes pēc kārtas",
    streak_one: "{n} kļūme pēc kārtas",
    streak_zero: "{n} kļūmju pēc kārtas",
    unavailable_since: "Nepieejama {when}",
    used_by: "Izmanto",
    trace: "Izsekot",
    edit: "Rediģēt",
    reset: "Notīrīt",
    reset_all: "Notīrīt visu",
    rebuild: "Atsvaidzināt",
    rebuild_title: "no jauna izveidot automatizāciju, skriptu un ainu izmantoto vienību sarakstu",
    confirm_reset: "Notīrīt {name} kļūmi? Par to atkal tiks ziņots nākamās kļūmes gadījumā.",
    confirm_reset_all: "Notīrīt visas neizdevušās automatizācijas? Par tām atkal tiks ziņots nākamās kļūmes gadījumā.",
    cancel: "Atcelt",
    show_more: "Rādīt vēl {n}",
    show_less: "Rādīt mazāk",
    just_now: "tikko",
    zoom_in: "Rādīt pilno kartīti",
    zoom_out: "Atpakaļ uz kompakto skatu",
    no_integration: "Automation Monitor nav atrasts. Vai Automation Monitor integrācija ir instalēta?",
    unavailable: "Automation Monitor sensori nav pieejami.",
    no_registry: "Šai kartītei nepieciešams Home Assistant 2024.8 vai jaunāks.",
    // Editor
    title: "Virsraksts (neobligāts)",
    show_failed: "Rādīt neizdevušās automatizācijas",
    show_linked: "Rādīt nepieejamās saistītās vienības",
    expand_failed: "Neizdevušās automatizācijas pēc noklusējuma izvērstas",
    expand_linked: "Nepieejamās saistītās vienības pēc noklusējuma izvērstas",
    show_controls: "Rādīt pogas Notīrīt",
    show_details: "Rādīt kļūdu informāciju",
    max_items: "Vienumu skaits sarakstā",
    exclude_devices: "Ignorētās ierīces",
    exclude_entities: "Ignorētās vienības",
    exclude_entities_helper: "Vienību ID vai šabloni ar * un ?: atbilstošās automatizācijas un vienības netiek iekļautas sarakstos, skaitītājos un statusā",
    hide_when_ok: "Paslēpt, kad viss kārtībā",
    hide_when_ok_helper: "Kartīte parādās tikai tad, ja automatizācija neizdevās vai saistītā vienība nav pieejama (informācijas paneļa rediģēšanas laikā vienmēr redzama)",
    zoom: "Detalizācijas poga",
    zoom_helper: "Pārslēdz minikartīti uz pilno kartīti un atpakaļ",
    language: "Valoda",
    lang_auto: "Automātiski",
  },
  el: {
    failed_automations: "Αυτοματισμοί που απέτυχαν",
    linked_unavailable: "Μη διαθέσιμες συνδεδεμένες οντότητες",
    failed_short: "Απέτυχαν",
    linked_short: "Μη διαθέσιμες",
    all_ok: "Όλα εντάξει",
    sensor_unavailable: "Αισθητήρας μη διαθέσιμος",
    n_problems: "{n} προβλήματα",
    n_problems_one: "{n} πρόβλημα",
    automations: "{n} αυτοματισμοί",
    automations_one: "{n} αυτοματισμός",
    last_failure: "Τελευταία αποτυχία {when}",
    step: "Βήμα",
    streak: "{n} διαδοχικές αποτυχίες",
    unavailable_since: "Μη διαθέσιμη {when}",
    used_by: "Χρησιμοποιείται από",
    trace: "Ίχνος",
    edit: "Αλλαγή",
    reset: "Απαλοιφή",
    reset_all: "Απαλοιφή όλων",
    rebuild: "Ανανέωση",
    rebuild_title: "ανακατασκευή της λίστας οντοτήτων που χρησιμοποιούνται από αυτοματισμούς, σενάρια και σκηνές",
    confirm_reset: "Απαλοιφή της αποτυχίας του {name}; Θα αναφερθεί ξανά στην επόμενη αποτυχία.",
    confirm_reset_all: "Απαλοιφή όλων των αυτοματισμών που απέτυχαν; Θα αναφερθούν ξανά στην επόμενη αποτυχία.",
    cancel: "Ακύρωση",
    show_more: "Εμφάνιση {n} ακόμη",
    show_less: "Εμφάνιση λιγότερων",
    just_now: "μόλις τώρα",
    zoom_in: "Εμφάνιση πλήρους κάρτας",
    zoom_out: "Επιστροφή στη συμπαγή προβολή",
    no_integration: "Δεν βρέθηκε το Automation Monitor. Είναι εγκατεστημένη η ενσωμάτωση Automation Monitor;",
    unavailable: "Οι αισθητήρες του Automation Monitor δεν είναι διαθέσιμοι.",
    no_registry: "Αυτή η κάρτα απαιτεί Home Assistant 2024.8 ή νεότερο.",
    // Editor
    title: "Τίτλος (προαιρετικό)",
    show_failed: "Εμφάνιση αυτοματισμών που απέτυχαν",
    show_linked: "Εμφάνιση μη διαθέσιμων συνδεδεμένων οντοτήτων",
    expand_failed: "Αυτοματισμοί που απέτυχαν ανεπτυγμένοι από προεπιλογή",
    expand_linked: "Μη διαθέσιμες συνδεδεμένες οντότητες ανεπτυγμένες από προεπιλογή",
    show_controls: "Εμφάνιση κουμπιών απαλοιφής",
    show_details: "Εμφάνιση λεπτομερειών σφαλμάτων",
    max_items: "Στοιχεία ανά λίστα",
    exclude_devices: "Συσκευές που αγνοούνται",
    exclude_entities: "Οντότητες που αγνοούνται",
    exclude_entities_helper: "Αναγνωριστικά οντοτήτων ή μοτίβα με * και ?: οι αντίστοιχοι αυτοματισμοί και οντότητες παραλείπονται από τις λίστες, τους μετρητές και την κατάσταση",
    hide_when_ok: "Απόκρυψη όταν όλα είναι εντάξει",
    hide_when_ok_helper: "Η κάρτα εμφανίζεται μόνο όταν ένας αυτοματισμός αποτύχει ή μια συνδεδεμένη οντότητα δεν είναι διαθέσιμη (πάντα ορατή κατά την επεξεργασία του πίνακα ελέγχου)",
    zoom: "Κουμπί λεπτομερειών",
    zoom_helper: "Εναλλάσσει τη μίνι κάρτα στην πλήρη κάρτα και πίσω",
    language: "Γλώσσα",
    lang_auto: "Αυτόματα",
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

// Locale for Intl: the full HA locale (pt-BR, fr-CA…) when it is in the card's language, else the card's
// language. HA uses "pt" for European Portuguese, which Intl reads as Brazilian: it becomes "pt-PT".
// sr-Latn stays as resolved, so the script follows the card and not the HA locale.
const intlLang = (hass, config) => {
  const l = lang(hass, config);
  const ha = hass && (hass.locale?.language || hass.language);
  const full = l.includes("-") || !ha || ha.split("-")[0] !== l ? l : ha;
  return full === "pt" ? "pt-PT" : full;
};

// Plural forms: with a number {n}, the text "<key>_<CLDR category>" (one, few, many…) of the language is used
// when it has one, else "<key>". One Intl.PluralRules per language.
const _plurals = new Map();
const pluralOf = (l, n) => {
  let rules = _plurals.get(l);
  if (!rules) _plurals.set(l, (rules = new Intl.PluralRules(l)));
  return rules.select(n);
};

const t = (hass, config, key, vars = {}) => {
  const l = STRINGS[lang(hass, config)][key] !== undefined ? lang(hass, config) : "en";
  const dict = STRINGS[l];
  const form = typeof vars.n === "number" ? dict[`${key}_${pluralOf(l, vars.n)}`] : undefined;
  return String(form ?? dict[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
};

const valid = (s) => s && !["unknown", "unavailable", ""].includes(s.state);

// One RelativeTimeFormat per language, instead of a new one for every relative time of every render.
const _rtf = new Map();
const rtfFor = (l) => {
  if (!_rtf.has(l)) _rtf.set(l, new Intl.RelativeTimeFormat(l, { numeric: "auto" }));
  return _rtf.get(l);
};

const ago = (hass, config, iso) => {
  const d = Date.parse(iso);
  if (!Number.isFinite(d)) return null;
  const diff = (d - Date.now()) / 1000;
  const abs = Math.abs(diff);
  if (abs < 60) return t(hass, config, "just_now");
  const rtf = rtfFor(intlLang(hass, config));
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
};

// 12 / 24 h clock from the Home Assistant profile (time_format): "12", "24", "system" (the browser's own
// locale) or "language" (the card's language, the Intl default: undefined).
const hour12Of = (hass) => {
  const tf = hass?.locale?.time_format;
  if (tf === "12") return true;
  if (tf === "24") return false;
  if (tf === "system") return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).resolvedOptions().hour12;
  return undefined;
};

const fullDate = (hass, config, iso) => {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const hour12 = hour12Of(hass);
  return d.toLocaleString(intlLang(hass, config), { dateStyle: "medium", timeStyle: "short", ...(hour12 === undefined ? {} : { hour12 }) });
};

const byDateDesc = (key) => (a, b) => (Date.parse(b[key]) || 0) - (Date.parse(a[key]) || 0);

const svgIcon = (path, cls = "") => `<svg class="icon ${cls}" viewBox="0 0 24 24"><path d="${path}"/></svg>`;

// Same values, compared by identity: used to skip a render when nothing the card shows has changed.
const sameSig = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);

// Patch the shadow DOM in place from the new HTML: nodes whose tag is unchanged are kept, so keyboard
// focus, hover, embedded pictures and CSS transitions survive an update, and only the changed text and
// attributes are written. Rows of a list carry a data-key (their entity or row id) and are matched by it,
// wherever they moved, so a focused row keeps its own data when the list is reordered (a node matched by
// position would be rewritten with the row taking its place, and Enter would act on that row). Nodes
// without a data-key are matched by position.
const patchAttrs = (cur, next) => {
  for (const { name } of [...cur.attributes]) if (!next.hasAttribute(name)) cur.removeAttribute(name);
  for (const { name, value } of next.attributes) if (cur.getAttribute(name) !== value) cur.setAttribute(name, value);
};
const keyOf = (n) => (n.nodeType === 1 ? n.getAttribute("data-key") : null);
const sameNode = (a, b) => !!a && a.nodeType === b.nodeType && a.nodeName === b.nodeName;
// Moves a kept node. moveBefore (where supported) keeps its focus; insertBefore drops it, which is safe:
// Enter then does nothing rather than act on another row.
const place = (parent, node, ref) => {
  if (node === ref) return;
  try {
    if (parent.moveBefore && node.parentNode === parent) return parent.moveBefore(node, ref);
  } catch (_e) {
    /* fall back to insertBefore */
  }
  parent.insertBefore(node, ref);
};
const patchChildren = (cur, next) => {
  const old = [...cur.childNodes];
  const fresh = [...next.childNodes];
  const byKey = new Map();
  for (const o of old) {
    const k = keyOf(o);
    if (k !== null && !byKey.has(k)) byKey.set(k, o);
  }
  const used = new Set();
  fresh.forEach((n, i) => {
    const k = keyOf(n);
    let o = k !== null ? byKey.get(k) : old[i];
    if (!sameNode(o, n) || used.has(o) || (k === null && keyOf(o) !== null)) o = null;
    const ref = cur.childNodes[i] ?? null;
    if (!o) {
      cur.insertBefore(n, ref);
      return;
    }
    used.add(o);
    place(cur, o, ref);
    if (n.nodeType === 1) {
      patchAttrs(o, n);
      patchChildren(o, n);
    } else if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue;
  });
  while (cur.childNodes.length > fresh.length) cur.removeChild(cur.lastChild);
};
const morph = (root, html) => {
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  patchChildren(root, tpl.content);
};

// Open a Home Assistant page (automation editor, trace…) without reloading the frontend.
const navigate = (path) => {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
};

// ---------------------------------------------------------------------------
// Registry-based resolution
// ---------------------------------------------------------------------------

const KEYS = { failed: "failed_automations", linked: "linked_entities_unavailable" };

/**
 * Find the two sensors of the integration: { failed, linked } entity ids. The entity registry is used
 * first (platform + translation_key); the default entity ids are a fallback.
 */
const _resolved = new WeakMap();

const resolve = (hass) => {
  if (!hass.entities) return null;
  // The registry scan is cached on the hass.entities object, which Home Assistant replaces only
  // when the registry changes (not on every state change).
  let registry = _resolved.get(hass.entities);
  if (!registry) {
    registry = {};
    for (const e of Object.values(hass.entities)) {
      if (e.platform !== PLATFORM) continue;
      for (const [k, key] of Object.entries(KEYS)) if (e.translation_key === key && !registry[k]) registry[k] = e.entity_id;
    }
    _resolved.set(hass.entities, registry);
  }
  const found = { ...registry };
  for (const [k, key] of Object.entries(KEYS)) if (!found[k] && hass.states[`sensor.${key}`]) found[k] = `sensor.${key}`;
  return found;
};

const findSensors = (hass, config) => {
  const found = resolve(hass);
  if (!found) return { error: "no_registry" };
  const failed = config.failed_entity || found.failed;
  const linked = config.linked_entity || found.linked;
  if (!failed && !linked) return { error: "no_integration" };
  return { failed, linked };
};

// Device of an item: the device_id given by the integration, else the entity registry.
const deviceOf = (hass, item) => item.device_id || hass.entities?.[item.entity_id]?.device_id || null;

const _excluded = new WeakMap();

/**
 * Devices to ignore, from exclude_devices: device ids (as the visual editor writes them) or device
 * names, so the YAML can stay readable. Returns a Set of device ids.
 */
const excludedDevices = (hass, config) => {
  // Cached on the hass.devices object (replaced only when the device registry changes), one entry
  // per exclude_devices value, instead of scanning every device on each update. A Map per value, so
  // two cards with different exclusions on the same dashboard do not evict each other's entry.
  if (!hass.devices) return computeExcluded(hass, config);
  const key = JSON.stringify(config.exclude_devices ?? null);
  let byKey = _excluded.get(hass.devices);
  if (!byKey) _excluded.set(hass.devices, (byKey = new Map()));
  if (!byKey.has(key)) byKey.set(key, computeExcluded(hass, config));
  return byKey.get(key);
};

const computeExcluded = (hass, config) => {
  const wanted = [].concat(config.exclude_devices ?? []).map((v) => String(v).trim()).filter(Boolean);
  if (!wanted.length) return null;
  const ids = new Set(wanted);
  const names = new Set(wanted.map((v) => v.toLowerCase()));
  for (const d of Object.values(hass.devices || {})) {
    const name = (d.name_by_user || d.name || "").toLowerCase();
    if (name && names.has(name)) ids.add(d.id);
  }
  return ids;
};

// Entities to ignore, from exclude_entities: entity ids or patterns with * (any characters) and ? (one
// character), case-insensitive. Returns a predicate on an entity id, or null when nothing is excluded; only
// the one for the last exclude_entities value is cached, so editing the option does not pile up matchers.
const _entityMatcherCache = { key: undefined, matcher: null };
const excludedEntities = (config) => {
  const key = JSON.stringify(config.exclude_entities ?? null);
  if (_entityMatcherCache.key !== key) {
    _entityMatcherCache.key = key;
    _entityMatcherCache.matcher = entityMatcher(config.exclude_entities);
  }
  return _entityMatcherCache.matcher;
};

const entityMatcher = (value) => {
  const wanted = [].concat(value ?? []).map((v) => String(v).trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return null;
  const ids = new Set(wanted.filter((v) => !/[*?]/.test(v)));
  const globs = wanted
    .filter((v) => /[*?]/.test(v))
    .map((v) => new RegExp(`^${v.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`));
  return (id) => {
    const s = String(id ?? "").toLowerCase();
    return ids.has(s) || globs.some((re) => re.test(s));
  };
};

// Editor page of an automation, script or scene, when it was created in the UI.
const editorPath = (hass, entityId, uniqueId) => {
  const [domain, objectId] = String(entityId).split(".");
  const s = hass.states[entityId];
  if (domain === "automation") {
    const id = s?.attributes?.id ?? uniqueId;
    return id ? `/config/automation/edit/${encodeURIComponent(id)}` : null;
  }
  // The script editor is keyed by the script key (its unique_id), which differs from the object_id
  // once the entity_id has been renamed.
  if (domain === "script") {
    const key = uniqueId ?? objectId;
    return key ? `/config/script/edit/${encodeURIComponent(key)}` : null;
  }
  if (domain === "scene") {
    const id = s?.attributes?.id ?? uniqueId;
    return id ? `/config/scene/edit/${encodeURIComponent(id)}` : null;
  }
  return null;
};

// Number of automation entities, computed once per hass.states object (the signature and the
// subtitle both need it).
const _automationCount = new WeakMap();
const automationCount = (hass) => {
  let n = _automationCount.get(hass.states);
  if (n === undefined) {
    n = Object.keys(hass.states).filter((id) => id.startsWith("automation.")).length;
    _automationCount.set(hass.states, n);
  }
  return n;
};

const tracePath = (hass, entityId, uniqueId) => {
  const id = hass.states[entityId]?.attributes?.id ?? uniqueId;
  return id ? `/config/automation/trace/${encodeURIComponent(id)}` : null;
};

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const BASE_STYLE = `
  /* Text in a state or accent colour is mixed with the theme's text colour (darker in light themes, lighter in dark
     ones) to stay readable (WCAG AA 4.5:1); dots, borders, badges and icons keep the pure colour. */
  :host { --am-blue: #1db6ec; --am-ok: var(--success-color, #43a047); --am-warn: var(--warning-color, #ffa600);
          --am-crit: var(--error-color, #db4437);
          --am-blue-text: color-mix(in srgb, var(--am-blue) 40%, var(--primary-text-color, #212121)); }
  /* A block host: its width (watched by a ResizeObserver, see _observeWidth) sets the narrow / compact / nologo / tiny
     attributes below. No CSS size container on the host: its size containment drops the card to ~24 px in a
     container that sizes it by its content (layout-card, button-card, an inline-block, an auto grid column).
     Instead the card's content does not size the host (inline-size containment on ha-card), and an invisible,
     zero-height spacer gives it its intrinsic widths: ~420 px preferred (a row of short words), a few px minimum
     (one word), so a 1fr column, or a <div> wrapping the card in one, can make it as narrow as it needs.
     min-width: 0 lets a grid or flex layout shrink the host itself. */
  :host { display: block; min-width: 0; }
  :host([hidden]) { display: none; }
  :host::before { content: "${"x ".repeat(35).trim()}"; display: block; height: 0; overflow: hidden; visibility: hidden;
                  font: 10px/0 monospace; }
  ha-card { contain: inline-size; }
  ha-card { overflow: hidden; }
  .icon { width: 18px; height: 18px; fill: currentColor; flex: none; }
  .muted { color: var(--secondary-text-color); }
  .clickable { cursor: pointer; }
  [role="button"]:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 2px; }
  .ok { --c: var(--am-ok); } .warn { --c: var(--am-warn); } .crit { --c: var(--am-crit); }
  .na { --c: var(--disabled-text-color, #9e9e9e); }
  .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--c, var(--am-ok)); flex: none; display: inline-block; }
  .chip { display: inline-flex; align-items: center; gap: 4px; padding: 1px 8px; border-radius: 12px; font-size: 11px; font-weight: 500; white-space: nowrap;
          background: color-mix(in srgb, var(--c, var(--am-ok)) 15%, transparent);
          color: color-mix(in srgb, var(--c, var(--am-ok)) 50%, var(--primary-text-color, #212121)); flex: 0 1 auto; min-width: 0; }
  /* The chip keeps its whole label and only truncates when the title is down to its minimum width. */
  .chip .txt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .header { display: flex; align-items: center; gap: 10px; padding: 12px 12px 8px; }
  /* Narrow headers free room for the title and the chip's whole label, step by step: below 320 px a smaller logo and
     narrower gaps, below 280 px no logo, and below 245 px (6 columns of the Sections view on a phone) the chip shows
     only its dot (its text stays in title and aria-label), so the title stays readable and the buttons stay in the
     card. */
  :host([compact]) .header { gap: 6px; }
  :host([compact]) .logo { height: 28px; width: 28px; }
  :host([compact]) .logo .icon { width: 16px; height: 16px; }
  :host([nologo]) .logo { display: none; }
  :host([tiny]) .chip .txt { display: none; }
  :host([tiny]) .chip { padding: 4px; }
  .logo { height: 40px; width: 40px; border-radius: 50%; flex: none; display: grid; place-items: center;
          color: var(--c, var(--am-ok)); background: color-mix(in srgb, var(--c, var(--am-ok)) 16%, transparent); }
  .logo .icon { width: 24px; height: 24px; fill: currentColor; }
  .refresh { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: none; border-radius: 50%; padding: 0;
             flex: none; cursor: pointer; background: transparent; color: var(--secondary-text-color); }
  .refresh:hover { background: var(--secondary-background-color, rgba(127,127,127,.12)); color: var(--am-blue); }
  .refresh .icon { width: 20px; height: 20px; }
  .refresh.spin .icon { color: var(--am-blue); animation: am-spin 1s linear infinite; }
  @keyframes am-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) {
    .refresh.spin .icon { animation: none; }
    .section-title .chevron { transition: none; }
  }
  /* The title block takes the room left, truncates, and keeps a few characters whatever the chip and buttons need. */
  .titles { flex: 1 1 0; min-width: 5ch; }
  .name { font-size: 16px; font-weight: 500; line-height: 1.25; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .sub { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* As ha-alert: theme text colour, warning colour on the left border and a light tint. */
  .warning { padding: 16px; color: var(--primary-text-color); border-left: 4px solid var(--am-warn);
             background: color-mix(in srgb, var(--am-warn) 12%, transparent); }
  .btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; border: none; cursor: pointer; font: inherit; font-size: 12px;
         font-weight: 500; padding: 4px 8px; border-radius: 16px; background: var(--secondary-background-color, rgba(127,127,127,.12));
         color: var(--primary-text-color); min-width: 0; white-space: nowrap; }
  .btn:hover { background: color-mix(in srgb, var(--am-blue) 16%, var(--secondary-background-color, rgba(127,127,127,.12))); }
  .btn .icon { width: 16px; height: 16px; color: var(--am-blue); }
  .counters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
  .counter { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 12px; min-width: 0;
             background: var(--secondary-background-color, rgba(127,127,127,.08)); }
  .counter.crit, .counter.warn { background: color-mix(in srgb, var(--c) 12%, transparent); }
  .counter .badge { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex: none;
                    background: color-mix(in srgb, var(--c) 18%, transparent); color: var(--c); }
  .counter .badge .icon { width: 18px; height: 18px; }
  .counter .n { font-size: 20px; font-weight: 500; line-height: 1.1; }
  .counter.crit .n, .counter.warn .n { color: color-mix(in srgb, var(--c) 50%, var(--primary-text-color, #212121)); }
  .counter .lbl { font-size: 12px; color: var(--secondary-text-color); line-height: 1.2; overflow-wrap: anywhere; }
  /* Narrow card (below 384 px): one counter per row, so long labels (Automatisierungen, automatiseringen…) fit
     their counter. */
  :host([narrow]) .counters { grid-template-columns: minmax(0, 1fr); }
  .counter > div:last-child { min-width: 0; }
  .zoom { all: unset; flex: none; cursor: pointer; width: 24px; height: 24px; margin: -4px -4px -4px 0;
          border-radius: 50%; display: grid; place-items: center; color: var(--secondary-text-color); }
  .zoom .icon { width: 16px; height: 16px; }
  .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color: var(--primary-text-color); }
  .zoom:focus-visible { outline: 2px solid var(--primary-color, #03a9f4); outline-offset: 1px; }
`;
// In-card confirmation popup (Clear / Clear all), as in ha-vacuum-card and ha-system-monitor-card: a
// backdrop over the card with a small dialog at the top, so it stays in view when the card is long,
// and follows the card's theme (the native window.confirm does neither).
const DIALOG_STYLE = `
  ha-card.dialog-open { position: relative; min-height: 160px; }
  .backdrop { position: absolute; inset: 0; background: rgba(0,0,0,.45); display: flex; align-items: flex-start; justify-content: center;
              padding-top: 12px; box-sizing: border-box; z-index: 9; border-radius: inherit; }
  .modal { background: var(--card-background-color, #1c1c1c); color: var(--primary-text-color); width: min(92%, 340px); max-height: calc(100% - 24px);
           box-sizing: border-box; border-radius: 14px; padding: 16px; box-shadow: 0 8px 30px rgba(0,0,0,.4); display: flex; flex-direction: column; gap: 12px; }
  .modal .msg { font-size: 14px; line-height: 1.4; }
  .modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
  /* No filled button: the smoked .btn background tinted with the accent colour, accent-tinted text. */
  .modal .btn.primary { color: var(--am-blue-text); background: color-mix(in srgb, var(--am-blue) 16%, var(--secondary-background-color, rgba(127,127,127,.12))); }
  .modal .btn.primary:hover { background: color-mix(in srgb, var(--am-blue) 26%, var(--secondary-background-color, rgba(127,127,127,.12))); }
`;

// After the confirmation popup closes, clicks on the card are ignored for this long: the second click of a
// double click on OK would otherwise land on what lies under the button.
const CONFIRM_GUARD_MS = 400;

// A click inside a dialog (more-info opened from the card, say) is not a click outside the card.
const inDialog = (ev) => ev.composedPath().some((n) => ["ha-more-info-dialog", "ha-dialog", "dialog"].includes(n.localName));

class AutomationMonitorBase extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._expanded = {};
    this.shadowRoot.addEventListener("click", (ev) => this._onClick(ev));
    // Escape closes the confirmation popup (as Cancel). Listened on the window, in the capture phase so a
    // dialog around the card (the card editor preview) does not get it first and close too, only while open.
    this._onKey = (ev) => {
      if (ev.key !== "Escape" || !this._confirm) return;
      ev.stopPropagation();
      this._closeConfirm();
    };
    // Keyboard access: Enter or Space on a focusable non-button element acts as a click.
    this.shadowRoot.addEventListener("keydown", (ev) => {
      if ((ev.key === "Enter" || ev.key === " ") && ev.target.getAttribute?.("role") === "button") {
        ev.preventDefault();
        ev.target.click();
      }
    });
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._config) return;
    // Render only when a state the card shows has changed, not on every state change of Home Assistant.
    const sig = this._signature();
    if (sameSig(sig, this._sig)) return;
    this._update(sig);
  }

  get hass() {
    return this._hass;
  }

  setConfig(config) {
    if (!config) throw new Error("Invalid configuration");
    this._config = { ...config };
    this._folds = {};
    this._expanded = {};
    this._html = "";
    this._update();
  }

  // Relative times ("5 minutes ago") are refreshed every minute even without a state change: the render
  // is patched in place, so only their text changes. An "All good" card shows no relative time, so the
  // tick skips the render (signature + full render chain) until a list has items again.
  connectedCallback() {
    this._observeWidth();
    this._timer = setInterval(() => {
      if (this._showsRelativeTime()) this._update();
    }, 60000);
    // A click elsewhere on the page folds the lists back to their defaults and shortens them again
    // (as in ha-carburants-france). A click, not a pointerdown: folding on press would shift the
    // layout under the pointer before the click.
    this._onOutside ??= (ev) => {
      if (!this._confirm && !Object.keys(this._folds || {}).length && !Object.keys(this._expanded).length) return;
      if (ev.composedPath().includes(this) || inDialog(ev)) return;
      // A click outside the card closes the confirmation popup (as Cancel) before anything else: the event
      // is remembered so the mini card does not also leave its zoomed view on that same click. The focus
      // stays where the user clicked.
      if (this._confirm) {
        this._confirmCloseEvent = ev;
        return this._closeConfirm(false);
      }
      this._folds = {};
      this._expanded = {};
      this._update();
    };
    document.addEventListener("click", this._onOutside, true);
    // A confirmation popup still open when the card is attached again (Lovelace keeps the card of a view
    // that is left and attaches it again on return) keeps closing on Escape.
    if (this._confirm) window.addEventListener("keydown", this._onKey, true);
  }

  // The card's width sets the host attributes the styles adapt to (no CSS size container, see :host above):
  // narrow below 384 px, compact below 320 px, nologo below 280 px, tiny below 245 px. Only a width change counts,
  // and the attributes are set on the next frame, not in the callback: they change the card's height, and resizing
  // the observed card inside its own callback is a "ResizeObserver loop completed with undelivered notifications"
  // error on window at every threshold crossed.
  _observeWidth() {
    if (typeof ResizeObserver === "undefined") return;
    this._roWidth = undefined;
    this._ro ??= new ResizeObserver((entries) => {
      const w = entries[entries.length - 1].contentRect.width;
      if (!w || w === this._roWidth) return;
      this._roWidth = w;
      if (this._roFrame) cancelAnimationFrame(this._roFrame);
      this._roFrame = requestAnimationFrame(() => {
        this._roFrame = 0;
        this.toggleAttribute("narrow", w < 384);
        this.toggleAttribute("compact", w < 320);
        this.toggleAttribute("nologo", w < 280);
        this.toggleAttribute("tiny", w < 245);
      });
    });
    this._ro.observe(this);
  }

  disconnectedCallback() {
    this._ro?.disconnect();
    if (this._roFrame) cancelAnimationFrame(this._roFrame);
    this._roFrame = 0;
    clearInterval(this._timer);
    this._stopRefresh();
    document.removeEventListener("click", this._onOutside, true);
    window.removeEventListener("keydown", this._onKey, true);
  }

  // True when the card shows at least one relative time: every one of them (subtitle, list items, mini
  // card lines) comes from a shown failed automation or unavailable linked entity.
  _showsRelativeTime() {
    if (!this._hass || !this._config) return false;
    const data = this._data();
    if (data.error) return false;
    const c = this._config;
    return (c.show_failed !== false && data.failures.length > 0) || (c.show_linked !== false && data.linked.length > 0);
  }

  _t(key, vars) {
    return t(this._hass, this._config, key, vars);
  }

  _s(id) {
    return id ? this._hass.states[id] : undefined;
  }

  // Trace, editor links and the Clear / Refresh buttons open admin pages or call admin actions: only
  // administrators get them.
  get _admin() {
    return !!this._hass?.user?.is_admin;
  }

  // What the render depends on: registries, language, the two sensors, the automations, scripts and
  // scenes they list (names, editor ids) and, only while the subtitle shows it, the number of automations
  // (counting them walks every state, and hass.states is replaced on each state change).
  _signature() {
    const h = this._hass;
    const sig = [h.entities, h.devices, h.language, h.locale?.language, h.locale?.time_format, this._admin];
    const found = findSensors(h, this._config);
    if (found.error) return sig;
    const list = (v) => (Array.isArray(v) ? v : []);
    for (const id of [found.failed, found.linked]) {
      const s = this._s(id);
      sig.push(s);
      for (const item of [...list(s?.attributes?.automations), ...list(s?.attributes?.entities)]) {
        sig.push(h.states[item.entity_id]);
        for (const src of [...list(item.referenced_by_details), ...list(item.referenced_by)]) sig.push(h.states[src?.entity_id ?? src]);
      }
    }
    if (!this._compact) {
      const data = this._data();
      if (!data.error && !this._hasLastFailure(data)) sig.push(automationCount(h));
    }
    return sig;
  }

  // Set by Lovelace while the dashboard is edited (editMode) and in the card editor's preview (preview): a card
  // hidden by hide_when_ok shows again there, so that it can still be edited.
  set editMode(v) {
    this._editMode = v;
    this._update();
  }

  get editMode() {
    return this._editMode;
  }

  set preview(v) {
    this._preview = v;
    this._update();
  }

  get preview() {
    return this._preview;
  }

  // hide_when_ok: hidden while the status is "All good" (never while a sensor can't be read). The hidden
  // property hides the host, and card-visibility-changed tells Lovelace to drop its grid slot too.
  _applyVisibility() {
    const data = this._data();
    const hide = this._config.hide_when_ok === true && !this._editMode && !this._preview && !data.error && this._status(data).cls === "ok";
    if (!!this.hidden === hide) return;
    this.hidden = hide;
    this.dispatchEvent(new CustomEvent("card-visibility-changed", { bubbles: true, composed: true }));
  }

  _update(sig) {
    if (!this._hass || !this._config) return;
    this._sig = sig ?? this._signature();
    this._applyVisibility();
    let html = this._render();
    if (this._confirm) {
      html = html.replace(/<ha-card>([\s\S]*)<\/ha-card>\s*$/, (_, inner) => `<ha-card class="dialog-open">${inner}${this._confirmHtml()}</ha-card>`);
    }
    if (html !== this._html) {
      this._html = html;
      morph(this.shadowRoot, html);
    }
  }

  // Service call whose failure is logged (Home Assistant already shows a toast) instead of left unhandled.
  _call(domain, service, data) {
    return Promise.resolve()
      .then(() => this._hass.callService(domain, service, data))
      .then(
        () => true,
        (err) => {
          console.error(`automation-monitor-card: ${domain}.${service} failed`, err);
          return false;
        }
      );
  }

  // End of the Refresh button spin (also on a failed call, or when the card is removed).
  _stopRefresh() {
    clearTimeout(this._refreshTimer);
    this._refreshTimer = null;
    if (!this._refreshing) return;
    this._refreshing = false;
    this._update();
  }

  _onClick(ev) {
    const el = ev.composedPath().find((n) => n.dataset && (n.dataset.entity || n.dataset.action || n.dataset.path));
    // Just closed: the rest of a double click on OK does nothing.
    if (!this._confirm && Date.now() - (this._confirmClosedAt ?? 0) < CONFIRM_GUARD_MS) {
      ev.stopPropagation();
      return;
    }
    // Confirmation popup open: only its buttons and the backdrop itself (outside the dialog) act.
    if (this._confirm) {
      ev.stopPropagation();
      const action = el?.dataset.action;
      if (action === "confirm_ok") {
        const { data } = this._confirm;
        this._closeConfirm();
        for (const d of [].concat(data)) this._call(PLATFORM, "reset", d);
      } else if (action === "confirm_cancel" || (action === "confirm_backdrop" && ev.composedPath()[0] === el)) {
        this._closeConfirm();
      }
      return;
    }
    if (!el) return;
    ev.stopPropagation();
    const { action, entity, label, path } = el.dataset;
    if (path) return navigate(path);
    if (action === "fold") {
      this._folds = { ...this._folds, [el.dataset.section]: !this._isOpen(el.dataset.section) };
      return this._update();
    }
    if (action === "expand") {
      this._expanded = { ...this._expanded, [entity]: !this._expanded[entity] };
      return this._update();
    }
    if (action === "reset") {
      this._openConfirm({ data: { entity_id: entity }, text: this._t("confirm_reset", { name: label }), ok: this._t("reset"), opener: el });
    } else if (action === "reset_all") {
      // Failures left out by exclude_devices / exclude_entities stay: then only the listed automations are
      // cleared, one call each (the action takes a single entity_id); otherwise one call clears them all.
      const data = this._data();
      const ids = data.failuresHidden ? [...new Set(data.failures.map((a) => a.entity_id))].map((entity_id) => ({ entity_id })) : {};
      this._openConfirm({ data: ids, text: this._t("confirm_reset_all"), ok: this._t("reset_all"), opener: el });
    } else if (action === "rebuild") {
      // Short spin of the button: the sensors update on their own once the rebuild is done.
      this._refreshing = true;
      this._update();
      clearTimeout(this._refreshTimer);
      this._refreshTimer = setTimeout(() => this._stopRefresh(), 1200);
      this._call(PLATFORM, "rebuild_linked_entities", {}).then((ok) => ok || this._stopRefresh());
    } else if (entity) {
      this.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: entity }, bubbles: true, composed: true }));
    }
  }

  // Confirmation before a Clear / Clear all service call: Cancel (button, Escape, backdrop or a click
  // outside the card) does nothing.
  _openConfirm(confirm) {
    this._confirm = confirm;
    window.addEventListener("keydown", this._onKey, true);
    this._update();
    // preventScroll: opening the popup must not bring a scrolled page back to the card.
    this.shadowRoot.querySelector(".modal .primary")?.focus({ preventScroll: true });
  }

  // The focus goes back to the Clear button that opened the popup (its OK button leaves the DOM), unless
  // the popup was closed by a click elsewhere on the page.
  _closeConfirm(restoreFocus = true) {
    const opener = this._confirm?.opener;
    this._confirm = null;
    this._confirmClosedAt = Date.now();
    window.removeEventListener("keydown", this._onKey, true);
    this._update();
    if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
  }

  _confirmHtml() {
    const c = this._confirm;
    return `<style>${DIALOG_STYLE}</style><div class="backdrop" data-action="confirm_backdrop">
      <div class="modal" role="dialog" aria-modal="true" aria-describedby="confirm-msg">
        <div class="msg" id="confirm-msg">${esc(c.text)}</div>
        <div class="modal-actions">
          <button class="btn" data-action="confirm_cancel"><span>${esc(this._t("cancel"))}</span></button>
          <button class="btn primary" data-action="confirm_ok"><span>${esc(c.ok)}</span></button>
        </div>
      </div>
    </div>`;
  }

  // Current data of the integration, computed once per hass object and configuration: the signature
  // (on every state change) and the render that follows it share the same filtered and sorted lists.
  _data() {
    const memo = this._dataMemo;
    if (memo && memo.hass === this._hass && memo.config === this._config) return memo.data;
    const data = this._computeData();
    this._dataMemo = { hass: this._hass, config: this._config, data };
    return data;
  }

  // Lists from the sensor attributes, most recent first.
  _computeData() {
    const found = findSensors(this._hass, this._config);
    if (found.error) return found;
    const f = this._s(found.failed);
    const l = this._s(found.linked);
    if (!valid(f) && !valid(l)) return { error: "unavailable" };
    // Items of an ignored device or entity are left out everywhere: lists, counters and status.
    const ignored = excludedDevices(this._hass, this._config);
    const ignoredIds = excludedEntities(this._config);
    const keep = (item) => !ignored?.has(deviceOf(this._hass, item)) && !ignoredIds?.(item.entity_id);
    const allFailures = valid(f) && Array.isArray(f.attributes.automations) ? f.attributes.automations : [];
    const failures = allFailures.filter(keep).sort(byDateDesc("last_error_time"));
    const linked = (valid(l) && Array.isArray(l.attributes.entities) ? l.attributes.entities : []).filter(keep).sort(byDateDesc("unavailable_since"));
    // A sensor that is unavailable, unknown or missing (disabled) says nothing: its counter and the status chip
    // must not read it as 0 problems.
    const failuresHidden = failures.length < allFailures.length;
    return { failedId: found.failed, linkedId: found.linked, failures, failuresHidden, linked, failedNA: !valid(f), linkedNA: !valid(l) };
  }

  _status(data) {
    const c = this._config;
    const nf = c.show_failed === false ? 0 : data.failures.length;
    const nl = c.show_linked === false ? 0 : data.linked.length;
    const n = nf + nl;
    if (n) return { cls: nf ? "crit" : "warn", text: this._t("n_problems", { n }), entity: nf ? data.failedId : data.linkedId };
    // No problem known, but a shown list cannot be read: not "All good".
    const na = (c.show_failed !== false && data.failedNA) || (c.show_linked !== false && data.linkedNA);
    if (na) return { cls: "na", text: this._t("sensor_unavailable"), entity: (c.show_failed !== false && data.failedNA ? data.failedId : data.linkedId) || "" };
    return { cls: "ok", text: this._t("all_ok"), entity: data.failedId || data.linkedId };
  }

  // True when the subtitle shows the time of the most recent failure (the signature only needs to know
  // that, not the formatted text).
  _hasLastFailure(data) {
    return this._config.show_failed !== false && data.failures.length > 0 && Number.isFinite(Date.parse(data.failures[0].last_error_time));
  }

  // Relative time of the most recent failure shown in the subtitle, or "".
  _lastFailure(data) {
    return this._hasLastFailure(data) ? ago(this._hass, this._config, data.failures[0].last_error_time) : "";
  }

  _sub(data) {
    const when = this._lastFailure(data);
    if (when) return this._t("last_failure", { when });
    // All automations of Home Assistant: the integration does not expose how many it monitors
    // (its exclusions are not visible to the card), so the label does not claim they are monitored.
    const n = automationCount(this._hass);
    return n ? this._t("automations", { n }) : "";
  }

  _header(data, sub) {
    const c = this._config;
    const status = this._status(data);
    return `
      <div class="header">
        <div class="logo ${status.cls}" aria-hidden="true">${svgIcon(ICONS.robot_confused)}</div>
        <div class="titles">
          <div class="name">${esc(c.title || "Automation Monitor")}</div>
          ${sub ? `<div class="sub">${esc(sub)}</div>` : ""}
        </div>
        <span class="chip clickable ${status.cls}" role="button" tabindex="0" data-entity="${esc(status.entity || "")}" title="${esc(status.text)}" aria-label="${esc(
          status.text
        )}"><span class="dot"></span><span class="txt">${esc(status.text)}</span></span>
        ${
          this._admin
            ? `<button class="refresh ${this._refreshing ? "spin" : ""}" data-action="rebuild" title="${esc(`${this._t("rebuild")} · ${this._t("rebuild_title")}`)}" aria-label="${esc(this._t("rebuild"))}">${svgIcon(ICONS.refresh)}</button>`
            : ""
        }
        ${this._zoomButton()}
      </div>`;
  }

  // Button at the far right of the header: only the mini card has one.
  _zoomButton() {
    return "";
  }

  _counters(data) {
    const c = this._config;
    // An unreadable sensor: a dash in a neutral counter (its own icon, not the check mark of 0), "Sensor
    // unavailable" in its tooltip.
    const counter = (id, icon, n, label, cls, na) =>
      `<div class="counter clickable ${na ? "na" : n ? cls : "ok"}" role="button" tabindex="0" data-entity="${esc(id || "")}"${
        na ? ` title="${esc(this._t("sensor_unavailable"))}"` : ""
      }>
        <div class="badge">${svgIcon(n || na ? icon : ICONS.check)}</div>
        <div><div class="n">${na ? "—" : n}</div><div class="lbl">${esc(label)}</div></div>
      </div>`;
    const list = [];
    if (c.show_failed !== false)
      list.push(
        counter(data.failedId, ICONS.robot_alert, data.failures.length, this._t(this._compact ? "failed_short" : "failed_automations"), "crit", data.failedNA)
      );
    if (c.show_linked !== false)
      list.push(
        counter(data.linkedId, ICONS.disconnect, data.linked.length, this._t(this._compact ? "linked_short" : "linked_unavailable"), "warn", data.linkedNA)
      );
    return list.length ? `<div class="counters" style="${list.length === 1 ? "grid-template-columns:minmax(0,1fr)" : ""}">${list.join("")}</div>` : "";
  }

  _errorCard(key) {
    return `<style>${BASE_STYLE}</style><ha-card><div class="warning">${esc(this._t(key))}</div></ha-card>`;
  }
}

// ---------------------------------------------------------------------------
// Full card
// ---------------------------------------------------------------------------

const FULL_STYLE = `
  .content { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 12px; }
  .section-title { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; text-transform: uppercase;
                   letter-spacing: .04em; color: var(--secondary-text-color); margin-bottom: 6px; min-height: 24px; }
  .section-title .icon { width: 16px; height: 16px; }
  /* The label takes the room left and wraps; the button, count and chevron never shrink. */
  .section-title .toggle { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; border-radius: 6px; }
  .section-title .label { min-width: 0; overflow-wrap: anywhere; }
  .section-title .count { text-transform: none; letter-spacing: 0; font-weight: 400; flex: none; }
  .section-title .btn { text-transform: none; letter-spacing: 0; flex: none; }
  /* Narrow card (below 384 px): the Clear all button shows only its icon (its text stays in title and aria-label). */
  :host([narrow]) .section-title .btn > span { display: none; }
  :host([narrow]) .section-title .btn { padding: 4px 6px; }
  .section-title.fold { cursor: pointer; user-select: none; }
  .section-title .chevron { transition: transform .2s ease; }
  .section-title.closed { margin-bottom: 0; }
  .section-title.closed .chevron { transform: rotate(-90deg); }
  .items { display: flex; flex-direction: column; gap: 6px; }
  .item { display: flex; gap: 8px; padding: 8px 10px; border-radius: 12px; min-width: 0;
          background: var(--secondary-background-color, rgba(127,127,127,.08)); border-left: 3px solid var(--c); }
  .item > .icon { width: 20px; height: 20px; color: var(--c); margin-top: 1px; }
  .item .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
  /* Name, then time: the time goes under the name when both do not fit, and both truncate rather than overflow. */
  .item .top { display: flex; flex-wrap: wrap; align-items: baseline; column-gap: 8px; row-gap: 1px; min-width: 0; }
  .item .title { flex: 1 1 auto; min-width: 0; max-width: 100%; font-size: 13px; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item .when { font-size: 12px; color: var(--secondary-text-color); white-space: nowrap; flex: 0 1 auto; min-width: 0; max-width: 100%;
                overflow: hidden; text-overflow: ellipsis; }
  .item .eid { font-size: 12px; color: var(--secondary-text-color); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .item .msg { font-family: var(--code-font-family, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace); font-size: 12px; line-height: 1.4;
               padding: 4px 8px; border-radius: 8px; overflow-wrap: anywhere; color: var(--primary-text-color);
               background: color-mix(in srgb, var(--c) 10%, transparent); }
  .tags { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .tag { display: inline-flex; align-items: center; gap: 4px; font-size: 11px; padding: 1px 6px; border-radius: 8px; max-width: 100%;
         background: var(--card-background-color, rgba(127,127,127,.12)); color: var(--primary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tag .icon { width: 14px; height: 14px; color: var(--secondary-text-color); }
  .tag.link { cursor: pointer; }
  .tag.link:hover { color: var(--am-blue-text); }
  .tag.link:hover .icon { color: var(--am-blue); }
  .tag.streak { color: color-mix(in srgb, var(--am-crit) 50%, var(--primary-text-color, #212121)); }
  .tag.streak .icon { color: var(--am-crit); }
  .actions { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
  .item .btn { background: var(--card-background-color, rgba(127,127,127,.12)); }
  .used { font-size: 12px; color: var(--secondary-text-color); }
  .more { align-self: center; }
`;

class AutomationMonitorCard extends AutomationMonitorBase {
  static getConfigElement() {
    return document.createElement("automation-monitor-card-editor");
  }

  static getStubConfig() {
    return {};
  }

  getCardSize() {
    return 6;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6 };
  }

  _render() {
    const data = this._data();
    if (data.error) return this._errorCard(data.error);
    const c = this._config;
    const parts = [this._counters(data)];
    if (c.show_failed !== false) parts.push(this._failedSection(data));
    if (c.show_linked !== false) parts.push(this._linkedSection(data));
    return `<style>${BASE_STYLE}${FULL_STYLE}</style>
      <ha-card>
        ${this._header(data, this._sub(data))}
        <div class="content">${parts.filter(Boolean).join("")}</div>
      </ha-card>`;
  }

  _max() {
    const m = parseInt(this._config.max_items, 10);
    return Number.isFinite(m) && m > 0 ? m : DEFAULT_MAX_ITEMS;
  }

  // Items of a list, cut to max_items with a "show more" button.
  _list(key, items, renderItem) {
    const max = this._max();
    const open = this._expanded[key];
    const shown = open ? items : items.slice(0, max);
    const more =
      items.length > max
        ? `<button class="btn more" data-action="expand" data-entity="${key}">${svgIcon(open ? ICONS.chevron_up : ICONS.chevron_down)}<span>${esc(
            open ? this._t("show_less") : this._t("show_more", { n: items.length - max })
          )}</span></button>`
        : "";
    return `<div class="items">${shown.map(renderItem).join("")}${more}</div>`;
  }

  // Lists are collapsed until their title is clicked, unless expand_<key> is set
  // (collapse_<key>: false, the former option, is still honoured).
  _isOpen(key) {
    return this._folds?.[key] ?? (this._config[`expand_${key}`] === true || this._config[`collapse_${key}`] === false);
  }

  // Title: icon, label, actions, "shown/total" counter and chevron, as in the Dockhand card. A click anywhere on it
  // but on its button folds the list; for the keyboard and screen readers the toggle is the icon and label (with
  // aria-expanded), next to the Clear all button and not around it (no button inside a button).
  _section(key, icon, label, items, renderItem, button) {
    const open = this._isOpen(key);
    const shown = this._expanded[key] ? items.length : Math.min(items.length, this._max());
    return `<div>
      <div class="section-title fold ${open ? "" : "closed"}" data-action="fold" data-section="${key}"><span class="toggle" role="button" tabindex="0" aria-expanded="${open}">${svgIcon(
        icon
      )}<span class="label">${esc(label)}</span></span>${button || ""}<span class="count">${shown}/${items.length}</span>${svgIcon(ICONS.chevron_down, "chevron")}</div>
      ${open ? this._list(key, items, renderItem) : ""}
    </div>`;
  }

  _failedSection(data) {
    const controls = this._config.show_controls !== false && this._admin;
    const button =
      controls && data.failures.length
        ? `<button class="btn" data-action="reset_all" title="${esc(this._t("reset_all"))}" aria-label="${esc(this._t("reset_all"))}">${svgIcon(ICONS.clear)}<span>${esc(
            this._t("reset_all")
          )}</span></button>`
        : "";
    // Nothing to list: the counter above already says so.
    if (!data.failures.length) return "";
    return this._section("failed", ICONS.robot_alert, this._t("failed_automations"), data.failures, (a) => this._failure(a, controls), button);
  }

  _failure(a, controls) {
    const h = this._hass;
    const name = a.name || a.entity_id;
    const when = ago(h, this._config, a.last_error_time);
    const tags = [];
    if (a.error_step && a.error_step !== "unknown") tags.push(`<span class="tag" title="${esc(this._t("step"))}">${svgIcon(ICONS.step)}${esc(a.error_step)}</span>`);
    if (a.consecutive_failures > 1) tags.push(`<span class="tag streak">${svgIcon(ICONS.repeat)}${esc(this._t("streak", { n: a.consecutive_failures }))}</span>`);
    const actions = [];
    const trace = this._admin && tracePath(h, a.entity_id, a.unique_id);
    const edit = this._admin && editorPath(h, a.entity_id, a.unique_id);
    if (trace) actions.push(`<button class="btn" data-key="trace" data-path="${esc(trace)}">${svgIcon(ICONS.trace)}<span>${esc(this._t("trace"))}</span></button>`);
    if (edit) actions.push(`<button class="btn" data-key="edit" data-path="${esc(edit)}">${svgIcon(ICONS.edit)}<span>${esc(this._t("edit"))}</span></button>`);
    if (controls)
      actions.push(
        `<button class="btn" data-key="reset" data-action="reset" data-entity="${esc(a.entity_id)}" data-label="${esc(name)}">${svgIcon(ICONS.reset)}<span>${esc(this._t("reset"))}</span></button>`
      );
    return `
      <div class="item crit" data-key="${esc(a.entity_id)}">
        ${svgIcon(ICONS.robot_alert)}
        <div class="body">
          <div class="top">
            <span class="title clickable" role="button" tabindex="0" data-entity="${esc(a.entity_id)}">${esc(name)}</span>
            ${when ? `<span class="when" title="${esc(fullDate(h, this._config, a.last_error_time))}">${esc(when)}</span>` : ""}
          </div>
          ${this._config.show_details !== false && a.error_message ? `<div class="msg">${esc(a.error_message)}</div>` : ""}
          ${tags.length ? `<div class="tags">${tags.join("")}</div>` : ""}
          ${actions.length ? `<div class="actions">${actions.join("")}</div>` : ""}
        </div>
      </div>`;
  }

  _linkedSection(data) {
    if (!data.linked.length) return "";
    return this._section("linked", ICONS.disconnect, this._t("linked_unavailable"), data.linked, (e) => this._linked(e));
  }

  _linked(e) {
    const h = this._hass;
    const when = ago(h, this._config, e.unavailable_since);
    const details = Array.isArray(e.referenced_by_details) && e.referenced_by_details.length ? e.referenced_by_details : (e.referenced_by || []).map((id) => ({ entity_id: id }));
    const sources = details.map((src) => {
      const domain = String(src.entity_id).split(".")[0];
      const name = src.name || h.states[src.entity_id]?.attributes?.friendly_name || src.entity_id;
      // Non-admins get the more-info dialog instead of the editor.
      const path = this._admin && editorPath(h, src.entity_id, src.unique_id);
      const icon = ICONS[domain] || ICONS.automation;
      return `<span class="tag link" role="button" tabindex="0" data-key="${esc(src.entity_id)}" ${path ? `data-path="${esc(path)}"` : `data-entity="${esc(src.entity_id)}"`} title="${esc(src.entity_id)}">${svgIcon(icon)}${esc(name)}</span>`;
    });
    return `
      <div class="item warn" data-key="${esc(e.entity_id)}">
        ${svgIcon(ICONS.disconnect)}
        <div class="body">
          <div class="top">
            <span class="title clickable" role="button" tabindex="0" data-entity="${esc(e.entity_id)}">${esc(e.name || e.entity_id)}</span>
            ${when ? `<span class="when" title="${esc(fullDate(h, this._config, e.unavailable_since))}">${esc(this._t("unavailable_since", { when }))}</span>` : ""}
          </div>
          <div class="eid">${esc(e.entity_id)}</div>
          ${sources.length ? `<div class="tags"><span class="used">${esc(this._t("used_by"))}</span>${sources.join("")}</div>` : ""}
        </div>
      </div>`;
  }
}

// ---------------------------------------------------------------------------
// Mini card
// ---------------------------------------------------------------------------

const MINI_STYLE = `
  .name { font-size: 16px; }
  /* A narrower Refresh button (same icon) leaves the title room for the detail button. */
  .refresh { width: 28px; height: 28px; }
  .content { padding: 0 12px 12px; display: flex; flex-direction: column; gap: 8px; }
  .counter { padding: 8px 10px; }
  .counter .badge { width: 30px; height: 30px; }
  .counter .badge .icon { width: 18px; height: 18px; }
  .counter .n { font-size: 20px; }
  .line { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--secondary-text-color); min-width: 0; }
  .line .icon { width: 14px; height: 14px; color: var(--c); }
  .line span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line b { font-weight: 500; color: var(--primary-text-color); }
`;

// The mini card extends the full card: its detail button (top right, `zoom: false` removes it) switches it to the
// full card's content, same configuration, and back; a click anywhere outside the card brings it back too.
class AutomationMonitorMiniCard extends AutomationMonitorCard {
  constructor() {
    super();
    this._zoomed = false;
    this.shadowRoot.addEventListener("click", (ev) => this._zoomClick(ev));
    // A click outside the card, and not in a dialog opened from it, brings it back to the compact view.
    this._onUnzoom = (ev) => {
      if (ev === this._confirmCloseEvent) return;
      if (this._zoomed && !ev.composedPath().includes(this) && !inDialog(ev)) this._setZoom(false);
    };
  }

  static getConfigElement() {
    return document.createElement("automation-monitor-mini-card-editor");
  }

  // Short counter labels, and no automation count in the signature, while compact.
  get _compact() {
    return !this._zoomed;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener("click", this._onUnzoom, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener("click", this._onUnzoom, true);
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : 3;
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6 };
  }

  _setZoom(zoomed) {
    this._zoomed = zoomed;
    this._update();
  }

  // A click on the detail button: never a tap on anything else of the card.
  _zoomClick(ev) {
    if (!ev.target?.closest?.(".zoom")) return;
    ev.stopPropagation();
    this._setZoom(!this._zoomed);
    // Keyboard use (Enter / Space: no click count) keeps the focus on the button.
    if (ev.detail === 0) this.shadowRoot.querySelector(".zoom")?.focus({ preventScroll: true });
  }

  _zoomButton() {
    if (this._config.zoom === false) return "";
    const z = this._zoomed;
    const label = esc(this._t(z ? "zoom_out" : "zoom_in"));
    return `<button class="zoom" title="${label}" aria-label="${label}" aria-expanded="${z}">${svgIcon(z ? ICONS.collapse : ICONS.expand)}</button>`;
  }

  _render() {
    if (this._zoomed) return super._render();
    const data = this._data();
    if (data.error) return this._errorCard(data.error);
    const c = this._config;
    const lines = [];
    const last = c.show_failed !== false && data.failures[0];
    if (last) {
      const when = ago(this._hass, c, last.last_error_time);
      lines.push(
        `<div class="line crit clickable" role="button" tabindex="0" data-key="failed:${esc(last.entity_id)}" data-entity="${esc(last.entity_id)}">${svgIcon(ICONS.alert)}<span><b>${esc(last.name || last.entity_id)}</b>${
          when ? ` · ${esc(when)}` : ""
        }</span></div>`
      );
    }
    const off = c.show_linked !== false && data.linked[0];
    if (off) {
      const when = ago(this._hass, c, off.unavailable_since);
      lines.push(
        `<div class="line warn clickable" role="button" tabindex="0" data-key="linked:${esc(off.entity_id)}" data-entity="${esc(off.entity_id)}">${svgIcon(ICONS.disconnect)}<span><b>${esc(off.name || off.entity_id)}</b>${
          when ? ` · ${esc(this._t("unavailable_since", { when }))}` : ""
        }</span></div>`
      );
    }
    return `<style>${BASE_STYLE}${MINI_STYLE}</style>
      <ha-card>
        ${this._header(data, "")}
        <div class="content">${this._counters(data)}${lines.join("")}</div>
      </ha-card>`;
  }
}

// ---------------------------------------------------------------------------
// Visual editors (ha-form)
// ---------------------------------------------------------------------------

class AutomationMonitorEditorBase extends HTMLElement {
  // [name, default]
  static get toggles() {
    return [
      ["show_failed", true],
      ["show_linked", true],
      ["hide_when_ok", false],
    ];
  }

  static extraFields() {
    return [];
  }

  setConfig(config) {
    this._config = { ...config };
    // Former options: collapse_<list>: false (still honoured by the card) becomes expand_<list>: true, and
    // collapse_<list> is dropped, so the "expanded by default" toggle shows the list state and acts on it.
    let migrated = false;
    for (const key of ["failed", "linked"]) {
      const collapse = `collapse_${key}`;
      if (!(collapse in this._config) || !this.constructor.toggles.some(([name]) => name === `expand_${key}`)) continue;
      if (this._config[collapse] === false) this._config[`expand_${key}`] = true;
      delete this._config[collapse];
      migrated = true;
    }
    if (migrated) this.dispatchEvent(new CustomEvent("config-changed", { detail: { config: { ...this._config } }, bubbles: true, composed: true }));
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _schema() {
    const tr = (k) => t(this._hass, this._config, k);
    return [
      { name: "title", selector: { text: {} } },
      ...this.constructor.extraFields(tr),
      { name: "exclude_devices", selector: { device: { multiple: true } } },
      // Text, not an entity picker: patterns with * and ? are allowed.
      { name: "exclude_entities", selector: { text: { multiple: true } } },
      { type: "grid", name: "", schema: this.constructor.toggles.map(([name]) => ({ name, selector: { boolean: {} } })) },
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
    const toggles = this.constructor.toggles;
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => t(this._hass, this._config, s.name);
      this._form.computeHelper = (s) => STRINGS[lang(this._hass, this._config)][`${s.name}_helper`];
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const config = { ...ev.detail.value };
        const defaults = { ...Object.fromEntries(toggles), max_items: DEFAULT_MAX_ITEMS };
        // Keep the YAML minimal: drop empty values and options left at their default.
        for (const [k, v] of Object.entries(config)) if (v === "" || v === undefined || v === null || (Array.isArray(v) && !v.length) || (k in defaults && v === defaults[k])) delete config[k];
        this._config = config;
        this.dispatchEvent(new CustomEvent("config-changed", { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    // New data or schema objects make ha-form render again: only give them when the configuration or the
    // language has changed, not on every state change of Home Assistant while the editor is open.
    if (this._formConfig !== this._config) {
      this._formConfig = this._config;
      const data = { ...this._config };
      for (const [name, def] of toggles) if (data[name] === undefined) data[name] = def;
      if (this.constructor.extraFields(() => "").some((f) => f.name === "max_items") && data.max_items === undefined) data.max_items = DEFAULT_MAX_ITEMS;
      this._form.data = data;
    }
    const l = lang(this._hass, this._config);
    if (this._formLang !== l) {
      this._formLang = l;
      this._form.schema = this._schema();
    }
  }
}

class AutomationMonitorCardEditor extends AutomationMonitorEditorBase {
  static get toggles() {
    return [...AutomationMonitorEditorBase.toggles, ["expand_failed", false], ["expand_linked", false], ["show_details", true], ["show_controls", true]];
  }

  static extraFields() {
    return [{ name: "max_items", selector: { number: { min: 1, max: 50, mode: "box" } } }];
  }
}

class AutomationMonitorMiniCardEditor extends AutomationMonitorEditorBase {
  static get toggles() {
    return [...AutomationMonitorEditorBase.toggles, ["zoom", true]];
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

const define = (name, cls) => {
  if (!customElements.get(name)) customElements.define(name, cls);
};
define("automation-monitor-card", AutomationMonitorCard);
define("automation-monitor-mini-card", AutomationMonitorMiniCard);
define("automation-monitor-card-editor", AutomationMonitorCardEditor);
define("automation-monitor-mini-card-editor", AutomationMonitorMiniCardEditor);

window.customCards = window.customCards || [];
for (const card of [
  {
    type: "automation-monitor-card",
    name: "Automation Monitor Card",
    description: "Failed automations and unavailable linked entities reported by Automation Monitor, with error details, trace and editor links.",
  },
  {
    type: "automation-monitor-mini-card",
    name: "Automation Monitor Mini Card",
    description: "Compact Automation Monitor overview: number of failed automations and unavailable linked entities.",
  },
]) {
  if (!window.customCards.some((c) => c.type === card.type))
    window.customCards.push({ ...card, preview: true, documentationURL: "https://github.com/juju35/ha-system-hub#automation-monitor-cards" });
}

console.info(
  `%c AUTOMATION-MONITOR-CARD %c v${VERSION} `,
  "color: white; background: #1db6ec; font-weight: 700;",
  "color: #1db6ec; background: white; font-weight: 700;"
);
