// Genera le icone della PWA (pixel art 32x32 ingrandita). Uso: node scripts/make-icons.cjs
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (const size of [192, 512]) {
    const data = await page.evaluate((size) => {
      const N = 32;
      const c = document.createElement('canvas');
      c.width = N; c.height = N;
      const x = c.getContext('2d');
      const px = (a, b, col) => { x.fillStyle = col; x.fillRect(a, b, 1, 1); };
      // campo a strisce
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) px(i, j, Math.floor(i / 4) % 2 ? '#48a842' : '#3d9a3a');
      for (let j = 0; j < N; j++) px(15, j, '#eff6ea'), px(16, j, '#eff6ea');
      // pallone
      const cx = 15.5, cy = 15.5, r = 9;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const d = Math.hypot(i + 0.5 - cx - 0.5, j + 0.5 - cy - 0.5);
        if (d <= r + 1.2 && d > r) px(i, j, '#1a1222');
        else if (d <= r) px(i, j, (i - cx) + (j - cy) > 5 ? '#c9cfd8' : '#fafafa');
      }
      const blob = (bx, by, rr) => {
        for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) {
          if (Math.hypot(i, j) > rr) continue;
          const a = Math.round(bx + i), b = Math.round(by + j);
          if (Math.hypot(a + 0.5 - cx - 0.5, b + 0.5 - cy - 0.5) <= r - 0.6) px(a, b, '#2a2a35');
        }
      };
      blob(16, 16, 2.3);
      for (let k = 0; k < 5; k++) {
        const ang = -Math.PI / 2 + (k * 2 * Math.PI) / 5;
        blob(16 + Math.cos(ang) * 7.5, 16 + Math.sin(ang) * 7.5, 2);
      }
      const out = document.createElement('canvas');
      out.width = size; out.height = size;
      const o = out.getContext('2d');
      o.imageSmoothingEnabled = false;
      o.drawImage(c, 0, 0, size, size);
      return out.toDataURL('image/png');
    }, size);
    require('fs').writeFileSync(path.join(__dirname, '..', 'public', 'icons', `icon-${size}.png`), Buffer.from(data.split(',')[1], 'base64'));
  }
  await browser.close();
})();
