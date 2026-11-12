/* UI: renders screens and handles input. State changes go through the small functions below. */
(function (g) {
  const AT = g.AT;
  const { GROUPS, CATEGORIES, byKey, groupName, generate, mockTest, mockSize } = AT.exercises;
  const P = AT.progress;
  const S = AT.synth;
  const MAX_PLAYS = 3;
  const MOCK_PER_CATEGORY = 2;

  const root = document.getElementById("app");
  const state = { screen: "home", session: null, summary: null, confirmReset: false, audioError: false, query: "" };
  let playTotal = 0; // seconds of the current playback, for the status readout

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
  const tag = (text, colour) => h("span", { class: "tag" + (colour ? " " + colour : "") }, text);
  const fmtDate = (ts) => new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const pad2 = (n) => String(n).padStart(2, "0");
  const partLetter = (i) => "abcdefghij"[i];

  /** Chunky 20-block bar. */
  function seg(percent) {
    const on = Math.round(percent / 5);
    const cls = percent >= P.PASS_MARK ? "good" : "warn";
    return h("div", { class: "seg " + cls, role: "progressbar", "aria-valuenow": percent, "aria-valuemin": 0, "aria-valuemax": 100 },
      Array.from({ length: 20 }, (_, i) => h("i", { class: i < on ? "on" : "" })));
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
    if (screen === "home") state.session = null;
    render();
  }

  /** Live feedback is always on in practice; in an entry check it is the learner's choice. */
  function startSession(mode, cat, questions, live) {
    state.session = {
      mode, cat, live: mode === "practice" ? true : !!live, questions, index: 0, selected: null, revealed: false,
      answers: [], log: [], history: [], playsUsed: 0, correct: 0, answered: 0, streak: 0, best: 0,
    };
    state.screen = "question";
    startQuestion();
  }

  const continuing = (s) => {
    const q = s.questions[s.index], prev = s.questions[s.index - 1];
    return !!(q.group && prev && prev.group === q.group);
  };

  function startQuestion() {
    const s = state.session;
    s.selected = null;
    s.revealed = false;
    if (!continuing(s)) { // later parts of an excerpt share the same hearing and play count
      s.playsUsed = 1;
      playEvents(s.questions[s.index].events); // counts as the first play
    }
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

  function record(q, ok) {
    P.record(q.category, ok);
    if (q.topic && q.topic !== q.category) P.record(q.topic, ok);
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
    record(q, ok);
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
    record(q, ok);
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
    if (s.index + 1 < s.questions.length) s.index++; // next part of the same excerpt
    else { s.questions = generate(s.cat); s.index = 0; }
    startQuestion();
  }

  /** One key and button for "carry on", whatever the mode. */
  function advance() {
    const s = state.session;
    if (!s) return;
    if (s.mode === "practice") nextPractice();
    else if (s.live) { if (s.revealed) moveOn(); }
    else submitMock();
  }

  function finishMock() {
    S.stop();
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
    state.summary = { score: s.correct, total: s.questions.length, per: per.filter((r) => r.total > 0), missed };
    state.session = null;
    state.screen = "results";
    render();
  }

  // ---------- stage: live level meter while listening, note roll once answered ----------
  const css = getComputedStyle(document.documentElement);
  const col = (name) => css.getPropertyValue(name).trim();
  const COLOURS = { fg: col("--fg"), amber: col("--amber"), unlit: "#16171a", line: col("--line"), dim: col("--dim") };
  const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

  function drawMeter(ctx, w, hgt) {
    const bands = w < 520 ? 20 : 32;
    const gap = 4, segH = 8, segGap = 3, padX = 12;
    const bw = (w - 2 * padX - (bands - 1) * gap) / bands;
    const rows = Math.max(3, Math.floor((hgt - 40) / (segH + segGap)));
    const level = S.spectrum(bands);
    for (let b = 0; b < bands; b++) {
      const lit = Math.round(level[b] * rows);
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = r >= lit ? COLOURS.unlit : r >= rows * 0.75 ? COLOURS.amber : COLOURS.fg;
        ctx.fillRect(padX + b * (bw + gap), hgt - 12 - (r + 1) * (segH + segGap) + segGap, bw, segH);
      }
    }
  }

  function drawRoll(ctx, w, hgt, q) {
    const padX = 12, top = 30, bottom = 30;
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
    const rowH = clamp(areaH / Math.max(rows, 6), 3, 12);
    const y0 = top + (areaH - rows * rowH) / 2;

    for (const { e, m } of notes) {
      const vol = clamp(e.vol, 0, 1);
      let alpha = 0.3 + 0.7 * vol; // louder notes are brighter, so a crescendo is visible
      let fill = COLOURS.fg;
      if (el != null) {
        if (el >= e.start && el <= e.start + e.dur + 0.05) { fill = COLOURS.amber; alpha = 1; }
        else if (el < e.start) alpha *= 0.45;
      }
      ctx.globalAlpha = alpha;
      ctx.fillStyle = fill;
      ctx.fillRect(xOf(e.start), y0 + (hi - m) * rowH, Math.max(3, xOf(e.start + e.dur) - xOf(e.start) - 1), Math.max(2, rowH - 1));
    }
    ctx.globalAlpha = 1;
    // pulse / click lane
    ctx.fillStyle = COLOURS.dim;
    ctx.fillRect(padX, hgt - 20, w - 2 * padX, 1);
    for (const e of q.events) {
      if (e.voice.click === undefined) continue;
      ctx.fillStyle = el != null && el >= e.start && el <= e.start + 0.12 ? COLOURS.amber : COLOURS.fg;
      ctx.fillRect(xOf(e.start), hgt - (e.voice.click ? 18 : 12), 2, e.voice.click ? 14 : 8);
    }
    if (el != null) {
      ctx.fillStyle = COLOURS.fg;
      ctx.fillRect(clamp(xOf(el), padX, w - padX) - 1, top - 6, 2, hgt - top - 4);
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
    if (s.revealed) drawRoll(ctx, w, hgt, s.questions[s.index]);
    else drawMeter(ctx, w, hgt);
  }

  // ---------- live status (footer bar and stage corner), driven by the animation loop ----------
  function updateStatus() {
    const el = S.elapsed();
    const playing = el != null;
    const text = playing ? `● Playing ${Math.min(el, playTotal).toFixed(1)}s / ${playTotal.toFixed(1)}s` : "○ Idle";
    const node = document.getElementById("status");
    if (node) {
      if (node.textContent !== text) node.textContent = text;
      node.classList.toggle("live", playing);
    }
    const st = document.getElementById("stage-state");
    if (st) {
      const s = state.session;
      const idle = s && s.revealed ? "○ Stopped" : "○ Silent";
      const label = playing ? "● Playing" : idle;
      if (st.textContent !== label) st.textContent = label;
      st.classList.toggle("live", playing);
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
  function topicCard(c, index) {
    const st = P.stat(c.key);
    const badge = st.attempts === 0 ? tag("Not tried", "blue") : st.percent < P.PASS_MARK ? tag("Needs work", "amber") : tag("On target", "green");
    return h("article", { class: "cell" },
      h("div", { class: "cell-top" }, h("span", null, `Topic ${pad2(index + 1)}`), h("span", null, groupName(c.group))),
      h("div", { class: "cell-body" },
        h("div", { class: "cell-head" },
          h("div", { class: "icon", "aria-hidden": "true" }, c.code),
          h("div", null, h("h3", null, c.name), h("div", { class: "tags", style: "margin-top:8px" }, badge))),
        h("div", { class: "info" },
          h("p", { class: "line" }, st.attempts ? `Accuracy: ${st.percent}% (${st.correct} of ${st.attempts})` : "Accuracy: no answers yet"),
          h("p", { class: "line muted", style: "margin-top:4px" }, c.blurb),
          h("p", { class: "line dim", style: "margin-top:4px" }, st.last ? `Last practised: ${fmtDate(st.last)}` : "Last practised: never")),
        h("button", { class: "btn primary block", onclick: () => startSession("practice", c.key, generate(c.key)) }, "Practise")));
  }

  function topicsView(query) {
    const needle = query.trim().toLowerCase();
    const list = P.setting("view") === "list" ? " list" : "";
    const out = [];
    for (const grp of GROUPS) {
      const cats = CATEGORIES.map((c, i) => [c, i])
        .filter(([c]) => c.group === grp.key && (!needle || `${c.name} ${c.blurb} ${grp.name}`.toLowerCase().includes(needle)));
      if (!cats.length) continue;
      out.push(h("div", { class: "sect" }, grp.name), h("div", { class: "cards" + list }, cats.map(([c, i]) => topicCard(c, i))));
    }
    if (!out.length) out.push(h("div", { class: "empty" }, "No topics match your search"));
    return out;
  }

  function viewToggle() {
    const view = P.setting("view");
    const set = (v) => () => { P.setSetting("view", v); render(); };
    return h("div", { class: "viewtoggle", role: "group", "aria-label": "Topic layout" },
      h("button", { class: view === "grid" ? "on" : "", id: "v-grid", "aria-label": "Grid view", "aria-pressed": String(view === "grid"), onclick: set("grid") },
        h("span", { class: "ico-grid" }, h("i"), h("i"), h("i"), h("i"))),
      h("button", { class: view === "list" ? "on" : "", id: "v-list", "aria-label": "List view", "aria-pressed": String(view === "list"), onclick: set("list") },
        h("span", { class: "ico-list" }, h("i"), h("i"), h("i"))));
  }

  function homeScreen() {
    const last = P.mocks().slice(-1)[0];
    const size = mockSize(MOCK_PER_CATEGORY);
    const live = P.setting("live");
    const pref = P.setting("inst");
    const start = () => startSession("mock", null, mockTest(MOCK_PER_CATEGORY), P.setting("live"));
    const instOptions = [["mixed", "Mixed (random)"], ...S.ORDER.map((k) => [k, S.INSTRUMENTS[k].name])];

    return h("div", null,
      h("div", { class: "toolbar" },
        h("span", { class: "label grow" }, `${CATEGORIES.length} topics`),
        h("button", { class: "btn primary", onclick: start }, "Start entry check"),
        h("label", { class: "label lbl", for: "inst" }, "Instrument",
          h("select", { class: "field", id: "inst", onchange: (e) => { P.setSetting("inst", e.target.value); render(); } },
            instOptions.map(([k, name]) => h("option", { value: k, selected: k === pref }, name)))),
        h("input", {
          class: "field", id: "q", type: "search", placeholder: "Search topics", value: state.query, "aria-label": "Search topics",
          oninput: (e) => { state.query = e.target.value; document.getElementById("topics").replaceChildren(...topicsView(state.query)); },
        }),
        viewToggle()),
      h("section", { class: "panel" },
        h("div", { class: "tags" }, tag("Paper", "blue"), tag(`${size} marks`, "amber")),
        h("h2", null, "Entry check"),
        h("div", { class: "lines" },
          h("p", null, `${size} questions: ${MOCK_PER_CATEGORY} from every topic, plus a ${AT.excerpt.PARTS}-part mixed excerpt. Headphones recommended.`),
          h("p", null, `Each question can be heard up to ${MAX_PLAYS} times. Aim for ${P.PASS_MARK}% or more.`),
          h("p", { class: "dim" }, last ? `Last attempt: ${last.score}/${last.total} (${last.percent}%) on ${fmtDate(last.when)}` : "Last attempt: none yet")),
        h("div", { class: "row", style: "margin-top:18px" },
          h("button", { class: "btn primary", onclick: start }, "Start entry check"),
          h("button", { class: "switch", id: "live", role: "switch", "aria-checked": String(live), onclick: () => { P.setSetting("live", !live); render(); } },
            h("span", { class: "box" }), `Live feedback ${live ? "on" : "off"}`)),
        h("p", { class: "muted small-text", style: "margin-top:12px" }, live
          ? "Right or wrong is shown the moment you answer, with a running score and streak. Switch it off for exam conditions."
          : "Exam conditions: you lock in each answer and only see your marks and the answers at the end.")),
      h("div", { id: "topics" }, topicsView(state.query)));
  }

  function strip(s, mock) {
    const blocks = [];
    if (mock) {
      for (let i = 0; i < s.questions.length; i++) {
        let cls = "blk";
        if (s.log[i] !== undefined) cls += s.live ? (s.log[i] ? " ok" : " no") : " done";
        if (i === s.index) cls += " cur";
        blocks.push(h("div", { class: cls }));
      }
    } else {
      // A fixed 20 slots: the last 19 results, the current question, then empty slots.
      const recent = s.history.slice(-19);
      recent.forEach((ok) => blocks.push(h("div", { class: "blk " + (ok ? "ok" : "no") })));
      blocks.push(h("div", { class: "blk cur" }));
      while (blocks.length < 20) blocks.push(h("div", { class: "blk" }));
    }
    return h("div", { class: "strip", "aria-hidden": "true" }, blocks);
  }

  function hud(s, mock) {
    const pct = s.answered ? `${P.pct(s.correct, s.answered)}%` : "--";
    const plays = `${Math.min(s.playsUsed, MAX_PLAYS)}/${MAX_PLAYS}`;
    let cells;
    if (!mock) cells = [["Score", `${s.correct}/${s.answered}`], ["Accuracy", pct], ["Streak", s.streak], ["Best streak", s.best]];
    else if (s.live) cells = [["Score", `${s.correct}/${s.answered}`], ["Accuracy", pct], ["Streak", s.streak], ["Plays used", plays]];
    else cells = [["Answered", `${s.answered}/${s.questions.length}`], ["Plays used", plays], ["Target", `${P.PASS_MARK}%`], ["Marks", s.questions.length]];
    return h("div", { class: "hud", "aria-live": "polite" }, cells.map(([k, v]) =>
      h("div", null, h("div", { class: "k" }, k), h("div", { class: "v" + (k === "Streak" && v >= 3 ? " ok" : "") }, v))));
  }

  function questionScreen() {
    const s = state.session;
    const q = s.questions[s.index];
    const mock = s.mode === "mock";
    const cat = byKey(q.topic || q.category); // an excerpt shows its own name, not its first part's topic
    const playing = S.isPlaying();
    const canPlay = !mock || s.playsUsed < MAX_PLAYS;
    const ok = s.selected === q.correct;
    const instName = q.hideInst && !s.revealed ? "???" : S.INSTRUMENTS[q.inst].name;
    const last = s.index + 1 === s.questions.length;

    return h("div", { class: "panel" },
      state.audioError && h("div", { class: "alert", role: "alert" }, "Sound could not start. Check your volume and that this browser allows audio, then press Play again."),
      h("div", { class: "qtop" },
        h("div", { class: "tags" },
          tag(cat.name, "white"),
          tag(`Instrument: ${instName}`, "blue"),
          q.group && tag(`Excerpt part ${partLetter(q.part).toUpperCase()} of ${q.parts}`, "amber"),
          mock && tag(s.live ? "Live feedback" : "Exam conditions", s.live ? "green" : "amber")),
        h("span", { class: "label" }, mock ? `Question ${pad2(s.index + 1)} / ${s.questions.length}` : "Practice")),
      strip(s, mock),
      hud(s, mock),
      q.group && h("p", { class: "intro" }, q.intro),
      h("h2", { class: "prompt" }, q.group && h("span", { class: "part" }, `(${partLetter(q.part)})`), q.prompt),
      h("div", { class: "stage" },
        h("canvas", { id: "stage", "aria-hidden": "true" }),
        h("div", { class: "tl" }, s.revealed ? "Note roll" : "Live level"),
        h("div", { class: "tr", id: "stage-state" }, playing ? "● Playing" : (s.revealed ? "○ Stopped" : "○ Silent"))),
      h("div", { class: "playrow" },
        h("button", { class: "btn primary", id: "play", disabled: !canPlay || playing, onclick: replay },
          playing ? "Playing..." : !canPlay ? "No plays left" : s.playsUsed === 0 ? "Play" : "Play again (R)"),
        mock && h("span", { class: "label" }, `Heard ${Math.min(s.playsUsed, MAX_PLAYS)} of ${MAX_PLAYS} times`)),
      h("div", { class: "options", role: "group", "aria-label": "Answer choices" }, q.options.map((opt, i) => {
        let cls = "opt";
        if (s.revealed) cls += i === q.correct ? " right" : s.selected === i ? " wrong" : " dimmed";
        else if (s.selected === i) cls += " sel";
        return h("button", { class: cls, "aria-pressed": String(s.selected === i), disabled: s.revealed, onclick: () => select(i) },
          h("span", { class: "num" }, i < 9 ? String(i + 1) : ""), h("span", { class: "txt" }, opt));
      })),
      s.mode === "mock" && !s.live
        ? h("div", { class: "actions" },
            h("button", { class: "btn primary", disabled: s.selected == null, onclick: submitMock },
              last ? "Submit and see results" : "Lock in answer and continue"))
        : s.revealed && h("div", { class: "feedback " + (ok ? "good" : "bad"), role: "status" },
            h("div", { class: "verdict" }, ok ? "Correct" : "Not quite"),
            !ok && h("p", null, `The answer was: ${q.options[q.correct]}`),
            h("p", null, q.explanation),
            h("div", { class: "actions" },
              h("button", { class: "btn primary", id: "next", onclick: advance },
                mock ? (last ? "See results (Enter)" : "Next question (Enter)") : (q.group && s.index + 1 < s.questions.length ? "Next part (Enter)" : "Next question (Enter)")))),
      h("p", { class: "keys" }, h("span", { class: "kbd" }, "R"), " replay ", h("span", { class: "kbd" }, "1-9"), " choose ",
        h("span", { class: "kbd" }, "Enter"), mock && !s.live ? " lock in" : " continue"));
  }

  function resultsScreen() {
    const sum = state.summary;
    const pct = P.pct(sum.score, sum.total);
    const pass = pct >= P.PASS_MARK;
    const weak = sum.per.filter((r) => r.correct < r.total)
      .sort((a, b) => a.correct / a.total - b.correct / b.total).slice(0, 3);
    return h("div", { class: "panel" },
      h("div", { class: "tags" }, tag("Entry check", "blue"), tag(pass ? "Above target" : "Below target", pass ? "green" : "amber")),
      h("div", { class: "score " + (pass ? "ok" : "no") }, `${sum.score}/${sum.total}`),
      h("p", { class: "label" }, `${pct}% (target ${P.PASS_MARK}%)`),
      h("p", { style: "margin-top:12px" }, pass
        ? `You are above the ${P.PASS_MARK}% self-check target. Keep practising the topics marked below to stay sharp.`
        : `Below the ${P.PASS_MARK}% self-check target. Practise the weakest topics below, then try the entry check again.`),
      h("div", { class: "sect" }, "By topic"),
      h("table", { class: "t" }, h("tbody", null, sum.per.map((r) =>
        h("tr", null, h("td", null, r.cat.name), h("td", { class: "bar-cell" }, seg(P.pct(r.correct, r.total))), h("td", { class: "num" }, `${r.correct}/${r.total}`))))),
      weak.length > 0 && h("div", null,
        h("div", { class: "sect" }, "Revise these first"),
        weak.map((r) => h("div", { class: "row", style: "margin:8px 0" },
          h("span", { style: "min-width:220px;font-weight:600;color:var(--fg)" }, r.cat.name),
          h("button", { class: "btn small", onclick: () => startSession("practice", r.cat.key, generate(r.cat.key)) }, "Practise")))),
      sum.missed.length > 0 && h("div", null,
        h("div", { class: "sect" }, `Questions you missed (${sum.missed.length})`),
        sum.missed.map((m, i) => h("details", null,
          h("summary", null, `${i + 1}. ${byKey(m.q.category).name}${m.q.group ? ` (part ${partLetter(m.q.part)})` : ""}`),
          h("p", null, m.q.prompt),
          h("p", { class: "no" }, `You answered: ${m.q.options[m.chosen]}`),
          h("p", { class: "ok" }, `Correct answer: ${m.q.options[m.q.correct]}`),
          h("p", null, m.q.explanation),
          h("button", { class: "btn small", onclick: () => playEvents(m.q.events) }, "Hear it again")))),
      h("div", { class: "actions" },
        h("button", { class: "btn primary", onclick: () => startSession("mock", null, mockTest(MOCK_PER_CATEGORY), P.setting("live")) }, "Retake entry check"),
        h("button", { class: "btn", onclick: () => go("home") }, "Back to home")));
  }

  function progressScreen() {
    const mocks = P.mocks();
    return h("div", { class: "panel" },
      h("h2", { style: "margin-top:0" }, "Your progress"),
      h("p", { class: "muted" }, "Accuracy per topic across all practice and entry checks. Saved in this browser only."),
      !P.storageOk() && h("div", { class: "alert" }, "This browser is blocking storage, so progress will be lost when you close the page."),
      h("table", { class: "t" }, h("tbody", null, CATEGORIES.map((c) => {
        const st = P.stat(c.key);
        return h("tr", null, h("td", null, c.name), h("td", { class: "bar-cell" }, seg(st.percent || 0)),
          h("td", { class: "num" }, st.attempts ? `${st.correct}/${st.attempts}` : "no data"));
      }))),
      h("div", { class: "sect" }, "Entry check history"),
      mocks.length === 0 && h("p", { class: "muted" }, "No entry checks completed yet."),
      h("div", { class: "hist" }, mocks.slice(-10).reverse().map((m, i) => h("div", null,
        h("span", { class: "dim" }, `#${mocks.length - i}`),
        h("strong", { class: m.percent >= P.PASS_MARK ? "ok" : "no" }, `${m.score}/${m.total} (${m.percent}%)`),
        h("span", { class: "muted" }, fmtDate(m.when))))),
      mocks.length > 10 && h("p", { class: "muted small-text" }, `(showing latest 10 of ${mocks.length})`),
      h("div", { class: "actions" }, state.confirmReset
        ? [h("span", { class: "no", style: "align-self:center" }, "This permanently deletes all saved results."),
           h("button", { class: "btn danger", onclick: () => { P.reset(); state.confirmReset = false; render(); } }, "Yes, delete everything"),
           h("button", { class: "btn", onclick: () => { state.confirmReset = false; render(); } }, "Cancel")]
        : h("button", { class: "btn", onclick: () => { state.confirmReset = true; render(); } }, "Reset progress")));
  }

  // ---------- render + input ----------
  function updateChrome() {
    const navOn = state.screen === "progress" ? "progress" : "home";
    document.querySelectorAll("[data-nav]").forEach((b) => b.classList.toggle("on", b.dataset.nav === navOn));
    const last = P.mocks().slice(-1)[0];
    const pref = P.setting("inst");
    const info = [
      `${CATEGORIES.length} topics`,
      last ? `Last check ${last.score}/${last.total} (${last.percent}%)` : "No entry check yet",
      `Instrument: ${pref === "mixed" ? "mixed" : S.INSTRUMENTS[pref].name}`,
      P.storageOk() ? "Saved in this browser" : "Storage blocked",
    ].join("  ·  ");
    const node = document.getElementById("foot-info");
    if (node && node.textContent !== info) node.textContent = info;
  }

  function render() {
    const screens = { home: homeScreen, question: questionScreen, results: resultsScreen, progress: progressScreen };
    // Keep keyboard focus on the same control across re-renders.
    const active = document.activeElement;
    const inRoot = active && root.contains(active);
    const activeId = inRoot && active.id ? active.id : null;
    const label = inRoot && !activeId && active.tagName === "BUTTON" ? active.textContent : null;
    root.replaceChildren(screens[state.screen]());
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
      // On an answer button Enter selects it, except in exam mode where Enter on the chosen answer locks it in.
      const chosen = onOption && e.target.getAttribute("aria-pressed") === "true";
      if (!onButton || chosen) { e.preventDefault(); advance(); }
    }
  });

  g.addEventListener("resize", drawStage);

  AT.app = { state, render }; // exposed for debugging and tests
  render();
  g.requestAnimationFrame(tick);
})(window);
