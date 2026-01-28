# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Stillness Meditation** — a minimalist meditation timer PWA built with vanilla web components (no frameworks, no build step). The app uses a circular wheel-based UI designed around thumb biomechanics rather than conventional button layouts.

## Running Locally

No build step. Serve files over HTTP (required for Service Worker, Web Audio API, and ES modules):

```bash
python3 -m http.server 8000
# or
npx http-server
```

The PWA entry point is `index.html`.

## File Structure

```
wheel/
  index.html                    # PWA shell (markup + styles)
  manifest.json                 # PWA manifest (standalone, portrait)
  sw.js                         # Service Worker (cache-first, local only)
  yoga_15876064.png             # App icon
  sounds/                       # Ambient audio files
  js/
    app.js                      # Root orchestrator: header, dimming, lifecycle, ring transitions
    components/
      stillness-ring.js         # Core reusable wheel ring (touch, momentum, snap)
      stillness-center.js       # Center button (select/play/pause)
    services/
      audio-service.js          # Web Audio ticks, gapless ambiance loop, chime, fade
      haptic-service.js         # Vibration API wrapper
      timer.js                  # Countdown engine (plain EventTarget, no UI)
    data/
      config.js                 # MODES, AMBIANCES, DURATIONS constants
```

## Architecture

### Vanilla JS + Web Components (no framework, no build)

`app.js` is a plain ES module that orchestrates the page directly — no custom element, no Shadow DOM at the root. The two interactive components (`<stillness-ring>`, `<stillness-center>`) are custom elements with Shadow DOM since they genuinely benefit from encapsulation. No CDN dependencies.

### Component Hierarchy

```
index.html (markup + styles)
  └── app.js (plain module orchestrator)
        ├── header (selections breadcrumb)
        ├── .wheel (div container)
        │     ├── <stillness-ring>     Ring 1: Mode (Relaxing / Sleeping)
        │     ├── <stillness-ring>     Ring 2: Ambiance
        │     └── <stillness-ring>     Ring 3: Duration
        ├── <stillness-center>         Center button (confirm / play / pause)
        └── Timer (plain EventTarget class, not a DOM element)
```

### Selection Flow

```
Ring 1 (Mode: Relaxing/Sleeping) → Ring 2 (Ambiance) → Ring 3 (Duration) → Play
```

Each ring confirms selection before revealing the next. The center button advances through stages.

### Session Modes

- **Relaxing**: Chime plays at session end, 5s grace period, return to start
- **Sleeping**: Audio fades over last 30s, silent end, 10s dimmed, return to start

### PWA Layer

- `sw.js` — Service Worker with cache-first strategy (cache version: `stillness-v11`)
- No external CDN dependencies; all assets are local
- `manifest.json` — Standalone display, portrait orientation
- Sound files in `sounds/` directory

### Legacy Files

- `components/`, `services/`, `data/` — Previous Lit-based implementation (archived)
- `meditation-wheel-v11.html`, `meditation-wheel-v10.html` — Previous single-file versions (archived)
- `logic.html` — Previous flat UI version (archived)

## Key Conventions

- **CSS custom properties** for theming: `--bg`, `--ring-track`, `--accent`, etc.
- **Shadow DOM**: Ring and center components use shadow DOM; CSS custom properties cross boundaries
- **JS variables**: camelCase, private state prefixed with `_` (in components)
- **Touch interaction**: rotation gesture for ring browsing
- **No state persistence**: the app remembers nothing between sessions by design

## Important Design Constraints

- The wheel interaction uses rotation (not swipe, which conflicts with OS gestures)
- The app has no guides, achievements, streaks, or statistics — minimalism is intentional
- Two meditation modes exist because they need different endings (chime vs. fade), not for feature count
- The screen dims/darkens during sessions; the interface disappears on purpose
- Pause/resume via center button tap during session
- Never add claude mention to any git commit message
