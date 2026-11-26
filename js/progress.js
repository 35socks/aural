/* Saved progress and settings in localStorage (falls back to memory if storage is blocked). */
(function (g) {
  const AT = g.AT;
  const KEY = "aural-trainer-progress-v2";
    const DEFAULT_SETTINGS = { inst: "mixed", groups: [], hooks: {}, volume: 0.8, theme: "auto", goal: 20, tempo: 1, motion: true };
  const blankExtra = () => ({ days: {}, xp: 0, ach: {}, mistakes: [], best: 0 });

  let data = { stats: {}, mocks: [], settings: { ...DEFAULT_SETTINGS }, extra: blankExtra() };
  let storageOk = true;

  function load() {
    try {
      const raw = g.localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          data = {
            stats: parsed.stats || {},
            mocks: Array.isArray(parsed.mocks) ? parsed.mocks : [],
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
            extra: { ...blankExtra(), ...(parsed.extra || {}) },
          };
        }
      }
    } catch (e) { storageOk = false; }
  }

  const listeners = [];
  function persist() {
    try { g.localStorage.setItem(KEY, JSON.stringify(data)); storageOk = true; }
    catch (e) { storageOk = false; }
  }
  /** Writes a change made by the person, and tells anything listening (account saving). */
  function save() { persist(); listeners.forEach((fn) => fn()); }

  const pct = (c, t) => (t === 0 ? 0 : Math.round((c * 100) / t));

  AT.progress = {
    load,
    key: KEY,
    raw: () => JSON.parse(JSON.stringify(data)),
    /** Swaps in data from an account. Does not count as a change by the person. */
    replace(next) {
      data = { stats: next.stats, mocks: next.mocks, settings: { ...DEFAULT_SETTINGS, ...next.settings }, extra: { ...blankExtra(), ...next.extra } };
      persist();
    },
    onChange: (fn) => listeners.push(fn),
    storageOk: () => storageOk,
    setting: (k) => data.settings[k],
    setSetting(k, v) { data.settings[k] = v; save(); },
    stat(key) {
      const s = data.stats[key] || { attempts: 0, correct: 0 };
      return { attempts: s.attempts, correct: s.correct, last: s.last || null, percent: s.attempts ? pct(s.correct, s.attempts) : null };
    },
    record(key, ok) {
      const s = (data.stats[key] = data.stats[key] || { attempts: 0, correct: 0 });
      s.attempts++;
      if (ok) s.correct++;
      s.last = Date.now();
      save();
    },
    recordMock(score, total, outcomes) {
      data.mocks.push({ when: Date.now(), score, total, outcomes: outcomes || [] });
      save();
    },
    mocks: () => data.mocks.map((m) => ({ ...m, percent: pct(m.score, m.total) })),
    reset() { data = { stats: {}, mocks: [], settings: data.settings, extra: blankExtra() }; save(); }, // keeps your settings
    pct,
    extra: () => data.extra,
    /** Change the extra data (days, xp, achievements, mistakes) inside fn, then save. */
    updateExtra(fn) { fn(data.extra); save(); },
    stats: () => data.stats,
    exportJSON: () => JSON.stringify({ app: "aural", version: 2, data }, null, 2),
    importJSON(text) {
      const parsed = JSON.parse(text);
      const d = parsed && parsed.data ? parsed.data : parsed;
      if (!d || typeof d !== "object" || !d.stats) throw new Error("That file is not an Aural backup.");
      data = {
        stats: d.stats || {}, mocks: Array.isArray(d.mocks) ? d.mocks : [],
        settings: { ...DEFAULT_SETTINGS, ...(d.settings || {}) }, extra: { ...blankExtra(), ...(d.extra || {}) },
      };
      save();
    },
  };
  load();
})(typeof window !== "undefined" ? window : globalThis);
