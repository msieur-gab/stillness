// ==============================
// App Orchestrator
// Wires session state machine, timer, audio,
// haptics, gestures → DOM updates
// ==============================

import './components/stillness-ring.js';

import { MODES, AMBIANCES_BY_MODE, DURATIONS } from './utils/constants.js';
import { formatTime } from './utils/format.js';
import { onSwipeUp, onLongPress } from './utils/gesture.js';

import { SessionService } from './services/session-service.js';
import { TimerService } from './services/timer-service.js';
import {
  initAudio, playTick,
  loadAmbiance, startAmbiance, stopAmbiance,
  suspendAudio, resumeAudio,
  fadeAmbiance, primeChime, playChime,
  updateMediaMetadata, setupMediaActions,
} from './services/audio-service.js';
import { triggerHaptic } from './services/haptic-service.js';
import { storage } from './services/storage-service.js';


// ---- Services ----

const session = new SessionService();
const timer = new TimerService();

// ---- DOM refs ----

const rings = [
  document.getElementById('ringMode'),
  document.getElementById('ringAmbiance'),
  document.getElementById('ringTime'),
];
const btn = document.getElementById('btn');
const selectionEl = document.getElementById('selection');
const timerEl = document.getElementById('timer');
const hintEl = document.getElementById('hint');
const headerEl = document.getElementById('header');
const themeToggle = document.getElementById('themeToggle');

// ---- Feed data into rings ----

rings[0].items = MODES;
rings[1].items = []; // Populated when mode is selected
rings[2].items = DURATIONS;

// ---- Ring events ----

rings.forEach((ring, i) => {
  const ringNumber = i + 1;

  ring.addEventListener('highlight-change', () => {
    triggerHaptic('light');
    playTick();
  });

  ring.addEventListener('item-selected', (e) => {
    onItemSelected(ringNumber, e.detail);
  });
});

function onItemSelected(ringNumber, { item }) {
  if (session.state !== 'selecting') return;
  if (ringNumber !== session.level) return;

  triggerHaptic('confirm');
  session.select(ringNumber, item);
}

// ---- Session state changes ----

session.addEventListener('state-change', (e) => {
  const { from, to } = e.detail;

  if (to === 'selecting') {
    onEnterSelecting();
  } else if (to === 'playing') {
    onEnterPlaying(from);
  } else if (to === 'paused') {
    onEnterPaused();
  } else if (to === 'completing') {
    onComplete();
  } else if (to === 'idle') {
    onReset();
  }
});

session.addEventListener('level-change', (e) => {
  const lvl = e.detail.level;

  // Update ambiance list based on mode
  if (lvl === 2 && session.mode) {
    rings[1].items = AMBIANCES_BY_MODE[session.mode.id] || [];
  }

  activateRingForLevel(lvl);
  updateUI();
});

// ---- State handlers ----

function onEnterSelecting() {
  activateRingForLevel(session.level);
  updateUI();
}

function onEnterPlaying(from) {
  // Hide all rings
  rings.forEach(r => r.active = false);

  // Start or resume timer
  if (from === 'paused') {
    timer.resume();
    resumeAudio();
  } else {
    const durationSec = session.duration.value * 60;
    timer.start(durationSec);

    // Audio
    initAudio();
    if (session.mode.id === 'relaxing') primeChime();

    const amb = session.ambiance;
    updateMediaMetadata(session.mode.label, amb ? amb.label : 'Silence');

    if (amb && amb.file) {
      loadAmbiance(`./sounds/${amb.file}`).then(() => startAmbiance());
    }
  }

  // UI
  headerEl.classList.add('dimmed');
  themeToggle.classList.add('dimmed');
  btn.textContent = 'Pause';
  btn.classList.add('playing', 'breathing');
  btn.classList.remove('paused');
  hintEl.classList.add('hidden');
  timerEl.classList.add('visible');
  updateSelection();
}

function onEnterPaused() {
  timer.pause();
  suspendAudio();

  headerEl.classList.remove('dimmed');
  themeToggle.classList.remove('dimmed');
  btn.textContent = 'Resume';
  btn.classList.remove('breathing');
  btn.classList.add('paused');
}

function onComplete() {
  timer.stop();
  timerEl.textContent = formatTime(0);

  if (session.mode.id === 'relaxing') {
    // Chime ending
    stopAmbiance();
    playChime();
    setTimeout(() => session.reset(), 5000);
  } else {
    // Sleeping: fade audio over 10s, then reset
    fadeAmbiance(10);
    setTimeout(() => {
      stopAmbiance();
      session.reset();
    }, 10000);
  }
}

function onReset() {
  stopAmbiance();

  // Restore UI
  headerEl.classList.remove('dimmed');
  themeToggle.classList.remove('dimmed');
  btn.classList.remove('playing', 'breathing', 'paused');
  timerEl.classList.remove('visible');

  session.begin();
}

// ---- Ring activation ----

function activateRingForLevel(lvl) {
  rings.forEach((ring, i) => {
    ring.active = (i === lvl - 1);
  });
  // Recalc positions after CSS transition starts
  setTimeout(() => {
    rings.forEach(r => r.recalculate());
  }, 50);
}

// ---- Timer events ----

timer.addEventListener('tick', (e) => {
  timerEl.textContent = e.detail.formatted;

  // Start fade for sleeping mode in last 30s
  if (session.mode && session.mode.id === 'sleeping' && e.detail.remaining === 30) {
    fadeAmbiance(30);
  }
});

timer.addEventListener('complete', () => {
  session.complete();
});

// ---- Button (long-press + tap) ----

onLongPress(btn, {
  onTap() {
    if (session.state === 'playing') {
      session.pause();
    } else if (session.state === 'paused') {
      session.resume();
    } else if (session.state === 'selecting') {
      // Confirm current ring selection
      const ring = rings[session.level - 1];
      ring.confirmSelection();
    }
  },
  onLongPress() {
    if (session.state === 'playing' || session.state === 'paused') {
      // Long press: enter edit mode → go to duration ring
      timer.stop();
      stopAmbiance();

      btn.classList.remove('playing', 'breathing', 'paused');
      timerEl.classList.remove('visible');
      headerEl.classList.remove('dimmed');
      themeToggle.classList.remove('dimmed');

      session.edit(3);
    }
  },
});

// ---- Swipe up → back ----

onSwipeUp({
  onSwipeUp() {
    if (session.state === 'selecting' && session.level > 1) {
      session.back();
    }
  },
});

// ---- Header tap → jump to level ----

function setupHeaderTaps() {
  selectionEl.querySelectorAll('[data-level]').forEach((span) => {
    const lvl = parseInt(span.dataset.level, 10);
    span.addEventListener('click', () => {
      if (session.state === 'playing' || session.state === 'paused') {
        // Pause and jump to that level for editing
        timer.stop();
        stopAmbiance();

        btn.classList.remove('playing', 'breathing', 'paused');
        timerEl.classList.remove('visible');
        headerEl.classList.remove('dimmed');
        themeToggle.classList.remove('dimmed');

        session.edit(lvl);
      } else if (session.state === 'selecting') {
        session.goToLevel(lvl);
      }
    });
  });
}

// ---- UI update ----

function updateUI() {
  updateSelection();

  // Hint
  const hints = { 1: 'Select mode', 2: 'Select ambiance', 3: 'Select duration' };
  const isActive = session.state === 'selecting';
  hintEl.textContent = isActive ? (hints[session.level] || '') : '';
  hintEl.classList.toggle('hidden', !isActive);

  // Button label during selection
  if (session.state === 'selecting') {
    btn.textContent = 'Select';
    btn.classList.remove('playing', 'breathing', 'paused');
  }

  timerEl.classList.toggle('visible', session.state === 'playing' || session.state === 'paused');
}

function updateSelection() {
  const parts = [];
  if (session.mode) parts.push(`<span data-level="1">${session.mode.label}</span>`);
  if (session.ambiance) parts.push(`<span data-level="2">${session.ambiance.label}</span>`);
  if (session.duration) parts.push(`<span data-level="3">${session.duration.value} min</span>`);
  selectionEl.innerHTML = parts.join('<span class="sep">&middot;</span>');
  setupHeaderTaps();
}

// ---- Theme toggle ----

themeToggle.addEventListener('click', () => {
  const isDark = document.documentElement.classList.toggle('dark');
  storage.theme = isDark ? 'dark' : 'light';
});

// Load saved theme
if (storage.isDark) {
  document.documentElement.classList.add('dark');
}

// ---- Service Worker ----

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// ---- Media Session Actions ----

setupMediaActions(
  () => session.resume(),
  () => session.pause()
);

// ---- Boot ----

session.begin();
