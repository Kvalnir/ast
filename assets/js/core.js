/* core.js — grid model, units, peers, candidate maths, solver. */
(function (root) {
  'use strict';

  const ROWS = [], COLS = [], BOXES = [];
  for (let r = 0; r < 9; r++) { const u = []; for (let c = 0; c < 9; c++) u.push(r * 9 + c); ROWS.push(u); }
  for (let c = 0; c < 9; c++) { const u = []; for (let r = 0; r < 9; r++) u.push(r * 9 + c); COLS.push(u); }
  for (let br = 0; br < 3; br++) for (let bc = 0; bc < 3; bc++) {
    const u = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) u.push((br * 3 + r) * 9 + bc * 3 + c);
    BOXES.push(u);
  }
  const UNITS = ROWS.concat(COLS, BOXES);

  const PEERS = [];
  for (let i = 0; i < 81; i++) PEERS.push(new Set());
  UNITS.forEach(u => u.forEach(a => u.forEach(b => { if (a !== b) PEERS[a].add(b); })));

  const rowOf = i => (i / 9) | 0;
  const colOf = i => i % 9;
  const boxOf = i => (((i / 9) | 0) / 3 | 0) * 3 + ((i % 9) / 3 | 0);
  const cellName = i => 'r' + (rowOf(i) + 1) + 'c' + (colOf(i) + 1);
  const unitName = u => {
    if (u === null || u === undefined) return '';
    const rows = new Set(u.map(rowOf)), cols = new Set(u.map(colOf)), boxes = new Set(u.map(boxOf));
    if (rows.size === 1) return 'row ' + (rowOf(u[0]) + 1);
    if (cols.size === 1) return 'column ' + (colOf(u[0]) + 1);
    if (boxes.size === 1) return 'box ' + (boxOf(u[0]) + 1);
    return '';
  };

  function parse(str) {
    const g = [];
    for (let i = 0; i < 81; i++) {
      const ch = str[i];
      g.push(ch === '.' || ch === '0' ? 0 : +ch);
    }
    return g;
  }

  /* Candidates implied purely by placed digits — what Autofill would produce. */
  function baseCandidates(grid) {
    const cand = [];
    for (let i = 0; i < 81; i++) {
      if (grid[i]) { cand.push(new Set()); continue; }
      const s = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      PEERS[i].forEach(p => { if (grid[p]) s.delete(grid[p]); });
      cand.push(s);
    }
    return cand;
  }

  /* Backtracking solver. limit=2 lets us test uniqueness. */
  function solve(grid, limit) {
    limit = limit || 1;
    const g = grid.slice();
    const found = [];
    function optionsFor(i) {
      const used = new Set();
      PEERS[i].forEach(p => { if (g[p]) used.add(g[p]); });
      const out = [];
      for (let d = 1; d <= 9; d++) if (!used.has(d)) out.push(d);
      return out;
    }
    function rec() {
      let best = -1, bestOpts = null;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const o = optionsFor(i);
        if (o.length === 0) return false;
        if (!bestOpts || o.length < bestOpts.length) { best = i; bestOpts = o; if (o.length === 1) break; }
      }
      if (best === -1) { found.push(g.slice()); return found.length >= limit; }
      for (const d of bestOpts) {
        g[best] = d;
        if (rec()) { g[best] = 0; return true; }
        g[best] = 0;
      }
      return false;
    }
    rec();
    return found;
  }

  /* The geometry overlay: a technique's `lines` — [[a, b, style], ...] over
     cell indexes, style 'lead' (solid) or 'cross' (dashed) — drawn into an SVG
     with a 9x9 viewBox. The trainer and the check board both draw with this,
     so a skyscraper is the same picture on either.

     Colour first, because it is the rule the generated pages share (mini.py,
     which draws every figure the site does not draw live — change one, change
     the other). Every solid segment is a pair, or a strong link, and gets its
     own ink in drawing order, cycling through the six --link-* colours. A
     dashed segment is a crossing line, and a crossing line joins two pairs —
     so it is drawn in two halves, each in the ink of the pair at its own end,
     meeting in the middle. A dashed segment touching one solid takes that
     ink whole; touching none, the first ink.

     A connector runs through the centre of every square between its ends,
     which is exactly where the 4, 5 and 6 notes sit — so both how it is
     drawn and where it stops are about staying out of the digits' way.

     How: two strokes, a pale casing first and the ink over it, so the line
     has an edge wherever it crosses something. Both classes carry `cross`
     on a dashed link so the casing is dashed to match — see .geo2 line.case
     in the stylesheet.

     Where: a free end stops short of the centre it points at. Drawn the
     whole way, the cap landed on the middle note of a pattern square — the
     digit the line exists to talk about — and buried it. An end another
     segment also lands on is drawn full length instead, because that
     junction IS the geometry: an X-Wing whose corners do not meet is not a
     rectangle. The midpoint where two halves of a dashed line meet is never
     inset: it is the middle of a line, not an end. */
  const PALETTE = 6;
  function lineColours(lines) {
    const solid = [];
    lines.forEach((l, k) => { if (l[2] !== 'cross') solid.push(k); });
    const own = new Map(solid.map((k, n) => [k, n % PALETTE]));
    const at = new Map();
    solid.forEach(k => {
      if (!at.has(lines[k][0])) at.set(lines[k][0], own.get(k));
      if (!at.has(lines[k][1])) at.set(lines[k][1], own.get(k));
    });
    return lines.map(([a, b], k) => {
      if (own.has(k)) return [own.get(k), own.get(k)];
      let ca = at.get(a), cb = at.get(b);
      if (ca === undefined && cb === undefined) ca = cb = 0;
      if (ca === undefined) ca = cb;
      if (cb === undefined) cb = ca;
      return [ca, cb];
    });
  }

  function drawGeo(svg, lines) {
    svg.innerHTML = '';
    if (!lines || !lines.length) return;
    const ends = new Map();
    lines.forEach(([a, b]) => {
      ends.set(a, (ends.get(a) || 0) + 1);
      ends.set(b, (ends.get(b) || 0) + 1);
    });
    const inks = lineColours(lines);
    lines.forEach(([a, b, style], k) => {
      const dashed = style === 'cross';
      let x1 = colOf(a) + 0.5, y1 = rowOf(a) + 0.5,
          x2 = colOf(b) + 0.5, y2 = rowOf(b) + 0.5;
      const len = Math.hypot(x2 - x1, y2 - y1) || 1;
      /* .42 of a cell clears the outer column of pencil marks — the 3/6/9
         or 1/4/7 stack — which is as far in as an end ever needs to sit. A
         segment between neighbouring squares cannot afford that twice, and
         keeps whatever is left over .4. */
      const inset = Math.min(0.42, (len - 0.4) / 2);
      if (inset > 0) {
        const ux = (x2 - x1) / len * inset, uy = (y2 - y1) / len * inset;
        if (ends.get(a) === 1) { x1 += ux; y1 += uy; }
        if (ends.get(b) === 1) { x2 -= ux; y2 -= uy; }
      }
      const [ca, cb] = inks[k];
      /* Each half starts at its own end, so the dashes set out from each pair
         and meet in the middle rather than running through it. */
      const parts = ca === cb
        ? [[x1, y1, x2, y2, ca]]
        : [[x1, y1, (x1 + x2) / 2, (y1 + y2) / 2, ca], [x2, y2, (x1 + x2) / 2, (y1 + y2) / 2, cb]];
      /* Casings before inks, so the second half's casing cannot paint over
         the first half's ink where they meet. */
      [true, false].forEach(casing => parts.forEach(([px1, py1, px2, py2, ink]) => {
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', px1); l.setAttribute('y1', py1);
        l.setAttribute('x2', px2); l.setAttribute('y2', py2);
        l.setAttribute('class', casing
          ? 'case' + (dashed ? ' cross' : '')
          : (dashed ? 'cross ' : '') + 'c' + ink);
        svg.appendChild(l);
      }));
    });
  }

  root.SudokuCore = {
    ROWS, COLS, BOXES, UNITS, PEERS,
    rowOf, colOf, boxOf, cellName, unitName,
    parse, baseCandidates, solve,
    lineColours, drawGeo
  };
})(typeof window !== 'undefined' ? window : globalThis);
