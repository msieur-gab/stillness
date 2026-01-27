# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Stillness Meditation** — a minimalist meditation timer PWA built with vanilla HTML, CSS, and JavaScript. The entire application lives in a single HTML file (`meditation-wheel-v11.html`) with no build tools, no dependencies, and no framework. The app uses a circular wheel-based UI designed around thumb biomechanics rather than conventional button layouts.

## Running Locally

No build step. Serve files over HTTP (required for Service Worker and Web Audio API):

```bash
python3 -m http.server 8000
# or
npx http-server
```

The PWA manifest points to `./index.html` as the start URL, but the actual app file is `meditation-wheel-v11.html`. If deploying, either rename it or create an index.html redirect.

## Architecture

### Single-File Application

All CSS and JavaScript are embedded inline in `meditation-wheel-v11.html`. There is no module system, no imports, no external JS/CSS files.

### Core Components (all in the single HTML file)

- **WheelRing class** (~line 776-1025) — Core interaction engine. Manages circular item layout, drag/touch handling, momentum-based snapping, and haptic/audio feedback. Each ring is an instance with its own items and geometry.

- **TransitionController** (~line 1039-1097) — Orchestrates progressive disclosure across three rings. Two animation modes: A (expand outward) and B (collapse inward).

- **SidebarController** (~line 1280-1356) — Debug panel for real-time adjustment of wheel geometry (diameter, Y offset, ring expansion, animation mode).

- **Timer system** (~line 1193-1220) — Countdown logic with mode-dependent endings (chime for Focus, fade for Sleep).

- **Audio/Haptics** (~line 703-755) — Web Audio API oscillators for UI tick feedback, HTML5 Audio for ambient soundscapes, Vibration API for tactile response.

### Selection Flow

```
Ring 1 (Mode: Focus/Unwind/Sleep) → Ring 2 (Ambiance) → Ring 3 (Duration) → Timer
```

Each ring confirms selection before revealing the next. The center button advances through stages.

### PWA Layer

- `sw.js` — Service Worker with cache-first strategy (cache version: `stillness-v9`)
- `manifest.json` — Standalone display, portrait orientation
- Sound files in `sounds/` directory (birds, chime, cricket, fireplace, forest, rain, river)

### Versioning

Files are versioned by suffix (`v10`, `v11`). The latest version is `meditation-wheel-v11.html`. Previous versions are kept for comparison.

## Key Conventions

- **CSS custom properties** for theming (defined ~line 15-29): `--bg`, `--ring-track`, `--ring-item`, etc.
- **CSS classes**: kebab-case (`.ring-item`, `.center-control`)
- **JS variables**: camelCase (`isDragging`, `selectedMode`, `anglePerItem`)
- **Touch interaction**: uses both touch and mouse events with passive listeners; rotation is the primary gesture (unclaimed by platform conventions)
- **No state persistence**: the app remembers nothing between sessions by design

## Important Design Constraints

- The wheel interaction avoids swipe gestures (which conflict with OS-level gestures) and uses rotation instead
- The app has no guides, achievements, streaks, or statistics — minimalism is intentional
- Two meditation modes exist because they need different endings (chime vs. fade), not for feature count
- The screen dims/darkens during sessions; the interface disappears on purpose
- Never add claude mention to any git commit message
