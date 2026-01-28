// ==============================
// Audio Service — Web Audio API
// Handles: tick feedback, gapless ambiance looping,
//          chime playback, fade-out for sleeping mode
// ==============================

let audioContext = null;
let ambianceBuffer = null;
let sourceNode = null;
let gainNode = null;
let chimeAudio = null;
let chimePrimed = false;

function ensureContext() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioContext.createGain();
    gainNode.connect(audioContext.destination);
  }
  return audioContext;
}

// ---- Tick (rotation feedback) ----

export function initAudio() {
  ensureContext();
}

export function playTick() {
  if (!audioContext) return;

  const osc = audioContext.createOscillator();
  const g = audioContext.createGain();

  osc.connect(g);
  g.connect(audioContext.destination);

  osc.frequency.value = 1200;
  osc.type = 'sine';

  g.gain.setValueAtTime(0.08, audioContext.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);

  osc.start(audioContext.currentTime);
  osc.stop(audioContext.currentTime + 0.05);
}

// ---- Ambiance (gapless Web Audio loop) ----

export async function loadAmbiance(url) {
  const ctx = ensureContext();
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  ambianceBuffer = await ctx.decodeAudioData(arrayBuffer);
}

export function startAmbiance() {
  if (!ambianceBuffer || !audioContext) return;
  stopAmbiance();

  gainNode.gain.setValueAtTime(1, audioContext.currentTime);

  sourceNode = audioContext.createBufferSource();
  sourceNode.buffer = ambianceBuffer;
  sourceNode.loop = true;
  sourceNode.connect(gainNode);
  sourceNode.start(0);
}

export function stopAmbiance() {
  if (sourceNode) {
    try { sourceNode.stop(); } catch (e) { /* already stopped */ }
    sourceNode.disconnect();
    sourceNode = null;
  }
}

// ---- Pause / Resume (preserves audio position via suspend) ----

export async function suspendAudio() {
  if (audioContext && audioContext.state === 'running') {
    await audioContext.suspend();
  }
}

export async function resumeAudio() {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }
}

// ---- Fade (sleeping mode ending) ----

export function fadeAmbiance(durationSeconds) {
  if (!audioContext || !gainNode) return;
  gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0, audioContext.currentTime + durationSeconds);
}

// ---- Chime (relaxing mode ending) ----

export function primeChime() {
  if (!chimeAudio) {
    chimeAudio = new Audio('./sounds/chime.mp3');
    chimeAudio.preload = 'auto';
  }
  // Silent play/pause trick for iOS audio policy
  chimeAudio.load();
  chimeAudio.volume = 0;
  chimeAudio.play().then(() => {
    chimeAudio.pause();
    chimeAudio.currentTime = 0;
    chimeAudio.volume = 1;
    chimePrimed = true;
  }).catch(() => {});
}

export function playChime() {
  if (!chimeAudio) {
    chimeAudio = new Audio('./sounds/chime.mp3');
  }
  chimeAudio.currentTime = 0;
  chimeAudio.play().catch(() => {
    chimeAudio.load();
    chimeAudio.play().catch(() => {});
  });
}

// ---- Cleanup ----

export function disposeAudio() {
  stopAmbiance();
  ambianceBuffer = null;
  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
    gainNode = null;
  }
  chimePrimed = false;
}
