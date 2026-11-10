/* Saved progress in localStorage (falls back to memory if storage is blocked). */
(function (g) {
  const AT = g.AT;
  const KEY = "aural-trainer-progress-v1";
  const PASS_MARK = 70; // self-check target, not an official mark

  let data = { stats: {}, mocks: [] };
  let storageOk = true;

  function load() {
    try {
      const raw = g.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          data = { stats: parsed.stats || {}, mocks: Array.isArray(parsed.mocks) ? parsed.mocks : [] };
        }
      }
    } catch (e) { storageOk = false; }
  }

  function save() {
    try { g.localStorage.setItem(KEY, JSON.stringify(data)); storageOk = true; }
    catch (e) { storageOk = false; }
  }

  const pct = (c, t) => (t === 0 ? 0 : Math.round((c * 100) / t));

  AT.progress = {
    PASS_MARK,
    load,
    storageOk: () => storageOk,
    stat(key) {
      const s = data.stats[key] || { attempts: 0, correct: 0 };
      return { attempts: s.attempts, correct: s.correct, percent: s.attempts ? pct(s.correct, s.attempts) : null };
    },
    record(key, ok) {
      const s = (data.stats[key] = data.stats[key] || { attempts: 0, correct: 0 });
      s.attempts++;
      if (ok) s.correct++;
      save();
    },
    recordMock(score, total) {
      data.mocks.push({ when: Date.now(), score, total });
      save();
    },
    mocks: () => data.mocks.map((m) => ({ ...m, percent: pct(m.score, m.total) })),
    reset() { data = { stats: {}, mocks: [] }; save(); },
    pct,
  };
  load();
})(typeof window !== "undefined" ? window : globalThis);
