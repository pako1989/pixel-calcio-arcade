import Phaser from 'phaser';
import { button, panel, shadowTxt, txt, type Button } from '../ui/ui';
import { audioPrefs, load, save } from '../save/storage';
import { sfx } from '../audio/sfx';
import { commentary } from '../audio/commentary';

type VolKey = 'music' | 'sfx' | 'crowd';

/** Impostazioni audio: si apre sopra il menu o sopra la pausa. */
export class SettingsScene extends Phaser.Scene {
  constructor() {
    super('settings');
  }

  create() {
    this.build();
    this.scale.on('resize', this.rebuild, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.rebuild, this));
  }

  private rebuild() {
    this.children.removeAll(true);
    this.build();
  }

  private apply() {
    sfx.setPrefs(audioPrefs());
  }

  private build() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.add.rectangle(0, 0, W, H, 0x0a0816, 0.82).setOrigin(0).setInteractive();
    const g = this.add.graphics();
    const pw = 380;
    const ph = 330;
    const px = W / 2 - pw / 2;
    const py = H / 2 - ph / 2 - 4;
    panel(g, px, py, pw, ph, 0x1b1d2e, 0x2e3250, 0.97);
    shadowTxt(this, W / 2, py + 20, 'OPZIONI', 16, '#ffd23f');

    const rows: [VolKey, string, () => void][] = [
      ['music', 'MUSICA', () => undefined],
      ['sfx', 'EFFETTI', () => sfx.kick(0.7)],
      ['crowd', 'PUBBLICO', () => sfx.ooh()],
    ];
    let y = py + 58;
    for (const [k, label, test] of rows) {
      this.slider(px + 24, y, label, k, test);
      y += 34;
    }

    const s = load().settings;
    txt(this, px + 24, y, 'TELECRONACA', 6, '#d8dcf0').setOrigin(0, 0.5);
    const vb: Button[] = [];
    (['SÌ', 'NO'] as const).forEach((l, i) => {
      const b = button(this, px + 196 + i * 62, y, 56, 20, l, () => {
        save((d) => (d.settings.voice = i === 0));
        this.apply();
        vb.forEach((x, j) => x.setSelected(j === i));
        if (i === 0) {
          commentary.unlock();
          setTimeout(() => commentary.say('goal', 'Pixel'), 150);
        } else commentary.stop();
        note.setVisible(i === 0 && !commentary.available);
      }, { size: 6 });
      b.setSelected(i === 0 ? s.voice : !s.voice);
      vb.push(b);
    });
    const note = txt(this, W / 2, y + 16, 'Voce italiana non trovata su questo dispositivo', 6, '#ff9a5a').setVisible(s.voice && !commentary.available);
    y += 38;

    txt(this, px + 24, y, 'TUTTO L\'AUDIO', 6, '#d8dcf0').setOrigin(0, 0.5);
    const mb: Button[] = [];
    (['SÌ', 'NO'] as const).forEach((l, i) => {
      const b = button(this, px + 196 + i * 62, y, 56, 20, l, () => {
        save((d) => (d.settings.muted = i === 1));
        this.apply();
        mb.forEach((x, j) => x.setSelected(j === i));
        if (i === 1) commentary.stop();
      }, { size: 6 });
      b.setSelected(i === 0 ? !s.muted : s.muted);
      mb.push(b);
    });
    y += 32;

    // regola di gioco: falli, cartellini e infortuni; oppure solo i rigori per le scivolate da dietro in area
    txt(this, px + 24, y, 'FALLI E RIGORI', 6, '#d8dcf0').setOrigin(0, 0.5);
    const fb: Button[] = [];
    const FOUL_NOTES = [
      'Gialli, rossi (30 s fuori), infortuni e rigori in area',
      'Solo rigori: scivolata da dietro in area = dal dischetto',
      'Niente falli e niente rigori in partita',
    ];
    const foulSel = () => (s.fouls ? 0 : s.penaltyKicks !== false ? 1 : 2);
    const fnote = txt(this, W / 2, y + 15, FOUL_NOTES[foulSel()], 6, '#8a8fb0');
    (['SÌ', 'RIGORI', 'NO'] as const).forEach((l, i) => {
      const b = button(this, px + 196 + i * 58 - 4, y, 54, 20, l, () => {
        save((d) => {
          d.settings.fouls = i === 0;
          d.settings.penaltyKicks = i !== 2;
        });
        fb.forEach((x, j) => x.setSelected(j === i));
        fnote.setText(FOUL_NOTES[i]);
      }, { size: i === 1 ? 5 : 6 });
      b.setSelected(i === foulSel());
      fb.push(b);
    });
    y += 36;

    // supermosse stile anime
    txt(this, px + 24, y, 'SUPERMOSSE', 6, '#d8dcf0').setOrigin(0, 0.5);
    const sb: Button[] = [];
    (['SÌ', 'NO'] as const).forEach((l, i) => {
      const b = button(this, px + 196 + i * 62, y, 56, 20, l, () => {
        save((d) => (d.settings.specials = i === 0));
        sb.forEach((x, j) => x.setSelected(j === i));
      }, { size: 6 });
      b.setSelected(i === 0 ? s.specials !== false : s.specials === false);
      sb.push(b);
    });
    txt(this, W / 2, y + 15, 'Tasto SUPER: tiri speciali, combo e parate a barra piena', 6, '#8a8fb0');

    button(this, W / 2, py + ph - 22, 140, 26, 'FATTO', () => this.scene.stop(), { color: 0x2f8be0 });
  }

  private slider(x: number, y: number, label: string, key: VolKey, test: () => void) {
    txt(this, x, y, label, 6, '#d8dcf0').setOrigin(0, 0.5);
    const g = this.add.graphics();
    const bx = x + 118;
    const n = 10;
    const bw = 14;
    const val = () => Math.round(load().settings[key] * n);
    const pct = txt(this, bx + n * (bw + 2) + 44, y, '', 6, '#8a8fb0').setOrigin(1, 0.5);
    const draw = () => {
      g.clear();
      const v = val();
      for (let i = 0; i < n; i++) {
        const on = i < v;
        const h = 6 + i;
        g.fillStyle(0x1a1222).fillRect(bx + i * (bw + 2) - 1, y + 8 - h - 1, bw + 2, h + 2);
        g.fillStyle(on ? (i < 7 ? 0x5be37d : 0xffd23f) : 0x3a3d55).fillRect(bx + i * (bw + 2), y + 8 - h, bw, h);
      }
      pct.setText(v === 0 ? 'NO' : `${v * 10}%`);
    };
    const set = (v: number) => {
      v = Math.max(0, Math.min(n, v));
      save((d) => (d.settings[key] = v / n));
      this.apply();
      draw();
      test();
    };
    // zona toccabile sopra le barre: si può anche trascinare
    const zw = n * (bw + 2);
    const zone = this.add.zone(bx + zw / 2, y + 1, zw + 10, 26).setInteractive({ useHandCursor: true });
    const pick = (p: Phaser.Input.Pointer) => {
      const i = Math.floor((p.x - bx) / (bw + 2));
      const v = i < 0 ? 0 : Math.min(n, i + 1);
      if (v !== val()) set(v);
    };
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => {
      sfx.unlock();
      pick(p);
    });
    zone.on('pointermove', (p: Phaser.Input.Pointer) => p.isDown && pick(p));
    button(this, bx - 18, y, 18, 18, '-', () => set(val() - 1), { size: 6 });
    draw();
  }
}
