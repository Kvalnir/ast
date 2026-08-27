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

  /* ---------------- verify ----------------
     The board's other question, asked the other way round.

     findAll answers "what can I play here?", and every detector past the
     singles bails the moment a pattern kills nothing — a move that changes no
     candidate is not a move. verify() answers "am I reading these squares
     right?", where a pattern that kills nothing is still a pattern correctly
     read. It is exactly the one findAll can never mention, so if the inspector
     ran off findAll it would answer "nothing here" precisely when you had got
     it right, which is the worst thing a confidence check can do.

     So these tests look at shape alone and count the kills afterwards, and
     `kills: []` is a result rather than a rejection. Everything else — which
     patterns are one square away from what you picked — comes off findAll,
     which already knows.                                                     */

  const NAME = {
    naked_single: 'Naked single', hidden_single: 'Hidden single',
    pointing: 'Pointing pair', claiming: 'Claiming',
    naked_pair: 'Naked pair', naked_triple: 'Naked triple',
    hidden_pair: 'Hidden pair', hidden_triple: 'Hidden triple',
    xwing: 'X-Wing', swordfish: 'Swordfish', skyscraper: 'Skyscraper', xy_wing: 'XY-Wing'
  };

  function verify(grid, notes, sel, findings) {
    const cand = effective(grid, notes);
    const filled = sel.filter(i => grid[i]).sort((a, b) => a - b);
    const cells = sel.filter(i => !grid[i]).sort((a, b) => a - b);
    const n = cells.length;
    const shapes = [];
    const seen = new Set();
    const push = o => {
      const key = o.id + '|' + o.cells.join(',') + '|' + o.digits.join(',');
      if (seen.has(key)) return;
      seen.add(key);
      o.name = NAME[o.id];
      shapes.push(o);
    };
    const kill = (arr, d) => arr.filter(i => !grid[i] && !cells.includes(i) && cand[i].has(d))
                                .map(i => ({ cell: i, digit: d }));
    /* Units every selected square is in — the thing a subset needs and the
       commonest thing to have got wrong. */
    const shared = n > 1 ? UNITS.filter(u => cells.every(i => u.includes(i))) : [];
    const allHave = d => n > 0 && cells.every(i => cand[i].has(d));
    const rows = [...new Set(cells.map(rowOf))], cols = [...new Set(cells.map(colOf))],
          boxes = [...new Set(cells.map(boxOf))];

    /* one square: what it holds, and whether it is already forced */
    if (n === 1) {
      const i = cells[0], ds = [...cand[i]].sort((a, b) => a - b);
      if (ds.length === 1) push({
        id: 'naked_single', digits: ds, cells: [i], region: cellName(i), kills: [],
        why: ds[0] + ' is the only candidate left in ' + cellName(i) + ', so that is what it is.'
      });
      ds.forEach(d => UNITS.forEach(u => {
        if (!u.includes(i)) return;
        if (u.filter(x => !grid[x] && cand[x].has(d)).length === 1) push({
          id: 'hidden_single', digits: [d], cells: [i], region: unitName(u), kills: [],
          why: cellName(i) + ' is the only square in ' + unitName(u) + ' that can still take ' + d + '.'
        });
      }));
    }

    /* naked subset: the union of what they hold is as small as their number */
    if (n >= 2 && n <= 3 && shared.length) {
      const union = new Set();
      cells.forEach(i => cand[i].forEach(d => union.add(d)));
      if (union.size === n) {
        const ds = [...union].sort((a, b) => a - b);
        const kills = [];
        shared.forEach(u => ds.forEach(d => kill(u, d).forEach(k => {
          if (!kills.some(x => x.cell === k.cell && x.digit === k.digit)) kills.push(k);
        })));
        push({
          id: n === 2 ? 'naked_pair' : 'naked_triple', digits: ds, cells, kills,
          region: shared.map(unitName).join(' and '),
          why: list(cells) + ' hold only ' + ds.join('/') + ' between them, so those ' + n +
               ' digits are used up in ' + shared.map(unitName).join(' and ') + '.'
        });
      }
    }

    /* hidden subset: digits with nowhere else in the unit to go */
    if (n >= 2 && n <= 3) shared.forEach(u => {
      const ds = [];
      for (let d = 1; d <= 9; d++) {
        const spots = u.filter(i => !grid[i] && cand[i].has(d));
        if (spots.length && spots.every(i => cells.includes(i))) ds.push(d);
      }
      if (ds.length !== n || !cells.every(i => ds.some(d => cand[i].has(d)))) return;
      const kills = [];
      cells.forEach(i => cand[i].forEach(d => { if (!ds.includes(d)) kills.push({ cell: i, digit: d }); }));
      push({
        id: n === 2 ? 'hidden_pair' : 'hidden_triple', digits: ds, cells, kills,
        region: unitName(u),
        why: 'In ' + unitName(u) + ', ' + ds.join(' and ') + ' can only go in ' + list(cells) +
             ' — so those squares are reserved for them.'
      });
    });

    /* pointing and claiming: one digit, one box, one line */
    if (n >= 2 && n <= 3 && boxes.length === 1 && (rows.length === 1 || cols.length === 1)) {
      const box = BOXES[boxes[0]], line = rows.length === 1 ? ROWS[rows[0]] : COLS[cols[0]];
      for (let d = 1; d <= 9; d++) {
        if (!allHave(d)) continue;
        const inBox = box.filter(i => !grid[i] && cand[i].has(d));
        if (inBox.length === n && inBox.every(i => cells.includes(i))) push({
          id: 'pointing', digits: [d], cells, kills: kill(line.filter(i => !box.includes(i)), d),
          region: 'box ' + (boxes[0] + 1),
          why: 'Every remaining ' + d + ' in box ' + (boxes[0] + 1) + ' sits in ' + unitName(line) +
               ', so the box puts its ' + d + ' on that line.'
        });
        const onLine = line.filter(i => !grid[i] && cand[i].has(d));
        if (onLine.length === n && onLine.every(i => cells.includes(i))) push({
          id: 'claiming', digits: [d], cells, kills: kill(box.filter(i => !line.includes(i)), d),
          region: unitName(line),
          why: 'In ' + unitName(line) + ', ' + d + ' can only go inside box ' + (boxes[0] + 1) +
               ', so the rest of that box loses it.'
        });
      }
    }

    /* fish: k lines whose digit is confined to the same k crossing lines */
    if (n >= 4 && rows.length === cols.length && (rows.length === 2 || rows.length === 3)) {
      const k = rows.length;
      for (let d = 1; d <= 9; d++) {
        if (!allHave(d)) continue;
        for (const [lines, cross, base, over, kind] of
             [[ROWS, COLS, rows, cols, 'row'], [COLS, ROWS, cols, rows, 'column']]) {
          const ok = base.every(li => {
            const spots = lines[li].filter(i => !grid[i] && cand[i].has(d));
            return spots.length >= 2 && spots.every(i => cells.includes(i));
          });
          if (!ok) continue;
          const kills = [];
          over.forEach(ci => kill(cross[ci], d).forEach(x => kills.push(x)));
          push({
            id: k === 2 ? 'xwing' : 'swordfish', digits: [d], cells, kills, soloDigit: d,
            region: kind + 's ' + base.map(x => x + 1).join(', '),
            why: 'The ' + d + 's in ' + kind + 's ' + base.map(x => x + 1).join(', ') +
                 ' are confined to ' + (kind === 'row' ? 'columns ' : 'rows ') +
                 over.map(x => x + 1).join(', ') + ', which need exactly ' + k + ' of them.'
          });
        }
      }
    }

    /* skyscraper: two strong links sharing one end line */
    if (n === 4) {
      for (let d = 1; d <= 9; d++) {
        if (!allHave(d)) continue;
        for (const [lines, kind] of [[ROWS, 'row'], [COLS, 'column']]) {
          const by = new Map();
          cells.forEach(i => {
            const li = kind === 'row' ? rowOf(i) : colOf(i);
            if (!by.has(li)) by.set(li, []);
            by.get(li).push(i);
          });
          if (by.size !== 2) continue;
          const pairs = [...by.entries()];
          if (!pairs.every(([li, p]) => p.length === 2 &&
              lines[li].filter(i => !grid[i] && cand[i].has(d)).length === 2)) continue;
          const [[l1, p1], [l2, p2]] = pairs;
          for (const [a1, b1] of [[p1[0], p1[1]], [p1[1], p1[0]]]) {
            for (const [a2, b2] of [[p2[0], p2[1]], [p2[1], p2[0]]]) {
              const aligned = kind === 'row' ? colOf(a1) === colOf(a2) : rowOf(a1) === rowOf(a2);
              const offset = kind === 'row' ? colOf(b1) !== colOf(b2) : rowOf(b1) !== rowOf(b2);
              if (!aligned || !offset || boxOf(b1) === boxOf(b2)) continue;
              const kills = [];
              for (let i = 0; i < 81; i++) {
                if (grid[i] || cells.includes(i) || !cand[i].has(d)) continue;
                if (PEERS[b1].has(i) && PEERS[b2].has(i)) kills.push({ cell: i, digit: d });
              }
              push({
                id: 'skyscraper', digits: [d], cells, kills, soloDigit: d, roof: [b1, b2],
                region: kind + 's ' + (l1 + 1) + ' and ' + (l2 + 1),
                why: kind.charAt(0).toUpperCase() + kind.slice(1) + 's ' + (l1 + 1) + ' and ' + (l2 + 1) +
                     ' have two ' + d + 's each and share one end, so one of ' + cellName(b1) + ' / ' +
                     cellName(b2) + ' is a ' + d + '.'
              });
            }
          }
        }
      }
    }

    /* XY-Wing: a two-candidate hinge seeing two two-candidate wings */
    if (n === 3 && cells.every(i => cand[i].size === 2)) {
      for (const p of cells) {
        const [a, b] = cells.filter(i => i !== p);
        if (!PEERS[p].has(a) || !PEERS[p].has(b)) continue;
        const P = [...cand[p]], A = [...cand[a]], B = [...cand[b]];
        const Z = A.find(d => B.includes(d) && !P.includes(d));
        if (Z === undefined) continue;
        const X = A.find(d => d !== Z), Y = B.find(d => d !== Z);
        if (X === Y || !P.includes(X) || !P.includes(Y)) continue;
        const kills = [];
        for (let i = 0; i < 81; i++) {
          if (grid[i] || cells.includes(i) || !cand[i].has(Z)) continue;
          if (PEERS[a].has(i) && PEERS[b].has(i)) kills.push({ cell: i, digit: Z });
        }
        push({
          id: 'xy_wing', digits: [Z], cells, kills, pivot: p, wings: [a, b],
          region: 'hinge ' + cellName(p),
          why: 'Hinge ' + cellName(p) + ' is ' + X + '/' + Y + ', seeing ' + cellName(a) + ' (' + X + '/' + Z +
               ') and ' + cellName(b) + ' (' + Y + '/' + Z + '), so one wing has to be ' + Z + '.'
        });
      }
    }

    /* What you nearly picked. findAll only carries patterns that kill, which is
       the right source here: a near miss is only worth reporting if the thing
       you were reaching for is a move. */
    const near = [];
    if (n) {
      (findings || findAll(grid, notes).findings).forEach(f => {
        const missing = f.cells.filter(i => !cells.includes(i));
        const extra = cells.filter(i => !f.cells.includes(i));
        if (!missing.length && !extra.length) return;          // the shape tests own an exact hit
        if (f.cells.length - missing.length < 2) return;        // barely overlaps; not a near miss
        if (missing.length + extra.length > 2) return;
        near.push({ id: f.id, name: NAME[f.id], digits: f.digits, cells: f.cells, missing, extra });
      });
      near.sort((a, b) => (a.missing.length + a.extra.length) - (b.missing.length + b.extra.length));
    }

    return {
      cand, cells, filled, shapes, near: near.slice(0, 3),
      shared: shared.map(unitName)
    };
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

  root.SudokuTech = { findAll, effective, verify, NAME };
})(typeof window !== 'undefined' ? window : globalThis);
