// tests/tappa3_roster.cjs - Verifica Tappa 3 (Roster, Carte, Moduli e Scout)
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
  console.log("▶ Avvio test Tappa 3: Roster, Carte e Scout...");
  const browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("Console: " + m.text());
  });
  page.on("pageerror", (e) => errors.push("PageError: " + e.message));

  // Blocca richieste esterne
  let externalRequests = 0;
  await page.route("**/*", (route) => {
    const url = route.request().url();
    if (!url.startsWith(BASE)) {
      externalRequests++;
      console.warn("Richiesta esterna bloccata:", url);
      route.abort();
    } else {
      route.continue();
    }
  });

  await page.goto(`${BASE}/pixel-calcio-arcade/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(500);

  // 1. Navigazione a Schermata Squadra
  await page.click('button[data-target="team"]');
  await page.waitForTimeout(400);

  const teamActive = await page.$eval("#screen-team", (el) => el.classList.contains("active"));
  if (!teamActive) throw new Error("Schermata Squadra non attivata");
  console.log("  ✓ Navigazione su Schermata Squadra eseguita");

  // 2. Verifica catalogo e modulo
  const moduloInit = await page.$eval("#select-modulo", (el) => el.value);
  if (moduloInit !== "rombo") throw new Error(`Modulo iniziale errato: ${moduloInit}`);
  console.log("  ✓ Modulo tattico iniziale verificato: rombo");

  // 3. Test cambio modulo
  await page.selectOption("#select-modulo", "piramide");
  await page.waitForTimeout(300);
  const moduloSaved = await page.evaluate(() => window.PCA_Storage.load().modulo);
  if (moduloSaved !== "piramide") throw new Error(`Modulo non salvato: ${moduloSaved}`);
  console.log("  ✓ Modulo aggiornato e salvato in localStorage: piramide");

  // 4. Navigazione a Negozio Scout
  await page.click('button[data-target="shop"]');
  await page.waitForTimeout(400);

  const preCoins = await page.evaluate(() => window.PCA_Storage.load().coins);
  console.log("  ✓ Monete prima dello spacchettamento:", preCoins);

  // Acquista bustina base (50 monete)
  await page.evaluate(() => window.PCA_Roster.openPack("base"));
  await page.waitForTimeout(400);

  const postCoins = await page.evaluate(() => window.PCA_Storage.load().coins);
  console.log("  ✓ Monete dopo lo spacchettamento:", postCoins);
  if (postCoins !== preCoins - 50) throw new Error(`Detrazione errata: atteso ${preCoins - 50}, ottenuto ${postCoins}`);

  const packsOpened = await page.evaluate(() => window.PCA_Storage.load().stats.packsOpened);
  if (packsOpened !== 1) throw new Error(`Contatore pacchetti errato: ${packsOpened}`);
  console.log("  ✓ Pacchetto aperto con successo, contatore pacchetti:", packsOpened);

  // 5. Verifica modale carta sbloccata
  const modalShown = await page.$eval("#cutin-modal", (el) => el.classList.contains("show"));
  if (!modalShown) throw new Error("Modale nuova carta non mostrato");
  console.log("  ✓ Modale rivelazione carta visualizzato correttamente");

  await page.click("#cutin-btn-ok");
  await page.waitForTimeout(300);

  // 6. Ritorno alla Squadra e screenshot
  await page.click('button[data-target="team"]');
  await page.waitForTimeout(400);

  const shotDir = path.join(__dirname, "shots");
  fs.mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, "tappa3_roster.png") });
  console.log("  ✓ Screenshot salvato in tests/shots/tappa3_roster.png");

  // 7. Verifica zero richieste esterne
  if (externalRequests > 0) throw new Error(`Rilevate ${externalRequests} richieste esterne!`);
  console.log("  ✓ Zero richieste esterne (100% offline)");

  await browser.close();

  if (errors.length > 0) {
    throw new Error("Errori console rilevati:\n" + errors.join("\n"));
  }

  console.log("✅ Tappa 3 completata e verificata con successo!");
}

run().catch((err) => {
  console.error("❌ Test Tappa 3 fallito:", err);
  process.exit(1);
});
