// Pixel Calcio Arcade - Gestione Roster, Carte, Formazione e Scout
(function (global) {
  const S = window.PCA_Storage;
  const A = window.PCA_Audio;

  const CATALOG = [
    // Portieri (P)
    { id: "dino_saracinesca", name: "Dino Guardiano", role: "P", rar: "r", shoot: 30, speed: 60, defense: 85, skill: "Volo Magnetico", col: "#3a8ad8" },
    { id: "gigi_muraglia", name: "Gigi Baluardo", role: "P", rar: "c", shoot: 25, speed: 55, defense: 75, skill: "Presa Sicura", col: "#9aa5b1" },
    { id: "tatsuo_guanto", name: "Tatsuo Acciaio", role: "P", rar: "e", shoot: 35, speed: 68, defense: 90, skill: "Barriera Sonica", col: "#a85ad8" },
    { id: "kronos_tempo", name: "Kronos Portale", role: "P", rar: "l", shoot: 40, speed: 75, defense: 96, skill: "Arresto Temporale", col: "#ffd23f" },

    // Difensori (D)
    { id: "marco_muro", name: "Marco Muro", role: "D", rar: "c", shoot: 42, speed: 65, defense: 80, skill: "Scivolata Roccia", col: "#9aa5b1" },
    { id: "bruno_spalla", name: "Bruno Corazza", role: "D", rar: "c", shoot: 38, speed: 68, defense: 78, skill: "Tackle Pulito", col: "#9aa5b1" },
    { id: "rocco_granito", name: "Rocco Granito", role: "D", rar: "r", shoot: 48, speed: 72, defense: 86, skill: "Muro d'Urti", col: "#3a8ad8" },
    { id: "valerio_fulcro", name: "Valerio Sentinella", role: "D", rar: "e", shoot: 55, speed: 78, defense: 91, skill: "Intercetto Laser", col: "#a85ad8" },
    { id: "titano_colosso", name: "Titano Scudo", role: "D", rar: "l", shoot: 60, speed: 82, defense: 97, skill: "Terremoto Difensivo", col: "#ffd23f" },

    // Centrocampisti (C)
    { id: "samu_regia", name: "Samu Regia", role: "C", rar: "c", shoot: 60, speed: 70, defense: 62, skill: "Passaggio Laser", col: "#9aa5b1" },
    { id: "tobia_turbo", name: "Tobia Turbo", role: "C", rar: "c", shoot: 68, speed: 79, defense: 50, skill: "Scatto Fiamma", col: "#9aa5b1" },
    { id: "mira_volante", name: "Mira Volante", role: "C", rar: "r", shoot: 72, speed: 80, defense: 65, skill: "Cross Pennellato", col: "#3a8ad8" },
    { id: "kai_tornado", name: "Kai Tornado", role: "C", rar: "e", shoot: 81, speed: 84, defense: 72, skill: "Vortice di Metà Campo", col: "#a85ad8" },
    { id: "sora_ombra", name: "Sora Ombra", role: "C", rar: "e", shoot: 78, speed: 89, defense: 68, skill: "Dribbling Fantasma", col: "#a85ad8" },
    { id: "zephyr_vento", name: "Zephyr Maestro", role: "C", rar: "l", shoot: 88, speed: 94, defense: 80, skill: "Danza delle Tempeste", col: "#ffd23f" },

    // Attaccanti (A)
    { id: "leo_lampo", name: "Leo Lampo", role: "A", rar: "r", shoot: 78, speed: 84, defense: 35, skill: "Tiro Fulmine", col: "#3a8ad8" },
    { id: "dario_falco", name: "Dario Falco", role: "A", rar: "c", shoot: 70, speed: 74, defense: 30, skill: "Zampata Rapida", col: "#9aa5b1" },
    { id: "nathan_freccia", name: "Nathan Saetta", role: "A", rar: "r", shoot: 82, speed: 86, defense: 40, skill: "Diagonale Tagliente", col: "#3a8ad8" },
    { id: "axel_vulcano", name: "Axel Vulcano", role: "A", rar: "e", shoot: 92, speed: 85, defense: 45, skill: "Tiro Meteorite", col: "#a85ad8" },
    { id: "yuri_ghiaccio", name: "Yuri Zero", role: "A", rar: "e", shoot: 90, speed: 88, defense: 42, skill: "Cannone Congelante", col: "#a85ad8" },
    { id: "phoenix_drago", name: "Phoenix Fenice", role: "A", rar: "l", shoot: 98, speed: 92, defense: 50, skill: "Fiamma Eterna", col: "#ffd23f" }
  ];

  const BY_ID = Object.fromEntries(CATALOG.map((c) => [c.id, c]));

  const MODULI = {
    rombo: { name: "Rombo (1-1-2-1)", roles: ["P", "D", "C", "C", "A"], desc: "Equilibrato: difesa rocciosa e doppio centrocampo" },
    lineare: { name: "Lineare (1-2-1-1)", roles: ["P", "D", "D", "C", "A"], desc: "Difensivo: doppia guardia e ripartenze veloci" },
    piramide: { name: "Piramide (1-1-1-2)", roles: ["P", "D", "C", "A", "A"], desc: "Offensivo: doppio terminale d'attacco" }
  };

  const RARITY_INFO = {
    c: { name: "Comune", stars: "★", badgeCol: "#64748b" },
    r: { name: "Rara", stars: "★★", badgeCol: "#3b82f6" },
    e: { name: "Epica", stars: "★★★", badgeCol: "#a855f7" },
    l: { name: "Leggendaria", stars: "★★★★", badgeCol: "#eab308" }
  };

  function getCardAvatarSvg(c) {
    const bg = c.col || "#3b82f6";
    const initial = (c.name || "E").charAt(0);
    return `<svg width="42" height="42" viewBox="0 0 42 42" xmlns="http://www.w3.org/2000/svg">
      <circle cx="21" cy="21" r="20" fill="#0f172a" stroke="${bg}" stroke-width="2"/>
      <circle cx="21" cy="16" r="8" fill="#f0be92"/>
      <path d="M12 36 Q21 24 30 36" fill="${bg}"/>
      <text x="21" y="19" font-family="sans-serif" font-weight="900" font-size="9" fill="#0f172a" text-anchor="middle">${initial}</text>
    </svg>`;
  }

  function calculateSintonia(teamIds, moduloKey) {
    const state = S.load();
    const mod = MODULI[moduloKey] || MODULI.rombo;
    let matchCount = 0;
    mod.roles.forEach((reqRole, idx) => {
      const cardId = teamIds[idx];
      const card = state.cards[cardId] || BY_ID[cardId];
      if (card && card.role === reqRole) matchCount++;
    });
    return Math.round((matchCount / mod.roles.length) * 100);
  }

  function renderRoster() {
    const container = document.getElementById("team-roster-view");
    if (!container) return;

    const state = S.load();
    const curModulo = state.modulo || "rombo";
    const sintonia = calculateSintonia(state.team, curModulo);

    let html = `
      <div style="background:var(--bg-card); border:1px solid var(--border-arcade); border-radius:12px; padding:12px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div>
            <span style="font-weight:800; color:#fff; font-size:1rem;">MODULO:</span>
            <select id="select-modulo" style="background:#0f172a; color:var(--neon-yellow); border:1px solid #3b82f6; border-radius:6px; padding:4px 8px; font-weight:700;">
              ${Object.entries(MODULI).map(([k, m]) => `<option value="${k}" ${k === curModulo ? "selected" : ""}>${m.name}</option>`).join("")}
            </select>
          </div>
          <div style="text-align:right;">
            <span style="font-size:0.75rem; color:var(--text-muted);">INTESA:</span>
            <span style="font-weight:900; color:${sintonia >= 80 ? "var(--neon-green)" : "#fbbf24"}; font-size:1.1rem;"> ${sintonia}%</span>
          </div>
        </div>
        <p style="font-size:0.75rem; color:var(--text-muted);">${MODULI[curModulo].desc}</p>
      </div>

      <h3 style="font-size:0.95rem; color:var(--neon-yellow); margin:10px 0 8px; text-transform:uppercase;">Titolari in Campo (5)</h3>
      <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:18px;">
    `;

    const modRoles = (MODULI[curModulo] || MODULI.rombo).roles;
    state.team.forEach((cardId, idx) => {
      const card = state.cards[cardId] || BY_ID[cardId] || { name: "Vuoto", role: "?", rar: "c", shoot: 50, speed: 50, defense: 50, lvl: 1 };
      const reqRole = modRoles[idx];
      const isRoleMatched = card.role === reqRole;
      const rar = RARITY_INFO[card.rar] || RARITY_INFO.c;

      html += `
        <div style="background:var(--bg-card); border:2px solid ${isRoleMatched ? rar.badgeCol : "#64748b"}; border-radius:10px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:10px;">
            ${getCardAvatarSvg(card)}
            <div>
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="font-weight:900; color:#fff; font-size:0.95rem;">${card.name}</span>
                <span style="font-size:0.68rem; color:${rar.badgeCol};">${rar.stars}</span>
              </div>
              <div style="font-size:0.75rem; color:var(--text-muted);">
                Ruolo: <b style="color:${isRoleMatched ? "var(--neon-green)" : "#ef4444"};">${card.role}</b> ${isRoleMatched ? "✓" : `(vuole ${reqRole})`} · Liv. ${card.lvl || 1}
              </div>
            </div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.75rem; color:#94a3b8;">TIRO: <b style="color:#fff;">${card.shoot}</b></div>
            <div style="font-size:0.75rem; color:#94a3b8;">DIF: <b style="color:#fff;">${card.defense}</b></div>
          </div>
        </div>
      `;
    });

    html += `
      </div>
      <h3 style="font-size:0.95rem; color:var(--neon-blue); margin:10px 0 8px; text-transform:uppercase;">Tutte le mie Carte (${Object.keys(state.cards).length})</h3>
      <div style="display:flex; flex-direction:column; gap:8px;">
    `;

    Object.values(state.cards).forEach((c) => {
      const isStarter = state.team.includes(c.id);
      const rar = RARITY_INFO[c.rar] || RARITY_INFO.c;
      html += `
        <div style="background:rgba(15,23,42,0.8); border:1px solid var(--border-arcade); border-radius:8px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between;">
          <div style="display:flex; align-items:center; gap:8px;">
            ${getCardAvatarSvg(c)}
            <div>
              <div style="font-weight:800; color:#fff; font-size:0.85rem;">${c.name} <span style="font-size:0.65rem; color:${rar.badgeCol};">${rar.stars}</span></div>
              <div style="font-size:0.7rem; color:var(--neon-yellow);">${c.skill}</div>
            </div>
          </div>
          <div>
            ${isStarter ? '<span style="font-size:0.7rem; color:var(--neon-green); font-weight:700;">IN CAMPO</span>' : `<button class="btn-swap-starter btn-arcade" data-id="${c.id}" style="padding:4px 8px; font-size:0.7rem;">SCHIERA</button>`}
          </div>
        </div>
      `;
    });

    html += `</div>`;
    container.innerHTML = html;

    // Listener cambio modulo
    const selMod = document.getElementById("select-modulo");
    if (selMod) {
      selMod.addEventListener("change", (e) => {
        state.modulo = e.target.value;
        S.save(state);
        A.click();
        renderRoster();
      });
    }

    // Listener schiera in campo
    document.querySelectorAll(".btn-swap-starter").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        const cardToPut = state.cards[id];
        if (!cardToPut) return;

        // Cerca di sostituire un giocatore con lo stesso ruolo o l'ultimo
        const replaceIdx = state.team.findIndex((tid) => {
          const oldC = state.cards[tid];
          return oldC && oldC.role === cardToPut.role;
        });

        const targetSlot = replaceIdx !== -1 ? replaceIdx : (state.team.length > 4 ? 4 : state.team.length);
        state.team[targetSlot] = id;
        S.save(state);
        A.click();
        renderRoster();
      });
    });
  }

  function openPack(packType) {
    const state = S.load();
    const cost = packType === "fuoriclasse" ? 120 : 50;

    if (state.coins < cost) {
      alert("Monete insufficienti! Vinci altre partite per guadagnare monete.");
      return;
    }

    state.coins -= cost;
    state.stats.packsOpened = (state.stats.packsOpened || 0) + 1;

    // Estrazione ponderata
    const pool = CATALOG.filter((c) => {
      if (packType === "fuoriclasse") return c.rar === "r" || c.rar === "e" || c.rar === "l";
      return c.rar === "c" || c.rar === "r" || c.rar === "e";
    });

    const chosen = pool[Math.floor(Math.random() * pool.length)];
    const alreadyOwn = !!state.cards[chosen.id];

    if (alreadyOwn) {
      state.cards[chosen.id].xp = (state.cards[chosen.id].xp || 0) + 100;
      if (state.cards[chosen.id].xp >= 200) {
        state.cards[chosen.id].lvl = (state.cards[chosen.id].lvl || 1) + 1;
        state.cards[chosen.id].shoot += 2;
        state.cards[chosen.id].defense += 2;
        state.cards[chosen.id].speed += 2;
        state.cards[chosen.id].xp = 0;
      }
    } else {
      state.cards[chosen.id] = Object.assign({}, chosen, { lvl: 1, xp: 0 });
    }

    S.save(state);
    if (window.PCA_App) window.PCA_App.updateUI();

    // Mostra modale spacchettamento
    showPackModal(chosen, alreadyOwn);
  }

  function showPackModal(card, duplicate) {
    const rar = RARITY_INFO[card.rar] || RARITY_INFO.c;
    const modal = document.getElementById("cutin-modal");
    if (!modal) return;

    document.getElementById("cutin-title").textContent = `🎴 NUOVA CARTA SCOUT!`;
    document.getElementById("cutin-subtitle").textContent = `${card.name} · ${rar.name.toUpperCase()} (${rar.stars})`;
    document.getElementById("cutin-desc").innerHTML = `
      <div style="margin:8px 0;">${getCardAvatarSvg(card)}</div>
      <div style="color:var(--neon-yellow); font-weight:700;">Abilità: ${card.skill}</div>
      <div style="font-size:0.8rem; color:#94a3b8; margin-top:4px;">
        Tiro: ${card.shoot} · Difesa: ${card.defense} · Velocità: ${card.speed}
      </div>
      <div style="font-size:0.75rem; color:${duplicate ? "#fbbf24" : "var(--neon-green)"}; margin-top:6px;">
        ${duplicate ? "Carta duplicata! Convertita in +100 XP di potenziamento!" : "Nuova carta aggiunta alla tua squadra!"}
      </div>
    `;

    modal.classList.add("show");
    A.goal();

    document.getElementById("cutin-btn-ok").onclick = () => {
      modal.classList.remove("show");
      A.click();
      if (document.getElementById("screen-team").classList.contains("active")) {
        renderRoster();
      }
    };
  }

  function setupShopButtons() {
    const shopScreen = document.getElementById("screen-shop");
    if (!shopScreen) return;

    const btns = shopScreen.querySelectorAll("button.btn-arcade");
    if (btns.length >= 2) {
      btns[0].onclick = () => openPack("base");
      btns[1].onclick = () => openPack("fuoriclasse");
    }
  }

  window.addEventListener("DOMContentLoaded", () => {
    setupShopButtons();
  });

  global.PCA_Roster = {
    render: renderRoster,
    openPack,
    calculateSintonia,
    CATALOG,
    BY_ID,
    MODULI
  };
})(window);
