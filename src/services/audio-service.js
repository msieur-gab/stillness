// ==============================
// Audio Service
// Uses HTML Audio for ambiance (enables Media Session on Android)
// Web Audio API for tick feedback only
// ==============================

let ctx = null;
let ambianceAudio = null;
let chimeAudio = null;
let fadeInterval = null;

function ensureContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return ctx;
}

// ---- Media Session ----

export function updateMediaMetadata(modeLabel, ambianceLabel) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${modeLabel} Meditation`,
      artist: 'Stillness',
      album: ambianceLabel || 'Silence',
      artwork: [
        { src: './yoga_15876064.png', sizes: '512x512', type: 'image/png' }
      ]
    });
    navigator.mediaSession.playbackState = 'playing';
  }
}

export function setupMediaActions(onPlay, onPause) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', onPlay);
    navigator.mediaSession.setActionHandler('pause', onPause);
  }
}

export function setMediaPlaybackState(state) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.playbackState = state; // 'playing', 'paused', 'none'
  }
}

// ---- Init (unlocks AudioContext on user gesture) ----

export function initAudio() {
  ensureContext();
}

// ---- Tick (rotation feedback via Web Audio) ----

export function playTick() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.connect(g);
  g.connect(ctx.destination);
  osc.frequency.value = 1200;
  osc.type = 'sine';
  g.gain.setValueAtTime(0.08, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.05);
}

// ---- Ambiance (HTML Audio for Media Session support) ----

export async function loadAmbiance(url) {
  stopAmbiance();
  ambianceAudio = new Audio(url);
  ambianceAudio.loop = true;
  ambianceAudio.preload = 'auto';
  ambianceAudio.volume = 1;

  return new Promise((resolve, reject) => {
    ambianceAudio.addEventListener('canplaythrough', resolve, { once: true });
    ambianceAudio.addEventListener('error', reject, { once: true });
    ambianceAudio.load();
  });
}

export function startAmbiance() {
  if (!ambianceAudio) return;
  ambianceAudio.volume = 1;
  ambianceAudio.play().catch(() => {});
}

export function stopAmbiance() {
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }
  if (ambianceAudio) {
    ambianceAudio.pause();
    ambianceAudio.currentTime = 0;
    ambianceAudio = null;
  }
  setMediaPlaybackState('none');
}

// ---- Pause / Resume ----

export async function suspendAudio() {
  if (ambianceAudio) {
    ambianceAudio.pause();
  }
  if (ctx && ctx.state === 'running') await ctx.suspend();
  setMediaPlaybackState('paused');
}

export async function resumeAudio() {
  if (ctx && ctx.state === 'suspended') await ctx.resume();
  if (ambianceAudio) {
    ambianceAudio.play().catch(() => {});
  }
  setMediaPlaybackState('playing');
}

// ---- Fade (sleeping mode ending) ----

export function fadeAmbiance(durationSeconds) {
  if (!ambianceAudio) return;

  const startVolume = ambianceAudio.volume;
  const steps = durationSeconds * 10; // 10 steps per second
  const volumeStep = startVolume / steps;
  let currentStep = 0;

  if (fadeInterval) clearInterval(fadeInterval);

  fadeInterval = setInterval(() => {
    currentStep++;
    const newVolume = Math.max(0, startVolume - (volumeStep * currentStep));
    ambianceAudio.volume = newVolume;

    if (currentStep >= steps) {
      clearInterval(fadeInterval);
      fadeInterval = null;
    }
  }, 100);
}

// ---- Chime (relaxing mode ending) ----

export function primeChime() {
  if (!chimeAudio) {
    chimeAudio = new Audio('./sounds/chime.mp3');
    chimeAudio.preload = 'auto';
  }
  chimeAudio.load();
  chimeAudio.volume = 0;
  chimeAudio.play().then(() => {
    chimeAudio.pause();
    chimeAudio.currentTime = 0;
    chimeAudio.volume = 1;
  }).catch(() => {});
}

export function playChime() {
  if (!chimeAudio) chimeAudio = new Audio('./sounds/chime.mp3');
  chimeAudio.currentTime = 0;
  chimeAudio.play().catch(() => {
    chimeAudio.load();
    chimeAudio.play().catch(() => {});
  });
}
