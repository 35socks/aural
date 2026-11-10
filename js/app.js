/* UI: renders screens and handles input. State changes go through the small functions below. */
(function (g) {
  const AT = g.AT;
  const { CATEGORIES, byKey, generate, mockTest } = AT.exercises;
  const P = AT.progress;
  const MAX_PLAYS = 3;
  const MOCK_PER_CATEGORY = 2;

  const root = document.getElementById("app");
  const state = { screen: "home", session: null, summary: null, confirmReset: false, audioError: false };

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
  const bar = (percent) => h("div", { class: "bar-track", role: "progressbar", "aria-valuenow": percent, "aria-valuemin": 0, "aria-valuemax": 100 },
    h("div", { class: "bar-fill", style: `width:${percent}%` }));

  // ---------- audio ----------
  function playEvents(events) {
    if (!AT.synth.supported()) { state.audioError = true; return; }
    const secs = AT.synth.play(events, () => { if (state.screen === "question") render(); });
    if (!secs) state.audioError = true;
  }

  // ---------- state changes ----------
  function go(screen) {
    AT.synth.stop();
    state.screen = screen;
    state.confirmReset = false;
    if (screen === "home") state.session = null;
    render();
  }

  function startSession(mode, cat, questions) {
    state.session = { mode, cat, questions, index: 0, selected: null, revealed: false, answers: [], playsUsed: 0, correct: 0, answered: 0 };
    state.screen = "question";
    startQuestion();
  }

  function startQuestion() {
    const s = state.session;
    s.selected = null;
    s.revealed = false;
    s.playsUsed = 1;
    playEvents(s.questions[s.index].events); // counts as the first play
    render();
  }

  function replay() {
    const s = state.session;
    if (!s || (s.mode === "mock" && s.playsUsed >= MAX_PLAYS)) return;
    s.playsUsed++;
    playEvents(s.questions[s.index].events);
    render();
  }

  function select(i) {
    const s = state.session;
    if (!s || s.revealed) return;
    const q = s.questions[s.index];
    if (i < 0 || i >= q.options.length) return;
    s.selected = i;
    if (s.mode === "practice") {
      const ok = i === q.correct;
      s.revealed = true;
      s.answered++;
      if (ok) s.correct++;
      P.record(q.category, ok);
    }
    render();
  }

  function submitMock() {
    const s = state.session;
    if (!s || s.mode !== "mock" || s.selected == null) return;
    const q = s.questions[s.index];
    const ok = s.selected === q.correct;
    s.answers.push(s.selected);
    s.answered++;
    if (ok) s.correct++;
    P.record(q.category, ok);
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

  function finishMock() {
    AT.synth.stop();
    const s = state.session;
    const per = CATEGORIES.map((c) => ({ cat: c, correct: 0, total: 0 }));
    const missed = [];
    s.questions.forEach((q, i) => {
      const ok = s.answers[i] === q.correct;
      const row = per.find((r) => r.cat.key === q.category);
      row.total++;
      if (ok) row.correct++; else missed.push({ q, chosen: s.answers[i] });
    });
    P.recordMock(s.correct, s.questions.length);
    state.summary = { score: s.correct, total: s.questions.length, per, missed };
    state.session = null;
    state.screen = "results";
    render();
  }

  // ---------- screens ----------
  function homeScreen() {
    const last = P.mocks().slice(-1)[0];
    return h("div", null,
      h("p", null, "Check how ready your listening skills are for the aural side of HNC Music entry. Headphones recommended."),
      h("section", { class: "card" },
        h("h2", { style: "margin-top:0" }, "Entry check"),
        h("p", null, `${CATEGORIES.length * MOCK_PER_CATEGORY} questions, ${MOCK_PER_CATEGORY} from every topic. Each question can be heard up to ${MAX_PLAYS} times, and answers are only revealed at the end, like an exam. Aim for ${P.PASS_MARK}% or more.`),
        h("div", { class: "row" },
          h("button", { class: "btn primary", onclick: () => startSession("mock", null, mockTest(MOCK_PER_CATEGORY)) }, "Start entry check"),
          last && h("span", { class: "muted" }, `Last attempt: ${last.score}/${last.total} (${last.percent}%)`))),
      h("h2", null, "Practise a topic"),
      h("p", { class: "muted", style: "margin-top:0" }, "Instant feedback and unlimited replays."),
      h("div", { class: "grid" }, CATEGORIES.map((c) => {
        const st = P.stat(c.key);
        return h("article", { class: "card topic" },
          h("h3", null, c.name),
          h("div", { class: "muted small-text" }, c.blurb),
          h("div", null, st.percent == null ? "Not tried yet" : `${st.percent}% over ${st.attempts} answers`),
          h("button", { class: "btn", onclick: () => startSession("practice", c.key, [generate(c.key)]) }, "Practise"));
      })));
  }

  function questionScreen() {
    const s = state.session;
    const q = s.questions[s.index];
    const mock = s.mode === "mock";
    const cat = byKey(q.category);
    const playing = AT.synth.isPlaying();
    const canPlay = !mock || s.playsUsed < MAX_PLAYS;
    const ok = s.selected === q.correct;

    return h("div", null,
      state.audioError && h("div", { class: "alert", role: "alert" }, "Sound could not start. Check your volume and that this browser allows audio, then press Play again."),
      h("div", { class: "qhead" },
        h("strong", null, cat.name),
        h("span", { class: "muted" }, mock ? `Question ${s.index + 1} of ${s.questions.length}` : `${s.correct} correct of ${s.answered} answered`)),
      mock && bar(Math.round((s.index / s.questions.length) * 100)),
      h("p", { class: "prompt" }, q.prompt),
      h("div", { class: "playrow" },
        h("button", { class: "btn", disabled: !canPlay || playing, onclick: replay }, playing ? "Playing..." : (s.playsUsed === 0 ? "Play" : "Play again (R)")),
        mock && h("span", { class: "muted" }, `Heard ${Math.min(s.playsUsed, MAX_PLAYS)} of ${MAX_PLAYS} times`)),
      h("div", { class: "options", role: "group", "aria-label": "Answer choices" }, q.options.map((opt, i) => {
        let cls = "btn opt";
        if (s.revealed) cls += i === q.correct ? " right" : (s.selected === i ? " wrong" : "");
        else if (s.selected === i) cls += " sel";
        return h("button", { class: cls, "aria-pressed": s.selected === i, disabled: s.revealed, onclick: () => select(i) },
          h("span", { class: "num" }, i < 9 ? String(i + 1) : ""), h("span", null, opt));
      })),
      mock
        ? h("div", { class: "actions" },
            h("button", { class: "btn primary", disabled: s.selected == null, onclick: submitMock },
              s.index + 1 === s.questions.length ? "Submit and see results" : "Lock in answer and continue"))
        : s.revealed && h("div", { class: "feedback", role: "status" },
            h("div", { class: "verdict " + (ok ? "ok" : "no") }, ok ? "Correct!" : `Not quite. The answer was: ${q.options[q.correct]}`),
            h("p", null, q.explanation),
            h("div", { class: "actions" }, h("button", { class: "btn primary", onclick: nextPractice }, "Next question (Enter)"))),
      h("p", { class: "muted small-text" }, "Keys: ", h("span", { class: "kbd" }, "R"), " replay, ", h("span", { class: "kbd" }, "1-9"), " choose, ", h("span", { class: "kbd" }, "Enter"), mock ? " continue" : " next question"));
  }

  function resultsScreen() {
    const sum = state.summary;
    const pct = P.pct(sum.score, sum.total);
    const pass = pct >= P.PASS_MARK;
    const weak = sum.per.filter((r) => r.correct < r.total)
      .sort((a, b) => a.correct / a.total - b.correct / b.total).slice(0, 3);
    return h("div", null,
      h("h2", { style: "margin-top:0" }, "Entry check results"),
      h("div", { class: "score " + (pass ? "ok" : "no") }, `${sum.score} / ${sum.total}  (${pct}%)`),
      h("p", null, pass
        ? `You are above the ${P.PASS_MARK}% self-check target. Keep practising the topics marked below to stay sharp.`
        : `Below the ${P.PASS_MARK}% self-check target. Practise the weakest topics below, then try the entry check again.`),
      h("h3", { style: "margin-top:16px" }, "By topic"),
      h("table", { class: "t" }, h("tbody", null, sum.per.map((r) =>
        h("tr", null, h("td", null, r.cat.name), h("td", { class: "bar-cell" }, bar(P.pct(r.correct, r.total))), h("td", null, `${r.correct}/${r.total}`))))),
      weak.length > 0 && h("div", null,
        h("h3", { style: "margin-top:16px" }, "Revise these first"),
        weak.map((r) => h("div", { class: "row", style: "margin:6px 0" },
          h("span", null, r.cat.name),
          h("button", { class: "btn small", onclick: () => startSession("practice", r.cat.key, [generate(r.cat.key)]) }, "Practise")))),
      sum.missed.length > 0 && h("div", null,
        h("h3", { style: "margin-top:16px" }, `Questions you missed (${sum.missed.length})`),
        sum.missed.map((m, i) => h("details", null,
          h("summary", null, `${i + 1}. ${byKey(m.q.category).name}`),
          h("p", null, m.q.prompt),
          h("p", { class: "no" }, `You answered: ${m.q.options[m.chosen]}`),
          h("p", { class: "ok" }, `Correct answer: ${m.q.options[m.q.correct]}`),
          h("p", null, m.q.explanation),
          h("button", { class: "btn small", onclick: () => playEvents(m.q.events) }, "Hear it again")))),
      h("div", { class: "actions" },
        h("button", { class: "btn primary", onclick: () => startSession("mock", null, mockTest(MOCK_PER_CATEGORY)) }, "Retake entry check"),
        h("button", { class: "btn", onclick: () => go("home") }, "Back to home")));
  }

  function progressScreen() {
    const mocks = P.mocks();
    return h("div", null,
      h("h2", { style: "margin-top:0" }, "Your progress"),
      h("p", { class: "muted" }, "Accuracy per topic across all practice and entry checks. Saved in this browser only."),
      !P.storageOk() && h("div", { class: "alert" }, "This browser is blocking storage, so progress will be lost when you close the page."),
      h("table", { class: "t" }, h("tbody", null, CATEGORIES.map((c) => {
        const st = P.stat(c.key);
        return h("tr", null, h("td", null, c.name), h("td", { class: "bar-cell" }, bar(st.percent || 0)),
          h("td", null, st.attempts ? `${st.correct}/${st.attempts} correct` : "no data"));
      }))),
      h("h3", { style: "margin-top:18px" }, "Entry check history"),
      mocks.length === 0 && h("p", { class: "muted" }, "No entry checks completed yet."),
      mocks.slice(-10).reverse().map((m, i) => h("div", null,
        `Check #${mocks.length - i}: `, h("strong", { class: m.percent >= P.PASS_MARK ? "ok" : "no" }, `${m.score}/${m.total} (${m.percent}%)`),
        " ", h("span", { class: "muted" }, new Date(m.when).toLocaleDateString("en-GB")))),
      mocks.length > 10 && h("p", { class: "muted small-text" }, `(showing latest 10 of ${mocks.length})`),
      h("div", { class: "actions" }, state.confirmReset
        ? [h("span", { class: "no" }, "This permanently deletes all saved results."),
           h("button", { class: "btn danger", onclick: () => { P.reset(); state.confirmReset = false; render(); } }, "Yes, delete everything"),
           h("button", { class: "btn", onclick: () => { state.confirmReset = false; render(); } }, "Cancel")]
        : h("button", { class: "btn", onclick: () => { state.confirmReset = true; render(); } }, "Reset progress")));
  }

  // ---------- render + input ----------
  function render() {
    const screens = { home: homeScreen, question: questionScreen, results: resultsScreen, progress: progressScreen };
    // Keep keyboard focus on the same-labelled button across re-renders.
    const active = document.activeElement;
    const label = active && root.contains(active) && active.tagName === "BUTTON" ? active.textContent : null;
    root.replaceChildren(screens[state.screen]());
    if (label) {
      const again = [...root.querySelectorAll("button:not(:disabled)")].find((b) => b.textContent === label);
      if (again) again.focus({ preventScroll: true });
    }
  }

  document.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => go(b.dataset.nav)));

  document.addEventListener("keydown", (e) => {
    if (state.screen !== "question" || !state.session || e.ctrlKey || e.metaKey || e.altKey) return;
    const s = state.session;
    const onButton = e.target && e.target.tagName === "BUTTON";
    if (e.key === "r" || e.key === "R") { e.preventDefault(); replay(); }
    else if (/^[1-9]$/.test(e.key)) { select(Number(e.key) - 1); }
    else if (e.key === "Enter" && !onButton) {
      if (s.mode === "mock") submitMock(); else nextPractice();
    }
  });

  AT.app = { state, render }; // exposed for debugging and tests
  render();
})(window);
