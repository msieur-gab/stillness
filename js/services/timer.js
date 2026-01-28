// ==============================
// Timer — Countdown Engine (plain EventTarget)
// Uses Date.now() delta tracking for drift-free timing
// No visible UI — fires events for parent to consume
// ==============================

export class Timer extends EventTarget {
  constructor() {
    super();
    this.running = false;
    this.duration = 0;
    this.remaining = 0;

    this._startTime = 0;
    this._pausedElapsed = 0;
    this._intervalId = null;
  }

  start(durationSeconds) {
    this.duration = durationSeconds;
    this.remaining = durationSeconds;
    this._pausedElapsed = 0;
    this._startTime = Date.now();
    this.running = true;
    this._startInterval();
  }

  pause() {
    if (!this.running) return;
    this._pausedElapsed += Date.now() - this._startTime;
    this.running = false;
    this._clearInterval();
  }

  resume() {
    if (this.running) return;
    this._startTime = Date.now();
    this.running = true;
    this._startInterval();
  }

  stop() {
    this.running = false;
    this._pausedElapsed = 0;
    this._clearInterval();
  }

  _startInterval() {
    this._clearInterval();
    this._intervalId = setInterval(() => this._tick(), 500);
  }

  _clearInterval() {
    if (this._intervalId) {
      clearInterval(this._intervalId);
      this._intervalId = null;
    }
  }

  _tick() {
    const totalElapsed = this._pausedElapsed + (Date.now() - this._startTime);
    const remainingMs = Math.max(0, (this.duration * 1000) - totalElapsed);
    this.remaining = Math.ceil(remainingMs / 1000);

    this.dispatchEvent(new CustomEvent('timer-tick', {
      detail: { remaining: this.remaining, formatted: this.formatTime(this.remaining) },
    }));

    if (remainingMs <= 0) {
      this.stop();
      this.dispatchEvent(new CustomEvent('timer-complete'));
    }
  }

  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
