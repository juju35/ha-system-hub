import { pickerDefine } from "./card-picker.js";
import { SYSTEM_HUB_CARD_VERSION } from "./core.js";
import { SystemHubCard, SystemHubMiniCard } from "./card.js";
import { SystemHubCardEditor, SystemHubMiniCardEditor } from "./editors.js";

if (!customElements.get('system-hub-card')) {
  pickerDefine('system-hub-card', SystemHubCard);
  pickerDefine('system-hub-card-editor', SystemHubCardEditor);
  pickerDefine('system-hub-mini-card', SystemHubMiniCard);
  pickerDefine('system-hub-mini-card-editor', SystemHubMiniCardEditor);
  window.customCards = window.customCards || [];
  window.customCards.push(
    {
      type: 'system-hub-card',
      name: 'System Hub',
      description: 'The status of Home Assistant at a glance, or one module of System Hub (module:)',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub#lovelace-cards',
    },
    {
      type: 'system-hub-mini-card',
      name: 'System Hub Mini',
      description: 'The status of Home Assistant on one line, or the mini card of one module of System Hub (module:)',
      preview: true,
      documentationURL: 'https://github.com/juju35/ha-system-hub#lovelace-cards',
    },
  );
  console.info(`%c SYSTEM-HUB-CARD %c v${SYSTEM_HUB_CARD_VERSION} `, 'background:#03a9f4;color:#fff;font-weight:700', '');
}
