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

  // One-bar rhythms, as note lengths in crotchet beats. `beat` is the main beat; `subs` is how it divides.
  const RHYTHM_METRES = {
    "4/4": { beat: 1, beats: 4, subs: 2, confuser: "3/4", patterns: [
      [1, 1, 1, 1], [1.5, 0.5, 1, 1], [1, 1, 0.5, 0.5, 1], [2, 1, 1], [1, 0.5, 0.5, 1, 1],
      [1.5, 0.5, 1.5, 0.5], [3, 1], [0.5, 0.5, 0.5, 0.5, 1, 1], [1, 1.5, 0.5, 1], [1.5, 0.5, 2], [0.75, 0.25, 1, 2],
    ] },
    "3/4": { beat: 1, beats: 3, subs: 2, confuser: "6/8", patterns: [
      [1, 1, 1], [1.5, 0.5, 1], [2, 1], [1, 2], [0.5, 0.5, 1, 1], [1, 0.5, 0.5, 1],
      [0.75, 0.25, 1, 1], [0.5, 0.5, 0.5, 0.5, 1], [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [1, 1.5, 0.5],
    ] },
    "6/8": { beat: 1.5, beats: 2, subs: 3, confuser: "3/4", patterns: [
      [0.5, 0.5, 0.5, 0.5, 0.5, 0.5], [1, 0.5, 1, 0.5], [1.5, 1.5], [1.5, 0.5, 0.5, 0.5], [0.5, 0.5, 0.5, 1.5],
      [0.5, 0.5, 0.5, 1, 0.5], [0.75, 0.25, 0.5, 1.5], [1, 0.5, 1.5], [1.5, 1, 0.5],
    ] },
    "9/8": { beat: 1.5, beats: 3, subs: 3, confuser: "6/8", patterns: [
      [1.5, 1.5, 1.5], [1, 0.5, 1, 0.5, 1.5], [0.5, 0.5, 0.5, 1.5, 1.5], [1.5, 0.5, 0.5, 0.5, 1, 0.5],
      [3, 1.5], [1, 0.5, 0.5, 0.5, 0.5, 1.5], [0.75, 0.25, 0.5, 1.5, 1, 0.5], [1.5, 1, 0.5, 1.5],
    ] },
  };
  const LEN_NAME = { 0.25: "semiquaver", 0.5: "quaver", 0.75: "dotted quaver", 1: "crotchet", 1.5: "dotted crotchet", 2: "minim", 3: "dotted minim" };
  const dotted = (p) => p.some((n) => n === 0.75 || n === 1.5 || n === 3);
  /** Words for a rhythm, used for screen readers and explanations. */
  const describe = (p) => {
    const parts = [];
    for (let i = 0; i < p.length; ) {
      let n = 1;
      while (p[i + n] === p[i]) n++;
      parts.push(n > 1 ? `${n} ${LEN_NAME[p[i]]}s` : LEN_NAME[p[i]]);
      i += n;
    }
    return parts.join(", ");
  };

  const every = Object.entries(RHYTHM_METRES).flatMap(([metre, m]) => m.patterns.map((pattern) => ({ metre, beat: m.beat, pattern })));

  // Answers are dealt from a shuffled deck, so all four time signatures keep coming up.
  let deck = [];
  const nextMetre = () => {
    if (!deck.length) deck = R.shuffle(Object.keys(RHYTHM_METRES));
    return deck.pop();
  };

  /** The right answer plus three others, always including one from the time signature most easily confused with it. */
  function choices(answer) {
    const picks = [answer];
    const take = (filter) => {
      const pool = every.filter((c) => !picks.includes(c) && filter(c));
      picks.push(R.pick(pool));
    };
    take((c) => c.metre === RHYTHM_METRES[answer.metre].confuser);
    take((c) => (R.chance(0.7) ? c.metre === answer.metre : true));
    take(() => true);
    return R.shuffle(picks);
  }

  function rhythms() {
    const metre = nextMetre();
    const m = RHYTHM_METRES[metre];
    const answer = R.pick(every.filter((c) => c.metre === metre));
    const picks = choices(answer);
    const second = 0.5; // seconds per crotchet
    const barLen = m.beats * m.beat * second;
    const events = [];
    const pitches = [64, 64, 67, 64, 62, 64];
    const clicks = (start, vol) => {
      for (let b = 0; b < m.beats; b++) events.push(E().click(start + b * m.beat * second, b === 0, vol));
    };
    // bar 0: count-in, with quiet taps showing how each beat divides. Bars 1 and 2: the rhythm.
    clicks(0, 0.7);
    for (let b = 0; b < m.beats; b++) {
      for (let s = 1; s < m.subs; s++) events.push(E().drum(((b + s / m.subs) * m.beat) * second, "hat", 0.2));
    }
    for (let rep = 0; rep < 2; rep++) {
      const start = barLen * (rep + 1);
      let t = start;
      answer.pattern.forEach((len, i) => {
        events.push(note(t, len * second * 0.92, pitches[i % pitches.length], 0.85));
        t += len * second;
      });
      clicks(start, 0.35);
    }
    return {
      category: "rhythms",
      prompt: "A one-bar count-in, then a one-bar rhythm played twice. The low drum marks the first beat of each bar. Which written rhythm is it?",
      options: picks.map((c) => `${c.metre}: ${describe(c.pattern)}`),
      pictures: picks.map((c) => ({ time: c.metre, lens: c.pattern.slice() })),
      correct: picks.indexOf(answer),
      events,
      allow: AT.synth.AGILE,
      explanation: `The rhythm was in ${metre}: ${describe(answer.pattern)}.` +
        (dotted(answer.pattern) ? " A dot makes a note half as long again." : "") +
        ` Count ${m.beats} main beats in each bar, each dividing into ${m.subs}.`,
    };
  }

  AT.rhythm = { timeSignatures, rhythms, RHYTHM_METRES };
})(typeof window !== "undefined" ? window : globalThis);
