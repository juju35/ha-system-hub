import { SystemHubDiffDialog } from "./diff-dialog.js";
import { SystemHubPanel } from "./panel.js";

if (!customElements.get('system-hub-diff-dialog')) {
  customElements.define('system-hub-diff-dialog', SystemHubDiffDialog);
}
if (!customElements.get('system-hub-panel')) {
  customElements.define('system-hub-panel', SystemHubPanel);
}
