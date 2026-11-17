/* Pitch questions for Outcomes 1 and 2: intervals, scales, tonality, triads, seventh chords, progressions. */
(function (g) {
  const AT = g.AT;
  const { R, theory: T } = AT;
  const E = () => AT.synth.ev;

  const note = (start, dur, midi, vol) => E().tone(start, dur, [T.freq(midi)], vol);
  const chord = (start, dur, midis, vol) => E().sustained(start, dur, midis.map(T.freq), vol);

  /** Two notes a given number of semitones apart, or one chord, played the way the question asks. */
  function playShape(notes, harmonic, start) {
    if (harmonic) return [chord(start, 1.8, notes, 0.8)];
    return notes.map((n, i) => note(start + i * 0.55, i === notes.length - 1 ? 1.2 : 0.6, n, 0.8));
  }

  // Triad on a degree, voiced close to the tonic, with the root doubled in the bass.
  function keyChord(start, dur, tonic, degree, vol) {
    const raw = T.triad(tonic, degree);
    const notes = raw.map((n) => { while (n > tonic + 9) n -= 12; return n; });
    notes.push(raw[0] - 12);
    return chord(start, dur, notes, vol);
  }

  // ---- Outcome 1(a): ascending intervals ----
  function intervals() {
    const idx = R.below(T.INTERVALS.length);
    const iv = T.INTERVALS[idx];
    const low = R.range(53, 67);
    return {
      category: "intervals",
      prompt: "Two notes are played one after the other, the second higher. Name the interval.",
      options: T.INTERVALS.map((i) => i.name),
      correct: idx,
      events: [note(0, 0.8, low, 0.8), note(0.9, 1.1, low + iv.semis, 0.8)],
      explanation: `${iv.name}: ${iv.semis} semitone${iv.semis === 1 ? "" : "s"} up (for example ${iv.from}). Sing the major scale from the lower note and count up to the second note.`,
    };
  }

  // ---- Outcome 1(b): scales, going up or down ----
  const SCALE_TEXT = {
    "Major": "Major scale: tone, tone, semitone, tone, tone, tone, semitone. It sounds bright, with a semitone between notes 3 and 4 and between 7 and 8.",
    "Melodic minor": "Melodic minor: going up, the 6th and 7th are raised (T S T T T T S). Coming down it returns to natural minor, so both 6th and 7th drop.",
    "Harmonic minor": "Harmonic minor: the 7th is raised both up and down, which leaves a three-semitone gap between the 6th and 7th notes. It sounds exotic.",
  };

  function scales() {
    const idx = R.below(T.SCALES.length);
    const sc = T.SCALES[idx];
    const up = R.chance(0.5);
    const pattern = up ? sc.up : sc.down;
    const tonic = R.range(55, 64);
    const step = 0.34;
    const events = pattern.map((p, i) => note(i * step, i === pattern.length - 1 ? 1.1 : step + 0.08, tonic + p, 0.8));
    return {
      category: "scales",
      prompt: `A scale is played going ${up ? "up" : "down"}. Which scale is it?`,
      options: T.SCALES.map((s) => s.name),
      correct: idx,
      events,
      explanation: SCALE_TEXT[sc.name] + (!up && sc.name === "Melodic minor" ? " This one was descending, which is the clue." : ""),
    };
  }

  // ---- Outcome 1(c): tonality of a four-bar phrase ----
  // Scale-step phrases (0 = tonic, -1 = the note below it). Four bars of four beats, ending on the tonic.
  const PHRASES = [
    [0, 2, 4, 2, 4, 5, 4, 2, 3, 2, 1, -1, 0, 2, 4, 0],
    [4, 2, 0, 2, 4, 4, 5, 4, 2, 3, 2, 1, -1, 1, 2, 0],
    [0, 0, 2, 4, 5, 4, 2, 4, 3, 1, 2, 3, 4, 1, -1, 0],
  ];

  function tonality() {
    const minor = R.chance(0.5);
    const scale = minor ? T.HARM_MINOR : T.MAJOR;
    const tonic = R.range(55, 64);
    const phrase = R.pick(PHRASES);
    const beat = 0.4;
    const events = [];
    const midiOf = (step) => {
      const oct = Math.floor(step / 7);
      return tonic + oct * 12 + scale[((step % 7) + 7) % 7];
    };
    phrase.forEach((s, i) => {
      const last = i === phrase.length - 1;
      events.push(note(i * beat, last ? 1.4 : beat * 0.95, midiOf(s), last ? 0.85 : 0.75));
    });
    for (let bar = 0; bar < 4; bar++) events.push(E().click(bar * 4 * beat, true, 0.35));
    return {
      category: "tonality",
      prompt: "Listen to this four-bar phrase. Is it in a major or a minor key?",
      options: ["Major", "Minor"],
      correct: minor ? 1 : 0,
      events,
      allow: AT.synth.AGILE,
      explanation: minor
        ? "Minor: the phrase is built on a minor 3rd above the home note, and it sounds darker. A raised 7th leads up to the final note."
        : "Major: the phrase is built on a major 3rd above the home note, and it sounds brighter and settles on the tonic.",
    };
  }

  // ---- Outcome 2(a): major and minor triads, melodic or harmonic ----
  function triads() {
    const idx = R.below(T.TRIADS.length);
    const tr = T.TRIADS[idx];
    const harmonic = R.chance(0.5);
    const root = R.range(50, 62);
    const notes = tr.notes.map((n) => root + n);
    return {
      category: "triads",
      prompt: `A triad is played ${harmonic ? "harmonically (all the notes together)" : "melodically (one note at a time)"}. Is it major or minor?`,
      options: T.TRIADS.map((t) => t.name),
      correct: idx,
      events: playShape(notes, harmonic, 0),
      allow: harmonic ? AT.synth.POLY : undefined,
      explanation: idx === 0
        ? "Major triad: root, major 3rd and perfect 5th (4 + 3 semitones). Listen to the 3rd: it sounds bright."
        : "Minor triad: root, minor 3rd and perfect 5th (3 + 4 semitones). Listen to the 3rd: it sounds darker.",
    };
  }

  // ---- Outcome 2(b): four-note chords, including major and minor 7ths ----
  function sevenths() {
    const CHORDS = [
      { name: "Major", notes: T.TRIADS[0].notes, text: "Major triad: root, major 3rd and perfect 5th (4 + 3 semitones). Only three notes, and it sounds bright." },
      { name: "Minor", notes: T.TRIADS[1].notes, text: "Minor triad: root, minor 3rd and perfect 5th (3 + 4 semitones). Only three notes, and it sounds darker." },
      ...T.SEVENTHS,
    ];
    const idx = R.below(CHORDS.length);
    const ch = CHORDS[idx];
    const harmonic = R.chance(0.6);
    const root = R.range(48, 58);
    const notes = ch.notes.map((n) => root + n);
    return {
      category: "sevenths",
      prompt: `A chord is played ${harmonic ? "all together" : "one note at a time"}. What type of chord is it?`,
      options: CHORDS.map((c) => c.name),
      correct: idx,
      events: playShape(notes, harmonic, 0),
      allow: harmonic ? AT.synth.POLY : undefined,
      explanation: ch.text,
    };
  }

  // ---- Outcome 2(c): three and four chord progressions, by number or by name ----
  const PROGRESSIONS = [
    ["I", "IV", "V"],
    ["I", "V", "IV"],
    ["ii", "V", "I"],
    ["I", "IV", "V", "I"],
    ["I", "V", "vi", "IV"],
    ["I", "vi", "IV", "V"],
    ["vi", "IV", "I", "V"],
    ["I", "vi", "ii", "V"],
    ["I", "iii", "IV", "V"],
    ["I", "IV", "vi", "V"],
  ];

  function progressions() {
    const answer = R.below(PROGRESSIONS.length);
    const prog = PROGRESSIONS[answer];
    const same = [...PROGRESSIONS.keys()].filter((i) => i !== answer && PROGRESSIONS[i].length === prog.length);
    const pool = R.shuffle(same.length >= 3 ? same : [...PROGRESSIONS.keys()].filter((i) => i !== answer));
    const picks = R.shuffle([answer, pool[0], pool[1], pool[2]]);
    const key = R.pick(T.KEYS);
    const byName = R.chance(0.4);
    const fmt = (p) => (byName ? p.map((d) => key.chords[d]).join(" - ") : p.join(" - "));
    return {
      category: "progressions",
      prompt: byName
        ? `${prog.length} chords are played in ${key.name} major. Which chord names match?`
        : `${prog.length} chords are played in a major key. Which progression is it?`,
      options: picks.map((i) => fmt(PROGRESSIONS[i])),
      correct: picks.indexOf(answer),
      events: prog.map((d, i) => keyChord(i * 1.2, 1.15, key.tonic, d, 0.78)),
      allow: AT.synth.POLY,
      explanation: `It was ${prog.join(" - ")}${byName ? ` (${fmt(prog)})` : ""}. Find the home chord I first. Capitals are major chords (I, IV, V) and lower case are minor (ii, iii, vi).`,
    };
  }

  AT.pitch = { note, chord, intervals, scales, tonality, triads, sevenths, progressions };
})(typeof window !== "undefined" ? window : globalThis);
