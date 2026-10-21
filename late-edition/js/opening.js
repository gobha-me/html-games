import { COLD_OPEN_DURATION_SEC } from './config.js';

export const LOU_LINES = Object.freeze([
  'Lou Vance. Night desk. The city sells alibis; we sell the morning paper.',
  'The wire has a lead. Pick a reporter’s pass, then send them to that slip. Bring back names.',
  'The Herald has a head start. Your clock starts when you dispatch. Make it count.',
]);

// Presentation time is separate from edition time. No timers survive Skip or reload.
export class ColdOpen {
  constructor(reducedMotion = false) {
    this.reducedMotion = reducedMotion === true;
    this.elapsed = 0;
  }

  advance(dt) {
    if (Number.isFinite(dt) && dt > 0) {
      this.elapsed = Math.min(COLD_OPEN_DURATION_SEC, this.elapsed + dt);
    }
    return this.elapsed >= COLD_OPEN_DURATION_SEC;
  }

  get lines() {
    return LOU_LINES.map((line, index) => {
      if (this.reducedMotion) return line;
      const characters = Math.floor(Math.max(0, this.elapsed - index * 10) * 30);
      return line.slice(0, characters);
    });
  }
}
