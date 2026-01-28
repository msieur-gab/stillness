// ==============================
// <stillness-ring> — Core Wheel Ring Component
// Handles: circular item layout, drag/touch rotation,
//          momentum, snap, highlight, selection
// ==============================

import { playTick, initAudio } from '../services/audio-service.js';
import { triggerHaptic } from '../services/haptic-service.js';

const template = document.createElement('template');
template.innerHTML = `
<style>
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

  /* During pause, selected items on expanded rings are tappable */
  :host([pause-interactive][transition-state="expanded-1"]) .ring-item.selected,
  :host([pause-interactive][transition-state="expanded-2"]) .ring-item.selected {
    pointer-events: auto;
    cursor: pointer;
    opacity: 0.7;
  }
</style>
<div class="ring-track"></div>
<div class="ring-items"></div>
`;

export class StillnessRing extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._items = [];
    this._active = false;
    this._pauseInteractive = false;
    this.highlightedIndex = 0;
    this.selectedIndex = null;
    this._transitionState = 'hidden';

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

    // Bind event handlers for the items container
    this._itemsEl = this.shadowRoot.querySelector('.ring-items');
    this._itemsEl.addEventListener('mousedown', (e) => this._onDragStart(e));
    this._itemsEl.addEventListener('touchstart', (e) => this._onDragStart(e), { passive: true });
  }

  // ---- Properties ----

  get items() {
    return this._items;
  }

  set items(val) {
    this._items = val;
    this._rotation = 0;
    this.highlightedIndex = 0;
    this._renderItems();
  }

  get active() {
    return this._active;
  }

  set active(val) {
    this._active = val;
    if (val) {
      this.setAttribute('active', '');
      requestAnimationFrame(() => this._recalculatePositions());
    } else {
      this.removeAttribute('active');
    }
  }

  get transitionState() {
    return this._transitionState;
  }

  set transitionState(val) {
    this._transitionState = val;
    this.setAttribute('transition-state', val);
    if (this._active) {
      requestAnimationFrame(() => this._recalculatePositions());
    }
  }

  get pauseInteractive() {
    return this._pauseInteractive;
  }

  set pauseInteractive(val) {
    this._pauseInteractive = val;
    if (val) {
      this.setAttribute('pause-interactive', '');
    } else {
      this.removeAttribute('pause-interactive');
    }
  }

  get _anglePerItem() {
    return this._items.length > 0 ? 360 / this._items.length : 360;
  }

  connectedCallback() {
    document.addEventListener('mousemove', this._onDocMove);
    document.addEventListener('touchmove', this._onDocMove, { passive: false });
    document.addEventListener('mouseup', this._onDocEnd);
    document.addEventListener('touchend', this._onDocEnd);
  }

  disconnectedCallback() {
    document.removeEventListener('mousemove', this._onDocMove);
    document.removeEventListener('touchmove', this._onDocMove);
    document.removeEventListener('mouseup', this._onDocEnd);
    document.removeEventListener('touchend', this._onDocEnd);
  }

  // ---- Rendering ----

  _renderItems() {
    const anglePerItem = this._anglePerItem;
    const radius = 280; // static initial radius; recalculated after layout

    this._itemsEl.innerHTML = this._items.map((item, index) => {
      const angle = (index * anglePerItem) - 90;
      const angleRad = angle * (Math.PI / 180);
      const x = Math.cos(angleRad) * radius;
      const y = Math.sin(angleRad) * radius;
      const isHighlighted = index === this.highlightedIndex;
      const isSelected = index === this.selectedIndex;

      const contentHTML = (item.value !== undefined && item.value !== null)
        ? `<span class="ring-item-value">${item.value}</span>
           <span class="ring-item-unit">${item.unit || 'min'}</span>`
        : `<span class="ring-item-label">${item.label || item.id}</span>`;

      return `
        <div class="ring-item${isHighlighted ? ' highlighted' : ''}${isSelected ? ' selected' : ''}"
             style="transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px))"
             data-index="${index}">
          <div class="ring-item-content" style="transform: rotate(${index * anglePerItem}deg)">
            ${contentHTML}
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers
    this._itemsEl.querySelectorAll('.ring-item').forEach((el) => {
      el.addEventListener('click', () => {
        this._onItemClick(parseInt(el.dataset.index, 10));
      });
    });

    // Reset container rotation
    this._itemsEl.style.transform = `rotate(${this._rotation}deg)`;
  }

  _updateItemClasses() {
    const itemEls = this._itemsEl.querySelectorAll('.ring-item');
    itemEls.forEach((el, index) => {
      el.classList.toggle('highlighted', index === this.highlightedIndex);
      el.classList.toggle('selected', index === this.selectedIndex);
    });
  }

  // ---- Position calculation ----

  _getRadius() {
    const val = getComputedStyle(this).getPropertyValue('--ring-active-radius').trim();
    if (val) {
      if (val.endsWith('vh')) return (parseFloat(val) / 100) * window.innerHeight;
      if (val.endsWith('px')) return parseFloat(val);
    }
    return this.offsetWidth / 2 || 280;
  }

  _recalculatePositions() {
    const radius = this._getRadius();
    const items = this._itemsEl.querySelectorAll('.ring-item');
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
    if (!this._active) return;

    this._isDragging = true;
    this._hasMoved = false;
    this._startX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
    this._startRotation = this._rotation;
    this._velocity = 0;
    this._lastX = this._startX;
    this._lastTime = Date.now();
    this._lastHighlightedIndex = this.highlightedIndex;

    this._itemsEl.style.transition = 'none';

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

    this._itemsEl.style.transform = `rotate(${this._rotation}deg)`;

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

    const nearestStep = Math.round(normalized / anglePerItem) % this._items.length;
    const targetRotation = nearestStep * anglePerItem;

    let diff = targetRotation - (this._rotation % 360);
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    this._rotation = this._rotation + diff;
    this.highlightedIndex = (this._items.length - nearestStep) % this._items.length;

    this._itemsEl.style.transition = 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
    this._itemsEl.style.transform = `rotate(${this._rotation}deg)`;

    this._updateItemClasses();
    this._fireHighlightChanged();
  }

  _updateHighlightFromRotation() {
    const anglePerItem = this._anglePerItem;
    let normalized = ((this._rotation % 360) + 360) % 360;
    const rawStep = Math.round(normalized / anglePerItem) % this._items.length;
    this.highlightedIndex = (this._items.length - rawStep) % this._items.length;
    this._updateItemClasses();
  }

  _onItemClick(index) {
    // Pause-edit: tap selected item on expanded ring to request activation
    if (this._pauseInteractive && !this._active) {
      this.dispatchEvent(new CustomEvent('ring-activate-request', {
        bubbles: true, composed: true,
      }));
      return;
    }
    if (!this._active) return;
    initAudio();

    const anglePerItem = this._anglePerItem;
    const targetStep = (this._items.length - index) % this._items.length;
    const targetRotation = targetStep * anglePerItem;

    let diff = targetRotation - ((this._rotation % 360) + 360) % 360;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    this._rotation += diff;
    this.highlightedIndex = index;

    this._itemsEl.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    this._itemsEl.style.transform = `rotate(${this._rotation}deg)`;

    this._feedbackTick();
    this._updateItemClasses();
    this._fireHighlightChanged();
  }

  _feedbackTick() {
    triggerHaptic('light');
    playTick();
  }

  _fireHighlightChanged() {
    this.dispatchEvent(new CustomEvent('ring-highlight-changed', {
      detail: { index: this.highlightedIndex, item: this._items[this.highlightedIndex] },
      bubbles: true, composed: true,
    }));
  }

  // ---- Public API ----

  setSelected(index) {
    this.selectedIndex = index;
    this._updateItemClasses();
  }

  clearSelected() {
    this.selectedIndex = null;
    this._updateItemClasses();
  }

  getHighlightedItem() {
    return this._items[this.highlightedIndex];
  }

  setHighlighted(index) {
    this.highlightedIndex = index;
    const anglePerItem = this._anglePerItem;
    const targetStep = (this._items.length - index) % this._items.length;
    this._rotation = targetStep * anglePerItem;
    this._itemsEl.style.transition = 'none';
    this._itemsEl.style.transform = `rotate(${this._rotation}deg)`;
    this._updateItemClasses();
  }
}

customElements.define('stillness-ring', StillnessRing);
