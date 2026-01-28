// ==============================
// <stillness-ring> — Core Wheel Ring Component
// Handles: circular item layout, drag/touch rotation,
//          momentum, snap, highlight, selection
// ==============================

import { LitElement, html, css } from 'lit';
import { playTick, initAudio } from '../services/audio-service.js';
import { triggerHaptic } from '../services/haptic-service.js';

export class StillnessRing extends LitElement {
  static properties = {
    items:            { type: Array },
    active:           { type: Boolean, reflect: true },
    highlightedIndex: { type: Number },
    selectedIndex:    { type: Number },
    transitionState:  { type: String, reflect: true, attribute: 'transition-state' },
  };

  static styles = css`
    :host {
      position: absolute;
      bottom: 0;
      left: 50%;
      transform: translateX(-50%) translateY(50%);
      border-radius: 50%;
      width: calc(var(--ring-active-radius, 50vh) * 2);
      height: calc(var(--ring-active-radius, 50vh) * 2);
      opacity: 0;
      pointer-events: none;
      transition:
        width 0.8s cubic-bezier(0.4, 0, 0.2, 1),
        height 0.8s cubic-bezier(0.4, 0, 0.2, 1),
        opacity 0.6s ease;
    }

    :host([active]) {
      opacity: 1;
      pointer-events: auto;
      transition:
        width 0.8s cubic-bezier(0.4, 0, 0.2, 1),
        height 0.8s cubic-bezier(0.4, 0, 0.2, 1),
        opacity 0.6s ease 0.15s;
    }

    /* Expand outward states */
    :host([transition-state="expanded-1"]) {
      width: calc((var(--ring-active-radius, 50vh) + var(--ring-expansion, 22vh)) * 2);
      height: calc((var(--ring-active-radius, 50vh) + var(--ring-expansion, 22vh)) * 2);
      opacity: var(--expanded-1-opacity, 0.3);
      pointer-events: none;
    }

    :host([transition-state="expanded-2"]) {
      width: calc((var(--ring-active-radius, 50vh) + var(--ring-expansion, 22vh) * 2) * 2);
      height: calc((var(--ring-active-radius, 50vh) + var(--ring-expansion, 22vh) * 2) * 2);
      opacity: var(--expanded-2-opacity, 0.1);
      pointer-events: none;
    }

    :host([transition-state="hidden"]) {
      opacity: 0;
      pointer-events: none;
    }

    .ring-track {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 1px solid var(--ring-track, rgba(0, 0, 0, 0.06));
      background: transparent;
      transition: border-color 0.6s ease;
    }

    :host([transition-state="expanded-1"]) .ring-track,
    :host([transition-state="expanded-2"]) .ring-track {
      border-color: var(--ring-track-faded, rgba(0, 0, 0, 0.025));
    }

    .ring-items {
      position: absolute;
      width: 100%;
      height: 100%;
      transition: transform 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .ring-item {
      position: absolute;
      top: 50%;
      left: 50%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: opacity 0.5s ease;
    }

    .ring-item-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 0.5rem;
    }

    .ring-item-label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-secondary, #4a4a4a);
      transition: all 0.3s ease;
      white-space: nowrap;
    }

    .ring-item.highlighted .ring-item-label {
      color: var(--text-primary, #1a1a1a);
      transform: scale(1.15);
    }

    .ring-item-value {
      font-size: 1.5rem;
      font-weight: 300;
      color: var(--text-secondary, #4a4a4a);
      line-height: 1;
      margin-bottom: 0.1rem;
      transition: all 0.3s ease;
    }

    .ring-item.highlighted .ring-item-value {
      color: var(--text-primary, #1a1a1a);
      font-weight: 400;
    }

    .ring-item-unit {
      font-size: 0.5rem;
      font-weight: 500;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-muted, #888888);
    }

    /* Expanded items: only selected visible */
    :host([transition-state="expanded-1"]) .ring-item,
    :host([transition-state="expanded-2"]) .ring-item {
      opacity: 0.03;
      pointer-events: none;
    }

    :host([transition-state="expanded-1"]) .ring-item.selected {
      opacity: var(--expanded-1-selected-opacity, 0.4);
    }

    :host([transition-state="expanded-2"]) .ring-item.selected {
      opacity: var(--expanded-2-selected-opacity, 0.2);
    }

    :host([transition-state="expanded-1"]) .ring-item.selected .ring-item-label,
    :host([transition-state="expanded-2"]) .ring-item.selected .ring-item-label,
    :host([transition-state="expanded-1"]) .ring-item.selected .ring-item-value,
    :host([transition-state="expanded-2"]) .ring-item.selected .ring-item-value {
      color: var(--text-muted, #888888);
    }
  `;

  constructor() {
    super();
    this.items = [];
    this.active = false;
    this.highlightedIndex = 0;
    this.selectedIndex = null;
    this.transitionState = 'hidden';

    // Internal drag state
    this._rotation = 0;
    this._isDragging = false;
    this._hasMoved = false;
    this._startX = 0;
    this._startRotation = 0;
    this._velocity = 0;
    this._lastX = 0;
    this._lastTime = 0;
    this._lastHighlightedIndex = 0;

    // Bound handlers for document-level listeners
    this._onDocMove = this._onDragMove.bind(this);
    this._onDocEnd = this._onDragEnd.bind(this);
  }

  get _anglePerItem() {
    return this.items.length > 0 ? 360 / this.items.length : 360;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('mousemove', this._onDocMove);
    document.addEventListener('touchmove', this._onDocMove, { passive: false });
    document.addEventListener('mouseup', this._onDocEnd);
    document.addEventListener('touchend', this._onDocEnd);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousemove', this._onDocMove);
    document.removeEventListener('touchmove', this._onDocMove);
    document.removeEventListener('mouseup', this._onDocEnd);
    document.removeEventListener('touchend', this._onDocEnd);
  }

  _getRadius() {
    // Use the CSS variable directly instead of offsetWidth.
    // offsetWidth returns the current animated size during CSS transitions,
    // which causes items to be positioned at the wrong radius after going back.
    const val = getComputedStyle(this).getPropertyValue('--ring-active-radius').trim();
    if (val) {
      if (val.endsWith('vh')) return (parseFloat(val) / 100) * window.innerHeight;
      if (val.endsWith('px')) return parseFloat(val);
    }
    return this.offsetWidth / 2 || 280;
  }

  updated(changedProps) {
    if (changedProps.has('active') || changedProps.has('transitionState')) {
      if (this.active) {
        requestAnimationFrame(() => this._recalculatePositions());
      }
    }
    if (changedProps.has('items')) {
      // Reset rotation when items change
      this._rotation = 0;
      this.highlightedIndex = 0;
    }
  }

  _recalculatePositions() {
    const radius = this._getRadius();
    const items = this.renderRoot.querySelectorAll('.ring-item');
    const anglePerItem = this._anglePerItem;

    items.forEach((itemEl, index) => {
      const angle = (index * anglePerItem) - 90;
      const angleRad = angle * (Math.PI / 180);
      const x = Math.cos(angleRad) * radius;
      const y = Math.sin(angleRad) * radius;
      itemEl.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
    });
  }

  recalculatePositions() {
    this._recalculatePositions();
  }

  // ---- Touch / Drag handling ----

  _onDragStart(e) {
    if (!this.active) return;

    this._isDragging = true;
    this._hasMoved = false;
    this._startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    this._startRotation = this._rotation;
    this._velocity = 0;
    this._lastX = this._startX;
    this._lastTime = Date.now();
    this._lastHighlightedIndex = this.highlightedIndex;

    const container = this.renderRoot.querySelector('.ring-items');
    if (container) container.style.transition = 'none';

    initAudio();
  }

  _onDragMove(e) {
    if (!this._isDragging) return;

    const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    const deltaX = clientX - this._startX;

    if (Math.abs(deltaX) > 3) this._hasMoved = true;

    const sensitivity = 0.4;
    this._rotation = this._startRotation + (deltaX * sensitivity);

    const now = Date.now();
    const dt = now - this._lastTime;
    if (dt > 0) {
      this._velocity = (clientX - this._lastX) / dt;
    }
    this._lastX = clientX;
    this._lastTime = now;

    const container = this.renderRoot.querySelector('.ring-items');
    if (container) container.style.transform = `rotate(${this._rotation}deg)`;

    this._updateHighlightFromRotation();

    if (this.highlightedIndex !== this._lastHighlightedIndex) {
      this._feedbackTick();
      this._lastHighlightedIndex = this.highlightedIndex;
      this._fireHighlightChanged();
    }
  }

  _onDragEnd() {
    if (!this._isDragging) return;
    this._isDragging = false;

    if (!this._hasMoved) return;

    const momentum = this._velocity * 80;
    this._rotation += momentum;
    this._snapToNearest();
  }

  _snapToNearest() {
    const anglePerItem = this._anglePerItem;
    let normalized = ((this._rotation % 360) + 360) % 360;

    const nearestStep = Math.round(normalized / anglePerItem) % this.items.length;
    const targetRotation = nearestStep * anglePerItem;

    let diff = targetRotation - (this._rotation % 360);
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    this._rotation = this._rotation + diff;
    this.highlightedIndex = (this.items.length - nearestStep) % this.items.length;

    const container = this.renderRoot.querySelector('.ring-items');
    if (container) {
      container.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
      container.style.transform = `rotate(${this._rotation}deg)`;
    }

    this.requestUpdate();
    this._fireHighlightChanged();
  }

  _updateHighlightFromRotation() {
    const anglePerItem = this._anglePerItem;
    let normalized = ((this._rotation % 360) + 360) % 360;
    const rawStep = Math.round(normalized / anglePerItem) % this.items.length;
    this.highlightedIndex = (this.items.length - rawStep) % this.items.length;
    this.requestUpdate();
  }

  _onItemClick(index) {
    if (!this.active) return;
    initAudio();

    const anglePerItem = this._anglePerItem;
    const targetStep = (this.items.length - index) % this.items.length;
    const targetRotation = targetStep * anglePerItem;

    let diff = targetRotation - ((this._rotation % 360) + 360) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    this._rotation += diff;
    this.highlightedIndex = index;

    const container = this.renderRoot.querySelector('.ring-items');
    if (container) {
      container.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
      container.style.transform = `rotate(${this._rotation}deg)`;
    }

    this._feedbackTick();
    this.requestUpdate();
    this._fireHighlightChanged();
  }

  _feedbackTick() {
    triggerHaptic('light');
    playTick();
  }

  _fireHighlightChanged() {
    this.dispatchEvent(new CustomEvent('ring-highlight-changed', {
      detail: { index: this.highlightedIndex, item: this.items[this.highlightedIndex] },
      bubbles: true, composed: true,
    }));
  }

  // ---- Public API ----

  setSelected(index) {
    this.selectedIndex = index;
    this.requestUpdate();
  }

  clearSelected() {
    this.selectedIndex = null;
    this.requestUpdate();
  }

  getHighlightedItem() {
    return this.items[this.highlightedIndex];
  }

  render() {
    const anglePerItem = this._anglePerItem;
    // We use a static radius for initial layout; recalculated in updated()
    const radius = 280;

    return html`
      <div class="ring-track"></div>
      <div class="ring-items"
        @mousedown=${this._onDragStart}
        @touchstart=${(e) => this._onDragStart(e)}
      >
        ${this.items.map((item, index) => {
          const angle = (index * anglePerItem) - 90;
          const angleRad = angle * (Math.PI / 180);
          const x = Math.cos(angleRad) * radius;
          const y = Math.sin(angleRad) * radius;
          const isHighlighted = index === this.highlightedIndex;
          const isSelected = index === this.selectedIndex;

          return html`
            <div
              class="ring-item ${isHighlighted ? 'highlighted' : ''} ${isSelected ? 'selected' : ''}"
              style="transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px))"
              @click=${() => this._onItemClick(index)}
            >
              <div class="ring-item-content" style="transform: rotate(${index * anglePerItem}deg)">
                ${item.value !== undefined && item.value !== null
                  ? html`
                    <span class="ring-item-value">${item.value}</span>
                    <span class="ring-item-unit">${item.unit || 'min'}</span>
                  `
                  : html`<span class="ring-item-label">${item.label || item.id}</span>`
                }
              </div>
            </div>
          `;
        })}
      </div>
    `;
  }
}

customElements.define('stillness-ring', StillnessRing);
