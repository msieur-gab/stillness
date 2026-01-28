// ==============================
// Session Service — State machine
//
// States: idle → selecting → playing → paused → completing → idle
//                    ↑          ↓         ↓
//                    └── editing ←────────┘
//
// The session service is the single source of truth.
// All UI reacts to state-change events.
// ==============================

const VALID_TRANSITIONS = {
  idle:       ['selecting'],
  selecting:  ['playing'],
  playing:    ['paused', 'editing', 'completing'],
  paused:     ['playing', 'editing'],
  editing:    ['selecting'],
  completing: ['idle'],
};

export class SessionService extends EventTarget {
  constructor() {
    super();
    this._state = 'idle';
    this.level = 1;           // 1=mode, 2=ambiance, 3=duration
    this.mode = null;
    this.ambiance = null;
    this.duration = null;
  }

  get state() {
    return this._state;
  }

  // ---- Transitions ----

  /**
   * Transition to a new state. Emits 'state-change' with { from, to, context }.
   * Throws if transition is invalid.
   */
  transition(to, context = {}) {
    const from = this._state;
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed || !allowed.includes(to)) {
      console.warn(`Session: invalid transition ${from} → ${to}`);
      return;
    }
    this._state = to;
    this.dispatchEvent(new CustomEvent('state-change', {
      detail: { from, to, ...context },
    }));
  }

  // ---- High-level actions ----

  /** Start selection flow from level 1 */
  begin() {
    this.level = 1;
    this.mode = null;
    this.ambiance = null;
    this.duration = null;
    this.transition('selecting');
  }

  /** Confirm current ring and advance level, or start playing */
  select(ringNumber, item) {
    if (ringNumber === 1) {
      this.mode = item;
      this.level = 2;
      this.dispatchEvent(new CustomEvent('level-change', {
        detail: { level: 2 },
      }));
    } else if (ringNumber === 2) {
      this.ambiance = item;
      this.level = 3;
      this.dispatchEvent(new CustomEvent('level-change', {
        detail: { level: 3 },
      }));
    } else if (ringNumber === 3) {
      this.duration = item;
      this.transition('playing');
    }
  }

  /** Navigate back one level during selection */
  back() {
    if (this._state !== 'selecting' || this.level <= 1) return;
    if (this.level === 3) this.duration = null;
    else if (this.level === 2) this.ambiance = null;
    this.level--;
    this.dispatchEvent(new CustomEvent('level-change', {
      detail: { level: this.level },
    }));
  }

  /** Jump to a specific level (for header taps during selection) */
  goToLevel(l) {
    if (this._state !== 'selecting') return;
    if (l >= this.level) return; // can only go backwards
    // Clear selections after target level
    if (l <= 2) this.duration = null;
    if (l <= 1) this.ambiance = null;
    this.level = l;
    this.dispatchEvent(new CustomEvent('level-change', {
      detail: { level: l },
    }));
  }

  /** Pause active session */
  pause() {
    this.transition('paused');
  }

  /** Resume paused session */
  resume() {
    this.transition('playing');
  }

  /** Enter edit mode (long-press or header tap during session) */
  edit(targetLevel = 3) {
    this.transition('editing', { targetLevel });
    // Editing transitions immediately into selecting at the target level
    this.level = targetLevel;
    this.transition('selecting');
    this.dispatchEvent(new CustomEvent('level-change', {
      detail: { level: targetLevel },
    }));
  }

  /** Session timer completed */
  complete() {
    this.transition('completing');
  }

  /** Return to idle after completion delay */
  reset() {
    this.transition('idle');
    this.level = 1;
    this.mode = null;
    this.ambiance = null;
    this.duration = null;
  }
}
