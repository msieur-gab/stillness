// ==============================
// Audio Service — Web Audio API
// Tick feedback, gapless ambiance looping,
// chime playback, fade-out for sleeping mode
// ==============================

let ctx = null;
let gainNode = null;
let sourceNode = null;
let ambianceBuffer = null;
let chimeAudio = null;

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
      album: ambianceLabel || 'Silence',
      artwork: [
        { src: './yoga_15876064.png', sizes: '512x512', type: 'image/png' }
      ]
    });
  }
}

// ---- Init (unlocks AudioContext on user gesture) ----

export function initAudio() {
  ensureContext();
}

// ---- Tick (rotation feedback) ----

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

// ---- Ambiance (gapless Web Audio loop) ----

export async function loadAmbiance(url) {
  const c = ensureContext();
  if (c.state === 'suspended') await c.resume();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  ambianceBuffer = await c.decodeAudioData(arrayBuffer);
}

export function startAmbiance() {
  if (!ambianceBuffer || !ctx) return;
  stopAmbiance();
  gainNode.gain.setValueAtTime(1, ctx.currentTime);
  sourceNode = ctx.createBufferSource();
  sourceNode.buffer = ambianceBuffer;
  sourceNode.loop = true;
  sourceNode.connect(gainNode);
  sourceNode.start(0);
}

export function stopAmbiance() {
  if (sourceNode) {
    try { sourceNode.stop(); } catch (_) {}
    sourceNode.disconnect();
    sourceNode = null;
  }
}

// ---- Pause / Resume ----

export async function suspendAudio() {
  if (ctx && ctx.state === 'running') await ctx.suspend();
}

export async function resumeAudio() {
  if (ctx && ctx.state === 'suspended') await ctx.resume();
}

// ---- Fade (sleeping mode ending) ----

export function fadeAmbiance(durationSeconds) {
  if (!ctx || !gainNode) return;
  gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + durationSeconds);
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
