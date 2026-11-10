/* Topic list and question generation. */
(function (g) {
  const AT = g.AT;

  const CATEGORIES = [
    { key: "toneSemitone", name: "Tones & semitones", blurb: "Is the step between two notes a tone (2 semitones) or a semitone (1)?", gen: () => AT.pitch.toneSemitone() },
    { key: "intervals", name: "Intervals (leaps)", blurb: "Name the size of a leap, from a 2nd up to an octave.", gen: () => AT.pitch.intervals() },
    { key: "scales", name: "Scales", blurb: "Major, minor (natural and harmonic), chromatic, whole tone and pentatonic.", gen: () => AT.pitch.scales() },
    { key: "chords", name: "Chords", blurb: "Major, minor, dominant 7th, diminished and augmented chords.", gen: () => AT.pitch.chords() },
    { key: "cadences", name: "Cadences", blurb: "Perfect, imperfect, plagal and interrupted cadences in a major key.", gen: () => AT.pitch.cadences() },
    { key: "progressions", name: "Chord progressions", blurb: "Progressions using chords I, II, IV, V and VI in a major key.", gen: () => AT.pitch.progressions() },
    { key: "metre", name: "Metre (simple & compound)", blurb: "Tell 2/4, 3/4 and 4/4 apart from compound 6/8, 9/8 and 12/8.", gen: () => AT.rhythm.metre() },
    { key: "rhythmFeature", name: "Rhythm features", blurb: "Straight rhythm, dotted rhythm, Scotch snap and syncopation.", gen: () => AT.rhythm.rhythmFeature() },
    { key: "tempo", name: "Tempo changes", blurb: "Steady tempo, ritardando (slowing) and accelerando (speeding up).", gen: () => AT.rhythm.tempo() },
    { key: "dynamics", name: "Dynamics", blurb: "pp, ff, crescendo, diminuendo and sforzando.", gen: () => AT.rhythm.dynamics() },
    { key: "bassPattern", name: "Bass patterns", blurb: "Alberti bass, walking bass and sustained (block) chords.", gen: () => AT.texture.bassPattern() },
    { key: "melodyMemory", name: "Melodic memory", blurb: "Listen to two short melodies: are they the same or different?", gen: () => AT.texture.melodyMemory() },
  ];

  const byKey = (k) => CATEGORIES.find((c) => c.key === k);
  const generate = (key) => byKey(key).gen();

  /** Balanced mock test: perCategory questions from every topic, shuffled. */
  function mockTest(perCategory) {
    const qs = [];
    for (const c of CATEGORIES) for (let i = 0; i < perCategory; i++) qs.push(c.gen());
    return AT.R.shuffle(qs);
  }

  AT.exercises = { CATEGORIES, byKey, generate, mockTest };
})(typeof window !== "undefined" ? window : globalThis);
