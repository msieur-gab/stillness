// ==============================
// <stillness-ring> — Lit Web Component
// Rotary selector: drag/touch rotation, momentum, snap,
// highlight, confirm. Pure interaction primitive.
//
// Properties:
//   items   Array   — Items to display. Each item is an object:
//                     { label }          → renders as text label
//                     { value, unit }    → renders as value + unit subtitle
//   active  Boolean — Enables interaction + visibility (reflected attribute)
//
// Events:
//   highlight-change  { index, item }  — During rotation / snap
//   item-selected     { index, item }  — On confirm (auto or manual)
//
// Public API:
//   confirmSelection()    — Confirm highlighted item as selected
//   setHighlighted(index) — Jump to index without animation
//   setSelected(index)    — Mark an item as selected (visual only)
//   clearSelected()       — Clear selected state
//   recalculate()         — Reposition items from current size
//
// CSS custom properties:
//   --ring-size          — Width & height (default: 100vh)
//   --ring-track-color   — Track circle border color
//   --text-primary       — Highlighted item text
//   --text-secondary     — Default item text
//   --text-muted         — Unit text
//
// Positioning:
//   The component has no positioning opinion. Place it with
//   external CSS on the tag. Items distribute along a radius
//   derived from the element's own width.
//
//   Example — half-wheel anchored at bottom of a container:
//
//     .wheel-container {
//       position: fixed;
//       bottom: -22vh;
//       left: 50%;
//       transform: translateX(-50%);
//       width: 200vw;
//       height: 200vw;
//     }
//
//     stillness-ring {
//       position: absolute;
//       bottom: 0;
//       left: 50%;
//       transform: translateX(-50%) translateY(50%);
//       --ring-size: 100vh;
//     }
//
// ==============================

import { LitElement, html, css } from 'lit';

export class StillnessRing extends LitElement {
  static properties = {
    items:  { type: Array },
    active: { type: Boolean, reflect: true },
  };

  static styles = css`
    :host {
      display: block;
      border-radius: 50%;
      width: var(--ring-size, 100vh);
      height: var(--ring-size, 100vh);
      opacity: 0;
      pointer-events: none;
      transition:
        opacity 0.5s ease,
        width 0.6s cubic-bezier(0.4, 0, 0.2, 1),
        height 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    :host([active]) {
      opacity: 1;
      pointer-events: auto;
    }

    .track {
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 1px solid var(--ring-track-color, rgba(0, 0, 0, 0.06));
    }

    .items {
      position: absolute;
      width: 100%;
      height: 100%;
    }

    .item {
      position: absolute;
      top: 50%;
      left: 50%;
      cursor: pointer;
      transition: opacity 0.4s ease;
    }

    .item-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 0.5rem;
    }

    .item-label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: var(--text-secondary, #4a4a4a);
      white-space: nowrap;
      transition: color 0.3s, transform 0.3s;
    }

    .item.highlighted .item-label {
      color: var(--text-primary, #1a1a1a);
      transform: scale(1.15);
    }

    .item-value {
      font-size: 1.5rem;
      font-weight: 300;
      color: var(--text-secondary, #4a4a4a);
      line-height: 1;
      transition: color 0.3s, font-weight 0.3s;
    }

    .item.highlighted .item-value {
      color: var(--text-primary, #1a1a1a);
      font-weight: 400;
    }

    .item-unit {
      font-size: 0.5rem;
      font-weight: 500;
      letter-spacing: 0.15em;
      text-transform: uppercase;
      color: var(--text-muted, #888);
    }
  `;

  constructor() {
    super();
    this.items = [];
    this.active = false;

    this._highlightedIndex = 0;
    this._selectedIndex = null;
    this._rotation = 0;
    this._autoConfirmTimer = null;

    // Drag state
    this._dragging = false;
    this._moved = false;
    this._startX = 0;
    this._startRotation = 0;
    this._velocity = 0;
    this._lastX = 0;
    this._lastTime = 0;
    this._lastHighlight = 0;

    this._onMove = this._onDragMove.bind(this);
    this._onEnd = this._onDragEnd.bind(this);
  }

  // ---- Public getters ----

  get highlightedIndex() { return this._highlightedIndex; }
  get highlightedItem()  { return this.items[this._highlightedIndex] || null; }
  get selectedIndex()    { return this._selectedIndex; }
  get selectedItem()     { return this._selectedIndex !== null ? this.items[this._selectedIndex] : null; }

  // ---- Public API ----

  confirmSelection() {
    if (this._autoConfirmTimer) {
      clearTimeout(this._autoConfirmTimer);
      this._autoConfirmTimer = null;
    }
    this._selectedIndex = this._highlightedIndex;
    this._updateClasses();
    this._emit('item-selected', { index: this._selectedIndex, item: this.selectedItem });
  }

  setHighlighted(index) {
    this._highlightedIndex = index;
    const step = (this.items.length - index) % this.items.length;
    this._rotation = step * this._anglePerItem;
    this._applyRotation(false);
    this._updateClasses();
  }

  setSelected(index) {
    this._selectedIndex = index;
    this._updateClasses();
  }

  clearSelected() {
    this._selectedIndex = null;
    this._updateClasses();
  }

  recalculate() {
    this._recalcPositions();
    this._applyRotation(false);
  }

  // ---- Lifecycle ----

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('mousemove', this._onMove);
    document.addEventListener('touchmove', this._onMove, { passive: true });
    document.addEventListener('mouseup', this._onEnd);
    document.addEventListener('touchend', this._onEnd);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('mousemove', this._onMove);
    document.removeEventListener('touchmove', this._onMove);
    document.removeEventListener('mouseup', this._onEnd);
    document.removeEventListener('touchend', this._onEnd);
  }

  firstUpdated() {
    this._itemsEl = this.shadowRoot.querySelector('.items');
    this._renderItems();
  }

  updated(changed) {
    if (changed.has('items')) {
      this._rotation = 0;
      this._highlightedIndex = 0;
      this._renderItems();
    }
    if (changed.has('active') && this.active) {
      requestAnimationFrame(() => this._recalcPositions());
    }
  }

  render() {
    return html`
      <div class="track"></div>
      <div class="items"
        @mousedown=${this._onDragStart}
        @touchstart=${this._onDragStart}
      ></div>
    `;
  }

  // ---- Internal rendering ----

  get _anglePerItem() {
    return this.items.length ? 360 / this.items.length : 360;
  }

  _renderItems() {
    if (!this._itemsEl) return;
    this._itemsEl.innerHTML = '';
    const angle = this._anglePerItem;

    this.items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'item';
      el.dataset.index = i;

      const content = document.createElement('div');
      content.className = 'item-content';
      content.style.transform = `rotate(${i * angle}deg)`;

      if (item.value != null) {
        content.innerHTML =
          `<span class="item-value">${item.value}</span>` +
          `<span class="item-unit">${item.unit || ''}</span>`;
      } else {
        content.innerHTML =
          `<span class="item-label">${item.label || item.id}</span>`;
      }

      el.appendChild(content);
      el.addEventListener('click', () => this._onItemClick(i));
      this._itemsEl.appendChild(el);
    });

    this._recalcPositions();
    this._updateClasses();
    this._applyRotation(false);
  }

  _recalcPositions() {
    if (!this._itemsEl) return;
    const radius = this._getRadius();
    const angle = this._anglePerItem;

    this._itemsEl.querySelectorAll('.item').forEach((el, i) => {
      const a = (i * angle - 90) * Math.PI / 180;
      el.style.transform =
        `translate(calc(-50% + ${Math.cos(a) * radius}px), calc(-50% + ${Math.sin(a) * radius}px))`;
    });
  }

  _getRadius() {
    const w = this.offsetWidth;
    return w ? w / 2 : window.innerHeight * 0.5;
  }

  _updateClasses() {
    if (!this._itemsEl) return;
    this._itemsEl.querySelectorAll('.item').forEach((el, i) => {
      el.classList.toggle('highlighted', i === this._highlightedIndex);
      el.classList.toggle('selected', i === this._selectedIndex);
    });
  }

  _applyRotation(animate) {
    if (!this._itemsEl) return;
    this._itemsEl.style.transition = animate
      ? 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
      : 'none';
    this._itemsEl.style.transform = `rotate(${this._rotation}deg)`;
  }

  // ---- Drag handling ----

  _onDragStart(e) {
    if (!this.active) return;
    this._dragging = true;
    this._moved = false;
    this._startX = e.touches ? e.touches[0].clientX : e.clientX;
    this._startRotation = this._rotation;
    this._velocity = 0;
    this._lastX = this._startX;
    this._lastTime = Date.now();
    this._lastHighlight = this._highlightedIndex;
    this._applyRotation(false);
  }

  _onDragMove(e) {
    if (!this._dragging) return;
    const x = e.touches ? e.touches[0].clientX : e.clientX;
    const dx = x - this._startX;
    if (Math.abs(dx) > 3) this._moved = true;

    this._rotation = this._startRotation + dx * 0.4;

    const now = Date.now();
    const dt = now - this._lastTime;
    if (dt > 0) this._velocity = (x - this._lastX) / dt;
    this._lastX = x;
    this._lastTime = now;

    this._applyRotation(false);
    this._updateHighlight();

    if (this._highlightedIndex !== this._lastHighlight) {
      this._emit('highlight-change', { index: this._highlightedIndex, item: this.highlightedItem });
      this._lastHighlight = this._highlightedIndex;
    }
  }

  _onDragEnd() {
    if (!this._dragging) return;
    this._dragging = false;
    if (!this._moved) return;
    this._rotation += this._velocity * 80;
    this._snap();
  }

  _snap() {
    const angle = this._anglePerItem;
    const norm = ((this._rotation % 360) + 360) % 360;
    const step = Math.round(norm / angle) % this.items.length;
    const target = step * angle;

    let diff = target - (this._rotation % 360);
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    this._rotation += diff;
    this._highlightedIndex = (this.items.length - step) % this.items.length;

    this._applyRotation(true);
    this._updateClasses();
    this._emit('highlight-change', { index: this._highlightedIndex, item: this.highlightedItem });
  }

  _updateHighlight() {
    const angle = this._anglePerItem;
    const norm = ((this._rotation % 360) + 360) % 360;
    const step = Math.round(norm / angle) % this.items.length;
    this._highlightedIndex = (this.items.length - step) % this.items.length;
    this._updateClasses();
  }

  _onItemClick(index) {
    if (!this.active) return;
    const angle = this._anglePerItem;
    const step = (this.items.length - index) % this.items.length;
    const target = step * angle;

    let norm = ((this._rotation % 360) + 360) % 360;
    let diff = target - norm;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;

    this._rotation += diff;
    this._highlightedIndex = index;
    this._applyRotation(true);
    this._updateClasses();

    // Auto-confirm after 300ms (debounced)
    if (this._autoConfirmTimer) clearTimeout(this._autoConfirmTimer);
    this._autoConfirmTimer = setTimeout(() => {
      this._autoConfirmTimer = null;
      this.confirmSelection();
    }, 300);
  }

  // ---- Events ----

  _emit(name, detail) {
    this.dispatchEvent(new CustomEvent(name, {
      detail, bubbles: true, composed: true,
    }));
  }
}

customElements.define('stillness-ring', StillnessRing);
