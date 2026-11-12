// System Hub's sidebar icon, loaded on every page: the Status tab's emblem as an icon set (system-hub:good, :warn,
// :bad). The panel's icon is system-hub:status: the emblem of the status this page last read, its badge as in the
// Status tab. An administrator's page reads the status every 5 minutes (the panel's own code, without showing it), the
// panel when open at each read; the icon is drawn again when it changes, here only: the panel is never registered
// again for it (Home Assistant would rebuild an open panel, back on its first tab). The last one is kept by the
// browser, so that the sidebar shows it at once.
var SH_ICON_PATHS = {
  good: 'M84.5 222.1 244.5 90.1Q249.5 86 256 86Q262.5 86 267.5 90.1L293.7 111.7C292.6 117.7 292 123.8 292 130C292 140.9 293.7 151.3 296.9 161.1L256 127.3L151 214H156V386H356V223.3C367.2 227.6 379.3 230 392 230C404.9 230 417.2 227.6 428.6 223.1Q430.6 225.1 431.9 227.6Q433.6 230.7 433.9 234.3Q434.3 237.8 433.2 241.3Q432.2 244.7 429.9 247.5Q427.6 250.2 424.4 251.9Q421.3 253.6 417.7 253.9Q414.2 254.3 410.7 253.2Q407.3 252.2 404.5 249.9L392 239.5V388Q392 403.5 382.7 412.7Q373.5 422 358 422H154Q138.5 422 129.3 412.7Q120 403.5 120 388V239.5L107.5 249.9Q104.7 252.2 101.3 253.2Q97.8 254.3 94.3 253.9Q90.7 253.6 87.6 251.9Q84.4 250.2 82.1 247.5Q79.8 244.7 78.8 241.3Q77.7 237.8 78.1 234.3Q78.4 230.7 80.1 227.6Q81.8 224.4 84.5 222.1ZM474 130C474 175.3 437.3 212 392 212C346.7 212 310 175.3 310 130C310 84.7 346.7 48 392 48C437.3 48 474 84.7 474 130ZM290 300C290 305.3 288.8 310.2 286.7 314.7L306.7 332C309.5 330.7 312.7 330 316 330C328.2 330 338 339.8 338 352C338 364.2 328.2 374 316 374C303.8 374 294 364.2 294 352C294 349.8 294.3 347.7 294.9 345.6L274.9 328.3C269.5 331.9 263 334 256 334C249 334 242.5 331.9 237.1 328.3L217.1 345.6C217.7 347.7 218 349.8 218 352C218 364.2 208.2 374 196 374C183.8 374 174 364.2 174 352C174 339.8 183.8 330 196 330C199.3 330 202.5 330.7 205.3 332L225.3 314.7C223.2 310.2 222 305.3 222 300C222 295 223.1 290.2 225 285.9L205.7 269.8C202.7 271.2 199.5 272 196 272C183.8 272 174 262.2 174 250C174 237.8 183.8 228 196 228C208.2 228 218 237.8 218 250C218 252.1 217.7 254.1 217.2 255.9L236.6 272.1C242.1 268.3 248.8 266 256 266C263.2 266 269.9 268.3 275.4 272.1L294.8 255.9C294.3 254.1 294 252.1 294 250C294 237.8 303.8 228 316 228C328.2 228 338 237.8 338 250C338 262.2 328.2 272 316 272C312.5 272 309.3 271.2 306.3 269.8L287 285.9C288.9 290.2 290 295 290 300ZM339.3 126.1Q335.8 126.1 333.3 128.6Q330.8 131.1 330.8 134.6Q330.8 138.2 333.3 140.7Q335.8 143.2 339.3 143.2H367.2Q373 143.2 375.1 137.8L380 125.3L393.1 169.6Q394.1 173 397.2 174.7Q400.3 176.4 403.7 175.4Q408 174.1 409.4 169.8L421.5 132.3H444.7Q448.2 132.3 450.7 129.8Q453.2 127.3 453.2 123.8Q453.2 120.3 450.7 117.8Q448.2 115.3 444.7 115.3H415.2Q409 115.3 407.1 121.2L401.6 138.3L389.3 96.6Q388.1 92.6 384.3 91.1Q381 89.8 377.7 91.2Q374.5 92.6 373.2 95.9L361.4 126.1Z',
  warn: 'M84.5 222.1 244.5 90.1Q249.5 86 256 86Q262.5 86 267.5 90.1L293.7 111.7C292.6 117.7 292 123.8 292 130C292 140.9 293.7 151.3 296.9 161.1L256 127.3L151 214H156V386H356V223.3C367.2 227.6 379.3 230 392 230C404.9 230 417.2 227.6 428.6 223.1Q430.6 225.1 431.9 227.6Q433.6 230.7 433.9 234.3Q434.3 237.8 433.2 241.3Q432.2 244.7 429.9 247.5Q427.6 250.2 424.4 251.9Q421.3 253.6 417.7 253.9Q414.2 254.3 410.7 253.2Q407.3 252.2 404.5 249.9L392 239.5V388Q392 403.5 382.7 412.7Q373.5 422 358 422H154Q138.5 422 129.3 412.7Q120 403.5 120 388V239.5L107.5 249.9Q104.7 252.2 101.3 253.2Q97.8 254.3 94.3 253.9Q90.7 253.6 87.6 251.9Q84.4 250.2 82.1 247.5Q79.8 244.7 78.8 241.3Q77.7 237.8 78.1 234.3Q78.4 230.7 80.1 227.6Q81.8 224.4 84.5 222.1ZM474 130C474 175.3 437.3 212 392 212C346.7 212 310 175.3 310 130C310 84.7 346.7 48 392 48C437.3 48 474 84.7 474 130ZM290 300C290 305.3 288.8 310.2 286.7 314.7L306.7 332C309.5 330.7 312.7 330 316 330C328.2 330 338 339.8 338 352C338 364.2 328.2 374 316 374C303.8 374 294 364.2 294 352C294 349.8 294.3 347.7 294.9 345.6L274.9 328.3C269.5 331.9 263 334 256 334C249 334 242.5 331.9 237.1 328.3L217.1 345.6C217.7 347.7 218 349.8 218 352C218 364.2 208.2 374 196 374C183.8 374 174 364.2 174 352C174 339.8 183.8 330 196 330C199.3 330 202.5 330.7 205.3 332L225.3 314.7C223.2 310.2 222 305.3 222 300C222 295 223.1 290.2 225 285.9L205.7 269.8C202.7 271.2 199.5 272 196 272C183.8 272 174 262.2 174 250C174 237.8 183.8 228 196 228C208.2 228 218 237.8 218 250C218 252.1 217.7 254.1 217.2 255.9L236.6 272.1C242.1 268.3 248.8 266 256 266C263.2 266 269.9 268.3 275.4 272.1L294.8 255.9C294.3 254.1 294 252.1 294 250C294 237.8 303.8 228 316 228C328.2 228 338 237.8 338 250C338 262.2 328.2 272 316 272C312.5 272 309.3 271.2 306.3 269.8L287 285.9C288.9 290.2 290 295 290 300ZM401.3 92.8Q401.3 88.9 398.6 86.2Q395.9 83.5 392 83.5Q388.1 83.5 385.4 86.2Q382.7 88.9 382.7 92.8V139.3Q382.7 143.2 385.4 145.9Q388.1 148.6 392 148.6Q395.9 148.6 398.6 145.9Q401.3 143.2 401.3 139.3ZM403.6 168.8C403.6 162.3 398.4 157.1 392 157.1C385.6 157.1 380.4 162.3 380.4 168.8C380.4 175.2 385.6 180.4 392 180.4C398.4 180.4 403.6 175.2 403.6 168.8Z',
  bad: 'M84.5 222.1 244.5 90.1Q249.5 86 256 86Q262.5 86 267.5 90.1L293.7 111.7C292.6 117.7 292 123.8 292 130C292 140.9 293.7 151.3 296.9 161.1L256 127.3L151 214H156V386H356V223.3C367.2 227.6 379.3 230 392 230C404.9 230 417.2 227.6 428.6 223.1Q430.6 225.1 431.9 227.6Q433.6 230.7 433.9 234.3Q434.3 237.8 433.2 241.3Q432.2 244.7 429.9 247.5Q427.6 250.2 424.4 251.9Q421.3 253.6 417.7 253.9Q414.2 254.3 410.7 253.2Q407.3 252.2 404.5 249.9L392 239.5V388Q392 403.5 382.7 412.7Q373.5 422 358 422H154Q138.5 422 129.3 412.7Q120 403.5 120 388V239.5L107.5 249.9Q104.7 252.2 101.3 253.2Q97.8 254.3 94.3 253.9Q90.7 253.6 87.6 251.9Q84.4 250.2 82.1 247.5Q79.8 244.7 78.8 241.3Q77.7 237.8 78.1 234.3Q78.4 230.7 80.1 227.6Q81.8 224.4 84.5 222.1ZM474 130C474 175.3 437.3 212 392 212C346.7 212 310 175.3 310 130C310 84.7 346.7 48 392 48C437.3 48 474 84.7 474 130ZM290 300C290 305.3 288.8 310.2 286.7 314.7L306.7 332C309.5 330.7 312.7 330 316 330C328.2 330 338 339.8 338 352C338 364.2 328.2 374 316 374C303.8 374 294 364.2 294 352C294 349.8 294.3 347.7 294.9 345.6L274.9 328.3C269.5 331.9 263 334 256 334C249 334 242.5 331.9 237.1 328.3L217.1 345.6C217.7 347.7 218 349.8 218 352C218 364.2 208.2 374 196 374C183.8 374 174 364.2 174 352C174 339.8 183.8 330 196 330C199.3 330 202.5 330.7 205.3 332L225.3 314.7C223.2 310.2 222 305.3 222 300C222 295 223.1 290.2 225 285.9L205.7 269.8C202.7 271.2 199.5 272 196 272C183.8 272 174 262.2 174 250C174 237.8 183.8 228 196 228C208.2 228 218 237.8 218 250C218 252.1 217.7 254.1 217.2 255.9L236.6 272.1C242.1 268.3 248.8 266 256 266C263.2 266 269.9 268.3 275.4 272.1L294.8 255.9C294.3 254.1 294 252.1 294 250C294 237.8 303.8 228 316 228C328.2 228 338 237.8 338 250C338 262.2 328.2 272 316 272C312.5 272 309.3 271.2 306.3 269.8L287 285.9C288.9 290.2 290 295 290 300ZM370.7 95.5Q368 92.8 364.1 92.8Q360.2 92.8 357.5 95.5Q354.8 98.2 354.8 102.1Q354.8 106 357.5 108.7L378.8 130L357.5 151.3Q354.8 154 354.8 157.9Q354.8 161.8 357.5 164.5Q360.2 167.2 364.1 167.2Q368 167.2 370.7 164.5L392 143.2L413.3 164.5Q416 167.2 419.9 167.2Q423.8 167.2 426.5 164.5Q429.2 161.8 429.2 157.9Q429.2 154 426.5 151.3L405.2 130L426.5 108.7Q429.2 106 429.2 102.1Q429.2 98.2 426.5 95.5Q423.8 92.8 419.9 92.8Q416 92.8 413.3 95.5L392 116.8Z',
};
var SH_ICON_VIEWBOX = '48 24 444 444';
var SH_ICON_EVERY_MS = 300000;
var SH_TONE_KEY = 'system-hub-tone';

function shToneSaved() {
  try {
    var tone = localStorage.getItem(SH_TONE_KEY);
    return tone in SH_ICON_PATHS ? tone : 'good';
  } catch (_err) {
    return 'good';
  }
}
window.__systemHubTone ??= shToneSaved();

window.customIcons = window.customIcons || {};
window.customIcons['system-hub'] = {
  getIcon: async (name) => ({
    path: SH_ICON_PATHS[name === 'status' ? window.__systemHubTone : name] || SH_ICON_PATHS.good,
    viewBox: SH_ICON_VIEWBOX,
  }),
  getIconList: async () => Object.keys(SH_ICON_PATHS).map((name) => ({ name })),
};

// The icons drawn before this set was known (shown blank until their icon changes): drawn again. The number found.
function shIconRedraw(root, depth = 0) {
  if (!root || depth > 8) return 0;
  let found = 0;
  for (const el of root.querySelectorAll('*')) {
    if (el.localName === 'ha-icon' && String(el.icon || '').startsWith('system-hub:')) {
      const icon = el.icon;
      el.icon = '';
      requestAnimationFrame(() => {
        el.icon = icon;
      });
      found += 1;
    }
    if (el.shadowRoot) found += shIconRedraw(el.shadowRoot, depth + 1);
  }
  return found;
}

// At once, then until the sidebar has drawn the icon (it may come after this module): every 250 ms for 5 seconds
function shIconRedrawSoon(tries = 20) {
  if (shIconRedraw(document.querySelector('home-assistant')?.shadowRoot) || tries <= 1) return;
  setTimeout(() => shIconRedrawSoon(tries - 1), 250);
}

// The status read (good, warn or bad): the sidebar icon drawn again when it changes, the tone kept for the next page
window.systemHubSetTone = (tone) => {
  if (!(tone in SH_ICON_PATHS) || tone === window.__systemHubTone) return;
  window.__systemHubTone = tone;
  try {
    localStorage.setItem(SH_TONE_KEY, tone);
  } catch (_err) {
    // drawn anyway, not kept
  }
  shIconRedraw(document.querySelector('home-assistant')?.shadowRoot);
};

// The status, read as the panel reads it (its module, without showing it), reported for the sidebar icon
async function shIconFollow() {
  var hass = document.querySelector('home-assistant')?.hass;
  var panel = hass?.panels?.['system-hub'];
  if (!hass?.user?.is_admin || !panel || document.hidden) return;
  try {
    if (!customElements.get('system-hub-panel')) await import(panel.config._panel_custom.module_url);
    var Panel = customElements.get('system-hub-panel');
    var probe = (window.__systemHubProbe ??= new Panel());
    probe._headless = true;
    probe._hass = hass;
    // Its tone sent with the read when the sidebar shows another one
    await probe._load();
  } catch (_err) {
    // read again next time
  }
}

if (!window.__systemHubIcons) {
  window.__systemHubIcons = true;
  shIconRedrawSoon();
  // The status read a few seconds after the page, once Home Assistant has drawn it, then every 5 minutes
  setTimeout(shIconFollow, 5000);
  setInterval(shIconFollow, SH_ICON_EVERY_MS);
}
