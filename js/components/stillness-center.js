// ==============================
// <stillness-center> — Center Button
// Modes: select → ready → playing → paused
// Tap handling only; recall gesture is handled by the app
// ==============================

const template = document.createElement('template');
template.innerHTML = `
<style>
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
</style>
<div class="center-control">
  <div class="center-content">
    <span class="center-label">Select</span>
  </div>
</div>
`;

export class StillnessCenter extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._mode = 'select';
    this._timerDisplay = '';
    this._touchHandled = false;

    const control = this.shadowRoot.querySelector('.center-control');
    control.addEventListener('touchend', () => this._onTouchEnd());
    control.addEventListener('click', () => this._onClick());
    control.addEventListener('contextmenu', (e) => this._onContextMenu(e));
  }

  // ---- Properties ----

  get mode() {
    return this._mode;
  }

  set mode(val) {
    this._mode = val;
    this.setAttribute('mode', val);
    this._updateContent();
  }

  get timerDisplay() {
    return this._timerDisplay;
  }

  set timerDisplay(val) {
    this._timerDisplay = val;
    this._updateTimerText();
  }

  // ---- Rendering ----

  _updateContent() {
    const content = this.shadowRoot.querySelector('.center-content');
    switch (this._mode) {
      case 'ready':
        content.innerHTML = `
          <div class="play-icon"></div>
          <span class="center-label">Play</span>
        `;
        break;
      case 'playing':
        content.innerHTML = `
          <div class="pause-icon"><span></span><span></span></div>
          <span class="center-timer">${this._timerDisplay}</span>
        `;
        break;
      case 'paused':
        content.innerHTML = `
          <div class="play-icon"></div>
          <span class="center-timer">${this._timerDisplay}</span>
        `;
        break;
      default: // 'select'
        content.innerHTML = `
          <span class="center-label">Select</span>
        `;
        break;
    }
  }

  _updateTimerText() {
    const timerEl = this.shadowRoot.querySelector('.center-timer');
    if (timerEl) {
      timerEl.textContent = this._timerDisplay;
    }
  }

  // ---- Event handling ----

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
    if (this._mode === 'playing' || this._mode === 'paused') {
      e.preventDefault();
    }
  }

  _handleAction() {
    let action;
    switch (this._mode) {
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
}

customElements.define('stillness-center', StillnessCenter);
