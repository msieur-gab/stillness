// ==============================
// Gesture detection — swipe-up, long-press
// ==============================

/**
 * Detects upward swipe from the bottom region of the screen.
 * Returns a cleanup function to remove listeners.
 *
 * @param {Object} opts
 * @param {Function} opts.onSwipeUp - Callback when swipe-up detected
 * @param {number}   [opts.threshold=60]  - Min vertical distance (px)
 * @param {number}   [opts.zoneRatio=0.8] - Start zone (bottom 20% of screen)
 */
export function onSwipeUp({ onSwipeUp, threshold = 60, zoneRatio = 0.8 }) {
  let startY = 0;
  let startX = 0;
  let inZone = false;

  function handleStart(e) {
    const t = e.touches[0];
    startY = t.clientY;
    startX = t.clientX;
    inZone = startY > window.innerHeight * zoneRatio;
  }

  function handleEnd(e) {
    if (!inZone) return;
    const t = e.changedTouches[0];
    const dy = startY - t.clientY;
    const dx = Math.abs(startX - t.clientX);
    if (dy > threshold && dy > dx * 3) {
      onSwipeUp();
    }
  }

  document.addEventListener('touchstart', handleStart, { passive: true });
  document.addEventListener('touchend', handleEnd);

  return () => {
    document.removeEventListener('touchstart', handleStart);
    document.removeEventListener('touchend', handleEnd);
  };
}

/**
 * Attaches long-press + tap detection to an element.
 * Returns a cleanup function to remove listeners.
 *
 * @param {HTMLElement} el
 * @param {Object} opts
 * @param {Function} opts.onTap       - Fired on short tap
 * @param {Function} opts.onLongPress - Fired after hold duration
 * @param {number}   [opts.duration=500] - Hold time in ms
 */
export function onLongPress(el, { onTap, onLongPress: onHold, duration = 500 }) {
  let timer = null;
  let fired = false;

  function start(e) {
    e.preventDefault();
    fired = false;
    timer = setTimeout(() => {
      fired = true;
      onHold();
    }, duration);
  }

  function end(e) {
    e.preventDefault();
    clearTimeout(timer);
    if (!fired) onTap();
  }

  function cancel() {
    clearTimeout(timer);
  }

  el.addEventListener('touchstart', start, { passive: false });
  el.addEventListener('touchend', end, { passive: false });
  el.addEventListener('touchcancel', cancel);
  el.addEventListener('contextmenu', e => e.preventDefault());

  // Mouse fallback
  el.addEventListener('mousedown', () => {
    fired = false;
    timer = setTimeout(() => { fired = true; onHold(); }, duration);
  });
  el.addEventListener('mouseup', () => {
    clearTimeout(timer);
    if (!fired) onTap();
  });
  el.addEventListener('mouseleave', cancel);

  return () => {
    el.removeEventListener('touchstart', start);
    el.removeEventListener('touchend', end);
    el.removeEventListener('touchcancel', cancel);
    el.removeEventListener('mousedown', start);
    el.removeEventListener('mouseup', end);
    el.removeEventListener('mouseleave', cancel);
  };
}
