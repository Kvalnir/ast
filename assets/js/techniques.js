/* techniques.js — detectors. Each returns findings shaped for the hint ladder:
   { id, name, family, rank, digits, cells, pivot, elims:[{cell,digit}],
     units:[cellArray], lines:[[a,b,style]], region, why }                */
(function (root) {
  'use strict';
  const C = root.SudokuCore;
  const { ROWS, COLS, BOXES, UNITS, PEERS, rowOf, colOf, boxOf, cellName, unitName } = C;

  const combos = (arr, k) => {
    const out = [];
    (function rec(start, cur) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); }
    })(0, []);
    return out;
  };
  const list = cells => cells.map(cellName).join(', ');

  /* Candidates the detectors reason over: the player's notes where they exist,
     otherwise the candidates implied by placed digits. */
  function effective(grid, notes) {
    const base = C.baseCandidates(grid);
    const out = [];
    for (let i = 0; i < 81; i++) {
      if (grid[i]) { out.push(new Set()); continue; }
      out.push(notes && notes[i] && notes[i].size ? new Set(notes[i]) : base[i]);
    }
    return out;
  }

  /* ---------------- singles ---------------- */
  function nakedSingles(g, cand) {
    const out = [];
    for (let i = 0; i < 81; i++) {
      if (g[i] || cand[i].size !== 1) continue;
      const d = [...cand[i]][0];
      out.push({
        id: 'naked_single', name: 'Naked single', family: 'Single', rank: 1,
        digits: [d], cells: [i], elims: [], placement: { cell: i, digit: d },
        units: [], lines: [], region: cellName(i),
        why: cellName(i) + ' has only one candidate left, so it must be ' + d + '.'
      });
    }
    return out;
  }

  function hiddenSingles(g, cand) {
    const out = [];
    for (const u of UNITS) {
      for (let d = 1; d <= 9; d++) {
        if (u.some(i => g[i] === d)) continue;
        const spots = u.filter(i => !g[i] && cand[i].has(d));
        if (spots.length === 1) {
          out.push({
            id: 'hidden_single', name: 'Hidden single', family: 'Single', rank: 2,
            digits: [d], cells: spots, elims: [], placement: { cell: spots[0], digit: d },
            units: [u], lines: [], region: unitName(u),
            why: 'In ' + unitName(u) + ', ' + d + ' can only go in ' + cellName(spots[0]) + '.'
          });
        }
      }
    }
    return out;
  }

  /* ---------------- locked candidates ---------------- */
  function locked(g, cand) {
    const out = [];
    BOXES.forEach((b, bi) => {
      for (let d = 1; d <= 9; d++) {
        const spots = b.filter(i => !g[i] && cand[i].has(d));
        if (spots.length < 2) continue;
        for (const line of [ROWS[rowOf(spots[0])], COLS[colOf(spots[0])]]) {
          if (!spots.every(i => line.includes(i))) continue;
          const elims = line.filter(i => !b.includes(i) && !g[i] && cand[i].has(d)).map(i => ({ cell: i, digit: d }));
          if (elims.length) out.push({
            id: 'pointing', name: 'Pointing pair', family: 'Interaction', rank: 3,
            digits: [d], cells: spots, elims, units: [b, line],
            lines: [[spots[0], spots[spots.length - 1], 'lead']],
            region: 'box ' + (bi + 1),
            why: 'Every remaining ' + d + ' in box ' + (bi + 1) + ' sits in ' + unitName(line) +
                 ' (' + list(spots) + '), so the box\u2019s ' + d + ' is on that line \u2014 clearing ' + d +
                 ' from the rest of it.'
          });
        }
      }
    });
    for (const line of ROWS.concat(COLS)) {
      for (let d = 1; d <= 9; d++) {
        const spots = line.filter(i => !g[i] && cand[i].has(d));
        if (spots.length < 2) continue;
        const b = BOXES[boxOf(spots[0])];
        if (!spots.every(i => b.includes(i))) continue;
        const elims = b.filter(i => !line.includes(i) && !g[i] && cand[i].has(d)).map(i => ({ cell: i, digit: d }));
        if (elims.length) out.push({
          id: 'claiming', name: 'Claiming', family: 'Interaction', rank: 3,
          digits: [d], cells: spots, elims, units: [line, b],
          lines: [[spots[0], spots[spots.length - 1], 'lead']],
          region: unitName(line),
          why: 'In ' + unitName(line) + ', ' + d + ' can only go in ' + list(spots) +
               ' \u2014 all inside box ' + (boxOf(spots[0]) + 1) + '. So that box\u2019s ' + d +
               ' is on the line, and the rest of the box loses it.'
        });
      }
    }
    return out;
  }

  /* ---------------- subsets ---------------- */
  function nakedSubset(g, cand, size) {
    const out = [];
    for (const u of UNITS) {
      const cells = u.filter(i => !g[i] && cand[i].size >= 2 && cand[i].size <= size);
      for (const combo of combos(cells, size)) {
        const union = new Set();
        combo.forEach(i => cand[i].forEach(d => union.add(d)));
        if (union.size !== size) continue;
        const elims = [];
        u.forEach(i => {
          if (combo.includes(i) || g[i]) return;
          union.forEach(d => { if (cand[i].has(d)) elims.push({ cell: i, digit: d }); });
        });
        if (!elims.length) continue;
        const ds = [...union].sort();
        out.push({
          id: size === 2 ? 'naked_pair' : 'naked_triple',
          name: size === 2 ? 'Naked pair' : 'Naked triple',
          family: 'Subset', rank: size === 2 ? 4 : 6,
          digits: ds, cells: combo, elims, units: [u],
          lines: [[combo[0], combo[combo.length - 1], 'lead']],
          region: unitName(u),
          why: list(combo) + ' in ' + unitName(u) + ' hold only ' + ds.join('/') +
               ' between them, so those ' + size + ' digits are used up there and leave the rest of the unit.'
        });
      }
    }
    return out;
  }

  function hiddenSubset(g, cand, size) {
    const out = [];
    for (const u of UNITS) {
      const free = u.filter(i => !g[i]);
      const digs = [];
      for (let d = 1; d <= 9; d++) if (free.some(i => cand[i].has(d))) digs.push(d);
      for (const combo of combos(digs, size)) {
        const spots = new Set();
        combo.forEach(d => free.forEach(i => { if (cand[i].has(d)) spots.add(i); }));
        if (spots.size !== size) continue;
        const elims = [];
        spots.forEach(i => cand[i].forEach(d => { if (!combo.includes(d)) elims.push({ cell: i, digit: d }); }));
        if (!elims.length) continue;
        const cells = [...spots].sort((a, b) => a - b);
        out.push({
          id: size === 2 ? 'hidden_pair' : 'hidden_triple',
          name: size === 2 ? 'Hidden pair' : 'Hidden triple',
          family: 'Subset', rank: 5,
          digits: combo, cells, elims, units: [u],
          lines: [[cells[0], cells[cells.length - 1], 'lead']],
          region: unitName(u),
          why: 'In ' + unitName(u) + ', ' + combo.join(' and ') + ' can only go in ' + list(cells) +
               '. Those cells are reserved for them, so every other candidate there goes.'
        });
      }
    }
    return out;
  }

  /* ---------------- fish ---------------- */
  function fish(g, cand, size) {
    const out = [];
    const name = size === 2 ? 'X-Wing' : 'Swordfish';
    const id = size === 2 ? 'xwing' : 'swordfish';
    for (let d = 1; d <= 9; d++) {
      for (const [lines, other, kind] of [[ROWS, COLS, 'row'], [COLS, ROWS, 'column']]) {
        const avail = [];
        lines.forEach((line, li) => {
          const spots = line.filter(i => !g[i] && cand[i].has(d));
          if (spots.length >= 2 && spots.length <= size) avail.push({ li, spots });
        });
        for (const combo of combos(avail, size)) {
          const cross = new Set();
          combo.forEach(x => x.spots.forEach(i => cross.add(kind === 'row' ? colOf(i) : rowOf(i))));
          if (cross.size !== size) continue;
          const base = [].concat(...combo.map(x => x.spots));
          const elims = [];
          cross.forEach(x => other[x].forEach(i => {
            if (base.includes(i) || g[i]) return;
            if (cand[i].has(d)) elims.push({ cell: i, digit: d });
          }));
          if (!elims.length) continue;
          /* base lines solid, crossing lines dashed — same geometry as the lesson figures */
          const segs = [];
          combo.forEach(x => segs.push([x.spots[0], x.spots[x.spots.length - 1], 'lead']));
          cross.forEach(x => {
            const onCross = base.filter(i => (kind === 'row' ? colOf(i) : rowOf(i)) === x)
                                .sort((p, q) => p - q);
            if (onCross.length > 1) segs.push([onCross[0], onCross[onCross.length - 1], 'cross']);
          });
          const units = combo.map(x => lines[x.li]);
          const crossName = kind === 'row' ? 'columns' : 'rows';
          out.push({
            id, name, family: 'Single digit', rank: size === 2 ? 7 : 9,
            digits: [d], cells: base, elims, units,
            lines: segs, region: kind + 's ' + combo.map(x => x.li + 1).join(', '),
            soloDigit: d,
            why: 'The ' + d + 's in ' + kind + 's ' + combo.map(x => x.li + 1).join(', ') +
                 ' are confined to ' + crossName + ' ' + [...cross].sort((a, b) => a - b).map(x => x + 1).join(', ') +
                 '. Those ' + kind + 's need ' + size + ' ' + d + '\u2019s and those ' + crossName +
                 ' can supply exactly ' + size + ', so every other ' + d + ' in them goes.'
          });
        }
      }
    }
    return out;
  }

  /* ---------------- skyscraper ---------------- */
  function skyscraper(g, cand) {
    const out = [];
    for (let d = 1; d <= 9; d++) {
      for (const [lines, kind] of [[ROWS, 'row'], [COLS, 'column']]) {
        const strong = [];
        lines.forEach((line, li) => {
          const spots = line.filter(i => !g[i] && cand[i].has(d));
          if (spots.length === 2) strong.push({ li, spots });
        });
        for (const [A, B] of combos(strong, 2)) {
          for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) {
            const a1 = A.spots[k], b1 = A.spots[1 - k];
            const a2 = B.spots[j], b2 = B.spots[1 - j];
            const aligned = kind === 'row' ? colOf(a1) === colOf(a2) : rowOf(a1) === rowOf(a2);
            const offset = kind === 'row' ? colOf(b1) !== colOf(b2) : rowOf(b1) !== rowOf(b2);
            if (!aligned || !offset) continue;
            if (boxOf(b1) === boxOf(b2)) continue;
            const elims = [];
            for (let i = 0; i < 81; i++) {
              if (g[i] || !cand[i].has(d)) continue;
              if ([a1, a2, b1, b2].includes(i)) continue;
              if (PEERS[b1].has(i) && PEERS[b2].has(i)) elims.push({ cell: i, digit: d });
            }
            if (!elims.length) continue;
            out.push({
              id: 'skyscraper', name: 'Skyscraper', family: 'Single digit', rank: 8,
              digits: [d], cells: [a1, a2, b1, b2], roof: [b1, b2], elims,
              units: [lines[A.li], lines[B.li]],
              lines: [[a1, b1, 'lead'], [a2, b2, 'lead'], [a1, a2, 'cross']],
              region: kind + 's ' + (A.li + 1) + ' and ' + (B.li + 1),
              soloDigit: d,
              why: kind.charAt(0).toUpperCase() + kind.slice(1) + 's ' + (A.li + 1) + ' and ' + (B.li + 1) +
                   ' each have just two ' + d + 's, and they share ' +
                   (kind === 'row' ? 'column ' + (colOf(a1) + 1) : 'row ' + (rowOf(a1) + 1)) +
                   '. Both cannot be the ' + d + ' there, so at least one of ' + cellName(b1) + ' / ' +
                   cellName(b2) + ' is a ' + d + ' \u2014 and anything seeing both loses it.'
            });
          }
        }
      }
    }
    return out;
  }

  /* ---------------- XY-Wing ---------------- */
  function xyWing(g, cand) {
    const out = [];
    const bi = [];
    for (let i = 0; i < 81; i++) if (!g[i] && cand[i].size === 2) bi.push(i);
    for (const p of bi) {
      const [X, Y] = [...cand[p]].sort();
      for (const a of bi) {
        if (a === p || !PEERS[p].has(a) || !cand[a].has(X)) continue;
        const restA = [...cand[a]].filter(d => d !== X);
        if (restA.length !== 1) continue;
        const Z = restA[0];
        if (Z === Y) continue;
        for (const b of bi) {
          if (b === p || b === a || !PEERS[p].has(b)) continue;
          if (!(cand[b].has(Y) && cand[b].has(Z) && cand[b].size === 2)) continue;
          const elims = [];
          for (let i = 0; i < 81; i++) {
            if (g[i] || [p, a, b].includes(i) || !cand[i].has(Z)) continue;
            if (PEERS[a].has(i) && PEERS[b].has(i)) elims.push({ cell: i, digit: Z });
          }
          if (!elims.length) continue;
          out.push({
            id: 'xy_wing', name: 'XY-Wing', family: 'Chain', rank: 10,
            digits: [Z], cells: [p, a, b], pivot: p, wings: [a, b], elims,
            units: [], lines: [[p, a, 'lead'], [p, b, 'lead']],
            region: 'hinge ' + cellName(p),
            why: 'Hinge ' + cellName(p) + ' is ' + X + '/' + Y + ', seeing ' + cellName(a) + ' (' + X + '/' + Z +
                 ') and ' + cellName(b) + ' (' + Y + '/' + Z + '). Either way the hinge falls, one wing must be ' +
                 Z + ' \u2014 so nothing seeing both wings can be ' + Z + '.'
          });
        }
      }
    }
    return out;
  }

  /* ---------------- aggregate ---------------- */
  function findAll(grid, notes) {
    const cand = effective(grid, notes);
    let all = [].concat(
      nakedSingles(grid, cand), hiddenSingles(grid, cand), locked(grid, cand),
      nakedSubset(grid, cand, 2), hiddenSubset(grid, cand, 2), nakedSubset(grid, cand, 3),
      fish(grid, cand, 2), skyscraper(grid, cand), fish(grid, cand, 3), xyWing(grid, cand)
    );
    // de-duplicate identical findings (same id, same cells, same elims)
    const seen = new Set();
    all = all.filter(f => {
      const key = f.id + '|' + f.cells.slice().sort().join(',') + '|' +
                  f.elims.map(e => e.cell + ':' + e.digit).sort().join(',') + '|' + f.digits.join(',');
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });
    all.sort((a, b) => a.rank - b.rank || b.elims.length - a.elims.length);
    return { findings: all, candidates: cand };
  }

  root.SudokuTech = { findAll, effective };
})(typeof window !== 'undefined' ? window : globalThis);
