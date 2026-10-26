import { DURATIONS } from '../modes/presets.js';

// Declarative settings layout. Row types: slider, switch, color, segmented, custom.
// `when(get)` hides a row unless it returns true; `block` stacks the control under the label.

const ACCENTS = ['#4f8dff', '#7c6cff', '#22c3a6', '#38d996', '#ffb547', '#ff7a45', '#ff4f8b', '#e8eaed'];
const CROSSHAIR_COLORS = ['#4dffa6', '#00e5ff', '#ffee00', '#ff3df5', '#ffffff', '#ff3b3b'];
const TARGET_COLORS = ['#ff4f6a', '#ffb547', '#38d996', '#3fc6ff', '#b28cff', '#ffffff'];
const BG_COLORS = ['#0b0c0f', '#14161b', '#101820', '#1b1530', '#2a2d33', '#d9dce1'];
const pct = { min: 0, max: 1, step: 0.01, scale: 100, unit: '%' };
const lineStyle = (get) => ['classic', 't'].includes(get('crosshair.style'));
const isBg = (type) => (get) => get('background.type') === type;

export const SECTIONS = [
  {
    id: 'general', title: 'General', reset: ['ui', 'run'],
    rows: [
      { type: 'color', path: 'ui.accent', label: 'Accent color', hint: 'Highlights across the interface.', swatches: ACCENTS, block: true },
      {
        type: 'segmented', path: 'ui.animations', label: 'Animations', hint: 'System follows your OS reduced-motion preference.',
        options: [{ value: 'system', label: 'System' }, { value: 'full', label: 'Full' }, { value: 'reduced', label: 'Reduced' }, { value: 'off', label: 'Off' }],
      },
      { type: 'segmented', path: 'run.duration', label: 'Run duration', hint: 'Length of a timed run.', options: DURATIONS },
      { type: 'switch', path: 'ui.fps', label: 'FPS counter', hint: 'Show frames per second during runs.' },
    ],
  },
  {
    id: 'profiles', title: 'Profiles', reset: [],
    rows: [
      { type: 'custom', id: 'profiles', label: 'Your profiles', hint: 'A profile stores your crosshair, pointer, trail, background, targets, effects and audio. The active profile saves changes automatically.', block: true },
    ],
  },
  {
    id: 'crosshair', title: 'Crosshair', reset: ['crosshair'], swatchPreview: true,
    rows: [
      {
        type: 'segmented', path: 'crosshair.style', label: 'Style', block: true,
        options: [{ value: 'classic', label: 'Classic' }, { value: 't', label: 'T-style' }, { value: 'dot', label: 'Dot' }, { value: 'circle', label: 'Circle' }, { value: 'circleDot', label: 'Circle + dot' }],
      },
      { type: 'color', path: 'crosshair.color', label: 'Color', swatches: CROSSHAIR_COLORS, block: true },
      { type: 'slider', path: 'crosshair.length', label: 'Length', hint: 'Radius for circle styles.', min: 0, max: 20, step: 0.5, unit: 'px', when: (g) => g('crosshair.style') !== 'dot' },
      { type: 'slider', path: 'crosshair.thickness', label: 'Thickness', min: 0.5, max: 6, step: 0.5, unit: 'px', when: (g) => g('crosshair.style') !== 'dot' },
      { type: 'slider', path: 'crosshair.gap', label: 'Center gap', min: -4, max: 12, step: 0.5, unit: 'px', when: lineStyle },
      { type: 'switch', path: 'crosshair.dot', label: 'Center dot', when: (g) => ['classic', 't', 'circle'].includes(g('crosshair.style')) },
      {
        type: 'slider', path: 'crosshair.dotSize', label: 'Dot size', min: 1, max: 8, step: 0.5, unit: 'px',
        when: (g) => g('crosshair.dot') || ['dot', 'circleDot'].includes(g('crosshair.style')),
      },
      { type: 'switch', path: 'crosshair.outline', label: 'Outline' },
      { type: 'slider', path: 'crosshair.outlineThickness', label: 'Outline thickness', min: 0.5, max: 3, step: 0.5, unit: 'px', when: (g) => g('crosshair.outline') },
      { type: 'slider', path: 'crosshair.opacity', label: 'Opacity', ...pct, min: 0.1 },
      { type: 'switch', path: 'crosshair.pulse', label: 'Pulse on click', hint: 'The crosshair kicks open on every shot.' },
      { type: 'slider', path: 'crosshair.pulseStrength', label: 'Pulse strength', min: 1, max: 12, step: 0.5, unit: 'px', when: (g) => g('crosshair.pulse') },
      { type: 'custom', id: 'crosshairCode', label: 'Share code', hint: 'Copy your crosshair, or paste a code to load one.', block: true },
    ],
  },
  {
    id: 'pointer', title: 'Pointer', reset: ['pointer'],
    rows: [
      { type: 'switch', path: 'pointer.lock', label: 'Raw input (pointer lock)', hint: 'Captures the mouse during runs and bypasses OS acceleration where supported.' },
      { type: 'slider', path: 'pointer.sensitivity', label: 'Sensitivity', hint: 'Multiplier on mouse movement.', min: 0.1, max: 5, step: 0.05, unit: '×' },
      {
        type: 'segmented', path: 'pointer.hitFeedback', label: 'Hit confirmation',
        options: [{ value: 'sound', label: 'Sound' }, { value: 'flash', label: 'Flash' }, { value: 'both', label: 'Both' }, { value: 'none', label: 'None' }],
      },
    ],
  },
  {
    id: 'trail', title: 'Cursor trail', reset: ['trail'],
    rows: [
      { type: 'switch', path: 'trail.enabled', label: 'Show trail' },
      { type: 'segmented', path: 'trail.style', label: 'Style', options: [{ value: 'line', label: 'Line' }, { value: 'dots', label: 'Dots' }, { value: 'glow', label: 'Glow' }], when: (g) => g('trail.enabled') },
      {
        type: 'segmented', path: 'trail.colorMode', label: 'Color',
        options: [{ value: 'accent', label: 'Accent' }, { value: 'crosshair', label: 'Crosshair' }, { value: 'custom', label: 'Custom' }], when: (g) => g('trail.enabled'),
      },
      { type: 'color', path: 'trail.color', label: 'Custom color', swatches: CROSSHAIR_COLORS, block: true, when: (g) => g('trail.enabled') && g('trail.colorMode') === 'custom' },
      { type: 'slider', path: 'trail.length', label: 'Length', min: 40, max: 600, step: 10, unit: 'ms', when: (g) => g('trail.enabled') },
      { type: 'slider', path: 'trail.fade', label: 'Fade speed', ...pct, when: (g) => g('trail.enabled') },
      { type: 'slider', path: 'trail.width', label: 'Width', min: 1, max: 12, step: 0.5, unit: 'px', when: (g) => g('trail.enabled') },
    ],
  },
  {
    id: 'background', title: 'Background', reset: ['background'],
    rows: [
      {
        type: 'segmented', path: 'background.type', label: 'Type', block: true,
        options: [{ value: 'solid', label: 'Solid' }, { value: 'grid', label: 'Grid' }, { value: 'gradient', label: 'Gradient' }, { value: 'stars', label: 'Starfield' }, { value: 'image', label: 'Image' }],
      },
      { type: 'color', path: 'background.color', label: 'Color', swatches: BG_COLORS, block: true },
      { type: 'color', path: 'background.color2', label: 'Gradient color', swatches: ['#1a2233', '#2a1a33', '#13282a', '#33241a'], block: true, when: isBg('gradient') },
      { type: 'slider', path: 'background.gridSpacing', label: 'Grid spacing', min: 16, max: 128, step: 4, unit: 'px', when: isBg('grid') },
      { type: 'slider', path: 'background.gridOpacity', label: 'Grid opacity', ...pct, min: 0.02, max: 0.3, when: isBg('grid') },
      { type: 'custom', id: 'bgImage', label: 'Image', hint: 'Stored on this device only.', when: isBg('image') },
      { type: 'slider', path: 'background.imageDim', label: 'Image dim', ...pct, max: 0.9, when: isBg('image') },
      { type: 'switch', path: 'background.vignette', label: 'Vignette' },
      { type: 'slider', path: 'background.brightness', label: 'Brightness', ...pct, min: 0.5, max: 1.5 },
    ],
  },
  {
    id: 'targets', title: 'Targets', reset: ['targets'],
    rows: [
      { type: 'custom', id: 'shapes', label: 'Shape', block: true },
      { type: 'custom', id: 'cbPresets', label: 'Colorblind-safe presets', hint: 'Okabe–Ito color pairs for the target and its hit flash.', block: true },
      { type: 'segmented', path: 'targets.colorMode', label: 'Colors', options: [{ value: 'single', label: 'Single' }, { value: 'states', label: 'Per state' }] },
      { type: 'color', path: 'targets.color', label: 'Target color', swatches: TARGET_COLORS, block: true },
      { type: 'color', path: 'targets.hitColor', label: 'Hit flash color', swatches: TARGET_COLORS, block: true, when: (g) => g('targets.colorMode') === 'states' },
      { type: 'switch', path: 'targets.outline', label: 'Outline' },
      { type: 'switch', path: 'targets.glow', label: 'Glow' },
      { type: 'slider', path: 'targets.opacity', label: 'Opacity', ...pct, min: 0.2 },
      { type: 'slider', path: 'targets.sizeVariation', label: 'Random size variation', hint: 'Each target is up to this much larger or smaller.', ...pct, max: 0.5 },
      { type: 'switch', path: 'targets.randomRotation', label: 'Random rotation' },
    ],
  },
  {
    id: 'effects', title: 'Effects', reset: ['effects'],
    rows: [
      { type: 'switch', path: 'effects.spawnPop', label: 'Spawn pop', hint: 'Targets scale in with a small overshoot.' },
      { type: 'switch', path: 'effects.hitBurst', label: 'Hit burst', hint: 'Particles when a target is hit.' },
      { type: 'switch', path: 'effects.fragments', label: 'Shape fragments', hint: 'Small pieces in the shape of the target fly off on a hit.' },
      { type: 'switch', path: 'effects.clickPing', label: 'Click ping', hint: 'A thin ring where you click.' },
      { type: 'switch', path: 'effects.missRipple', label: 'Miss ripple', hint: 'A red ripple where a shot misses.' },
      { type: 'switch', path: 'effects.streak', label: 'Streak counter', hint: 'Shows consecutive hits under the HUD.' },
      { type: 'switch', path: 'effects.screenShake', label: 'Screen shake on miss', hint: 'A very small shake. Off by default.' },
      { type: 'switch', path: 'effects.timerBar', label: 'Timer bar', hint: 'The progress bar along the top edge.' },
    ],
  },
  {
    id: 'audio', title: 'Audio', reset: ['audio'],
    rows: [
      { type: 'slider', path: 'audio.master', label: 'Master volume', ...pct },
      { type: 'slider', path: 'audio.hit', label: 'Hit', ...pct },
      { type: 'slider', path: 'audio.miss', label: 'Miss', ...pct },
      { type: 'slider', path: 'audio.spawn', label: 'Target spawn', ...pct },
      { type: 'slider', path: 'audio.countdown', label: 'Countdown', ...pct },
      { type: 'segmented', path: 'audio.hitTimbre', label: 'Hit sound', options: [{ value: 'click', label: 'Click' }, { value: 'pop', label: 'Pop' }, { value: 'tick', label: 'Tick' }] },
      { type: 'custom', id: 'audioTest', label: 'Test sounds' },
    ],
  },
];
