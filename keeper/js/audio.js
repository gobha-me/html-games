// Quiet by default; this milestone only sounds the held two-tone foghorn.
export function createHorn() {
  let context, gain;
  let muted = false;
  return {
    unlock() {
      if (!context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        context = new Audio(); gain = context.createGain(); gain.gain.value = 0;
        gain.connect(context.destination);
        for (const frequency of [110, 113]) {
          const oscillator = context.createOscillator();
          oscillator.type = 'sine'; oscillator.frequency.value = frequency;
          oscillator.connect(gain); oscillator.start();
        }
      }
      void context.resume().catch(() => {}); // Muted/unavailable audio never blocks play.
    },
    set(held) {
      if (gain) gain.gain.setTargetAtTime(held && !muted ? 0.08 : 0, context.currentTime, 0.08);
    },
    toggleMute() { muted = !muted; return muted; },
  };
}
