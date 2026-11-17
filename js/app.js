/* UI: renders screens and handles input. State changes go through the small functions below. */
(function (g) {
  const AT = g.AT;
  const { OUTCOMES, CATEGORIES, EXAM_MINUTES, byKey, outcomeOf, generate, mockTest, minutesFor } = AT.exercises;
  const P = AT.progress;
  const S = AT.synth;
  const MAX_PLAYS = 3;
  const PASS_PCT = 70; // 14/20 and 7/10 are both 70%

  const DATES = [
    ["8 Dec", "Mock exam, under exam conditions"],
    ["15 Dec", "Exam, closed book"],
    ["22 Dec", "Resit and remediation begins"],
    ["12 Jan", "Last day to resit, 9-11 am, L309b"],
  ];

  const root = document.getElementById("app");
  const state = { screen: "home", session: null, summary: null, confirmReset: false, audioError: false };
  let playTotal = 0;

  // ---------- tiny DOM helper (text is always set via textContent) ----------
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === "class") el.className = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const chip = (text, tone) => h("span", { class: "chip" + (tone ? " " + tone : "") }, text);
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const fmtClock = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  /** Thin bar with a tick at the pass mark. */
  function meter(percent, label) {
    return h("div", { class: "bar-meter" + (percent >= PASS_PCT ? " met" : ""), role: "progressbar", "aria-label": label,
        "aria-valuenow": percent, "aria-valuemin": 0, "aria-valuemax": 100 },
      h("i", { style: `width:${percent}%` }), h("b", { style: `left:${PASS_PCT}%` }));
  }

  // ---------- audio ----------
  function playEvents(events) {
    if (!S.supported()) { state.audioError = true; return; }
    const secs = S.play(events, () => { if (state.screen === "question") render(); updateStatus(); });
    if (!secs) state.audioError = true;
    else { state.audioError = false; playTotal = secs; }
  }

  // ---------- state changes ----------
  function go(screen) {
    S.stop();
    state.screen = screen;
    state.confirmReset = false;
    if (screen !== "question") state.session = null;
    render();
    g.scrollTo(0, 0);
  }

  function startSession(mode, cat, questions, live, outcomes) {
    state.session = {
      mode, cat, live: mode === "practice" ? true : !!live, questions, outcomes: outcomes || null,
      index: 0, selected: null, revealed: false,
      answers: [], log: [], history: [], playsUsed: 0, correct: 0, answered: 0, streak: 0, best: 0,
      deadline: mode === "mock" ? Date.now() + minutesFor(questions.length) * 60000 : null,
    };
    state.screen = "question";
    startQuestion();
    g.scrollTo(0, 0);
  }

  const startMock = (outcomes, scale, groupId) => {
    startSession("mock", null, mockTest(outcomes, scale), P.setting("live"), outcomes);
    state.session.groupId = groupId || null;
    state.session.scale = scale || 1;
  };

  function startQuestion() {
    const s = state.session;
    s.selected = null;
    s.revealed = false;
    s.playsUsed = 1;
    playEvents(s.questions[s.index].events);
    render();
  }

  function replay() {
    const s = state.session;
    if (!s) return;
    if (s.mode === "mock" && (s.playsUsed >= MAX_PLAYS || S.isPlaying())) return;
    s.playsUsed++;
    playEvents(s.questions[s.index].events);
    render();
  }

  /** Marks the answer straight away: score, streak and saved stats update in real time. */
  function reveal(i) {
    const s = state.session;
    const q = s.questions[s.index];
    const ok = i === q.correct;
    s.selected = i;
    s.revealed = true;
    s.answered++;
    s.answers[s.index] = i;
    s.log[s.index] = ok;
    s.history.push(ok);
    if (ok) { s.correct++; s.streak++; s.best = Math.max(s.best, s.streak); } else s.streak = 0;
    P.record(q.category, ok);
  }

  function select(i) {
    const s = state.session;
    if (!s || s.revealed) return;
    const q = s.questions[s.index];
    if (i < 0 || i >= q.options.length) return;
    if (s.mode === "practice" || s.live) reveal(i);
    else s.selected = i; // exam conditions: lock in later, see marks at the end
    render();
  }

  /** Exam conditions: record the chosen answer without showing the result. */
  function submitMock() {
    const s = state.session;
    if (!s || s.mode !== "mock" || s.live || s.selected == null) return;
    const q = s.questions[s.index];
    const ok = s.selected === q.correct;
    s.answers[s.index] = s.selected;
    s.log[s.index] = ok;
    s.answered++;
    if (ok) s.correct++;
    P.record(q.category, ok);
    moveOn();
  }

  function moveOn() {
    const s = state.session;
    if (s.index + 1 < s.questions.length) { s.index++; startQuestion(); }
    else finishMock();
  }

  function nextPractice() {
    const s = state.session;
    if (!s || s.mode !== "practice" || !s.revealed) return;
    s.questions = [generate(s.cat)];
    s.index = 0;
    startQuestion();
  }

  function advance() {
    const s = state.session;
    if (!s) return;
    if (s.mode === "practice") nextPractice();
    else if (s.live) { if (s.revealed) moveOn(); }
    else submitMock();
  }

  /** Marks each outcome on its own against its pass mark. Unanswered questions score nothing. */
  function finishMock(timedOut) {
    S.stop();
    const s = state.session;
    const sections = OUTCOMES.map((o) => ({ o, score: 0, total: 0, missed: [] }))
      .filter((sec) => s.questions.some((q) => q.outcome === sec.o.n));
    s.questions.forEach((q, i) => {
      const sec = sections.find((x) => x.o.n === q.outcome);
      sec.total++;
      if (s.answers[i] === q.correct) sec.score++;
      else sec.missed.push({ q, chosen: s.answers[i] });
    });
    sections.forEach((sec) => { sec.pass = sec.score >= sec.o.pass; });
    const score = sections.reduce((n, x) => n + x.score, 0);
    P.recordMock(score, s.questions.length, sections.map((x) => [x.o.n, x.score, x.total]));
    if (s.groupId) {
      const groups = P.setting("groups").map((gr) => gr.id === s.groupId
        ? { ...gr, last: { when: Date.now(), score, total: s.questions.length, sections: sections.map((x) => [x.o.n, x.score, x.total]) } } : gr);
      P.setSetting("groups", groups);
    }
    state.summary = { sections, total: s.questions.length, score, timedOut: !!timedOut, full: sections.length === OUTCOMES.length };
    state.session = null;
    state.screen = "results";
    render();
    g.scrollTo(0, 0);
  }

  // ---------- stage: live level meter while listening, note roll once answered ----------
  const css = getComputedStyle(document.documentElement);
  const col = (name) => css.getPropertyValue(name).trim();
  const COLOURS = { fg: col("--text"), accent: col("--accent"), unlit: col("--raise"), line: col("--line-hi"), dim: col("--dim") };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  /** Five hairlines, the stave, behind everything on the stage. */
  function drawStave(ctx, w, hgt) {
    const gap = 12, top = Math.round(hgt / 2 - gap * 2);
    ctx.fillStyle = COLOURS.line;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) ctx.fillRect(0, top + i * gap, w, 1);
    ctx.globalAlpha = 1;
  }

  function drawMeter(ctx, w, hgt) {
    const bands = w < 520 ? 20 : 32;
    const gap = 4, segH = 4, segGap = 4, padX = 16;
    const bw = (w - 2 * padX - (bands - 1) * gap) / bands;
    const rows = Math.max(3, Math.floor((hgt - 40) / (segH + segGap)));
    const level = S.spectrum(bands);
    for (let b = 0; b < bands; b++) {
      const lit = Math.round(level[b] * rows);
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = r >= lit ? COLOURS.unlit : r >= rows * 0.75 ? COLOURS.accent : COLOURS.fg;
        ctx.fillRect(padX + b * (bw + gap), hgt - 16 - (r + 1) * (segH + segGap) + segGap, bw, segH);
      }
    }
  }

  function drawRoll(ctx, w, hgt, q) {
    const padX = 16, top = 32, bottom = 32;
    const notes = [];
    let lo = Infinity, hi = -Infinity;
    for (const e of q.events) {
      if (e.voice.click !== undefined) continue;
      for (const f of e.freqs) {
        const m = Math.round(S.midiOf(f));
        notes.push({ e, m });
        lo = Math.min(lo, m); hi = Math.max(hi, m);
      }
    }
    const total = Math.max(0.1, S.totalSeconds(q.events));
    const xOf = (t) => padX + (t / total) * (w - 2 * padX);
    const el = S.elapsed();
    const rows = notes.length ? hi - lo + 1 : 1;
    const areaH = hgt - top - bottom;
    const rowH = clamp(areaH / Math.max(rows, 6), 3, 10);
    const y0 = top + (areaH - rows * rowH) / 2;

    for (const { e, m } of notes) {
      let alpha = 0.55 + 0.45 * clamp(e.vol, 0, 1);
      let fill = COLOURS.fg;
      if (el != null) {
        if (el >= e.start && el <= e.start + e.dur + 0.05) { fill = COLOURS.accent; alpha = 1; }
        else if (el < e.start) alpha *= 0.45;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      const x = xOf(e.start), wd = Math.max(4, xOf(e.start + e.dur) - x - 2);
      ctx.beginPath();
      ctx.roundRect(x, y0 + (hi - m) * rowH, wd, Math.max(3, rowH - 1), 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLOURS.dim;
    ctx.fillRect(padX, hgt - 20, w - 2 * padX, 1);
    for (const e of q.events) {
      if (e.voice.click === undefined) continue;
      ctx.fillStyle = el != null && el >= e.start && el <= e.start + 0.12 ? COLOURS.accent : COLOURS.fg;
      ctx.fillRect(xOf(e.start), hgt - (e.voice.click ? 20 : 16), 2, e.voice.click ? 14 : 10);
    }
    if (el != null) {
      ctx.fillStyle = COLOURS.accent;
      ctx.fillRect(clamp(xOf(el), padX, w - padX) - 1, top - 8, 2, hgt - top - 4);
    }
  }

  function drawStage() {
    const cv = document.getElementById("stage");
    if (!cv) return;
    const dpr = g.devicePixelRatio || 1;
    const w = cv.clientWidth, hgt = cv.clientHeight;
    if (!w || !hgt) return;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(hgt * dpr)) {
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(hgt * dpr);
    }
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const s = state.session;
    if (!s || state.screen !== "question") return;
    drawStave(ctx, w, hgt);
    if (s.revealed) drawRoll(ctx, w, hgt, s.questions[s.index]);
    else drawMeter(ctx, w, hgt);
  }

  // ---------- live status (stage corner) and exam clock, driven by the animation loop ----------
  function updateStatus() {
    const playing = S.elapsed() != null;
    const st = document.getElementById("stage-state");
    if (st) {
      const s = state.session;
      const label = playing ? "Playing" : s && s.revealed ? "Stopped" : "Silent";
      if (st.textContent !== label) st.textContent = label;
      st.classList.toggle("live", playing);
    }
    const s = state.session;
    const clock = document.getElementById("clock");
    if (clock && s && s.deadline) {
      const left = s.deadline - Date.now();
      const text = fmtClock(left);
      if (clock.textContent !== text) clock.textContent = text;
      clock.classList.toggle("low", left < 5 * 60000);
      if (left <= 0) finishMock(true);
    }
  }

  let wasPlaying = false;
  function tick() {
    const playing = S.isPlaying();
    if (playing || wasPlaying) drawStage();
    updateStatus();
    wasPlaying = playing;
    g.requestAnimationFrame(tick);
  }

  // ---------- screens ----------
  function topicRow(c) {
    const st = P.stat(c.key);
    return h("li", { class: "topic" },
      h("span", { class: "pc" }, c.pc),
      h("div", { class: "topic-text" }, h("h4", null, c.name), h("p", null, c.blurb)),
      h("div", { class: "topic-score" },
        meter(st.percent || 0, `${c.name} accuracy`),
        h("span", null, st.attempts ? `${st.percent}% of ${st.attempts}` : "Not tried")),
      h("button", { class: "btn", "aria-label": `Practise ${c.name}`, onclick: () => startSession("practice", c.key, [generate(c.key)]) }, "Practise"));
  }

  function outcomeSection(o, last) {
    const result = last && last.outcomes && last.outcomes.find((x) => x[0] === o.n);
    return h("section", { class: "outcome" },
      h("header", null,
        h("div", null, h("p", { class: "meta" }, `Outcome ${o.n}`), h("h3", null, o.name)),
        h("p", { class: "meta cut" }, `Pass mark ${o.pass} of ${o.marks}`,
          result && h("span", { class: result[1] >= o.pass ? "ok" : "no" }, ` · last paper ${result[1]}/${result[2]}`))),
      h("ul", { class: "topics" }, CATEGORIES.filter((c) => c.outcome === o.n).map(topicRow)));
  }

  function homeScreen() {
    const mocks = P.mocks();
    const last = mocks.length ? mocks[mocks.length - 1] : null;
    const live = P.setting("live");
    const pref = P.setting("inst");
    const instOptions = [["mixed", "Mixed"], ...S.ORDER.map((k) => [k, S.INSTRUMENTS[k].name])];
    const total = CATEGORIES.reduce((n, c) => n + c.mock, 0);

    return h("div", { class: "home" },
      h("div", { class: "lead" },
        h("h2", null, "Aural Skills, SCQF level 5"),
        h("p", null, "Identify intervals, scales, chords and rhythms by ear. Practise each outcome, then sit a timed paper marked the way the unit is marked.")),
      h("div", { class: "split" },
        h("section", { class: "panel exam" },
          h("p", { class: "meta" }, "Mock exam"),
          h("h3", null, `${total} questions, ${EXAM_MINUTES} minutes, closed book`),
          h("p", null, `Each outcome is marked on its own. Fail one and you resit only that section. Each sound can be played ${MAX_PLAYS} times.`),
          h("dl", { class: "marks" }, OUTCOMES.map((o) =>
            h("div", null, h("dt", null, `Outcome ${o.n}`), h("dd", null, `${o.pass}`, h("span", null, `/${o.marks}`))))),
          h("div", { class: "row" },
            h("button", { class: "btn primary", onclick: () => startMock() }, "Start mock exam"),
            h("button", { class: "switch", id: "live", role: "switch", "aria-checked": String(live), onclick: () => { P.setSetting("live", !live); render(); } },
              h("span", { class: "box" }), "Show answers as I go")),
          h("p", { class: "note" }, last
            ? `Last paper ${last.score}/${last.total} on ${fmtDate(last.when)}`
            : "No mock exam taken yet")),
        h("aside", { class: "panel dates" },
          h("p", { class: "meta" }, "Key dates"),
          h("ol", null, DATES.map(([d, t]) => h("li", null, h("time", null, d), h("span", null, t)))),
          h("p", { class: "note" }, "100% attendance is required. Two attempts are allowed at each outcome."))),
      h("div", { class: "settings" },
        h("h2", { class: "section-title" }, "Practise by outcome"),
        h("label", { class: "meta lbl", for: "inst" }, "Instrument",
          h("select", { class: "field", id: "inst", onchange: (e) => { P.setSetting("inst", e.target.value); render(); } },
            instOptions.map(([k, name]) => h("option", { value: k, selected: k === pref }, name))))),
      OUTCOMES.map((o) => outcomeSection(o, last)));
  }

  function strip(s) {
    const blocks = [];
    if (s.mode === "mock") {
      for (let i = 0; i < s.questions.length; i++) {
        let cls = "blk";
        if (s.log[i] !== undefined) cls += s.live ? (s.log[i] ? " ok" : " no") : " done";
        if (i === s.index) cls += " cur";
        blocks.push(h("div", { class: cls }));
      }
    } else {
      const recent = s.history.slice(-19);
      recent.forEach((ok) => blocks.push(h("div", { class: "blk " + (ok ? "ok" : "no") })));
      blocks.push(h("div", { class: "blk cur" }));
      while (blocks.length < 20) blocks.push(h("div", { class: "blk" }));
    }
    return h("div", { class: "strip", "aria-hidden": "true" }, blocks);
  }

  function hud(s) {
    const mock = s.mode === "mock";
    const pct = s.answered ? `${P.pct(s.correct, s.answered)}%` : "-";
    const plays = `${Math.min(s.playsUsed, MAX_PLAYS)}/${MAX_PLAYS}`;
    const clock = h("div", null, h("div", { class: "k" }, "Time left"), h("div", { class: "v", id: "clock" }, fmtClock(s.deadline - Date.now())));
    let cells;
    if (!mock) cells = [["Score", `${s.correct}/${s.answered}`], ["Accuracy", pct], ["Streak", s.streak], ["Best streak", s.best]];
    else if (s.live) cells = [["Score", `${s.correct}/${s.answered}`], ["Accuracy", pct], ["Plays used", plays], clock];
    else cells = [["Answered", `${s.answered}/${s.questions.length}`], ["Plays used", plays], clock];
    return h("div", { class: "hud", "aria-live": "off" }, cells.map((c) => c.nodeType ? c :
      h("div", null, h("div", { class: "k" }, c[0]), h("div", { class: "v" + (c[0] === "Streak" && c[1] >= 3 ? " ok" : "") }, c[1]))));
  }

  function questionScreen() {
    const s = state.session;
    const q = s.questions[s.index];
    const mock = s.mode === "mock";
    const cat = byKey(q.category);
    const o = outcomeOf(q.outcome);
    const playing = S.isPlaying();
    const canPlay = !mock || s.playsUsed < MAX_PLAYS;
    const ok = s.selected === q.correct;
    const last = s.index + 1 === s.questions.length;

    return h("div", { class: "panel quiz" },
      state.audioError && h("div", { class: "alert", role: "alert" }, "Sound could not start. Check your volume and that this browser allows audio, then press Play again."),
      h("div", { class: "qtop" },
        h("p", { class: "meta" }, `Outcome ${o.n} · ${cat.name}`, mock ? ` · ${s.live ? "answers shown" : "exam conditions"}` : " · practice"),
        h("p", { class: "meta" }, mock ? `Question ${s.index + 1} of ${s.questions.length}` : `Instrument: ${S.INSTRUMENTS[q.inst].name}`)),
      strip(s),
      hud(s),
      h("h2", { class: "prompt" }, q.prompt),
      h("div", { class: "stage" },
        h("canvas", { id: "stage", "aria-hidden": "true" }),
        h("div", { class: "tl" }, s.revealed ? "Note roll" : "Level"),
        h("div", { class: "tr" + (playing ? " live" : ""), id: "stage-state" }, playing ? "Playing" : (s.revealed ? "Stopped" : "Silent"))),
      h("div", { class: "playrow" },
        h("button", { class: "btn primary", id: "play", disabled: !canPlay || playing, onclick: replay },
          playing ? "Playing" : !canPlay ? "No plays left" : "Play again"),
        mock && h("span", { class: "meta" }, `Heard ${Math.min(s.playsUsed, MAX_PLAYS)} of ${MAX_PLAYS} times`)),
      h("div", { class: "options", role: "group", "aria-label": "Answer choices" }, q.options.map((opt, i) => {
        let cls = "opt";
        if (s.revealed) cls += i === q.correct ? " right" : s.selected === i ? " wrong" : " dimmed";
        else if (s.selected === i) cls += " sel";
        return h("button", { class: cls, "aria-pressed": String(s.selected === i), disabled: s.revealed, onclick: () => select(i) },
          h("span", { class: "num" }, i < 9 ? String(i + 1) : ""), h("span", { class: "txt" }, opt));
      })),
      mock && !s.live
        ? h("div", { class: "actions" },
            h("button", { class: "btn primary", disabled: s.selected == null, onclick: submitMock },
              last ? "Submit paper" : "Lock in and continue"))
        : s.revealed && h("div", { class: "feedback " + (ok ? "good" : "bad"), role: "status" },
            h("p", { class: "verdict" }, ok ? "Correct" : "Not quite"),
            !ok && h("p", null, `The answer was ${q.options[q.correct]}`),
            h("p", { class: "why" }, q.explanation),
            h("div", { class: "actions" },
              h("button", { class: "btn primary", id: "next", onclick: advance },
                mock && last ? "See results" : "Next question"))),
      h("p", { class: "keys" }, h("kbd", null, "R"), " replay", h("kbd", null, "1-9"), " choose", h("kbd", null, "Enter"), mock && !s.live ? " lock in" : " continue"));
  }

  function resultsScreen() {
    const sum = state.summary;
    const failed = sum.sections.filter((x) => !x.pass);
    const passed = failed.length === 0;
    const allFailed = sum.full && failed.length === sum.sections.length;
    const startAgain = () => startMock(failed.map((x) => x.o.n));
    return h("div", { class: "panel results" },
      h("p", { class: "meta" }, sum.full ? "Mock exam result" : "Resit result"),
      h("h2", null, passed ? "All sections passed" : failed.length === 1 ? "One section to resit" : `${failed.length} sections to resit`),
      sum.timedOut && h("p", { class: "note" }, "Time ran out. Unanswered questions scored nothing."),
      h("div", { class: "sections" }, sum.sections.map((x) =>
        h("div", { class: "sec " + (x.pass ? "pass" : "fail") },
          h("div", null, h("p", { class: "meta" }, `Outcome ${x.o.n}`), h("h3", null, x.o.name)),
          h("div", { class: "sec-score" },
            h("strong", null, `${x.score}`, h("span", null, `/${x.total}`)),
            h("span", { class: "meta" }, `Pass mark ${x.o.pass} · ${x.pass ? "passed" : "not yet"}`))))),
      h("p", { class: "advice" }, passed
        ? "Every outcome met its pass mark. The real paper is closed book, so keep practising without the crib sheet."
        : allFailed
          ? "All three outcomes are below the pass mark, so an alternative paper is the right next step. Use the button below for a fresh one."
          : `Below the pass mark: ${failed.map((x) => `Outcome ${x.o.n}`).join(" and ")}. You only need to resit ${failed.length === 1 ? "that section" : "those sections"}.`),
      sum.sections.some((x) => x.missed.length) && h("div", { class: "missed" },
        h("h3", { class: "section-title" }, "Questions you missed"),
        sum.sections.flatMap((x) => x.missed.map((m) =>
          h("details", null,
            h("summary", null, h("span", { class: "meta" }, `Outcome ${x.o.n}`), byKey(m.q.category).name),
            h("p", null, m.q.prompt),
            h("p", { class: "no" }, m.chosen == null ? "You did not answer" : `You answered ${m.q.options[m.chosen]}`),
            h("p", { class: "ok" }, `Correct answer: ${m.q.options[m.q.correct]}`),
            h("p", null, m.q.explanation),
            h("button", { class: "btn small", onclick: () => playEvents(m.q.events) }, "Hear it again"))))),
      h("div", { class: "actions" },
        passed
          ? h("button", { class: "btn primary", onclick: () => startMock() }, "Sit another paper")
          : h("button", { class: "btn primary", onclick: allFailed ? () => startMock() : startAgain },
              allFailed ? "Start alternative paper" : "Resit failed sections"),
        h("button", { class: "btn", onclick: () => go("home") }, "Back to practice")));
  }

  function groupsScreen() {
    const groups = P.setting("groups");
    const save = (list) => { P.setSetting("groups", list); render(); };
    const add = (e) => {
      e.preventDefault();
      const f = e.target;
      const name = f.elements.name.value.trim();
      const outcomes = OUTCOMES.map((o) => o.n).filter((n) => f.elements["o" + n].checked);
      if (!name || !outcomes.length) return;
      save([...groups, { id: String(Date.now()), name, outcomes, scale: Number(f.elements.scale.value) }]);
    };
    return h("div", { class: "groups" },
      h("div", { class: "lead" },
        h("h2", null, "Groups"),
        h("p", null, "Set up the group Patrick puts you in. Each group gets its own test, made from the outcomes it covers and marked the same way as the mock exam.")),
      groups.length === 0 && h("p", { class: "note" }, "No groups yet. Add one below."),
      h("div", { class: "group-list" }, groups.map((gr) => {
        const count = gr.outcomes.reduce((n, o) => n + CATEGORIES.filter((c) => c.outcome === o)
          .reduce((m, c) => m + (gr.scale < 1 ? Math.max(1, Math.round(c.mock * gr.scale)) : c.mock), 0), 0);
        return h("article", { class: "panel group-card" },
          h("div", null,
            h("h3", null, gr.name),
            h("p", { class: "meta" }, `${gr.outcomes.map((n) => `Outcome ${n}`).join(", ")} · ${count} questions · ${minutesFor(count)} minutes`),
            h("p", { class: "note" }, gr.last
              ? `Last test ${gr.last.score}/${gr.last.total} on ${fmtDate(gr.last.when)}: ${gr.last.sections.map(([n, sc, t]) => `O${n} ${sc}/${t}`).join(", ")}`
              : "No test taken yet")),
          h("div", { class: "row" },
            h("button", { class: "btn primary", onclick: () => startMock(gr.outcomes, gr.scale, gr.id) }, "Start test"),
            h("button", { class: "btn", onclick: () => save(groups.filter((x) => x.id !== gr.id)) }, "Remove")));
      })),
      h("form", { class: "panel group-form", onsubmit: add },
        h("h3", null, "Add a group"),
        h("label", { class: "meta" }, "Group name", h("input", { class: "field text", name: "name", required: true, maxlength: 40, placeholder: "Group A" })),
        h("fieldset", null, h("legend", { class: "meta" }, "Outcomes in this group's test"),
          OUTCOMES.map((o) => h("label", { class: "check" }, h("input", { type: "checkbox", name: "o" + o.n, checked: true }), `Outcome ${o.n}: ${o.name}`))),
        h("label", { class: "meta" }, "Length",
          h("select", { class: "field", name: "scale" },
            h("option", { value: "1" }, "Full length"), h("option", { value: "0.5" }, "Short, about half"))),
        h("div", { class: "actions" }, h("button", { class: "btn primary", type: "submit" }, "Add group"))));
  }

  function cribScreen() {
    return h("div", { class: "crib" },
      h("div", { class: "lead" },
        h("h2", null, "Crib sheet"),
        h("p", null, "Revision reference for the three outcomes. Intervals and chords can start on any note. The exam itself is closed book.")),
      OUTCOMES.map((o) => h("section", { class: "outcome" },
        h("header", null, h("div", null, h("p", { class: "meta" }, `Outcome ${o.n}`), h("h3", null, o.name))),
        h("div", { class: "crib-grid" }, AT.crib.filter((c) => c.outcome === o.n).map((c) =>
          h("article", { class: "panel" },
            h("h4", null, c.title),
            h("table", { class: "t" },
              h("thead", null, h("tr", null, c.head.map((x) => h("th", null, x)))),
              h("tbody", null, c.rows.map((r) => h("tr", null, r.map((x) => h("td", null, x)))))),
            c.note && h("p", { class: "note" }, c.note)))))));
  }

  function progressScreen() {
    const mocks = P.mocks();
    return h("div", { class: "panel progress" },
      h("h2", null, "Your progress"),
      h("p", { class: "note" }, "Accuracy per topic across practice and mock exams. The tick marks the 70% pass line."),
      !P.storageOk() && h("div", { class: "alert" }, "This browser is blocking storage, so progress will be lost when you close the page."),
      OUTCOMES.map((o) => h("div", null,
        h("p", { class: "meta group" }, `Outcome ${o.n} · ${o.name}`),
        h("table", { class: "t" }, h("tbody", null, CATEGORIES.filter((c) => c.outcome === o.n).map((c) => {
          const st = P.stat(c.key);
          return h("tr", null, h("td", null, c.name), h("td", { class: "bar-cell" }, meter(st.percent || 0, `${c.name} accuracy`)),
            h("td", { class: "num" }, st.attempts ? `${st.correct}/${st.attempts}` : "No data"));
        }))))),
      h("h3", { class: "section-title" }, "Mock exam history"),
      mocks.length === 0 && h("p", { class: "note" }, "No mock exams completed yet"),
      h("div", { class: "hist" }, mocks.slice(-10).reverse().map((m, i) => {
        const parts = (m.outcomes || []).map(([n, sc, tot]) => {
          const o = outcomeOf(n);
          return h("span", { class: sc >= o.pass ? "ok" : "no" }, `O${n} ${sc}/${tot}`);
        });
        return h("div", null, h("time", null, fmtDate(m.when)), h("strong", null, `${m.score}/${m.total}`), h("span", { class: "parts" }, parts));
      })),
      mocks.length > 10 && h("p", { class: "note" }, `Showing the latest 10 of ${mocks.length}`),
      h("div", { class: "actions" }, state.confirmReset
        ? [h("span", { class: "no", style: "align-self:center" }, "This permanently deletes all saved results."),
           h("button", { class: "btn danger", onclick: () => { P.reset(); state.confirmReset = false; render(); } }, "Delete everything"),
           h("button", { class: "btn", onclick: () => { state.confirmReset = false; render(); } }, "Cancel")]
        : h("button", { class: "btn", onclick: () => { state.confirmReset = true; render(); } }, "Reset progress")));
  }

  // ---------- render + input ----------
  function updateChrome() {
    const navOn = state.screen === "progress" ? "progress" : state.screen === "crib" ? "crib" : state.screen === "groups" ? "groups" : "home";
    document.querySelectorAll("[data-nav]").forEach((b) => b.classList.toggle("on", b.dataset.nav === navOn));
    const pref = P.setting("inst");
    const info = [
      P.storageOk() ? "Saved in this browser" : "Storage blocked",
      `Instrument: ${pref === "mixed" ? "mixed" : S.INSTRUMENTS[pref].name}`,
    ].join(" · ");
    const node = document.getElementById("foot-info");
    if (node && node.textContent !== info) node.textContent = info;
  }

  function render() {
    const screens = { home: homeScreen, question: questionScreen, results: resultsScreen, progress: progressScreen, crib: cribScreen, groups: groupsScreen };
    const active = document.activeElement;
    const inRoot = active && root.contains(active);
    const activeId = inRoot && active.id ? active.id : null;
    const label = inRoot && !activeId && active.tagName === "BUTTON" ? active.textContent : null;
    try {
      root.replaceChildren(screens[state.screen]());
    } catch (err) {
      root.replaceChildren(h("div", { class: "alert", role: "alert" }, `This page could not load: ${err && err.message}. Try a hard refresh (Ctrl+Shift+R) and tell the developer this message.`));
    }
    if (activeId) {
      const el = document.getElementById(activeId);
      if (el && !el.disabled) el.focus({ preventScroll: true });
    } else if (label) {
      const again = [...root.querySelectorAll("button:not(:disabled)")].find((b) => b.textContent === label);
      if (again) again.focus({ preventScroll: true });
    }
    updateChrome();
    updateStatus();
    drawStage();
  }

  document.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => go(b.dataset.nav)));

  document.addEventListener("keydown", (e) => {
    if (state.screen !== "question" || !state.session || e.ctrlKey || e.metaKey || e.altKey) return;
    const onButton = e.target && e.target.tagName === "BUTTON";
    const onOption = onButton && e.target.classList.contains("opt");
    if (e.key === "r" || e.key === "R") { e.preventDefault(); replay(); }
    else if (/^[1-9]$/.test(e.key)) { select(Number(e.key) - 1); }
    else if (e.key === "Enter") {
      const chosen = onOption && e.target.getAttribute("aria-pressed") === "true";
      if (!onButton || chosen) { e.preventDefault(); advance(); }
    }
  });

  g.addEventListener("resize", drawStage);

  AT.app = { state, render };
  render();
  g.requestAnimationFrame(tick);
})(window);
