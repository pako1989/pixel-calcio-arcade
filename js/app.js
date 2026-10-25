// Pixel Calcio Arcade - App Orchestrator
(function () {
  const S = window.PCA_Storage;
  const A = window.PCA_Audio;

  let state = S.load();

  // Registrazione Service Worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js")
        .then(() => console.log("[App] Service worker registrato con successo."))
        .catch((err) => console.warn("[App] Errore service worker:", err));
    });
  }

  // Navigation management
  function switchScreen(screenId) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));

    const target = document.getElementById("screen-" + screenId);
    if (target) target.classList.add("active");

    const navBtn = document.querySelector(`.nav-item[data-target="${screenId}"]`);
    if (navBtn) navBtn.classList.add("active");

    A.click();
    updateUI();

    // Trigger hooks
    if (screenId === "match") {
      if (window.PCA_Match && typeof window.PCA_Match.start === "function") {
        window.PCA_Match.start();
      }
    } else if (window.PCA_Match && typeof window.PCA_Match.pause === "function") {
      window.PCA_Match.pause();
    }

    if (screenId === "team" && window.PCA_Roster) {
      window.PCA_Roster.render();
    }
  }

  function updateUI() {
    state = S.load();
    const coinEl = document.getElementById("coin-count");
    if (coinEl) coinEl.textContent = state.coins;
  }

  function showCutin(key, title, subtitle, desc) {
    state = S.load();
    if (state.settings.cutins[key]) return; // Già visto

    const modal = document.getElementById("cutin-modal");
    if (!modal) return;
    document.getElementById("cutin-title").textContent = title;
    document.getElementById("cutin-subtitle").textContent = subtitle;
    document.getElementById("cutin-desc").textContent = desc;
    modal.classList.add("show");
    A.goal();

    document.getElementById("cutin-btn-ok").onclick = () => {
      modal.classList.remove("show");
      state.settings.cutins[key] = true;
      S.save(state);
      A.click();
    };
  }

  window.addEventListener("DOMContentLoaded", () => {
    A.init();
    updateUI();

    // Bottom nav clicks
    document.querySelectorAll(".nav-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const target = btn.getAttribute("data-target");
        if (target) switchScreen(target);
      });
    });

    // Quick match button from menu
    const btnQuickMatch = document.getElementById("btn-quick-match");
    if (btnQuickMatch) {
      btnQuickMatch.addEventListener("click", () => switchScreen("match"));
    }

    const btnTeam = document.getElementById("btn-open-team");
    if (btnTeam) {
      btnTeam.addEventListener("click", () => switchScreen("team"));
    }

    const btnTournament = document.getElementById("btn-open-tournament");
    if (btnTournament) {
      btnTournament.addEventListener("click", () => {
        showCutin("tourney", "🏆 TORNEO URBANO", "LIVELLO 1 · QUARTI DI FINALE", "Vinci 3 partite di fila per conquistare la coppa e sbloccare 200 monete!");
      });
    }

    // Export PCA globals
    window.PCA_App = {
      switchScreen,
      updateUI,
      showCutin,
      getState: () => state,
      addCoins: (n) => {
        state.coins = Math.max(0, (state.coins || 0) + n);
        S.save(state);
        updateUI();
      }
    };
  });
})();
