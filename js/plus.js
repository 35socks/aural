/* The extra layer: daily goal and streaks, XP and levels, achievements, a mistakes bank, smart practice,
   a session builder, charts, a piano and metronome, settings, backup and install. Screens register in
   AT.extraScreens and are drawn by app.js using the helpers it exposes in AT.ui. */
(function (g) {
  const AT = g.AT;
  const P = AT.progress;
  const S = AT.synth;
  const X = AT.exercises;
  const R = AT.R;
  const ui = () => AT.ui;
  const h = (...a) => ui().h(...a);

  // ---------- small helpers ----------
  const dayKey = (d) => {
    const x = d ? new Date(d) : new Date();
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); return dayKey(d); };
  const today = () => P.extra().days[dayKey()] || { n: 0, c: 0 };
  const goal = () => Number(P.setting("goal")) || 20;
  const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;

  /** Consecutive days with at least one answer, counting back from today (or yesterday if today is empty). */
  function streakDays() {
    const days = P.extra().days;
    let n = 0, i = days[dayKey()] && days[dayKey()].n ? 0 : 1;
    while (days[daysAgo(i)] && days[daysAgo(i)].n) { n++; i++; }
    return n;
  }
  function longestStreak() {
    const keys = Object.keys(P.extra().days).filter((k) => P.extra().days[k].n).sort();
    let best = 0, run = 0, prev = null;
    for (const k of keys) {
      const t = new Date(k + "T12:00:00").getTime();
      run = prev && Math.round((t - prev) / 86400000) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      prev = t;
    }
    return best;
  }

  // ---------- level and XP ----------
  const levelOf = (xp) => Math.floor(Math.sqrt(xp / 60)) + 1;
  const xpFor = (lvl) => 60 * (lvl - 1) * (lvl - 1);
  const LEVEL_NAMES = ["Listener", "Apprentice ear", "Interval spotter", "Chord catcher", "Rhythm keeper", "Tonal navigator", "Sharp ear", "Maestro"];
  const levelName = (lvl) => LEVEL_NAMES[Math.min(LEVEL_NAMES.length - 1, Math.floor((lvl - 1) / 2))];

  // ---------- achievements ----------
  const totals = () => {
    const st = P.stats();
    let a = 0, c = 0;
    Object.values(st).forEach((s) => { a += s.attempts; c += s.correct; });
    return { attempts: a, correct: c };
  };
  const lessonsDone = () => Object.values(P.setting("lessons") || {}).filter((r) => r && r.done).length;
  const ACHIEVEMENTS = [
    { id: "first", name: "First note", text: "Answer your first question.", test: () => totals().attempts >= 1 },
    { id: "c50", name: "Warming up", text: "50 correct answers.", test: () => totals().correct >= 50 },
    { id: "c250", name: "Good ear", text: "250 correct answers.", test: () => totals().correct >= 250 },
    { id: "c1000", name: "Golden ear", text: "1000 correct answers.", test: () => totals().correct >= 1000 },
    { id: "s5", name: "On a roll", text: "5 right in a row.", test: (c) => c.streak >= 5 },
    { id: "s15", name: "In the zone", text: "15 right in a row.", test: (c) => c.streak >= 15 },
    { id: "d3", name: "Three days running", text: "Practise on 3 days in a row.", test: () => streakDays() >= 3 },
    { id: "d7", name: "A full week", text: "Practise on 7 days in a row.", test: () => streakDays() >= 7 },
    { id: "d30", name: "Habit formed", text: "Practise on 30 days in a row.", test: () => streakDays() >= 30 },
    { id: "goal", name: "Goal met", text: "Reach your daily goal.", test: () => today().n >= goal() },
    { id: "mock", name: "Exam sat", text: "Finish a mock exam.", test: () => P.mocks().length >= 1 },
    { id: "pass", name: "Clean pass", text: "Pass all three outcomes in one mock.", test: () => P.mocks().some((m) => (m.outcomes || []).length === 3 && m.outcomes.every(([n, sc]) => sc >= X.outcomeOf(n).pass)) },
    { id: "tried", name: "Explorer", text: "Try every topic at least once.", test: () => X.CATEGORIES.every((c) => P.stat(c.key).attempts > 0) },
    { id: "master", name: "Full house", text: "70% or better on all eight unit topics (10+ attempts each).", test: () => X.CATEGORIES.filter((c) => !c.ext).every((c) => { const s = P.stat(c.key); return s.attempts >= 10 && s.percent >= 70; }) },
    { id: "daily", name: "Daily ten", text: "Finish a daily challenge.", test: () => !!P.extra().daily },
    { id: "perfect", name: "Flawless", text: "10 out of 10 in a daily challenge.", test: (c) => c.perfect },
    { id: "fixed", name: "Learning from errors", text: "Clear 10 questions from the mistakes bank.", test: () => (P.extra().cleared || 0) >= 10 },
    { id: "lessons", name: "Top of the class", text: "Finish every lesson.", test: () => lessonsDone() >= ((AT.lessons && AT.lessons.LESSONS) ? AT.lessons.LESSONS.length : 14) },
  ];

  const toasts = [];
  // Pop-ups wait until a set is over: "5 right in a row" would give answers away.
  const held = [];
  function flushToasts() { held.splice(0).forEach(([title, text]) => toast(title, text)); }
  function toast(title, text) {
    if (ui() && ui().state.screen === "question") { held.push([title, text]); return; }
    let box = document.getElementById("toasts");
    if (!box) {
      box = document.createElement("div");
      box.id = "toasts";
      box.setAttribute("role", "status");
      box.setAttribute("aria-live", "polite");
      document.body.append(box);
    }
    const el = h("div", { class: "toast" }, h("strong", null, title), text && h("span", null, text));
    box.append(el);
    toasts.push(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 400); }, 4200);
  }

  function checkAchievements(ctx) {
    const ex = P.extra();
    const fresh = ACHIEVEMENTS.filter((a) => !ex.ach[a.id] && a.test(ctx || {}));
    if (!fresh.length) return;
    P.updateExtra((e) => fresh.forEach((a) => { e.ach[a.id] = Date.now(); }));
    fresh.forEach((a) => toast(`Achievement: ${a.name}`, a.text));
  }

  // ---------- mistakes bank ----------
  const sig = (q) => `${q.category}|${q.correct}|${q.events.length}|${Math.round(q.events.reduce((n, e) => n + (e.freqs[0] || 0) + e.start * 100, 0))}`;
  const mistakes = () => P.extra().mistakes;

  function addMistake(q) {
    const id = sig(q);
    P.updateExtra((e) => {
      const hit = e.mistakes.find((m) => m.id === id);
      if (hit) { hit.misses++; hit.when = Date.now(); return; }
      const { category, prompt, options, pictures, correct, events, explanation, inst, outcome } = q;
      e.mistakes.unshift({ id, when: Date.now(), misses: 1, q: { category, prompt, options, pictures, correct, events, explanation, inst, outcome, ready: true } });
      if (e.mistakes.length > 80) e.mistakes.length = 80;
    });
  }

  /** Called by app.js after every answer. */
  function onAnswer(q, ok, s) {
    const day = dayKey();
    P.updateExtra((e) => {
      const d = (e.days[day] = e.days[day] || { n: 0, c: 0 });
      d.n++;
      if (ok) d.c++;
      if (ok) e.xp += 10 + (s && s.streak >= 5 ? 5 : 0);
      if (q._bank) {
        const i = e.mistakes.findIndex((m) => m.id === q._bank);
        if (i >= 0) {
          if (ok) { e.mistakes.splice(i, 1); e.cleared = (e.cleared || 0) + 1; }
          else e.mistakes[i].misses++;
        }
      }
    });
    if (!ok && !q._bank) addMistake(q);
    if (today().n === goal()) toast("Daily goal reached", `${goal()} questions today. Nice work.`);
    checkAchievements({ streak: s ? s.streak : 0 });
  }

  // ---------- smart practice ----------
  let lastKey = null;
  function smartKey(pool) {
    const weights = pool.map((c) => {
      const st = P.stat(c.key);
      if (!st.attempts) return 3;
      const gap = Math.max(0, 100 - st.percent);
      const stale = st.last ? Math.min(2, (Date.now() - st.last) / 86400000 / 3) : 1;
      return (1 + gap / 18 + stale) * (c.key === lastKey ? 0.2 : 1);
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i].key; }
    return pool[0].key;
  }
  const poolFor = (keys) => X.CATEGORIES.filter((c) => (keys ? keys.includes(c.key) : !c.ext));
  function smartNext(keys) {
    // About one question in five is a past mistake coming back for another go.
    const bank = mistakes();
    if (!keys && bank.length && Math.random() < 0.2) {
      const m = R.pick(bank);
      return { ...m.q, _bank: m.id };
    }
    const k = smartKey(poolFor(keys));
    lastKey = k;
    return X.generate(k);
  }

  /** A fixed set of questions chosen the smart way, using each saved mistake at most once. */
  function smartSet(keys, count) {
    const used = new Set();
    return Array.from({ length: count }, () => {
      let q = smartNext(keys);
      if (q._bank && used.has(q._bank)) q = X.generate(smartKey(poolFor(keys)));
      if (q._bank) used.add(q._bank);
      return q;
    });
  }

  function startSmart(keys, count, label) {
    const n = count || 10, name = label || "Smart practice";
    ui().startDrill(smartSet(keys, n), name, () => startSmart(keys, n, name));
  }

  function startReview() {
    const queue = R.shuffle(mistakes().map((m) => ({ ...m.q, _bank: m.id })));
    if (queue.length) ui().startDrill(queue, "Mistakes review", () => (mistakes().length ? startReview() : startSmart()));
  }

  function startDaily() {
    ui().startDrill(smartSet(null, 10), "Daily challenge", startDaily, { daily: true });
  }

  /** The end of a practice set: score first, then the answers. */
  function finishDrill(s, result) {
    S.stop();
    const ui_ = ui();
    // The daily challenge only counts if every question was answered.
    const daily = !!s.daily && s.answered >= result.total;
    if (daily) {
      P.updateExtra((e) => {
        if (e.daily !== dayKey()) e.xp += 50;
        e.daily = dayKey();
      });
    }
    ui_.state.drill = { label: s.label, correct: s.correct, best: s.best, daily, restart: s.restart, ...result };
    ui_.state.session = null;
    ui_.state.screen = "drill";
    ui_.render();
    checkAchievements({ perfect: daily && s.correct === result.total, streak: s.best });
    flushToasts();
    g.scrollTo(0, 0);
  }

  // ---------- charts (SVG strings; only numbers and fixed text go in) ----------
  function svgBox(html, label) {
    const d = document.createElement("div");
    d.className = "chart";
    d.setAttribute("role", "img");
    d.setAttribute("aria-label", label);
    d.innerHTML = html;
    return d;
  }

  function activityChart() {
    const days = P.extra().days;
    const N = 14, W = 640, H = 170, pl = 30, pr = 8, pt = 12, pb = 24;
    const keys = Array.from({ length: N }, (_, i) => daysAgo(N - 1 - i));
    const vals = keys.map((k) => (days[k] ? days[k].n : 0));
    const max = Math.max(goal(), ...vals, 5);
    const bw = (W - pl - pr) / N;
    const y = (v) => pt + (H - pt - pb) * (1 - v / max);
    let out = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet">`;
    [0, Math.round(max / 2), max].forEach((t) => {
      out += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${t}</text>`;
    });
    keys.forEach((k, i) => {
      const x = pl + i * bw + bw * 0.18, w = bw * 0.64, top = y(vals[i]);
      const isToday = i === N - 1;
      out += `<rect x="${x}" y="${top}" width="${w}" height="${Math.max(0, H - pb - top)}" rx="2" fill="${isToday ? "var(--accent)" : "var(--muted)"}" opacity="${vals[i] ? 1 : 0.25}"><title>${k}: ${vals[i]} questions</title></rect>`;
      if (i % 2 === (N - 1) % 2) out += `<text x="${x + w / 2}" y="${H - 7}" text-anchor="middle" class="ax">${k.slice(8)}</text>`;
    });
    out += `<line x1="${pl}" x2="${W - pr}" y1="${y(goal())}" y2="${y(goal())}" stroke="var(--good)" stroke-dasharray="4 4"/><text x="${W - pr}" y="${y(goal()) - 4}" text-anchor="end" class="ax" fill="var(--good)">goal ${goal()}</text></svg>`;
    return svgBox(out, `Questions answered per day over the last 14 days. Today: ${vals[N - 1]} of a goal of ${goal()}.`);
  }

  function accuracyChart() {
    const days = P.extra().days;
    const N = 30, W = 640, H = 170, pl = 30, pr = 8, pt = 12, pb = 24;
    const keys = Array.from({ length: N }, (_, i) => daysAgo(N - 1 - i));
    const pts = keys.map((k, i) => ({ k, i, d: days[k] })).filter((p) => p.d && p.d.n >= 3);
    if (pts.length < 2) return h("p", { class: "note" }, "Answer at least 3 questions on two different days to see your accuracy trend.");
    const x = (i) => pl + (i / (N - 1)) * (W - pl - pr);
    const y = (v) => pt + (H - pt - pb) * (1 - v / 100);
    let out = `<svg viewBox="0 0 ${W} ${H}" width="100%">`;
    [0, 50, 100].forEach((t) => { out += `<line x1="${pl}" x2="${W - pr}" y1="${y(t)}" y2="${y(t)}" stroke="var(--line)"/><text x="${pl - 6}" y="${y(t) + 4}" text-anchor="end" class="ax">${t}%</text>`; });
    out += `<line x1="${pl}" x2="${W - pr}" y1="${y(70)}" y2="${y(70)}" stroke="var(--good)" stroke-dasharray="4 4"/><text x="${W - pr}" y="${y(70) - 4}" text-anchor="end" class="ax" fill="var(--good)">pass 70%</text>`;
    const pct = (p) => Math.round((p.d.c * 100) / p.d.n);
    out += `<polyline fill="none" stroke="var(--accent)" stroke-width="2" points="${pts.map((p) => `${x(p.i)},${y(pct(p))}`).join(" ")}"/>`;
    pts.forEach((p) => { out += `<circle cx="${x(p.i)}" cy="${y(pct(p))}" r="3.5" fill="var(--accent)"><title>${p.k}: ${pct(p)}% of ${p.d.n}</title></circle>`; });
    [0, 14, 29].forEach((i) => { out += `<text x="${x(i)}" y="${H - 7}" text-anchor="${i === 0 ? "start" : i === N - 1 ? "end" : "middle"}" class="ax">${keys[i].slice(5)}</text>`; });
    out += "</svg>";
    return svgBox(out, `Daily accuracy over the last 30 days, with the 70 percent pass line.`);
  }

  function heatmap() {
    const days = P.extra().days;
    const weeks = 15, cell = 14, gap = 3;
    const start = new Date();
    start.setDate(start.getDate() - (weeks * 7 - 1) - ((start.getDay() + 6) % 7) + ((start.getDay() + 6) % 7));
    let out = `<svg viewBox="0 0 ${weeks * (cell + gap)} ${7 * (cell + gap)}" width="100%" style="max-width:${weeks * (cell + gap) * 1.6}px">`;
    const todayK = dayKey();
    for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
      const dt = new Date(start); dt.setDate(start.getDate() + w * 7 + d);
      const k = dayKey(dt);
      if (k > todayK) continue;
      const n = days[k] ? days[k].n : 0;
      const lvl = n === 0 ? 0 : n < goal() / 2 ? 1 : n < goal() ? 2 : 3;
      out += `<rect x="${w * (cell + gap)}" y="${d * (cell + gap)}" width="${cell}" height="${cell}" rx="3" class="hm${lvl}"><title>${k}: ${n} questions</title></rect>`;
    }
    out += "</svg>";
    return svgBox(out, "Calendar of practice over the last fifteen weeks.");
  }

  // ---------- dashboard band (top of the Practice screen) ----------
  function weakest(n) {
    return X.CATEGORIES.filter((c) => !c.ext).map((c) => ({ c, st: P.stat(c.key) }))
      .sort((a, b) => (a.st.attempts ? a.st.percent : -1) - (b.st.attempts ? b.st.percent : -1)).slice(0, n);
  }

  function dashboard() {
    const ex = P.extra();
    const t = today();
    const lvl = levelOf(ex.xp);
    const into = ex.xp - xpFor(lvl), span = xpFor(lvl + 1) - xpFor(lvl);
    const streak = streakDays();
    const gpct = Math.min(100, Math.round((t.n * 100) / goal()));
    const dailyDone = ex.daily === dayKey();
    const bank = mistakes().length;
    const weak = weakest(2).filter((w) => !w.st.attempts || w.st.percent < 80);
    const stat = (k, v, sub, extra) => h("div", { class: "dstat" }, h("p", { class: "k" }, k), h("p", { class: "dv" }, v), sub && h("p", { class: "note" }, sub), extra);

    return h("section", { class: "dash", "aria-label": "Today" },
      h("div", { class: "dgrid" },
        stat("Today", `${t.n}`, `of ${goal()} questions${t.n >= goal() ? " · goal met" : ""}`,
          h("div", { class: "bar-meter" + (gpct >= 100 ? " met" : ""), role: "progressbar", "aria-label": "Daily goal", "aria-valuenow": gpct, "aria-valuemin": 0, "aria-valuemax": 100 }, h("i", { style: `width:${gpct}%` }))),
        stat("Practice streak", plural(streak, "day"), `Longest ${plural(longestStreak(), "day")}`),
        stat(`Level ${lvl}`, levelName(lvl), `${into} / ${span} XP to level ${lvl + 1}`,
          h("div", { class: "bar-meter met" }, h("i", { style: `width:${Math.round((into * 100) / span)}%` }))),
        stat("Mistakes bank", String(bank), bank ? "questions waiting for a second go" : "nothing to review")),
      h("div", { class: "dcta" },
        h("button", { class: "btn primary", onclick: () => startSmart() }, "Smart practice · 10 questions"),
        h("button", { class: "btn", onclick: startDaily }, dailyDone ? "Daily challenge (done, go again)" : "Daily challenge · 10 questions"),
        h("button", { class: "btn", disabled: !bank, onclick: startReview }, bank ? `Review ${plural(bank, "mistake")}` : "No mistakes to review")),
      h("p", { class: "note dwhy" }, weak.length
        ? `Smart practice favours your weakest topics. Right now: ${weak.map((w) => `${w.c.name}${w.st.attempts ? ` (${w.st.percent}%)` : " (not tried)"}`).join(", ")}.`
        : "Smart practice mixes every topic, favouring the ones you have practised least recently."));
  }

  // ---------- session builder (Practice screen) ----------
  const build = { keys: null, count: 10 };
  function builder() {
    if (!build.keys) build.keys = X.CATEGORIES.filter((c) => !c.ext).map((c) => c.key);
    const rerender = () => ui().render();
    const toggle = (k) => { build.keys = build.keys.includes(k) ? build.keys.filter((x) => x !== k) : [...build.keys, k]; rerender(); };
    return h("section", { class: "panel builder" },
      h("p", { class: "meta" }, "Build a session"),
      h("h3", null, "Pick your own topics"),
      h("div", { class: "chips" }, X.CATEGORIES.map((c) =>
        h("button", { class: "tchip" + (build.keys.includes(c.key) ? " on" : ""), "aria-pressed": String(build.keys.includes(c.key)), onclick: () => toggle(c.key) }, c.name))),
      h("div", { class: "row", style: "margin-top:16px" },
        h("label", { class: "lbl" }, h("span", { class: "meta" }, "Questions"),
          h("select", { class: "field", onchange: (e) => { build.count = Number(e.target.value); } },
            [5, 10, 20, 30].map((n) => h("option", { value: n, selected: n === build.count }, String(n))))),
        h("button", { class: "btn primary", disabled: !build.keys.length, onclick: () => startSmart(build.keys.slice(), build.count, "Custom session") }, "Start session")));
  }

  function extensionSection() {
    const cats = X.CATEGORIES.filter((c) => c.ext);
    return h("section", { class: "outcome" },
      h("header", null, h("div", null, h("p", { class: "meta" }, "Beyond the unit"), h("h3", null, X.EXTENSION.name)),
        h("p", { class: "meta cut" }, "Not in the mock exam")),
      h("ul", { class: "topics" }, cats.map((c) => {
        const st = P.stat(c.key);
        return h("li", { class: "topic" },
          h("span", { class: "pc" }, c.pc),
          h("div", { class: "topic-text" }, h("h4", null, c.name), h("p", null, c.blurb)),
          h("div", { class: "topic-score" }, ui().meter(st.percent || 0, `${c.name} accuracy`), h("span", null, st.attempts ? `${st.percent}% of ${st.attempts}` : "Not tried")),
          h("button", { class: "btn", onclick: () => ui().startPractice(c.key) }, "Practise"));
      })));
  }

  // ---------- screens ----------
  const screens = {};

  screens.drill = () => {
    const d = ui().state.drill || { label: "Practice", correct: 0, total: 0, best: 0, missed: [] };
    const pct = d.total ? P.pct(d.correct, d.total) : 0;
    return h("div", { class: "panel results" },
      h("p", { class: "meta" }, d.label),
      h("h2", null, pct >= 90 ? "Excellent listening" : pct >= 70 ? "Solid work" : "Keep going, it is working"),
      d.timedOut && h("p", { class: "note" }, "Time ran out. Unanswered questions scored nothing."),
      h("div", { class: "marks" },
        h("div", null, h("dt", null, "Score"), h("dd", null, String(d.correct), h("span", null, `/${d.total}`))),
        h("div", null, h("dt", null, "Accuracy"), h("dd", null, `${pct}%`)),
        h("div", null, h("dt", null, "Best streak"), h("dd", null, String(d.best)))),
      d.daily && h("p", { class: "advice" }, "Daily challenge complete. +50 XP the first time each day."),
      mistakes().length > 0 && h("p", { class: "advice" }, `You have ${plural(mistakes().length, "question")} in the mistakes bank. Fixing those is the quickest way to improve.`),
      ui().missedList(d.missed),
      h("div", { class: "actions" },
        d.restart && h("button", { class: "btn primary", onclick: d.restart }, "Practise again"),
        mistakes().length > 0 && h("button", { class: "btn", onclick: startReview }, "Review mistakes"),
        h("button", { class: "btn", onclick: () => ui().go("home") }, "Back to practice")));
  };

  screens.review = () => {
    const bank = mistakes();
    const byCat = {};
    bank.forEach((m) => { byCat[m.q.category] = (byCat[m.q.category] || 0) + 1; });
    return h("div", { class: "review" },
      h("div", { class: "lead" }, h("h2", null, "Mistakes bank"),
        h("p", null, "Every question you get wrong is saved here with its sound. Answer one correctly in review and it leaves the bank. Smart practice also slips them back in now and then.")),
      h("div", { class: "actions", style: "margin:0 0 24px" },
        h("button", { class: "btn primary", disabled: !bank.length, onclick: startReview }, bank.length ? `Review all ${bank.length}` : "Nothing to review"),
        bank.length > 0 && h("button", { class: "btn", onclick: () => { P.updateExtra((e) => { e.mistakes = []; }); ui().render(); } }, "Clear bank")),
      bank.length === 0 && h("p", { class: "note" }, "Your bank is empty. Wrong answers in practice and mock exams will appear here."),
      bank.length > 0 && h("div", { class: "chips", style: "margin-bottom:16px" }, Object.entries(byCat).map(([k, n]) => h("span", { class: "tchip static" }, `${X.byKey(k).name} · ${n}`))),
      bank.map((m) => h("details", null,
        h("summary", null, h("span", { class: "meta" }, X.byKey(m.q.category).name), h("span", null, m.q.prompt.length > 70 ? m.q.prompt.slice(0, 70) + "…" : m.q.prompt), h("span", { class: "meta" }, `missed ${m.misses}×`)),
        h("p", { class: "ok" }, `Answer: ${m.q.options[m.q.correct]}`),
        m.q.pictures && h("div", { class: "pic-review" }, AT.notation.rhythmSVG(m.q.pictures[m.q.correct], m.q.options[m.q.correct])),
        h("p", null, m.q.explanation),
        h("div", { class: "actions", style: "margin-top:0" },
          h("button", { class: "btn small", onclick: () => { S.play(m.q.events); } }, "Hear it"),
          h("button", { class: "btn small", onclick: () => { P.updateExtra((e) => { e.mistakes = e.mistakes.filter((x) => x.id !== m.id); }); ui().render(); } }, "Remove")))));
  };

  // ---- tools: keyboard + metronome ----
  const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
  const KEYMAP = "awsedftgyhujkolp;'".split("");
  let metro = { on: false, bpm: 90, beats: 4, timer: 0 };

  function metroEvents() {
    const beat = 60 / metro.bpm, bars = 24, ev = [];
    for (let b = 0; b < bars * metro.beats; b++) ev.push(S.ev.click(b * beat, b % metro.beats === 0, 0.7));
    return ev;
  }
  function metroStart() {
    metro.on = true;
    const loop = () => { if (metro.on) S.play(metroEvents(), loop); };
    loop();
    metro.timer = setInterval(updateMetro, 60);
    ui().render();
  }
  function metroStop() { metro.on = false; clearInterval(metro.timer); S.stop(); ui().render(); }
  function updateMetro() {
    const el = document.getElementById("beat-dots");
    if (!el) return;
    const t = S.elapsed();
    if (t == null) return;
    const idx = Math.floor(t / (60 / metro.bpm)) % metro.beats;
    [...el.children].forEach((c, i) => c.classList.toggle("on", i === idx));
  }

  function pianoKeys(base, octaves) {
    const wrap = h("div", { class: "piano", role: "group", "aria-label": "Piano keyboard" });
    const whiteIdx = [0, 2, 4, 5, 7, 9, 11];
    let wi = 0;
    const total = octaves * 7;
    for (let o = 0; o < octaves; o++) for (let n = 0; n < 12; n++) {
      const midi = base + o * 12 + n;
      const black = ![0, 2, 4, 5, 7, 9, 11].includes(n);
      const idx = o * 12 + n;
      const key = h("button", {
        class: "pk " + (black ? "black" : "white"), type: "button", "data-midi": midi,
        "aria-label": NOTE_NAMES[n] + (Math.floor(midi / 12) - 1),
        style: black ? `left:${((wi - 0.3) / total) * 100}%;width:${(0.6 / total) * 100}%` : `left:${(wi / total) * 100}%;width:${100 / total}%`,
      }, !black && n === 0 ? h("span", null, "C" + (Math.floor(midi / 12) - 1)) : null);
      key.dataset.k = KEYMAP[idx] || "";
      key.addEventListener("pointerdown", (e) => { e.preventDefault(); sound(midi, key); });
      wrap.append(key);
      if (!black) wi++;
    }
    return wrap;
  }
  function sound(midi, key) {
    S.tap(AT.theory.freq(midi), 1.2, 0.85);
    if (key) { key.classList.add("down"); setTimeout(() => key.classList.remove("down"), 160); }
  }
  g.addEventListener("keydown", (e) => {
    if (ui().state.screen !== "tools" || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
    if (e.target && /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    const i = KEYMAP.indexOf(e.key.toLowerCase());
    if (i < 0) return;
    const key = document.querySelector(`.pk[data-midi="${60 + i}"]`);
    if (key) { e.preventDefault(); sound(60 + i, key); }
  });

  screens.tools = () => {
    return h("div", { class: "tools" },
      h("div", { class: "lead" }, h("h2", null, "Tools"), h("p", null, "A keyboard to check what you hear, and a metronome to feel the beat.")),
      h("section", { class: "panel" },
        h("p", { class: "meta" }, "Keyboard"),
        h("h3", null, "Find the notes"),
        h("p", { class: "note", style: "margin:6px 0 16px" }, "Click or tap the keys. On a computer keyboard use A W S E D F T G Y H U J K O L P ; ' starting from middle C."),
        pianoKeys(60, 2),
        h("div", { class: "hear", style: "margin-top:16px" },
          h("button", { class: "btn small", onclick: () => S.play([S.ev.tone(0, 3, [440], 0.8)]) }, "Play A 440 Hz"),
          h("button", { class: "btn small", onclick: () => S.play([60, 62, 64, 65, 67, 69, 71, 72].map((m, i) => S.ev.tone(i * 0.4, 0.45, [AT.theory.freq(m)], 0.8))) }, "Play C major scale"),
          h("button", { class: "btn small", onclick: () => S.play([S.ev.sustained(0, 1.8, [60, 64, 67].map(AT.theory.freq), 0.8)]) }, "Play C major chord"))),
      h("section", { class: "panel", style: "margin-top:24px" },
        h("p", { class: "meta" }, "Metronome"),
        h("h3", null, `${metro.bpm} beats per minute`),
        h("div", { class: "row", style: "margin-top:16px" },
          h("label", { class: "lbl" }, h("span", { class: "meta" }, "Tempo"),
            h("input", { type: "range", min: 40, max: 208, value: metro.bpm, "aria-label": "Tempo in beats per minute", oninput: (e) => {
              metro.bpm = Number(e.target.value); e.target.closest("section").querySelector("h3").textContent = `${metro.bpm} beats per minute`;
            }, onchange: () => { if (metro.on) { S.stop(); metroStart(); } } })),
          h("label", { class: "lbl" }, h("span", { class: "meta" }, "Beats in a bar"),
            h("select", { class: "field", onchange: (e) => { metro.beats = Number(e.target.value); if (metro.on) { S.stop(); metroStart(); } else ui().render(); } },
              [2, 3, 4, 6].map((n) => h("option", { value: n, selected: n === metro.beats }, String(n))))),
          h("button", { class: "btn primary", id: "metro-btn", onclick: () => (metro.on ? metroStop() : metroStart()) }, metro.on ? "Stop" : "Start")),
        h("div", { class: "beats", id: "beat-dots", "aria-hidden": "true" }, Array.from({ length: metro.beats }, () => h("i")))));
  };

  // ---- settings ----
  function applyTheme() {
    const t = P.setting("theme");
    const el = document.documentElement;
    el.dataset.theme = t === "light" || t === "dark" ? t : "auto";
    const dark = t === "dark" || (t !== "light" && g.matchMedia("(prefers-color-scheme: dark)").matches);
    el.style.colorScheme = dark ? "dark" : "light";
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = dark ? "#141516" : "#f6f4ef";
    if (ui() && ui().refreshColours) ui().refreshColours();
  }
  const applyMotion = () => { document.documentElement.dataset.motion = P.setting("motion") === false ? "off" : "on"; };

  let installEvent = null;
  g.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; if (ui() && ui().state.screen === "settings") ui().render(); });

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  let settingsMsg = "";
  screens.settings = () => {
    const set = (k, v) => { P.setSetting(k, v); applyTheme(); applyMotion(); ui().render(); };
    const sw = (label, key, desc) => h("div", { class: "srow" }, h("div", null, h("h4", null, label), desc && h("p", { class: "note" }, desc)),
      h("button", { class: "switch", role: "switch", "aria-label": label, "aria-checked": String(!!P.setting(key)), onclick: () => set(key, !P.setting(key)) }, h("span", { class: "box" })));
    const sel = (label, key, opts, desc, num) => h("div", { class: "srow" }, h("div", null, h("h4", null, label), desc && h("p", { class: "note" }, desc)),
      h("select", { class: "field", "aria-label": label, onchange: (e) => set(key, num ? Number(e.target.value) : e.target.value) },
        opts.map(([v, t]) => h("option", { value: v, selected: String(P.setting(key)) === String(v) }, t))));
    return h("div", { class: "settings-page" },
      h("div", { class: "lead" }, h("h2", null, "Settings"), h("p", null, "Settings are saved in this browser. Progress stays here too, unless you sign in to an account.")),
      h("section", { class: "panel" },
        h("h3", null, "Sound and display"),
        h("div", { class: "srow" }, h("div", null, h("h4", null, "Volume"), h("p", { class: "note" }, "Applies to every sound in the app.")),
          h("input", { type: "range", min: 0.1, max: 1, step: 0.05, value: P.setting("volume"), "aria-label": "Volume", oninput: (e) => { P.setSetting("volume", Number(e.target.value)); S.setVolume(Number(e.target.value)); },
            onchange: () => S.tap(AT.theory.freq(69), 0.6, 0.8) })),
        sel("Theme", "theme", [["auto", "Match my device"], ["dark", "Dark"], ["light", "Light"]]),
        sw("Animations", "motion", "Turn off to remove motion effects.")),
      h("section", { class: "panel", style: "margin-top:24px" },
        h("h3", null, "Practice"),
        sel("Daily goal", "goal", [[10, "10 questions"], [20, "20 questions"], [30, "30 questions"], [50, "50 questions"], [100, "100 questions"]], "Counts toward your streak and the Today bar.", true)),
      h("section", { class: "panel", style: "margin-top:24px" },
        h("h3", null, "Your data"),
        settingsMsg && h("p", { class: "note ok", role: "status" }, settingsMsg),
        h("div", { class: "actions", style: "margin-top:12px" },
          h("button", { class: "btn", onclick: () => { download(`aural-backup-${dayKey()}.json`, P.exportJSON(), "application/json"); settingsMsg = "Backup downloaded."; ui().render(); } }, "Download backup"),
          h("label", { class: "btn" }, "Restore from backup",
            h("input", { type: "file", accept: "application/json,.json", hidden: true, onchange: (e) => {
              const f = e.target.files[0];
              if (!f) return;
              f.text().then((t) => { try { P.importJSON(t); applyTheme(); applyMotion(); S.setVolume(P.setting("volume")); settingsMsg = "Backup restored."; } catch (err) { settingsMsg = "Could not restore: " + err.message; } ui().render(); });
            } })),
          installEvent && h("button", { class: "btn primary", onclick: () => { installEvent.prompt(); installEvent = null; } }, "Install as an app")),
        h("p", { class: "note", style: "margin-top:12px" }, "Moving to another device or browser? Download a backup here and restore it there.")),
      h("section", { class: "panel", style: "margin-top:24px" },
        h("h3", null, "Keyboard shortcuts"),
        h("table", { class: "t" }, h("tbody", null, [["R", "Replay the sound"], ["1-9", "Choose an answer"], ["Enter", "Lock in"], ["A W S E D F …", "Play the piano on the Tools page"]].map(([k, v]) => h("tr", null, h("td", null, h("kbd", { style: "margin:0" }, k)), h("td", null, v)))))));
  };

  // ---- insights (added to the Progress page) ----
  function achievementsPanel() {
    const got = P.extra().ach;
    return h("section", null,
      h("h3", { class: "section-title" }, `Achievements · ${Object.keys(got).filter((k) => ACHIEVEMENTS.some((a) => a.id === k)).length}/${ACHIEVEMENTS.length}`),
      h("div", { class: "ach" }, ACHIEVEMENTS.map((a) => h("div", { class: "achcard" + (got[a.id] ? " got" : "") },
        h("strong", null, a.name), h("span", null, a.text), got[a.id] && h("time", null, new Date(got[a.id]).toLocaleDateString("en-GB", { day: "numeric", month: "short" }))))));
  }

  function insights() {
    const ex = P.extra();
    const t = totals();
    const weak = weakest(3);
    return h("div", { class: "insights" },
      h("div", { class: "dgrid" },
        h("div", { class: "dstat" }, h("p", { class: "k" }, "Answered"), h("p", { class: "dv" }, String(t.attempts)), h("p", { class: "note" }, `${P.pct(t.correct, t.attempts)}% correct`)),
        h("div", { class: "dstat" }, h("p", { class: "k" }, "Streak"), h("p", { class: "dv" }, plural(streakDays(), "day")), h("p", { class: "note" }, `Longest ${plural(longestStreak(), "day")}`)),
        h("div", { class: "dstat" }, h("p", { class: "k" }, "XP"), h("p", { class: "dv" }, String(ex.xp)), h("p", { class: "note" }, `Level ${levelOf(ex.xp)} · ${levelName(levelOf(ex.xp))}`)),
        h("div", { class: "dstat" }, h("p", { class: "k" }, "Mock exams"), h("p", { class: "dv" }, String(P.mocks().length)), h("p", { class: "note" }, "sat so far"))),
      h("h3", { class: "section-title" }, "Questions per day"), activityChart(),
      h("h3", { class: "section-title" }, "Accuracy, last 30 days"), accuracyChart(),
      h("h3", { class: "section-title" }, "Practice calendar"), heatmap(),
      h("h3", { class: "section-title" }, "Focus next"),
      h("ul", { class: "focus" }, weak.map((w) => h("li", null,
        h("span", null, w.c.name, h("span", { class: "meta" }, w.st.attempts ? ` ${w.st.percent}% of ${w.st.attempts}` : " not tried")),
        h("button", { class: "btn small", onclick: () => ui().startPractice(w.c.key) }, "Practise")))),
      achievementsPanel());
  }

  // ---------- boot ----------
  AT.volume = P.setting("volume");
  applyTheme();
  applyMotion();
  g.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

  AT.extraScreens = screens;
  AT.plus = { flushToasts, onAnswer, dashboard, builder, extensionSection, insights, finishDrill, startReview, checkAchievements, applyTheme, mistakes };

  if ("serviceWorker" in navigator && g.location.protocol.startsWith("http")) {
    const base = g.location.pathname.replace(/(groups|learning)\/$/, "");
    navigator.serviceWorker.register(base + "sw.js").catch(() => {});
  }
})(window);
