# ⚽ Pixel Calcio Arcade

Calcetto arcade mobile 100% offline per Android e Web, con comandi touch a 60 fps, grafica pixel art a 3/4 ("Stadio HD"), gestione squadra con carte collezionabili, super tiri d'effetto e tornei a coppe.

---

## 🎮 Caratteristiche Principali
- **Gameplay Rapido**: Partite 3v3 e 5v5 su campo sintetico con sponde e reti 3D.
- **Visuale a 3/4 Stadio HD**: Rendering procedurale pixel art a 60 fps con pubblico animato, tabellone LED in legno e ombre morbide.
- **Nessuna Microtransazione**: Monete guadagnate solo vincendo le partite e le coppe. Nessun acquisto con soldi reali e zero pubblicità.
- **100% Offline (PWA)**: Service Worker integrato con precache di tutti i file e zero CDN esterne.
- **Compatibile Mobile First**: Ottimizzato per schermi a partire da 390px (orientamento orizzontale e verticale).

---

## 🚀 Avvio Locale
```bash
npm install
npm run dev
```
Apri il browser su `http://localhost:3000`.

---

## 🧪 Test Automatici (Playwright)
```bash
npm test
```

---

## 📦 Impacchettamento Android (Capacitor)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Pixel Calcio Arcade" com.pako1989.pixelcalcio
npx cap add android
npx cap copy
npx cap open android
```

---

## 📄 Licenze
Consulta `LICENZE.md` per le licenze di Phaser 3.80.1, DiceBear e delle risorse procedurali.
