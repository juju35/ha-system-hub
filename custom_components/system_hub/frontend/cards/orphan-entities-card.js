/**
 * orphan-entities-card — the entities their integration no longer provides (or stale for too long), listed by
 * System Hub's Orphans module: filter them, select them and remove them from the entity registry in bulk.
 * orphan-entities-mini-card — the same on two lines, with a detail button showing the full card.
 * Served and added to the dashboard resources by System Hub (formerly bundled with Orphan Entities).
 * https://github.com/juju35/ha-system-hub
 */
var ORPHAN_ENTITIES_CARD_VERSION = '2.0.0';
// The integration, its module and the prefix of the module's actions
const OE_DOMAIN = 'system_hub';

const OE_I18N = {
  en: {
    title: 'Orphan Entities',
    none: 'No orphan',
    orphans_one: '{n} orphan',
    orphans_many: '{n} orphans',
    waiting: 'Waiting for the first scan',
    not_loaded: 'Not set up',
    never_scanned: 'Not scanned yet',
    scanned: 'Scanned {d}',
    scan_now: 'Scan now',
    action_failed: 'Failed: {error}',
    stat_orphans: 'Orphans',
    stat_removed: 'Removed',
    stat_removed_hint: 'Since Home Assistant started',
    stat_ignored: 'Ignored',
    reason_entry_removed: 'Integration removed',
    reason_integration_missing: 'Integration not loaded',
    reason_not_provided: 'Not provided',
    reason_unavailable: 'Unavailable',
    reason_unknown: 'Unknown',
    all: 'All',
    search: 'Search',
    all_integrations: 'All integrations',
    list_title: 'Orphaned entities',
    no_match: 'No entity matches the filters',
    empty: 'Every entity is provided by its integration',
    for: 'for {d}',
    disabled: 'disabled',
    select_all: 'Select the {n} shown',
    show_all: 'Show all ({n})',
    selected_one: '{n} selected',
    selected_many: '{n} selected',
    remove: 'Remove',
    ignore: 'Ignore',
    clear: 'Clear the selection',
    cancel: 'Cancel',
    confirm_remove_one: 'Remove {n} entity from the entity registry?',
    confirm_remove_many: 'Remove {n} entities from the entity registry?',
    confirm_remove_text: 'Their history stays in the database. An entity still provided by its integration comes back if the integration creates it again.',
    confirm_ignore_one: 'Ignore {n} entity?',
    confirm_ignore_many: 'Ignore {n} entities?',
    confirm_ignore_text: 'They are no longer listed. Remove them from the ignored entities in the integration options.',
    used_by: 'Used by {n}',
    ref_automation: 'Automation',
    ref_script: 'Script',
    ref_scene: 'Scene',
    ref_group: 'Group',
    ref_dashboard: 'Dashboard',
    confirm_used_one: '{n} selected entity is still in use: what uses it may stop working.',
    confirm_used_many: '{n} selected entities are still in use: what uses them may stop working.',
    remove_anyway: 'Remove anyway',
    and_more: 'and {n} more',
    removed_one: '{n} entity removed',
    removed_many: '{n} entities removed',
    devices_title: 'Orphan devices',
    devices_hint: 'Their integration was removed: nothing provides them any more',
    remove_devices: 'Remove devices',
    confirm_devices: 'Remove the orphan devices?',
    confirm_devices_text: 'They leave the device registry with their entities. Their history stays in the database.',
    devices_removed: 'Orphan devices removed: {n}',
    confirm_ignore_devices: 'Ignore the selected devices?',
    devices_ignored: 'Orphan devices ignored: {n}',
    truncated: '{n} more orphans are not listed here: remove or ignore these first.',
    devices_truncated: 'Orphan devices not listed here: {n}',
    confirm_devices_used: 'Devices still used by automations or scripts: {n}. They may stop working.',
    kept: 'Kept, no longer orphaned: {n}',
    dev_entities: 'Entities: {n}',
    ignored_one: '{n} entity ignored',
    ignored_many: '{n} entities ignored',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Orphan Entities sensor',
    ed_entity_helper: 'Orphaned entities sensor; leave empty to find it automatically',
    ed_title: 'Title',
    ed_title_helper: 'Leave empty for “Orphan Entities”',
    ed_show_stats: 'Summary',
    ed_show_stats_helper: 'Orphans, removed since start and ignored',
    ed_show_filters: 'Filters',
    ed_show_filters_helper: 'Search, integration and reason',
    ed_max_rows: 'Rows shown',
    ed_max_rows_helper: 'Before “Show all”',
    ed_scan_button: '“Scan now” button',
    ed_scan_button_helper: 'Scans from the header, for every user who sees the card',
    ed_hide_when_empty: 'Hide the card when there is no orphan',
    ed_hide_when_empty_helper: 'The card only appears when an entity is orphaned',
    zoom_in: 'Show details',
    zoom_out: 'Back to the compact view',
    ed_zoom: 'Detail button',
    ed_zoom_helper: 'Switches to the full card and back',
    ed_language: 'Language',
    ed_language_helper: 'Leave empty to follow Home Assistant',
  },
  fr: {
    title: 'Orphan Entities',
    none: 'Aucune orpheline',
    orphans_one: '{n} orpheline',
    orphans_many: '{n} orphelines',
    waiting: 'En attente de la première analyse',
    not_loaded: 'Non configuré',
    never_scanned: 'Pas encore analysé',
    scanned: 'Analysé {d}',
    scan_now: 'Analyser maintenant',
    action_failed: 'Échec : {error}',
    stat_orphans: 'Orphelines',
    stat_removed: 'Supprimées',
    stat_removed_hint: 'Depuis le démarrage de Home Assistant',
    stat_ignored: 'Ignorées',
    reason_entry_removed: 'Intégration supprimée',
    reason_integration_missing: 'Intégration non chargée',
    reason_not_provided: 'Non fournie',
    reason_unavailable: 'Indisponible',
    reason_unknown: 'Inconnue',
    all: 'Toutes',
    search: 'Rechercher',
    all_integrations: 'Toutes les intégrations',
    list_title: 'Entités orphelines',
    no_match: 'Aucune entité ne correspond aux filtres',
    empty: 'Chaque entité est fournie par son intégration',
    for: 'depuis {d}',
    disabled: 'désactivée',
    select_all: 'Sélectionner les {n} affichées',
    show_all: 'Tout afficher ({n})',
    selected_one: '{n} sélectionnée',
    selected_many: '{n} sélectionnées',
    remove: 'Supprimer',
    ignore: 'Ignorer',
    clear: 'Effacer la sélection',
    cancel: 'Annuler',
    confirm_remove_one: 'Supprimer {n} entité du registre des entités ?',
    confirm_remove_many: 'Supprimer {n} entités du registre des entités ?',
    confirm_remove_text: 'Leur historique reste dans la base de données. Une entité encore fournie par son intégration revient si l’intégration la recrée.',
    confirm_ignore_one: 'Ignorer {n} entité ?',
    confirm_ignore_many: 'Ignorer {n} entités ?',
    confirm_ignore_text: 'Elles ne sont plus listées. Retirez-les des entités ignorées dans les options de l’intégration.',
    used_by: 'Utilisée par {n}',
    ref_automation: 'Automatisation',
    ref_script: 'Script',
    ref_scene: 'Scène',
    ref_group: 'Groupe',
    ref_dashboard: 'Tableau de bord',
    confirm_used_one: '{n} entité sélectionnée est encore utilisée : ce qui l’utilise risque de ne plus fonctionner.',
    confirm_used_many: '{n} entités sélectionnées sont encore utilisées : ce qui les utilise risque de ne plus fonctionner.',
    remove_anyway: 'Supprimer quand même',
    and_more: 'et {n} de plus',
    removed_one: '{n} entité supprimée',
    removed_many: '{n} entités supprimées',
    devices_title: 'Appareils orphelins',
    devices_hint: 'Leur intégration a été supprimée : plus rien ne les fournit',
    remove_devices: 'Supprimer les appareils',
    confirm_devices: 'Supprimer les appareils orphelins ?',
    confirm_devices_text: 'Ils quittent le registre des appareils avec leurs entités. Leur historique reste dans la base.',
    devices_removed: 'Appareils orphelins supprimés : {n}',
    confirm_ignore_devices: 'Ignorer les appareils sélectionnés ?',
    devices_ignored: 'Appareils orphelins ignorés : {n}',
    truncated: '{n} autres orphelins ne sont pas listés ici : supprimez ou ignorez d’abord ceux-ci.',
    devices_truncated: 'Appareils orphelins non listés ici : {n}',
    confirm_devices_used: 'Appareils encore utilisés par des automatisations ou des scripts : {n}. Ils risquent de ne plus fonctionner.',
    kept: 'Conservés, plus orphelins : {n}',
    dev_entities: 'Entités : {n}',
    ignored_one: '{n} entité ignorée',
    ignored_many: '{n} entités ignorées',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} j',
    ed_entity: 'Capteur Orphan Entities',
    ed_entity_helper: 'Capteur des entités orphelines ; laisser vide pour le trouver automatiquement',
    ed_title: 'Titre',
    ed_title_helper: 'Laisser vide pour « Orphan Entities »',
    ed_show_stats: 'Résumé',
    ed_show_stats_helper: 'Orphelines, supprimées depuis le démarrage et ignorées',
    ed_show_filters: 'Filtres',
    ed_show_filters_helper: 'Recherche, intégration et motif',
    ed_max_rows: 'Lignes affichées',
    ed_max_rows_helper: 'Avant « Tout afficher »',
    ed_scan_button: 'Bouton « Analyser maintenant »',
    ed_scan_button_helper: 'Lance une analyse depuis l’en-tête, pour tout utilisateur qui voit la carte',
    ed_hide_when_empty: 'Masquer la carte quand il n’y a aucune orpheline',
    ed_hide_when_empty_helper: 'La carte n’apparaît que si une entité est orpheline',
    zoom_in: 'Afficher le détail',
    zoom_out: 'Revenir à la vue compacte',
    ed_zoom: 'Bouton détail',
    ed_zoom_helper: 'Bascule vers la carte complète et retour',
    ed_language: 'Langue',
    ed_language_helper: 'Laisser vide pour suivre Home Assistant',
  },
  de: {
    title: 'Orphan Entities',
    none: 'Keine verwaisten',
    orphans_one: '{n} verwaist',
    orphans_many: '{n} verwaist',
    waiting: 'Warten auf den ersten Scan',
    not_loaded: 'Nicht eingerichtet',
    never_scanned: 'Noch nicht gescannt',
    scanned: 'Gescannt {d}',
    scan_now: 'Jetzt scannen',
    action_failed: 'Fehlgeschlagen: {error}',
    stat_orphans: 'Verwaist',
    stat_removed: 'Entfernt',
    stat_removed_hint: 'Seit dem Start von Home Assistant',
    stat_ignored: 'Ignoriert',
    reason_entry_removed: 'Integration entfernt',
    reason_integration_missing: 'Integration nicht geladen',
    reason_not_provided: 'Nicht bereitgestellt',
    reason_unavailable: 'Nicht verfügbar',
    reason_unknown: 'Unbekannt',
    all: 'Alle',
    search: 'Suchen',
    all_integrations: 'Alle Integrationen',
    list_title: 'Verwaiste Entitäten',
    no_match: 'Keine Entität entspricht den Filtern',
    empty: 'Jede Entität wird von ihrer Integration bereitgestellt',
    for: 'seit {d}',
    disabled: 'deaktiviert',
    select_all: 'Die {n} angezeigten auswählen',
    show_all: 'Alle anzeigen ({n})',
    selected_one: '{n} ausgewählt',
    selected_many: '{n} ausgewählt',
    remove: 'Entfernen',
    ignore: 'Ignorieren',
    clear: 'Auswahl aufheben',
    cancel: 'Abbrechen',
    confirm_remove_one: '{n} Entität aus dem Entitätsregister entfernen?',
    confirm_remove_many: '{n} Entitäten aus dem Entitätsregister entfernen?',
    confirm_remove_text: 'Ihr Verlauf bleibt in der Datenbank. Eine noch von ihrer Integration bereitgestellte Entität kommt zurück, wenn die Integration sie erneut erstellt.',
    confirm_ignore_one: '{n} Entität ignorieren?',
    confirm_ignore_many: '{n} Entitäten ignorieren?',
    confirm_ignore_text: 'Sie werden nicht mehr aufgelistet. Entferne sie in den Optionen der Integration aus den ignorierten Entitäten.',
    used_by: 'Verwendet von {n}',
    ref_automation: 'Automatisierung',
    ref_script: 'Skript',
    ref_scene: 'Szene',
    ref_group: 'Gruppe',
    ref_dashboard: 'Dashboard',
    confirm_used_one: '{n} ausgewählte Entität wird noch verwendet: Was sie nutzt, funktioniert danach womöglich nicht mehr.',
    confirm_used_many: '{n} ausgewählte Entitäten werden noch verwendet: Was sie nutzt, funktioniert danach womöglich nicht mehr.',
    remove_anyway: 'Trotzdem entfernen',
    and_more: 'und {n} weitere',
    removed_one: '{n} Entität entfernt',
    removed_many: '{n} Entitäten entfernt',
    devices_title: 'Verwaiste Geräte',
    devices_hint: 'Ihre Integration wurde entfernt: nichts stellt sie mehr bereit',
    remove_devices: 'Geräte entfernen',
    confirm_devices: 'Verwaiste Geräte entfernen?',
    confirm_devices_text: 'Sie verlassen die Geräteregistrierung mit ihren Entitäten. Ihr Verlauf bleibt in der Datenbank.',
    devices_removed: 'Verwaiste Geräte entfernt: {n}',
    confirm_ignore_devices: 'Ausgewählte Geräte ignorieren?',
    devices_ignored: 'Verwaiste Geräte ignoriert: {n}',
    truncated: '{n} weitere verwaiste Entitäten werden hier nicht angezeigt: entferne oder ignoriere zuerst diese.',
    devices_truncated: 'Hier nicht angezeigte verwaiste Geräte: {n}',
    confirm_devices_used: 'Geräte, die noch von Automationen oder Skripten verwendet werden: {n}. Diese funktionieren danach womöglich nicht mehr.',
    kept: 'Behalten, nicht mehr verwaist: {n}',
    dev_entities: 'Entitäten: {n}',
    ignored_one: '{n} Entität ignoriert',
    ignored_many: '{n} Entitäten ignoriert',
    minutes: '{n} Min.',
    hours: '{n} Std.',
    days: '{n} Tg.',
    ed_entity: 'Orphan-Entities-Sensor',
    ed_entity_helper: 'Sensor der verwaisten Entitäten; leer lassen, um ihn automatisch zu finden',
    ed_title: 'Titel',
    ed_title_helper: 'Leer lassen für „Orphan Entities“',
    ed_show_stats: 'Übersicht',
    ed_show_stats_helper: 'Verwaiste, seit dem Start entfernte und ignorierte',
    ed_show_filters: 'Filter',
    ed_show_filters_helper: 'Suche, Integration und Grund',
    ed_max_rows: 'Angezeigte Zeilen',
    ed_max_rows_helper: 'Vor „Alle anzeigen“',
    ed_scan_button: 'Schaltfläche „Jetzt scannen“',
    ed_scan_button_helper: 'Scannt aus der Kopfzeile, für alle Benutzer, die die Karte sehen',
    ed_hide_when_empty: 'Karte ausblenden, wenn nichts verwaist ist',
    ed_hide_when_empty_helper: 'Die Karte erscheint nur, wenn eine Entität verwaist ist',
    zoom_in: 'Details anzeigen',
    zoom_out: 'Zurück zur Kompaktansicht',
    ed_zoom: 'Detail-Schaltfläche',
    ed_zoom_helper: 'Wechselt zur vollständigen Karte und zurück',
    ed_language: 'Sprache',
    ed_language_helper: 'Leer lassen, um Home Assistant zu folgen',
  },
  es: {
    title: 'Orphan Entities',
    none: 'Ninguna huérfana',
    orphans_one: '{n} huérfana',
    orphans_many: '{n} huérfanas',
    waiting: 'Esperando el primer escaneo',
    not_loaded: 'No configurado',
    never_scanned: 'Aún sin escanear',
    scanned: 'Escaneado {d}',
    scan_now: 'Escanear ahora',
    action_failed: 'Ha fallado: {error}',
    stat_orphans: 'Huérfanas',
    stat_removed: 'Eliminadas',
    stat_removed_hint: 'Desde que se inició Home Assistant',
    stat_ignored: 'Ignoradas',
    reason_entry_removed: 'Integración eliminada',
    reason_integration_missing: 'Integración no cargada',
    reason_not_provided: 'No proporcionada',
    reason_unavailable: 'No disponible',
    reason_unknown: 'Desconocida',
    all: 'Todas',
    search: 'Buscar',
    all_integrations: 'Todas las integraciones',
    list_title: 'Entidades huérfanas',
    no_match: 'Ninguna entidad coincide con los filtros',
    empty: 'Todas las entidades las proporciona su integración',
    for: 'desde hace {d}',
    disabled: 'deshabilitada',
    select_all: 'Seleccionar las {n} mostradas',
    show_all: 'Mostrar todas ({n})',
    selected_one: '{n} seleccionada',
    selected_many: '{n} seleccionadas',
    remove: 'Eliminar',
    ignore: 'Ignorar',
    clear: 'Borrar la selección',
    cancel: 'Cancelar',
    confirm_remove_one: '¿Eliminar {n} entidad del registro de entidades?',
    confirm_remove_many: '¿Eliminar {n} entidades del registro de entidades?',
    confirm_remove_text: 'Su historial permanece en la base de datos. Una entidad aún proporcionada por su integración vuelve si la integración la crea de nuevo.',
    confirm_ignore_one: '¿Ignorar {n} entidad?',
    confirm_ignore_many: '¿Ignorar {n} entidades?',
    confirm_ignore_text: 'Dejan de mostrarse. Quítalas de las entidades ignoradas en las opciones de la integración.',
    used_by: 'Usada por {n}',
    ref_automation: 'Automatización',
    ref_script: 'Script',
    ref_scene: 'Escena',
    ref_group: 'Grupo',
    ref_dashboard: 'Panel',
    confirm_used_one: '{n} entidad seleccionada aún está en uso: lo que la usa puede dejar de funcionar.',
    confirm_used_many: '{n} entidades seleccionadas aún están en uso: lo que las usa puede dejar de funcionar.',
    remove_anyway: 'Eliminar de todos modos',
    and_more: 'y {n} más',
    removed_one: '{n} entidad eliminada',
    removed_many: '{n} entidades eliminadas',
    devices_title: 'Dispositivos huérfanos',
    devices_hint: 'Su integración se eliminó: ya nada los proporciona',
    remove_devices: 'Eliminar dispositivos',
    confirm_devices: '¿Eliminar los dispositivos huérfanos?',
    confirm_devices_text: 'Salen del registro de dispositivos con sus entidades. Su historial permanece en la base de datos.',
    devices_removed: 'Dispositivos huérfanos eliminados: {n}',
    confirm_ignore_devices: '¿Ignorar los dispositivos seleccionados?',
    devices_ignored: 'Dispositivos huérfanos ignorados: {n}',
    truncated: '{n} huérfanas más no se muestran aquí: elimina o ignora primero estas.',
    devices_truncated: 'Dispositivos huérfanos no listados aquí: {n}',
    confirm_devices_used: 'Dispositivos aún usados por automatizaciones o scripts: {n}. Estos pueden dejar de funcionar.',
    kept: 'Conservadas, ya no huérfanas: {n}',
    dev_entities: 'Entidades: {n}',
    ignored_one: '{n} entidad ignorada',
    ignored_many: '{n} entidades ignoradas',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Sensor de Orphan Entities',
    ed_entity_helper: 'Sensor de entidades huérfanas; déjalo vacío para encontrarlo automáticamente',
    ed_title: 'Título',
    ed_title_helper: 'Déjalo vacío para «Orphan Entities»',
    ed_show_stats: 'Resumen',
    ed_show_stats_helper: 'Huérfanas, eliminadas desde el inicio e ignoradas',
    ed_show_filters: 'Filtros',
    ed_show_filters_helper: 'Búsqueda, integración y motivo',
    ed_max_rows: 'Filas mostradas',
    ed_max_rows_helper: 'Antes de «Mostrar todas»',
    ed_scan_button: 'Botón «Escanear ahora»',
    ed_scan_button_helper: 'Escanea desde la cabecera, para cualquier usuario que vea la tarjeta',
    ed_hide_when_empty: 'Ocultar la tarjeta cuando no haya huérfanas',
    ed_hide_when_empty_helper: 'La tarjeta solo aparece cuando una entidad es huérfana',
    zoom_in: 'Mostrar detalles',
    zoom_out: 'Volver a la vista compacta',
    ed_zoom: 'Botón de detalle',
    ed_zoom_helper: 'Cambia a la tarjeta completa y vuelve',
    ed_language: 'Idioma',
    ed_language_helper: 'Déjalo vacío para seguir a Home Assistant',
  },
  it: {
    title: 'Orphan Entities',
    none: 'Nessuna orfana',
    orphans_one: '{n} orfana',
    orphans_many: '{n} orfane',
    waiting: 'In attesa della prima scansione',
    not_loaded: 'Non configurato',
    never_scanned: 'Non ancora scansionato',
    scanned: 'Scansionato {d}',
    scan_now: 'Scansiona ora',
    action_failed: 'Non riuscito: {error}',
    stat_orphans: 'Orfane',
    stat_removed: 'Rimosse',
    stat_removed_hint: 'Dall’avvio di Home Assistant',
    stat_ignored: 'Ignorate',
    reason_entry_removed: 'Integrazione rimossa',
    reason_integration_missing: 'Integrazione non caricata',
    reason_not_provided: 'Non fornita',
    reason_unavailable: 'Non disponibile',
    reason_unknown: 'Sconosciuta',
    all: 'Tutte',
    search: 'Cerca',
    all_integrations: 'Tutte le integrazioni',
    list_title: 'Entità orfane',
    no_match: 'Nessuna entità corrisponde ai filtri',
    empty: 'Ogni entità è fornita dalla sua integrazione',
    for: 'da {d}',
    disabled: 'disabilitata',
    select_all: 'Seleziona le {n} mostrate',
    show_all: 'Mostra tutte ({n})',
    selected_one: '{n} selezionata',
    selected_many: '{n} selezionate',
    remove: 'Rimuovi',
    ignore: 'Ignora',
    clear: 'Annulla la selezione',
    cancel: 'Annulla',
    confirm_remove_one: 'Rimuovere {n} entità dal registro delle entità?',
    confirm_remove_many: 'Rimuovere {n} entità dal registro delle entità?',
    confirm_remove_text: 'La loro cronologia resta nel database. Un’entità ancora fornita dalla sua integrazione ricompare se l’integrazione la crea di nuovo.',
    confirm_ignore_one: 'Ignorare {n} entità?',
    confirm_ignore_many: 'Ignorare {n} entità?',
    confirm_ignore_text: 'Non vengono più elencate. Rimuovile dalle entità ignorate nelle opzioni dell’integrazione.',
    used_by: 'Usata da {n}',
    ref_automation: 'Automazione',
    ref_script: 'Script',
    ref_scene: 'Scena',
    ref_group: 'Gruppo',
    ref_dashboard: 'Plancia',
    confirm_used_one: '{n} entità selezionata è ancora in uso: ciò che la usa potrebbe smettere di funzionare.',
    confirm_used_many: '{n} entità selezionate sono ancora in uso: ciò che le usa potrebbe smettere di funzionare.',
    remove_anyway: 'Rimuovi comunque',
    and_more: 'e altre {n}',
    removed_one: '{n} entità rimossa',
    removed_many: '{n} entità rimosse',
    devices_title: 'Dispositivi orfani',
    devices_hint: 'La loro integrazione è stata rimossa: niente li fornisce più',
    remove_devices: 'Rimuovi dispositivi',
    confirm_devices: 'Rimuovere i dispositivi orfani?',
    confirm_devices_text: 'Escono dal registro dei dispositivi con le loro entità. La cronologia resta nel database.',
    devices_removed: 'Dispositivi orfani rimossi: {n}',
    confirm_ignore_devices: 'Ignorare i dispositivi selezionati?',
    devices_ignored: 'Dispositivi orfani ignorati: {n}',
    truncated: 'Altre {n} entità orfane non sono elencate qui: rimuovi o ignora prima queste.',
    devices_truncated: 'Dispositivi orfani non elencati qui: {n}',
    confirm_devices_used: 'Dispositivi ancora usati da automazioni o script: {n}. Potrebbero smettere di funzionare.',
    kept: 'Mantenute, non più orfane: {n}',
    dev_entities: 'Entità: {n}',
    ignored_one: '{n} entità ignorata',
    ignored_many: '{n} entità ignorate',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} g',
    ed_entity: 'Sensore Orphan Entities',
    ed_entity_helper: 'Sensore delle entità orfane; lascia vuoto per trovarlo automaticamente',
    ed_title: 'Titolo',
    ed_title_helper: 'Lascia vuoto per «Orphan Entities»',
    ed_show_stats: 'Riepilogo',
    ed_show_stats_helper: 'Orfane, rimosse dall’avvio e ignorate',
    ed_show_filters: 'Filtri',
    ed_show_filters_helper: 'Ricerca, integrazione e motivo',
    ed_max_rows: 'Righe mostrate',
    ed_max_rows_helper: 'Prima di «Mostra tutte»',
    ed_scan_button: 'Pulsante «Scansiona ora»',
    ed_scan_button_helper: 'Avvia una scansione dall’intestazione, per ogni utente che vede la scheda',
    ed_hide_when_empty: 'Nascondi la scheda quando non ci sono orfane',
    ed_hide_when_empty_helper: 'La scheda appare solo quando un’entità è orfana',
    zoom_in: 'Mostra dettagli',
    zoom_out: 'Torna alla vista compatta',
    ed_zoom: 'Pulsante dettagli',
    ed_zoom_helper: 'Passa alla scheda completa e torna indietro',
    ed_language: 'Lingua',
    ed_language_helper: 'Lascia vuoto per seguire Home Assistant',
  },
  nl: {
    title: 'Orphan Entities',
    none: 'Geen verweesde',
    orphans_one: '{n} verweesd',
    orphans_many: '{n} verweesd',
    waiting: 'Wachten op de eerste scan',
    not_loaded: 'Niet ingesteld',
    never_scanned: 'Nog niet gescand',
    scanned: 'Gescand {d}',
    scan_now: 'Nu scannen',
    action_failed: 'Mislukt: {error}',
    stat_orphans: 'Verweesd',
    stat_removed: 'Verwijderd',
    stat_removed_hint: 'Sinds Home Assistant is gestart',
    stat_ignored: 'Genegeerd',
    reason_entry_removed: 'Integratie verwijderd',
    reason_integration_missing: 'Integratie niet geladen',
    reason_not_provided: 'Niet geleverd',
    reason_unavailable: 'Niet beschikbaar',
    reason_unknown: 'Onbekend',
    all: 'Alle',
    search: 'Zoeken',
    all_integrations: 'Alle integraties',
    list_title: 'Verweesde entiteiten',
    no_match: 'Geen entiteit komt overeen met de filters',
    empty: 'Elke entiteit wordt door haar integratie geleverd',
    for: 'al {d}',
    disabled: 'uitgeschakeld',
    select_all: 'De {n} getoonde selecteren',
    show_all: 'Alles tonen ({n})',
    selected_one: '{n} geselecteerd',
    selected_many: '{n} geselecteerd',
    remove: 'Verwijderen',
    ignore: 'Negeren',
    clear: 'Selectie wissen',
    cancel: 'Annuleren',
    confirm_remove_one: '{n} entiteit uit het entiteitenregister verwijderen?',
    confirm_remove_many: '{n} entiteiten uit het entiteitenregister verwijderen?',
    confirm_remove_text: 'Hun geschiedenis blijft in de database. Een entiteit die nog door haar integratie wordt geleverd, komt terug als de integratie haar opnieuw aanmaakt.',
    confirm_ignore_one: '{n} entiteit negeren?',
    confirm_ignore_many: '{n} entiteiten negeren?',
    confirm_ignore_text: 'Ze worden niet meer getoond. Verwijder ze uit de genegeerde entiteiten in de opties van de integratie.',
    used_by: 'Gebruikt door {n}',
    ref_automation: 'Automatisering',
    ref_script: 'Script',
    ref_scene: 'Scène',
    ref_group: 'Groep',
    ref_dashboard: 'Dashboard',
    confirm_used_one: '{n} geselecteerde entiteit is nog in gebruik: wat haar gebruikt, kan stoppen met werken.',
    confirm_used_many: '{n} geselecteerde entiteiten zijn nog in gebruik: wat ze gebruikt, kan stoppen met werken.',
    remove_anyway: 'Toch verwijderen',
    and_more: 'en nog {n}',
    removed_one: '{n} entiteit verwijderd',
    removed_many: '{n} entiteiten verwijderd',
    devices_title: 'Verweesde apparaten',
    devices_hint: 'Hun integratie is verwijderd: niets levert ze nog',
    remove_devices: 'Apparaten verwijderen',
    confirm_devices: 'De verweesde apparaten verwijderen?',
    confirm_devices_text: 'Ze verdwijnen met hun entiteiten uit het apparaatregister. Hun geschiedenis blijft in de database.',
    devices_removed: 'Verweesde apparaten verwijderd: {n}',
    confirm_ignore_devices: 'De geselecteerde apparaten negeren?',
    devices_ignored: 'Verweesde apparaten genegeerd: {n}',
    truncated: 'Nog {n} verweesde entiteiten staan hier niet: verwijder of negeer eerst deze.',
    devices_truncated: 'Verweesde apparaten die hier niet staan: {n}',
    confirm_devices_used: 'Apparaten nog in gebruik door automatiseringen of scripts: {n}. Die kunnen stoppen met werken.',
    kept: 'Behouden, niet meer verweesd: {n}',
    dev_entities: 'Entiteiten: {n}',
    ignored_one: '{n} entiteit genegeerd',
    ignored_many: '{n} entiteiten genegeerd',
    minutes: '{n} min',
    hours: '{n} u',
    days: '{n} d',
    ed_entity: 'Orphan Entities-sensor',
    ed_entity_helper: 'Sensor van de verweesde entiteiten; laat leeg om hem automatisch te vinden',
    ed_title: 'Titel',
    ed_title_helper: 'Laat leeg voor ‘Orphan Entities’',
    ed_show_stats: 'Overzicht',
    ed_show_stats_helper: 'Verweesd, verwijderd sinds de start en genegeerd',
    ed_show_filters: 'Filters',
    ed_show_filters_helper: 'Zoeken, integratie en reden',
    ed_max_rows: 'Getoonde rijen',
    ed_max_rows_helper: 'Vóór ‘Alles tonen’',
    ed_scan_button: 'Knop ‘Nu scannen’',
    ed_scan_button_helper: 'Scant vanuit de koptekst, voor elke gebruiker die de kaart ziet',
    ed_hide_when_empty: 'Kaart verbergen als er niets verweesd is',
    ed_hide_when_empty_helper: 'De kaart verschijnt alleen als een entiteit verweesd is',
    zoom_in: 'Details tonen',
    zoom_out: 'Terug naar de compacte weergave',
    ed_zoom: 'Detailknop',
    ed_zoom_helper: 'Schakelt naar de volledige kaart en terug',
    ed_language: 'Taal',
    ed_language_helper: 'Laat leeg om Home Assistant te volgen',
  },
  pt: {
    title: 'Orphan Entities',
    none: 'Nenhuma órfã',
    orphans_one: '{n} órfã',
    orphans_many: '{n} órfãs',
    waiting: 'A aguardar a primeira análise',
    not_loaded: 'Não configurado',
    never_scanned: 'Ainda não analisado',
    scanned: 'Analisado {d}',
    scan_now: 'Analisar agora',
    action_failed: 'Falhou: {error}',
    stat_orphans: 'Órfãs',
    stat_removed: 'Removidas',
    stat_removed_hint: 'Desde o arranque do Home Assistant',
    stat_ignored: 'Ignoradas',
    reason_entry_removed: 'Integração removida',
    reason_integration_missing: 'Integração não carregada',
    reason_not_provided: 'Não fornecida',
    reason_unavailable: 'Indisponível',
    reason_unknown: 'Desconhecida',
    all: 'Todas',
    search: 'Pesquisar',
    all_integrations: 'Todas as integrações',
    list_title: 'Entidades órfãs',
    no_match: 'Nenhuma entidade corresponde aos filtros',
    empty: 'Todas as entidades são fornecidas pela sua integração',
    for: 'há {d}',
    disabled: 'desativada',
    select_all: 'Selecionar as {n} mostradas',
    show_all: 'Mostrar todas ({n})',
    selected_one: '{n} selecionada',
    selected_many: '{n} selecionadas',
    remove: 'Remover',
    ignore: 'Ignorar',
    clear: 'Limpar a seleção',
    cancel: 'Cancelar',
    confirm_remove_one: 'Remover {n} entidade do registo de entidades?',
    confirm_remove_many: 'Remover {n} entidades do registo de entidades?',
    confirm_remove_text: 'O seu histórico permanece na base de dados. Uma entidade ainda fornecida pela sua integração volta se a integração a criar novamente.',
    confirm_ignore_one: 'Ignorar {n} entidade?',
    confirm_ignore_many: 'Ignorar {n} entidades?',
    confirm_ignore_text: 'Deixam de ser listadas. Remova-as das entidades ignoradas nas opções da integração.',
    used_by: 'Usada por {n}',
    ref_automation: 'Automatização',
    ref_script: 'Script',
    ref_scene: 'Cena',
    ref_group: 'Grupo',
    ref_dashboard: 'Painel',
    confirm_used_one: '{n} entidade selecionada ainda está em uso: o que a usa pode deixar de funcionar.',
    confirm_used_many: '{n} entidades selecionadas ainda estão em uso: o que as usa pode deixar de funcionar.',
    remove_anyway: 'Remover mesmo assim',
    and_more: 'e mais {n}',
    removed_one: '{n} entidade removida',
    removed_many: '{n} entidades removidas',
    devices_title: 'Dispositivos órfãos',
    devices_hint: 'A integração deles foi removida: já nada os fornece',
    remove_devices: 'Remover dispositivos',
    confirm_devices: 'Remover os dispositivos órfãos?',
    confirm_devices_text: 'Saem do registo de dispositivos com as suas entidades. O histórico fica na base de dados.',
    devices_removed: 'Dispositivos órfãos removidos: {n}',
    confirm_ignore_devices: 'Ignorar os dispositivos selecionados?',
    devices_ignored: 'Dispositivos órfãos ignorados: {n}',
    truncated: 'Mais {n} órfãs não estão listadas aqui: remova ou ignore primeiro estas.',
    devices_truncated: 'Dispositivos órfãos não listados aqui: {n}',
    confirm_devices_used: 'Dispositivos ainda usados por automações ou scripts: {n}. Estes podem deixar de funcionar.',
    kept: 'Mantidas, já não órfãs: {n}',
    dev_entities: 'Entidades: {n}',
    ignored_one: '{n} entidade ignorada',
    ignored_many: '{n} entidades ignoradas',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Sensor do Orphan Entities',
    ed_entity_helper: 'Sensor das entidades órfãs; deixe vazio para o encontrar automaticamente',
    ed_title: 'Título',
    ed_title_helper: 'Deixe vazio para «Orphan Entities»',
    ed_show_stats: 'Resumo',
    ed_show_stats_helper: 'Órfãs, removidas desde o arranque e ignoradas',
    ed_show_filters: 'Filtros',
    ed_show_filters_helper: 'Pesquisa, integração e motivo',
    ed_max_rows: 'Linhas mostradas',
    ed_max_rows_helper: 'Antes de «Mostrar todas»',
    ed_scan_button: 'Botão «Analisar agora»',
    ed_scan_button_helper: 'Analisa a partir do cabeçalho, para qualquer utilizador que veja o cartão',
    ed_hide_when_empty: 'Ocultar o cartão quando não há órfãs',
    ed_hide_when_empty_helper: 'O cartão só aparece quando uma entidade está órfã',
    zoom_in: 'Mostrar detalhes',
    zoom_out: 'Voltar à vista compacta',
    ed_zoom: 'Botão de detalhe',
    ed_zoom_helper: 'Muda para o cartão completo e volta',
    ed_language: 'Idioma',
    ed_language_helper: 'Deixe vazio para seguir o Home Assistant',
  },
  pl: {
    title: 'Orphan Entities',
    none: 'Brak osieroconych',
    orphans_one: '{n} osierocona',
    orphans_few: '{n} osierocone',
    orphans_many: '{n} osieroconych',
    waiting: 'Oczekiwanie na pierwsze skanowanie',
    not_loaded: 'Nie skonfigurowano',
    never_scanned: 'Jeszcze nie przeskanowano',
    scanned: 'Przeskanowano {d}',
    scan_now: 'Skanuj teraz',
    action_failed: 'Niepowodzenie: {error}',
    stat_orphans: 'Osierocone',
    stat_removed: 'Usunięte',
    stat_removed_hint: 'Od uruchomienia Home Assistant',
    stat_ignored: 'Ignorowane',
    reason_entry_removed: 'Integracja usunięta',
    reason_integration_missing: 'Integracja niewczytana',
    reason_not_provided: 'Niedostarczona',
    reason_unavailable: 'Niedostępna',
    reason_unknown: 'Nieznana',
    all: 'Wszystkie',
    search: 'Szukaj',
    all_integrations: 'Wszystkie integracje',
    list_title: 'Osierocone encje',
    no_match: 'Żadna encja nie pasuje do filtrów',
    empty: 'Każda encja jest dostarczana przez swoją integrację',
    for: 'od {d}',
    disabled: 'wyłączona',
    select_all: 'Zaznacz wyświetlane ({n})',
    show_all: 'Pokaż wszystkie ({n})',
    selected_one: '{n} zaznaczona',
    selected_few: '{n} zaznaczone',
    selected_many: '{n} zaznaczonych',
    remove: 'Usuń',
    ignore: 'Ignoruj',
    clear: 'Wyczyść zaznaczenie',
    cancel: 'Anuluj',
    confirm_remove_one: 'Usunąć {n} encję z rejestru encji?',
    confirm_remove_few: 'Usunąć {n} encje z rejestru encji?',
    confirm_remove_many: 'Usunąć {n} encji z rejestru encji?',
    confirm_remove_text: 'Ich historia pozostaje w bazie danych. Encja nadal dostarczana przez swoją integrację powróci, jeśli integracja utworzy ją ponownie.',
    confirm_ignore_one: 'Zignorować {n} encję?',
    confirm_ignore_few: 'Zignorować {n} encje?',
    confirm_ignore_many: 'Zignorować {n} encji?',
    confirm_ignore_text: 'Nie będą już wyświetlane. Usuń je z ignorowanych encji w opcjach integracji.',
    used_by: 'Używana przez {n}',
    ref_automation: 'Automatyzacja',
    ref_script: 'Skrypt',
    ref_scene: 'Scena',
    ref_group: 'Grupa',
    ref_dashboard: 'Dashboard',
    confirm_used_one: '{n} zaznaczona encja jest nadal używana: to, co jej używa, może przestać działać.',
    confirm_used_few: '{n} zaznaczone encje są nadal używane: to, co ich używa, może przestać działać.',
    confirm_used_many: '{n} zaznaczonych encji jest nadal używanych: to, co ich używa, może przestać działać.',
    remove_anyway: 'Usuń mimo to',
    and_more: 'i {n} więcej',
    removed_one: 'Usunięto {n} encję',
    removed_few: 'Usunięto {n} encje',
    removed_many: 'Usunięto {n} encji',
    devices_title: 'Osierocone urządzenia',
    devices_hint: 'Ich integracja została usunięta: nic ich już nie dostarcza',
    remove_devices: 'Usuń urządzenia',
    confirm_devices: 'Usunąć osierocone urządzenia?',
    confirm_devices_text: 'Znikają z rejestru urządzeń razem z encjami. Ich historia zostaje w bazie danych.',
    devices_removed: 'Usunięte osierocone urządzenia: {n}',
    confirm_ignore_devices: 'Zignorować wybrane urządzenia?',
    devices_ignored: 'Zignorowane osierocone urządzenia: {n}',
    truncated: 'Kolejne osierocone encje ({n}) nie są tu wyświetlane: najpierw usuń lub zignoruj te.',
    devices_truncated: 'Osierocone urządzenia niewyświetlone tutaj: {n}',
    confirm_devices_used: 'Urządzenia nadal używane przez automatyzacje lub skrypty: {n}. Mogą one przestać działać.',
    kept: 'Zachowane, już nie osierocone: {n}',
    dev_entities: 'Encje: {n}',
    ignored_one: 'Zignorowano {n} encję',
    ignored_few: 'Zignorowano {n} encje',
    ignored_many: 'Zignorowano {n} encji',
    minutes: '{n} min',
    hours: '{n} godz.',
    days: '{n} dni',
    ed_entity: 'Sensor Orphan Entities',
    ed_entity_helper: 'Sensor osieroconych encji; pozostaw puste, aby znaleźć go automatycznie',
    ed_title: 'Tytuł',
    ed_title_helper: 'Pozostaw puste dla „Orphan Entities”',
    ed_show_stats: 'Podsumowanie',
    ed_show_stats_helper: 'Osierocone, usunięte od uruchomienia i ignorowane',
    ed_show_filters: 'Filtry',
    ed_show_filters_helper: 'Wyszukiwanie, integracja i powód',
    ed_max_rows: 'Liczba wyświetlanych wierszy',
    ed_max_rows_helper: 'Przed „Pokaż wszystkie”',
    ed_scan_button: 'Przycisk „Skanuj teraz”',
    ed_scan_button_helper: 'Skanuje z nagłówka, dla każdego użytkownika, który widzi kartę',
    ed_hide_when_empty: 'Ukryj kartę, gdy nie ma osieroconych',
    ed_hide_when_empty_helper: 'Karta pojawia się tylko wtedy, gdy jakaś encja jest osierocona',
    zoom_in: 'Pokaż szczegóły',
    zoom_out: 'Wróć do widoku kompaktowego',
    ed_zoom: 'Przycisk szczegółów',
    ed_zoom_helper: 'Przełącza na pełną kartę i z powrotem',
    ed_language: 'Język',
    ed_language_helper: 'Pozostaw puste, aby używać języka Home Assistant',
  },
  sr: {
    title: 'Orphan Entities',
    none: 'Нема осироћених',
    orphans_one: '{n} осироћен',
    orphans_few: '{n} осироћена',
    orphans_many: '{n} осироћених',
    waiting: 'Чека се прво скенирање',
    not_loaded: 'Није подешено',
    never_scanned: 'Још није скенирано',
    scanned: 'Скенирано {d}',
    scan_now: 'Скенирај сада',
    action_failed: 'Није успело: {error}',
    stat_orphans: 'Осироћени',
    stat_removed: 'Уклоњени',
    stat_removed_hint: 'Од покретања Home Assistant-а',
    stat_ignored: 'Игнорисани',
    reason_entry_removed: 'Интеграција уклоњена',
    reason_integration_missing: 'Интеграција није учитана',
    reason_not_provided: 'Није обезбеђен',
    reason_unavailable: 'Недоступан',
    reason_unknown: 'Непознат',
    all: 'Сви',
    search: 'Претрага',
    all_integrations: 'Све интеграције',
    list_title: 'Осироћени ентитети',
    no_match: 'Ниједан ентитет не одговара филтерима',
    empty: 'Сваки ентитет обезбеђује његова интеграција',
    for: 'већ {d}',
    disabled: 'онемогућен',
    select_all: 'Изабери приказане ({n})',
    show_all: 'Прикажи све ({n})',
    selected_one: '{n} изабран',
    selected_few: '{n} изабрана',
    selected_many: '{n} изабраних',
    remove: 'Уклони',
    ignore: 'Игнориши',
    clear: 'Обриши избор',
    cancel: 'Откажи',
    confirm_remove_one: 'Уклонити {n} ентитет из регистра ентитета?',
    confirm_remove_few: 'Уклонити {n} ентитета из регистра ентитета?',
    confirm_remove_many: 'Уклонити {n} ентитета из регистра ентитета?',
    confirm_remove_text: 'Њихова историја остаје у бази података. Ентитет који његова интеграција још обезбеђује враћа се ако га интеграција поново направи.',
    confirm_ignore_one: 'Игнорисати {n} ентитет?',
    confirm_ignore_few: 'Игнорисати {n} ентитета?',
    confirm_ignore_many: 'Игнорисати {n} ентитета?',
    confirm_ignore_text: 'Више се не приказују. Уклоните их из игнорисаних ентитета у опцијама интеграције.',
    used_by: 'Користе га: {n}',
    ref_automation: 'Аутоматизација',
    ref_script: 'Скрипта',
    ref_scene: 'Сцена',
    ref_group: 'Група',
    ref_dashboard: 'Контролна табла',
    confirm_used_one: '{n} изабрани ентитет се још користи: оно што га користи може престати да ради.',
    confirm_used_few: '{n} изабрана ентитета се још користе: оно што их користи може престати да ради.',
    confirm_used_many: '{n} изабраних ентитета се још користи: оно што их користи може престати да ради.',
    remove_anyway: 'Ипак уклони',
    and_more: 'и још {n}',
    removed_one: '{n} ентитет уклоњен',
    removed_few: '{n} ентитета уклоњена',
    removed_many: '{n} ентитета уклоњено',
    devices_title: 'Напуштени уређаји',
    devices_hint: 'Њихова интеграција је уклоњена: више их ништа не пружа',
    remove_devices: 'Уклони уређаје',
    confirm_devices: 'Уклонити напуштене уређаје?',
    confirm_devices_text: 'Напуштају регистар уређаја заједно са својим ентитетима. Њихова историја остаје у бази.',
    devices_removed: 'Уклоњени напуштени уређаји: {n}',
    confirm_ignore_devices: 'Игнорисати изабране уређаје?',
    devices_ignored: 'Игнорисани напуштени уређаји: {n}',
    truncated: 'Још {n} напуштених ентитета није приказано овде: прво уклоните или игноришите ове.',
    devices_truncated: 'Напуштени уређаји који нису приказани овде: {n}',
    confirm_devices_used: 'Уређаји које још користе аутоматизације или скрипте: {n}. Оне могу престати да раде.',
    kept: 'Задржано, више није напуштено: {n}',
    dev_entities: 'Ентитети: {n}',
    ignored_one: '{n} ентитет игнорисан',
    ignored_few: '{n} ентитета игнорисана',
    ignored_many: '{n} ентитета игнорисано',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Сензор Orphan Entities',
    ed_entity_helper: 'Сензор осироћених ентитета; оставите празно да би био пронађен аутоматски',
    ed_title: 'Наслов',
    ed_title_helper: 'Оставите празно за „Orphan Entities“',
    ed_show_stats: 'Преглед',
    ed_show_stats_helper: 'Осироћени, уклоњени од покретања и игнорисани',
    ed_show_filters: 'Филтери',
    ed_show_filters_helper: 'Претрага, интеграција и разлог',
    ed_max_rows: 'Број приказаних редова',
    ed_max_rows_helper: 'Пре „Прикажи све“',
    ed_scan_button: 'Дугме „Скенирај сада“',
    ed_scan_button_helper: 'Скенира из заглавља, за сваког корисника који види картицу',
    ed_hide_when_empty: 'Сакриј картицу када нема осироћених',
    ed_hide_when_empty_helper: 'Картица се појављује само када је неки ентитет осироћен',
    zoom_in: 'Прикажи детаље',
    zoom_out: 'Назад на сажети приказ',
    ed_zoom: 'Дугме за детаље',
    ed_zoom_helper: 'Пребацује на пуну картицу и назад',
    ed_language: 'Језик',
    ed_language_helper: 'Оставите празно да бисте пратили Home Assistant',
  },
  'sr-Latn': {
    title: 'Orphan Entities',
    none: 'Nema osiroćenih',
    orphans_one: '{n} osiroćen',
    orphans_few: '{n} osiroćena',
    orphans_many: '{n} osiroćenih',
    waiting: 'Čeka se prvo skeniranje',
    not_loaded: 'Nije podešeno',
    never_scanned: 'Još nije skenirano',
    scanned: 'Skenirano {d}',
    scan_now: 'Skeniraj sada',
    action_failed: 'Nije uspelo: {error}',
    stat_orphans: 'Osiroćeni',
    stat_removed: 'Uklonjeni',
    stat_removed_hint: 'Od pokretanja Home Assistant-a',
    stat_ignored: 'Ignorisani',
    reason_entry_removed: 'Integracija uklonjena',
    reason_integration_missing: 'Integracija nije učitana',
    reason_not_provided: 'Nije obezbeđen',
    reason_unavailable: 'Nedostupan',
    reason_unknown: 'Nepoznat',
    all: 'Svi',
    search: 'Pretraga',
    all_integrations: 'Sve integracije',
    list_title: 'Osiroćeni entiteti',
    no_match: 'Nijedan entitet ne odgovara filterima',
    empty: 'Svaki entitet obezbeđuje njegova integracija',
    for: 'već {d}',
    disabled: 'onemogućen',
    select_all: 'Izaberi prikazane ({n})',
    show_all: 'Prikaži sve ({n})',
    selected_one: '{n} izabran',
    selected_few: '{n} izabrana',
    selected_many: '{n} izabranih',
    remove: 'Ukloni',
    ignore: 'Ignoriši',
    clear: 'Obriši izbor',
    cancel: 'Otkaži',
    confirm_remove_one: 'Ukloniti {n} entitet iz registra entiteta?',
    confirm_remove_few: 'Ukloniti {n} entiteta iz registra entiteta?',
    confirm_remove_many: 'Ukloniti {n} entiteta iz registra entiteta?',
    confirm_remove_text: 'Njihova istorija ostaje u bazi podataka. Entitet koji njegova integracija još obezbeđuje vraća se ako ga integracija ponovo napravi.',
    confirm_ignore_one: 'Ignorisati {n} entitet?',
    confirm_ignore_few: 'Ignorisati {n} entiteta?',
    confirm_ignore_many: 'Ignorisati {n} entiteta?',
    confirm_ignore_text: 'Više se ne prikazuju. Uklonite ih iz ignorisanih entiteta u opcijama integracije.',
    used_by: 'Koriste ga: {n}',
    ref_automation: 'Automatizacija',
    ref_script: 'Skripta',
    ref_scene: 'Scena',
    ref_group: 'Grupa',
    ref_dashboard: 'Kontrolna tabla',
    confirm_used_one: '{n} izabrani entitet se još koristi: ono što ga koristi može prestati da radi.',
    confirm_used_few: '{n} izabrana entiteta se još koriste: ono što ih koristi može prestati da radi.',
    confirm_used_many: '{n} izabranih entiteta se još koristi: ono što ih koristi može prestati da radi.',
    remove_anyway: 'Ipak ukloni',
    and_more: 'i još {n}',
    removed_one: '{n} entitet uklonjen',
    removed_few: '{n} entiteta uklonjena',
    removed_many: '{n} entiteta uklonjeno',
    devices_title: 'Napušteni uređaji',
    devices_hint: 'Njihova integracija je uklonjena: više ih ništa ne pruža',
    remove_devices: 'Ukloni uređaje',
    confirm_devices: 'Ukloniti napuštene uređaje?',
    confirm_devices_text: 'Napuštaju registar uređaja zajedno sa svojim entitetima. Njihova istorija ostaje u bazi.',
    devices_removed: 'Uklonjeni napušteni uređaji: {n}',
    confirm_ignore_devices: 'Ignorisati izabrane uređaje?',
    devices_ignored: 'Ignorisani napušteni uređaji: {n}',
    truncated: 'Još {n} napuštenih entiteta nije prikazano ovde: prvo uklonite ili ignorišite ove.',
    devices_truncated: 'Napušteni uređaji koji nisu prikazani ovde: {n}',
    confirm_devices_used: 'Uređaji koje još koriste automatizacije ili skripte: {n}. One mogu prestati da rade.',
    kept: 'Zadržano, više nije napušteno: {n}',
    dev_entities: 'Entiteti: {n}',
    ignored_one: '{n} entitet ignorisan',
    ignored_few: '{n} entiteta ignorisana',
    ignored_many: '{n} entiteta ignorisano',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Senzor Orphan Entities',
    ed_entity_helper: 'Senzor osiroćenih entiteta; ostavite prazno da bi bio pronađen automatski',
    ed_title: 'Naslov',
    ed_title_helper: 'Ostavite prazno za „Orphan Entities“',
    ed_show_stats: 'Pregled',
    ed_show_stats_helper: 'Osiroćeni, uklonjeni od pokretanja i ignorisani',
    ed_show_filters: 'Filteri',
    ed_show_filters_helper: 'Pretraga, integracija i razlog',
    ed_max_rows: 'Broj prikazanih redova',
    ed_max_rows_helper: 'Pre „Prikaži sve“',
    ed_scan_button: 'Dugme „Skeniraj sada“',
    ed_scan_button_helper: 'Skenira iz zaglavlja, za svakog korisnika koji vidi karticu',
    ed_hide_when_empty: 'Sakrij karticu kada nema osiroćenih',
    ed_hide_when_empty_helper: 'Kartica se pojavljuje samo kada je neki entitet osiroćen',
    zoom_in: 'Prikaži detalje',
    zoom_out: 'Nazad na sažeti prikaz',
    ed_zoom: 'Dugme za detalje',
    ed_zoom_helper: 'Prebacuje na punu karticu i nazad',
    ed_language: 'Jezik',
    ed_language_helper: 'Ostavite prazno da biste pratili Home Assistant',
  },
  ro: {
    title: 'Orphan Entities',
    none: 'Nicio orfană',
    orphans_one: '{n} orfană',
    orphans_few: '{n} orfane',
    orphans_many: '{n} de orfane',
    waiting: 'Se așteaptă prima scanare',
    not_loaded: 'Neconfigurat',
    never_scanned: 'Nescanat încă',
    scanned: 'Scanat {d}',
    scan_now: 'Scanează acum',
    action_failed: 'Eșec: {error}',
    stat_orphans: 'Orfane',
    stat_removed: 'Eliminate',
    stat_removed_hint: 'De la pornirea Home Assistant',
    stat_ignored: 'Ignorate',
    reason_entry_removed: 'Integrare eliminată',
    reason_integration_missing: 'Integrare neîncărcată',
    reason_not_provided: 'Nefurnizată',
    reason_unavailable: 'Indisponibilă',
    reason_unknown: 'Necunoscută',
    all: 'Toate',
    search: 'Căutare',
    all_integrations: 'Toate integrările',
    list_title: 'Entități orfane',
    no_match: 'Nicio entitate nu corespunde filtrelor',
    empty: 'Fiecare entitate este furnizată de integrarea sa',
    for: 'de {d}',
    disabled: 'dezactivată',
    select_all: 'Selectează cele {n} afișate',
    show_all: 'Afișează tot ({n})',
    selected_one: '{n} selectată',
    selected_few: '{n} selectate',
    selected_many: 'Selectate: {n}',
    remove: 'Elimină',
    ignore: 'Ignoră',
    clear: 'Golește selecția',
    cancel: 'Anulează',
    confirm_remove_one: 'Eliminați {n} entitate din registrul entităților?',
    confirm_remove_few: 'Eliminați {n} entități din registrul entităților?',
    confirm_remove_many: 'Eliminați {n} de entități din registrul entităților?',
    confirm_remove_text: 'Istoricul lor rămâne în baza de date. O entitate încă furnizată de integrarea sa revine dacă integrarea o creează din nou.',
    confirm_ignore_one: 'Ignorați {n} entitate?',
    confirm_ignore_few: 'Ignorați {n} entități?',
    confirm_ignore_many: 'Ignorați {n} de entități?',
    confirm_ignore_text: 'Nu mai sunt listate. Eliminați-le din entitățile ignorate în opțiunile integrării.',
    used_by: 'Folosită de {n}',
    ref_automation: 'Automatizare',
    ref_script: 'Script',
    ref_scene: 'Scenă',
    ref_group: 'Grup',
    ref_dashboard: 'Tablou de bord',
    confirm_used_one: '{n} entitate selectată este încă folosită: ce o folosește poate să nu mai funcționeze.',
    confirm_used_few: '{n} entități selectate sunt încă folosite: ce le folosește poate să nu mai funcționeze.',
    confirm_used_many: '{n} de entități selectate sunt încă folosite: ce le folosește poate să nu mai funcționeze.',
    remove_anyway: 'Eliminați oricum',
    and_more: 'și încă {n}',
    removed_one: '{n} entitate eliminată',
    removed_few: '{n} entități eliminate',
    removed_many: '{n} de entități eliminate',
    devices_title: 'Dispozitive orfane',
    devices_hint: 'Integrarea lor a fost eliminată: nimic nu le mai furnizează',
    remove_devices: 'Elimină dispozitivele',
    confirm_devices: 'Eliminați dispozitivele orfane?',
    confirm_devices_text: 'Ies din registrul de dispozitive împreună cu entitățile lor. Istoricul rămâne în baza de date.',
    devices_removed: 'Dispozitive orfane eliminate: {n}',
    confirm_ignore_devices: 'Ignorați dispozitivele selectate?',
    devices_ignored: 'Dispozitive orfane ignorate: {n}',
    truncated: 'Încă {n} entități orfane nu sunt listate aici: eliminați sau ignorați mai întâi acestea.',
    devices_truncated: 'Dispozitive orfane nelistate aici: {n}',
    confirm_devices_used: 'Dispozitive încă folosite de automatizări sau scripturi: {n}. Acestea pot să nu mai funcționeze.',
    kept: 'Păstrate, nu mai sunt orfane: {n}',
    dev_entities: 'Entități: {n}',
    ignored_one: '{n} entitate ignorată',
    ignored_few: '{n} entități ignorate',
    ignored_many: '{n} de entități ignorate',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} zile',
    ed_entity: 'Senzor Orphan Entities',
    ed_entity_helper: 'Senzorul entităților orfane; lăsați gol pentru a-l găsi automat',
    ed_title: 'Titlu',
    ed_title_helper: 'Lăsați gol pentru „Orphan Entities”',
    ed_show_stats: 'Rezumat',
    ed_show_stats_helper: 'Orfane, eliminate de la pornire și ignorate',
    ed_show_filters: 'Filtre',
    ed_show_filters_helper: 'Căutare, integrare și motiv',
    ed_max_rows: 'Rânduri afișate',
    ed_max_rows_helper: 'Înainte de „Afișează tot”',
    ed_scan_button: 'Butonul „Scanează acum”',
    ed_scan_button_helper: 'Scanează din antet, pentru orice utilizator care vede cardul',
    ed_hide_when_empty: 'Ascunde cardul când nu există orfane',
    ed_hide_when_empty_helper: 'Cardul apare doar când o entitate este orfană',
    zoom_in: 'Afișează detaliile',
    zoom_out: 'Înapoi la vizualizarea compactă',
    ed_zoom: 'Buton de detalii',
    ed_zoom_helper: 'Comută la cardul complet și înapoi',
    ed_language: 'Limbă',
    ed_language_helper: 'Lăsați gol pentru a urma Home Assistant',
  },
  da: {
    title: 'Orphan Entities',
    none: 'Ingen forældreløse',
    orphans_one: '{n} forældreløs',
    orphans_many: '{n} forældreløse',
    waiting: 'Venter på den første scanning',
    not_loaded: 'Ikke konfigureret',
    never_scanned: 'Ikke scannet endnu',
    scanned: 'Scannet {d}',
    scan_now: 'Scan nu',
    action_failed: 'Mislykkedes: {error}',
    stat_orphans: 'Forældreløse',
    stat_removed: 'Fjernet',
    stat_removed_hint: 'Siden Home Assistant startede',
    stat_ignored: 'Ignoreret',
    reason_entry_removed: 'Integration fjernet',
    reason_integration_missing: 'Integration ikke indlæst',
    reason_not_provided: 'Leveres ikke',
    reason_unavailable: 'Utilgængelig',
    reason_unknown: 'Ukendt',
    all: 'Alle',
    search: 'Søg',
    all_integrations: 'Alle integrationer',
    list_title: 'Forældreløse entiteter',
    no_match: 'Ingen entiteter matcher filtrene',
    empty: 'Alle entiteter leveres af deres integration',
    for: 'i {d}',
    disabled: 'deaktiveret',
    select_all: 'Vælg de {n} viste',
    show_all: 'Vis alle ({n})',
    selected_one: '{n} valgt',
    selected_many: '{n} valgt',
    remove: 'Fjern',
    ignore: 'Ignorer',
    clear: 'Ryd valget',
    cancel: 'Annuller',
    confirm_remove_one: 'Fjern {n} entitet fra entitetsregistret?',
    confirm_remove_many: 'Fjern {n} entiteter fra entitetsregistret?',
    confirm_remove_text: 'Deres historik bliver i databasen. En entitet, der stadig leveres af sin integration, kommer tilbage, hvis integrationen opretter den igen.',
    confirm_ignore_one: 'Ignorer {n} entitet?',
    confirm_ignore_many: 'Ignorer {n} entiteter?',
    confirm_ignore_text: 'De vises ikke længere. Fjern dem fra de ignorerede entiteter i integrationens indstillinger.',
    used_by: 'Bruges af {n}',
    ref_automation: 'Automatisering',
    ref_script: 'Script',
    ref_scene: 'Scene',
    ref_group: 'Gruppe',
    ref_dashboard: 'Dashboard',
    confirm_used_one: '{n} valgt entitet er stadig i brug: det, der bruger den, kan holde op med at virke.',
    confirm_used_many: '{n} valgte entiteter er stadig i brug: det, der bruger dem, kan holde op med at virke.',
    remove_anyway: 'Fjern alligevel',
    and_more: 'og {n} til',
    removed_one: '{n} entitet fjernet',
    removed_many: '{n} entiteter fjernet',
    devices_title: 'Forældreløse enheder',
    devices_hint: 'Deres integration blev fjernet: intet leverer dem længere',
    remove_devices: 'Fjern enheder',
    confirm_devices: 'Fjern de forældreløse enheder?',
    confirm_devices_text: 'De forlader enhedsregistret sammen med deres entiteter. Deres historik bliver i databasen.',
    devices_removed: 'Forældreløse enheder fjernet: {n}',
    confirm_ignore_devices: 'Ignorer de valgte enheder?',
    devices_ignored: 'Forældreløse enheder ignoreret: {n}',
    truncated: '{n} flere forældreløse entiteter vises ikke her: fjern eller ignorer disse først.',
    devices_truncated: 'Forældreløse enheder, der ikke vises her: {n}',
    confirm_devices_used: 'Enheder, der stadig bruges af automatiseringer eller scripts: {n}. De kan holde op med at virke.',
    kept: 'Beholdt, ikke længere forældreløse: {n}',
    dev_entities: 'Entiteter: {n}',
    ignored_one: '{n} entitet ignoreret',
    ignored_many: '{n} entiteter ignoreret',
    minutes: '{n} min',
    hours: '{n} t',
    days: '{n} d',
    ed_entity: 'Orphan Entities-sensor',
    ed_entity_helper: 'Sensoren for forældreløse entiteter; lad feltet stå tomt for at finde den automatisk',
    ed_title: 'Titel',
    ed_title_helper: 'Lad feltet stå tomt for »Orphan Entities«',
    ed_show_stats: 'Oversigt',
    ed_show_stats_helper: 'Forældreløse, fjernet siden start og ignorerede',
    ed_show_filters: 'Filtre',
    ed_show_filters_helper: 'Søgning, integration og årsag',
    ed_max_rows: 'Viste rækker',
    ed_max_rows_helper: 'Før »Vis alle«',
    ed_scan_button: 'Knappen »Scan nu«',
    ed_scan_button_helper: 'Scanner fra overskriften, for alle brugere, der ser kortet',
    ed_hide_when_empty: 'Skjul kortet, når der ikke er nogen forældreløse',
    ed_hide_when_empty_helper: 'Kortet vises kun, når en entitet er forældreløs',
    zoom_in: 'Vis detaljer',
    zoom_out: 'Tilbage til kompakt visning',
    ed_zoom: 'Detaljeknap',
    ed_zoom_helper: 'Skifter til det fulde kort og tilbage',
    ed_language: 'Sprog',
    ed_language_helper: 'Lad feltet stå tomt for at følge Home Assistant',
  },
  sv: {
    title: 'Orphan Entities',
    none: 'Inga föräldralösa',
    orphans_one: '{n} föräldralös',
    orphans_many: '{n} föräldralösa',
    waiting: 'Väntar på den första skanningen',
    not_loaded: 'Inte konfigurerad',
    never_scanned: 'Inte skannad än',
    scanned: 'Skannad {d}',
    scan_now: 'Skanna nu',
    action_failed: 'Misslyckades: {error}',
    stat_orphans: 'Föräldralösa',
    stat_removed: 'Borttagna',
    stat_removed_hint: 'Sedan Home Assistant startade',
    stat_ignored: 'Ignorerade',
    reason_entry_removed: 'Integration borttagen',
    reason_integration_missing: 'Integration inte inläst',
    reason_not_provided: 'Tillhandahålls inte',
    reason_unavailable: 'Otillgänglig',
    reason_unknown: 'Okänd',
    all: 'Alla',
    search: 'Sök',
    all_integrations: 'Alla integrationer',
    list_title: 'Föräldralösa entiteter',
    no_match: 'Inga entiteter matchar filtren',
    empty: 'Alla entiteter tillhandahålls av sin integration',
    for: 'i {d}',
    disabled: 'inaktiverad',
    select_all: 'Markera de {n} som visas',
    show_all: 'Visa alla ({n})',
    selected_one: '{n} markerad',
    selected_many: '{n} markerade',
    remove: 'Ta bort',
    ignore: 'Ignorera',
    clear: 'Rensa markeringen',
    cancel: 'Avbryt',
    confirm_remove_one: 'Ta bort {n} entitet från entitetsregistret?',
    confirm_remove_many: 'Ta bort {n} entiteter från entitetsregistret?',
    confirm_remove_text: 'Deras historik finns kvar i databasen. En entitet som fortfarande tillhandahålls av sin integration kommer tillbaka om integrationen skapar den igen.',
    confirm_ignore_one: 'Ignorera {n} entitet?',
    confirm_ignore_many: 'Ignorera {n} entiteter?',
    confirm_ignore_text: 'De listas inte längre. Ta bort dem från de ignorerade entiteterna i integrationens alternativ.',
    used_by: 'Används av {n}',
    ref_automation: 'Automation',
    ref_script: 'Skript',
    ref_scene: 'Scen',
    ref_group: 'Grupp',
    ref_dashboard: 'Instrumentpanel',
    confirm_used_one: '{n} vald entitet används fortfarande: det som använder den kan sluta fungera.',
    confirm_used_many: '{n} valda entiteter används fortfarande: det som använder dem kan sluta fungera.',
    remove_anyway: 'Ta bort ändå',
    and_more: 'och {n} till',
    removed_one: '{n} entitet borttagen',
    removed_many: '{n} entiteter borttagna',
    devices_title: 'Föräldralösa enheter',
    devices_hint: 'Deras integration togs bort: inget tillhandahåller dem längre',
    remove_devices: 'Ta bort enheter',
    confirm_devices: 'Ta bort de föräldralösa enheterna?',
    confirm_devices_text: 'De lämnar enhetsregistret med sina entiteter. Deras historik stannar i databasen.',
    devices_removed: 'Föräldralösa enheter borttagna: {n}',
    confirm_ignore_devices: 'Ignorera de valda enheterna?',
    devices_ignored: 'Föräldralösa enheter ignorerade: {n}',
    truncated: '{n} fler föräldralösa entiteter visas inte här: ta bort eller ignorera dessa först.',
    devices_truncated: 'Föräldralösa enheter som inte visas här: {n}',
    confirm_devices_used: 'Enheter som fortfarande används av automatiseringar eller skript: {n}. De kan sluta fungera.',
    kept: 'Behållna, inte längre föräldralösa: {n}',
    dev_entities: 'Entiteter: {n}',
    ignored_one: '{n} entitet ignorerad',
    ignored_many: '{n} entiteter ignorerade',
    minutes: '{n} min',
    hours: '{n} tim',
    days: '{n} d',
    ed_entity: 'Orphan Entities-sensor',
    ed_entity_helper: 'Sensorn för föräldralösa entiteter; lämna tomt för att hitta den automatiskt',
    ed_title: 'Rubrik',
    ed_title_helper: 'Lämna tomt för ”Orphan Entities”',
    ed_show_stats: 'Översikt',
    ed_show_stats_helper: 'Föräldralösa, borttagna sedan start och ignorerade',
    ed_show_filters: 'Filter',
    ed_show_filters_helper: 'Sökning, integration och orsak',
    ed_max_rows: 'Rader som visas',
    ed_max_rows_helper: 'Före ”Visa alla”',
    ed_scan_button: 'Knappen ”Skanna nu”',
    ed_scan_button_helper: 'Skannar från sidhuvudet, för alla användare som ser kortet',
    ed_hide_when_empty: 'Dölj kortet när det inte finns några föräldralösa',
    ed_hide_when_empty_helper: 'Kortet visas bara när en entitet är föräldralös',
    zoom_in: 'Visa detaljer',
    zoom_out: 'Tillbaka till kompakt vy',
    ed_zoom: 'Detaljknapp',
    ed_zoom_helper: 'Växlar till det fullständiga kortet och tillbaka',
    ed_language: 'Språk',
    ed_language_helper: 'Lämna tomt för att följa Home Assistant',
  },
  bg: {
    title: 'Orphan Entities',
    none: 'Няма осиротели',
    orphans_one: '{n} осиротял',
    orphans_many: '{n} осиротели',
    waiting: 'Изчакване на първото сканиране',
    not_loaded: 'Не е настроено',
    never_scanned: 'Още не е сканирано',
    scanned: 'Сканирано {d}',
    scan_now: 'Сканирай сега',
    action_failed: 'Неуспешно: {error}',
    stat_orphans: 'Осиротели',
    stat_removed: 'Премахнати',
    stat_removed_hint: 'От стартирането на Home Assistant',
    stat_ignored: 'Игнорирани',
    reason_entry_removed: 'Премахната интеграция',
    reason_integration_missing: 'Незаредена интеграция',
    reason_not_provided: 'Не се предоставя',
    reason_unavailable: 'Недостъпен',
    reason_unknown: 'Неизвестен',
    all: 'Всички',
    search: 'Търсене',
    all_integrations: 'Всички интеграции',
    list_title: 'Осиротели обекти',
    no_match: 'Няма обекти, отговарящи на филтрите',
    empty: 'Всеки обект се предоставя от своята интеграция',
    for: 'от {d}',
    disabled: 'деактивиран',
    select_all: 'Избери показаните ({n})',
    show_all: 'Покажи всички ({n})',
    selected_one: '{n} избран',
    selected_many: '{n} избрани',
    remove: 'Премахни',
    ignore: 'Игнорирай',
    clear: 'Изчисти избора',
    cancel: 'Отказ',
    confirm_remove_one: 'Да се премахне ли {n} обект от регистъра на обектите?',
    confirm_remove_many: 'Да се премахнат ли {n} обекта от регистъра на обектите?',
    confirm_remove_text: 'Историята им остава в базата данни. Обект, който все още се предоставя от своята интеграция, се връща, ако интеграцията го създаде отново.',
    confirm_ignore_one: 'Да се игнорира ли {n} обект?',
    confirm_ignore_many: 'Да се игнорират ли {n} обекта?',
    confirm_ignore_text: 'Те вече не се показват. Премахнете ги от игнорираните обекти в опциите на интеграцията.',
    used_by: 'Използван от {n}',
    ref_automation: 'Автоматизация',
    ref_script: 'Скрипт',
    ref_scene: 'Сцена',
    ref_group: 'Група',
    ref_dashboard: 'Табло',
    confirm_used_one: '{n} избран обект все още се използва: това, което го използва, може да спре да работи.',
    confirm_used_many: '{n} избрани обекта все още се използват: това, което ги използва, може да спре да работи.',
    remove_anyway: 'Премахни въпреки това',
    and_more: 'и още {n}',
    removed_one: '{n} обект е премахнат',
    removed_many: '{n} обекта са премахнати',
    devices_title: 'Осиротели устройства',
    devices_hint: 'Интеграцията им е премахната: нищо вече не ги предоставя',
    remove_devices: 'Премахни устройствата',
    confirm_devices: 'Да се премахнат ли осиротелите устройства?',
    confirm_devices_text: 'Излизат от регистъра на устройствата заедно с обектите си. Историята им остава в базата данни.',
    devices_removed: 'Премахнати осиротели устройства: {n}',
    confirm_ignore_devices: 'Да се игнорират ли избраните устройства?',
    devices_ignored: 'Игнорирани осиротели устройства: {n}',
    truncated: 'Още {n} осиротели обекта не са показани тук: първо премахнете или игнорирайте тези.',
    devices_truncated: 'Осиротели устройства, които не са показани тук: {n}',
    confirm_devices_used: 'Устройства, все още използвани от автоматизации или скриптове: {n}. Те може да спрат да работят.',
    kept: 'Запазени, вече не са осиротели: {n}',
    dev_entities: 'Обекти: {n}',
    ignored_one: '{n} обект е игнориран',
    ignored_many: '{n} обекта са игнорирани',
    minutes: '{n} мин.',
    hours: '{n} ч',
    days: '{n} дни',
    ed_entity: 'Сензор Orphan Entities',
    ed_entity_helper: 'Сензорът на осиротелите обекти; оставете празно, за да бъде намерен автоматично',
    ed_title: 'Заглавие',
    ed_title_helper: 'Оставете празно за „Orphan Entities“',
    ed_show_stats: 'Обобщение',
    ed_show_stats_helper: 'Осиротели, премахнати от стартирането и игнорирани',
    ed_show_filters: 'Филтри',
    ed_show_filters_helper: 'Търсене, интеграция и причина',
    ed_max_rows: 'Показани редове',
    ed_max_rows_helper: 'Преди „Покажи всички“',
    ed_scan_button: 'Бутон „Сканирай сега“',
    ed_scan_button_helper: 'Сканира от заглавката, за всеки потребител, който вижда картата',
    ed_hide_when_empty: 'Скрий картата, когато няма осиротели',
    ed_hide_when_empty_helper: 'Картата се появява само когато има осиротял обект',
    zoom_in: 'Покажи подробности',
    zoom_out: 'Назад към компактния изглед',
    ed_zoom: 'Бутон за подробности',
    ed_zoom_helper: 'Превключва към пълната карта и обратно',
    ed_language: 'Език',
    ed_language_helper: 'Оставете празно, за да следва Home Assistant',
  },
  ru: {
    title: 'Orphan Entities',
    none: 'Нет осиротевших',
    orphans_one: '{n} осиротевший',
    orphans_few: '{n} осиротевших',
    orphans_many: '{n} осиротевших',
    waiting: 'Ожидание первого сканирования',
    not_loaded: 'Не настроено',
    never_scanned: 'Ещё не сканировалось',
    scanned: 'Просканировано {d}',
    scan_now: 'Сканировать сейчас',
    action_failed: 'Ошибка: {error}',
    stat_orphans: 'Осиротевшие',
    stat_removed: 'Удалённые',
    stat_removed_hint: 'С момента запуска Home Assistant',
    stat_ignored: 'Игнорируемые',
    reason_entry_removed: 'Интеграция удалена',
    reason_integration_missing: 'Интеграция не загружена',
    reason_not_provided: 'Не предоставляется',
    reason_unavailable: 'Недоступен',
    reason_unknown: 'Неизвестен',
    all: 'Все',
    search: 'Поиск',
    all_integrations: 'Все интеграции',
    list_title: 'Осиротевшие объекты',
    no_match: 'Нет объектов, соответствующих фильтрам',
    empty: 'Каждый объект предоставляется своей интеграцией',
    for: 'уже {d}',
    disabled: 'отключён',
    select_all: 'Выбрать показанные ({n})',
    show_all: 'Показать все ({n})',
    selected_one: '{n} выбран',
    selected_few: '{n} выбрано',
    selected_many: '{n} выбрано',
    remove: 'Удалить',
    ignore: 'Игнорировать',
    clear: 'Снять выделение',
    cancel: 'Отмена',
    confirm_remove_one: 'Удалить {n} объект из реестра объектов?',
    confirm_remove_few: 'Удалить {n} объекта из реестра объектов?',
    confirm_remove_many: 'Удалить {n} объектов из реестра объектов?',
    confirm_remove_text: 'Их история остаётся в базе данных. Объект, который всё ещё предоставляется своей интеграцией, вернётся, если интеграция создаст его снова.',
    confirm_ignore_one: 'Игнорировать {n} объект?',
    confirm_ignore_few: 'Игнорировать {n} объекта?',
    confirm_ignore_many: 'Игнорировать {n} объектов?',
    confirm_ignore_text: 'Они больше не будут отображаться. Удалите их из игнорируемых объектов в параметрах интеграции.',
    used_by: 'Используется: {n}',
    ref_automation: 'Автоматизация',
    ref_script: 'Скрипт',
    ref_scene: 'Сцена',
    ref_group: 'Группа',
    ref_dashboard: 'Панель',
    confirm_used_one: '{n} выбранный объект всё ещё используется: то, что его использует, может перестать работать.',
    confirm_used_few: '{n} выбранных объекта всё ещё используются: то, что их использует, может перестать работать.',
    confirm_used_many: '{n} выбранных объектов всё ещё используются: то, что их использует, может перестать работать.',
    remove_anyway: 'Всё равно удалить',
    and_more: 'и ещё {n}',
    removed_one: 'Удалён {n} объект',
    removed_few: 'Удалено {n} объекта',
    removed_many: 'Удалено {n} объектов',
    devices_title: 'Осиротевшие устройства',
    devices_hint: 'Их интеграция удалена: их больше ничто не предоставляет',
    remove_devices: 'Удалить устройства',
    confirm_devices: 'Удалить осиротевшие устройства?',
    confirm_devices_text: 'Они удаляются из реестра устройств вместе с объектами. Их история остаётся в базе данных.',
    devices_removed: 'Удалено осиротевших устройств: {n}',
    confirm_ignore_devices: 'Игнорировать выбранные устройства?',
    devices_ignored: 'Игнорировано осиротевших устройств: {n}',
    truncated: 'Ещё {n} осиротевших объектов здесь не показаны: сначала удалите или игнорируйте эти.',
    devices_truncated: 'Осиротевшие устройства, не показанные здесь: {n}',
    confirm_devices_used: 'Устройства, всё ещё используемые автоматизациями или скриптами: {n}. Они могут перестать работать.',
    kept: 'Сохранено, больше не осиротевшие: {n}',
    dev_entities: 'Объекты: {n}',
    ignored_one: 'Проигнорирован {n} объект',
    ignored_few: 'Проигнорировано {n} объекта',
    ignored_many: 'Проигнорировано {n} объектов',
    minutes: '{n} мин',
    hours: '{n} ч',
    days: '{n} дн.',
    ed_entity: 'Сенсор Orphan Entities',
    ed_entity_helper: 'Сенсор осиротевших объектов; оставьте пустым для автоматического поиска',
    ed_title: 'Заголовок',
    ed_title_helper: 'Оставьте пустым для «Orphan Entities»',
    ed_show_stats: 'Сводка',
    ed_show_stats_helper: 'Осиротевшие, удалённые с момента запуска и игнорируемые',
    ed_show_filters: 'Фильтры',
    ed_show_filters_helper: 'Поиск, интеграция и причина',
    ed_max_rows: 'Отображаемые строки',
    ed_max_rows_helper: 'До «Показать все»',
    ed_scan_button: 'Кнопка «Сканировать сейчас»',
    ed_scan_button_helper: 'Сканирует из заголовка, для любого пользователя, который видит карточку',
    ed_hide_when_empty: 'Скрывать карточку, когда нет осиротевших',
    ed_hide_when_empty_helper: 'Карточка появляется, только когда есть осиротевший объект',
    zoom_in: 'Показать подробности',
    zoom_out: 'Назад к компактному виду',
    ed_zoom: 'Кнопка подробностей',
    ed_zoom_helper: 'Переключает на полную карточку и обратно',
    ed_language: 'Язык',
    ed_language_helper: 'Оставьте пустым, чтобы использовать язык Home Assistant',
  },
  uk: {
    title: 'Orphan Entities',
    none: 'Немає осиротілих',
    orphans_one: '{n} осиротіла',
    orphans_few: '{n} осиротілі',
    orphans_many: '{n} осиротілих',
    waiting: 'Очікування першого сканування',
    not_loaded: 'Не налаштовано',
    never_scanned: 'Ще не скановано',
    scanned: 'Скановано {d}',
    scan_now: 'Сканувати зараз',
    action_failed: 'Помилка: {error}',
    stat_orphans: 'Осиротілі',
    stat_removed: 'Видалені',
    stat_removed_hint: 'З моменту запуску Home Assistant',
    stat_ignored: 'Ігноровані',
    reason_entry_removed: 'Інтеграцію видалено',
    reason_integration_missing: 'Інтеграцію не завантажено',
    reason_not_provided: 'Не надається',
    reason_unavailable: 'Недоступна',
    reason_unknown: 'Невідома',
    all: 'Усі',
    search: 'Пошук',
    all_integrations: 'Усі інтеграції',
    list_title: 'Осиротілі сутності',
    no_match: 'Жодна сутність не відповідає фільтрам',
    empty: 'Кожну сутність надає її інтеграція',
    for: 'уже {d}',
    disabled: 'вимкнена',
    select_all: 'Вибрати показані ({n})',
    show_all: 'Показати всі ({n})',
    selected_one: '{n} вибрана',
    selected_few: '{n} вибрані',
    selected_many: '{n} вибраних',
    remove: 'Видалити',
    ignore: 'Ігнорувати',
    clear: 'Скасувати вибір',
    cancel: 'Скасувати',
    confirm_remove_one: 'Видалити {n} сутність з реєстру сутностей?',
    confirm_remove_few: 'Видалити {n} сутності з реєстру сутностей?',
    confirm_remove_many: 'Видалити {n} сутностей з реєстру сутностей?',
    confirm_remove_text: 'Їхня історія залишається в базі даних. Сутність, яку її інтеграція все ще надає, повернеться, якщо інтеграція створить її знову.',
    confirm_ignore_one: 'Ігнорувати {n} сутність?',
    confirm_ignore_few: 'Ігнорувати {n} сутності?',
    confirm_ignore_many: 'Ігнорувати {n} сутностей?',
    confirm_ignore_text: 'Вони більше не відображатимуться. Видаліть їх з ігнорованих сутностей у параметрах інтеграції.',
    used_by: 'Використовується: {n}',
    ref_automation: 'Автоматизація',
    ref_script: 'Скрипт',
    ref_scene: 'Сцена',
    ref_group: 'Група',
    ref_dashboard: 'Панель',
    confirm_used_one: '{n} вибрана сутність досі використовується: те, що її використовує, може перестати працювати.',
    confirm_used_few: '{n} вибрані сутності досі використовуються: те, що їх використовує, може перестати працювати.',
    confirm_used_many: '{n} вибраних сутностей досі використовуються: те, що їх використовує, може перестати працювати.',
    remove_anyway: 'Усе одно видалити',
    and_more: 'і ще {n}',
    removed_one: 'Видалено {n} сутність',
    removed_few: 'Видалено {n} сутності',
    removed_many: 'Видалено {n} сутностей',
    devices_title: 'Осиротілі пристрої',
    devices_hint: 'Їхню інтеграцію видалено: ніщо їх більше не надає',
    remove_devices: 'Видалити пристрої',
    confirm_devices: 'Видалити осиротілі пристрої?',
    confirm_devices_text: 'Вони зникають з реєстру пристроїв разом із сутностями. Їхня історія лишається в базі даних.',
    devices_removed: 'Видалено осиротілих пристроїв: {n}',
    confirm_ignore_devices: 'Ігнорувати вибрані пристрої?',
    devices_ignored: 'Проігноровано осиротілих пристроїв: {n}',
    truncated: 'Ще {n} осиротілих сутностей тут не показано: спершу видаліть або проігноруйте ці.',
    devices_truncated: 'Осиротілі пристрої, не показані тут: {n}',
    confirm_devices_used: 'Пристрої, які досі використовують автоматизації або скрипти: {n}. Вони можуть перестати працювати.',
    kept: 'Залишено, більше не осиротілі: {n}',
    dev_entities: 'Сутності: {n}',
    ignored_one: 'Проігноровано {n} сутність',
    ignored_few: 'Проігноровано {n} сутності',
    ignored_many: 'Проігноровано {n} сутностей',
    minutes: '{n} хв',
    hours: '{n} год',
    days: '{n} дн.',
    ed_entity: 'Сенсор Orphan Entities',
    ed_entity_helper: 'Сенсор осиротілих сутностей; залиште порожнім, щоб знайти його автоматично',
    ed_title: 'Заголовок',
    ed_title_helper: 'Залиште порожнім для «Orphan Entities»',
    ed_show_stats: 'Зведення',
    ed_show_stats_helper: 'Осиротілі, видалені з моменту запуску та ігноровані',
    ed_show_filters: 'Фільтри',
    ed_show_filters_helper: 'Пошук, інтеграція та причина',
    ed_max_rows: 'Показані рядки',
    ed_max_rows_helper: 'До «Показати всі»',
    ed_scan_button: 'Кнопка «Сканувати зараз»',
    ed_scan_button_helper: 'Сканує із заголовка, для кожного користувача, який бачить картку',
    ed_hide_when_empty: 'Приховувати картку, коли немає осиротілих',
    ed_hide_when_empty_helper: 'Картка з’являється лише тоді, коли є осиротіла сутність',
    zoom_in: 'Показати деталі',
    zoom_out: 'Назад до компактного вигляду',
    ed_zoom: 'Кнопка деталей',
    ed_zoom_helper: 'Перемикає на повну картку й назад',
    ed_language: 'Мова',
    ed_language_helper: 'Залиште порожнім, щоб використовувати мову Home Assistant',
  },
  hu: {
    title: 'Orphan Entities',
    none: 'Nincs árva',
    orphans_one: '{n} árva',
    orphans_many: '{n} árva',
    waiting: 'Várakozás az első vizsgálatra',
    not_loaded: 'Nincs beállítva',
    never_scanned: 'Még nem volt vizsgálat',
    scanned: 'Vizsgálva: {d}',
    scan_now: 'Vizsgálat most',
    action_failed: 'Sikertelen: {error}',
    stat_orphans: 'Árvák',
    stat_removed: 'Eltávolítva',
    stat_removed_hint: 'A Home Assistant indulása óta',
    stat_ignored: 'Mellőzve',
    reason_entry_removed: 'Integráció eltávolítva',
    reason_integration_missing: 'Integráció nincs betöltve',
    reason_not_provided: 'Nincs biztosítva',
    reason_unavailable: 'Nem elérhető',
    reason_unknown: 'Ismeretlen',
    all: 'Mind',
    search: 'Keresés',
    all_integrations: 'Minden integráció',
    list_title: 'Árva entitások',
    no_match: 'Egyetlen entitás sem felel meg a szűrőknek',
    empty: 'Minden entitást biztosít az integrációja',
    for: '{d} óta',
    disabled: 'letiltva',
    select_all: 'A megjelenített {n} kijelölése',
    show_all: 'Összes megjelenítése ({n})',
    selected_one: '{n} kijelölve',
    selected_many: '{n} kijelölve',
    remove: 'Eltávolítás',
    ignore: 'Mellőzés',
    clear: 'Kijelölés törlése',
    cancel: 'Mégse',
    confirm_remove_one: '{n} entitás eltávolítása az entitásnyilvántartásból?',
    confirm_remove_many: '{n} entitás eltávolítása az entitásnyilvántartásból?',
    confirm_remove_text: 'Az előzményeik az adatbázisban maradnak. Az integrációja által még biztosított entitás visszatér, ha az integráció újra létrehozza.',
    confirm_ignore_one: '{n} entitás figyelmen kívül hagyása?',
    confirm_ignore_many: '{n} entitás figyelmen kívül hagyása?',
    confirm_ignore_text: 'Többé nem jelennek meg a listában. Az integráció beállításaiban távolíthatja el őket a figyelmen kívül hagyott entitások közül.',
    used_by: 'Használja: {n}',
    ref_automation: 'Automatizálás',
    ref_script: 'Szkript',
    ref_scene: 'Jelenet',
    ref_group: 'Csoport',
    ref_dashboard: 'Irányítópult',
    confirm_used_one: '{n} kijelölt entitás még használatban van: ami használja, leállhat.',
    confirm_used_many: '{n} kijelölt entitás még használatban van: ami használja őket, leállhat.',
    remove_anyway: 'Eltávolítás mégis',
    and_more: 'és még {n}',
    removed_one: '{n} entitás eltávolítva',
    removed_many: '{n} entitás eltávolítva',
    devices_title: 'Árva eszközök',
    devices_hint: 'Az integrációjukat eltávolították: már semmi sem biztosítja őket',
    remove_devices: 'Eszközök eltávolítása',
    confirm_devices: 'Eltávolítja az árva eszközöket?',
    confirm_devices_text: 'Entitásaikkal együtt kikerülnek az eszköznyilvántartásból. Az előzményeik az adatbázisban maradnak.',
    devices_removed: 'Eltávolított árva eszközök: {n}',
    confirm_ignore_devices: 'Figyelmen kívül hagyja a kijelölt eszközöket?',
    devices_ignored: 'Figyelmen kívül hagyott árva eszközök: {n}',
    truncated: 'További {n} árva entitás nem látható itt: előbb távolítsa el vagy hagyja figyelmen kívül ezeket.',
    devices_truncated: 'Itt nem látható árva eszközök: {n}',
    confirm_devices_used: 'Automatizálások vagy szkriptek által még használt eszközök: {n}. Ezek leállhatnak.',
    kept: 'Megtartva, már nem árva: {n}',
    dev_entities: 'Entitások: {n}',
    ignored_one: '{n} entitás figyelmen kívül hagyva',
    ignored_many: '{n} entitás figyelmen kívül hagyva',
    minutes: '{n} perc',
    hours: '{n} óra',
    days: '{n} nap',
    ed_entity: 'Orphan Entities érzékelő',
    ed_entity_helper: 'Az árva entitások érzékelője; hagyja üresen az automatikus kereséshez',
    ed_title: 'Cím',
    ed_title_helper: 'Hagyja üresen az „Orphan Entities” címhez',
    ed_show_stats: 'Összegzés',
    ed_show_stats_helper: 'Árvák, az indulás óta eltávolítottak és figyelmen kívül hagyottak',
    ed_show_filters: 'Szűrők',
    ed_show_filters_helper: 'Keresés, integráció és ok',
    ed_max_rows: 'Megjelenített sorok',
    ed_max_rows_helper: 'Az „Összes megjelenítése” előtt',
    ed_scan_button: '„Vizsgálat most” gomb',
    ed_scan_button_helper: 'A fejlécből indít vizsgálatot, minden felhasználónak, aki látja a kártyát',
    ed_hide_when_empty: 'Kártya elrejtése, ha nincs árva',
    ed_hide_when_empty_helper: 'A kártya csak akkor jelenik meg, ha van árva entitás',
    zoom_in: 'Részletek megjelenítése',
    zoom_out: 'Vissza a kompakt nézethez',
    ed_zoom: 'Részletek gomb',
    ed_zoom_helper: 'Átvált a teljes kártyára és vissza',
    ed_language: 'Nyelv',
    ed_language_helper: 'Hagyja üresen a Home Assistant nyelvének követéséhez',
  },
  sk: {
    title: 'Orphan Entities',
    none: 'Žiadne osirotené',
    orphans_one: '{n} osirotená',
    orphans_few: '{n} osirotené',
    orphans_many: '{n} osirotených',
    waiting: 'Čaká sa na prvé skenovanie',
    not_loaded: 'Nenastavené',
    never_scanned: 'Ešte neskenované',
    scanned: 'Skenované {d}',
    scan_now: 'Skenovať teraz',
    action_failed: 'Zlyhalo: {error}',
    stat_orphans: 'Osirotené',
    stat_removed: 'Odstránené',
    stat_removed_hint: 'Od spustenia Home Assistant',
    stat_ignored: 'Ignorované',
    reason_entry_removed: 'Integrácia odstránená',
    reason_integration_missing: 'Integrácia nenačítaná',
    reason_not_provided: 'Neposkytovaná',
    reason_unavailable: 'Nedostupná',
    reason_unknown: 'Neznáma',
    all: 'Všetky',
    search: 'Hľadať',
    all_integrations: 'Všetky integrácie',
    list_title: 'Osirotené entity',
    no_match: 'Filtrom nezodpovedá žiadna entita',
    empty: 'Každú entitu poskytuje jej integrácia',
    for: 'už {d}',
    disabled: 'zakázaná',
    select_all: 'Vybrať zobrazené ({n})',
    show_all: 'Zobraziť všetky ({n})',
    selected_one: '{n} vybraná',
    selected_few: '{n} vybrané',
    selected_many: '{n} vybraných',
    remove: 'Odstrániť',
    ignore: 'Ignorovať',
    clear: 'Zrušiť výber',
    cancel: 'Zrušiť',
    confirm_remove_one: 'Odstrániť {n} entitu z registra entít?',
    confirm_remove_few: 'Odstrániť {n} entity z registra entít?',
    confirm_remove_many: 'Odstrániť {n} entít z registra entít?',
    confirm_remove_text: 'Ich história zostáva v databáze. Entita, ktorú jej integrácia stále poskytuje, sa vráti, ak ju integrácia znova vytvorí.',
    confirm_ignore_one: 'Ignorovať {n} entitu?',
    confirm_ignore_few: 'Ignorovať {n} entity?',
    confirm_ignore_many: 'Ignorovať {n} entít?',
    confirm_ignore_text: 'Už sa nebudú zobrazovať. Odstráňte ich z ignorovaných entít v možnostiach integrácie.',
    used_by: 'Používa ju: {n}',
    ref_automation: 'Automatizácia',
    ref_script: 'Skript',
    ref_scene: 'Scéna',
    ref_group: 'Skupina',
    ref_dashboard: 'Ovládací panel',
    confirm_used_one: '{n} vybraná entita sa stále používa: to, čo ju používa, môže prestať fungovať.',
    confirm_used_few: '{n} vybrané entity sa stále používajú: to, čo ich používa, môže prestať fungovať.',
    confirm_used_many: '{n} vybraných entít sa stále používa: to, čo ich používa, môže prestať fungovať.',
    remove_anyway: 'Napriek tomu odstrániť',
    and_more: 'a ďalšie ({n})',
    removed_one: 'Odstránená {n} entita',
    removed_few: 'Odstránené {n} entity',
    removed_many: 'Odstránených {n} entít',
    devices_title: 'Osirotené zariadenia',
    devices_hint: 'Ich integrácia bola odstránená: nič ich už neposkytuje',
    remove_devices: 'Odstrániť zariadenia',
    confirm_devices: 'Odstrániť osirotené zariadenia?',
    confirm_devices_text: 'Odídu z registra zariadení spolu s entitami. Ich história zostane v databáze.',
    devices_removed: 'Odstránené osirotené zariadenia: {n}',
    confirm_ignore_devices: 'Ignorovať vybrané zariadenia?',
    devices_ignored: 'Ignorované osirelé zariadenia: {n}',
    truncated: 'Ďalších {n} osirelých entít tu nie je uvedených: najprv odstráňte alebo ignorujte tieto.',
    devices_truncated: 'Osirotené zariadenia, ktoré tu nie sú uvedené: {n}',
    confirm_devices_used: 'Zariadenia stále používané automatizáciami alebo skriptmi: {n}. Môžu prestať fungovať.',
    kept: 'Ponechané, už nie sú osirotené: {n}',
    dev_entities: 'Entity: {n}',
    ignored_one: 'Ignorovaná {n} entita',
    ignored_few: 'Ignorované {n} entity',
    ignored_many: 'Ignorovaných {n} entít',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Senzor Orphan Entities',
    ed_entity_helper: 'Senzor osirotených entít; nechajte prázdne na automatické vyhľadanie',
    ed_title: 'Názov',
    ed_title_helper: 'Nechajte prázdne pre „Orphan Entities“',
    ed_show_stats: 'Prehľad',
    ed_show_stats_helper: 'Osirotené, odstránené od spustenia a ignorované',
    ed_show_filters: 'Filtre',
    ed_show_filters_helper: 'Vyhľadávanie, integrácia a dôvod',
    ed_max_rows: 'Zobrazené riadky',
    ed_max_rows_helper: 'Pred „Zobraziť všetky“',
    ed_scan_button: 'Tlačidlo „Skenovať teraz“',
    ed_scan_button_helper: 'Skenuje z hlavičky, pre každého používateľa, ktorý vidí kartu',
    ed_hide_when_empty: 'Skryť kartu, keď nie sú žiadne osirotené',
    ed_hide_when_empty_helper: 'Karta sa zobrazí, len keď je nejaká entita osirotená',
    zoom_in: 'Zobraziť podrobnosti',
    zoom_out: 'Späť na kompaktné zobrazenie',
    ed_zoom: 'Tlačidlo podrobností',
    ed_zoom_helper: 'Prepína na celú kartu a späť',
    ed_language: 'Jazyk',
    ed_language_helper: 'Nechajte prázdne, ak chcete používať jazyk Home Assistant',
  },
  cs: {
    title: 'Orphan Entities',
    none: 'Žádné osiřelé',
    orphans_one: '{n} osiřelá',
    orphans_few: '{n} osiřelé',
    orphans_many: '{n} osiřelých',
    waiting: 'Čeká se na první skenování',
    not_loaded: 'Nenastaveno',
    never_scanned: 'Zatím neskenováno',
    scanned: 'Skenováno {d}',
    scan_now: 'Skenovat nyní',
    action_failed: 'Selhalo: {error}',
    stat_orphans: 'Osiřelé',
    stat_removed: 'Odebrané',
    stat_removed_hint: 'Od spuštění Home Assistant',
    stat_ignored: 'Ignorované',
    reason_entry_removed: 'Integrace odebrána',
    reason_integration_missing: 'Integrace nenačtena',
    reason_not_provided: 'Neposkytována',
    reason_unavailable: 'Nedostupná',
    reason_unknown: 'Neznámá',
    all: 'Všechny',
    search: 'Hledat',
    all_integrations: 'Všechny integrace',
    list_title: 'Osiřelé entity',
    no_match: 'Filtrům neodpovídá žádná entita',
    empty: 'Každou entitu poskytuje její integrace',
    for: 'již {d}',
    disabled: 'zakázaná',
    select_all: 'Vybrat zobrazené ({n})',
    show_all: 'Zobrazit vše ({n})',
    selected_one: '{n} vybraná',
    selected_few: '{n} vybrané',
    selected_many: '{n} vybraných',
    remove: 'Odebrat',
    ignore: 'Ignorovat',
    clear: 'Zrušit výběr',
    cancel: 'Zrušit',
    confirm_remove_one: 'Odebrat {n} entitu z registru entit?',
    confirm_remove_few: 'Odebrat {n} entity z registru entit?',
    confirm_remove_many: 'Odebrat {n} entit z registru entit?',
    confirm_remove_text: 'Jejich historie zůstává v databázi. Entita, kterou její integrace stále poskytuje, se vrátí, pokud ji integrace znovu vytvoří.',
    confirm_ignore_one: 'Ignorovat {n} entitu?',
    confirm_ignore_few: 'Ignorovat {n} entity?',
    confirm_ignore_many: 'Ignorovat {n} entit?',
    confirm_ignore_text: 'Již nebudou zobrazeny. Odeberte je z ignorovaných entit v možnostech integrace.',
    used_by: 'Používá ji: {n}',
    ref_automation: 'Automatizace',
    ref_script: 'Skript',
    ref_scene: 'Scéna',
    ref_group: 'Skupina',
    ref_dashboard: 'Ovládací panel',
    confirm_used_one: '{n} vybraná entita se stále používá: to, co ji používá, může přestat fungovat.',
    confirm_used_few: '{n} vybrané entity se stále používají: to, co je používá, může přestat fungovat.',
    confirm_used_many: '{n} vybraných entit se stále používá: to, co je používá, může přestat fungovat.',
    remove_anyway: 'Přesto odebrat',
    and_more: 'a další ({n})',
    removed_one: 'Odebrána {n} entita',
    removed_few: 'Odebrány {n} entity',
    removed_many: 'Odebráno {n} entit',
    devices_title: 'Osiřelá zařízení',
    devices_hint: 'Jejich integrace byla odebrána: nic je už neposkytuje',
    remove_devices: 'Odebrat zařízení',
    confirm_devices: 'Odebrat osiřelá zařízení?',
    confirm_devices_text: 'Odejdou z registru zařízení i s entitami. Jejich historie zůstane v databázi.',
    devices_removed: 'Odebraná osiřelá zařízení: {n}',
    confirm_ignore_devices: 'Ignorovat vybraná zařízení?',
    devices_ignored: 'Ignorovaná osiřelá zařízení: {n}',
    truncated: 'Dalších {n} osiřelých entit zde není uvedeno: nejprve odstraňte nebo ignorujte tyto.',
    devices_truncated: 'Osiřelá zařízení, která zde nejsou uvedena: {n}',
    confirm_devices_used: 'Zařízení stále používaná automatizacemi nebo skripty: {n}. Ty mohou přestat fungovat.',
    kept: 'Ponecháno, už nejsou osiřelé: {n}',
    dev_entities: 'Entity: {n}',
    ignored_one: 'Ignorována {n} entita',
    ignored_few: 'Ignorovány {n} entity',
    ignored_many: 'Ignorováno {n} entit',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Senzor Orphan Entities',
    ed_entity_helper: 'Senzor osiřelých entit; ponechte prázdné pro automatické vyhledání',
    ed_title: 'Název',
    ed_title_helper: 'Ponechte prázdné pro „Orphan Entities“',
    ed_show_stats: 'Přehled',
    ed_show_stats_helper: 'Osiřelé, odebrané od spuštění a ignorované',
    ed_show_filters: 'Filtry',
    ed_show_filters_helper: 'Hledání, integrace a důvod',
    ed_max_rows: 'Zobrazené řádky',
    ed_max_rows_helper: 'Před „Zobrazit vše“',
    ed_scan_button: 'Tlačítko „Skenovat nyní“',
    ed_scan_button_helper: 'Skenuje ze záhlaví, pro každého uživatele, který kartu vidí',
    ed_hide_when_empty: 'Skrýt kartu, když nejsou žádné osiřelé',
    ed_hide_when_empty_helper: 'Karta se zobrazí, jen když je některá entita osiřelá',
    zoom_in: 'Zobrazit podrobnosti',
    zoom_out: 'Zpět na kompaktní zobrazení',
    ed_zoom: 'Tlačítko podrobností',
    ed_zoom_helper: 'Přepne na celou kartu a zpět',
    ed_language: 'Jazyk',
    ed_language_helper: 'Ponechte prázdné pro jazyk Home Assistant',
  },
  sl: {
    title: 'Orphan Entities',
    none: 'Ni osirotelih',
    orphans_one: '{n} osirotela',
    orphans_many: 'Osirotele: {n}',
    waiting: 'Čakanje na prvi pregled',
    not_loaded: 'Ni nastavljeno',
    never_scanned: 'Še ni pregledano',
    scanned: 'Pregledano {d}',
    scan_now: 'Preglej zdaj',
    action_failed: 'Ni uspelo: {error}',
    stat_orphans: 'Osirotele',
    stat_removed: 'Odstranjene',
    stat_removed_hint: 'Od zagona Home Assistant',
    stat_ignored: 'Prezrte',
    reason_entry_removed: 'Integracija odstranjena',
    reason_integration_missing: 'Integracija ni naložena',
    reason_not_provided: 'Ni zagotovljena',
    reason_unavailable: 'Ni na voljo',
    reason_unknown: 'Neznana',
    all: 'Vse',
    search: 'Iskanje',
    all_integrations: 'Vse integracije',
    list_title: 'Osirotele entitete',
    no_match: 'Nobena entiteta se ne ujema s filtri',
    empty: 'Vsako entiteto zagotavlja njena integracija',
    for: 'že {d}',
    disabled: 'onemogočena',
    select_all: 'Izberi prikazane ({n})',
    show_all: 'Prikaži vse ({n})',
    selected_one: '{n} izbrana',
    selected_many: 'Izbrane: {n}',
    remove: 'Odstrani',
    ignore: 'Prezri',
    clear: 'Počisti izbor',
    cancel: 'Prekliči',
    confirm_remove_one: 'Odstranim {n} entiteto iz registra entitet?',
    confirm_remove_many: 'Odstranim entitete iz registra entitet ({n})?',
    confirm_remove_text: 'Njihova zgodovina ostane v zbirki podatkov. Entiteta, ki jo njena integracija še zagotavlja, se vrne, če jo integracija znova ustvari.',
    confirm_ignore_one: 'Prezrem {n} entiteto?',
    confirm_ignore_many: 'Prezrem entitete ({n})?',
    confirm_ignore_text: 'Ne bodo več prikazane. Odstranite jih iz prezrtih entitet v možnostih integracije.',
    used_by: 'Uporablja: {n}',
    ref_automation: 'Avtomatizacija',
    ref_script: 'Skripta',
    ref_scene: 'Scena',
    ref_group: 'Skupina',
    ref_dashboard: 'Nadzorna plošča',
    confirm_used_one: '{n} izbrana entiteta je še v uporabi: kar jo uporablja, lahko preneha delovati.',
    confirm_used_many: '{n} izbranih entitet je še v uporabi: kar jih uporablja, lahko preneha delovati.',
    remove_anyway: 'Vseeno odstrani',
    and_more: 'in še {n}',
    removed_one: 'Odstranjena {n} entiteta',
    removed_many: 'Odstranjene entitete: {n}',
    devices_title: 'Osirotele naprave',
    devices_hint: 'Njihova integracija je bila odstranjena: nič jih več ne zagotavlja',
    remove_devices: 'Odstrani naprave',
    confirm_devices: 'Odstranim osirotele naprave?',
    confirm_devices_text: 'Iz registra naprav odidejo skupaj s svojimi entitetami. Njihova zgodovina ostane v bazi.',
    devices_removed: 'Odstranjene osirotele naprave: {n}',
    confirm_ignore_devices: 'Prezrem izbrane naprave?',
    devices_ignored: 'Prezrte osirotele naprave: {n}',
    truncated: 'Še {n} osirotelih entitet tu ni prikazanih: najprej odstranite ali prezrite te.',
    devices_truncated: 'Osirotele naprave, ki tu niso prikazane: {n}',
    confirm_devices_used: 'Naprave, ki jih še uporabljajo avtomatizacije ali skripti: {n}. Ti lahko prenehajo delovati.',
    kept: 'Ohranjeno, ni več osirotelo: {n}',
    dev_entities: 'Entitete: {n}',
    ignored_one: 'Prezrta {n} entiteta',
    ignored_many: 'Prezrte entitete: {n}',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Senzor Orphan Entities',
    ed_entity_helper: 'Senzor osirotelih entitet; pustite prazno za samodejno iskanje',
    ed_title: 'Naslov',
    ed_title_helper: 'Pustite prazno za »Orphan Entities«',
    ed_show_stats: 'Povzetek',
    ed_show_stats_helper: 'Osirotele, odstranjene od zagona in prezrte',
    ed_show_filters: 'Filtri',
    ed_show_filters_helper: 'Iskanje, integracija in razlog',
    ed_max_rows: 'Prikazane vrstice',
    ed_max_rows_helper: 'Pred »Prikaži vse«',
    ed_scan_button: 'Gumb »Preglej zdaj«',
    ed_scan_button_helper: 'Pregleda iz glave, za vsakega uporabnika, ki vidi kartico',
    ed_hide_when_empty: 'Skrij kartico, ko ni osirotelih',
    ed_hide_when_empty_helper: 'Kartica se prikaže le, ko je kakšna entiteta osirotela',
    zoom_in: 'Prikaži podrobnosti',
    zoom_out: 'Nazaj na strnjeni pogled',
    ed_zoom: 'Gumb za podrobnosti',
    ed_zoom_helper: 'Preklopi na celotno kartico in nazaj',
    ed_language: 'Jezik',
    ed_language_helper: 'Pustite prazno za jezik Home Assistant',
  },
  lv: {
    title: 'Orphan Entities',
    none: 'Nav pamestu',
    orphans_one: '{n} pamesta',
    orphans_many: '{n} pamestas',
    waiting: 'Gaida pirmo skenēšanu',
    not_loaded: 'Nav iestatīts',
    never_scanned: 'Vēl nav skenēts',
    scanned: 'Skenēts {d}',
    scan_now: 'Skenēt tagad',
    action_failed: 'Neizdevās: {error}',
    stat_orphans: 'Pamestas',
    stat_removed: 'Noņemtas',
    stat_removed_hint: 'Kopš Home Assistant palaišanas',
    stat_ignored: 'Ignorētas',
    reason_entry_removed: 'Integrācija noņemta',
    reason_integration_missing: 'Integrācija nav ielādēta',
    reason_not_provided: 'Netiek nodrošināta',
    reason_unavailable: 'Nav pieejama',
    reason_unknown: 'Nezināma',
    all: 'Visas',
    search: 'Meklēt',
    all_integrations: 'Visas integrācijas',
    list_title: 'Pamestas vienības',
    no_match: 'Filtriem neatbilst neviena vienība',
    empty: 'Katru vienību nodrošina tās integrācija',
    for: 'jau {d}',
    disabled: 'atspējota',
    select_all: 'Atlasīt parādītās ({n})',
    show_all: 'Rādīt visas ({n})',
    selected_one: '{n} atlasīta',
    selected_many: '{n} atlasītas',
    remove: 'Noņemt',
    ignore: 'Ignorēt',
    clear: 'Notīrīt atlasi',
    cancel: 'Atcelt',
    confirm_remove_one: 'Noņemt {n} vienību no vienību reģistra?',
    confirm_remove_many: 'Noņemt {n} vienības no vienību reģistra?',
    confirm_remove_text: 'To vēsture paliek datubāzē. Vienība, ko tās integrācija joprojām nodrošina, atgriežas, ja integrācija to izveido no jauna.',
    confirm_ignore_one: 'Ignorēt {n} vienību?',
    confirm_ignore_many: 'Ignorēt {n} vienības?',
    confirm_ignore_text: 'Tās vairs netiek rādītas. Noņemiet tās no ignorētajām vienībām integrācijas opcijās.',
    used_by: 'Izmanto: {n}',
    ref_automation: 'Automatizācija',
    ref_script: 'Skripts',
    ref_scene: 'Aina',
    ref_group: 'Grupa',
    ref_dashboard: 'Informācijas panelis',
    confirm_used_one: '{n} atlasītā entītija joprojām tiek izmantota: tas, kas to izmanto, var pārstāt darboties.',
    confirm_used_many: '{n} atlasītās entītijas joprojām tiek izmantotas: tas, kas tās izmanto, var pārstāt darboties.',
    remove_anyway: 'Tomēr noņemt',
    and_more: 'un vēl {n}',
    removed_one: '{n} vienība noņemta',
    removed_many: '{n} vienības noņemtas',
    devices_title: 'Bāreņu ierīces',
    devices_hint: 'To integrācija tika noņemta: tās vairs nekas nenodrošina',
    remove_devices: 'Noņemt ierīces',
    confirm_devices: 'Noņemt bāreņu ierīces?',
    confirm_devices_text: 'Tās pazūd no ierīču reģistra kopā ar entītijām. To vēsture paliek datubāzē.',
    devices_removed: 'Noņemtās bāreņu ierīces: {n}',
    confirm_ignore_devices: 'Ignorēt atlasītās ierīces?',
    devices_ignored: 'Ignorētas bāreņu ierīces: {n}',
    truncated: 'Vēl {n} pamestas vienības šeit nav uzskaitītas: vispirms noņemiet vai ignorējiet šīs.',
    devices_truncated: 'Bāreņu ierīces, kas šeit nav uzskaitītas: {n}',
    confirm_devices_used: 'Ierīces, ko joprojām izmanto automatizācijas vai skripti: {n}. Tie var pārstāt darboties.',
    kept: 'Saglabātas, vairs nav bāreņi: {n}',
    dev_entities: 'Entītijas: {n}',
    ignored_one: '{n} vienība ignorēta',
    ignored_many: '{n} vienības ignorētas',
    minutes: '{n} min',
    hours: '{n} st.',
    days: '{n} d.',
    ed_entity: 'Orphan Entities sensors',
    ed_entity_helper: 'Pamesto vienību sensors; atstājiet tukšu, lai to atrastu automātiski',
    ed_title: 'Virsraksts',
    ed_title_helper: 'Atstājiet tukšu, lai rādītu „Orphan Entities”',
    ed_show_stats: 'Kopsavilkums',
    ed_show_stats_helper: 'Pamestas, noņemtas kopš palaišanas un ignorētas',
    ed_show_filters: 'Filtri',
    ed_show_filters_helper: 'Meklēšana, integrācija un iemesls',
    ed_max_rows: 'Rādītās rindas',
    ed_max_rows_helper: 'Pirms „Rādīt visas”',
    ed_scan_button: 'Poga „Skenēt tagad”',
    ed_scan_button_helper: 'Skenē no galvenes, ikvienam lietotājam, kas redz karti',
    ed_hide_when_empty: 'Paslēpt karti, ja nav pamestu',
    ed_hide_when_empty_helper: 'Karte parādās tikai tad, ja kāda vienība ir pamesta',
    zoom_in: 'Rādīt detaļas',
    zoom_out: 'Atpakaļ uz kompakto skatu',
    ed_zoom: 'Detaļu poga',
    ed_zoom_helper: 'Pārslēdz uz pilno karti un atpakaļ',
    ed_language: 'Valoda',
    ed_language_helper: 'Atstājiet tukšu, lai sekotu Home Assistant valodai',
  },
  el: {
    title: 'Orphan Entities',
    none: 'Καμία ορφανή',
    orphans_one: '{n} ορφανή',
    orphans_many: '{n} ορφανές',
    waiting: 'Αναμονή για την πρώτη σάρωση',
    not_loaded: 'Δεν έχει ρυθμιστεί',
    never_scanned: 'Δεν έχει σαρωθεί ακόμα',
    scanned: 'Σαρώθηκε {d}',
    scan_now: 'Σάρωση τώρα',
    action_failed: 'Απέτυχε: {error}',
    stat_orphans: 'Ορφανές',
    stat_removed: 'Αφαιρέθηκαν',
    stat_removed_hint: 'Από την εκκίνηση του Home Assistant',
    stat_ignored: 'Σε παράβλεψη',
    reason_entry_removed: 'Η ενσωμάτωση αφαιρέθηκε',
    reason_integration_missing: 'Η ενσωμάτωση δεν φορτώθηκε',
    reason_not_provided: 'Δεν παρέχεται',
    reason_unavailable: 'Μη διαθέσιμη',
    reason_unknown: 'Άγνωστη',
    all: 'Όλες',
    search: 'Αναζήτηση',
    all_integrations: 'Όλες οι ενσωματώσεις',
    list_title: 'Ορφανές οντότητες',
    no_match: 'Καμία οντότητα δεν ταιριάζει με τα φίλτρα',
    empty: 'Κάθε οντότητα παρέχεται από την ενσωμάτωσή της',
    for: 'εδώ και {d}',
    disabled: 'απενεργοποιημένη',
    select_all: 'Επιλογή ορατών ({n})',
    show_all: 'Εμφάνιση όλων ({n})',
    selected_one: '{n} επιλεγμένη',
    selected_many: '{n} επιλεγμένες',
    remove: 'Αφαίρεση',
    ignore: 'Παράβλεψη',
    clear: 'Εκκαθάριση επιλογής',
    cancel: 'Ακύρωση',
    confirm_remove_one: 'Αφαίρεση {n} οντότητας από το μητρώο οντοτήτων;',
    confirm_remove_many: 'Αφαίρεση {n} οντοτήτων από το μητρώο οντοτήτων;',
    confirm_remove_text: 'Το ιστορικό τους παραμένει στη βάση δεδομένων. Μια οντότητα που εξακολουθεί να παρέχεται από την ενσωμάτωσή της επιστρέφει, αν η ενσωμάτωση τη δημιουργήσει ξανά.',
    confirm_ignore_one: 'Παράβλεψη {n} οντότητας;',
    confirm_ignore_many: 'Παράβλεψη {n} οντοτήτων;',
    confirm_ignore_text: 'Δεν εμφανίζονται πλέον στη λίστα. Αφαιρέστε τες από τις οντότητες σε παράβλεψη στις επιλογές της ενσωμάτωσης.',
    used_by: 'Χρησιμοποιείται: {n}',
    ref_automation: 'Αυτοματισμός',
    ref_script: 'Σενάριο',
    ref_scene: 'Σκηνή',
    ref_group: 'Ομάδα',
    ref_dashboard: 'Πίνακας ελέγχου',
    confirm_used_one: '{n} επιλεγμένη οντότητα χρησιμοποιείται ακόμα: ό,τι τη χρησιμοποιεί μπορεί να σταματήσει να λειτουργεί.',
    confirm_used_many: '{n} επιλεγμένες οντότητες χρησιμοποιούνται ακόμα: ό,τι τις χρησιμοποιεί μπορεί να σταματήσει να λειτουργεί.',
    remove_anyway: 'Αφαίρεση ούτως ή άλλως',
    and_more: 'και {n} ακόμα',
    removed_one: 'Αφαιρέθηκε {n} οντότητα',
    removed_many: 'Αφαιρέθηκαν {n} οντότητες',
    devices_title: 'Ορφανές συσκευές',
    devices_hint: 'Η ενσωμάτωσή τους αφαιρέθηκε: τίποτα δεν τις παρέχει πια',
    remove_devices: 'Αφαίρεση συσκευών',
    confirm_devices: 'Αφαίρεση των ορφανών συσκευών;',
    confirm_devices_text: 'Φεύγουν από το μητρώο συσκευών μαζί με τις οντότητές τους. Το ιστορικό τους μένει στη βάση δεδομένων.',
    devices_removed: 'Ορφανές συσκευές που αφαιρέθηκαν: {n}',
    confirm_ignore_devices: 'Παράβλεψη των επιλεγμένων συσκευών;',
    devices_ignored: 'Ορφανές συσκευές σε παράβλεψη: {n}',
    truncated: 'Άλλες {n} ορφανές οντότητες δεν εμφανίζονται εδώ: αφαιρέστε ή αγνοήστε πρώτα αυτές.',
    devices_truncated: 'Ορφανές συσκευές που δεν εμφανίζονται εδώ: {n}',
    confirm_devices_used: 'Συσκευές που χρησιμοποιούνται ακόμα από αυτοματισμούς ή σενάρια: {n}. Μπορεί να σταματήσουν να λειτουργούν.',
    kept: 'Διατηρήθηκαν, δεν είναι πια ορφανές: {n}',
    dev_entities: 'Οντότητες: {n}',
    ignored_one: '{n} οντότητα σε παράβλεψη',
    ignored_many: '{n} οντότητες σε παράβλεψη',
    minutes: '{n} λεπ.',
    hours: '{n} ώρ.',
    days: '{n} ημ.',
    ed_entity: 'Αισθητήρας Orphan Entities',
    ed_entity_helper: 'Αισθητήρας των ορφανών οντοτήτων· αφήστε κενό για αυτόματο εντοπισμό',
    ed_title: 'Τίτλος',
    ed_title_helper: 'Αφήστε κενό για «Orphan Entities»',
    ed_show_stats: 'Σύνοψη',
    ed_show_stats_helper: 'Ορφανές, αφαιρεμένες από την εκκίνηση και σε παράβλεψη',
    ed_show_filters: 'Φίλτρα',
    ed_show_filters_helper: 'Αναζήτηση, ενσωμάτωση και αιτία',
    ed_max_rows: 'Εμφανιζόμενες γραμμές',
    ed_max_rows_helper: 'Πριν από το «Εμφάνιση όλων»',
    ed_scan_button: 'Κουμπί «Σάρωση τώρα»',
    ed_scan_button_helper: 'Σαρώνει από την κεφαλίδα, για κάθε χρήστη που βλέπει την κάρτα',
    ed_hide_when_empty: 'Απόκρυψη της κάρτας όταν δεν υπάρχουν ορφανές',
    ed_hide_when_empty_helper: 'Η κάρτα εμφανίζεται μόνο όταν κάποια οντότητα είναι ορφανή',
    zoom_in: 'Εμφάνιση λεπτομερειών',
    zoom_out: 'Επιστροφή στη συμπαγή προβολή',
    ed_zoom: 'Κουμπί λεπτομερειών',
    ed_zoom_helper: 'Εναλλάσσει στην πλήρη κάρτα και πίσω',
    ed_language: 'Γλώσσα',
    ed_language_helper: 'Αφήστε κενό για να ακολουθεί το Home Assistant',
  },
};

const OE_LANGS = [
  ['en', 'English'],
  ['fr', 'Français'],
  ['de', 'Deutsch'],
  ['es', 'Español'],
  ['it', 'Italiano'],
  ['nl', 'Nederlands'],
  ['pt', 'Português (Portugal)'],
  ['pl', 'Polski'],
  ['sr', 'Српски'],
  ['sr-Latn', 'Srpski (latinica)'],
  ['ro', 'Română'],
  ['da', 'Dansk'],
  ['sv', 'Svenska'],
  ['bg', 'Български'],
  ['ru', 'Русский'],
  ['uk', 'Українська'],
  ['hu', 'Magyar'],
  ['sk', 'Slovenčina'],
  ['cs', 'Čeština'],
  ['sl', 'Slovenščina'],
  ['lv', 'Latviešu'],
  ['el', 'Ελληνικά'],
];

const oeLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  if (OE_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return OE_I18N[l] ? l : 'en';
};

// The locale for Intl: Home Assistant's full tag (pt-BR, nl-BE…) when it is the card's language, else the card's language.
// A bare "pt" is Home Assistant's European Portuguese, but Intl reads it as Brazilian: it becomes pt-PT.
const oeLocale = (hass, config) => {
  const lang = oeLang(hass, config);
  const ha = String(hass?.locale?.language || hass?.language || '');
  const tag = ha && (ha === lang || ha.split('-')[0] === lang) ? ha : lang;
  return tag === 'pt' ? 'pt-PT' : tag;
};

const oeT = (lang, key, vars = {}) =>
  (OE_I18N[lang]?.[key] ?? OE_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

const oeEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const OE_DEFAULTS = {
  show_stats: true,
  show_filters: true,
  max_rows: 25,
  scan_button: true,
  hide_when_empty: false,
};
const OE_MAX_ROWS = 500;
// In the integration's order, from the most to the least certain orphan.
const OE_REASONS = ['entry_removed', 'integration_missing', 'not_provided', 'unavailable', 'unknown'];
const OE_REASON_ICONS = {
  entry_removed: 'mdi:puzzle-remove-outline',
  integration_missing: 'mdi:puzzle-remove-outline',
  not_provided: 'mdi:ghost-outline',
  unavailable: 'mdi:lan-disconnect',
  unknown: 'mdi:help-circle-outline',
};
// What still uses an orphan (the integration's `used_by`), in its order: automations, scripts, scenes, groups, dashboards.
const OE_REF_ICONS = {
  automation: 'mdi:robot-outline',
  script: 'mdi:script-text-outline',
  scene: 'mdi:palette-outline',
  group: 'mdi:google-circles-communities',
  dashboard: 'mdi:view-dashboard-outline',
};
const oeUses = (i) => (Array.isArray(i?.used_by) ? i.used_by.filter((r) => r && typeof r.name === 'string') : []);

// No longer provided: red; still provided but stale: orange.
const oeKind = (reason) => (reason === 'unavailable' || reason === 'unknown' ? 'warn' : 'alert');

// Minutes elapsed since `iso` (0 for a date in the future or unreadable).
const oeMinutes = (iso, now = Date.now()) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, (now - t) / 60000) : 0;
};

// The Orphans module's entities, from the entity registry: { device: { orphans, last_scan, button } }.
// Each entity is told apart by its translation key, else by the end of its entity ID (renamed IDs keep the key).
// System Hub's other modules share the platform: only these keys are taken.
const OE_KEYS = {
  orphans: ['orphans_orphans', '_orphans_orphaned_entities'],
  last_scan: ['orphans_last_scan', '_orphans_last_scan'],
  button: ['orphans_scan', '_orphans_scan_now'],
};
function oeDevices(registry) {
  const devices = {};
  for (const [id, e] of Object.entries(registry || {})) {
    if (e?.platform !== OE_DOMAIN) continue;
    const keys = Object.keys(OE_KEYS);
    const key = keys.find((k) => e.translation_key === OE_KEYS[k][0]) || keys.find((k) => id.endsWith(OE_KEYS[k][1]));
    if (!key) continue;
    (devices[e.device_id || ''] ||= {})[key] = id;
  }
  return devices;
}

// The "Orphaned entities" sensor among `candidates`: the one whose state carries the entity list.
const oePick = (hass, candidates) => candidates.find((id) => Array.isArray(hass?.states?.[id]?.attributes?.entities));

// The items matching the search text (name, entity ID, integration, device, config entry), integration and reason.
function oeFilter(items, { q = '', platform = '', reason = '' } = {}) {
  const words = String(q).toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((i) => {
    if (platform && i.platform !== platform) return false;
    if (reason && i.reason !== reason) return false;
    if (!words.length) return true;
    const hay = [i.name, i.entity_id, i.platform, i.device, i.entry_title].filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => hay.includes(w));
  });
}

class OrphanEntitiesCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('sh-orphans-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    // What the user is doing on the card: kept across the renders.
    this._q = '';
    this._platform = '';
    this._reason = '';
    this._sel = new Set();
    // The orphan devices selected (by device ID).
    this._dsel = new Set();
    // The rows whose "Used by" list is open.
    this._open = new Set();
    this._showAll = false;
    this._confirm = null;
    this._busy = false;
    this._onKey = (ev) => {
      if (ev.key === 'Escape' && this._confirm) {
        this._confirm = null;
        this._render();
      }
    };
  }

  connectedCallback() {
    document.addEventListener('keydown', this._onKey);
    // The header is fitted again when the card is resized (a phone turned, a column added to the view).
    if (typeof ResizeObserver === 'function' && !this._resize) {
      this._resize = new ResizeObserver(() => this._fitPill());
      this._resize.observe(this);
    }
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this._onKey);
    this._resize?.disconnect();
    this._resize = null;
  }

  // The status pill keeps its text only while the text and the title both fit: a long status such as "Waiting for
  // the first scan" on a narrow card would otherwise leave "Orp…" of the title, or get cut itself. When one of them
  // is cut, the pill shows its dot alone (the text stays in its tooltip) and the title gets the room.
  _fitPill() {
    const root = this.shadowRoot;
    const pill = root?.querySelector('.head .pill');
    const text = pill?.querySelector('.ptxt');
    if (!pill || !text || typeof text.clientWidth !== 'number') return;
    pill.classList.remove('compact');
    const title = root.querySelector('.head .title');
    const cut = (el) => !!el && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1);
    if (cut(text) || cut(title)) pill.classList.add('compact');
  }

  setConfig(config) {
    this._config = { ...OE_DEFAULTS, ...config };
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._sig = null;
    this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    // Nothing the card shows changed: the same state objects, registry, language and minute ("3 min ago").
    const ids = this._ids;
    if (
      old &&
      this._sig &&
      // No sensor found yet (integration not loaded): its return must be seen at once, not at the next minute.
      ids?.orphans &&
      hass.entities === old.entities &&
      hass.user === old.user &&
      Object.values(ids).every((id) => !id || hass.states[id] === old.states[id]) &&
      oeLang(hass, this._config) === oeLang(old, this._config) &&
      Math.floor(Date.now() / 60000) === this._sigMinute
    ) {
      return;
    }
    this._render();
  }

  // Set by Lovelace while the dashboard is edited (editMode) and in the card editor's preview (preview): a card
  // hidden by hide_when_empty shows again there, so that it can still be edited.
  set editMode(value) {
    this._editMode = value;
    this._sig = null;
    this._render();
  }

  set preview(value) {
    this._preview = value;
    this._sig = null;
    this._render();
  }

  // Hides the host and tells Lovelace (card-visibility-changed), so that a sections view drops the card's slot too.
  _setHidden(hidden) {
    const changed = !!this._hidden !== hidden;
    this._hidden = hidden;
    this.style.display = hidden ? 'none' : '';
    if (changed) this.dispatchEvent(new CustomEvent('card-visibility-changed', { bubbles: true, composed: true }));
  }

  getCardSize() {
    return 3 + (this._rows || 0);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 8, rows: 'auto' };
  }

  _t(key, vars) {
    return oeT(oeLang(this._hass, this._config), key, vars);
  }

  // "{n} orphans" with the plural form of the card's language: `key_one`, `key_few` (2-4 in Serbian, Polish,
  // Russian, Ukrainian, Czech and Slovak, 0 and 2-19 in Romanian, when the language has it) or `key_many`.
  _count(key, n) {
    let cat = n === 1 ? 'one' : 'other';
    try {
      cat = new Intl.PluralRules(oeLocale(this._hass, this._config)).select(n);
    } catch {
      // Unknown locale: the simple rule above.
    }
    const form = cat === 'one' ? 'one' : cat === 'few' && OE_I18N[oeLang(this._hass, this._config)]?.[`${key}_few`] ? 'few' : 'many';
    return this._t(`${key}_${form}`, { n });
  }

  // "12 min", "3 h", "2 d".
  _duration(minutes) {
    if (minutes < 60) return this._t('minutes', { n: Math.max(1, Math.floor(minutes)) });
    const h = minutes / 60;
    return h < 48 ? this._t('hours', { n: Math.floor(h) }) : this._t('days', { n: Math.floor(h / 24) });
  }

  // "3 minutes ago", "yesterday"… in the card's language.
  _ago(iso) {
    const m = oeMinutes(iso);
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(oeLocale(this._hass, this._config), { numeric: 'auto' });
    } catch {
      return this._duration(m);
    }
    if (m < 1) return rtf.format(0, 'second');
    if (m < 60) return rtf.format(-Math.floor(m), 'minute');
    if (m < 1440) return rtf.format(-Math.floor(m / 60), 'hour');
    return rtf.format(-Math.floor(m / 1440), 'day');
  }

  // "in 7 minutes": when the first scan after a start is due (end of the grace period), or "" once it is.
  _in(iso) {
    const m = iso ? (new Date(iso).getTime() - Date.now()) / 60000 : NaN;
    if (!(m > 0)) return '';
    try {
      const rtf = new Intl.RelativeTimeFormat(oeLocale(this._hass, this._config), { numeric: 'auto' });
      return m < 60 ? rtf.format(Math.ceil(m), 'minute') : rtf.format(Math.ceil(m / 60), 'hour');
    } catch {
      return this._duration(m);
    }
  }

  // The status while the sensor is unknown (Home Assistant starting, grace period): with the time of the first scan.
  _waiting() {
    const due = this._in(this._hass.states[this._ids.orphans]?.attributes?.next_scan);
    return due ? `${this._t('waiting')} (${due})` : this._t('waiting');
  }

  _absolute(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    try {
      return d.toLocaleString(oeLocale(this._hass, this._config), { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return d.toISOString();
    }
  }

  // The entities of the device of the chosen (or found) sensor. Cached per registry object, never when empty.
  _lookup() {
    const registry = this._hass.entities;
    if (!this._reg || this._reg.registry !== registry) {
      const devices = oeDevices(registry);
      this._reg = Object.keys(devices).length ? { registry, devices } : null;
    }
    const devices = this._reg?.devices || {};
    let entity = this._config.entity;
    if (!entity) entity = oePick(this._hass, Object.values(devices).map((d) => d.orphans).filter(Boolean));
    if (!entity) return {};
    const device = Object.values(devices).find((d) => d.orphans === entity) || {};
    return { ...device, orphans: entity };
  }

  _render() {
    const m = this._prepare();
    if (!m) return;
    // innerHTML replaces every element: the one that had the keyboard focus gets it back after the render,
    // a text field with its caret.
    const active = this.shadowRoot.activeElement;
    const focusKey = active?.dataset?.focus;
    const caret = active && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null;
    this._draw(m);
    this._bind();
    this._fitPill();
    if (!focusKey) return;
    const el = [...this.shadowRoot.querySelectorAll('[data-focus]')].find((n) => n.dataset.focus === focusKey);
    el?.focus({ preventScroll: true });
    if (el && caret && typeof el.setSelectionRange === 'function') el.setSelectionRange(...caret);
  }

  // What the card shows, read from the sensors; null when nothing changed since the last render, or the card is hidden.
  _prepare() {
    if (!this._config || !this._hass || !this.shadowRoot) return null;
    const c = this._config;
    const ids = this._lookup();
    this._ids = ids;
    const states = this._hass.states;
    // Without its list (unavailable or restored while the integration is not loaded), the sensor says nothing.
    const sensorSt = ids.orphans && states[ids.orphans];
    const st = Array.isArray(sensorSt?.attributes?.entities) ? sensorSt : null;
    const scanSt = ids.last_scan && states[ids.last_scan];

    const minute = Math.floor(Date.now() / 60000);
    this._sigMinute = minute;
    // Only administrators can remove or ignore entities (admin actions), or open Settings.
    this._admin = this._hass.user?.is_admin === true;
    const ui = [this._q, this._platform, this._reason, [...this._sel], [...this._dsel], [...this._open], this._showAll, this._confirm, this._busy, this._zoomed];
    const sig = JSON.stringify([c, oeLang(this._hass, c), ids, sensorSt, scanSt, minute, this._admin, ui]);
    if (sig === this._sig) return null;
    this._sig = sig;

    const items = st ? st.attributes.entities.filter((i) => i && typeof i.entity_id === 'string') : [];
    // The sensor's state is unknown until the first scan (Home Assistant starting, grace period).
    const scanned = !!st && !['unknown', 'unavailable'].includes(sensorSt.state);
    const level = !st ? 'na' : !scanned ? 'idle' : items.length ? 'warn' : 'ok';

    const hidden = c.hide_when_empty && scanned && !items.length && !this._editMode && !this._preview;
    this._setHidden(hidden);
    if (hidden) return null;

    // The selection only keeps what is still listed; a filter on a vanished integration is dropped.
    const listed = new Set(items.map((i) => i.entity_id));
    for (const id of this._sel) if (!listed.has(id)) this._sel.delete(id);
    const devs = new Set((Array.isArray(st?.attributes?.devices) ? st.attributes.devices : []).map((d) => d?.device_id));
    for (const id of this._dsel) if (!devs.has(id)) this._dsel.delete(id);
    // The "Used by" lists open on entity and device rows.
    for (const id of this._open) if (!listed.has(id) && !devs.has(id)) this._open.delete(id);
    if (this._platform && !items.some((i) => i.platform === this._platform)) this._platform = '';
    if (this._reason && !items.some((i) => i.reason === this._reason)) this._reason = '';

    const shown = oeFilter(items, { q: this._q, platform: this._platform, reason: this._reason });
    const max = Math.min(OE_MAX_ROWS, Math.max(1, Number(c.max_rows) || OE_DEFAULTS.max_rows));
    const visible = this._showAll ? shown : shown.slice(0, max);
    this._rows = visible.length;
    const scannedAt = scanSt && !['unknown', 'unavailable'].includes(scanSt.state) ? scanSt.state : null;
    return { st, scanned, items, shown, visible, level, scannedAt };
  }

  _badgeIcon() {
    return 'mdi:broom';
  }

  _draw(m) {
    const { st, scanned, items, shown, visible, level, scannedAt } = m;
    const c = this._config;
    const subtitle = !st ? '' : scannedAt ? this._t('scanned', { d: this._ago(scannedAt) }) : this._t('never_scanned');
    const a = st?.attributes || {};
    const ignored = (a.ignored_integrations?.length || 0) + (a.ignored_entities?.length || 0);
    this.shadowRoot.innerHTML = `
      <style>${this.constructor.styles}</style>
      <ha-card class="lvl-${level}${this._confirm ? ' dlg-open' : ''}">
        ${this._header(subtitle, scannedAt, items, scanned)}
        ${c.show_stats && scanned ? this._stats(items.length, Number(a.removed) || 0, ignored, a) : ''}
        ${scanned && items.length && c.show_filters ? this._filters(items) : ''}
        ${scanned ? this._list(items, shown, visible) : ''}
        ${scanned && Number(a.truncated) > 0 ? `<div class="empty trunc">${oeEsc(this._t('truncated', { n: Number(a.truncated) }))}</div>` : ''}
        ${scanned ? this._devices(a.devices, Number(a.devices_truncated) || 0) : ''}
        ${this._confirm ? this._dialog() : ''}
      </ha-card>`;
  }

  _header(subtitle, scannedAt, items, scanned) {
    return `<div class="head">
          <div class="badge"><ha-icon icon="${this._badgeIcon()}"></ha-icon></div>
          <div class="heading">
            <div class="title">${oeEsc(this._config.title || this._t('title'))}</div>
            ${subtitle ? `<div class="subtitle" title="${oeEsc(scannedAt ? this._absolute(scannedAt) : '')}">${oeEsc(subtitle)}</div>` : ''}
          </div>
          ${this._scanButton()}
          ${this._pill(this._status(items, scanned))}
          ${this._headExtra()}
        </div>`;
  }

  _bind() {
    const root = this.shadowRoot;
    const on = (sel, type, fn) => {
      for (const el of root.querySelectorAll(sel)) el.addEventListener(type, (ev) => fn(el, ev));
    };
    root.querySelector('.scan')?.addEventListener('click', () => this._scan());
    on('input.q', 'input', (el) => {
      this._q = el.value;
      this._showAll = false;
      this._render();
    });
    on('select.platform', 'change', (el) => {
      this._platform = el.value;
      this._showAll = false;
      this._render();
    });
    on('.chip[data-reason]', 'click', (el) => {
      this._reason = el.dataset.reason;
      this._showAll = false;
      this._render();
    });
    on('.row[data-id]', 'click', (el) => this._toggle(el.dataset.id));
    on('.row[data-dev]', 'click', (el) => this._toggle(el.dataset.dev, this._dsel));
    on('.used[data-used]', 'click', (el) => {
      const id = el.dataset.used;
      if (this._open.has(id)) this._open.delete(id);
      else this._open.add(id);
      this._render();
    });
    // An editor page or a dashboard: opened in Home Assistant's frontend, without reloading the page.
    on('.refs a[data-nav]', 'click', (el, ev) => {
      if (ev.ctrlKey || ev.metaKey || ev.shiftKey || ev.button) return;
      ev.preventDefault();
      window.history.pushState(null, '', el.dataset.nav);
      window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
    });
    on('.all', 'click', () => this._toggleAll());
    on('.more', 'click', () => {
      this._showAll = true;
      this._render();
    });
    on('.act[data-act]', 'click', (el) => {
      const act = el.dataset.act;
      if (act === 'clear') this._sel.clear();
      else if (act === 'clear_devices') this._dsel.clear();
      else this._confirm = act;
      this._render();
    });
    on('.dlg [data-dlg]', 'click', (el) => (el.dataset.dlg === 'ok' ? this._run() : this._cancel()));
    on('.scrim', 'click', () => this._cancel());
    // A brand image that doesn't exist (custom integration without a brand) falls back to the generic icon.
    for (const img of root.querySelectorAll('img.brand')) {
      img.addEventListener('error', () => img.parentElement?.classList.add('nobrand'), { once: true });
    }
  }

  _cancel() {
    this._confirm = null;
    this._render();
  }

  _toggle(id, set = this._sel) {
    if (!this._admin || !id) return;
    if (set.has(id)) set.delete(id);
    else set.add(id);
    this._render();
  }

  // Selects every entity matching the filters (not only the rows shown), or clears them when all are selected.
  _toggleAll() {
    if (!this._admin) return;
    const items = this._hass.states[this._ids.orphans]?.attributes?.entities || [];
    const shown = oeFilter(items, { q: this._q, platform: this._platform, reason: this._reason }).map((i) => i.entity_id);
    const all = shown.length && shown.every((id) => this._sel.has(id));
    for (const id of shown) {
      if (all) this._sel.delete(id);
      else this._sel.add(id);
    }
    this._render();
  }

  _status(items, scanned) {
    if (!this._ids.orphans || !this._hass.states[this._ids.orphans]?.attributes?.entities) return this._t('not_loaded');
    // The mini card's header is narrow, and its chip says when the first scan is due.
    if (!scanned) return this instanceof OrphanEntitiesMiniCard ? this._t('waiting') : this._waiting();
    return items.length ? this._count('orphans', items.length) : this._t('none');
  }

  // The status pill: its text, or only its coloured dot when the header is narrow (the text stays in the tooltip
  // and for screen readers).
  _pill(text) {
    const t = oeEsc(text);
    return `<div class="pill" title="${t}"><span class="dot"></span><span class="ptxt">${t}</span></div>`;
  }

  // Added at the end of the header by the mini card (its detail button).
  _headExtra() {
    return '';
  }

  _scanButton() {
    if (!this._config.scan_button || !this._ids.button) return '';
    const label = oeEsc(this._t('scan_now'));
    return `<button class="scan" data-focus="scan" title="${label}" aria-label="${label}"${this._busy ? ' disabled' : ''}><ha-icon icon="mdi:refresh"></ha-icon></button>`;
  }

  _toast(message) {
    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
  }

  _fail(err) {
    this._toast(this._t('action_failed', { error: err?.message || err?.code || String(err) }));
  }

  // A failure (connection lost, button removed) is shown as a Home Assistant toast.
  async _scan() {
    if (!this._ids.button) return;
    try {
      await this._hass.callService('button', 'press', { entity_id: this._ids.button });
    } catch (err) {
      this._fail(err);
    }
  }

  // Calls an admin action of the integration and returns its response; null before Home Assistant 2025.1, whose admin
  // actions return none (the action is then called again without asking for one).
  async _call(service, data) {
    try {
      const res = await this._hass.callService(OE_DOMAIN, `orphans_${service}`, data, undefined, false, true);
      return res?.response ?? null;
    } catch (err) {
      if (err?.translation_key !== 'service_does_not_support_response' && !/response/i.test(String(err?.message || ''))) throw err;
      await this._hass.callService(OE_DOMAIN, `orphans_${service}`, data);
      return null;
    }
  }

  // "3 entities removed", then how many were kept because they are no longer orphaned since the scan.
  _removedToast(done, response) {
    const kept = Array.isArray(response?.skipped) ? response.skipped.length : 0;
    this._toast(kept ? `${done} · ${this._t('kept', { n: kept })}` : done);
  }

  // The confirmed action on the selection: remove or ignore (admin actions of the integration).
  async _run() {
    const act = this._confirm;
    if (act === 'remove_devices' || act === 'ignore_devices') return this._runDevices(act);
    const entities = [...this._sel];
    if (!entities.length || !act || this._busy) return;
    this._busy = true;
    this._confirm = null;
    this._render();
    try {
      if (act === 'remove') {
        // What was actually removed: an entity provided again since the scan is kept (`skipped`).
        const res = await this._call('remove', { entities });
        const n = Array.isArray(res?.removed) ? res.removed.length : entities.length;
        this._removedToast(this._count('removed', n), res);
      } else {
        await this._hass.callService(OE_DOMAIN, `orphans_${act}`, { entities });
        this._toast(this._count('ignored', entities.length));
      }
      for (const id of entities) this._sel.delete(id);
    } catch (err) {
      this._fail(err);
    } finally {
      this._busy = false;
      this._render();
    }
  }

  // The selected devices, or every listed one when none is selected (Remove devices only).
  _deviceTargets() {
    const listed = this._hass.states[this._ids.orphans]?.attributes?.devices || [];
    return this._dsel.size ? listed.filter((d) => this._dsel.has(d.device_id)) : listed;
  }

  async _runDevices(act) {
    const devices = this._deviceTargets().map((d) => d.device_id);
    if (!devices.length || this._busy || (act === 'ignore_devices' && !this._dsel.size)) return;
    this._busy = true;
    this._confirm = null;
    this._render();
    try {
      if (act === 'remove_devices') {
        // Without a selection, every orphan device goes, also those the sensor leaves out (`devices_truncated`).
        const res = await this._call('remove_devices', this._dsel.size ? { devices } : {});
        const n = Array.isArray(res?.removed) ? res.removed.length : devices.length;
        this._removedToast(this._t('devices_removed', { n }), res);
      } else {
        await this._hass.callService(OE_DOMAIN, 'orphans_ignore', { devices });
        this._toast(this._t('devices_ignored', { n: devices.length }));
      }
      for (const id of devices) this._dsel.delete(id);
    } catch (err) {
      this._fail(err);
    } finally {
      this._busy = false;
      this._render();
    }
  }

  _stats(orphans, removed, ignored, a) {
    const names = [...(a.ignored_integrations || []), ...(a.ignored_entities || [])].join(', ');
    const tile = (cls, value, key, title = '') =>
      `<div class="stat ${cls}"${title ? ` title="${oeEsc(title)}"` : ''}><span class="val">${oeEsc(value)}</span><span class="lbl">${oeEsc(this._t(key))}</span></div>`;
    return `<div class="stats">
          ${tile(orphans ? 'warn' : '', orphans, 'stat_orphans')}
          ${tile('', removed, 'stat_removed', this._t('stat_removed_hint'))}
          ${tile('', ignored, 'stat_ignored', names)}
        </div>`;
  }

  _filters(items) {
    const counts = {};
    for (const i of items) counts[i.reason] = (counts[i.reason] || 0) + 1;
    const platforms = {};
    for (const i of items) platforms[i.platform] = (platforms[i.platform] || 0) + 1;
    const chip = (reason, label, n) =>
      `<button class="chip${this._reason === reason ? ' on' : ''}${reason ? ` ${oeKind(reason)}` : ''}" data-reason="${reason}" data-focus="r:${reason}" aria-pressed="${this._reason === reason}">${oeEsc(label)}<span class="n">${n}</span></button>`;
    const search = oeEsc(this._t('search'));
    return `<div class="filters">
          <div class="frow">
            <label class="field"><ha-icon icon="mdi:magnify"></ha-icon><input class="q" type="search" data-focus="q" placeholder="${search}" aria-label="${search}" value="${oeEsc(this._q)}"></label>
            <select class="platform" data-focus="p" aria-label="${oeEsc(this._t('all_integrations'))}">
              <option value="">${oeEsc(this._t('all_integrations'))}</option>
              ${Object.keys(platforms)
                .sort()
                .map((p) => `<option value="${oeEsc(p)}"${p === this._platform ? ' selected' : ''}>${oeEsc(p)} (${platforms[p]})</option>`)
                .join('')}
            </select>
          </div>
          <div class="chips">
            ${chip('', this._t('all'), items.length)}
            ${OE_REASONS.filter((r) => counts[r])
              .map((r) => chip(r, this._t(`reason_${r}`), counts[r]))
              .join('')}
          </div>
        </div>`;
  }

  _list(items, shown, visible) {
    if (!items.length) return `<div class="section"><div class="empty ok">${oeEsc(this._t('empty'))}</div></div>`;
    const admin = this._admin;
    const all = shown.length > 0 && shown.every((i) => this._sel.has(i.entity_id));
    const some = !all && shown.some((i) => this._sel.has(i.entity_id));
    const head = admin
      ? `<button class="all" data-focus="all" role="checkbox" aria-checked="${all ? 'true' : some ? 'mixed' : 'false'}"${shown.length ? '' : ' disabled'}>
            <span class="box${all ? ' on' : some ? ' some' : ''}"><ha-icon icon="${all ? 'mdi:check' : some ? 'mdi:minus' : ''}"></ha-icon></span>
            <span>${oeEsc(this._t('select_all', { n: shown.length }))}</span>
          </button>`
      : `<div class="stitle">${oeEsc(this._t('list_title'))}</div>`;
    const rows = visible.length ? visible.map((i) => this._row(i)).join('') : `<div class="empty">${oeEsc(this._t('no_match'))}</div>`;
    const more =
      visible.length < shown.length
        ? `<button class="more" data-focus="more">${oeEsc(this._t('show_all', { n: shown.length }))}</button>`
        : '';
    return `<div class="section">
          <div class="lhead">${head}${admin && this._sel.size ? this._actions() : ''}</div>
          <div class="list">${rows}</div>
          ${more}
        </div>`;
  }

  // Devices whose integration entries were all removed: listed under the entities. Administrators select some to
  // remove or ignore them, or remove them all.
  _devices(devices, truncated = 0) {
    const list = Array.isArray(devices) ? devices : [];
    if (!list.length) return '';
    const rows = list
      .map((d) => {
        const sub = [[d.manufacturer, d.model].filter(Boolean).join(' '), d.entities ? this._t('dev_entities', { n: d.entities }) : '']
          .filter(Boolean)
          .join(' · ');
        const body = `<span class="ic nobrand"><ha-icon icon="mdi:devices"></ha-icon></span>
            <span class="txt"><span class="name">${oeEsc(d.name)}</span>${sub ? `<span class="sub">${oeEsc(sub)}</span>` : ''}</span>`;
        const on = this._dsel.has(d.device_id);
        const row = !this._admin
          ? `<div class="row alert" title="${oeEsc(d.name)}">${body}</div>`
          : `<button class="row alert${on ? ' sel' : ''}" role="checkbox" aria-checked="${on}" data-dev="${oeEsc(d.device_id)}" data-focus="v:${oeEsc(d.device_id)}" title="${oeEsc(d.name)}">
            <span class="box${on ? ' on' : ''}"><ha-icon icon="${on ? 'mdi:check' : ''}"></ha-icon></span>${body}
          </button>`;
        // Automations and scripts with device triggers, conditions or actions on it.
        const uses = oeUses(d);
        return uses.length ? this._used(d.device_id, row, uses) : row;
      })
      .join('');
    const btn = (act, icon, cls, key = act) => {
      const label = oeEsc(this._t(key));
      return `<button class="act ${cls}" data-act="${act}" data-focus="a:${act}" title="${label}" aria-label="${label}"${this._busy ? ' disabled' : ''}><ha-icon icon="${icon}"></ha-icon><span>${cls === 'icon' ? '' : label}</span></button>`;
    };
    let actions = '';
    if (this._admin && this._dsel.size) {
      actions = `<div class="bar">${btn('ignore_devices', 'mdi:eye-off-outline', 'neutral', 'ignore')}${btn('remove_devices', 'mdi:delete-outline', 'danger')}${btn('clear_devices', 'mdi:close', 'icon', 'clear')}</div>`;
    } else if (this._admin) {
      actions = btn('remove_devices', 'mdi:delete-outline', 'danger');
    }
    const count = this._dsel.size ? `${this._dsel.size}/${list.length}` : list.length;
    return `<div class="section devs">
          <div class="lhead"><div class="stitle" title="${oeEsc(this._t('devices_hint'))}">${oeEsc(this._t('devices_title'))} · ${count}</div>${actions}</div>
          <div class="list">${rows}</div>
          ${truncated > 0 ? `<div class="empty trunc">${oeEsc(this._t('devices_truncated', { n: truncated }))}</div>` : ''}
        </div>`;
  }

  _row(i) {
    const kind = oeKind(i.reason);
    const label = this._t(`reason_${i.reason}`);
    const sub = [i.entity_id, i.device || i.entry_title, i.disabled ? this._t('disabled') : ''].filter(Boolean).join(' · ');
    const since = i.since ? this._t('for', { d: this._duration(oeMinutes(i.since)) }) : '';
    const title = [`${i.name} (${i.entity_id})`, i.platform, label, i.since ? this._absolute(i.since) : ''].filter(Boolean).join(' — ');
    const body = `
            ${this._brand(i.platform, OE_REASON_ICONS[i.reason] || 'mdi:ghost-outline')}
            <span class="txt">
              <span class="name">${oeEsc(i.name)}</span>
              <span class="sub">${oeEsc(sub)}</span>
            </span>
            <span class="when">
              <span class="lbl">${oeEsc(label)}</span>
              ${since ? `<span class="ago">${oeEsc(since)}</span>` : ''}
            </span>`;
    const on = this._sel.has(i.entity_id);
    const row = !this._admin
      ? `<div class="row ${kind}" title="${oeEsc(title)}">${body}</div>`
      : `<button class="row ${kind}${on ? ' sel' : ''}" role="checkbox" aria-checked="${on}" data-id="${oeEsc(i.entity_id)}" data-focus="e:${oeEsc(i.entity_id)}" title="${oeEsc(title)}">
            <span class="box${on ? ' on' : ''}"><ha-icon icon="${on ? 'mdi:check' : ''}"></ha-icon></span>${body}
          </button>`;
    const uses = oeUses(i);
    return uses.length ? this._used(i.entity_id, row, uses) : row;
  }

  // A row still used by something: its "Used by N" badge (the list in its tooltip) opens the list under the row,
  // each with a link to its editor page or dashboard when it has one.
  _used(id, row, uses) {
    const open = this._open.has(id);
    const kind = (r) => this._t(`ref_${r.type}`);
    const tip = uses.map((r) => `${kind(r)}: ${r.name}`).join('\n');
    const label = this._t('used_by', { n: uses.length });
    const refs = uses
      .map((r) => {
        const name = oeEsc(r.name);
        const path = typeof r.path === 'string' && r.path.startsWith('/') ? r.path : '';
        const link = path ? `<a href="${oeEsc(path)}" data-nav="${oeEsc(path)}">${name}</a>` : `<span class="rn">${name}</span>`;
        return `<li><ha-icon icon="${OE_REF_ICONS[r.type] || 'mdi:link-variant'}"></ha-icon><span class="rk">${oeEsc(kind(r))}</span>${link}</li>`;
      })
      .join('');
    return `<div class="item">${row}<button class="used" data-used="${oeEsc(id)}" data-focus="u:${oeEsc(id)}" aria-expanded="${open}" title="${oeEsc(tip)}"><ha-icon icon="mdi:link-variant"></ha-icon><span>${oeEsc(label)}</span></button>${open ? `<ul class="refs">${refs}</ul>` : ''}</div>`;
  }

  // Above the list while entities are selected: their count, then Ignore, Remove and clear.
  _actions() {
    const btn = (act, icon, cls) => {
      const label = oeEsc(this._t(act));
      return `<button class="act ${cls}" data-act="${act}" data-focus="a:${act}" title="${label}" aria-label="${label}"${this._busy ? ' disabled' : ''}><ha-icon icon="${icon}"></ha-icon><span>${act === 'clear' ? '' : label}</span></button>`;
    };
    return `<div class="bar">
          <span class="count">${oeEsc(this._count('selected', this._sel.size))}</span>
          ${btn('ignore', 'mdi:eye-off-outline', 'neutral')}
          ${btn('remove', 'mdi:delete-outline', 'danger')}
          ${btn('clear', 'mdi:close', 'icon')}
        </div>`;
  }

  // The confirmation, at the top of the card over a scrim: the action, its consequences and the first entities.
  _dialog() {
    const act = this._confirm;
    if (act === 'remove_devices' || act === 'ignore_devices') return this._devicesDialog(act);
    const ids = [...this._sel];
    const items = this._hass.states[this._ids.orphans]?.attributes?.entities || [];
    const byId = new Map(items.map((i) => [i.entity_id, i]));
    const remove = act === 'remove';
    // The selected entities still in use come first: they are the ones to look at before removing.
    const uses = (id) => oeUses(byId.get(id)).length;
    if (remove) ids.sort((a, b) => (uses(b) > 0) - (uses(a) > 0));
    const used = remove ? ids.filter((id) => uses(id)).length : 0;
    const first = ids.slice(0, 5).map((id) => {
      const n = remove ? uses(id) : 0;
      const badge = n ? ` <span class="ub">${oeEsc(this._t('used_by', { n }))}</span>` : '';
      return `<li><span class="name">${oeEsc(byId.get(id)?.name || id)}</span> <span class="sub">${oeEsc(id)}</span>${badge}</li>`;
    });
    if (ids.length > 5) first.push(`<li class="sub">${oeEsc(this._t('and_more', { n: ids.length - 5 }))}</li>`);
    const warn = used ? `<div class="dw"><ha-icon icon="mdi:alert-outline"></ha-icon><span>${oeEsc(this._count('confirm_used', used))}</span></div>` : '';
    return `<div class="scrim"></div>
        <div class="dlg ${remove ? 'danger' : 'neutral'}" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
          <div class="dt" id="dlg-t">${oeEsc(this._count(remove ? 'confirm_remove' : 'confirm_ignore', ids.length))}</div>
          <div class="dx">${oeEsc(this._t(remove ? 'confirm_remove_text' : 'confirm_ignore_text'))}</div>
          ${warn}
          <ul>${first.join('')}</ul>
          <div class="db">
            <button class="act icon-text" data-dlg="cancel" data-focus="d:cancel">${oeEsc(this._t('cancel'))}</button>
            <button class="act ${remove ? 'danger' : 'neutral'}" data-dlg="ok" data-focus="d:ok"><ha-icon icon="${remove ? 'mdi:delete-outline' : 'mdi:eye-off-outline'}"></ha-icon><span>${oeEsc(this._t(used ? 'remove_anyway' : act))}</span></button>
          </div>
        </div>`;
  }

  _devicesDialog(act) {
    const devices = [...this._deviceTargets()];
    const remove = act === 'remove_devices';
    // Removing them all also removes those the sensor leaves out.
    const total = devices.length + (remove && !this._dsel.size ? Number(this._hass.states[this._ids.orphans]?.attributes?.devices_truncated) || 0 : 0);
    // The devices still used by automations or scripts come first.
    const uses = (d) => (remove ? oeUses(d).length : 0);
    devices.sort((a, b) => (uses(b) > 0) - (uses(a) > 0));
    const used = devices.filter((d) => uses(d)).length;
    const first = devices.slice(0, 5).map((d) => {
      const n = uses(d);
      const badge = n ? ` <span class="ub">${oeEsc(this._t('used_by', { n }))}</span>` : '';
      return `<li><span class="name">${oeEsc(d.name)}</span> <span class="sub">${oeEsc([d.manufacturer, d.model].filter(Boolean).join(' '))}</span>${badge}</li>`;
    });
    if (total > 5) first.push(`<li class="sub">${oeEsc(this._t('and_more', { n: total - 5 }))}</li>`);
    const warn = used ? `<div class="dw"><ha-icon icon="mdi:alert-outline"></ha-icon><span>${oeEsc(this._t('confirm_devices_used', { n: used }))}</span></div>` : '';
    return `<div class="scrim"></div>
        <div class="dlg ${remove ? 'danger' : 'neutral'}" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t">
          <div class="dt" id="dlg-t">${oeEsc(this._t(remove ? 'confirm_devices' : 'confirm_ignore_devices'))}</div>
          <div class="dx">${oeEsc(this._t(remove ? 'confirm_devices_text' : 'confirm_ignore_text'))}</div>
          ${warn}
          <ul>${first.join('')}</ul>
          <div class="db">
            <button class="act icon-text" data-dlg="cancel" data-focus="d:cancel">${oeEsc(this._t('cancel'))}</button>
            <button class="act ${remove ? 'danger' : 'neutral'}" data-dlg="ok" data-focus="d:ok"><ha-icon icon="${remove ? 'mdi:delete-outline' : 'mdi:eye-off-outline'}"></ha-icon><span>${oeEsc(this._t(remove ? (used ? 'remove_anyway' : 'remove_devices') : 'ignore'))}</span></button>
          </div>
        </div>`;
  }

  // The integration's logo from the Home Assistant brands, with the reason's icon behind it when there is none.
  _brand(domain, fallback) {
    const dark = this._hass.themes?.darkMode ? 'dark_' : '';
    const src = `https://brands.home-assistant.io/_/${encodeURIComponent(domain)}/${dark}icon.png`;
    return `<span class="ic"><img class="brand" src="${oeEsc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"><ha-icon icon="${fallback}"></ha-icon></span>`;
  }

  static get styles() {
    return `
      :host {
        display: block;
        min-width: 0;
        --oe-natural-width: 380px;
        --oe-accent: #7e57c2;
        --oe-ok: var(--success-color, #43a047);
        --oe-warn: var(--warning-color, #ffa600);
        --oe-alert: var(--error-color, #db4437);
        --oe-na: var(--disabled-color, #9e9e9e);
        /* Secondary text on the tinted tiles: nudged towards the primary text so it stays readable (WCAG AA) */
        --oe-muted: color-mix(in srgb, var(--secondary-text-color) 70%, var(--primary-text-color));
      }
      /* Width without a minimum: the card contributes no width of its own (inline-size containment), the empty
         zero-height grid gives it a natural width with a min-content width of 0 (see ha-integration-watchdog). */
      :host::before { content: ""; display: grid; grid-template-columns: minmax(0, var(--oe-natural-width)); height: 0; }
      ha-card { position: relative; padding: 12px; overflow: hidden; contain: inline-size; }
      ha-card.lvl-ok   { --c: var(--oe-ok); }
      ha-card.lvl-warn { --c: var(--oe-warn); }
      ha-card.lvl-idle { --c: var(--oe-na); }
      ha-card.lvl-na   { --c: var(--oe-na); }

      /* The header is a size container: the pill keeps only its dot when it is narrow */
      .head { display: flex; align-items: center; gap: 8px; container-type: inline-size; }
      /* The project's icon, in its accent colour whatever the status (the pill tells it) */
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--oe-accent) 16%, transparent); color: var(--oe-accent); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      /* The title keeps at least 45 % of the header (a few words), the pill takes at most 60 % and wraps on two
         lines before the title is cut: "En attente de la première analyse" must not leave "Orp…" on a mini card. */
      .heading { flex: 1 1 0; min-width: min(45%, 14ch); display: flex; flex-direction: column; }
      .title { font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .subtitle { font-size: 12px; line-height: 1.3; color: var(--secondary-text-color);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pill { flex: 0 1 auto; min-width: 0; max-width: 60%; display: flex; align-items: center; box-sizing: border-box;
              white-space: nowrap; overflow: hidden;
              font-size: 11px; font-weight: 500; padding: 1px 6px; border-radius: 9px;
              color: color-mix(in srgb, var(--c) 40%, var(--primary-text-color));
              background: color-mix(in srgb, var(--c) 14%, transparent); }
      .pill .ptxt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.25;
                    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
      .pill .dot { display: none; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
      /* Dot only: under 200 px, and whenever the text or the title would be cut (class compact, set by _fitPill) */
      .head .pill.compact { padding: 5px; }
      .head .pill.compact .dot { display: block; }
      .head .pill.compact .ptxt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      @container (max-width: 200px) {
        .head .pill { padding: 5px; }
        .head .pill .dot { display: block; }
        .head .pill .ptxt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      }
      @container (max-width: 140px) {
        .head .badge { display: none; }
      }
      .scan { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .scan:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .scan:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .scan[disabled] { cursor: default; opacity: .4; background: none; }
      .scan ha-icon { --mdc-icon-size: 16px; }

      .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
      .stat { --t: var(--secondary-text-color); display: flex; flex-direction: column; align-items: center; gap: 1px;
              padding: 6px 4px; border-radius: 10px; min-width: 0;
              background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .stat.warn { --t: var(--oe-warn); background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      .stat .val { font-size: 18px; font-weight: 500; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
      .stat.warn .val { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
      .stat .lbl { font-size: 11px; color: var(--oe-muted); max-width: 100%;
                   white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .filters { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
      .frow { display: flex; flex-wrap: wrap; gap: 6px; }
      .field { flex: 1 1 160px; min-width: 0; display: flex; align-items: center; gap: 4px; box-sizing: border-box;
               height: 32px; padding: 0 8px; border-radius: 10px; color: var(--secondary-text-color);
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .field:focus-within { outline: 2px solid var(--primary-color); outline-offset: -2px; }
      .field ha-icon { flex: none; --mdc-icon-size: 16px; }
      .field input { all: unset; flex: 1; min-width: 0; font-size: 13px; color: var(--primary-text-color); }
      .field input::placeholder { color: var(--oe-muted); opacity: 1; }
      select.platform { flex: 0 1 180px; min-width: 0; height: 32px; box-sizing: border-box; padding: 0 6px;
                        border: 0; border-radius: 10px; font: inherit; font-size: 13px; color: var(--primary-text-color);
                        background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      select.platform:focus-visible { outline: 2px solid var(--primary-color); outline-offset: -2px; }
      .chips { display: flex; flex-wrap: wrap; gap: 4px; }
      .chip { --t: var(--primary-color); all: unset; cursor: pointer; box-sizing: border-box; display: inline-flex;
              align-items: center; gap: 4px; height: 24px; padding: 0 8px; border-radius: 999px; font-size: 12px;
              font-weight: 500; color: var(--oe-muted); white-space: nowrap;
              background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .chip.warn  { --t: var(--oe-warn); }
      .chip.alert { --t: var(--oe-alert); }
      .chip .n { font-variant-numeric: tabular-nums; opacity: .8; }
      .chip:hover { background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      .chip.on { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color));
                 background: color-mix(in srgb, var(--t) 18%, transparent); box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--t) 50%, transparent); }
      .chip:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }

      .section { margin-top: 12px; }
      .lhead { display: flex; align-items: center; margin: 0 2px 6px; }
      .devs .lhead > .act { margin-left: auto; }
      .empty.trunc { margin-top: 6px; }
      .stitle { font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
                text-transform: uppercase; letter-spacing: .04em; }
      .all { all: unset; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; padding: 2px 4px 2px 3px;
             border-radius: 8px; font-size: 12px; font-weight: 500; color: var(--secondary-text-color); }
      .all:hover { color: var(--primary-text-color); }
      .all[disabled] { cursor: default; opacity: .5; }
      .all:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .list { display: flex; flex-direction: column; gap: 6px; }
      .empty { font-size: 13px; color: var(--oe-muted); padding: 8px 10px; border-radius: 10px;
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .empty.ok { --t: var(--oe-ok); background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      .row { --t: var(--oe-warn); all: unset; box-sizing: border-box; min-width: 0;
             display: flex; align-items: center; gap: 8px; padding: 5px 10px 5px 5px; border-radius: 10px;
             background: color-mix(in srgb, var(--t) 10%, var(--secondary-background-color, transparent)); }
      .row.alert { --t: var(--oe-alert); }
      button.row { cursor: pointer; padding-left: 8px; }
      button.row:hover { background: color-mix(in srgb, var(--t) 16%, var(--secondary-background-color, transparent)); }
      button.row.sel { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--primary-color) 60%, transparent);
                       background: color-mix(in srgb, var(--primary-color) 10%, var(--secondary-background-color, transparent)); }
      .row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      /* The checkbox: an outline, ticked in the primary colour */
      .box { flex: none; width: 16px; height: 16px; box-sizing: border-box; border-radius: 4px; display: grid; place-items: center;
             border: 1.5px solid var(--secondary-text-color); color: var(--primary-color); }
      .box.on, .box.some { border-color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 16%, transparent); }
      .box ha-icon { --mdc-icon-size: 14px; }
      .ic { position: relative; flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
            color: var(--t); background: color-mix(in srgb, var(--t) 18%, transparent); overflow: hidden; }
      .ic ha-icon { --mdc-icon-size: 16px; }
      .ic img.brand { position: absolute; inset: 5px; width: 18px; height: 18px; object-fit: contain; }
      .ic:not(.nobrand) img.brand + ha-icon { visibility: hidden; }
      .ic.nobrand img.brand { display: none; }
      .txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .name { font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--primary-text-color);
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub { font-size: 11px; line-height: 1.2; color: var(--oe-muted);
             white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* The reason and how long, on the right: they shrink (up to 40% of the row) before the name does */
      .when { flex: 0 1 auto; min-width: 0; max-width: 40%; display: flex; flex-direction: column; align-items: flex-end; }
      .when > span { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .when .lbl { font-size: 12px; font-weight: 500; line-height: 1.2; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
      .when .ago { font-size: 11px; line-height: 1.2; color: var(--oe-muted); }
      /* A row still in use: its "Used by N" badge (orange, tinted) at its right, its list under it when open */
      .item { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-width: 0; }
      .item > .row { flex: 1 1 0; }
      .used { --t: var(--oe-warn); all: unset; cursor: pointer; flex: none; box-sizing: border-box; display: inline-flex;
              align-items: center; gap: 3px; height: 24px; padding: 0 8px; border-radius: 12px; font-size: 11px; font-weight: 500;
              white-space: nowrap; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color));
              background: color-mix(in srgb, var(--t) 16%, transparent); }
      .used:hover { background: color-mix(in srgb, var(--t) 24%, transparent); }
      .used:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .used ha-icon { --mdc-icon-size: 14px; }
      .used[aria-expanded="true"] { box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--t) 50%, transparent); }
      .refs { --t: var(--oe-warn); flex: 1 0 100%; box-sizing: border-box; margin: 0; padding: 6px 10px; list-style: none;
              display: flex; flex-direction: column; gap: 4px; border-radius: 10px; font-size: 12px;
              background: color-mix(in srgb, var(--t) 6%, var(--secondary-background-color, transparent)); }
      .refs li { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .refs ha-icon { flex: none; --mdc-icon-size: 14px; color: var(--secondary-text-color); }
      .refs .rk { flex: none; color: var(--oe-muted); }
      .refs a, .refs .rn { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500; }
      .refs .rn { color: var(--primary-text-color); }
      .refs a { color: color-mix(in srgb, var(--primary-color) 45%, var(--primary-text-color)); text-decoration: underline; text-underline-offset: 2px; }
      .refs a:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 1px; border-radius: 2px; }
      .more { all: unset; cursor: pointer; display: block; box-sizing: border-box; width: 100%; margin-top: 6px; padding: 6px;
              border-radius: 10px; text-align: center; font-size: 12px; font-weight: 500; color: var(--primary-color);
              background: color-mix(in srgb, var(--primary-color) 8%, transparent); }
      .more:hover { background: color-mix(in srgb, var(--primary-color) 14%, transparent); }
      .more:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }

      /* The selection's actions, at the right of "Select all": they wrap under it on a narrow card */
      .lhead { flex-wrap: wrap; gap: 6px; }
      .bar { margin-left: auto; display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 4px; min-width: 0; }
      .bar .count { min-width: 0; padding-right: 2px; font-size: 12px; font-weight: 500; color: var(--primary-text-color);
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* Buttons are tinted, never filled */
      .act { --t: var(--secondary-text-color); all: unset; cursor: pointer; box-sizing: border-box; display: inline-flex;
             align-items: center; gap: 4px; height: 28px; padding: 0 10px; border-radius: 14px; font-size: 12px; font-weight: 500;
             white-space: nowrap; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color));
             background: color-mix(in srgb, var(--t) 14%, transparent); }
      .act.danger { --t: var(--oe-alert); }
      .act.neutral { --t: var(--primary-color); }
      .act.icon { width: 28px; padding: 0; justify-content: center; background: none; color: var(--secondary-text-color); }
      .act.icon span:empty { display: none; }
      .act.icon-text { background: none; color: var(--secondary-text-color); }
      .act:hover { background: color-mix(in srgb, var(--t) 22%, transparent); }
      .act[disabled] { cursor: default; opacity: .5; }
      .act:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .act ha-icon { --mdc-icon-size: 16px; }

      /* Confirmation at the top of the card, over a scrim covering the card */
      ha-card.dlg-open { min-height: 240px; }
      .scrim { position: absolute; inset: 0; background: rgba(0,0,0,.32); }
      .dlg { --t: var(--oe-alert); position: absolute; top: 8px; left: 8px; right: 8px; box-sizing: border-box; padding: 14px;
             border-radius: 14px; background: var(--card-background-color, var(--ha-card-background, #fff));
             border: 1px solid var(--divider-color, rgba(127,127,127,.2)); box-shadow: 0 4px 18px rgba(0,0,0,.28); }
      .dlg.neutral { --t: var(--primary-color); }
      .dlg .dt { font-size: 15px; font-weight: 500; color: var(--primary-text-color); }
      .dlg .dx { margin-top: 4px; font-size: 12px; line-height: 1.4; color: var(--oe-muted); }
      .dlg ul { margin: 8px 0 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 2px; }
      .dlg li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; }
      .dlg li .name { display: inline; font-size: 12px; }
      .db { display: flex; justify-content: flex-end; gap: 6px; margin-top: 12px; }
      .dlg .dw { --t: var(--oe-warn); margin-top: 8px; padding: 6px 8px; border-radius: 10px; display: flex; align-items: flex-start; gap: 6px;
                 font-size: 12px; line-height: 1.4; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color));
                 background: color-mix(in srgb, var(--t) 14%, transparent); }
      .dlg .dw ha-icon { flex: none; --mdc-icon-size: 16px; }
      .dlg .ub { --t: var(--oe-warn); font-size: 11px; font-weight: 500; padding: 0 6px; border-radius: 8px;
                 color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); background: color-mix(in srgb, var(--t) 16%, transparent); }
    `;
  }
}

// ── Mini card ────────────────────────────────────────────────────────────────
// orphan-entities-mini-card: the status on two lines — the badge, title and status pill, then a chip per reason
// (with its count) and the time of the last scan. Its detail button (top right, `zoom: false` removes it) switches it
// to the full card and back, as does a click anywhere else, unless it lands in a dialog opened from the card. A
// reason's chip opens the full card filtered on that reason.
class OrphanEntitiesMiniCard extends OrphanEntitiesCard {
  static getConfigElement() {
    return document.createElement('sh-orphans-mini-card-editor');
  }

  constructor() {
    super();
    this._zoomed = false;
    this._onUnzoom = (ev) => {
      const path = ev.composedPath();
      if (!this._zoomed || path.includes(this)) return;
      if (path.some((n) => ['ha-more-info-dialog', 'ha-dialog', 'dialog'].includes(n.localName))) return;
      this._zoomed = false;
      this._confirm = null;
      this._render();
    };
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._onUnzoom, true);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onUnzoom, true);
  }

  setConfig(config) {
    if (config?.zoom != null && typeof config.zoom !== 'boolean') throw new Error('zoom must be true or false');
    super.setConfig(config);
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : 2;
  }

  getGridOptions() {
    return { columns: 6, min_columns: 6, rows: 'auto' };
  }

  _badgeIcon() {
    return 'mdi:ghost-outline';
  }

  _headExtra() {
    if (this._config.zoom === false) return '';
    const label = oeEsc(this._t(this._zoomed ? 'zoom_out' : 'zoom_in'));
    const icon = this._zoomed ? 'mdi:arrow-collapse' : 'mdi:arrow-expand';
    return `<button class="zoom" data-focus="zoom" title="${label}" aria-label="${label}" aria-expanded="${this._zoomed}"><ha-icon icon="${icon}"></ha-icon></button>`;
  }

  _draw(m) {
    if (this._zoomed) {
      super._draw(m);
      return;
    }
    const { items, scanned, level, scannedAt } = m;
    this.shadowRoot.innerHTML = `
      <style>${this.constructor.styles}</style>
      <ha-card class="lvl-${level}">
        <div class="mini">
          <div class="badge"><ha-icon icon="${this._badgeIcon()}"></ha-icon></div>
          <div class="body">
            <div class="head">
              <div class="heading"><div class="title">${oeEsc(this._config.title || this._t('title'))}</div></div>
              ${this._scanButton()}
              ${this._pill(this._status(items, scanned))}
              ${this._headExtra()}
            </div>
            <div class="rs">${m.st ? this._chips(items, scanned, scannedAt) : ''}</div>
          </div>
        </div>
      </ha-card>`;
  }

  _zoom(on, reason) {
    this._zoomed = on;
    if (reason != null) {
      this._reason = reason;
      this._showAll = false;
    }
    if (!on) this._confirm = null;
    this._render();
  }

  _bind() {
    super._bind();
    this.shadowRoot.querySelector('.zoom')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._zoom(!this._zoomed);
      // The button was replaced: keyboard use (Enter / Space, no click count) keeps the focus on the new one.
      if (ev.detail === 0) this.shadowRoot.querySelector('.zoom')?.focus({ preventScroll: true });
    });
    for (const el of this.shadowRoot.querySelectorAll('.r')) {
      el.addEventListener('click', (ev) => {
        if (el.dataset.zoom != null && this._config.zoom !== false) {
          ev.stopPropagation();
          this._zoom(true, el.dataset.zoom);
        } else if (el.dataset.entity) {
          this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true }));
        }
      });
    }
  }

  _chip(cls, icon, text, title, focus, attrs) {
    return `<button class="r ${cls}" ${attrs} data-focus="${oeEsc(focus)}" title="${oeEsc(title)}"><ha-icon icon="${icon}"></ha-icon><span class="rt">${oeEsc(text)}</span></button>`;
  }

  _chips(items, scanned, scannedAt) {
    const ids = this._ids;
    const sensor = `data-entity="${oeEsc(ids.orphans)}"`;
    const counts = {};
    for (const i of items) counts[i.reason] = (counts[i.reason] || 0) + 1;
    // One tinted chip per reason: no longer provided in red, stale in orange. It opens the filtered full card.
    const chips = OE_REASONS.filter((r) => counts[r]).map((r) => {
      const label = `${this._t(`reason_${r}`)} · ${counts[r]}`;
      return this._chip(`${oeKind(r)} pill`, OE_REASON_ICONS[r], label, label, `m:${r}`, `data-zoom="${r}" ${sensor}`);
    });
    if (scanned && !items.length) chips.push(this._chip('ok', 'mdi:check-circle', this._t('none'), this._t('empty'), 'm:ok', sensor));
    // The mini card is narrow: while waiting the chip only says when ("in 10 minutes"), the full status is its tooltip.
    const due = scanned ? '' : this._in(this._hass.states[ids.orphans]?.attributes?.next_scan);
    const text = scannedAt ? this._t('scanned', { d: this._ago(scannedAt) }) : scanned ? this._t('never_scanned') : due || this._t('waiting');
    const tip = scannedAt ? this._absolute(scannedAt) : due ? this._waiting() : text;
    chips.push(this._chip('idle', 'mdi:clock-check-outline', text, tip, 'm:s', ids.last_scan ? `data-entity="${oeEsc(ids.last_scan)}"` : ''));
    return chips.join('');
  }

  static get styles() {
    return `${OrphanEntitiesCard.styles}
      :host { --oe-natural-width: 300px; }
      /* Badge, then the two lines; the badge keeps the full card's size (40 px), top-aligned */
      .mini { display: flex; align-items: flex-start; gap: 10px; container-type: inline-size; }
      .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .mini .head { min-height: 40px; }
      .rs { display: flex; flex-wrap: wrap; gap: 2px 4px; margin-left: -4px; }
      .rs:empty { display: none; }
      .r { --t: var(--secondary-text-color); all: unset; box-sizing: border-box; cursor: pointer;
           display: inline-flex; align-items: center; gap: 3px; max-width: 100%; min-width: 0;
           padding: 0 6px 0 4px; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 18px;
           white-space: nowrap; color: var(--primary-text-color); }
      .r.ok    { --t: var(--oe-ok); }
      .r.warn  { --t: var(--oe-warn); }
      .r.alert { --t: var(--oe-alert); }
      .r.idle  { color: var(--oe-muted); }
      .r ha-icon { flex: none; display: inline-flex; --mdc-icon-size: 13px; color: var(--t); }
      .r .rt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .r.pill { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); background: color-mix(in srgb, var(--t) 14%, transparent); }
      .r:hover { background: color-mix(in srgb, var(--t) 16%, var(--secondary-background-color, transparent)); }
      .r.pill:hover { background: color-mix(in srgb, var(--t) 22%, transparent); }
      .r:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .zoom { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .zoom ha-icon { --mdc-icon-size: 16px; }
      @container (max-width: 150px) {
        .mini > .badge { display: none; }
        .mini .head { gap: 4px; }
      }
    `;
  }
}

// ── Editor ───────────────────────────────────────────────────────────────────
const OE_HELPERS = ['entity', 'title', 'show_stats', 'show_filters', 'max_rows', 'scan_button', 'zoom', 'hide_when_empty', 'language'];

class OrphanEntitiesCardEditor extends HTMLElement {
  static get DEFAULTS() {
    return OE_DEFAULTS;
  }

  // Fields shown after the "Scan now" button: the mini card adds its detail button there.
  _extraFields() {
    return [];
  }

  setConfig(config) {
    this._config = config;
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  _update() {
    if (!this._hass || !this._config) return;
    if (!this._form) {
      this._form = document.createElement('ha-form');
      const t = (key) => oeT(oeLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (OE_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
      this._form.addEventListener('value-changed', (ev) => {
        const config = { ...ev.detail.value };
        // Options left at their default are not written to the YAML.
        for (const k of Object.keys(config)) {
          if (config[k] === '' || config[k] == null || this.constructor.DEFAULTS[k] === config[k]) delete config[k];
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const c = this._config;
    const lang = oeLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    if (this._deps && this._deps.config === c && this._deps.lang === lang) return;
    this._deps = { config: c, lang };
    this._form.data = { ...this.constructor.DEFAULTS, ...c };
    this._form.schema = [
      { name: 'entity', selector: { entity: { filter: { integration: OE_DOMAIN, domain: 'sensor' } } } },
      { name: 'title', selector: { text: {} } },
      { name: 'show_stats', selector: { boolean: {} } },
      { name: 'show_filters', selector: { boolean: {} } },
      { name: 'max_rows', selector: { number: { min: 1, max: OE_MAX_ROWS, mode: 'box' } } },
      { name: 'scan_button', selector: { boolean: {} } },
      ...this._extraFields(),
      { name: 'hide_when_empty', selector: { boolean: {} } },
      { name: 'language', selector: { select: { mode: 'dropdown', options: OE_LANGS.map(([value, label]) => ({ value, label })) } } },
    ];
  }
}

// The mini card's editor: the full card's options (its detail view), plus the detail button.
class OrphanEntitiesMiniCardEditor extends OrphanEntitiesCardEditor {
  static get DEFAULTS() {
    return { ...OE_DEFAULTS, zoom: true };
  }

  _extraFields() {
    return [{ name: 'zoom', selector: { boolean: {} } }];
  }
}

// Each card is registered on its own: a page that already loaded an older copy of this file still gets the other.
window.systemHubCards = window.systemHubCards || [];
if (!customElements.get('sh-orphans-card')) {
  customElements.define('sh-orphans-card', OrphanEntitiesCard);
  customElements.define('sh-orphans-card-editor', OrphanEntitiesCardEditor);
  window.systemHubCards.push({
    type: 'sh-orphans-card',
    name: 'Orphan Entities Card',
    description: 'The entities their integration no longer provides: filter, select and remove them in bulk',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub#orphans',
  });
  console.info(`%c ORPHAN-ENTITIES-CARD %c v${ORPHAN_ENTITIES_CARD_VERSION} `, 'background:#7e57c2;color:#fff;font-weight:700', '');
}
if (!customElements.get('sh-orphans-mini-card')) {
  customElements.define('sh-orphans-mini-card', OrphanEntitiesMiniCard);
  customElements.define('sh-orphans-mini-card-editor', OrphanEntitiesMiniCardEditor);
  window.systemHubCards.push({
    type: 'sh-orphans-mini-card',
    name: 'Orphan Entities Mini Card',
    description: 'Orphaned entities by reason on two lines, with a detail button showing the full card',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub#orphans',
  });
}
