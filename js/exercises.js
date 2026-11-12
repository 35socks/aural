/* Topic list and question generation. */
(function (g) {
  const AT = g.AT;

  const GROUPS = [
    { key: "pitch", name: "Pitch & harmony" },
    { key: "rhythm", name: "Rhythm, tempo & dynamics" },
    { key: "texture", name: "Texture & timbre" },
    { key: "exam", name: "Exam-style practice" },
  ];

  const CATEGORIES = [
    { key: "toneSemitone", code: "T/S", group: "pitch", name: "Tones & semitones", blurb: "Is the step between two notes a tone (2 semitones) or a semitone (1)?", gen: () => AT.pitch.toneSemitone() },
    { key: "intervals", code: "INT", group: "pitch", name: "Intervals (leaps)", blurb: "Name the size of a leap, from a 2nd up to an octave.", gen: () => AT.pitch.intervals() },
    { key: "scales", code: "SCL", group: "pitch", name: "Scales", blurb: "Major, minor (natural and harmonic), chromatic, whole tone and pentatonic.", gen: () => AT.pitch.scales() },
    { key: "chords", code: "CHD", group: "pitch", name: "Chords", blurb: "Major, minor, dominant 7th, diminished and augmented chords.", gen: () => AT.pitch.chords() },
    { key: "cadences", code: "CAD", group: "pitch", name: "Cadences", blurb: "Perfect, imperfect, plagal and interrupted cadences in a major key.", gen: () => AT.pitch.cadences() },
    { key: "progressions", code: "PRG", group: "pitch", name: "Chord progressions", blurb: "Progressions using chords I, II, IV, V and VI in a major key.", gen: () => AT.pitch.progressions() },
    { key: "metre", code: "MTR", group: "rhythm", name: "Metre (simple & compound)", blurb: "Tell 2/4, 3/4 and 4/4 apart from compound 6/8, 9/8 and 12/8.", gen: () => AT.rhythm.metre() },
    { key: "rhythmFeature", code: "RHY", group: "rhythm", name: "Rhythm features", blurb: "Straight rhythm, dotted rhythm, Scotch snap and syncopation.", gen: () => AT.rhythm.rhythmFeature() },
    { key: "tempo", code: "TMP", group: "rhythm", name: "Tempo changes", blurb: "Steady tempo, ritardando (slowing) and accelerando (speeding up).", gen: () => AT.rhythm.tempo() },
    { key: "dynamics", code: "DYN", group: "rhythm", name: "Dynamics", blurb: "pp, ff, crescendo, diminuendo and sforzando.", gen: () => AT.rhythm.dynamics() },
    { key: "bassPattern", code: "BAS", group: "texture", name: "Bass patterns", blurb: "Alberti bass, walking bass and sustained (block) chords.", gen: () => AT.texture.bassPattern() },
    { key: "melodyMemory", code: "MEL", group: "texture", name: "Melodic memory", blurb: "Listen to two short melodies: are they the same or different?", gen: () => AT.texture.melodyMemory() },
    { key: "instruments", code: "INS", group: "texture", name: "Instruments (timbre)", blurb: "Name the instrument you hear: piano, organ, guitar, strings, flute, clarinet, trumpet, marimba or bass.", gen: () => AT.texture.instruments() },
    { key: "excerpt", code: "EXC", group: "exam", name: "Mixed excerpt", blurb: "One extract, then linked questions (a), (b) and (c) on metre, tempo, dynamics and instrument, like a listening paper.", mock: 1, gen: () => AT.excerpt.excerpt() },
  ];

  const byKey = (k) => CATEGORIES.find((c) => c.key === k);
  const groupName = (k) => GROUPS.find((x) => x.key === k).name;

  /** Gives every question an instrument and moves it into that instrument's register. */
  function prepare(made) {
    const qs = Array.isArray(made) ? made : [made];
    for (const q of qs) {
      if (q.ready) continue;
      q.inst = q.inst || AT.synth.choose(q.allow);
      q.events = AT.synth.fit(q.events, q.inst);
      q.ready = true;
    }
    return qs;
  }

  /** One question, or the linked parts of an excerpt, always returned as an array. */
  const generate = (key) => prepare(byKey(key).gen());

  /** How many questions an entry check holds. */
  function mockSize(perCategory) {
    return CATEGORIES.reduce((n, c) => n + (c.mock ? c.mock * AT.excerpt.PARTS : perCategory), 0);
  }

  /** Balanced mock test: perCategory questions from every topic, shuffled. Excerpt parts stay together. */
  function mockTest(perCategory) {
    const items = [];
    for (const c of CATEGORIES) {
      const n = c.mock || perCategory;
      for (let i = 0; i < n; i++) items.push(prepare(c.gen()));
    }
    return AT.R.shuffle(items).flat();
  }

  AT.exercises = { GROUPS, CATEGORIES, byKey, groupName, generate, mockTest, mockSize };
})(typeof window !== "undefined" ? window : globalThis);
