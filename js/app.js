// ==============================
// App — Root Orchestrator (plain module)
// Full session lifecycle, audio integration, dimming,
// wake lock, media session, mode-dependent endings,
// dark mode, header breadcrumbs, ring transitions.
// ==============================

import { MODES, AMBIANCES, DURATIONS } from './data/config.js';
import {
  initAudio, loadAmbiance, startAmbiance, stopAmbiance,
  suspendAudio, resumeAudio, fadeAmbiance,
  primeChime, playChime,
} from './services/audio-service.js';
import { triggerHaptic } from './services/haptic-service.js';
import { Timer } from './services/timer.js';
import './components/stillness-ring.js';
import './components/stillness-center.js';

// ---- SVG icons ----
const MOON_SVG = `<path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" stroke-width="1.5" fill="none" stroke="currentColor"/>`;
const SUN_SVG = `<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" stroke-width="1.5" fill="none" stroke="currentColor"/>`;

// ---- DOM references ----
const $ = (sel) => document.querySelector(sel);

const dimmerEl        = $('.dimmer');
const headerEl        = $('.header');
const headerSelection = $('.header-selection');
const backBtn         = $('.back-button');
const themeBtn        = $('.theme-toggle');
const themeSvg        = themeBtn.querySelector('svg');
const ring1           = $('#ring1');
const ring2           = $('#ring2');
const ring3           = $('#ring3');
const center          = $('stillness-center');
const hintEl          = $('.hint');

// ---- State ----
let stage            = 1;
let selectedMode     = null;
let selectedAmbiance = null;
let selectedDuration = null;
let centerMode       = 'select';
let timerDisplay     = '';
let dimmed           = false;
let dark             = false;
let wakeLock         = null;
let fadeStarted      = false;
let settingsRecall   = false;
let recallOriginalAmbiance = null;

// Recall gesture state
let recallTouchId       = null;
let recallStartY        = 0;
let recallStartX        = 0;
let recallLongPressTimer = null;

// ---- Timer ----
const timer = new Timer();
timer.addEventListener('timer-tick', onTimerTick);
timer.addEventListener('timer-complete', onTimerComplete);

// ---- Init ----
ring1.items = MODES;
ring2.items = AMBIANCES;
ring3.items = DURATIONS;

backBtn.addEventListener('click', goBack);
themeBtn.addEventListener('click', toggleDarkMode);
center.addEventListener('center-action', onCenterAction);
ring1.addEventListener('ring-highlight-changed', onRingHighlightChanged);
ring2.addEventListener('ring-highlight-changed', onRingHighlightChanged);
ring3.addEventListener('ring-highlight-changed', onRingHighlightChanged);

document.addEventListener('touchstart', () => initAudio(), { once: true, passive: true });

// Recall gesture (swipe-up / long-press near center button during session)
document.addEventListener('touchstart', handleRecallTouchStart, { passive: true });
document.addEventListener('touchmove', handleRecallTouchMove, { passive: false });
document.addEventListener('touchend', handleRecallTouchEnd);
document.addEventListener('contextmenu', handleRecallContextMenu);

// Ring activation during recall editing
ring1.addEventListener('ring-activate-request', () => activateRingForEdit(1));
ring2.addEventListener('ring-activate-request', () => activateRingForEdit(2));
ring3.addEventListener('ring-activate-request', () => activateRingForEdit(3));

updateThemeIcon();
applyTransitions();

// ---- Stage management ----

function goToStage(s) {
  stage = s;
  applyTransitions();
  updateCenterMode();
  updateHeader();
  updateBackButton();
  updateHint();
}

function updateCenterMode() {
  if (stage >= 5) return; // managed by play/pause logic

  // During recall at stage 4, keep paused mode for the Resume button
  if (settingsRecall && stage === 4) {
    centerMode = 'paused';
    center.mode = 'paused';
    return;
  }

  const allSelected = selectedMode && selectedAmbiance && selectedDuration;
  centerMode = allSelected ? 'ready' : 'select';
  center.mode = centerMode;
}

// ---- Ring transitions (absorbed from stillness-wheel) ----

function applyTransitions() {
  const s = stage;

  // Stage 5+: hide all rings (active session)
  if (s >= 5) {
    ring1.active = false; ring1.transitionState = 'hidden';
    ring2.active = false; ring2.transitionState = 'hidden';
    ring3.active = false; ring3.transitionState = 'hidden';
    return;
  }

  // Ring 1
  ring1.active = s === 1;
  if (s === 1)      { ring1.transitionState = 'active'; if (!settingsRecall) ring1.clearSelected(); }
  else if (s === 2) { ring1.transitionState = 'expanded-1'; }
  else              { ring1.transitionState = 'expanded-2'; }

  // Ring 2
  ring2.active = s === 2;
  if (s < 2)        { ring2.transitionState = 'hidden'; }
  else if (s === 2) { ring2.transitionState = 'active'; if (!settingsRecall) ring2.clearSelected(); }
  else              { ring2.transitionState = 'expanded-1'; }

  // Ring 3
  ring3.active = s === 3;
  if (s < 3)        { ring3.transitionState = 'hidden'; }
  else if (s === 3) { ring3.transitionState = 'active'; if (!settingsRecall) ring3.clearSelected(); }
  else              { ring3.transitionState = 'expanded-1'; }

  // Recalculate active ring positions after transition
  if (s >= 1 && s <= 3) {
    const activeRing = [ring1, ring2, ring3][s - 1];
    requestAnimationFrame(() => activeRing.recalculatePositions());
  }
}

// ---- Selection flow ----

function onCenterAction(e) {
  const { action } = e.detail;
  initAudio();

  switch (action) {
    case 'confirm': confirmSelection(); break;
    case 'play':    startSession();     break;
    case 'pause':   pauseSession();     break;
    case 'resume':  resumeSession();    break;
  }
}

function confirmSelection() {
  if (stage === 1) {
    selectedMode = ring1.getHighlightedItem();
    ring1.setSelected(ring1.highlightedIndex);
    triggerHaptic('confirm');
    if (settingsRecall) { returnToRecallOverview(); return; }
    goToStage(2);
  } else if (stage === 2) {
    selectedAmbiance = ring2.getHighlightedItem();
    ring2.setSelected(ring2.highlightedIndex);
    triggerHaptic('confirm');
    if (settingsRecall) { returnToRecallOverview(); return; }
    goToStage(3);
  } else if (stage === 3) {
    selectedDuration = ring3.getHighlightedItem();
    ring3.setSelected(ring3.highlightedIndex);
    triggerHaptic('confirm');
    if (settingsRecall) { returnToRecallOverview(); return; }
    goToStage(4);
  }
}

function goBack() {
  if (centerMode === 'playing') return;

  // During recall editing, back returns to recall overview
  if (settingsRecall && stage >= 1 && stage <= 3) {
    triggerHaptic('medium');
    returnToRecallOverview();
    return;
  }

  if (centerMode === 'paused') return;
  if (stage <= 1) return;

  triggerHaptic('medium');

  if (stage === 4)      selectedDuration = null;
  else if (stage === 3) selectedDuration = null;
  else if (stage === 2) selectedAmbiance = null;

  goToStage(stage - 1);
}

// ---- Session lifecycle ----

async function startSession() {
  triggerHaptic('confirm');
  centerMode = 'playing';
  center.mode = 'playing';
  dimmed = true;
  dimmerEl.classList.add('active');
  fadeStarted = false;

  goToStage(5);
  updateHeaderDimmed();

  // Wake lock
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch (e) { /* not available */ }

  // Prime and start audio
  primeChime();

  if (selectedAmbiance && selectedAmbiance.file) {
    try {
      await loadAmbiance(`./sounds/${selectedAmbiance.file}`);
      startAmbiance();
    } catch (e) { /* audio load failed silently */ }
  }

  // Media Session
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: 'Meditation Session',
      artist: 'Stillness',
      album: selectedAmbiance ? selectedAmbiance.label : 'Silence',
    });
    navigator.mediaSession.setActionHandler('pause', () => pauseSession());
    navigator.mediaSession.setActionHandler('play', () => resumeSession());
  }

  timer.start(selectedDuration.value * 60);
}

async function pauseSession() {
  centerMode = 'paused';
  center.mode = 'paused';
  dimmed = false;
  dimmerEl.classList.remove('active');
  updateHeaderDimmed();
  triggerHaptic('medium');
  timer.pause();
  await suspendAudio();
}

async function resumeSession() {
  centerMode = 'playing';
  center.mode = 'playing';
  triggerHaptic('confirm');
  dimmed = true;
  dimmerEl.classList.add('active');

  if (settingsRecall) {
    const ambianceChanged = selectedAmbiance !== recallOriginalAmbiance;
    clearRecallMode();
    goToStage(5);

    if (ambianceChanged) {
      stopAmbiance();
      if (selectedAmbiance && selectedAmbiance.file) {
        try {
          await loadAmbiance(`./sounds/${selectedAmbiance.file}`);
          startAmbiance();
        } catch (e) { /* audio load failed silently */ }
      }
    } else {
      await resumeAudio();
    }
  } else {
    await resumeAudio();
  }

  updateHeaderDimmed();
  timer.resume();
}

// ---- Timer events ----

function onTimerTick(e) {
  const { formatted, remaining } = e.detail;
  timerDisplay = formatted;
  center.timerDisplay = formatted;

  if (selectedMode && selectedMode.id === 'sleeping'
      && remaining <= 30 && !fadeStarted
      && selectedAmbiance && selectedAmbiance.file) {
    fadeStarted = true;
    fadeAmbiance(remaining);
  }
}

function onTimerComplete() {
  if (selectedMode && selectedMode.id === 'relaxing') {
    stopAmbiance();
    playChime();
    setTimeout(resetSession, 5000);
  } else {
    stopAmbiance();
    setTimeout(resetSession, 10000);
  }
}

async function resetSession() {
  centerMode = 'select';
  center.mode = 'select';
  dimmed = false;
  dimmerEl.classList.remove('active');
  selectedMode = null;
  selectedAmbiance = null;
  selectedDuration = null;
  fadeStarted = false;
  clearRecallMode();

  if (wakeLock) {
    try { await wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }

  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('pause', null);
    navigator.mediaSession.setActionHandler('play', null);
  }

  goToStage(1);
}

// ---- Dark mode ----

function toggleDarkMode() {
  dark = !dark;
  document.body.classList.toggle('dark', dark);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#1a1a1a' : '#e8e8e8');

  updateThemeIcon();
}

// ---- UI update helpers ----

function updateThemeIcon() {
  themeSvg.innerHTML = dark ? SUN_SVG : MOON_SVG;
}

function updateHeader() {
  const parts = [];
  if (selectedMode) parts.push(selectedMode.label);
  if (selectedAmbiance) parts.push(selectedAmbiance.label);
  if (selectedDuration) parts.push(`${selectedDuration.value} min`);

  headerSelection.innerHTML = parts.map((part, i) =>
    (i > 0 ? '<span class="separator">&middot;</span>' : '') + `<span>${part}</span>`
  ).join('');

  updateHeaderDimmed();
}

function updateHeaderDimmed() {
  const hide = centerMode === 'playing';
  headerEl.classList.toggle('dimmed', hide);
  themeBtn.classList.toggle('dimmed', hide);
}

function updateBackButton() {
  // During recall at stage 4, hide back (Resume is the way out)
  // During recall editing (stage 1-3), show back to return to overview
  if (settingsRecall && stage === 4) {
    backBtn.classList.toggle('visible', false);
    return;
  }
  const showBack = stage > 1 && stage <= 4;
  backBtn.classList.toggle('visible', showBack);
}

function updateHint() {
  if (settingsRecall && stage === 4) {
    hintEl.textContent = 'Tap to edit';
    hintEl.classList.remove('hidden');
    return;
  }
  if (stage >= 4) {
    hintEl.classList.add('hidden');
    hintEl.textContent = '';
  } else {
    const hints = { 1: 'Select mode', 2: 'Select ambiance', 3: 'Select duration' };
    hintEl.textContent = hints[stage] || '';
    hintEl.classList.remove('hidden');
  }
}

function onRingHighlightChanged() {
  updateCenterMode();
}

// ---- Settings recall (swipe-up / long-press during session) ----

function handleRecallTouchStart(e) {
  if (centerMode !== 'playing' && centerMode !== 'paused') return;
  if (settingsRecall) return;

  const touch = e.touches[0];
  // Only track touches in bottom 120px of screen (near center button)
  if (touch.clientY < window.innerHeight - 120) return;

  recallTouchId = touch.identifier;
  recallStartY = touch.clientY;
  recallStartX = touch.clientX;

  // Long press fallback (500ms hold)
  recallLongPressTimer = setTimeout(() => {
    recallLongPressTimer = null;
    recallTouchId = null;
    onSettingsRecall();
  }, 500);
}

function handleRecallTouchMove(e) {
  if (recallTouchId === null) return;

  const touch = Array.from(e.touches).find(t => t.identifier === recallTouchId);
  if (!touch) return;

  const deltaX = Math.abs(touch.clientX - recallStartX);
  const deltaY = touch.clientY - recallStartY;

  // Cancel long press if moved too much
  if (deltaX > 10 || Math.abs(deltaY) > 10) {
    if (recallLongPressTimer) {
      clearTimeout(recallLongPressTimer);
      recallLongPressTimer = null;
    }
  }

  // Detect swipe up (negative deltaY = upward)
  if (deltaY < -25 && deltaX < 40) {
    e.preventDefault();
    recallTouchId = null;
    if (recallLongPressTimer) {
      clearTimeout(recallLongPressTimer);
      recallLongPressTimer = null;
    }
    onSettingsRecall();
  }
}

function handleRecallTouchEnd(e) {
  if (recallTouchId === null) return;

  const ended = Array.from(e.changedTouches).find(t => t.identifier === recallTouchId);
  if (!ended) return;

  recallTouchId = null;
  if (recallLongPressTimer) {
    clearTimeout(recallLongPressTimer);
    recallLongPressTimer = null;
  }
}

function handleRecallContextMenu(e) {
  if (centerMode !== 'playing' && centerMode !== 'paused') return;
  if (e.clientY >= window.innerHeight - 120) {
    e.preventDefault();
  }
}

function onSettingsRecall() {
  if (centerMode !== 'playing' && centerMode !== 'paused') return;

  // Pause session if playing
  if (centerMode === 'playing') {
    pauseSession();
  }

  settingsRecall = true;
  recallOriginalAmbiance = selectedAmbiance;

  // Boost expanded ring opacity so selections are readable
  document.body.style.setProperty('--expanded-1-opacity', '0.8');
  document.body.style.setProperty('--expanded-2-opacity', '0.5');
  document.body.style.setProperty('--expanded-1-selected-opacity', '1');
  document.body.style.setProperty('--expanded-2-selected-opacity', '0.8');

  ring1.pauseInteractive = true;
  ring2.pauseInteractive = true;
  ring3.pauseInteractive = true;

  triggerHaptic('medium');
  goToStage(4);
}

function activateRingForEdit(ringNumber) {
  ring1.pauseInteractive = false;
  ring2.pauseInteractive = false;
  ring3.pauseInteractive = false;

  // Position the ring to show the currently selected item
  const ring = [ring1, ring2, ring3][ringNumber - 1];
  if (ring.selectedIndex !== null) {
    ring.setHighlighted(ring.selectedIndex);
  }

  goToStage(ringNumber);
}

function returnToRecallOverview() {
  ring1.pauseInteractive = true;
  ring2.pauseInteractive = true;
  ring3.pauseInteractive = true;
  goToStage(4);
}

function clearRecallMode() {
  settingsRecall = false;
  recallOriginalAmbiance = null;

  document.body.style.removeProperty('--expanded-1-opacity');
  document.body.style.removeProperty('--expanded-2-opacity');
  document.body.style.removeProperty('--expanded-1-selected-opacity');
  document.body.style.removeProperty('--expanded-2-selected-opacity');

  ring1.pauseInteractive = false;
  ring2.pauseInteractive = false;
  ring3.pauseInteractive = false;
}
