import type Phaser from 'phaser';
import { TEAMS, awayKit, colorsClash } from '../data/teams';
import { PITCHES, PITCH_ORDER } from '../data/pitches';
import type { MatchLaunch } from '../modes/modes';
import type { TeamDef } from '../sim/types';

let n = 0;

/** Partita CPU contro CPU che gira dietro al menu, ogni volta su un campo diverso. */
export function demoLaunch(): MatchLaunch {
  const a = TEAMS[n % TEAMS.length];
  const b = TEAMS[(n + 3) % TEAMS.length];
  const pitch = PITCHES[PITCH_ORDER[n % PITCH_ORDER.length]];
  n++;
  return {
    mode: 'quick',
    demo: true,
    config: {
      home: a,
      away: fixKits(a, b),
      pitch,
      difficulty: 'difficile',
      durationSec: 600,
      powerUps: true,
      goldenGoal: false,
      humanTeam: null,
    },
  };
}

export function fixKits(home: TeamDef, away: TeamDef): TeamDef {
  if (colorsClash(home.colors.shirt, away.colors.shirt)) {
    const k = awayKit(away);
    if (!colorsClash(home.colors.shirt, k.colors.shirt)) return k;
  }
  return away;
}

/** Scene che si aprono sopra la partita dimostrativa. */
const OVERLAYS = ['hud', 'result', 'setup', 'title', 'tournament', 'missions', 'career', 'story', 'conquista', 'manager', 'penalties', 'album', 'club', 'settings'];

/** Torna a una schermata di menu con la partita dimostrativa sullo sfondo. */
export function backToScene(from: Phaser.Scene, key: string, data?: object) {
  const sm = from.scene;
  for (const k of OVERLAYS) if (k !== from.scene.key && sm.isActive(k)) sm.stop(k);
  const match = sm.get('match');
  match.scene.restart(demoLaunch());
  sm.launch(key, data);
  if (from.scene.key !== 'match') sm.stop();
}

/** Torna al menu principale con la partita dimostrativa sullo sfondo. */
export function backToMenu(from: Phaser.Scene) {
  backToScene(from, 'title');
}

/** Avvia una partita vera chiudendo i menu aperti. */
export function startMatch(from: Phaser.Scene, launch: MatchLaunch) {
  const sm = from.scene;
  for (const k of OVERLAYS) if (k !== from.scene.key && sm.isActive(k)) sm.stop(k);
  sm.get('match').scene.restart(launch);
  sm.stop();
}
