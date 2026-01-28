// ==============================
// Constants — Modes, Ambiances, Durations
// ==============================

export const MODES = [
  { id: 'relaxing', label: 'Relaxing' },
  { id: 'sleeping', label: 'Sleeping' },
  { id: 'relaxing', label: 'Relaxing' },
  { id: 'sleeping', label: 'Sleeping' },
  { id: 'relaxing', label: 'Relaxing' },
  { id: 'sleeping', label: 'Sleeping' },
];

export const AMBIANCES_BY_MODE = {
  relaxing: [
    { id: 'rain',        label: 'Rain',        file: 'rain.mp3' },
    { id: 'forest',      label: 'Forest',      file: 'forest.mp3' },
    { id: 'birds',       label: 'Birds',       file: 'birds.mp3' },
    { id: 'river',       label: 'River',       file: 'river.mp3' },
    { id: 'waves',       label: 'Waves',       file: 'sea-wave-34088.mp3' },
    { id: 'piano',       label: 'Piano',       file: 'soft-peaceful-piano-melody-309269.mp3' },
    { id: 'windchimes',  label: 'Chimes',      file: 'wind-chimes-no-background-noise-57238.mp3' },
    { id: 'silence',     label: 'Silence',     file: null },
  ],
  sleeping: [
    { id: 'cricket',     label: 'Cricket',     file: 'cricket.mp3' },
    { id: 'fireplace',   label: 'Fireplace',   file: 'fireplace.mp3' },
    { id: 'thunder',     label: 'Storm',       file: 'thunderstorm-108454.mp3' },
    { id: 'delta',       label: 'Delta',       file: 'binaural-beats_delta_440_440-5hz-48565.mp3' },
    { id: 'pad',         label: 'Texture',     file: 'uplifting-pad-texture-113842.mp3' },
    { id: 'beach',       label: 'Binaural',    file: 'beach-waves-binaural-72494.mp3' },
    { id: 'silence',     label: 'Silence',     file: null },
  ]
};

// For backward compatibility or default view
export const AMBIANCES = [
  ...AMBIANCES_BY_MODE.relaxing
];

export const DURATIONS = [];
for (let i = 5; i <= 120; i += 5) {
  DURATIONS.push({ id: `time-${i}`, value: i, unit: 'min' });
}