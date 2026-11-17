/* Music theory data and small helpers. Plain script (no modules) so it also works from file://. */
(function (g) {
  const AT = (g.AT = g.AT || {});

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

  // Unit F58L 11, Outcome 1(a): unison, major 2nd, major 3rd, perfect 4th, perfect 5th, major 6th, major 7th, octave.
  const INTERVALS = [
    { name: "Unison", semis: 0, from: "C to C" },
    { name: "Major 2nd", semis: 2, from: "C to D" },
    { name: "Major 3rd", semis: 4, from: "C to E" },
    { name: "Perfect 4th", semis: 5, from: "C to F" },
    { name: "Perfect 5th", semis: 7, from: "C to G" },
    { name: "Major 6th", semis: 9, from: "C to A" },
    { name: "Major 7th", semis: 11, from: "C to B" },
    { name: "Octave", semis: 12, from: "C to C" },
  ];

  // Scale patterns from the tonic, as semitones above it.
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const NAT_MINOR = [0, 2, 3, 5, 7, 8, 10];
  const HARM_MINOR = [0, 2, 3, 5, 7, 8, 11];
  const MEL_MINOR_UP = [0, 2, 3, 5, 7, 9, 11];

  const SCALES = [
    { name: "Major", up: [...MAJOR, 12], down: [12, ...MAJOR.slice().reverse()] },
    { name: "Melodic minor", up: [...MEL_MINOR_UP, 12], down: [12, ...NAT_MINOR.slice().reverse()] },
    { name: "Harmonic minor", up: [...HARM_MINOR, 12], down: [12, ...HARM_MINOR.slice().reverse()] },
  ];

  const TRIADS = [
    { name: "Major", notes: [0, 4, 7] },
    { name: "Minor", notes: [0, 3, 7] },
  ];

  const SEVENTHS = [
    { name: "Major 7th", notes: [0, 4, 7, 11], text: "Major 7th: a major triad with a major 7th on top (4 + 3 + 4 semitones). It sounds smooth and dreamy." },
    { name: "Minor 7th", notes: [0, 3, 7, 10], text: "Minor 7th: a minor triad with a minor 7th on top (3 + 4 + 3 semitones). It sounds mellow and relaxed." },
    { name: "Dominant 7th", notes: [0, 4, 7, 10], text: "Dominant 7th: a major triad with a minor 7th on top (4 + 3 + 3 semitones). It sounds tense and wants to move on." },
  ];

  // Diatonic triads in a major key: [semitones above tonic, minor?, chord numeral]
  const DEGREES = {
    I: [0, false], ii: [2, true], iii: [4, true], IV: [5, false], V: [7, false], vi: [9, true],
  };
  const KEYS = [
    { name: "C", tonic: 60, chords: { I: "C", ii: "Dm", iii: "Em", IV: "F", V: "G", vi: "Am" } },
    { name: "G", tonic: 67, chords: { I: "G", ii: "Am", iii: "Bm", IV: "C", V: "D", vi: "Em" } },
    { name: "F", tonic: 65, chords: { I: "F", ii: "Gm", iii: "Am", IV: "B♭", V: "C", vi: "Dm" } },
    { name: "D", tonic: 62, chords: { I: "D", ii: "Em", iii: "F♯m", IV: "G", V: "A", vi: "Bm" } },
  ];

  function triad(tonic, degree) {
    const [off, minor] = DEGREES[degree];
    const root = tonic + off;
    return [root, root + (minor ? 3 : 4), root + 7];
  }

  AT.R = R;
  AT.theory = { freq, INTERVALS, SCALES, TRIADS, SEVENTHS, DEGREES, KEYS, triad, MAJOR, NAT_MINOR, HARM_MINOR };
})(typeof window !== "undefined" ? window : globalThis);
