/* Web Audio synth: plays a list of timed note events on a choice of instruments.
   Event: { start, dur, freqs[], vol, voice: { inst, sus } | { click: accent } } (seconds, Hz).
   `inst` is a key of INSTRUMENTS; `sus` marks sustained chords, which decay more slowly. */
(function (g) {
  const AT = (g.AT = g.AT || {});

  const RELEASE = 0.08; // default tail for clicks and unknown voices
  // Loudness of the original 4-harmonic voice, so every instrument lands at a similar volume.
  const REF_RMS = Math.sqrt(1 + 0.25 + 0.0625 + 0.0144);

  // harm: amplitude of harmonic n at index n.  atk: attack seconds.  decay: exponential decay rate (1/s)
  // down to `floor` (1 = sustained).  rel: release seconds.  vib: [cents, Hz].  lp: low-pass cutoff as
  // a multiple of the note's frequency, [start, end, time-constant] (a sweep when start != end).
  // centre: the MIDI register the instrument sits in.  poly: sounds natural playing chords.
  const INSTRUMENTS = {
    piano: {
      name: "Piano", family: "Keyboard", centre: 60, poly: true,
      harm: [0, 1, 0.6, 0.35, 0.22, 0.14, 0.09, 0.05], atk: 0.004, decay: 2.2, floor: 0, rel: 0.12,
      lp: [10, 3, 0.6], gain: 1,
      desc: "Piano: a struck-string keyboard instrument. Each note starts sharply, then fades away.",
    },
    organ: {
      name: "Organ", family: "Keyboard", centre: 60, poly: true,
      harm: [0, 1, 0.9, 0.5, 0.6, 0.25, 0.3, 0.12, 0.15], atk: 0.02, decay: 0, floor: 1, rel: 0.06,
      lp: null, gain: 0.85,
      desc: "Organ: notes stay at full strength for as long as the key is held, with a full, reedy tone.",
    },
    guitar: {
      name: "Guitar", family: "Plucked strings", centre: 55, poly: true,
      harm: [0, 1, 0.7, 0.45, 0.3, 0.18, 0.1, 0.06], atk: 0.003, decay: 3.4, floor: 0, rel: 0.1,
      lp: [9, 2, 0.25], gain: 1.1,
      desc: "Guitar: plucked strings. Each note starts bright and dies away quickly.",
    },
    strings: {
      name: "Strings (violin)", family: "Bowed strings", centre: 67, poly: true,
      harm: [0, 1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.13, 0.11, 0.09, 0.08], atk: 0.07, decay: 0, floor: 1, rel: 0.18,
      vib: [9, 5.5], lp: [6, 6, 0], gain: 0.75,
      desc: "Strings (violin): a bowed, singing tone that swells in gently and has a slight vibrato.",
    },
    flute: {
      name: "Flute", family: "Woodwind", centre: 76, poly: false,
      harm: [0, 1, 0.18, 0.07, 0.03], atk: 0.06, decay: 0, floor: 1, rel: 0.1,
      vib: [8, 5], lp: null, gain: 1.05,
      desc: "Flute: a pure, breathy woodwind tone, usually high in pitch.",
    },
    clarinet: {
      name: "Clarinet", family: "Woodwind", centre: 64, poly: false,
      harm: [0, 1, 0, 0.55, 0, 0.3, 0, 0.15, 0, 0.08], atk: 0.04, decay: 0, floor: 1, rel: 0.08,
      lp: null, gain: 0.9,
      desc: "Clarinet: a warm, hollow-sounding single-reed woodwind.",
    },
    trumpet: {
      name: "Trumpet", family: "Brass", centre: 68, poly: false,
      harm: [0, 1, 0.85, 0.7, 0.5, 0.35, 0.22, 0.12, 0.07], atk: 0.035, decay: 0, floor: 1, rel: 0.08,
      vib: [4, 5.5], lp: [3, 9, 0.08], gain: 0.75,
      desc: "Trumpet: a bright, brassy tone with a bold edge at the start of each note.",
    },
    marimba: {
      name: "Marimba", family: "Tuned percussion", centre: 69, poly: true,
      harm: [0, 1, 0, 0, 0.3, 0, 0, 0.05], atk: 0.002, decay: 6, floor: 0, rel: 0.06,
      lp: null, gain: 1.3,
      desc: "Marimba: tuned percussion struck with mallets. The notes are short, wooden and mellow.",
    },
    bass: {
      name: "Bass guitar", family: "Plucked strings", centre: 40, poly: false,
      harm: [0, 1, 0.6, 0.3, 0.12, 0.05], atk: 0.01, decay: 1.6, floor: 0.1, rel: 0.1,
      lp: [6, 2, 0.2], gain: 1.2,
      desc: "Bass guitar: a low, round, plucked tone that sits underneath the other instruments.",
    },
  };
  for (const k of Object.keys(INSTRUMENTS)) {
    const inst = INSTRUMENTS[k];
    inst.key = k;
    inst.norm = (REF_RMS / Math.sqrt(inst.harm.reduce((a, x) => a + x * x, 0))) * inst.gain;
  }
  const ORDER = ["piano", "organ", "guitar", "strings", "flute", "clarinet", "trumpet", "marimba", "bass"];
  const MELODIC = ["piano", "organ", "guitar", "strings", "flute", "clarinet", "trumpet", "marimba"];
  const POLY = ["piano", "organ", "guitar", "strings", "marimba"];
  const AGILE = ["piano", "guitar", "marimba", "organ", "clarinet", "trumpet"]; // quick attack, good for fast notes

  const ev = {
    tone: (start, dur, freqs, vol, inst) => ({ start, dur, freqs, vol, voice: { inst: inst || null } }),
    sustained: (start, dur, freqs, vol, inst) => ({ start, dur, freqs, vol, voice: { inst: inst || null, sus: true } }),
    click: (start, accent, vol) => ({ start, dur: 0.05, freqs: [], vol, voice: { click: accent } }),
  };

  const midiOf = (f) => 69 + 12 * Math.log2(f / 440);
  const instOf = (e) => INSTRUMENTS[e.voice.inst] || INSTRUMENTS.piano;
  const relOf = (e) => (e.voice.click !== undefined ? RELEASE : instOf(e).rel);

  /** The instrument for a question: the learner's choice, or a random pick from `allow`. */
  function choose(allow) {
    const pref = AT.progress && AT.progress.setting ? AT.progress.setting("inst") : "mixed";
    if (pref && pref !== "mixed" && INSTRUMENTS[pref]) return pref;
    const pool = allow && allow.length ? allow : MELODIC;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /** Returns events assigned to instrument `key` and moved by whole octaves into its register.
      Octave shifts keep every interval, chord and rhythm the same, so the question is unchanged. */
  function fit(events, key) {
    const inst = INSTRUMENTS[key];
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
    return events.map((e) => (e.voice.click !== undefined ? e : {
      ...e, freqs: e.freqs.map((f) => f * mul), voice: { ...e.voice, inst: e.voice.inst || key },
    }));
  }

  let ctx = null, master = null, analyser = null, specBuf = null;
  let nodes = [];
  let endTimer = null;
  let playingUntil = 0;
  let startedAt = 0;

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
    // Tap for the live meter.
    analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    analyser.smoothingTimeConstant = 0.6;
    analyser.maxDecibels = -22;
    master.connect(analyser);
    specBuf = new Uint8Array(analyser.frequencyBinCount);
    for (const k of ORDER) {
      const inst = INSTRUMENTS[k];
      inst.wave = ctx.createPeriodicWave(new Float32Array(inst.harm.length), Float32Array.from(inst.harm), {
        disableNormalization: true,
      });
    }
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
    return events.reduce((m, e) => Math.max(m, e.start + e.dur + relOf(e)), 0);
  }

  /** Gain curve for one note: attack, exponential decay to a floor, then release. */
  function envelope(inst, e) {
    const total = e.dur + inst.rel;
    const decay = inst.decay * (e.voice.sus ? 0.3 : 1);
    const n = Math.min(900, Math.max(64, Math.ceil(total * 240)));
    const amp = ((e.vol * 0.28) / Math.sqrt(e.freqs.length)) * inst.norm;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = (i / (n - 1)) * total;
      const attack = inst.atk > 0 ? Math.min(t / inst.atk, 1) : 1;
      const body = inst.floor + (1 - inst.floor) * Math.exp(-t * decay);
      const rel = t > e.dur ? Math.max(1 - (t - e.dur) / inst.rel, 0) : 1;
      curve[i] = amp * attack * body * rel;
    }
    return { curve, total };
  }

  /** Plays events; returns the duration in seconds, or 0 if audio is unavailable. */
  function play(events, onEnd) {
    stop();
    if (!init()) return 0;
    if (ctx.state === "suspended") ctx.resume();
    const t0 = ctx.currentTime + 0.06;
    startedAt = performance.now() + 60;
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
      const inst = instOf(e);
      const { curve, total } = envelope(inst, e);
      const gn = ctx.createGain();
      gn.gain.setValueCurveAtTime(curve, start, total);
      gn.connect(master.pre);
      let lfoGain = null;
      if (inst.vib) {
        const lfo = ctx.createOscillator();
        lfo.frequency.value = inst.vib[1];
        lfoGain = ctx.createGain();
        lfoGain.gain.value = inst.vib[0];
        lfo.connect(lfoGain);
        lfo.start(start);
        lfo.stop(start + total + 0.02);
        nodes.push(lfo);
      }
      for (const f of e.freqs) {
        const o = ctx.createOscillator();
        o.setPeriodicWave(inst.wave);
        o.frequency.value = f;
        if (lfoGain) lfoGain.connect(o.detune);
        let out = o;
        if (inst.lp) {
          const lp = ctx.createBiquadFilter();
          lp.type = "lowpass";
          lp.Q.value = 0.7;
          lp.frequency.setValueAtTime(Math.min(f * inst.lp[0], 16000), start);
          if (inst.lp[0] !== inst.lp[1] && inst.lp[2] > 0) {
            lp.frequency.setTargetAtTime(Math.min(f * inst.lp[1], 16000), start, inst.lp[2]);
          }
          o.connect(lp);
          out = lp;
        }
        out.connect(gn);
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
    INSTRUMENTS, ORDER, MELODIC, POLY, AGILE,
    supported: () => !!(g.AudioContext || g.webkitAudioContext),
  };
})(typeof window !== "undefined" ? window : globalThis);
