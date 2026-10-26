import { settings } from '../state/settings.js';

// All sounds are synthesized with the Web Audio API; no audio files.
let ac = null;
let master = null;
let noise = null;

function ensure() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(gainScale, { type = 'sine', f0, f1 = f0, dur, gain = 0.3, attack = 0.003 }) {
  const c = ensure();
  if (!c || gainScale <= 0) return;
  const t = c.currentTime;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain * gainScale, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(gainScale, { dur, gain, freq }) {
  const c = ensure();
  if (!c || gainScale <= 0) return;
  if (!noise) {
    noise = c.createBuffer(1, c.sampleRate * 0.1, c.sampleRate);
    const ch = noise.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime;
  const src = c.createBufferSource();
  const filter = c.createBiquadFilter();
  const env = c.createGain();
  src.buffer = noise;
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = 1.2;
  env.gain.setValueAtTime(gain * gainScale, t);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
}

const HIT_TIMBRES = {
  click: (g) => tone(g, { f0: 1100, f1: 1650, dur: 0.07, gain: 0.25 }),
  pop: (g) => tone(g, { type: 'triangle', f0: 720, f1: 240, dur: 0.09, gain: 0.35 }),
  tick: (g) => noiseBurst(g, { dur: 0.04, gain: 0.5, freq: 3800 }),
};

const SOUNDS = {
  hit: (g) => HIT_TIMBRES[settings.get('audio.hitTimbre')]?.(g),
  miss: (g) => tone(g, { type: 'triangle', f0: 220, f1: 140, dur: 0.09, gain: 0.18 }),
  spawn: (g) => tone(g, { f0: 520, f1: 600, dur: 0.05, gain: 0.12 }),
  count: (g) => tone(g, { f0: 660, dur: 0.1, gain: 0.2 }),
  go: (g) => tone(g, { f0: 990, f1: 1320, dur: 0.18, gain: 0.25 }),
};

const CATEGORY = { hit: 'hit', miss: 'miss', spawn: 'spawn', count: 'countdown', go: 'countdown' };

export const audio = {
  /** Call from a user gesture so the browser allows playback. */
  unlock: ensure,
  play(name) {
    const a = settings.get('audio');
    if (!ensure() || a.master <= 0) return;
    master.gain.value = a.master;
    SOUNDS[name]?.(a[CATEGORY[name]] ?? 1);
  },
};
