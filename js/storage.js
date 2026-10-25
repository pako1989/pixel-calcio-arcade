// Pixel Calcio Arcade - Gestione Salvataggi LocalStorage
(function (global) {
  const KEY = "pixelcalcio.save";

  const DEFAULT_SAVE = {
    version: 1,
    coins: 150, // Monete iniziali di benvenuto
    cards: {
      "leo_lampo": { id: "leo_lampo", name: "Leo Lampo", role: "A", rar: "r", lvl: 1, xp: 0, shoot: 78, speed: 84, defense: 35, skill: "Tiro Fulmine" },
      "marco_muro": { id: "marco_muro", name: "Marco Muro", role: "D", rar: "c", lvl: 1, xp: 0, shoot: 42, speed: 65, defense: 80, skill: "Scivolata Roccia" },
      "samu_regia": { id: "samu_regia", name: "Samu Regia", role: "C", rar: "c", lvl: 1, xp: 0, shoot: 60, speed: 70, defense: 62, skill: "Passaggio Laser" },
      "tobia_turbo": { id: "tobia_turbo", name: "Tobia Turbo", role: "C", rar: "c", lvl: 1, xp: 0, shoot: 68, speed: 79, defense: 50, skill: "Scatto Fiamma" },
      "dino_saracinesca": { id: "dino_saracinesca", name: "Dino Guardiano", role: "P", rar: "r", lvl: 1, xp: 0, shoot: 30, speed: 60, defense: 85, skill: "Volo Magnetico" }
    },
    team: ["dino_saracinesca", "marco_muro", "samu_regia", "tobia_turbo", "leo_lampo"],
    modulo: "rombo", // rombo, piramide, lineare
    stats: {
      matches: 0,
      wins: 0,
      goalsScored: 0,
      goalsConceded: 0,
      packsOpened: 0
    },
    cup: 1, // Livello torneo (1..5)
    cupStage: 0, // 0: Quarti, 1: Semifinale, 2: Finale
    settings: {
      sound: true,
      gfx: "hd", // "hd" o "2d"
      proTackle: true,
      stickFixed: false,
      cutins: {}
    }
  };

  const Storage = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SAVE));
        const data = JSON.parse(raw);
        return Object.assign({}, DEFAULT_SAVE, data, {
          settings: Object.assign({}, DEFAULT_SAVE.settings, data.settings || {}),
          stats: Object.assign({}, DEFAULT_SAVE.stats, data.stats || {})
        });
      } catch (e) {
        console.warn("[Storage] Errore caricamento save:", e);
        return JSON.parse(JSON.stringify(DEFAULT_SAVE));
      }
    },

    save(data) {
      try {
        localStorage.setItem(KEY, JSON.stringify(data));
      } catch (e) {
        console.warn("[Storage] Errore salvataggio:", e);
      }
    },

    reset() {
      try {
        localStorage.removeItem(KEY);
      } catch (e) {}
      return JSON.parse(JSON.stringify(DEFAULT_SAVE));
    }
  };

  global.PCA_Storage = Storage;
})(window);
