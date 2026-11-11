// Screenshots of the Configure forms of every module (the "Module settings" button of the panel), taken from a
// running Home Assistant, light and dark, into screenshots/config-*.png.
// Needs a Home Assistant at HA_URL with System Hub set up (every module turned on), and a Playwright storage state
// of a logged-in administrator in HA_STATE (log in once and save it with context.storageState()).
// Usage: HA_URL=http://127.0.0.1:8123 HA_STATE=state.json node scripts/config-screenshots.mjs
import { chromium } from 'playwright';

const url = process.env.HA_URL || 'http://127.0.0.1:8123';
const state = process.env.HA_STATE || 'state.json';
const out = new URL('../screenshots/', import.meta.url).pathname;
// The menu, then each step by its label in the English translations
const steps = [
  ['menu', null],
  ['modules', 'Modules'],
  ['containers', 'Containers'],
  ['watchdog', 'Watchdog'],
  ['watchdog-power-cycle', 'Watchdog: Add a power cycle'],
  ['marketplace', 'Marketplace'],
  ['batteries', 'Batteries'],
  ['batteries-types', 'Batteries: Battery types'],
  ['batteries-import', 'Batteries: Import from Battery Monitor'],
  ['git-sync-repository', 'Git Sync: Repository settings'],
  ['git-sync', 'Git Sync'],
];

// The first element of the page, shadow roots included, that `test` accepts (defined in every page)
function installFind() {
  window.shFind = (test) => {
    let hit = null;
    const walk = (root) => {
      for (const el of root.querySelectorAll('*')) {
        if (hit) return;
        if (test(el)) {
          hit = el;
          return;
        }
        if (el.shadowRoot) walk(el.shadowRoot);
      }
    };
    walk(document);
    return hit;
  };
}

const browser = await chromium.launch();
for (const dark of [false, true]) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 }, deviceScaleFactor: 2, storageState: state });
  await context.addInitScript((d) => localStorage.setItem('selectedTheme', JSON.stringify({ theme: 'default', dark: d })), dark);
  await context.addInitScript(installFind);
  const page = await context.newPage();
  for (const [file, label] of steps) {
    await page.goto(`${url}/config/integrations/integration/system_hub`);
    await page.waitForTimeout(4000);
    // The cog of the entry opens its options
    await page.evaluate(() => window.shFind((el) => el.tagName === 'HA-ICON-BUTTON' && String(el.path || '').startsWith('M12,8A4,4')).click());
    await page.waitForTimeout(2500);
    if (label) {
      await page.getByText(label, { exact: true }).first().click();
      await page.waitForTimeout(2500);
    }
    const clip = await page.evaluate(() => {
      const box = window.shFind((el) => el.classList?.contains('mdc-dialog__surface')).getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    });
    await page.screenshot({ path: `${out}config-${file}${dark ? '-dark' : ''}.png`, clip, animations: 'disabled' });
    console.log(`screenshots/config-${file}${dark ? '-dark' : ''}.png`);
  }
  await context.close();
}
await browser.close();
