/* Optional accounts (Supabase). Everything works signed out. Signing in keeps a copy of your progress online and
   merges it between devices. Plain fetch calls, so there is still no library or build step.

   While signed in, the normal progress store holds the account's progress and the signed-out progress is set aside,
   so people sharing a computer do not mix their results. The table and its security rules are in supabase/setup.sql. */
(function (g) {
  const AT = g.AT;
  const P = AT.progress;

  // Both values are meant to be public. What protects the data is row level security in the database.
  const API = "https://hntgiectjuiuvzkpdwbn.supabase.co";
  const PUBLIC_KEY = "sb_publishable_uqPDqnQKASf-scBJSTC3jA_Rm0eVJsW";

  const META = "aural-account-v1";
  const GUEST = "aural-guest-v1";
  // Progress follows the account. Theme, volume and other settings belong to the device.
  const SYNCED_SETTINGS = ["groups", "lessons", "goal", "hooks"];

  // ---------- merging ----------
  const copy = (x) => JSON.parse(JSON.stringify(x));
  const canon = (x) => {
    if (Array.isArray(x)) return `[${x.map(canon).join(",")}]`;
    if (x && typeof x === "object") return `{${Object.keys(x).filter((k) => x[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canon(x[k])}`).join(",")}}`;
    return JSON.stringify(x === undefined ? null : x);
  };
  const same = (a, b) => canon(a) === canon(b);

  /** The part of the saved data that belongs to a person, in a fixed shape. */
  function slice(data) {
    const d = copy(data || {});
    const set = d.settings || {};
    const settings = { groups: Array.isArray(set.groups) ? set.groups : [], lessons: set.lessons || {}, hooks: set.hooks || {} };
    if (set.goal !== undefined) settings.goal = set.goal;
    return {
      stats: d.stats || {},
      mocks: Array.isArray(d.mocks) ? d.mocks : [],
      extra: { days: {}, xp: 0, ach: {}, mistakes: [], best: 0, ...(d.extra || {}) },
      settings,
    };
  }
  const empty = () => slice({});

  /** Whole saved data with the personal part swapped for `s`. */
  function withSlice(data, s) {
    const settings = { ...(data.settings || {}) };
    SYNCED_SETTINGS.forEach((k) => delete settings[k]);
    return { stats: s.stats, mocks: s.mocks, extra: s.extra, settings: { ...settings, goal: 20, ...s.settings } };
  }

  /** The value changed here wins; otherwise take the account's. With no common history the account's wins. */
  const pick = (b, l, r) => (b === undefined ? (r !== undefined ? r : l) : same(l, b) ? r : l);

  /** Running totals: add what happened here since the last save to what the account holds. */
  const count = (b, l, r) => Math.max(0, (r || 0) + (l || 0) - (b || 0));
  const tally = (totalKey, rightKey) => (b, l, r) => {
    const total = count(b && b[totalKey], l[totalKey], r[totalKey]);
    const out = { ...r, ...l, [totalKey]: total, [rightKey]: Math.min(total, count(b && b[rightKey], l[rightKey], r[rightKey])) };
    if (l.last || r.last) out.last = Math.max(l.last || 0, r.last || 0);
    return out;
  };

  /** Three-way merge of keyed records: additions from both sides are kept, and deletions stay deleted. */
  function mergeMap(b, l, r, combine) {
    const out = {};
    for (const k of new Set([...Object.keys(l), ...Object.keys(r)])) {
      const inB = Object.prototype.hasOwnProperty.call(b, k);
      const inL = Object.prototype.hasOwnProperty.call(l, k);
      const inR = Object.prototype.hasOwnProperty.call(r, k);
      if (inL && inR) out[k] = combine(b[k], l[k], r[k]);
      else if (!inB) out[k] = inL ? l[k] : r[k];
    }
    return out;
  }
  function mergeList(b, l, r, id, order) {
    const map = (list) => Object.fromEntries(list.map((x) => [id(x), x]));
    return Object.values(mergeMap(map(b), map(l), map(r), pick)).sort(order);
  }

  /** `base` is what both sides last agreed on, `local` is this browser, `remote` is the account. */
  function merge(base, local, remote) {
    const b = slice(base), l = slice(local), r = slice(remote);
    const extra = {
      days: mergeMap(b.extra.days, l.extra.days, r.extra.days, tally("n", "c")),
      ach: mergeMap(b.extra.ach, l.extra.ach, r.extra.ach, (x, y, z) => Math.min(y, z)),
      mistakes: mergeList(b.extra.mistakes, l.extra.mistakes, r.extra.mistakes, (m) => m.id, (x, y) => y.when - x.when).slice(0, 80),
      xp: count(b.extra.xp, l.extra.xp, r.extra.xp),
      // Highest wins, unless it was lowered here (a progress reset).
      best: (l.extra.best || 0) < (b.extra.best || 0) ? l.extra.best || 0 : Math.max(l.extra.best || 0, r.extra.best || 0),
    };
    const cleared = count(b.extra.cleared, l.extra.cleared, r.extra.cleared);
    if (cleared) extra.cleared = cleared;
    for (const k of new Set([...Object.keys(l.extra), ...Object.keys(r.extra)])) {
      if (["days", "ach", "mistakes", "xp", "best", "cleared"].includes(k)) continue;
      const v = pick(b.extra[k], l.extra[k], r.extra[k]);
      if (v !== undefined) extra[k] = v;
    }
    const settings = {
      groups: mergeList(b.settings.groups, l.settings.groups, r.settings.groups, (x) => x.id, (x, y) => String(x.id).localeCompare(String(y.id))),
      lessons: mergeMap(b.settings.lessons, l.settings.lessons, r.settings.lessons, (x, y, z) => ((y.when || 0) >= (z.when || 0) ? y : z)),
      hooks: mergeMap(b.settings.hooks, l.settings.hooks, r.settings.hooks, pick),
    };
    const goal = pick(b.settings.goal, l.settings.goal, r.settings.goal);
    if (goal !== undefined) settings.goal = goal;
    return {
      stats: mergeMap(b.stats, l.stats, r.stats, tally("attempts", "correct")),
      mocks: mergeList(b.mocks, l.mocks, r.mocks, (m) => `${m.when}|${m.score}|${m.total}`, (x, y) => x.when - y.when),
      extra,
      settings,
    };
  }

  const hasProgress = (s) => Object.keys(s.stats).length > 0 || s.mocks.length > 0 || s.settings.groups.length > 0 || Object.keys(s.settings.lessons).length > 0 || Object.values(s.settings.hooks).some(Boolean);

  // ---------- local records ----------
  const read = (key) => { try { return JSON.parse(g.localStorage.getItem(key)); } catch (e) { return null; } };
  const write = (key, value) => g.localStorage.setItem(key, JSON.stringify(value));
  const drop = (key) => g.localStorage.removeItem(key);
  const meta = () => read(META);
  const patchMeta = (changes) => write(META, { ...meta(), ...changes });

  /** True if this browser holds progress the account has not received. */
  function unsaved() {
    const local = slice(P.raw()), base = slice(meta().base);
    if (base.settings.goal === undefined && local.settings.goal === 20) delete local.settings.goal;
    return !same(local, base);
  }

  // ---------- talking to Supabase ----------
  async function request(path, { method = "GET", body, token, headers } = {}) {
    let res;
    try {
      res = await g.fetch(API + path, {
        method,
        headers: { apikey: PUBLIC_KEY, "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) { throw Object.assign(new Error("offline"), { offline: true }); }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { /* not JSON */ }
    if (!res.ok) {
      const j = json || {};
      throw Object.assign(new Error(j.msg || j.error_description || j.message || `Request failed (${res.status})`),
        { status: res.status, code: j.error_code || j.code || "" });
    }
    return json;
  }

  const toSession = (r) => ({
    access_token: r.access_token, refresh_token: r.refresh_token,
    expires_at: r.expires_at || Math.floor(Date.now() / 1000) + Number(r.expires_in || 3600),
    user: { id: r.user.id, email: r.user.email },
  });

  /** A working access token, refreshed if it is about to run out. Call only while holding the lock. */
  async function accessToken() {
    const s = meta().session;
    if (s.expires_at * 1000 - Date.now() > 60000) return s.access_token;
    try {
      const next = toSession(await request("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: s.refresh_token } }));
      patchMeta({ session: next });
      return next.access_token;
    } catch (e) {
      // The sign-in is no longer valid. Keep the progress here until the same person signs in again.
      if ([400, 401, 403].includes(e.status)) patchMeta({ session: null, expired: true });
      throw e;
    }
  }

  // One account operation at a time, across tabs where the browser supports it.
  let queue = Promise.resolve();
  function locked(fn) {
    if (g.navigator && g.navigator.locks) return g.navigator.locks.request("aural-account", fn);
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
  }

  // ---------- saving ----------
  let status = { state: "idle", text: "" };
  function setStatus(state, text) { status = { state, text: text || "" }; refresh(false); }

  function problem(e) {
    if (e.offline) return "Offline. Your progress will be saved to your account when you are back online.";
    if (e.code === "PGRST205" || e.code === "42P01") return "Online saving is not set up yet. Your progress is safe in this browser.";
    if (meta() && meta().expired) return "Your sign-in has ended. Sign in again to keep saving.";
    return "Could not save to your account. It will try again.";
  }

  async function exchange() {
    for (let attempt = 0; attempt < 4; attempt++) {
      if (!meta() || !meta().session) return false;
      const token = await accessToken();
      const id = meta().userId;
      const rows = await request(`/rest/v1/progress?select=data,version&user_id=eq.${id}`, { token });
      const row = rows[0] || null;
      const remote = row ? row.data : {};
      P.load();
      let { base, pending } = meta();
      // An earlier save reached the account but we never heard back: count it as done, so nothing is added twice.
      if (pending && (remote.syncs || []).includes(pending.id)) {
        P.replace(withSlice(P.raw(), merge(pending.snapshot, slice(P.raw()), pending.merged)));
        base = pending.merged;
        patchMeta({ base, pending: null });
      }
      const snapshot = slice(P.raw());
      const merged = merge(base, snapshot, remote);
      if (!row || !same(merged, slice(remote))) {
        const syncId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
        patchMeta({ pending: { id: syncId, snapshot, merged } });
        const data = { ...merged, syncs: [...(remote.syncs || []), syncId].slice(-20) };
        const headers = { Prefer: "return=representation" };
        const updated_at = new Date().toISOString();
        try {
          if (row) {
            // Only writes if nobody else has saved since we read.
            const done = await request(`/rest/v1/progress?user_id=eq.${id}&version=eq.${row.version}`,
              { method: "PATCH", token, headers, body: { data, version: row.version + 1, updated_at } });
            if (!done.length) continue;
          } else {
            await request("/rest/v1/progress", { method: "POST", token, headers, body: { user_id: id, data, version: 1, updated_at } });
          }
        } catch (e) {
          if (e.status === 409) continue;
          throw e;
        }
      }
      // Answers given while we were waiting are carried on top of the merged result.
      P.load();
      const current = slice(P.raw());
      const next = merge(snapshot, current, merged);
      const changed = !same(next, current);
      if (changed) P.replace(withSlice(P.raw(), next));
      patchMeta({ base: merged, pending: null, lastSync: Date.now() });
      if (meta().addingGuest) {
        // It is in the account now, so empty the signed-out copy to stop it being added twice.
        write(GUEST, withSlice(read(GUEST) || {}, empty()));
        patchMeta({ addingGuest: false });
      }
      if (changed) refresh(true);
      return true;
    }
    throw new Error("The account kept changing while saving.");
  }

  async function syncUnlocked() {
    if (!meta() || !meta().session) return false;
    setStatus("saving", "Saving...");
    try {
      const ok = await exchange();
      setStatus("saved", "Saved to your account");
      return ok;
    } catch (e) {
      setStatus("error", problem(e));
      return false;
    }
  }
  const sync = () => locked(syncUnlocked);

  let timer = null;
  function soon() {
    if (timer || !meta() || !meta().session) return;
    timer = setTimeout(() => { timer = null; sync(); }, 3000);
  }

  // ---------- signing in and out ----------
  /** Puts the signed-out progress back and forgets the account on this device. */
  function leaveAccount() {
    const guest = read(GUEST);
    P.load();
    P.replace(withSlice(P.raw(), guest ? slice(guest) : empty()));
    drop(META);
    drop(GUEST);
  }

  async function adopt(session) {
    await locked(async () => {
      if (meta() && meta().userId !== session.user.id) leaveAccount();
      if (!meta()) {
        P.load();
        const guest = P.raw();
        write(GUEST, guest);
        write(META, { userId: session.user.id, base: empty(), pending: null, offerGuest: hasProgress(slice(guest)) });
        P.replace(withSlice(guest, empty()));
      }
      patchMeta({ session, email: session.user.email, expired: false });
      await syncUnlocked();
    });
    refresh(true);
  }

  async function signIn(email, password) {
    await adopt(toSession(await request("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password } })));
  }

  /** The page that links in emails come back to: the top of the site. */
  function homeUrl() {
    if (!g.location.protocol.startsWith("http")) return "";
    const sub = g.document.body.dataset.page;
    const url = new g.URL(sub ? "../" : "./", g.location.href);
    return `?redirect_to=${encodeURIComponent(url.origin + url.pathname)}`;
  }

  /** Returns "in" if signed in straight away, or "confirm" if an email has to be confirmed first. */
  async function signUp(email, password) {
    const r = await request(`/auth/v1/signup${homeUrl()}`, { method: "POST", body: { email, password } });
    if (!r.access_token) return "confirm";
    await adopt(toSession(r));
    return "in";
  }

  const recover = (email) => request(`/auth/v1/recover${homeUrl()}`, { method: "POST", body: { email } });

  const setPassword = (password) => locked(async () => {
    await request("/auth/v1/user", { method: "PUT", token: await accessToken(), body: { password } });
  });

  /** Returns false, and stays signed in, if some progress could not be saved first (unless `force`). */
  async function signOut(force) {
    const done = await locked(async () => {
      if (!meta()) return true;
      await syncUnlocked();
      P.load();
      if (!force && unsaved()) return false;
      const session = meta().session;
      leaveAccount();
      if (session) request("/auth/v1/logout?scope=local", { method: "POST", token: session.access_token }).catch(() => {});
      return true;
    });
    if (done) setStatus("idle");
    refresh(true);
    return done;
  }

  /** Adds the progress made signed out to the account, once. */
  async function addGuest() {
    await locked(async () => {
      const m = meta(), guest = read(GUEST);
      if (!m || !m.offerGuest || !guest) return;
      P.load();
      P.replace(withSlice(P.raw(), merge(empty(), slice(guest), slice(P.raw()))));
      patchMeta({ offerGuest: false, addingGuest: true });
      await syncUnlocked();
    });
    refresh(true);
  }
  const keepSeparate = () => { patchMeta({ offerGuest: false }); refresh(true); };

  // ---------- screens ----------
  const form = { mode: "signin", email: "", password: "", busy: false, note: "", error: "", unsaved: false };

  const MESSAGES = {
    invalid_credentials: "The email or password is wrong.",
    email_not_confirmed: "Confirm your email first: open the link that was sent to you.",
    over_email_send_rate_limit: "Too many emails have been sent just now. Try again later.",
    email_address_not_authorized: "This site cannot send email to that address yet. Tell the site owner.",
    user_already_exists: "That email already has an account. Sign in instead.",
  };
  const explain = (e) => (e.offline ? "You seem to be offline. Try again when you are connected." : MESSAGES[e.code] || e.message);

  async function submit(event) {
    event.preventDefault();
    if (form.busy) return;
    const email = form.email.trim(), password = form.password;
    Object.assign(form, { busy: true, note: "", error: "" });
    refresh(true);
    try {
      if (form.mode === "signup") {
        if ((await signUp(email, password)) === "confirm") {
          form.mode = "signin";
          form.note = "Check your email and open the confirmation link, then sign in here. If you already have an account, just sign in.";
        }
      } else if (form.mode === "forgot") {
        await recover(email);
        form.note = "If that email has an account, a link to set a new password is on its way.";
      } else if (form.mode === "newpass") {
        await setPassword(password);
        form.mode = "signin";
        form.note = "Your password has been changed.";
      } else await signIn(email, password);
      form.password = "";
    } catch (e) { form.error = explain(e); }
    form.busy = false;
    refresh(true);
  }

  function screen() {
    const h = AT.ui.h;
    const m = meta();
    const signedIn = !!(m && m.session);
    const mode = form.mode;
    const to = (next) => () => { Object.assign(form, { mode: next, note: "", error: "", password: "" }); refresh(true); };
    const input = (label, name, type, autocomplete, min) => h("label", { class: "meta" }, label,
      h("input", { class: "field text", id: "account-" + name, name, type, autocomplete, required: true, minlength: min, value: form[name],
        oninput: (e) => { form[name] = e.target.value; } }));
    const messages = [
      form.error && h("div", { class: "alert", role: "alert" }, form.error),
      form.note && h("p", { class: "note ok", role: "status" }, form.note),
    ];

    if (signedIn && mode !== "newpass") {
      const out = async (force) => { form.unsaved = !(await signOut(force)); if (!form.unsaved) form.note = ""; refresh(true); };
      return h("div", { class: "account" },
        h("div", { class: "lead" }, h("h2", null, "Your account"), h("p", null, `Signed in as ${m.email}.`)),
        messages,
        m.offerGuest && h("section", { class: "panel offer" },
          h("h3", null, "Add the progress already on this browser?"),
          h("p", null, "There are results here from before you signed in. Only add them if they are yours."),
          h("div", { class: "actions" },
            h("button", { class: "btn primary", onclick: addGuest }, "Yes, add it to my account"),
            h("button", { class: "btn", onclick: keepSeparate }, "No, keep it separate"))),
        h("section", { class: "panel" },
          h("p", { id: "account-status", role: "status" }, status.text || "Signed in"),
          m.lastSync && h("p", { class: "note" }, `Last saved ${new Date(m.lastSync).toLocaleString("en-GB")}`),
          h("div", { class: "actions" },
            h("button", { class: "btn", onclick: () => sync().then(() => refresh(true)) }, "Save now"),
            h("button", { class: "btn", onclick: to("newpass") }, "Change password"),
            h("button", { class: "btn", onclick: () => out(false) }, "Sign out")),
          form.unsaved && h("div", { class: "alert unsaved", role: "alert" },
            h("p", null, "Some progress has not reached your account. Signing out now will lose it."),
            h("button", { class: "btn danger", onclick: () => out(true) }, "Sign out anyway"))),
        h("p", { class: "note" }, "On a shared computer, sign out when you finish."));
    }

    const title = { signin: "Sign in", signup: "Create an account", forgot: "Reset your password", newpass: "Set a new password" }[mode];
    return h("div", { class: "account" },
      h("div", { class: "lead" }, h("h2", null, title),
        h("p", null, "An account is optional: everything works without one. Sign in to keep your progress and use it on other devices.")),
      m && !signedIn && h("div", { class: "alert" },
        h("p", null, `The sign-in for ${m.email} has ended. Sign in again to keep saving.`),
        h("button", { class: "btn small", onclick: () => signOut(true) }, "Sign out and remove that progress from this browser")),
      messages,
      h("form", { class: "panel account-form", onsubmit: submit },
        mode !== "newpass" && input("Email", "email", "email", "email"),
        mode !== "forgot" && input(mode === "newpass" ? "New password" : "Password", "password", "password",
          mode === "signin" ? "current-password" : "new-password", mode === "signin" ? false : 8),
        h("div", { class: "actions" },
          h("button", { class: "btn primary", type: "submit", disabled: form.busy },
            form.busy ? "Please wait..." : { signin: "Sign in", signup: "Create account", forgot: "Send reset link", newpass: "Save password" }[mode]))),
      h("div", { class: "actions" },
        mode !== "signin" && h("button", { class: "btn", onclick: to("signin") }, signedIn ? "Cancel" : "I already have an account"),
        mode === "signin" && h("button", { class: "btn", onclick: to("signup") }, "Create an account"),
        mode === "signin" && h("button", { class: "btn", onclick: to("forgot") }, "Forgot password?")),
      h("p", { class: "note" }, "Signing in stores your email address and practice results online (with Supabase). Use a password you do not use anywhere else."));
  }

  // ---------- page furniture ----------
  /** The strip under the header. Hidden during questions so it cannot interrupt a test. */
  function chrome(current) {
    const doc = g.document;
    if (!doc || !AT.ui) return;
    let bar = doc.getElementById("account-bar");
    if (!bar) {
      bar = doc.createElement("div");
      bar.id = "account-bar";
      bar.className = "wrap account-bar";
      doc.querySelector("header").after(bar);
    }
    bar.hidden = current === "question" || current === "account";
    const m = meta();
    const text = m && m.session ? `${m.email} · ${status.text || "Signed in"}` : m ? "Your sign-in has ended." : "";
    const label = m && m.session ? (m.offerGuest ? "Finish setting up" : "Account") : m ? "Sign in again" : "Sign In to save your progress";
    const key = `${text}|${label}`;
    if (bar.dataset.key === key) return;
    bar.dataset.key = key;
    const h = AT.ui.h;
    bar.replaceChildren(...[text && h("span", { class: "meta" }, text),
      h("button", { class: "btn small" + (m && m.session ? "" : " primary"), onclick: () => AT.ui.go("account") }, label)].filter(Boolean));
  }

  /** Updates the strip, and redraws the page if `redraw` and it is safe to. */
  function refresh(redraw) {
    if (!AT.ui) return;
    const current = AT.ui.state.screen;
    chrome(current);
    const line = g.document && g.document.getElementById("account-status");
    if (line && status.text) line.textContent = status.text;
    // Never redraw under someone's feet during a question or while they are reading or typing elsewhere.
    if (redraw && ["account", "home", "progress", "groups", "review"].includes(current)) AT.ui.render();
  }

  const signedIn = () => !!(meta() && meta().session);

  AT.account = { merge, slice, empty, signIn, signUp, signOut, sync, addGuest, keepSeparate, signedIn, chrome,
    label: () => (signedIn() ? "Saved in this browser and your account" : "Saved in this browser") };
  if (AT.extraScreens) AT.extraScreens.account = screen;

  // ---------- start ----------
  P.onChange(soon);
  if (g.addEventListener) {
    // Another tab saved or signed in or out: pick up its data before this tab writes over it.
    g.addEventListener("storage", (e) => { if (e.key === null || e.key === META || e.key === P.key) { P.load(); refresh(e.key === META); } });
    g.addEventListener("online", () => sync());
  }
  if (g.document && g.document.addEventListener) g.document.addEventListener("visibilitychange", () => { if (signedIn()) sync(); });

  // Coming back from a link in a confirmation or password email.
  const params = new g.URLSearchParams(((g.location && g.location.hash) || "").slice(1));
  if (params.get("access_token") || params.get("error_description")) {
    g.history.replaceState(null, "", g.location.pathname + g.location.search + "#account");
    if (params.get("error_description")) form.error = "That email link did not work or has expired. Ask for a new one.";
    else {
      const token = params.get("access_token");
      request("/auth/v1/user", { token })
        .then((user) => adopt(toSession({ access_token: token, refresh_token: params.get("refresh_token"), expires_in: params.get("expires_in"), user })))
        .then(() => { if (params.get("type") === "recovery") form.mode = "newpass"; refresh(true); })
        .catch((e) => { form.error = explain(e); refresh(true); });
    }
  } else if (signedIn()) sync();
})(typeof window !== "undefined" ? window : globalThis);
