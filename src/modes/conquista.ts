import { makeTeam, type TeamSeed } from '../data/teams';
import { PITCHES } from '../data/pitches';
import type { Difficulty, PitchId, PlayerDef, PlayerStats, TeamDef } from '../sim/types';
import type { MatchLaunch, MatchOutcome } from './modes';
import { npc, npcTeam, type CastMember } from './career';

/**
 * "Quartiere contro Città": la saga di una squadra di quartiere.
 * Il campetto di Vicolo Stella sta per diventare un parcheggio: l'unico modo
 * per salvarlo è vincere la Coppa dei Cento Campanili, conquistando l'Italia
 * città per città. Ogni città ha il suo campo, il suo capitano e un ricordo
 * da portare a casa (un bonus per tutta la squadra).
 */

export type CqChar = 'hero' | 'nina' | 'gege' | 'toto' | 'corvo' | 'vera' | 'local' | 'title';
export interface CqLine {
  who: CqChar;
  text: string;
  /** Per who = 'local': capitano di un'altra città (indice della tappa). */
  of?: number;
}

export type CqGoal = 'win' | 'winBy2' | 'cleanSheet' | 'captainGoal';

export const CQ_GOAL_TEXT: Record<CqGoal, string> = {
  win: 'Vinci la partita',
  winBy2: 'Vinci con almeno 2 gol di scarto',
  cleanSheet: 'Vinci senza subire gol',
  captainGoal: 'Vinci con almeno un gol del capitano',
};

/** Ricordi delle città: bonus permanenti per tutta la squadra. */
export interface Souvenir {
  name: string;
  desc: string;
  stat?: keyof PlayerStats;
  all?: boolean;
  superStart?: boolean;
}

export interface City {
  id: string;
  name: string;
  /** Longitudine e latitudine (per la mappa). */
  lon: number;
  lat: number;
  place: string;
  pitch: PitchId;
  goal: CqGoal;
  startScore?: [number, number];
  duration: number;
  goldenGoal: boolean;
  opp: TeamSeed;
  captain: { name: string; look: PlayerDef['look'] };
  souvenir: Souvenir;
  before: CqLine[];
  win: CqLine[];
  lose: CqLine[];
}

const kit = (shirt: number, shirt2: number, shorts: number, gk: number) => ({ shirt, shirt2, shorts, socks: shirt, gk });

export const CITIES: City[] = [
  {
    id: 'napoli', name: 'NAPOLI', lon: 14.25, lat: 40.85,
    place: 'Gabbia dei Quartieri, Napoli', pitch: 'quartiere', goal: 'win', duration: 120, goldenGoal: true,
    opp: { id: 'mercato', name: 'Quelli del Mercato', short: 'MER', colors: kit(0xe8443a, 0xf2f2f2, 0x2b2b2b, 0x29c7c7), pattern: 'hoops', stars: 1 },
    captain: { name: 'Saracinesca', look: { skin: 2, hair: 0, hairStyle: 1 } },
    souvenir: { name: 'CORNETTO ROSSO', desc: '+tiro per tutta la squadra', stat: 'shot' },
    before: [
      { who: 'title', text: 'PROLOGO\nIL VICOLO' },
      { who: 'gege', text: 'Diretta di Stella TV! Siamo al campetto di Vicolo Stella, il campo più storto di tutta Napoli.' },
      { who: 'gege', text: 'Ehi... che ci fa quel cartello? "CORVO COSTRUZIONI: qui sorgerà un parcheggio da 400 posti."' },
      { who: 'hero', text: 'Un parcheggio? Al posto del nostro campo?!' },
      { who: 'corvo', text: 'Ingegner Corvo, piacere. Il terreno è del Comune, e il Comune vende. Lavori a settembre.' },
      { who: 'corvo', text: 'A meno che non vinciate la Coppa dei Cento Campanili. Ahah! Buona fortuna, ragazzini.' },
      { who: 'nina', text: 'La Coppa dei Cento Campanili... il torneo dei quartieri che attraversa tutta l\'Italia.' },
      { who: 'nina', text: 'Regola numero uno, la più vecchia: il campo di chi vince la Coppa non si tocca.' },
      { who: 'hero', text: 'Allora la vinciamo, Zia Nina. Città per città.' },
      { who: 'nina', text: 'Prima diventate campioni di Napoli. E al Mercato non regalano niente, nemmeno il resto.' },
      { who: 'local', text: 'Vicolo Stella? Vi conosco. Perdete pure a biliardino.' },
    ],
    win: [
      { who: 'local', text: 'Va bene, va bene. Siete i campioni di Napoli. Portatevela lontano, sta Coppa.' },
      { who: 'gege', text: 'Il video della partita ha 300 visualizzazioni! ...299 sono di mia nonna.' },
      { who: 'toto', text: 'Avete visto il mio tacco? Ditemi che l\'avete ripreso!' },
      { who: 'nina', text: 'Prossima tappa: Bari. Si parte col furgone del fruttivendolo. Puzza di cipolle, ma cammina.' },
    ],
    lose: [
      { who: 'local', text: 'Tornate al vicolo, finché c\'è ancora.' },
      { who: 'nina', text: 'Si rigioca. A Napoli una seconda occasione non si nega a nessuno.' },
    ],
  },
  {
    id: 'bari', name: 'BARI', lon: 16.87, lat: 41.12,
    place: 'Tra i vicoli di Bari Vecchia', pitch: 'quartiere', goal: 'winBy2', duration: 120, goldenGoal: false,
    opp: { id: 'levante', name: 'Levante Bari', short: 'LEV', colors: kit(0xf2f2f2, 0xc8202a, 0xc8202a, 0x2fbf5a), pattern: 'half', stars: 2 },
    captain: { name: 'Rosa', look: { skin: 1, hair: 4, hairStyle: 2 } },
    souvenir: { name: 'FOCACCIA DEL FORNO', desc: '+velocità per tutta la squadra', stat: 'speed' },
    before: [
      { who: 'title', text: 'TAPPA 2\nBARI' },
      { who: 'gege', text: 'Bari Vecchia! Le signore fanno le orecchiette in strada e ci guardano malissimo.' },
      { who: 'local', text: 'Rosa, capitana del Levante. Qui le nonne fanno da arbitro. E sono severe.' },
      { who: 'local', text: 'Regola del vicolo: se vincete di un gol solo, è fortuna. Ne servono due.' },
      { who: 'hero', text: 'Due gol di scarto? Ci stiamo.' },
    ],
    win: [
      { who: 'local', text: 'Due gol di scarto. Le nonne applaudono. Succede una volta ogni dieci anni.' },
      { who: 'nina', text: 'Ci hanno regalato una focaccia grande come un pallone. Si mangia sul furgone.' },
      { who: 'gege', text: 'Diretta da Bari: Vicolo Stella conquista il Levante! Ora si attraversa il mare: Palermo!' },
    ],
    lose: [
      { who: 'local', text: 'Non basta, Napoli. Nei vicoli si vince largo o non si vince.' },
      { who: 'nina', text: 'Più tiri, meno chiacchiere. Riproviamo.' },
    ],
  },
  {
    id: 'palermo', name: 'PALERMO', lon: 13.36, lat: 38.12,
    place: 'Terrazza sopra il mercato, Palermo', pitch: 'tetto', goal: 'win', duration: 150, goldenGoal: true,
    opp: { id: 'scirocco', name: 'Scirocco Palermo', short: 'SCI', colors: kit(0xf5c400, 0xc8202a, 0xc8202a, 0x3a7bff), pattern: 'stripes', stars: 2 },
    captain: { name: 'Salvo', look: { skin: 3, hair: 0, hairStyle: 3 } },
    souvenir: { name: 'ARANCINA D\'ORO', desc: '+dribbling per tutta la squadra', stat: 'control' },
    before: [
      { who: 'title', text: 'TAPPA 3\nPALERMO' },
      { who: 'local', text: 'Salvo, Scirocco Palermo. Benvenuti sulla terrazza: sotto c\'è il mercato, sopra c\'è il vento.' },
      { who: 'local', text: 'Lo scirocco soffia da tre giorni. È il nostro dodicesimo giocatore.' },
      { who: 'nina', text: 'Guardate la freccia del vento e tirate di conseguenza. Il vento non tifa: spinge.' },
      { who: 'gege', text: 'Ehi, chi è quella ragazza in tribuna che prende appunti su di noi?' },
    ],
    win: [
      { who: 'local', text: 'Oggi lo scirocco ha cambiato squadra. Complimenti, Napoli.' },
      { who: 'vera', text: 'Niente male. Il capitano ha un buon tiro, il portiere esce tardi.' },
      { who: 'hero', text: 'E tu chi saresti?' },
      { who: 'vera', text: 'Vera. Faccio l\'osservatrice. Per chi? Non sono affari tuoi. Ci vediamo in Sardegna.' },
    ],
    lose: [
      { who: 'local', text: 'Il vento qui comanda. Imparate ad ascoltarlo.' },
      { who: 'nina', text: 'Tirate col vento alle spalle, non contro. Si rigioca.' },
    ],
  },
  {
    id: 'cagliari', name: 'CAGLIARI', lon: 9.11, lat: 39.22,
    place: 'Spiaggia del Poetto, Cagliari', pitch: 'spiaggia', goal: 'win', duration: 150, goldenGoal: true,
    opp: { id: 'maestrale', name: 'Maestrale Cagliari', short: 'MAE', colors: kit(0x1d3f8f, 0xc8202a, 0x1d3f8f, 0xffd23f), pattern: 'half', stars: 2 },
    captain: { name: 'Gavino', look: { skin: 1, hair: 1, hairStyle: 0 } },
    souvenir: { name: 'PANE CARASAU', desc: '+passaggio per tutta la squadra', stat: 'pass' },
    before: [
      { who: 'title', text: 'TAPPA 4\nCAGLIARI' },
      { who: 'gege', text: 'Traghetto, sei ore di mare, Totò ha vomitato due volte. Ma eccoci: il Poetto!' },
      { who: 'local', text: 'Gavino, Maestrale Cagliari. Sulla sabbia la palla si pianta. Le gambe pure.' },
      { who: 'toto', text: 'Io sulla sabbia sono un fenomeno. Chiedete alle ragazze del lido.' },
      { who: 'nina', text: 'Totò, chiedi meno e tira più forte. Palla bassa e veloce, ragazzi.' },
    ],
    win: [
      { who: 'local', text: 'Siete forti, gente del vicolo. Ricordatevi del Maestrale quando sarete in finale.' },
      { who: 'vera', text: 'Te l\'avevo detto: ci si vede in Sardegna. Prossima tappa, Roma. Lì ci sarà qualcuno che conosci.' },
      { who: 'hero', text: 'Ma perché ci segui?!' },
      { who: 'vera', text: 'Perché qualcuno deve pur farlo.' },
    ],
    lose: [
      { who: 'local', text: 'La sabbia non perdona. Torna quando avrai le gambe.' },
      { who: 'nina', text: 'Tirate forte e non passate lungo. Un\'altra volta.' },
    ],
  },
  {
    id: 'roma', name: 'ROMA', lon: 12.5, lat: 41.9,
    place: 'Stadio dei Pini, Roma', pitch: 'stadio', goal: 'win', duration: 150, goldenGoal: true,
    opp: { id: 'gatti', name: 'Gatti di Trastevere', short: 'GAT', colors: kit(0xb3261e, 0xf5c400, 0xb3261e, 0x29c7c7), pattern: 'sash', stars: 3 },
    captain: { name: 'Lallo', look: { skin: 0, hair: 3, hairStyle: 1 } },
    souvenir: { name: 'SAMPIETRINO', desc: '+parate per tutta la squadra', stat: 'keeping' },
    before: [
      { who: 'title', text: 'TAPPA 5\nROMA' },
      { who: 'gege', text: 'Il nostro primo stadio vero! Ci sono le tribune! E i bagni funzionano!' },
      { who: 'local', text: 'Lallo, Gatti de Trastevere. A Roma ne sono passati de conquistatori. Tutti ripartiti.' },
      { who: 'corvo', text: 'Bravi, bravi. Siete arrivati fin qui. Mi siedo in tribuna a godermi la fine del viaggio.' },
      { who: 'nina', text: '...' },
      { who: 'hero', text: 'Zia Nina? Perché guardi Corvo in quel modo?' },
      { who: 'nina', text: 'Dopo. Adesso giocate.' },
    ],
    win: [
      { who: 'local', text: 'Daje, ve lo meritate. Ma quel tizio in tribuna ve guardava storto.' },
      { who: 'hero', text: 'Zia Nina, adesso ce lo dici?' },
      { who: 'nina', text: 'Trent\'anni fa Vicolo Stella arrivò alla finale della Coppa. Il nostro numero 10 era un ragazzo magro, velocissimo.' },
      { who: 'nina', text: 'Si chiamava Corvo. Il giorno della finale non si presentò. Perdemmo a tavolino.' },
      { who: 'gege', text: 'COSA?! L\'ingegnere giocava nel vicolo?!' },
      { who: 'nina', text: 'Il giorno dopo partì per Milano con un contratto. Da allora vuole cancellare quel campetto. E quello che ricorda.' },
    ],
    lose: [
      { who: 'corvo', text: 'Vedete? Roma non si conquista in un giorno. Nemmeno in una partita.' },
      { who: 'nina', text: 'Lui non ha mai capito che si può perdere e rialzarsi. Voi sì. Di nuovo in campo.' },
    ],
  },
  {
    id: 'firenze', name: 'FIRENZE', lon: 11.25, lat: 43.77,
    place: 'Terrazza col Duomo, Firenze', pitch: 'tetto', goal: 'win', startScore: [0, 1], duration: 150, goldenGoal: true,
    opp: { id: 'gigli', name: 'Gigli di Firenze', short: 'GIG', colors: kit(0x6a2bbf, 0xf2f2f2, 0xf2f2f2, 0xff7a1a), pattern: 'plain', stars: 3 },
    captain: { name: 'Duccio', look: { skin: 0, hair: 1, hairStyle: 2 } },
    souvenir: { name: 'GIGLIO D\'ORO', desc: '+passaggio e +dribbling', stat: 'pass' },
    before: [
      { who: 'title', text: 'TAPPA 6\nFIRENZE' },
      { who: 'gege', text: 'Il furgone si è fermato a Barberino. Siamo arrivati di corsa... e la partita è già iniziata!' },
      { who: 'local', text: 'Duccio, Gigli di Firenze. Ritardo di dieci minuti: 1-0 per noi, regolamento. Che c\'è da ridere?' },
      { who: 'toto', text: 'Nessuno ride. Ma adesso vi facciamo vedere come si rimonta.' },
      { who: 'nina', text: 'Siete sotto di uno. Vincere, non pareggiare. Testa bassa e pedalare.' },
    ],
    win: [
      { who: 'local', text: 'Rimonta sotto il Duomo. Ve lo concedo: è roba da Rinascimento.' },
      { who: 'vera', text: 'Mio padre ha guardato la partita in diretta. Ha rotto il telecomando.' },
      { who: 'hero', text: 'Tuo... padre? Sei la figlia di Corvo?!' },
      { who: 'vera', text: 'Vera Corvo. Capitana della Real Corvo. Ci vediamo in finale, se ci arrivate.' },
    ],
    lose: [
      { who: 'local', text: 'Il ritardo si paga, ragazzi. Il pallone non aspetta.' },
      { who: 'nina', text: 'La prossima volta si parte all\'alba. Intanto si rigioca.' },
    ],
  },
  {
    id: 'bologna', name: 'BOLOGNA', lon: 11.34, lat: 44.49,
    place: 'Campo sotto i portici, Bologna', pitch: 'stadio', goal: 'cleanSheet', duration: 150, goldenGoal: true,
    opp: { id: 'portici', name: 'Portici Bologna', short: 'POR', colors: kit(0xc8202a, 0x1d3f8f, 0xf2f2f2, 0xf5c400), pattern: 'half', stars: 3 },
    captain: { name: 'Matilde', look: { skin: 1, hair: 2, hairStyle: 2 } },
    souvenir: { name: 'RAGÙ DELLA DOMENICA', desc: '+contrasto per tutta la squadra', stat: 'tackle' },
    before: [
      { who: 'title', text: 'TAPPA 7\nBOLOGNA' },
      { who: 'local', text: 'Matilde, Portici Bologna. Abbiamo l\'attacco più forte del torneo. Ditemi che avete un piano.' },
      { who: 'nina', text: 'Il piano è semplice: oggi non prendiamo gol. Nemmeno uno.' },
      { who: 'toto', text: 'Zia Nina, io sono un attaccante, non un muro...' },
      { who: 'nina', text: 'Oggi sei un muro, Totò. Un muro che corre.' },
    ],
    win: [
      { who: 'local', text: 'Porta inviolata contro di noi. Chapeau, Vicolo Stella.' },
      { who: 'vera', text: 'Totò, hai un minuto? Mio padre ti offre un posto nella Real Corvo. Maglia nuova, stadio vero, uno stipendio.' },
      { who: 'toto', text: '...' },
      { who: 'toto', text: 'Scusate, ragazzi. Mia madre fa due lavori. Un\'occasione così non ricapita.' },
      { who: 'hero', text: 'Totò, aspetta! Siamo a tre partite dalla Coppa!' },
      { who: 'nina', text: 'Lascialo andare. Le persone tornano, quando devono tornare.' },
      { who: 'gege', text: 'Al posto di Totò entra Mimmo, il mio cuginetto. Ha undici anni ma tira come un mulo.' },
    ],
    lose: [
      { who: 'local', text: 'Un gol l\'abbiamo trovato. Ne serviva zero.' },
      { who: 'nina', text: 'Difesa stretta, palla lontana dalla porta. Riproviamo.' },
    ],
  },
  {
    id: 'venezia', name: 'VENEZIA', lon: 12.33, lat: 45.44,
    place: 'Spiaggia del Lido, Venezia', pitch: 'spiaggia', goal: 'captainGoal', duration: 150, goldenGoal: true,
    opp: { id: 'laguna', name: 'Leoni di Laguna', short: 'LAG', colors: kit(0x1f9e4a, 0xf5c400, 0xf5c400, 0xe0457b), pattern: 'stripes', stars: 3 },
    captain: { name: 'Bepi', look: { skin: 0, hair: 5, hairStyle: 1 } },
    souvenir: { name: 'MASCHERA DI CARNEVALE', desc: 'La barra SUPER parte carica', superStart: true },
    before: [
      { who: 'title', text: 'TAPPA 8\nVENEZIA' },
      { who: 'gege', text: 'Siamo arrivati in vaporetto. Mimmo ha perso una scarpa in laguna. Ne abbiamo comprata una sinistra... ma era la destra che mancava.' },
      { who: 'local', text: 'Bepi, Leoni di Laguna. Senza il vostro numero 9 non fate più paura a nessuno.' },
      { who: 'nina', text: '{nome}, senza Totò i gol tocca farli a te. Oggi il capitano deve segnare.' },
      { who: 'hero', text: 'Allora segno io. Per il vicolo.' },
    ],
    win: [
      { who: 'local', text: 'Gol del capitano e partita vinta. Il leone si inchina, per stavolta.' },
      { who: 'gege', text: 'Brutte notizie dal vicolo: hanno parcheggiato le ruspe davanti al campetto. Corvo dice che si parte dopo la finale.' },
      { who: 'hero', text: 'Allora la finale non la perdiamo. Prima però c\'è Torino.' },
    ],
    lose: [
      { who: 'local', text: 'Il capitano non ha lasciato il segno. La laguna se lo ricorda.' },
      { who: 'nina', text: 'Cerca la porta, {nome}. Fidati del tuo tiro. Si rigioca.' },
    ],
  },
  {
    id: 'torino', name: 'TORINO', lon: 7.68, lat: 45.07,
    place: 'Campo in collina sotto la neve, Torino', pitch: 'neve', goal: 'win', duration: 150, goldenGoal: true,
    opp: { id: 'bufera', name: 'Bufera Torino', short: 'BUF', colors: kit(0x8a1a3a, 0xf2f2f2, 0xf2f2f2, 0x9bd12a), pattern: 'plain', stars: 4 },
    captain: { name: 'Gianni', look: { skin: 0, hair: 4, hairStyle: 0 } },
    souvenir: { name: 'GIANDUIOTTO', desc: '+un po\' di tutto per tutti', all: true },
    before: [
      { who: 'title', text: 'TAPPA 9\nTORINO' },
      { who: 'gege', text: 'Neve a novembre! E guardate: messaggi dai capitani che abbiamo battuto!' },
      { who: 'local', of: 1, text: 'Da Bari: fategli vedere chi sono i vicoli! Le nonne fanno il tifo per voi.' },
      { who: 'local', of: 2, text: 'Da Palermo: lo scirocco vi spinge fino a Milano!' },
      { who: 'local', of: 4, text: 'Da Roma: daje, che quel Corvo non me piaceva pe\' gnente.' },
      { who: 'local', text: 'Gianni, Bufera Torino. Bella la festa, ma sulla neve si scivola. Soprattutto chi arriva da sud.' },
    ],
    win: [
      { who: 'local', text: 'Siete in finale. Andate a Milano e fate un po\' di rumore anche per noi.' },
      { who: 'vera', text: '{nome}, aspetta. Prima della finale devo dirti una cosa.' },
      { who: 'vera', text: 'Io il parcheggio non lo voglio. Mio padre del vostro campetto parlava sempre, quando ero piccola. Era l\'unica volta che sorrideva.' },
      { who: 'hero', text: 'Allora perché giochi per lui?' },
      { who: 'vera', text: 'Perché è mio padre. E perché in finale voglio battervi davvero. O perdere davvero. Niente trucchi.' },
    ],
    lose: [
      { who: 'local', text: 'La neve ha scelto noi. Tornate con i tacchetti giusti.' },
      { who: 'nina', text: 'Passi corti e palla a terra. Ancora una volta.' },
    ],
  },
  {
    id: 'milano', name: 'MILANO', lon: 9.19, lat: 45.46,
    place: 'Corvo Arena, Milano: la finale', pitch: 'stadio', goal: 'win', duration: 180, goldenGoal: true,
    opp: { id: 'realcorvo', name: 'Real Corvo', short: 'RCO', colors: kit(0x202028, 0x9b3fd0, 0x202028, 0xf5c400), pattern: 'sash', stars: 4 },
    captain: { name: 'Vera', look: { skin: 1, hair: 0, hairStyle: 2 } },
    souvenir: { name: 'COPPA DEI CENTO CAMPANILI', desc: 'Il campetto è salvo!', all: true },
    before: [
      { who: 'title', text: 'FINALE\nCORVO ARENA' },
      { who: 'gege', text: 'Ventimila posti! Mia nonna ha portato la bandiera del vicolo. È un lenzuolo con una stella disegnata col pennarello.' },
      { who: 'corvo', text: 'Benvenuti nella mia arena. Se vincete, il campetto è vostro. Se perdete, lunedì arrivano le ruspe.' },
      { who: 'nina', text: 'Ciao, Corvo. Sono trent\'anni che aspetto questa partita.' },
      { who: 'corvo', text: '...Anch\'io, Nina.' },
      { who: 'toto', text: '{nome}, io... ne parliamo dopo. Adesso gioco per vincere.' },
      { who: 'hero', text: 'Anche noi, Totò. Anche noi.' },
    ],
    win: [
      { who: 'gege', text: 'È FINITA! VICOLO STELLA VINCE LA COPPA DEI CENTO CAMPANILI! IL CAMPETTO È SALVO!' },
      { who: 'toto', text: 'Avevate ragione. Lo stadio vero è quello sotto casa. Mi riprendete?' },
      { who: 'hero', text: 'Il tuo posto non l\'abbiamo mai dato a nessuno. Mimmo gioca in porta, tanto.' },
      { who: 'vera', text: 'Avete vinto davvero. Niente trucchi. La prossima Coppa però la vinco io.' },
      { who: 'corvo', text: 'Trent\'anni fa ho scelto i soldi invece della finale. Ci ho pensato ogni giorno.' },
      { who: 'corvo', text: 'Il parcheggio non si farà. Anzi: i fari nuovi per il campetto li pago io. Se mi fate giocare il giovedì.' },
      { who: 'nina', text: 'Te l\'avevo detto, {nome}. Le persone tornano, quando devono tornare.' },
      { who: 'title', text: 'L\'ITALIA\nÈ VOSTRA' },
    ],
    lose: [
      { who: 'corvo', text: 'Le ruspe sono già in moto.' },
      { who: 'vera', text: 'Papà, il regolamento dà diritto alla rivincita. L\'hai scritto tu, trent\'anni fa.' },
      { who: 'nina', text: 'Avete sentito? Si rigioca. E stavolta si vince.' },
    ],
  },
];

export const KITS: { name: string; colors: TeamDef['colors']; pattern: TeamDef['pattern'] }[] = [
  { name: 'NOTTE STELLATA', colors: kit(0x1d2a6b, 0xffd23f, 0x1d2a6b, 0xff7a1a), pattern: 'sash' },
  { name: 'MARE DEL GOLFO', colors: kit(0x29a9e0, 0xf2f2f2, 0xf2f2f2, 0xff5aa0), pattern: 'stripes' },
  { name: 'LIMONI', colors: kit(0xf5d13b, 0x1f7a3a, 0x1f7a3a, 0x3a7bff), pattern: 'hoops' },
  { name: 'PEPERONCINO', colors: kit(0xd8241c, 0xf5d13b, 0x202020, 0x29c7c7), pattern: 'half' },
];

export interface CqCaptain {
  name: string;
  number: number;
  look: PlayerDef['look'];
}

export type CqControl = 'solo' | 'squadra';

export interface ConquistaState {
  captain: CqCaptain;
  kit: number;
  difficulty: Difficulty;
  control: CqControl;
  /** Tappa da giocare (= città conquistate). */
  step: number;
  apps: number;
  wins: number;
  goalsFor: number;
  goalsAgainst: number;
  finished: boolean;
}

export function newConquista(captain: CqCaptain, kitIdx: number, difficulty: Difficulty, control: CqControl = 'solo'): ConquistaState {
  return { captain, kit: kitIdx, difficulty, control, step: 0, apps: 0, wins: 0, goalsFor: 0, goalsAgainst: 0, finished: false };
}

/** Città conquistate finora. */
export function conquered(s: ConquistaState): number {
  return s.finished ? CITIES.length : s.step;
}

/** Totò lascia la squadra dopo Bologna e torna solo dopo la finale. */
const TOTO_LEAVES = CITIES.findIndex((c) => c.id === 'bologna') + 1;

function totoWithUs(s: ConquistaState, step: number): boolean {
  return step < TOTO_LEAVES || (s.finished && step >= CITIES.length - 1);
}

const MATES = ['Peppe', 'Lello', 'Ciccio', 'Totò'];
const TOTO_LOOK = { skin: 2, hair: 1, hairStyle: 3 };

export function vicoloTeam(s: ConquistaState, step = s.step): TeamDef {
  const k = KITS[s.kit] ?? KITS[0];
  const t = makeTeam({ id: 'vicolo', name: 'Vicolo Stella', short: 'VST', colors: { ...k.colors }, pattern: k.pattern, stars: 2 + (step >= 4 ? 1 : 0) + (step >= 8 ? 1 : 0) }, 4242);
  t.players.forEach((p, i) => {
    if (i < 4) p.name = MATES[i];
  });
  t.players[3].look = TOTO_LOOK;
  t.players[3].stats.shot += 0.06;
  if (!totoWithUs(s, step)) {
    t.players[3] = { ...t.players[3], name: 'Mimmo', look: { skin: 2, hair: 0, hairStyle: 0 }, stats: { ...t.players[3].stats, shot: t.players[3].stats.shot - 0.04 } };
  }
  // ricordi delle città conquistate prima di questa tappa
  for (let i = 0; i < Math.min(step, CITIES.length - 1); i++) {
    const sv = CITIES[i].souvenir;
    for (const p of t.players) {
      if (sv.all) for (const key of Object.keys(p.stats) as (keyof PlayerStats)[]) p.stats[key] += 0.02;
      if (sv.stat) p.stats[sv.stat] += 0.05;
      if (CITIES[i].id === 'firenze') p.stats.control += 0.03;
    }
  }
  t.players[4] = {
    name: s.captain.name,
    number: s.captain.number,
    role: 'FWD',
    look: s.captain.look,
    stats: { ...t.players[4].stats, shot: t.players[4].stats.shot + 0.05, speed: t.players[4].stats.speed + 0.03 },
  };
  for (const p of t.players) if (p !== t.players[4] && p.name.toLowerCase() === s.captain.name.toLowerCase()) p.name += ' B.';
  return t;
}

function seedOf(id: string): number {
  let h = 11;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function cityTeam(s: ConquistaState, idx: number): TeamDef {
  const c = CITIES[idx];
  const t = makeTeam(c.opp, seedOf(c.id));
  t.players[4] = { ...t.players[4], name: c.captain.name, number: 10, look: c.captain.look, stats: { ...t.players[4].stats, shot: t.players[4].stats.shot + 0.04 } };
  if (c.id === 'milano') t.players[3] = { ...t.players[3], name: 'Totò', number: 9, look: TOTO_LOOK, stats: { ...t.players[3].stats, shot: t.players[3].stats.shot + 0.06 } };
  for (const p of t.players) if (p !== t.players[4] && p.name.toLowerCase() === s.captain.name.toLowerCase()) p.name += ' J.';
  return t;
}

/** CPU più morbida nelle prime tappe. */
export function cqDifficulty(s: ConquistaState, idx: number): Difficulty {
  if (idx < 3 && s.difficulty === 'normale') return 'facile';
  if (idx < 3 && s.difficulty === 'difficile') return 'normale';
  return s.difficulty;
}

/** Il bonus della maschera di Venezia vale dalla tappa successiva. */
function hasSuperStart(step: number): boolean {
  return CITIES.slice(0, Math.min(step, CITIES.length - 1)).some((c) => c.souvenir.superStart);
}

export function conquistaLaunch(s: ConquistaState, fixKits: (h: TeamDef, a: TeamDef) => TeamDef): MatchLaunch {
  const c = CITIES[s.step];
  const mine = vicoloTeam(s);
  const opp = cityTeam(s, s.step);
  return {
    mode: 'conquista',
    startScore: c.startScore,
    superStart: hasSuperStart(s.step) ? 0.6 : 0,
    hudGoal: `${c.name}: ${CQ_GOAL_TEXT[c.goal]}`.toUpperCase(),
    modeData: { step: s.step },
    config: {
      home: mine,
      away: fixKits(mine, opp),
      pitch: PITCHES[c.pitch],
      difficulty: cqDifficulty(s, s.step),
      durationSec: c.duration,
      powerUps: true,
      goldenGoal: c.goldenGoal,
      humanTeam: 0,
      lockHuman: s.control === 'squadra' ? undefined : 4,
    },
  };
}

export function checkCqGoal(goal: CqGoal, score: [number, number], captainGoals: number): boolean {
  const [a, b] = score;
  switch (goal) {
    case 'win':
      return a > b;
    case 'winBy2':
      return a - b >= 2;
    case 'cleanSheet':
      return a > b && b === 0;
    case 'captainGoal':
      return a > b && captainGoals >= 1;
  }
}

export interface CqReport {
  success: boolean;
  city: City;
  captainGoals: number;
  finished: boolean;
}

export function applyConquistaResult(s: ConquistaState, out: MatchOutcome): CqReport {
  const city = CITIES[s.step];
  const score = out.result.score;
  const cg = out.result.scorers.filter((x) => x.team === 0 && x.name === s.captain.name).length;
  const success = checkCqGoal(city.goal, score, cg);
  s.apps++;
  s.goalsFor += score[0];
  s.goalsAgainst += score[1];
  if (score[0] > score[1]) s.wins++;
  if (success) {
    if (s.step >= CITIES.length - 1) s.finished = true;
    else s.step++;
  }
  return { success, city, captainGoals: cg, finished: success && s.finished };
}

export function fillCq(text: string, s: ConquistaState): string {
  return text.replace(/\{nome\}/g, s.captain.name);
}

/** Personaggi dei dialoghi per una tappa. */
export function cqCast(s: ConquistaState, step: number, line: CqLine): CastMember {
  const idx = Math.min(step, CITIES.length - 1);
  switch (line.who) {
    case 'hero':
    case 'title': {
      const t = vicoloTeam(s, idx);
      return { name: s.captain.name, team: t, def: t.players[4] };
    }
    case 'toto': {
      const t = idx >= CITIES.length - 1 && !s.finished ? cityTeam(s, CITIES.length - 1) : vicoloTeam(s, Math.min(idx, TOTO_LEAVES - 1));
      return { name: 'Totò', team: t, def: { ...t.players[3], name: 'Totò', number: 9, look: TOTO_LOOK } };
    }
    case 'nina':
      return { name: 'Zia Nina', team: npcTeam('n', 0xffd23f, 0x1d2a6b, 'half'), def: npc('Nina', 0, { skin: 1, hair: 5, hairStyle: 2 }) };
    case 'gege':
      return { name: 'Gegè · Stella TV', team: npcTeam('g', 0x5be37d, 0x202028, 'stripes'), def: npc('Gegè', 0, { skin: 3, hair: 0, hairStyle: 3 }) };
    case 'corvo':
      return { name: 'Ing. Corvo', team: npcTeam('c', 0x202028, 0x9b3fd0, 'plain'), def: npc('Corvo', 0, { skin: 0, hair: 5, hairStyle: 1 }) };
    case 'vera': {
      const t = cityTeam(s, CITIES.length - 1);
      return { name: 'Vera Corvo', team: t, def: t.players[4] };
    }
    case 'local': {
      const ci = line.of ?? idx;
      const t = cityTeam(s, ci);
      return { name: `${CITIES[ci].captain.name} · ${CITIES[ci].opp.short}`, team: t, def: t.players[4] };
    }
  }
}
