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

  // One-bar rhythms as note lengths in crotchet beats (quaver 0.5, dotted crotchet 1.5).
  // Simple time beats are crotchets; compound time beats are dotted crotchets (three quavers).
  const LEN_NAME = { 0.5: "quaver", 1: "crotchet", 1.5: "dotted crotchet", 2: "minim", 3: "dotted minim" };
  const RHYTHM_METRES = {
    "4/4": { beats: 4, beat: 1, weight: 4, patterns: [
      [1, 1, 1, 1], [1.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [2, 1, 1], [1, 0.5, 0.5, 1, 1],
      [1.5, 0.5, 1.5, 0.5], [3, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [1, 1.5, 0.5, 1], [1.5, 0.5, 2]] },
    "3/4": { beats: 3, beat: 1, weight: 2, patterns: [
      [1, 1, 1], [2, 1], [1, 2], [3], [1.5, 0.5, 1], [1, 0.5, 0.5, 1],
      [0.5, 0.5, 1, 1], [1, 1.5, 0.5], [0.5, 0.5, 0.5, 0.5, 1], [1.5, 0.5, 0.5, 0.5]] },
    "6/8": { beats: 2, beat: 1.5, weight: 2, patterns: [
      [1.5, 1.5], [1, 0.5, 1, 0.5], [0.5, 0.5, 0.5, 1.5], [1.5, 0.5, 0.5, 0.5], [1, 0.5, 1.5],
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [3], [1.5, 1, 0.5], [0.5, 0.5, 0.5, 1, 0.5]] },
    "9/8": { beats: 3, beat: 1.5, weight: 2, patterns: [
      [1.5, 1.5, 1.5], [1, 0.5, 1, 0.5, 1, 0.5], [3, 1.5], [1.5, 1, 0.5, 1.5], [0.5, 0.5, 0.5, 1.5, 1.5],
      [1.5, 0.5, 0.5, 0.5, 1.5], [1, 0.5, 1.5, 1, 0.5], [1.5, 1.5, 0.5, 0.5, 0.5]] },
  };
  const dotted = (p) => p.some((n) => n === 1.5 || n === 3);

  /** Names a rhythm, grouping quavers that share a beat ("2 quavers", "3 quavers"). */
  function describe(p, beatLen) {
    const parts = [];
    let pos = 0;
    for (let i = 0; i < p.length; i++) {
      if (p[i] === 0.5) {
        const beatNo = Math.floor(pos / beatLen + 1e-9);
        let n = 1;
        while (p[i + n] === 0.5 && Math.floor((pos + n * 0.5) / beatLen + 1e-9) === beatNo) n++;
        parts.push(n > 1 ? `${n} quavers` : "quaver");
        pos += n * 0.5; i += n - 1;
      } else { parts.push(LEN_NAME[p[i]]); pos += p[i]; }
    }
    return parts.join(", ");
  }

  function pickMetre() {
    const entries = Object.entries(RHYTHM_METRES);
    let r = Math.random() * entries.reduce((n, [, m]) => n + m.weight, 0);
    for (const [label, m] of entries) { if ((r -= m.weight) < 0) return label; }
    return "4/4";
  }

  function rhythms() {
    const time = pickMetre();
    const M = RHYTHM_METRES[time];
    const PATTERNS = M.patterns;
    const compound = M.beat === 1.5;
    const answer = R.below(PATTERNS.length);
    const pat = PATTERNS[answer];
    const others = R.shuffle([...PATTERNS.keys()].filter((i) => i !== answer));
    const picks = R.shuffle([answer, others[0], others[1], others[2]]);
    const unit = compound ? 0.42 : 0.5; // seconds per crotchet
    const barLen = M.beats * M.beat;
    const events = [];
    const pitches = [64, 64, 67, 64, 62, 64];
    // bar 0: count-in on the main beats, bars 1 and 2: the rhythm with quiet beat clicks
    for (let b = 0; b < M.beats; b++) events.push(E().click(b * M.beat * unit, b === 0, 0.7));
    for (let rep = 0; rep < 2; rep++) {
      const barStart = (1 + rep) * barLen;
      let t = barStart * unit;
      pat.forEach((len, i) => {
        events.push(note(t, len * unit * 0.92, pitches[i % pitches.length], 0.85));
        t += len * unit;
      });
      for (let b = 0; b < M.beats; b++) events.push(E().click((barStart + b * M.beat) * unit, b === 0, 0.35));
    }
    const name = (p) => describe(p, M.beat);
    return {
      category: "rhythms",
      prompt: `${M.beats} hi-hat taps count you in, then a one-bar rhythm in ${time} is played twice. Which rhythm is it?`,
      options: picks.map((i) => name(PATTERNS[i])),
      pictures: picks.map((i) => ({ lens: PATTERNS[i].slice(), time })),
      correct: picks.indexOf(answer),
      events,
      allow: AT.synth.AGILE,
      explanation: `The rhythm in ${time} was: ${name(pat)}. ` +
        (compound
          ? `${time} has ${M.beats} dotted-crotchet beats, each split into three quavers ("straw-ber-ry"). A crotchet then a quaver fills one beat with a long-short swing.`
          : dotted(pat)
            ? "A dot makes a note half as long again, so a dotted crotchet lasts 1½ beats and is usually followed by a quaver."
            : `Count the ${M.beats} crotchet beats and listen for where the notes split into quavers.`),
    };
  }

  AT.rhythm = { timeSignatures, rhythms };
})(typeof window !== "undefined" ? window : globalThis);
