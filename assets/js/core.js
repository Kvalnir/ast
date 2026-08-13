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

  root.SudokuCore = {
    ROWS, COLS, BOXES, UNITS, PEERS,
    rowOf, colOf, boxOf, cellName, unitName,
    parse, baseCandidates, solve
  };
})(typeof window !== 'undefined' ? window : globalThis);
