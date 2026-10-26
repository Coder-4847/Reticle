// Run configuration: which fields each mode exposes, their ranges, and difficulty presets.

export const DURATIONS = [30, 60, 90].map((v) => ({ value: v, label: `${v}s` }));

export const FIELDS = {
  size: { type: 'slider', label: 'Target size', hint: 'Radius in pixels', min: 8, max: 64, step: 1, unit: 'px' },
  lifetime: { type: 'slider', label: 'Target lifetime', hint: '0 = never expires', min: 0, max: 4000, step: 50, unit: 'ms' },
  spawnDelay: { type: 'slider', label: 'Spawn delay', hint: 'Pause before the next target appears', min: 0, max: 1000, step: 10, unit: 'ms' },
  count: { type: 'slider', label: 'Simultaneous targets', min: 1, max: 6, step: 1 },
  speed: { type: 'slider', label: 'Movement speed', min: 0, max: 600, step: 10, unit: 'px/s' },
  area: { type: 'segmented', label: 'Play area', options: [{ value: 'full', label: 'Full screen' }, { value: 'box', label: 'Centered box' }] },
  holdToTrack: { type: 'switch', label: 'Hold to track', hint: 'Only count time while the mouse button is held' },
  trials: { type: 'segmented', label: 'Trials', options: [{ value: 5, label: '5' }, { value: 10, label: '10' }] },
};

// Per-mode field list, with optional range overrides.
export const MODE_FIELDS = {
  flick: { size: {}, lifetime: { min: 300, hint: 'How long each target stays up' }, spawnDelay: {}, count: { max: 4 }, speed: {}, area: {} },
  gridshot: { size: {}, lifetime: {}, count: {}, speed: {}, area: {} },
  tracking: { size: {}, speed: { min: 40 }, area: {}, holdToTrack: {} },
  reaction: { trials: {} },
  switching: { size: {}, lifetime: {}, count: { min: 2, max: 3 }, speed: {}, area: {} },
};

export const PRESET_NAMES = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'standard', label: 'Standard' },
  { value: 'pro', label: 'Pro' },
  { value: 'insane', label: 'Insane' },
  { value: 'custom', label: 'Custom' },
];

// "standard" must match the defaults in settings.js.
export const PRESETS = {
  flick: {
    beginner: { size: 40, lifetime: 2400, spawnDelay: 150, count: 1, speed: 0 },
    standard: { size: 28, lifetime: 1600, spawnDelay: 0, count: 1, speed: 0 },
    pro: { size: 20, lifetime: 1100, spawnDelay: 0, count: 1, speed: 0 },
    insane: { size: 14, lifetime: 750, spawnDelay: 0, count: 2, speed: 120 },
  },
  gridshot: {
    beginner: { size: 40, lifetime: 0, count: 3, speed: 0 },
    standard: { size: 30, lifetime: 0, count: 3, speed: 0 },
    pro: { size: 22, lifetime: 2000, count: 3, speed: 0 },
    insane: { size: 16, lifetime: 1200, count: 4, speed: 80 },
  },
  tracking: {
    beginner: { size: 44, speed: 160 },
    standard: { size: 32, speed: 260 },
    pro: { size: 24, speed: 380 },
    insane: { size: 16, speed: 520 },
  },
  switching: {
    beginner: { size: 38, lifetime: 0, count: 2, speed: 0 },
    standard: { size: 28, lifetime: 1600, count: 3, speed: 0 },
    pro: { size: 22, lifetime: 1100, count: 3, speed: 60 },
    insane: { size: 16, lifetime: 800, count: 3, speed: 140 },
  },
};
