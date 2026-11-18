# ⚽ Pixel Calcio Arcade

Calcio arcade 2D in pixel art, pensato per il **telefono** (in orizzontale) con comandi touch.
Partite veloci 5 contro 5 contro la CPU, effetti, power-up e campi diversi, ognuno con la sua regola.

**Gioca:** https://pako1989.github.io/pixel-calcio-arcade/ — dal telefono puoi aggiungerlo alla schermata Home (è una PWA e funziona anche offline).

## Comandi

| Touch | Tastiera | Cosa fa |
| --- | --- | --- |
| Joystick (metà sinistra dello schermo) | Frecce / WASD | Muoversi |
| **TIRA** (tieni premuto per caricare) | J, X o Spazio | Tiro. Senza palla: **scivolata** |
| **PASSA** | K o Z | Passaggio verso il joystick. Senza palla: **cambia giocatore** |
| **SCATTO** | L, Shift o C | Corsa veloce (consuma fiato) |
| II | Esc / P | Pausa |

- **Super tiro**: passaggi riusciti, contrasti e recuperi riempiono la barra SUPER sotto il punteggio. Quando lampeggia, un tiro caricato al massimo diventa un super tiro a effetto.
- **Power-up** sul campo: 🔥 tiro di fuoco, ⚡ turbo per tutta la squadra, 🧱 muro davanti alla propria porta.
- In caso di pareggio si va al **golden gol**.

## Modalità

- **Partita veloce**: scegli squadre, campo, difficoltà e durata.
- **Torneo**: la Coppa Pixel a 8 squadre, quarti, semifinale e finale. Un campo diverso a ogni turno, la finale allo Stadio. Le coppe vinte restano in bacheca.
- **Missioni**: 12 sfide con obiettivi speciali (rimonta da 0-2, gol col super tiro, porta inviolata, gol lampo...). Si sbloccano un po' alla volta.
- **Diventa un mito** (storia): crei il tuo campione e lo porti dal campetto di quartiere alla finale di Coppa in Serie A. 9 partite in 6 capitoli, con dialoghi, un rivale, punti abilità da spendere e abilità speciali da sbloccare. Puoi scegliere se muovere **solo il tuo campione** (i compagni sono della CPU e con PASSA senza palla chiedi il pallone) o tutta la squadra.

Tutto il progresso è salvato sul telefono.

## Campi

| Campo | Regola |
| --- | --- |
| Stadio Arcade | Erba perfetta, nessuna sorpresa |
| Spiaggia | Si corre più piano e la palla si ferma presto |
| Campo Innevato | Si scivola e la palla corre lontano |
| Tetto in Città | Di notte, il vento sposta la palla in aria |
| Gabbia di Quartiere | Campo piccolo e muri elastici |

## Sviluppo

```bash
npm install
npm run dev      # server locale: apri /game.html (anche dal telefono, indirizzo "Network")
npm test         # test della simulazione
npm run build    # build di produzione in dist/
```

Tecnologie: [Phaser 3](https://phaser.io), TypeScript, Vite. Tutta la grafica e i suoni sono generati dal codice (nessun file esterno), il font è Press Start 2P (licenza OFL).

### Struttura

- `src/sim/` – simulazione della partita **senza grafica**: fisica, regole, IA della CPU. Si può usare anche per simulare partite (carriera, manageriale).
- `src/data/` – squadre e campi.
- `src/gfx/` – sprite pixel art e campi disegnati in codice.
- `src/scenes/` – menu, scelta squadre, partita, HUD con comandi touch, risultato.
- `src/modes/` – logica delle modalità senza grafica: torneo, missioni, storia "Diventa un mito" (testi dei dialoghi in `career.ts`). Più avanti: il manageriale collegato.

L'IA della CPU riprende le idee di *SimpleSoccer* (Mat Buckland, "Programming Game AI by Example"): squadra in attacco o in difesa, un giocatore che pressa, gli altri che si smarcano nei punti di supporto o marcano, controllo che la linea di passaggio sia libera, portiere tra palla e porta.

### Pubblicazione

GitHub Pages serve la radice del branch `main`. La pagina sorgente è `game.html`;
`index.html`, `assets/`, `icons/`, `sw.js` e `manifest.webmanifest` nella radice sono la **build pubblicata**
e non vanno modificati a mano: a ogni push su `main` il workflow `deploy.yml` esegue i test,
ricostruisce il gioco e li aggiorna da solo.
