// ==============================
// <stillness-wheel> — Transition Controller
// Manages three <stillness-ring> instances with
// progressive disclosure transitions
// ==============================

import { LitElement, html, css } from 'lit';
import './stillness-ring.js';

export class StillnessWheel extends LitElement {
  static properties = {
    stage:     { type: Number },
    modeItems: { type: Array },
    ambianceItems: { type: Array },
    durationItems: { type: Array },
  };

  static styles = css`
    :host {
      position: fixed;
      bottom: calc(-1 * var(--wheel-offset, 22vh));
      left: 50%;
      transform: translateX(-50%);
      width: 200vw;
      height: 200vw;
      pointer-events: none;
    }
  `;

  constructor() {
    super();
    this.stage = 1;
    this.modeItems = [];
    this.ambianceItems = [];
    this.durationItems = [];
  }

  get _ring1() {
    return this.renderRoot.querySelector('#ring1');
  }

  get _ring2() {
    return this.renderRoot.querySelector('#ring2');
  }

  get _ring3() {
    return this.renderRoot.querySelector('#ring3');
  }

  updated(changedProps) {
    if (changedProps.has('stage')) {
      this._applyTransitions();
    }
  }

  _applyTransitions() {
    const r1 = this._ring1;
    const r2 = this._ring2;
    const r3 = this._ring3;
    if (!r1 || !r2 || !r3) return;

    const s = this.stage;

    // Stage 5+: hide all rings (active session)
    if (s >= 5) {
      r1.active = false;
      r1.transitionState = 'hidden';
      r2.active = false;
      r2.transitionState = 'hidden';
      r3.active = false;
      r3.transitionState = 'hidden';
      return;
    }

    // Ring 1
    r1.active = s === 1;
    if (s === 1) {
      r1.transitionState = 'active';
      r1.clearSelected();
    } else if (s === 2) {
      r1.transitionState = 'expanded-1';
    } else {
      r1.transitionState = 'expanded-2';
    }

    // Ring 2
    r2.active = s === 2;
    if (s < 2) {
      r2.transitionState = 'hidden';
    } else if (s === 2) {
      r2.transitionState = 'active';
      r2.clearSelected();
    } else if (s === 3) {
      r2.transitionState = 'expanded-1';
    } else {
      r2.transitionState = 'expanded-1';
    }

    // Ring 3
    r3.active = s === 3;
    if (s < 3) {
      r3.transitionState = 'hidden';
    } else if (s === 3) {
      r3.transitionState = 'active';
      r3.clearSelected();
    } else {
      r3.transitionState = 'expanded-1';
    }

    // Recalculate active ring positions after transition
    if (s >= 1 && s <= 3) {
      const activeRing = [r1, r2, r3][s - 1];
      requestAnimationFrame(() => activeRing.recalculatePositions());
    }
  }

  getRing(level) {
    if (level === 1) return this._ring1;
    if (level === 2) return this._ring2;
    if (level === 3) return this._ring3;
    return null;
  }

  render() {
    return html`
      <stillness-ring
        id="ring1"
        .items=${this.modeItems}
        @ring-highlight-changed=${(e) => this._forward('ring-highlight-changed', e.detail)}
      ></stillness-ring>

      <stillness-ring
        id="ring2"
        .items=${this.ambianceItems}
        @ring-highlight-changed=${(e) => this._forward('ring-highlight-changed', e.detail)}
      ></stillness-ring>

      <stillness-ring
        id="ring3"
        .items=${this.durationItems}
        @ring-highlight-changed=${(e) => this._forward('ring-highlight-changed', e.detail)}
      ></stillness-ring>
    `;
  }

  _forward(name, detail) {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }
}

customElements.define('stillness-wheel', StillnessWheel);
