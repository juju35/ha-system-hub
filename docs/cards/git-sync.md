# Git Sync Card

The card of System Hub's **Git Sync** module, ported from [ha-git-sync](https://github.com/juju35/ha-git-sync): same element names, options and look, so a dashboard keeps working once the module replaces the old integration. System Hub serves it with its other cards: no separate install. Add it from the card picker, or:

```yaml
type: custom:git-sync-card
```

| Changes pending | Up to date |
|---|---|
| <img src="../../screenshots/card-git-sync.png" alt="Card" width="400"> | <img src="../../screenshots/card-git-sync-clean.png" alt="Card, up to date" width="400"> |
| <img src="../../screenshots/card-git-sync-dark.png" alt="Card, dark theme" width="400"> | <img src="../../screenshots/card-git-sync-clean-dark.png" alt="Card, up to date, dark theme" width="400"> |

| Push failed | Commit & push, message written by the ✨ button |
|---|---|
| <img src="../../screenshots/card-git-sync-error.png" alt="Card, push failed" width="400"> | <img src="../../screenshots/card-git-sync-confirm.png" alt="Card, commit confirmation" width="400"> |
| <img src="../../screenshots/card-git-sync-error-dark.png" alt="Card, push failed, dark theme" width="400"> | <img src="../../screenshots/card-git-sync-confirm-dark.png" alt="Card, commit confirmation, dark theme" width="400"> |

- **Header**: status (up to date, changes, push pending, behind, diverged, error, working…), branch and remote repository
- **Last commit**: message, short hash and how long ago
- **Changed files**: collapsible list, folded again when you click elsewhere
- **Last push** and **Dashboard export**, with the number of exported files
- **Commit & push** opens a confirmation at the top of the card with a message box, as in VS Code: the placeholder names the branch, and the ✨ button inside it (shown when an AI task is set) writes the message for the current changes without committing, so you can read and edit it before **Commit & push**. Left empty, the AI task writes it when committing. **Enter** commits, **Escape** closes. **Export dashboards** runs the export right away. The result is shown in a toast
- **Pull** (shown when the remote has commits that are not here, unless local changes sit on top of unpushed commits: commit first) brings in the remote commits right away, with `system_hub.git_sync_pull`
- The actions (**Commit & push**, **Pull**, **Export dashboards**, **View changes**, ✨) are shown to administrators only, as the actions themselves are reserved to them; other users see the status
- **View changes** (the compare button beside the actions, also linked from the commit confirmation, shown when something changed) opens the **diff viewer** below

## Diff viewer

A full-screen view of what the next commit would include, laid out like an editor's source control view: the changed files on the left with their status letter (**A**dded, **M**odified, **D**eleted, **R**enamed, **T**ype or mode changed) and their added and removed lines, the selected file on the right hunk by hunk, with the line numbers of both sides, additions in green and deletions in red. On a phone it fills the screen and the files become a row of chips above the diff. Nothing is staged or committed by looking: the diff comes from a copy of the Git index (`system_hub.git_sync_get_diff`). **↑ ↓** walk the files, **Escape** or a click outside closes, **Commit & push** goes straight to the commit confirmation of the card.

| Desktop | Phone |
|---|---|
| <img src="../../screenshots/card-git-sync-diff.png" alt="Diff viewer" width="640"> | <img src="../../screenshots/card-git-sync-diff-phone.png" alt="Diff viewer on a phone" width="250"> |
| <img src="../../screenshots/card-git-sync-diff-dark.png" alt="Diff viewer, dark theme" width="640"> | <img src="../../screenshots/card-git-sync-diff-phone-dark.png" alt="Diff viewer on a phone, dark theme" width="250"> |

Every option is in the visual editor:

| Option | Default | Description |
|---|---|---|
| `entity` | found automatically | The Git Sync **Status** sensor (`sensor.system_hub_git_sync_status`); any other Git Sync entity leads to it, and an entity that isn't one (from the old integration, say) falls back to it |
| `title` | Git Sync | Card title |
| `show_files` | `true` | Collapsible list of the changed files |
| `show_export` | `true` | Last export and the **Export dashboards** button |
| `language` | Home Assistant's | `en`, `fr`, `de`, `es`, `it`, `nl`, `pt` (European Portuguese), `pl`, `ro`, `da`, `sv`, `bg`, `ru`, `uk`, `hu`, `sk`, `cs`, `sl`, `lv`, `el`, `sr` (Serbian, Cyrillic) or `sr-Latn` (Serbian, Latin) |

## Mini card

A compact version for a 6-column slot: status, branch, last commit on one line, number of changed files, last push and **Commit & push** as an icon button (plus **Pull** when the remote has new commits; administrators only). The zoom button at the top right switches it to the full card (same options) and back; a click anywhere else brings back the compact view.

```yaml
type: custom:git-sync-mini-card
```

| Changes pending | Up to date | Push failed |
|---|---|---|
| <img src="../../screenshots/card-git-sync-mini.png" alt="Mini card" width="400"> | <img src="../../screenshots/card-git-sync-mini-clean.png" alt="Mini card, up to date" width="400"> | <img src="../../screenshots/card-git-sync-mini-error.png" alt="Mini card, push failed" width="400"> |
| <img src="../../screenshots/card-git-sync-mini-dark.png" alt="Mini card, dark theme" width="400"> | <img src="../../screenshots/card-git-sync-mini-clean-dark.png" alt="Mini card, up to date, dark theme" width="400"> | <img src="../../screenshots/card-git-sync-mini-error-dark.png" alt="Mini card, push failed, dark theme" width="400"> |

| Zoomed in | |
|---|---|
| <img src="../../screenshots/card-git-sync-mini-zoomed.png" alt="Mini card zoomed in to the full card" width="389"> | <img src="../../screenshots/card-git-sync-mini-zoomed-dark.png" alt="Mini card zoomed in, dark theme" width="389"> |

In the compact view **Commit & push** opens the same message box (✨ button included) in place of the content. The mini card takes the options of the full card, plus:

| Option | Default | Description |
|---|---|---|
| `zoom` | `true` | Zoom button switching to the full card; `show_files` and `show_export` apply to the full view |


## Entities and actions used

The card reads the Git Sync module's sensors, told apart by their translation key (`git_sync_status`, `git_sync_last_commit`, `git_sync_last_push`, `git_sync_last_export`) so renamed entity IDs keep working, and only System Hub's (the other modules have a status too). It calls `system_hub.git_sync_commit_push`, `system_hub.git_sync_pull`, `system_hub.git_sync_export_dashboards`, `system_hub.git_sync_generate_message` and `system_hub.git_sync_get_diff`, with no config entry: System Hub has a single one.

Screenshots: `python scripts/screenshots_git_sync.py` (mock data, frozen clock).
