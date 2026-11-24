/* Outcome 3 questions: rhythms (including dotted rhythms) and time signatures. */
(function (g) {
  const AT = g.AT;
  const { R, theory: T } = AT;
  const { note } = AT.pitch;
  const E = () => AT.synth.ev;

  // Unit F58L 11, Outcome 3(b): 4/4, 3/4, 6/8 and 9/8. [label, main beats per bar, divisions per beat]
  const METRES = [
    ["4/4", 4, 2, "simple quadruple"],
    ["3/4", 3, 2, "simple triple"],
    ["6/8", 2, 3, "compound duple"],
    ["9/8", 3, 3, "compound triple"],
  ];

  function timeSignatures() {
    const idx = R.below(METRES.length);
    const [label, beats, subs, kind] = METRES[idx];
    const beatLen = subs === 3 ? 0.6 : 0.5;
    const bars = beats === 2 ? 4 : 3;
    const events = [];
    for (let bar = 0; bar < bars; bar++) {
      for (let beat = 0; beat < beats; beat++) {
        const t = (bar * beats + beat) * beatLen;
        events.push(E().click(t, beat === 0, 1.0));
        for (let s = 0; s < subs; s++) {
          const pitch = 60 + T.MAJOR[beat === 0 && s === 0 ? 0 : 4];
          events.push(E().tone(t + (s * beatLen) / subs, 0.12, [T.freq(pitch)], s === 0 ? 0.5 : 0.26));
        }
      }
    }
    const compound = subs === 3;
    return {
      category: "timeSignatures",
      prompt: "Listen to the pulse. A low kick drum marks the first beat of each bar and hi-hat taps mark the other beats. What is the time signature?",
      options: METRES.map((m) => m[0]),
      correct: idx,
      events,
      allow: AT.synth.AGILE,
      explanation: `${label} is ${kind} time: ${beats} main beats in each bar, and each beat divides into ${subs}. ` +
        (compound ? "Compound time has a lilting feel, 1-2-3 1-2-3." : "Simple time divides each beat into two."),
    };
  }

  // One-bar rhythms in 4/4, as note lengths in crotchet beats.
  const LEN_NAME = { 0.25: "semiquaver", 0.5: "quaver", 1: "crotchet", 1.5: "dotted crotchet", 2: "minim", 3: "dotted minim" };
  const PATTERNS = [
    [1, 1, 1, 1],
    [1.5, 0.5, 1, 1],
    [1, 1, 0.5, 0.5, 1],
    [2, 1, 1],
    [1, 0.5, 0.5, 1, 1],
    [1.5, 0.5, 1.5, 0.5],
    [3, 1],
    [0.5, 0.5, 0.5, 0.5, 1, 1],
    [1, 1.5, 0.5, 1],
    [1.5, 0.5, 2],
  ];
  const dotted = (p) => p.some((n) => n === 1.5 || n === 3);
  const describe = (p) => {
    const parts = [];
    for (let i = 0; i < p.length; i++) {
      if (p[i] === 0.5 && p[i + 1] === 0.5) { parts.push("2 quavers"); i++; }
      else parts.push(LEN_NAME[p[i]]);
    }
    return parts.join(", ");
  };

  function rhythms() {
    const answer = R.below(PATTERNS.length);
    const pat = PATTERNS[answer];
    const wantDotted = dotted(pat);
    // Distractors: prefer a mix, always the same bar length
    const others = R.shuffle([...PATTERNS.keys()].filter((i) => i !== answer));
    const picks = R.shuffle([answer, others[0], others[1], others[2]]);
    const beat = 0.5;
    const events = [];
    const pitches = [64, 64, 67, 64, 62, 64];
    // bar 0: count-in clicks, bars 1 and 2: the rhythm
    for (let b = 0; b < 4; b++) events.push(E().click(b * beat, b === 0, 0.7));
    for (let rep = 0; rep < 2; rep++) {
      let t = (4 + rep * 4) * beat;
      pat.forEach((len, i) => {
        events.push(note(t, len * beat * 0.92, pitches[i % pitches.length], 0.85));
        t += len * beat;
      });
      for (let b = 0; b < 4; b++) events.push(E().click((4 + rep * 4 + b) * beat, b === 0, 0.35));
    }
    return {
      category: "rhythms",
      prompt: "Four hi-hat taps count you in, then a one-bar rhythm is played twice in 4/4. Which rhythm is it?",
      options: picks.map((i) => describe(PATTERNS[i])),
      pictures: picks.map((i) => PATTERNS[i].slice()),
      correct: picks.indexOf(answer),
      events,
      allow: AT.synth.AGILE,
      explanation: `The rhythm was: ${describe(pat)}.` +
        (wantDotted ? " A dot makes a note half as long again, so a dotted crotchet lasts 1½ beats and is usually followed by a quaver." : " Count the main beats and listen for where the notes split."),
    };
  }

  AT.rhythm = { timeSignatures, rhythms };
})(typeof window !== "undefined" ? window : globalThis);
