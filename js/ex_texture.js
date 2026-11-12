/* Melodic memory and bass-pattern questions. */
(function (g) {
  const AT = g.AT;
  const { R, theory: T } = AT;
  const { note, chord } = AT.pitch;

  // MIDI note for a (possibly out-of-range) major-scale index relative to tonic.
  function scaleNote(tonic, idx) {
    const octave = Math.floor(idx / 7);
    const degree = ((idx % 7) + 7) % 7;
    return tonic + octave * 12 + T.MAJOR[degree];
  }

  const melodyEvents = (tonic, degrees, start) =>
    degrees.map((d, i) => note(start + i * 0.5, 0.55, scaleNote(tonic, d), 0.8));

  function melodyMemory() {
    const tonic = R.range(55, 62);
    const degrees = [R.range(0, 4)];
    for (let i = 0; i < 4; i++) {
      const prev = degrees[degrees.length - 1];
      degrees.push(Math.min(7, Math.max(0, prev + R.range(-2, 2))));
    }
    const second = degrees.slice();
    const same = R.chance(0.5);
    let changedAt = 0;
    if (!same) {
      changedAt = R.below(degrees.length);
      const old = degrees[changedAt];
      let nw = old;
      while (nw === old) nw = Math.min(7, Math.max(0, old + R.range(-3, 3)));
      second[changedAt] = nw;
    }
    return {
      category: "melodyMemory",
      prompt: "A short melody is played twice. Is the second playing the same or different?",
      options: ["Same", "Different"],
      correct: same ? 0 : 1,
      events: melodyEvents(tonic, degrees, 0).concat(melodyEvents(tonic, second, 3.4)),
      explanation: same
        ? "Both playings were identical."
        : `Different: note ${changedAt + 1} of the melody was changed the second time.`,
    };
  }

  const BASS_TEXT = [
    "Alberti bass: a chord broken into a repeating low-high-middle-high pattern, typical of the Classical period.",
    "Walking bass: steady, mostly stepwise notes in the bass moving between chord roots, common in jazz and blues.",
    "Sustained (block) chords: each chord is held without being broken up into a pattern.",
  ];

  function bassPattern() {
    const kind = R.below(3); // 0 Alberti, 1 walking, 2 sustained
    const tonic = R.range(55, 60);
    const bar = 1.6;
    const roots = [0, 3, 4, 0]; // I IV V I
    const events = [];
    roots.forEach((root, b) => {
      const t0 = b * bar;
      const r = scaleNote(tonic, root);
      const third = scaleNote(tonic, root + 2);
      const fifth = scaleNote(tonic, root + 4);
      if (kind === 0) {
        [r, fifth, third, fifth, r, fifth, third, fifth].forEach((n, i) =>
          events.push(note(t0 + i * 0.2, 0.22, n, 0.75)));
      } else if (kind === 1) {
        const up = R.chance(0.5) || b === 3;
        for (let i = 0; i < 4; i++) {
          const idx = up ? root + i : root + 3 - i;
          events.push(note(t0 + i * 0.4, 0.4, scaleNote(tonic - 12, idx), 0.85));
        }
      } else {
        events.push(chord(t0, bar, [r, third, fifth, r - 12], 0.75));
      }
    });
    return {
      category: "bassPattern",
      prompt: "Listen to the accompaniment (chords I - IV - V - I). Which pattern is being played?",
      options: ["Alberti bass", "Walking bass", "Sustained chords"],
      correct: kind,
      events,
      // Keep the instrument true to the pattern: block chords need a sound that sustains.
      allow: [["piano", "guitar", "organ"], ["bass", "piano", "organ"], ["piano", "organ", "strings"]][kind],
      explanation: BASS_TEXT[kind],
    };
  }

  /** Timbre: name the instrument playing a short phrase. */
  function instruments() {
    const S = AT.synth;
    const key = R.pick(S.ORDER);
    const picks = R.shuffle([key, ...R.shuffle(S.ORDER.filter((k) => k !== key)).slice(0, 3)]);
    const tonic = 60;
    let idx = R.pick([0, 2, 4]);
    const degrees = [idx];
    for (let i = 0; i < 5; i++) {
      idx = Math.min(8, Math.max(0, idx + R.pick([-2, -1, -1, 1, 1, 2])));
      degrees.push(idx);
    }
    const events = degrees.map((d, i) =>
      note(i * 0.45, i === degrees.length - 1 ? 1.1 : 0.42, scaleNote(tonic, d), 0.8));
    return {
      category: "instruments",
      prompt: "A short phrase is played. Which instrument is playing?",
      options: picks.map((k) => S.INSTRUMENTS[k].name),
      correct: picks.indexOf(key),
      events,
      inst: key, // fixed: the answer is the sound itself, so the learner's instrument setting is ignored
      hideInst: true,
      explanation: S.INSTRUMENTS[key].desc,
    };
  }

  AT.texture = { scaleNote, melodyMemory, bassPattern, instruments };
})(typeof window !== "undefined" ? window : globalThis);
