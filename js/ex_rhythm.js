/* Rhythm, metre, tempo and dynamics questions. */
(function (g) {
  const AT = g.AT;
  const { R, theory: T } = AT;
  const { note } = AT.pitch;
  const E = () => AT.synth.ev;

  const METRES = [
    ["2/4", 2, 2], ["3/4", 3, 2], ["4/4", 4, 2],
    ["6/8", 2, 3], ["9/8", 3, 3], ["12/8", 4, 3],
  ]; // [label, beats per bar, subdivisions per beat]

  function metre() {
    const idx = R.below(METRES.length);
    const [label, beats, subs] = METRES[idx];
    const beatLen = 0.55;
    const bars = beats === 2 ? 4 : 3;
    const events = [];
    for (let bar = 0; bar < bars; bar++) {
      for (let beat = 0; beat < beats; beat++) {
        const t = (bar * beats + beat) * beatLen;
        events.push(E().click(t, beat === 0, 1.0));
        for (let s = 0; s < subs; s++) {
          const pitch = 60 + T.MAJOR[beat === 0 && s === 0 ? 0 : 4];
          events.push(E().tone(t + (s * beatLen) / subs, 0.12, [T.freq(pitch)], s === 0 ? 0.45 : 0.28));
        }
      }
    }
    const compound = subs === 3;
    return {
      category: "metre",
      prompt: "Listen to the pulse (a high click marks the first beat of each bar). What is the time signature?",
      options: METRES.map((m) => m[0]),
      correct: idx,
      events,
      allow: AT.synth.AGILE,
      explanation: `${label}: ${beats} main beats per bar, each split into ${subs}, so it is ${compound ? "compound" : "simple"} time. ` +
        (compound ? "Compound time feels like a lilting 1-2-3, 1-2-3." : "Simple time splits each beat into two."),
    };
  }

  const RHYTHM_TEXT = [
    "Straight rhythm: even notes that line up with the beat.",
    "Dotted rhythm: a long-short, 'jerky' pattern (dotted quaver then semiquaver).",
    "Scotch snap: a short note on the beat followed by a longer note, a Scottish folk feature.",
    "Syncopation: notes are stressed between the beats, so the accents feel off-beat.",
  ];

  function rhythmFeature() {
    const kind = R.below(4); // 0 straight, 1 dotted, 2 Scotch snap, 3 syncopation
    const beat = 0.5;
    const pitches = [60, 62, 64, 62, 60, 64, 67, 64];
    const events = [];
    let t = 0, p = 0;
    const push = (len) => {
      events.push(note(t, len * 0.95, pitches[p % pitches.length], 0.8));
      t += len;
      p++;
    };
    for (let rep = 0; rep < 4; rep++) {
      if (kind === 0) { for (let i = 0; i < 4; i++) push(beat / 2); }
      else if (kind === 1) { for (let i = 0; i < 2; i++) { push(beat * 0.75); push(beat * 0.25); } }
      else if (kind === 2) { for (let i = 0; i < 2; i++) { push(beat * 0.25); push(beat * 0.75); } }
      else { push(beat / 2); push(beat); push(beat / 2); }
    }
    for (let ct = 0; ct < t - 1e-6; ct += beat) {
      const barPos = (ct / (beat * 2)) % 1;
      events.push(E().click(ct, barPos < 0.01, 0.6));
    }
    return {
      category: "rhythmFeature",
      prompt: "Follow the clicks and listen to the melody rhythm. Which feature is it?",
      options: ["Straight rhythm", "Dotted rhythm", "Scotch snap", "Syncopation"],
      correct: kind,
      events,
      allow: AT.synth.AGILE,
      explanation: RHYTHM_TEXT[kind],
    };
  }

  const TEMPO_TEXT = [
    "Steady tempo: the beat stayed the same throughout.",
    "Ritardando (rit.): the music gradually slows down.",
    "Accelerando (accel.): the music gradually speeds up.",
  ];

  function tempo() {
    const kind = R.below(3); // 0 steady, 1 ritardando, 2 accelerando
    const pitches = [60, 64, 67, 64, 60, 64, 67, 72, 67, 64];
    const base = kind === 2 ? 0.7 : 0.35;
    const events = [];
    let t = 0, gap = base;
    pitches.forEach((p, i) => {
      events.push(note(t, gap * 0.9, p, 0.8));
      t += gap;
      if (kind === 1) gap *= 1.17;
      if (kind === 2) gap *= 0.87;
      if (i < 3) gap = base; // first four notes establish the steady beat
    });
    return {
      category: "tempo",
      prompt: "Listen to the melody. What happens to the speed?",
      options: ["Steady", "Ritardando", "Accelerando"],
      correct: kind,
      events,
      explanation: TEMPO_TEXT[kind],
    };
  }

  const DYN_TEXT = [
    "pp (pianissimo): very quiet throughout.",
    "ff (fortissimo): very loud throughout.",
    "Crescendo: gradually getting louder.",
    "Diminuendo: gradually getting quieter.",
    "Sforzando (sfz): one note suddenly and sharply accented.",
  ];

  function dynamics() {
    const kind = R.below(5); // pp, ff, cresc, dim, sfz
    const pitches = [60, 62, 64, 65, 67, 65, 64, 62];
    const n = pitches.length;
    const events = pitches.map((p, i) => {
      const f = i / (n - 1);
      const vol = [0.12, 0.95, 0.12 + 0.8 * f, 0.92 - 0.8 * f, i === 4 ? 1.0 : 0.22][kind];
      return note(i * 0.45, 0.42, p, vol);
    });
    return {
      category: "dynamics",
      prompt: "Listen to the volume of the melody. Which dynamic marking fits?",
      options: ["pp (very quiet)", "ff (very loud)", "Crescendo", "Diminuendo", "Sforzando"],
      correct: kind,
      events,
      explanation: DYN_TEXT[kind],
    };
  }

  AT.rhythm = { metre, rhythmFeature, tempo, dynamics };
})(typeof window !== "undefined" ? window : globalThis);
