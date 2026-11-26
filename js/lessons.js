/* Lessons: teaching from zero. Each lesson is explain -> hear -> check -> remember -> practise.
   Audio specs (see build): { notes, harmonic } | { rhythm, times, bpm } | { pulse } | { prog } | { seq }. */
(function (g) {
  const AT = g.AT;
  const T = AT.theory;
  const E = () => AT.synth.ev;

  // ---------- audio ----------
  const MAJ = [0, 2, 4, 5, 7, 9, 11, 12];
  const MEL_UP = [0, 2, 3, 5, 7, 9, 11, 12];
  const HARM = [0, 2, 3, 5, 7, 8, 11, 12];
  const NAT_DOWN = [12, 10, 8, 7, 5, 3, 2, 0];
  const up = (steps, root) => steps.map((s) => (root == null ? 60 : root) + s);

  /** Events for one spec, starting at time `off`. */
  function build(spec, off) {
    off = off || 0;
    const ev = E(), out = [];
    if (spec.seq) {
      let t = off;
      for (const s of spec.seq) {
        out.push(...build(s, t));
        t += AT.synth.totalSeconds(build(s, 0)) + 0.5;
      }
      return out;
    }
    if (spec.notes) {
      const gap = spec.gap || 0.55;
      if (spec.harmonic) return [ev.sustained(off, 1.8, spec.notes.map(T.freq), 0.8)];
      return spec.notes.map((n, i) => ev.tone(off + i * gap, i === spec.notes.length - 1 ? 1.3 : gap * 1.1, [T.freq(n)], 0.8));
    }
    if (spec.rhythm) {
      const beat = 60 / (spec.bpm || 84), perBar = spec.perBar || 4, times = spec.times || 2;
      const lens = spec.rhythm, total = lens.reduce((a, b) => a + Math.abs(b), 0);
      for (let p = 0; p < times; p++) {
        const base = off + p * total * beat;
        for (let b = 0; b < Math.ceil(total); b++) out.push(ev.click(base + b * beat, b % perBar === 0, b % perBar === 0 ? 0.8 : 0.45));
        let t = base;
        for (const len of lens) {
          if (len > 0) out.push(ev.tone(t, Math.max(0.08, len * beat * 0.93), [T.freq(spec.pitch || 67)], 0.85));
          t += Math.abs(len) * beat;
        }
      }
      return out;
    }
    if (spec.pulse) {
      const { perBar, subs = 1, bars = 2, bpm = 84 } = spec.pulse;
      const beat = 60 / bpm;
      for (let bar = 0; bar < bars; bar++) {
        for (let b = 0; b < perBar; b++) {
          const t = off + (bar * perBar + b) * beat;
          out.push(b === 0 ? ev.drum(t, "kick", 0.95) : ev.drum(t, "rim", 0.7));
          for (let s = 1; s < subs; s++) out.push(ev.drum(t + (s * beat) / subs, "hat", 0.3));
        }
      }
      return out;
    }
    if (spec.prog) {
      const tonic = spec.tonic || 60, beat = spec.beat || 1.0;
      spec.prog.forEach((deg, i) => {
        const raw = T.triad(tonic, deg);
        const notes = raw.map((n) => { while (n > tonic + 9) n -= 12; return n; });
        notes.push(raw[0] - 12);
        const last = i === spec.prog.length - 1;
        out.push(ev.sustained(off + i * beat, last ? beat * 1.8 : beat * 0.95, notes.map(T.freq), 0.8));
      });
      return out;
    }
    return out;
  }

  // ---------- visuals (static SVG/DOM, never user text) ----------
  const NOTE_PATHS = {
    flag1: "M24.5 12 C33 15 38 22 34 36",
    flag2: "M24.5 21 C33 24 38 31 34 45",
  };
  function noteSvg(kind, dotted) {
    const open = kind === "semibreve" || kind === "minim";
    const stem = kind !== "semibreve";
    const flags = kind === "quaver" ? 1 : kind === "semiquaver" ? 2 : 0;
    let s = '<svg viewBox="0 0 50 70" width="48" height="68" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round">';
    if (kind === "semibreve") s += '<ellipse cx="22" cy="52" rx="12" ry="7.5" stroke-width="3"/><ellipse cx="22" cy="52" rx="4.2" ry="7" transform="rotate(35 22 52)" stroke-width="2.6"/>';
    else if (open) s += '<ellipse cx="16" cy="52" rx="9.5" ry="6.5" transform="rotate(-20 16 52)"/>';
    else s += '<ellipse cx="16" cy="52" rx="9.5" ry="6.5" transform="rotate(-20 16 52)" fill="currentColor"/>';
    if (stem) s += '<line x1="24.8" y1="49" x2="24.8" y2="10"/>';
    if (flags >= 1) s += `<path d="${NOTE_PATHS.flag1}"/>`;
    if (flags >= 2) s += `<path d="${NOTE_PATHS.flag2}"/>`;
    if (dotted) s += `<circle cx="${kind === "semibreve" ? 40 : 33}" cy="51" r="2.3" fill="currentColor" stroke="none"/>`;
    return s + "</svg>";
  }
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

  /** A bar of segments sized by beat length. items: [{len, label, rest}]. */
  function barRow(items, total) {
    total = total || items.reduce((a, b) => a + b.len, 0);
    const row = el("div", "lbar");
    items.forEach((it) => {
      const seg = el("div", "lseg" + (it.rest ? " rest" : ""), it.label || "");
      seg.style.flex = String(it.len / total);
      row.appendChild(seg);
    });
    return row;
  }

  /** "Family tree" of note values: each row splits the bar into equal pieces. */
  function tree() {
    const rows = [["Semibreve", 1], ["Minim", 2], ["Crotchet", 4], ["Quaver", 8], ["Semiquaver", 16]];
    const box = el("div", "ltree");
    rows.forEach(([name, n]) => {
      const row = el("div", "ltree-row");
      row.appendChild(el("span", "ltree-name", `${name}${n > 1 ? " x " + n : ""}`));
      const seg = el("div", "ltree-segs");
      for (let i = 0; i < n; i++) seg.appendChild(el("i", "ltree-seg"));
      row.appendChild(seg);
      box.appendChild(row);
    });
    return box;
  }

  /** A clickable piano keyboard. `mark` midi numbers are highlighted. */
  function keyboard(from, to, mark, onKey) {
    const WHITE = [0, 2, 4, 5, 7, 9, 11], NAMES = { 0: "C", 2: "D", 4: "E", 5: "F", 7: "G", 9: "A", 11: "B" };
    const isWhite = (m) => WHITE.includes(m % 12);
    const W = 34, H = 120, BW = 21, BH = 74;
    let whites = 0;
    for (let m = from; m <= to; m++) if (isWhite(m)) whites++;
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("viewBox", `0 0 ${whites * W} ${H + 4}`);
    svg.setAttribute("class", "kb");
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-label", "Piano keyboard. Click a key to hear it.");
    const mk = (tag, attrs) => { const n = document.createElementNS(ns, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };
    let x = 0;
    const blacks = [];
    for (let m = from; m <= to; m++) {
      if (isWhite(m)) {
        const r = mk("rect", { x: x + 1, y: 1, width: W - 2, height: H, rx: 3, class: "wk" + (mark.includes(m) ? " hi" : ""), "data-m": m });
        svg.appendChild(r);
        const label = mk("text", { x: x + W / 2, y: H - 8, "text-anchor": "middle", class: "kl" });
        label.textContent = NAMES[m % 12] + (m === 60 ? "" : "");
        svg.appendChild(label);
        x += W;
      } else blacks.push([m, x]);
    }
    blacks.forEach(([m, bx]) => svg.appendChild(mk("rect", { x: bx - BW / 2, y: 1, width: BW, height: BH, rx: 2.5, class: "bk" + (mark.includes(m) ? " hi" : ""), "data-m": m })));
    svg.addEventListener("click", (e) => { const m = e.target.getAttribute && e.target.getAttribute("data-m"); if (m != null) onKey(Number(m)); });
    return svg;
  }

  // ---------- the lessons ----------
  const V = (kind, name, us, beats, dotted) => ({ kind, name, us, beats, dotted });
  const LESSONS = [
    { id: "beat", outcome: 0, title: "Feel the beat", mins: 5,
      goal: "Know what a beat and a bar are, and tell 3 beats in a bar from 4.",
      why: "Every rhythm question starts with finding the pulse. If you can do this, the rest of Outcome 3 is easier.",
      steps: [
        { t: "say", title: "The beat is the steady pulse", text: "Tap your foot to any song and you are tapping the beat. It never changes speed unless the music does. How fast it goes is called the tempo.",
          list: ["Beat: one tap of the steady pulse", "Tempo: how fast the beats are (slow, medium, fast)"] },
        { t: "hear", text: "Same pulse at three different speeds. Tap along with each one.",
          buttons: [["Slow", { pulse: { perBar: 4, bars: 2, bpm: 60 } }], ["Medium", { pulse: { perBar: 4, bars: 2, bpm: 96 } }], ["Fast", { pulse: { perBar: 4, bars: 3, bpm: 140 } }]] },
        { t: "say", title: "Beats come in groups called bars", text: "We group beats into bars to keep track. The first beat of a bar is the strongest, so musicians count it as the \"one\". In the sound below the low drum is beat 1 and the lighter taps are the other beats.",
          list: ["Bar: one group of beats, ending at a bar line", "The first beat is felt as the strongest"] },
        { t: "hear", text: "Count out loud: \"ONE two three four, ONE two three four\". Then try the second one: \"ONE two three\".",
          buttons: [["4 beats in a bar", { pulse: { perBar: 4, bars: 3, bpm: 84 } }], ["3 beats in a bar", { pulse: { perBar: 3, bars: 4, bpm: 84 } }]] },
        { t: "check", q: "What do we call the steady pulse you tap your foot to?", options: ["The beat", "The melody", "The pitch", "The chord"], answer: 0, why: "The beat is the steady pulse. The melody is the tune on top of it." },
        { t: "check", q: "Listen. How many beats are in each bar?", hear: { pulse: { perBar: 3, bars: 4, bpm: 84 } }, options: ["2", "3", "4", "6"], answer: 1, why: "The low drum comes round every 3 taps, so there are 3 beats in each bar." },
        { t: "check", q: "Which beat of the bar is usually the strongest?", options: ["The first", "The second", "The last", "They are all the same"], answer: 0, why: "The first beat gets the accent. Listening for the low drum or the stressed beat is how you find where each bar starts." },
      ],
      remember: ["A beat is the steady pulse; tempo is its speed.", "Beats are grouped into bars.", "Listen for the strong first beat to count how many beats are in a bar."],
      practise: "timeSignatures" },

    { id: "values", outcome: 3, title: "Note lengths: semibreve, minim, crotchet, quaver", mins: 8,
      goal: "Name the five common note lengths and say how many beats each lasts.",
      why: "The rhythm questions are written in these names. Learn them once and the answers become obvious.",
      steps: [
        { t: "say", title: "A note's shape tells you how long it lasts", text: "Every note has a length, measured in beats. We count in crotchet beats: a crotchet lasts 1 beat. All the others are shorter or longer than that.",
          list: ["The head is open or filled in", "The stem is the line going up or down", "Flags (the little tails) make a note shorter"] },
        { t: "values", items: [
          V("semibreve", "Semibreve", "whole note", 4), V("minim", "Minim", "half note", 2), V("crotchet", "Crotchet", "quarter note", 1),
          V("quaver", "Quaver", "eighth note", 0.5), V("semiquaver", "Semiquaver", "sixteenth note", 0.25)] },
        { t: "say", title: "Use fractions to remember the names", text: "Treat the semibreve as one whole bar of 4 beats. Everything else is a fraction of it, which is exactly what the American names say (whole, half, quarter, eighth, sixteenth). If you forget a UK name, work out the fraction.",
          list: ["Semibreve = whole = 4 beats", "Minim = half = 2 beats", "Crotchet = quarter = 1 beat", "Quaver = eighth = half a beat", "Semiquaver = sixteenth = a quarter of a beat"] },
        { t: "tree" },
        { t: "tip", text: "Each row below fits into the same space. So 2 minims = 1 semibreve, 4 crotchets = 1 semibreve, and 2 quavers = 1 crotchet. In the exam you will often need \"2 quavers\" for one beat." },
        { t: "hear", text: "Hear the same bar of 4 beats filled in different ways. The drum keeps the beat.",
          buttons: [["2 minims", { rhythm: [2, 2] }], ["4 crotchets", { rhythm: [1, 1, 1, 1] }], ["8 quavers", { rhythm: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }]] },
        { t: "check", q: "How many beats does a minim last?", options: ["1", "2", "3", "4"], answer: 1, why: "A minim is a half note: half of a 4-beat semibreve, so 2 beats." },
        { t: "check", q: "How many quavers fit into one crotchet?", options: ["1", "2", "3", "4"], answer: 1, why: "A quaver is half a beat, so two quavers make one crotchet." },
        { t: "check", q: "Listen to the notes against the beat. Each note lasts how long?", hear: { rhythm: [2, 2] }, options: ["Semibreve", "Minim", "Crotchet", "Quaver"], answer: 1, why: "Each note lasts 2 beats, which is a minim. Two of them fill the bar of 4." },
        { t: "check", q: "Listen. Which note value is being played?", hear: { rhythm: [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5] }, options: ["Minim", "Crotchet", "Quaver", "Semibreve"], answer: 2, why: "Two notes happen for every tap of the beat, so each lasts half a beat: quavers." },
      ],
      remember: ["Semibreve 4, minim 2, crotchet 1, quaver 1/2, semiquaver 1/4 (in beats).", "If you forget a name, think whole, half, quarter, eighth, sixteenth.", "2 quavers make 1 crotchet."],
      practise: "rhythms" },

    { id: "rests", outcome: 3, title: "Rests: silence has a length too", mins: 5,
      goal: "Know that every note length has a matching rest, and hear silence as part of the rhythm.",
      why: "A rhythm with gaps in it sounds very different from one without. Learn to count the silence.",
      steps: [
        { t: "say", title: "A rest is a silence of a set length", text: "For every note there is a rest of the same length. A crotchet rest is 1 beat of silence, a minim rest is 2 beats of silence, and so on. You keep counting through the silence.",
          list: ["Crotchet rest: 1 beat of silence", "Minim rest: 2 beats", "Semibreve rest: a whole bar of 4 beats", "Quaver rest: half a beat"] },
        { t: "bars", caption: "Same bar of 4 beats, with silence shown in grey.", rows: [
          { label: "Note, rest, note, rest", items: [{ len: 1, label: "note" }, { len: 1, label: "rest", rest: true }, { len: 1, label: "note" }, { len: 1, label: "rest", rest: true }], hear: { rhythm: [1, -1, 1, -1] } },
          { label: "Rest, then three notes", items: [{ len: 1, label: "rest", rest: true }, { len: 1, label: "note" }, { len: 1, label: "note" }, { len: 1, label: "note" }], hear: { rhythm: [-1, 1, 1, 1] } },
          { label: "Two notes, then a minim rest", items: [{ len: 1, label: "note" }, { len: 1, label: "note" }, { len: 2, label: "minim rest", rest: true }], hear: { rhythm: [1, 1, -2] } },
        ] },
        { t: "tip", text: "Count aloud while you listen: \"1 2 3 4\". If you reach a beat and hear nothing, that beat is a rest." },
        { t: "check", q: "How long is a minim rest?", options: ["1 beat", "2 beats", "3 beats", "4 beats"], answer: 1, why: "A rest has the same length as the note of the same name, so a minim rest is 2 beats." },
        { t: "check", q: "Count the beats of silence at the end of this bar.", hear: { rhythm: [1, 1, -2] }, options: ["1", "2", "3", "None"], answer: 1, why: "Two crotchets use up beats 1 and 2, so beats 3 and 4 are silent: 2 beats of rest." },
        { t: "check", q: "Which beat is silent in this bar?", hear: { rhythm: [-1, 1, 1, 1] }, options: ["Beat 1", "Beat 2", "Beat 3", "Beat 4"], answer: 0, why: "The drum plays on beat 1 but there is no piano note: beat 1 is a rest." },
      ],
      remember: ["Every note has a rest of equal length.", "Keep counting through the silence.", "In a 4-beat bar, a semibreve rest is the whole bar."],
      practise: "rhythms" },

    { id: "dots", outcome: 3, title: "Dotted notes", mins: 6,
      goal: "Work out how long any dotted note lasts and recognise the dotted rhythm sound.",
      why: "Dotted rhythms are named in the unit. The rule is simple: add half.",
      steps: [
        { t: "say", title: "A dot makes a note half as long again", text: "A dot after a note head adds half of that note's value. Do the sum: note length + half of the note length.",
          list: ["Dotted minim = 2 + 1 = 3 beats", "Dotted crotchet = 1 + 1/2 = 1 1/2 beats", "Dotted quaver = 1/2 + 1/4 = 3/4 of a beat"] },
        { t: "values", items: [V("minim", "Dotted minim", "dotted half", 3, true), V("crotchet", "Dotted crotchet", "dotted quarter", 1.5, true), V("quaver", "Dotted quaver", "dotted eighth", 0.75, true)] },
        { t: "say", title: "A dotted note usually has a short partner", text: "A dotted crotchet (1 1/2) is usually followed by a quaver (1/2) to make 2 beats. This gives the long-short, long-short feel. Say \"Hap-py Birth-day\": the first syllable of each pair is long and the second short. That is a dotted rhythm.",
          list: ["Dotted crotchet + quaver = 2 beats", "Dotted minim + crotchet = 4 beats (a full bar)"] },
        { t: "hear", text: "Hear the lilting dotted feel against an even rhythm. Try saying \"DUM-da DUM-da\" along with the dotted one.",
          buttons: [["Even crotchets", { rhythm: [1, 1, 1, 1] }], ["Dotted crotchet + quaver", { rhythm: [1.5, 0.5, 1.5, 0.5] }], ["Dotted minim + crotchet", { rhythm: [3, 1] }]] },
        { t: "check", q: "How many beats does a dotted crotchet last?", options: ["1", "1 1/2", "2", "3"], answer: 1, why: "Crotchet (1) plus half of it (1/2) = 1 1/2 beats." },
        { t: "check", q: "A dotted minim and a crotchet are in the same bar. How many beats is that in total?", options: ["3", "4", "5", "6"], answer: 1, why: "3 + 1 = 4 beats, a full bar of 4/4." },
        { t: "check", q: "Listen. Which rhythm is this?", hear: { rhythm: [1.5, 0.5, 1.5, 0.5] }, options: ["Four crotchets", "Two minims", "Dotted crotchet and quaver, twice", "Dotted minim and crotchet"], answer: 2, why: "It lilts: long-short, long-short. Each pair is a dotted crotchet (1 1/2) plus a quaver (1/2) = 2 beats, so two pairs fill the bar." },
        { t: "check", q: "Review: how many quavers fit into one crotchet?", review: true, options: ["1", "2", "3", "4"], answer: 1, why: "A quaver is half a beat, so two make a crotchet." },
      ],
      remember: ["A dot adds half the note's value.", "Dotted crotchet = 1 1/2, dotted minim = 3.", "Dotted crotchet + quaver feels like \"long-short\"."],
      practise: "rhythms" },

    { id: "bars", outcome: 3, title: "Bars and time signatures", mins: 8,
      goal: "Read the two numbers of a time signature and tell 4/4 from 3/4 by ear.",
      why: "Time signatures are one whole topic in Outcome 3.",
      steps: [
        { t: "say", title: "The two numbers tell you how to count", text: "A time signature is written like a fraction at the start of the music. The top number says how many beats are in each bar. The bottom number says which note counts as one beat.",
          list: ["Top number: beats in each bar", "Bottom number 4: the beat is a crotchet", "Bottom number 8: the beat is a quaver (more on this next lesson)", "Bottom number 2: the beat is a minim"] },
        { t: "bars", caption: "Bars of 4/4 and 3/4 can be filled in many ways. Each one adds up to the top number.", rows: [
          { label: "4/4: minim + crotchet + crotchet = 4", items: [{ len: 2, label: "minim" }, { len: 1, label: "crotchet" }, { len: 1, label: "crotchet" }], hear: { rhythm: [2, 1, 1] } },
          { label: "4/4: four crotchets = 4", items: [{ len: 1, label: "crotchet" }, { len: 1, label: "crotchet" }, { len: 1, label: "crotchet" }, { len: 1, label: "crotchet" }], hear: { rhythm: [1, 1, 1, 1] } },
          { label: "3/4: minim + crotchet = 3", items: [{ len: 2, label: "minim" }, { len: 1, label: "crotchet" }], hear: { rhythm: [2, 1], perBar: 3 } },
          { label: "3/4: dotted minim = 3", items: [{ len: 3, label: "dotted minim" }], hear: { rhythm: [3], perBar: 3 } },
        ] },
        { t: "say", title: "Name the type", text: "Simple time means each beat splits in two. 2, 3 or 4 beats in a bar gives duple, triple or quadruple. So 4/4 is simple quadruple and 3/4 is simple triple. A 3/4 bar has a waltz feel: ONE two three, ONE two three." },
        { t: "hear", text: "Listen for where the low drum falls.", buttons: [["4/4", { pulse: { perBar: 4, bars: 3, bpm: 84 } }], ["3/4 (waltz)", { pulse: { perBar: 3, bars: 4, bpm: 84 } }]] },
        { t: "check", q: "In 3/4, what does the top number 3 tell you?", options: ["There are 3 beats in each bar", "The bar lasts 3 seconds", "There are 3 bars", "It is the third beat"], answer: 0, why: "The top number is the number of beats in each bar." },
        { t: "check", q: "How many crotchets fill one bar of 4/4?", options: ["2", "3", "4", "8"], answer: 2, why: "The bottom 4 means the beat is a crotchet, and the top 4 means 4 of them in each bar." },
        { t: "check", q: "Listen. Is this 4/4 or 3/4?", hear: { pulse: { perBar: 3, bars: 4, bpm: 84 } }, options: ["3/4", "4/4"], answer: 0, why: "The low drum comes round every 3 beats, so it is 3/4." },
        { t: "check", q: "Review: how long is a dotted minim?", review: true, options: ["2 beats", "3 beats", "4 beats", "1 1/2 beats"], answer: 1, why: "Minim 2 plus half of it (1) = 3 beats. It fills a bar of 3/4 by itself." },
      ],
      remember: ["Top number = beats in a bar. Bottom number 4 = the beat is a crotchet.", "4/4 is simple quadruple, 3/4 is simple triple.", "In simple time every beat splits into 2."],
      practise: "timeSignatures" },

    { id: "compound", outcome: 3, title: "Compound time: 6/8 and 9/8", mins: 8,
      goal: "Hear the difference between beats that split in two and beats that split in three, and name 6/8 and 9/8.",
      why: "6/8 and 9/8 are the two hardest time signatures to tell apart from 4/4 and 3/4. This is how.",
      steps: [
        { t: "say", title: "Two ways to split a beat", text: "In simple time each main beat splits into 2. In compound time each main beat splits into 3. The bottom number 8 means the counting unit is a quaver, and quavers are grouped in threes.",
          list: ["Simple: ONE-and TWO-and (2 quavers per beat)", "Compound: ONE-la-li TWO-la-li (3 quavers per beat)"] },
        { t: "say", title: "Use words to feel the groups", text: "Say \"ap-ple\" for a beat that splits into 2 and \"straw-ber-ry\" for a beat that splits into 3. A bar of 6/8 is \"straw-ber-ry straw-ber-ry\": 6 quavers felt as 2 big beats. A bar of 9/8 is \"straw-ber-ry\" three times: 3 big beats.",
          list: ["6/8: 6 quavers, 2 main beats (compound duple)", "9/8: 9 quavers, 3 main beats (compound triple)"] },
        { t: "hear", text: "Say the fruit words over each one. The low drum is the first main beat and the quiet taps are the quavers.",
          buttons: [["4/4 (ap-ple)", { pulse: { perBar: 4, subs: 2, bars: 2, bpm: 70 } }], ["6/8 (straw-ber-ry x2)", { pulse: { perBar: 2, subs: 3, bars: 4, bpm: 64 } }], ["3/4 (ap-ple x3)", { pulse: { perBar: 3, subs: 2, bars: 3, bpm: 70 } }], ["9/8 (straw-ber-ry x3)", { pulse: { perBar: 3, subs: 3, bars: 3, bpm: 64 } }]] },
        { t: "tip", text: "Tap the main pulse, not every quaver. 6/8 rocks like a boat going back and forth (2). 9/8 rocks in three. If you hear a lilting 1-2-3 inside each beat, it is compound." },
        { t: "check", q: "How many main beats are in a bar of 6/8?", options: ["2", "3", "4", "6"], answer: 0, why: "6/8 is 6 quavers in 2 groups of 3, so 2 main beats." },
        { t: "check", q: "How many main beats are in a bar of 9/8?", options: ["2", "3", "4", "9"], answer: 1, why: "9 quavers in 3 groups of 3 gives 3 main beats." },
        { t: "check", q: "Listen. Which time signature is this?", hear: { pulse: { perBar: 2, subs: 3, bars: 4, bpm: 64 } }, options: ["4/4", "3/4", "6/8", "9/8"], answer: 2, why: "Each low-drum beat has 2 quiet taps after it (3 quavers per beat) and the drum returns after 2 beats: 6/8." },
        { t: "check", q: "Listen. Which time signature is this?", hear: { pulse: { perBar: 3, subs: 3, bars: 3, bpm: 64 } }, options: ["3/4", "6/8", "9/8", "4/4"], answer: 2, why: "Each main beat splits in 3 and there are 3 main beats before the drum returns: 9/8." },
        { t: "check", q: "Review: which time signature has beats that split in two and 3 beats in a bar?", review: true, options: ["3/4", "6/8", "9/8", "4/4"], answer: 0, why: "3/4 is simple triple: 3 beats, each splitting in 2." },
      ],
      remember: ["Simple = beats split in 2; compound = beats split in 3.", "6/8 = 2 main beats, 9/8 = 3 main beats.", "Find the pulse, count main beats per bar, decide if each splits in 2 or 3."],
      practise: "timeSignatures" },

    { id: "pitch", outcome: 1, title: "Pitch, tones and semitones", mins: 8,
      goal: "Find notes on the keyboard and know what a semitone and a tone are.",
      why: "Everything in Outcomes 1 and 2 is measured in semitones.",
      steps: [
        { t: "say", title: "Pitch is how high or low a note is", text: "Notes get their names from the first seven letters: A B C D E F G. After G the pattern starts again, higher up. Click the keys below to hear them. The C keys are the white key just to the left of each pair of black keys.",
          list: ["Pitch: how high or low a note sounds", "The same letter an octave apart sounds like the \"same\" note, higher or lower"] },
        { t: "keys", from: 60, to: 76, mark: [60, 72], caption: "Click any key. The two highlighted keys are both C, an octave apart." },
        { t: "say", title: "The semitone is the smallest step", text: "A semitone is the distance from one key to the very next key, black or white. A tone is two semitones. There is no black key between E and F or between B and C, so those pairs are only a semitone apart. All other neighbouring white notes are a tone apart.",
          list: ["Semitone = 1 key step (smallest)", "Tone = 2 semitones", "E to F and B to C are semitones"] },
        { t: "keys", from: 60, to: 72, mark: [64, 65], caption: "E to F: two white keys with no black key between. Just 1 semitone." },
        { t: "hear", text: "Compare a semitone with a tone, starting on C and then on E.",
          buttons: [["C up a semitone", { notes: [60, 61] }], ["C up a tone", { notes: [60, 62] }], ["E to F (semitone)", { notes: [64, 65] }], ["F to G (tone)", { notes: [65, 67] }]] },
        { t: "check", q: "How many semitones are in a tone?", options: ["1", "2", "3", "4"], answer: 1, why: "A tone is two semitones." },
        { t: "check", q: "Which pair of white notes is only a semitone apart?", options: ["C and D", "E and F", "F and G", "A and B"], answer: 1, why: "There is no black key between E and F, so they are a semitone apart." },
        { t: "check", q: "Listen. Is this step a semitone or a tone?", hear: { notes: [64, 65] }, options: ["Semitone", "Tone"], answer: 0, why: "E up to F is the smallest step on the keyboard, a semitone." },
      ],
      remember: ["Notes are named A to G, then repeat.", "Semitone = next key; tone = 2 semitones.", "E to F and B to C are semitones."],
      practise: "intervals" },

    { id: "intervals", outcome: 1, title: "Intervals", mins: 10,
      goal: "Name the eight intervals in the unit and recognise each by ear.",
      why: "Outcome 1 starts with ascending intervals: unison, major 2nd, major 3rd, perfect 4th and 5th, major 6th and 7th, octave.",
      steps: [
        { t: "say", title: "An interval is the distance between two notes", text: "We name it by counting letter names from the bottom note, counting the first note as 1. C up to E is C D E, so it is a 3rd. The word before it (major or perfect) says how many semitones it contains.",
          list: ["Unison: the same note (0 semitones)", "Major 2nd: C-D (2)", "Major 3rd: C-E (4)", "Perfect 4th: C-F (5)", "Perfect 5th: C-G (7)", "Major 6th: C-A (9)", "Major 7th: C-B (11)", "Octave: C-C (12)"] },
        { t: "keys", from: 60, to: 72, mark: [60, 64], caption: "C to E is a major 3rd: count C D E = 3, and it is 4 semitones." },
        { t: "say", title: "Learn the ladder, then add a tune to each", text: "The semitone numbers 0 2 4 5 7 9 11 12 are just the notes of a major scale. Chant them like a phone number. Then give each interval a song you know that starts with it. Pick your own: your own memory is stronger than mine.",
          list: ["Major 2nd: Happy Birthday (\"Birth-day\") or Do-Re-Mi", "Major 3rd: When the Saints Go Marching In", "Perfect 4th: Here Comes the Bride", "Perfect 5th: Twinkle Twinkle Little Star", "Major 6th: My Bonnie Lies Over the Ocean", "Major 7th: one semitone short of the octave", "Octave: Somewhere Over the Rainbow"] },
        { t: "hear", text: "Hear each interval from middle C. Sing the top note back after each one.",
          buttons: [["Unison", { notes: [60, 60] }], ["Major 2nd", { notes: [60, 62] }], ["Major 3rd", { notes: [60, 64] }], ["Perfect 4th", { notes: [60, 65] }], ["Perfect 5th", { notes: [60, 67] }], ["Major 6th", { notes: [60, 69] }], ["Major 7th", { notes: [60, 71] }], ["Octave", { notes: [60, 72] }]] },
        { t: "tip", text: "Two sorting steps help when you are unsure. First sort by width: close (2nd, 3rd), middle (4th, 5th), wide (6th, 7th, octave). Then choose inside the group. 6th is a 5th plus a tone; 7th is an octave minus a semitone." },
        { t: "check", q: "How many semitones are in a perfect 5th?", options: ["5", "7", "9", "11"], answer: 1, why: "C to G is 7 semitones." },
        { t: "check", q: "C up to A is which interval?", options: ["Perfect 5th", "Major 6th", "Major 7th", "Perfect 4th"], answer: 1, why: "C D E F G A: A is the 6th note, and the gap is 9 semitones: a major 6th." },
        { t: "check", q: "Listen. Which interval is this?", hear: { notes: [60, 65] }, options: ["Major 3rd", "Perfect 4th", "Perfect 5th", "Major 6th"], answer: 1, why: "It sounds like the start of \"Here Comes the Bride\": a perfect 4th (5 semitones)." },
        { t: "check", q: "Listen. Which interval is this?", hear: { notes: [60, 67] }, options: ["Perfect 4th", "Perfect 5th", "Major 6th", "Octave"], answer: 1, why: "It sounds like the start of \"Twinkle Twinkle\": a perfect 5th (7 semitones)." },
        { t: "check", q: "Listen. Which interval is this?", hear: { notes: [60, 71] }, options: ["Major 6th", "Major 7th", "Octave", "Perfect 5th"], answer: 1, why: "It is very wide and almost reaches the octave: a major 7th, 11 semitones." },
        { t: "check", q: "Review: how many semitones in a tone?", review: true, options: ["1", "2", "3", "4"], answer: 1, why: "A tone is 2 semitones." },
      ],
      remember: ["Count letter names to get the number (C to E = 3rd).", "0, 2, 4, 5, 7, 9, 11, 12 semitones.", "Match each interval to a song and sing the second note."],
      practise: "intervals" },

    { id: "scales", outcome: 1, title: "Scales: major and two minors", mins: 10,
      goal: "Say the tone/semitone pattern of each scale and hear the difference.",
      why: "You need to tell major, melodic minor and harmonic minor scales apart, going up and down.",
      steps: [
        { t: "say", title: "A scale is a ladder of notes", text: "A scale is a set of notes in order, going up one step at a time. Its pattern of tones (T) and semitones (S) decides how it sounds. Learn each pattern as a short chant.",
          list: ["Major: T T S T T T S", "Melodic minor (going up): T S T T T T S", "Harmonic minor: T S T T S 3 S   (3 means three semitones, a big jump)"] },
        { t: "keys", from: 60, to: 72, mark: [60, 62, 64, 65, 67, 69, 71, 72], caption: "C major uses only white keys from C to C. Click them in order to hear the scale." },
        { t: "hear", text: "Hear all three going up from C. Notice only the 3rd note changes between major and melodic minor, and harmonic minor has the odd jump.",
          buttons: [["Major up", { notes: up(MAJ), gap: 0.4 }], ["Melodic minor up", { notes: up(MEL_UP), gap: 0.4 }], ["Harmonic minor up", { notes: up(HARM), gap: 0.4 }]] },
        { t: "say", title: "What to listen for", text: "Harmonic minor has an unmistakable sound: a big jump between the 6th and 7th notes, like a snake-charmer tune. Melodic minor sounds like a major scale that starts darker. Coming down, melodic minor goes back to natural minor, so going down it sounds different from going up.",
          list: ["Major: bright all the way", "Melodic minor: dark 3rd, but the top is bright going up; going down it is natural minor", "Harmonic minor: the big jump near the top"] },
        { t: "hear", text: "Compare melodic minor going up with going down.", buttons: [["Melodic minor up", { notes: up(MEL_UP), gap: 0.4 }], ["Melodic minor down", { notes: up(NAT_DOWN), gap: 0.4 }]] },
        { t: "check", q: "What is the pattern of the major scale?", options: ["T T S T T T S", "T S T T T T S", "T S T T S 3 S", "S T T S T T T"], answer: 0, why: "Major is T T S T T T S: the last gap before the top note is a semitone." },
        { t: "check", q: "Which scale has the three-semitone jump?", options: ["Major", "Melodic minor", "Harmonic minor"], answer: 2, why: "Harmonic minor raises only the 7th, leaving a gap of 3 semitones between the 6th and 7th notes." },
        { t: "check", q: "Listen. Which scale is this?", hear: { notes: up(HARM), gap: 0.4 }, options: ["Major", "Melodic minor", "Harmonic minor"], answer: 2, why: "That big jump near the top is the sound of harmonic minor." },
        { t: "check", q: "Listen. Which scale is this?", hear: { notes: up(MAJ), gap: 0.4 }, options: ["Major", "Melodic minor", "Harmonic minor"], answer: 0, why: "It sounds bright and even from bottom to top: major." },
        { t: "check", q: "Melodic minor coming down is the same as which scale?", options: ["Major", "Natural minor", "Harmonic minor"], answer: 1, why: "Coming down, the 6th and 7th drop back, which is natural minor." },
      ],
      remember: ["Major T T S T T T S; melodic minor T S T T T T S; harmonic minor T S T T S 3 S.", "Listen for the odd jump: harmonic minor.", "Melodic minor comes down as natural minor."],
      practise: "scales" },

    { id: "tonality", outcome: 1, title: "Major or minor? Hearing the key", mins: 6,
      goal: "Decide whether a short tune is major or minor by finding home and checking the 3rd.",
      why: "Tonality questions give you a four-bar phrase and ask for major or minor.",
      steps: [
        { t: "say", title: "Find home first", text: "Every tune has a home note (the tonic) where it feels finished. Hum along until you find it. Then sing the note a 3rd above home. If that 3rd is bright (4 semitones) the tune is major; if it is darker (3 semitones) the tune is minor.",
          list: ["Do not guess from happy or sad alone", "Check the 3rd above the home note", "In minor keys the 7th may be raised, so a bright ending does not mean major"] },
        { t: "hear", text: "Same tune, one note changed (the 3rd).", buttons: [["Major tune", { notes: [60, 62, 64, 67, 64, 62, 60], gap: 0.45 }], ["Minor tune", { notes: [60, 62, 63, 67, 63, 62, 60], gap: 0.45 }]] },
        { t: "hear", text: "The home chord shows the same thing.", buttons: [["Major chord", { notes: [60, 64, 67], harmonic: true }], ["Minor chord", { notes: [60, 63, 67], harmonic: true }]] },
        { t: "check", q: "Listen. Major or minor?", hear: { notes: [60, 62, 63, 67, 63, 62, 60], gap: 0.45 }, options: ["Major", "Minor"], answer: 1, why: "The 3rd above home (the third note) is lower than in a major tune. That darker 3rd makes it minor." },
        { t: "check", q: "Listen. Major or minor?", hear: { notes: [67, 69, 71, 74, 71, 69, 67], gap: 0.45 }, options: ["Major", "Minor"], answer: 0, why: "Home is G and the 3rd above it (B) is bright: major." },
        { t: "check", q: "A major 3rd has how many semitones?", options: ["3", "4", "5", "7"], answer: 1, why: "Major 3rd = 4 semitones; minor 3rd = 3 semitones." },
        { t: "check", q: "Review: how many semitones in a perfect 5th?", review: true, options: ["5", "7", "9", "11"], answer: 1, why: "7 semitones." },
      ],
      remember: ["Find the home note, then check the 3rd above it.", "Major 3rd = 4 semitones, minor 3rd = 3.", "Do not trust mood alone."],
      practise: "tonality" },

    { id: "triads", outcome: 2, title: "Triads: major and minor chords", mins: 8,
      goal: "Build a major or minor triad and hear which is which, played together or one note at a time.",
      why: "Outcome 2 begins with triads, played melodically (one at a time) and harmonically (together).",
      steps: [
        { t: "say", title: "A chord is several notes sounding together", text: "A triad is a three-note chord: a root, a 3rd above it and a 5th above it. The only difference between major and minor is the middle note.",
          list: ["Major triad: 4 semitones then 3 (root, major 3rd, perfect 5th)", "Minor triad: 3 semitones then 4 (root, minor 3rd, perfect 5th)"] },
        { t: "keys", from: 60, to: 72, mark: [60, 64, 67], caption: "C major triad: C E G. Click the three keys, one after another, then together in your head." },
        { t: "keys", from: 60, to: 72, mark: [60, 63, 67], caption: "C minor triad: C E-flat G. The middle note moved down one key." },
        { t: "say", title: "Big step first = major", text: "Listen only to the lower gap, between the root and the middle note. If it is the wide gap (4) the chord is major. If it is the narrow gap (3) the chord is minor. You can also hear the chord broken up, one note at a time (melodic).",
          list: ["Harmonic: all notes together", "Melodic: notes one after another (also called broken)"] },
        { t: "hear", text: "Compare them all four ways.",
          buttons: [["Major, together", { notes: [60, 64, 67], harmonic: true }], ["Minor, together", { notes: [60, 63, 67], harmonic: true }], ["Major, one by one", { notes: [60, 64, 67], gap: 0.5 }], ["Minor, one by one", { notes: [60, 63, 67], gap: 0.5 }]] },
        { t: "check", q: "A minor triad is built from a minor 3rd (3 semitones) and then...", options: ["A major 3rd (4)", "A minor 3rd (3)", "A 4th (5)", "A 5th (7)"], answer: 0, why: "Minor is 3 + 4. Major is 4 + 3." },
        { t: "check", q: "Listen. Major or minor?", hear: { notes: [62, 65, 69], harmonic: true }, options: ["Major", "Minor"], answer: 1, why: "D to F is only 3 semitones: a minor triad (D minor)." },
        { t: "check", q: "Listen to the notes one at a time. Major or minor?", hear: { notes: [65, 69, 72], gap: 0.5 }, options: ["Major", "Minor"], answer: 0, why: "F to A is 4 semitones: a major triad (F major)." },
        { t: "check", q: "Review: which scale has a three-semitone jump?", review: true, options: ["Major", "Melodic minor", "Harmonic minor"], answer: 2, why: "Harmonic minor." },
      ],
      remember: ["Triad = root, 3rd, 5th.", "Major = 4 + 3, minor = 3 + 4.", "Listen to the bottom gap: wide = major."],
      practise: "triads" },

    { id: "sevenths", outcome: 2, title: "Seventh chords", mins: 8,
      goal: "Tell major, minor, major 7th, minor 7th and dominant 7th chords apart.",
      why: "The four-note chord question also includes plain major and minor chords, so you need a clear method.",
      steps: [
        { t: "say", title: "Add a fourth note on top", text: "A seventh chord is a triad with a 7th added above the root. Three types are in the unit. The type depends on the 3rd (major or minor) and on the 7th (major or minor).",
          list: ["Major 7th: major triad + major 7th (0 4 7 11): smooth, dreamy", "Minor 7th: minor triad + minor 7th (0 3 7 10): mellow, relaxed", "Dominant 7th: major triad + minor 7th (0 4 7 10): tense, wants to move on"] },
        { t: "keys", from: 60, to: 72, mark: [60, 64, 67, 71], caption: "C major 7th: C E G B." },
        { t: "keys", from: 60, to: 72, mark: [60, 64, 67, 70], caption: "C dominant 7th: C E G B-flat. The top note is one semitone lower than in major 7th." },
        { t: "hear", text: "Hear all five chord types you may be asked about.",
          buttons: [["Major", { notes: [60, 64, 67], harmonic: true }], ["Minor", { notes: [60, 63, 67], harmonic: true }], ["Major 7th", { notes: [60, 64, 67, 71], harmonic: true }], ["Minor 7th", { notes: [60, 63, 67, 70], harmonic: true }], ["Dominant 7th", { notes: [60, 64, 67, 70], harmonic: true }]] },
        { t: "say", title: "Decision tree for chord type", text: "Use the same steps every time:",
          list: ["1. Count the notes. Three notes: it is a triad. Decide major or minor from the 3rd.", "2. Four notes: listen to the 3rd. Dark 3rd = minor 7th.", "3. Bright 3rd and a smooth, floating top = major 7th.", "4. Bright 3rd and a tense, leaning top = dominant 7th."] },
        { t: "check", q: "Which seventh chord has a minor 3rd?", options: ["Major 7th", "Minor 7th", "Dominant 7th"], answer: 1, why: "Minor 7th is built on a minor triad (3 + 4), then a minor 7th." },
        { t: "check", q: "Listen. What type of chord is this?", hear: { notes: [60, 64, 67, 71], harmonic: true }, options: ["Major", "Minor", "Major 7th", "Dominant 7th"], answer: 2, why: "Four notes with a bright 3rd and a smooth, floating top note: major 7th." },
        { t: "check", q: "Listen. What type of chord is this?", hear: { notes: [60, 64, 67, 70], harmonic: true }, options: ["Major 7th", "Minor 7th", "Dominant 7th", "Minor"], answer: 2, why: "Bright 3rd plus a tense top note that wants to move on: dominant 7th." },
        { t: "check", q: "Listen. What type of chord is this?", hear: { notes: [60, 63, 67, 70], harmonic: true }, options: ["Major 7th", "Minor 7th", "Dominant 7th", "Major"], answer: 1, why: "The 3rd is dark, so it is a minor 7th." },
        { t: "check", q: "Listen. What type of chord is this?", hear: { notes: [60, 63, 67], harmonic: true }, options: ["Major", "Minor", "Minor 7th", "Dominant 7th"], answer: 1, why: "Only three notes with a dark 3rd: a plain minor triad. Count the notes first!" },
      ],
      remember: ["Count the notes first: 3 = triad, 4 = seventh chord.", "Dark 3rd = minor or minor 7th.", "Bright 3rd: smooth top = major 7th; tense top = dominant 7th."],
      practise: "sevenths" },

    { id: "numbers", outcome: 2, title: "Chord numbers and progressions", mins: 10,
      goal: "Name the chords of a key by number, and recognise common three- and four-chord progressions.",
      why: "The last Outcome 2 topic: name three and four chord progressions by their Roman numerals.",
      steps: [
        { t: "say", title: "Build a chord on every note of the scale", text: "Take a major scale and number its notes 1 to 7. Build a triad on each. Capital Roman numerals are major chords and lower case are minor. In C major:",
          list: ["I: major (home)", "ii: minor", "iii: minor", "IV: major", "V: major", "vi: minor"] },
        { t: "say", title: "Remember with two lists", text: "Major chords are 1, 4 and 5. Minor chords are 2, 3 and 6. Say it out loud: \"one, four, five are major; two, three, six are minor\". The pattern is the same in every key, and the test uses only the numerals." },
        { t: "keys", from: 60, to: 72, mark: [60, 65, 67], caption: "With C as home, the roots of the three major chords I, IV and V are the 1st, 4th and 5th notes of the scale." },
        { t: "say", title: "Learn the sounds as shapes", text: "Most questions use a handful of progressions. Learn what each feels like:",
          list: ["I - IV - V - I: home, away, tension, home", "I - V - vi - IV: the four-chord pop loop", "ii - V - I: the \"pull home\" of jazz and classical"] },
        { t: "hear", text: "Hear each one in C major. Sing the bass note of each chord if you can.",
          buttons: [["I - IV - V - I", { prog: ["I", "IV", "V", "I"] }], ["I - V - vi - IV", { prog: ["I", "V", "vi", "IV"] }], ["ii - V - I", { prog: ["ii", "V", "I"] }]] },
        { t: "tip", text: "Follow the bass line, not the whole chord. Three or four bass notes are easier to hold in your head than three or four full chords. The first chord is usually I, and V usually wants to go to I." },
        { t: "check", q: "Which of these is a minor chord?", options: ["I", "IV", "vi", "V"], answer: 2, why: "vi is written in lower case, so it is minor. I, IV and V are major." },
        { t: "check", q: "Which set contains only major chords?", options: ["I, IV, V", "ii, iii, vi", "I, ii, V", "iii, IV, vi"], answer: 0, why: "I, IV and V are major (1, 4, 5)." },
        { t: "check", q: "Listen. Which progression is this?", hear: { prog: ["ii", "V", "I"] }, options: ["I - IV - V", "I - V - vi - IV", "ii - V - I"], answer: 2, why: "Three chords: a minor chord, then V pulling home to I. That is ii - V - I." },
        { t: "check", q: "Listen. Which progression is this?", hear: { prog: ["I", "V", "vi", "IV"] }, options: ["I - IV - V - I", "I - V - vi - IV", "ii - V - I"], answer: 1, why: "Four chords: the pop loop I - V - vi - IV." },
        { t: "check", q: "Review: a dominant 7th is a major triad with a ... 7th?", review: true, options: ["Minor", "Major", "Diminished", "Perfect"], answer: 0, why: "Dominant 7th = major triad + minor 7th (0 4 7 10)." },
      ],
      remember: ["1, 4, 5 are major (capitals); 2, 3, 6 are minor.", "Learn each progression as a sound: I-IV-V-I, I-V-vi-IV, ii-V-I.", "Follow the bass line and trust V to I."],
      practise: "progressions" },

    { id: "exam", outcome: 0, title: "Exam technique", mins: 6,
      goal: "Use a repeatable routine for every question and manage your three listens.",
      why: "Technique picks up marks even when your ear is not perfect.",
      steps: [
        { t: "say", title: "The mock paper", text: "50 questions, 45 minutes, closed book. Each sound plays up to 3 times. Each outcome is marked on its own: Outcome 1 and 2 are out of 20 (pass 14) and Outcome 3 is out of 10 (pass 7)." },
        { t: "say", title: "A routine for every question", text: "Do the same thing every time so your head is free to listen.",
          list: ["Before play 1: read the question and options so you know what to listen for.", "Play 1: just listen and hum or tap. Do not choose yet.", "Play 2: test your best two options against the sound.", "Play 3: only if you are still unsure. Then choose and move on."] },
        { t: "say", title: "Use elimination", text: "You rarely have to know the answer for sure. Rule out options first: wide or narrow, major or minor 3rd, 2 beats or 3. A two-option guess is 50%, so never leave a blank." },
        { t: "say", title: "Between questions", text: "Reset your ears. Breathe, forget the last one and read the next. One missed question must not cost you the next two." },
        { t: "check", q: "What should you do on the first play of a sound?", options: ["Listen and hum or tap, without choosing yet", "Choose the first answer that comes to mind", "Skip it", "Close your eyes and guess"], answer: 0, why: "Use the first play to collect information, then test options on the second." },
        { t: "check", q: "You are not sure which answer is correct. What do you do?", options: ["Rule out options you are sure are wrong, then choose", "Leave it blank", "Spend the whole 45 minutes on it", "Pick the first"], answer: 0, why: "Elimination improves your odds. Blank answers score nothing." },
        { t: "check", q: "Outcome 3 is out of 10. What is the pass mark?", options: ["5", "7", "8", "10"], answer: 1, why: "Outcome 3 pass mark is 7 out of 10." },
      ],
      remember: ["Read first, listen first, test second, decide third.", "Eliminate before guessing; never leave blanks.", "Reset between questions."],
      practise: null },
  ];

  const PLAN = [
    ["Days 1 to 3", "Lessons 1 to 6", "Rhythm: beat, note lengths, rests, dots, bars and time signatures. Practise Rhythms and Time signatures for 10 minutes after each lesson."],
    ["Days 4 to 7", "Lessons 7 to 10", "Pitch: semitones, intervals, scales and tonality. Sing every interval back."],
    ["Days 8 to 11", "Lessons 11 to 13", "Chords: triads, seventh chords, chord numbers. Practise all of Outcome 2."],
    ["Days 12 to 14", "Lesson 14 and mocks", "Sit a mock paper, then retake any lesson where you scored below 75%."],
  ];

  AT.lessons = { LESSONS, PLAN, build, kit: { noteSvg, barRow, tree, keyboard, el } };
})(typeof window !== "undefined" ? window : globalThis);
