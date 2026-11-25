import pkg from '../../package.json';

/** Versione dell'app sincronizzata con package.json. */
export const APP_VERSION: string = typeof __APP_VERSION__ !== 'undefined' && __APP_VERSION__ ? __APP_VERSION__ : pkg.version;
export const VERSION_TAG = `v${APP_VERSION}`;

export interface VersionEntry {
  version: string;
  items: string[];
}

export const CHANGELOG: VersionEntry[] = [
  {
    version: 'v0.9.5',
    items: [
      'Leggenda del Pallone: nuova scheda STELLE con 76 carte dei personaggi',
      'I rivali battuti nella storia si uniscono alla tua Squadra delle Stelle',
      'Buste, doppioni che fanno salire di livello e sbloccano le tecniche',
      'Intesa tra le coppie della storia e Torneo delle Stelle in 9 turni',
    ],
  },
  {
    version: 'v0.9.4',
    items: [
      'Carriera Allenatore Avanzata: scelta sponsor strategici e bonus',
      'Calciomercato avanzato con mercato prestiti e riscatto',
      'Fiducia della dirigenza (Board Confidence) e rinnovi contrattuali',
    ],
  },
  {
    version: 'v0.9.3',
    items: [
      'Campionato Nazionale Giovanile con gironi all italiana e fase finale',
      'Classifica marcatori e Trofeo Nazionale Giovanile in Leggenda del Pallone',
      'Nuovi premi in monete e Punti Leggenda per il trionfo in campionato',
    ],
  },
  {
    version: 'v0.9.2',
    items: [
      'Torneo evoluto: Coppa Lampo (4) o Pixel (8), Modulo & Capocannoniere',
      '6 nuove Missioni su Flipper, Fango e Vulcano (Al Volo) con premi monete',
      'Nuovo 4° esercizio in Allenamento: Tiro al Volo su cross laterale',
    ],
  },
  {
    version: 'v0.9.1',
    items: [
      'Portiere reattivo nei duelli 1v1 e difesa anti-autogol',
      'Moduli tattici 5v5 (1-2-1, 1-1-2, 2-1-1) in preparazione',
      'Anello visivo quando il pallone è pronto al volo / rovesciata',
    ],
  },
  {
    version: 'v0.9.0',
    items: [
      'Tiro al Volo e Rovesciata acrobatica su palle alte',
      'Moviola Replay gol in stile TV anni \'90 con marcatori',
      'Badge versione sincronizzato in Home',
    ],
  },
  {
    version: 'v0.8.0',
    items: [
      'Street World Tour in 6 tappe internazionali',
      'Campi Flipper, Campo Fangoso e Cratere Vulcano',
      'Power-up Ghiaccio, Calamita e Pallone Gigante',
    ],
  },
];
