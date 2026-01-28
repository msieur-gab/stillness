// ==============================
// <stillness-app> — Root Orchestrator
// Full session lifecycle, audio integration, dimming,
// wake lock, media session, mode-dependent endings,
// settings recall (swipe-up / long-press), dark mode,
// header breadcrumbs
// ==============================

import { LitElement, html, css, svg } from 'lit';
import { MODES, AMBIANCES, DURATIONS } from '../data/config.js';
import {
  initAudio, loadAmbiance, startAmbiance, stopAmbiance,
  suspendAudio, resumeAudio, fadeAmbiance,
  primeChime, playChime,
} from '../services/audio-service.js';
import { triggerHaptic } from '../services/haptic-service.js';
import './stillness-wheel.js';
import './stillness-center.js';
import './stillness-timer.js';

export class StillnessApp extends LitElement {
  static properties = {
    _stage:           { state: true }, // 1-6
    _selectedMode:    { state: true },
    _selectedAmbiance:{ state: true },
    _selectedDuration:{ state: true },
    _centerMode:      { state: true }, // select|ready|playing|paused
    _timerDisplay:    { state: true },
    _dimmed:          { state: true },
    _settingsRecall:  { state: true },
    _dark:            { state: true },
  };

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      --bg: #e8e8e8;
      --bg-surface: #f0f0f0;
      --text-primary: #1a1a1a;
      --text-secondary: #4a4a4a;
      --text-muted: #888888;
      --ring-track: rgba(0, 0, 0, 0.06);
      --ring-track-faded: rgba(0, 0, 0, 0.025);
      --accent: #2a2a2a;
      --wheel-offset: 22vh;
      --ring-active-radius: 50vh;
      --ring-expansion: 22vh;
      background: var(--bg);
      color: var(--text-primary);
      overflow: hidden;
      position: relative;
      transition: background 0.6s ease, color 0.6s ease;
    }

    :host(.dark) {
      --bg: #1a1a1a;
      --bg-surface: #2a2a2a;
      --text-primary: #e8e8e8;
      --text-secondary: #b0b0b0;
      --text-muted: #777777;
      --ring-track: rgba(255, 255, 255, 0.08);
      --ring-track-faded: rgba(255, 255, 255, 0.03);
      --accent: #e0e0e0;
    }

    .dimmer {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0);
      transition: background 2s ease;
      pointer-events: none;
      z-index: 50;
    }

    .dimmer.active {
      background: rgba(0, 0, 0, 0.7);
    }

    .header {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      padding: 2.5rem 1.5rem 1rem;
      text-align: center;
      z-index: 20;
      transition: opacity 0.5s ease;
    }

    .header.dimmed {
      opacity: 0;
    }

    .header-title {
      font-size: 0.6rem;
      font-weight: 600;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 0.6rem;
    }

    .header-selection {
      font-size: 1.1rem;
      font-weight: 400;
      color: var(--text-primary);
      min-height: 1.5rem;
    }

    .header-selection .separator {
      color: var(--text-muted);
      margin: 0 0.4rem;
    }

    .back-button {
      position: fixed;
      top: 0.8rem;
      left: 0.8rem;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 0.6rem;
      font-weight: 500;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      cursor: pointer;
      padding: 0.5rem;
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.4s ease, color 0.3s ease;
      display: flex;
      align-items: center;
      gap: 0.3rem;
      z-index: 30;
      font-family: inherit;
    }

    .back-button.visible {
      opacity: 1;
      pointer-events: auto;
    }

    .back-button:hover {
      color: var(--text-primary);
    }

    .theme-toggle {
      position: fixed;
      top: 0.8rem;
      right: 0.8rem;
      background: none;
      border: 1px solid var(--text-muted);
      border-radius: 50%;
      color: var(--text-muted);
      cursor: pointer;
      padding: 0.4rem;
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 30;
      transition: opacity 0.4s ease, color 0.3s ease, border-color 0.3s ease;
      -webkit-tap-highlight-color: transparent;
      font-family: inherit;
    }

    .theme-toggle:hover {
      color: var(--text-primary);
      border-color: var(--text-primary);
    }

    .theme-toggle.dimmed {
      opacity: 0;
      pointer-events: none;
    }

    .theme-toggle svg {
      width: 1rem;
      height: 1rem;
      display: block;
    }

    .hint {
      position: fixed;
      bottom: 7rem;
      left: 50%;
      transform: translateX(-50%);
      font-size: 0.55rem;
      color: var(--text-muted);
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-align: center;
      opacity: 0.5;
      transition: opacity 0.3s ease;
      z-index: 10;
    }

    .hint.hidden {
      opacity: 0;
    }
  `;

  constructor() {
    super();
    this._stage = 1;
    this._selectedMode = null;
    this._selectedAmbiance = null;
    this._selectedDuration = null;
    this._centerMode = 'select';
    this._timerDisplay = '';
    this._dimmed = false;
    this._settingsRecall = false;
    this._dark = false;
    this._wakeLock = null;
    this._fadeStarted = false;

    // Recall gesture state
    this._recallTouchId = null;
    this._recallStartY = 0;
    this._recallStartX = 0;
    this._recallLongPressTimer = null;

    // Bound handlers for document-level listeners
    this._onRecallTouchStart = this._handleRecallTouchStart.bind(this);
    this._onRecallTouchMove = this._handleRecallTouchMove.bind(this);
    this._onRecallTouchEnd = this._handleRecallTouchEnd.bind(this);
    this._onRecallContextMenu = this._handleRecallContextMenu.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    // Init audio on first touch
    document.addEventListener('touchstart', () => initAudio(), { once: true, passive: true });

    // Recall gesture detection (document-level for reliable capture)
    document.addEventListener('touchstart', this._onRecallTouchStart, { passive: true });
    document.addEventListener('touchmove', this._onRecallTouchMove, { passive: false });
    document.addEventListener('touchend', this._onRecallTouchEnd, { passive: true });
    document.addEventListener('touchcancel', this._onRecallTouchEnd, { passive: true });
    document.addEventListener('contextmenu', this._onRecallContextMenu);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('touchstart', this._onRecallTouchStart);
    document.removeEventListener('touchmove', this._onRecallTouchMove);
    document.removeEventListener('touchend', this._onRecallTouchEnd);
    document.removeEventListener('touchcancel', this._onRecallTouchEnd);
    document.removeEventListener('contextmenu', this._onRecallContextMenu);

    if (this._recallLongPressTimer) {
      clearTimeout(this._recallLongPressTimer);
      this._recallLongPressTimer = null;
    }
  }

  // ---- Wheel reference ----

  get _wheel() {
    return this.renderRoot.querySelector('stillness-wheel');
  }

  get _timer() {
    return this.renderRoot.querySelector('stillness-timer');
  }

  // ---- Stage management ----

  _goToStage(stage) {
    this._stage = stage;
    const wheel = this._wheel;
    if (wheel) wheel.stage = stage;

    this._updateCenterMode();
  }

  _updateCenterMode() {
    if (this._stage >= 5) return; // managed by play/pause logic

    // During recall at stage 4, keep 'paused' so center shows Resume
    if (this._settingsRecall && this._stage === 4) {
      this._centerMode = 'paused';
      return;
    }

    // Once user navigates back during recall, they're changing settings —
    // clear recall flag so re-reaching stage 4 shows Play (fresh session)
    if (this._settingsRecall && this._stage < 4) {
      this._clearRecallMode();
      // Stop the paused timer since settings are being changed
      const timer = this._timer;
      if (timer) timer.stop();
    }

    const allSelected = this._selectedMode && this._selectedAmbiance && this._selectedDuration;
    this._centerMode = allSelected ? 'ready' : 'select';
  }

  // ---- Selection flow ----

  _onCenterAction(e) {
    const { action } = e.detail;
    initAudio();

    switch (action) {
      case 'confirm':
        this._confirmSelection();
        break;
      case 'play':
        this._startSession();
        break;
      case 'pause':
        this._pauseSession();
        break;
      case 'resume':
        this._resumeSession();
        break;
    }
  }

  _confirmSelection() {
    const wheel = this._wheel;
    if (!wheel) return;

    if (this._stage === 1) {
      const ring = wheel.getRing(1);
      const item = ring.getHighlightedItem();
      this._selectedMode = item;
      ring.setSelected(ring.highlightedIndex);
      triggerHaptic('confirm');
      this._goToStage(2);
    } else if (this._stage === 2) {
      const ring = wheel.getRing(2);
      const item = ring.getHighlightedItem();
      this._selectedAmbiance = item;
      ring.setSelected(ring.highlightedIndex);
      triggerHaptic('confirm');
      this._goToStage(3);
    } else if (this._stage === 3) {
      const ring = wheel.getRing(3);
      const item = ring.getHighlightedItem();
      this._selectedDuration = item;
      ring.setSelected(ring.highlightedIndex);
      triggerHaptic('confirm');
      this._goToStage(4);
    }
  }

  _goBack() {
    // Block back during active playback (unless settings recall is open)
    if ((this._centerMode === 'playing' || this._centerMode === 'paused')
        && !this._settingsRecall) return;
    if (this._stage <= 1) return;

    triggerHaptic('medium');

    if (this._stage === 4) {
      this._selectedDuration = null;
    } else if (this._stage === 3) {
      this._selectedDuration = null;
    } else if (this._stage === 2) {
      this._selectedAmbiance = null;
    }

    this._goToStage(this._stage - 1);
  }

  // ---- Session lifecycle ----

  async _startSession() {
    triggerHaptic('confirm');
    this._centerMode = 'playing';
    this._dimmed = true;
    this._fadeStarted = false;

    // Hide wheel rings
    this._goToStage(5);

    // Wake lock
    try {
      if ('wakeLock' in navigator) {
        this._wakeLock = await navigator.wakeLock.request('screen');
      }
    } catch (e) { /* not available */ }

    // Prime and start audio
    primeChime();

    if (this._selectedAmbiance && this._selectedAmbiance.file) {
      try {
        await loadAmbiance(`./sounds/${this._selectedAmbiance.file}`);
        startAmbiance();
      } catch (e) {
        // Audio load failed silently
      }
    }

    // Media Session
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Meditation Session',
        artist: 'Stillness',
        album: this._selectedAmbiance ? this._selectedAmbiance.label : 'Silence',
      });
      navigator.mediaSession.setActionHandler('pause', () => this._pauseSession());
      navigator.mediaSession.setActionHandler('play', () => this._resumeSession());
    }

    // Start timer
    const timer = this._timer;
    if (timer) {
      timer.start(this._selectedDuration.value * 60);
    }
  }

  async _pauseSession() {
    this._centerMode = 'paused';
    triggerHaptic('medium');

    const timer = this._timer;
    if (timer) timer.pause();

    await suspendAudio();
  }

  async _resumeSession() {
    this._centerMode = 'playing';
    triggerHaptic('confirm');
    this._dimmed = true;

    // If returning from settings recall, hide wheel again
    if (this._settingsRecall) {
      this._clearRecallMode();
      this._goToStage(5);
    }

    const timer = this._timer;
    if (timer) timer.resume();

    await resumeAudio();
  }

  // ---- Settings recall (swipe-up / long-press during session) ----

  _handleRecallTouchStart(e) {
    if (this._centerMode !== 'playing' && this._centerMode !== 'paused') return;
    if (this._settingsRecall) return;

    const touch = e.touches[0];
    // Only track touches in bottom 120px of screen (near center button)
    if (touch.clientY < window.innerHeight - 120) return;

    this._recallTouchId = touch.identifier;
    this._recallStartY = touch.clientY;
    this._recallStartX = touch.clientX;

    // Long press fallback (500ms hold)
    this._recallLongPressTimer = setTimeout(() => {
      this._recallLongPressTimer = null;
      this._recallTouchId = null;
      this._onSettingsRecall();
    }, 500);
  }

  _handleRecallTouchMove(e) {
    if (this._recallTouchId === null) return;

    const touch = Array.from(e.touches).find(t => t.identifier === this._recallTouchId);
    if (!touch) return;

    const deltaX = Math.abs(touch.clientX - this._recallStartX);
    const deltaY = touch.clientY - this._recallStartY;

    // Cancel long press if moved too much
    if (deltaX > 10 || Math.abs(deltaY) > 10) {
      if (this._recallLongPressTimer) {
        clearTimeout(this._recallLongPressTimer);
        this._recallLongPressTimer = null;
      }
    }

    // Detect swipe up (negative deltaY = upward)
    if (deltaY < -25 && deltaX < 40) {
      e.preventDefault();
      this._recallTouchId = null;
      if (this._recallLongPressTimer) {
        clearTimeout(this._recallLongPressTimer);
        this._recallLongPressTimer = null;
      }
      this._onSettingsRecall();
    }
  }

  _handleRecallTouchEnd(e) {
    if (this._recallTouchId === null) return;

    const ended = Array.from(e.changedTouches).find(t => t.identifier === this._recallTouchId);
    if (!ended) return;

    this._recallTouchId = null;
    if (this._recallLongPressTimer) {
      clearTimeout(this._recallLongPressTimer);
      this._recallLongPressTimer = null;
    }
  }

  _handleRecallContextMenu(e) {
    // Prevent context menu on center button area during sessions
    if (this._centerMode !== 'playing' && this._centerMode !== 'paused') return;
    if (e.clientY >= window.innerHeight - 120) {
      e.preventDefault();
    }
  }

  _onSettingsRecall() {
    if (this._centerMode !== 'playing' && this._centerMode !== 'paused') return;

    // Pause the session
    if (this._centerMode === 'playing') {
      this._pauseSession();
    }

    // Show the rings again (set flag before _goToStage so
    // _updateCenterMode keeps 'paused' for the Resume button)
    this._settingsRecall = true;
    this._dimmed = false;

    // Boost expanded ring opacity so selections are readable
    this.style.setProperty('--expanded-1-opacity', '0.8');
    this.style.setProperty('--expanded-2-opacity', '0.5');
    this.style.setProperty('--expanded-1-selected-opacity', '1');
    this.style.setProperty('--expanded-2-selected-opacity', '0.8');

    triggerHaptic('medium');
    this._goToStage(4);
  }

  _clearRecallMode() {
    this._settingsRecall = false;
    this.style.removeProperty('--expanded-1-opacity');
    this.style.removeProperty('--expanded-2-opacity');
    this.style.removeProperty('--expanded-1-selected-opacity');
    this.style.removeProperty('--expanded-2-selected-opacity');
  }

  // ---- Timer events ----

  _onTimerTick(e) {
    const { formatted, remaining } = e.detail;
    this._timerDisplay = formatted;

    // Sleeping mode: start fade in last 30 seconds
    if (this._selectedMode && this._selectedMode.id === 'sleeping'
        && remaining <= 30 && !this._fadeStarted
        && this._selectedAmbiance && this._selectedAmbiance.file) {
      this._fadeStarted = true;
      fadeAmbiance(remaining);
    }
  }

  _onTimerComplete() {
    if (this._selectedMode && this._selectedMode.id === 'relaxing') {
      // Relaxing: chime ending
      stopAmbiance();
      playChime();
      setTimeout(() => this._resetSession(), 5000);
    } else {
      // Sleeping: silent fade (already faded), wait dimmed
      stopAmbiance();
      setTimeout(() => this._resetSession(), 10000);
    }
  }

  async _resetSession() {
    this._centerMode = 'select';
    this._dimmed = false;
    this._selectedMode = null;
    this._selectedAmbiance = null;
    this._selectedDuration = null;
    this._fadeStarted = false;
    this._clearRecallMode();

    // Release wake lock
    if (this._wakeLock) {
      try { await this._wakeLock.release(); } catch (e) {}
      this._wakeLock = null;
    }

    // Clear media session
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('play', null);
    }

    this._goToStage(1);
  }

  // ---- Dark mode ----

  _toggleDarkMode() {
    this._dark = !this._dark;
    this.classList.toggle('dark', this._dark);

    // Update page background (outside shadow DOM)
    const bgColor = this._dark ? '#1a1a1a' : '#e8e8e8';
    document.body.style.background = bgColor;
    document.documentElement.style.background = bgColor;

    // Update meta theme-color for browser/status bar
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', bgColor);
  }

  // ---- Hint text ----

  get _hintText() {
    if (this._stage >= 4) return '';
    const hints = { 1: 'Select mode', 2: 'Select ambiance', 3: 'Select duration' };
    return hints[this._stage] || '';
  }

  // ---- Header parts ----

  get _headerParts() {
    const parts = [];
    if (this._selectedMode) parts.push(this._selectedMode.label);
    if (this._selectedAmbiance) parts.push(this._selectedAmbiance.label);
    if (this._selectedDuration) parts.push(`${this._selectedDuration.value} min`);
    return parts;
  }

  // ---- SVG icons ----

  get _moonIcon() {
    return svg`<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" stroke-width="1.5" fill="none" stroke="currentColor"/>`;
  }

  get _sunIcon() {
    return svg`<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" stroke-width="1.5" fill="none" stroke="currentColor"/>`;
  }

  render() {
    const showBack = this._stage > 1 && this._stage <= 4;
    const headerParts = this._headerParts;
    const isSessionActive = this._centerMode === 'playing' || this._centerMode === 'paused';
    const headerDimmed = isSessionActive && !this._settingsRecall;
    const hintText = this._hintText;

    return html`
      <!-- Dimmer overlay -->
      <div class="dimmer ${this._dimmed ? 'active' : ''}"></div>

      <!-- Header -->
      <div class="header ${headerDimmed ? 'dimmed' : ''}">
        <div class="header-title">Stillness</div>
        <div class="header-selection">
          ${headerParts.map((part, i) => html`
            ${i > 0 ? html`<span class="separator">&middot;</span>` : ''}
            <span>${part}</span>
          `)}
        </div>
      </div>

      <!-- Back button -->
      <button class="back-button ${showBack ? 'visible' : ''}" @click=${this._goBack}>
        <span>&larr;</span> Back
      </button>

      <!-- Dark mode toggle -->
      <button
        class="theme-toggle ${headerDimmed ? 'dimmed' : ''}"
        @click=${this._toggleDarkMode}
        aria-label="Toggle dark mode"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          ${this._dark ? this._sunIcon : this._moonIcon}
        </svg>
      </button>

      <!-- Wheel -->
      <stillness-wheel
        .stage=${Math.min(this._stage, 5)}
        .modeItems=${MODES}
        .ambianceItems=${AMBIANCES}
        .durationItems=${DURATIONS}
        @ring-highlight-changed=${this._onRingHighlightChanged}
      ></stillness-wheel>

      <!-- Center button -->
      <stillness-center
        .mode=${this._centerMode}
        .timerDisplay=${this._timerDisplay}
        @center-action=${this._onCenterAction}
      ></stillness-center>

      <!-- Timer engine (no UI) -->
      <stillness-timer
        @timer-tick=${this._onTimerTick}
        @timer-complete=${this._onTimerComplete}
      ></stillness-timer>

      <!-- Hint -->
      <div class="hint ${hintText ? '' : 'hidden'}">${hintText}</div>
    `;
  }

  _onRingHighlightChanged() {
    // Trigger re-render for center button state if needed
    this._updateCenterMode();
  }
}

customElements.define('stillness-app', StillnessApp);
