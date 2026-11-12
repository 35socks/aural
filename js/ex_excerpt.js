/* Exam-style excerpt: one extract of music with several linked questions, (a), (b), (c).
   The parts share one set of events, so the listener answers them all from the same hearing. */
(function (g) {
  const AT = g.AT;
  const { R, theory: T } = AT;
  const PARTS = 3;
  let groupSeq = 0;

  const METRES = [["2/4", 2, 2], ["3/4", 3, 2], ["4/4", 4, 2], ["6/8", 2, 3], ["9/8", 3, 3], ["12/8", 4, 3]];
  const TEMPO_OPTS = ["Steady", "Ritardando (slowing down)", "Accelerando (speeding up)"];
  const TEMPO_TEXT = [
    "Steady tempo: the beat stayed the same throughout.",
    "Ritardando (rit.): the music gradually slowed down towards the end.",
    "Accelerando (accel.): the music gradually sped up towards the end.",
  ];
  const DYN_OPTS = ["Stays the same", "Crescendo (getting louder)", "Diminuendo (getting quieter)"];
  const DYN_TEXT = [
    "The volume stayed the same throughout.",
    "Crescendo: the music gradually got louder.",
    "Diminuendo: the music gradually got quieter.",
  ];

  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  /** A four-bar tune with a bass note on every bar's first beat. */
  function buildEvents(beats, subs, tempoKind, dynKind) {
    const ev = AT.synth.ev;
    const tonic = 60;
    const total = beats * 4;
    const start = [], lens = [];
    let t = 0, len = 0.5;
    const changeFrom = Math.floor(total * 0.35);
    for (let b = 0; b < total; b++) {
      start.push(t); lens.push(len); t += len;
      if (b >= changeFrom) {
        if (tempoKind === 1) len *= 1.08;
        else if (tempoKind === 2) len *= 0.93;
      }
    }
    const vol = (b) => (dynKind === 0 ? 0.6 : dynKind === 1 ? 0.2 + (0.75 * b) / (total - 1) : 0.95 - (0.75 * b) / (total - 1));
    const roots = [0, 3, 4, 0];
    const events = [];
    let deg = R.pick([0, 2, 4]);
    for (let b = 0; b < total; b++) {
      const down = b % beats === 0;
      const last = b === total - 1;
      const v = vol(b);
      if (down) {
        const end = start[b + beats] !== undefined ? start[b + beats] : start[b] + lens[b] * beats;
        const root = AT.texture.scaleNote(tonic - 12, roots[b / beats]);
        events.push(ev.tone(start[b], (end - start[b]) * 0.9, [T.freq(root)], Math.min(1, v * 0.95)));
      }
      let pattern;
      if (last) pattern = [1];
      else if (subs === 2) pattern = R.chance(0.55) ? [1] : [0.5, 0.5];
      else pattern = R.pick([[1], [1], [1 / 3, 1 / 3, 1 / 3], [1 / 3, 1 / 3, 1 / 3], [2 / 3, 1 / 3]]);
      let off = 0;
      for (const frac of pattern) {
        deg = last ? 0 : clamp(deg + R.pick([-2, -1, 0, 1, 2]), 0, 9);
        const dur = last ? lens[b] * 1.6 : frac * lens[b] * 0.92;
        events.push(ev.tone(start[b] + off * lens[b], dur, [T.freq(AT.texture.scaleNote(tonic, deg))],
          Math.min(1, v * (down && off === 0 ? 1.12 : 1))));
        off += frac;
      }
    }
    return events;
  }

  function excerpt() {
    const S = AT.synth;
    const pref = AT.progress ? AT.progress.setting("inst") : "mixed";
    const fixed = pref && pref !== "mixed" && S.INSTRUMENTS[pref];
    const instKey = fixed ? pref : R.pick(S.MELODIC);
    const [label, beats, subs] = R.pick(METRES);
    const tempoKind = R.below(3);
    const dynKind = R.below(3);
    const compound = subs === 3;

    const instrumentPart = () => {
      const picks = R.shuffle([instKey, ...R.shuffle(S.MELODIC.filter((k) => k !== instKey)).slice(0, 3)]);
      return {
        category: "instruments",
        prompt: "Which instrument plays the tune?",
        options: picks.map((k) => S.INSTRUMENTS[k].name),
        correct: picks.indexOf(instKey),
        explanation: S.INSTRUMENTS[instKey].desc,
      };
    };
    const typePart = () => ({
      category: "metre",
      prompt: "Is the music in simple or compound time?",
      options: ["Simple time", "Compound time"],
      correct: compound ? 1 : 0,
      explanation: `This was ${label}: each main beat splits into ${subs}, so it is ${compound ? "compound" : "simple"} time. ` +
        (compound ? "Compound time feels like a lilting 1-2-3, 1-2-3." : "Simple time splits each beat into two."),
    });
    const beatsPart = () => ({
      category: "metre",
      prompt: "How many main beats are there in each bar?",
      options: ["2", "3", "4"],
      correct: beats - 2,
      explanation: `${label} has ${beats} main beats in each bar` + (compound ? ", each one split into three." : "."),
    });
    const tempoPart = () => ({
      category: "tempo",
      prompt: "What happens to the speed of the music?",
      options: TEMPO_OPTS.slice(),
      correct: tempoKind,
      explanation: TEMPO_TEXT[tempoKind],
    });
    const dynPart = () => ({
      category: "dynamics",
      prompt: "What happens to the volume of the music?",
      options: DYN_OPTS.slice(),
      correct: dynKind,
      explanation: DYN_TEXT[dynKind],
    });

    const pool = [typePart, beatsPart, tempoPart, dynPart];
    if (!fixed) pool.push(instrumentPart);
    const chosen = R.shuffle(pool).slice(0, PARTS);
    const asksInstrument = chosen.includes(instrumentPart);

    const events = S.fit(buildEvents(beats, subs, tempoKind, dynKind), instKey);
    const group = ++groupSeq;
    return chosen.map((make, i) => ({
      ...make(),
      events,
      inst: instKey,
      ready: true,
      hideInst: asksInstrument,
      group,
      part: i,
      parts: chosen.length,
      topic: "excerpt",
      intro: "One extract, played up to three times. Answer every part. The low note at the start of each bar is beat 1.",
    }));
  }

  AT.excerpt = { excerpt, PARTS };
})(typeof window !== "undefined" ? window : globalThis);
