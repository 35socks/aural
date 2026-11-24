/* Draws a one-bar 4/4 rhythm as notation on a single-line rhythm stave (SVG).
   A pattern is a list of note lengths in crotchet beats: 0.5 quaver, 1 crotchet, 1.5 dotted crotchet,
   2 minim, 3 dotted minim, 4 semibreve. Quaver pairs that start on a beat are beamed together. */
(function (g) {
  const AT = g.AT;
  const W = 260, H = 72, LINE = 46, STEM = 30;
  const X0 = 46; // first note x

  function rhythmSVG(pattern, label) {
    const parts = [];
    // stave line, time signature, end barline
    parts.push(`<line x1="6" y1="${LINE}" x2="${W - 6}" y2="${LINE}" stroke="currentColor" stroke-width="1.2"/>`);
    parts.push(`<text x="20" y="${LINE - 4}" font-family="Georgia,serif" font-weight="700" font-size="20" text-anchor="middle" fill="currentColor">4</text>`);
    parts.push(`<text x="20" y="${LINE + 18}" font-family="Georgia,serif" font-weight="700" font-size="20" text-anchor="middle" fill="currentColor">4</text>`);
    parts.push(`<line x1="${W - 6}" y1="${LINE - 14}" x2="${W - 6}" y2="${LINE + 14}" stroke="currentColor" stroke-width="1.4"/>`);

    // note positions
    // engraving-style spacing: longer notes get more room, but not in strict proportion
    const room = (len) => 1 + 1.4 * Math.sqrt(len);
    const totalRoom = pattern.reduce((n, len) => n + room(len), 0);
    const scale = (W - 18 - X0) / totalRoom;
    const notes = [];
    let pos = 0, x = X0;
    for (const len of pattern) { notes.push({ len, pos, x }); pos += len; x += room(len) * scale; }

    // decide beams: two quavers in a row where the first starts on a whole beat
    for (let i = 0; i < notes.length - 1; i++) {
      const a = notes[i], b = notes[i + 1];
      if (a.len === 0.5 && b.len === 0.5 && Number.isInteger(a.pos) && !a.beam) { a.beam = "start"; b.beam = "end"; b.partner = a; i++; }
    }

    for (const n of notes) {
      const hollow = n.len >= 2;
      const hx = n.x, top = LINE - STEM, sx = hx + 5.2;
      parts.push(`<ellipse cx="${hx}" cy="${LINE}" rx="6" ry="4.3" transform="rotate(-20 ${hx} ${LINE})" ` +
        (hollow ? `fill="none" stroke="currentColor" stroke-width="1.8"` : `fill="currentColor"`) + "/>");
      if (n.len < 4) parts.push(`<line x1="${sx}" y1="${LINE - 1}" x2="${sx}" y2="${top}" stroke="currentColor" stroke-width="1.5"/>`);
      if (n.len === 1.5 || n.len === 3) parts.push(`<circle cx="${hx + 11}" cy="${LINE - 4}" r="2" fill="currentColor"/>`);
      if (n.len === 0.5 && !n.beam) {
        parts.push(`<path d="M${sx} ${top} c 1 6 10 9 7 19 c 1 -7 -4 -10 -7 -12 z" fill="currentColor"/>`);
      }
      if (n.beam === "end") {
        const ax = n.partner.x + 5.2;
        parts.push(`<rect x="${ax - 0.75}" y="${top}" width="${sx - ax + 1.5}" height="4.5" fill="currentColor"/>`);
      }
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="rhythm-pic" role="img" aria-label="${label || "rhythm"}">${parts.join("")}</svg>`;
    const t = document.createElement("template");
    t.innerHTML = svg;
    return t.content.firstChild;
  }

  AT.notation = { rhythmSVG };
})(typeof window !== "undefined" ? window : globalThis);
