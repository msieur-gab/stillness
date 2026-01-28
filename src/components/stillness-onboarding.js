// ==============================
// Stillness Onboarding Component
// Adaptive UI calibration through gesture
// ==============================

import { onboarding } from '../services/onboarding-service.js';

// Ink effect tuning
const INK = {
  STAIN_MAX_RADIUS: 45,
  STAIN_GROWTH_RATE: 2.5,
  STROKE_MAX_SPREAD: 18,
  STROKE_SPREAD_RATE: 0.35,
  AGE_FADE_RATE: 0.012,
  AGE_FADE_MIN: 0.3,
};

// Gesture detection thresholds
const GESTURE = {
  TAP_MAX_MOVEMENT: 20,
  SWIPE_MIN_DISTANCE: 50,
  SWIPE_RATIO: 1.5, // X movement must be this times greater than Y
};

class StillnessOnboarding extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // State - reversed flow: button first, then wheel
    this._phase = 'tap'; // 'tap' | 'swipe' | 'preview' | 'complete'
    this._swipeYs = [];
    this._tapYs = [];
    this._inkTrails = [];
    this._animationId = null;

    // Computed positions
    this._wheelY = 0;
    this._buttonY = 0;

    // Touch tracking
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._currentTrail = null;

    // Debug: shows average position lines
    this._showDebugLines = false;
  }

  connectedCallback() {
    this._render();
    this._setupCanvas();
    this._bindEvents();
    this._startAnimation();
  }

  disconnectedCallback() {
    if (this._animationId) {
      cancelAnimationFrame(this._animationId);
    }
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          position: fixed;
          inset: 0;
          z-index: 9999;
          background: var(--bg, #f5f5f5);
          touch-action: none;
        }

        canvas {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          filter: url(#gooey);
        }

        /* SVG filter for gooey/organic blob effect */
        .filters {
          position: absolute;
          width: 0;
          height: 0;
          overflow: hidden;
        }

        .instruction {
          position: absolute;
          top: 35%;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          color: var(--text-primary, #333);
          font-family: -apple-system, BlinkMacSystemFont, sans-serif;
          pointer-events: none;
          transition: opacity 0.5s ease;
        }

        .instruction h2 {
          font-size: 1.2rem;
          font-weight: 300;
          margin: 0 0 0.5rem 0;
          letter-spacing: 0.05em;
        }

        .instruction p {
          font-size: 0.75rem;
          color: var(--text-muted, #888);
          margin: 0;
        }

        .progress {
          display: flex;
          gap: 0.5rem;
          justify-content: center;
          margin-top: 1.5rem;
        }

        .dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--ring-track-color, #ddd);
          transition: background 0.3s ease;
        }

        .dot.filled {
          background: var(--accent, #666);
        }

        .preview-actions {
          position: absolute;
          top: 35%;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 1rem;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }

        .preview-actions.visible {
          opacity: 1;
          pointer-events: auto;
        }

        .preview-btn {
          padding: 0.8rem 1.5rem;
          border-radius: 2rem;
          font-size: 0.7rem;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: transform 0.2s, opacity 0.2s;
        }

        .preview-btn:active {
          transform: scale(0.95);
        }

        .preview-btn.redo {
          background: transparent;
          border: 1px solid var(--text-muted, #888);
          color: var(--text-muted, #888);
        }

        .preview-btn.continue {
          background: var(--text-primary, #333);
          border: 1px solid var(--text-primary, #333);
          color: var(--bg, #f5f5f5);
        }
      </style>

      <!-- SVG Gooey Filter - soft settings to preserve thin strokes -->
      <svg class="filters">
        <defs>
          <filter id="gooey">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
            <feColorMatrix in="blur" mode="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      0 0 0 6 -1" result="gooey" />
            <feComposite in="SourceGraphic" in2="gooey" operator="atop" />
          </filter>
        </defs>
      </svg>

      <canvas></canvas>

      <div class="instruction">
        <h2>Tap the screen</h2>
        <p>Where you want the play button</p>
        <div class="progress">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>

      <div class="preview-actions">
        <button class="preview-btn redo">Redo</button>
        <button class="preview-btn continue">Continue</button>
      </div>
    `;
  }

  _setupCanvas() {
    this._canvas = this.shadowRoot.querySelector('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._resizeCanvas();

    window.addEventListener('resize', () => this._resizeCanvas());
  }

  _resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this._canvas.getBoundingClientRect();
    this._canvas.width = rect.width * dpr;
    this._canvas.height = rect.height * dpr;
    this._ctx.scale(dpr, dpr);
    this._width = rect.width;
    this._height = rect.height;
  }

  _bindEvents() {
    this._canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false });
    this._canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false });
    this._canvas.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false });

    // Mouse fallback for testing
    this._canvas.addEventListener('mousedown', (e) => this._onMouseDown(e));
    this._canvas.addEventListener('mousemove', (e) => this._onMouseMove(e));
    this._canvas.addEventListener('mouseup', (e) => this._onMouseUp(e));

    // Preview action buttons
    this.shadowRoot.querySelector('.preview-btn.redo').addEventListener('click', () => this._redo());
    this.shadowRoot.querySelector('.preview-btn.continue').addEventListener('click', () => this._complete());
  }

  _onTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
    this._currentTrail = {
      points: [{ x: touch.clientX, y: touch.clientY, time: Date.now() }],
      opacity: 1,
    };
  }

  _onTouchMove(e) {
    e.preventDefault();
    if (!this._currentTrail) return;

    const touch = e.touches[0];
    this._currentTrail.points.push({
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    });
  }

  _onTouchEnd(e) {
    e.preventDefault();
    if (!this._currentTrail) return;

    const touch = e.changedTouches[0];
    this._handleGestureEnd(touch.clientY);
  }

  // Mouse fallback
  _isMouseDown = false;

  _onMouseDown(e) {
    this._isMouseDown = true;
    this._touchStartX = e.clientX;
    this._touchStartY = e.clientY;
    this._currentTrail = {
      points: [{ x: e.clientX, y: e.clientY, time: Date.now() }],
      opacity: 1,
    };
  }

  _onMouseMove(e) {
    if (!this._isMouseDown || !this._currentTrail) return;
    this._currentTrail.points.push({
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
    });
  }

  _onMouseUp(e) {
    if (!this._isMouseDown) return;
    this._isMouseDown = false;

    this._handleGestureEnd(e.clientY);
  }

  _handleGestureEnd(endY) {
    if (!this._currentTrail) return;

    const points = this._currentTrail.points;
    const deltaX = Math.abs(points[points.length - 1].x - this._touchStartX);
    const deltaY = Math.abs(points[points.length - 1].y - this._touchStartY);

    if (this._phase === 'swipe') {
      // Detect horizontal swipe
      if (deltaX > GESTURE.SWIPE_MIN_DISTANCE && deltaX > deltaY * GESTURE.SWIPE_RATIO) {
        const minY = Math.min(...points.map(p => p.y));
        this._registerSwipe(minY);
      }
    } else if (this._phase === 'tap') {
      // Detect tap (minimal movement)
      if (deltaX < GESTURE.TAP_MAX_MOVEMENT && deltaY < GESTURE.TAP_MAX_MOVEMENT) {
        this._registerTap(endY);
      }
    }

    // Add trail to list
    if (points.length > 1) {
      this._inkTrails.push(this._currentTrail);
    }
    this._currentTrail = null;
  }

  _registerTap(y) {
    // Create a tap ripple effect
    this._inkTrails.push({
      points: [{ x: this._width / 2, y: y, time: Date.now() }],
      opacity: 1,
      isTap: true,
      radius: 0,
    });

    this._tapYs.push(y);
    this._updateProgress();

    if (this._tapYs.length >= 3) {
      // Calculate average Y position
      this._buttonY = this._tapYs.reduce((a, b) => a + b, 0) / this._tapYs.length;
      this._buttonY = (this._buttonY / this._height) * 100; // Convert to percentage

      // Transition to swipe phase (wheel calibration)
      setTimeout(() => {
        this._phase = 'swipe';
        this._updateInstruction();
      }, 500);
    }
  }

  _registerSwipe(y) {
    this._swipeYs.push(y);
    this._updateProgress();

    if (this._swipeYs.length >= 3) {
      // Calculate average Y position
      this._wheelY = this._swipeYs.reduce((a, b) => a + b, 0) / this._swipeYs.length;
      this._wheelY = (this._wheelY / this._height) * 100; // Convert to percentage

      // Transition to preview phase
      setTimeout(() => {
        this._phase = 'preview';
        this._updateInstruction();
        this._showPreview();
      }, 500);
    }
  }

  _updateProgress() {
    const dots = this.shadowRoot.querySelectorAll('.dot');
    const count = this._phase === 'swipe' ? this._swipeYs.length : this._tapYs.length;
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < count);
    });
  }

  _updateInstruction() {
    const instruction = this.shadowRoot.querySelector('.instruction');
    const previewActions = this.shadowRoot.querySelector('.preview-actions');
    const dots = this.shadowRoot.querySelectorAll('.dot');

    if (this._phase === 'swipe') {
      instruction.querySelector('h2').textContent = 'Swipe horizontally';
      instruction.querySelector('p').textContent = 'Where the wheel should appear';
      dots.forEach(dot => dot.classList.remove('filled'));
    } else if (this._phase === 'preview') {
      instruction.style.opacity = '0';
      previewActions.classList.add('visible');
    }
  }

  _showPreview() {
    // Clear old trails for clean preview
    this._inkTrails = [];
  }

  _redo() {
    // Reset state
    this._phase = 'tap';
    this._swipeYs = [];
    this._tapYs = [];
    this._inkTrails = [];
    this._wheelY = 0;
    this._buttonY = 0;

    // Reset UI
    const instruction = this.shadowRoot.querySelector('.instruction');
    const previewActions = this.shadowRoot.querySelector('.preview-actions');

    instruction.querySelector('h2').textContent = 'Tap the screen';
    instruction.querySelector('p').textContent = 'Where you want the play button';
    instruction.style.opacity = '1';
    previewActions.classList.remove('visible');
    this.shadowRoot.querySelectorAll('.dot').forEach(d => d.classList.remove('filled'));

    // Clear applied layout (in case it was set)
    onboarding.clearConfig();
  }

  _complete() {
    // Save configuration
    onboarding.setConfig(this._wheelY, this._buttonY);
    onboarding.applyLayout();

    // Dispatch complete event
    this.dispatchEvent(new CustomEvent('complete', {
      detail: {
        wheelY: this._wheelY,
        buttonY: this._buttonY,
      }
    }));

    // Fade out and remove
    this.style.transition = 'opacity 0.5s ease';
    this.style.opacity = '0';
    setTimeout(() => this.remove(), 500);
  }

  _startAnimation() {
    const animate = () => {
      this._draw();
      this._animationId = requestAnimationFrame(animate);
    };
    animate();
  }

  _draw() {
    const ctx = this._ctx;
    ctx.clearRect(0, 0, this._width, this._height);

    // Draw ink trails (persist during calibration)
    this._inkTrails.forEach(trail => this._drawInkTrail(ctx, trail));

    // Draw current trail
    if (this._currentTrail && this._currentTrail.points.length > 0) {
      this._drawInkTrail(ctx, this._currentTrail);
    }

    // Debug: draw average lines (optional, hide in preview)
    if (this._showDebugLines && this._phase !== 'preview') {
      this._drawAverageLines(ctx);
    }

    // Draw styled preview
    if (this._phase === 'preview') {
      this._drawPreview(ctx);
    }
  }

  _drawAverageLines(ctx) {
    // Draw average line for button taps
    if (this._tapYs.length > 0) {
      const avgTapY = this._tapYs.reduce((a, b) => a + b, 0) / this._tapYs.length;
      ctx.beginPath();
      ctx.moveTo(this._width * 0.3, avgTapY);
      ctx.lineTo(this._width * 0.7, avgTapY);
      ctx.strokeStyle = 'rgba(0, 150, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = 'rgba(0, 150, 0, 0.8)';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillText(`btn avg: ${Math.round(avgTapY)}px`, this._width * 0.72, avgTapY - 5);
    }

    // Draw average line for wheel swipes
    if (this._swipeYs.length > 0) {
      const avgSwipeY = this._swipeYs.reduce((a, b) => a + b, 0) / this._swipeYs.length;
      ctx.beginPath();
      ctx.moveTo(0, avgSwipeY);
      ctx.lineTo(this._width, avgSwipeY);
      ctx.strokeStyle = 'rgba(150, 0, 0, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Label
      ctx.fillStyle = 'rgba(150, 0, 0, 0.8)';
      ctx.font = '10px -apple-system, sans-serif';
      ctx.fillText(`wheel avg: ${Math.round(avgSwipeY)}px`, 10, avgSwipeY - 5);
    }
  }

  _drawInkTrail(ctx, trail) {
    // Shared: age-based fade for both taps and swipes
    trail.age = (trail.age || 0) + 1;
    const ageFade = Math.max(INK.AGE_FADE_MIN, 1 - trail.age * INK.AGE_FADE_RATE);
    const opacity = trail.opacity * ageFade;

    if (trail.isTap) {
      this._drawInkStain(ctx, trail, opacity);
    } else {
      this._drawInkStroke(ctx, trail, opacity);
    }
  }

  _drawInkStain(ctx, trail, opacity) {
    if (!trail.radius) trail.radius = 5;
    if (trail.radius < INK.STAIN_MAX_RADIUS) {
      trail.radius += INK.STAIN_GROWTH_RATE * (1 - trail.radius / INK.STAIN_MAX_RADIUS);
    }

    const { x, y } = trail.points[0];
    const r = trail.radius;

    // Outer fuzzy edge
    ctx.beginPath();
    ctx.arc(x, y, r * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(60, 60, 80, ${opacity * 0.2})`;
    ctx.fill();

    // Dark ring edge - defines boundary
    ctx.beginPath();
    ctx.arc(x, y, r * 0.9, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(40, 40, 60, ${opacity * 0.25})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Core stain
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(50, 50, 70, ${opacity * 0.35})`;
    ctx.fill();

    // Dense center
    ctx.beginPath();
    ctx.arc(x, y, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(35, 35, 55, ${opacity * 0.5})`;
    ctx.fill();
  }

  _drawInkStroke(ctx, trail, opacity) {
    const points = trail.points;
    if (points.length < 2) return;

    // Spread effect over time - ink bleeds into paper
    const spread = Math.min(trail.age * INK.STROKE_SPREAD_RATE, INK.STROKE_MAX_SPREAD);

    const drawPath = () => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    };

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Layer 1: Outer glow
    drawPath();
    ctx.strokeStyle = `rgba(60, 60, 80, ${opacity * 0.18})`;
    ctx.lineWidth = 16 + spread * 2;
    ctx.stroke();

    // Layer 2: Mid spread
    drawPath();
    ctx.strokeStyle = `rgba(55, 55, 75, ${opacity * 0.3})`;
    ctx.lineWidth = 8 + spread * 1.2;
    ctx.stroke();

    // Layer 3: Core line
    drawPath();
    ctx.strokeStyle = `rgba(45, 45, 65, ${opacity * 0.5})`;
    ctx.lineWidth = 4 + spread * 0.4;
    ctx.stroke();

    // Layer 4: Dense center
    drawPath();
    ctx.strokeStyle = `rgba(35, 35, 55, ${opacity * 0.6})`;
    ctx.lineWidth = 2 + spread * 0.2;
    ctx.stroke();

    // Start blob
    const blobR = 8 + spread * 1.2;
    ctx.beginPath();
    ctx.arc(points[0].x, points[0].y, blobR, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(50, 50, 70, ${opacity * 0.4})`;
    ctx.fill();
  }

  _drawPreview(ctx) {
    const wheelYPx = (this._wheelY / 100) * this._height;
    const buttonYPx = (this._buttonY / 100) * this._height;
    const centerX = this._width / 2;

    // Wheel: radius = 50vh, center below visible arc
    const wheelRadius = this._height * 0.5;
    const wheelCenterY = wheelYPx + wheelRadius;

    // Track (thin, like real ring)
    ctx.beginPath();
    ctx.arc(centerX, wheelCenterY, wheelRadius, Math.PI * 1.15, Math.PI * 1.85);
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.4)';
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Option markers on track
    const optionCount = 5;
    for (let i = 0; i < optionCount; i++) {
      const angle = Math.PI * 1.15 + (Math.PI * 0.7 / (optionCount - 1)) * i;
      const x = centerX + Math.cos(angle) * wheelRadius;
      const y = wheelCenterY + Math.sin(angle) * wheelRadius;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = i === 2 ? 'rgba(100, 100, 100, 0.6)' : 'rgba(150, 150, 150, 0.3)';
      ctx.fill();
    }

    // Button (80px filled circle, same subtle style as arc)
    ctx.beginPath();
    ctx.arc(centerX, buttonYPx, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(180, 180, 180, 0.4)';
    ctx.fill();
  }

}

customElements.define('stillness-onboarding', StillnessOnboarding);
