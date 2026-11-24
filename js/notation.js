/* Draws a one-bar rhythm as notation on a single-line rhythm stave (SVG).
   Accepts a list of note lengths in crotchet beats (0.5 quaver, 1 crotchet, 1.5 dotted crotchet,
   2 minim, 3 dotted minim), taken as 4/4, or { lens, time } with time "4/4", "3/4", "6/8" or "9/8".
   Quavers in the same beat are beamed: pairs in simple time, up to three in compound time. */
(function (g) {
  const AT = g.AT;
  const W = 260, H = 72, LINE = 46, STEM = 30;
  const X0 = 46; // first note x

  function rhythmSVG(pic, label) {
    const pattern = Array.isArray(pic) ? pic : pic.lens;
    const time = (!Array.isArray(pic) && pic.time) || "4/4";
    const [top, bottom] = time.split("/");
    const beatLen = bottom === "8" ? 1.5 : 1;

    const parts = [];
    parts.push(`<line x1="6" y1="${LINE}" x2="${W - 6}" y2="${LINE}" stroke="currentColor" stroke-width="1.2"/>`);
    parts.push(`<text x="20" y="${LINE - 4}" font-family="Georgia,serif" font-weight="700" font-size="20" text-anchor="middle" fill="currentColor">${top}</text>`);
    parts.push(`<text x="20" y="${LINE + 18}" font-family="Georgia,serif" font-weight="700" font-size="20" text-anchor="middle" fill="currentColor">${bottom}</text>`);
    parts.push(`<line x1="${W - 6}" y1="${LINE - 14}" x2="${W - 6}" y2="${LINE + 14}" stroke="currentColor" stroke-width="1.4"/>`);

    // engraving-style spacing: longer notes get more room, but not in strict proportion
    const room = (len) => 1 + 1.4 * Math.sqrt(len);
    const totalRoom = pattern.reduce((n, len) => n + room(len), 0);
    const scale = (W - 18 - X0) / totalRoom;
    const notes = [];
    let pos = 0, x = X0;
    for (const len of pattern) { notes.push({ len, pos, x, beat: Math.floor(pos / beatLen + 1e-9) }); pos += len; x += room(len) * scale; }

    // beam groups: runs of quavers inside one beat
    const groups = [];
    for (let i = 0; i < notes.length; i++) {
      if (notes[i].len !== 0.5) continue;
      const run = [notes[i]];
      while (notes[i + 1] && notes[i + 1].len === 0.5 && notes[i + 1].beat === notes[i].beat) run.push(notes[++i]);
      if (run.length > 1) { run.forEach((n) => { n.beamed = true; }); groups.push(run); }
    }

    const stemTop = LINE - STEM;
    for (const n of notes) {
      const hollow = n.len >= 2;
      const hx = n.x, sx = hx + 5.2;
      parts.push(`<ellipse cx="${hx}" cy="${LINE}" rx="6" ry="4.3" transform="rotate(-20 ${hx} ${LINE})" ` +
        (hollow ? `fill="none" stroke="currentColor" stroke-width="1.8"` : `fill="currentColor"`) + "/>");
      parts.push(`<line x1="${sx}" y1="${LINE - 1}" x2="${sx}" y2="${stemTop}" stroke="currentColor" stroke-width="1.5"/>`);
      if (n.len === 1.5 || n.len === 3) parts.push(`<circle cx="${hx + 11}" cy="${LINE - 4}" r="2" fill="currentColor"/>`);
      if (n.len === 0.5 && !n.beamed) parts.push(`<path d="M${sx} ${stemTop} c 1 6 10 9 7 19 c 1 -7 -4 -10 -7 -12 z" fill="currentColor"/>`);
    }
    for (const run of groups) {
      const a = run[0].x + 5.2, b = run[run.length - 1].x + 5.2;
      parts.push(`<rect x="${a - 0.75}" y="${stemTop}" width="${b - a + 1.5}" height="4.5" fill="currentColor"/>`);
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="rhythm-pic" role="img" aria-label="${(label || "rhythm") + " in " + time}">${parts.join("")}</svg>`;
    const t = document.createElement("template");
    t.innerHTML = svg;
    return t.content.firstChild;
  }

  AT.notation = { rhythmSVG };
})(typeof window !== "undefined" ? window : globalThis);
