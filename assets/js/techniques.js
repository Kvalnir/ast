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

  /* ---------------- audit ----------------
     The board's third question, and the one a real puzzle cannot ask.

     findAll answers "what can I play here?" and verify() answers "am I reading
     these squares right?" — both on a full position, where a square you have
     not marked still has the candidates its peers leave it. audit() answers
     "would this BE one?" on a blank board carrying nothing but the handful of
     marks you copied off the puzzle in front of you. Different question,
     different honest answer.

     The difference is what an empty square means. Here it means nothing at
     all: you have not told us about it, and the code must not invent
     something. That splits every technique's conditions in two.

       * The ones the marks in front of us settle — two cells holding the same
         two digits, a hinge that sees both wings, four cells making a
         rectangle. These come back ok or bad.
       * The ones that are claims about squares you have NOT written down —
         "row 2 has no other 6", "nothing else in box 4 can take a 5". These
         come back `assume`: named, in full, as the scan you still owe.

     Reporting the second kind as ok would be guessing, and guessing
     confidently is the exact failure this page exists to fix. So a shape whose
     local conditions all pass but whose global ones are unchecked comes back
     `maybe` rather than `yes`, and says which count is still outstanding.

     A typed square that CONTRADICTS an assumption is a third case: if you have
     written a third 6 into row 2, the assumption is not unchecked, it is
     false, and the answer is no. So the more of the position you copy in, the
     more of the work this can do — which is the right incentive. */

  function audit(notes, id, sel) {
    const marked = [];
    for (let i = 0; i < 81; i++) if (notes[i] && notes[i].size) marked.push(i);
    const src = (sel && sel.length ? sel.slice() : marked.slice());
    const cells = src.filter(i => notes[i] && notes[i].size).sort((a, b) => a - b);
    const of = i => [...notes[i]].sort((a, b) => a - b);
    const digitsOf = i => of(i).join('/');

    const R = {
      id, name: NAME[id], cells, unmarked: src.filter(i => !(notes[i] && notes[i].size)),
      conditions: [], kills: [], zone: [], digits: [], lines: [], pivot: null,
      wings: [], roof: [], units: [], zoneText: '', note: ''
    };
    /* A square reference keeps its lower-case r — `R5c7` is not how this site
       writes one — and everything else takes a capital, because these are
       sentences and half of them start with a unit name. */
    const cap = t => (/^r\d+c\d+/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1));
    const ok = t => (R.conditions.push({ state: 'ok', text: cap(t) }), true);
    const bad = t => (R.conditions.push({ state: 'bad', text: cap(t) }), true);
    const assume = t => (R.conditions.push({ state: 'assume', text: cap(t) }), true);
    const done = () => {
      R.verdict = R.conditions.some(c => c.state === 'bad') ? 'no'
        : R.conditions.some(c => c.state === 'assume') ? 'maybe' : 'yes';
      const seen = new Set();
      R.zone = R.zone.filter(i => (seen.has(i) ? false : (seen.add(i), true)));
      const kseen = new Set();
      R.kills = R.kills.filter(k => {
        const key = k.cell + ':' + k.digit;
        return kseen.has(key) ? false : (kseen.add(key), true);
      });
      return R;
    };

    /* Where a deletion would land. A square you have written marks into gives a
       real answer — it loses the digit, or it never had it. A square you have
       not is the part of the job that stays yours, so it is counted as ground
       to check rather than claimed as a kill. */
    function land(region, d, skip) {
      region.forEach(i => {
        if (skip.indexOf(i) >= 0) return;
        if (notes[i] && notes[i].size) { if (notes[i].has(d)) R.kills.push({ cell: i, digit: d }); }
        else R.zone.push(i);
      });
    }
    const shared = cs => UNITS.filter(u => cs.every(i => u.includes(i)));
    /* Marks you have typed that sit in `u`, are not part of the pattern, and
       carry the digit — the only evidence available for a claim about the rest
       of a unit. */
    const witness = (u, d, skip) => u.filter(i => skip.indexOf(i) < 0 && notes[i] && notes[i].has(d));
    const common = cs => {
      const out = [];
      for (let d = 1; d <= 9; d++) if (cs.every(i => notes[i].has(d))) out.push(d);
      return out;
    };
    const listc = cs => cs.map(cellName).join(', ');
    const plural = (n, one, many) => (n === 1 ? one : many);
    const andList = xs => (xs.length < 2 ? xs.join('') :
      xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
    const WORD = { 2: 'Two', 3: 'Three', 4: 'Four', 6: 'Six' };
    const an = n => (/^[AEIOUX]/.test(n) ? 'an ' : 'a ');
    const blanks = (u, skip) => u.filter(i => skip.indexOf(i) < 0 && !(notes[i] && notes[i].size));

    if (!cells.length) { bad('Nothing to read — write some pencil marks in first.'); return done(); }
    if (R.unmarked.length) {
      bad(listc(R.unmarked) + ' ' + plural(R.unmarked.length, 'has', 'have') +
          ' no marks in it, so there is nothing there to check.');
      return done();
    }

    /* ---- the subsets: everything they claim is in the marks themselves ---- */
    if (id === 'naked_pair' || id === 'naked_triple') {
      const n = id === 'naked_pair' ? 2 : 3;
      if (cells.length !== n) { bad('A ' + R.name.toLowerCase() + ' is ' + n +
        ' squares; you have marked ' + cells.length + '.'); return done(); }
      ok(WORD[n] + ' squares.');
      const su = shared(cells);
      if (!su.length) { bad(listc(cells) + ' share no row, column or box, so no subset can live ' +
        'across them.'); return done(); }
      ok('They share ' + su.map(unitName).join(' and ') + '.');
      const big = cells.filter(i => notes[i].size > n);
      if (big.length) { bad(listc(big) + ' ' + plural(big.length, 'holds', 'hold') + ' more than ' +
        n + ' marks (' + big.map(digitsOf).join(', ') + '), and a square with more marks than the ' +
        'subset has digits can never join one.'); return done(); }
      ok('Each holds ' + (n === 2 ? 'two marks' : 'two or three marks') + '.');
      const union = new Set();
      cells.forEach(i => notes[i].forEach(d => union.add(d)));
      const ds = [...union].sort((a, b) => a - b);
      if (ds.length !== n) { bad('Between them they hold ' + ds.join('/') + ' — ' + ds.length +
        ' digits across ' + n + ' squares, which forces nothing.'); return done(); }
      ok('Between them they hold exactly ' + ds.join('/') + '.');
      R.digits = ds;
      R.lines = [[cells[0], cells[cells.length - 1], 'lead']];
      su.forEach(u => { R.units.push(u); ds.forEach(d => land(u, d, cells)); });
      R.zoneText = andList(ds.map(String)) + ' leave every other square of ' +
        su.map(unitName).join(' and ') + '.';
      R.note = 'Nothing here needs a scan you have not done. A naked subset is a claim about these ' +
        n + ' squares alone: if their marks are right, it is right.';
      return done();
    }

    if (id === 'hidden_pair') {
      if (cells.length !== 2) { bad('A hidden pair is two squares; you have marked ' +
        cells.length + '.'); return done(); }
      ok('Two squares.');
      const su = shared(cells);
      if (!su.length) { bad(listc(cells) + ' share no row, column or box.'); return done(); }
      ok('They share ' + su.map(unitName).join(' and ') + '.');
      const both = common(cells);
      if (both.length < 2) { bad('They have ' + (both.length ? 'only the ' + both[0] : 'no digit') +
        ' in common, and a hidden pair needs two digits that both squares can take.'); return done(); }
      /* Which two digits? Any pair they share is a candidate until a mark
         elsewhere in the unit rules it out — so what you have typed chooses
         between them, and where it cannot, the panel says so rather than
         picking one and sounding sure. */
      const live = [];
      for (let a = 0; a < both.length; a++) for (let b = a + 1; b < both.length; b++) {
        const pair = [both[a], both[b]];
        const clash = [];
        su.forEach(u => pair.forEach(d => witness(u, d, cells).forEach(i => clash.push([d, i]))));
        live.push({ pair: pair, clash: clash });
      }
      const clean = live.filter(x => !x.clash.length);
      if (!clean.length) {
        const c = live[0].clash[0];
        bad('The ' + c[0] + ' also fits ' + cellName(c[1]) + ' in ' + su.map(unitName).join(' and ') +
          ', so ' + (live.length > 1 ? 'no two of these digits are' : 'the pair is') +
          ' down to these two squares.');
        return done();
      }
      const pick = clean[0];
      R.digits = pick.pair;
      ok('Both squares can take ' + pick.pair.join(' and ') + '.');
      if (clean.length > 1) assume('These two share ' + both.join('/') + ', so ' + clean.length +
        ' different pairs still fit what you have typed. Write in the rest of ' + unitName(su[0]) +
        ' and only one survives; ' + pick.pair.join('/') + ' is the one read below.');
      su.forEach(u => {
        const unknown = blanks(u, cells);
        if (unknown.length) assume(pick.pair.join(' and ') + ' must have nowhere else to go in ' +
          unitName(u) + '. ' + unknown.length + ' ' + plural(unknown.length, 'square', 'squares') +
          ' there ' + plural(unknown.length, 'is', 'are') + ' still blank here, and that count is ' +
          'the whole move.');
        else ok(pick.pair.join(' and ') + ' have nowhere else in ' + unitName(u) + ' — you typed it all in.');
        R.units.push(u);
      });
      cells.forEach(i => notes[i].forEach(d => {
        if (pick.pair.indexOf(d) < 0) R.kills.push({ cell: i, digit: d });
      }));
      R.lines = [[cells[0], cells[1], 'lead']];
      R.zoneText = R.kills.length
        ? 'Every other mark in ' + listc(cells) + ' dies.'
        : 'Those two squares hold nothing but ' + pick.pair.join('/') + ' already, so there is ' +
          'nothing to delete — what you have is a naked pair, which is the same news arriving earlier.';
      return done();
    }

    /* ---- box and line ---- */
    if (id === 'pointing' || id === 'claiming') {
      if (cells.length < 2 || cells.length > 3) {
        bad('Two or three squares, and you have marked ' + cells.length + '.'); return done(); }
      ok(WORD[cells.length] + ' squares.');
      const bs = [...new Set(cells.map(boxOf))], rs = [...new Set(cells.map(rowOf))],
            cls = [...new Set(cells.map(colOf))];
      if (bs.length !== 1) { bad('They are spread over ' + bs.length + ' boxes, and both halves of ' +
        'this move happen inside one.'); return done(); }
      if (rs.length !== 1 && cls.length !== 1) { bad('They share neither a row nor a column, so ' +
        'there is no line for the box to point along.'); return done(); }
      const bx = BOXES[bs[0]], line = rs.length === 1 ? ROWS[rs[0]] : COLS[cls[0]];
      ok('All inside box ' + (bs[0] + 1) + ', and all on ' + unitName(line) + '.');
      const ds = common(cells);
      if (!ds.length) { bad('They share no digit — ' + cells.map(digitsOf).join(', ') +
        ' — and this is a claim about one digit.'); return done(); }
      const d = ds[0];
      R.digits = [d];
      ok('Every one of them can take the ' + d +
         (ds.length > 1 ? ' (they also share the ' + ds.slice(1).join('/') + '; the ' + d +
          ' is the one read below)' : '') + '.');
      const home = id === 'pointing' ? bx : line;
      const out = id === 'pointing' ? line : bx;
      const homeName = id === 'pointing' ? 'box ' + (bs[0] + 1) : unitName(line);
      const clash = witness(home, d, cells);
      if (clash.length) { bad('You have typed a ' + d + ' at ' + listc(clash) + ', inside ' +
        homeName + ' and outside the pattern — so its ' + d + 's are not confined to ' +
        (id === 'pointing' ? unitName(line) : 'box ' + (bs[0] + 1)) + '.'); return done(); }
      const unknown = blanks(home, cells);
      if (unknown.length) assume('No other square in ' + homeName + ' can take the ' + d + '. ' +
        unknown.length + ' of them ' + plural(unknown.length, 'is', 'are') + ' blank here, so that ' +
        'count is yours to make — and it is the entire move.');
      else ok('Nothing else in ' + homeName + ' can take the ' + d + ' — you typed it all in.');
      R.units = [home];
      R.lines = [[cells[0], cells[cells.length - 1], 'lead']];
      land(out.filter(i => (id === 'pointing' ? bx.indexOf(i) < 0 : line.indexOf(i) < 0)), d, cells);
      R.zoneText = 'The ' + d + ' leaves ' + (id === 'pointing'
        ? 'the rest of ' + unitName(line) + ', outside box ' + (bs[0] + 1)
        : 'the rest of box ' + (bs[0] + 1) + ', off ' + unitName(line)) + '.';
      return done();
    }

    /* ---- the fish ---- */
    if (id === 'xwing' || id === 'swordfish') {
      const size = id === 'xwing' ? 2 : 3;
      if (cells.length < size * 2 || cells.length > size * 3) {
        bad(an(R.name) + R.name + ' is ' + (size === 2 ? 'four squares' : 'six to nine squares') +
          '; you have marked ' + cells.length + '.'); return done(); }
      const ds = common(cells);
      if (!ds.length) { bad('They share no digit, and a fish is one digit only.'); return done(); }
      const d = ds[0];
      R.digits = [d];
      ok('All ' + cells.length + ' squares can take the ' + d + '.');
      const rs = [...new Set(cells.map(rowOf))].sort((a, b) => a - b),
            cls = [...new Set(cells.map(colOf))].sort((a, b) => a - b);
      if (rs.length !== size || cls.length !== size) {
        bad('They cover ' + rs.length + ' rows and ' + cls.length + ' columns. ' +
          an(R.name).replace(/^./, c => c.toUpperCase()) + R.name + ' needs exactly ' + size +
          ' of each — that is what confined means.'); return done(); }
      ok('They cover ' + size + ' rows (' + rs.map(x => x + 1).join(', ') + ') and ' + size +
         ' columns (' + cls.map(x => x + 1).join(', ') + ').');
      const perRow = rs.map(r => cells.filter(i => rowOf(i) === r));
      const perCol = cls.map(c => cells.filter(i => colOf(i) === c));
      if (perRow.some(g => g.length < 2) && perCol.some(g => g.length < 2)) {
        bad('One of the lines holds only a single one of your squares, so nothing is confined in ' +
          'either direction.'); return done(); }
      /* Which way round is it? Rows as the base unless a mark you typed rules
         that out — and the other reading gets named either way, because a fish
         read backwards deletes from the wrong lines. */
      const rowClash = rs.some(r => witness(ROWS[r], d, cells).length);
      const colClash = cls.some(c => witness(COLS[c], d, cells).length);
      const useRows = !rowClash && !perRow.some(g => g.length < 2);
      const useCols = !colClash && !perCol.some(g => g.length < 2);
      if (!useRows && !useCols) {
        const r = rs.filter(x => witness(ROWS[x], d, cells).length)[0];
        const c = cls.filter(x => witness(COLS[x], d, cells).length)[0];
        const line = r !== undefined ? ROWS[r] : COLS[c];
        bad('You have typed another ' + d + ' at ' + listc(witness(line, d, cells)) + ', in ' +
          unitName(line) + '. A base line with a third spot proves nothing, and it is the ' +
          'commonest false positive there is.');
        return done();
      }
      const base = useRows ? rs.map(r => ROWS[r]) : cls.map(c => COLS[c]);
      const cross = useRows ? cls.map(c => COLS[c]) : rs.map(r => ROWS[r]);
      R.units = base;
      base.forEach(u => {
        const unknown = blanks(u, cells);
        if (unknown.length) assume(unitName(u) + ' must hold no other ' + d + '. ' + unknown.length +
          ' of its squares ' + plural(unknown.length, 'is', 'are') + ' blank here — count them on ' +
          'the real grid before you delete anything.');
        else ok(unitName(u) + ' holds no other ' + d + ' — you typed it all in.');
      });
      base.concat(cross).forEach((u, n) => {
        const g = cells.filter(i => u.indexOf(i) >= 0).sort((a, b) => a - b);
        if (g.length > 1) R.lines.push([g[0], g[g.length - 1],
          (n < base.length || size === 2) ? 'lead' : 'cross']);
      });
      cross.forEach(u => land(u, d, cells));
      R.zoneText = 'Reading the ' + (useRows ? 'rows' : 'columns') + ' as the base, the ' + d +
        ' leaves the rest of ' + andList(cross.map(unitName)) + '.';
      /* Which lines are the base is a choice, and a silent one would be the
         panel answering a question you did not ask. If your own marks ruled a
         direction out, that is the first thing said. */
      let flip = '';
      if (!useRows) {
        const r = rs.filter(x => witness(ROWS[x], d, cells).length)[0];
        flip = r !== undefined
          ? 'The rows cannot be the base: you have typed another ' + d + ' in ' + unitName(ROWS[r]) +
            ', at ' + listc(witness(ROWS[r], d, cells)) + '. Read as columns it still stands. '
          : 'The rows cannot be the base — one of them holds only a single one of your squares — ' +
            'so this is read as columns. ';
      }
      R.note = flip + 'A fish reads both ways round. If it is ' + andList(cross.map(unitName)) +
        ' that hold only these ' + d + 's, the deletions land in ' + andList(base.map(unitName)) +
        ' instead — so do your counting in the direction you mean to delete in.';
      return done();
    }

    /* ---- skyscraper ---- */
    if (id === 'skyscraper') {
      if (cells.length !== 4) { bad('A skyscraper is four squares; you have marked ' +
        cells.length + '.'); return done(); }
      const ds = common(cells);
      if (!ds.length) { bad('They share no digit, and a skyscraper is one digit only.'); return done(); }
      const d = ds[0];
      R.digits = [d];
      ok('Four squares, all able to take the ' + d + '.');
      let found = null;
      [[ROWS, rowOf, colOf, 'row'], [COLS, colOf, rowOf, 'column']].forEach(pair => {
        if (found) return;
        const lines = pair[0], along = pair[1], across = pair[2], word = pair[3];
        const groups = {};
        cells.forEach(i => { (groups[along(i)] = groups[along(i)] || []).push(i); });
        const keys = Object.keys(groups);
        if (keys.length !== 2 || keys.some(k => groups[k].length !== 2)) return;
        const g1 = groups[keys[0]], g2 = groups[keys[1]];
        g1.forEach(a1 => g2.forEach(a2 => {
          if (found) return;
          const b1 = g1.filter(i => i !== a1)[0], b2 = g2.filter(i => i !== a2)[0];
          if (across(a1) !== across(a2) || across(b1) === across(b2)) return;
          found = { lines: lines, word: word, floor: [a1, a2], roof: [b1, b2],
                    keys: keys.map(Number) };
        }));
      });
      if (!found) { bad('These four are not laid out as a skyscraper: it is two lines of two, ' +
        'meeting in one crossing line and parting at the other end. Four squares meeting twice ' +
        'are an X-Wing; four in two lines that never meet are nothing.'); return done(); }
      const met = found.lines === ROWS ? COLS[colOf(found.floor[0])] : ROWS[rowOf(found.floor[0])];
      ok('Two ' + found.word + 's of two, meeting in ' + unitName(met) + '.');
      if (boxOf(found.roof[0]) === boxOf(found.roof[1])) {
        bad('The loose ends ' + andList(found.roof.map(cellName)) + ' sit in the same box, ' +
          'which makes this a ' +
          'pointing pair — a cheaper move, and a different one.'); return done(); }
      ok('The loose ends ' + andList(found.roof.map(cellName)) +
         ' are strangers: different line, different box.');
      R.roof = found.roof;
      R.units = found.keys.map(k => found.lines[k]);
      R.units.forEach(u => {
        const clash = witness(u, d, cells);
        const unknown = blanks(u, cells);
        if (clash.length) bad('You have typed a third ' + d + ' at ' + listc(clash) + ' in ' +
          unitName(u) + ', so that line is not a strong link and the chain does not hold.');
        else if (unknown.length) assume(unitName(u) + ' must have exactly two ' + d + 's — these ' +
          'two. ' + unknown.length + ' of its squares ' + plural(unknown.length, 'is', 'are') +
          ' blank here.');
        else ok(unitName(u) + ' has exactly two ' + d + 's — you typed it all in.');
      });
      if (R.conditions.some(c => c.state === 'bad')) return done();
      R.lines = [[found.floor[0], found.roof[0], 'lead'], [found.floor[1], found.roof[1], 'lead'],
                 [found.floor[0], found.floor[1], 'cross']];
      const seen = [];
      for (let i = 0; i < 81; i++) {
        if (cells.indexOf(i) >= 0) continue;
        if (PEERS[found.roof[0]].has(i) && PEERS[found.roof[1]].has(i)) seen.push(i);
      }
      land(seen, d, cells);
      R.zoneText = 'One of ' + andList(found.roof.map(cellName)) + ' is the ' + d +
        ', so every square seeing both ' +
        'of them loses it — ' + seen.length + ' squares in all.';
      return done();
    }

    /* ---- XY-Wing ---- */
    if (id === 'xy_wing') {
      if (cells.length !== 3) { bad('An XY-Wing is three squares; you have marked ' +
        cells.length + '.'); return done(); }
      const wrong = cells.filter(i => notes[i].size !== 2);
      if (wrong.length) { bad(listc(wrong) + ' ' + plural(wrong.length, 'has', 'have') + ' ' +
        wrong.map(i => notes[i].size).join('/') + ' marks. All three corners must have exactly two.');
        return done(); }
      ok('Three squares, two marks each.');
      const hinge = cells.filter(p => cells.every(i => i === p || PEERS[p].has(i)))[0];
      if (hinge === undefined) {
        const pairs = [];
        cells.forEach(a => cells.forEach(b => {
          if (a < b && !PEERS[a].has(b)) pairs.push(cellName(a) + ' and ' + cellName(b));
        }));
        bad('None of them sees the other two — ' + pairs.join('; ') + ' share no row, column or ' +
          'box. The hinge must see both wings, though the wings need not see each other.');
        return done();
      }
      const wings = cells.filter(i => i !== hinge);
      ok(cellName(hinge) + ' (' + digitsOf(hinge) + ') sees both ' +
         andList(wings.map(cellName)) + '.');
      const H = of(hinge), A = of(wings[0]), B = of(wings[1]);
      const zs = A.filter(x => B.indexOf(x) >= 0 && H.indexOf(x) < 0);
      if (zs.length !== 1) { bad('The wings are ' + A.join('/') + ' and ' + B.join('/') + ', and ' +
        'they share ' + (zs.length ? zs.length + ' digits the hinge does not hold' :
        'no digit the hinge does not hold') + '. They need exactly one — that shared digit is the ' +
        'whole point of the pattern.'); return done(); }
      const Z = zs[0];
      const X = A.filter(x => x !== Z)[0], Y = B.filter(x => x !== Z)[0];
      if (X === Y || H.indexOf(X) < 0 || H.indexOf(Y) < 0) {
        bad('The hinge is ' + H.join('/') + ', and the wings’ other digits are ' + X + ' and ' +
          Y + '. For the chain to close, the hinge has to hold one of each.'); return done(); }
      ok('Hinge ' + H.join('/') + ', wings ' + X + '/' + Z + ' and ' + Y + '/' + Z +
         ' — whichever way the hinge falls, one wing is the ' + Z + '.');
      R.digits = [Z];
      R.pivot = hinge;
      R.wings = wings;
      R.lines = [[hinge, wings[0], 'lead'], [hinge, wings[1], 'lead']];
      const seen = [];
      for (let i = 0; i < 81; i++) {
        if (cells.indexOf(i) >= 0) continue;
        if (PEERS[wings[0]].has(i) && PEERS[wings[1]].has(i)) seen.push(i);
      }
      land(seen, Z, cells);
      R.zoneText = 'Every square that sees both wings loses the ' + Z + ' — ' + seen.length +
        ' squares in all.';
      R.note = 'Nothing here needs a scan you have not done: the three squares carry the whole ' +
        'argument. What is left is finding the squares that see both wings.';
      return done();
    }

    bad('No audit for ' + id + '.');
    return done();
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

  root.SudokuTech = { findAll, effective, verify, audit, NAME };
})(typeof window !== 'undefined' ? window : globalThis);
