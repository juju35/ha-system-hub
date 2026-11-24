// Entry point: the modules in their original order. scripts/build-frontend.mjs (scripts/bundle.mjs) concatenates them
// in this order into the single classic script the integration serves.
import "./card-picker.js";
import "./core.js";
import "./i18n/strings.js";
import "./helpers.js";
import "./entity-discovery.js";
import "./shared-styles.js";
import "./illustrated-header.js";
import "./card-base.js";
import "./full-card.js";
import "./zoomable-compact-card.js";
import "./mini-card.js";
import "./visual-editors.js";
import "./register.js";
