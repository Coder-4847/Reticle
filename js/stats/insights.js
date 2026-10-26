// Rule-based observations about a run. Each rule returns { score, text } or null;
// the highest-scoring 3-5 are shown. No network or AI calls.

const pct = (v) => `${Math.round(v * 100)}%`;
const REGION_NAMES = ['top-left', 'top', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom', 'bottom-right'];

const RULES = [
  // Warm-up / fatigue
  (a) => {
    const { first, second, n } = a.halves ?? {};
    if (!first || !second || n < 4) return null;
    const change = (second - first) / first;
    if (Math.abs(change) < 0.08) return null;
    return change > 0
      ? { score: 60 + change * 100, text: `Your reaction time slowed ${pct(change)} in the second half. Fatigue or lost focus late in the run.` }
      : { score: 55 - change * 100, text: `You got ${pct(-change)} faster in the second half. You may need a short warm-up before you peak.` };
  },
  // Dominant miss direction
  (a) => {
    const entries = Object.entries(a.missDirs ?? {});
    const total = entries.reduce((s, [, n]) => s + n, 0);
    if (total < 4) return null;
    const [dir, n] = entries.sort((x, y) => y[1] - x[1])[0];
    if (n / total < 0.3) return null;
    return { score: 50 + (n / total) * 60, text: `You miss ${dir} of the target most often (${n} of ${total} misses).` };
  },
  // Overshoot vs undershoot
  (a) => {
    const { over = 0, under = 0 } = a.flick ?? {};
    const total = over + under;
    if (total < 4) return null;
    if (over / total >= 0.65) return { score: 70, text: `${pct(over / total)} of your directional misses overshoot. Try easing off the end of each flick.` };
    if (under / total >= 0.65) return { score: 70, text: `${pct(under / total)} of your directional misses fall short. Commit fully to each flick.` };
    return null;
  },
  // Hit bias on the target
  (a) => {
    if (!a.offsetMean || a.offsets.length < 6) return null;
    const [mx, my] = a.offsetMean;
    const mag = Math.hypot(mx, my);
    if (mag < 0.18) return null;
    const vert = my > 0.1 ? 'low' : my < -0.1 ? 'high' : '';
    const horiz = mx > 0.1 ? 'right' : mx < -0.1 ? 'left' : '';
    const where = [vert, horiz].filter(Boolean).join('-');
    return { score: 40 + mag * 100, text: `Your hits land ${where} of center on average. Aim a touch ${vert === 'low' ? 'higher' : vert === 'high' ? 'lower' : horiz === 'right' ? 'further left' : 'further right'}.` };
  },
  // Weakest screen region
  (a) => {
    if (!a.regions) return null;
    const total = a.regions.reduce((s, r) => s + r.total, 0);
    const hits = a.regions.reduce((s, r) => s + r.hits, 0);
    if (total < 12) return null;
    const overall = hits / total;
    let worst = null;
    a.regions.forEach((r, i) => {
      if (r.total >= 3 && (!worst || r.hits / r.total < worst.acc)) worst = { i, acc: r.hits / r.total };
    });
    if (!worst || overall - worst.acc < 0.15) return null;
    return { score: 45 + (overall - worst.acc) * 100, text: `Targets in the ${REGION_NAMES[worst.i]} are your weakest area (${pct(worst.acc)} vs ${pct(overall)} overall).` };
  },
  // Accuracy vs speed balance
  (a) => {
    const s = a.sum;
    if (s.shots < 10 || a.track) return null;
    if (s.accuracy < 0.7) return { score: 65, text: `Accuracy was ${pct(s.accuracy)}. Fewer, more deliberate shots would raise your score: every miss costs points.` };
    if (s.accuracy > 0.95 && a.rt && a.rt.mean > 450) return { score: 40, text: `You were very accurate (${pct(s.accuracy)}). You can afford to push for speed.` };
    return null;
  },
  // Expired targets
  (a) => {
    const s = a.sum;
    const targets = s.hits + s.expired;
    if (!s.expired || targets < 8) return null;
    const share = s.expired / targets;
    if (share < 0.15) return null;
    return { score: 50 + share * 80, text: `You let ${pct(share)} of targets expire. Prioritize acquiring the target over a perfect shot.` };
  },
  // Consistency
  (a) => {
    if (!a.rt || a.rt.n < 8) return null;
    const cv = a.rt.sd / a.rt.mean;
    if (cv < 0.18) return { score: 35, text: `Very consistent reaction times (±${Math.round(a.rt.sd)} ms around ${Math.round(a.rt.mean)} ms).` };
    if (cv > 0.45) return { score: 45, text: `Your reaction times vary a lot (±${Math.round(a.rt.sd)} ms). Consistency usually improves with steadier pacing.` };
    return null;
  },
  // Tracking
  (a) => {
    if (!a.track?.onFirst || a.track.onSecond === null) return null;
    const diff = a.track.onSecond - a.track.onFirst;
    if (Math.abs(diff) < 0.06) return { score: 30, text: `Your tracking held steady across the run (${pct(a.track.onFirst)} → ${pct(a.track.onSecond)} on target).` };
    return { score: 60, text: diff < 0 ? `On-target time dropped from ${pct(a.track.onFirst)} to ${pct(a.track.onSecond)} in the second half.` : `You locked in as the run went on: ${pct(a.track.onFirst)} → ${pct(a.track.onSecond)} on target.` };
  },
  (a) => {
    if (!a.track?.err) return null;
    return { score: 25, text: `On average the crosshair sat ${Math.round(a.track.err.mean)} px from the target's center.` };
  },
  // Reaction mode
  (a) => {
    if (!a.trials) return null;
    const early = a.trials.reduce((s, t) => s + t.early, 0);
    if (!early) return { score: 30, text: 'No false starts. Clean discipline.' };
    return { score: 55, text: `${early} false start${early > 1 ? 's' : ''}. Waiting for the change costs less than guessing.` };
  },
];

export function insights(analysis, max = 5) {
  const found = [];
  for (const rule of RULES) {
    const r = rule(analysis);
    if (r) found.push(r);
  }
  return found.sort((a, b) => b.score - a.score).slice(0, max).map((r) => r.text);
}
