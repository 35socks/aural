/* Draws a one-bar rhythm as written music: time signature, notes, dots, flags, beams and bar line. */
(function (g) {
  const AT = g.AT;
  const NS = "http://www.w3.org/2000/svg";
  const LINE = 40, TOP = 10, HEIGHT = 58;

  // Note lengths are in crotchet beats. `flags` is also the number of beams.
  const SHAPES = {
    0.25: { flags: 2 }, 0.5: { flags: 1 }, 0.75: { flags: 1, dot: true }, 1: {}, 1.5: { dot: true },
    2: { open: true }, 3: { open: true, dot: true },
  };

  function mk(tag, attrs) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  /** Splits note indexes into beam groups: short notes that start inside the same main beat. */
  function beamGroups(pattern, beat) {
    const groups = [];
    let t = 0, current = null, currentBeat = -1;
    pattern.forEach((len, i) => {
      const inBeat = Math.floor(t / beat + 1e-6);
      if (len < 1) {
        if (!current || inBeat !== currentBeat) { current = []; groups.push(current); currentBeat = inBeat; }
        current.push(i);
      } else current = null;
      t += len;
    });
    return groups;
  }

  /** `metre` is a label such as "6/8"; `beat` is the main beat in crotchets (1, or 1.5 in compound time). */
  function rhythm(metre, beat, pattern) {
    const xs = [];
    let x = 46;
    for (const len of pattern) { xs.push(x); x += 14 + 24 * Math.sqrt(len); }
    const width = Math.round(x + 8);
    const svg = mk("svg", { viewBox: `0 0 ${width} ${HEIGHT}`, width, height: HEIGHT, class: "notation", "aria-hidden": "true", focusable: "false" });
    const add = (tag, attrs) => svg.appendChild(mk(tag, attrs));
    const line = (x1, y1, x2, y2, w) => add("line", { x1, y1, x2, y2, stroke: "currentColor", "stroke-width": w });

    line(2, LINE, width - 3, LINE, 1);
    metre.split("/").forEach((digit, i) => {
      const t = add("text", { x: 18, y: i ? LINE + 15 : LINE - 2, "text-anchor": "middle", class: "timesig" });
      t.textContent = digit;
    });
    line(width - 3, LINE - 14, width - 3, LINE + 14, 1.5);

    const groups = beamGroups(pattern, beat);
    const beamed = new Set(groups.filter((grp) => grp.length > 1).flat());
    const stemX = (i) => xs[i] + 5.4;

    pattern.forEach((len, i) => {
      const s = SHAPES[len];
      add("ellipse", { cx: xs[i], cy: LINE, rx: 6, ry: 4.4, transform: `rotate(-20 ${xs[i]} ${LINE})`,
        stroke: "currentColor", "stroke-width": s.open ? 2 : 1, fill: s.open ? "none" : "currentColor" });
      line(stemX(i), LINE - 2, stemX(i), TOP, 1.6);
      if (s.dot) add("circle", { cx: xs[i] + 11, cy: LINE - 4, r: 2.1, fill: "currentColor" });
      if (!beamed.has(i)) {
        for (let f = 0; f < (s.flags || 0); f++) {
          const y = TOP + f * 7;
          add("path", { d: `M${stemX(i)} ${y} c7 4 11 8 8 17`, fill: "none", stroke: "currentColor", "stroke-width": 2 });
        }
      }
    });

    const beam = (x1, x2, y) => add("rect", { x: x1 - 0.8, y, width: x2 - x1 + 1.6, height: 4, fill: "currentColor", class: "beam" });
    for (const grp of groups.filter((x) => x.length > 1)) {
      beam(stemX(grp[0]), stemX(grp[grp.length - 1]), TOP);
      // Second beam for semiquavers: joined to a neighbouring semiquaver, otherwise a short stub.
      grp.forEach((i, k) => {
        if (SHAPES[pattern[i]].flags !== 2) return;
        const prev = grp[k - 1], next = grp[k + 1];
        if (next !== undefined && SHAPES[pattern[next]].flags === 2) beam(stemX(i), stemX(next), TOP + 7);
        else if (prev !== undefined && SHAPES[pattern[prev]].flags === 2) return;
        else if (prev !== undefined) beam(stemX(i) - 9, stemX(i), TOP + 7);
        else beam(stemX(i), stemX(i) + 9, TOP + 7);
      });
    }
    return svg;
  }

  /** `pic` is { lens, time }, or a bare list of note lengths in 4/4 (older saved mistakes). */
  function rhythmSVG(pic, label) {
    const lens = Array.isArray(pic) ? pic : pic.lens;
    const time = (!Array.isArray(pic) && pic.time) || "4/4";
    const svg = rhythm(time, time.endsWith("/8") ? 1.5 : 1, lens);
    svg.removeAttribute("aria-hidden");
    svg.setAttribute("role", "img");
    // Older saved labels do not start with the time signature.
    svg.setAttribute("aria-label", !label ? `Rhythm in ${time}` : label.startsWith(time) ? label : `${time}: ${label}`);
    return svg;
  }

  AT.notation = { rhythm, beamGroups, rhythmSVG };
})(typeof window !== "undefined" ? window : globalThis);
