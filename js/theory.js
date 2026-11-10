/* Music theory data and small helpers. Plain script (no modules) so it also works from file://. */
(function (g) {
  const AT = (g.AT = g.AT || {});

  // ---- random helpers ----
  const R = {
    below: (n) => Math.floor(Math.random() * n),
    range: (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1)),
    chance: (p) => Math.random() < p,
    pick: (a) => a[Math.floor(Math.random() * a.length)],
    shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  };

  const freq = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

  const INTERVAL_SEMITONES = [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12];
  const INTERVAL_LABELS = ["2nd", "3rd", "4th", "5th", "6th", "7th", "Octave"];
  function intervalNumber(s) {
    switch (s) {
      case 1: case 2: return "2nd";
      case 3: case 4: return "3rd";
      case 5: return "4th";
      case 7: return "5th";
      case 8: case 9: return "6th";
      case 10: case 11: return "7th";
      case 12: return "Octave";
      default: return null;
    }
  }

  const MAJOR = [0, 2, 4, 5, 7, 9, 11, 12];
  const SCALES = [
    ["Major", MAJOR],
    ["Natural minor", [0, 2, 3, 5, 7, 8, 10, 12]],
    ["Harmonic minor", [0, 2, 3, 5, 7, 8, 11, 12]],
    ["Chromatic", [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]],
    ["Whole tone", [0, 2, 4, 6, 8, 10, 12]],
    ["Pentatonic", [0, 2, 4, 7, 9, 12]],
  ];
  const CHORD_QUALITIES = [
    ["Major", [0, 4, 7]],
    ["Minor", [0, 3, 7]],
    ["Dominant 7th", [0, 4, 7, 10]],
    ["Diminished", [0, 3, 6]],
    ["Augmented", [0, 4, 8]],
  ];

  // Triad on a degree of the major key (I, II, IV, V, VI), root position.
  const DEGREES = { I: [0, false], II: [2, true], IV: [5, false], V: [7, false], VI: [9, true] };
  function triad(tonic, degree) {
    const [off, minor] = DEGREES[degree];
    const root = tonic + off;
    return [root, root + (minor ? 3 : 4), root + 7];
  }

  const CADENCES = [
    { name: "Perfect", chords: ["V", "I"], text: "Perfect cadence: chord V moves to chord I. It sounds finished, like a full stop." },
    { name: "Imperfect", chords: ["I", "V"], text: "Imperfect cadence: the phrase ends on chord V. It sounds unfinished, like a comma." },
    { name: "Plagal", chords: ["IV", "I"], text: "Plagal cadence: chord IV moves to chord I (the 'Amen' cadence)." },
    { name: "Interrupted", chords: ["V", "VI"], text: "Interrupted cadence: chord V moves to chord VI instead of I, a surprise ending." },
  ];

  AT.R = R;
  AT.theory = {
    freq, INTERVAL_SEMITONES, INTERVAL_LABELS, intervalNumber,
    MAJOR, SCALES, CHORD_QUALITIES, triad, CADENCES,
  };
})(typeof window !== "undefined" ? window : globalThis);
