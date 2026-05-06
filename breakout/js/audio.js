// Audio module — Web Audio API sound effects (opt-in, no external files)
const Audio = (() => {
  let ctx;

  function init() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  function play(freq, duration, type = 'square', volume = 0.15) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  return {
    init,
    hitBrick()    { play(520, 0.08, 'square', 0.12); },
    hitPaddle()   { play(330, 0.06, 'triangle', 0.1); },
    hitWall()     { play(220, 0.05, 'sine', 0.08); },
    loseLife()    { play(150, 0.3, 'sawtooth', 0.15); },
    powerup()     {
      play(440, 0.08, 'sine', 0.12);
      setTimeout(() => play(660, 0.08, 'sine', 0.12), 80);
      setTimeout(() => play(880, 0.12, 'sine', 0.12), 160);
    },
    laser()       { play(800, 0.1, 'sawtooth', 0.08); },
    explode()     {
      if (!ctx) return;
      const bufferSize = ctx.sampleRate * 0.15;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      source.connect(gain);
      gain.connect(ctx.destination);
      source.start();
    },
    levelComplete() {
      [523, 659, 784, 1047].forEach((f, i) => {
        setTimeout(() => play(f, 0.15, 'sine', 0.12), i * 100);
      });
    },
    gameOver() {
      [400, 350, 300, 200].forEach((f, i) => {
        setTimeout(() => play(f, 0.2, 'sawtooth', 0.1), i * 150);
      });
    },
    bossHit()     { play(180, 0.12, 'square', 0.15); }
  };
})();
