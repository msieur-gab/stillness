// ==============================
// Storage Service — Theme & preferences
// ==============================

const PREFIX = 'stillness-';

export const storage = {
  get theme() {
    return localStorage.getItem(PREFIX + 'theme') || 'light';
  },

  set theme(value) {
    localStorage.setItem(PREFIX + 'theme', value);
  },

  get isDark() {
    return this.theme === 'dark';
  },
};
