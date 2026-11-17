/* Web Audio synth: a modelled piano plus a small drum kit, with no audio files.
   Event: { start, dur, freqs[], vol, voice: { inst, sus } | { click: accent, drum: kind } } (seconds, Hz).
   Piano notes are rendered once per pitch from a string model (inexact harmonics, two detuned strings per note,
   a fast-then-slow decay and a hammer thump) and cached. Drums are short synthesised hits. */
(function (g) {
  const AT = (g.AT = g.AT || {});

  const RELEASE = 0.35; // default tail for drum hits
  const PIANO_RATE = 22050; // piano notes are rendered at this rate; every partial used sits well below 11 kHz

  const INSTRUMENTS = {
    piano: {
      name: "Piano", family: "Keyboard", centre: 60, poly: true, rel: 0.5, key: "piano",
      desc: "Piano: a struck-string keyboard instrument. Each note starts sharply, then fades away.",
    },
  };
  const ORDER = ["piano"];
  const MELODIC = ["piano"];
  const POLY = ["piano"];
  const AGILE = ["piano"];
  const DRUMS = ["kick", "snare", "hat", "openhat", "rim", "tom"];


  const ev = {
    tone: (start, dur, freqs, vol, inst) => ({ start, dur, freqs, vol, voice: { inst: inst || null } }),
    sustained: (start, dur, freqs, vol, inst) => ({ start, dur, freqs, vol, voice: { inst: inst || null, sus: true } }),
    /** A pulse tap: the accented one is a kick drum, the others a closed hi-hat. */
    click: (start, accent, vol) => ({ start, dur: 0.05, freqs: [], vol, voice: { click: accent, drum: accent ? "kick" : "hat" } }),
    /** Any drum hit: kick, snare, hat, openhat, rim or tom. */
    drum: (start, kind, vol) => ({ start, dur: 0.05, freqs: [], vol, voice: { click: kind === "kick", drum: kind } }),
  };

  const midiOf = (f) => 69 + 12 * Math.log2(f / 440);
  const isDrum = (e) => e.voice.click !== undefined || e.voice.drum !== undefined;
  const relOf = (e) => (isDrum(e) ? RELEASE : INSTRUMENTS.piano.rel);

  /** The instrument for a question: always the piano. */
  function choose() { return "piano"; }

  /** Moves events by whole octaves into the piano's comfortable register. Octave shifts keep every interval,
      chord and rhythm the same, so the question is unchanged. */
  function fit(events, key) {
    const inst = INSTRUMENTS[key] || INSTRUMENTS.piano;
    const midis = [];
    for (const e of events) for (const f of e.freqs) midis.push(midiOf(f));
    let k = 0;
    if (midis.length) {
      midis.sort((a, b) => a - b);
      const median = midis[Math.floor(midis.length / 2)];
      k = Math.round((inst.centre - median) / 12);
      while (k > 0 && midis[midis.length - 1] + 12 * k > 100) k--;
      while (k < 0 && midis[0] + 12 * k < 24) k++;
    }
    const mul = Math.pow(2, k);
    return events.map((e) => (isDrum(e) ? e : {
      ...e, freqs: e.freqs.map((f) => f * mul), voice: { ...e.voice, inst: e.voice.inst || "piano" },
    }));
  }

  // ---------------------------------------------------------------------------------------------
  // Piano: additive model of a struck string, rendered to a sample once per pitch.
  // ---------------------------------------------------------------------------------------------
  const clampN = (x, a, b) => Math.max(a, Math.min(b, x));

  /** Samples (Float32Array) for one piano note at `freq` Hz. */
  function renderPiano(freq, sr) {
    const midi = midiOf(freq);
    const secs = clampN(7 - (midi - 36) * 0.075, 2.4, 6.5);
    const N = Math.floor(sr * secs);
    const out = new Float64Array(N);
    // Real strings are slightly stiff, so upper partials sit a little sharp of exact multiples.
    const B = 0.00022 * Math.exp(Math.max(0, midi - 60) * 0.065) * (midi < 40 ? 1.8 : 1);
    const top = clampN(Math.floor(9500 / freq), 3, 34);
    // Time for the fundamental to fade by 60 dB: long in the bass, short at the top.
    const t60 = clampN(14 - (midi - 30) * 0.17, 1.6, 13);
    const r0 = 6.9 / t60;
    const strike = 0.118; // the hammer hits about an eighth of the way along the string
    // Seeded so a given pitch always sounds the same.
    let seed = Math.round(midi * 100) * 2654435761 >>> 0;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const dt = 1 / sr;
    const strings = [-1, 1]; // two slightly mistuned strings per note (they beat softly together)
    for (let n = 1; n <= top; n++) {
      const fn = n * freq * Math.sqrt(1 + B * n * n);
      if (fn > 10000) break;
      const amp = (0.12 + Math.abs(Math.sin(Math.PI * n * strike))) / Math.pow(n, 0.78) * Math.exp(-(n - 1) * 0.035);
      const rs = r0 * (1 + 0.32 * (n - 1));   // slow decay rate for this partial
      const rf = rs * 5.5;                    // the quick initial drop (the "prompt" sound)
      for (const sgn of strings) {
        const w = 2 * Math.PI * fn * Math.pow(2, (sgn * (0.5 + rnd() * 0.5)) / 1200) * dt;
        const ph = rnd() * 6.2832;
        let c = Math.cos(ph), s = Math.sin(ph);
        const dc = Math.cos(w), ds = Math.sin(w);
        let es = amp * 0.5 * 0.55, ef = amp * 0.5 * 0.45;
        const ms = Math.exp(-rs * dt), mf = Math.exp(-rf * dt);
        for (let i = 0; i < N; i++) {
          out[i] += s * (es + ef);
          const c2 = c * dc - s * ds;
          s = s * dc + c * ds; c = c2;
          es *= ms; ef *= mf;
        }
      }
    }
    // Hammer thump: a few milliseconds of low-passed noise.
    let lp = 0;
    const thump = Math.min(N, Math.floor(sr * 0.05));
    const k = clampN(2 * Math.PI * clampN(freq * 2.5, 300, 2500) * dt, 0.02, 0.6);
    for (let i = 0; i < thump; i++) {
      lp += k * ((rnd() * 2 - 1) - lp);
      out[i] += lp * Math.exp(-i * dt / 0.007) * 0.55;
    }
    // Fade in over 2 ms (no click) and out over the last 12% (no cut-off).
    const a = Math.floor(sr * 0.002), f0 = Math.floor(N * 0.88);
    let peak = 0;
    for (let i = 0; i < N; i++) {
      if (i < a) out[i] *= i / a;
      if (i >= f0) out[i] *= 1 - (i - f0) / (N - f0);
      if (i < sr * 0.1) peak = Math.max(peak, Math.abs(out[i]));
    }
    const norm = 0.9 / (peak || 1);
    const buf = new Float32Array(N);
    for (let i = 0; i < N; i++) buf[i] = out[i] * norm;
    return buf;
  }

  // ---------------------------------------------------------------------------------------------
  // Drums: short synthesised hits.
  // ---------------------------------------------------------------------------------------------
  function renderDrum(kind, sr) {
    const secs = { kick: 0.5, snare: 0.3, hat: 0.12, openhat: 0.5, rim: 0.12, tom: 0.5 }[kind];
    const N = Math.floor(sr * secs);
    const out = new Float64Array(N);
    const dt = 1 / sr;
    let seed = 12345 + kind.length * 77;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
    if (kind === "kick" || kind === "tom") {
      const f0 = kind === "kick" ? 46 : 96, f1 = kind === "kick" ? 150 : 210;
      const tau = kind === "kick" ? 0.16 : 0.2;
      let ph = 0;
      for (let i = 0; i < N; i++) {
        const t = i * dt;
        ph += 2 * Math.PI * (f0 + (f1 - f0) * Math.exp(-t / 0.028)) * dt;
        out[i] = Math.sin(ph) * Math.exp(-t / tau) + rnd() * Math.exp(-t / 0.004) * 0.35;
      }
    } else if (kind === "snare") {
      let prev = 0, ph1 = 0, ph2 = 0;
      for (let i = 0; i < N; i++) {
        const t = i * dt;
        const nz = rnd();
        const hp = nz - prev; prev = nz;           // brightens the noise
        ph1 += 2 * Math.PI * 188 * dt; ph2 += 2 * Math.PI * 312 * dt;
        out[i] = hp * 0.75 * Math.exp(-t / 0.075) + (Math.sin(ph1) * 0.55 + Math.sin(ph2) * 0.25) * Math.exp(-t / 0.045);
      }
    } else if (kind === "hat" || kind === "openhat") {
      const tau = kind === "hat" ? 0.022 : 0.16;
      const ratios = [2, 3, 4.16, 5.43, 6.79, 8.21];
      const ph = ratios.map(() => 0);
      let p1 = 0, p2 = 0;
      for (let i = 0; i < N; i++) {
        const t = i * dt;
        let m = 0;
        for (let j = 0; j < ratios.length; j++) { ph[j] += ratios[j] * 41 * dt; m += (ph[j] % 1) < 0.5 ? 1 : -1; }
        const raw = m / 6 * 0.5 + rnd() * 0.6;
        const hp = raw - 2 * p1 + p2; p2 = p1; p1 = raw;   // strong high-pass
        out[i] = hp * Math.exp(-t / tau);
      }
    } else { // rim: a woody click
      let ph = 0;
      for (let i = 0; i < N; i++) {
        const t = i * dt;
        ph += 2 * Math.PI * 1750 * dt;
        out[i] = Math.sin(ph) * Math.exp(-t / 0.012) * 0.7 + rnd() * Math.exp(-t / 0.003) * 0.5;
      }
    }
    let peak = 0;
    for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(out[i]));
    const buf = new Float32Array(N);
    const gain = { kick: 0.95, snare: 0.8, hat: 0.55, openhat: 0.5, rim: 0.7, tom: 0.9 }[kind] / (peak || 1);
    for (let i = 0; i < N; i++) buf[i] = out[i] * gain;
    return buf;
  }

  let ctx = null, master = null, analyser = null, specBuf = null;
  const pianoCache = new Map();
  const drumCache = new Map();
  let nodes = [];
  let endTimer = null;
  let playingUntil = 0;
  let startedAt = 0;

  function makeBuffer(data, rate) {
    const b = ctx.createBuffer(1, data.length, rate);
    b.getChannelData(0).set(data);
    return b;
  }
  function pianoBuf(freq) {
    const key = Math.round(midiOf(freq) * 20);
    let b = pianoCache.get(key);
    if (!b) { b = makeBuffer(renderPiano(freq, PIANO_RATE), PIANO_RATE); pianoCache.set(key, b); }
    return b;
  }
  function drumBuf(kind) {
    let b = drumCache.get(kind);
    if (!b) { b = makeBuffer(renderDrum(kind, ctx.sampleRate), ctx.sampleRate); drumCache.set(kind, b); }
    return b;
  }

  /** A short, soft room: decaying noise, so the piano is not bone dry. */
  function roomImpulse() {
    const len = Math.floor(ctx.sampleRate * 1.3);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        lp += 0.35 * ((Math.random() * 2 - 1) - lp);
        d[i] = lp * Math.exp(-(i / ctx.sampleRate) / 0.28) * (i < 400 ? i / 400 : 1);
      }
    }
    return ir;
  }

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
    master.gain.value = 1.5;
    const pre = ctx.createGain();
    pre.gain.value = 0.5;
    pre.connect(shaper);
    shaper.connect(master);
    master.connect(ctx.destination);
    master.pre = pre;
    // A little room sound, mixed in beside the dry signal.
    try {
      const room = ctx.createConvolver();
      room.buffer = roomImpulse();
      const wet = ctx.createGain();
      wet.gain.value = 0.16;
      master.connect(room);
      room.connect(wet);
      wet.connect(ctx.destination);
    } catch (e) { /* no reverb: still fine */ }
    // Tap for the live meter.
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    analyser.maxDecibels = -22;
    master.connect(analyser);
    specBuf = new Uint8Array(analyser.frequencyBinCount);
    warm();
    return true;
  }

  /** Renders the commonly used notes and the drum kit in the background, so playback starts instantly. */
  function warm() {
    const queue = [];
    DRUMS.forEach((d) => queue.push(() => drumBuf(d)));
    for (let m = 55; m <= 79; m++) queue.push(() => pianoBuf(440 * Math.pow(2, (m - 69) / 12)));
    for (let m = 48; m < 55; m++) queue.push(() => pianoBuf(440 * Math.pow(2, (m - 69) / 12)));
    for (let m = 80; m <= 88; m++) queue.push(() => pianoBuf(440 * Math.pow(2, (m - 69) / 12)));
    const step = () => { const f = queue.shift(); if (f) { f(); setTimeout(step, 25); } };
    setTimeout(step, 400);
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
    return events.reduce((m, e) => Math.max(m, e.start + e.dur + relOf(e)), 0);
  }

  /** Plays events; returns the duration in seconds, or 0 if audio is unavailable. */
  function play(events, onEnd) {
    stop();
    if (!init()) return 0;
    if (ctx.state === "suspended") ctx.resume();
    // Rendering any notes not yet cached takes a moment, so schedule from after that.
    const t0 = ctx.currentTime + 0.06;
    const prepared = events.map((e) => {
      if (isDrum(e)) return { e, bufs: [drumBuf(e.voice.drum || (e.voice.click ? "kick" : "hat"))] };
      return { e, bufs: e.freqs.map(pianoBuf) };
    });
    const startT = Math.max(t0, ctx.currentTime + 0.06);
    startedAt = performance.now() + (startT - ctx.currentTime) * 1000;
    for (const { e, bufs } of prepared) {
      const start = startT + e.start;
      if (isDrum(e)) {
        const gn = ctx.createGain();
        gn.gain.value = clampN(e.vol, 0, 1.2) * 0.85;
        const src = ctx.createBufferSource();
        src.buffer = bufs[0];
        src.connect(gn).connect(master.pre);
        src.start(start);
        nodes.push(src);
        continue;
      }
      const amp = (e.vol * 0.42) / Math.sqrt(Math.max(1, e.freqs.length));
      const tau = e.voice.sus ? 0.16 : 0.07;   // how quickly the damper stops the note after release
      bufs.forEach((buf) => {
        const gn = ctx.createGain();
        gn.gain.setValueAtTime(amp, start);
        gn.gain.setValueAtTime(amp, start + e.dur);
        gn.gain.setTargetAtTime(0, start + e.dur, tau);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(gn).connect(master.pre);
        src.start(start);
        src.stop(start + e.dur + tau * 6 + 0.05);
        nodes.push(src);
      });
    }
    const secs = totalSeconds(events) + 0.1 + (startT - ctx.currentTime);
    playingUntil = performance.now() + secs * 1000;
    endTimer = setTimeout(() => {
      playingUntil = 0;
      if (onEnd) onEnd();
    }, secs * 1000);
    return secs;
  }

  const isPlaying = () => performance.now() < playingUntil;
  /** Seconds since the current playback began, or null when nothing is playing. */
  const elapsed = () => (isPlaying() ? Math.max(0, (performance.now() - startedAt) / 1000) : null);

  /** Live levels (0..1) for `n` log-spaced frequency bands; all zero when silent. */
  function spectrum(n) {
    const out = new Array(n).fill(0);
    if (!analyser || !isPlaying()) return out;
    analyser.getByteFrequencyData(specBuf);
    const lo = 1, hi = Math.floor(specBuf.length * 0.55);
    for (let b = 0; b < n; b++) {
      const a = Math.floor(lo * Math.pow(hi / lo, b / n));
      const z = Math.max(a + 1, Math.floor(lo * Math.pow(hi / lo, (b + 1) / n)));
      let m = 0;
      for (let i = a; i < z; i++) m = Math.max(m, specBuf[i]);
      out[b] = Math.min(1, Math.pow(m / 255, 1.4) * 1.15);
    }
    return out;
  }

  AT.synth = {
    _ctx: () => ctx, ev, play, stop, totalSeconds, isPlaying, elapsed, spectrum, fit, choose, midiOf,
    INSTRUMENTS, ORDER, MELODIC, POLY, AGILE, DRUMS, renderPiano, renderDrum,
    supported: () => !!(g.AudioContext || g.webkitAudioContext),
  };
})(typeof window !== "undefined" ? window : globalThis);
