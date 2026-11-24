// Entry point: the modules in their original order. scripts/build-frontend.mjs (scripts/bundle.mjs) concatenates them
// in this order into the single classic script the integration serves.
import "./card-picker.js";
import "./core.js";
import "./illustrated-header.js";
import "./styles.js";
import "./card-base.js";
import "./card.js";
import "./editors.js";
import "./register.js";
