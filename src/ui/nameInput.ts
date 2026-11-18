/** Piccola finestra HTML per scrivere un nome (la tastiera del telefono funziona solo con un vero campo di testo). */
export function askName(current: string, max = 12): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.style.cssText =
      'position:fixed;inset:0;z-index:50;display:flex;align-items:flex-start;justify-content:center;padding-top:8vh;background:rgba(13,10,26,0.82);font-family:"Press Start 2P",monospace;';
    const box = document.createElement('form');
    box.style.cssText =
      'background:#1b1d2e;border:3px solid #ffd23f;box-shadow:4px 4px 0 #000;padding:14px;display:flex;flex-direction:column;gap:12px;width:min(86vw,360px);';
    const label = document.createElement('div');
    label.textContent = 'NOME DEL CAMPIONE';
    label.style.cssText = 'color:#ffd23f;font-size:10px;';
    const input = document.createElement('input');
    input.value = current;
    input.maxLength = max;
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.style.cssText =
      'font-family:inherit;font-size:14px;padding:10px;background:#0d0a1a;color:#fff;border:2px solid #3a3d55;outline:none;text-transform:none;';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;';
    const mk = (t: string, bg: string, fg: string) => {
      const b = document.createElement('button');
      b.textContent = t;
      b.style.cssText = `font-family:inherit;font-size:10px;padding:10px 14px;border:0;background:${bg};color:${fg};box-shadow:2px 2px 0 #000;`;
      return b;
    };
    const cancel = mk('ANNULLA', '#3a3d55', '#fff');
    cancel.type = 'button';
    const ok = mk('OK', '#5be37d', '#1a1222');
    ok.type = 'submit';
    row.append(cancel, ok);
    box.append(label, input, row);
    wrap.append(box);
    document.body.append(wrap);
    const close = (v: string | null) => {
      wrap.remove();
      resolve(v);
    };
    box.addEventListener('submit', (e) => {
      e.preventDefault();
      const v = input.value.replace(/[^\p{L}\p{N} '.-]/gu, '').trim().slice(0, max);
      close(v ? v.charAt(0).toUpperCase() + v.slice(1) : null);
    });
    cancel.addEventListener('click', () => close(null));
    setTimeout(() => {
      input.focus();
      input.select();
    }, 50);
  });
}
