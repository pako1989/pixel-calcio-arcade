# Pixel Calcio Arcade v0.9.2 — Approfondimento Torneo, Missioni e Allenamento

Questo aggiornamento potenzia in modo complementare tre modalità di gioco esistenti: rende la **Coppa Pixel** più ricca e strategica (formato 4/8 squadre, modulo tattico e capocannoniere con premi), espande le **Missioni** sui campi speciali finora esclusi (**Flipper**, **Fango**, **Vulcano**) con obiettivi acrobatici e premi in monete, e aggiunge in **Allenamento** l'esercizio dedicato al **Tiro al Volo** per padroneggiare le giocate aeree.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> Il piano recepisce la preferenza confermata di approfondire altre modalità di gioco tramite **2 novità complementari ben integrate**, sincronizzando la versione **`v0.9.2`** nel badge e nel changelog della Home.

- **Direzione confermata**: approfondimento di **Torneo**, **Missioni** e **Allenamento** (senza modificare la fisica di base appena stabilizzata in v0.9.1).
- **Retrocompatibilità salvataggi (Decisione consigliata)**: i tornei già avviati a 8 squadre restano validi; il traguardo trofeo a 18 missioni completate resta valido e si affianca al nuovo trofeo per tutte le 24 missioni.
- **Formato torneo predefinito (Decisione consigliata)**: `8 SQUADRE` (Coppa Pixel classica) preselezionato, affiancato dalla nuova opzione `4 SQUADRE` (Coppa Lampo: Semifinale + Finale).

---

### 1. Overview & Core Concept

- **Cosa fa**:
  1. **Torneo Evoluto ("Coppa Pixel" & "Coppa Lampo")**: permette di scegliere formato (`4` o `8` squadre) e modulo tattico (`1-2-1`, `1-1-2`, `2-1-1`) prima di iniziare la coppa, registra i marcatori turno per turno mostrando il **Capocannoniere del Torneo** direttamente sul tabellone e assegna premi in monete (per vittoria finale, podio e capocannoniere).
  2. **Missioni Atto II (24 Sfide + Premi) & Allenamento al Volo**: aggiunge una quarta fila di **6 nuove missioni (19–24)** ambientate su Flipper, Campo Fangoso e Cratere Vulcano con nuovi obiettivi legati a **Tiro al Volo** e **Rovesciata** e ricompense in monete alla prima vittoria; in parallelo introduce il 4° esercizio in Allenamento (**Tiro al Volo** su cross laterale) per allenare il tempismo aereo di attaccanti e centrocampisti.
- **Per chi è pensato**: giocatori che amano le competizioni a eliminazione diretta, le sfide a obiettivi speciali e la progressione del proprio Club tramite monete, XP e record.
- **Valore aggiunto**: chiude il cerchio tra allenamento, sfide e coppa — alleni il tiro al volo, lo usi nelle nuove missioni sui campi speciali guadagnando monete e punti alla Coppa Pixel con modulo personalizzato e classifica marcatori.

---

### 2. User Experience & Visual Design

- **Flussi principali**:
  1. **Torneo**:
     - Nella schermata iniziale della Coppa il giocatore sceglie **Squadra**, **Difficoltà CPU**, **Formato (`4` o `8` squadre)** e **Modulo (`1-2-1`, `1-1-2`, `2-1-1`)**.
     - Sul tabellone compaiono le partite (2 colonne per la Coppa a 4, tabellone completo a 8 per la Coppa Pixel) insieme al nuovo riquadro **CAPOCANNONIERE** con i migliori marcatori della competizione.
     - Al fischio finale e nella schermata di risultato vengono mostrati l'avanzamento, gli eventuali marcatori aggiornati e il **premio in monete** conquistato (coppa + titolo capocannoniere).
  2. **Missioni (6x4 = 24 sfide)**:
     - La griglia mostra 4 righe da 6 tessere (`1–24`) con icone maglia/lucchetto/spunta verde.
     - Il riquadro dettagli della missione selezionata evidenzia gli obiettivi e il **Premio Prima Vittoria (`+40`..`+100` monete)**; al completamento, il riepilogo post-partita accredita il bonus una tantum.
  3. **Allenamento — Esercizio "Tiro al Volo"**:
     - La schermata iniziale dell'Allenamento presenta 4 card affiancate e bilanciate (`TIRO AL BERSAGLIO`, `PUNIZIONI`, `RIFLESSI DEL PORTIERE`, `TIRO AL VOLO`).
     - Avviando `TIRO AL VOLO`, un compagno crossa il pallone da fascia laterale verso il dischetto: il giocatore sceglie prima l'angolo in porta, poi tocca la porta o preme `SPAZIO` esattamente quando il pallone entra nel cerchio di battuta al volo (`VERDE` = tiro al volo `+3 pt`, `ORO` = timing perfetto / rovesciata `+5 pt`).
- **Identità visiva & Coerenza**:
  - Stessa estetica pixel-art retro (`Press Start 2P`), pannelli scuri `#1b1d2e` con bordo `#2e3250` e accenti `#ffd23f` (oro), `#3fd0ff` (ciano), `#5be37d` (verde), `#ff7ab8` (magenta acrobazie).
  - Griglia missioni 6x4 dimensionata per mantenere leggibilità completa nella risoluzione di base senza sovrapposizioni coi pulsanti inferiori.
- **Feedback interattivo**:
  - Anello bersaglio pulsante sul punto di impatto del cross nell'esercizio `TIRO AL VOLO`, lampo oro/magenta su impatto perfetto e rete animata + coriandoli/fanfara su record o titolo capocannoniere.

---

### 3. Key Product Decisions & Trade-Offs

- **Decisione 1 — Calcolo Marcatori del Torneo**:
  - *Approccio scelto*: le partite giocate dall'utente registrano i marcatori reali (`result.scorers`), mentre le partite simulate tra squadre CPU estraggono marcatori dai rispettivi roster (pesati per ruolo `FWD`/`MID`) salvando una mappa `scorers` nello stato del torneo.
  - *Perché*: rende vivo e coerente il tabellone del Capocannoniere senza dover simulare fisicamente 60 secondi per ogni partita CPU vs CPU.
  - *Alternative scartate*: simulare solo i gol dell'utente (avrebbe reso impossibile competere con altri bomber del torneo).
- **Decisione 2 — Layout 4 Card in Allenamento e Griglia 6x4 in Missioni**:
  - *Approccio scelto*: ridimensionamento proporzionale delle 4 card in `Allenamento` (larghezza adattiva `<= 136px`) e altezza tessere `30px` in `Missioni` per far stare 4 righe + scheda dettagli + premi monete nello schermo `640x360`.
  - *Perché*: mantiene accesso diretto immediato senza introdurre scrollbar o paginazione nascosta.
  - *Alternative scartate*: menu a scorrimento o seconda pagina separata.
- **Decisione 3 — Tracciamento Gol al Volo e Rovesciata nelle Statistiche Match**:
  - *Approccio scelto*: estendere il contatore di fine partita (`MatchTally`) con `volleyGoals` e `bicycleGoals` ricavati dagli eventi `goal` esistenti (`e.volley`).
  - *Perché*: permette alle nuove missioni e a futuri trofei/sfide di verificare oggettivamente gol al volo e rovesciate senza toccare la fisica di `MatchSim`.

---

### 4. Technical Architecture & Data Strategy *(Technical Reference)*

```
┌───────────────────────────┐     ┌────────────────────────────────┐
│   Stato Persistente       │────▶│  Scene delle Modalità          │
│   (Tournament, Missions,  │     │  • Tournament (4/8, Modulo,    │
│    Training, Progress)    │     │    Capocannoniere, Premi)      │
└───────────────────────────┘     │  • Missions (6x4, Coin Bonus)  │
             ▲                    │  • Training (4° Drill Volo)    │
             │                    └───────────────┬────────────────┘
             │                                    │ MatchLaunch
             │                                    ▼
┌────────────┴──────────────┐     ┌────────────────────────────────┐
│   Resoconto & Ricompense  │◀────│  Simulazione & Conteggi        │
│   (Torneo + Missioni +    │     │  • MatchSim (formazioni 5v5)   │
│    Trofei + Club Coins)   │     │  • TallyTracker (volleyGoals,  │
└───────────────────────────┘     │    bicycleGoals)               │
                                  └────────────────────────────────┘
```

- **Modello dati & Stati**:
  - **Stato Torneo**: arricchito con campi opzionali retrocompatibili (`size?: 4 | 8`, `formation?: FormationId`, `scorers?: Record<string, { name: string; team: string; goals: number }>`).
  - **Definizione Missioni & Conteggi**: nuovi tipi di obiettivo `volleyGoal` e `bicycleGoal` valutati tramite `tally.volleyGoals` e `tally.bicycleGoals`; campo `reward` in monete per ciascuna missione, tracciato in salvataggio (`missions.done`) per erogazione una tantum.
  - **Allenamento**: nuovo identificativo esercizio `'volo'` con logica di punteggio pura (`volleyTimingPoints`) basata sulla distanza temporale dal punto ottimale di battuta del cross e sull'angolo di mira.
- **Mappatura Interazioni**:
  - Selezione formato `4 / 8` e modulo `1-2-1 / 1-1-2 / 2-1-1` in Torneo -> inizializzazione tabellone ridotto o completo e propagazione del modulo in `MatchLaunch.config.formation`.
  - Selezione tessera `19–24` in Missioni -> aggiornamento riquadro dettagli con campi speciali, nuovi obiettivi acrobatici e premio monete prima vittoria -> avvio `MatchScene` e verifica a fine gara.
  - Avvio esercizio `TIRO AL VOLO` in Allenamento -> mira in porta -> lancio cross parabolico dalla fascia -> tap/Spazio sul cerchio di battuta -> animazione tiro al volo / rovesciata -> accumulo punti, record e XP per `FWD`/`MID`.
- **Sincronizzazione Versione**: bump `0.9.2` e nuova voce in testa al changelog visualizzabile dal badge in Home.
