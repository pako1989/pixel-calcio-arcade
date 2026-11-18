/** Schermo intero + blocco orizzontale (dove il browser lo permette, es. Android). */
export function goFullscreen() {
  const el = document.documentElement;
  if (document.fullscreenElement || !el.requestFullscreen) return;
  el.requestFullscreen({ navigationUI: 'hide' })
    .then(() => {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      return o.lock?.('landscape');
    })
    .catch(() => undefined);
}

export function isTouch(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}
