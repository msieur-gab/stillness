// ==============================
// Onboarding Service
// Stores and retrieves adaptive UI positioning
// ==============================

const STORAGE_KEY = 'stillness-layout';

// Default positions (percentage of viewport height)
const DEFAULTS = {
  wheelY: 78,   // 78% from top (bottom area)
  buttonY: 92,  // 92% from top (very bottom)
};

class OnboardingService {
  constructor() {
    this._config = null;
  }

  /**
   * Check if onboarding has been completed
   */
  hasConfig() {
    return localStorage.getItem(STORAGE_KEY) !== null;
  }

  /**
   * Get the stored layout config
   * Returns defaults if not configured
   */
  getConfig() {
    if (this._config) return this._config;

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this._config = JSON.parse(stored);
        return this._config;
      } catch (e) {
        console.warn('Invalid layout config, using defaults');
      }
    }

    return { ...DEFAULTS };
  }

  /**
   * Save the layout config
   * @param {number} wheelY - Wheel center Y position (% of viewport)
   * @param {number} buttonY - Button center Y position (% of viewport)
   */
  setConfig(wheelY, buttonY) {
    this._config = { wheelY, buttonY };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this._config));
  }

  /**
   * Clear config (for testing or reset)
   */
  clearConfig() {
    this._config = null;
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Get CSS custom properties for positioning
   */
  getCSSProperties() {
    const config = this.getConfig();
    return {
      '--wheel-y': `${config.wheelY}vh`,
      '--button-y': `${config.buttonY}vh`,
    };
  }

  /**
   * Apply layout to document root
   */
  applyLayout() {
    const props = this.getCSSProperties();
    Object.entries(props).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }
}

export const onboarding = new OnboardingService();
