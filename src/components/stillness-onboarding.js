// ==============================
// Stillness Onboarding Component
// Adaptive UI calibration through gesture
// ==============================

import { onboarding } from '../services/onboarding-service.js';

class StillnessOnboarding extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // State
    this._phase = 'swipe'; // 'swipe' | 'tap' | 'preview' | 'complete'
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

        .preview-text {
          position: absolute;
          bottom: 3rem;
          left: 50%;
          transform: translateX(-50%);
          text-align: center;
          color: var(--text-muted, #888);
          font-size: 0.65rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }

        .preview-text.visible {
          opacity: 1;
        }
      </style>

      <canvas></canvas>

      <div class="instruction">
        <h2>Swipe horizontally</h2>
        <p>Where your thumb naturally rests</p>
        <div class="progress">
          <div class="dot"></div>
          <div class="dot"></div>
          <div class="dot"></div>
        </div>
      </div>

      <div class="preview-text">Tap anywhere to continue</div>
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
    const deltaX = Math.abs(touch.clientX - this._touchStartX);
    const deltaY = Math.abs(touch.clientY - this._touchStartY);

    if (this._phase === 'swipe') {
      // Detect horizontal swipe (more X movement than Y)
      if (deltaX > 50 && deltaX > deltaY * 1.5) {
        this._registerSwipe(this._touchStartY);
      }
    } else if (this._phase === 'tap') {
      // Detect tap (minimal movement)
      if (deltaX < 20 && deltaY < 20) {
        this._registerTap(touch.clientY);
      }
    } else if (this._phase === 'preview') {
      this._complete();
    }

    // Add trail to fading list
    if (this._currentTrail.points.length > 1) {
      this._inkTrails.push(this._currentTrail);
    }
    this._currentTrail = null;
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

    const deltaX = Math.abs(e.clientX - this._touchStartX);
    const deltaY = Math.abs(e.clientY - this._touchStartY);

    if (this._phase === 'swipe') {
      if (deltaX > 50 && deltaX > deltaY * 1.5) {
        this._registerSwipe(this._touchStartY);
      }
    } else if (this._phase === 'tap') {
      if (deltaX < 20 && deltaY < 20) {
        this._registerTap(e.clientY);
      }
    } else if (this._phase === 'preview') {
      this._complete();
    }

    if (this._currentTrail && this._currentTrail.points.length > 1) {
      this._inkTrails.push(this._currentTrail);
    }
    this._currentTrail = null;
  }

  _registerSwipe(y) {
    this._swipeYs.push(y);
    this._updateProgress();

    if (this._swipeYs.length >= 3) {
      // Calculate average Y position
      this._wheelY = this._swipeYs.reduce((a, b) => a + b, 0) / this._swipeYs.length;
      this._wheelY = (this._wheelY / this._height) * 100; // Convert to percentage

      // Transition to tap phase
      setTimeout(() => {
        this._phase = 'tap';
        this._updateInstruction();
      }, 500);
    }
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
    const previewText = this.shadowRoot.querySelector('.preview-text');
    const dots = this.shadowRoot.querySelectorAll('.dot');

    if (this._phase === 'tap') {
      instruction.querySelector('h2').textContent = 'Tap the screen';
      instruction.querySelector('p').textContent = 'Where you want the play button';
      dots.forEach(dot => dot.classList.remove('filled'));
    } else if (this._phase === 'preview') {
      instruction.style.opacity = '0';
      previewText.classList.add('visible');
    }
  }

  _showPreview() {
    // Clear old trails for clean preview
    this._inkTrails = [];
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

    // Draw fading ink trails
    this._inkTrails = this._inkTrails.filter(trail => {
      trail.opacity -= 0.008; // Slow fade

      if (trail.opacity <= 0) return false;

      if (trail.isTap) {
        // Draw expanding ripple for taps
        trail.radius += 2;
        ctx.beginPath();
        ctx.arc(trail.points[0].x, trail.points[0].y, trail.radius, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(100, 100, 100, ${trail.opacity * 0.5})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        // Draw ink trail for swipes
        this._drawTrail(ctx, trail);
      }

      return true;
    });

    // Draw current trail
    if (this._currentTrail && this._currentTrail.points.length > 1) {
      this._drawTrail(ctx, this._currentTrail);
    }

    // Draw preview elements
    if (this._phase === 'preview') {
      this._drawPreview(ctx);
    }
  }

  _drawTrail(ctx, trail) {
    const points = trail.points;
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    // Smooth curve through points
    for (let i = 1; i < points.length - 1; i++) {
      const xc = (points[i].x + points[i + 1].x) / 2;
      const yc = (points[i].y + points[i + 1].y) / 2;
      ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }

    // Last point
    const last = points[points.length - 1];
    ctx.lineTo(last.x, last.y);

    // Ink-like appearance
    ctx.strokeStyle = `rgba(60, 60, 80, ${trail.opacity * 0.6})`;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Subtle glow
    ctx.strokeStyle = `rgba(60, 60, 80, ${trail.opacity * 0.15})`;
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  _drawPreview(ctx) {
    // wheelY is where the user swiped - where the visible arc should appear
    const wheelYPx = (this._wheelY / 100) * this._height;
    const buttonYPx = (this._buttonY / 100) * this._height;

    // The actual wheel has radius = 50vh, center is below the visible arc
    // For preview, we use viewport height as reference
    const wheelRadius = this._height * 0.5;
    const wheelCenterY = wheelYPx + wheelRadius; // Center is below the arc

    // Draw wheel arc preview (only the visible top portion)
    ctx.beginPath();
    ctx.arc(this._width / 2, wheelCenterY, wheelRadius,
            Math.PI * 1.2, Math.PI * 1.8); // ~108° to ~324° - top arc
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.25)';
    ctx.lineWidth = 35;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Draw button preview
    ctx.beginPath();
    ctx.arc(this._width / 2, buttonYPx, 40, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 100, 100, 0.15)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Button label
    ctx.fillStyle = 'rgba(100, 100, 100, 0.4)';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PLAY', this._width / 2, buttonYPx + 4);
  }
}

customElements.define('stillness-onboarding', StillnessOnboarding);
