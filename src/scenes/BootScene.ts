import Phaser from 'phaser';
import { makeBall, makeCommonTextures } from '../gfx/sprites';
import { load } from '../save/storage';
import { sfx } from '../audio/sfx';
import { demoLaunch } from './demo';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }
  async create() {
    try {
      await Promise.race([
        Promise.all([document.fonts.load('8px "Press Start 2P"'), document.fonts.load('16px "Press Start 2P"')]),
        new Promise((r) => setTimeout(r, 2500)),
      ]);
    } catch {
      /* si prosegue con il font di riserva */
    }
    makeCommonTextures(this);
    makeBall(this);
    sfx.setMuted(load().settings.muted);
    this.scene.start('match', demoLaunch());
    this.scene.launch('title');
  }
}
