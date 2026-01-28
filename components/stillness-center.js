// ==============================
// <stillness-center> — Center Button
// Modes: select → ready → playing → paused
// Tap handling only; recall gesture is handled by the app
// ==============================

import { LitElement, html, css } from 'lit';

export class StillnessCenter extends LitElement {
  static properties = {
    mode:          { type: String, reflect: true }, // select | ready | playing | paused
    timerDisplay:  { type: String },
  };

  static styles = css`
    :host {
      position: fixed;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 100;
      display: block;
    }

    .center-control {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      background: var(--bg-surface, #f0f0f0);
      border: 1px solid var(--ring-track, rgba(0, 0, 0, 0.06));
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
      -webkit-tap-highlight-color: transparent;
      touch-action: none;
    }

    .center-control:active {
      transform: scale(0.95);
    }

    :host([mode="ready"]) .center-control {
      background: var(--accent, #2a2a2a);
      border-color: var(--accent, #2a2a2a);
      transform: scale(1.1);
    }

    :host([mode="ready"]) .center-control:active {
      transform: scale(1.02);
    }

    :host([mode="playing"]) .center-control,
    :host([mode="paused"]) .center-control {
      background: var(--accent, #2a2a2a);
      border-color: var(--accent, #2a2a2a);
    }

    :host([mode="playing"]) .center-control {
      animation: breathe 4s ease-in-out infinite;
    }

    :host([mode="paused"]) .center-control {
      animation: none;
    }

    @keyframes breathe {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }

    .center-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .center-label {
      font-size: 0.55rem;
      font-weight: 600;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-muted, #888888);
      transition: color 0.3s ease;
    }

    :host([mode="ready"]) .center-label,
    :host([mode="playing"]) .center-label,
    :host([mode="paused"]) .center-label {
      color: var(--bg, #e8e8e8);
    }

    .center-timer {
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--bg, #e8e8e8);
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.05em;
    }

    .play-icon {
      width: 0;
      height: 0;
      border-style: solid;
      border-width: 9px 0 9px 15px;
      border-color: transparent transparent transparent var(--bg, #e8e8e8);
      margin-left: 4px;
      margin-bottom: 0.25rem;
    }

    .pause-icon {
      display: flex;
      gap: 4px;
      margin-bottom: 0.25rem;
    }

    .pause-icon span {
      width: 4px;
      height: 18px;
      background: var(--bg, #e8e8e8);
    }
  `;

  constructor() {
    super();
    this.mode = 'select';
    this.timerDisplay = '';
    this._touchHandled = false;
  }

  _onTouchEnd() {
    this._touchHandled = true;
    this._handleAction();
  }

  _onClick() {
    if (this._touchHandled) {
      this._touchHandled = false;
      return;
    }
    this._handleAction();
  }

  _onContextMenu(e) {
    if (this.mode === 'playing' || this.mode === 'paused') {
      e.preventDefault();
    }
  }

  _handleAction() {
    let action;
    switch (this.mode) {
      case 'select':
        action = 'confirm';
        break;
      case 'ready':
        action = 'play';
        break;
      case 'playing':
        action = 'pause';
        break;
      case 'paused':
        action = 'resume';
        break;
      default:
        action = 'confirm';
    }
    this.dispatchEvent(new CustomEvent('center-action', {
      detail: { action },
      bubbles: true, composed: true,
    }));
  }

  render() {
    return html`
      <div class="center-control"
        @click=${this._onClick}
        @touchend=${this._onTouchEnd}
        @contextmenu=${this._onContextMenu}
      >
        ${this._renderContent()}
      </div>
    `;
  }

  _renderContent() {
    switch (this.mode) {
      case 'ready':
        return html`
          <div class="center-content">
            <div class="play-icon"></div>
            <span class="center-label">Play</span>
          </div>
        `;
      case 'playing':
        return html`
          <div class="center-content">
            <div class="pause-icon"><span></span><span></span></div>
            <span class="center-timer">${this.timerDisplay}</span>
          </div>
        `;
      case 'paused':
        return html`
          <div class="center-content">
            <div class="play-icon"></div>
            <span class="center-timer">${this.timerDisplay}</span>
          </div>
        `;
      default: // 'select'
        return html`
          <div class="center-content">
            <span class="center-label">Select</span>
          </div>
        `;
    }
  }
}

customElements.define('stillness-center', StillnessCenter);
