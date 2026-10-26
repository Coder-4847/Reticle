# Reticle

A polished aim and reflex trainer that runs entirely in your browser. No install, no account, no tracking.

**Live:** https://coder-4847.github.io/Reticle/

## Features

- **Five modes:** Flick, Gridshot, Tracking, Reaction and Target Switching, each with Beginner / Standard / Pro / Insane presets or fully custom settings (size, lifetime, spawn delay, target count, speed, play area).
- **Deep customization** with a live preview:
  - CS2-style crosshair (classic, T, dot, circle, circle + dot) with outline, gap, opacity, pulse on click and shareable codes
  - Cursor trail (line, dots, glow), backgrounds (solid, grid, gradient, starfield, your own image), vignette and brightness
  - Target shapes, colors, glow, outline, size variation, rotation and colorblind-safe presets
  - **Draw your own target shapes** freehand; hit detection is exact, even for concave shapes
  - Pointer lock with raw input, sensitivity, hit confirmation, synthesized audio with per-sound volume
- **Statistics:** an animated summary after every run that expands into a full report: reaction-time distribution, warm-up and fatigue, hit heatmap, precision scatter, miss direction and overshoot, accuracy by screen region, and plain-language insights.
- **History:** personal bests per mode and preset, progress graphs, an activity calendar with streaks, and JSON / CSV export and import.
- **Profiles:** save and switch complete setups, and share them as codes.
- **Polish:** smooth motion everywhere (respects reduced motion), toggleable in-game effects, keyboard shortcuts, and keyboard-accessible UI.

All data stays on your device (localStorage and IndexedDB).

## Controls

| Key | Action |
| --- | --- |
| Mouse | Aim and shoot |
| `Space` / `Enter` | Quick start (home) or retry (results) |
| `1`–`5` | Pick a mode on the home screen |
| `R` | Restart the run, or retry from results |
| `Esc` | Pause / resume |
| `S` | Settings |
| `?` | Shortcut cheat sheet |

## Run locally

No build step: it's plain HTML, CSS and JavaScript modules. Serve the folder with any static server:

```sh
python -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` directly from disk won't work, because browsers block ES modules on `file://`.

## Deploy

Pushing to `main` publishes the site to GitHub Pages through `.github/workflows/pages.yml`.
