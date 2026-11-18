import Phaser from 'phaser';
import '@fontsource/press-start-2p/latin-400.css';
import { BootScene } from './scenes/BootScene';
import { TitleScene } from './scenes/TitleScene';
import { SetupScene } from './scenes/SetupScene';
import { MatchScene } from './scenes/MatchScene';
import { HudScene } from './scenes/HudScene';
import { ResultScene } from './scenes/ResultScene';
import { TournamentScene } from './scenes/TournamentScene';
import { MissionsScene } from './scenes/MissionsScene';
import { CareerScene } from './scenes/CareerScene';
import { StoryScene } from './scenes/StoryScene';

export const GAME_H = 360;

/** Larghezza logica in base al formato dello schermo (telefoni 19.5:9 compresi). */
export function gameWidth(): number {
  const w = window.innerWidth || 640;
  const h = window.innerHeight || 360;
  const aspect = Math.max(w, h) / Math.min(w, h);
  return Math.round(Math.min(820, Math.max(560, GAME_H * aspect)) / 2) * 2;
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#14111f',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  width: gameWidth(),
  height: GAME_H,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: { activePointers: 4 },
  fps: { target: 60, min: 30 },
  scene: [BootScene, MatchScene, HudScene, TitleScene, SetupScene, ResultScene, TournamentScene, MissionsScene, CareerScene, StoryScene],
});

let resizeT: number | undefined;
window.addEventListener('resize', () => {
  window.clearTimeout(resizeT);
  resizeT = window.setTimeout(() => {
    const w = gameWidth();
    if (w !== game.scale.gameSize.width) game.scale.setGameSize(w, GAME_H);
  }, 150);
});

document.getElementById('loading')?.remove();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

(window as unknown as { __game: Phaser.Game }).__game = game;
