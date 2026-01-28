// ==============================
// Constants — Modes, Ambiances, Durations
// ==============================

export const MODES = [
  { id: 'focusing',   label: 'Focusing' },
  { id: 'meditating', label: 'Meditating' },
  { id: 'sleeping',   label: 'Sleeping' },
  { id: 'focusing',   label: 'Focusing' },
  { id: 'meditating', label: 'Meditating' },
  { id: 'sleeping',   label: 'Sleeping' },
];

// Focusing: work, study, concentration - steady ambient sounds
// Meditating: mindfulness practice, nature sounds - chime ending
// Sleeping: drift off to sleep, monotonous drones - fade ending
export const AMBIANCES_BY_MODE = {
  focusing: [
    { id: 'rain',       label: 'Rain',      file: 'rain.mp3' },
    { id: 'binaural',   label: 'Binaural',  file: 'beach-waves-binaural-72494.mp3' },
    { id: 'texture',    label: 'Texture',   file: 'uplifting-pad-texture-113842.mp3' },
    { id: 'handpan',    label: 'Handpan',   file: 'handpan-dream-olistik-sound-project-patrizio-yoga-137080.mp3' },
    { id: 'piano',      label: 'Piano',     file: 'soft-peaceful-piano-melody-309269.mp3' },
    { id: 'forest',     label: 'Forest',    file: 'forest.mp3' },
  ],
  meditating: [
    { id: 'rain',       label: 'Rain',      file: 'rain.mp3' },
    { id: 'forest',     label: 'Forest',    file: 'forest.mp3' },
    { id: 'river',      label: 'River',     file: 'river.mp3' },
    { id: 'waves',      label: 'Waves',     file: 'sea-wave-34088.mp3' },
    { id: 'piano',      label: 'Piano',     file: 'soft-peaceful-piano-melody-309269.mp3' },
    { id: 'chimes',     label: 'Chimes',    file: 'wind-chimes-no-background-noise-57238.mp3' },
    { id: 'delta',      label: 'Delta',     file: 'binaural-beats_delta_440_440-5hz-48565.mp3' },
    { id: 'binaural',   label: 'Binaural',  file: 'beach-waves-binaural-72494.mp3' },
  ],
  sleeping: [
    { id: 'rain',       label: 'Rain',      file: 'rain.mp3' },
    { id: 'cricket',    label: 'Cricket',   file: 'cricket.mp3' },
    { id: 'fireplace',  label: 'Fireplace', file: 'fireplace.mp3' },
    { id: 'storm',      label: 'Storm',     file: 'thunderstorm-108454.mp3' },
    { id: 'delta',      label: 'Delta',     file: 'binaural-beats_delta_440_440-5hz-48565.mp3' },
    { id: 'texture',    label: 'Texture',   file: 'uplifting-pad-texture-113842.mp3' },
    { id: 'binaural',   label: 'Binaural',  file: 'beach-waves-binaural-72494.mp3' },
  ]
};

// For backward compatibility or default view
export const AMBIANCES = [
  ...AMBIANCES_BY_MODE.meditating
];

export const DURATIONS = [];
for (let i = 5; i <= 120; i += 5) {
  DURATIONS.push({ id: `time-${i}`, value: i, unit: 'min' });
}