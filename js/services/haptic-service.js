// ==============================
// Haptic Feedback Service
// ==============================

export function triggerHaptic(pattern = 'light') {
  if (!('vibrate' in navigator)) return;
  try {
    switch (pattern) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(25);
        break;
      case 'confirm':
        navigator.vibrate([15, 50, 15]);
        break;
    }
  } catch (e) {
    // Vibration API not available or blocked
  }
}
