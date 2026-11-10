/* Pitch questions: tones/semitones, intervals, scales, chords, cadences, progressions. */
(function (g) {
  const AT = g.AT;
  const { R, theory: T } = AT;
  const E = () => AT.synth.ev;

  const note = (start, dur, midi, vol) => E().tone(start, dur, [T.freq(midi)], vol);
  const chord = (start, dur, midis, vol) => E().sustained(start, dur, midis.map(T.freq), vol);

  // Triad on a degree, voiced close to the tonic, with the root doubled in the bass.
  function keyChord(start, dur, tonic, degree, vol) {
    const raw = T.triad(tonic, degree);
    const notes = raw.map((n) => { while (n > tonic + 9) n -= 12; return n; });
    notes.push(raw[0] - 12);
    return chord(start, dur, notes, vol);
  }

  function toneSemitone() {
    const size = R.chance(0.5) ? 1 : 2;
    const low = R.range(55, 70);
    const [a, b] = R.chance(0.5) ? [low, low + size] : [low + size, low];
    return {
      category: "toneSemitone",
      prompt: "Two notes are played one after the other. Is the step between them a tone or a semitone?",
      options: ["Tone", "Semitone"],
      correct: size === 2 ? 0 : 1,
      events: [note(0, 0.8, a, 0.8), note(0.9, 1.0, b, 0.8)],
      explanation: size === 2
        ? "That was a tone: two semitones, like C up to D."
        : "That was a semitone, the smallest step: like E up to F.",
    };
  }

  function intervals() {
    const semis = R.pick(T.INTERVAL_SEMITONES);
    const low = R.range(53, 67);
    const [a, b] = R.chance(0.7) ? [low, low + semis] : [low + semis, low];
    const answer = T.intervalNumber(semis);
    return {
      category: "intervals",
      prompt: "Two notes are played one after the other. What is the size of the leap?",
      options: T.INTERVAL_LABELS.slice(),
      correct: T.INTERVAL_LABELS.indexOf(answer),
      events: [note(0, 0.8, a, 0.8), note(0.9, 1.0, b, 0.8)],
      explanation: `That was a ${answer} (${semis} semitones). Tip: sing the major scale up from the lower note and count the notes.`,
    };
  }

  const SCALE_TEXT = {
    "Major": "Major scale: bright, with a semitone between notes 3-4 and 7-8.",
    "Natural minor": "Natural minor: darker; the 3rd, 6th and 7th notes are lowered compared with major.",
    "Harmonic minor": "Harmonic minor: like natural minor but with a raised 7th, leaving a big step between notes 6 and 7.",
    "Chromatic": "Chromatic scale: every step is a semitone.",
    "Whole tone": "Whole tone scale: every step is a tone, so it sounds dreamy and has no clear home note.",
    "Pentatonic": "Pentatonic scale: only five notes per octave, with no semitone steps.",
  };

  function scales() {
    const idx = R.below(T.SCALES.length);
    const [name, pattern] = T.SCALES[idx];
    const tonic = R.range(55, 65);
    const step = pattern.length > 9 ? 0.2 : 0.32;
    const events = pattern.map((p, i) =>
      note(i * step, i === pattern.length - 1 ? 1.0 : step + 0.1, tonic + p, 0.8));
    return {
      category: "scales",
      prompt: "A scale is played going up. Which scale is it?",
      options: T.SCALES.map((s) => s[0]),
      correct: idx,
      events,
      explanation: SCALE_TEXT[name],
    };
  }

  const CHORD_TEXT = {
    "Major": "Major chord: root, major 3rd and perfect 5th. It sounds bright and happy.",
    "Minor": "Minor chord: root, minor 3rd and perfect 5th. It sounds sad or serious.",
    "Dominant 7th": "Dominant 7th: a major chord with an added minor 7th. It sounds tense and wants to resolve.",
    "Diminished": "Diminished chord: two minor 3rds stacked. It sounds tense and unstable.",
    "Augmented": "Augmented chord: two major 3rds stacked. It sounds uneasy and dreamlike.",
  };

  function chords() {
    const idx = R.below(T.CHORD_QUALITIES.length);
    const [name, pattern] = T.CHORD_QUALITIES[idx];
    const root = R.range(48, 58);
    const notes = pattern.map((p) => root + p);
    const events = [chord(0, 1.6, notes, 0.8)];
    notes.forEach((n, i) => events.push(note(2.0 + i * 0.4, 0.5, n, 0.7)));
    return {
      category: "chords",
      prompt: "A chord is played, then its notes one at a time. What type of chord is it?",
      options: T.CHORD_QUALITIES.map((c) => c[0]),
      correct: idx,
      events,
      explanation: CHORD_TEXT[name],
    };
  }

  function cadences() {
    const idx = R.below(T.CADENCES.length);
    const cad = T.CADENCES[idx];
    const tonic = R.range(55, 62);
    let [first, second] = cad.chords;
    if (cad.name === "Imperfect") first = R.pick(["I", "II", "IV"]);
    return {
      category: "cadences",
      prompt: "You hear the key chord (I), then two chords ending a phrase. Which cadence is it?",
      options: T.CADENCES.map((c) => c.name),
      correct: idx,
      events: [
        keyChord(0, 1.0, tonic, "I", 0.75),
        keyChord(1.4, 1.0, tonic, first, 0.75),
        keyChord(2.5, 1.8, tonic, second, 0.8),
      ],
      explanation: cad.text,
    };
  }

  const PROGRESSIONS = [
    ["I", "IV", "V", "I"],
    ["I", "VI", "IV", "V"],
    ["I", "V", "VI", "IV"],
    ["I", "IV", "I", "V"],
    ["I", "VI", "V", "I"],
    ["I", "II", "V", "I"],
  ];

  function progressions() {
    const fmt = (p) => p.join(" - ");
    const answer = R.below(PROGRESSIONS.length);
    const others = R.shuffle([...PROGRESSIONS.keys()].filter((i) => i !== answer));
    const picks = R.shuffle([answer, others[0], others[1], others[2]]);
    const tonic = R.range(55, 62);
    return {
      category: "progressions",
      prompt: "Four chords are played in a major key. Which progression is it?",
      options: picks.map((i) => fmt(PROGRESSIONS[i])),
      correct: picks.indexOf(answer),
      events: PROGRESSIONS[answer].map((d, i) => keyChord(i * 1.25, 1.2, tonic, d, 0.78)),
      explanation: `The progression was ${fmt(PROGRESSIONS[answer])}. I is home, V pulls back to I, and II and VI are minor chords.`,
    };
  }

  AT.pitch = { note, chord, toneSemitone, intervals, scales, chords, cadences, progressions };
})(typeof window !== "undefined" ? window : globalThis);
