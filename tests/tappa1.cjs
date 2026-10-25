// tests/tappa1.cjs - Verifica Tappa 1 per Pixel Calcio Arcade
const path = require("path");
const fs = require("fs");

function loadPW() {
  for (const p of ["playwright", "/root/.bun/install/global/node_modules/playwright", "/opt/node22/lib/node_modules/playwright"]) {
    try { return require(p); } catch (e) {}
  }
  throw new Error("Playwright non trovato");
}

const { chromium } = loadPW();
const CHROME_PATHS = [
  "/opt/pw-browsers/chromium",
  "/ms-playwright/chromium_headless_shell-1247/chrome-headless-shell-linux64/chrome-headless-shell",
  "/ms-playwright/chrome-headless-shell-linux64"
];
const EXE = process.env.PW_CHROMIUM || CHROME_PATHS.find((p) => fs.existsSync(p)) || undefined;
const BASE = process.env.TEST_URL || "http://localhost:3000";

async function run() {
  console.log("▶ Avvio test Tappa 1: Pixel Calcio Arcade...");
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("Console error: " + m.text());
  });
  page.on("pageerror", (e) => errors.push("Page error: " + e.message));

  // Blocca richieste esterne
  let externalRequests = 0;
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(BASE)) {
      externalRequests++;
      console.warn("Rilevata richiesta esterna bloccata:", url);
      route.abort();
    } else {
      route.continue();
    }
  });

  await page.goto(`${BASE}/pixel-calcio-arcade/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  // 1. Verifica titolo ed elementi principali
  const title = await page.title();
  if (title !== "Pixel Calcio Arcade") throw new Error(`Titolo errato: ${title}`);
  console.log("  ✓ Titolo verificato:", title);

  // 2. Verifica saldo monete
  const coins = await page.$eval("#coin-count", (el) => el.textContent.trim());
  if (coins !== "150") throw new Error(`Monete iniziali errate: ${coins}`);
  console.log("  ✓ Monete iniziali:", coins);

  // 3. Test navigazione schermi
  await page.click('button[data-target="shop"]');
  await page.waitForTimeout(200);
  const shopActive = await page.$eval("#screen-shop", (el) => el.classList.contains("active"));
  if (!shopActive) throw new Error("Schermata Shop non attiva");
  console.log("  ✓ Navigazione su Shop funzionante");

  await page.click('button[data-target="menu"]');
  await page.waitForTimeout(200);
  const menuActive = await page.$eval("#screen-menu", (el) => el.classList.contains("active"));
  if (!menuActive) throw new Error("Ritorno al Menu non funzionante");
  console.log("  ✓ Ritorno al Menu funzionante");

  // 4. Test Cut-in banner
  await page.click("#btn-open-tournament");
  await page.waitForTimeout(200);
  const cutinShown = await page.$eval("#cutin-modal", (el) => el.classList.contains("show"));
  if (!cutinShown) throw new Error("Cut-in modal non visibile al click Torneo");
  console.log("  ✓ Cut-in banner mostrato con successo");

  await page.click("#cutin-btn-ok");
  await page.waitForTimeout(100);
  const cutinHidden = await page.$eval("#cutin-modal", (el) => !el.classList.contains("show"));
  if (!cutinHidden) throw new Error("Cut-in modal non chiuso dopo click");
  console.log("  ✓ Chiusura Cut-in banner verificata");

  // 5. Nessuna richiesta esterna
  if (externalRequests > 0) throw new Error(`Rilevate ${externalRequests} richieste esterne!`);
  console.log("  ✓ Zero richieste esterne (100% offline)");

  // 6. Screenshot di verifica
  const shotDir = path.join(__dirname, "shots");
  fs.mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, "tappa1_menu.png") });
  console.log("  ✓ Screenshot salvato in tests/shots/tappa1_menu.png");

  await browser.close();

  if (errors.length > 0) {
    throw new Error("Rilevati errori durante l'esecuzione:\n" + errors.join("\n"));
  }

  console.log("✅ Tappa 1 completata e verificata con successo!");
}

run().catch((err) => {
  console.error("❌ Test Tappa 1 fallito:", err);
  process.exit(1);
});
