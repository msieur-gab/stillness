// ==============================
// Stillness Meditation — Configuration
// ==============================

export const MODES = [
  { id: 'relaxing', label: 'Relaxing' },
  { id: 'sleeping', label: 'Sleeping' },
];

export const AMBIANCES = [
  { id: 'rain',      label: 'Rain',      file: 'rain.mp3' },
  { id: 'forest',    label: 'Forest',    file: 'forest.mp3' },
  { id: 'birds',     label: 'Birds',     file: 'birds.mp3' },
  { id: 'cricket',   label: 'Cricket',   file: 'cricket.mp3' },
  { id: 'river',     label: 'River',     file: 'river.mp3' },
  { id: 'fireplace', label: 'Fireplace', file: 'fireplace.mp3' },
  { id: 'silence',   label: 'Silence',   file: null },
];

export const DURATIONS = [];
for (let i = 5; i <= 120; i += 5) {
  DURATIONS.push({ id: `time-${i}`, value: i, unit: 'min' });
}
