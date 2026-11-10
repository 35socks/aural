/* Web Audio synth: plays a list of timed note events.
   Event: { start, dur, freqs[], vol, voice: { tone: decay } | { click: accent } } (seconds, Hz). */
(function (g) {
  const AT = (g.AT = g.AT || {});

  const HARMONICS = [0, 1.0, 0.5, 0.25, 0.12]; // index = harmonic number
  const RELEASE = 0.08;

  const ev = {
    tone: (start, dur, freqs, vol) => ({ start, dur, freqs, vol, voice: { tone: 2.2 } }),
    sustained: (start, dur, freqs, vol) => ({ start, dur, freqs, vol, voice: { tone: 0.6 } }),
    click: (start, accent, vol) => ({ start, dur: 0.05, freqs: [], vol, voice: { click: accent } }),
  };

  let ctx = null, master = null, wave = null;
  let nodes = [];
  let endTimer = null;
  let playingUntil = 0;

  function init() {
    if (ctx) return true;
    const AC = g.AudioContext || g.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    // Soft clip so chords never distort.
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) curve[i] = Math.tanh((i / (curve.length - 1)) * 4 - 2);
    shaper.curve = curve;
    master = ctx.createGain();
    master.gain.value = 1.6; // after the soft clip; loudest topic peaks around 0.87
    // Input scaled so the curve acts like tanh(x) for x in -2..2 (x/2 maps to -1..1).
    const pre = ctx.createGain();
    pre.gain.value = 0.5;
    pre.connect(shaper);
    shaper.connect(master);
    master.connect(ctx.destination);
    master.pre = pre;
    wave = ctx.createPeriodicWave(new Float32Array(HARMONICS.length), Float32Array.from(HARMONICS), {
      disableNormalization: true,
    });
    return true;
  }

  function stop() {
    clearTimeout(endTimer);
    for (const n of nodes) {
      try { n.stop(); } catch (e) { /* already stopped */ }
    }
    nodes = [];
    playingUntil = 0;
  }

  function totalSeconds(events) {
    return events.reduce((m, e) => Math.max(m, e.start + e.dur + RELEASE), 0);
  }

  /** Plays events; returns the duration in seconds, or 0 if audio is unavailable. */
  function play(events, onEnd) {
    stop();
    if (!init()) return 0;
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime + 0.06;
    for (const e of events) {
      const start = t0 + e.start;
      if (e.voice.click !== undefined) {
        const accent = e.voice.click;
        const o = ctx.createOscillator();
        const gn = ctx.createGain();
        o.frequency.value = accent ? 1600 : 1000;
        const amp = e.vol * (accent ? 0.5 : 0.32);
        gn.gain.setValueAtTime(amp, start);
        gn.gain.setTargetAtTime(0, start, 1 / 120);
        o.connect(gn).connect(master.pre);
        o.start(start);
        o.stop(start + 0.05);
        nodes.push(o);
        continue;
      }
      if (!e.freqs.length) continue;
      const decay = e.voice.tone;
      const total = e.dur + RELEASE;
      const perVoice = (e.vol * 0.28) / Math.sqrt(e.freqs.length);
      const N = 160;
      const curve = new Float32Array(N);
      for (let i = 0; i < N; i++) {
        const t = (i / (N - 1)) * total;
        const attack = Math.min(t / 0.004, 1);
        const rel = t > e.dur ? Math.max(1 - (t - e.dur) / RELEASE, 0) : 1;
        curve[i] = perVoice * attack * rel * Math.exp(-t * decay);
      }
      const gn = ctx.createGain();
      gn.gain.setValueCurveAtTime(curve, start, total);
      gn.connect(master.pre);
      for (const f of e.freqs) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(wave);
        o.frequency.value = f;
        o.connect(gn);
        o.start(start);
        o.stop(start + total + 0.02);
        nodes.push(o);
      }
    }
    const secs = totalSeconds(events) + 0.1;
    playingUntil = performance.now() + secs * 1000;
    endTimer = setTimeout(() => {
      playingUntil = 0;
      if (onEnd) onEnd();
    }, secs * 1000);
    return secs;
  }

  AT.synth = { _ctx: () => ctx, ev, play, stop, totalSeconds, isPlaying: () => performance.now() < playingUntil, supported: () => !!(g.AudioContext || g.webkitAudioContext) };
})(typeof window !== "undefined" ? window : globalThis);
