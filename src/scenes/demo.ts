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

/** Torna al menu principale con la partita dimostrativa sullo sfondo. */
export function backToMenu(from: Phaser.Scene) {
  const sm = from.scene;
  for (const k of ['hud', 'result', 'setup']) if (k !== from.scene.key && sm.isActive(k)) sm.stop(k);
  const match = sm.get('match');
  match.scene.restart(demoLaunch());
  sm.launch('title');
  if (from.scene.key !== 'match') sm.stop();
}
