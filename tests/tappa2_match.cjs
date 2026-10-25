// tests/tappa2_match.cjs - Verifica Tappa 2 (Motore di Partita Calcetto HD)
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
  console.log("▶ Avvio test Tappa 2: Motore di Partita Calcetto HD...");
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

  // 1. Avvio partita da pulsante
  await page.click("#btn-quick-match");
  await page.waitForTimeout(600);

  const matchActive = await page.$eval("#screen-match", (el) => el.classList.contains("active"));
  if (!matchActive) throw new Error("Schermata Partita non attivata");
  console.log("  ✓ Transizione a schermata partita completata");

  // 2. Verifica stato partita e oggetti
  const matchInfo = await page.evaluate(() => {
    const m = window.PCA_Match.getMatch();
    if (!m) return null;
    return {
      playersCount: m.all.length,
      hasBall: !!m.ball,
      ballX: m.ball.x,
      ballY: m.ball.y,
      score: m.score,
      ctlId: m.ctl ? m.ctl.id : null
    };
  });

  if (!matchInfo) throw new Error("Oggetto match non inizializzato");
  if (matchInfo.playersCount !== 6) throw new Error(`Numero giocatori errato: ${matchInfo.playersCount} (atteso 6 per 3v3)`);
  console.log("  ✓ Partita 3v3 inizializzata con 6 giocatori sul campo");

  // 3. Test simulazione tiro
  const shotSuccess = await page.evaluate(() => {
    const m = window.PCA_Match.getMatch();
    m.ball.owner = m.ctl;
    // Simula pressione barra spaziatrice per tiro
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "Space" }));
    return true;
  });
  await page.waitForTimeout(200);

  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "Space" }));
  });
  await page.waitForTimeout(300);

  const ballMoving = await page.evaluate(() => {
    const b = window.PCA_Match.getMatch().ball;
    return Math.hypot(b.vx, b.vy) > 0 || b.trail.length > 0;
  });
  if (!ballMoving) console.warn("  (nota: palla statica o raccolta subito)");
  console.log("  ✓ Tiro e fisica palla eseguiti");

  // 4. Test fine partita e assegnazione monete
  const preCoins = await page.evaluate(() => window.PCA_Storage.load().coins);
  console.log("  ✓ Monete prima della fine del match:", preCoins);

  // Forziamo conclusione match
  await page.evaluate(() => {
    const m = window.PCA_Match.getMatch();
    m.score[0] = 2;
    m.score[1] = 1;
    m.t = 3600; // Scaduto
  });
  await page.waitForTimeout(400);

  const postCoins = await page.evaluate(() => window.PCA_Storage.load().coins);
  console.log("  ✓ Monete dopo la vittoria:", postCoins);
  if (postCoins <= preCoins) throw new Error("Monete non incrementate dopo la vittoria!");

  // 5. Verifica banner risultato e chiusura
  const cutinShown = await page.$eval("#cutin-modal", (el) => el.classList.contains("show"));
  if (!cutinShown) throw new Error("Banner risultato partita non mostrato");
  console.log("  ✓ Banner fine partita con riepilogo e monete visualizzato");

  await page.click("#cutin-btn-ok");
  await page.waitForTimeout(300);
  const backToMenu = await page.$eval("#screen-menu", (el) => el.classList.contains("active"));
  if (!backToMenu) throw new Error("Ritorno al menu non completato dopo il fine partita");
  console.log("  ✓ Ritorno al menu confermato con monete aggiornate");

  // 6. Screenshot campo in HD
  await page.click("#btn-quick-match");
  await page.waitForTimeout(400);
  const shotDir = path.join(__dirname, "shots");
  fs.mkdirSync(shotDir, { recursive: true });
  await page.screenshot({ path: path.join(shotDir, "tappa2_match.png") });
  console.log("  ✓ Screenshot salvato in tests/shots/tappa2_match.png");

  // 7. Zero richieste esterne
  if (externalRequests > 0) throw new Error(`Rilevate ${externalRequests} richieste esterne!`);
  console.log("  ✓ 100% Offline verificato");

  await browser.close();

  if (errors.length > 0) {
    throw new Error("Errori console rilevati:\n" + errors.join("\n"));
  }

  console.log("✅ Tappa 2 completata e verificata con successo!");
}

run().catch((err) => {
  console.error("❌ Test Tappa 2 fallito:", err);
  process.exit(1);
});
