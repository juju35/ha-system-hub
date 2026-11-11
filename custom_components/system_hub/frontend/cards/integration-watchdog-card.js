/**
 * integration-watchdog-card — the overall status of System Hub's Watchdog module: the integrations whose entities are
 * all unavailable, and the recent reloads (with the failed ones and the integrations given up). Ported from Integration
 * Watchdog, under the same card types so that existing dashboards keep working.
 * Served and added to the dashboard resources by System Hub.
 * https://github.com/juju35/ha-system-hub
 */
var INTEGRATION_WATCHDOG_CARD_VERSION = '1.3.1';

const IW_I18N = {
  en: {
    title: 'Watchdog',
    all_ok: 'All available',
    unavailable_one: '{n} unavailable',
    unavailable_many: '{n} unavailable',
    gave_up_one: '{n} given up',
    gave_up_many: '{n} given up',
    checking: 'Checking…',
    not_loaded: 'Not set up',
    never_checked: 'Not checked yet',
    checked: 'Checked {d}',
    check_now: 'Check now',
    check_failed: 'Check failed: {error}',
    retry: 'Try again',
    retry_failed: 'Try again failed: {error}',
    stat_unavailable: 'Unavailable',
    stat_reloads: 'Reloads',
    stat_reloads_hint: 'Since Home Assistant started',
    stat_ignored: 'Ignored',
    unavailable_title: 'Unavailable integrations',
    history_title: 'Recent reloads',
    no_history: 'No reload yet',
    since: 'unavailable for {d}',
    attempts: '{n}/{max} reloads',
    attempt: 'reload {n}/{max}',
    waiting: 'Grace period',
    gave_up: 'Given up',
    reloaded: 'Reloaded',
    reload_failed: 'Failed',
    gave_up_event: 'Given up',
    gave_up_after: 'after {n} reloads',
    power_cycled: 'Power cycled',
    power_cycle_failed: 'Power cycle failed',
    cycle_attempt: 'power cycle {n}/{max}',
    cycle_gave_up_after: 'after {n} power cycles',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Watchdog sensor',
    ed_entity_helper: 'Unavailable integrations sensor; leave empty to find it automatically',
    ed_title: 'Title',
    ed_title_helper: 'Leave empty for “Watchdog”',
    ed_show_stats: 'Summary',
    ed_show_stats_helper: 'Unavailable, reloads since start and ignored integrations',
    ed_show_unavailable: 'Unavailable integrations',
    ed_show_unavailable_helper: 'The integrations whose entities are all unavailable, with their reloads',
    ed_show_history: 'Recent reloads',
    ed_show_history_helper: 'The last reloads, failed reloads and integrations given up',
    ed_history_count: 'Reloads shown',
    ed_check_button: '“Check now” button',
    ed_check_button_helper: 'Runs a check from the header, for every user who sees the card',
    ed_hide_when_ok: 'Hide the card when everything is available',
    ed_hide_when_ok_helper: 'The card only appears when an integration is unavailable',
    zoom_in: 'Show details',
    zoom_out: 'Back to the compact view',
    ed_zoom: 'Detail button',
    ed_zoom_helper: 'Switches to the full card and back',
    ed_language: 'Language',
    ed_language_helper: 'Leave empty to follow Home Assistant',
  },
  fr: {
    title: 'Watchdog',
    all_ok: 'Tout est disponible',
    unavailable_one: '{n} indisponible',
    unavailable_many: '{n} indisponibles',
    gave_up_one: '{n} abandonnée',
    gave_up_many: '{n} abandonnées',
    checking: 'Vérification…',
    not_loaded: 'Non configuré',
    never_checked: 'Pas encore vérifié',
    checked: 'Vérifié {d}',
    check_now: 'Vérifier maintenant',
    check_failed: 'Échec de la vérification : {error}',
    retry: 'Réessayer',
    retry_failed: 'Échec de la nouvelle tentative : {error}',
    stat_unavailable: 'Indisponibles',
    stat_reloads: 'Rechargements',
    stat_reloads_hint: 'Depuis le démarrage de Home Assistant',
    stat_ignored: 'Ignorées',
    unavailable_title: 'Intégrations indisponibles',
    history_title: 'Derniers rechargements',
    no_history: 'Aucun rechargement pour l’instant',
    since: 'indisponible depuis {d}',
    attempts: '{n}/{max} rechargements',
    attempt: 'rechargement {n}/{max}',
    waiting: 'Délai de grâce',
    gave_up: 'Abandonnée',
    reloaded: 'Rechargée',
    reload_failed: 'Échec',
    gave_up_event: 'Abandon',
    gave_up_after: 'après {n} rechargements',
    power_cycled: 'Redémarré par la prise',
    power_cycle_failed: 'Échec du redémarrage',
    cycle_attempt: 'redémarrage {n}/{max}',
    cycle_gave_up_after: 'après {n} redémarrages',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} j',
    ed_entity: 'Capteur Watchdog',
    ed_entity_helper: 'Capteur des intégrations indisponibles ; laisser vide pour le trouver automatiquement',
    ed_title: 'Titre',
    ed_title_helper: 'Laisser vide pour « Watchdog »',
    ed_show_stats: 'Résumé',
    ed_show_stats_helper: 'Indisponibles, rechargements depuis le démarrage et intégrations ignorées',
    ed_show_unavailable: 'Intégrations indisponibles',
    ed_show_unavailable_helper: 'Les intégrations dont toutes les entités sont indisponibles, avec leurs rechargements',
    ed_show_history: 'Derniers rechargements',
    ed_show_history_helper: 'Les derniers rechargements, échecs et intégrations abandonnées',
    ed_history_count: 'Rechargements affichés',
    ed_check_button: 'Bouton « Vérifier maintenant »',
    ed_check_button_helper: 'Lance une vérification depuis l’en-tête, pour tout utilisateur qui voit la carte',
    ed_hide_when_ok: 'Masquer la carte quand tout est disponible',
    ed_hide_when_ok_helper: 'La carte n’apparaît que si une intégration est indisponible',
    zoom_in: 'Afficher le détail',
    zoom_out: 'Revenir à la vue compacte',
    ed_zoom: 'Bouton détail',
    ed_zoom_helper: 'Bascule vers la carte complète et retour',
    ed_language: 'Langue',
    ed_language_helper: 'Laisser vide pour suivre Home Assistant',
  },
  de: {
    title: 'Watchdog',
    all_ok: 'Alles verfügbar',
    unavailable_one: '{n} nicht verfügbar',
    unavailable_many: '{n} nicht verfügbar',
    gave_up_one: '{n} aufgegeben',
    gave_up_many: '{n} aufgegeben',
    checking: 'Prüfung läuft…',
    not_loaded: 'Nicht eingerichtet',
    never_checked: 'Noch nicht geprüft',
    checked: 'Geprüft {d}',
    check_now: 'Jetzt prüfen',
    check_failed: 'Prüfung fehlgeschlagen: {error}',
    retry: 'Erneut versuchen',
    retry_failed: 'Erneuter Versuch fehlgeschlagen: {error}',
    stat_unavailable: 'Nicht verfügbar',
    stat_reloads: 'Neuladungen',
    stat_reloads_hint: 'Seit dem Start von Home Assistant',
    stat_ignored: 'Ignoriert',
    unavailable_title: 'Nicht verfügbare Integrationen',
    history_title: 'Letzte Neuladungen',
    no_history: 'Noch keine Neuladung',
    since: 'nicht verfügbar seit {d}',
    attempts: '{n}/{max} Neuladungen',
    attempt: 'Neuladung {n}/{max}',
    waiting: 'Karenzzeit',
    gave_up: 'Aufgegeben',
    reloaded: 'Neu geladen',
    reload_failed: 'Fehlgeschlagen',
    gave_up_event: 'Aufgegeben',
    gave_up_after: 'nach {n} Neuladungen',
    power_cycled: 'Per Steckdose neu gestartet',
    power_cycle_failed: 'Neustart fehlgeschlagen',
    cycle_attempt: 'Neustart {n}/{max}',
    cycle_gave_up_after: 'nach {n} Neustarts',
    minutes: '{n} Min.',
    hours: '{n} Std.',
    days: '{n} Tg.',
    ed_entity: 'Integration-Watchdog-Sensor',
    ed_entity_helper: 'Sensor der nicht verfügbaren Integrationen; leer lassen, um ihn automatisch zu finden',
    ed_title: 'Titel',
    ed_title_helper: 'Leer lassen für „Watchdog“',
    ed_show_stats: 'Übersicht',
    ed_show_stats_helper: 'Nicht verfügbare, Neuladungen seit dem Start und ignorierte Integrationen',
    ed_show_unavailable: 'Nicht verfügbare Integrationen',
    ed_show_unavailable_helper: 'Die Integrationen, deren Entitäten alle nicht verfügbar sind, mit ihren Neuladungen',
    ed_show_history: 'Letzte Neuladungen',
    ed_show_history_helper: 'Die letzten Neuladungen, Fehlschläge und aufgegebenen Integrationen',
    ed_history_count: 'Angezeigte Neuladungen',
    ed_check_button: 'Schaltfläche „Jetzt prüfen“',
    ed_check_button_helper: 'Startet eine Prüfung aus der Kopfzeile, für alle Benutzer, die die Karte sehen',
    ed_hide_when_ok: 'Karte ausblenden, wenn alles verfügbar ist',
    ed_hide_when_ok_helper: 'Die Karte erscheint nur, wenn eine Integration nicht verfügbar ist',
    zoom_in: 'Details anzeigen',
    zoom_out: 'Zurück zur Kompaktansicht',
    ed_zoom: 'Detail-Schaltfläche',
    ed_zoom_helper: 'Wechselt zur vollständigen Karte und zurück',
    ed_language: 'Sprache',
    ed_language_helper: 'Leer lassen, um Home Assistant zu folgen',
  },
  es: {
    title: 'Watchdog',
    all_ok: 'Todo disponible',
    unavailable_one: '{n} no disponible',
    unavailable_many: '{n} no disponibles',
    gave_up_one: '{n} abandonada',
    gave_up_many: '{n} abandonadas',
    checking: 'Comprobando…',
    not_loaded: 'No configurado',
    never_checked: 'Aún sin comprobar',
    checked: 'Comprobado {d}',
    check_now: 'Comprobar ahora',
    check_failed: 'La comprobación ha fallado: {error}',
    retry: 'Reintentar',
    retry_failed: 'El reintento ha fallado: {error}',
    stat_unavailable: 'No disponibles',
    stat_reloads: 'Recargas',
    stat_reloads_hint: 'Desde que se inició Home Assistant',
    stat_ignored: 'Ignoradas',
    unavailable_title: 'Integraciones no disponibles',
    history_title: 'Últimas recargas',
    no_history: 'Aún no hay recargas',
    since: 'no disponible desde hace {d}',
    attempts: '{n}/{max} recargas',
    attempt: 'recarga {n}/{max}',
    waiting: 'Periodo de gracia',
    gave_up: 'Abandonada',
    reloaded: 'Recargada',
    reload_failed: 'Fallida',
    gave_up_event: 'Abandono',
    gave_up_after: 'tras {n} recargas',
    power_cycled: 'Reiniciado por enchufe',
    power_cycle_failed: 'Reinicio fallido',
    cycle_attempt: 'reinicio {n}/{max}',
    cycle_gave_up_after: 'tras {n} reinicios',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Sensor de Watchdog',
    ed_entity_helper: 'Sensor de integraciones no disponibles; déjalo vacío para encontrarlo automáticamente',
    ed_title: 'Título',
    ed_title_helper: 'Déjalo vacío para «Watchdog»',
    ed_show_stats: 'Resumen',
    ed_show_stats_helper: 'No disponibles, recargas desde el inicio e integraciones ignoradas',
    ed_show_unavailable: 'Integraciones no disponibles',
    ed_show_unavailable_helper: 'Las integraciones cuyas entidades no están disponibles, con sus recargas',
    ed_show_history: 'Últimas recargas',
    ed_show_history_helper: 'Las últimas recargas, los fallos y las integraciones abandonadas',
    ed_history_count: 'Recargas mostradas',
    ed_check_button: 'Botón «Comprobar ahora»',
    ed_check_button_helper: 'Lanza una comprobación desde la cabecera, para cualquier usuario que vea la tarjeta',
    ed_hide_when_ok: 'Ocultar la tarjeta cuando todo esté disponible',
    ed_hide_when_ok_helper: 'La tarjeta solo aparece cuando una integración no está disponible',
    zoom_in: 'Mostrar detalles',
    zoom_out: 'Volver a la vista compacta',
    ed_zoom: 'Botón de detalle',
    ed_zoom_helper: 'Cambia a la tarjeta completa y vuelve',
    ed_language: 'Idioma',
    ed_language_helper: 'Déjalo vacío para seguir a Home Assistant',
  },
  it: {
    title: 'Watchdog',
    all_ok: 'Tutto disponibile',
    unavailable_one: '{n} non disponibile',
    unavailable_many: '{n} non disponibili',
    gave_up_one: '{n} abbandonata',
    gave_up_many: '{n} abbandonate',
    checking: 'Controllo in corso…',
    not_loaded: 'Non configurato',
    never_checked: 'Non ancora controllato',
    checked: 'Controllato {d}',
    check_now: 'Controlla ora',
    check_failed: 'Controllo non riuscito: {error}',
    retry: 'Riprova',
    retry_failed: 'Nuovo tentativo non riuscito: {error}',
    stat_unavailable: 'Non disponibili',
    stat_reloads: 'Ricaricamenti',
    stat_reloads_hint: 'Dall’avvio di Home Assistant',
    stat_ignored: 'Ignorate',
    unavailable_title: 'Integrazioni non disponibili',
    history_title: 'Ricaricamenti recenti',
    no_history: 'Ancora nessun ricaricamento',
    since: 'non disponibile da {d}',
    attempts: '{n}/{max} ricaricamenti',
    attempt: 'ricaricamento {n}/{max}',
    waiting: 'In attesa',
    gave_up: 'Abbandonata',
    reloaded: 'Ricaricata',
    reload_failed: 'Fallito',
    gave_up_event: 'Abbandono',
    gave_up_after: 'dopo {n} ricaricamenti',
    power_cycled: 'Riavviato dalla presa',
    power_cycle_failed: 'Riavvio non riuscito',
    cycle_attempt: 'riavvio {n}/{max}',
    cycle_gave_up_after: 'dopo {n} riavvii',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} g',
    ed_entity: 'Sensore Watchdog',
    ed_entity_helper: 'Sensore delle integrazioni non disponibili; lascia vuoto per trovarlo automaticamente',
    ed_title: 'Titolo',
    ed_title_helper: 'Lascia vuoto per «Watchdog»',
    ed_show_stats: 'Riepilogo',
    ed_show_stats_helper: 'Non disponibili, ricaricamenti dall’avvio e integrazioni ignorate',
    ed_show_unavailable: 'Integrazioni non disponibili',
    ed_show_unavailable_helper: 'Le integrazioni le cui entità sono tutte non disponibili, con i loro ricaricamenti',
    ed_show_history: 'Ricaricamenti recenti',
    ed_show_history_helper: 'Gli ultimi ricaricamenti, quelli non riusciti e le integrazioni abbandonate',
    ed_history_count: 'Ricaricamenti mostrati',
    ed_check_button: 'Pulsante «Controlla ora»',
    ed_check_button_helper: 'Avvia un controllo dall’intestazione, per ogni utente che vede la scheda',
    ed_hide_when_ok: 'Nascondi la scheda quando tutto è disponibile',
    ed_hide_when_ok_helper: 'La scheda appare solo quando un’integrazione non è disponibile',
    zoom_in: 'Mostra dettagli',
    zoom_out: 'Torna alla vista compatta',
    ed_zoom: 'Pulsante dettagli',
    ed_zoom_helper: 'Passa alla scheda completa e torna indietro',
    ed_language: 'Lingua',
    ed_language_helper: 'Lascia vuoto per seguire Home Assistant',
  },
  nl: {
    title: 'Watchdog',
    all_ok: 'Alles beschikbaar',
    unavailable_one: '{n} niet beschikbaar',
    unavailable_many: '{n} niet beschikbaar',
    gave_up_one: '{n} opgegeven',
    gave_up_many: '{n} opgegeven',
    checking: 'Controleren…',
    not_loaded: 'Niet ingesteld',
    never_checked: 'Nog niet gecontroleerd',
    checked: 'Gecontroleerd {d}',
    check_now: 'Nu controleren',
    check_failed: 'Controle mislukt: {error}',
    retry: 'Opnieuw proberen',
    retry_failed: 'Opnieuw proberen mislukt: {error}',
    stat_unavailable: 'Niet beschikbaar',
    stat_reloads: 'Herladen',
    stat_reloads_hint: 'Sinds Home Assistant is gestart',
    stat_ignored: 'Genegeerd',
    unavailable_title: 'Niet-beschikbare integraties',
    history_title: 'Recente herlaadpogingen',
    no_history: 'Nog geen herlaadpogingen',
    since: '{d} niet beschikbaar',
    attempts: '{n}/{max} herlaadpogingen',
    attempt: 'herlaadpoging {n}/{max}',
    waiting: 'Wachttijd',
    gave_up: 'Opgegeven',
    reloaded: 'Herladen',
    reload_failed: 'Mislukt',
    gave_up_event: 'Opgegeven',
    gave_up_after: 'na {n} herlaadpogingen',
    power_cycled: 'Herstart via stekker',
    power_cycle_failed: 'Herstart mislukt',
    cycle_attempt: 'herstart {n}/{max}',
    cycle_gave_up_after: 'na {n} herstarts',
    minutes: '{n} min',
    hours: '{n} u',
    days: '{n} d',
    ed_entity: 'Watchdog-sensor',
    ed_entity_helper: 'Sensor van de niet-beschikbare integraties; laat leeg om hem automatisch te vinden',
    ed_title: 'Titel',
    ed_title_helper: 'Laat leeg voor ‘Watchdog’',
    ed_show_stats: 'Overzicht',
    ed_show_stats_helper: 'Niet beschikbaar, herlaadpogingen sinds de start en genegeerde integraties',
    ed_show_unavailable: 'Niet-beschikbare integraties',
    ed_show_unavailable_helper: 'De integraties waarvan alle entiteiten niet beschikbaar zijn, met hun herlaadpogingen',
    ed_show_history: 'Recente herlaadpogingen',
    ed_show_history_helper: 'De laatste herlaadpogingen, mislukte pogingen en opgegeven integraties',
    ed_history_count: 'Getoonde herlaadpogingen',
    ed_check_button: 'Knop ‘Nu controleren’',
    ed_check_button_helper: 'Start een controle vanuit de koptekst, voor elke gebruiker die de kaart ziet',
    ed_hide_when_ok: 'Kaart verbergen als alles beschikbaar is',
    ed_hide_when_ok_helper: 'De kaart verschijnt alleen als een integratie niet beschikbaar is',
    zoom_in: 'Details tonen',
    zoom_out: 'Terug naar de compacte weergave',
    ed_zoom: 'Detailknop',
    ed_zoom_helper: 'Schakelt naar de volledige kaart en terug',
    ed_language: 'Taal',
    ed_language_helper: 'Laat leeg om Home Assistant te volgen',
  },
  pt: {
    title: 'Watchdog',
    all_ok: 'Tudo disponível',
    unavailable_one: '{n} indisponível',
    unavailable_many: '{n} indisponíveis',
    gave_up_one: '{n} abandonada',
    gave_up_many: '{n} abandonadas',
    checking: 'A verificar…',
    not_loaded: 'Não configurado',
    never_checked: 'Ainda não verificado',
    checked: 'Verificado {d}',
    check_now: 'Verificar agora',
    check_failed: 'A verificação falhou: {error}',
    retry: 'Tentar novamente',
    retry_failed: 'A nova tentativa falhou: {error}',
    stat_unavailable: 'Indisponíveis',
    stat_reloads: 'Recarregamentos',
    stat_reloads_hint: 'Desde o arranque do Home Assistant',
    stat_ignored: 'Ignoradas',
    unavailable_title: 'Integrações indisponíveis',
    history_title: 'Recarregamentos recentes',
    no_history: 'Ainda nenhum recarregamento',
    since: 'indisponível há {d}',
    attempts: '{n}/{max} recarregamentos',
    attempt: 'recarregamento {n}/{max}',
    waiting: 'Em espera',
    gave_up: 'Abandonada',
    reloaded: 'Recarregada',
    reload_failed: 'Falhou',
    gave_up_event: 'Abandono',
    gave_up_after: 'após {n} recarregamentos',
    power_cycled: 'Reiniciado pela tomada',
    power_cycle_failed: 'Falha no reinício',
    cycle_attempt: 'reinício {n}/{max}',
    cycle_gave_up_after: 'após {n} reinícios',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Sensor do Watchdog',
    ed_entity_helper: 'Sensor das integrações indisponíveis; deixe vazio para o encontrar automaticamente',
    ed_title: 'Título',
    ed_title_helper: 'Deixe vazio para «Watchdog»',
    ed_show_stats: 'Resumo',
    ed_show_stats_helper: 'Indisponíveis, recarregamentos desde o arranque e integrações ignoradas',
    ed_show_unavailable: 'Integrações indisponíveis',
    ed_show_unavailable_helper: 'As integrações cujas entidades estão todas indisponíveis, com os seus recarregamentos',
    ed_show_history: 'Recarregamentos recentes',
    ed_show_history_helper: 'Os últimos recarregamentos, as falhas e as integrações abandonadas',
    ed_history_count: 'Recarregamentos mostrados',
    ed_check_button: 'Botão «Verificar agora»',
    ed_check_button_helper: 'Inicia uma verificação a partir do cabeçalho, para qualquer utilizador que veja o cartão',
    ed_hide_when_ok: 'Ocultar o cartão quando tudo está disponível',
    ed_hide_when_ok_helper: 'O cartão só aparece quando uma integração está indisponível',
    zoom_in: 'Mostrar detalhes',
    zoom_out: 'Voltar à vista compacta',
    ed_zoom: 'Botão de detalhe',
    ed_zoom_helper: 'Muda para o cartão completo e volta',
    ed_language: 'Idioma',
    ed_language_helper: 'Deixe vazio para seguir o Home Assistant',
  },
  pl: {
    title: 'Watchdog',
    all_ok: 'Wszystko dostępne',
    unavailable_one: '{n} niedostępna',
    unavailable_few: '{n} niedostępne',
    unavailable_many: '{n} niedostępnych',
    gave_up_one: '{n} porzucona',
    gave_up_few: '{n} porzucone',
    gave_up_many: '{n} porzuconych',
    checking: 'Sprawdzanie…',
    not_loaded: 'Nie skonfigurowano',
    never_checked: 'Jeszcze nie sprawdzono',
    checked: 'Sprawdzono {d}',
    check_now: 'Sprawdź teraz',
    check_failed: 'Sprawdzanie nie powiodło się: {error}',
    retry: 'Spróbuj ponownie',
    retry_failed: 'Ponowna próba nie powiodła się: {error}',
    stat_unavailable: 'Niedostępne',
    stat_reloads: 'Ponowne wczytania',
    stat_reloads_hint: 'Od uruchomienia Home Assistant',
    stat_ignored: 'Ignorowane',
    unavailable_title: 'Niedostępne integracje',
    history_title: 'Ostatnie ponowne wczytania',
    no_history: 'Brak ponownych wczytań',
    since: 'niedostępna od {d}',
    attempts: 'Próby: {n}/{max}',
    attempt: 'ponowne wczytanie {n}/{max}',
    waiting: 'Okres karencji',
    gave_up: 'Porzucona',
    reloaded: 'Wczytana ponownie',
    reload_failed: 'Błąd',
    gave_up_event: 'Porzucenie',
    gave_up_after: 'ponowne wczytania: {n}',
    power_cycled: 'Zrestartowane przez gniazdko',
    power_cycle_failed: 'Restart nieudany',
    cycle_attempt: 'restart {n}/{max}',
    cycle_gave_up_after: 'po {n} restartach',
    minutes: '{n} min',
    hours: '{n} godz.',
    days: '{n} dni',
    ed_entity: 'Sensor Watchdog',
    ed_entity_helper: 'Sensor niedostępnych integracji; pozostaw puste, aby znaleźć go automatycznie',
    ed_title: 'Tytuł',
    ed_title_helper: 'Pozostaw puste dla „Watchdog”',
    ed_show_stats: 'Podsumowanie',
    ed_show_stats_helper: 'Niedostępne, ponowne wczytania od uruchomienia i ignorowane integracje',
    ed_show_unavailable: 'Niedostępne integracje',
    ed_show_unavailable_helper: 'Integracje, których wszystkie encje są niedostępne, z ich ponownymi wczytaniami',
    ed_show_history: 'Ostatnie ponowne wczytania',
    ed_show_history_helper: 'Ostatnie ponowne wczytania, niepowodzenia i porzucone integracje',
    ed_history_count: 'Liczba wyświetlanych ponownych wczytań',
    ed_check_button: 'Przycisk „Sprawdź teraz”',
    ed_check_button_helper: 'Uruchamia sprawdzenie z nagłówka, dla każdego użytkownika, który widzi kartę',
    ed_hide_when_ok: 'Ukryj kartę, gdy wszystko jest dostępne',
    ed_hide_when_ok_helper: 'Karta pojawia się tylko wtedy, gdy jakaś integracja jest niedostępna',
    zoom_in: 'Pokaż szczegóły',
    zoom_out: 'Wróć do widoku kompaktowego',
    ed_zoom: 'Przycisk szczegółów',
    ed_zoom_helper: 'Przełącza na pełną kartę i z powrotem',
    ed_language: 'Język',
    ed_language_helper: 'Pozostaw puste, aby używać języka Home Assistant',
  },
  sr: {
    title: 'Watchdog',
    all_ok: 'Све је доступно',
    unavailable_one: '{n} недоступна',
    unavailable_few: '{n} недоступне',
    unavailable_many: '{n} недоступних',
    gave_up_one: '{n} напуштена',
    gave_up_few: '{n} напуштене',
    gave_up_many: '{n} напуштених',
    checking: 'Проверавање…',
    not_loaded: 'Није подешено',
    never_checked: 'Још није проверено',
    checked: 'Проверено {d}',
    check_now: 'Провери сада',
    check_failed: 'Провера није успела: {error}',
    retry: 'Покушај поново',
    retry_failed: 'Поновни покушај није успео: {error}',
    stat_unavailable: 'Недоступне',
    stat_reloads: 'Поновна учитавања',
    stat_reloads_hint: 'Од покретања Home Assistant-а',
    stat_ignored: 'Игнорисане',
    unavailable_title: 'Недоступне интеграције',
    history_title: 'Недавна поновна учитавања',
    no_history: 'Још нема поновних учитавања',
    since: 'недоступна већ {d}',
    attempts: '{n}/{max} поновних учитавања',
    attempt: 'поновно учитавање {n}/{max}',
    waiting: 'Период чекања',
    gave_up: 'Напуштена',
    reloaded: 'Поново учитана',
    reload_failed: 'Неуспело',
    gave_up_event: 'Напуштена',
    gave_up_after: 'после {n} поновних учитавања',
    power_cycled: 'Рестартован преко утичнице',
    power_cycle_failed: 'Рестарт није успео',
    cycle_attempt: 'рестарт {n}/{max}',
    cycle_gave_up_after: 'после {n} рестарта',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Сензор Watchdog',
    ed_entity_helper: 'Сензор недоступних интеграција; оставите празно да би био пронађен аутоматски',
    ed_title: 'Наслов',
    ed_title_helper: 'Оставите празно за „Watchdog“',
    ed_show_stats: 'Преглед',
    ed_show_stats_helper: 'Недоступне, поновна учитавања од покретања и игнорисане интеграције',
    ed_show_unavailable: 'Недоступне интеграције',
    ed_show_unavailable_helper: 'Интеграције чији су сви ентитети недоступни, са њиховим поновним учитавањима',
    ed_show_history: 'Недавна поновна учитавања',
    ed_show_history_helper: 'Последња поновна учитавања, неуспела учитавања и напуштене интеграције',
    ed_history_count: 'Број приказаних поновних учитавања',
    ed_check_button: 'Дугме „Провери сада“',
    ed_check_button_helper: 'Покреће проверу из заглавља, за сваког корисника који види картицу',
    ed_hide_when_ok: 'Сакриј картицу када је све доступно',
    ed_hide_when_ok_helper: 'Картица се појављује само када је нека интеграција недоступна',
    zoom_in: 'Прикажи детаље',
    zoom_out: 'Назад на сажети приказ',
    ed_zoom: 'Дугме за детаље',
    ed_zoom_helper: 'Пребацује на пуну картицу и назад',
    ed_language: 'Језик',
    ed_language_helper: 'Оставите празно да бисте пратили Home Assistant',
  },
  'sr-Latn': {
    title: 'Watchdog',
    all_ok: 'Sve je dostupno',
    unavailable_one: '{n} nedostupna',
    unavailable_few: '{n} nedostupne',
    unavailable_many: '{n} nedostupnih',
    gave_up_one: '{n} napuštena',
    gave_up_few: '{n} napuštene',
    gave_up_many: '{n} napuštenih',
    checking: 'Proveravanje…',
    not_loaded: 'Nije podešeno',
    never_checked: 'Još nije provereno',
    checked: 'Provereno {d}',
    check_now: 'Proveri sada',
    check_failed: 'Provera nije uspela: {error}',
    retry: 'Pokušaj ponovo',
    retry_failed: 'Ponovni pokušaj nije uspeo: {error}',
    stat_unavailable: 'Nedostupne',
    stat_reloads: 'Ponovna učitavanja',
    stat_reloads_hint: 'Od pokretanja Home Assistant-a',
    stat_ignored: 'Ignorisane',
    unavailable_title: 'Nedostupne integracije',
    history_title: 'Nedavna ponovna učitavanja',
    no_history: 'Još nema ponovnih učitavanja',
    since: 'nedostupna već {d}',
    attempts: '{n}/{max} ponovnih učitavanja',
    attempt: 'ponovno učitavanje {n}/{max}',
    waiting: 'Period čekanja',
    gave_up: 'Napuštena',
    reloaded: 'Ponovo učitana',
    reload_failed: 'Neuspelo',
    gave_up_event: 'Napuštena',
    gave_up_after: 'posle {n} ponovnih učitavanja',
    power_cycled: 'Restartovan preko utičnice',
    power_cycle_failed: 'Restart nije uspeo',
    cycle_attempt: 'restart {n}/{max}',
    cycle_gave_up_after: 'posle {n} restarta',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Senzor Watchdog',
    ed_entity_helper: 'Senzor nedostupnih integracija; ostavite prazno da bi bio pronađen automatski',
    ed_title: 'Naslov',
    ed_title_helper: 'Ostavite prazno za „Watchdog“',
    ed_show_stats: 'Pregled',
    ed_show_stats_helper: 'Nedostupne, ponovna učitavanja od pokretanja i ignorisane integracije',
    ed_show_unavailable: 'Nedostupne integracije',
    ed_show_unavailable_helper: 'Integracije čiji su svi entiteti nedostupni, sa njihovim ponovnim učitavanjima',
    ed_show_history: 'Nedavna ponovna učitavanja',
    ed_show_history_helper: 'Poslednja ponovna učitavanja, neuspela učitavanja i napuštene integracije',
    ed_history_count: 'Broj prikazanih ponovnih učitavanja',
    ed_check_button: 'Dugme „Proveri sada“',
    ed_check_button_helper: 'Pokreće proveru iz zaglavlja, za svakog korisnika koji vidi karticu',
    ed_hide_when_ok: 'Sakrij karticu kada je sve dostupno',
    ed_hide_when_ok_helper: 'Kartica se pojavljuje samo kada je neka integracija nedostupna',
    zoom_in: 'Prikaži detalje',
    zoom_out: 'Nazad na sažeti prikaz',
    ed_zoom: 'Dugme za detalje',
    ed_zoom_helper: 'Prebacuje na punu karticu i nazad',
    ed_language: 'Jezik',
    ed_language_helper: 'Ostavite prazno da biste pratili Home Assistant',
  },
  ro: {
    title: 'Watchdog',
    all_ok: 'Totul este disponibil',
    unavailable_one: '{n} indisponibilă',
    unavailable_many: 'Indisponibile: {n}',
    gave_up_one: '{n} abandonată',
    gave_up_many: 'Abandonate: {n}',
    checking: 'Se verifică…',
    not_loaded: 'Neconfigurat',
    never_checked: 'Neverificat încă',
    checked: 'Verificat {d}',
    check_now: 'Verifică acum',
    check_failed: 'Verificarea a eșuat: {error}',
    retry: 'Reîncearcă',
    retry_failed: 'Reîncercarea a eșuat: {error}',
    stat_unavailable: 'Indisponibile',
    stat_reloads: 'Reîncărcări',
    stat_reloads_hint: 'De la pornirea Home Assistant',
    stat_ignored: 'Ignorate',
    unavailable_title: 'Integrări indisponibile',
    history_title: 'Reîncărcări recente',
    no_history: 'Nicio reîncărcare încă',
    since: 'indisponibilă de {d}',
    attempts: 'Reîncărcări: {n}/{max}',
    attempt: 'reîncărcare {n}/{max}',
    waiting: 'Perioadă de grație',
    gave_up: 'Abandonată',
    reloaded: 'Reîncărcată',
    reload_failed: 'Eșuată',
    gave_up_event: 'Abandon',
    gave_up_after: 'reîncărcări: {n}',
    power_cycled: 'Repornit prin priză',
    power_cycle_failed: 'Repornire eșuată',
    cycle_attempt: 'repornirea {n}/{max}',
    cycle_gave_up_after: 'după {n} reporniri',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} z',
    ed_entity: 'Senzor Watchdog',
    ed_entity_helper: 'Senzorul integrărilor indisponibile; lăsați gol pentru a-l găsi automat',
    ed_title: 'Titlu',
    ed_title_helper: 'Lăsați gol pentru „Watchdog”',
    ed_show_stats: 'Rezumat',
    ed_show_stats_helper: 'Indisponibile, reîncărcări de la pornire și integrări ignorate',
    ed_show_unavailable: 'Integrări indisponibile',
    ed_show_unavailable_helper: 'Integrările ale căror entități sunt toate indisponibile, cu reîncărcările lor',
    ed_show_history: 'Reîncărcări recente',
    ed_show_history_helper: 'Ultimele reîncărcări, reîncărcările eșuate și integrările abandonate',
    ed_history_count: 'Reîncărcări afișate',
    ed_check_button: 'Butonul „Verifică acum”',
    ed_check_button_helper: 'Pornește o verificare din antet, pentru orice utilizator care vede cardul',
    ed_hide_when_ok: 'Ascunde cardul când totul este disponibil',
    ed_hide_when_ok_helper: 'Cardul apare doar când o integrare este indisponibilă',
    zoom_in: 'Afișează detaliile',
    zoom_out: 'Înapoi la vizualizarea compactă',
    ed_zoom: 'Buton de detalii',
    ed_zoom_helper: 'Comută la cardul complet și înapoi',
    ed_language: 'Limbă',
    ed_language_helper: 'Lăsați gol pentru a urma Home Assistant',
  },
  da: {
    title: 'Watchdog',
    all_ok: 'Alt er tilgængeligt',
    unavailable_one: '{n} utilgængelig',
    unavailable_many: '{n} utilgængelige',
    gave_up_one: '{n} opgivet',
    gave_up_many: '{n} opgivet',
    checking: 'Kontrollerer…',
    not_loaded: 'Ikke konfigureret',
    never_checked: 'Ikke kontrolleret endnu',
    checked: 'Kontrolleret {d}',
    check_now: 'Kontrollér nu',
    check_failed: 'Kontrollen mislykkedes: {error}',
    retry: 'Prøv igen',
    retry_failed: 'Nyt forsøg mislykkedes: {error}',
    stat_unavailable: 'Utilgængelige',
    stat_reloads: 'Genindlæsninger',
    stat_reloads_hint: 'Siden Home Assistant startede',
    stat_ignored: 'Ignorerede',
    unavailable_title: 'Utilgængelige integrationer',
    history_title: 'Seneste genindlæsninger',
    no_history: 'Ingen genindlæsninger endnu',
    since: 'utilgængelig i {d}',
    attempts: '{n}/{max} genindlæsninger',
    attempt: 'genindlæsning {n}/{max}',
    waiting: 'Respitperiode',
    gave_up: 'Opgivet',
    reloaded: 'Genindlæst',
    reload_failed: 'Mislykkedes',
    gave_up_event: 'Opgivet',
    gave_up_after: 'efter {n} genindlæsninger',
    power_cycled: 'Genstartet via stik',
    power_cycle_failed: 'Genstart mislykkedes',
    cycle_attempt: 'genstart {n}/{max}',
    cycle_gave_up_after: 'efter {n} genstarter',
    minutes: '{n} min',
    hours: '{n} t',
    days: '{n} d',
    ed_entity: 'Watchdog-sensor',
    ed_entity_helper: 'Sensoren for utilgængelige integrationer; lad feltet være tomt for at finde den automatisk',
    ed_title: 'Titel',
    ed_title_helper: 'Lad feltet være tomt for “Watchdog”',
    ed_show_stats: 'Oversigt',
    ed_show_stats_helper: 'Utilgængelige, genindlæsninger siden start og ignorerede integrationer',
    ed_show_unavailable: 'Utilgængelige integrationer',
    ed_show_unavailable_helper: 'De integrationer, hvis enheder alle er utilgængelige, med deres genindlæsninger',
    ed_show_history: 'Seneste genindlæsninger',
    ed_show_history_helper: 'De seneste genindlæsninger, mislykkede genindlæsninger og opgivne integrationer',
    ed_history_count: 'Viste genindlæsninger',
    ed_check_button: 'Knappen “Kontrollér nu”',
    ed_check_button_helper: 'Starter en kontrol fra overskriften for alle brugere, der kan se kortet',
    ed_hide_when_ok: 'Skjul kortet, når alt er tilgængeligt',
    ed_hide_when_ok_helper: 'Kortet vises kun, når en integration er utilgængelig',
    zoom_in: 'Vis detaljer',
    zoom_out: 'Tilbage til kompakt visning',
    ed_zoom: 'Detaljeknap',
    ed_zoom_helper: 'Skifter til det fulde kort og tilbage',
    ed_language: 'Sprog',
    ed_language_helper: 'Lad feltet være tomt for at følge Home Assistant',
  },
  sv: {
    title: 'Watchdog',
    all_ok: 'Allt är tillgängligt',
    unavailable_one: '{n} otillgänglig',
    unavailable_many: '{n} otillgängliga',
    gave_up_one: '{n} övergiven',
    gave_up_many: '{n} övergivna',
    checking: 'Kontrollerar…',
    not_loaded: 'Inte konfigurerad',
    never_checked: 'Inte kontrollerad än',
    checked: 'Kontrollerad {d}',
    check_now: 'Kontrollera nu',
    check_failed: 'Kontrollen misslyckades: {error}',
    retry: 'Försök igen',
    retry_failed: 'Nytt försök misslyckades: {error}',
    stat_unavailable: 'Otillgängliga',
    stat_reloads: 'Omladdningar',
    stat_reloads_hint: 'Sedan Home Assistant startade',
    stat_ignored: 'Ignorerade',
    unavailable_title: 'Otillgängliga integrationer',
    history_title: 'Senaste omladdningar',
    no_history: 'Inga omladdningar än',
    since: 'otillgänglig i {d}',
    attempts: '{n}/{max} omladdningar',
    attempt: 'omladdning {n}/{max}',
    waiting: 'Respittid',
    gave_up: 'Övergiven',
    reloaded: 'Omladdad',
    reload_failed: 'Misslyckades',
    gave_up_event: 'Övergiven',
    gave_up_after: 'efter {n} omladdningar',
    power_cycled: 'Omstartad via uttag',
    power_cycle_failed: 'Omstart misslyckades',
    cycle_attempt: 'omstart {n}/{max}',
    cycle_gave_up_after: 'efter {n} omstarter',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Watchdog-sensor',
    ed_entity_helper: 'Sensorn för otillgängliga integrationer; lämna tomt för att hitta den automatiskt',
    ed_title: 'Titel',
    ed_title_helper: 'Lämna tomt för ”Watchdog”',
    ed_show_stats: 'Sammanfattning',
    ed_show_stats_helper: 'Otillgängliga, omladdningar sedan start och ignorerade integrationer',
    ed_show_unavailable: 'Otillgängliga integrationer',
    ed_show_unavailable_helper: 'Integrationerna vars entiteter alla är otillgängliga, med deras omladdningar',
    ed_show_history: 'Senaste omladdningar',
    ed_show_history_helper: 'De senaste omladdningarna, misslyckade omladdningar och övergivna integrationer',
    ed_history_count: 'Visade omladdningar',
    ed_check_button: 'Knappen ”Kontrollera nu”',
    ed_check_button_helper: 'Startar en kontroll från rubriken, för alla användare som ser kortet',
    ed_hide_when_ok: 'Dölj kortet när allt är tillgängligt',
    ed_hide_when_ok_helper: 'Kortet visas bara när en integration är otillgänglig',
    zoom_in: 'Visa detaljer',
    zoom_out: 'Tillbaka till kompakt vy',
    ed_zoom: 'Detaljknapp',
    ed_zoom_helper: 'Växlar till det fullständiga kortet och tillbaka',
    ed_language: 'Språk',
    ed_language_helper: 'Lämna tomt för att följa Home Assistant',
  },
  bg: {
    title: 'Watchdog',
    all_ok: 'Всичко е достъпно',
    unavailable_one: '{n} недостъпна',
    unavailable_many: '{n} недостъпни',
    gave_up_one: '{n} изоставена',
    gave_up_many: '{n} изоставени',
    checking: 'Проверка…',
    not_loaded: 'Не е настроено',
    never_checked: 'Още не е проверено',
    checked: 'Проверено {d}',
    check_now: 'Провери сега',
    check_failed: 'Проверката не бе успешна: {error}',
    retry: 'Опитай отново',
    retry_failed: 'Новият опит не бе успешен: {error}',
    stat_unavailable: 'Недостъпни',
    stat_reloads: 'Презареждания',
    stat_reloads_hint: 'От стартирането на Home Assistant',
    stat_ignored: 'Игнорирани',
    unavailable_title: 'Недостъпни интеграции',
    history_title: 'Последни презареждания',
    no_history: 'Още няма презареждания',
    since: 'недостъпна от {d}',
    attempts: 'Презареждания: {n}/{max}',
    attempt: 'презареждане {n}/{max}',
    waiting: 'Гратисен период',
    gave_up: 'Изоставена',
    reloaded: 'Презаредена',
    reload_failed: 'Неуспешно',
    gave_up_event: 'Изоставена',
    gave_up_after: 'презареждания: {n}',
    power_cycled: 'Рестартирано чрез контакт',
    power_cycle_failed: 'Неуспешен рестарт',
    cycle_attempt: 'рестарт {n}/{max}',
    cycle_gave_up_after: 'след {n} рестарта',
    minutes: '{n} мин',
    hours: '{n} ч',
    days: '{n} д',
    ed_entity: 'Сензор на Watchdog',
    ed_entity_helper: 'Сензорът за недостъпни интеграции; оставете празно, за да бъде намерен автоматично',
    ed_title: 'Заглавие',
    ed_title_helper: 'Оставете празно за „Watchdog“',
    ed_show_stats: 'Обобщение',
    ed_show_stats_helper: 'Недостъпни, презареждания от стартирането и игнорирани интеграции',
    ed_show_unavailable: 'Недостъпни интеграции',
    ed_show_unavailable_helper: 'Интеграциите, чиито обекти са всички недостъпни, с техните презареждания',
    ed_show_history: 'Последни презареждания',
    ed_show_history_helper: 'Последните презареждания, неуспешните и изоставените интеграции',
    ed_history_count: 'Показани презареждания',
    ed_check_button: 'Бутон „Провери сега“',
    ed_check_button_helper: 'Стартира проверка от заглавната част за всеки потребител, който вижда картата',
    ed_hide_when_ok: 'Скрий картата, когато всичко е достъпно',
    ed_hide_when_ok_helper: 'Картата се показва само когато някоя интеграция е недостъпна',
    zoom_in: 'Покажи подробности',
    zoom_out: 'Обратно към компактния изглед',
    ed_zoom: 'Бутон за подробности',
    ed_zoom_helper: 'Превключва към пълната карта и обратно',
    ed_language: 'Език',
    ed_language_helper: 'Оставете празно, за да следва Home Assistant',
  },
  ru: {
    title: 'Watchdog',
    all_ok: 'Всё доступно',
    unavailable_one: 'Недоступно: {n}',
    unavailable_many: 'Недоступно: {n}',
    gave_up_one: 'Прекращено: {n}',
    gave_up_many: 'Прекращено: {n}',
    checking: 'Проверка…',
    not_loaded: 'Не настроено',
    never_checked: 'Ещё не проверялось',
    checked: 'Проверено {d}',
    check_now: 'Проверить сейчас',
    check_failed: 'Ошибка проверки: {error}',
    retry: 'Повторить',
    retry_failed: 'Повторная попытка не удалась: {error}',
    stat_unavailable: 'Недоступно',
    stat_reloads: 'Перезагрузки',
    stat_reloads_hint: 'С момента запуска Home Assistant',
    stat_ignored: 'Исключены',
    unavailable_title: 'Недоступные интеграции',
    history_title: 'Последние перезагрузки',
    no_history: 'Перезагрузок пока не было',
    since: 'недоступна уже {d}',
    attempts: 'Перезагрузки: {n}/{max}',
    attempt: 'перезагрузка {n}/{max}',
    waiting: 'Период ожидания',
    gave_up: 'Прекращено',
    reloaded: 'Перезагружена',
    reload_failed: 'Ошибка',
    gave_up_event: 'Прекращено',
    gave_up_after: 'перезагрузок: {n}',
    power_cycled: 'Перезапущено розеткой',
    power_cycle_failed: 'Перезапуск не удался',
    cycle_attempt: 'перезапуск {n}/{max}',
    cycle_gave_up_after: 'после {n} перезапусков',
    minutes: '{n} мин',
    hours: '{n} ч',
    days: '{n} д',
    ed_entity: 'Сенсор Watchdog',
    ed_entity_helper: 'Сенсор недоступных интеграций; оставьте пустым, чтобы найти его автоматически',
    ed_title: 'Заголовок',
    ed_title_helper: 'Оставьте пустым для «Watchdog»',
    ed_show_stats: 'Сводка',
    ed_show_stats_helper: 'Недоступные, перезагрузки с момента запуска и игнорируемые интеграции',
    ed_show_unavailable: 'Недоступные интеграции',
    ed_show_unavailable_helper: 'Интеграции, все объекты которых недоступны, с их перезагрузками',
    ed_show_history: 'Последние перезагрузки',
    ed_show_history_helper: 'Последние перезагрузки, неудачные перезагрузки и интеграции, для которых попытки исчерпаны',
    ed_history_count: 'Число показанных перезагрузок',
    ed_check_button: 'Кнопка «Проверить сейчас»',
    ed_check_button_helper: 'Запускает проверку из заголовка для любого пользователя, который видит карточку',
    ed_hide_when_ok: 'Скрывать карточку, когда всё доступно',
    ed_hide_when_ok_helper: 'Карточка появляется, только когда какая-либо интеграция недоступна',
    zoom_in: 'Показать подробности',
    zoom_out: 'Вернуться к компактному виду',
    ed_zoom: 'Кнопка подробностей',
    ed_zoom_helper: 'Переключает на полную карточку и обратно',
    ed_language: 'Язык',
    ed_language_helper: 'Оставьте пустым, чтобы использовать язык Home Assistant',
  },
  uk: {
    title: 'Watchdog',
    all_ok: 'Усе доступне',
    unavailable_one: 'Недоступно: {n}',
    unavailable_many: 'Недоступно: {n}',
    gave_up_one: 'Припинено: {n}',
    gave_up_many: 'Припинено: {n}',
    checking: 'Перевірка…',
    not_loaded: 'Не налаштовано',
    never_checked: 'Ще не перевірялося',
    checked: 'Перевірено {d}',
    check_now: 'Перевірити зараз',
    check_failed: 'Помилка перевірки: {error}',
    retry: 'Повторити',
    retry_failed: 'Повторна спроба не вдалася: {error}',
    stat_unavailable: 'Недоступно',
    stat_reloads: 'Перезавантаження',
    stat_reloads_hint: 'Від запуску Home Assistant',
    stat_ignored: 'Ігнорується',
    unavailable_title: 'Недоступні інтеграції',
    history_title: 'Історія перезавантажень',
    no_history: 'Перезавантажень ще не було',
    since: 'недоступна вже {d}',
    attempts: 'Перезавантаження: {n}/{max}',
    attempt: 'перезавантаження {n}/{max}',
    waiting: 'Очікування',
    gave_up: 'Припинено',
    reloaded: 'Перезавантажено',
    reload_failed: 'Помилка',
    gave_up_event: 'Припинено',
    gave_up_after: 'перезавантажень: {n}',
    power_cycled: 'Перезапущено розеткою',
    power_cycle_failed: 'Перезапуск не вдався',
    cycle_attempt: 'перезапуск {n}/{max}',
    cycle_gave_up_after: 'після {n} перезапусків',
    minutes: '{n} хв',
    hours: '{n} год',
    days: '{n} д',
    ed_entity: 'Сенсор Watchdog',
    ed_entity_helper: 'Сенсор недоступних інтеграцій; залиште порожнім, щоб знайти його автоматично',
    ed_title: 'Заголовок',
    ed_title_helper: 'Залиште порожнім для «Watchdog»',
    ed_show_stats: 'Зведення',
    ed_show_stats_helper: 'Недоступні, перезавантаження від запуску та ігноровані інтеграції',
    ed_show_unavailable: 'Недоступні інтеграції',
    ed_show_unavailable_helper: 'Інтеграції, усі сутності яких недоступні, з їхніми перезавантаженнями',
    ed_show_history: 'Останні перезавантаження',
    ed_show_history_helper: 'Останні перезавантаження, невдалі перезавантаження та інтеграції, для яких спроби вичерпано',
    ed_history_count: 'Кількість показаних перезавантажень',
    ed_check_button: 'Кнопка «Перевірити зараз»',
    ed_check_button_helper: 'Запускає перевірку із заголовка для кожного користувача, який бачить картку',
    ed_hide_when_ok: 'Приховувати картку, коли все доступне',
    ed_hide_when_ok_helper: 'Картка з’являється, лише коли якась інтеграція недоступна',
    zoom_in: 'Показати подробиці',
    zoom_out: 'Повернутися до компактного вигляду',
    ed_zoom: 'Кнопка подробиць',
    ed_zoom_helper: 'Перемикає на повну картку й назад',
    ed_language: 'Мова',
    ed_language_helper: 'Залиште порожнім, щоб використовувати мову Home Assistant',
  },
  hu: {
    title: 'Watchdog',
    all_ok: 'Minden elérhető',
    unavailable_one: '{n} nem elérhető',
    unavailable_many: '{n} nem elérhető',
    gave_up_one: '{n} feladva',
    gave_up_many: '{n} feladva',
    checking: 'Ellenőrzés…',
    not_loaded: 'Nincs beállítva',
    never_checked: 'Még nincs ellenőrizve',
    checked: 'Ellenőrizve: {d}',
    check_now: 'Ellenőrzés most',
    check_failed: 'Az ellenőrzés sikertelen: {error}',
    retry: 'Újra',
    retry_failed: 'Az újrapróbálás sikertelen: {error}',
    stat_unavailable: 'Nem elérhető',
    stat_reloads: 'Újratöltések',
    stat_reloads_hint: 'A Home Assistant indulása óta',
    stat_ignored: 'Mellőzve',
    unavailable_title: 'Nem elérhető integrációk',
    history_title: 'Legutóbbi újratöltések',
    no_history: 'Még nem volt újratöltés',
    since: '{d} óta nem elérhető',
    attempts: '{n}/{max} újratöltés',
    attempt: '{n}/{max}. újratöltés',
    waiting: 'Türelmi idő',
    gave_up: 'Feladva',
    reloaded: 'Újratöltve',
    reload_failed: 'Sikertelen',
    gave_up_event: 'Feladva',
    gave_up_after: '{n} újratöltés után',
    power_cycled: 'Újraindítva konnektorral',
    power_cycle_failed: 'Sikertelen újraindítás',
    cycle_attempt: 'újraindítás {n}/{max}',
    cycle_gave_up_after: '{n} újraindítás után',
    minutes: '{n} perc',
    hours: '{n} óra',
    days: '{n} nap',
    ed_entity: 'Watchdog érzékelő',
    ed_entity_helper: 'A nem elérhető integrációk érzékelője; hagyja üresen az automatikus kereséshez',
    ed_title: 'Cím',
    ed_title_helper: 'Hagyja üresen az „Watchdog” címhez',
    ed_show_stats: 'Összegzés',
    ed_show_stats_helper: 'Nem elérhető, indulás óta újratöltött és figyelmen kívül hagyott integrációk',
    ed_show_unavailable: 'Nem elérhető integrációk',
    ed_show_unavailable_helper: 'Azok az integrációk, amelyeknek minden entitása nem elérhető, az újratöltéseikkel',
    ed_show_history: 'Legutóbbi újratöltések',
    ed_show_history_helper: 'A legutóbbi újratöltések, a sikertelen újratöltések és a feladott integrációk',
    ed_history_count: 'Megjelenített újratöltések',
    ed_check_button: '„Ellenőrzés most” gomb',
    ed_check_button_helper: 'Ellenőrzést indít a fejlécből minden felhasználónak, aki látja a kártyát',
    ed_hide_when_ok: 'Kártya elrejtése, ha minden elérhető',
    ed_hide_when_ok_helper: 'A kártya csak akkor jelenik meg, ha egy integráció nem elérhető',
    zoom_in: 'Részletek megjelenítése',
    zoom_out: 'Vissza a kompakt nézethez',
    ed_zoom: 'Részletek gomb',
    ed_zoom_helper: 'Átvált a teljes kártyára és vissza',
    ed_language: 'Nyelv',
    ed_language_helper: 'Hagyja üresen a Home Assistant nyelvének követéséhez',
  },
  sk: {
    title: 'Watchdog',
    all_ok: 'Všetko je dostupné',
    unavailable_one: '{n} nedostupná',
    unavailable_many: 'Nedostupné: {n}',
    gave_up_one: '{n} vzdaná',
    gave_up_many: 'Vzdané: {n}',
    checking: 'Kontroluje sa…',
    not_loaded: 'Nie je nastavené',
    never_checked: 'Zatiaľ neskontrolované',
    checked: 'Skontrolované {d}',
    check_now: 'Skontrolovať teraz',
    check_failed: 'Kontrola zlyhala: {error}',
    retry: 'Skúsiť znova',
    retry_failed: 'Nový pokus zlyhal: {error}',
    stat_unavailable: 'Nedostupné',
    stat_reloads: 'Opätovné načítania',
    stat_reloads_hint: 'Od spustenia Home Assistant',
    stat_ignored: 'Ignorované',
    unavailable_title: 'Nedostupné integrácie',
    history_title: 'Posledné opätovné načítania',
    no_history: 'Zatiaľ žiadne opätovné načítanie',
    since: 'nedostupná už {d}',
    attempts: 'Opätovné načítania: {n}/{max}',
    attempt: 'opätovné načítanie {n}/{max}',
    waiting: 'Ochranná lehota',
    gave_up: 'Vzdaná',
    reloaded: 'Znovu načítaná',
    reload_failed: 'Zlyhalo',
    gave_up_event: 'Vzdaná',
    gave_up_after: 'opätovné načítania: {n}',
    power_cycled: 'Reštartované cez zásuvku',
    power_cycle_failed: 'Reštart zlyhal',
    cycle_attempt: 'reštart {n}/{max}',
    cycle_gave_up_after: 'reštarty: {n}',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Senzor Watchdog',
    ed_entity_helper: 'Senzor nedostupných integrácií; nechajte prázdne, aby sa našiel automaticky',
    ed_title: 'Názov',
    ed_title_helper: 'Nechajte prázdne pre „Watchdog“',
    ed_show_stats: 'Súhrn',
    ed_show_stats_helper: 'Nedostupné, opätovné načítania od spustenia a ignorované integrácie',
    ed_show_unavailable: 'Nedostupné integrácie',
    ed_show_unavailable_helper: 'Integrácie, ktorých všetky entity sú nedostupné, s ich opätovnými načítaniami',
    ed_show_history: 'Posledné opätovné načítania',
    ed_show_history_helper: 'Posledné opätovné načítania, neúspešné načítania a vzdané integrácie',
    ed_history_count: 'Zobrazené opätovné načítania',
    ed_check_button: 'Tlačidlo „Skontrolovať teraz“',
    ed_check_button_helper: 'Spustí kontrolu z hlavičky pre každého používateľa, ktorý vidí kartu',
    ed_hide_when_ok: 'Skryť kartu, keď je všetko dostupné',
    ed_hide_when_ok_helper: 'Karta sa zobrazí, len keď je niektorá integrácia nedostupná',
    zoom_in: 'Zobraziť podrobnosti',
    zoom_out: 'Späť na kompaktné zobrazenie',
    ed_zoom: 'Tlačidlo podrobností',
    ed_zoom_helper: 'Prepne na úplnú kartu a späť',
    ed_language: 'Jazyk',
    ed_language_helper: 'Nechajte prázdne, aby sa použil jazyk Home Assistant',
  },
  cs: {
    title: 'Watchdog',
    all_ok: 'Vše je dostupné',
    unavailable_one: '{n} nedostupná',
    unavailable_many: 'Nedostupné: {n}',
    gave_up_one: '{n} vzdaná',
    gave_up_many: 'Vzdané: {n}',
    checking: 'Probíhá kontrola…',
    not_loaded: 'Nenastaveno',
    never_checked: 'Zatím nezkontrolováno',
    checked: 'Zkontrolováno {d}',
    check_now: 'Zkontrolovat nyní',
    check_failed: 'Kontrola selhala: {error}',
    retry: 'Zkusit znovu',
    retry_failed: 'Nový pokus selhal: {error}',
    stat_unavailable: 'Nedostupné',
    stat_reloads: 'Opětovná načtení',
    stat_reloads_hint: 'Od spuštění Home Assistant',
    stat_ignored: 'Ignorované',
    unavailable_title: 'Nedostupné integrace',
    history_title: 'Nedávná opětovná načtení',
    no_history: 'Zatím žádné opětovné načtení',
    since: 'nedostupná už {d}',
    attempts: 'Opětovná načtení: {n}/{max}',
    attempt: 'opětovné načtení {n}/{max}',
    waiting: 'Ochranná lhůta',
    gave_up: 'Vzdaná',
    reloaded: 'Znovu načtena',
    reload_failed: 'Selhalo',
    gave_up_event: 'Vzdaná',
    gave_up_after: 'opětovná načtení: {n}',
    power_cycled: 'Restartováno přes zásuvku',
    power_cycle_failed: 'Restart selhal',
    cycle_attempt: 'restart {n}/{max}',
    cycle_gave_up_after: 'restarty: {n}',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Senzor Watchdog',
    ed_entity_helper: 'Senzor nedostupných integrací; ponechte prázdné, aby byl nalezen automaticky',
    ed_title: 'Název',
    ed_title_helper: 'Ponechte prázdné pro „Watchdog“',
    ed_show_stats: 'Souhrn',
    ed_show_stats_helper: 'Nedostupné, opětovná načtení od spuštění a ignorované integrace',
    ed_show_unavailable: 'Nedostupné integrace',
    ed_show_unavailable_helper: 'Integrace, jejichž všechny entity jsou nedostupné, s jejich opětovnými načteními',
    ed_show_history: 'Nedávná opětovná načtení',
    ed_show_history_helper: 'Poslední opětovná načtení, neúspěšná načtení a vzdané integrace',
    ed_history_count: 'Zobrazená opětovná načtení',
    ed_check_button: 'Tlačítko „Zkontrolovat nyní“',
    ed_check_button_helper: 'Spustí kontrolu ze záhlaví pro každého uživatele, který kartu vidí',
    ed_hide_when_ok: 'Skrýt kartu, když je vše dostupné',
    ed_hide_when_ok_helper: 'Karta se zobrazí, jen když je některá integrace nedostupná',
    zoom_in: 'Zobrazit podrobnosti',
    zoom_out: 'Zpět na kompaktní zobrazení',
    ed_zoom: 'Tlačítko podrobností',
    ed_zoom_helper: 'Přepne na úplnou kartu a zpět',
    ed_language: 'Jazyk',
    ed_language_helper: 'Ponechte prázdné, aby se použil jazyk Home Assistant',
  },
  sl: {
    title: 'Watchdog',
    all_ok: 'Vse je na voljo',
    unavailable_one: 'Ni na voljo: {n}',
    unavailable_many: 'Ni na voljo: {n}',
    gave_up_one: 'Opuščene: {n}',
    gave_up_many: 'Opuščene: {n}',
    checking: 'Preverjanje…',
    not_loaded: 'Ni nastavljeno',
    never_checked: 'Še ni preverjeno',
    checked: 'Preverjeno {d}',
    check_now: 'Preveri zdaj',
    check_failed: 'Preverjanje ni uspelo: {error}',
    retry: 'Poskusi znova',
    retry_failed: 'Ponoven poskus ni uspel: {error}',
    stat_unavailable: 'Ni na voljo',
    stat_reloads: 'Ponovna nalaganja',
    stat_reloads_hint: 'Od zagona Home Assistanta',
    stat_ignored: 'Prezrte',
    unavailable_title: 'Integracije, ki niso na voljo',
    history_title: 'Nedavna ponovna nalaganja',
    no_history: 'Še ni ponovnih nalaganj',
    since: 'ni na voljo že {d}',
    attempts: 'Ponovna nalaganja: {n}/{max}',
    attempt: 'ponovno nalaganje {n}/{max}',
    waiting: 'Čakalna doba',
    gave_up: 'Opuščena',
    reloaded: 'Ponovno naložena',
    reload_failed: 'Neuspešno',
    gave_up_event: 'Opuščena',
    gave_up_after: 'ponovna nalaganja: {n}',
    power_cycled: 'Ponovno zagnano prek vtičnice',
    power_cycle_failed: 'Ponovni zagon ni uspel',
    cycle_attempt: 'ponovni zagon {n}/{max}',
    cycle_gave_up_after: 'ponovni zagoni: {n}',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d',
    ed_entity: 'Senzor Watchdog',
    ed_entity_helper: 'Senzor integracij, ki niso na voljo; pustite prazno, da ga poiščete samodejno',
    ed_title: 'Naslov',
    ed_title_helper: 'Pustite prazno za »Watchdog«',
    ed_show_stats: 'Povzetek',
    ed_show_stats_helper: 'Integracije, ki niso na voljo, ponovna nalaganja od zagona in prezrte integracije',
    ed_show_unavailable: 'Integracije, ki niso na voljo',
    ed_show_unavailable_helper: 'Integracije, katerih nobena entiteta ni na voljo, z njihovimi ponovnimi nalaganji',
    ed_show_history: 'Nedavna ponovna nalaganja',
    ed_show_history_helper: 'Zadnja ponovna nalaganja, neuspešna nalaganja in opuščene integracije',
    ed_history_count: 'Prikazana ponovna nalaganja',
    ed_check_button: 'Gumb »Preveri zdaj«',
    ed_check_button_helper: 'Zažene preverjanje iz glave za vsakega uporabnika, ki vidi kartico',
    ed_hide_when_ok: 'Skrij kartico, ko je vse na voljo',
    ed_hide_when_ok_helper: 'Kartica se prikaže le, ko neka integracija ni na voljo',
    zoom_in: 'Prikaži podrobnosti',
    zoom_out: 'Nazaj na strnjeni pogled',
    ed_zoom: 'Gumb za podrobnosti',
    ed_zoom_helper: 'Preklopi na celotno kartico in nazaj',
    ed_language: 'Jezik',
    ed_language_helper: 'Pustite prazno za jezik Home Assistanta',
  },
  lv: {
    title: 'Watchdog',
    all_ok: 'Viss ir pieejams',
    unavailable_one: 'Nav pieejamas: {n}',
    unavailable_many: 'Nav pieejamas: {n}',
    gave_up_one: 'Atmestas: {n}',
    gave_up_many: 'Atmestas: {n}',
    checking: 'Notiek pārbaude…',
    not_loaded: 'Nav iestatīts',
    never_checked: 'Vēl nav pārbaudīts',
    checked: 'Pārbaudīts {d}',
    check_now: 'Pārbaudīt tagad',
    check_failed: 'Pārbaude neizdevās: {error}',
    retry: 'Mēģināt vēlreiz',
    retry_failed: 'Atkārtotais mēģinājums neizdevās: {error}',
    stat_unavailable: 'Nav pieejamas',
    stat_reloads: 'Pārlādes',
    stat_reloads_hint: 'Kopš Home Assistant palaišanas',
    stat_ignored: 'Ignorētas',
    unavailable_title: 'Nepieejamās integrācijas',
    history_title: 'Nesenās pārlādes',
    no_history: 'Vēl nav pārlāžu',
    since: 'nav pieejama jau {d}',
    attempts: 'Pārlādes: {n}/{max}',
    attempt: 'pārlāde {n}/{max}',
    waiting: 'Nogaidīšanas laiks',
    gave_up: 'Atmesta',
    reloaded: 'Pārlādēta',
    reload_failed: 'Neizdevās',
    gave_up_event: 'Atmesta',
    gave_up_after: 'pārlādes: {n}',
    power_cycled: 'Restartēta ar kontaktligzdu',
    power_cycle_failed: 'Restartēšana neizdevās',
    cycle_attempt: 'restartēšana {n}/{max}',
    cycle_gave_up_after: 'restartēšanas: {n}',
    minutes: '{n} min',
    hours: '{n} h',
    days: '{n} d.',
    ed_entity: 'Watchdog sensors',
    ed_entity_helper: 'Nepieejamo integrāciju sensors; atstājiet tukšu, lai to atrastu automātiski',
    ed_title: 'Virsraksts',
    ed_title_helper: 'Atstājiet tukšu, lai izmantotu “Watchdog”',
    ed_show_stats: 'Kopsavilkums',
    ed_show_stats_helper: 'Nepieejamās, pārlādes kopš palaišanas un ignorētās integrācijas',
    ed_show_unavailable: 'Nepieejamās integrācijas',
    ed_show_unavailable_helper: 'Integrācijas, kuru visas vienības nav pieejamas, ar to pārlādēm',
    ed_show_history: 'Nesenās pārlādes',
    ed_show_history_helper: 'Pēdējās pārlādes, neizdevušās pārlādes un atmestās integrācijas',
    ed_history_count: 'Parādītās pārlādes',
    ed_check_button: 'Poga “Pārbaudīt tagad”',
    ed_check_button_helper: 'Sāk pārbaudi no galvenes ikvienam lietotājam, kurš redz kartīti',
    ed_hide_when_ok: 'Paslēpt kartīti, kad viss ir pieejams',
    ed_hide_when_ok_helper: 'Kartīte parādās tikai tad, kad kāda integrācija nav pieejama',
    zoom_in: 'Rādīt detaļas',
    zoom_out: 'Atpakaļ uz kompakto skatu',
    ed_zoom: 'Detaļu poga',
    ed_zoom_helper: 'Pārslēdz uz pilno kartīti un atpakaļ',
    ed_language: 'Valoda',
    ed_language_helper: 'Atstājiet tukšu, lai izmantotu Home Assistant valodu',
  },
  el: {
    title: 'Watchdog',
    all_ok: 'Όλα διαθέσιμα',
    unavailable_one: '{n} μη διαθέσιμη',
    unavailable_many: '{n} μη διαθέσιμες',
    gave_up_one: '{n} διακόπηκε',
    gave_up_many: '{n} διακόπηκαν',
    checking: 'Έλεγχος…',
    not_loaded: 'Δεν έχει ρυθμιστεί',
    never_checked: 'Δεν έχει ελεγχθεί ακόμα',
    checked: 'Ελέγχθηκε {d}',
    check_now: 'Έλεγχος τώρα',
    check_failed: 'Ο έλεγχος απέτυχε: {error}',
    retry: 'Δοκιμή ξανά',
    retry_failed: 'Η νέα προσπάθεια απέτυχε: {error}',
    stat_unavailable: 'Μη διαθέσιμες',
    stat_reloads: 'Επαναφορτώσεις',
    stat_reloads_hint: 'Από την εκκίνηση του Home Assistant',
    stat_ignored: 'Αγνοούνται',
    unavailable_title: 'Μη διαθέσιμες ενσωματώσεις',
    history_title: 'Πρόσφατες επαναφορτώσεις',
    no_history: 'Καμία επαναφόρτωση ακόμα',
    since: 'μη διαθέσιμη εδώ και {d}',
    attempts: '{n}/{max} επαναφορτώσεις',
    attempt: 'επαναφόρτωση {n}/{max}',
    waiting: 'Περίοδος χάριτος',
    gave_up: 'Διακόπηκε',
    reloaded: 'Επαναφορτώθηκε',
    reload_failed: 'Απέτυχε',
    gave_up_event: 'Εγκατάλειψη',
    gave_up_after: 'μετά από {n} επαναφορτώσεις',
    power_cycled: 'Επανεκκίνηση μέσω πρίζας',
    power_cycle_failed: 'Η επανεκκίνηση απέτυχε',
    cycle_attempt: 'επανεκκίνηση {n}/{max}',
    cycle_gave_up_after: 'μετά από {n} επανεκκινήσεις',
    minutes: '{n} λεπ.',
    hours: '{n} ώρ.',
    days: '{n} ημ.',
    ed_entity: 'Αισθητήρας Watchdog',
    ed_entity_helper: 'Ο αισθητήρας των μη διαθέσιμων ενσωματώσεων· αφήστε κενό για αυτόματο εντοπισμό',
    ed_title: 'Τίτλος',
    ed_title_helper: 'Αφήστε κενό για «Watchdog»',
    ed_show_stats: 'Σύνοψη',
    ed_show_stats_helper: 'Μη διαθέσιμες, επαναφορτώσεις από την εκκίνηση και ενσωματώσεις που παραβλέπονται',
    ed_show_unavailable: 'Μη διαθέσιμες ενσωματώσεις',
    ed_show_unavailable_helper: 'Οι ενσωματώσεις των οποίων όλες οι οντότητες δεν είναι διαθέσιμες, με τις επαναφορτώσεις τους',
    ed_show_history: 'Πρόσφατες επαναφορτώσεις',
    ed_show_history_helper: 'Οι τελευταίες επαναφορτώσεις, οι αποτυχημένες επαναφορτώσεις και οι ενσωματώσεις που εγκαταλείφθηκαν',
    ed_history_count: 'Εμφανιζόμενες επαναφορτώσεις',
    ed_check_button: 'Κουμπί «Έλεγχος τώρα»',
    ed_check_button_helper: 'Ξεκινά έλεγχο από την κεφαλίδα, για κάθε χρήστη που βλέπει την κάρτα',
    ed_hide_when_ok: 'Απόκρυψη της κάρτας όταν όλα είναι διαθέσιμα',
    ed_hide_when_ok_helper: 'Η κάρτα εμφανίζεται μόνο όταν κάποια ενσωμάτωση δεν είναι διαθέσιμη',
    zoom_in: 'Εμφάνιση λεπτομερειών',
    zoom_out: 'Επιστροφή στη συμπαγή προβολή',
    ed_zoom: 'Κουμπί λεπτομερειών',
    ed_zoom_helper: 'Εναλλαγή στην πλήρη κάρτα και πίσω',
    ed_language: 'Γλώσσα',
    ed_language_helper: 'Αφήστε κενό για να ακολουθεί το Home Assistant',
  },
};

const iwLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  if (IW_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return IW_I18N[l] ? l : 'en';
};

// The locale for Intl: Home Assistant's full tag (pt-BR, nl-BE…) when it is the card's language, else the card's language.
// A bare "pt" is Home Assistant's European Portuguese, but Intl reads it as Brazilian: it becomes pt-PT.
const iwLocale = (hass, config) => {
  const lang = iwLang(hass, config);
  const ha = String(hass?.locale?.language || hass?.language || '');
  const tag = ha && (ha === lang || ha.split('-')[0] === lang) ? ha : lang;
  return tag === 'pt' ? 'pt-PT' : tag;
};

const iwT = (lang, key, vars = {}) =>
  (IW_I18N[lang]?.[key] ?? IW_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

const iwEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const IW_DEFAULTS = {
  show_stats: true,
  show_unavailable: true,
  show_history: true,
  history_count: 5,
  check_button: true,
  hide_when_ok: false,
};
const IW_MAX_HISTORY = 20;

// The history is newest first: keep only the last reload, failed reload or give-up of each integration (config entry).
const iwLatestPerIntegration = (history) => {
  const seen = new Set();
  return history.filter((h) => {
    // A power cycle is per device, apart from the reloads of the device's integration.
    const key = h?.device_id ? `device:${h.device_id}` : h?.entry_id || `${h?.domain}:${h?.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

// Minutes elapsed since `iso` (0 for a date in the future or unreadable).
const iwMinutes = (iso, now = Date.now()) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, (now - t) / 60000) : 0;
};

// System Hub's Watchdog entities, from the entity registry: { device: { unavailable, last_reload, last_check, button } }.
// Each entity is told apart by its translation key (watchdog_…), else by the end of its entity ID, among the entities
// of the Watchdog module only (the other modules of System Hub have a "last check" too).
const IW_KEYS = { unavailable: '_unavailable_integrations', last_reload: '_last_reload', last_check: '_last_check', check: '_check_now' };
const IW_TRANSLATION_KEYS = { unavailable: 'watchdog_unavailable', last_reload: 'watchdog_last_reload', last_check: 'watchdog_last_check', check: 'watchdog_check' };
function iwDevices(registry) {
  const devices = {};
  for (const [id, e] of Object.entries(registry || {})) {
    if (e?.platform !== 'system_hub') continue;
    const watchdog = e.translation_key ? e.translation_key.startsWith('watchdog_') : id.includes('_watchdog_');
    if (!watchdog) continue;
    const d = (devices[e.device_id || ''] ||= {});
    const key =
      Object.keys(IW_TRANSLATION_KEYS).find((k) => e.translation_key === IW_TRANSLATION_KEYS[k]) ||
      (e.translation_key ? undefined : Object.keys(IW_KEYS).find((k) => id.endsWith(IW_KEYS[k])));
    if (!key) continue;
    d[key === 'check' ? 'button' : key] = id;
  }
  return devices;
}

// The "Unavailable integrations" sensor among `candidates`: the one whose state carries the integration list.
const iwPick = (hass, candidates) => candidates.find((id) => Array.isArray(hass?.states?.[id]?.attributes?.integrations));

// History item kinds: reloads and power cycles (a device switched off and on with its plug), done, failed or given up.
function iwHistoryKind(kind) {
  if (kind === 'reloaded' || kind === 'power_cycled') return 'ok';
  if (kind === 'reload_failed' || kind === 'power_cycle_failed') return 'warn';
  return 'alert';
}

function iwHistoryLabel(kind) {
  return kind === 'gave_up' || kind === 'power_cycle_gave_up' ? 'gave_up_event' : kind;
}

class IntegrationWatchdogCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('integration-watchdog-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this._config = { ...IW_DEFAULTS, ...config };
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
      ids &&
      // No sensor found yet (watchdog not loaded): its return must be seen at once, not at the next minute.
      ids.unavailable &&
      hass.entities === old.entities &&
      hass.user === old.user &&
      Object.values(ids).every((id) => !id || hass.states[id] === old.states[id]) &&
      iwLang(hass, this._config) === iwLang(old, this._config) &&
      Math.floor(Date.now() / 60000) === this._sigMinute
    ) {
      return;
    }
    this._render();
  }

  // Set by Lovelace while the dashboard is edited (editMode) and in the card editor's preview (preview): a card
  // hidden by hide_when_ok shows again there, so that it can still be edited.
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
    return 2 + (this._rows || 0);
  }

  getGridOptions() {
    return { columns: 12, min_columns: 8, rows: 'auto' };
  }

  _t(key, vars) {
    return iwT(iwLang(this._hass, this._config), key, vars);
  }

  // "{n} unavailable" with the plural form of the card's language: `key_one`, `key_few` (2-4 in Serbian and Polish,
  // when the language has it) or `key_many`.
  _count(key, n) {
    let cat = n === 1 ? 'one' : 'other';
    try {
      cat = new Intl.PluralRules(iwLocale(this._hass, this._config)).select(n);
    } catch {
      // Unknown locale: the simple rule above.
    }
    const form = cat === 'one' ? 'one' : cat === 'few' && IW_I18N[iwLang(this._hass, this._config)]?.[`${key}_few`] ? 'few' : 'many';
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
    const m = iwMinutes(iso);
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(iwLocale(this._hass, this._config), { numeric: 'auto' });
    } catch {
      return this._duration(m);
    }
    if (m < 1) return rtf.format(0, 'second');
    if (m < 60) return rtf.format(-Math.floor(m), 'minute');
    if (m < 1440) return rtf.format(-Math.floor(m / 60), 'hour');
    return rtf.format(-Math.floor(m / 1440), 'day');
  }

  _absolute(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    try {
      return d.toLocaleString(iwLocale(this._hass, this._config), { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return d.toISOString();
    }
  }

  // The entities of the device of the chosen (or found) sensor. Cached per registry object, never when empty.
  _lookup() {
    const registry = this._hass.entities;
    if (!this._reg || this._reg.registry !== registry) {
      const devices = iwDevices(registry);
      this._reg = Object.keys(devices).length ? { registry, devices } : null;
    }
    const devices = this._reg?.devices || {};
    // An entity set in the card but gone (Integration Watchdog's own sensor, removed with it): found automatically.
    let entity = this._config.entity && this._hass.states?.[this._config.entity] ? this._config.entity : null;
    if (!entity) entity = iwPick(this._hass, Object.values(devices).map((d) => d.unavailable).filter(Boolean));
    if (!entity) return {};
    const device = Object.values(devices).find((d) => d.unavailable === entity) || {};
    return { ...device, unavailable: entity };
  }

  _render() {
    const m = this._prepare();
    if (!m) return;
    // innerHTML replaces every element: the one that had the keyboard focus gets it back after the render.
    const focusKey = this.shadowRoot.activeElement?.dataset?.focus;
    this._draw(m);
    this._bind();
    if (focusKey) [...this.shadowRoot.querySelectorAll('[data-focus]')].find((el) => el.dataset.focus === focusKey)?.focus({ preventScroll: true });
  }

  // What the card shows, read from the sensors; null when nothing changed since the last render, or the card is hidden.
  _prepare() {
    if (!this._config || !this._hass || !this.shadowRoot) return null;
    const c = this._config;
    const ids = this._lookup();
    this._ids = ids;
    const states = this._hass.states;
    // Without its list (unavailable or restored while the watchdog is not loaded), the sensor says nothing: not set up.
    const sensorSt = ids.unavailable && states[ids.unavailable];
    const st = Array.isArray(sensorSt?.attributes?.integrations) ? sensorSt : null;
    const reloadSt = ids.last_reload && states[ids.last_reload];
    const checkSt = ids.last_check && states[ids.last_check];
    const buttonSt = ids.button && states[ids.button];

    const minute = Math.floor(Date.now() / 60000);
    this._sigMinute = minute;
    // Only administrators can open Settings: the rows are links for them only.
    this._admin = this._hass.user?.is_admin === true;
    // `_zoomed`: the mini card's view (compact or full), undefined on the full card.
    const sig = JSON.stringify([c, iwLang(this._hass, c), ids, sensorSt, reloadSt, checkSt, buttonSt?.state, minute, this._admin, this._zoomed]);
    if (sig === this._sig) return null;
    this._sig = sig;

    const items = Array.isArray(st?.attributes?.integrations) ? st.attributes.integrations : [];
    const ignored = Array.isArray(st?.attributes?.ignored) ? st.attributes.ignored : [];
    const max = Number(st?.attributes?.max_reloads) || null;
    const history = Array.isArray(reloadSt?.attributes?.history) ? reloadSt.attributes.history : [];
    const reloads = Number(reloadSt?.attributes?.reloads) || 0;
    const givenUp = items.filter((i) => i.gave_up);
    // The button is unavailable while a check runs.
    const checking = buttonSt?.state === 'unavailable';
    const level = !st ? 'na' : givenUp.length ? 'alert' : items.length ? 'warn' : 'ok';

    const hidden = c.hide_when_ok && st && !items.length && !this._editMode && !this._preview;
    this._setHidden(hidden);
    if (hidden) return null;

    const count = Math.min(IW_MAX_HISTORY, Math.max(1, Number(c.history_count) || IW_DEFAULTS.history_count));
    const shownHistory = c.show_history ? iwLatestPerIntegration(history).slice(0, count) : [];
    this._rows = (c.show_unavailable ? items.length : 0) + shownHistory.length + (c.show_stats && st ? 1 : 0);

    const checkedAt = checkSt && !['unknown', 'unavailable'].includes(checkSt.state) ? checkSt.state : null;
    const icon = { ok: 'mdi:shield-check-outline', warn: 'mdi:shield-alert-outline', alert: 'mdi:shield-off-outline', na: 'mdi:shield-outline' }[level];
    return { st, items, ignored, max, history, reloads, givenUp, checking, level, shownHistory, checkedAt, icon };
  }

  _draw({ st, items, ignored, max, reloads, givenUp, checking, level, shownHistory, checkedAt, icon }) {
    const c = this._config;
    const subtitle = !st ? '' : checkedAt ? this._t('checked', { d: this._ago(checkedAt) }) : this._t('never_checked');
    this.shadowRoot.innerHTML = `
      <style>${this.constructor.styles}</style>
      <ha-card class="lvl-${level}">
        <div class="head">
          <div class="badge"><ha-icon icon="${icon}"></ha-icon></div>
          <div class="heading">
            <div class="title">${iwEsc(c.title || this._t('title'))}</div>
            ${subtitle ? `<div class="subtitle" title="${iwEsc(checkedAt ? this._absolute(checkedAt) : '')}">${iwEsc(subtitle)}</div>` : ''}
          </div>
          ${this._checkButton(checking)}
          ${this._pill(this._status(st, items, givenUp, checking))}
          ${this._headExtra()}
        </div>
        ${c.show_stats && st ? this._stats(items.length, reloads, ignored) : ''}
        ${c.show_unavailable && items.length ? this._section('unavailable_title', items.map((i) => this._unavailableRow(i, max)).join('')) : ''}
        ${
          c.show_history && st
            ? this._section(
                'history_title',
                shownHistory.length ? shownHistory.map((h) => this._historyRow(h)).join('') : `<div class="empty">${iwEsc(this._t('no_history'))}</div>`,
              )
            : ''
        }
      </ha-card>`;
  }

  _bind() {
    this.shadowRoot.querySelector('.check')?.addEventListener('click', () => this._check());
    for (const el of this.shadowRoot.querySelectorAll('.row[data-domain]')) {
      el.addEventListener('click', () => this._openIntegration(el.dataset.domain, el.dataset.entry));
    }
    for (const el of this.shadowRoot.querySelectorAll('.retry[data-entry]')) {
      el.addEventListener('click', () => this._retry(el.dataset.entry));
    }
    // A brand image that doesn't exist (custom integration without a brand) falls back to the generic icon.
    for (const img of this.shadowRoot.querySelectorAll('img.brand')) {
      img.addEventListener('error', () => img.parentElement?.classList.add('nobrand'), { once: true });
    }
  }

  _status(st, items, givenUp, checking) {
    if (!st) return this._t('not_loaded');
    if (checking) return this._t('checking');
    const parts = [];
    const available = items.length - givenUp.length;
    if (available) parts.push(this._count('unavailable', available));
    if (givenUp.length) parts.push(this._count('gave_up', givenUp.length));
    return parts.length ? parts.join(' · ') : this._t('all_ok');
  }

  // The status pill: its text, or only its coloured dot when the header is narrow (the text stays in the tooltip
  // and for screen readers).
  _pill(text) {
    const t = iwEsc(text);
    return `<div class="pill" title="${t}"><span class="dot"></span><span class="ptxt">${t}</span></div>`;
  }

  // A row: a button opening the integration's page (on its entry) for an administrator, plain text for the other users.
  _row(cls, domain, focus, title, body, entry) {
    const t = iwEsc(title);
    const target = entry ? ` data-entry="${iwEsc(entry)}"` : '';
    return this._admin
      ? `<button class="${cls}" data-domain="${iwEsc(domain)}"${target} data-focus="${iwEsc(focus)}" title="${t}">${body}</button>`
      : `<div class="${cls}" title="${t}">${body}</div>`;
  }

  // Added at the end of the header by the mini card (its detail button).
  _headExtra() {
    return '';
  }

  _checkButton(checking) {
    if (!this._config.check_button || !this._ids.button) return '';
    const label = iwEsc(this._t('check_now'));
    return `<button class="check" data-focus="check" title="${label}" aria-label="${label}"${checking ? ' disabled' : ''}><ha-icon icon="mdi:refresh"></ha-icon></button>`;
  }

  // "Try again" on an integration given up: the reset action forgets its reloads and reloads it. A failure is a toast.
  async _retry(entryId) {
    try {
      await this._hass.callService('system_hub', 'watchdog_reset', { entry_id: entryId });
    } catch (err) {
      const message = this._t('retry_failed', { error: err?.message || err?.code || String(err) });
      this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
    }
  }

  // A failure (connection lost, button removed) is shown as a Home Assistant toast.
  async _check() {
    if (!this._ids.button) return;
    try {
      await this._hass.callService('button', 'press', { entity_id: this._ids.button });
    } catch (err) {
      const message = this._t('check_failed', { error: err?.message || err?.code || String(err) });
      this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
    }
  }

  _stats(unavailable, reloads, ignored) {
    const tile = (cls, value, key, title = '') =>
      `<div class="stat ${cls}"${title ? ` title="${iwEsc(title)}"` : ''}><span class="val">${iwEsc(value)}</span><span class="lbl">${iwEsc(this._t(key))}</span></div>`;
    return `<div class="stats">
          ${tile(unavailable ? 'warn' : '', unavailable, 'stat_unavailable')}
          ${tile('', reloads, 'stat_reloads', this._t('stat_reloads_hint'))}
          ${tile('', ignored.length, 'stat_ignored', ignored.join(', '))}
        </div>`;
  }

  _section(key, body) {
    return `<div class="section"><div class="stitle">${iwEsc(this._t(key))}</div><div class="list">${body}</div></div>`;
  }

  // The integration's logo from the Home Assistant brands, with the generic icon behind it when there is none.
  _brand(domain, fallback) {
    const dark = this._hass.themes?.darkMode ? 'dark_' : '';
    const src = `https://brands.home-assistant.io/_/${encodeURIComponent(domain)}/${dark}icon.png`;
    return `<span class="ic"><img class="brand" src="${iwEsc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer"><ha-icon icon="${fallback}"></ha-icon></span>`;
  }

  _unavailableRow(i, max) {
    const kind = i.gave_up ? 'alert' : 'warn';
    const sub = [i.domain, i.since ? this._t('since', { d: this._duration(iwMinutes(i.since)) }) : ''].filter(Boolean).join(' · ');
    const value = i.gave_up ? this._t('gave_up') : i.reloads && max ? this._t('attempts', { n: i.reloads, max }) : this._t('waiting');
    const row = this._row(
      `row ${kind}`,
      i.domain,
      `u:${i.entry_id || i.domain}`,
      `${i.title} (${i.domain})`,
      `
            ${this._brand(i.domain, 'mdi:puzzle-remove-outline')}
            <span class="txt">
              <span class="name">${iwEsc(i.title)}</span>
              <span class="sub">${iwEsc(sub)}</span>
            </span>
            <span class="tag">${iwEsc(value)}</span>`,
      i.entry_id,
    );
    // Given up: an administrator gets "Try again" (the reset action) next to the row.
    if (!i.gave_up || !this._admin || !i.entry_id) return row;
    const label = iwEsc(`${this._t('retry')} — ${i.title}`);
    return `<div class="line">${row}<button class="retry" data-entry="${iwEsc(i.entry_id)}" data-focus="r:${iwEsc(i.entry_id)}" title="${label}" aria-label="${label}"><ha-icon icon="mdi:restart"></ha-icon></button></div>`;
  }

  _historyRow(h) {
    const kind = iwHistoryKind(h.kind);
    const icon = { ok: 'mdi:check-circle', warn: 'mdi:alert-circle', alert: 'mdi:cancel' }[kind];
    const label = this._t(iwHistoryLabel(h.kind));
    // A power cycle: the plug used, instead of the integration's domain.
    const cycle = h.kind.startsWith('power_cycle');
    const detail = h.kind.endsWith('gave_up')
      ? this._t(cycle ? 'cycle_gave_up_after' : 'gave_up_after', { n: h.attempt })
      : h.max_reloads
        ? this._t(cycle ? 'cycle_attempt' : 'attempt', { n: h.attempt, max: h.max_reloads })
        : '';
    const sub = [cycle ? h.switch_name || h.switch : h.domain, detail].filter(Boolean).join(' · ');
    return this._row(
      `row hist ${kind}`,
      h.domain,
      `h:${h.at}:${h.entry_id || h.domain}`,
      `${label} — ${this._absolute(h.at)}`,
      `
            <span class="ic ev"><ha-icon icon="${icon}"></ha-icon></span>
            <span class="txt">
              <span class="name">${iwEsc(h.title)}</span>
              <span class="sub">${iwEsc(sub)}</span>
            </span>
            <span class="when">
              <span class="lbl">${iwEsc(label)}</span>
              <span class="ago">${iwEsc(this._ago(h.at))}</span>
            </span>`,
      h.entry_id,
    );
  }

  // The integration's page in Settings, where its entries can be reloaded or their logs read; scrolled to the entry.
  _openIntegration(domain, entry) {
    if (!domain) return;
    const hash = entry ? `#config_entry=${encodeURIComponent(entry)}` : '';
    window.history.pushState(null, '', `/config/integrations/integration/${encodeURIComponent(domain)}${hash}`);
    window.dispatchEvent(new CustomEvent('location-changed', { detail: { replace: false } }));
  }

  static get styles() {
    return `
      :host {
        display: block;
        min-width: 0;
        --iw-natural-width: 360px;
        --iw-ok: var(--success-color, #43a047);
        --iw-warn: var(--warning-color, #ffa600);
        --iw-alert: var(--error-color, #db4437);
        --iw-na: var(--disabled-color, #9e9e9e);
        /* Secondary text on the tinted tiles: nudged towards the primary text so it stays readable (WCAG AA) */
        --iw-muted: color-mix(in srgb, var(--secondary-text-color) 70%, var(--primary-text-color));
      }
      /* Width without a minimum. The card contributes no width of its own (inline-size containment): its stats,
         rows and pill would otherwise set a min-content width of 210-354 px, a floor that a 1fr grid column or a
         flex row cannot go below once the card is wrapped in a div (min-width: 0 on the host does not reach the
         wrapper), so the card would run out of its column. The empty, zero-height grid below gives it a natural
         (max-content) width with a min-content width of 0: in a parent sized by its content (layout-card,
         button-card, an inline-block, a grid "auto" column) the card gets that width instead of falling to its
         padding, and in a 1fr 1fr grid or a flex row, wrapped or not, it shrinks to its track. No
         contain-intrinsic-* and no min-width in px: both would be a minimum. */
      :host::before { content: ""; display: grid; grid-template-columns: minmax(0, var(--iw-natural-width)); height: 0; }
      ha-card { padding: 12px; overflow: hidden; contain: inline-size; }
      ha-card.lvl-ok    { --c: var(--iw-ok); }
      ha-card.lvl-warn  { --c: var(--iw-warn); }
      ha-card.lvl-alert { --c: var(--iw-alert); }
      ha-card.lvl-na    { --c: var(--iw-na); }

      /* The header is a size container: the pill keeps only its dot when it is narrow */
      .head { display: flex; align-items: center; gap: 8px; container-type: inline-size; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--c) 16%, transparent); color: var(--c); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      /* The title takes what the pill leaves (basis 0) and keeps a few characters; the pill keeps its full text
         while there is room and only truncates when there is not */
      .heading { flex: 1 1 0; min-width: 5ch; display: flex; flex-direction: column; }
      .title { font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .subtitle { font-size: 12px; line-height: 1.3; color: var(--secondary-text-color);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pill { flex: 0 1 auto; min-width: 0; display: flex; align-items: center; box-sizing: border-box;
              white-space: nowrap; overflow: hidden;
              font-size: 11px; font-weight: 500; padding: 1px 6px; border-radius: 9px;
              color: color-mix(in srgb, var(--c) 40%, var(--primary-text-color));
              background: color-mix(in srgb, var(--c) 14%, transparent); }
      /* Short of room the status takes a second line before it is cut */
      .pill .ptxt { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: normal; line-height: 1.25;
                    display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2; }
      .pill .dot { display: none; flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
      @container (max-width: 200px) {
        .head .pill { padding: 5px; }
        .head .pill .dot { display: block; }
        .head .pill .ptxt { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
      }
      /* A very narrow header (a 1fr 1fr grid on a phone): the badge gives way, the pill's dot still tells the status */
      @container (max-width: 140px) {
        .head .badge { display: none; }
      }
      .check { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
               display: grid; place-items: center; color: var(--secondary-text-color); }
      .check:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .check:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .check[disabled] { cursor: default; opacity: .4; background: none; }
      .check ha-icon { --mdc-icon-size: 16px; }
      /* A given-up row and its "Try again" button (outlined, not filled) */
      .line { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .line > .row { flex: 1; }
      .retry { all: unset; cursor: pointer; flex: none; box-sizing: border-box; width: 30px; height: 30px; border-radius: 50%;
               display: grid; place-items: center; color: var(--iw-alert); border: 1px solid color-mix(in srgb, var(--iw-alert) 50%, transparent); }
      .retry:hover { background: color-mix(in srgb, var(--iw-alert) 12%, transparent); }
      .retry:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .retry ha-icon { --mdc-icon-size: 16px; }

      .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
      .stat { --t: var(--secondary-text-color); display: flex; flex-direction: column; align-items: center; gap: 1px;
              padding: 6px 4px; border-radius: 10px; min-width: 0;
              background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .stat.warn { --t: var(--iw-warn); background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      .stat .val { font-size: 18px; font-weight: 500; line-height: 1.2; font-variant-numeric: tabular-nums; color: var(--primary-text-color); }
      .stat.warn .val { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
      .stat .lbl { font-size: 11px; color: var(--iw-muted); max-width: 100%;
                   white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .section { margin-top: 12px; }
      .stitle { font-size: 12px; font-weight: 500; color: var(--secondary-text-color); margin: 0 2px 6px;
                text-transform: uppercase; letter-spacing: .04em; }
      .list { display: flex; flex-direction: column; gap: 6px; }
      .empty { font-size: 13px; color: var(--iw-muted); padding: 8px 10px; border-radius: 10px;
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .row { --t: var(--iw-ok); all: unset; box-sizing: border-box; min-width: 0;
             display: flex; align-items: center; gap: 8px; padding: 5px 10px 5px 5px; border-radius: 10px;
             background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .row.warn  { --t: var(--iw-warn); }
      .row.alert { --t: var(--iw-alert); }
      /* Unavailable integrations are tinted; the history keeps the neutral tile, its colour on the icon */
      .row:not(.hist) { background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      /* Only administrators get clickable rows (buttons): they can open Settings */
      button.row { cursor: pointer; }
      button.row:hover { background: color-mix(in srgb, var(--t) 18%, var(--secondary-background-color, transparent)); }
      button.row.hist:hover { background: color-mix(in srgb, var(--secondary-text-color) 10%, var(--secondary-background-color, transparent)); }
      .row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .ic { position: relative; flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
            color: var(--t); background: color-mix(in srgb, var(--t) 18%, transparent); overflow: hidden; }
      .ic ha-icon { --mdc-icon-size: 16px; }
      .ic img.brand { position: absolute; inset: 5px; width: 18px; height: 18px; object-fit: contain; }
      .ic:not(.nobrand) img.brand + ha-icon { visibility: hidden; }
      .ic.nobrand img.brand { display: none; }
      .txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .name { font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--primary-text-color);
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub { font-size: 11px; line-height: 1.2; color: var(--iw-muted);
             white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* The outcome on the right shrinks (up to half the row) before the name does */
      .tag { flex: 0 1 auto; min-width: 0; max-width: 50%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 500; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); font-variant-numeric: tabular-nums; }
      .when { flex: 0 1 auto; min-width: 0; max-width: 50%; display: flex; flex-direction: column; align-items: flex-end; }
      .when > span { max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .when .lbl { font-size: 12px; font-weight: 500; line-height: 1.2; color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); }
      .when .ago { font-size: 11px; line-height: 1.2; color: var(--iw-muted); }
    `;
  }
}

// ── Mini card ────────────────────────────────────────────────────────────────
// integration-watchdog-mini-card: the status on two lines — the badge, title and status pill, then a chip per
// unavailable integration (or the last reload while everything is available) and the time of the last check.
// Its detail button (top right, `zoom: false` removes it) switches it to the full card and back; a click anywhere
// else brings it back too, unless it lands in a dialog opened from the card (more-info).
class IntegrationWatchdogMiniCard extends IntegrationWatchdogCard {
  static getConfigElement() {
    return document.createElement('integration-watchdog-mini-card-editor');
  }

  constructor() {
    super();
    this._zoomed = false;
    this._onUnzoom = (ev) => {
      const path = ev.composedPath();
      if (!this._zoomed || path.includes(this)) return;
      if (path.some((n) => ['ha-more-info-dialog', 'ha-dialog', 'dialog'].includes(n.localName))) return;
      this._zoomed = false;
      this._render();
    };
  }

  connectedCallback() {
    document.addEventListener('click', this._onUnzoom, true);
  }

  disconnectedCallback() {
    document.removeEventListener('click', this._onUnzoom, true);
  }

  setConfig(config) {
    if (config?.zoom != null && typeof config.zoom !== 'boolean') throw new Error('zoom must be true or false');
    super.setConfig(config);
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : 2;
  }

  // 6 columns of a phone section (~156 px) still hold the header once the badge has given way.
  getGridOptions() {
    return { columns: 6, min_columns: 6, rows: 'auto' };
  }

  _headExtra() {
    if (this._config.zoom === false) return '';
    const label = iwEsc(this._t(this._zoomed ? 'zoom_out' : 'zoom_in'));
    const icon = this._zoomed ? 'mdi:arrow-collapse' : 'mdi:arrow-expand';
    return `<button class="zoom" data-focus="zoom" title="${label}" aria-label="${label}" aria-expanded="${this._zoomed}"><ha-icon icon="${icon}"></ha-icon></button>`;
  }

  _draw(m) {
    if (this._zoomed) {
      super._draw(m);
      return;
    }
    const { st, items, givenUp, checking, level, icon } = m;
    this.shadowRoot.innerHTML = `
      <style>${this.constructor.styles}</style>
      <ha-card class="lvl-${level}">
        <div class="mini">
          <div class="badge"><ha-icon icon="${icon}"></ha-icon></div>
          <div class="body">
            <div class="head">
              <div class="heading"><div class="title">${iwEsc(this._config.title || this._t('title'))}</div></div>
              ${this._checkButton(checking)}
              ${this._pill(this._status(st, items, givenUp, checking))}
              ${this._headExtra()}
            </div>
            <div class="rs">${this._chips(m)}</div>
          </div>
        </div>
      </ha-card>`;
  }

  _bind() {
    super._bind();
    this.shadowRoot.querySelector('.zoom')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      this._zoomed = !this._zoomed;
      this._render();
      // The button was replaced: keyboard use (Enter / Space, no click count) keeps the focus on the new one.
      if (ev.detail === 0) this.shadowRoot.querySelector('.zoom')?.focus({ preventScroll: true });
    });
    for (const el of this.shadowRoot.querySelectorAll('.r')) {
      el.addEventListener('click', () => {
        if (el.dataset.domain) this._openIntegration(el.dataset.domain, el.dataset.entry);
        else if (el.dataset.entity) {
          this.dispatchEvent(new CustomEvent('hass-more-info', { detail: { entityId: el.dataset.entity }, bubbles: true, composed: true }));
        }
      });
    }
  }

  // A chip: an administrator's opens the integration's page in Settings, the others open the sensor's more-info.
  _chip(cls, icon, text, title, focus, domain, entity, entry) {
    const target =
      domain && this._admin
        ? ` data-domain="${iwEsc(domain)}"${entry ? ` data-entry="${iwEsc(entry)}"` : ''}`
        : entity
          ? ` data-entity="${iwEsc(entity)}"`
          : '';
    return `<button class="r ${cls}"${target} data-focus="${iwEsc(focus)}" title="${iwEsc(title)}"><ha-icon icon="${icon}"></ha-icon><span class="rt">${iwEsc(text)}</span></button>`;
  }

  _chips({ st, items, max, history, checkedAt }) {
    if (!st) return '';
    const ids = this._ids;
    // The unavailable integrations, tinted: given up in red, the others in orange.
    const chips = items.map((i) => {
      const value = i.gave_up ? this._t('gave_up') : i.reloads && max ? this._t('attempts', { n: i.reloads, max }) : this._t('waiting');
      return this._chip(
        `${i.gave_up ? 'alert' : 'warn'} pill`,
        i.gave_up ? 'mdi:cancel' : 'mdi:puzzle-remove-outline',
        `${i.title} · ${value}`,
        `${i.title} (${i.domain}) — ${value}`,
        `m:u:${i.entry_id || i.domain}`,
        i.domain,
        ids.unavailable,
        i.entry_id,
      );
    });
    // Everything available: the last reload, failed reload or give-up, plain with its coloured icon.
    const last = !items.length && history[0];
    if (last) {
      const kind = iwHistoryKind(last.kind);
      const label = this._t(iwHistoryLabel(last.kind));
      chips.push(
        this._chip(
          kind,
          { ok: 'mdi:check-circle', warn: 'mdi:alert-circle', alert: 'mdi:cancel' }[kind],
          `${label} · ${last.title}`,
          `${label} — ${last.title} (${last.domain}) — ${this._absolute(last.at)}`,
          'm:h',
          last.domain,
          ids.last_reload,
          last.entry_id,
        ),
      );
    }
    const checked = checkedAt ? this._t('checked', { d: this._ago(checkedAt) }) : this._t('never_checked');
    chips.push(this._chip('idle', 'mdi:clock-check-outline', checked, checkedAt ? this._absolute(checkedAt) : checked, 'm:c', null, ids.last_check));
    return chips.join('');
  }

  static get styles() {
    return `${IntegrationWatchdogCard.styles}
      :host { --iw-natural-width: 300px; }
      /* Badge, then the two lines; the badge keeps the full card's size (40 px), top-aligned */
      .mini { display: flex; align-items: flex-start; gap: 10px; container-type: inline-size; }
      .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
      .mini .head { min-height: 40px; }
      .rs { display: flex; flex-wrap: wrap; gap: 2px 4px; margin-left: -4px; }
      .rs:empty { display: none; }
      /* A chip never gets wider than the card: its text ends in an ellipsis (full text in the tooltip) */
      .r { --t: var(--secondary-text-color); all: unset; box-sizing: border-box; cursor: pointer;
           display: inline-flex; align-items: center; gap: 3px; max-width: 100%; min-width: 0;
           padding: 0 6px 0 4px; border-radius: 999px; font-size: 12px; font-weight: 500; line-height: 18px;
           white-space: nowrap; color: var(--primary-text-color); }
      .r.ok    { --t: var(--iw-ok); }
      .r.warn  { --t: var(--iw-warn); }
      .r.alert { --t: var(--iw-alert); }
      .r.idle  { color: var(--iw-muted); }
      .r ha-icon { flex: none; display: inline-flex; --mdc-icon-size: 13px; color: var(--t); }
      .r .rt { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .r.pill { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color)); background: color-mix(in srgb, var(--t) 14%, transparent); }
      .r:hover { background: color-mix(in srgb, var(--t) 16%, var(--secondary-background-color, transparent)); }
      /* A pill keeps a light tint on hover, so its darkened text stays readable */
      .r.pill:hover { background: color-mix(in srgb, var(--t) 22%, transparent); }
      .r:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      /* Detail button, top right in both views */
      .zoom { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
              display: grid; place-items: center; color: var(--secondary-text-color); }
      .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .zoom:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .zoom ha-icon { --mdc-icon-size: 16px; }
      /* A narrow mini card (6 columns of a phone section): the badge gives way, the header tightens */
      @container (max-width: 150px) {
        .mini > .badge { display: none; }
        .mini .head { gap: 4px; }
      }
    `;
  }
}

// ── Editor ───────────────────────────────────────────────────────────────────
const IW_HELPERS = ['entity', 'title', 'show_stats', 'show_unavailable', 'show_history', 'check_button', 'zoom', 'hide_when_ok', 'language'];

class IntegrationWatchdogCardEditor extends HTMLElement {
  static get DEFAULTS() {
    return IW_DEFAULTS;
  }

  // Fields shown after the "Check now" button: the mini card adds its detail button there.
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
      const t = (key) => iwT(iwLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (IW_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
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
    const lang = iwLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    if (this._deps && this._deps.config === c && this._deps.lang === lang) return;
    this._deps = { config: c, lang };
    this._form.data = { ...this.constructor.DEFAULTS, ...c };
    this._form.schema = [
      { name: 'entity', selector: { entity: { filter: { integration: 'system_hub', domain: 'sensor' } } } },
      { name: 'title', selector: { text: {} } },
      { name: 'show_stats', selector: { boolean: {} } },
      { name: 'show_unavailable', selector: { boolean: {} } },
      { name: 'show_history', selector: { boolean: {} } },
      ...(c.show_history === false
        ? []
        : [{ name: 'history_count', selector: { number: { min: 1, max: IW_MAX_HISTORY, mode: 'box' } } }]),
      { name: 'check_button', selector: { boolean: {} } },
      ...this._extraFields(),
      { name: 'hide_when_ok', selector: { boolean: {} } },
      {
        name: 'language',
        selector: {
          select: {
            mode: 'dropdown',
            options: [
              { value: 'en', label: 'English' },
              { value: 'fr', label: 'Français' },
              { value: 'de', label: 'Deutsch' },
              { value: 'es', label: 'Español' },
              { value: 'it', label: 'Italiano' },
              { value: 'nl', label: 'Nederlands' },
              { value: 'pt', label: 'Português (Portugal)' },
              { value: 'pl', label: 'Polski' },
              { value: 'sr', label: 'Српски' },
              { value: 'sr-Latn', label: 'Srpski (latinica)' },
              { value: 'ro', label: 'Română' },
              { value: 'da', label: 'Dansk' },
              { value: 'sv', label: 'Svenska' },
              { value: 'bg', label: 'Български' },
              { value: 'ru', label: 'Русский' },
              { value: 'uk', label: 'Українська' },
              { value: 'hu', label: 'Magyar' },
              { value: 'sk', label: 'Slovenčina' },
              { value: 'cs', label: 'Čeština' },
              { value: 'sl', label: 'Slovenščina' },
              { value: 'lv', label: 'Latviešu' },
              { value: 'el', label: 'Ελληνικά' },
            ],
          },
        },
      },
    ];
  }
}

// The mini card's editor: the full card's options (its detail view), plus the detail button.
class IntegrationWatchdogMiniCardEditor extends IntegrationWatchdogCardEditor {
  static get DEFAULTS() {
    return { ...IW_DEFAULTS, zoom: true };
  }

  _extraFields() {
    return [{ name: 'zoom', selector: { boolean: {} } }];
  }
}

// Each card is registered on its own: a page that already loaded an older copy of this file (a stale resource or a
// cached version without the mini card) still gets the mini card from this one.
window.customCards = window.customCards || [];
if (!customElements.get('integration-watchdog-card')) {
  customElements.define('integration-watchdog-card', IntegrationWatchdogCard);
  customElements.define('integration-watchdog-card-editor', IntegrationWatchdogCardEditor);
  window.customCards.push({
    type: 'integration-watchdog-card',
    name: 'Watchdog Card (System Hub)',
    description: 'The overall status of the System Hub Watchdog: unavailable integrations and recent reloads',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub',
  });
  console.info(
    `%c INTEGRATION-WATCHDOG-CARD %c v${INTEGRATION_WATCHDOG_CARD_VERSION} `,
    'background:#14b8a6;color:#fff;font-weight:700',
    '',
  );
}
if (!customElements.get('integration-watchdog-mini-card')) {
  customElements.define('integration-watchdog-mini-card', IntegrationWatchdogMiniCard);
  customElements.define('integration-watchdog-mini-card-editor', IntegrationWatchdogMiniCardEditor);
  window.customCards.push({
    type: 'integration-watchdog-mini-card',
    name: 'Watchdog Mini Card (System Hub)',
    description: 'The System Hub Watchdog status and unavailable integrations on two lines, with a detail button showing the full card',
    preview: true,
    documentationURL: 'https://github.com/juju35/ha-system-hub',
  });
}
