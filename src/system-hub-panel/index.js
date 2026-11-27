// Entry point: the modules in their original order. scripts/build-frontend.mjs (scripts/bundle.mjs) concatenates them
// in this order into the single classic script the integration serves.
import "./core.js";
import "./network-graphs.js";
import "./diff-dialog.js";
import "./monitor-helpers.js";
import "./fold-css.js";
import "./fold.js";
import "./panel.js";
import "./orphans.js";
import "./security.js";
import "./purge.js";
import "./register.js";
import "./settings.js";
import "./status.js";
import "./illustrated-header.js";
import "./banner-style.js";
