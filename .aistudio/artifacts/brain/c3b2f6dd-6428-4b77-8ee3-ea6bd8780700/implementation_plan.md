# Pixel Calcio Arcade v0.9.4 — Carriera Allenatore Avanzata (Sponsor & Calciomercato)

Questo aggiornamento espande la **Modalità Manager** introducendo contratti di sponsorizzazione strategici a scelta (Sponsor Bronze, Silver, Gold con bonus e rischi) e un calciomercato potenziato con trattative, prestiti e scouting di giovani talenti.

---

## 1. Overview & Core Features

1. **Scelta dello Sponsor**: All'inizio di ogni stagione (o cambio contratto), il club riceve 3 offerte di sponsorizzazione (es. *Birrificio Locale*, *Tech Arena*, *Global Sports*) con differenti ricavi settimanali e bonus salvezza/promozione.
2. **Calciomercato Avanzato**:
   - Lista trasferimenti ampliata con filtri per ruolo e potenziale (`pot`).
   - Opzione **Prestito con Diritto di Riscatto** per giocatori giovani o in esubero.
   - Trattativa di rinnovo contratto per i propri giocatori chiave.
3. **Fiducia del Consiglio (Board Confidence)**:
   - Indicatore visivo (0-100%) della dirigenza basato su risultati, gestione finanziaria e obiettivi del presidente.

---

## 2. Technical Architecture & Data Changes

- **Stato Manager (`ManagerState`)**:
  - Aggiunta di `sponsor?: { name: string; weekly: number; bonus: number; durationWeeks: number }`.
  - Aggiunta di `boardConfidence: number` (0..100, default 70).
  - Estensione del mercato (`market`) con opzione prestito (`loan?: boolean; buyout?: number`).
- **File da modificare**:
  - `src/modes/manager.ts`: logica di gestione sponsor, contratti, rinnovi e calciomercato avanzato.
  - `src/scenes/ManagerScene.ts`: interfacce UI per la scelta dello sponsor, pannello mercato prestiti/rinnovi e indicatore fiducia dirigenza.
  - `tests/manager.test.ts`: test unitari per sponsor e calciomercato avanzato.

---

## 3. Verification Plan

- Esecuzione di `npm test` per verificare tutti i test esistenti e i nuovi test su sponsor e mercato.
- Compilazione e build con `npm run build`.
