// ==============================
// Audio Service — Hybrid Approach
// Web Audio API for gapless ambiance looping
// Silent HTML Audio to trigger Media Session (Android/iOS)
// ==============================

let ctx = null;
let gainNode = null;
let sourceNode = null;
let ambianceBuffer = null;
let mediaAudio = null;  // Silent audio for Media Session
let chimeAudio = null;
let fadeInterval = null;

function ensureContext() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = ctx.createGain();
    gainNode.connect(ctx.destination);
  }
  return ctx;
}

// ---- Media Session ----

export function updateMediaMetadata(modeLabel, ambianceLabel) {
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: `${modeLabel} Meditation`,
      artist: 'Stillness',
      album: ambianceLabel || 'Ambient',
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

// ---- Silent Audio for Media Session ----
// This tricks Android/iOS into showing lock screen controls

function startMediaSessionAudio(url) {
  if (mediaAudio) {
    mediaAudio.pause();
    mediaAudio = null;
  }

  // Use the actual audio file but at near-zero volume
  // This triggers Media Session while Web Audio does the real playback
  mediaAudio = new Audio(url);
  mediaAudio.loop = true;
  mediaAudio.volume = 0.01; // Nearly silent
  mediaAudio.play().catch(() => {});
}

function stopMediaSessionAudio() {
  if (mediaAudio) {
    mediaAudio.pause();
    mediaAudio.currentTime = 0;
    mediaAudio = null;
  }
}

function pauseMediaSessionAudio() {
  if (mediaAudio) {
    mediaAudio.pause();
  }
}

function resumeMediaSessionAudio() {
  if (mediaAudio) {
    mediaAudio.play().catch(() => {});
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

// ---- Ambiance (Web Audio for gapless looping) ----

let currentAmbianceUrl = null;

export async function loadAmbiance(url) {
  const c = ensureContext();
  if (c.state === 'suspended') await c.resume();

  currentAmbianceUrl = url;

  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  ambianceBuffer = await c.decodeAudioData(arrayBuffer);
}

export function startAmbiance() {
  if (!ambianceBuffer || !ctx) return;

  // Stop any existing playback
  stopAmbianceSource();

  // Reset gain
  gainNode.gain.setValueAtTime(1, ctx.currentTime);

  // Create and start new source
  sourceNode = ctx.createBufferSource();
  sourceNode.buffer = ambianceBuffer;
  sourceNode.loop = true;
  sourceNode.connect(gainNode);
  sourceNode.start(0);

  // Start silent audio for Media Session
  if (currentAmbianceUrl) {
    startMediaSessionAudio(currentAmbianceUrl);
  }
}

function stopAmbianceSource() {
  if (sourceNode) {
    try { sourceNode.stop(); } catch (_) {}
    sourceNode.disconnect();
    sourceNode = null;
  }
}

export function stopAmbiance() {
  if (fadeInterval) {
    clearInterval(fadeInterval);
    fadeInterval = null;
  }

  stopAmbianceSource();
  stopMediaSessionAudio();
  ambianceBuffer = null;
  currentAmbianceUrl = null;

  setMediaPlaybackState('none');
}

// ---- Pause / Resume ----

export async function suspendAudio() {
  if (ctx && ctx.state === 'running') await ctx.suspend();
  pauseMediaSessionAudio();
  setMediaPlaybackState('paused');
}

export async function resumeAudio() {
  if (ctx && ctx.state === 'suspended') await ctx.resume();
  resumeMediaSessionAudio();
  setMediaPlaybackState('playing');
}

// ---- Fade (Sleeping mode ending) ----

export function fadeAmbiance(durationSeconds) {
  if (!ctx || !gainNode) return;

  // Use Web Audio's smooth ramping for the main audio
  gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSeconds);

  // Also fade the Media Session audio
  if (mediaAudio) {
    const startVolume = mediaAudio.volume;
    const steps = durationSeconds * 10;
    const volumeStep = startVolume / steps;
    let currentStep = 0;

    if (fadeInterval) clearInterval(fadeInterval);

    fadeInterval = setInterval(() => {
      currentStep++;
      mediaAudio.volume = Math.max(0, startVolume - (volumeStep * currentStep));

      if (currentStep >= steps) {
        clearInterval(fadeInterval);
        fadeInterval = null;
      }
    }, 100);
  }
}

// ---- Chime (Focusing & Meditating mode ending) ----

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
