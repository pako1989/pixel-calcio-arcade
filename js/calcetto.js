// Pixel Calcio Arcade - Motore di Partita Calcetto HD a 3/4 (Stadio HD completo)
(function (global) {
  const S = window.PCA_Storage;
  const A = window.PCA_Audio;

  const W = 320, H = 180, TOP = 16, BOT = H - 16, CY = H / 2;
  const GY0 = CY - 24, GY1 = CY + 24, MX = 32, CW = W + MX * 2, OY = 32, CH = H + OY + 16, SS = 2;
  const DUR = 3600; // 60s a 60fps

  let canvas = null, ctx = null, rafId = 0, M = null, active = false;
  let STATIC_HD = null, CROWD_HD = null;

  // Input state
  const inp = { l: 0, r: 0, u: 0, d: 0, sprint: false, shootHeld: 0, isCharging: false };
  const stick = { active: false, x: 0, y: 0, sx: 0, sy: 0 };

  function seeded(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildStaticHD() {
    const c = document.createElement("canvas");
    c.width = CW * SS; c.height = CH * SS;
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.scale(SS, SS);

    // 1. Spalti superiori e gradinate
    g.fillStyle = "#121a24"; g.fillRect(0, 0, CW, OY);
    g.fillStyle = "#1e2c3d";
    for (let y = 0; y < OY; y += 7) g.fillRect(0, y, CW, 2.5);
    g.fillStyle = "#0c131c";
    for (let x = 0; x < CW; x += 18) g.fillRect(x, 0, 1.5, OY);

    // Recinzione a rete verde con maglia
    g.fillStyle = "#27ae60"; g.fillRect(0, OY - 7, CW, 7);
    g.fillStyle = "rgba(10,30,20,.65)";
    for (let x = 0; x < CW; x += 3) for (let y = OY - 7; y < OY; y += 3) g.fillRect(x, y, 1.2, 1.2);
    g.fillStyle = "#3e4f63"; g.fillRect(0, OY - 1, CW, 1.5);

    // 2. Campo (manto sintetico blu consumato stile Football Story)
    g.save(); g.translate(MX, OY);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#1a4677"); gr.addColorStop(0.5, "#245e9a"); gr.addColorStop(1, "#1a4677");
    g.fillStyle = gr; g.fillRect(0, 0, W, H);

    // Sponda superiore arancione in legno
    g.fillStyle = "#9e380a"; g.fillRect(-MX, 0, CW, 4.5);
    g.fillStyle = "#d46422"; g.fillRect(-MX, 0, CW, 3.5);
    g.fillStyle = "#f58238"; g.fillRect(-MX, 3, CW, 1);
    for (let x = -MX; x < W + MX; x += 16) { g.fillStyle = "#4a1c06"; g.fillRect(x, 0, 1.2, 4); }

    // Striature di usura erba
    const r = seeded(42);
    for (let i = 0; i < 400; i++) {
      const rx = r() * W, ry = r() * H, op = r();
      if (op < 0.35) { g.fillStyle = "rgba(180,230,255,.08)"; g.fillRect(rx, ry, 1.5, 1.2); }
      else if (op < 0.6) { g.fillStyle = "rgba(10,40,75,.09)"; g.fillRect(rx, ry, 1.4, 1.2); }
      else if (op < 0.7) { g.fillStyle = "rgba(160,220,255,.06)"; g.fillRect(rx, ry, 3.5, 0.8); }
    }

    // Linee bianche nitide con ombra di contrasto
    g.strokeStyle = "rgba(10,35,70,.4)"; g.lineWidth = 3.2; g.strokeRect(2, TOP, W - 4, BOT - TOP);
    g.beginPath(); g.moveTo(W / 2, TOP); g.lineTo(W / 2, BOT); g.stroke();
    g.beginPath(); g.arc(W / 2, CY, 26, 0, Math.PI * 2); g.stroke();

    g.strokeStyle = "#ffffff"; g.lineWidth = 1.8; g.strokeRect(2, TOP, W - 4, BOT - TOP);
    g.beginPath(); g.moveTo(W / 2, TOP); g.lineTo(W / 2, BOT); g.stroke();
    g.beginPath(); g.arc(W / 2, CY, 26, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#ffffff"; g.beginPath(); g.arc(W / 2, CY, 2.2, 0, Math.PI * 2); g.fill();

    // Aree di rigore
    const BXW = 38, BXH = 64;
    g.strokeRect(2, CY - BXH / 2, BXW, BXH);
    g.strokeRect(W - BXW - 2, CY - BXH / 2, BXW, BXH);
    g.beginPath(); g.arc(BXW * 0.72, CY, 1.8, 0, Math.PI * 2); g.arc(W - BXW * 0.72, CY, 1.8, 0, Math.PI * 2); g.fill();

    // Bandierine d'angolo
    [[2, TOP], [W - 2, TOP], [2, BOT], [W - 2, BOT]].forEach(([x, y], idx) => {
      g.fillStyle = "#f0f0f0"; g.fillRect(x - 0.5, y - 9, 1, 9);
      g.fillStyle = idx % 2 === 0 ? "#ff473a" : "#ffa020"; g.beginPath(); const dir = idx % 2 === 0 ? 1 : -1;
      g.moveTo(x + 0.5 * dir, y - 9); g.lineTo(x + 6 * dir, y - 6.5); g.lineTo(x + 0.5 * dir, y - 4); g.closePath(); g.fill();
    });

    // Porte con rete 3D a maglia
    const goal3D = (gx0, isRight) => {
      const gw = MX - 2;
      g.fillStyle = "rgba(8,14,26,.85)"; g.fillRect(gx0, GY0, gw, GY1 - GY0);
      g.strokeStyle = "rgba(255,255,255,.55)"; g.lineWidth = 0.7;
      for (let y = GY0 - 8; y <= GY1 + 8; y += 4.5) {
        g.beginPath(); g.moveTo(gx0, y); g.lineTo(gx0 + gw, y + 4.5); g.stroke();
        g.beginPath(); g.moveTo(gx0, y + 4.5); g.lineTo(gx0 + gw, y); g.stroke();
      }
      const px = isRight ? W : 0;
      g.fillStyle = "#ffffff"; g.fillRect(px - (isRight ? 1.2 : 0.8), GY0 - 2, 2, GY1 - GY0 + 4);
      g.fillRect(isRight ? W : -gw, GY0 - 2, gw, 2); g.fillRect(isRight ? W : -gw, GY1, gw, 2);
    };
    goal3D(-MX + 2, false); goal3D(W, true);

    // Sponda arancione inferiore in legno
    g.fillStyle = "#9e380a"; g.fillRect(-MX, H - 2, CW, 5);
    g.fillStyle = "#d46422"; g.fillRect(-MX, H - 2, CW, 3.5);
    g.fillStyle = "#f58238"; g.fillRect(-MX, H - 2, CW, 1);
    for (let x = -MX + 6; x < W + MX; x += 16) { g.fillStyle = "#4a1c06"; g.fillRect(x, H - 0.8, 1, 1.2); }
    g.restore();

    // 3. Tabellone in legno «MATCH BOARD»
    const tbx = 24, tby = 2, tbw = 76, tbh = 18;
    g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(tbx - 1, tby - 0.5, tbw + 2, tbh + 2);
    const wc2 = ["#63381a", "#7a4622", "#8c532b", "#6e3f1e"];
    for (let i = 0; i < 4; i++) { g.fillStyle = wc2[i % wc2.length]; g.fillRect(tbx, tby + i * 4.5, tbw, 4.2); }
    g.strokeStyle = "#452410"; g.lineWidth = 1.2; g.strokeRect(tbx, tby, tbw, tbh);
    g.fillStyle = "#f5d061"; g.font = "900 4.5px system-ui"; g.textAlign = "center";
    g.fillText("★ PIXEL CALCIO BOARD ★", tbx + tbw / 2, tby + 4.2);
    g.fillStyle = "#0c131a"; g.fillRect(tbx + 4, tby + 5.2, tbw - 8, tbh - 6.5);
    g.strokeStyle = "#1c2a38"; g.lineWidth = 0.8; g.strokeRect(tbx + 4, tby + 5.2, tbw - 8, tbh - 6.5);

    c._w = W; return c;
  }

  function buildCrowdHD() {
    const frames = [0, 1, 2, 3].map(() => {
      const c = document.createElement("canvas"); c.width = CW * SS; c.height = OY * SS;
      const g = c.getContext("2d"); g.imageSmoothingEnabled = false; g.scale(SS, SS); return { c, g };
    });
    const r = seeded(42);
    const shirtCols = ["#e74c3c", "#f39c12", "#27ae60", "#8e44ad", "#2980b9", "#d35400", "#16a085", "#ffffff"];
    const hairCols = ["#2c3e50", "#7f8c8d", "#d35400", "#f1c40f", "#34495e"];
    const spots = [];
    for (let x = 6; x <= 20; x += 5.5) { spots.push({ x, y: 5.5, col: shirtCols[Math.floor(r() * shirtCols.length)], hair: hairCols[Math.floor(r() * hairCols.length)], kind: "fan" }); spots.push({ x, y: 10.5, col: shirtCols[Math.floor(r() * shirtCols.length)], hair: hairCols[Math.floor(r() * hairCols.length)], kind: "fan" }); }
    spots.push({ x: 22, y: 15.5, col: "#ffaa00", hair: "#111", kind: "steward" });
    for (let i = 0; i < 4; i++) spots.push({ x: 104 + i * 11, y: 15.5, kind: "cheer" });
    spots.push({ x: 152, y: 15.5, col: "#ffaa00", hair: "#111", kind: "steward" });
    for (let row = 0; row < 3; row++) {
      const startX = row === 2 ? 164 : 104;
      for (let x = startX; x < CW - 26; x += 6.5) spots.push({ x, y: 5.5 + row * 5, col: shirtCols[Math.floor(r() * shirtCols.length)], hair: hairCols[Math.floor(r() * hairCols.length)], kind: "fan", flag: r() < 0.2 ? shirtCols[Math.floor(r() * shirtCols.length)] : null });
    }
    spots.push({ x: CW - 25, y: 15.5, col: "#ffaa00", hair: "#111", kind: "steward" });

    frames.forEach(({ g }, f) => {
      spots.forEach((s) => {
        if (s.kind === "cheer") {
          const py = s.y + (f === 1 ? -1.5 : (f === 3 ? -0.5 : 0));
          g.fillStyle = "#e74c3c"; g.fillRect(s.x - 2, py + 1, 4, 2.5);
          g.fillStyle = "#ffffff"; g.fillRect(s.x - 1.5, py - 2.5, 3, 3.5);
          g.fillStyle = "#f5c59e"; g.fillRect(s.x - 1, py - 4.5, 2, 2);
          g.fillStyle = "#f1c40f"; g.fillRect(s.x - 1.5, py - 5.5, 3, 2);
          g.fillStyle = "#ff2233"; const lx = s.x - 3, ly = py - (f % 2 === 1 ? 4 : 1.5), rx = s.x + 3, ry = py - (f % 2 === 1 ? 4 : 1.5);
          g.beginPath(); g.arc(lx, ly, 1.8, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(rx, ry, 1.8, 0, Math.PI * 2); g.fill();
        } else if (s.kind === "steward") {
          g.fillStyle = "#1c2430"; g.fillRect(s.x - 1.5, s.y + 1, 3, 3);
          g.fillStyle = "#ffaa00"; g.fillRect(s.x - 2, s.y - 3, 4, 4);
          g.fillStyle = "#f0be92"; g.fillRect(s.x - 1, s.y - 4.5, 2, 2);
        } else {
          const cheer = (f === 1 || f === 2), py = s.y + (f % 2 === 1 ? -0.8 : 0);
          g.fillStyle = "#1a2434"; g.fillRect(s.x - 1.5, py + 1.2, 3, 2.8);
          g.fillStyle = s.col; g.fillRect(s.x - 2, py - 2.5, 4, 3.8);
          g.fillStyle = "#f0be92"; g.fillRect(s.x - 1.2, py - 4.5, 2.4, 2);
          g.fillStyle = s.hair; g.fillRect(s.x - 1.5, py - 5.5, 3, 1.5);
          if (s.flag && cheer) {
            g.fillStyle = "#f0f0f0"; g.fillRect(s.x + 2.5, py - 6.5, 0.7, 4);
            g.fillStyle = s.flag; g.fillRect(s.x + 3.2, py - 6.5, 3, 2);
          }
        }
      });
    });
    return frames.map((x) => x.c);
  }

  function figHD(g, p) {
    const sv = Math.hypot(p.vx, p.vy), isMoving = sv > 0.35, sgn = p.fx >= 0 ? 1 : -1, isSliding = p.slide > 0, isStunned = p.stun > 0 && !isSliding;
    const isKicking = p.kickAnim > 0, isSaving = p.keeper && (sv > 1.1 || isStunned);
    const cel = M.goalT > 0 && p.team === M.lastScorer ? 1 : 0, jumpY = cel ? -Math.abs(Math.sin(M.goalT * 0.25 + p.x)) * 8.5 : 0;

    // 1. Ombra morbida
    g.fillStyle = "rgba(8,22,42,.42)"; g.beginPath();
    g.ellipse(p.x, p.y + 1.2, isSliding ? 11 : 8.5, isSliding ? 4 : 3.2, 0, 0, Math.PI * 2); g.fill();

    // 2. Anello colorato luminoso per controllabile
    if (p === M.ctl) {
      g.strokeStyle = "#ff3b30"; g.lineWidth = 1.8; g.beginPath(); g.ellipse(p.x, p.y + 1.2, 11, 4.4, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = "rgba(255,225,90,.9)"; g.lineWidth = 0.9; g.beginPath(); g.ellipse(p.x, p.y + 1.2, 9.8, 3.8, 0, 0, Math.PI * 2); g.stroke();
      const arY = p.y - 38 + Math.sin(M.t * 0.18) * 2;
      g.fillStyle = "#ffd23f"; g.strokeStyle = "#1a1202"; g.lineWidth = 1;
      g.beginPath(); g.moveTo(p.x, arY); g.lineTo(p.x - 4.5, arY - 7); g.lineTo(p.x + 4.5, arY - 7); g.closePath(); g.fill(); g.stroke();
    }

    // 3. Pixel art giocatore completo
    g.save(); g.translate(p.x, p.y + jumpY); if (sgn < 0) g.scale(-1, 1);
    const runFrame = isMoving ? (Math.floor(p.run * 1.5) % 4) : 0, bob = isMoving ? (runFrame % 2 === 1 ? 1 : 0) : Math.sin(M.t * 0.1) * 0.5;
    const sw = isMoving ? (runFrame === 0 ? 4 : runFrame === 2 ? -4 : 0) : 0;
    const sk = "#f0be92";

    if (isSliding) {
      g.rotate(0.35); g.strokeStyle = sk; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, -5); g.lineTo(9, -1); g.stroke();
      g.strokeStyle = p.col2; g.lineWidth = 3.2; g.beginPath(); g.moveTo(4, -2.5); g.lineTo(9, -1); g.stroke();
      g.fillStyle = "#111"; g.fillRect(9, -2, 4, 2.5);
      g.fillStyle = p.col2; g.beginPath(); g.roundRect(-6, -9, 9, 6, 1.5); g.fill();
      g.fillStyle = p.col; g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 1; g.beginPath(); g.roundRect(-7, -17, 11, 9, 2.5); g.fill(); g.stroke();
    } else if (isSaving) {
      g.rotate(-0.4); g.strokeStyle = sk; g.lineWidth = 3; g.beginPath(); g.moveTo(-2, -8); g.lineTo(-8, -12); g.stroke();
      g.fillStyle = "#1a1a1a"; g.beginPath(); g.roundRect(-4, -11, 8, 5, 1.5); g.fill();
      g.fillStyle = p.col; g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 1; g.beginPath(); g.roundRect(-5, -19, 10, 9, 2.5); g.fill(); g.stroke();
      g.fillStyle = "#ffe066"; g.fillRect(6, -23, 4.5, 4.5); g.fillRect(10, -22, 4.5, 4.5);
    } else if (isKicking) {
      g.strokeStyle = sk; g.lineWidth = 3; g.beginPath(); g.moveTo(-2.5, -8); g.lineTo(-2, -1); g.stroke();
      g.strokeStyle = p.col2; g.lineWidth = 3.2; g.beginPath(); g.moveTo(-2, -4); g.lineTo(-2, -1); g.stroke(); g.fillStyle = "#111"; g.fillRect(-4, -1.5, 4, 2);
      g.strokeStyle = sk; g.lineWidth = 3.2; g.beginPath(); g.moveTo(2.5, -8); g.lineTo(7, -4); g.stroke();
      g.strokeStyle = p.col2; g.lineWidth = 3.2; g.beginPath(); g.moveTo(4.5, -6); g.lineTo(7, -4); g.stroke(); g.fillStyle = "#111"; g.fillRect(6, -5, 4, 2.5);
      g.fillStyle = p.col2; g.beginPath(); g.roundRect(-5, -11, 10, 5, 1.5); g.fill();
      g.fillStyle = p.col; g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 1; g.beginPath(); g.roundRect(-5.5, -20, 11, 10, 2.5); g.fill(); g.stroke();
      g.fillStyle = "rgba(255,255,255,.9)"; g.font = "bold 6px sans-serif"; g.textAlign = "center"; g.fillText(p.num, 0, -12.5);
    } else {
      g.lineCap = "round"; g.strokeStyle = sk; g.lineWidth = 3; g.beginPath(); g.moveTo(-2.5, -8); g.lineTo(-3 + sw, -1 - bob * 0.2); g.moveTo(2.5, -8); g.lineTo(3 - sw, -1 - bob * 0.2); g.stroke();
      g.strokeStyle = p.col2; g.lineWidth = 3.2; g.beginPath(); g.moveTo(-3 + sw * 0.8, -4); g.lineTo(-3 + sw, -1); g.moveTo(3 - sw * 0.8, -4); g.lineTo(3 - sw, -1); g.stroke();
      g.fillStyle = "#111"; g.fillRect(-5 + sw, -1.6, 4, 2); g.fillRect(1 - sw, -1.6, 4, 2);
      g.fillStyle = p.col2; g.beginPath(); g.roundRect(-5, -11 - bob, 10, 5, 1.5); g.fill();
      g.fillStyle = p.col; g.strokeStyle = "rgba(0,0,0,.6)"; g.lineWidth = 1; g.beginPath(); g.roundRect(-5.5, -20 - bob, 11, 10, 2.5); g.fill(); g.stroke();
      g.fillStyle = "rgba(255,255,255,.85)"; g.font = "bold 6px sans-serif"; g.textAlign = "center"; g.fillText(p.num, 0, -12.6 - bob);
      g.strokeStyle = p.keeper ? "#ffe066" : sk; g.lineWidth = p.keeper ? 3.2 : 2.4; g.beginPath(); g.moveTo(-5.5, -18 - bob); g.lineTo(-8 - sw * 0.5, -12 - bob); g.moveTo(5.5, -18 - bob); g.lineTo(8 + sw * 0.5, -12 - bob); g.stroke();
      if (p.keeper) { g.fillStyle = "#ffe066"; g.fillRect(-10 - sw * 0.5, -13 - bob, 3.5, 3.5); g.fillRect(7 + sw * 0.5, -13 - bob, 3.5, 3.5); }
    }

    // 4. Testa e capigliatura pixel art
    const hy = (isSliding ? -19 : isSaving ? -20 : -27) - bob;
    g.fillStyle = sk; g.beginPath(); g.arc(0, hy, 7.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = p.hairCol || "#2d1d0e";
    g.beginPath(); g.arc(0, hy - 2, 7.5, Math.PI, Math.PI * 2); g.fill();
    g.fillRect(-7.5, hy - 4, 3, 5);
    // Occhi
    g.fillStyle = "#111"; g.fillRect(2, hy - 1, 2, 2);
    // Bordo testa
    g.strokeStyle = p.col; g.lineWidth = 1.4; g.beginPath(); g.arc(0, hy, 7.5, 0, Math.PI * 2); g.stroke();
    g.restore();
  }

  function drawBallHD(g) {
    const b = M.ball, sp = Math.hypot(b.vx, b.vy);
    b.tr.forEach((t, i) => {
      g.fillStyle = b.superTiro ? `rgba(255,${100 + i * 15},30,${i / 10})` : `rgba(255,255,255,${i / 14})`;
      g.beginPath(); g.arc(t[0], t[1], 2 + i * 0.35, 0, Math.PI * 2); g.fill();
    });

    if (b.superTiro) {
      const gr = g.createRadialGradient(b.x, b.y - 2, 1, b.x, b.y - 2, 14);
      gr.addColorStop(0, "#ffd23faa"); gr.addColorStop(1, "#ff336600");
      g.fillStyle = gr; g.beginPath(); g.arc(b.x, b.y - 2, 14, 0, Math.PI * 2); g.fill();
    }

    // Ombra a terra
    g.fillStyle = "rgba(8,22,42,.42)"; g.beginPath();
    g.ellipse(b.x + 1, b.y + 3, Math.max(3, 5.2 - sp * 0.08), Math.max(1.6, 2.5 - sp * 0.04), 0, 0, Math.PI * 2); g.fill();

    // Sfera Telstar bianca
    g.fillStyle = b.superTiro ? "#ffdd55" : "#ffffff";
    g.strokeStyle = "#101820"; g.lineWidth = 1.1;
    g.beginPath(); g.arc(b.x, b.y - 2, 4.5, 0, Math.PI * 2); g.fill(); g.stroke();

    // Pentagoli neri rotanti
    g.fillStyle = "#111822";
    for (let i = 0; i < 3; i++) {
      const a = b.rot + i * 2.094;
      g.beginPath(); g.arc(b.x + Math.cos(a) * 2.2, b.y - 2 + Math.sin(a) * 2.2, 1.1, 0, Math.PI * 2); g.fill();
    }
  }

  function initMatch() {
    const state = S.load();
    const teamCards = (state.team || []).map((id) => state.cards[id] || { name: "Eroe", role: "A", shoot: 70, speed: 75 });

    const pMine = [
      { id: "p0_gk", name: teamCards[0]?.name || "Dino Guardiano", role: "P", team: 0, x: 22, y: CY, vx: 0, vy: 0, fx: 1, fy: 0, home: [22, CY], keeper: true, shoot: 40, speed: 70, num: 1, col: "#00e5ff", col2: "#072b4a", hairCol: "#1e293b", run: 0, slide: 0, stun: 0, kickAnim: 0 },
      { id: "p1_def", name: teamCards[1]?.name || "Marco Muro", role: "D", team: 0, x: 80, y: CY - 30, vx: 0, vy: 0, fx: 1, fy: 0, home: [80, CY - 25], keeper: false, shoot: 65, speed: 80, num: 4, col: "#00e5ff", col2: "#072b4a", hairCol: "#451a03", run: 0, slide: 0, stun: 0, kickAnim: 0 },
      { id: "p2_att", name: teamCards[4]?.name || teamCards[2]?.name || "Leo Lampo", role: "A", team: 0, x: 130, y: CY + 15, vx: 0, vy: 0, fx: 1, fy: 0, home: [130, CY + 15], keeper: false, shoot: 88, speed: 86, num: 10, col: "#00e5ff", col2: "#072b4a", hairCol: "#78350f", run: 0, slide: 0, stun: 0, kickAnim: 0 }
    ];

    const pFoes = [
      { id: "f0_gk", name: "Rival Guardiano", role: "P", team: 1, x: W - 22, y: CY, vx: 0, vy: 0, fx: -1, fy: 0, home: [W - 22, CY], keeper: true, shoot: 40, speed: 70, num: 1, col: "#ff3366", col2: "#3b0714", hairCol: "#111", run: 0, slide: 0, stun: 0, kickAnim: 0 },
      { id: "f1_def", name: "Rival Roccia", role: "D", team: 1, x: W - 80, y: CY + 30, vx: 0, vy: 0, fx: -1, fy: 0, home: [W - 80, CY + 25], keeper: false, shoot: 60, speed: 75, num: 3, col: "#ff3366", col2: "#3b0714", hairCol: "#2d153b", run: 0, slide: 0, stun: 0, kickAnim: 0 },
      { id: "f2_att", name: "Rival Saetta", role: "A", team: 1, x: W - 130, y: CY - 15, vx: 0, vy: 0, fx: -1, fy: 0, home: [W - 130, CY - 15], keeper: false, shoot: 82, speed: 82, num: 9, col: "#ff3366", col2: "#3b0714", hairCol: "#0f2c42", run: 0, slide: 0, stun: 0, kickAnim: 0 }
    ];

    M = {
      p: pMine,
      q: pFoes,
      all: pMine.concat(pFoes),
      ball: { x: W / 2, y: CY, vx: 0, vy: 0, owner: null, rot: 0, tr: [], superTiro: false, cool: 0 },
      score: [0, 0],
      t: 0,
      over: false,
      ctl: pMine[2],
      cam: 0,
      vw: 390,
      shake: 0,
      goalT: 0,
      scorer: null,
      lastScorer: 0,
      energy: [50, 50]
    };

    A.whistle(true);
  }

  function doShoot(p, isSuper = false) {
    if (!p) return;
    const b = M.ball;
    const distToBall = Math.hypot(p.x - b.x, p.y - b.y);

    // Se non ha la palla ma è vicino (< 35px), aggancia e tira!
    if (b.owner !== p && distToBall < 35 && (!b.owner || b.owner.team !== p.team)) {
      b.owner = p;
    }

    // Se un avversario ha la palla, esegui tackle/scivolata
    if (b.owner && b.owner.team !== p.team) {
      doTackle(p);
      return;
    }

    if (b.owner !== p && distToBall >= 35) {
      // Scivolata disperata verso la palla
      doSlide(p);
      return;
    }

    // Esegui tiro in porta
    b.owner = null;
    b.cool = 15;
    p.kickAnim = 16;

    const targetX = p.team === 0 ? W : 0;
    const targetY = CY + (Math.random() - 0.5) * 28;
    const dx = targetX - p.x, dy = targetY - p.y;
    const l = Math.hypot(dx, dy) || 1;
    const power = (p.shoot / 100) * (isSuper ? 8.2 : 5.2);

    b.vx = (dx / l) * power;
    b.vy = (dy / l) * power;
    b.superTiro = isSuper;

    if (isSuper) {
      M.shake = 16;
      A.kick(2.2);
    } else {
      A.kick(1.2);
    }
  }

  function doPass(p) {
    if (!p) return;
    const b = M.ball;
    const distToBall = Math.hypot(p.x - b.x, p.y - b.y);

    if (b.owner !== p && distToBall < 30) b.owner = p;
    if (b.owner !== p) {
      doSlide(p);
      return;
    }

    const mates = p.team === 0 ? M.p.filter((m) => m !== p && !m.keeper) : M.q.filter((m) => m !== p && !m.keeper);
    const target = mates[0];
    if (!target) return;

    b.owner = null;
    b.cool = 14;
    p.kickAnim = 12;

    const dx = target.x - p.x, dy = target.y - p.y;
    const l = Math.hypot(dx, dy) || 1;
    b.vx = (dx / l) * 4.4;
    b.vy = (dy / l) * 4.4;
    b.superTiro = false;

    if (p.team === 0) M.ctl = target;
    A.kick(0.85);
  }

  function doSlide(p) {
    if (p.slide > 0 || p.stun > 0) return;
    p.slide = 18;
    p.vx = p.fx * 3.8;
    p.vy = p.fy * 3.8;
  }

  function doTackle(p) {
    const b = M.ball, o = b.owner;
    if (!o || o.team === p.team) return;
    const d = Math.hypot(p.x - o.x, p.y - o.y);
    if (d < 30) {
      // Ruba palla
      b.owner = p;
      p.hold = 0;
      o.stun = 24;
      A.kick(1.0);
    } else {
      doSlide(p);
    }
  }

  function doSuper(p) {
    if (!p) return;
    doShoot(p, true);
  }

  function update() {
    if (!M || M.over) return;
    M.t++;

    if (M.t >= DUR) {
      endMatch();
      return;
    }

    const b = M.ball;
    if (b.cool > 0) b.cool--;

    // Controllo giocatore umano
    const ctl = M.ctl;
    if (ctl && !M.goalT) {
      let dx = 0, dy = 0;
      if (stick.active) {
        dx = stick.x; dy = stick.y;
      }
      if (inp.l) dx -= 1;
      if (inp.r) dx += 1;
      if (inp.u) dy -= 1;
      if (inp.d) dy += 1;

      const len = Math.hypot(dx, dy);
      if (len > 0.1) {
        const sp = (ctl.speed / 100) * (inp.sprint ? 2.4 : 1.85);
        ctl.vx = (dx / len) * sp;
        ctl.vy = (dy / len) * sp;
        ctl.fx = dx / len;
        ctl.fy = dy / len;
        ctl.run += 0.25;
      } else {
        ctl.vx *= 0.75;
        ctl.vy *= 0.75;
      }
    }

    // AI per tutti gli altri
    M.all.forEach((p) => {
      if (p.slide > 0) { p.slide--; p.vx *= 0.94; p.vy *= 0.94; return; }
      if (p.stun > 0) { p.stun--; p.vx *= 0.7; p.vy *= 0.7; return; }
      if (p.kickAnim > 0) p.kickAnim--;

      if (p === M.ctl && !M.goalT) return;

      const isOwner = b.owner === p;
      let tx, ty;

      if (p.keeper) {
        tx = p.home[0];
        ty = Math.max(GY0 + 5, Math.min(GY1 - 5, b.y));
      } else if (isOwner) {
        tx = p.team === 0 ? W - 15 : 15;
        ty = b.y;
        if (p.team === 1 && p.x < 110) doShoot(p, false);
      } else {
        tx = p.home[0] + (b.x - W / 2) * 0.4;
        ty = p.home[1] + (b.y - CY) * 0.4;
      }

      const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
      if (d > 4) {
        const sp = (p.speed / 100) * 1.35;
        p.vx = (dx / d) * sp;
        p.vy = (dy / d) * sp;
        p.fx = dx / d;
        p.fy = dy / d;
        p.run += 0.2;
      } else {
        p.vx *= 0.75;
        p.vy *= 0.75;
      }
    });

    // Movimento e limiti
    M.all.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.x = Math.max(10, Math.min(W - 10, p.x));
      p.y = Math.max(TOP + 6, Math.min(BOT - 6, p.y));

      // Raccogli palla se libera
      if (!b.owner && b.cool === 0 && Math.hypot(p.x - b.x, p.y - b.y) < 14 && !M.goalT) {
        b.owner = p;
        if (p.team === 0) M.ctl = p;
      }
    });

    // Palla
    if (b.owner) {
      const p = b.owner;
      b.x = p.x + (p.fx >= 0 ? 8 : -8);
      b.y = p.y + 3;
      b.vx = p.vx;
      b.vy = p.vy;
      b.superTiro = false;
    } else {
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.985;
      b.vy *= 0.985;
      b.rot += Math.hypot(b.vx, b.vy) * 0.1;

      b.tr.push([b.x, b.y]);
      if (b.tr.length > 10) b.tr.shift();

      // Rimbalzo sponde
      if (b.y < TOP + 4) { b.y = TOP + 4; b.vy = -b.vy * 0.8; A.post(); }
      if (b.y > BOT - 4) { b.y = BOT - 4; b.vy = -b.vy * 0.8; A.post(); }

      // Gol o palo
      if (b.x < 4) {
        if (b.y > GY0 && b.y < GY1) handleGoal(1);
        else { b.x = 4; b.vx = -b.vx * 0.8; A.post(); }
      } else if (b.x > W - 4) {
        if (b.y > GY0 && b.y < GY1) handleGoal(0);
        else { b.x = W - 4; b.vx = -b.vx * 0.8; A.post(); }
      }
    }

    if (M.goalT > 0) {
      M.goalT--;
      if (M.goalT === 0) resetKickoff();
    }
  }

  function handleGoal(team) {
    if (M.goalT > 0) return;
    M.score[team]++;
    M.goalT = 120;
    M.lastScorer = team;
    M.shake = 18;
    A.goal();
  }

  function resetKickoff() {
    const b = M.ball;
    b.x = W / 2; b.y = CY; b.vx = 0; b.vy = 0; b.owner = null; b.tr = [];
    M.all.forEach((p) => {
      p.x = p.home[0]; p.y = p.home[1]; p.vx = 0; p.vy = 0;
      p.slide = 0; p.stun = 0; p.kickAnim = 0;
    });
    A.whistle(false);
  }

  function endMatch() {
    M.over = true;
    A.whistle(true);

    const win = M.score[0] > M.score[1];
    const draw = M.score[0] === M.score[1];
    const coinsEarned = (win ? 50 : (draw ? 25 : 15)) + M.score[0] * 10;

    const state = S.load();
    state.coins = (state.coins || 0) + coinsEarned;
    state.stats.matches = (state.stats.matches || 0) + 1;
    if (win) state.stats.wins = (state.stats.wins || 0) + 1;
    state.stats.goalsScored = (state.stats.goalsScored || 0) + M.score[0];
    state.stats.goalsConceded = (state.stats.goalsConceded || 0) + M.score[1];
    S.save(state);

    if (window.PCA_App) window.PCA_App.updateUI();

    const banner = document.getElementById("cutin-modal");
    if (!banner) return;
    document.getElementById("cutin-title").textContent = win ? "🎉 VITTORIA!" : (draw ? "🤝 PAREGGIO" : "💔 SCONFITTA");
    document.getElementById("cutin-subtitle").textContent = `FINALE: ${M.score[0]} - ${M.score[1]}`;
    document.getElementById("cutin-desc").textContent = `Hai guadagnato 🪙 ${coinsEarned} monete per aver giocato!`;
    banner.classList.add("show");

    document.getElementById("cutin-btn-ok").onclick = () => {
      banner.classList.remove("show");
      if (window.PCA_App) window.PCA_App.switchScreen("menu");
    };
  }

  function render() {
    if (!ctx || !canvas) return;

    if (!STATIC_HD) {
      STATIC_HD = buildStaticHD();
      CROWD_HD = buildCrowdHD();
    }

    const vw = canvas.width, vh = canvas.height;
    ctx.clearRect(0, 0, vw, vh);

    const scale = Math.min(vw / CW, vh / CH);
    ctx.save();
    ctx.scale(scale, scale);

    const sh = M && M.shake > 0 ? (Math.random() - 0.5) * M.shake : 0;
    if (M && M.shake > 0) M.shake *= 0.88;

    // 1. Spalti e campo HD
    ctx.drawImage(STATIC_HD, 0, 0, CW * SS, CH * SS, sh, sh * 0.5, CW, CH);

    // 2. Pubblico animato
    if (CROWD_HD && M) {
      const cf = ((Math.floor(M.t / 10) % 4) + 4) % 4;
      ctx.drawImage(CROWD_HD[cf], 0, 0, CW * SS, OY * SS, sh, sh * 0.5, CW, OY);
    }

    // 3. Tabellone LED dinamico in tribuna
    if (M) {
      const rem = Math.max(0, Math.ceil((DUR - M.t) / 60));
      const min = String(Math.floor(rem / 60)).padStart(2, "0"), sec = String(rem % 60).padStart(2, "0");
      ctx.fillStyle = "#ffb020"; ctx.font = "900 5px monospace"; ctx.textAlign = "left";
      ctx.fillText(`${min}:${sec}`, 30, 14.5);
      ctx.fillStyle = "#ffd23f"; ctx.textAlign = "center";
      ctx.fillText("HD", 62, 14.5);
      ctx.fillStyle = "#ff4433"; ctx.textAlign = "right";
      ctx.fillText(`${M.score[0]}-${M.score[1]}`, 94, 14.5);
    }

    // 4. Giocatori e palla sul campo a 3/4
    ctx.save();
    ctx.translate(MX + sh, OY + sh * 0.5);

    if (M) {
      // Ordina giocatori per Y per corretta profondità isometrica
      M.all.slice().sort((a, b) => a.y - b.y).forEach((p) => figHD(ctx, p));
      drawBallHD(ctx);

      // Traiettoria di mira tiro caricato
      if (inp.shootHeld > 0 && M.ctl && M.ball.owner === M.ctl) {
        const c = M.ctl;
        const f = Math.min(1, inp.shootHeld / 35);
        ctx.strokeStyle = `rgba(255, ${Math.round(220 - 150 * f)}, 40, .85)`;
        ctx.lineWidth = 1.5; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(c.x, c.y - 4); ctx.lineTo(W, CY); ctx.stroke(); ctx.setLineDash([]);

        ctx.fillStyle = "#000a"; ctx.fillRect(c.x - 14, c.y + 8, 28, 5);
        ctx.fillStyle = f >= 0.8 ? "#ff3366" : "#ffd23f";
        ctx.fillRect(c.x - 13, c.y + 9, 26 * f, 3);
      }
    }

    ctx.restore();

    // 5. Scoreboard HUD centrale
    if (M) {
      const cx = CW / 2;
      ctx.fillStyle = "rgba(10,19,32,0.85)"; ctx.beginPath();
      ctx.roundRect(cx - 70, 4, 140, 20, 6); ctx.fill();
      ctx.strokeStyle = "rgba(255,215,0,0.5)"; ctx.lineWidth = 1; ctx.stroke();

      ctx.fillStyle = "#00e5ff"; ctx.font = "900 11px sans-serif"; ctx.textAlign = "right";
      ctx.fillText("TU", cx - 24, 18);

      ctx.fillStyle = "#ff3366"; ctx.textAlign = "left";
      ctx.fillText("RIVALI", cx + 24, 18);

      ctx.fillStyle = "#fff"; ctx.font = "900 14px monospace"; ctx.textAlign = "center";
      ctx.fillText(`${M.score[0]} - ${M.score[1]}`, cx, 19);

      if (M.goalT > 0) {
        ctx.fillStyle = "#000a"; ctx.fillRect(0, CH / 2 - 25, CW, 50);
        ctx.fillStyle = "#ffd23f"; ctx.font = "900 28px sans-serif"; ctx.textAlign = "center";
        ctx.fillText("GOOOOL!", cx, CH / 2 + 10);
      }
    }

    ctx.restore();

    if (active) {
      update();
      rafId = requestAnimationFrame(render);
    }
  }

  function setupControls() {
    // 1. Tasti a schermo (Pointerdown per touch E mouse!)
    const bindBtn = (sel, onDown, onUp) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const down = (e) => { e.preventDefault(); el.classList.add("on"); onDown(); };
      const up = (e) => { e.preventDefault(); el.classList.remove("on"); onUp(); };
      el.addEventListener("pointerdown", down);
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
    };

    bindBtn('.btn-ctrl[data-act="shoot"]', () => {
      inp.isCharging = true;
      inp.shootHeld = 1;
    }, () => {
      if (inp.isCharging) {
        if (M && M.ctl) doShoot(M.ctl, inp.shootHeld > 25);
        inp.isCharging = false;
        inp.shootHeld = 0;
      }
    });

    bindBtn('.btn-ctrl[data-act="pass"]', () => {
      if (M && M.ctl) doPass(M.ctl);
    }, () => {});

    bindBtn('.btn-ctrl[data-act="sprint"]', () => {
      inp.sprint = true;
    }, () => {
      inp.sprint = false;
    });

    bindBtn('.btn-ctrl[data-act="super"]', () => {
      if (M && M.ctl) doSuper(M.ctl);
    }, () => {});

    // Loop timer carica tiro
    setInterval(() => {
      if (inp.isCharging) inp.shootHeld++;
    }, 20);

    // 2. Stick Virtuale Touch / Mouse
    const stickZone = document.getElementById("touch-stick-zone");
    const stickKnob = document.getElementById("touch-stick-knob");

    if (stickZone && stickKnob) {
      const handleStickMove = (clientX, clientY) => {
        const rect = stickZone.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = clientX - centerX;
        const dy = clientY - centerY;
        const d = Math.hypot(dx, dy) || 1;
        const maxR = 36;
        const clamped = Math.min(d, maxR);
        stick.x = (dx / d) * (clamped / maxR);
        stick.y = (dy / d) * (clamped / maxR);

        stickKnob.style.transform = `translate(calc(-50% + ${stick.x * 24}px), calc(-50% + ${stick.y * 24}px))`;
      };

      const resetStick = () => {
        stick.active = false;
        stick.x = 0; stick.y = 0;
        stickKnob.style.transform = "translate(-50%, -50%)";
      };

      stickZone.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        stick.active = true;
        handleStickMove(e.clientX, e.clientY);
      });

      window.addEventListener("pointermove", (e) => {
        if (stick.active) handleStickMove(e.clientX, e.clientY);
      });

      window.addEventListener("pointerup", resetStick);
      window.addEventListener("pointercancel", resetStick);
    }

    // 3. Tastiera
    window.addEventListener("keydown", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") inp.l = 1;
      if (e.code === "ArrowRight" || e.code === "KeyD") inp.r = 1;
      if (e.code === "ArrowUp" || e.code === "KeyW") inp.u = 1;
      if (e.code === "ArrowDown" || e.code === "KeyS") inp.d = 1;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") inp.sprint = true;
      if ((e.code === "Space" || e.code === "KeyK") && !inp.isCharging) {
        inp.isCharging = true;
        inp.shootHeld = 1;
      }
      if (e.code === "KeyJ") {
        if (M && M.ctl) doPass(M.ctl);
      }
      if (e.code === "KeyL") {
        if (M && M.ctl) doSuper(M.ctl);
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "ArrowLeft" || e.code === "KeyA") inp.l = 0;
      if (e.code === "ArrowRight" || e.code === "KeyD") inp.r = 0;
      if (e.code === "ArrowUp" || e.code === "KeyW") inp.u = 0;
      if (e.code === "ArrowDown" || e.code === "KeyS") inp.d = 0;
      if (e.code === "ShiftLeft" || e.code === "ShiftRight") inp.sprint = false;
      if (e.code === "Space" || e.code === "KeyK") {
        if (inp.isCharging) {
          if (M && M.ctl) doShoot(M.ctl, inp.shootHeld > 25);
          inp.isCharging = false;
          inp.shootHeld = 0;
        }
      }
    });
  }

  function resizeCanvas() {
    if (!canvas) return;
    const stage = document.querySelector(".match-stage");
    if (!stage) return;
    canvas.width = stage.clientWidth || 390;
    canvas.height = stage.clientHeight || 280;
  }

  const Calcetto = {
    start() {
      canvas = document.getElementById("match-canvas");
      if (!canvas) return;
      ctx = canvas.getContext("2d");
      resizeCanvas();
      setupControls();
      initMatch();
      active = true;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(render);
    },

    pause() {
      active = false;
      cancelAnimationFrame(rafId);
    },

    getMatch() {
      return M;
    },

    shoot(p, isSuper) {
      doShoot(p || (M && M.ctl), isSuper);
    },

    pass(p) {
      doPass(p || (M && M.ctl));
    }
  };

  window.addEventListener("resize", resizeCanvas);
  global.PCA_Match = Calcetto;
})(window);
