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
import { ConquistaScene } from './scenes/ConquistaScene';
import { ManagerScene } from './scenes/ManagerScene';
import { SettingsScene } from './scenes/SettingsScene';
import { PenaltyScene } from './scenes/PenaltyScene';
import { AlbumScene } from './scenes/AlbumScene';
import { ClubScene } from './scenes/ClubScene';
import { TrainingScene } from './scenes/TrainingScene';
import { LeggendaScene } from './scenes/LeggendaScene';
import { EpicMatchScene } from './scenes/EpicMatchScene';
import { SurvivalScene } from './scenes/SurvivalScene';
import { sfx } from './audio/sfx';
import { commentary } from './audio/commentary';

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
  scene: [BootScene, MatchScene, HudScene, TitleScene, SetupScene, ResultScene, TournamentScene, MissionsScene, SurvivalScene, CareerScene, StoryScene, ConquistaScene, ManagerScene, PenaltyScene, AlbumScene, ClubScene, TrainingScene, LeggendaScene, EpicMatchScene, SettingsScene],
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
// solo in sviluppo: accesso al gioco dalla console per le prove
if (import.meta.env.DEV) (window as unknown as { __game: Phaser.Game }).__game = game;

// il primo tocco sblocca audio e voce (richiesto dai browser dei telefoni)
const unlockAudio = () => {
  sfx.unlock();
  commentary.unlock();
  window.removeEventListener('pointerdown', unlockAudio);
  window.removeEventListener('keydown', unlockAudio);
};
window.addEventListener('pointerdown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => undefined);
  });
}

(window as unknown as { __game: Phaser.Game }).__game = game;
