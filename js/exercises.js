/* Topics, the three outcomes of unit F58L 11, and the mock exam builder. */
(function (g) {
  const AT = g.AT;

  // Marks and pass marks from the unit marking criteria: each outcome is marked on its own.
  const OUTCOMES = [
    { n: 1, name: "Intervals, scales and tonality", marks: 20, pass: 14 },
    { n: 2, name: "Triads, chords and progressions", marks: 20, pass: 14 },
    { n: 3, name: "Rhythms and time signatures", marks: 10, pass: 7 },
  ];
  const EXAM_MINUTES = 45;

  // `mock` is how many questions each topic contributes to a full paper.
  const CATEGORIES = [
    { key: "intervals", outcome: 1, pc: "1(a)", name: "Intervals", mock: 8,
      blurb: "Ascending: unison, major 2nd, major 3rd, perfect 4th and 5th, major 6th and 7th, octave.", gen: () => AT.pitch.intervals() },
    { key: "scales", outcome: 1, pc: "1(b)", name: "Scales", mock: 6,
      blurb: "Major, melodic minor and harmonic minor, going up and going down.", gen: () => AT.pitch.scales() },
    { key: "tonality", outcome: 1, pc: "1(c)", name: "Tonality", mock: 6,
      blurb: "Four-bar phrases: major or minor?", gen: () => AT.pitch.tonality() },
    { key: "triads", outcome: 2, pc: "2(a)", name: "Triads", mock: 7,
      blurb: "Major and minor triads, played melodically or harmonically.", gen: () => AT.pitch.triads() },
    { key: "sevenths", outcome: 2, pc: "2(b)", name: "Chords", mock: 6,
      blurb: "Major and minor chords, plus major 7th, minor 7th and dominant 7th chords.", gen: () => AT.pitch.sevenths() },
    { key: "progressions", outcome: 2, pc: "2(c)", name: "Chord progressions", mock: 7,
      blurb: "Three and four chord progressions, named by Roman numeral (I, ii, IV, V, vi).", gen: () => AT.pitch.progressions() },
    { key: "rhythms", outcome: 3, pc: "3(a)", name: "Rhythms", mock: 5,
      blurb: "Written one-bar rhythms in 4/4, 3/4, 6/8 and 9/8, including dotted rhythms.", gen: () => AT.rhythm.rhythms() },
    { key: "timeSignatures", outcome: 3, pc: "3(b)", name: "Time signatures", mock: 5,
      blurb: "4/4, 3/4, 6/8 and 9/8.", gen: () => AT.rhythm.timeSignatures() },
  ];

  // Extension topics (outcome 4): extra ear training that is not in the unit and never in the mock paper.
  const EXTENSION = { n: 4, name: "Extension: extra ear training", marks: 0, pass: 0, ext: true };
  CATEGORIES.push(
    { key: "descIntervals", outcome: 4, pc: "X1", name: "Descending intervals", mock: 0, blurb: "The same intervals, played going down.", gen: () => AT.extra.descIntervals() },
    { key: "cadences", outcome: 4, pc: "X2", name: "Cadences", mock: 0, blurb: "Perfect, plagal, imperfect or interrupted: how a phrase ends.", gen: () => AT.extra.cadences() },
    { key: "contour", outcome: 4, pc: "X3", name: "Melodic shape", mock: 0, blurb: "Rising, falling, arch or valley.", gen: () => AT.extra.contour() },
    { key: "beatFeel", outcome: 4, pc: "X4", name: "Simple or compound beat", mock: 0, blurb: "Does each beat split into two or three?", gen: () => AT.extra.beatFeel() },
    { key: "missingNote", outcome: 4, pc: "X5", name: "Missing scale note", mock: 0, blurb: "A major scale with one note left out.", gen: () => AT.extra.missingNote() },
  );

  const byKey = (k) => CATEGORIES.find((c) => c.key === k);
  const outcomeOf = (n) => OUTCOMES.find((o) => o.n === n) || EXTENSION;

  /** Gives every question an instrument and moves it into that instrument's register. */
  function prepare(q) {
    if (!q.ready) {
      q.inst = q.inst || AT.synth.choose(q.allow);
      q.events = AT.synth.fit(q.events, q.inst);
      q.ready = true;
    }
    q.outcome = byKey(q.category).outcome;
    return q;
  }

  const generate = (key) => prepare(byKey(key).gen());

  /** A paper for the given outcomes (all three by default), in outcome order, one mark per question. */
  function mockTest(outcomes, scale) {
    const wanted = outcomes && outcomes.length ? outcomes : OUTCOMES.map((o) => o.n);
    const qs = [];
    for (const n of wanted) {
      const section = [];
      for (const c of CATEGORIES.filter((x) => x.outcome === n)) {
        const n = scale && scale < 1 ? Math.max(1, Math.round(c.mock * scale)) : c.mock;
        for (let i = 0; i < n; i++) section.push(prepare(c.gen()));
      }
      qs.push(...AT.R.shuffle(section));
    }
    return qs;
  }

  const minutesFor = (count) => Math.max(10, Math.round((EXAM_MINUTES * count) / 50));

  AT.exercises = { EXTENSION, OUTCOMES, CATEGORIES, EXAM_MINUTES, byKey, outcomeOf, generate, mockTest, minutesFor };
})(typeof window !== "undefined" ? window : globalThis);
