import Phaser from 'phaser';
import { button, COLORS, panel, shadowTxt, txt } from '../ui/ui';
import { load } from '../save/storage';
import { careerLaunch, castFor, fillName, STORY, type Line } from '../modes/career';
import { frameIndex, makePlayerSheet } from '../gfx/sprites';
import { backToScene, fixKits, startMatch } from './demo';
import { sfx } from '../audio/sfx';

export interface StoryData {
  lines: Line[];
  /** Capitolo a cui appartengono le battute (per divise e ritratti). */
  step: number;
  /** Dopo i dialoghi: si gioca la partita o si torna alla carriera. */
  then: 'match' | 'career';
}

const CPS = 45;

/** Dialoghi a fumetto tra una partita e l'altra della storia. */
export class StoryScene extends Phaser.Scene {
  private d!: StoryData;
  private idx = 0;
  private shown = 0;
  private full = '';
  private body?: Phaser.GameObjects.Text;
  private done = false;
  private lastSfx = 0;

  constructor() {
    super('story');
  }

  init(d: StoryData) {
    this.d = d;
    this.idx = 0;
    this.done = false;
  }

  create() {
    this.cameras.main.fadeIn(250, 10, 8, 20);
    this.build();
    this.input.on('pointerup', this.advance, this);
    const kb = this.input.keyboard;
    kb?.on('keydown-SPACE', this.advance, this);
    kb?.on('keydown-ENTER', this.advance, this);
    this.scale.on('resize', this.build, this);
    this.events.once('shutdown', () => {
      this.scale.off('resize', this.build, this);
      this.input.off('pointerup', this.advance, this);
      kb?.off('keydown-SPACE', this.advance, this);
      kb?.off('keydown-ENTER', this.advance, this);
    });
  }

  private get career() {
    return load().career!;
  }

  private build() {
    this.children.removeAll(true);
    this.body = undefined;
    const W = this.scale.width;
    const H = this.scale.height;
    const line = this.d.lines[this.idx];
    if (!line) return;
    const c = this.career;
    const step = STORY[Math.min(this.d.step, STORY.length - 1)];
    this.add.rectangle(0, 0, W, H, 0x0d0a1a, 0.86).setOrigin(0);
    // strisce di luce sullo sfondo
    const g = this.add.graphics();
    for (let i = 0; i < 6; i++) g.fillStyle(0x2a2050, 0.25).fillRect(((i * 157) % W) - 40, 0, 26, H);
    txt(this, 12, 12, step.place.toUpperCase(), 6, '#8a8fb0').setOrigin(0, 0.5);

    button(this, W - 44, 16, 72, 20, 'SALTA', () => this.finish(), { size: 6, color: 0x3a3d55 });

    if (line.who === 'title') {
      const parts = fillName(line.text, c.hero.name).split('\n');
      const t1 = shadowTxt(this, W / 2, H / 2 - 22, parts[0], 8, '#3fd0ff');
      const t2 = shadowTxt(this, W / 2, H / 2 + 8, parts[1] ?? '', parts[1] && parts[1].length > 14 ? 16 : 24, '#ffd23f', '#a0381e', 3);
      for (const t of [t1.c, t2.c]) {
        t.setAlpha(0);
        this.tweens.add({ targets: t, alpha: 1, duration: 500 });
      }
      t2.c.setScale(0.6);
      this.tweens.add({ targets: t2.c, scale: 1, duration: 500, ease: 'Back.easeOut' });
      txt(this, W / 2, H - 30, 'TOCCA PER CONTINUARE', 6, '#8a8fb0');
      this.full = '';
      this.shown = 0;
      sfx.fanfare();
      return;
    }

    const cast = castFor(c, this.d.step);
    const who = cast[line.who];
    const heroSide = line.who === 'hero';
    // ritratti: il protagonista a sinistra, l'altro personaggio a destra
    const other = this.findOther();
    const draw = (id: keyof typeof cast, x: number, active: boolean, flip: boolean) => {
      const m = cast[id];
      const key = `cast_${id}`;
      makePlayerSheet(this, key, m.team, m.def);
      const img = this.add.image(x, H - 120, key, frameIndex('down', 'idle')).setScale(5).setFlipX(flip);
      img.setOrigin(0.5, 1);
      if (!active) img.setTint(0x55557a).setAlpha(0.8);
      else this.tweens.add({ targets: img, y: img.y - 4, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeOut' });
    };
    draw('hero', 90, heroSide, false);
    if (other) draw(other, W - 90, !heroSide, true);

    // riquadro del dialogo
    const bx = 16;
    const by = H - 112;
    const bw = W - 32;
    const bh = 98;
    const pg = this.add.graphics();
    panel(pg, bx, by, bw, bh, 0x1b1d2e, heroSide ? COLORS.accent : 0x3fd0ff, 0.96);
    const tagX = heroSide ? bx + 10 : bx + bw - 10;
    const tag = txt(this, tagX, by - 8, who.name.toUpperCase(), 8, '#1a1222', { backgroundColor: heroSide ? '#ffd23f' : '#3fd0ff', padding: { x: 5, y: 4 } });
    tag.setOrigin(heroSide ? 0 : 1, 0.5);
    this.full = fillName(line.text, c.hero.name);
    this.shown = 0;
    this.body = txt(this, bx + 14, by + 18, '', 8, '#ffffff', { wordWrap: { width: bw - 28 }, lineSpacing: 8 }).setOrigin(0, 0);
    const more = txt(this, bx + bw - 14, by + bh - 12, '▼', 8, '#ffd23f');
    this.tweens.add({ targets: more, y: more.y + 3, duration: 350, yoyo: true, repeat: -1 });
    txt(this, W / 2, by + bh + 7, `${this.idx + 1}/${this.d.lines.length}`, 6, '#5a5f80');
  }

  /** Il personaggio (non protagonista) più vicino a questa battuta. */
  private findOther(): Exclude<Line['who'], 'hero' | 'title'> | null {
    const ls = this.d.lines;
    const cur = ls[this.idx];
    if (cur.who !== 'hero' && cur.who !== 'title') return cur.who;
    for (let i = this.idx - 1; i >= 0; i--) if (ls[i].who !== 'hero' && ls[i].who !== 'title') return ls[i].who as never;
    for (let i = this.idx + 1; i < ls.length; i++) if (ls[i].who !== 'hero' && ls[i].who !== 'title') return ls[i].who as never;
    return null;
  }

  update(_t: number, dms: number) {
    if (!this.body || this.shown >= this.full.length) return;
    const before = Math.floor(this.shown);
    this.shown = Math.min(this.full.length, this.shown + (dms / 1000) * CPS);
    const n = Math.floor(this.shown);
    if (n !== before) {
      this.body.setText(this.full.slice(0, n));
      if (this.time.now - this.lastSfx > 70 && this.full[n - 1] !== ' ') {
        this.lastSfx = this.time.now;
        sfx.blip();
      }
    }
  }

  private advance(p?: Phaser.Input.Pointer) {
    if (this.done) return;
    // i tocchi sul pulsante SALTA non fanno avanzare
    if (p && p.y < 34 && p.x > this.scale.width - 90) return;
    if (this.body && this.shown < this.full.length) {
      this.shown = this.full.length;
      this.body.setText(this.full);
      return;
    }
    this.idx++;
    if (this.idx >= this.d.lines.length) this.finish();
    else this.build();
  }

  private finish() {
    if (this.done) return;
    this.done = true;
    const c = this.career;
    if (this.d.then === 'match' && c && !c.finished) startMatch(this, careerLaunch(c, fixKits));
    else backToScene(this, 'career');
  }
}
