import { settings } from '../state/settings.js';

// All sounds are synthesized with the Web Audio API; no audio files.
let ac = null;
let master = null;

function ensure() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  master.gain.value = settings.get('audio.master');
  return ac;
}

function tone({ type = 'sine', f0, f1 = f0, dur, gain = 0.3, attack = 0.003 }) {
  const c = ensure();
  if (!c || master.gain.value <= 0) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

const SOUNDS = {
  hit: () => tone({ type: 'sine', f0: 1100, f1: 1650, dur: 0.07, gain: 0.25 }),
  miss: () => tone({ type: 'triangle', f0: 220, f1: 140, dur: 0.09, gain: 0.18 }),
  count: () => tone({ type: 'sine', f0: 660, dur: 0.1, gain: 0.2 }),
  go: () => tone({ type: 'sine', f0: 990, f1: 1320, dur: 0.18, gain: 0.25 }),
};

export const audio = {
  /** Call from a user gesture so the browser allows playback. */
  unlock: ensure,
  play(name) {
    SOUNDS[name]?.();
  },
};
