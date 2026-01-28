# Stillness Meditation — Architecture & Design Document

A minimalist meditation timer PWA built with intentional constraints and thoughtful design decisions.

---

## Table of Contents

1. [Philosophy](#philosophy)
2. [Three Modes](#three-modes)
3. [Sound Design](#sound-design)
4. [Audio Architecture](#audio-architecture)
5. [PWA Features](#pwa-features)
6. [Interaction Design](#interaction-design)
7. [Technical Stack](#technical-stack)

---

## Philosophy

### Radical Minimalism

Stillness rejects the feature creep common in wellness apps. There are no:
- Streaks or achievements
- Statistics or history
- Accounts or social features
- Guides or tutorials
- Notifications or reminders

The app does one thing: set a timer with ambient sound, then get out of the way.

### Intentional Friction

The wheel-based interface requires deliberate interaction. This isn't accidental—the act of slowly rotating to select a duration is itself a moment of mindfulness. The interface forces you to slow down before you begin.

### Disappearing UI

During a session, the interface fades away. The screen dims, controls vanish, and only a subtle breathing animation remains. The app becomes invisible so you can focus on being present.

---

## Three Modes

The app offers three distinct modes, each designed for a specific mental state and ending behavior.

### Focusing

**Purpose:** Work, study, concentration sessions

**Ending:** Chime (signals "break time" or "task complete")

**Sound Profile:**
- Steady, consistent ambient sounds
- Binaural beats for concentration
- Minimal variation to avoid distraction

| Sound | File | Intention |
|-------|------|-----------|
| Rain | rain.mp3 | Consistent white noise for focus |
| Binaural | beach-waves-binaural-72494.mp3 | Alpha-wave entrainment |
| Texture | uplifting-pad-texture-113842.mp3 | Ambient drone, no peaks |
| Handpan | handpan-dream-...mp3 | Gentle rhythm for flow state |
| Piano | soft-peaceful-piano-...mp3 | Melodic but unobtrusive |
| Forest | forest.mp3 | Natural white noise |

**Reasoning:** Focus mode sounds are chosen for their consistency. The brain habituates to steady sounds, allowing them to fade into the background while masking distracting environmental noise.

---

### Meditating

**Purpose:** Mindfulness practice, seated meditation

**Ending:** Chime (gently brings awareness back)

**Sound Profile:**
- Nature sounds that evoke presence
- Variety of textures for different preferences
- Binaural options for deeper states

| Sound | File | Intention |
|-------|------|-----------|
| Rain | rain.mp3 | Classic meditation backdrop |
| Forest | forest.mp3 | Grounding, earthy presence |
| River | river.mp3 | Flowing, impermanent |
| Waves | sea-wave-34088.mp3 | Breath-like rhythm |
| Piano | soft-peaceful-piano-...mp3 | Heart-opening melody |
| Chimes | wind-chimes-...mp3 | Traditional meditation sound |
| Delta | binaural-beats_delta_...mp3 | Deep relaxation waves |
| Binaural | beach-waves-binaural-72494.mp3 | Subtle entrainment |

**Reasoning:** The chime ending is crucial—it's the traditional meditation bell that signals "return to awareness." The sound selection emphasizes natural, organic textures that support present-moment awareness without demanding attention.

---

### Sleeping

**Purpose:** Falling asleep, bedtime wind-down

**Ending:** Fade to silence (no jarring sounds)

**Sound Profile:**
- Darker, warmer tones
- Monotonous patterns that encourage drowsiness
- Delta-wave binaural for deep sleep

| Sound | File | Intention |
|-------|------|-----------|
| Rain | rain.mp3 | Cozy, sleep-inducing |
| Cricket | cricket.mp3 | Nighttime atmosphere |
| Fireplace | fireplace.mp3 | Warmth, safety, comfort |
| Storm | thunderstorm-108454.mp3 | Deep rumble, drowsy |
| Delta | binaural-beats_delta_...mp3 | 0.5-4Hz for deep sleep |
| Texture | uplifting-pad-texture-...mp3 | Ambient drone |
| Binaural | beach-waves-binaural-72494.mp3 | Gentle entrainment |

**Reasoning:** Sleep mode fades audio over the final 30 seconds rather than playing a chime. The last thing you want when drifting off is to be startled awake. The sound selection emphasizes warmth, darkness, and monotony—qualities that signal "safe to let go" to the nervous system.

---

## Sound Design

### Natural Sounds

Natural sounds are not arbitrary choices. Each connects to evolutionary responses:

| Sound | Psychological Effect |
|-------|---------------------|
| **Rain** | Safety (shelter), masking, consistent |
| **Forest** | Grounding, presence, biodiversity = safety |
| **River** | Flow state, impermanence, cleansing |
| **Birds** | Daytime, alertness, "all is well" signal |
| **Waves** | Breath rhythm, vastness, perspective |
| **Fire** | Warmth, tribe, protection, primal comfort |
| **Cricket** | Night, rest time, natural circadian cue |
| **Storm** | Cozy contrast, pressure drop = drowsiness |

### Binaural Sounds

Binaural beats use a psychoacoustic phenomenon where two slightly different frequencies played in each ear create a perceived third frequency in the brain.

| Type | Frequency | Mental State |
|------|-----------|--------------|
| **Delta** | 0.5-4 Hz | Deep sleep, healing |
| **Theta** | 4-8 Hz | Meditation, creativity |
| **Alpha** | 8-14 Hz | Relaxed focus, calm |
| **Beta** | 14-30 Hz | Active thinking, alertness |

The app includes Delta waves for sleep and mixed binaural tracks for general relaxation/focus.

### Why No Silence Option

An earlier version included a "Silence" option. It was removed because:

1. **Redundant:** If you want silence, you don't need an app
2. **Breaks Media Session:** Android/iOS lock screen controls require audio playback
3. **Misses the point:** Ambient sound is a core feature, not optional

---

## Audio Architecture

### The Gapless Looping Problem

HTML5 `<audio>` elements have an inherent gap when looping—a brief silence as the browser seeks back to the start. This is unacceptable for meditation where any interruption breaks immersion.

### The Media Session Problem

Android and iOS only show lock screen controls (play/pause, metadata, artwork) when an HTML `<audio>` element is actively playing. The Web Audio API, despite being more powerful, doesn't trigger these controls.

### The Hybrid Solution

We use both APIs simultaneously:

```
┌─────────────────────────────────────────────────────────┐
│                    Audio Architecture                    │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   Web Audio API (AudioContext)                          │
│   ┌─────────────┐    ┌──────────┐    ┌─────────────┐   │
│   │ BufferSource │───▶│ GainNode │───▶│ Destination │   │
│   │ (looped)     │    │ (volume) │    │ (speakers)  │   │
│   └─────────────┘    └──────────┘    └─────────────┘   │
│         │                                               │
│         │ Gapless looping ✓                             │
│         │ Smooth fade ✓                                 │
│         │ Lock screen ✗                                 │
│                                                         │
│   ─────────────────────────────────────────────────     │
│                                                         │
│   HTML Audio Element                                    │
│   ┌─────────────┐                                       │
│   │ <audio>     │ volume: 0.01 (nearly silent)         │
│   │ loop=true   │                                       │
│   └─────────────┘                                       │
│         │                                               │
│         │ Gapless looping ✗                             │
│         │ Triggers Media Session ✓                      │
│         │ Lock screen controls ✓                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**How it works:**

1. **Web Audio** decodes the audio file into a buffer and plays it through a BufferSourceNode with `loop: true`. This gives perfect gapless playback.

2. **HTML Audio** plays the same file at 1% volume. The user can't hear it, but Android/iOS detect it and show lock screen controls.

3. Both are paused/resumed/stopped together to keep them in sync.

### Fade Implementation

Sleep mode fades audio over the final 30 seconds. Web Audio's GainNode provides smooth, sample-accurate ramping:

```javascript
gainNode.gain.setValueAtTime(currentVolume, ctx.currentTime);
gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 30);
```

The HTML Audio element fades via JavaScript interval (less smooth, but it's nearly inaudible anyway).

---

## PWA Features

### Service Worker Strategy

**Cache-first for local assets:** All HTML, CSS, JS, and sound files are cached on install. The app works fully offline.

**Network-first for CDN:** Lit (the only external dependency) is fetched fresh when online, falling back to cache when offline.

### Update Mechanism

When a new version is deployed:

1. Service Worker detects the update during periodic checks (every 60 seconds)
2. New assets are cached in the background
3. A toast notification appears: "New version available"
4. User can tap "Update" to reload, or dismiss
5. If dismissed, update applies on next visit

The app never force-reloads during an active session—that would be hostile UX.

### Install Prompt

The app captures the `beforeinstallprompt` event and shows a custom "Install" button. This is less intrusive than the browser's default banner and gives users control over when to install.

### Lock Screen Controls

Media Session API provides:
- Play/pause buttons on lock screen
- App name and icon in notification shade
- Current sound name as "album"

This transforms the PWA into something that feels native—users can pause meditation without unlocking their phone.

---

## Interaction Design

### The Wheel Metaphor

The circular ring interface isn't just aesthetic—it's biomechanically optimized for thumb reach on mobile devices. The arc of options follows the natural sweep of the thumb.

### Multiple Navigation Paths

Different users think differently. The app provides multiple ways to accomplish the same task:

| Action | Method 1 | Method 2 | Method 3 |
|--------|----------|----------|----------|
| Select option | Rotate wheel, tap center | Rotate wheel, release on item | Tap breadcrumb |
| Go back | Swipe up | Tap previous breadcrumb | — |
| Pause | Tap center button | Lock screen controls | — |
| Edit during session | Long-press center | Tap breadcrumb | — |

This redundancy isn't bloat—it's accessibility. Some users think in gestures, others in taps, others in spatial navigation.

### Gesture Design

**Rotation** was chosen over swipe for selection because:
- Swipe conflicts with OS gestures (back, home)
- Rotation maps naturally to a wheel metaphor
- The circular motion is inherently calming

**Long-press** reveals edit mode because:
- It's discoverable through exploration
- It prevents accidental edits
- The delay mirrors the deliberate pace of the app

**Swipe-up** for "back" because:
- It matches iOS/Android conventions
- Upward motion = going up a level
- Single-hand operation

### Visual Feedback

- **Haptic ticks** on rotation (subtle confirmation)
- **Breathing animation** during session (subtle life)
- **Dimmed interface** during session (disappearing UI)
- **Smooth transitions** between states (no jarring cuts)

---

## Technical Stack

### Vanilla Architecture

The app uses no framework at the root level—just ES modules orchestrating DOM updates. This is intentional:

- **No build step:** Edit a file, refresh the browser
- **No dependencies to update:** No security vulnerabilities from abandoned packages
- **Minimal bundle size:** Only what's needed
- **Longevity:** Vanilla JS will work in 10 years; frameworks won't

### Web Components

Two custom elements use Shadow DOM:
- `<stillness-ring>` — The rotatable selection wheel
- `<stillness-center>` — The center confirmation button

Shadow DOM provides style encapsulation without framework overhead.

### Lit (Minimal Use)

Lit is used only for the ring component where reactive templating genuinely helps. It's loaded via import map from CDN—no bundler needed.

### State Machine

Session state follows a simple machine:

```
selecting → playing → completing → idle
              ↓↑
            paused
```

Transitions are explicit. The current state determines what UI is shown and what actions are valid.

### File Structure

```
wheel/
├── index.html              # Shell, meta tags, component mounting
├── manifest.json           # PWA manifest
├── sw.js                   # Service Worker
├── styles/
│   ├── tokens.css          # CSS custom properties
│   └── global.css          # Layout, components
├── src/
│   ├── app.js              # Root orchestrator
│   ├── components/
│   │   └── stillness-ring.js
│   ├── services/
│   │   ├── audio-service.js    # Hybrid Web Audio + HTML Audio
│   │   ├── session-service.js  # State machine
│   │   ├── timer-service.js    # Drift-corrected countdown
│   │   ├── haptic-service.js   # Vibration API
│   │   └── storage-service.js  # Theme persistence
│   └── utils/
│       ├── constants.js    # Modes, sounds, durations
│       ├── format.js       # Time formatting
│       └── gesture.js      # Touch handlers
└── sounds/                 # Audio files
```

---

## Summary

Stillness is a meditation timer that prioritizes:

1. **Simplicity** over features
2. **Presence** over engagement metrics
3. **Craftsmanship** over velocity
4. **Longevity** over trendiness

Every technical decision—from the hybrid audio architecture to the wheel-based UI—serves the core purpose: helping people find a moment of stillness.

---

*Last updated: January 2026*
