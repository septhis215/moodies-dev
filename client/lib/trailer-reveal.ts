/** Reveal only after uninterrupted playback; interrupted or blocked video stays covered. */
export function createTrailerReveal(onVisible: (visible: boolean) => void, isPlaying: () => boolean, delayMs = 4000) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let visible = false;
  let disposed = false;
  const hide = () => {
    clearTimeout(timer);
    timer = undefined;
    visible = false;
    if (!disposed) onVisible(false);
  };
  return {
    update(playing: boolean) {
      if (disposed) return;
      if (!playing) { hide(); return; }
      if (timer !== undefined || visible) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (disposed || !isPlaying()) return;
        visible = true;
        onVisible(true);
      }, delayMs);
    },
    dispose() { disposed = true; hide(); },
  };
}
