/**
 * git-sync-card — the Git status of a Home Assistant configuration (changes, last commit, last push, last
 * dashboard export), with Commit & push and Export dashboards actions.
 * git-sync-mini-card — the same in a compact card, with a zoom button that switches it to the full card.
 * Served and added to the dashboard resources by System Hub (its Git Sync module), the card of the former Git Sync
 * integration, same card types: dashboards using it keep working.
 * https://github.com/juju35/ha-system-hub
 */
var GIT_SYNC_CARD_VERSION = '1.3.0';
// System Hub: its entities (platform system_hub, translation keys git_sync_*) and actions (system_hub.git_sync_*)
var GS_DOMAIN = 'system_hub';
var GS_PREFIX = 'git_sync_';

const GS_I18N = {
  en: {
    title: 'Git Sync',
    clean: 'Up to date',
    dirty: 'Changes',
    ahead: 'Push pending',
    behind: 'Behind',
    diverged: 'Diverged',
    error: 'Error',
    unavailable: 'Unavailable',
    working: 'Working…',
    not_loaded: 'Git Sync is not set up',
    last_commit: 'Last commit',
    last_push: 'Last push',
    last_export: 'Dashboard export',
    changes: 'Changes',
    files_one: '{n} file',
    files_many: '{n} files',
    changed_files: 'Changed files',
    no_changes: 'Working tree clean',
    more: '+ {n} more',
    never: 'Never',
    commit: 'Commit & push',
    export: 'Export dashboards',
    confirm_title: 'Commit and push now?',
    confirm_text_one: '{n} changed file will be committed and pushed.',
    confirm_text_many: '{n} changed files will be committed and pushed.',
    confirm_push: 'The commits waiting will be pushed.',
    message: 'Message (Enter to commit on ‘{branch}’)',
    message_hint: 'Empty: written by the AI task when committing',
    generate: 'Generate commit message',
    generated_none: 'Nothing to describe: no changes',
    cancel: 'Cancel',
    committed: 'Committed: {m}',
    nothing: 'Nothing to commit',
    pushed: 'Pending commits pushed',
    exported_one: '{n} dashboard file exported',
    exported_many: '{n} dashboard files exported',
    pull: 'Pull',
    pulled_one: '{n} commit pulled',
    pulled_many: '{n} commits pulled',
    failed: 'Failed: {e}',
    zoom_in: 'Show the full card',
    zoom_out: 'Back to the compact view',
    ed_entity: 'Git Sync sensor',
    ed_entity_helper: 'Status sensor of the repository; leave empty to find it automatically',
    ed_title: 'Title',
    ed_title_helper: 'Leave empty for “Git Sync”',
    ed_show_files: 'Changed files',
    ed_show_files_helper: 'Collapsible list of the files not committed yet',
    ed_show_export: 'Dashboard export',
    ed_show_export_helper: 'Time of the last export and the Export dashboards button',
    ed_zoom: 'Zoom button',
    ed_zoom_helper: 'Switches the mini card to the full card and back',
    ed_language: 'Language',
    ed_language_helper: 'Leave empty to follow Home Assistant',
    diff: 'View changes',
    diff_title: 'Changes on ‘{branch}’',
    diff_loading: 'Loading changes…',
    diff_empty: 'No changes to show',
    diff_binary: 'Binary file',
    diff_truncated: 'Diff cut here: {n} more lines',
    diff_more_files: '{n} more files not shown',
    diff_added: 'Added',
    diff_modified: 'Modified',
    diff_deleted: 'Deleted',
    diff_renamed: 'Renamed',
    diff_mode: 'Mode changed',
    close: 'Close',
  },
  fr: {
    title: 'Git Sync',
    clean: 'À jour',
    dirty: 'Modifications',
    ahead: 'Push en attente',
    behind: 'En retard',
    diverged: 'Divergé',
    error: 'Erreur',
    unavailable: 'Indisponible',
    working: 'En cours…',
    not_loaded: 'Git Sync n’est pas configuré',
    last_commit: 'Dernier commit',
    last_push: 'Dernier push',
    last_export: 'Export des dashboards',
    changes: 'Modifications',
    files_one: '{n} fichier',
    files_many: '{n} fichiers',
    changed_files: 'Fichiers modifiés',
    no_changes: 'Aucune modification',
    more: '+ {n} autres',
    never: 'Jamais',
    commit: 'Commit et push',
    export: 'Exporter les dashboards',
    confirm_title: 'Commit et push maintenant ?',
    confirm_text_one: '{n} fichier modifié sera committé et poussé.',
    confirm_text_many: '{n} fichiers modifiés seront committés et poussés.',
    confirm_push: 'Les commits en attente seront poussés.',
    message: 'Message (Entrée pour committer sur « {branch} »)',
    message_hint: 'Vide : rédigé par l’AI task au moment du commit',
    generate: 'Générer le message de commit',
    generated_none: 'Rien à décrire : aucune modification',
    cancel: 'Annuler',
    committed: 'Commit : {m}',
    nothing: 'Rien à committer',
    pushed: 'Commits en attente poussés',
    exported_one: '{n} fichier de dashboard exporté',
    exported_many: '{n} fichiers de dashboard exportés',
    pull: 'Pull',
    pulled_one: '{n} commit récupéré',
    pulled_many: '{n} commits récupérés',
    failed: 'Échec : {e}',
    zoom_in: 'Afficher la carte complète',
    zoom_out: 'Revenir à la vue compacte',
    ed_entity: 'Capteur Git Sync',
    ed_entity_helper: 'Capteur de statut du dépôt ; laisser vide pour le trouver automatiquement',
    ed_title: 'Titre',
    ed_title_helper: 'Laisser vide pour « Git Sync »',
    ed_show_files: 'Fichiers modifiés',
    ed_show_files_helper: 'Liste repliable des fichiers pas encore committés',
    ed_show_export: 'Export des dashboards',
    ed_show_export_helper: 'Heure du dernier export et bouton Exporter les dashboards',
    ed_zoom: 'Bouton zoom',
    ed_zoom_helper: 'Bascule la mini-carte en carte complète, et inversement',
    ed_language: 'Langue',
    ed_language_helper: 'Laisser vide pour suivre Home Assistant',
    diff: 'Voir les modifications',
    diff_title: 'Modifications sur ‘{branch}’',
    diff_loading: 'Chargement des modifications…',
    diff_empty: 'Aucune modification à afficher',
    diff_binary: 'Fichier binaire',
    diff_truncated: 'Diff coupé ici : {n} lignes de plus',
    diff_more_files: '{n} autres fichiers non affichés',
    diff_added: 'Ajouté',
    diff_modified: 'Modifié',
    diff_deleted: 'Supprimé',
    diff_renamed: 'Renommé',
    diff_mode: 'Mode modifié',
    close: 'Fermer',
  },
  de: {
    title: 'Git Sync',
    clean: 'Aktuell',
    dirty: 'Änderungen',
    ahead: 'Push ausstehend',
    behind: 'Zurück',
    diverged: 'Divergiert',
    error: 'Fehler',
    unavailable: 'Nicht verfügbar',
    working: 'Läuft…',
    not_loaded: 'Git Sync ist nicht eingerichtet',
    last_commit: 'Letzter Commit',
    last_push: 'Letzter Push',
    last_export: 'Dashboard-Export',
    changes: 'Änderungen',
    files_one: '{n} Datei',
    files_many: '{n} Dateien',
    changed_files: 'Geänderte Dateien',
    no_changes: 'Keine Änderungen',
    more: '+ {n} weitere',
    never: 'Nie',
    commit: 'Commit & Push',
    export: 'Dashboards exportieren',
    confirm_title: 'Jetzt committen und pushen?',
    confirm_text_one: '{n} geänderte Datei wird committet und gepusht.',
    confirm_text_many: '{n} geänderte Dateien werden committet und gepusht.',
    confirm_push: 'Die ausstehenden Commits werden gepusht.',
    message: 'Nachricht (Eingabe zum Committen auf „{branch}“)',
    message_hint: 'Leer: beim Commit vom AI-Task geschrieben',
    generate: 'Commit-Nachricht erzeugen',
    generated_none: 'Nichts zu beschreiben: keine Änderungen',
    cancel: 'Abbrechen',
    committed: 'Committet: {m}',
    nothing: 'Nichts zu committen',
    pushed: 'Ausstehende Commits gepusht',
    exported_one: '{n} Dashboard-Datei exportiert',
    exported_many: '{n} Dashboard-Dateien exportiert',
    pull: 'Pull',
    pulled_one: '{n} Commit geholt',
    pulled_many: '{n} Commits geholt',
    failed: 'Fehlgeschlagen: {e}',
    zoom_in: 'Vollständige Karte anzeigen',
    zoom_out: 'Zurück zur kompakten Ansicht',
    ed_entity: 'Git-Sync-Sensor',
    ed_entity_helper: 'Statussensor des Repositorys; leer lassen, um ihn automatisch zu finden',
    ed_title: 'Titel',
    ed_title_helper: 'Leer lassen für „Git Sync“',
    ed_show_files: 'Geänderte Dateien',
    ed_show_files_helper: 'Aufklappbare Liste der noch nicht committeten Dateien',
    ed_show_export: 'Dashboard-Export',
    ed_show_export_helper: 'Zeit des letzten Exports und die Schaltfläche Dashboards exportieren',
    ed_zoom: 'Zoom-Schaltfläche',
    ed_zoom_helper: 'Wechselt von der Mini-Karte zur vollständigen Karte und zurück',
    ed_language: 'Sprache',
    ed_language_helper: 'Leer lassen, um Home Assistant zu folgen',
    diff: 'Änderungen anzeigen',
    diff_title: 'Änderungen auf ‘{branch}’',
    diff_loading: 'Änderungen werden geladen…',
    diff_empty: 'Keine Änderungen anzuzeigen',
    diff_binary: 'Binärdatei',
    diff_truncated: 'Diff hier gekürzt: {n} weitere Zeilen',
    diff_more_files: '{n} weitere Dateien nicht angezeigt',
    diff_added: 'Hinzugefügt',
    diff_modified: 'Geändert',
    diff_deleted: 'Gelöscht',
    diff_renamed: 'Umbenannt',
    diff_mode: 'Modus geändert',
    close: 'Schließen',
  },
  es: {
    title: 'Git Sync',
    clean: 'Al día',
    dirty: 'Cambios',
    ahead: 'Push pendiente',
    behind: 'Atrasado',
    diverged: 'Divergido',
    error: 'Error',
    unavailable: 'No disponible',
    working: 'En curso…',
    not_loaded: 'Git Sync no está configurado',
    last_commit: 'Último commit',
    last_push: 'Último push',
    last_export: 'Exportación de paneles',
    changes: 'Cambios',
    files_one: '{n} archivo',
    files_many: '{n} archivos',
    changed_files: 'Archivos modificados',
    no_changes: 'Sin cambios',
    more: '+ {n} más',
    never: 'Nunca',
    commit: 'Commit y push',
    export: 'Exportar paneles',
    confirm_title: '¿Hacer commit y push ahora?',
    confirm_text_one: 'Se hará commit y push de {n} archivo modificado.',
    confirm_text_many: 'Se hará commit y push de {n} archivos modificados.',
    confirm_push: 'Se hará push de los commits pendientes.',
    message: 'Mensaje (Intro para hacer commit en «{branch}»)',
    message_hint: 'Vacío: lo escribe la AI task al hacer commit',
    generate: 'Generar mensaje de commit',
    generated_none: 'Nada que describir: sin cambios',
    cancel: 'Cancelar',
    committed: 'Commit: {m}',
    nothing: 'Nada que confirmar',
    pushed: 'Commits pendientes enviados',
    exported_one: '{n} archivo de panel exportado',
    exported_many: '{n} archivos de panel exportados',
    pull: 'Pull',
    pulled_one: '{n} commit traído',
    pulled_many: '{n} commits traídos',
    failed: 'Error: {e}',
    zoom_in: 'Mostrar la tarjeta completa',
    zoom_out: 'Volver a la vista compacta',
    ed_entity: 'Sensor de Git Sync',
    ed_entity_helper: 'Sensor de estado del repositorio; déjalo vacío para encontrarlo automáticamente',
    ed_title: 'Título',
    ed_title_helper: 'Déjalo vacío para «Git Sync»',
    ed_show_files: 'Archivos modificados',
    ed_show_files_helper: 'Lista plegable de los archivos aún sin commit',
    ed_show_export: 'Exportación de paneles',
    ed_show_export_helper: 'Hora de la última exportación y el botón Exportar paneles',
    ed_zoom: 'Botón de zoom',
    ed_zoom_helper: 'Cambia la minitarjeta a la tarjeta completa y viceversa',
    ed_language: 'Idioma',
    ed_language_helper: 'Déjalo vacío para seguir a Home Assistant',
    diff: 'Ver cambios',
    diff_title: 'Cambios en ‘{branch}’',
    diff_loading: 'Cargando cambios…',
    diff_empty: 'No hay cambios que mostrar',
    diff_binary: 'Archivo binario',
    diff_truncated: 'Diff cortado aquí: {n} líneas más',
    diff_more_files: '{n} archivos más no mostrados',
    diff_added: 'Añadido',
    diff_modified: 'Modificado',
    diff_deleted: 'Eliminado',
    diff_renamed: 'Renombrado',
    diff_mode: 'Modo cambiado',
    close: 'Cerrar',
  },
  it: {
    title: 'Git Sync',
    clean: 'Aggiornato',
    dirty: 'Modifiche',
    ahead: 'Push in sospeso',
    behind: 'Indietro',
    diverged: 'Divergente',
    error: 'Errore',
    unavailable: 'Non disponibile',
    working: 'In corso…',
    not_loaded: 'Git Sync non è configurato',
    last_commit: 'Ultimo commit',
    last_push: 'Ultimo push',
    last_export: 'Esportazione dashboard',
    changes: 'Modifiche',
    files_one: '{n} file',
    files_many: '{n} file',
    changed_files: 'File modificati',
    no_changes: 'Nessuna modifica',
    more: '+ altri {n}',
    never: 'Mai',
    commit: 'Commit e push',
    export: 'Esporta dashboard',
    confirm_title: 'Eseguire commit e push adesso?',
    confirm_text_one: '{n} file modificato verrà incluso nel commit e inviato con push.',
    confirm_text_many: '{n} file modificati verranno inclusi nel commit e inviati con push.',
    confirm_push: 'I commit in attesa verranno inviati con push.',
    message: 'Messaggio (Invio per il commit su “{branch}”)',
    message_hint: 'Vuoto: lo scrive l’attività IA al commit',
    generate: 'Genera messaggio di commit',
    generated_none: 'Niente da descrivere: nessuna modifica',
    cancel: 'Annulla',
    committed: 'Commit eseguito: {m}',
    nothing: 'Niente da includere nel commit',
    pushed: 'Commit in sospeso inviati con push',
    exported_one: '{n} file di dashboard esportato',
    exported_many: '{n} file di dashboard esportati',
    pull: 'Pull',
    pulled_one: '{n} commit scaricato',
    pulled_many: '{n} commit scaricati',
    failed: 'Non riuscito: {e}',
    zoom_in: 'Mostra la scheda completa',
    zoom_out: 'Torna alla vista compatta',
    ed_entity: 'Sensore Git Sync',
    ed_entity_helper: 'Sensore di stato del repository; lascia vuoto per trovarlo automaticamente',
    ed_title: 'Titolo',
    ed_title_helper: 'Lascia vuoto per “Git Sync”',
    ed_show_files: 'File modificati',
    ed_show_files_helper: 'Elenco comprimibile dei file non ancora inclusi in un commit',
    ed_show_export: 'Esportazione dashboard',
    ed_show_export_helper: 'Ora dell’ultima esportazione e pulsante Esporta dashboard',
    ed_zoom: 'Pulsante zoom',
    ed_zoom_helper: 'Passa dalla mini scheda alla scheda completa e viceversa',
    ed_language: 'Lingua',
    ed_language_helper: 'Lascia vuoto per seguire Home Assistant',
    diff: 'Vedi modifiche',
    diff_title: 'Modifiche su ‘{branch}’',
    diff_loading: 'Caricamento delle modifiche…',
    diff_empty: 'Nessuna modifica da mostrare',
    diff_binary: 'File binario',
    diff_truncated: 'Diff interrotto qui: altre {n} righe',
    diff_more_files: 'Altri {n} file non mostrati',
    diff_added: 'Aggiunto',
    diff_modified: 'Modificato',
    diff_deleted: 'Eliminato',
    diff_renamed: 'Rinominato',
    diff_mode: 'Modalità cambiata',
    close: 'Chiudi',
  },
  nl: {
    title: 'Git Sync',
    clean: 'Bijgewerkt',
    dirty: 'Wijzigingen',
    ahead: 'Push in afwachting',
    behind: 'Achter',
    diverged: 'Uiteengelopen',
    error: 'Fout',
    unavailable: 'Niet beschikbaar',
    working: 'Bezig…',
    not_loaded: 'Git Sync is niet ingesteld',
    last_commit: 'Laatste commit',
    last_push: 'Laatste push',
    last_export: 'Dashboardexport',
    changes: 'Wijzigingen',
    files_one: '{n} bestand',
    files_many: '{n} bestanden',
    changed_files: 'Gewijzigde bestanden',
    no_changes: 'Geen wijzigingen',
    more: '+ nog {n}',
    never: 'Nooit',
    commit: 'Commit & push',
    export: 'Dashboards exporteren',
    confirm_title: 'Nu committen en pushen?',
    confirm_text_one: '{n} gewijzigd bestand wordt gecommit en gepusht.',
    confirm_text_many: '{n} gewijzigde bestanden worden gecommit en gepusht.',
    confirm_push: 'De wachtende commits worden gepusht.',
    message: 'Bericht (Enter om te committen op ‘{branch}’)',
    message_hint: 'Leeg: de AI-taak schrijft het bij de commit',
    generate: 'Commitbericht genereren',
    generated_none: 'Niets te beschrijven: geen wijzigingen',
    cancel: 'Annuleren',
    committed: 'Gecommit: {m}',
    nothing: 'Niets om te committen',
    pushed: 'Wachtende commits gepusht',
    exported_one: '{n} dashboardbestand geëxporteerd',
    exported_many: '{n} dashboardbestanden geëxporteerd',
    pull: 'Pull',
    pulled_one: '{n} commit opgehaald',
    pulled_many: '{n} commits opgehaald',
    failed: 'Mislukt: {e}',
    zoom_in: 'Volledige kaart weergeven',
    zoom_out: 'Terug naar de compacte weergave',
    ed_entity: 'Git Sync-sensor',
    ed_entity_helper: 'Statussensor van de repository; leeg laten om hem automatisch te vinden',
    ed_title: 'Titel',
    ed_title_helper: 'Leeg laten voor ‘Git Sync’',
    ed_show_files: 'Gewijzigde bestanden',
    ed_show_files_helper: 'Inklapbare lijst van de nog niet gecommitte bestanden',
    ed_show_export: 'Dashboardexport',
    ed_show_export_helper: 'Tijdstip van de laatste export en de knop Dashboards exporteren',
    ed_zoom: 'Zoomknop',
    ed_zoom_helper: 'Schakelt de minikaart over naar de volledige kaart en terug',
    ed_language: 'Taal',
    ed_language_helper: 'Leeg laten om Home Assistant te volgen',
    diff: 'Wijzigingen bekijken',
    diff_title: 'Wijzigingen op ‘{branch}’',
    diff_loading: 'Wijzigingen laden…',
    diff_empty: 'Geen wijzigingen om te tonen',
    diff_binary: 'Binair bestand',
    diff_truncated: 'Diff hier afgekapt: nog {n} regels',
    diff_more_files: 'Nog {n} bestanden niet getoond',
    diff_added: 'Toegevoegd',
    diff_modified: 'Gewijzigd',
    diff_deleted: 'Verwijderd',
    diff_renamed: 'Hernoemd',
    diff_mode: 'Modus gewijzigd',
    close: 'Sluiten',
  },
  pt: {
    title: 'Git Sync',
    clean: 'Atualizado',
    dirty: 'Alterações',
    ahead: 'Push pendente',
    behind: 'Atrasado',
    diverged: 'Divergente',
    error: 'Erro',
    unavailable: 'Indisponível',
    working: 'A processar…',
    not_loaded: 'O Git Sync não está configurado',
    last_commit: 'Último commit',
    last_push: 'Último push',
    last_export: 'Exportação de painéis',
    changes: 'Alterações',
    files_one: '{n} ficheiro',
    files_many: '{n} ficheiros',
    changed_files: 'Ficheiros alterados',
    no_changes: 'Sem alterações',
    more: '+ mais {n}',
    never: 'Nunca',
    commit: 'Commit e push',
    export: 'Exportar painéis',
    confirm_title: 'Fazer commit e push agora?',
    confirm_text_one: 'Vai ser feito commit e push de {n} ficheiro alterado.',
    confirm_text_many: 'Vai ser feito commit e push de {n} ficheiros alterados.',
    confirm_push: 'Vai ser feito push dos commits pendentes.',
    message: 'Mensagem (Enter para fazer commit em «{branch}»)',
    message_hint: 'Vazio: escrita pela tarefa de IA ao fazer commit',
    generate: 'Gerar mensagem de commit',
    generated_none: 'Nada a descrever: sem alterações',
    cancel: 'Cancelar',
    committed: 'Commit feito: {m}',
    nothing: 'Nada para fazer commit',
    pushed: 'Commits pendentes enviados com push',
    exported_one: '{n} ficheiro de painel exportado',
    exported_many: '{n} ficheiros de painéis exportados',
    pull: 'Pull',
    pulled_one: '{n} commit obtido',
    pulled_many: '{n} commits obtidos',
    failed: 'Falhou: {e}',
    zoom_in: 'Mostrar o cartão completo',
    zoom_out: 'Voltar à vista compacta',
    ed_entity: 'Sensor do Git Sync',
    ed_entity_helper: 'Sensor de estado do repositório; deixe vazio para o encontrar automaticamente',
    ed_title: 'Título',
    ed_title_helper: 'Deixe vazio para «Git Sync»',
    ed_show_files: 'Ficheiros alterados',
    ed_show_files_helper: 'Lista recolhível dos ficheiros ainda sem commit',
    ed_show_export: 'Exportação de painéis',
    ed_show_export_helper: 'Hora da última exportação e o botão Exportar painéis',
    ed_zoom: 'Botão de zoom',
    ed_zoom_helper: 'Alterna o minicartão para o cartão completo e vice-versa',
    ed_language: 'Idioma',
    ed_language_helper: 'Deixe vazio para seguir o Home Assistant',
    diff: 'Ver alterações',
    diff_title: 'Alterações em ‘{branch}’',
    diff_loading: 'A carregar as alterações…',
    diff_empty: 'Sem alterações para mostrar',
    diff_binary: 'Ficheiro binário',
    diff_truncated: 'Diff cortado aqui: mais {n} linhas',
    diff_more_files: 'Mais {n} ficheiros não mostrados',
    diff_added: 'Adicionado',
    diff_modified: 'Modificado',
    diff_deleted: 'Eliminado',
    diff_renamed: 'Renomeado',
    diff_mode: 'Modo alterado',
    close: 'Fechar',
  },
  pl: {
    title: 'Git Sync',
    clean: 'Aktualne',
    dirty: 'Zmiany',
    ahead: 'Oczekuje na push',
    behind: 'W tyle',
    diverged: 'Rozbieżność',
    error: 'Błąd',
    unavailable: 'Niedostępne',
    working: 'W toku…',
    not_loaded: 'Git Sync nie jest skonfigurowany',
    last_commit: 'Ostatni commit',
    last_push: 'Ostatni push',
    last_export: 'Eksport dashboardów',
    changes: 'Zmiany',
    files_one: '{n} plik',
    files_many: 'Pliki: {n}',
    changed_files: 'Zmienione pliki',
    no_changes: 'Brak zmian',
    more: '+ więcej: {n}',
    never: 'Nigdy',
    commit: 'Commit i push',
    export: 'Eksportuj dashboardy',
    confirm_title: 'Wykonać teraz commit i push?',
    confirm_text_one: 'Zostanie wykonany commit i push {n} zmienionego pliku.',
    confirm_text_many: 'Zmienione pliki do commita i pusha: {n}.',
    confirm_push: 'Zostanie wykonany push oczekujących commitów.',
    message: 'Wiadomość (Enter, aby wykonać commit na „{branch}”)',
    message_hint: 'Puste: wiadomość napisze zadanie AI przy commicie',
    generate: 'Wygeneruj wiadomość commita',
    generated_none: 'Nie ma czego opisać: brak zmian',
    cancel: 'Anuluj',
    committed: 'Commit: {m}',
    nothing: 'Brak zmian do commita',
    pushed: 'Wykonano push oczekujących commitów',
    exported_one: 'Wyeksportowano {n} plik dashboardu',
    exported_many: 'Wyeksportowane pliki dashboardów: {n}',
    pull: 'Pull',
    pulled_one: 'Pobrano {n} commit',
    pulled_many: 'Pobrane commity: {n}',
    failed: 'Niepowodzenie: {e}',
    zoom_in: 'Pokaż pełną kartę',
    zoom_out: 'Wróć do widoku kompaktowego',
    ed_entity: 'Czujnik Git Sync',
    ed_entity_helper: 'Czujnik stanu repozytorium; pozostaw puste, aby znaleźć go automatycznie',
    ed_title: 'Tytuł',
    ed_title_helper: 'Pozostaw puste, aby użyć „Git Sync”',
    ed_show_files: 'Zmienione pliki',
    ed_show_files_helper: 'Zwijana lista plików jeszcze nieobjętych commitem',
    ed_show_export: 'Eksport dashboardów',
    ed_show_export_helper: 'Czas ostatniego eksportu i przycisk Eksportuj dashboardy',
    ed_zoom: 'Przycisk powiększenia',
    ed_zoom_helper: 'Przełącza minikartę na pełną kartę i z powrotem',
    ed_language: 'Język',
    ed_language_helper: 'Pozostaw puste, aby używać języka Home Assistanta',
    diff: 'Zobacz zmiany',
    diff_title: 'Zmiany na ‘{branch}’',
    diff_loading: 'Wczytywanie zmian…',
    diff_empty: 'Brak zmian do pokazania',
    diff_binary: 'Plik binarny',
    diff_truncated: 'Diff ucięty tutaj: pozostałe wiersze: {n}',
    diff_more_files: 'Niepokazane pliki: {n}',
    diff_added: 'Dodano',
    diff_modified: 'Zmieniono',
    diff_deleted: 'Usunięto',
    diff_renamed: 'Zmieniono nazwę',
    diff_mode: 'Zmieniono tryb',
    close: 'Zamknij',
  },
  ro: {
    title: 'Git Sync',
    clean: 'Actualizat',
    dirty: 'Modificări',
    ahead: 'Push restant',
    behind: 'În urmă',
    diverged: 'Divergent',
    error: 'Eroare',
    unavailable: 'Indisponibil',
    working: 'În curs…',
    not_loaded: 'Git Sync nu este configurat',
    last_commit: 'Ultimul commit',
    last_push: 'Ultimul push',
    last_export: 'Export tablouri de bord',
    changes: 'Modificări',
    files_one: '{n} fișier',
    files_many: 'Fișiere: {n}',
    changed_files: 'Fișiere modificate',
    no_changes: 'Nicio modificare',
    more: '+ încă {n}',
    never: 'Niciodată',
    commit: 'Commit și push',
    export: 'Exportă tablourile de bord',
    confirm_title: 'Faceți commit și push acum?',
    confirm_text_one: 'Pentru {n} fișier modificat se va face commit și push.',
    confirm_text_many: 'Fișiere modificate pentru commit și push: {n}.',
    confirm_push: 'Commiturile în așteptare vor fi trimise prin push.',
    message: 'Mesaj (Enter pentru commit pe „{branch}”)',
    message_hint: 'Gol: îl scrie sarcina AI la commit',
    generate: 'Generează mesajul de commit',
    generated_none: 'Nimic de descris: nicio modificare',
    cancel: 'Anulează',
    committed: 'Commit: {m}',
    nothing: 'Nimic de inclus în commit',
    pushed: 'Commiturile în așteptare au fost trimise prin push',
    exported_one: '{n} fișier de tablou de bord exportat',
    exported_many: 'Fișiere de tablouri de bord exportate: {n}',
    pull: 'Pull',
    pulled_one: '{n} commit preluat',
    pulled_many: 'Commit-uri preluate: {n}',
    failed: 'Eșuat: {e}',
    zoom_in: 'Afișează cardul complet',
    zoom_out: 'Înapoi la vizualizarea compactă',
    ed_entity: 'Senzor Git Sync',
    ed_entity_helper: 'Senzorul de stare al depozitului; lăsați gol pentru a-l găsi automat',
    ed_title: 'Titlu',
    ed_title_helper: 'Lăsați gol pentru „Git Sync”',
    ed_show_files: 'Fișiere modificate',
    ed_show_files_helper: 'Listă pliabilă a fișierelor încă neincluse într-un commit',
    ed_show_export: 'Export tablouri de bord',
    ed_show_export_helper: 'Ora ultimului export și butonul Exportă tablourile de bord',
    ed_zoom: 'Buton de zoom',
    ed_zoom_helper: 'Comută minicardul la cardul complet și înapoi',
    ed_language: 'Limbă',
    ed_language_helper: 'Lăsați gol pentru a urma limba Home Assistant',
    diff: 'Vezi modificările',
    diff_title: 'Modificări pe ‘{branch}’',
    diff_loading: 'Se încarcă modificările…',
    diff_empty: 'Nicio modificare de afișat',
    diff_binary: 'Fișier binar',
    diff_truncated: 'Diff tăiat aici: încă {n} linii',
    diff_more_files: 'Încă {n} fișiere neafișate',
    diff_added: 'Adăugat',
    diff_modified: 'Modificat',
    diff_deleted: 'Șters',
    diff_renamed: 'Redenumit',
    diff_mode: 'Mod schimbat',
    close: 'Închide',
  },
  da: {
    title: 'Git Sync',
    clean: 'Opdateret',
    dirty: 'Ændringer',
    ahead: 'Push afventer',
    behind: 'Bagud',
    diverged: 'Divergeret',
    error: 'Fejl',
    unavailable: 'Utilgængelig',
    working: 'I gang…',
    not_loaded: 'Git Sync er ikke sat op',
    last_commit: 'Seneste commit',
    last_push: 'Seneste push',
    last_export: 'Dashboardeksport',
    changes: 'Ændringer',
    files_one: '{n} fil',
    files_many: '{n} filer',
    changed_files: 'Ændrede filer',
    no_changes: 'Ingen ændringer',
    more: '+ {n} mere',
    never: 'Aldrig',
    commit: 'Commit og push',
    export: 'Eksportér dashboards',
    confirm_title: 'Commit og push nu?',
    confirm_text_one: '{n} ændret fil bliver committet og pushet.',
    confirm_text_many: '{n} ændrede filer bliver committet og pushet.',
    confirm_push: 'De ventende commits bliver pushet.',
    message: 'Besked (Enter for at committe på “{branch}”)',
    message_hint: 'Tom: AI-opgaven skriver den ved commit',
    generate: 'Generér commitbesked',
    generated_none: 'Intet at beskrive: ingen ændringer',
    cancel: 'Annuller',
    committed: 'Committet: {m}',
    nothing: 'Intet at committe',
    pushed: 'Ventende commits pushet',
    exported_one: '{n} dashboardfil eksporteret',
    exported_many: '{n} dashboardfiler eksporteret',
    pull: 'Pull',
    pulled_one: '{n} commit hentet',
    pulled_many: '{n} commits hentet',
    failed: 'Mislykkedes: {e}',
    zoom_in: 'Vis hele kortet',
    zoom_out: 'Tilbage til kompakt visning',
    ed_entity: 'Git Sync-sensor',
    ed_entity_helper: 'Statussensor for repositoriet; lad feltet være tomt for at finde den automatisk',
    ed_title: 'Titel',
    ed_title_helper: 'Lad feltet være tomt for “Git Sync”',
    ed_show_files: 'Ændrede filer',
    ed_show_files_helper: 'Sammenklappelig liste over filer, der endnu ikke er committet',
    ed_show_export: 'Dashboardeksport',
    ed_show_export_helper: 'Tidspunkt for seneste eksport og knappen Eksportér dashboards',
    ed_zoom: 'Zoomknap',
    ed_zoom_helper: 'Skifter minikortet til hele kortet og tilbage',
    ed_language: 'Sprog',
    ed_language_helper: 'Lad feltet være tomt for at følge Home Assistant',
    diff: 'Vis ændringer',
    diff_title: 'Ændringer på ‘{branch}’',
    diff_loading: 'Indlæser ændringer…',
    diff_empty: 'Ingen ændringer at vise',
    diff_binary: 'Binær fil',
    diff_truncated: 'Diff afkortet her: {n} linjer mere',
    diff_more_files: '{n} filer mere ikke vist',
    diff_added: 'Tilføjet',
    diff_modified: 'Ændret',
    diff_deleted: 'Slettet',
    diff_renamed: 'Omdøbt',
    diff_mode: 'Tilstand ændret',
    close: 'Luk',
  },
  sv: {
    title: 'Git Sync',
    clean: 'Uppdaterad',
    dirty: 'Ändringar',
    ahead: 'Push väntar',
    behind: 'Efter',
    diverged: 'Divergerat',
    error: 'Fel',
    unavailable: 'Ej tillgänglig',
    working: 'Pågår…',
    not_loaded: 'Git Sync är inte konfigurerat',
    last_commit: 'Senaste commit',
    last_push: 'Senaste push',
    last_export: 'Export av paneler',
    changes: 'Ändringar',
    files_one: '{n} fil',
    files_many: '{n} filer',
    changed_files: 'Ändrade filer',
    no_changes: 'Inga ändringar',
    more: '+ {n} till',
    never: 'Aldrig',
    commit: 'Commit och push',
    export: 'Exportera paneler',
    confirm_title: 'Göra commit och push nu?',
    confirm_text_one: '{n} ändrad fil kommer att committas och pushas.',
    confirm_text_many: '{n} ändrade filer kommer att committas och pushas.',
    confirm_push: 'De väntande commitarna kommer att pushas.',
    message: 'Meddelande (Enter för commit på ”{branch}”)',
    message_hint: 'Tomt: AI-uppgiften skriver det vid commit',
    generate: 'Generera commitmeddelande',
    generated_none: 'Inget att beskriva: inga ändringar',
    cancel: 'Avbryt',
    committed: 'Committat: {m}',
    nothing: 'Inget att committa',
    pushed: 'Väntande commits pushade',
    exported_one: '{n} instrumentpanelsfil exporterad',
    exported_many: '{n} instrumentpanelsfiler exporterade',
    pull: 'Pull',
    pulled_one: '{n} commit hämtad',
    pulled_many: '{n} commits hämtade',
    failed: 'Misslyckades: {e}',
    zoom_in: 'Visa hela kortet',
    zoom_out: 'Tillbaka till kompakt vy',
    ed_entity: 'Git Sync-sensor',
    ed_entity_helper: 'Statussensor för förrådet; lämna tomt för att hitta den automatiskt',
    ed_title: 'Rubrik',
    ed_title_helper: 'Lämna tomt för ”Git Sync”',
    ed_show_files: 'Ändrade filer',
    ed_show_files_helper: 'Hopfällbar lista över filer som ännu inte har committats',
    ed_show_export: 'Export av paneler',
    ed_show_export_helper: 'Tid för senaste export och knappen Exportera paneler',
    ed_zoom: 'Zoomknapp',
    ed_zoom_helper: 'Växlar minikortet till hela kortet och tillbaka',
    ed_language: 'Språk',
    ed_language_helper: 'Lämna tomt för att följa Home Assistant',
    diff: 'Visa ändringar',
    diff_title: 'Ändringar på ‘{branch}’',
    diff_loading: 'Läser in ändringar…',
    diff_empty: 'Inga ändringar att visa',
    diff_binary: 'Binär fil',
    diff_truncated: 'Diff avkortad här: {n} rader till',
    diff_more_files: '{n} filer till visas inte',
    diff_added: 'Tillagd',
    diff_modified: 'Ändrad',
    diff_deleted: 'Borttagen',
    diff_renamed: 'Omdöpt',
    diff_mode: 'Läge ändrat',
    close: 'Stäng',
  },
  bg: {
    title: 'Git Sync',
    clean: 'Актуално',
    dirty: 'Промени',
    ahead: 'Чакащ push',
    behind: 'Изостава',
    diverged: 'Разклонено',
    error: 'Грешка',
    unavailable: 'Недостъпно',
    working: 'В процес…',
    not_loaded: 'Git Sync не е настроен',
    last_commit: 'Последен commit',
    last_push: 'Последен push',
    last_export: 'Експорт на таблата',
    changes: 'Промени',
    files_one: '{n} файл',
    files_many: '{n} файла',
    changed_files: 'Променени файлове',
    no_changes: 'Няма промени',
    more: '+ още {n}',
    never: 'Никога',
    commit: 'Commit и push',
    export: 'Експорт на таблата',
    confirm_title: 'Commit и push сега?',
    confirm_text_one: 'За {n} променен файл ще бъде направен commit и push.',
    confirm_text_many: 'За {n} променени файла ще бъде направен commit и push.',
    confirm_push: 'Чакащите commit-и ще бъдат изпратени с push.',
    message: 'Съобщение (Enter за commit в „{branch}“)',
    message_hint: 'Празно: AI задачата го пише при commit',
    generate: 'Генериране на commit съобщение',
    generated_none: 'Няма какво да се опише: няма промени',
    cancel: 'Отказ',
    committed: 'Commit: {m}',
    nothing: 'Няма нищо за commit',
    pushed: 'Чакащите commit-и са изпратени с push',
    exported_one: 'Експортиран е {n} файл на табло',
    exported_many: 'Експортирани са {n} файла на табла',
    pull: 'Pull',
    pulled_one: 'Изтеглен е {n} commit',
    pulled_many: 'Изтеглени commit-и: {n}',
    failed: 'Неуспех: {e}',
    zoom_in: 'Показване на цялата карта',
    zoom_out: 'Обратно към компактния изглед',
    ed_entity: 'Сензор на Git Sync',
    ed_entity_helper: 'Сензор за състоянието на хранилището; оставете празно, за да бъде открит автоматично',
    ed_title: 'Заглавие',
    ed_title_helper: 'Оставете празно за „Git Sync“',
    ed_show_files: 'Променени файлове',
    ed_show_files_helper: 'Сгъваем списък на файловете, за които още няма commit',
    ed_show_export: 'Експорт на таблата',
    ed_show_export_helper: 'Час на последния експорт и бутонът „Експорт на таблата“',
    ed_zoom: 'Бутон за мащабиране',
    ed_zoom_helper: 'Превключва мини картата към цялата карта и обратно',
    ed_language: 'Език',
    ed_language_helper: 'Оставете празно, за да следва езика на Home Assistant',
    diff: 'Преглед на промените',
    diff_title: 'Промени в ‘{branch}’',
    diff_loading: 'Зареждане на промените…',
    diff_empty: 'Няма промени за показване',
    diff_binary: 'Двоичен файл',
    diff_truncated: 'Diff отрязан тук: още {n} реда',
    diff_more_files: 'Още {n} файла не са показани',
    diff_added: 'Добавен',
    diff_modified: 'Променен',
    diff_deleted: 'Изтрит',
    diff_renamed: 'Преименуван',
    diff_mode: 'Променен режим',
    close: 'Затвори',
  },
  ru: {
    title: 'Git Sync',
    clean: 'Актуально',
    dirty: 'Изменения',
    ahead: 'Ждёт push',
    behind: 'Отстаёт',
    diverged: 'Расхождение',
    error: 'Ошибка',
    unavailable: 'Недоступно',
    working: 'В работе…',
    not_loaded: 'Git Sync не настроен',
    last_commit: 'Последний commit',
    last_push: 'Последний push',
    last_export: 'Экспорт панелей',
    changes: 'Изменения',
    files_one: '{n} файл',
    files_many: 'Файлы: {n}',
    changed_files: 'Изменённые файлы',
    no_changes: 'Нет изменений',
    more: '+ ещё {n}',
    never: 'Никогда',
    commit: 'Commit и push',
    export: 'Экспортировать панели',
    confirm_title: 'Commit и push сейчас?',
    confirm_text_one: 'Для {n} изменённого файла будут выполнены commit и push.',
    confirm_text_many: 'Изменённые файлы для commit и push: {n}.',
    confirm_push: 'Ожидающие commit-ы будут отправлены через push.',
    message: 'Сообщение (Enter — commit в «{branch}»)',
    message_hint: 'Пусто: сообщение напишет AI-задача при commit',
    generate: 'Сгенерировать сообщение commit',
    generated_none: 'Нечего описывать: нет изменений',
    cancel: 'Отмена',
    committed: 'Commit: {m}',
    nothing: 'Нечего добавить в commit',
    pushed: 'Ожидающие commit-ы отправлены через push',
    exported_one: 'Экспортирован {n} файл панели',
    exported_many: 'Экспортированные файлы панелей: {n}',
    pull: 'Pull',
    pulled_one: 'Получен {n} commit',
    pulled_many: 'Полученные commit-ы: {n}',
    failed: 'Ошибка: {e}',
    zoom_in: 'Показать полную карточку',
    zoom_out: 'Вернуться к компактному виду',
    ed_entity: 'Датчик Git Sync',
    ed_entity_helper: 'Датчик состояния репозитория; оставьте пустым, чтобы найти его автоматически',
    ed_title: 'Заголовок',
    ed_title_helper: 'Оставьте пустым для «Git Sync»',
    ed_show_files: 'Изменённые файлы',
    ed_show_files_helper: 'Сворачиваемый список файлов, ещё не включённых в commit',
    ed_show_export: 'Экспорт панелей',
    ed_show_export_helper: 'Время последнего экспорта и кнопка «Экспортировать панели»',
    ed_zoom: 'Кнопка масштаба',
    ed_zoom_helper: 'Переключает мини-карточку на полную карточку и обратно',
    ed_language: 'Язык',
    ed_language_helper: 'Оставьте пустым, чтобы использовать язык Home Assistant',
    diff: 'Показать изменения',
    diff_title: 'Изменения в ‘{branch}’',
    diff_loading: 'Загрузка изменений…',
    diff_empty: 'Нет изменений для показа',
    diff_binary: 'Двоичный файл',
    diff_truncated: 'Diff обрезан здесь: ещё строк: {n}',
    diff_more_files: 'Не показано файлов: {n}',
    diff_added: 'Добавлен',
    diff_modified: 'Изменён',
    diff_deleted: 'Удалён',
    diff_renamed: 'Переименован',
    diff_mode: 'Режим изменён',
    close: 'Закрыть',
  },
  uk: {
    title: 'Git Sync',
    clean: 'Актуально',
    dirty: 'Зміни',
    ahead: 'Очікує push',
    behind: 'Відстає',
    diverged: 'Розбіжність',
    error: 'Помилка',
    unavailable: 'Недоступно',
    working: 'Триває…',
    not_loaded: 'Git Sync не налаштовано',
    last_commit: 'Останній commit',
    last_push: 'Останній push',
    last_export: 'Експорт панелей',
    changes: 'Зміни',
    files_one: '{n} файл',
    files_many: 'Файли: {n}',
    changed_files: 'Змінені файли',
    no_changes: 'Немає змін',
    more: '+ ще {n}',
    never: 'Ніколи',
    commit: 'Commit і push',
    export: 'Експортувати панелі',
    confirm_title: 'Commit і push зараз?',
    confirm_text_one: 'Для {n} зміненого файлу буде виконано commit і push.',
    confirm_text_many: 'Змінені файли для commit і push: {n}.',
    confirm_push: 'Commit-и, що очікують, буде надіслано через push.',
    message: 'Повідомлення (Enter — commit у «{branch}»)',
    message_hint: 'Порожньо: повідомлення напише AI-завдання під час commit',
    generate: 'Згенерувати повідомлення commit',
    generated_none: 'Нічого описувати: немає змін',
    cancel: 'Скасувати',
    committed: 'Commit: {m}',
    nothing: 'Нічого додавати в commit',
    pushed: 'Commit-и, що очікували, надіслано через push',
    exported_one: 'Експортовано {n} файл панелі',
    exported_many: 'Експортовані файли панелей: {n}',
    pull: 'Pull',
    pulled_one: 'Отримано {n} commit',
    pulled_many: 'Отримані commit-и: {n}',
    failed: 'Помилка: {e}',
    zoom_in: 'Показати повну картку',
    zoom_out: 'Повернутися до компактного вигляду',
    ed_entity: 'Датчик Git Sync',
    ed_entity_helper: 'Датчик стану репозиторію; залиште порожнім, щоб знайти його автоматично',
    ed_title: 'Заголовок',
    ed_title_helper: 'Залиште порожнім для «Git Sync»',
    ed_show_files: 'Змінені файли',
    ed_show_files_helper: 'Згортуваний список файлів, ще не включених у commit',
    ed_show_export: 'Експорт панелей',
    ed_show_export_helper: 'Час останнього експорту та кнопка «Експортувати панелі»',
    ed_zoom: 'Кнопка масштабу',
    ed_zoom_helper: 'Перемикає міні-картку на повну картку й назад',
    ed_language: 'Мова',
    ed_language_helper: 'Залиште порожнім, щоб використовувати мову Home Assistant',
    diff: 'Показати зміни',
    diff_title: 'Зміни у ‘{branch}’',
    diff_loading: 'Завантаження змін…',
    diff_empty: 'Немає змін для показу',
    diff_binary: 'Двійковий файл',
    diff_truncated: 'Diff обрізано тут: ще рядків: {n}',
    diff_more_files: 'Не показано файлів: {n}',
    diff_added: 'Додано',
    diff_modified: 'Змінено',
    diff_deleted: 'Видалено',
    diff_renamed: 'Перейменовано',
    diff_mode: 'Режим змінено',
    close: 'Закрити',
  },
  hu: {
    title: 'Git Sync',
    clean: 'Naprakész',
    dirty: 'Változások',
    ahead: 'Push vár',
    behind: 'Lemaradás',
    diverged: 'Elágazott',
    error: 'Hiba',
    unavailable: 'Nem elérhető',
    working: 'Dolgozik…',
    not_loaded: 'A Git Sync nincs beállítva',
    last_commit: 'Utolsó commit',
    last_push: 'Utolsó push',
    last_export: 'Irányítópult-exportálás',
    changes: 'Módosítások',
    files_one: '{n} fájl',
    files_many: '{n} fájl',
    changed_files: 'Módosított fájlok',
    no_changes: 'Nincs módosítás',
    more: '+ még {n}',
    never: 'Soha',
    commit: 'Commit és push',
    export: 'Irányítópultok exportálása',
    confirm_title: 'Commit és push most?',
    confirm_text_one: '{n} módosított fájl kerül commitolásra és pusholásra.',
    confirm_text_many: '{n} módosított fájl kerül commitolásra és pusholásra.',
    confirm_push: 'A várakozó commitok pusholásra kerülnek.',
    message: 'Üzenet (Enter a commithoz ide: „{branch}”)',
    message_hint: 'Üres: az MI-feladat írja meg a commitkor',
    generate: 'Commitüzenet generálása',
    generated_none: 'Nincs mit leírni: nincs módosítás',
    cancel: 'Mégse',
    committed: 'Commitolva: {m}',
    nothing: 'Nincs mit commitolni',
    pushed: 'A várakozó commitok pusholva',
    exported_one: '{n} irányítópultfájl exportálva',
    exported_many: '{n} irányítópultfájl exportálva',
    pull: 'Pull',
    pulled_one: '{n} commit lekérve',
    pulled_many: '{n} commit lekérve',
    failed: 'Sikertelen: {e}',
    zoom_in: 'Teljes kártya megjelenítése',
    zoom_out: 'Vissza a kompakt nézethez',
    ed_entity: 'Git Sync-érzékelő',
    ed_entity_helper: 'A tároló állapotérzékelője; hagyja üresen az automatikus kereséshez',
    ed_title: 'Cím',
    ed_title_helper: 'Hagyja üresen a „Git Sync” címhez',
    ed_show_files: 'Módosított fájlok',
    ed_show_files_helper: 'A még nem commitolt fájlok összecsukható listája',
    ed_show_export: 'Irányítópult-exportálás',
    ed_show_export_helper: 'Az utolsó exportálás ideje és az Irányítópultok exportálása gomb',
    ed_zoom: 'Nagyítás gomb',
    ed_zoom_helper: 'A minikártyát teljes kártyára váltja, majd vissza',
    ed_language: 'Nyelv',
    ed_language_helper: 'Hagyja üresen a Home Assistant nyelvének követéséhez',
    diff: 'Változások megtekintése',
    diff_title: 'Változások itt: ‘{branch}’',
    diff_loading: 'Változások betöltése…',
    diff_empty: 'Nincs megjeleníthető változás',
    diff_binary: 'Bináris fájl',
    diff_truncated: 'A diff itt le van vágva: még {n} sor',
    diff_more_files: 'Még {n} fájl nincs megjelenítve',
    diff_added: 'Hozzáadva',
    diff_modified: 'Módosítva',
    diff_deleted: 'Törölve',
    diff_renamed: 'Átnevezve',
    diff_mode: 'Mód megváltozott',
    close: 'Bezárás',
  },
  sk: {
    title: 'Git Sync',
    clean: 'Aktuálne',
    dirty: 'Zmeny',
    ahead: 'Čaká na push',
    behind: 'Pozadu',
    diverged: 'Rozchádza sa',
    error: 'Chyba',
    unavailable: 'Nedostupné',
    working: 'Prebieha…',
    not_loaded: 'Git Sync nie je nastavený',
    last_commit: 'Posledný commit',
    last_push: 'Posledný push',
    last_export: 'Export dashboardov',
    changes: 'Zmeny',
    files_one: '{n} súbor',
    files_many: 'Súbory: {n}',
    changed_files: 'Zmenené súbory',
    no_changes: 'Žiadne zmeny',
    more: '+ ďalšie: {n}',
    never: 'Nikdy',
    commit: 'Commit a push',
    export: 'Exportovať dashboardy',
    confirm_title: 'Vykonať commit a push teraz?',
    confirm_text_one: 'Pre {n} zmenený súbor sa vykoná commit a push.',
    confirm_text_many: 'Zmenené súbory na commit a push: {n}.',
    confirm_push: 'Čakajúce commity sa odošlú cez push.',
    message: 'Správa (Enter pre commit na „{branch}“)',
    message_hint: 'Prázdne: správu napíše úloha AI pri commite',
    generate: 'Vygenerovať správu commitu',
    generated_none: 'Nie je čo popísať: žiadne zmeny',
    cancel: 'Zrušiť',
    committed: 'Commit: {m}',
    nothing: 'Nie je čo commitnúť',
    pushed: 'Čakajúce commity odoslané cez push',
    exported_one: 'Exportovaný {n} súbor dashboardu',
    exported_many: 'Exportované súbory dashboardov: {n}',
    pull: 'Pull',
    pulled_one: 'Načítaný {n} commit',
    pulled_many: 'Načítané commity: {n}',
    failed: 'Zlyhalo: {e}',
    zoom_in: 'Zobraziť celú kartu',
    zoom_out: 'Späť na kompaktné zobrazenie',
    ed_entity: 'Senzor Git Sync',
    ed_entity_helper: 'Senzor stavu repozitára; nechajte prázdne na automatické vyhľadanie',
    ed_title: 'Nadpis',
    ed_title_helper: 'Nechajte prázdne pre „Git Sync“',
    ed_show_files: 'Zmenené súbory',
    ed_show_files_helper: 'Zbaliteľný zoznam súborov, ktoré ešte nie sú v commite',
    ed_show_export: 'Export dashboardov',
    ed_show_export_helper: 'Čas posledného exportu a tlačidlo Exportovať dashboardy',
    ed_zoom: 'Tlačidlo priblíženia',
    ed_zoom_helper: 'Prepína minikartu na celú kartu a späť',
    ed_language: 'Jazyk',
    ed_language_helper: 'Nechajte prázdne, ak sa má použiť jazyk Home Assistanta',
    diff: 'Zobraziť zmeny',
    diff_title: 'Zmeny na ‘{branch}’',
    diff_loading: 'Načítavajú sa zmeny…',
    diff_empty: 'Žiadne zmeny na zobrazenie',
    diff_binary: 'Binárny súbor',
    diff_truncated: 'Diff tu skrátený: ďalších riadkov: {n}',
    diff_more_files: 'Nezobrazených súborov: {n}',
    diff_added: 'Pridané',
    diff_modified: 'Zmenené',
    diff_deleted: 'Odstránené',
    diff_renamed: 'Premenované',
    diff_mode: 'Zmenený režim',
    close: 'Zavrieť',
  },
  cs: {
    title: 'Git Sync',
    clean: 'Aktuální',
    dirty: 'Změny',
    ahead: 'Čeká na push',
    behind: 'Pozadu',
    diverged: 'Rozchází se',
    error: 'Chyba',
    unavailable: 'Nedostupné',
    working: 'Probíhá…',
    not_loaded: 'Git Sync není nastaven',
    last_commit: 'Poslední commit',
    last_push: 'Poslední push',
    last_export: 'Export dashboardů',
    changes: 'Změny',
    files_one: '{n} soubor',
    files_many: 'Soubory: {n}',
    changed_files: 'Změněné soubory',
    no_changes: 'Žádné změny',
    more: '+ další: {n}',
    never: 'Nikdy',
    commit: 'Commit a push',
    export: 'Exportovat dashboardy',
    confirm_title: 'Provést commit a push nyní?',
    confirm_text_one: 'Pro {n} změněný soubor bude proveden commit a push.',
    confirm_text_many: 'Změněné soubory pro commit a push: {n}.',
    confirm_push: 'Čekající commity budou odeslány pomocí push.',
    message: 'Zpráva (Enter pro commit do „{branch}“)',
    message_hint: 'Prázdné: zprávu napíše úloha AI při commitu',
    generate: 'Vygenerovat zprávu commitu',
    generated_none: 'Není co popsat: žádné změny',
    cancel: 'Zrušit',
    committed: 'Commit: {m}',
    nothing: 'Není co commitnout',
    pushed: 'Čekající commity odeslány pomocí push',
    exported_one: 'Exportován {n} soubor dashboardu',
    exported_many: 'Exportované soubory dashboardů: {n}',
    pull: 'Pull',
    pulled_one: 'Načten {n} commit',
    pulled_many: 'Načtené commity: {n}',
    failed: 'Selhalo: {e}',
    zoom_in: 'Zobrazit celou kartu',
    zoom_out: 'Zpět na kompaktní zobrazení',
    ed_entity: 'Senzor Git Sync',
    ed_entity_helper: 'Senzor stavu repozitáře; ponechte prázdné pro automatické vyhledání',
    ed_title: 'Nadpis',
    ed_title_helper: 'Ponechte prázdné pro „Git Sync“',
    ed_show_files: 'Změněné soubory',
    ed_show_files_helper: 'Sbalitelný seznam souborů, které ještě nejsou v commitu',
    ed_show_export: 'Export dashboardů',
    ed_show_export_helper: 'Čas posledního exportu a tlačítko Exportovat dashboardy',
    ed_zoom: 'Tlačítko přiblížení',
    ed_zoom_helper: 'Přepíná minikartu na celou kartu a zpět',
    ed_language: 'Jazyk',
    ed_language_helper: 'Ponechte prázdné pro použití jazyka Home Assistanta',
    diff: 'Zobrazit změny',
    diff_title: 'Změny na ‘{branch}’',
    diff_loading: 'Načítání změn…',
    diff_empty: 'Žádné změny k zobrazení',
    diff_binary: 'Binární soubor',
    diff_truncated: 'Diff zde zkrácen: dalších řádků: {n}',
    diff_more_files: 'Nezobrazených souborů: {n}',
    diff_added: 'Přidáno',
    diff_modified: 'Změněno',
    diff_deleted: 'Odstraněno',
    diff_renamed: 'Přejmenováno',
    diff_mode: 'Změněn režim',
    close: 'Zavřít',
  },
  sl: {
    title: 'Git Sync',
    clean: 'Ažurno',
    dirty: 'Spremembe',
    ahead: 'Čaka na push',
    behind: 'Zaostaja',
    diverged: 'Razhaja se',
    error: 'Napaka',
    unavailable: 'Ni na voljo',
    working: 'V teku…',
    not_loaded: 'Git Sync ni nastavljen',
    last_commit: 'Zadnji commit',
    last_push: 'Zadnji push',
    last_export: 'Izvoz nadzornih plošč',
    changes: 'Spremembe',
    files_one: '{n} datoteka',
    files_many: 'Datoteke: {n}',
    changed_files: 'Spremenjene datoteke',
    no_changes: 'Ni sprememb',
    more: '+ še {n}',
    never: 'Nikoli',
    commit: 'Commit in push',
    export: 'Izvozi nadzorne plošče',
    confirm_title: 'Izvedem commit in push zdaj?',
    confirm_text_one: 'Za {n} spremenjeno datoteko bosta izvedena commit in push.',
    confirm_text_many: 'Spremenjene datoteke za commit in push: {n}.',
    confirm_push: 'Commiti na čakanju bodo poslani s push.',
    message: 'Sporočilo (Enter za commit na »{branch}«)',
    message_hint: 'Prazno: sporočilo napiše opravilo AI ob commitu',
    generate: 'Ustvari sporočilo commita',
    generated_none: 'Ni česa opisati: ni sprememb',
    cancel: 'Prekliči',
    committed: 'Commit: {m}',
    nothing: 'Ni česa za commit',
    pushed: 'Commiti na čakanju so poslani s push',
    exported_one: 'Izvožena {n} datoteka nadzorne plošče',
    exported_many: 'Izvožene datoteke nadzornih plošč: {n}',
    pull: 'Pull',
    pulled_one: 'Pridobljen {n} commit',
    pulled_many: 'Pridobljeni commiti: {n}',
    failed: 'Ni uspelo: {e}',
    zoom_in: 'Prikaži celotno kartico',
    zoom_out: 'Nazaj na strnjen pogled',
    ed_entity: 'Senzor Git Sync',
    ed_entity_helper: 'Senzor stanja repozitorija; pustite prazno za samodejno iskanje',
    ed_title: 'Naslov',
    ed_title_helper: 'Pustite prazno za »Git Sync«',
    ed_show_files: 'Spremenjene datoteke',
    ed_show_files_helper: 'Zložljiv seznam datotek, ki še niso v commitu',
    ed_show_export: 'Izvoz nadzornih plošč',
    ed_show_export_helper: 'Čas zadnjega izvoza in gumb Izvozi nadzorne plošče',
    ed_zoom: 'Gumb za povečavo',
    ed_zoom_helper: 'Preklopi mini kartico na celotno kartico in nazaj',
    ed_language: 'Jezik',
    ed_language_helper: 'Pustite prazno za jezik Home Assistanta',
    diff: 'Prikaži spremembe',
    diff_title: 'Spremembe na ‘{branch}’',
    diff_loading: 'Nalaganje sprememb…',
    diff_empty: 'Ni sprememb za prikaz',
    diff_binary: 'Binarna datoteka',
    diff_truncated: 'Diff tu odrezan: še vrstic: {n}',
    diff_more_files: 'Neprikazanih datotek: {n}',
    diff_added: 'Dodano',
    diff_modified: 'Spremenjeno',
    diff_deleted: 'Izbrisano',
    diff_renamed: 'Preimenovano',
    diff_mode: 'Spremenjen način',
    close: 'Zapri',
  },
  lv: {
    title: 'Git Sync',
    clean: 'Aktuāls',
    dirty: 'Izmaiņas',
    ahead: 'Gaida push',
    behind: 'Atpaliek',
    diverged: 'Atšķiras',
    error: 'Kļūda',
    unavailable: 'Nav pieejams',
    working: 'Notiek…',
    not_loaded: 'Git Sync nav iestatīts',
    last_commit: 'Pēdējais commit',
    last_push: 'Pēdējais push',
    last_export: 'Paneļu eksports',
    changes: 'Izmaiņas',
    files_one: '{n} fails',
    files_many: 'Faili: {n}',
    changed_files: 'Mainītie faili',
    no_changes: 'Nav izmaiņu',
    more: '+ vēl {n}',
    never: 'Nekad',
    commit: 'Commit un push',
    export: 'Eksportēt paneļus',
    confirm_title: 'Veikt commit un push tagad?',
    confirm_text_one: '{n} mainītajam failam tiks veikts commit un push.',
    confirm_text_many: 'Mainītie faili commit un push: {n}.',
    confirm_push: 'Gaidošajiem commit tiks veikts push.',
    message: 'Ziņojums (Enter — commit zarā “{branch}”)',
    message_hint: 'Tukšs: ziņojumu commit brīdī uzraksta AI uzdevums',
    generate: 'Ģenerēt commit ziņojumu',
    generated_none: 'Nav ko aprakstīt: nav izmaiņu',
    cancel: 'Atcelt',
    committed: 'Commit: {m}',
    nothing: 'Nav ko iekļaut commit',
    pushed: 'Gaidošajiem commit veikts push',
    exported_one: 'Eksportēts {n} paneļa fails',
    exported_many: 'Eksportētie paneļu faili: {n}',
    pull: 'Pull',
    pulled_one: 'Ielādēts {n} commit',
    pulled_many: 'Ielādētie commit: {n}',
    failed: 'Neizdevās: {e}',
    zoom_in: 'Rādīt pilno karti',
    zoom_out: 'Atpakaļ uz kompakto skatu',
    ed_entity: 'Git Sync sensors',
    ed_entity_helper: 'Repozitorija statusa sensors; atstājiet tukšu, lai to atrastu automātiski',
    ed_title: 'Virsraksts',
    ed_title_helper: 'Atstājiet tukšu, lai būtu “Git Sync”',
    ed_show_files: 'Mainītie faili',
    ed_show_files_helper: 'Sakļaujams saraksts ar failiem, kuriem vēl nav veikts commit',
    ed_show_export: 'Paneļu eksports',
    ed_show_export_helper: 'Pēdējā eksporta laiks un poga Eksportēt paneļus',
    ed_zoom: 'Tālummaiņas poga',
    ed_zoom_helper: 'Pārslēdz minikarti uz pilno karti un atpakaļ',
    ed_language: 'Valoda',
    ed_language_helper: 'Atstājiet tukšu, lai izmantotu Home Assistant valodu',
    diff: 'Skatīt izmaiņas',
    diff_title: 'Izmaiņas zarā ‘{branch}’',
    diff_loading: 'Ielādē izmaiņas…',
    diff_empty: 'Nav rādāmu izmaiņu',
    diff_binary: 'Binārs fails',
    diff_truncated: 'Diff šeit nogriezts: vēl rindu: {n}',
    diff_more_files: 'Nav parādīti faili: {n}',
    diff_added: 'Pievienots',
    diff_modified: 'Mainīts',
    diff_deleted: 'Dzēsts',
    diff_renamed: 'Pārdēvēts',
    diff_mode: 'Mainīts režīms',
    close: 'Aizvērt',
  },
  el: {
    title: 'Git Sync',
    clean: 'Ενήμερο',
    dirty: 'Αλλαγές',
    ahead: 'Εκκρεμεί push',
    behind: 'Πίσω',
    diverged: 'Απόκλιση',
    error: 'Σφάλμα',
    unavailable: 'Μη διαθέσιμο',
    working: 'Εκτέλεση…',
    not_loaded: 'Το Git Sync δεν έχει ρυθμιστεί',
    last_commit: 'Τελευταίο commit',
    last_push: 'Τελευταίο push',
    last_export: 'Εξαγωγή πινάκων',
    changes: 'Αλλαγές',
    files_one: '{n} αρχείο',
    files_many: '{n} αρχεία',
    changed_files: 'Αλλαγμένα αρχεία',
    no_changes: 'Καμία αλλαγή',
    more: '+ {n} ακόμη',
    never: 'Ποτέ',
    commit: 'Commit και push',
    export: 'Εξαγωγή πινάκων',
    confirm_title: 'Commit και push τώρα;',
    confirm_text_one: 'Θα γίνει commit και push για {n} αλλαγμένο αρχείο.',
    confirm_text_many: 'Θα γίνει commit και push για {n} αλλαγμένα αρχεία.',
    confirm_push: 'Θα γίνει push των commit σε αναμονή.',
    message: 'Μήνυμα (Enter για commit στο «{branch}»)',
    message_hint: 'Κενό: το γράφει η εργασία AI κατά το commit',
    generate: 'Δημιουργία μηνύματος commit',
    generated_none: 'Τίποτα για περιγραφή: καμία αλλαγή',
    cancel: 'Ακύρωση',
    committed: 'Commit: {m}',
    nothing: 'Τίποτα για commit',
    pushed: 'Έγινε push των commit σε αναμονή',
    exported_one: 'Εξήχθη {n} αρχείο πίνακα ελέγχου',
    exported_many: 'Εξήχθησαν {n} αρχεία πινάκων ελέγχου',
    pull: 'Pull',
    pulled_one: 'Λήφθηκε {n} commit',
    pulled_many: 'Λήφθηκαν {n} commit',
    failed: 'Απέτυχε: {e}',
    zoom_in: 'Εμφάνιση πλήρους κάρτας',
    zoom_out: 'Επιστροφή στη συμπαγή προβολή',
    ed_entity: 'Αισθητήρας Git Sync',
    ed_entity_helper: 'Αισθητήρας κατάστασης του αποθετηρίου· αφήστε κενό για αυτόματο εντοπισμό',
    ed_title: 'Τίτλος',
    ed_title_helper: 'Αφήστε κενό για «Git Sync»',
    ed_show_files: 'Αλλαγμένα αρχεία',
    ed_show_files_helper: 'Πτυσσόμενη λίστα των αρχείων που δεν έχουν γίνει ακόμη commit',
    ed_show_export: 'Εξαγωγή πινάκων',
    ed_show_export_helper: 'Ώρα της τελευταίας εξαγωγής και το κουμπί Εξαγωγή πινάκων',
    ed_zoom: 'Κουμπί μεγέθυνσης',
    ed_zoom_helper: 'Εναλλάσσει τη μίνι κάρτα στην πλήρη κάρτα και αντίστροφα',
    ed_language: 'Γλώσσα',
    ed_language_helper: 'Αφήστε κενό για να ακολουθεί το Home Assistant',
    diff: 'Προβολή αλλαγών',
    diff_title: 'Αλλαγές στο ‘{branch}’',
    diff_loading: 'Φόρτωση αλλαγών…',
    diff_empty: 'Δεν υπάρχουν αλλαγές για εμφάνιση',
    diff_binary: 'Δυαδικό αρχείο',
    diff_truncated: 'Το diff κόπηκε εδώ: {n} ακόμη γραμμές',
    diff_more_files: '{n} ακόμη αρχεία δεν εμφανίζονται',
    diff_added: 'Προστέθηκε',
    diff_modified: 'Τροποποιήθηκε',
    diff_deleted: 'Διαγράφηκε',
    diff_renamed: 'Μετονομάστηκε',
    diff_mode: 'Αλλαγή λειτουργίας',
    close: 'Κλείσιμο',
  },
  sr: {
    title: 'Git Sync',
    clean: 'Ажурирано',
    dirty: 'Измене',
    ahead: 'Push на чекању',
    behind: 'Заостаје',
    diverged: 'Разилази се',
    error: 'Грешка',
    unavailable: 'Недоступно',
    working: 'У току…',
    not_loaded: 'Git Sync није подешен',
    last_commit: 'Последњи commit',
    last_push: 'Последњи push',
    last_export: 'Извоз контролних табли',
    changes: 'Измене',
    files_one: '{n} датотека',
    files_many: 'Датотека: {n}',
    changed_files: 'Измењене датотеке',
    no_changes: 'Нема измена',
    more: '+ још {n}',
    never: 'Никада',
    commit: 'Commit и push',
    export: 'Извези контролне табле',
    confirm_title: 'Урадити commit и push сада?',
    confirm_text_one: 'За {n} измењену датотеку биће урађен commit и push.',
    confirm_text_many: 'Измењених датотека за commit и push: {n}.',
    confirm_push: 'Commit-ови на чекању биће push-овани.',
    message: 'Порука (Enter за commit на „{branch}“)',
    message_hint: 'Празно: поруку пише AI task при commit-у',
    generate: 'Генериши commit поруку',
    generated_none: 'Нема шта да се опише: нема измена',
    cancel: 'Откажи',
    committed: 'Commit: {m}',
    nothing: 'Нема ничега за commit',
    pushed: 'Commit-ови на чекању су push-овани',
    exported_one: '{n} датотека контролне табле је извезена',
    exported_many: 'Извезено датотека контролних табли: {n}',
    pull: 'Pull',
    pulled_one: 'Преузет је {n} commit',
    pulled_many: 'Преузетих commit-ова: {n}',
    failed: 'Није успело: {e}',
    zoom_in: 'Прикажи целу картицу',
    zoom_out: 'Назад на компактни приказ',
    ed_entity: 'Git Sync сензор',
    ed_entity_helper: 'Сензор статуса репозиторијума; остави празно за аутоматско проналажење',
    ed_title: 'Наслов',
    ed_title_helper: 'Остави празно за „Git Sync“',
    ed_show_files: 'Измењене датотеке',
    ed_show_files_helper: 'Склопива листа датотека које још нису commit-оване',
    ed_show_export: 'Извоз контролних табли',
    ed_show_export_helper: 'Време последњег извоза и дугме „Извези контролне табле“',
    ed_zoom: 'Дугме за увећање',
    ed_zoom_helper: 'Пребацује мини картицу на пун приказ и назад',
    ed_language: 'Језик',
    ed_language_helper: 'Остави празно да прати језик Home Assistant-а',
    diff: 'Прикажи измене',
    diff_title: 'Измене на ‘{branch}’',
    diff_loading: 'Учитавање измена…',
    diff_empty: 'Нема измена за приказ',
    diff_binary: 'Бинарна датотека',
    diff_truncated: 'Diff је овде скраћен, преосталих редова: {n}',
    diff_more_files: 'Неприказаних датотека: {n}',
    diff_added: 'Додато',
    diff_modified: 'Измењено',
    diff_deleted: 'Обрисано',
    diff_renamed: 'Преименовано',
    diff_mode: 'Режим промењен',
    close: 'Затвори',
  },
  'sr-Latn': {
    title: 'Git Sync',
    clean: 'Ažurirano',
    dirty: 'Izmene',
    ahead: 'Push na čekanju',
    behind: 'Zaostaje',
    diverged: 'Razilazi se',
    error: 'Greška',
    unavailable: 'Nedostupno',
    working: 'U toku…',
    not_loaded: 'Git Sync nije podešen',
    last_commit: 'Poslednji commit',
    last_push: 'Poslednji push',
    last_export: 'Izvoz kontrolnih tabli',
    changes: 'Izmene',
    files_one: '{n} datoteka',
    files_many: 'Datoteka: {n}',
    changed_files: 'Izmenjene datoteke',
    no_changes: 'Nema izmena',
    more: '+ još {n}',
    never: 'Nikada',
    commit: 'Commit i push',
    export: 'Izvezi kontrolne table',
    confirm_title: 'Uraditi commit i push sada?',
    confirm_text_one: 'Za {n} izmenjenu datoteku biće urađen commit i push.',
    confirm_text_many: 'Izmenjenih datoteka za commit i push: {n}.',
    confirm_push: 'Commit-ovi na čekanju biće push-ovani.',
    message: 'Poruka (Enter za commit na „{branch}“)',
    message_hint: 'Prazno: poruku piše AI task pri commit-u',
    generate: 'Generiši commit poruku',
    generated_none: 'Nema šta da se opiše: nema izmena',
    cancel: 'Otkaži',
    committed: 'Commit: {m}',
    nothing: 'Nema ničega za commit',
    pushed: 'Commit-ovi na čekanju su push-ovani',
    exported_one: '{n} datoteka kontrolne table je izvezena',
    exported_many: 'Izvezeno datoteka kontrolnih tabli: {n}',
    pull: 'Pull',
    pulled_one: 'Preuzet je {n} commit',
    pulled_many: 'Preuzetih commit-ova: {n}',
    failed: 'Nije uspelo: {e}',
    zoom_in: 'Prikaži celu karticu',
    zoom_out: 'Nazad na kompaktni prikaz',
    ed_entity: 'Git Sync senzor',
    ed_entity_helper: 'Senzor statusa repozitorijuma; ostavi prazno za automatsko pronalaženje',
    ed_title: 'Naslov',
    ed_title_helper: 'Ostavi prazno za „Git Sync“',
    ed_show_files: 'Izmenjene datoteke',
    ed_show_files_helper: 'Sklopiva lista datoteka koje još nisu commit-ovane',
    ed_show_export: 'Izvoz kontrolnih tabli',
    ed_show_export_helper: 'Vreme poslednjeg izvoza i dugme „Izvezi kontrolne table“',
    ed_zoom: 'Dugme za uvećanje',
    ed_zoom_helper: 'Prebacuje mini karticu na pun prikaz i nazad',
    ed_language: 'Jezik',
    ed_language_helper: 'Ostavi prazno da prati jezik Home Assistant-a',
    diff: 'Prikaži izmene',
    diff_title: 'Izmene na ‘{branch}’',
    diff_loading: 'Učitavanje izmena…',
    diff_empty: 'Nema izmena za prikaz',
    diff_binary: 'Binarna datoteka',
    diff_truncated: 'Diff je ovde skraćen, preostalih redova: {n}',
    diff_more_files: 'Neprikazanih datoteka: {n}',
    diff_added: 'Dodato',
    diff_modified: 'Izmenjeno',
    diff_deleted: 'Obrisano',
    diff_renamed: 'Preimenovano',
    diff_mode: 'Režim promenjen',
    close: 'Zatvori',
  },
};

const gsLang = (hass, config) => {
  const raw = String(config?.language || hass?.locale?.language || hass?.language || 'en');
  // Exact code first (sr-Latn, Serbian in Latin script), then its base language (fr-FR → fr, pt-BR → pt).
  if (GS_I18N[raw]) return raw;
  const l = raw.split('-')[0];
  return GS_I18N[l] ? l : 'en';
};

// Locale for Intl: Home Assistant's full code (pt-PT, nl-BE…) when it is a variant of the card's language,
// else the card's language. Bare "pt" means Brazilian to Intl, while the card's Portuguese is European.
const gsLocale = (hass, config) => {
  const lang = gsLang(hass, config);
  const full = String(hass?.locale?.language || hass?.language || '');
  const locale = full && (full === lang || (!GS_I18N[full] && full.split('-')[0] === lang)) ? full : lang;
  return locale === 'pt' ? 'pt-PT' : locale;
};

const gsT = (lang, key, vars = {}) =>
  (GS_I18N[lang]?.[key] ?? GS_I18N.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

// "{n} file" / "{n} files": the *_one key for 1, *_many otherwise.
const gsN = (lang, key, n, vars = {}) => gsT(lang, `${key}_${n === 1 ? 'one' : 'many'}`, { n, ...vars });

const gsEsc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const GS_DEFAULTS = { show_files: true, show_export: true };
const GS_MINI_DEFAULTS = { ...GS_DEFAULTS, zoom: true };
const GS_FILES_SHOWN = 30;
// behind: the remote has commits that are not here (the next commit pulls them first);
// diverged: both sides have commits, nothing is pushed until it is resolved by hand (see Settings → Repairs).
const GS_STATUSES = ['clean', 'dirty', 'ahead', 'error', 'behind', 'diverged'];

// Pull is offered whenever the remote has commits that are not here (status behind, but also dirty or error),
// except with local changes on top of local commits: the action refuses that case (commit first, then pull).
function gsPullable(a) {
  const behind = Number(a?.behind) || 0;
  const ahead = Number(a?.ahead) || 0;
  const dirty = (Number(a?.changed_count) || 0) > 0;
  return behind > 0 && !(dirty && ahead > 0);
}

// Minutes elapsed since `iso` (0 for a date in the future or unreadable).
const gsMinutes = (iso, now = Date.now()) => {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? Math.max(0, (now - t) / 60000) : 0;
};

// The integration's entities, from the entity registry: { device: { status, last_commit, …, commit_push } }.
// Each entity is told apart by its translation key, else by the end of its entity ID (renamed IDs keep the key).
const GS_KEYS = {
  status: '_status',
  changed_files: '_changed_files',
  last_commit: '_last_commit',
  last_push: '_last_push',
  last_export: '_last_export',
  branch: '_branch',
  commit_push: '_commit_and_push',
  export_dashboards: '_export_dashboards',
};
function gsDevices(registry) {
  const devices = {};
  for (const [id, e] of Object.entries(registry || {})) {
    if (e?.platform !== GS_DOMAIN) continue;
    // Only the Git Sync module's entities: other modules have a "status" too
    const tk = String(e.translation_key || '');
    if (tk && !tk.startsWith(GS_PREFIX)) continue;
    if (!tk && !id.includes('_git_sync_')) continue;
    const d = (devices[e.device_id || ''] ||= {});
    const keys = Object.keys(GS_KEYS);
    const key = keys.find((k) => tk === GS_PREFIX + k) || keys.find((k) => id.endsWith(GS_KEYS[k]));
    if (key) d[key] = id;
  }
  return devices;
}

// A click in a dialog opened from the card (more-info, the diff viewer…) is not a click elsewhere.
const gsInDialog = (ev) =>
  (ev.composedPath?.() || []).some((n) =>
    ['ha-more-info-dialog', 'ha-dialog', 'dialog', 'git-sync-diff-dialog'].includes(n?.localName),
  );

// Status letter and colour of a file in the diff viewer, as in an editor's source control view.
const GS_DIFF_STATUS = {
  added: { letter: 'A', key: 'diff_added', color: 'var(--gs-ok)' },
  modified: { letter: 'M', key: 'diff_modified', color: 'var(--gs-warn)' },
  deleted: { letter: 'D', key: 'diff_deleted', color: 'var(--gs-alert)' },
  renamed: { letter: 'R', key: 'diff_renamed', color: 'var(--gs-info)' },
  copied: { letter: 'C', key: 'diff_added', color: 'var(--gs-info)' },
  mode: { letter: 'T', key: 'diff_mode', color: 'var(--gs-off)' },
};

// jscpd:ignore-start (the panel's own copy of the diff viewer: a dashboard card loads without the panel)
// "config/packages/lights.yaml" → ["lights.yaml", "config/packages"].
const gsSplitPath = (path) => {
  const i = String(path || '').lastIndexOf('/');
  return i < 0 ? [path, ''] : [path.slice(i + 1), path.slice(0, i)];
};

// "git@github.com:me/homeassistant-config.git" → "me/homeassistant-config".
const gsRepo = (url) => {
  if (!url) return '';
  const cleaned = String(url).replace(/\.git$/, '');
  const m = cleaned.match(/[:/]([^/:]+\/[^/:]+)$/);
  return m ? m[1] : cleaned;
};
// jscpd:ignore-end

class GitSyncCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement('git-sync-card-editor');
  }

  static getStubConfig() {
    return {};
  }

  constructor() {
    super();
    this._filesOpen = false;
    this._confirm = false;
    this._busy = null;
    this._draft = '';
    this._generating = false;
    // A click elsewhere folds the changed files (and brings the mini card back to its compact view).
    this._outside = (ev) => {
      if (ev.composedPath?.().includes(this) || gsInDialog(ev)) return;
      if (this._collapse()) this._render();
    };
  }

  connectedCallback() {
    document.addEventListener?.('click', this._outside, true);
  }

  disconnectedCallback() {
    document.removeEventListener?.('click', this._outside, true);
    this._diffDialog?.close?.();
    this._diffDialog?.remove?.();
    this._diffDialog = null;
  }

  // Folds what a click elsewhere folds; true when something changed.
  _collapse() {
    if (!this._filesOpen) return false;
    this._filesOpen = false;
    return true;
  }

  // The mini card's compact view (see GitSyncMiniCard).
  _compact() {
    return false;
  }

  // Button at the far right of the header: only the mini card has one.
  _zoomButton() {
    return '';
  }

  // jscpd:ignore-start (each card is its own dashboard resource: the card boilerplate is theirs)
  setConfig(config) {
    this._config = { ...GS_DEFAULTS, ...config };
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._sig = null;
    this._render();
  }
  // jscpd:ignore-end

  set hass(hass) {
    const old = this._hass;
    this._hass = hass;
    // Nothing the card shows changed: same state objects, registry, language and minute ("3 min ago").
    const ids = this._ids;
    if (
      old &&
      this._sig &&
      ids &&
      hass.entities === old.entities &&
      Object.values(ids).every((id) => !id || hass.states[id] === old.states[id]) &&
      gsLang(hass, this._config) === gsLang(old, this._config) &&
      !!hass.user?.is_admin === !!old.user?.is_admin &&
      Math.floor(Date.now() / 60000) === this._sigMinute
    ) {
      return;
    }
    // Typing a commit message: keep the popup as it is.
    if (this._confirm) return;
    this._render();
  }

  getCardSize() {
    return this._filesOpen ? 7 : 5;
  }

  getGridOptions() {
    return { columns: 12, min_columns: 6, rows: 'auto' };
  }

  _t(key, vars) {
    return gsT(gsLang(this._hass, this._config), key, vars);
  }

  _n(key, n, vars) {
    return gsN(gsLang(this._hass, this._config), key, n, vars);
  }

  // "3 minutes ago", "yesterday"… in the card's language.
  _ago(iso) {
    const m = gsMinutes(iso);
    let rtf;
    try {
      rtf = new Intl.RelativeTimeFormat(gsLocale(this._hass, this._config), { numeric: 'auto' });
    } catch {
      return '';
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
      return d.toLocaleString(gsLocale(this._hass, this._config), { dateStyle: 'medium', timeStyle: 'short' });
    } catch {
      return d.toISOString();
    }
  }

  // The entities of the chosen sensor's device, or of the first Git Sync device.
  _resolve() {
    const hass = this._hass;
    const devices = gsDevices(hass?.entities);
    if (this._config.entity) {
      const device = hass?.entities?.[this._config.entity]?.device_id || '';
      // Any sensor of the Git Sync module leads to its status sensor; one of another System Hub module (or of the
      // former Git Sync integration, from a dashboard written for it) falls back to finding it
      if (devices[device]?.status) return { ...devices[device], device };
    }
    const [device, ids] = Object.entries(devices).find(([, d]) => d.status) || [];
    return ids ? { ...ids, device } : null;
  }

  _toast(message) {
    this.dispatchEvent(new CustomEvent('hass-notification', { detail: { message }, bubbles: true, composed: true }));
  }

  // The repository the card shows, named in its actions when System Hub has several (else the only one is meant)
  _target() {
    const devices = Object.values(gsDevices(this._hass?.entities)).filter((d) => d.status);
    const repository = this._hass?.states?.[this._ids?.status]?.attributes?.repository;
    return devices.length > 1 && repository ? { repository } : {};
  }

  async _call(service) {
    const data = this._target();
    if (service === 'commit_push') {
      const message = this._draft.trim();
      if (message) data.message = message;
    }
    this._busy = service;
    this._confirm = false;
    this._draft = '';
    this._render();
    try {
      // callService(domain, service, data, target, notifyOnError, returnResponse)
      const result = await this._hass.callService(GS_DOMAIN, GS_PREFIX + service, data, undefined, false, true);
      const first = result?.response;
      if (service === 'commit_push') {
        if (first?.committed) this._toast(this._t('committed', { m: first.message }));
        else this._toast(this._t(first?.pushed ? 'pushed' : 'nothing'));
      } else if (service === 'pull') this._toast(first?.pulled ? this._n('pulled', first.pulled) : this._t('clean'));
      else this._toast(this._n('exported', first?.files?.length ?? 0));
    } catch (err) {
      this._toast(this._t('failed', { e: err?.message || String(err) }));
    } finally {
      this._busy = null;
      this._render();
    }
  }

  // Asks the AI task for a message describing the current changes, without committing, and puts it in the field.
  async _generate() {
    if (this._generating) return;
    const data = this._target();
    this._generating = true;
    this._render();
    try {
      const result = await this._hass.callService(GS_DOMAIN, `${GS_PREFIX}generate_message`, data, undefined, false, true);
      const message = result?.response?.message;
      // The popup may have been closed meanwhile: a late message must not come back at the next opening.
      if (message) {
        if (this._confirm) this._draft = message;
      } else this._toast(this._t('generated_none'));
    } catch (err) {
      this._toast(this._t('failed', { e: err?.message || String(err) }));
    } finally {
      this._generating = false;
      if (this._confirm) {
        this._render();
        this.shadowRoot.querySelector('#message')?.focus?.({ preventScroll: true });
      }
    }
  }

  // Opens the full-screen diff viewer on the changes a commit would include.
  _openDiff() {
    const data = this._target();
    if (!this._diffDialog) {
      this._diffDialog = document.createElement('git-sync-diff-dialog');
      document.body?.appendChild?.(this._diffDialog);
    }
    const branch = this._hass?.states?.[this._ids?.status]?.attributes?.branch;
    this._diffDialog.open({
      lang: gsLang(this._hass, this._config),
      locale: gsLocale(this._hass, this._config),
      branch,
      request: async () => (await this._hass.callService(GS_DOMAIN, `${GS_PREFIX}get_diff`, data, undefined, false, true))?.response,
      onCommit: () => {
        this._confirm = true;
        this._render();
        this.shadowRoot.querySelector('#message')?.focus?.({ preventScroll: true });
      },
    });
  }

  _bind() {
    const root = this.shadowRoot;
    const on = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);
    on('#diff', () => this._openDiff());
    const toggleFiles = () => {
      this._filesOpen = !this._filesOpen;
      this._render();
    };
    on('.toggle', toggleFiles);
    root.querySelector('.toggle')?.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      toggleFiles();
    });
    on('#commit', () => {
      this._confirm = true;
      this._render();
      root.querySelector('#message')?.focus?.({ preventScroll: true });
    });
    on('#export', () => this._call('export_dashboards'));
    on('#pull', () => this._call('pull'));
    on('.zoom', () => this._toggleZoom?.());
    const close = () => {
      this._confirm = false;
      this._draft = '';
      this._render();
    };
    on('#cancel', close);
    on('.overlay', close);
    on('#confirm', () => {
      if (!this._generating) this._call('commit_push');
    });
    on('#generate', () => this._generate());
    root.querySelector('#message')?.addEventListener('input', (ev) => {
      this._draft = ev.target?.value ?? '';
    });
    root.querySelector('#message')?.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !this._generating) this._call('commit_push');
      if (ev.key === 'Escape') close();
    });
  }

  // The element with the keyboard focus, as a selector to find it again after a render replaced the DOM.
  _focused() {
    const el = this.shadowRoot?.activeElement;
    if (!el) return null;
    if (el.id) return `#${el.id}`;
    if (el.classList?.contains('zoom')) return '.zoom';
    if (el.classList?.contains('link')) return '.link';
    return el.classList?.contains('toggle') ? '.toggle' : null;
  }

  _render() {
    const focused = this._focused();
    this._paint();
    if (focused) this.shadowRoot.querySelector(focused)?.focus?.({ preventScroll: true });
  }

  _paint() {
    if (!this._config || !this.shadowRoot) return;
    const hass = this._hass;
    if (!hass) return;
    const ids = this._resolve();
    this._ids = ids;
    this._sigMinute = Math.floor(Date.now() / 60000);
    this._sig = true;
    const statusObj = ids && hass.states[ids.status];
    if (!statusObj) {
      this.shadowRoot.innerHTML = `<style>${this._css()}</style><ha-card><div class="empty">${gsEsc(this._t('not_loaded'))}</div></ha-card>`;
      return;
    }

    const c = this._config;
    const a = statusObj.attributes || {};
    const status = GS_STATUSES.includes(statusObj.state) ? statusObj.state : 'unavailable';
    const files = Array.isArray(a.changed_files) ? a.changed_files : [];
    const count = Number(a.changed_count ?? files.length) || 0;
    const valid = (s) => s && !['unknown', 'unavailable'].includes(s.state);
    const commitObj = hass.states[ids.last_commit];
    const pushObj = hass.states[ids.last_push];
    const exportObj = hass.states[ids.last_export];
    const busy = this._busy;
    const compact = this._compact();
    // The actions (commit, pull, export, diff, AI message) are for administrators only: others see the status.
    const admin = hass.user?.is_admin === true;
    const pullable = gsPullable(a);
    // Compact view: the branch alone, the remote repository is in the full card.
    const subtitle = [a.branch, compact ? '' : gsRepo(a.remote_url)].filter(Boolean).map(gsEsc).join(' → ');

    const commit = valid(commitObj)
      ? `<div class="commit">
          <div class="lbl">${gsEsc(this._t('last_commit'))}</div>
          <div class="msg">${gsEsc(commitObj.attributes?.message)}</div>
          <div class="meta"><span class="sha">${gsEsc(commitObj.attributes?.short_sha)}</span>
            <span title="${gsEsc(this._absolute(commitObj.state))}">${gsEsc(this._ago(commitObj.state))}</span></div>
        </div>`
      : '';

    const timeRow = (icon, label, obj, extra = '') => `
      <div class="row">
        <ha-icon icon="${icon}"></ha-icon>
        <span class="label">${gsEsc(label)}</span>
        <span class="value" title="${valid(obj) ? gsEsc(this._absolute(obj.state)) : ''}">${
          valid(obj) ? gsEsc(this._ago(obj.state)) : gsEsc(this._t('never'))
        }${extra}</span>
      </div>`;

    let changes;
    if (c.show_files && count > 0) {
      const list = this._filesOpen
        ? `<ul class="files">${files
            .slice(0, GS_FILES_SHOWN)
            .map((f) => `<li title="${gsEsc(f)}">${gsEsc(f)}</li>`)
            .join('')}${count > GS_FILES_SHOWN ? `<li>${gsEsc(this._t('more', { n: count - GS_FILES_SHOWN }))}</li>` : ''}</ul>`
        : '';
      changes = `<div class="row toggle" role="button" tabindex="0" aria-expanded="${this._filesOpen}">
          <ha-icon class="chevron${this._filesOpen ? ' open' : ''}" icon="mdi:chevron-right"></ha-icon>
          <span class="label">${gsEsc(this._t('changed_files'))}</span>
          <span class="value">${gsEsc(this._n('files', count))}</span>
        </div>${list}`;
    } else {
      changes = `<div class="row">
          <ha-icon icon="mdi:file-document-multiple-outline"></ha-icon>
          <span class="label">${gsEsc(this._t('changes'))}</span>
          <span class="value">${gsEsc(count > 0 ? this._n('files', count) : this._t('no_changes'))}</span>
        </div>`;
    }

    const exportCount = exportObj?.attributes?.files?.length || 0;
    const exportRow = c.show_export
      ? timeRow(
          'mdi:view-dashboard-outline',
          this._t('last_export'),
          exportObj,
          valid(exportObj) && exportCount ? ` · ${gsEsc(this._n('files', exportCount))}` : '',
        )
      : '';

    // Compact view: the confirmation takes the place of the content (no room for a popup over it).
    const popup =
      this._confirm && admin
        ? `${compact ? '' : '<div class="overlay"></div>'}
        <div class="popup${compact ? ' inline' : ''}" role="dialog" aria-modal="true">
          <div class="p-title">${gsEsc(this._t('confirm_title'))}</div>
          <div class="p-text">${gsEsc(count > 0 ? this._n('confirm_text', count) : this._t('confirm_push'))}</div>
          <div class="field${this._generating ? ' generating' : ''}">
            <input id="message" type="text" maxlength="100" autocomplete="off" aria-label="${gsEsc(this._t('message', { branch: a.branch || 'HEAD' }))}"
              placeholder="${gsEsc(this._t('message', { branch: a.branch || 'HEAD' }))}" value="${gsEsc(this._draft)}"${this._generating ? ' disabled' : ''} />
            ${
              a.ai_task
                ? `<button class="gen" id="generate" title="${gsEsc(this._t('generate'))}" aria-label="${gsEsc(this._t('generate'))}"${this._generating ? ' disabled' : ''}>
                    <ha-icon icon="${this._generating ? 'mdi:loading' : 'mdi:creation-outline'}"></ha-icon></button>`
                : ''
            }
          </div>
          ${a.ai_task ? `<div class="hint">${gsEsc(this._t('message_hint'))}</div>` : ''}
          ${count > 0 ? `<button class="link" id="diff"><ha-icon icon="mdi:file-compare"></ha-icon>${gsEsc(this._t('diff'))}</button>` : ''}
          <div class="actions">
            <button class="action" id="cancel"><ha-icon icon="mdi:close"></ha-icon>${gsEsc(this._t('cancel'))}</button>
            <button class="action" id="confirm"${this._generating ? ' disabled' : ''}><ha-icon icon="mdi:source-commit-end"></ha-icon>${gsEsc(this._t('commit'))}</button>
          </div>
        </div>`
      : '';

    const canCommit = ['dirty', 'ahead', 'error'].includes(status) && !busy;
    const pullAllowed = admin && pullable;
    const button = (id, service, icon, label, enabled) =>
      `<button class="action${busy === service ? ' busy' : ''}" id="${id}" ${enabled ? '' : 'disabled'}>
        <ha-icon icon="${busy === service ? 'mdi:loading' : icon}"></ha-icon>${gsEsc(label)}</button>`;

    const pillText = busy ? this._t('working') : this._t(status);
    const error = a.last_error ? `<div class="err">${gsEsc(a.last_error)}</div>` : '';
    // Opens the full-screen diff viewer; only when something changed (the popup has its own link).
    const diffButton = `<button class="icon-btn" id="diff" title="${gsEsc(this._t('diff'))}" aria-label="${gsEsc(this._t('diff'))}">
        <ha-icon icon="mdi:file-compare"></ha-icon></button>`;
    // Behind: bring in the remote commits (the next commit would pull them too).
    const pullLabel = busy === 'pull' ? this._t('working') : this._t('pull');
    const pullIcon = `<button class="icon-btn${busy === 'pull' ? ' busy' : ''}" id="pull" title="${gsEsc(pullLabel)}" aria-label="${gsEsc(pullLabel)}" ${busy ? 'disabled' : ''}>
        <ha-icon icon="${busy === 'pull' ? 'mdi:loading' : 'mdi:source-pull'}"></ha-icon></button>`;
    let body;
    if (compact && this._confirm && admin) body = popup;
    else if (compact) {
      // Compact view: the last commit on one line, the changes and the last push, Commit & push as an icon.
      const commitLine = valid(commitObj)
        ? `<div class="m-commit" title="${gsEsc(this._absolute(commitObj.state))}">
            <span class="m-msg">${gsEsc(commitObj.attributes?.message)}</span>
            <span class="m-ago">${gsEsc(this._ago(commitObj.state))}</span>
          </div>`
        : '';
      const pushText = valid(pushObj) ? this._ago(pushObj.state) : this._t('never');
      // "0 files" rather than "Working tree clean": fits beside the last push on a 6-column card.
      const changesText = this._n('files', count);
      const commitLabel = busy === 'commit_push' ? this._t('working') : this._t('commit');
      body = `${commitLine}${error}
        <div class="m-foot">
          <span class="m-chip${count > 0 ? ' changed' : ''}" title="${gsEsc(this._t('changes'))}: ${gsEsc(changesText)}">
            <ha-icon icon="mdi:file-document-multiple-outline"></ha-icon><span class="m-txt">${gsEsc(changesText)}</span></span>
          <span class="m-chip" title="${gsEsc(this._t('last_push'))}: ${gsEsc(pushText)}">
            <ha-icon icon="mdi:cloud-check-outline"></ha-icon><span class="m-txt">${gsEsc(pushText)}</span></span>
          ${admin && count > 0 ? diffButton : ''}
          ${pullAllowed ? pullIcon : ''}
          ${
            admin
              ? `<button class="icon-btn${busy === 'commit_push' ? ' busy' : ''}" id="commit" title="${gsEsc(commitLabel)}" aria-label="${gsEsc(commitLabel)}" ${canCommit ? '' : 'disabled'}>
            <ha-icon icon="${busy === 'commit_push' ? 'mdi:loading' : 'mdi:source-commit-end'}"></ha-icon></button>`
              : ''
          }
        </div>`;
    } else {
      body = `${commit}
        <div class="rows">
          ${changes}
          ${timeRow('mdi:cloud-check-outline', this._t('last_push'), pushObj)}
          ${exportRow}
        </div>
        ${error}
        ${
          admin
            ? `<div class="actions">
          ${pullAllowed ? button('pull', 'pull', 'mdi:source-pull', this._t('pull'), !busy) : ''}
          ${button('commit', 'commit_push', 'mdi:source-commit-end', this._t('commit'), canCommit)}
          ${c.show_export ? button('export', 'export_dashboards', 'mdi:export', this._t('export'), !busy) : ''}
          ${count > 0 && !this._confirm ? diffButton : ''}
        </div>`
            : ''
        }
        ${popup}`;
    }
    this.shadowRoot.innerHTML = `
      <style>${this._css()}</style>
      <ha-card class="st-${status}${compact ? ' compact' : ''}">
        <div class="header">
          <div class="badge"><ha-icon icon="mdi:git"></ha-icon></div>
          <div class="titles">
            <div class="title">${gsEsc(c.title || this._t('title'))}</div>
            <div class="subtitle">${subtitle}</div>
          </div>
          <span class="pill${busy ? ' busy' : ''}" title="${gsEsc(pillText)}" aria-label="${gsEsc(pillText)}"><span class="pill-text">${gsEsc(pillText)}</span></span>
          ${this._zoomButton()}
        </div>
        ${body}
      </ha-card>`;
    this._bind();
  }

  _css() {
    return `
      :host { display: block; --gs-ok: var(--success-color, #43a047); --gs-warn: var(--warning-color, #ffa600);
              --gs-info: var(--info-color, #039be5); --gs-alert: var(--error-color, #db4437);
              --gs-off: var(--disabled-text-color, #9e9e9e); --gs-accent: var(--primary-color, #03a9f4); }
      /* No size container on ha-card itself: its intrinsic width would drop to its padding in an inline-block
         parent, a grid column sized auto, layout-card or button-card. Only the header is one (see .header). */
      ha-card { position: relative; overflow: hidden; padding: 16px; --s: var(--gs-off); }
      ha-card.st-clean { --s: var(--gs-ok); }
      ha-card.st-dirty { --s: var(--gs-warn); }
      ha-card.st-ahead { --s: var(--gs-info); }
      ha-card.st-error, ha-card.st-diverged { --s: var(--gs-alert); }
      ha-card.st-behind { --s: var(--gs-info); }
      .empty { padding: 8px 0; color: var(--secondary-text-color); }

      /* Same header as the other cards: the title keeps a few letters, the pill shrinks, nothing leaves the card. */
      /* Gap 6px on the narrowest cards (6 columns of a phone): room for four letters of the title. */
      .header { display: flex; align-items: center; gap: clamp(6px, 100% - 140px, 10px); min-width: 0;
                container-type: inline-size; }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               color: var(--s); background: color-mix(in srgb, var(--s) 18%, transparent); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      /* Basis 0: the title takes what the pill leaves, the pill keeps its whole label while there is room. */
      /* 5ch: four letters and the ellipsis of a proportional font ("Git S…"). */
      .titles { flex: 1 1 0; min-width: 5ch; font-size: 16px; }
      .title { min-width: 4ch; font-size: 16px; font-weight: 500; line-height: 22px; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .subtitle { font-size: 12px; line-height: 16px; color: var(--secondary-text-color);
                  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* Text: the state colour mixed with the text colour, readable on the tinted background in both themes. */
      .pill { flex: 0 1 auto; min-width: 0; box-sizing: border-box; align-self: flex-start; margin-top: 2px;
              display: inline-flex; align-items: center; gap: 6px; padding: 1px 8px; border-radius: 999px;
              font-size: 11px; line-height: 18px; font-weight: 500;
              color: color-mix(in srgb, var(--s) 40%, var(--primary-text-color));
              background: color-mix(in srgb, var(--s) 14%, transparent); }
      .pill::before { content: ''; flex: none; width: 6px; height: 6px; border-radius: 50%; background: var(--s); }
      .pill-text { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* Narrow card: the pill keeps its dot only, its text stays in title / aria-label. */
      @container (max-width: 200px) {
        .pill { gap: 0; padding: 4px; }
        .pill-text { display: none; }
      }
      .pill.busy::before { animation: gs-pulse 1s ease-in-out infinite; }

      .commit { margin-top: 14px; padding: 10px 12px; border-radius: 12px;
                background: var(--secondary-background-color, rgba(127,127,127,.08)); }
      .commit .lbl { font-size: 11px; text-transform: uppercase; letter-spacing: .04em; color: var(--secondary-text-color); }
      .commit .msg { margin-top: 2px; font-size: 14px; line-height: 20px; color: var(--primary-text-color); word-break: break-word; }
      .commit .meta { margin-top: 4px; font-size: 12px; color: var(--secondary-text-color); display: flex; gap: 8px; flex-wrap: wrap; }
      .sha { font-family: var(--code-font-family, monospace); }

      .rows { margin-top: 10px; display: flex; flex-direction: column; }
      /* A value that does not fit beside its label goes under it, and wraps: never cut by the card. */
      /* The gap narrows to 4px on the narrowest cards (6 columns of a phone) so a long word fits beside the icon. */
      .row { display: flex; flex-wrap: wrap; align-items: center; column-gap: clamp(4px, 100% - 120px, 10px);
             min-height: 36px; font-size: 14px; }
      .row ha-icon { --mdc-icon-size: 20px; color: var(--secondary-text-color); flex: none; }
      .row .label { flex: 1 1 0; min-width: min(7em, 100% - 24px); overflow-wrap: break-word; color: var(--primary-text-color); }
      .row .value { flex: 0 1 auto; min-width: 0; margin-left: auto; overflow-wrap: anywhere;
                    color: var(--secondary-text-color); text-align: right; }
      .row.toggle { cursor: pointer; user-select: none; }
      .row.toggle:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 2px; border-radius: 6px; }
      .chevron { transition: transform .2s ease; }
      .chevron.open { transform: rotate(90deg); }
      .files { margin: 2px 0 6px 30px; padding: 0; list-style: none; max-height: 180px; overflow-y: auto;
               font-family: var(--code-font-family, monospace); font-size: 12px; line-height: 18px; color: var(--secondary-text-color); }
      .files li { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

      .err { margin-top: 8px; padding: 8px 10px; border-radius: 10px; font-size: 12px; word-break: break-word;
             color: color-mix(in srgb, var(--gs-alert) 40%, var(--primary-text-color));
             background: color-mix(in srgb, var(--gs-alert) 10%, transparent); }

      .actions { margin-top: 12px; display: flex; gap: 8px; flex-wrap: wrap; container-type: inline-size; }
      /* min-width 0 and wrapping: a long label (pl, sr) wraps instead of leaving a narrow card. */
      button.action { flex: 1 1 auto; min-width: 0; display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                      white-space: normal; overflow-wrap: anywhere; text-align: center; line-height: 18px;
                      min-height: 38px; padding: 4px 12px; border-radius: 10px; cursor: pointer;
                      font: inherit; font-size: 14px; font-weight: 500; color: var(--gs-accent); background: transparent;
                      border: 1px solid color-mix(in srgb, var(--gs-accent) 45%, transparent); transition: background .15s ease; }
      button.action ha-icon { --mdc-icon-size: 18px; flex: none; }
      /* Very narrow card (6 columns on a phone): less padding, so a word such as "dashboardy" fits on its line. */
      @container (max-width: 140px) {
        button.action { padding: 4px 6px; gap: 4px; }
      }
      button.action:hover:not([disabled]) { background: color-mix(in srgb, var(--gs-accent) 10%, transparent); }
      button.action:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 2px; }
      button.action[disabled] { cursor: default; opacity: .45; }
      button.action.busy ha-icon { animation: gs-spin 1s linear infinite; }

      .overlay { position: absolute; inset: 0; z-index: 2; backdrop-filter: blur(2px);
                 background: color-mix(in srgb, var(--card-background-color, #fff) 55%, transparent); }
      .popup { position: absolute; top: 12px; left: 12px; right: 12px; z-index: 3; padding: 16px; border-radius: 14px;
               background: var(--card-background-color, #fff); box-shadow: 0 8px 28px rgba(0,0,0,.25);
               border: 1px solid var(--divider-color, rgba(127,127,127,.2)); }
      .p-title { font-size: 16px; font-weight: 500; color: var(--primary-text-color); }
      .p-text { margin-top: 4px; font-size: 13px; color: var(--secondary-text-color); }
      /* VS Code-like message box: placeholder with the branch, sparkle button inside, on the right */
      .field { position: relative; margin-top: 12px; }
      .field input { box-sizing: border-box; width: 100%; padding: 9px 40px 9px 10px; border-radius: 8px;
                     font: inherit; font-size: 14px; color: var(--primary-text-color); outline: none;
                     background: var(--secondary-background-color, transparent);
                     border: 1px solid var(--divider-color, rgba(127,127,127,.3)); text-overflow: ellipsis; }
      .field input::placeholder { color: var(--secondary-text-color); opacity: .8; }
      .field input:focus { border-color: var(--gs-accent); }
      .field input[disabled] { opacity: .6; }
      .gen { position: absolute; top: 50%; right: 4px; transform: translateY(-50%); width: 32px; height: 32px;
             display: grid; place-items: center; padding: 0; border: none; border-radius: 6px; cursor: pointer;
             background: transparent; color: var(--secondary-text-color); transition: color .15s ease, background .15s ease; }
      .gen ha-icon { --mdc-icon-size: 18px; }
      .gen:hover:not([disabled]) { color: var(--gs-accent); background: color-mix(in srgb, var(--gs-accent) 10%, transparent); }
      .gen:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 1px; }
      .gen[disabled] { cursor: default; }
      .generating .gen ha-icon { animation: gs-spin 1s linear infinite; color: var(--gs-accent); }
      .hint { margin-top: 4px; font-size: 11px; color: var(--secondary-text-color); }
      .popup .actions { margin-top: 14px; }
      /* "View changes" in the commit popup: a text link with its icon, no border. */
      button.link { margin-top: 10px; display: inline-flex; align-items: center; gap: 6px; padding: 2px 0; border: none; cursor: pointer;
                    background: transparent; font: inherit; font-size: 13px; color: var(--gs-accent); }
      button.link ha-icon { --mdc-icon-size: 16px; }
      button.link:hover { text-decoration: underline; }
      button.link:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 2px; border-radius: 4px; }
      /* The diff button in the full card's action row keeps its square shape beside the wide buttons. */
      .actions button.icon-btn { flex: none; margin-left: 0; min-height: 38px; height: 38px; width: 38px; }

      /* Mini card: zoom button at the far right of the header. */
      .zoom { flex: none; align-self: flex-start; width: 24px; height: 24px; margin: 0 -4px 0 -2px; padding: 0;
              border: none; border-radius: 50%; display: grid; place-items: center; cursor: pointer;
              background: transparent; color: var(--secondary-text-color); transition: background .15s ease; }
      .zoom ha-icon { --mdc-icon-size: 16px; }
      .zoom:hover { background: color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color: var(--primary-text-color); }
      .zoom:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 1px; }

      /* Compact view: 32 px badge, the last commit on one line, the changes and the last push beside an icon button. */
      ha-card.compact { padding: 12px; }
      .compact .badge { width: 32px; height: 32px; }
      .compact .badge ha-icon { --mdc-icon-size: 20px; }
      .m-commit { margin-top: 10px; display: flex; align-items: baseline; gap: 8px; min-width: 0; font-size: 13px; }
      .m-msg { flex: 1 1 auto; min-width: 0; color: var(--primary-text-color);
               white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .m-ago { flex: none; font-size: 12px; color: var(--secondary-text-color); }
      .compact .err { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
      .m-foot { margin-top: 8px; display: flex; align-items: center; gap: 12px; min-width: 0; container-type: inline-size; }
      .m-chip { flex: 0 1 auto; min-width: 0; display: inline-flex; align-items: center; gap: 4px;
                font-size: 12px; color: var(--secondary-text-color); }
      .m-chip ha-icon { --mdc-icon-size: 16px; flex: none; }
      .m-chip.changed { color: color-mix(in srgb, var(--gs-warn) 40%, var(--primary-text-color)); }
      .m-chip.changed ha-icon { color: var(--gs-warn); }
      .m-txt { min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      /* Very narrow mini card (6 columns on a phone): the chips keep their icon, their text stays in the tooltip. */
      @container (max-width: 150px) { .m-chip .m-txt { display: none; } }
      button.icon-btn { flex: none; margin-left: auto; width: 36px; height: 36px; padding: 0; border-radius: 10px;
                        display: grid; place-items: center; cursor: pointer; color: var(--gs-accent); background: transparent;
                        border: 1px solid color-mix(in srgb, var(--gs-accent) 45%, transparent); transition: background .15s ease; }
      button.icon-btn ha-icon { --mdc-icon-size: 18px; }
      button.icon-btn:hover:not([disabled]) { background: color-mix(in srgb, var(--gs-accent) 10%, transparent); }
      button.icon-btn:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 2px; }
      button.icon-btn[disabled] { cursor: default; opacity: .45; }
      button.icon-btn.busy ha-icon { animation: gs-spin 1s linear infinite; }
      /* The confirmation in the flow of the compact card, instead of a popup over its content. */
      .popup.inline { position: static; margin-top: 12px; padding: 0; border: none; border-radius: 0; box-shadow: none;
                      background: transparent; }

      @keyframes gs-spin { to { transform: rotate(360deg); } }
      @keyframes gs-pulse { 50% { opacity: .3; } }
      @media (prefers-reduced-motion: reduce) {
        .pill.busy::before, button.action.busy ha-icon, button.icon-btn.busy ha-icon, .generating .gen ha-icon { animation: none; }
        .chevron, button.action, button.icon-btn, .gen, .zoom { transition: none; }
      }
    `;
  }
}

// ── Mini card ────────────────────────────────────────────────────────────────
// The mini card extends the full card: its zoom button (top right, `zoom: false` removes it) switches it to the
// full card's content, same configuration, and back; a click anywhere outside the card brings it back too.
class GitSyncMiniCard extends GitSyncCard {
  static getConfigElement() {
    return document.createElement('git-sync-mini-card-editor');
  }

  constructor() {
    super();
    this._zoomed = false;
  }

  setConfig(config) {
    super.setConfig({ ...GS_MINI_DEFAULTS, ...config });
  }

  getCardSize() {
    return this._zoomed ? super.getCardSize() : 2;
  }

  getGridOptions() {
    return this._zoomed ? super.getGridOptions() : { columns: 6, min_columns: 6, rows: 'auto' };
  }

  _compact() {
    return !this._zoomed;
  }

  _toggleZoom() {
    this._zoomed = !this._zoomed;
    this._filesOpen = false;
    this._render();
  }

  // A click elsewhere also leaves the full view, unless a commit message is being written.
  _collapse() {
    const folded = super._collapse();
    if (!this._zoomed || this._confirm) return folded;
    this._zoomed = false;
    return true;
  }

  _zoomButton() {
    if (this._config.zoom === false) return '';
    const label = this._t(this._zoomed ? 'zoom_out' : 'zoom_in');
    return `<button class="zoom" title="${gsEsc(label)}" aria-label="${gsEsc(label)}" aria-expanded="${this._zoomed}">
      <ha-icon icon="${this._zoomed ? 'mdi:arrow-collapse' : 'mdi:arrow-expand'}"></ha-icon></button>`;
  }
}

// ── Diff viewer ──────────────────────────────────────────────────────────────
// A full-screen dialog showing the changes a commit would include, file by file, like an editor's diff view:
// the files on the left (status letter, name, added and removed lines), the selected file's hunks on the right
// with the line numbers of both sides. It lives in document.body, so that no card, section or transform clips it.
// jscpd:ignore-start (the panel's own copy of the diff viewer: a dashboard card loads without the panel)
class GitSyncDiffDialog extends HTMLElement {
  constructor() {
    super();
    this._open = false;
    this._loading = false;
    this._diff = null;
    this._error = null;
    this._selected = 0;
    this._onKey = (ev) => {
      if (!this._open) return;
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.close();
      } else if ((ev.key === 'ArrowDown' || ev.key === 'ArrowUp') && !(ev.target?.closest?.('.d-main'))) {
        const files = this._diff?.files || [];
        if (!files.length) return;
        ev.preventDefault();
        this._select((this._selected + (ev.key === 'ArrowDown' ? 1 : files.length - 1)) % files.length);
      }
    };
  }

  // Opens the viewer for a card: `request` fetches the diff, `onCommit` (optional) adds a Commit & push button.
  async open({ lang, locale, branch, request, onCommit }) {
    if (!this.shadowRoot) this.attachShadow({ mode: 'open' });
    this._lang = lang;
    this._locale = locale;
    this._branch = branch;
    this._onCommit = onCommit;
    this._open = true;
    this._loading = true;
    this._diff = null;
    this._error = null;
    this._selected = 0;
    this._restore = document.activeElement;
    document.addEventListener?.('keydown', this._onKey);
    this._render();
    try {
      this._diff = await request();
    } catch (err) {
      this._error = err?.message || String(err);
    } finally {
      this._loading = false;
      if (this._open) {
        this._render();
        this.shadowRoot.querySelector('.d-main')?.focus?.({ preventScroll: true });
      }
    }
  }

  close() {
    if (!this._open) return;
    this._open = false;
    document.removeEventListener?.('keydown', this._onKey);
    this._render();
    this._restore?.focus?.({ preventScroll: true });
  }

  _t(key, vars) {
    return gsT(this._lang, key, vars);
  }

  _select(index) {
    this._selected = index;
    this._render();
    this.shadowRoot.querySelector('.d-main')?.scrollTo?.(0, 0);
    this.shadowRoot.querySelector(`.d-file[data-i="${index}"]`)?.focus?.({ preventScroll: true });
  }

  _fmt(n) {
    try {
      return Number(n).toLocaleString(this._locale);
    } catch {
      return String(n);
    }
  }

  _fileItem(file, index) {
    const st = GS_DIFF_STATUS[file.status] || GS_DIFF_STATUS.modified;
    const [name, dir] = gsSplitPath(file.path);
    const label = this._t(st.key);
    return `<button class="d-file${index === this._selected ? ' selected' : ''}" data-i="${index}" role="option" aria-selected="${index === this._selected}"
        title="${gsEsc(file.path)}">
      <span class="d-st" style="--c:${st.color}" title="${gsEsc(label)}" aria-label="${gsEsc(label)}">${st.letter}</span>
      <span class="d-name"><span class="d-base">${gsEsc(name)}</span>${dir ? `<span class="d-dir">${gsEsc(dir)}</span>` : ''}</span>
      <span class="d-counts">${file.additions ? `<span class="d-add">+${this._fmt(file.additions)}</span>` : ''}${
        file.deletions ? `<span class="d-del">−${this._fmt(file.deletions)}</span>` : ''
      }</span>
    </button>`;
  }

  _hunk(hunk) {
    const rows = hunk.lines
      .map((line) => {
        const cls = line.kind === 'add' ? 'add' : line.kind === 'del' ? 'del' : 'ctx';
        const sign = line.kind === 'add' ? '+' : line.kind === 'del' ? '−' : ' ';
        return `<tr class="${cls}"><td class="ln">${line.old ?? ''}</td><td class="ln">${line.new ?? ''}</td><td class="sg">${sign}</td><td class="tx">${gsEsc(line.text)}</td></tr>`;
      })
      .join('');
    return `<tr class="hunk"><td class="ln"></td><td class="ln"></td><td class="sg"></td><td class="tx">${gsEsc(hunk.header)}</td></tr>${rows}`;
  }

  _fileView(file) {
    const st = GS_DIFF_STATUS[file.status] || GS_DIFF_STATUS.modified;
    const rename = file.old_path ? `<span class="d-old">${gsEsc(file.old_path)}</span><ha-icon icon="mdi:arrow-right"></ha-icon>` : '';
    let body;
    if (file.binary) body = `<div class="d-note"><ha-icon icon="mdi:file-outline"></ha-icon>${gsEsc(this._t('diff_binary'))}</div>`;
    else if (!file.hunks.length) body = `<div class="d-note">${gsEsc(this._t(st.key))}</div>`;
    else {
      body = `<table class="d-table" aria-label="${gsEsc(file.path)}"><tbody>${file.hunks.map((h) => this._hunk(h)).join('')}</tbody></table>`;
      if (file.truncated) body += `<div class="d-note">${gsEsc(this._t('diff_truncated', { n: this._fmt(file.truncated) }))}</div>`;
    }
    return `<div class="d-head">
        <span class="d-st big" style="--c:${st.color}" title="${gsEsc(this._t(st.key))}">${st.letter}</span>
        <span class="d-path">${rename}<span>${gsEsc(file.path)}</span></span>
        <span class="d-counts">${file.additions ? `<span class="d-add">+${this._fmt(file.additions)}</span>` : ''}${
          file.deletions ? `<span class="d-del">−${this._fmt(file.deletions)}</span>` : ''
        }</span>
      </div>${body}`;
  }

  _render() {
    if (!this.shadowRoot) return;
    if (!this._open) {
      this.shadowRoot.innerHTML = '';
      return;
    }
    const diff = this._diff;
    const files = diff?.files || [];
    const selected = files[this._selected];
    let main;
    let summary = '';
    if (this._loading) main = `<div class="d-note d-center"><ha-icon class="spin" icon="mdi:loading"></ha-icon>${gsEsc(this._t('diff_loading'))}</div>`;
    else if (this._error) main = `<div class="d-note d-center d-error">${gsEsc(this._t('failed', { e: this._error }))}</div>`;
    else if (!files.length) main = `<div class="d-note d-center">${gsEsc(this._t('diff_empty'))}</div>`;
    else {
      main = this._fileView(selected);
      summary = `${gsEsc(gsN(this._lang, 'files', files.length + (diff.more_files || 0)))} · <span class="d-add">+${this._fmt(diff.additions)}</span> <span class="d-del">−${this._fmt(diff.deletions)}</span>`;
    }
    const list = files.length
      ? `<div class="d-list" role="listbox" aria-label="${gsEsc(this._t('changed_files'))}">${files.map((f, i) => this._fileItem(f, i)).join('')}${
          diff.more_files ? `<div class="d-more">${gsEsc(this._t('diff_more_files', { n: this._fmt(diff.more_files) }))}</div>` : ''
        }</div>`
      : '';
    const commit = this._onCommit && files.length
      ? `<button class="d-btn primary" id="commit"><ha-icon icon="mdi:source-commit-end"></ha-icon>${gsEsc(this._t('commit'))}</button>`
      : '';
    this.shadowRoot.innerHTML = `<style>${this._css()}</style>
      <div class="d-backdrop"></div>
      <div class="d-dialog" role="dialog" aria-modal="true" aria-label="${gsEsc(this._t('diff_title', { branch: this._branch || 'HEAD' }))}">
        <div class="d-top">
          <div class="badge"><ha-icon icon="mdi:file-compare"></ha-icon></div>
          <div class="d-titles">
            <div class="d-title">${gsEsc(this._t('diff_title', { branch: this._branch || 'HEAD' }))}</div>
            <div class="d-sub">${summary}</div>
          </div>
          <button class="d-x" id="close" title="${gsEsc(this._t('close'))}" aria-label="${gsEsc(this._t('close'))}"><ha-icon icon="mdi:close"></ha-icon></button>
        </div>
        <div class="d-body${files.length ? '' : ' alone'}">
          ${list}
          <div class="d-main" tabindex="0">${main}</div>
        </div>
        <div class="d-foot">
          <button class="d-btn" id="close2"><ha-icon icon="mdi:close"></ha-icon>${gsEsc(this._t('close'))}</button>
          ${commit}
        </div>
      </div>`;
    this._bind();
  }

  _bind() {
    const root = this.shadowRoot;
    const on = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);
    on('.d-backdrop', () => this.close());
    on('#close', () => this.close());
    on('#close2', () => this.close());
    on('#commit', () => {
      const cb = this._onCommit;
      this.close();
      cb?.();
    });
    root.querySelector('.d-list')?.addEventListener('click', (ev) => {
      const item = ev.target?.closest?.('.d-file');
      if (item) this._select(Number(item.dataset.i));
    });
  }

  _css() {
    return `
      :host { --gs-ok: var(--success-color, #43a047); --gs-warn: var(--warning-color, #ffa600);
              --gs-info: var(--info-color, #039be5); --gs-alert: var(--error-color, #db4437);
              --gs-off: var(--disabled-text-color, #9e9e9e); --gs-accent: var(--primary-color, #03a9f4);
              --gs-mono: var(--code-font-family, ui-monospace, SFMono-Regular, Menlo, Consolas, monospace);
              --gs-bg: var(--card-background-color, var(--ha-card-background, #fff));
              --gs-line: var(--divider-color, rgba(127,127,127,.2)); }
      .d-backdrop { position: fixed; inset: 0; z-index: 1000; background: rgba(0,0,0,.45); backdrop-filter: blur(2px); }
      /* Full screen on a phone; a large centred window elsewhere. */
      .d-dialog { position: fixed; inset: 0; z-index: 1001; display: flex; flex-direction: column; min-height: 0;
                  background: var(--gs-bg); color: var(--primary-text-color); font-family: var(--paper-font-body1_-_font-family, inherit); }
      @media (min-width: 900px) and (min-height: 600px) {
        .d-dialog { inset: 24px; max-width: 1280px; margin: 0 auto; border-radius: 16px;
                    box-shadow: 0 12px 40px rgba(0,0,0,.35); border: 1px solid var(--gs-line); }
      }
      .d-top { flex: none; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--gs-line); }
      .badge { flex: none; width: 40px; height: 40px; border-radius: 50%; display: grid; place-items: center;
               color: var(--gs-accent); background: color-mix(in srgb, var(--gs-accent) 18%, transparent); }
      .badge ha-icon { --mdc-icon-size: 24px; }
      .d-titles { flex: 1 1 auto; min-width: 0; }
      .d-title { font-size: 16px; font-weight: 500; line-height: 22px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-sub { font-size: 12px; line-height: 16px; color: var(--secondary-text-color); }
      .d-x { flex: none; width: 36px; height: 36px; border: none; border-radius: 50%; padding: 0; display: grid; place-items: center;
             cursor: pointer; background: transparent; color: var(--secondary-text-color); }
      .d-x:hover { background: color-mix(in srgb, var(--secondary-text-color) 16%, transparent); color: var(--primary-text-color); }
      .d-x:focus-visible, .d-btn:focus-visible, .d-file:focus-visible { outline: 2px solid var(--gs-accent); outline-offset: 1px; }

      .d-body { flex: 1 1 auto; min-height: 0; display: flex; }
      .d-body.alone .d-main { width: 100%; }
      /* Files: a column on the left; on a narrow screen, a row of chips above the diff. */
      .d-list { flex: none; width: 280px; overflow-y: auto; border-right: 1px solid var(--gs-line); padding: 6px; display: flex; flex-direction: column; gap: 2px;
                background: var(--secondary-background-color, color-mix(in srgb, var(--primary-text-color) 4%, transparent)); }
      .d-file { display: flex; align-items: center; gap: 8px; width: 100%; min-width: 0; padding: 6px 8px; border: none; border-radius: 8px;
                cursor: pointer; text-align: left; font: inherit; font-size: 13px; color: var(--primary-text-color); background: transparent; }
      .d-file:hover { background: color-mix(in srgb, var(--gs-accent) 8%, transparent); }
      .d-file.selected { background: color-mix(in srgb, var(--gs-accent) 16%, transparent); }
      .d-st { flex: none; width: 20px; height: 20px; border-radius: 5px; display: grid; place-items: center; font-family: var(--gs-mono);
              font-size: 11px; font-weight: 700; color: var(--c); background: color-mix(in srgb, var(--c) 18%, transparent); }
      .d-st.big { width: 24px; height: 24px; font-size: 12px; }
      .d-name { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; line-height: 16px; }
      .d-base { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-dir { font-size: 11px; color: var(--secondary-text-color); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; direction: rtl; text-align: left; }
      .d-counts { flex: none; display: inline-flex; gap: 6px; font-family: var(--gs-mono); font-size: 11px; }
      .d-add { color: var(--gs-ok); }
      .d-del { color: var(--gs-alert); }
      .d-more { padding: 8px; font-size: 12px; color: var(--secondary-text-color); }
      @media (max-width: 719px) {
        .d-body { flex-direction: column; }
        .d-list { width: auto; max-height: 34%; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden;
                  border-right: none; border-bottom: 1px solid var(--gs-line); }
        .d-file { width: auto; flex: none; max-width: 220px; }
        .d-dir { display: none; }
        .d-more { white-space: nowrap; align-self: center; }
      }

      .d-main { flex: 1 1 auto; min-width: 0; overflow: auto; outline: none; }
      .d-head { position: sticky; top: 0; z-index: 1; display: flex; align-items: center; gap: 10px; padding: 8px 12px; font-size: 13px;
                background: var(--gs-bg); border-bottom: 1px solid var(--gs-line); }
      .d-path { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 6px; font-family: var(--gs-mono); font-size: 12px;
                white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .d-path ha-icon { --mdc-icon-size: 14px; color: var(--secondary-text-color); }
      .d-old { color: var(--secondary-text-color); }
      .d-note { display: flex; align-items: center; gap: 8px; padding: 16px; font-size: 13px; color: var(--secondary-text-color); }
      .d-note.d-center { justify-content: center; padding: 48px 16px; }
      .d-note.d-error { color: var(--gs-alert); }
      .d-note ha-icon { --mdc-icon-size: 20px; }
      .spin { animation: gs-spin 1s linear infinite; }

      /* The diff itself: old and new line numbers, sign, text; additions tinted green, deletions red. */
      .d-table { width: 100%; border-collapse: collapse; font-family: var(--gs-mono); font-size: 12px; line-height: 20px; tab-size: 4; }
      .d-table td { padding: 0 6px; vertical-align: top; white-space: pre; }
      .d-table .ln { width: 1%; min-width: 3.5ch; text-align: right; color: var(--secondary-text-color); opacity: .7; user-select: none;
                     background: color-mix(in srgb, var(--primary-text-color) 3%, transparent); }
      .d-table .sg { width: 1%; padding: 0 4px; user-select: none; }
      .d-table .tx { white-space: pre-wrap; word-break: break-all; }
      .d-table tr.add td { background: color-mix(in srgb, var(--gs-ok) 14%, transparent); }
      .d-table tr.add .ln, .d-table tr.add .sg { color: var(--gs-ok); opacity: 1; }
      .d-table tr.del td { background: color-mix(in srgb, var(--gs-alert) 14%, transparent); }
      .d-table tr.del .ln, .d-table tr.del .sg { color: var(--gs-alert); opacity: 1; }
      .d-table tr.hunk td { color: var(--gs-info); background: color-mix(in srgb, var(--gs-info) 8%, transparent); }

      .d-foot { flex: none; display: flex; justify-content: flex-end; gap: 8px; padding: 10px 16px; border-top: 1px solid var(--gs-line); }
      .d-btn { display: inline-flex; align-items: center; gap: 6px; min-height: 38px; padding: 4px 14px; border-radius: 10px; cursor: pointer;
               font: inherit; font-size: 14px; font-weight: 500; color: var(--secondary-text-color); background: transparent;
               border: 1px solid color-mix(in srgb, var(--secondary-text-color) 35%, transparent); }
      .d-btn.primary { color: var(--gs-accent); border-color: color-mix(in srgb, var(--gs-accent) 45%, transparent); }
      .d-btn:hover { background: color-mix(in srgb, var(--gs-accent) 10%, transparent); }
      .d-btn ha-icon { --mdc-icon-size: 18px; }
      @keyframes gs-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
    `;
  }
}
// jscpd:ignore-end

// ── Editor ───────────────────────────────────────────────────────────────────
const GS_HELPERS = ['entity', 'title', 'zoom', 'show_files', 'show_export', 'language'];

// jscpd:ignore-start (each card is its own dashboard resource: the editor boilerplate is theirs)
class GitSyncCardEditor extends HTMLElement {
  // Options of the card; the mini card's editor adds the zoom button.
  _defaults() {
    return GS_DEFAULTS;
  }

  _options() {
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
      const t = (key) => gsT(gsLang(this._hass, this._config), key);
      this._form.computeLabel = (s) => t(`ed_${s.name}`);
      this._form.computeHelper = (s) => (GS_HELPERS.includes(s.name) ? t(`ed_${s.name}_helper`) : undefined);
      this._form.addEventListener('value-changed', (ev) => {
        const config = { ...ev.detail.value };
        // Options left at their default are not written to the YAML.
        for (const k of Object.keys(config)) {
          if (config[k] === '' || config[k] == null || this._defaults()[k] === config[k]) delete config[k];
        }
        this.dispatchEvent(new CustomEvent('config-changed', { detail: { config }, bubbles: true, composed: true }));
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    const c = this._config;
    const lang = gsLang(this._hass, c);
    // Reassigning the schema at every Home Assistant update would re-render ha-form while the user is typing.
    if (this._deps && this._deps.config === c && this._deps.lang === lang) return;
    this._deps = { config: c, lang };
    this._form.data = { ...this._defaults(), ...c };
    this._form.schema = [
      {
        name: 'entity',
        selector: {
          entity: {
            filter: { integration: GS_DOMAIN, domain: 'sensor' },
            // The Git Sync module's sensors only, not those of the other System Hub modules
            include_entities: Object.values(gsDevices(this._hass?.entities))
              .flatMap((d) => Object.values(d))
              .filter((id) => id.startsWith('sensor.')),
          },
        },
      },
      { name: 'title', selector: { text: {} } },
      ...this._options(),
      { name: 'show_files', selector: { boolean: {} } },
      { name: 'show_export', selector: { boolean: {} } },
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
              { value: 'sr', label: 'Српски' },
              { value: 'sr-Latn', label: 'Srpski (latinica)' },
            ],
          },
        },
      },
    ];
  }
}
// jscpd:ignore-end

class GitSyncMiniCardEditor extends GitSyncCardEditor {
  _defaults() {
    return GS_MINI_DEFAULTS;
  }

  _options() {
    return [{ name: 'zoom', selector: { boolean: {} } }];
  }
}

if (!customElements.get('git-sync-card')) {
  customElements.define('git-sync-card', GitSyncCard);
  customElements.define('git-sync-card-editor', GitSyncCardEditor);
  customElements.define('git-sync-mini-card', GitSyncMiniCard);
  customElements.define('git-sync-mini-card-editor', GitSyncMiniCardEditor);
  customElements.define('git-sync-diff-dialog', GitSyncDiffDialog);
  window.customCards = window.customCards || [];
  window.customCards.push(
    {
      type: 'git-sync-card',
      name: 'Git Sync Card',
      description: 'Git status of the configuration, Commit & push and dashboard export',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub',
    },
    {
      type: 'git-sync-mini-card',
      name: 'Git Sync Mini Card',
      description: 'Compact Git status with Commit & push; its zoom button shows the full card',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub',
    },
  );
  console.info(`%c GIT-SYNC-CARD %c v${GIT_SYNC_CARD_VERSION} `, 'background:#f05133;color:#fff;font-weight:700', '');
}
