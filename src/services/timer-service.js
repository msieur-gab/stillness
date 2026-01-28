// ==============================
// Timer Service — Drift-free countdown (EventTarget)
// ==============================

import { formatTime } from '../utils/format.js';

export class TimerService extends EventTarget {
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
    this.stop();
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

    this.dispatchEvent(new CustomEvent('tick', {
      detail: { remaining: this.remaining, formatted: formatTime(this.remaining) },
    }));

    if (remainingMs <= 0) {
      this.stop();
      this.dispatchEvent(new CustomEvent('complete'));
    }
  }
}
