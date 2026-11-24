// Entry point: the modules in their original order. scripts/build-frontend.mjs (scripts/bundle.mjs) concatenates them
// in this order into the single classic script the integration serves.
import "./card-picker.js";
import "./core.js";
import "./i18n/bm-i18n.js";
import "./i18n-helpers.js";
import "./battery-types.js";
import "./illustrated-header.js";
import "./card.js";
import "./mini-card.js";
import "./editor.js";
