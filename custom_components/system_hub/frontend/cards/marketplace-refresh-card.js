/**
 * marketplace-refresh-card — the update check of Marketplace Refresh: status and progress, the last and next check, the updates
 * available for the repositories installed from the Marketplace, and the ones that couldn't be checked.
 * Served and added to the dashboard resources by the integration.
 * https://github.com/juju35/ha-system-hub (Marketplace module, from ha-marketplace-refresh)
 */
// Requests left under which the card says the checks may wait for GitHub's limit to reset.
const MR_RATE_LOW = 1500;
var MARKETPLACE_REFRESH_CARD_VERSION = '2.11.0';
// System Hub: its entities (platform system_hub, translation keys marketplace_*) and actions (system_hub.marketplace_*)
var HR_DOMAIN = 'system_hub';
var HR_PREFIX = 'marketplace_';

const HR_I18N = {
  en: {
    title: 'Marketplace updates',
    up_to_date: 'Up to date',
    updates_one: '{n} update',
    updates_many: '{n} updates',
    checking: 'Checking {done}/{total}',
    checking_short: 'Checking…',
    error: 'Error',
    failed_one: '{n} failed',
    failed_many: '{n} failed',
    not_loaded: 'Marketplace Refresh is not set up',
    unavailable: 'Unavailable',
    never_checked: 'Not checked yet',
    checked: 'Checked {d}',
    next: 'next {d}',
    auto_off: 'automatic check off',
    check_now: 'Check for updates',
    updates_title: 'Updates available',
    system_title: 'System updates',
    no_details: 'The Marketplace isn’t loaded: no details on these updates',
    failed_title: 'Could not be checked',
    no_github: 'GitHub isn’t connected to the Marketplace: the repositories added from a link couldn’t be checked',
    error_title: 'The last check failed',
    rate_low: 'Few GitHub requests left ({n}): checks wait until the limit resets {d}',
    install_all: 'Update all ({n})',
    installing_one: 'Installing… {n} left',
    installing_many: 'Installing… {n} left',
    installing_short: 'Installing…',
    confirm_one: 'Install {n} update?',
    confirm_many: 'Install {n} updates?',
    confirm_hint: 'One after the other. Integrations need a restart of Home Assistant afterwards.',
    cancel: 'Cancel',
    install: 'Install',
    install_failed_title: 'Could not be installed',
    version: '{from} → {to}',
    ed_entity: 'Marketplace Refresh sensor',
    ed_entity_helper: 'Status sensor; leave empty to find it automatically',
    ed_title: 'Title',
    ed_show_title: 'Show title',
    ed_show_subtitle: 'Show subtitle',
    ed_show_next_check: 'Show the next check',
    ed_title_helper: 'Leave empty for “Marketplace updates”',
    ed_show_updates: 'Updates available',
    ed_show_updates_helper: 'The repositories with an update, from their Marketplace update entities',
    ed_show_system_updates: 'System updates',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), the apps and the device firmware with an update; a row opens it to install it',
    ed_show_failed: 'Repositories that could not be checked',
    ed_show_failed_helper: 'And the error of a check that failed',
    ed_check_button: '“Check for updates” button',
    ed_check_button_helper: 'Starts a check from the header',
    ed_install_button: '“Update all” button',
    ed_install_button_helper: 'Installs every update listed, after a confirmation (administrators only)',
    ed_hide_when_ok: 'Hide the card when everything is up to date',
    ed_hide_when_ok_helper: 'The card only appears while checking, or with an update or an error',
    ed_language: 'Language',
    ed_language_helper: 'Leave empty to follow Home Assistant',
  },
  fr: {
    title: 'Mises à jour Marketplace',
    up_to_date: 'À jour',
    updates_one: '{n} mise à jour',
    updates_many: '{n} mises à jour',
    checking: 'Vérification {done}/{total}',
    checking_short: 'Vérification…',
    error: 'Erreur',
    failed_one: '{n} en échec',
    failed_many: '{n} en échec',
    not_loaded: 'Marketplace Refresh n’est pas configuré',
    unavailable: 'Indisponible',
    never_checked: 'Pas encore vérifié',
    checked: 'Vérifié {d}',
    next: 'prochaine {d}',
    auto_off: 'vérification automatique désactivée',
    check_now: 'Rechercher les mises à jour',
    updates_title: 'Mises à jour disponibles',
    system_title: 'Mises à jour système',
    no_details: 'Le Marketplace n’est pas chargé : pas de détail sur ces mises à jour',
    failed_title: 'Impossible à vérifier',
    no_github: 'GitHub n’est pas connecté au Marketplace : les dépôts ajoutés depuis un lien n’ont pas pu être vérifiés',
    error_title: 'La dernière vérification a échoué',
    rate_low: 'Peu de requêtes GitHub restantes ({n}) : les vérifications attendent la remise à zéro {d}',
    install_all: 'Tout mettre à jour ({n})',
    installing_one: 'Installation… {n} restante',
    installing_many: 'Installation… {n} restantes',
    installing_short: 'Installation…',
    confirm_one: 'Installer {n} mise à jour ?',
    confirm_many: 'Installer {n} mises à jour ?',
    confirm_hint: 'L’une après l’autre. Les intégrations demandent ensuite un redémarrage de Home Assistant.',
    cancel: 'Annuler',
    install: 'Installer',
    install_failed_title: 'Installation impossible',
    version: '{from} → {to}',
    ed_entity: 'Capteur Marketplace Refresh',
    ed_entity_helper: 'Capteur de statut ; laisser vide pour le trouver automatiquement',
    ed_title: 'Titre',
    ed_show_title: 'Afficher le titre',
    ed_show_subtitle: 'Afficher le sous-titre',
    ed_show_next_check: 'Afficher la prochaine vérification',
    ed_title_helper: 'Laisser vide pour « Mises à jour Marketplace »',
    ed_show_updates: 'Mises à jour disponibles',
    ed_show_updates_helper: 'Les dépôts avec une mise à jour, d’après leurs entités de mise à jour du Marketplace',
    ed_show_system_updates: 'Mises à jour système',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), les applications et les firmwares d’appareils avec une mise à jour ; une ligne l’ouvre pour l’installer',
    ed_show_failed: 'Dépôts impossibles à vérifier',
    ed_show_failed_helper: 'Et l’erreur d’une vérification qui a échoué',
    ed_check_button: 'Bouton « Rechercher les mises à jour »',
    ed_check_button_helper: 'Lance une vérification depuis l’en-tête',
    ed_install_button: 'Bouton « Tout mettre à jour »',
    ed_install_button_helper: 'Installe toutes les mises à jour listées, après confirmation (administrateurs uniquement)',
    ed_hide_when_ok: 'Masquer la carte quand tout est à jour',
    ed_hide_when_ok_helper: 'La carte n’apparaît que pendant une vérification, ou avec une mise à jour ou une erreur',
    ed_language: 'Langue',
    ed_language_helper: 'Laisser vide pour suivre Home Assistant',
  },
  de: {
    title: 'Marketplace-Updates',
    up_to_date: 'Aktuell',
    updates_one: '{n} Update',
    updates_many: '{n} Updates',
    checking: 'Prüfung {done}/{total}',
    checking_short: 'Prüfung läuft…',
    error: 'Fehler',
    failed_one: '{n} fehlgeschlagen',
    failed_many: '{n} fehlgeschlagen',
    not_loaded: 'Marketplace Refresh ist nicht eingerichtet',
    unavailable: 'Nicht verfügbar',
    never_checked: 'Noch nicht geprüft',
    checked: 'Geprüft {d}',
    next: 'nächste {d}',
    auto_off: 'automatische Prüfung aus',
    check_now: 'Nach Updates suchen',
    updates_title: 'Verfügbare Updates',
    system_title: 'System-Updates',
    no_details: 'Marketplace ist nicht geladen: keine Details zu diesen Updates',
    failed_title: 'Konnten nicht geprüft werden',
    no_github: 'GitHub ist nicht mit dem Marketplace verbunden: die über einen Link hinzugefügten Repositorys konnten nicht geprüft werden',
    error_title: 'Die letzte Prüfung ist fehlgeschlagen',
    rate_low: 'Wenige GitHub-Anfragen übrig ({n}): Prüfungen warten bis zum Zurücksetzen {d}',
    install_all: 'Alle aktualisieren ({n})',
    installing_one: 'Installation… {n} übrig',
    installing_many: 'Installation… {n} übrig',
    installing_short: 'Installation…',
    confirm_one: '{n} Update installieren?',
    confirm_many: '{n} Updates installieren?',
    confirm_hint: 'Nacheinander. Integrationen erfordern danach einen Neustart von Home Assistant.',
    cancel: 'Abbrechen',
    install: 'Installieren',
    install_failed_title: 'Nicht installierbar',
    version: '{from} → {to}',
    ed_entity: 'Marketplace-Refresh-Sensor',
    ed_entity_helper: 'Statussensor; leer lassen, um ihn automatisch zu finden',
    ed_title: 'Titel',
    ed_show_title: 'Titel anzeigen',
    ed_show_subtitle: 'Untertitel anzeigen',
    ed_show_next_check: 'Nächste Prüfung anzeigen',
    ed_title_helper: 'Leer lassen für „Marketplace-Updates“',
    ed_show_updates: 'Verfügbare Updates',
    ed_show_updates_helper: 'Die Marketplace-Repositorys mit einem Update, aus ihren Update-Entitäten',
    ed_show_system_updates: 'System-Updates',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), die Apps und die Geräte-Firmware mit einem Update; eine Zeile öffnet es zur Installation',
    ed_show_failed: 'Nicht prüfbare Repositorys',
    ed_show_failed_helper: 'Und der Fehler einer fehlgeschlagenen Prüfung',
    ed_check_button: 'Schaltfläche „Nach Updates suchen“',
    ed_check_button_helper: 'Startet eine Prüfung aus der Kopfzeile',
    ed_install_button: 'Schaltfläche „Alle aktualisieren“',
    ed_install_button_helper: 'Installiert alle aufgeführten Updates nach einer Bestätigung (nur Administratoren)',
    ed_hide_when_ok: 'Karte ausblenden, wenn alles aktuell ist',
    ed_hide_when_ok_helper: 'Die Karte erscheint nur während einer Prüfung oder bei einem Update oder Fehler',
    ed_language: 'Sprache',
    ed_language_helper: 'Leer lassen, um Home Assistant zu folgen',
  },
  es: {
    title: 'Actualizaciones de Marketplace',
    up_to_date: 'Al día',
    updates_one: '{n} actualización',
    updates_many: '{n} actualizaciones',
    checking: 'Comprobando {done}/{total}',
    checking_short: 'Comprobando…',
    error: 'Error',
    failed_one: '{n} con error',
    failed_many: '{n} con error',
    not_loaded: 'Marketplace Refresh no está configurado',
    unavailable: 'No disponible',
    never_checked: 'Aún sin comprobar',
    checked: 'Comprobado {d}',
    next: 'próxima {d}',
    auto_off: 'comprobación automática desactivada',
    check_now: 'Buscar actualizaciones',
    updates_title: 'Actualizaciones disponibles',
    system_title: 'Actualizaciones del sistema',
    no_details: 'Marketplace no está cargado: sin detalles de estas actualizaciones',
    failed_title: 'No se pudieron comprobar',
    no_github: 'GitHub no está conectado al Marketplace: los repositorios añadidos desde un enlace no se pudieron comprobar',
    error_title: 'La última comprobación falló',
    rate_low: 'Quedan pocas solicitudes de GitHub ({n}): las comprobaciones esperan al restablecimiento {d}',
    install_all: 'Actualizar todo ({n})',
    installing_one: 'Instalando… queda {n}',
    installing_many: 'Instalando… quedan {n}',
    installing_short: 'Instalando…',
    confirm_one: '¿Instalar {n} actualización?',
    confirm_many: '¿Instalar {n} actualizaciones?',
    confirm_hint: 'Una tras otra. Las integraciones requieren después reiniciar Home Assistant.',
    cancel: 'Cancelar',
    install: 'Instalar',
    install_failed_title: 'No se pudieron instalar',
    version: '{from} → {to}',
    ed_entity: 'Sensor de Marketplace Refresh',
    ed_entity_helper: 'Sensor de estado; déjalo vacío para encontrarlo automáticamente',
    ed_title: 'Título',
    ed_show_title: 'Mostrar el título',
    ed_show_subtitle: 'Mostrar el subtítulo',
    ed_show_next_check: 'Mostrar la próxima comprobación',
    ed_title_helper: 'Déjalo vacío para «Actualizaciones de Marketplace»',
    ed_show_updates: 'Actualizaciones disponibles',
    ed_show_updates_helper: 'Los repositorios de Marketplace con una actualización, según sus entidades de actualización',
    ed_show_system_updates: 'Actualizaciones del sistema',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), las aplicaciones y el firmware de dispositivos con una actualización; una fila la abre para instalarla',
    ed_show_failed: 'Repositorios que no se pudieron comprobar',
    ed_show_failed_helper: 'Y el error de una comprobación fallida',
    ed_check_button: 'Botón «Buscar actualizaciones»',
    ed_check_button_helper: 'Lanza una comprobación desde la cabecera',
    ed_install_button: 'Botón «Actualizar todo»',
    ed_install_button_helper: 'Instala todas las actualizaciones listadas, tras una confirmación (solo administradores)',
    ed_hide_when_ok: 'Ocultar la tarjeta cuando todo esté al día',
    ed_hide_when_ok_helper: 'La tarjeta solo aparece durante una comprobación, o con una actualización o un error',
    ed_language: 'Idioma',
    ed_language_helper: 'Déjalo vacío para seguir a Home Assistant',
  },
  sr: {
    title: 'Marketplace ажурирања',
    up_to_date: 'Ажурирано',
    updates_one: '{n} ажурирање',
    updates_many: '{n} ажурирања',
    checking: 'Провера {done}/{total}',
    checking_short: 'Проверавање…',
    error: 'Грешка',
    failed_one: '{n} неуспешан',
    failed_few: '{n} неуспешна',
    failed_many: '{n} неуспешних',
    not_loaded: 'Marketplace Refresh није подешен',
    unavailable: 'Недоступно',
    never_checked: 'Још није проверено',
    checked: 'Проверено {d}',
    next: 'следећа {d}',
    auto_off: 'аутоматска провера искључена',
    check_now: 'Провери ажурирања',
    updates_title: 'Доступна ажурирања',
    system_title: 'Системска ажурирања',
    no_details: 'Marketplace није учитан: нема детаља о овим ажурирањима',
    failed_title: 'Није могуће проверити',
    no_github: 'GitHub није повезан са Marketplace-ом: репозиторијуми додати преко линка нису могли бити проверени',
    error_title: 'Последња провера није успела',
    rate_low: 'Мало преосталих GitHub захтева ({n}): провере чекају ресетовање {d}',
    install_all: 'Ажурирај све ({n})',
    installing_one: 'Инсталирање… преостало {n}',
    installing_few: 'Инсталирање… преостала {n}',
    installing_many: 'Инсталирање… преостало {n}',
    installing_short: 'Инсталирање…',
    confirm_one: 'Инсталирати {n} ажурирање?',
    confirm_many: 'Инсталирати {n} ажурирања?',
    confirm_hint: 'Једно за другим. Интеграције након тога захтевају поновно покретање Home Assistant-а.',
    cancel: 'Откажи',
    install: 'Инсталирај',
    install_failed_title: 'Није могуће инсталирати',
    version: '{from} → {to}',
    ed_entity: 'Marketplace Refresh сензор',
    ed_entity_helper: 'Сензор статуса; оставите празно да би се аутоматски пронашао',
    ed_title: 'Наслов',
    ed_show_title: 'Прикажи наслов',
    ed_show_subtitle: 'Прикажи поднаслов',
    ed_show_next_check: 'Прикажи следећу проверу',
    ed_title_helper: 'Оставите празно за „Marketplace ажурирања“',
    ed_show_updates: 'Доступна ажурирања',
    ed_show_updates_helper: 'Marketplace репозиторијуми са ажурирањем, према њиховим ентитетима ажурирања',
    ed_show_system_updates: 'Системска ажурирања',
    ed_show_system_updates_helper: 'Home Assistant, апликације и фирмвер уређаја са ажурирањем; ред га отвара за инсталацију',
    ed_show_failed: 'Репозиторијуми које није могуће проверити',
    ed_show_failed_helper: 'И грешка провере која није успела',
    ed_check_button: 'Дугме „Провери ажурирања“',
    ed_check_button_helper: 'Покреће проверу из заглавља',
    ed_install_button: 'Дугме „Ажурирај све“',
    ed_install_button_helper: 'Инсталира сва наведена ажурирања, након потврде (само администратори)',
    ed_hide_when_ok: 'Сакриј картицу када је све ажурирано',
    ed_hide_when_ok_helper: 'Картица се појављује само током провере, или када постоји ажурирање или грешка',
    ed_language: 'Језик',
    ed_language_helper: 'Оставите празно да бисте пратили Home Assistant',
  },
  'sr-Latn': {
    title: 'Marketplace ažuriranja',
    up_to_date: 'Ažurirano',
    updates_one: '{n} ažuriranje',
    updates_many: '{n} ažuriranja',
    checking: 'Provera {done}/{total}',
    checking_short: 'Proveravanje…',
    error: 'Greška',
    failed_one: '{n} neuspešan',
    failed_few: '{n} neuspešna',
    failed_many: '{n} neuspešnih',
    not_loaded: 'Marketplace Refresh nije podešen',
    unavailable: 'Nedostupno',
    never_checked: 'Još nije provereno',
    checked: 'Provereno {d}',
    next: 'sledeća {d}',
    auto_off: 'automatska provera isključena',
    check_now: 'Proveri ažuriranja',
    updates_title: 'Dostupna ažuriranja',
    system_title: 'Sistemska ažuriranja',
    no_details: 'Marketplace nije učitan: nema detalja o ovim ažuriranjima',
    failed_title: 'Nije moguće proveriti',
    no_github: 'GitHub nije povezan sa Marketplace-om: repozitorijumi dodati preko linka nisu mogli biti provereni',
    error_title: 'Poslednja provera nije uspela',
    rate_low: 'Malo preostalih GitHub zahteva ({n}): provere čekaju resetovanje {d}',
    install_all: 'Ažuriraj sve ({n})',
    installing_one: 'Instaliranje… preostalo {n}',
    installing_few: 'Instaliranje… preostala {n}',
    installing_many: 'Instaliranje… preostalo {n}',
    installing_short: 'Instaliranje…',
    confirm_one: 'Instalirati {n} ažuriranje?',
    confirm_many: 'Instalirati {n} ažuriranja?',
    confirm_hint: 'Jedno za drugim. Integracije nakon toga zahtevaju ponovno pokretanje Home Assistant-a.',
    cancel: 'Otkaži',
    install: 'Instaliraj',
    install_failed_title: 'Nije moguće instalirati',
    version: '{from} → {to}',
    ed_entity: 'Marketplace Refresh senzor',
    ed_entity_helper: 'Senzor statusa; ostavite prazno da bi se automatski pronašao',
    ed_title: 'Naslov',
    ed_show_title: 'Prikaži naslov',
    ed_show_subtitle: 'Prikaži podnaslov',
    ed_show_next_check: 'Prikaži sledeću proveru',
    ed_title_helper: 'Ostavite prazno za „Marketplace ažuriranja“',
    ed_show_updates: 'Dostupna ažuriranja',
    ed_show_updates_helper: 'Marketplace repozitorijumi sa ažuriranjem, prema njihovim entitetima ažuriranja',
    ed_show_system_updates: 'Sistemska ažuriranja',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), aplikacije i firmver uređaja sa ažuriranjem; red ga otvara za instalaciju',
    ed_show_failed: 'Repozitorijumi koje nije moguće proveriti',
    ed_show_failed_helper: 'I greška provere koja nije uspela',
    ed_check_button: 'Dugme „Proveri ažuriranja“',
    ed_check_button_helper: 'Pokreće proveru iz zaglavlja',
    ed_install_button: 'Dugme „Ažuriraj sve“',
    ed_install_button_helper: 'Instalira sva navedena ažuriranja, nakon potvrde (samo administratori)',
    ed_hide_when_ok: 'Sakrij karticu kada je sve ažurirano',
    ed_hide_when_ok_helper: 'Kartica se pojavljuje samo tokom provere, ili kada postoji ažuriranje ili greška',
    ed_language: 'Jezik',
    ed_language_helper: 'Ostavite prazno da biste pratili Home Assistant',
  },
  it: {
    title: 'Aggiornamenti Marketplace',
    up_to_date: 'Aggiornato',
    updates_one: '{n} aggiornamento',
    updates_many: '{n} aggiornamenti',
    checking: 'Verifica {done}/{total}',
    checking_short: 'Verifica in corso…',
    error: 'Errore',
    failed_one: '{n} fallito',
    failed_many: '{n} falliti',
    not_loaded: 'Marketplace Refresh non è configurato',
    unavailable: 'Non disponibile',
    never_checked: 'Non ancora verificato',
    checked: 'Verificato {d}',
    next: 'prossima {d}',
    auto_off: 'verifica automatica disattivata',
    check_now: 'Cerca aggiornamenti',
    updates_title: 'Aggiornamenti disponibili',
    system_title: 'Aggiornamenti di sistema',
    no_details: 'Marketplace non è caricato: nessun dettaglio su questi aggiornamenti',
    failed_title: 'Impossibile verificare',
    no_github: 'GitHub non è connesso al Marketplace: i repository aggiunti da un link non sono stati verificati',
    error_title: 'L’ultima verifica non è riuscita',
    rate_low: 'Poche richieste GitHub rimaste ({n}): i controlli attendono l\'azzeramento {d}',
    install_all: 'Aggiorna tutto ({n})',
    installing_one: 'Installazione… {n} rimanente',
    installing_many: 'Installazione… {n} rimanenti',
    installing_short: 'Installazione…',
    confirm_one: 'Installare {n} aggiornamento?',
    confirm_many: 'Installare {n} aggiornamenti?',
    confirm_hint: 'Uno dopo l’altro. Le integrazioni richiedono poi un riavvio di Home Assistant.',
    cancel: 'Annulla',
    install: 'Installa',
    install_failed_title: 'Impossibile installare',
    version: '{from} → {to}',
    ed_entity: 'Sensore Marketplace Refresh',
    ed_entity_helper: 'Sensore di stato; lascia vuoto per trovarlo automaticamente',
    ed_title: 'Titolo',
    ed_show_title: 'Mostra il titolo',
    ed_show_subtitle: 'Mostra il sottotitolo',
    ed_show_next_check: 'Mostra il prossimo controllo',
    ed_title_helper: 'Lascia vuoto per «Aggiornamenti Marketplace»',
    ed_show_updates: 'Aggiornamenti disponibili',
    ed_show_updates_helper: 'I repository Marketplace con un aggiornamento, dalle loro entità di aggiornamento',
    ed_show_system_updates: 'Aggiornamenti di sistema',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), le app e i firmware dei dispositivi con un aggiornamento; una riga lo apre per installarlo',
    ed_show_failed: 'Repository che non è stato possibile verificare',
    ed_show_failed_helper: 'E l’errore di una verifica non riuscita',
    ed_check_button: 'Pulsante «Cerca aggiornamenti»',
    ed_check_button_helper: 'Avvia una verifica dall’intestazione',
    ed_install_button: 'Pulsante «Aggiorna tutto»',
    ed_install_button_helper: 'Installa tutti gli aggiornamenti elencati, dopo una conferma (solo amministratori)',
    ed_hide_when_ok: 'Nascondi la scheda quando è tutto aggiornato',
    ed_hide_when_ok_helper: 'La scheda appare solo durante una verifica, o con un aggiornamento o un errore',
    ed_language: 'Lingua',
    ed_language_helper: 'Lascia vuoto per seguire Home Assistant',
  },
  nl: {
    title: 'Marketplace-updates',
    up_to_date: 'Up-to-date',
    updates_one: '{n} update',
    updates_many: '{n} updates',
    checking: 'Controleren {done}/{total}',
    checking_short: 'Controleren…',
    error: 'Fout',
    failed_one: '{n} mislukt',
    failed_many: '{n} mislukt',
    not_loaded: 'Marketplace Refresh is niet ingesteld',
    unavailable: 'Niet beschikbaar',
    never_checked: 'Nog niet gecontroleerd',
    checked: 'Gecontroleerd {d}',
    next: 'volgende {d}',
    auto_off: 'automatische controle uit',
    check_now: 'Controleren op updates',
    updates_title: 'Beschikbare updates',
    system_title: 'Systeemupdates',
    no_details: 'Marketplace is niet geladen: geen details over deze updates',
    failed_title: 'Kon niet worden gecontroleerd',
    no_github: 'GitHub is niet verbonden met de Marketplace: de via een link toegevoegde repository’s konden niet worden gecontroleerd',
    error_title: 'De laatste controle is mislukt',
    rate_low: 'Weinig GitHub-verzoeken over ({n}): controles wachten tot de limiet reset {d}',
    install_all: 'Alles bijwerken ({n})',
    installing_one: 'Installeren… nog {n}',
    installing_many: 'Installeren… nog {n}',
    installing_short: 'Installeren…',
    confirm_one: '{n} update installeren?',
    confirm_many: '{n} updates installeren?',
    confirm_hint: 'De een na de ander. Integraties vereisen daarna een herstart van Home Assistant.',
    cancel: 'Annuleren',
    install: 'Installeren',
    install_failed_title: 'Kon niet worden geïnstalleerd',
    version: '{from} → {to}',
    ed_entity: 'Marketplace Refresh-sensor',
    ed_entity_helper: 'Statussensor; laat leeg om hem automatisch te vinden',
    ed_title: 'Titel',
    ed_show_title: 'Titel tonen',
    ed_show_subtitle: 'Ondertitel tonen',
    ed_show_next_check: 'Volgende controle tonen',
    ed_title_helper: 'Laat leeg voor “Marketplace-updates”',
    ed_show_updates: 'Beschikbare updates',
    ed_show_updates_helper: 'De Marketplace-repository’s met een update, volgens hun update-entiteiten',
    ed_show_system_updates: 'Systeemupdates',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), de apps en de apparaatfirmware met een update; een rij opent hem om te installeren',
    ed_show_failed: 'Repository’s die niet konden worden gecontroleerd',
    ed_show_failed_helper: 'En de fout van een mislukte controle',
    ed_check_button: 'Knop “Controleren op updates”',
    ed_check_button_helper: 'Start een controle vanuit de koptekst',
    ed_install_button: 'Knop “Alles bijwerken”',
    ed_install_button_helper: 'Installeert alle vermelde updates, na een bevestiging (alleen beheerders)',
    ed_hide_when_ok: 'Kaart verbergen als alles up-to-date is',
    ed_hide_when_ok_helper: 'De kaart verschijnt alleen tijdens een controle, of bij een update of een fout',
    ed_language: 'Taal',
    ed_language_helper: 'Laat leeg om Home Assistant te volgen',
  },
  pt: {
    title: 'Atualizações Marketplace',
    up_to_date: 'Atualizado',
    updates_one: '{n} atualização',
    updates_many: '{n} atualizações',
    checking: 'A verificar {done}/{total}',
    checking_short: 'A verificar…',
    error: 'Erro',
    failed_one: '{n} falhou',
    failed_many: '{n} falharam',
    not_loaded: 'Marketplace Refresh não configurado',
    unavailable: 'Indisponível',
    never_checked: 'Ainda não verificado',
    checked: 'Verificado {d}',
    next: 'próxima {d}',
    auto_off: 'verificação automática desativada',
    check_now: 'Procurar atualizações',
    updates_title: 'Atualizações disponíveis',
    system_title: 'Atualizações do sistema',
    no_details: 'O Marketplace não está carregado: sem detalhes sobre estas atualizações',
    failed_title: 'Não foi possível verificar',
    no_github: 'O GitHub não está ligado ao Marketplace: os repositórios adicionados por ligação não puderam ser verificados',
    error_title: 'A última verificação falhou',
    rate_low: 'Poucos pedidos ao GitHub restantes ({n}): as verificações esperam pela reposição {d}',
    install_all: 'Atualizar tudo ({n})',
    installing_one: 'A instalar… falta {n}',
    installing_many: 'A instalar… faltam {n}',
    installing_short: 'A instalar…',
    confirm_one: 'Instalar {n} atualização?',
    confirm_many: 'Instalar {n} atualizações?',
    confirm_hint: 'Uma após a outra. As integrações precisam depois de um reinício do Home Assistant.',
    cancel: 'Cancelar',
    install: 'Instalar',
    install_failed_title: 'Não foi possível instalar',
    version: '{from} → {to}',
    ed_entity: 'Sensor Marketplace Refresh',
    ed_entity_helper: 'Sensor de estado; deixe vazio para o encontrar automaticamente',
    ed_title: 'Título',
    ed_show_title: 'Mostrar o título',
    ed_show_subtitle: 'Mostrar o subtítulo',
    ed_show_next_check: 'Mostrar a próxima verificação',
    ed_title_helper: 'Deixe vazio para «Atualizações Marketplace»',
    ed_show_updates: 'Atualizações disponíveis',
    ed_show_updates_helper: 'Os repositórios Marketplace com uma atualização, segundo as suas entidades de atualização',
    ed_show_system_updates: 'Atualizações do sistema',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), as aplicações e o firmware dos dispositivos com uma atualização; uma linha abre-a para a instalar',
    ed_show_failed: 'Repositórios que não foi possível verificar',
    ed_show_failed_helper: 'E o erro de uma verificação que falhou',
    ed_check_button: 'Botão «Procurar atualizações»',
    ed_check_button_helper: 'Inicia uma verificação a partir do cabeçalho',
    ed_install_button: 'Botão «Atualizar tudo»',
    ed_install_button_helper: 'Instala todas as atualizações listadas, após confirmação (apenas administradores)',
    ed_hide_when_ok: 'Ocultar o cartão quando tudo estiver atualizado',
    ed_hide_when_ok_helper: 'O cartão só aparece durante uma verificação, ou com uma atualização ou um erro',
    ed_language: 'Idioma',
    ed_language_helper: 'Deixe vazio para seguir o Home Assistant',
  },
  pl: {
    title: 'Aktualizacje Marketplace',
    up_to_date: 'Aktualne',
    updates_one: '{n} aktualizacja',
    updates_few: '{n} aktualizacje',
    updates_many: '{n} aktualizacji',
    checking: 'Sprawdzanie {done}/{total}',
    checking_short: 'Sprawdzanie…',
    error: 'Błąd',
    failed_one: 'Nieudane: {n}',
    failed_many: 'Nieudane: {n}',
    not_loaded: 'Marketplace Refresh nieskonfigurowany',
    unavailable: 'Niedostępne',
    never_checked: 'Jeszcze nie sprawdzono',
    checked: 'Sprawdzono {d}',
    next: 'następne {d}',
    auto_off: 'automatyczne sprawdzanie wyłączone',
    check_now: 'Sprawdź aktualizacje',
    updates_title: 'Dostępne aktualizacje',
    system_title: 'Aktualizacje systemu',
    no_details: 'Marketplace nie jest załadowany: brak szczegółów tych aktualizacji',
    failed_title: 'Nie udało się sprawdzić',
    no_github: 'GitHub nie jest połączony z Marketplace: repozytoria dodane z linku nie mogły zostać sprawdzone',
    error_title: 'Ostatnie sprawdzanie nie powiodło się',
    rate_low: 'Mało pozostałych żądań GitHub ({n}): sprawdzenia czekają na reset limitu {d}',
    install_all: 'Zaktualizuj wszystko ({n})',
    installing_one: 'Instalowanie… pozostało: {n}',
    installing_many: 'Instalowanie… pozostało: {n}',
    installing_short: 'Instalowanie…',
    confirm_one: 'Zainstalować {n} aktualizację?',
    confirm_few: 'Zainstalować {n} aktualizacje?',
    confirm_many: 'Zainstalować {n} aktualizacji?',
    confirm_hint: 'Jedna po drugiej. Integracje wymagają potem ponownego uruchomienia Home Assistant.',
    cancel: 'Anuluj',
    install: 'Zainstaluj',
    install_failed_title: 'Nie udało się zainstalować',
    version: '{from} → {to}',
    ed_entity: 'Czujnik Marketplace Refresh',
    ed_entity_helper: 'Czujnik stanu; pozostaw puste, aby znaleźć go automatycznie',
    ed_title: 'Tytuł',
    ed_show_title: 'Pokaż tytuł',
    ed_show_subtitle: 'Pokaż podtytuł',
    ed_show_next_check: 'Pokaż następne sprawdzenie',
    ed_title_helper: 'Pozostaw puste dla „Aktualizacje Marketplace”',
    ed_show_updates: 'Dostępne aktualizacje',
    ed_show_updates_helper: 'Repozytoria Marketplace z aktualizacją, według ich encji aktualizacji',
    ed_show_system_updates: 'Aktualizacje systemu',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), aplikacje i oprogramowanie urządzeń z aktualizacją; wiersz otwiera ją do instalacji',
    ed_show_failed: 'Repozytoria, których nie udało się sprawdzić',
    ed_show_failed_helper: 'Oraz błąd nieudanego sprawdzania',
    ed_check_button: 'Przycisk „Sprawdź aktualizacje”',
    ed_check_button_helper: 'Uruchamia sprawdzanie z nagłówka',
    ed_install_button: 'Przycisk „Zaktualizuj wszystko”',
    ed_install_button_helper: 'Instaluje wszystkie wymienione aktualizacje po potwierdzeniu (tylko administratorzy)',
    ed_hide_when_ok: 'Ukryj kartę, gdy wszystko jest aktualne',
    ed_hide_when_ok_helper: 'Karta pojawia się tylko podczas sprawdzania albo gdy jest aktualizacja lub błąd',
    ed_language: 'Język',
    ed_language_helper: 'Pozostaw puste, aby używać języka Home Assistant',
  },
  ro: {
    title: 'Actualizări Marketplace',
    up_to_date: 'La zi',
    updates_one: '{n} actualizare',
    updates_many: 'Actualizări: {n}',
    checking: 'Verificare {done}/{total}',
    checking_short: 'Se verifică…',
    error: 'Eroare',
    failed_one: '{n} eșuat',
    failed_many: 'Eșuate: {n}',
    not_loaded: 'Marketplace Refresh nu este configurat',
    unavailable: 'Indisponibil',
    never_checked: 'Încă neverificat',
    checked: 'Verificat {d}',
    next: 'următoarea {d}',
    auto_off: 'verificare automată dezactivată',
    check_now: 'Caută actualizări',
    updates_title: 'Actualizări disponibile',
    system_title: 'Actualizări de sistem',
    no_details: 'Marketplace nu este încărcat: nu există detalii despre aceste actualizări',
    failed_title: 'Nu au putut fi verificate',
    no_github: 'GitHub nu este conectat la Marketplace: depozitele adăugate dintr-un link nu au putut fi verificate',
    error_title: 'Ultima verificare a eșuat',
    rate_low: 'Puține cereri GitHub rămase ({n}): verificările așteaptă resetarea {d}',
    install_all: 'Actualizează tot ({n})',
    installing_one: 'Se instalează… mai rămâne {n}',
    installing_many: 'Se instalează… rămase: {n}',
    installing_short: 'Se instalează…',
    confirm_one: 'Instalați {n} actualizare?',
    confirm_many: 'Instalați actualizările ({n})?',
    confirm_hint: 'Una după alta. Integrările necesită apoi o repornire a Home Assistant.',
    cancel: 'Anulează',
    install: 'Instalează',
    install_failed_title: 'Nu au putut fi instalate',
    version: '{from} → {to}',
    ed_entity: 'Senzor Marketplace Refresh',
    ed_entity_helper: 'Senzorul de stare; lăsați gol pentru a-l găsi automat',
    ed_title: 'Titlu',
    ed_show_title: 'Afișează titlul',
    ed_show_subtitle: 'Afișează subtitlul',
    ed_show_next_check: 'Afișează următoarea verificare',
    ed_title_helper: 'Lăsați gol pentru „Actualizări Marketplace”',
    ed_show_updates: 'Actualizări disponibile',
    ed_show_updates_helper: 'Depozitele Marketplace cu o actualizare, după entitățile lor de actualizare',
    ed_show_system_updates: 'Actualizări de sistem',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), aplicațiile și firmware-ul dispozitivelor cu o actualizare; un rând o deschide pentru instalare',
    ed_show_failed: 'Depozite care nu au putut fi verificate',
    ed_show_failed_helper: 'Și eroarea unei verificări eșuate',
    ed_check_button: 'Butonul „Caută actualizări”',
    ed_check_button_helper: 'Pornește o verificare din antet',
    ed_install_button: 'Butonul „Actualizează tot”',
    ed_install_button_helper: 'Instalează toate actualizările listate, după confirmare (doar administratori)',
    ed_hide_when_ok: 'Ascunde cardul când totul este la zi',
    ed_hide_when_ok_helper: 'Cardul apare doar în timpul unei verificări sau când există o actualizare ori o eroare',
    ed_language: 'Limbă',
    ed_language_helper: 'Lăsați gol pentru a urma Home Assistant',
  },
  da: {
    title: 'Marketplace-opdateringer',
    up_to_date: 'Opdateret',
    updates_one: '{n} opdatering',
    updates_many: '{n} opdateringer',
    checking: 'Kontrollerer {done}/{total}',
    checking_short: 'Kontrollerer…',
    error: 'Fejl',
    failed_one: '{n} mislykkedes',
    failed_many: '{n} mislykkedes',
    not_loaded: 'Marketplace Refresh er ikke konfigureret',
    unavailable: 'Ikke tilgængelig',
    never_checked: 'Ikke kontrolleret endnu',
    checked: 'Kontrolleret {d}',
    next: 'næste {d}',
    auto_off: 'automatisk kontrol slået fra',
    check_now: 'Søg efter opdateringer',
    updates_title: 'Tilgængelige opdateringer',
    system_title: 'Systemopdateringer',
    no_details: 'Marketplace er ikke indlæst: ingen detaljer om disse opdateringer',
    failed_title: 'Kunne ikke kontrolleres',
    no_github: 'GitHub er ikke forbundet til Marketplace: repositories tilføjet fra et link kunne ikke tjekkes',
    error_title: 'Den seneste kontrol mislykkedes',
    rate_low: 'Få GitHub-forespørgsler tilbage ({n}): tjek venter på nulstillingen {d}',
    install_all: 'Opdater alle ({n})',
    installing_one: 'Installerer… {n} tilbage',
    installing_many: 'Installerer… {n} tilbage',
    installing_short: 'Installerer…',
    confirm_one: 'Installer {n} opdatering?',
    confirm_many: 'Installer {n} opdateringer?',
    confirm_hint: 'Én ad gangen. Integrationer kræver derefter en genstart af Home Assistant.',
    cancel: 'Annuller',
    install: 'Installer',
    install_failed_title: 'Kunne ikke installeres',
    version: '{from} → {to}',
    ed_entity: 'Marketplace Refresh-sensor',
    ed_entity_helper: 'Statussensor; lad stå tomt for at finde den automatisk',
    ed_title: 'Titel',
    ed_show_title: 'Vis titel',
    ed_show_subtitle: 'Vis undertitel',
    ed_show_next_check: 'Vis næste kontrol',
    ed_title_helper: 'Lad stå tomt for “Marketplace-opdateringer”',
    ed_show_updates: 'Tilgængelige opdateringer',
    ed_show_updates_helper: 'Marketplace-repositories med en opdatering, ifølge deres opdateringsentiteter',
    ed_show_system_updates: 'Systemopdateringer',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), apps og enhedsfirmware med en opdatering; en række åbner den til installation',
    ed_show_failed: 'Repositories, der ikke kunne kontrolleres',
    ed_show_failed_helper: 'Og fejlen fra en mislykket kontrol',
    ed_check_button: 'Knappen “Søg efter opdateringer”',
    ed_check_button_helper: 'Starter en kontrol fra overskriften',
    ed_install_button: 'Knappen “Opdater alle”',
    ed_install_button_helper: 'Installerer alle viste opdateringer efter en bekræftelse (kun administratorer)',
    ed_hide_when_ok: 'Skjul kortet, når alt er opdateret',
    ed_hide_when_ok_helper: 'Kortet vises kun under en kontrol, eller når der er en opdatering eller en fejl',
    ed_language: 'Sprog',
    ed_language_helper: 'Lad stå tomt for at følge Home Assistant',
  },
  sv: {
    title: 'Marketplace-uppdateringar',
    up_to_date: 'Uppdaterad',
    updates_one: '{n} uppdatering',
    updates_many: '{n} uppdateringar',
    checking: 'Kontrollerar {done}/{total}',
    checking_short: 'Kontrollerar…',
    error: 'Fel',
    failed_one: '{n} misslyckades',
    failed_many: '{n} misslyckades',
    not_loaded: 'Marketplace Refresh är inte konfigurerat',
    unavailable: 'Inte tillgänglig',
    never_checked: 'Inte kontrollerad än',
    checked: 'Kontrollerad {d}',
    next: 'nästa {d}',
    auto_off: 'automatisk kontroll avstängd',
    check_now: 'Sök efter uppdateringar',
    updates_title: 'Uppdateringar',
    system_title: 'Systemuppdateringar',
    no_details: 'Marketplace är inte inläst: inga detaljer om dessa uppdateringar',
    failed_title: 'Kunde inte kontrolleras',
    no_github: 'GitHub är inte anslutet till Marketplace: repositorier som lagts till från en länk kunde inte kontrolleras',
    error_title: 'Den senaste kontrollen misslyckades',
    rate_low: 'Få GitHub-förfrågningar kvar ({n}): kontroller väntar på återställningen {d}',
    install_all: 'Uppdatera alla ({n})',
    installing_one: 'Installerar… {n} kvar',
    installing_many: 'Installerar… {n} kvar',
    installing_short: 'Installerar…',
    confirm_one: 'Installera {n} uppdatering?',
    confirm_many: 'Installera {n} uppdateringar?',
    confirm_hint: 'En i taget. Integrationer kräver sedan en omstart av Home Assistant.',
    cancel: 'Avbryt',
    install: 'Installera',
    install_failed_title: 'Kunde inte installeras',
    version: '{from} → {to}',
    ed_entity: 'Marketplace Refresh-sensor',
    ed_entity_helper: 'Statussensor; lämna tomt för att hitta den automatiskt',
    ed_title: 'Titel',
    ed_show_title: 'Visa rubrik',
    ed_show_subtitle: 'Visa underrubrik',
    ed_show_next_check: 'Visa nästa kontroll',
    ed_title_helper: 'Lämna tomt för ”Marketplace-uppdateringar”',
    ed_show_updates: 'Tillgängliga uppdateringar',
    ed_show_updates_helper: 'Marketplace-repositorier med en uppdatering, enligt deras uppdateringsentiteter',
    ed_show_system_updates: 'Systemuppdateringar',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), apparna och enheternas firmware med en uppdatering; en rad öppnar den för installation',
    ed_show_failed: 'Repositorier som inte kunde kontrolleras',
    ed_show_failed_helper: 'Och felet från en misslyckad kontroll',
    ed_check_button: 'Knappen ”Sök efter uppdateringar”',
    ed_check_button_helper: 'Startar en kontroll från rubriken',
    ed_install_button: 'Knappen ”Uppdatera alla”',
    ed_install_button_helper: 'Installerar alla listade uppdateringar efter en bekräftelse (endast administratörer)',
    ed_hide_when_ok: 'Dölj kortet när allt är uppdaterat',
    ed_hide_when_ok_helper: 'Kortet visas bara under en kontroll, eller när det finns en uppdatering eller ett fel',
    ed_language: 'Språk',
    ed_language_helper: 'Lämna tomt för att följa Home Assistant',
  },
  bg: {
    title: 'Актуализации на Marketplace',
    up_to_date: 'Актуално',
    updates_one: '{n} актуализация',
    updates_many: '{n} актуализации',
    checking: 'Проверка {done}/{total}',
    checking_short: 'Проверява се…',
    error: 'Грешка',
    failed_one: '{n} неуспешно',
    failed_many: '{n} неуспешни',
    not_loaded: 'Marketplace Refresh не е настроен',
    unavailable: 'Недостъпно',
    never_checked: 'Още не е проверено',
    checked: 'Проверено {d}',
    next: 'следваща {d}',
    auto_off: 'автоматичната проверка е изключена',
    check_now: 'Провери за актуализации',
    updates_title: 'Актуализации',
    system_title: 'Системни актуализации',
    no_details: 'Marketplace не е зареден: няма подробности за тези актуализации',
    failed_title: 'Неуспешна проверка',
    no_github: 'GitHub не е свързан с Marketplace: хранилищата, добавени от връзка, не можаха да бъдат проверени',
    error_title: 'Последната проверка е неуспешна',
    rate_low: 'Малко оставащи заявки към GitHub ({n}): проверките изчакват нулирането {d}',
    install_all: 'Актуализирай всички ({n})',
    installing_one: 'Инсталиране… остава {n}',
    installing_many: 'Инсталиране… остават {n}',
    installing_short: 'Инсталиране…',
    confirm_one: 'Да се инсталира ли {n} актуализация?',
    confirm_many: 'Да се инсталират ли {n} актуализации?',
    confirm_hint: 'Една след друга. След това интеграциите изискват рестартиране на Home Assistant.',
    cancel: 'Отказ',
    install: 'Инсталирай',
    install_failed_title: 'Неуспешно инсталиране',
    version: '{from} → {to}',
    ed_entity: 'Сензор на Marketplace Refresh',
    ed_entity_helper: 'Сензор за състояние; оставете празно, за да бъде намерен автоматично',
    ed_title: 'Заглавие',
    ed_show_title: 'Показване на заглавието',
    ed_show_subtitle: 'Показване на подзаглавието',
    ed_show_next_check: 'Показване на следващата проверка',
    ed_title_helper: 'Оставете празно за „Актуализации на Marketplace“',
    ed_show_updates: 'Налични актуализации',
    ed_show_updates_helper: 'Хранилищата в Marketplace с актуализация, според техните обекти за актуализация',
    ed_show_system_updates: 'Системни актуализации',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), приложенията и фърмуерът на устройствата с актуализация; ред я отваря за инсталиране',
    ed_show_failed: 'Хранилища, които не можаха да бъдат проверени',
    ed_show_failed_helper: 'И грешката от неуспешна проверка',
    ed_check_button: 'Бутон „Провери за актуализации“',
    ed_check_button_helper: 'Стартира проверка от заглавната лента',
    ed_install_button: 'Бутон „Актуализирай всички“',
    ed_install_button_helper: 'Инсталира всички изброени актуализации след потвърждение (само администратори)',
    ed_hide_when_ok: 'Скрий картата, когато всичко е актуално',
    ed_hide_when_ok_helper: 'Картата се показва само по време на проверка или при актуализация или грешка',
    ed_language: 'Език',
    ed_language_helper: 'Оставете празно, за да следва Home Assistant',
  },
  ru: {
    title: 'Обновления Marketplace',
    up_to_date: 'Актуально',
    updates_one: '{n} обновление',
    updates_many: 'Обновления: {n}',
    checking: 'Проверка {done}/{total}',
    checking_short: 'Проверка…',
    error: 'Ошибка',
    failed_one: 'С ошибкой: {n}',
    failed_many: 'С ошибкой: {n}',
    not_loaded: 'Marketplace Refresh не настроен',
    unavailable: 'Недоступно',
    never_checked: 'Ещё не проверялось',
    checked: 'Проверено {d}',
    next: 'следующая {d}',
    auto_off: 'автоматическая проверка отключена',
    check_now: 'Проверить обновления',
    updates_title: 'Доступные обновления',
    system_title: 'Системные обновления',
    no_details: 'Marketplace не загружен: нет сведений об этих обновлениях',
    failed_title: 'Не удалось проверить',
    no_github: 'GitHub не подключён к Marketplace: репозитории, добавленные по ссылке, не удалось проверить',
    error_title: 'Последняя проверка не удалась',
    rate_low: 'Осталось мало запросов GitHub ({n}): проверки ждут сброса лимита {d}',
    install_all: 'Обновить все ({n})',
    installing_one: 'Установка… осталось: {n}',
    installing_many: 'Установка… осталось: {n}',
    installing_short: 'Установка…',
    confirm_one: 'Установить {n} обновление?',
    confirm_many: 'Установить обновления ({n})?',
    confirm_hint: 'По очереди. После этого интеграциям потребуется перезапуск Home Assistant.',
    cancel: 'Отмена',
    install: 'Установить',
    install_failed_title: 'Не удалось установить',
    version: '{from} → {to}',
    ed_entity: 'Датчик Marketplace Refresh',
    ed_entity_helper: 'Датчик статуса; оставьте пустым, чтобы найти его автоматически',
    ed_title: 'Заголовок',
    ed_show_title: 'Показывать заголовок',
    ed_show_subtitle: 'Показывать подзаголовок',
    ed_show_next_check: 'Показывать следующую проверку',
    ed_title_helper: 'Оставьте пустым для «Обновления Marketplace»',
    ed_show_updates: 'Доступные обновления',
    ed_show_updates_helper: 'Репозитории Marketplace с обновлением, по их объектам обновления',
    ed_show_system_updates: 'Системные обновления',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), приложения и прошивки устройств с обновлением; строка открывает его для установки',
    ed_show_failed: 'Репозитории, которые не удалось проверить',
    ed_show_failed_helper: 'И ошибка неудавшейся проверки',
    ed_check_button: 'Кнопка «Проверить обновления»',
    ed_check_button_helper: 'Запускает проверку из заголовка',
    ed_install_button: 'Кнопка «Обновить все»',
    ed_install_button_helper: 'Устанавливает все перечисленные обновления после подтверждения (только администраторы)',
    ed_hide_when_ok: 'Скрывать карточку, когда всё актуально',
    ed_hide_when_ok_helper: 'Карточка появляется только во время проверки или при наличии обновления или ошибки',
    ed_language: 'Язык',
    ed_language_helper: 'Оставьте пустым, чтобы использовать язык Home Assistant',
  },
  uk: {
    title: 'Оновлення Marketplace',
    up_to_date: 'Актуально',
    updates_one: '{n} оновлення',
    updates_many: 'Оновлення: {n}',
    checking: 'Перевірка {done}/{total}',
    checking_short: 'Перевірка…',
    error: 'Помилка',
    failed_one: 'З помилкою: {n}',
    failed_many: 'З помилкою: {n}',
    not_loaded: 'Marketplace Refresh не налаштовано',
    unavailable: 'Недоступно',
    never_checked: 'Ще не перевірялося',
    checked: 'Перевірено {d}',
    next: 'далі {d}',
    auto_off: 'автоматичну перевірку вимкнено',
    check_now: 'Перевірити оновлення',
    updates_title: 'Доступні оновлення',
    system_title: 'Системні оновлення',
    no_details: 'Marketplace не завантажено: немає відомостей про ці оновлення',
    failed_title: 'Не вдалося перевірити',
    no_github: 'GitHub не підключено до Marketplace: репозиторії, додані за посиланням, не вдалося перевірити',
    error_title: 'Остання перевірка не вдалася',
    rate_low: 'Залишилось мало запитів GitHub ({n}): перевірки чекають скидання ліміту {d}',
    install_all: 'Оновити все ({n})',
    installing_one: 'Встановлення… залишилося: {n}',
    installing_many: 'Встановлення… залишилося: {n}',
    installing_short: 'Встановлення…',
    confirm_one: 'Встановити {n} оновлення?',
    confirm_many: 'Встановити оновлення ({n})?',
    confirm_hint: 'Одне за одним. Після цього інтеграціям знадобиться перезапуск Home Assistant.',
    cancel: 'Скасувати',
    install: 'Встановити',
    install_failed_title: 'Не вдалося встановити',
    version: '{from} → {to}',
    ed_entity: 'Датчик Marketplace Refresh',
    ed_entity_helper: 'Датчик стану; залиште порожнім, щоб знайти його автоматично',
    ed_title: 'Заголовок',
    ed_show_title: 'Показувати заголовок',
    ed_show_subtitle: 'Показувати підзаголовок',
    ed_show_next_check: 'Показувати наступну перевірку',
    ed_title_helper: 'Залиште порожнім для «Оновлення Marketplace»',
    ed_show_updates: 'Доступні оновлення',
    ed_show_updates_helper: 'Репозиторії Marketplace з оновленням, за їхніми сутностями оновлення',
    ed_show_system_updates: 'Системні оновлення',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), застосунки та прошивки пристроїв з оновленням; рядок відкриває його для встановлення',
    ed_show_failed: 'Репозиторії, які не вдалося перевірити',
    ed_show_failed_helper: 'І помилка невдалої перевірки',
    ed_check_button: 'Кнопка «Перевірити оновлення»',
    ed_check_button_helper: 'Запускає перевірку із заголовка',
    ed_install_button: 'Кнопка «Оновити все»',
    ed_install_button_helper: 'Встановлює всі наведені оновлення після підтвердження (лише адміністратори)',
    ed_hide_when_ok: 'Приховувати картку, коли все актуально',
    ed_hide_when_ok_helper: 'Картка з’являється лише під час перевірки або коли є оновлення чи помилка',
    ed_language: 'Мова',
    ed_language_helper: 'Залиште порожнім, щоб використовувати мову Home Assistant',
  },
  hu: {
    title: 'Marketplace-frissítések',
    up_to_date: 'Naprakész',
    updates_one: '{n} frissítés',
    updates_many: '{n} frissítés',
    checking: 'Ellenőrzés {done}/{total}',
    checking_short: 'Ellenőrzés…',
    error: 'Hiba',
    failed_one: '{n} sikertelen',
    failed_many: '{n} sikertelen',
    not_loaded: 'A Marketplace Refresh nincs beállítva',
    unavailable: 'Nem elérhető',
    never_checked: 'Még nincs ellenőrizve',
    checked: 'Ellenőrizve {d}',
    next: 'következő {d}',
    auto_off: 'automatikus ellenőrzés kikapcsolva',
    check_now: 'Frissítések keresése',
    updates_title: 'Elérhető frissítések',
    system_title: 'Rendszerfrissítések',
    no_details: 'A Marketplace nincs betöltve: nincs részlet ezekről a frissítésekről',
    failed_title: 'Nem sikerült ellenőrizni',
    no_github: 'A GitHub nincs összekötve a Marketplace-szel: a hivatkozásból hozzáadott tárolókat nem lehetett ellenőrizni',
    error_title: 'Az utolsó ellenőrzés sikertelen volt',
    rate_low: 'Kevés GitHub-kérés maradt ({n}): az ellenőrzések a visszaállításig várnak {d}',
    install_all: 'Összes frissítése ({n})',
    installing_one: 'Telepítés… még {n}',
    installing_many: 'Telepítés… még {n}',
    installing_short: 'Telepítés…',
    confirm_one: '{n} frissítés telepítése?',
    confirm_many: '{n} frissítés telepítése?',
    confirm_hint: 'Egymás után. Az integrációkhoz ezután újra kell indítani a Home Assistantet.',
    cancel: 'Mégse',
    install: 'Telepítés',
    install_failed_title: 'Nem sikerült telepíteni',
    version: '{from} → {to}',
    ed_entity: 'Marketplace Refresh érzékelő',
    ed_entity_helper: 'Állapotérzékelő; hagyja üresen az automatikus kereséshez',
    ed_title: 'Cím',
    ed_show_title: 'Cím megjelenítése',
    ed_show_subtitle: 'Alcím megjelenítése',
    ed_show_next_check: 'Következő ellenőrzés megjelenítése',
    ed_title_helper: 'Hagyja üresen a „Marketplace-frissítések” címhez',
    ed_show_updates: 'Elérhető frissítések',
    ed_show_updates_helper: 'A frissíthető Marketplace-tárolók, a frissítési entitásaik alapján',
    ed_show_system_updates: 'Rendszerfrissítések',
    ed_show_system_updates_helper: 'A frissíthető Home Assistant (Core, Supervisor, OS), alkalmazások és eszköz-firmware-ek; egy sor megnyitja a telepítéshez',
    ed_show_failed: 'Nem ellenőrizhető tárolók',
    ed_show_failed_helper: 'És egy sikertelen ellenőrzés hibája',
    ed_check_button: '„Frissítések keresése” gomb',
    ed_check_button_helper: 'Ellenőrzést indít a fejlécből',
    ed_install_button: '„Összes frissítése” gomb',
    ed_install_button_helper: 'Megerősítés után telepíti az összes felsorolt frissítést (csak rendszergazdák)',
    ed_hide_when_ok: 'Kártya elrejtése, ha minden naprakész',
    ed_hide_when_ok_helper: 'A kártya csak ellenőrzés közben, illetve frissítés vagy hiba esetén jelenik meg',
    ed_language: 'Nyelv',
    ed_language_helper: 'Hagyja üresen a Home Assistant nyelvének követéséhez',
  },
  sk: {
    title: 'Aktualizácie Marketplace',
    up_to_date: 'Aktuálne',
    updates_one: '{n} aktualizácia',
    updates_many: 'Aktualizácie: {n}',
    checking: 'Kontrola {done}/{total}',
    checking_short: 'Kontroluje sa…',
    error: 'Chyba',
    failed_one: 'Neúspešné: {n}',
    failed_many: 'Neúspešné: {n}',
    not_loaded: 'Marketplace Refresh nie je nastavený',
    unavailable: 'Nedostupné',
    never_checked: 'Zatiaľ neskontrolované',
    checked: 'Skontrolované {d}',
    next: 'ďalšia {d}',
    auto_off: 'automatická kontrola vypnutá',
    check_now: 'Skontrolovať aktualizácie',
    updates_title: 'Dostupné aktualizácie',
    system_title: 'Systémové aktualizácie',
    no_details: 'Marketplace nie je načítaný: žiadne podrobnosti o týchto aktualizáciách',
    failed_title: 'Nepodarilo sa skontrolovať',
    no_github: 'GitHub nie je pripojený k Marketplace: repozitáre pridané z odkazu sa nepodarilo skontrolovať',
    error_title: 'Posledná kontrola zlyhala',
    rate_low: 'Zostáva málo požiadaviek GitHub ({n}): kontroly čakajú na vynulovanie {d}',
    install_all: 'Aktualizovať všetko ({n})',
    installing_one: 'Inštaluje sa… zostáva: {n}',
    installing_many: 'Inštaluje sa… zostáva: {n}',
    installing_short: 'Inštaluje sa…',
    confirm_one: 'Nainštalovať {n} aktualizáciu?',
    confirm_many: 'Nainštalovať aktualizácie ({n})?',
    confirm_hint: 'Jednu po druhej. Integrácie potom vyžadujú reštart Home Assistant.',
    cancel: 'Zrušiť',
    install: 'Nainštalovať',
    install_failed_title: 'Nepodarilo sa nainštalovať',
    version: '{from} → {to}',
    ed_entity: 'Senzor Marketplace Refresh',
    ed_entity_helper: 'Senzor stavu; ponechajte prázdne, aby sa našiel automaticky',
    ed_title: 'Názov',
    ed_show_title: 'Zobraziť názov',
    ed_show_subtitle: 'Zobraziť podnázov',
    ed_show_next_check: 'Zobraziť ďalšiu kontrolu',
    ed_title_helper: 'Ponechajte prázdne pre „Aktualizácie Marketplace“',
    ed_show_updates: 'Dostupné aktualizácie',
    ed_show_updates_helper: 'Repozitáre Marketplace s aktualizáciou podľa ich entít aktualizácie',
    ed_show_system_updates: 'Systémové aktualizácie',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), aplikácie a firmvér zariadení s aktualizáciou; riadok ju otvorí na inštaláciu',
    ed_show_failed: 'Repozitáre, ktoré sa nepodarilo skontrolovať',
    ed_show_failed_helper: 'A chyba neúspešnej kontroly',
    ed_check_button: 'Tlačidlo „Skontrolovať aktualizácie“',
    ed_check_button_helper: 'Spustí kontrolu z hlavičky',
    ed_install_button: 'Tlačidlo „Aktualizovať všetko“',
    ed_install_button_helper: 'Po potvrdení nainštaluje všetky uvedené aktualizácie (len správcovia)',
    ed_hide_when_ok: 'Skryť kartu, keď je všetko aktuálne',
    ed_hide_when_ok_helper: 'Karta sa zobrazí len počas kontroly alebo pri aktualizácii či chybe',
    ed_language: 'Jazyk',
    ed_language_helper: 'Ponechajte prázdne, aby sa použil jazyk Home Assistant',
  },
  cs: {
    title: 'Aktualizace Marketplace',
    up_to_date: 'Aktuální',
    updates_one: '{n} aktualizace',
    updates_many: 'Aktualizace: {n}',
    checking: 'Kontrola {done}/{total}',
    checking_short: 'Probíhá kontrola…',
    error: 'Chyba',
    failed_one: 'Neúspěšné: {n}',
    failed_many: 'Neúspěšné: {n}',
    not_loaded: 'Marketplace Refresh není nastaven',
    unavailable: 'Nedostupné',
    never_checked: 'Zatím nezkontrolováno',
    checked: 'Zkontrolováno {d}',
    next: 'další {d}',
    auto_off: 'automatická kontrola vypnuta',
    check_now: 'Zkontrolovat aktualizace',
    updates_title: 'Dostupné aktualizace',
    system_title: 'Systémové aktualizace',
    no_details: 'Marketplace není načten: žádné podrobnosti o těchto aktualizacích',
    failed_title: 'Nepodařilo se zkontrolovat',
    no_github: 'GitHub není připojen k Marketplace: repozitáře přidané z odkazu se nepodařilo zkontrolovat',
    error_title: 'Poslední kontrola selhala',
    rate_low: 'Zbývá málo požadavků GitHub ({n}): kontroly čekají na vynulování {d}',
    install_all: 'Aktualizovat vše ({n})',
    installing_one: 'Instalace… zbývá: {n}',
    installing_many: 'Instalace… zbývá: {n}',
    installing_short: 'Instalace…',
    confirm_one: 'Nainstalovat {n} aktualizaci?',
    confirm_many: 'Nainstalovat aktualizace ({n})?',
    confirm_hint: 'Jednu po druhé. Integrace pak vyžadují restart Home Assistant.',
    cancel: 'Zrušit',
    install: 'Nainstalovat',
    install_failed_title: 'Nepodařilo se nainstalovat',
    version: '{from} → {to}',
    ed_entity: 'Senzor Marketplace Refresh',
    ed_entity_helper: 'Senzor stavu; ponechte prázdné pro automatické vyhledání',
    ed_title: 'Název',
    ed_show_title: 'Zobrazit název',
    ed_show_subtitle: 'Zobrazit podnázev',
    ed_show_next_check: 'Zobrazit další kontrolu',
    ed_title_helper: 'Ponechte prázdné pro „Aktualizace Marketplace“',
    ed_show_updates: 'Dostupné aktualizace',
    ed_show_updates_helper: 'Repozitáře Marketplace s aktualizací podle jejich entit aktualizace',
    ed_show_system_updates: 'Systémové aktualizace',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), aplikace a firmware zařízení s aktualizací; řádek ji otevře k instalaci',
    ed_show_failed: 'Repozitáře, které se nepodařilo zkontrolovat',
    ed_show_failed_helper: 'A chyba neúspěšné kontroly',
    ed_check_button: 'Tlačítko „Zkontrolovat aktualizace“',
    ed_check_button_helper: 'Spustí kontrolu ze záhlaví',
    ed_install_button: 'Tlačítko „Aktualizovat vše“',
    ed_install_button_helper: 'Po potvrzení nainstaluje všechny uvedené aktualizace (pouze správci)',
    ed_hide_when_ok: 'Skrýt kartu, když je vše aktuální',
    ed_hide_when_ok_helper: 'Karta se zobrazí jen během kontroly nebo při aktualizaci či chybě',
    ed_language: 'Jazyk',
    ed_language_helper: 'Ponechte prázdné pro jazyk Home Assistant',
  },
  sl: {
    title: 'Posodobitve Marketplace',
    up_to_date: 'Posodobljeno',
    updates_one: '{n} posodobitev',
    updates_many: 'Posodobitve: {n}',
    checking: 'Preverjanje {done}/{total}',
    checking_short: 'Preverjanje…',
    error: 'Napaka',
    failed_one: 'Neuspešno: {n}',
    failed_many: 'Neuspešno: {n}',
    not_loaded: 'Marketplace Refresh ni nastavljen',
    unavailable: 'Ni na voljo',
    never_checked: 'Še ni preverjeno',
    checked: 'Preverjeno {d}',
    next: 'naslednje {d}',
    auto_off: 'samodejno preverjanje izklopljeno',
    check_now: 'Preveri posodobitve',
    updates_title: 'Razpoložljive posodobitve',
    system_title: 'Sistemske posodobitve',
    no_details: 'Marketplace ni naložen: ni podrobnosti o teh posodobitvah',
    failed_title: 'Ni bilo mogoče preveriti',
    no_github: 'GitHub ni povezan z Marketplace: repozitorijev, dodanih prek povezave, ni bilo mogoče preveriti',
    error_title: 'Zadnje preverjanje ni uspelo',
    rate_low: 'Ostalo je malo zahtev GitHub ({n}): preverjanja čakajo na ponastavitev {d}',
    install_all: 'Posodobi vse ({n})',
    installing_one: 'Nameščanje… preostalo: {n}',
    installing_many: 'Nameščanje… preostalo: {n}',
    installing_short: 'Nameščanje…',
    confirm_one: 'Namestim {n} posodobitev?',
    confirm_many: 'Namestim posodobitve ({n})?',
    confirm_hint: 'Eno za drugo. Integracije nato zahtevajo ponovni zagon Home Assistanta.',
    cancel: 'Prekliči',
    install: 'Namesti',
    install_failed_title: 'Ni bilo mogoče namestiti',
    version: '{from} → {to}',
    ed_entity: 'Senzor Marketplace Refresh',
    ed_entity_helper: 'Senzor stanja; pustite prazno za samodejno iskanje',
    ed_title: 'Naslov',
    ed_show_title: 'Prikaži naslov',
    ed_show_subtitle: 'Prikaži podnaslov',
    ed_show_next_check: 'Prikaži naslednje preverjanje',
    ed_title_helper: 'Pustite prazno za »Posodobitve Marketplace«',
    ed_show_updates: 'Razpoložljive posodobitve',
    ed_show_updates_helper: 'Repozitoriji Marketplace s posodobitvijo, glede na njihove entitete posodobitev',
    ed_show_system_updates: 'Sistemske posodobitve',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), aplikacije in vdelana programska oprema naprav s posodobitvijo; vrstica jo odpre za namestitev',
    ed_show_failed: 'Repozitoriji, ki jih ni bilo mogoče preveriti',
    ed_show_failed_helper: 'In napaka neuspešnega preverjanja',
    ed_check_button: 'Gumb »Preveri posodobitve«',
    ed_check_button_helper: 'Zažene preverjanje iz glave',
    ed_install_button: 'Gumb »Posodobi vse«',
    ed_install_button_helper: 'Po potrditvi namesti vse navedene posodobitve (samo skrbniki)',
    ed_hide_when_ok: 'Skrij kartico, ko je vse posodobljeno',
    ed_hide_when_ok_helper: 'Kartica se prikaže le med preverjanjem ali ob posodobitvi oziroma napaki',
    ed_language: 'Jezik',
    ed_language_helper: 'Pustite prazno za jezik Home Assistanta',
  },
  lv: {
    title: 'Marketplace atjauninājumi',
    up_to_date: 'Atjaunināts',
    updates_one: '{n} atjauninājums',
    updates_many: 'Atjauninājumi: {n}',
    checking: 'Pārbaude {done}/{total}',
    checking_short: 'Notiek pārbaude…',
    error: 'Kļūda',
    failed_one: 'Neizdevās: {n}',
    failed_many: 'Neizdevās: {n}',
    not_loaded: 'Marketplace Refresh nav iestatīts',
    unavailable: 'Nav pieejams',
    never_checked: 'Vēl nav pārbaudīts',
    checked: 'Pārbaudīts {d}',
    next: 'nākamā {d}',
    auto_off: 'automātiskā pārbaude izslēgta',
    check_now: 'Meklēt atjauninājumus',
    updates_title: 'Pieejamie atjauninājumi',
    system_title: 'Sistēmas atjauninājumi',
    no_details: 'Marketplace nav ielādēts: nav informācijas par šiem atjauninājumiem',
    failed_title: 'Neizdevās pārbaudīt',
    no_github: 'GitHub nav pievienots Marketplace: no saites pievienotās repozitorijas nevarēja pārbaudīt',
    error_title: 'Pēdējā pārbaude neizdevās',
    rate_low: 'Atlicis maz GitHub pieprasījumu ({n}): pārbaudes gaida atiestatīšanu {d}',
    install_all: 'Atjaunināt visu ({n})',
    installing_one: 'Instalē… atlicis: {n}',
    installing_many: 'Instalē… atlicis: {n}',
    installing_short: 'Instalē…',
    confirm_one: 'Instalēt {n} atjauninājumu?',
    confirm_many: 'Instalēt atjauninājumus ({n})?',
    confirm_hint: 'Vienu pēc otra. Pēc tam integrācijām nepieciešama Home Assistant restartēšana.',
    cancel: 'Atcelt',
    install: 'Instalēt',
    install_failed_title: 'Neizdevās instalēt',
    version: '{from} → {to}',
    ed_entity: 'Marketplace Refresh sensors',
    ed_entity_helper: 'Statusa sensors; atstājiet tukšu, lai to atrastu automātiski',
    ed_title: 'Virsraksts',
    ed_show_title: 'Rādīt virsrakstu',
    ed_show_subtitle: 'Rādīt apakšvirsrakstu',
    ed_show_next_check: 'Rādīt nākamo pārbaudi',
    ed_title_helper: 'Atstājiet tukšu, lai būtu “Marketplace atjauninājumi”',
    ed_show_updates: 'Pieejamie atjauninājumi',
    ed_show_updates_helper: 'Marketplace repozitoriji ar atjauninājumu, pēc to atjauninājumu vienībām',
    ed_show_system_updates: 'Sistēmas atjauninājumi',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), lietotnes un ierīču programmaparatūra ar atjauninājumu; rinda to atver instalēšanai',
    ed_show_failed: 'Repozitoriji, kurus neizdevās pārbaudīt',
    ed_show_failed_helper: 'Un neizdevušās pārbaudes kļūda',
    ed_check_button: 'Poga “Meklēt atjauninājumus”',
    ed_check_button_helper: 'Sāk pārbaudi no galvenes',
    ed_install_button: 'Poga “Atjaunināt visu”',
    ed_install_button_helper: 'Pēc apstiprinājuma instalē visus uzskaitītos atjauninājumus (tikai administratoriem)',
    ed_hide_when_ok: 'Paslēpt karti, kad viss ir atjaunināts',
    ed_hide_when_ok_helper: 'Karte parādās tikai pārbaudes laikā vai tad, ja ir atjauninājums vai kļūda',
    ed_language: 'Valoda',
    ed_language_helper: 'Atstājiet tukšu, lai izmantotu Home Assistant valodu',
  },
  el: {
    title: 'Ενημερώσεις Marketplace',
    up_to_date: 'Ενημερωμένο',
    updates_one: '{n} ενημέρωση',
    updates_many: '{n} ενημερώσεις',
    checking: 'Έλεγχος {done}/{total}',
    checking_short: 'Έλεγχος…',
    error: 'Σφάλμα',
    failed_one: '{n} απέτυχε',
    failed_many: '{n} απέτυχαν',
    not_loaded: 'Το Marketplace Refresh δεν έχει ρυθμιστεί',
    unavailable: 'Μη διαθέσιμο',
    never_checked: 'Δεν έχει ελεγχθεί ακόμη',
    checked: 'Έλεγχος {d}',
    next: 'επόμενος {d}',
    auto_off: 'αυτόματος έλεγχος απενεργοποιημένος',
    check_now: 'Έλεγχος για ενημερώσεις',
    updates_title: 'Διαθέσιμες ενημερώσεις',
    system_title: 'Ενημερώσεις συστήματος',
    no_details: 'Το Marketplace δεν έχει φορτωθεί: δεν υπάρχουν λεπτομέρειες για αυτές τις ενημερώσεις',
    failed_title: 'Αποτυχία ελέγχου',
    no_github: 'Το GitHub δεν είναι συνδεδεμένο με το Marketplace: τα αποθετήρια που προστέθηκαν από σύνδεσμο δεν ήταν δυνατό να ελεγχθούν',
    error_title: 'Ο τελευταίος έλεγχος απέτυχε',
    rate_low: 'Λίγα αιτήματα GitHub απομένουν ({n}): οι έλεγχοι περιμένουν τον μηδενισμό {d}',
    install_all: 'Ενημέρωση όλων ({n})',
    installing_one: 'Εγκατάσταση… απομένει {n}',
    installing_many: 'Εγκατάσταση… απομένουν {n}',
    installing_short: 'Εγκατάσταση…',
    confirm_one: 'Εγκατάσταση {n} ενημέρωσης;',
    confirm_many: 'Εγκατάσταση {n} ενημερώσεων;',
    confirm_hint: 'Η μία μετά την άλλη. Οι ενσωματώσεις απαιτούν στη συνέχεια επανεκκίνηση του Home Assistant.',
    cancel: 'Ακύρωση',
    install: 'Εγκατάσταση',
    install_failed_title: 'Αποτυχία εγκατάστασης',
    version: '{from} → {to}',
    ed_entity: 'Αισθητήρας Marketplace Refresh',
    ed_entity_helper: 'Αισθητήρας κατάστασης· αφήστε κενό για αυτόματο εντοπισμό',
    ed_title: 'Τίτλος',
    ed_show_title: 'Εμφάνιση τίτλου',
    ed_show_subtitle: 'Εμφάνιση υπότιτλου',
    ed_show_next_check: 'Εμφάνιση του επόμενου ελέγχου',
    ed_title_helper: 'Αφήστε κενό για «Ενημερώσεις Marketplace»',
    ed_show_updates: 'Διαθέσιμες ενημερώσεις',
    ed_show_updates_helper: 'Τα αποθετήρια Marketplace με ενημέρωση, σύμφωνα με τις οντότητες ενημέρωσής τους',
    ed_show_system_updates: 'Ενημερώσεις συστήματος',
    ed_show_system_updates_helper: 'Home Assistant (Core, Supervisor, OS), οι εφαρμογές και το υλικολογισμικό συσκευών με ενημέρωση· μια γραμμή την ανοίγει για εγκατάσταση',
    ed_show_failed: 'Αποθετήρια που δεν ήταν δυνατό να ελεγχθούν',
    ed_show_failed_helper: 'Και το σφάλμα ενός ελέγχου που απέτυχε',
    ed_check_button: 'Κουμπί «Έλεγχος για ενημερώσεις»',
    ed_check_button_helper: 'Ξεκινά έλεγχο από την κεφαλίδα',
    ed_install_button: 'Κουμπί «Ενημέρωση όλων»',
    ed_install_button_helper: 'Εγκαθιστά όλες τις ενημερώσεις της λίστας, μετά από επιβεβαίωση (μόνο διαχειριστές)',
    ed_hide_when_ok: 'Απόκρυψη της κάρτας όταν όλα είναι ενημερωμένα',
    ed_hide_when_ok_helper: 'Η κάρτα εμφανίζεται μόνο κατά τη διάρκεια ελέγχου ή όταν υπάρχει ενημέρωση ή σφάλμα',
    ed_language: 'Γλώσσα',
    ed_language_helper: 'Αφήστε κενό για να ακολουθεί το Home Assistant',
  },
};

// The full code when the card has it (sr-Latn), else the part before the dash (fr-FR → fr, pt-BR → pt), else English.
const hrLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  if (HR_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return HR_I18N[l] ? l : 'en';
};

// Locale for Intl: Home Assistant's full locale (pt-BR, fr-CA…) when its base is the card's language, else the card's
// language (option `language:` set to another one, or a code the card has its own strings for: sr vs sr-Latn).
// A bare `pt` is Home Assistant's European Portuguese: Intl reads it as Brazilian, so it becomes pt-PT.
const hrLocale = (hass, config) => {
  const lang = hrLang(hass, config);
  const full = String(hass?.locale?.language || hass?.language || '');
  const loc = full === lang || (!HR_I18N[full] && full.split('-')[0] === lang) ? full || lang : lang;
  return loc === 'pt' ? 'pt-PT' : loc;
};

const hrT = (lang, key, vars = {}) =>
  (HR_I18N[lang]?.[key] ?? HR_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// A count's string: `<key>_one`, `<key>_few` (Serbian, Polish: 2-4, 22-24…) or `<key>_many`, by the language's plural rules.
const hrPlural = (lang, locale, key, n) => {
  let form = n === 1 ? 'one' : 'other';
  try {
    form = new Intl.PluralRules(locale).select(n);
  } catch {
    // Unknown locale: one or other.
  }
  const strings = HR_I18N[lang] || HR_I18N.en;
  const suffix = form === 'one' ? 'one' : form === 'few' && strings[`${key}_few`] ? 'few' : 'many';
  return hrT(lang, `${key}_${suffix}`, { n });
};

const hrEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The focus the card gives back itself (after a re-render, a confirmation) never scrolls the page.
const HR_FOCUS = { preventScroll: true };
const HR_DEFAULTS = { show_title: true, show_subtitle: true, show_next_check: true, show_updates: true, show_system_updates: false, show_failed: true, check_button: true, install_button: true, hide_when_ok: false };

// The integration's entities, from the entity registry: { device: { status, last_check, button } }.
// Each entity is told apart by its translation key, else by the end of its entity ID (renamed IDs keep the key).
const HR_KEYS = { status: '_marketplace_status', last_check: '_marketplace_last_check', check_updates: '_marketplace_check_updates' };
function hrDevices(registry) {
  const devices = {};
  for (const [id, e] of Object.entries(registry || {})) {
    if (e?.platform !== HR_DOMAIN) continue;
    // The other modules of System Hub have a status too: only the Marketplace's.
    const tk = String(e.translation_key || '');
    if (tk && !tk.startsWith(HR_PREFIX)) continue;
    const keys = Object.keys(HR_KEYS);
    const key = keys.find((k) => tk === HR_PREFIX + k) || (!tk && keys.find((k) => id.endsWith(HR_KEYS[k])));
    if (!key) continue;
    const d = (devices[e.device_id || ''] ||= {});
    d[key === 'check_updates' ? 'button' : key] = id;
  }
  return devices;
}

// The editor's entity choice: the Marketplace status sensors, when there is any.
const hrStatusIds = (registry) => {
  const ids = Object.values(hrDevices(registry))
    .map((d) => d.status)
    .filter(Boolean);
  return ids.length ? { include_entities: ids } : {};
};

// The Marketplace's own update entities: one per installed repository.
const hrMarketplaceUpdates = (registry) =>
  Object.keys(registry || {}).filter((id) => id.startsWith('update.') && registry[id]?.platform === 'marketplace');

// Every other update entity (show_system_updates): Home Assistant itself (Core, Supervisor, OS) and the apps, from the
// Supervisor, then the devices and services (a Zigbee or ESPHome firmware…). The repositories of HACS are left out too,
// and the hidden entities, like the Updates tab of the panel.
const HR_REPOSITORY_PLATFORMS = ['marketplace', 'hacs'];
const hrSystemUpdates = (registry) =>
  Object.keys(registry || {}).filter(
    (id) => id.startsWith('update.') && !HR_REPOSITORY_PLATFORMS.includes(registry[id]?.platform) && !registry[id]?.hidden,
  );

// The parts of the header that hold the status pill (see _fitPill).
const MR_PILL = { block: '.heading', row: '.title-row', name: '.title', chip: '.pill', sub: '.subtitle' };

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

class MarketplaceRefreshCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('sh-marketplace-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  setConfig(config) {
    this.connectedWhileHidden = true;
    this._config = { ...HR_DEFAULTS, ...config };
    // show_title / show_subtitle: the header's title / subtitle, hidden by the stylesheet
    this.toggleAttribute?.('hide-title', config.show_title === false);
    this.toggleAttribute?.('hide-subtitle', config.show_subtitle === false);
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._sig = null;
    this._render();
  }

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    // Nothing the card shows changed: the same state objects, registry, language and minute ("3 min ago").
    const watched = this._watched;
    if (
      old &&
      this._sig &&
      watched &&
      hass.entities === old.entities &&
      watched.every((id) => hass.states[id] === old.states[id]) &&
      hrLocale(hass, this._config) === hrLocale(old, this._config) &&
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

  get editMode() {
    return this._editMode;
  }

  set preview(value) {
    this._preview = value;
    this._sig = null;
    this._render();
  }

  get preview() {
    return this._preview;
  }

  // Hides the card and tells Lovelace (card-visibility-changed): hui-card reads the `hidden` property and then
  // drops the card's slot in a sections view. connectedWhileHidden keeps the card in the DOM so that it keeps
  // following its entities and shows again on its own. Never hidden in the editor preview / edit mode.
  _setHidden(hidden) {
    hidden = !!hidden && !this._editMode && !this._preview;
    this.connectedWhileHidden = true;
    this.style.display = hidden ? 'none' : '';
    if (!!this.hidden !== hidden) {
      this.hidden = hidden;
      this.dispatchEvent(new CustomEvent('card-visibility-changed', { detail: { value: !hidden }, bubbles: true, composed: true }));
    }
    return hidden;
  }

  getCardSize() {
    if (this.hidden) return 0;
    return 2 + (this._rows || 0);
  }

  connectedCallback() {
    this._watchPill();
  }

  disconnectedCallback() {
    this._unwatchPill();
  }

  // The status pill goes on the title row, right after the title, only when the whole title and the pill's whole
  // label fit there; otherwise it takes its own line under the subtitle (the subtitle then on one line). Its dot
  // alone on a card 200 px wide or less, or when its label is wider than the title block (or, in a banner, would not
  // fit above the ground strip). Measured after each render and on every new width (or once the web font is loaded),
  // never by a fixed width; $MR_PILL names the parts.
  _fitPill() {
    const S = MR_PILL;
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
      this._pillFrame = requestAnimationFrame(() => this._fitPill());
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

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  // An update entity without a title: its device's name (the repository) rather than its friendly_name, which can be
  // the entity's own name alone ("Update", "Firmware") with the newer entity naming.
  _deviceName(id) {
    const deviceId = this._hass.entities?.[id]?.device_id;
    const device = deviceId && this._hass.devices?.[deviceId];
    return device ? device.name_by_user || device.name || '' : '';
  }

  _t(key, vars) {
    return hrT(hrLang(this._hass, this._config), key, vars);
  }

  _n(key, n) {
    return hrPlural(hrLang(this._hass, this._config), hrLocale(this._hass, this._config), key, n);
  }

  // "3 hours ago", "in 21 hours"… in the card's language.
  _relative(iso) {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return '';
    const m = (t - Date.now()) / 60000;
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(hrLocale(this._hass, this._config), { numeric: 'auto' });
    } catch {
      return new Date(t).toISOString();
    }
    // Rounded to the nearest unit: a check due in 20 h 59 min reads "in 21 hours".
    const a = Math.abs(m);
    if (a < 1) return rtf.format(0, 'second');
    if (a < 59.5) return rtf.format(Math.round(m), 'minute');
    if (a < 2850) return rtf.format(Math.round(m / 60), 'hour');
    return rtf.format(Math.round(m / 1440), 'day');
  }

  _absolute(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return '';
    try {
      return d.toLocaleString(hrLocale(this._hass, this._config), { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return d.toISOString();
    }
  }

  // The integration's entities (cached per registry object, never when empty) and the Marketplace's update entities.
  _lookup() {
    const registry = this._hass.entities;
    if (!this._reg || this._reg.registry !== registry) {
      const devices = hrDevices(registry);
      this._reg = Object.keys(devices).length ? { registry, devices, updates: hrMarketplaceUpdates(registry), system: hrSystemUpdates(registry) } : null;
    }
    const devices = this._reg?.devices || {};
    const updates = this._reg?.updates || [];
    const system = this._reg?.system || [];
    let status = this._config.entity;
    // An entity that no longer exists (one of the old Marketplace Refresh integration, say): the module's own is found.
    if (status && !this._hass.states[status]) status = null;
    if (!status) status = Object.values(devices).map((d) => d.status).find((id) => this._hass.states[id]);
    if (!status) return { updates, system };
    // Any of the device's entities (the Last check sensor, the button) leads to its status sensor.
    const device = Object.values(devices).find((d) => Object.values(d).includes(status));
    return device?.status ? { ...device, updates, system } : { ...device, status, updates, system };
  }

  // GitHub's rate limit as the last check read it: a line when it is low enough to hold the checks back (under
  // 1,500 left: the Marketplace keeps a reserve of 1,000), until it resets. Nothing once reset or unknown.
  _rateLow(a) {
    const left = a.rate_limit_remaining;
    const reset = a.rate_limit_reset && new Date(a.rate_limit_reset).getTime();
    if (typeof left !== 'number' || left >= MR_RATE_LOW || !reset || reset <= Date.now()) return '';
    return `<div class="rate"><ha-icon icon="mdi:speedometer-slow"></ha-icon><span>${hrEsc(this._t('rate_low', { n: left, d: this._relative(a.rate_limit_reset) }))}</span></div>`;
  }

  _render() {
    if (!this._config || !this._hass || !this.shadowRoot) return;
    const c = this._config;
    const ids = this._lookup();
    const states = this._hass.states;
    const raw = ids.status && states[ids.status];
    // Unavailable or unknown (entry not loaded, setup retry, restored state): nothing to read from it.
    const unavailable = !!raw && ['unavailable', 'unknown'].includes(raw.state);
    const st = unavailable ? null : raw;
    const lastSt = ids.last_check && states[ids.last_check];
    const buttonSt = ids.button && states[ids.button];
    const systemIds = c.show_system_updates ? ids.system : [];
    this._watched = [ids.status, ids.last_check, ids.button, ...ids.updates, ...systemIds].filter(Boolean);
    this._ids = ids;

    const minute = Math.floor(Date.now() / 60000);
    this._sigMinute = minute;
    const updateStates = ids.updates.map((id) => states[id]).filter((s) => s?.state === 'on');
    // Every update entity's state, not only the ones on: one coming back from unavailable changes the count.
    const updateSig = ids.updates.map((id) => states[id]?.state);
    const systemStates = systemIds.map((id) => states[id]).filter((s) => s?.state === 'on');
    const admin = !!this._hass.user?.is_admin;
    const sig = JSON.stringify([c, shbIsNight(this._hass, c), hrLocale(this._hass, c), ids, raw, lastSt, buttonSt?.state, updateStates, updateSig, systemStates, minute, admin, !!this._confirm]);
    if (sig === this._sig) return;
    this._sig = sig;

    const a = st?.attributes || {};
    const running = st?.state === 'running';
    // Without a GitHub account connected, the last check only read the catalog: the repositories added from a link
    // are in `not_checked`, listed with the failed ones and explained once under them.
    const notChecked = Array.isArray(a.not_checked) ? a.not_checked : [];
    const failed = [...(Array.isArray(a.failed) ? a.failed : []), ...notChecked];
    const installing = Array.isArray(a.installing) ? a.installing : [];
    const installFailed = Array.isArray(a.install_failed) ? a.install_failed : [];
    const noGithub = notChecked.length > 0;
    const error = st?.state === 'error' ? a.error || this._t('error') : null;
    // The update entities are the truth; the sensor's count is the fallback when the Marketplace's entities aren't there.
    const updates = updateStates
      .map((s) => ({
        id: s.entity_id,
        title: s.attributes.title || this._deviceName(s.entity_id) || s.attributes.friendly_name || s.entity_id,
        from: s.attributes.installed_version,
        to: s.attributes.latest_version,
        picture: s.attributes.entity_picture,
      }))
      .sort((x, y) => String(x.title).localeCompare(String(y.title)));
    // The Marketplace not loaded (setup retry, disabled): its entities are unavailable or gone, so they say nothing.
    const known = ids.updates.some((id) => ['on', 'off'].includes(states[id]?.state));
    const count = known ? updates.length : Number(a.updates) || 0;
    // Home Assistant, the apps first (the Supervisor's), then the devices and services; installed from their own dialog.
    const system = systemStates
      .map((s) => ({
        id: s.entity_id,
        title: s.attributes.title || this._deviceName(s.entity_id) || s.attributes.friendly_name || s.entity_id,
        from: s.attributes.installed_version,
        to: s.attributes.latest_version,
        picture: s.attributes.entity_picture,
        busy: !!s.attributes.in_progress,
        hassio: this._hass.entities?.[s.entity_id]?.platform === 'hassio',
      }))
      .sort((x, y) => Number(y.hassio) - Number(x.hassio) || String(x.title).localeCompare(String(y.title)));
    const total = count + system.length;
    const level = !st ? 'na' : error ? 'alert' : failed.length || installFailed.length ? 'warn' : running || installing.length || total ? 'info' : 'ok';

    const hidden = c.hide_when_ok && st && level === 'ok' && !this._editMode && !this._preview;
    this._setHidden(hidden);
    if (hidden) return;

    const shownUpdates = c.show_updates && st ? updates : [];
    this._rows = shownUpdates.length + (st ? system.length : 0) + (c.show_failed ? failed.length + installFailed.length : 0);
    // Installed from the card: what it lists (and the confirmation counts) is what gets installed.
    this._installable = st && admin && c.install_button && !installing.length ? updates.map((u) => u.id) : [];
    if (!this._installable.length) this._confirm = false;

    const last = lastSt && !['unknown', 'unavailable'].includes(lastSt.state) ? lastSt.state : null;
    // A check already due (overdue, or retried within the hour while the Marketplace is unavailable) has no "next" to show.
    const nextAt = lastSt?.attributes?.next_check;
    const next = nextAt && new Date(nextAt).getTime() > Date.now() ? nextAt : null;
    const interval = lastSt?.attributes?.scan_interval;
    const subtitle = !st
      ? ''
      : [
          last ? this._t('checked', { d: this._relative(last) }) : this._t('never_checked'),
          // show_next_check: false keeps the subtitle short on a phone, where it is cut (#137).
          interval === 0 ? this._t('auto_off') : next && c.show_next_check !== false ? this._t('next', { d: this._relative(next) }) : '',
        ]
          .filter(Boolean)
          .join(' · ');
    const icon = { ok: 'mdi:package-variant-closed-check', info: 'mdi:package-up', warn: 'mdi:package-variant-closed-remove', alert: 'mdi:alert-circle-outline', na: 'mdi:package-variant-closed' }[level];
    const pct = running && a.total ? Math.round((100 * (a.done || 0)) / a.total) : 0;

    // innerHTML replaces the focused element: give the focus back to its new copy afterwards, without scrolling the
    // page (a hass update re-renders the card while the user may have scrolled it out of view).
    const active = this.shadowRoot.activeElement;
    const focusCls = ['check', 'install', 'confirm-yes', 'confirm-no'].find((k) => active?.classList?.contains(k));
    const focus = focusCls || (active?.dataset?.id ? { id: active.dataset.id } : null);
    // The button is also unavailable while updates are installed: grey it out right away, without waiting for its state.
    this._busy = running || installing.length > 0 || buttonSt?.state === 'unavailable';
    this.shadowRoot.innerHTML = shBanner(`
      <style>${MarketplaceRefreshCard.styles}</style>
      <ha-card class="lvl-${level}">
        <div class="head">
          <div class="badge"><ha-icon icon="${icon}"></ha-icon></div>
          <div class="heading">
            <div class="title-row"><div class="title">${hrEsc(c.title || this._t('title'))}</div>${this._pill(unavailable ? this._t('unavailable') : this._status(st, running, a, total, failed, error, installing))}</div>
            ${subtitle ? `<div class="subtitle" title="${hrEsc(last ? this._absolute(last) : '')}">${hrEsc(subtitle)}</div>` : ''}
          </div>
          ${this._checkButton(this._busy)}
        </div>
        ${this._confirm ? this._confirmBox(this._installable.length) : ''}
        ${running ? `<div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct}%"></span></div>` : ''}
        ${this._rateLow(a)}
        ${c.show_failed && error ? `<div class="error"><ha-icon icon="mdi:alert-circle-outline"></ha-icon><span><b>${hrEsc(this._t('error_title'))}</b><br>${hrEsc(error)}</span></div>` : ''}
        ${st && system.length ? this._section('system_title', system.map((u) => this._updateRow(u, u.busy)).join(''), system.length) : ''}
        ${
          // No update: no section (the pill already says "Up to date").
          c.show_updates && st && count
            ? this._section(
                'updates_title',
                shownUpdates.length
                  ? shownUpdates.map((u) => this._updateRow(u, installing.includes(u.id))).join('')
                  : `<div class="empty">${hrEsc(this._t('no_details'))}</div>`,
                count,
                this._installButton(installing),
              )
            : ''
        }
        ${c.show_failed && failed.length ? this._section('failed_title', failed.map((f) => this._failedRow(f)).join('') + (noGithub ? `<div class="empty">${hrEsc(this._t('no_github'))}</div>` : '')) : ''}
        ${c.show_failed && installFailed.length ? this._section('install_failed_title', installFailed.map((f) => this._failedRow(f)).join('')) : ''}
      </ha-card>`, { hass: this._hass, config: this._config, scene: 'marketplace', pad: '12px' });

    const check = this.shadowRoot.querySelector('.check');
    check?.addEventListener('click', () => this._check());
    if (focus === 'check') check?.focus(HR_FOCUS);
    const on = (cls, fn) => {
      const el = this.shadowRoot.querySelector(`.${cls}`);
      el?.addEventListener('click', fn);
      if (focus === cls) el?.focus(HR_FOCUS);
    };
    on('install', () => this._askInstall());
    on('confirm-yes', () => this._install());
    on('confirm-no', () => this._setConfirm(false));
    for (const el of this.shadowRoot.querySelectorAll('.row[data-id]')) {
      el.addEventListener('click', () => this._moreInfo(el.dataset.id));
      if (focus?.id === el.dataset.id) el.focus(HR_FOCUS);
    }
    // A repository picture that doesn't load falls back to the generic icon.
    for (const img of this.shadowRoot.querySelectorAll('img.pic')) {
      img.addEventListener('error', () => img.parentElement?.classList.add('nopic'), { once: true });
    }
    if (this.isConnected) this._fitPill();
  }

  // The status pill: only its dot when its label doesn't fit in the header (the text stays for screen readers and in
  // the tooltip).
  _pill(text) {
    const t = hrEsc(text);
    return `<div class="pill" title="${t}"><span class="dot" aria-hidden="true"></span><span class="ptext">${t}</span></div>`;
  }

  _status(st, running, a, count, failed, error, installing = []) {
    if (!st) return this._t('not_loaded');
    if (running) return a.total ? this._t('checking', { done: a.done || 0, total: a.total }) : this._t('checking_short');
    if (installing.length) return this._n('installing', installing.length);
    if (error) return this._t('error');
    const parts = [];
    if (count) parts.push(this._n('updates', count));
    if (failed.length) parts.push(this._n('failed', failed.length));
    return parts.length ? parts.join(' · ') : this._t('up_to_date');
  }

  _checkButton(busy) {
    if (!this._config.check_button || !this._ids.button) return '';
    const label = hrEsc(this._t('check_now'));
    // aria-disabled rather than disabled: a disabled button would drop the keyboard focus while checking.
    return `<button class="check" title="${label}" aria-label="${label}"${busy ? ' aria-disabled="true"' : ''}><ha-icon icon="mdi:refresh"></ha-icon></button>`;
  }

  _check() {
    if (this._ids.button && !this._busy) this._hass.callService('button', 'press', { entity_id: this._ids.button });
  }

  // The updates section's button: "Update all (n)", or the installs' progress while they run.
  _installButton(installing) {
    if (installing.length) {
      return `<span class="install busy" aria-live="polite"><ha-icon icon="mdi:progress-download"></ha-icon><span class="ilabel">${hrEsc(this._t('installing_short'))}</span></span>`;
    }
    const n = this._installable.length;
    if (!n) return '';
    const label = hrEsc(this._t('install_all', { n }));
    return `<button class="install"${this._confirm ? ' aria-expanded="true"' : ''}><ha-icon icon="mdi:package-down"></ha-icon><span class="ilabel">${label}</span></button>`;
  }

  // Confirmation at the top of the card, like the other cards' popups.
  _confirmBox(n) {
    const ask = hrEsc(this._n('confirm', n));
    return `
        <div class="confirm" role="alertdialog" aria-label="${ask}">
          <ha-icon icon="mdi:package-down"></ha-icon>
          <span class="ctext"><b>${ask}</b><br>${hrEsc(this._t('confirm_hint'))}</span>
          <span class="cbtns">
            <button class="confirm-no">${hrEsc(this._t('cancel'))}</button>
            <button class="confirm-yes">${hrEsc(this._t('install'))}</button>
          </span>
        </div>`;
  }

  _setConfirm(on) {
    this._confirm = on;
    this._sig = null;
    this._render();
    // Keyboard focus on the safe choice when it opens, back on the button when it closes.
    this.shadowRoot?.querySelector(on ? '.confirm-no' : '.install')?.focus?.(HR_FOCUS);
  }

  _askInstall() {
    if (this._installable.length) this._setConfirm(true);
  }

  _install() {
    const ids = this._installable;
    this._setConfirm(false);
    if (!ids.length) return;
    // Home Assistant shows the error of a failed call; nothing more to do with it here.
    Promise.resolve(this._hass.callService(HR_DOMAIN, `${HR_PREFIX}install_updates`, { entity_id: ids })).catch(() => {});
  }

  _moreInfo(entityId) {
    const ev = new Event('hass-more-info', { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }

  // A section, with its number of items in the title ("Updates available · 3") and an action on its right.
  _section(key, body, count = 0, action = '') {
    const n = count ? ` <span class="count">· ${count}</span>` : '';
    return `<div class="section"><div class="shead"><div class="stitle">${hrEsc(this._t(key))}${n}</div>${action}</div><div class="list">${body}</div></div>`;
  }

  // A brand image of Home Assistant (/api/brands/…) needs its access token, read once (brands/access_token)
  _picture(url) {
    if (!url) return null;
    if (!url.startsWith('/api/brands/')) return url;
    if (this._brandsToken === undefined && this._hass?.callWS) {
      this._brandsToken = null;
      this._hass
        .callWS({ type: 'brands/access_token' })
        .then((res) => {
          this._brandsToken = res?.token || '';
          this._render?.();
        })
        .catch(() => {
          this._brandsToken = '';
        });
    }
    if (!this._brandsToken) return this._brandsToken === '' ? url : null;
    return `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(this._brandsToken)}`;
  }

  _updateRow(u, busy = false) {
    const version = u.from && u.to ? this._t('version', { from: u.from, to: u.to }) : u.to || '';
    const picture = this._picture(u.picture);
    const pic = picture && !busy ? `<img class="pic" src="${hrEsc(picture)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '';
    return `
          <button class="row upd${busy ? ' busy' : ''}" data-id="${hrEsc(u.id)}" title="${hrEsc(u.title)}">
            <span class="ic${pic ? '' : ' nopic'}">${pic}<ha-icon icon="${busy ? 'mdi:progress-download' : 'mdi:package-up'}"></ha-icon></span>
            <span class="txt">
              <span class="name">${hrEsc(u.title)}</span>
              ${version ? `<span class="sub">${hrEsc(version)}</span>` : ''}
            </span>
            <ha-icon class="chev" icon="mdi:chevron-right"></ha-icon>
          </button>`;
  }

  // "owner/repo" or "owner/repo: the error".
  _failedRow(f) {
    const text = String(f);
    const i = text.indexOf(': ');
    const name = i > 0 ? text.slice(0, i) : text;
    const why = i > 0 ? text.slice(i + 2) : '';
    return `
          <div class="row warn" title="${hrEsc(text)}">
            <span class="ic nopic"><ha-icon icon="mdi:alert-outline"></ha-icon></span>
            <span class="txt">
              <span class="name">${hrEsc(name)}</span>
              ${why ? `<span class="sub">${hrEsc(why)}</span>` : ''}
            </span>
          </div>`;
  }

  static get styles() {
    return `
      :host([hidden]) { display: none !important; }
      /* Home Assistant's <ha-icon> is inline: as a box of its own, its icon is centred in its badge */
      ha-icon { display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; line-height: 0; }
      :host {
        --hr-ok: var(--success-color, #43a047);
        --hr-info: var(--info-color, #039be5);
        --hr-warn: var(--warning-color, #ffa600);
        --hr-alert: var(--error-color, #db4437);
        --hr-na: var(--disabled-color, #9e9e9e);
        /* A block that a flex or grid parent may shrink (the card has no minimum width of its own). */
        display: block;
        min-width: 0;
      }
      /* Text and status icons in a state colour are mixed with the text colour: darker on a light theme,
         lighter on a dark one, so they stay readable (4.5:1 for text, 3:1 for icons) on their tinted background. */
      /* A size container: the header's pill turns into a dot on a narrow card. */
      ha-card { padding: 12px; overflow: hidden; container-type: inline-size; }
      /* A size container has no width of its own content: in a parent that sizes to its content (an inline-block, an
         "auto" grid column, some layout-card set-ups) the card would fall to its padding. This empty, zero-height grid
         gives it a natural (max-content) width without any minimum (its min-content width is 0): in a "1fr 1fr" grid,
         wrapped in a div or not, the card still shrinks to its track. contain-intrinsic-inline-size or a min-width on
         the host would be a minimum and overflow there. */
      :host::before { content: ""; display: grid; grid-template-columns: minmax(0, 322px); height: 0; }
      ha-card.lvl-ok    { --c: var(--hr-ok); }
      ha-card.lvl-info  { --c: var(--hr-info); }
      ha-card.lvl-warn  { --c: var(--hr-warn); }
      ha-card.lvl-alert { --c: var(--hr-alert); }
      ha-card.lvl-na    { --c: var(--hr-na); }

      .head { position: relative; display: flex; align-items: center; gap: 10px; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               background: color-mix(in srgb, var(--c) 16%, transparent); color: color-mix(in srgb, var(--c) 55%, var(--primary-text-color, #212121)); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      /* The title takes the room left (a long subtitle never squeezes the pill) and keeps about four characters;
         the buttons never shrink, the pill keeps its whole label and is only truncated when there is really no room. */
      .heading { flex: 1 1 0%; min-width: 6ch; font-size: 16px; display: flex; flex-direction: column; }
      .title { font-size: 16px; font-weight: 500; line-height: 1.25; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .subtitle { font-size: 12px; line-height: 1.3; color: var(--secondary-text-color);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .pill { position: relative; flex: 0 1 auto; min-width: 0; box-sizing: border-box; display: flex; align-items: center; gap: 5px;
              font-size: 11px; font-weight: 500; padding: 1px 8px; border-radius: 999px;
              color: color-mix(in srgb, var(--c) 40%, var(--primary-text-color, #212121));
              background: color-mix(in srgb, var(--c) 14%, transparent); font-variant-numeric: tabular-nums; }
      .ptext { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .dot { display: block; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--c); }
      /* A dot in the status colour before the pill's words; 8 px gaps and a slimmer pill under 324 px; on a phone's
         6 columns (156-194 px) a smaller badge. */
      /* The status pill: on the title row, 8 px after the title, only when the whole title and the pill's whole label fit
         there; otherwise on its own line under the subtitle, which then keeps one line; its dot alone at 200 px or less
         or when its label does not fit the title block (its text stays in its title and for screen readers). Measured
         after each render (_fitPill), in every language, never by a fixed width. */
      .title-row { display: flex; flex-wrap: nowrap; align-items: center; gap: 8px; min-width: 0; }
      .title-row > .title { flex: 0 1 auto; min-width: 0; }
      .title-row > .pill { flex: none; min-width: auto; max-width: none; overflow: visible; align-self: center; margin-top: 0; }
      .title-row > .pill .ptext { min-width: auto; overflow: visible; white-space: nowrap; display: inline; -webkit-line-clamp: none; line-clamp: none; }
      .heading.pill-below { display: flex; flex-direction: column; align-items: stretch; }
      .heading.pill-below > * { order: 3; }
      .heading.pill-below > .title-row { display: contents; }
      .heading.pill-below > .subtitle { order: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .heading.pill-below > .title-row > .pill { order: 2; align-self: flex-start; margin-top: 2px; }
      .heading.pill-dot > .title-row > .pill { padding: 4px; gap: 0; }
      .heading.pill-dot > .title-row > .pill .dot { display: block; }
      .heading.pill-dot > .title-row > .pill .ptext { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
      @container (max-width: 300px) { .head { gap: 8px; } .pill { padding: 1px 6px; } }
      @container (max-width: 170px) {
        .badge { width: 32px; height: 32px; }
        .badge ha-icon { --mdc-icon-size: 20px; }
      }
      .check { all: unset; cursor: pointer; flex: none; width: 26px; height: 26px; border-radius: 50%;
               display: grid; place-items: center; color: var(--secondary-text-color); }
      .check:hover { background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent); color: var(--primary-text-color); }
      .check:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .check[aria-disabled="true"] { cursor: default; opacity: .4; background: none; color: var(--secondary-text-color); }
      .check ha-icon { --mdc-icon-size: 16px; }

      .progress { height: 4px; margin-top: 10px; border-radius: 2px; overflow: hidden;
                  background: color-mix(in srgb, var(--secondary-text-color) 22%, transparent); }
      .progress span { display: block; height: 100%; border-radius: 2px; background: var(--c); }

      .rate { display: flex; gap: 8px; align-items: center; margin-top: 10px; font-size: 12px; color: var(--secondary-text-color); }
      .rate ha-icon { --mdc-icon-size: 16px; flex: none; color: var(--warning-color, #ffa600); }
      .error { display: flex; gap: 8px; align-items: flex-start; margin-top: 10px; padding: 8px 10px; border-radius: 10px;
               font-size: 12px; line-height: 1.35; color: var(--primary-text-color);
               background: color-mix(in srgb, var(--hr-alert) 12%, var(--secondary-background-color, transparent)); }
      .error ha-icon { --mdc-icon-size: 18px; color: color-mix(in srgb, var(--hr-alert) 55%, var(--primary-text-color, #212121)); flex: none; }
      .error b { font-weight: 500; color: color-mix(in srgb, var(--hr-alert) 40%, var(--primary-text-color, #212121)); }
      .error span { min-width: 0; overflow-wrap: anywhere; }

      .section { margin-top: 12px; }
      /* The section's button goes under its title when both don't fit on one line. */
      .shead { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 6px 8px; margin: 0 2px 6px; min-height: 24px; }
      .stitle { min-width: 0; font-size: 12px; font-weight: 500; color: var(--secondary-text-color);
                text-transform: uppercase; letter-spacing: .04em; }
      .stitle .count { font-variant-numeric: tabular-nums; }
      /* No filled button: a tinted outline, the accent colour for the text. */
      .install, .cbtns button { all: unset; box-sizing: border-box; cursor: pointer; flex: none; display: inline-flex; align-items: center; gap: 4px;
               font-size: 12px; font-weight: 500; line-height: 1; padding: 5px 10px; border-radius: 999px; font-variant-numeric: tabular-nums;
               color: color-mix(in srgb, var(--hr-info) 45%, var(--primary-text-color, #212121));
               border: 1px solid color-mix(in srgb, var(--hr-info) 45%, transparent); }
      .install ha-icon { --mdc-icon-size: 16px; flex: none; }
      /* On its own line under the section title, it never gets wider than the card. */
      .install { max-width: 100%; }
      .ilabel { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      button.install:hover, .cbtns button:hover { background: color-mix(in srgb, var(--hr-info) 12%, transparent); }
      .install:focus-visible, .cbtns button:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .install.busy { cursor: default; border-color: transparent; color: var(--secondary-text-color); }
      .cbtns .confirm-no { color: var(--secondary-text-color); border-color: color-mix(in srgb, var(--secondary-text-color) 40%, transparent); }
      .cbtns .confirm-no:hover { background: color-mix(in srgb, var(--secondary-text-color) 12%, transparent); }

      .confirm { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 10px; margin-top: 10px; padding: 8px 10px; border-radius: 10px;
                 font-size: 12px; line-height: 1.35; color: var(--primary-text-color);
                 background: color-mix(in srgb, var(--hr-info) 12%, var(--secondary-background-color, transparent)); }
      .confirm > ha-icon { --mdc-icon-size: 18px; flex: none; color: color-mix(in srgb, var(--hr-info) 55%, var(--primary-text-color, #212121)); }
      .confirm b { font-weight: 500; }
      .ctext { flex: 1 1 180px; min-width: 0; }
      .cbtns { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 6px; margin-left: auto; max-width: 100%; }
      .row.busy .ic { color: color-mix(in srgb, var(--hr-info) 55%, var(--primary-text-color, #212121)); }
      .row.busy .ic ha-icon { animation: hr-pulse 1.2s ease-in-out infinite; }
      @keyframes hr-pulse { 50% { opacity: .35; } }
      @media (prefers-reduced-motion: reduce) { .row.busy .ic ha-icon { animation: none; } }
      .list { display: flex; flex-direction: column; gap: 6px; }
      .empty { font-size: 13px; color: var(--secondary-text-color); padding: 8px 10px; border-radius: 10px;
               background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .row { --t: var(--hr-info); all: unset; box-sizing: border-box; min-width: 0;
             display: flex; align-items: center; gap: 8px; padding: 5px 8px 5px 5px; border-radius: 10px;
             background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .row.warn { --t: var(--hr-warn); background: color-mix(in srgb, var(--t) 12%, var(--secondary-background-color, transparent)); }
      button.row { cursor: pointer; }
      button.row:hover { background: color-mix(in srgb, var(--t) 14%, var(--secondary-background-color, transparent)); }
      .row:focus-visible { outline: 2px solid var(--primary-color); outline-offset: 2px; }
      .ic { position: relative; flex: none; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
            color: color-mix(in srgb, var(--t) 55%, var(--primary-text-color, #212121));
            background: color-mix(in srgb, var(--t) 18%, transparent); overflow: hidden; }
      .ic ha-icon { --mdc-icon-size: 16px; }
      .ic img.pic { position: absolute; inset: 5px; width: 18px; height: 18px; object-fit: contain; }
      .ic:not(.nopic) img.pic + ha-icon { visibility: hidden; }
      .ic.nopic img.pic { display: none; }
      .txt { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .name { font-size: 13px; font-weight: 500; line-height: 1.2; color: var(--primary-text-color);
              white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub { font-size: 11px; line-height: 1.2; color: var(--secondary-text-color); font-variant-numeric: tabular-nums;
             white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .row.warn .sub { color: color-mix(in srgb, var(--t) 40%, var(--primary-text-color, #212121)); }
      .chev { flex: none; --mdc-icon-size: 18px; color: var(--secondary-text-color); }
      /* A phone's 6 columns (156-200 px card): the version ("v1.13.0 →" / "v1.14.1"), an error and the section's button go
         on two lines instead of being cut. */
      @container (max-width: 200px) {
        .sub { white-space: normal; overflow-wrap: anywhere; }
        .ilabel { white-space: normal; overflow-wrap: anywhere; }
        .install { border-radius: 12px; line-height: 1.2; }
      }
      :host([hide-title]) .heading .title, :host([hide-subtitle]) .heading > .subtitle { display: none; }
    `;
  }
}

// ── Editor ───────────────────────────────────────────────────────────────────
const HR_HELPERS = ['entity', 'title', 'show_updates', 'show_system_updates', 'show_failed', 'check_button', 'install_button', 'hide_when_ok', 'language'];

class MarketplaceRefreshCardEditor extends HTMLElement {
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
      const t = (key) => hrT(hrLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => shbLabel(this._hass, s.name) ?? t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (HR_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
      this._form.addEventListener('value-changed', (ev) => {
        const config = { ...ev.detail.value };
        // Options left at their default are not written to the YAML.
        for (const k of Object.keys(config)) {
          if (config[k] === '' || config[k] == null || HR_DEFAULTS[k] === config[k]) delete config[k];
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: shbClean(config) }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const c = this._config;
    const lang = hrLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    if (this._deps && this._deps.config === c && this._deps.lang === lang) return;
    this._deps = { config: c, lang };
    this._form.data = shbData({ ...HR_DEFAULTS, ...c });
    this._form.schema = [
      {
        name: 'entity',
        selector: {
          entity: {
            filter: { integration: HR_DOMAIN, domain: 'sensor', device_class: 'enum' },
            // Only the Marketplace's status, not the other System Hub modules' (when the registry is known).
            ...hrStatusIds(this._hass?.entities),
          },
        },
      },
      { name: 'title', selector: { text: {} } },
      ...shbFields(this._hass),
      { name: 'show_title', selector: { boolean: {} } },
      { name: 'show_subtitle', selector: { boolean: {} } },
      { name: 'show_next_check', selector: { boolean: {} } },
      { name: 'show_updates', selector: { boolean: {} } },
      { name: 'show_system_updates', selector: { boolean: {} } },
      { name: 'show_failed', selector: { boolean: {} } },
      { name: 'check_button', selector: { boolean: {} } },
      { name: 'install_button', selector: { boolean: {} } },
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
              { value: 'sr', label: 'Српски' },
              { value: 'sr-Latn', label: 'Srpski (latinica)' },
              { value: 'it', label: 'Italiano' },
              { value: 'nl', label: 'Nederlands' },
              { value: 'pt', label: 'Português (Portugal)' },
              { value: 'pl', label: 'Polski' },
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

if (!customElements.get('sh-marketplace-card')) {
  customElements.define('sh-marketplace-card', MarketplaceRefreshCard);
  customElements.define('sh-marketplace-card-editor', MarketplaceRefreshCardEditor);
  window.systemHubCards = window.systemHubCards || [];
  window.systemHubCards.push({
    type: 'sh-marketplace-card',
    name: 'Marketplace Refresh Card',
    description: 'The update check of Marketplace Refresh: status, last and next check, updates available and failed repositories',
    preview: false,
    documentationURL: 'https://github.com/juju35/ha-system-hub',
  });
  console.info(`%c MARKETPLACE-REFRESH-CARD %c v${MARKETPLACE_REFRESH_CARD_VERSION} `, 'background:#14b8a6;color:#fff;font-weight:700', '');
}
