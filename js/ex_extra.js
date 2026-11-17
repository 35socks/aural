/* Extension questions beyond the unit's three outcomes: descending intervals, cadences, melodic contour,
   simple or compound beat, and the missing scale note. They never appear in the mock exam. */
(function (g) {
  const AT = g.AT;
  const { R, theory: T } = AT;
  const { note, chord } = AT.pitch;
  const E = () => AT.synth.ev;

  const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

  // ---- descending intervals ----
  function descIntervals() {
    const choices = T.INTERVALS.filter((i) => i.semis > 0);
    const idx = R.below(choices.length);
    const iv = choices[idx];
    const high = R.range(62, 74);
    return {
      category: "descIntervals",
      prompt: "Two notes are played one after the other, the second lower. Name the interval.",
      options: choices.map((i) => i.name),
      correct: idx,
      events: [note(0, 0.8, high, 0.8), note(0.9, 1.1, high - iv.semis, 0.8)],
      explanation: `${iv.name}: the second note is ${iv.semis} semitones below the first. Hearing it downwards is harder, so imagine the same two notes played upwards, or sing the major scale down from the top note.`,
    };
  }

  // ---- cadences ----
  const CADENCES = [
    { name: "Perfect", chords: ["V", "I"], text: "Perfect cadence: V then I. It sounds finished, like a full stop." },
    { name: "Plagal", chords: ["IV", "I"], text: "Plagal cadence: IV then I, the \"Amen\" cadence. It sounds settled but softer than a perfect cadence." },
    { name: "Imperfect", chords: ["I", "V"], text: "Imperfect cadence: ends on V. It sounds unfinished, like a comma or a question." },
    { name: "Interrupted", chords: ["V", "vi"], text: "Interrupted cadence: V then vi. You expect the home chord, but you get a surprise." },
  ];

  function voice(tonic, degree) {
    const raw = T.triad(tonic, degree);
    const notes = raw.map((n) => { while (n > tonic + 9) n -= 12; return n; });
    notes.push(raw[0] - 12);
    return notes;
  }

  function cadences() {
    const idx = R.below(CADENCES.length);
    const cad = CADENCES[idx];
    const key = R.pick(T.KEYS);
    const lead = ["I", "IV"];
    const chords = [R.pick(lead), ...cad.chords];
    if (chords[0] === cad.chords[0]) chords.shift();
    return {
      category: "cadences",
      prompt: "A short phrase ends with two chords, the cadence. Which cadence is it?",
      options: CADENCES.map((c) => c.name),
      correct: idx,
      events: chords.map((d, i) => chord(i * 1.2, 1.15, voice(key.tonic, d), 0.78)),
      allow: AT.synth.POLY,
      explanation: cad.text + " Listen to how the last chord makes you feel before you name it.",
    };
  }

  // ---- melodic contour ----
  const SHAPES = [
    { name: "Rising", steps: [0, 1, 2, 3, 4], text: "Rising: every note is higher than the one before." },
    { name: "Falling", steps: [4, 3, 2, 1, 0], text: "Falling: every note is lower than the one before." },
    { name: "Arch", steps: [0, 2, 4, 2, 0], text: "Arch: it climbs to a peak in the middle, then comes back down." },
    { name: "Valley", steps: [4, 2, 0, 2, 4], text: "Valley: it dips to a low point in the middle, then climbs back up." },
  ];
  function contour() {
    const idx = R.below(SHAPES.length);
    const sh = SHAPES[idx];
    const tonic = R.range(55, 64);
    const events = sh.steps.map((s, i) => note(i * 0.5, i === 4 ? 1.0 : 0.5, tonic + T.MAJOR[s], 0.8));
    return {
      category: "contour",
      prompt: "Five notes are played. What shape does the melody make?",
      options: SHAPES.map((s) => s.name),
      correct: idx,
      events,
      allow: AT.synth.AGILE,
      explanation: sh.text,
    };
  }

  // ---- simple or compound ----
  function beatFeel() {
    const compound = R.chance(0.5);
    const subs = compound ? 3 : 2;
    const beatLen = compound ? 0.62 : 0.5;
    const events = [];
    for (let b = 0; b < 8; b++) {
      const t = b * beatLen;
      events.push(E().click(t, b % 2 === 0, 0.8));
      for (let s = 0; s < subs; s++) events.push(E().tone(t + (s * beatLen) / subs, 0.1, [T.freq(s === 0 ? 72 : 67)], s === 0 ? 0.5 : 0.28));
    }
    return {
      category: "beatFeel",
      prompt: "Each main beat is split into smaller notes. Is the beat divided into two or into three?",
      options: ["Two (simple time)", "Three (compound time)"],
      correct: compound ? 1 : 0,
      events,
      allow: AT.synth.AGILE,
      explanation: compound
        ? "Three: each beat splits into three (1-2-3, 1-2-3), the lilting feel of 6/8 and 9/8."
        : "Two: each beat splits into two (1-and, 2-and), the steady feel of 4/4 and 3/4.",
    };
  }

  // ---- missing scale note ----
  function missingNote() {
    const miss = R.range(1, 6); // index 1..6 of the 8 notes (never the first or last)
    const tonic = R.range(55, 62);
    const scale = [...T.MAJOR, 12];
    const events = [];
    let t = 0;
    scale.forEach((s, i) => {
      if (i === miss) { t += 0.4; return; }
      events.push(note(t, i === 7 ? 1.0 : 0.4, tonic + s, 0.8));
      t += 0.4;
    });
    const options = [1, 2, 3, 4, 5, 6].map((i) => `Note ${i + 1} (the ${ORD[i + 1]})`);
    return {
      category: "missingNote",
      prompt: "A major scale is played from the bottom note to the top, but one note is left out. Which note is missing?",
      options,
      correct: miss - 1,
      events,
      allow: AT.synth.AGILE,
      explanation: `The ${ORD[miss + 1]} note of the scale is missing; you hear a gap in the pulse where it should be. Sing the scale along in your head and notice where you have to jump.`,
    };
  }

  AT.extra = { descIntervals, cadences, contour, beatFeel, missingNote };
})(typeof window !== "undefined" ? window : globalThis);
