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

  const PAGE = document.body.dataset.page || "home";
  const root = document.getElementById("app");
  const EXTRA = () => AT.extraScreens || {};
  const fromHash = ["crib", "progress", "lessons", ...Object.keys(EXTRA())].includes(g.location.hash.slice(1)) && g.location.hash.slice(1) !== "drill" ? g.location.hash.slice(1) : "home";
  const SUBPAGES = ["groups", "learning"];
  const state = { drill: null, lesson: null, run: null, screen: SUBPAGES.includes(PAGE) ? PAGE : fromHash, session: null, summary: null, confirmReset: false, audioError: false };
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
    // Groups is its own page at /groups/; everything else lives on the main page.
    if (SUBPAGES.includes(screen) && PAGE !== screen) { g.location.href = (PAGE === "home" ? "" : "../") + screen + "/"; return; }
    if (SUBPAGES.includes(PAGE) && screen !== PAGE && screen !== "question") {
      g.location.href = "../" + (screen === "home" ? "" : "#" + screen);
      return;
    }
    state.screen = screen;
    state.lesson = null;
    state.run = null;
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
    AT.plus.onAnswer(q, ok, s);
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
    AT.plus.onAnswer(q, ok, s);
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
    if (s.limit && s.answered >= s.limit) return AT.plus.finishDrill(s);
    const nq = s.next ? s.next() : generate(s.cat);
    if (!nq) return AT.plus.finishDrill(s);
    s.questions = [nq];
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
  let COLOURS;
  function refreshColours() {
    const cs = getComputedStyle(document.documentElement);
    const c = (n) => cs.getPropertyValue(n).trim();
    COLOURS = { fg: c("--text"), accent: c("--accent"), unlit: c("--raise"), line: c("--line-hi"), dim: c("--dim") };
    if (state.screen === "question") drawStage();
  }
  refreshColours();
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
    const total = CATEGORIES.reduce((n, c) => n + c.mock, 0);

    return h("div", { class: "home" },
      h("div", { class: "lead" },
        h("h2", null, "Aural Skills, SCQF level 5"),
        h("p", null, "Identify intervals, scales, chords and rhythms by ear. Practise each outcome, then sit a timed paper marked the way the unit is marked.")),
      AT.plus.dashboard(),
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
        h("h2", { class: "section-title" }, "Practise by outcome")),
      OUTCOMES.map((o) => outcomeSection(o, last)),
      AT.plus.extensionSection(),
      h("div", { class: "settings" }, h("h2", { class: "section-title" }, "Your own session")),
      AT.plus.builder());
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
        h("p", { class: "meta" }, `${o.ext ? "Extension" : "Outcome " + o.n} · ${cat.name}`, mock ? ` · ${s.live ? "answers shown" : "exam conditions"}` : ` · ${s.label || "practice"}`),
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
                mock && last ? "See results" : s.limit && s.answered >= s.limit ? "Finish" : "Next question"))),
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

  function learningScreen() {
    const heard = (notes) => {
      const harmonic = notes.harmonic, list = notes.harmonic || notes.melodic;
      const E = S.ev, T = AT.theory;
      playEvents(harmonic ? [E.sustained(0, 1.8, list.map(T.freq), 0.8)]
        : list.map((n, i) => E.tone(i * 0.5, i === list.length - 1 ? 1.2 : 0.55, [T.freq(n)], 0.8)));
    };
    const card = (c) => h("article", { class: "panel learn-card" },
      h("h4", null, c.name),
      h("p", null, c.body),
      c.list && h("ul", { class: "learn-list" }, c.list.map((x) => h("li", null, x))),
      c.hear && h("div", { class: "hear" }, c.hear.map(([label, notes]) => h("button", { class: "btn small", type: "button", onclick: () => heard(notes) }, "Play " + label))),
      c.tip && h("p", { class: "tip" }, h("strong", null, "Tip: "), c.tip));
    return h("div", { class: "learning" },
      h("div", { class: "lead" }, h("h2", null, AT.learningIntro.title), h("p", null, AT.learningIntro.text)),
      AT.learning.map((sec) => h("section", { class: "outcome" },
        h("header", null, h("div", null, h("p", { class: "meta" }, sec.outcome ? `Outcome ${sec.outcome}` : "Everything"), h("h3", null, sec.title))),
        h("div", { class: "crib-grid" }, sec.cards.map(card)),
        sec.recall && h("details", { class: "recall" }, h("summary", null, "Cover and recall"),
          h("p", { class: "note" }, "Cover the answer, say it out loud, then open it to check."),
          sec.recall.map(([q, a]) => h("details", null, h("summary", null, q), h("p", null, a)))))));
  }

  // ---------- lessons ----------
  const LS = AT.lessons;
  const KIT = LS.kit;
  const DAY = 86400000;
  const REVIEW_AFTER = [1, 3, 7, 21, 45]; // days between reviews, growing each time
  const lessonRecs = () => P.setting("lessons") || {};
  const checksOf = (lesson) => lesson.steps.map((st, i) => [st, i]).filter(([st]) => st.t === "check");
  function lessonStatus(l) {
    const r = lessonRecs()[l.id];
    if (!r) return { label: "Not started", cls: "", mastered: false, due: false };
    const mastered = r.score / r.total >= 0.75;
    const due = mastered && Date.now() - r.when > REVIEW_AFTER[Math.min((r.n || 1) - 1, 4)] * DAY;
    return { label: due ? `Review due (was ${r.score}/${r.total})` : mastered ? `Done ${r.score}/${r.total}` : `Try again (${r.score}/${r.total})`, cls: due ? "due" : mastered ? "ok" : "no", mastered, due };
  }
  const playSpec = (spec) => playEvents(LS.build(spec));
  function openLesson(id) {
    S.stop();
    state.lesson = id;
    state.run = { answers: {}, order: {}, finished: false };
    render();
    g.scrollTo(0, 0);
  }
  function finishLesson(lesson) {
    const checks = checksOf(lesson);
    const score = checks.filter(([st, i]) => state.run.answers[i] === st.answer).length;
    const recs = { ...lessonRecs() };
    const prev = recs[lesson.id];
    recs[lesson.id] = { when: Date.now(), score, total: checks.length, n: (prev ? prev.n || 1 : 0) + 1 };
    P.setSetting("lessons", recs);
    state.run.finished = true;
    state.run.score = score;
    render();
    g.scrollTo(0, 0);
  }

  const RHYTHM_FOR = {
    4: [4], 2: [2, 2], 1: [1, 1, 1, 1], 0.5: Array(8).fill(0.5), 0.25: Array(16).fill(0.25),
    3: [3, 1], 1.5: [1.5, 0.5, 1.5, 0.5], 0.75: [0.75, 0.25, 0.75, 0.25, 0.75, 0.25, 0.75, 0.25],
  };
  const hearBtn = (label, spec) => h("button", { class: "btn small", type: "button", onclick: () => playSpec(spec) }, label);
  const keyEv = (m, i, gap) => S.ev.tone((i || 0) * (gap || 0), 1.3, [AT.theory.freq(m)], 0.8);

  function lessonStep(lesson, step, i) {
    const run = state.run;
    switch (step.t) {
      case "say":
        return h("section", { class: "lstep" }, step.title && h("h4", null, step.title), h("p", null, step.text),
          step.list && h("ul", { class: "learn-list" }, step.list.map((x) => h("li", null, x))));
      case "tip":
        return h("aside", { class: "ltip" }, h("strong", null, "Remember: "), step.text);
      case "hear":
        return h("section", { class: "lstep" }, step.text && h("p", null, step.text),
          h("div", { class: "hear" }, step.buttons.map(([label, spec]) => hearBtn("Play: " + label, spec))));
      case "values":
        return h("div", { class: "lvalues" }, step.items.map((it) => {
          const lens = RHYTHM_FOR[it.beats];
          const holder = h("span", { class: "nsvg" });
          holder.innerHTML = KIT.noteSvg(it.kind, it.dotted);
          return h("article", { class: "panel lvalue" }, holder, h("h4", null, it.name),
            h("p", { class: "note" }, `US name: ${it.us}`),
            h("p", { class: "lbeats" }, `${it.beats === 0.5 ? "1/2" : it.beats === 0.25 ? "1/4" : it.beats === 0.75 ? "3/4" : it.beats === 1.5 ? "1 1/2" : it.beats} ${it.beats === 1 ? "beat" : "beats"}`),
            KIT.barRow([{ len: Math.min(it.beats, 4), label: "" }], 4),
            hearBtn("Hear it", { rhythm: lens }));
        }));
      case "tree":
        return h("div", { class: "lstep" }, KIT.tree());
      case "bars":
        return h("section", { class: "lstep" }, step.caption && h("p", null, step.caption),
          step.rows.map((r) => h("div", { class: "lrow" }, h("p", { class: "meta" }, r.label), KIT.barRow(r.items), hearBtn("Hear it", r.hear))));
      case "keys": {
        const kb = KIT.keyboard(step.from, step.to, step.mark, (m) => playEvents([keyEv(m)]));
        return h("section", { class: "lstep" }, step.caption && h("p", null, step.caption), kb,
          step.mark.length > 1 && h("div", { class: "hear" },
            h("button", { class: "btn small", type: "button", onclick: () => playEvents(step.mark.map((m, k) => keyEv(m, k, 0.55))) }, "Play marked notes one by one"),
            h("button", { class: "btn small", type: "button", onclick: () => playEvents([S.ev.sustained(0, 1.8, step.mark.map(AT.theory.freq), 0.8)]) }, "Play marked notes together")));
      }
      case "check": {
        const order = run.order[i] || (run.order[i] = AT.R.shuffle(step.options.map((_, k) => k)));
        const chosen = run.answers[i];
        const answered = chosen !== undefined;
        return h("section", { class: "lcheck panel" },
          h("p", { class: "meta" }, step.review ? "Review from an earlier lesson" : "Check yourself"),
          h("h4", null, step.q),
          step.hear && h("div", { class: "hear" }, hearBtn("Play the sound", step.hear)),
          h("div", { class: "opts" }, order.map((orig, pos) => h("button", {
            class: "opt" + (answered ? (orig === step.answer ? " right" : orig === chosen ? " wrong" : "") : ""),
            type: "button", disabled: answered,
            onclick: () => { run.answers[i] = orig; render(); },
          }, h("span", { class: "num" }, String(pos + 1)), step.options[orig]))),
          answered && h("p", { class: "lwhy " + (chosen === step.answer ? "ok" : "no") }, (chosen === step.answer ? "Correct. " : "Not quite. ") + step.why));
      }
      default: return h("div");
    }
  }

  function lessonDetail(lesson) {
    const run = state.run;
    const checks = checksOf(lesson);
    const done = checks.filter(([, i]) => run.answers[i] !== undefined).length;
    const idx = LS.LESSONS.indexOf(lesson);
    const next = LS.LESSONS[idx + 1];
    const cat = lesson.practise && byKey(lesson.practise);
    const header = h("div", { class: "lead" },
      h("button", { class: "btn small", type: "button", onclick: () => go("lessons") }, "All lessons"),
      h("p", { class: "meta", style: "margin-top:16px" }, `Lesson ${idx + 1} of ${LS.LESSONS.length} · about ${lesson.mins} minutes`),
      h("h2", null, lesson.title),
      h("p", null, h("strong", null, "By the end you can: "), lesson.goal),
      h("p", { class: "note" }, lesson.why));
    if (run.finished) {
      const pass = run.score / checks.length >= 0.75;
      return h("div", { class: "lessons" }, header,
        h("div", { class: "panel lresult" },
          h("p", { class: "meta" }, "Lesson result"),
          h("h3", null, `${run.score} of ${checks.length} correct`),
          h("p", { class: pass ? "ok" : "no" }, pass
            ? "Well done. Now make it stick: do ten practice questions today and come back to this lesson in a few days."
            : "Not yet secure. That is normal: read the explanations you missed, replay the sounds and try the lesson again."),
          h("p", { class: "meta" }, "Remember"),
          h("ul", { class: "learn-list" }, lesson.remember.map((x) => h("li", null, x))),
          h("div", { class: "row", style: "margin-top:16px" },
            cat && h("button", { class: "btn primary", onclick: () => startSession("practice", cat.key, [generate(cat.key)]) }, `Practise ${cat.name.toLowerCase()}`),
            !pass && h("button", { class: "btn", onclick: () => openLesson(lesson.id) }, "Try this lesson again"),
            next && h("button", { class: "btn", onclick: () => openLesson(next.id) }, `Next: ${next.title}`),
            h("button", { class: "btn", onclick: () => go("lessons") }, "All lessons"))));
    }
    return h("div", { class: "lessons" }, header,
      h("div", { class: "lprog" }, meter(checks.length ? Math.round((done * 100) / checks.length) : 100, "Checks answered"),
        h("span", { class: "meta" }, `${done} of ${checks.length} checks answered`)),
      lesson.steps.map((st, i) => lessonStep(lesson, st, i)),
      h("section", { class: "panel lremember" },
        h("h3", null, "Remember"),
        h("ul", { class: "learn-list" }, lesson.remember.map((x) => h("li", null, x))),
        h("div", { class: "row", style: "margin-top:16px" },
          h("button", { class: "btn primary", disabled: done < checks.length, onclick: () => finishLesson(lesson) },
            done < checks.length ? `Answer ${checks.length - done} more check${checks.length - done === 1 ? "" : "s"} to finish` : "Finish lesson"))));
  }

  function lessonsScreen() {
    if (state.lesson) {
      const lesson = LS.LESSONS.find((l) => l.id === state.lesson);
      if (lesson) return lessonDetail(lesson);
    }
    const stat = LS.LESSONS.map(lessonStatus);
    const nextIdx = stat.findIndex((s) => !s.mastered);
    const dueIdx = stat.findIndex((s) => s.due);
    const doneCount = stat.filter((s) => s.mastered).length;
    const groups = [["Rhythm and time", 0, 6], ["Pitch, intervals and scales", 6, 9], ["Chords and progressions", 10, 13], ["Exam skills", 13, 14]];
    const card = (l, i) => h("article", { class: "panel lcard" },
      h("p", { class: "meta" }, `Lesson ${i + 1} · ${l.mins} min`),
      h("h4", null, l.title),
      h("p", { class: "note" }, l.goal),
      h("div", { class: "lfoot" },
        h("span", { class: "chip " + stat[i].cls }, stat[i].label),
        h("button", { class: "btn small" + (i === nextIdx ? " primary" : ""), onclick: () => openLesson(l.id) }, stat[i].mastered ? "Revisit" : stat[i].label === "Not started" ? "Start" : "Retry")));
    return h("div", { class: "lessons" },
      h("div", { class: "lead" },
        h("h2", null, "Lessons"),
        h("p", null, "Start from nothing. These lessons assume you know no music theory: they explain what a crotchet and a minim are, what a semitone is, how chords are built, and train your ear on each idea as you go. Do them in order, 10 to 15 minutes a day.")),
      h("div", { class: "split" },
        h("section", { class: "panel" },
          h("p", { class: "meta" }, "How every lesson works"),
          h("ol", { class: "lhow" },
            h("li", null, h("strong", null, "Learn it. "), "A short explanation with a picture, one idea at a time."),
            h("li", null, h("strong", null, "Hear it. "), "Press the buttons to listen. Piano and drums play every example."),
            h("li", null, h("strong", null, "Check it. "), "Answer questions straight away, with sounds. You see why an answer is right or wrong."),
            h("li", null, h("strong", null, "Practise it. "), "Finish with real exam-style questions on the same topic."),
            h("li", null, h("strong", null, "Come back. "), "Done lessons return for review after 1, 3, 7 and 21 days. Spaced review is how you keep it."))),
        h("aside", { class: "panel" },
          h("p", { class: "meta" }, "Your progress"),
          h("h3", null, `${doneCount} of ${LS.LESSONS.length} lessons done`),
          meter(Math.round((doneCount * 100) / LS.LESSONS.length), "Lessons done"),
          dueIdx >= 0 && h("p", { class: "note" }, `Review due: ${LS.LESSONS[dueIdx].title}`),
          h("div", { class: "row", style: "margin-top:16px" }, nextIdx >= 0
            ? h("button", { class: "btn primary", onclick: () => openLesson(LS.LESSONS[dueIdx >= 0 ? dueIdx : nextIdx].id) }, dueIdx >= 0 ? "Do your review" : `Continue: ${LS.LESSONS[nextIdx].title}`)
            : h("p", { class: "ok" }, "All lessons done. Sit a mock paper.")))),
      groups.map(([title, a, b]) => h("section", { class: "outcome" },
        h("header", null, h("div", null, h("h3", null, title))),
        h("div", { class: "crib-grid" }, LS.LESSONS.slice(a, b).map((l, k) => card(l, a + k))))),
      h("section", { class: "outcome" },
        h("header", null, h("div", null, h("p", { class: "meta" }, "Suggested plan, 20 minutes a day"), h("h3", null, "Two weeks to the mock exam"))),
        h("div", { class: "crib-grid" }, LS.PLAN.map(([when, what, text]) => h("article", { class: "panel" }, h("p", { class: "meta" }, when), h("h4", null, what), h("p", { class: "note" }, text)))),
        h("p", { class: "note", style: "margin-top:16px" }, "Each day: one lesson (10 minutes), then 10 practice questions on that topic, then 2 minutes recalling yesterday's lesson without looking.")));
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
      AT.plus.insights(),
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
    const navOn = state.screen === "drill" ? "home" : NAV.some((n) => n[0] === state.screen) ? state.screen : "home";
    document.querySelectorAll("[data-nav]").forEach((b) => b.classList.toggle("on", b.dataset.nav === navOn));
    const info = [P.storageOk() ? "Saved in this browser" : "Storage blocked", "Sounds: piano and drums"].join(" · ");
    const node = document.getElementById("foot-info");
    if (node && node.textContent !== info) node.textContent = info;
  }

  function render() {
    const screens = { ...EXTRA(), home: homeScreen, question: questionScreen, results: resultsScreen, progress: progressScreen, crib: cribScreen, groups: groupsScreen, learning: learningScreen, lessons: lessonsScreen };
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

  const NAV = [["home", "Practice"], ["review", "Review"], ["lessons", "Lessons"], ["learning", "Learning"], ["groups", "Groups"], ["tools", "Tools"], ["crib", "Crib sheet"], ["progress", "Progress"], ["settings", "Settings"]];
  const navEl = document.querySelector("header nav");
  navEl.replaceChildren(...NAV.map(([k, t]) => h("button", { class: "navbtn", "data-nav": k, onclick: () => go(k) }, t)));

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

  AT.ui = { h, state, render, go, startSession, startMock, meter, chip, fmtDate, refreshColours };
  AT.app = { state, render };
  render();
  g.requestAnimationFrame(tick);
})(window);
