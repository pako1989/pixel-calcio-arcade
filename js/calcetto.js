// Pixel Calcio Arcade - Motore di Partita Calcetto 3v3 con Visuale Stadio HD a 3/4
(function (global) {
  const S = window.PCA_Storage;
  const A = window.PCA_Audio;

  const W = 320, H = 180, TOP = 16, BOT = H - 16, CY = H / 2;
  const GY0 = CY - 24, GY1 = CY + 24, MX = 32, CW = W + MX * 2, OY = 32, CH = H + OY + 16, SS = 2;
  const DUR = 3600; // 60 secondi a 60fps

  let canvas = null, ctx = null, rafId = 0, match = null, active = false;
  let STATIC_HD = null, CROWD_HD = null;

  // Touch / Input tracking
  const input = {
    stick: { active: false, x: 0, y: 0, startX: 0, startY: 0, curX: 0, curY: 0 },
    keys: {},
    shootHold: 0,
    isShooting: false,
    buttons: { shoot: false, pass: false, slide: false }
  };

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

    // 1. Spalti e gradinate superiori
    g.fillStyle = "#182333"; g.fillRect(0, 0, CW, OY);
    g.fillStyle = "#223147";
    for (let y = 0; y < OY; y += 7) g.fillRect(0, y, CW, 2.5);
    g.fillStyle = "#111a26";
    for (let x = 0; x < CW; x += 18) g.fillRect(x, 0, 1.5, OY);

    // Ringhiera e recinzione a rete verde
    g.fillStyle = "#27ae60"; g.fillRect(0, OY - 7, CW, 7);
    g.fillStyle = "rgba(10,30,20,.6)";
    for (let x = 0; x < CW; x += 3) for (let y = OY - 7; y < OY; y += 3) g.fillRect(x, y, 1.2, 1.2);
    g.fillStyle = "#3e4f63"; g.fillRect(0, OY - 1, CW, 1.5);

    // 2. Campo da gioco (Manto sintetico blu consumato)
    g.save(); g.translate(MX, OY);
    const grField = g.createLinearGradient(0, 0, 0, H);
    grField.addColorStop(0, "#194475"); grField.addColorStop(0.5, "#225b96"); grField.addColorStop(1, "#194475");
    g.fillStyle = grField; g.fillRect(0, 0, W, H);

    // Sponda superiore arancione in legno
    g.fillStyle = "#d46422"; g.fillRect(-MX, 0, CW, 3.5);
    g.fillStyle = "#f58238"; g.fillRect(-MX, 3, CW, 1);
    for (let x = -MX; x < W + MX; x += 16) { g.fillStyle = "#7a2a06"; g.fillRect(x, 0, 1.2, 4); }

    // Dettagli erba e usura
    const r = seeded(1234);
    for (let i = 0; i < 400; i++) {
      const rx = r() * W, ry = r() * H;
      g.fillStyle = r() < 0.5 ? "rgba(255,255,255,.05)" : "rgba(0,0,0,.08)";
      g.fillRect(rx, ry, 2, 1.5);
    }

    // Linee di gioco bianche
    g.strokeStyle = "rgba(255,255,255,.9)"; g.lineWidth = 1.8;
    g.strokeRect(2, TOP, W - 4, BOT - TOP);
    g.beginPath(); g.moveTo(W / 2, TOP); g.lineTo(W / 2, BOT); g.stroke();
    g.beginPath(); g.arc(W / 2, CY, 24, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#fff"; g.beginPath(); g.arc(W / 2, CY, 2, 0, Math.PI * 2); g.fill();

    // Aree di rigore
    g.strokeRect(2, CY - 30, 36, 60);
    g.strokeRect(W - 38, CY - 30, 36, 60);

    // Porte con rete 3D
    const goal3D = (gx0, isRight) => {
      const gw = MX - 4;
      g.fillStyle = "rgba(10,20,35,.8)"; g.fillRect(gx0, GY0, gw, GY1 - GY0);
      g.strokeStyle = "rgba(255,255,255,.5)"; g.lineWidth = 0.7;
      for (let y = GY0; y <= GY1; y += 4) {
        g.beginPath(); g.moveTo(gx0, y); g.lineTo(gx0 + gw, y); g.stroke();
      }
      for (let x = gx0; x <= gx0 + gw; x += 4) {
        g.beginPath(); g.moveTo(x, GY0); g.lineTo(x, GY1); g.stroke();
      }
      g.fillStyle = "#fff";
      g.fillRect(isRight ? W - 1 : 0, GY0 - 2, 2, GY1 - GY0 + 4);
      g.fillRect(gx0, GY0 - 2, gw, 2);
      g.fillRect(gx0, GY1, gw, 2);
    };
    goal3D(-MX + 4, false);
    goal3D(W, true);

    // Sponda inferiore arancione
    g.fillStyle = "#9e380a"; g.fillRect(-MX, H - 3, CW, 4);
    g.fillStyle = "#f58238"; g.fillRect(-MX, H - 3, CW, 1);
    g.restore();

    // 3. Tabellone MATCH BOARD in tribuna
    const tbx = 20, tby = 3, tbw = 74, tbh = 18;
    g.fillStyle = "#63381a"; g.fillRect(tbx, tby, tbw, tbh);
    g.strokeStyle = "#ffd700"; g.lineWidth = 1; g.strokeRect(tbx, tby, tbw, tbh);
    g.fillStyle = "#f5d061"; g.font = "900 5px monospace"; g.textAlign = "center";
    g.fillText("★ PIXEL CALCIO BOARD ★", tbx + tbw / 2, tby + 5.5);
    g.fillStyle = "#0c131a"; g.fillRect(tbx + 4, tby + 7, tbw - 8, tbh - 9);

    c._w = W;
    return c;
  }

  function buildCrowdHD() {
    const frames = [0, 1, 2, 3].map(() => {
      const c = document.createElement("canvas");
      c.width = CW * SS; c.height = OY * SS;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = false;
      g.scale(SS, SS);
      return { c, g };
    });

    const shirtCols = ["#e74c3c", "#f39c12", "#27ae60", "#8e44ad", "#2980b9", "#fff"];
    const r = seeded(88);
    const spectators = [];
    for (let x = 10; x < CW - 10; x += 9) {
      spectators.push({ x, y: 12, col: shirtCols[Math.floor(r() * shirtCols.length)], offset: r() });
    }

    frames.forEach(({ g }, f) => {
      spectators.forEach((s) => {
        const bob = (f % 2 === 1) ? -1 : 0;
        // Corpo spettatore
        g.fillStyle = s.col; g.fillRect(s.x - 2, s.y + bob, 4, 5);
        // Testa spettatore
        g.fillStyle = "#f0be92"; g.fillRect(s.x - 1.5, s.y - 3 + bob, 3, 3);
        // Braccia che esultano a frame alterni
        if (f === 1 || f === 2) {
          g.fillStyle = s.col;
          g.fillRect(s.x - 3.5, s.y - 2 + bob, 1.5, 3);
          g.fillRect(s.x + 2, s.y - 2 + bob, 1.5, 3);
        }
      });
    });

    return frames.map((x) => x.c);
  }

  function initMatch() {
    const state = S.load();
    const teamCards = (state.team || []).map((id) => state.cards[id] || { name: "Eroe", role: "A", shoot: 70, speed: 70 });

    // 3v3 match: 1 GK + 1 DEF + 1 ATT
    const pMine = [
      { id: "p0_gk", name: teamCards[0]?.name || "Portiere", role: "P", team: 0, x: 20, y: CY, vx: 0, vy: 0, home: [20, CY], keeper: true, shoot: 40, speed: 65, num: 1, col: "#00e5ff", col2: "#0a1f38" },
      { id: "p1_def", name: teamCards[1]?.name || "Difensore", role: "D", team: 0, x: 70, y: CY - 30, vx: 0, vy: 0, home: [70, CY - 25], keeper: false, shoot: 60, speed: 75, num: 4, col: "#00e5ff", col2: "#0a1f38" },
      { id: "p2_att", name: teamCards[4]?.name || teamCards[2]?.name || "Attaccante", role: "A", team: 0, x: 120, y: CY + 20, vx: 0, vy: 0, home: [120, CY + 20], keeper: false, shoot: 85, speed: 82, num: 10, col: "#00e5ff", col2: "#0a1f38" }
    ];

    const pFoes = [
      { id: "f0_gk", name: "Rival Guardiano", role: "P", team: 1, x: W - 20, y: CY, vx: 0, vy: 0, home: [W - 20, CY], keeper: true, shoot: 40, speed: 65, num: 1, col: "#ff3366", col2: "#2d0812" },
      { id: "f1_def", name: "Rival Roccia", role: "D", team: 1, x: W - 70, y: CY + 30, vx: 0, vy: 0, home: [W - 70, CY + 25], keeper: false, shoot: 55, speed: 70, num: 3, col: "#ff3366", col2: "#2d0812" },
      { id: "f2_att", name: "Rival Fulmine", role: "A", team: 1, x: W - 120, y: CY - 20, vx: 0, vy: 0, home: [W - 120, CY - 20], keeper: false, shoot: 80, speed: 78, num: 9, col: "#ff3366", col2: "#2d0812" }
    ];

    match = {
      p: pMine,
      q: pFoes,
      all: pMine.concat(pFoes),
      ball: { x: W / 2, y: CY, vx: 0, vy: 0, owner: null, rot: 0, trail: [], superTiro: false },
      score: [0, 0],
      t: 0,
      over: false,
      ctl: pMine[2], // Inizia controllando l'attaccante
      cam: 0,
      shake: 0,
      goalCelebration: 0
    };

    A.whistle(true);
  }

  function updatePhysics() {
    if (!match || match.over) return;
    match.t++;

    const b = match.ball;

    // Timer scadenza
    if (match.t >= DUR) {
      endMatch();
      return;
    }

    // Input utente per il giocatore controllato
    const ctl = match.ctl;
    if (ctl && !match.goalCelebration) {
      let dx = 0, dy = 0;
      if (input.stick.active) {
        dx = input.stick.x;
        dy = input.stick.y;
      }
      if (input.keys["ArrowLeft"] || input.keys["KeyA"]) dx -= 1;
      if (input.keys["ArrowRight"] || input.keys["KeyD"]) dx += 1;
      if (input.keys["ArrowUp"] || input.keys["KeyW"]) dy -= 1;
      if (input.keys["ArrowDown"] || input.keys["KeyS"]) dy += 1;

      const len = Math.hypot(dx, dy);
      if (len > 0.1) {
        const sp = (ctl.speed / 100) * 1.8;
        ctl.vx = (dx / len) * sp;
        ctl.vy = (dy / len) * sp;
      } else {
        ctl.vx *= 0.8;
        ctl.vy *= 0.8;
      }
    }

    // AI semplice per compagni e avversari
    match.all.forEach((p) => {
      if (p === match.ctl && !match.goalCelebration) return;

      const tx = p.keeper ? p.home[0] : (b.owner === p ? (p.team === 0 ? W - 10 : 10) : (p.team === 0 ? b.x - 30 : b.x + 30));
      const ty = p.keeper ? Math.max(GY0 + 6, Math.min(GY1 - 6, b.y)) : (b.y + (p.home[1] - CY) * 0.4);

      const ddx = tx - p.x, ddy = ty - p.y;
      const d = Math.hypot(ddx, ddy);
      if (d > 4) {
        const sp = (p.speed / 100) * 1.3;
        p.vx = (ddx / d) * sp;
        p.vy = (ddy / d) * sp;
      } else {
        p.vx *= 0.7;
        p.vy *= 0.7;
      }

      // Se l'AI avversaria ha palla vicino all'area, tira
      if (p.team === 1 && b.owner === p && p.x < 100) {
        shoot(p, false);
      }
    });

    // Aggiornamento posizioni giocatori e collisioni
    match.all.forEach((p) => {
      p.x += p.vx;
      p.y += p.vy;

      // Limiti campo
      p.x = Math.max(10, Math.min(W - 10, p.x));
      p.y = Math.max(TOP + 6, Math.min(BOT - 6, p.y));

      // Raccogli palla se vicina e libera
      if (!b.owner && Math.hypot(p.x - b.x, p.y - b.y) < 12 && !match.goalCelebration) {
        b.owner = p;
        if (p.team === 0) match.ctl = p;
      }
    });

    // Palla
    if (b.owner) {
      const p = b.owner;
      b.x = p.x + (p.team === 0 ? 8 : -8);
      b.y = p.y + 4;
      b.vx = p.vx;
      b.vy = p.vy;
      b.superTiro = false;
    } else {
      b.x += b.vx;
      b.y += b.vy;
      b.vx *= 0.985;
      b.vy *= 0.985;
      b.rot += (Math.hypot(b.vx, b.vy) * 0.1);

      // Scia della palla
      b.trail.push([b.x, b.y]);
      if (b.trail.length > 8) b.trail.shift();

      // Rimbalzo sponde
      if (b.y < TOP + 3) { b.y = TOP + 3; b.vy = -b.vy * 0.8; A.post(); }
      if (b.y > BOT - 3) { b.y = BOT - 3; b.vy = -b.vy * 0.8; A.post(); }

      // Palo e linea di porta
      if (b.x < 4) {
        if (b.y > GY0 && b.y < GY1) {
          handleGoal(1); // Gol avversari
        } else {
          b.x = 4; b.vx = -b.vx * 0.8; A.post();
        }
      } else if (b.x > W - 4) {
        if (b.y > GY0 && b.y < GY1) {
          handleGoal(0); // Gol nostro!
        } else {
          b.x = W - 4; b.vx = -b.vx * 0.8; A.post();
        }
      }
    }

    // Gestione esultanza gol
    if (match.goalCelebration > 0) {
      match.goalCelebration--;
      if (match.goalCelebration === 0) resetKickoff();
    }

    // Telecamera segue palla
    const targetCam = Math.max(-MX, Math.min(W + MX - 390, b.x - 195));
    match.cam += (targetCam - match.cam) * 0.1;
  }

  function shoot(p, isSuper = false) {
    const b = match.ball;
    if (b.owner !== p) return;
    b.owner = null;

    const targetX = p.team === 0 ? W : 0;
    const targetY = CY + (Math.random() - 0.5) * 20;
    const dx = targetX - p.x, dy = targetY - p.y;
    const d = Math.hypot(dx, dy) || 1;
    const power = (p.shoot / 100) * (isSuper ? 7.5 : 4.5);

    b.vx = (dx / d) * power;
    b.vy = (dy / d) * power;
    b.superTiro = isSuper;

    if (isSuper) {
      match.shake = 12;
      A.kick(2.0);
    } else {
      A.kick(1.0);
    }
  }

  function pass(p) {
    const b = match.ball;
    if (b.owner !== p) return;

    // Trova compagno migliore
    const mates = p.team === 0 ? match.p.filter((m) => m !== p && !m.keeper) : match.q.filter((m) => m !== p && !m.keeper);
    const mate = mates[0];
    if (!mate) return;

    b.owner = null;
    const dx = mate.x - p.x, dy = mate.y - p.y;
    const d = Math.hypot(dx, dy) || 1;
    b.vx = (dx / d) * 3.8;
    b.vy = (dy / d) * 3.8;
    b.superTiro = false;

    if (p.team === 0) match.ctl = mate;
    A.kick(0.8);
  }

  function handleGoal(team) {
    if (match.goalCelebration > 0) return;
    match.score[team]++;
    match.goalCelebration = 120; // 2 secondi
    match.shake = 16;
    A.goal();
  }

  function resetKickoff() {
    const b = match.ball;
    b.x = W / 2; b.y = CY; b.vx = 0; b.vy = 0; b.owner = null; b.trail = [];
    match.all.forEach((p) => {
      p.x = p.home[0];
      p.y = p.home[1];
      p.vx = 0;
      p.vy = 0;
    });
    A.whistle(false);
  }

  function endMatch() {
    match.over = true;
    A.whistle(true);

    const win = match.score[0] > match.score[1];
    const draw = match.score[0] === match.score[1];
    const coinsEarned = (win ? 50 : (draw ? 25 : 15)) + match.score[0] * 10;

    // Salva ricompensa
    const state = S.load();
    state.coins = (state.coins || 0) + coinsEarned;
    state.stats.matches = (state.stats.matches || 0) + 1;
    if (win) state.stats.wins = (state.stats.wins || 0) + 1;
    state.stats.goalsScored = (state.stats.goalsScored || 0) + match.score[0];
    state.stats.goalsConceded = (state.stats.goalsConceded || 0) + match.score[1];
    S.save(state);

    if (window.PCA_App) window.PCA_App.updateUI();

    // Mostra overlay risultato partita
    showMatchResultOverlay(win, draw, coinsEarned);
  }

  function showMatchResultOverlay(win, draw, coins) {
    const banner = document.getElementById("cutin-modal");
    if (!banner) return;
    document.getElementById("cutin-title").textContent = win ? "🎉 VITTORIA!" : (draw ? "🤝 PAREGGIO" : "💔 SCONFITTA");
    document.getElementById("cutin-subtitle").textContent = `RISULTATO: ${match.score[0]} - ${match.score[1]}`;
    document.getElementById("cutin-desc").textContent = `Hai guadagnato 🪙 ${coins} monete per aver giocato!`;
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

    const scale = Math.min(vw / 390, vh / 240);
    ctx.save();
    ctx.scale(scale, scale);

    const sh = match && match.shake > 0 ? (Math.random() - 0.5) * match.shake : 0;
    if (match && match.shake > 0) match.shake *= 0.88;

    // 1. Spalti e campo
    ctx.drawImage(STATIC_HD, 0, 0, CW * SS, CH * SS, sh, sh * 0.5, CW, CH);

    // 2. Pubblico animato
    if (CROWD_HD && match) {
      const crowdFrame = Math.abs(Math.floor(match.t / 12) % 4);
      ctx.drawImage(CROWD_HD[crowdFrame], 0, 0, CW * SS, OY * SS, sh, sh * 0.5, CW, OY);
    }

    // 3. Palla e giocatori all'interno del campo
    ctx.save();
    ctx.translate(MX + sh, OY + sh * 0.5);

    if (match) {
      // Giocatori
      match.all.forEach((p) => {
        // Ombra
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 8, 3, 0, 0, Math.PI * 2); ctx.fill();

        // Anello selezione giocatore
        if (p === match.ctl) {
          ctx.strokeStyle = "#ffd700"; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.ellipse(p.x, p.y + 1, 10, 4, 0, 0, Math.PI * 2); ctx.stroke();
        }

        // Corpo
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x - 5, p.y - 14, 10, 10);

        // Numero maglia
        ctx.fillStyle = "#fff"; ctx.font = "bold 6px sans-serif"; ctx.textAlign = "center";
        ctx.fillText(p.num, p.x, p.y - 7);

        // Pantaloncini
        ctx.fillStyle = p.col2;
        ctx.fillRect(p.x - 4, p.y - 4, 8, 4);

        // Testa
        ctx.fillStyle = "#f0be92";
        ctx.beginPath(); ctx.arc(p.x, p.y - 18, 5, 0, Math.PI * 2); ctx.fill();
      });

      // Palla
      const b = match.ball;
      // Scia super tiro
      if (b.superTiro) {
        b.trail.forEach(([tx, ty], idx) => {
          ctx.fillStyle = `rgba(255, 106, 0, ${idx / 10})`;
          ctx.beginPath(); ctx.arc(tx, ty, 3 + idx * 0.4, 0, Math.PI * 2); ctx.fill();
        });
      }
      // Ombra palla
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.beginPath(); ctx.ellipse(b.x, b.y + 2, 4, 2, 0, 0, Math.PI * 2); ctx.fill();

      // Palla da calcio
      ctx.fillStyle = b.superTiro ? "#ff3366" : "#ffffff";
      ctx.strokeStyle = "#111"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(b.x, b.y - 2, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

      // Hexagoni palla
      ctx.fillStyle = "#111";
      for (let i = 0; i < 3; i++) {
        const a = b.rot + i * 2.094;
        ctx.beginPath(); ctx.arc(b.x + Math.cos(a) * 2, b.y - 2 + Math.sin(a) * 2, 1.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    ctx.restore();

    // 4. HUD partita (Tempo e Risultato)
    if (match) {
      const remSec = Math.max(0, Math.ceil((DUR - match.t) / 60));
      ctx.fillStyle = "rgba(10,19,32,0.85)";
      ctx.fillRect(145, 4, 100, 22);
      ctx.strokeStyle = "#ffd700"; ctx.lineWidth = 1;
      ctx.strokeRect(145, 4, 100, 22);

      ctx.fillStyle = "#fff"; ctx.font = "900 12px monospace"; ctx.textAlign = "center";
      ctx.fillText(`${match.score[0]} - ${match.score[1]}`, 195, 18);

      ctx.font = "bold 9px monospace"; ctx.fillStyle = "#00e5ff";
      ctx.fillText(`${remSec}s`, 195, 25);

      // Barra di carica tiro se in corso
      if (input.shootHold > 0) {
        const f = Math.min(1, input.shootHold / 40);
        ctx.fillStyle = "rgba(0,0,0,0.7)"; ctx.fillRect(150, 32, 90, 7);
        ctx.fillStyle = f > 0.8 ? "#ff3366" : "#ffd700";
        ctx.fillRect(151, 33, 88 * f, 5);
      }
    }

    ctx.restore();

    // 5. Controlli Touch Overlay
    renderTouchControls(vw, vh);

    if (active) {
      updatePhysics();
      rafId = requestAnimationFrame(render);
    }
  }

  function renderTouchControls(vw, vh) {
    if (!active || (match && match.over)) return;

    // Stick virtuale (sinistra)
    const stickBaseX = 65, stickBaseY = vh - 65, stickRad = 45;
    ctx.strokeStyle = "rgba(255,255,255,0.25)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(stickBaseX, stickBaseY, stickRad, 0, Math.PI * 2); ctx.stroke();

    const knobX = input.stick.active ? stickBaseX + input.stick.x * 30 : stickBaseX;
    const knobY = input.stick.active ? stickBaseY + input.stick.y * 30 : stickBaseY;
    ctx.fillStyle = "rgba(0, 229, 255, 0.4)";
    ctx.beginPath(); ctx.arc(knobX, knobY, 20, 0, Math.PI * 2); ctx.fill();

    // Tasti azione (destra)
    // Tasto Tiro (A)
    const btnShootX = vw - 50, btnShootY = vh - 50;
    ctx.fillStyle = input.isShooting ? "rgba(255, 51, 102, 0.8)" : "rgba(255, 51, 102, 0.5)";
    ctx.beginPath(); ctx.arc(btnShootX, btnShootY, 30, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("TIRO", btnShootX, btnShootY + 4);

    // Tasto Passaggio (B)
    const btnPassX = vw - 110, btnPassY = vh - 50;
    ctx.fillStyle = "rgba(57, 255, 20, 0.5)";
    ctx.beginPath(); ctx.arc(btnPassX, btnPassY, 24, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center";
    ctx.fillText("PASS", btnPassX, btnPassY + 4);
  }

  function setupInputEvents() {
    window.addEventListener("keydown", (e) => {
      input.keys[e.code] = true;
      if (e.code === "Space" && match && match.ctl) {
        input.shootHold++;
      }
    });

    window.addEventListener("keyup", (e) => {
      input.keys[e.code] = false;
      if (e.code === "Space" && match && match.ctl) {
        shoot(match.ctl, input.shootHold > 30);
        input.shootHold = 0;
      }
      if (e.code === "KeyJ" && match && match.ctl) {
        pass(match.ctl);
      }
    });

    // Touch events sul canvas
    if (!canvas) return;

    canvas.addEventListener("touchstart", (e) => {
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const tx = t.clientX - rect.left, ty = t.clientY - rect.top;

        // Tasto Tiro
        if (tx > canvas.width - 90 && ty > canvas.height - 90) {
          input.isShooting = true;
          input.shootHold = 1;
        } else if (tx > canvas.width - 150 && ty > canvas.height - 90) {
          if (match && match.ctl) pass(match.ctl);
        } else if (tx < 150 && ty > canvas.height - 150) {
          // Stick
          input.stick.active = true;
          input.stick.startX = 65; input.stick.startY = canvas.height - 65;
          updateStick(tx, ty);
        }
      }
    });

    canvas.addEventListener("touchmove", (e) => {
      const rect = canvas.getBoundingClientRect();
      for (let i = 0; i < e.touches.length; i++) {
        const t = e.touches[i];
        const tx = t.clientX - rect.left, ty = t.clientY - rect.top;
        if (input.stick.active && tx < 180) {
          updateStick(tx, ty);
        }
      }
    });

    canvas.addEventListener("touchend", () => {
      if (input.isShooting) {
        if (match && match.ctl) shoot(match.ctl, input.shootHold > 25);
        input.isShooting = false;
        input.shootHold = 0;
      }
      input.stick.active = false;
      input.stick.x = 0;
      input.stick.y = 0;
    });

    // Incrementa carica tiro nel loop
    setInterval(() => {
      if (input.isShooting) input.shootHold++;
    }, 25);
  }

  function updateStick(tx, ty) {
    const dx = tx - input.stick.startX;
    const dy = ty - input.stick.startY;
    const dist = Math.hypot(dx, dy) || 1;
    const maxR = 40;
    const clamped = Math.min(dist, maxR);
    input.stick.x = (dx / dist) * (clamped / maxR);
    input.stick.y = (dy / dist) * (clamped / maxR);
  }

  function resizeCanvas() {
    if (!canvas) return;
    const container = document.getElementById("screen-match");
    if (!container) return;
    canvas.width = container.clientWidth || 390;
    canvas.height = container.clientHeight || 500;
  }

  const Calcetto = {
    start() {
      canvas = document.getElementById("match-canvas");
      if (!canvas) return;
      ctx = canvas.getContext("2d");
      resizeCanvas();
      setupInputEvents();
      initMatch();
      active = true;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(render);
    },

    pause() {
      active = false;
      cancelAnimationFrame(rafId);
    },

    resume() {
      if (!active) {
        active = true;
        rafId = requestAnimationFrame(render);
      }
    },

    getMatch() {
      return match;
    }
  };

  window.addEventListener("resize", resizeCanvas);
  global.PCA_Match = Calcetto;
})(window);
