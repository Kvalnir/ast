/* master.js — the tier above the nine.
 *
 * Nine more techniques, in the same finding shape techniques.js uses, so the
 * trainer's coach, the inspector and the check page can read them without
 * knowing which tier a move came from. Loaded on every page; only consulted
 * when the tier switch says Master (see tier.js).
 *
 * What they have in common, and why they are worth learning as a set: seven of
 * the nine are one idea — the STRONG LINK, a unit where a digit has exactly two
 * homes, so one of them is true. The skyscraper on the Advanced tier is already
 * two strong links sharing an end. A kite is two strong links whose near ends
 * share a box; colouring is the whole network of them at once; a W-Wing is one
 * strong link between two identical pairs; an AIC is the general form that
 * produces all of them. Learn the primitive and the names stop mattering.
 *
 * The other two — the unique rectangle and BUG+1 — argue from a different
 * place: that the puzzle has exactly one solution. index.html's uniqueness
 * footnote says why that is dangerous on a grid you may have corrupted, and it
 * is the reason those two are gated here: `findAll` will not offer either
 * unless the digits currently on the board still lead to exactly one solution.
 * That is the check the README asked for if anyone ever added them.
 *
 * Every elimination any of these produces is checked against the puzzle's
 * solution by the harness in tools/harvest-master.js before a figure of it is
 * ever drawn, and by the same bank walk the Advanced detectors are checked
 * with. An unsound detector here would be a confident wrong answer, which is
 * the one thing this site cannot ship.
 */
(function (root) {
  'use strict';

  const C = root.SudokuCore;
  const { ROWS, COLS, BOXES, UNITS, PEERS, rowOf, colOf, boxOf, cellName, unitName } = C;

  const NAME = {
    unique_rect: 'Unique rectangle', bug: 'BUG+1', finned: 'Finned X-Wing',
    kite: '2-string kite', empty_rect: 'Empty rectangle', colouring: 'Simple colouring',
    w_wing: 'W-Wing', xy_chain: 'XY-chain', aic: 'AIC'
  };
  /* Rank continues techniques.js's scale, where 1 is a naked single and 10 the
     XY-Wing. Order is by what a move costs you to find, not by how clever it
     is: the two uniqueness moves are nearly free to spot, and the chain that
     could have found anything is last. */
  const RANK = {
    unique_rect: 11, bug: 12, finned: 13, kite: 14, empty_rect: 15,
    colouring: 16, w_wing: 17, xy_chain: 18, aic: 19
  };
  const IDS = Object.keys(RANK);
  const EXPLAIN = {
    unique_rect: 'Four cells on a rectangle in two boxes, three of them holding the same two candidates. A puzzle with one answer cannot let the fourth hold only those two, so it loses them.',
    bug: 'Every unsolved cell down to two candidates except one with three. The board is one step from a position with two answers, and the digit that appears three times in the odd cell out is what prevents it.',
    finned: 'An X-Wing with one extra spot in a base line, all of it inside one box. The eliminations survive, but only in that box.',
    kite: 'A row and a column with two spots each for one digit, whose near ends share a box. One of the far ends must be the digit.',
    empty_rect: 'A box whose candidates for a digit fit in one row and one column of it, joined to a strong link elsewhere. Kills the cell where the two meet.',
    colouring: 'Colour a digit’s strong links alternately across the board. Two of one colour in a unit kills that colour; any cell seeing both colours loses the digit.',
    w_wing: 'Two cells holding the same two candidates, joined by a strong link on one of them. Whatever happens, the other digit lands in one of the pair.',
    xy_chain: 'A chain of two-candidate cells, each sharing a digit with the next, that starts and ends on the same digit. One end or the other must be it.',
    aic: 'A chain of alternating strong and weak links. It proves that one of its two ends is true, and everything that sees both ends pays for it.'
  };
  /* Anchors on master.html, for the coach's "read the full technique" link. */
  const LESSON = {
    unique_rect: 'unique-rectangle', bug: 'bug', finned: 'finned-fish', kite: 'kite',
    empty_rect: 'empty-rectangle', colouring: 'colouring', w_wing: 'w-wing',
    xy_chain: 'xy-chain', aic: 'aic'
  };

  /* ---------------- shared ---------------- */
  const list = cells => cells.map(cellName).join(', ');
  const sees = (a, b) => PEERS[a].has(b);

  function spotsIn(g, cand, unit, d) {
    return unit.filter(i => !g[i] && cand[i].has(d));
  }

  /* A strong link: a unit where the digit has exactly two homes, so one of them
     is true. Seven of the nine below are built out of these, which is why this
     is the first function in the file rather than a helper buried in one. */
  function strongLinks(g, cand, d) {
    const out = [], seen = new Set();
    UNITS.forEach(u => {
      const sp = spotsIn(g, cand, u, d);
      if (sp.length !== 2) return;
      const key = sp[0] + ':' + sp[1];
      if (seen.has(key)) return;          // a link can live in a row and a box both
      seen.add(key);
      out.push({ a: sp[0], b: sp[1], unit: u });
    });
    return out;
  }

  const seg = (a, b, style) => [a, b, style || 'lead'];

  /* ---------------- uniqueness ----------------
     Both of these reason from the puzzle having exactly one answer rather than
     from the marks in front of you, and both keep working — confidently, and
     wrongly — on a grid you have broken. `safe` is the gate: the digits on the
     board must still lead to exactly one solution. It cannot see a candidate
     you struck by mistake, so the lesson says plainly that these two are the
     only moves on the site that trust the puzzle rather than the grid. */
  function uniqueRect(g, cand, safe) {
    if (!safe) return [];
    const out = [];
    for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++) {
      for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
        const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
        if (cells.some(i => g[i])) continue;
        /* Two boxes exactly. Four corners over four boxes are not a deadly
           pattern — the digits could not swap without leaving a box short. */
        if (new Set(cells.map(boxOf)).size !== 2) continue;
        const twos = cells.filter(i => cand[i].size === 2);
        if (twos.length < 2) continue;
        const pair = [...cand[twos[0]]].sort((a, b) => a - b);
        const [A, B] = pair;
        if (!cells.every(i => cand[i].has(A) && cand[i].has(B))) continue;
        const bare = cells.filter(i => cand[i].size === 2);
        const rest = cells.filter(i => cand[i].size > 2);

        /* Type 1 — three corners bare, the fourth carrying extras. If the
           fourth were only A/B the four could swap and the puzzle would have
           two answers, so it is one of its extras. */
        if (bare.length === 3 && rest.length === 1) {
          const t = rest[0];
          const elims = pair.filter(d => cand[t].has(d)).map(d => ({ cell: t, digit: d }));
          if (elims.length) out.push({
            id: 'unique_rect', name: NAME.unique_rect, family: 'Uniqueness', rank: RANK.unique_rect,
            kind: 'type 1', digits: pair, cells: cells.slice(), elims,
            units: [], lines: [seg(cells[0], cells[1]), seg(cells[2], cells[3]),
                               seg(cells[0], cells[2]), seg(cells[1], cells[3])],
            region: 'rows ' + (r1 + 1) + ' and ' + (r2 + 1) + ', columns ' + (c1 + 1) + ' and ' + (c2 + 1),
            why: list(bare) + ' are all ' + A + '/' + B + ' on a rectangle in two boxes. If ' +
                 cellName(t) + ' were ' + A + ' or ' + B + ' as well, the four could swap and the ' +
                 'puzzle would have two answers — so it is one of its other candidates.'
          });
        }

        /* Type 2 — all four hold A/B, and two of them carry the same single
           extra. One of those two must be that extra, so anything seeing both
           loses it. */
        if (bare.length === 2 && rest.length === 2 &&
            rest.every(i => cand[i].size === 3)) {
          const e1 = [...cand[rest[0]]].filter(d => d !== A && d !== B)[0];
          const e2 = [...cand[rest[1]]].filter(d => d !== A && d !== B)[0];
          if (e1 === e2) {
            const elims = [];
            for (let i = 0; i < 81; i++) {
              if (g[i] || cells.indexOf(i) >= 0 || !cand[i].has(e1)) continue;
              if (sees(i, rest[0]) && sees(i, rest[1])) elims.push({ cell: i, digit: e1 });
            }
            if (elims.length) out.push({
              id: 'unique_rect', name: NAME.unique_rect, family: 'Uniqueness', rank: RANK.unique_rect,
              kind: 'type 2', digits: [e1], cells: cells.slice(), elims,
              units: [], lines: [seg(cells[0], cells[1]), seg(cells[2], cells[3]),
                                 seg(cells[0], cells[2]), seg(cells[1], cells[3])],
              region: 'rows ' + (r1 + 1) + ' and ' + (r2 + 1) + ', columns ' + (c1 + 1) + ' and ' + (c2 + 1),
              why: 'All four corners hold ' + A + '/' + B + ', and ' + list(rest) + ' each carry an ' +
                   'extra ' + e1 + '. One of those two has to be the ' + e1 + ', or the rectangle ' +
                   'swaps and the puzzle has two answers — so anything seeing both loses it.'
            });
          }
        }
      }
    }
    return out;
  }

  function bugPlusOne(g, cand, safe) {
    if (!safe) return [];
    let tri = -1;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const n = cand[i].size;
      if (n === 2) continue;
      if (n === 3 && tri < 0) { tri = i; continue; }
      return [];                       // any other size, and this is not the position
    }
    if (tri < 0) return [];
    /* Which of the three is the one holding the grave open? Not simply the one
       appearing three times in the odd cell's own units: a unit whose digits
       run 1, 3, 2 also has a three in it, and it also has a hidden single,
       which means the position is nothing like a grave. So the test is the
       definition itself — take the digit out and ask whether what is left is a
       bivalue universal grave, where every digit still needing a home in a unit
       has exactly two of them. Only then does removing it produce a board with
       an even number of answers, and only then is keeping it forced. */
    const isGrave = drop => {
      for (const u of UNITS) {
        for (let d = 1; d <= 9; d++) {
          let n = 0;
          for (const i of u) {
            if (g[i] || !cand[i].has(d)) continue;
            if (i === tri && d === drop) continue;
            n++;
          }
          if (n !== 0 && n !== 2) return false;
        }
      }
      return true;
    };
    for (const d of [...cand[tri]].sort((a, b) => a - b)) {
      if (!isGrave(d)) continue;
      return [{
        id: 'bug', name: NAME.bug, family: 'Uniqueness', rank: RANK.bug,
        digits: [d], cells: [tri], elims: [], placement: { cell: tri, digit: d },
        units: [], lines: [], region: cellName(tri),
        why: 'Every unsolved square holds two candidates except ' + cellName(tri) + ', which holds ' +
             'three. Take the ' + d + ' out of it and every digit left would have exactly two homes ' +
             'in every unit \u2014 a grid whose answers come in pairs, and this puzzle has one. So ' +
             cellName(tri) + ' is the ' + d + '.'
      }];
    }
    return [];
  }

  /* ---------------- finned fish ----------------
     The X-Wing you had to throw away. One base line carries extra spots, and
     as long as they all sit in a single box the argument still runs: either
     the fish is real, or the digit is on one of the fins — and a cell that is
     both in the covered lines and in the fin's box loses it either way. */
  function finnedFish(g, cand) {
    const out = [];
    for (let d = 1; d <= 9; d++) {
      for (const [lines, cross, kind] of [[ROWS, COLS, 'row'], [COLS, ROWS, 'column']]) {
        const spots = lines.map(l => spotsIn(g, cand, l, d));
        const at = k => kind === 'row' ? colOf(k) : rowOf(k);
        const on = k => kind === 'row' ? rowOf(k) : colOf(k);
        for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) {
          if (spots[i].length < 1 || spots[j].length < 2) continue;
          if (spots[i].length + spots[j].length > 7) continue;
          const all = spots[i].concat(spots[j]);
          const xs = [...new Set(all.map(at))].sort((a, b) => a - b);
          if (xs.length < 3 || xs.length > 4) continue;   // 2 would be a plain X-Wing
          for (let a = 0; a < xs.length; a++) for (let b = a + 1; b < xs.length; b++) {
            const covers = [xs[a], xs[b]];
            const fins = all.filter(k => covers.indexOf(at(k)) < 0);
            if (!fins.length || fins.length > 3) continue;
            if (new Set(fins.map(boxOf)).size !== 1) continue;
            /* Every fin has to sit in ONE of the two base lines, and the other
               line has to be clean, or there is no fish left underneath. */
            if (new Set(fins.map(on)).size !== 1) continue;
            const fl = on(fins[0]), other = fl === i ? j : i;
            if (fl !== i && fl !== j) continue;
            if (spots[other].some(k => covers.indexOf(at(k)) < 0)) continue;
            if (!spots[fl].some(k => covers.indexOf(at(k)) >= 0)) continue;
            const base = all.filter(k => covers.indexOf(at(k)) >= 0);
            const finBox = boxOf(fins[0]);
            const elims = [];
            covers.forEach(x => cross[x].forEach(k => {
              if (g[k] || !cand[k].has(d)) return;
              if (all.indexOf(k) >= 0) return;
              if (on(k) === i || on(k) === j) return;
              if (boxOf(k) !== finBox) return;
              elims.push({ cell: k, digit: d });
            }));
            if (!elims.length) continue;
            const sorted = base.slice().sort((x, y) => x - y);
            out.push({
              id: 'finned', name: NAME.finned, family: 'Single digit', rank: RANK.finned,
              digits: [d], cells: base.concat(fins), fins: fins.slice(), soloDigit: d,
              elims, units: [lines[i], lines[j]],
              lines: [seg(sorted[0], sorted[sorted.length - 1], 'cross')],
              region: kind + 's ' + (i + 1) + ' and ' + (j + 1),
              why: 'The ' + d + 's in ' + kind + 's ' + (i + 1) + ' and ' + (j + 1) + ' would be an ' +
                   'X-Wing on ' + (kind === 'row' ? 'columns ' : 'rows ') +
                   covers.map(x => x + 1).join(' and ') + ' but for ' + list(fins) + '. Those sit in ' +
                   'box ' + (finBox + 1) + ', so either the X-Wing holds or the ' + d + ' is on a fin ' +
                   '\u2014 and anything in that box and those ' +
                   (kind === 'row' ? 'columns' : 'rows') + ' loses it either way.'
            });
          }
        }
      }
    }
    return out;
  }

  /* ---------------- two strong links ----------------
     The kite. Two strong links whose near ends share a box cannot both be
     true there, so one of the far ends is the digit. The skyscraper is the
     same argument with the near ends sharing a line, which is why that one is
     on the Advanced tier and this one only fires when the ends are in a box
     without being on a line. */
  function kite(g, cand) {
    const out = [];
    for (let d = 1; d <= 9; d++) {
      const rows = [], cols = [];
      ROWS.forEach((u, li) => { const sp = spotsIn(g, cand, u, d); if (sp.length === 2) rows.push({ li, sp }); });
      COLS.forEach((u, li) => { const sp = spotsIn(g, cand, u, d); if (sp.length === 2) cols.push({ li, sp }); });
      rows.forEach(R => cols.forEach(K => {
        for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
          const nearR = R.sp[a], farR = R.sp[1 - a];
          const nearK = K.sp[b], farK = K.sp[1 - b];
          if (nearR === nearK || farR === farK) continue;
          if (boxOf(nearR) !== boxOf(nearK)) continue;
          if (rowOf(nearR) === rowOf(nearK) || colOf(nearR) === colOf(nearK)) continue;
          if (sees(farR, farK)) continue;         // then it is a simpler move
          const elims = [];
          for (let i = 0; i < 81; i++) {
            if (g[i] || !cand[i].has(d)) continue;
            if ([nearR, farR, nearK, farK].indexOf(i) >= 0) continue;
            if (sees(i, farR) && sees(i, farK)) elims.push({ cell: i, digit: d });
          }
          if (!elims.length) continue;
          out.push({
            id: 'kite', name: NAME.kite, family: 'Single digit', rank: RANK.kite,
            digits: [d], cells: [farR, nearR, nearK, farK], roof: [farR, farK], soloDigit: d,
            elims, units: [ROWS[R.li], COLS[K.li]],
            lines: [seg(farR, nearR), seg(nearK, farK), seg(nearR, nearK, 'cross')],
            region: 'row ' + (R.li + 1) + ' and column ' + (K.li + 1),
            why: 'Row ' + (R.li + 1) + ' and column ' + (K.li + 1) + ' have two ' + d + 's each, and ' +
                 'their near ends ' + list([nearR, nearK]) + ' share box ' + (boxOf(nearR) + 1) +
                 ' — so they cannot both be the ' + d + '. One of ' + list([farR, farK]) + ' is, and ' +
                 'anything seeing both loses it.'
          });
        }
      }));
    }
    return out;
  }

  /* ---------------- empty rectangle ----------------
     A box whose candidates for one digit all lie in one of its rows and one of
     its columns. That is a promise: the digit in this box is on that row or on
     that column. Cross it with a strong link and one cell pays. */
  function emptyRect(g, cand) {
    const out = [];
    for (let d = 1; d <= 9; d++) {
      const links = strongLinks(g, cand, d);
      BOXES.forEach((box, bi) => {
        const sp = spotsIn(g, cand, box, d);
        if (sp.length < 2) return;
        const rs = [...new Set(sp.map(rowOf))], cs = [...new Set(sp.map(colOf))];
        if (rs.length < 2 || cs.length < 2) return;    // one line only is a pointing pair
        rs.forEach(r => cs.forEach(c => {
          if (!sp.every(i => rowOf(i) === r || colOf(i) === c)) return;
          if (!sp.some(i => rowOf(i) === r && colOf(i) !== c)) return;
          if (!sp.some(i => colOf(i) === c && rowOf(i) !== r)) return;
          links.forEach(L => {
            [[L.a, L.b], [L.b, L.a]].forEach(([A, Z]) => {
              if (boxOf(A) === bi || boxOf(Z) === bi) return;
              /* Two ways round. A link down a COLUMN with one end on the box's
                 row kills where the far end's row crosses the box's column; a
                 link along a ROW with one end on the box's column kills where
                 the far end's column crosses the box's row. */
              let target = -1;
              if (colOf(A) === colOf(Z) && rowOf(A) === r && colOf(A) !== c) target = rowOf(Z) * 9 + c;
              else if (rowOf(A) === rowOf(Z) && colOf(A) === c && rowOf(A) !== r) target = r * 9 + colOf(Z);
              if (target < 0) return;
              if (g[target] || !cand[target].has(d)) return;
              if (boxOf(target) === bi) return;
              if (target === A || target === Z) return;
              if (sp.indexOf(target) >= 0) return;
              out.push({
                id: 'empty_rect', name: NAME.empty_rect, family: 'Single digit', rank: RANK.empty_rect,
                digits: [d], cells: sp.concat([A, Z]), soloDigit: d,
                elims: [{ cell: target, digit: d }],
                units: [box], lines: [seg(A, Z), seg(Z, target, 'cross')],
                region: 'box ' + (bi + 1) + ', row ' + (r + 1) + ' and column ' + (c + 1),
                why: 'Box ' + (bi + 1) + ' keeps its ' + d + 's inside row ' + (r + 1) + ' and column ' +
                     (c + 1) + ', so its ' + d + ' is on one of them. ' + cellName(A) + ' and ' +
                     cellName(Z) + ' are a strong link: if ' + cellName(A) + ' is the ' + d + ' the box ' +
                     'takes the column, and if it is not then ' + cellName(Z) + ' is — and ' +
                     cellName(target) + ' loses the ' + d + ' both ways.'
              });
            });
          });
        }));
      });
    }
    return out;
  }

  /* ---------------- simple colouring ----------------
     Every strong link for one digit at once. Two-colour the network: two cells
     of one colour in a unit means that colour is false outright, and any cell
     seeing both colours cannot be the digit whichever colour is true. */
  function colouring(g, cand) {
    const out = [];
    for (let d = 1; d <= 9; d++) {
      const links = strongLinks(g, cand, d);
      if (links.length < 2) continue;
      const adj = new Map();
      links.forEach(L => {
        if (!adj.has(L.a)) adj.set(L.a, []);
        if (!adj.has(L.b)) adj.set(L.b, []);
        adj.get(L.a).push(L.b);
        adj.get(L.b).push(L.a);
      });
      const colour = new Map();
      [...adj.keys()].forEach(start => {
        if (colour.has(start)) return;
        const comp = [start];
        colour.set(start, 0);
        let broken = false;
        for (let qi = 0; qi < comp.length; qi++) {
          const cur = comp[qi];
          adj.get(cur).forEach(n => {
            if (colour.has(n)) {
              /* Strong links alternate by definition, so an odd cycle among
                 them means the position itself is already contradictory —
                 someone struck a candidate that was true. Colouring it would
                 hand out confident nonsense, so this walks away instead. */
              if (colour.get(n) === colour.get(cur)) broken = true;
              return;
            }
            colour.set(n, 1 - colour.get(cur));
            comp.push(n);
          });
        }
        if (broken || comp.length < 4) return;
        const A = comp.filter(i => colour.get(i) === 0), B = comp.filter(i => colour.get(i) === 1);
        const drawn = links.filter(L => comp.indexOf(L.a) >= 0)
                           .map(L => seg(L.a, L.b));

        /* Rule 1 — a colour twice in one unit. Both cannot be the digit, and
           they are the same colour, so that colour is false everywhere. */
        [[A, B], [B, A]].forEach(([same, ]) => {
          for (let x = 0; x < same.length; x++) for (let y = x + 1; y < same.length; y++) {
            if (!sees(same[x], same[y])) continue;
            const elims = same.map(i => ({ cell: i, digit: d }));
            out.push({
              id: 'colouring', name: NAME.colouring, family: 'Single digit', rank: RANK.colouring,
              digits: [d], cells: comp.slice(), soloDigit: d, elims, units: [], lines: drawn,
              region: comp.length + ' linked squares on the ' + d,
              why: cellName(same[x]) + ' and ' + cellName(same[y]) + ' take the same colour in the ' +
                   d + '’s chain and they see each other. A colour is all true or all false, and ' +
                   'these two cannot both be the ' + d + ' — so that whole colour is false.'
            });
            return;
          }
        });

        /* Rule 2 — a cell outside the chain seeing both colours. One colour is
           true, so the digit is beside it either way. */
        const elims = [];
        for (let i = 0; i < 81; i++) {
          if (g[i] || !cand[i].has(d) || comp.indexOf(i) >= 0) continue;
          if (A.some(x => sees(i, x)) && B.some(x => sees(i, x))) elims.push({ cell: i, digit: d });
        }
        if (elims.length) out.push({
          id: 'colouring', name: NAME.colouring, family: 'Single digit', rank: RANK.colouring,
          digits: [d], cells: comp.slice(), soloDigit: d, elims, units: [], lines: drawn,
          region: comp.length + ' linked squares on the ' + d,
          why: 'The ' + d + '’s strong links chain ' + comp.length + ' squares together, ' +
               'alternating. One colour is the truth, and ' + list(elims.map(e => e.cell)) + ' ' +
               (elims.length === 1 ? 'sees' : 'see') + ' both colours — so whichever it is, that ' +
               d + ' is gone.'
        });
      });
    }
    return out;
  }

  /* ---------------- W-Wing ----------------
     Two cells reading the same two digits, with a strong link on one of them
     running between them. Whichever end of the link is true, one of the pair
     is forced onto the other digit. */
  function wWing(g, cand) {
    const out = [];
    const bi = [];
    for (let i = 0; i < 81; i++) if (!g[i] && cand[i].size === 2) bi.push(i);
    for (let x = 0; x < bi.length; x++) for (let y = x + 1; y < bi.length; y++) {
      const P = bi[x], Q = bi[y];
      if (sees(P, Q)) continue;
      const p = [...cand[P]].sort((a, b) => a - b), q = [...cand[Q]].sort((a, b) => a - b);
      if (p[0] !== q[0] || p[1] !== q[1]) continue;
      p.forEach((B, k) => {
        const A = p[1 - k];
        strongLinks(g, cand, B).forEach(L => {
          const ends = [[L.a, L.b], [L.b, L.a]];
          ends.forEach(([X, Y]) => {
            if (X === P || X === Q || Y === P || Y === Q) return;
            if (!sees(X, P) || !sees(Y, Q)) return;
            const elims = [];
            for (let i = 0; i < 81; i++) {
              if (g[i] || !cand[i].has(A) || i === P || i === Q) continue;
              if (sees(i, P) && sees(i, Q)) elims.push({ cell: i, digit: A });
            }
            if (!elims.length) return;
            out.push({
              id: 'w_wing', name: NAME.w_wing, family: 'Chain', rank: RANK.w_wing,
              digits: [A], cells: [P, X, Y, Q], roof: [P, Q], pivot: undefined,
              elims, units: [L.unit],
              lines: [seg(P, X, 'cross'), seg(X, Y), seg(Y, Q, 'cross')],
              region: cellName(P) + ' and ' + cellName(Q) + ', linked on the ' + B,
              why: cellName(P) + ' and ' + cellName(Q) + ' both read ' + A + '/' + B + ', and ' +
                   cellName(X) + '/' + cellName(Y) + ' are the only ' + B + 's in ' + unitName(L.unit) +
                   '. One of those two is the ' + B + ', which knocks the ' + B + ' out of ' +
                   (sees(X, P) ? cellName(P) : cellName(Q)) + ' or ' +
                   (sees(Y, Q) ? cellName(Q) : cellName(P)) + ' — so one of the pair is the ' + A +
                   ', and anything seeing both loses it.'
            });
          });
        });
      });
    }
    return out;
  }

  /* ---------------- XY-chain ----------------
     The XY-Wing with more links in it. Every cell holds two candidates and
     shares one with the next; if the first is not Z then the digits cascade
     along the chain and the last one is. */
  function xyChain(g, cand, cap) {
    const out = [];
    const bi = [];
    for (let i = 0; i < 81; i++) if (!g[i] && cand[i].size === 2) bi.push(i);
    const MAX = cap || 6;
    const seen = new Set();
    bi.forEach(start => {
      [...cand[start]].forEach(Z => {
        const other = [...cand[start]].find(x => x !== Z);
        const path = [start];
        (function walk(cur, need) {
          if (path.length > MAX) return;
          if (path.length >= 4) {
            /* It ends where the cascade FORCES a Z, not merely where a Z is
               still a candidate — `need` is the digit this square is pushed
               to, and the whole chain says nothing unless that digit is Z. */
            if (need === Z && cur !== start) {
              const a = start, b = cur;
              const key = Math.min(a, b) + ':' + Math.max(a, b) + ':' + Z + ':' + path.length;
              if (!seen.has(key) && !sees(a, b)) {
                const elims = [];
                for (let i = 0; i < 81; i++) {
                  if (g[i] || !cand[i].has(Z) || path.indexOf(i) >= 0) continue;
                  if (sees(i, a) && sees(i, b)) elims.push({ cell: i, digit: Z });
                }
                if (elims.length) {
                  seen.add(key);
                  const lines = [];
                  for (let k = 0; k + 1 < path.length; k++) lines.push(seg(path[k], path[k + 1]));
                  out.push({
                    id: 'xy_chain', name: NAME.xy_chain, family: 'Chain', rank: RANK.xy_chain,
                    digits: [Z], cells: path.slice(), roof: [a, b], elims, units: [], lines,
                    region: path.length + ' two-mark squares, ' + cellName(a) + ' to ' + cellName(b),
                    why: 'Follow the chain ' + path.map(cellName).join(' → ') + ': each square ' +
                         'shares a digit with the next, and both ends can be ' + Z + '. If ' +
                         cellName(a) + ' is not the ' + Z + ' the whole chain flips and ' + cellName(b) +
                         ' is — so one of them is, and anything seeing both loses the ' + Z + '.'
                  });
                }
              }
            }
          }
          if (path.length >= MAX) return;
          bi.forEach(nxt => {
            if (path.indexOf(nxt) >= 0 || !sees(cur, nxt) || !cand[nxt].has(need)) return;
            const on = [...cand[nxt]].find(x => x !== need);
            path.push(nxt);
            walk(nxt, on);
            path.pop();
          });
        })(start, other);
      });
    });
    return out;
  }

  /* ---------------- AIC ----------------
     The general form, and the reason the eight above are worth learning as
     variations rather than as eight separate facts. A chain alternates strong
     links (one of these two is true) with weak ones (these two cannot both be
     true), starting and ending strong; that proves at least one end is true,
     and the eliminations follow from the two ends alone.

     Only searched when the cheaper detectors have come up empty — see findAll.
     It is the last resort by construction, and a full search on every keypress
     would cost more than the answer is worth. */
  function aic(g, cand, limit) {
    const out = [];
    const key = (c, d) => c * 10 + d;
    /* strong: the two ends of a two-spot unit, and the two candidates of a
       two-candidate cell. */
    const strong = new Map();
    const add = (m, a, b) => { if (!m.has(a)) m.set(a, []); m.get(a).push(b); };
    for (let d = 1; d <= 9; d++) strongLinks(g, cand, d).forEach(L => {
      add(strong, key(L.a, d), { cell: L.b, digit: d, unit: L.unit });
      add(strong, key(L.b, d), { cell: L.a, digit: d, unit: L.unit });
    });
    for (let i = 0; i < 81; i++) {
      if (g[i] || cand[i].size !== 2) continue;
      const [x, y] = [...cand[i]];
      add(strong, key(i, x), { cell: i, digit: y, cellLink: true });
      add(strong, key(i, y), { cell: i, digit: x, cellLink: true });
    }
    const weakOf = (c, d) => {
      const res = [];
      PEERS[c].forEach(p => { if (!g[p] && cand[p].has(d)) res.push({ cell: p, digit: d }); });
      cand[c].forEach(e => { if (e !== d) res.push({ cell: c, digit: e }); });
      return res;
    };
    const MAX = 5;                      // links, so at most three strong ones
    let budget = 60000;                 // nodes visited, board-wide
    const found = new Set();
    const nodes = [];
    for (let i = 0; i < 81; i++) if (!g[i]) cand[i].forEach(d => nodes.push({ cell: i, digit: d }));

    for (const startNode of nodes) {
      if (out.length >= (limit || 6)) break;
      const path = [startNode];
      const used = new Set([key(startNode.cell, startNode.digit)]);
      (function walk(cur, depth, wantStrong) {
        if (out.length >= (limit || 6) || depth >= MAX || budget <= 0) return;
        const nexts = wantStrong ? (strong.get(key(cur.cell, cur.digit)) || [])
                                 : weakOf(cur.cell, cur.digit);
        for (const n of nexts) {
          const k = key(n.cell, n.digit);
          if (used.has(k)) continue;
          /* A weak link is only worth following if the node it lands on can
             carry the chain onward with a strong one. Without this the search
             fans out across every peer of every candidate and never returns. */
          if (!wantStrong && !(strong.get(k) || []).length) continue;
          if (--budget <= 0) return;
          used.add(k); path.push(n);
          if (wantStrong && path.length >= 4) {
            const A = path[0], B = n;
            const elims = [];
            if (A.digit === B.digit) {
              for (let i = 0; i < 81; i++) {
                if (g[i] || !cand[i].has(A.digit)) continue;
                if (path.some(p => p.cell === i)) continue;
                if (sees(i, A.cell) && sees(i, B.cell)) elims.push({ cell: i, digit: A.digit });
              }
            } else if (A.cell !== B.cell && sees(A.cell, B.cell)) {
              /* Different digits: if A held B's digit it would have to be the
                 other end too, and the two see each other. So each end loses
                 the other's digit. */
              if (cand[A.cell].has(B.digit)) elims.push({ cell: A.cell, digit: B.digit });
              if (cand[B.cell].has(A.digit)) elims.push({ cell: B.cell, digit: A.digit });
            } else if (A.cell === B.cell) {
              /* Both ends in one square: one of the two digits is true, so
                 every other candidate there dies. */
              cand[A.cell].forEach(e => {
                if (e !== A.digit && e !== B.digit) elims.push({ cell: A.cell, digit: e });
              });
            }
            if (elims.length) {
              const sig = path.map(p => key(p.cell, p.digit)).join('-');
              const rev = path.slice().reverse().map(p => key(p.cell, p.digit)).join('-');
              if (!found.has(sig) && !found.has(rev)) {
                found.add(sig);
                const lines = [];
                for (let k2 = 0; k2 + 1 < path.length; k2++) {
                  if (path[k2].cell !== path[k2 + 1].cell)
                    lines.push(seg(path[k2].cell, path[k2 + 1].cell, k2 % 2 ? 'cross' : 'lead'));
                }
                out.push({
                  id: 'aic', name: NAME.aic, family: 'Chain', rank: RANK.aic,
                  digits: [...new Set(path.map(p => p.digit))].sort((a, b) => a - b),
                  cells: [...new Set(path.map(p => p.cell))],
                  roof: [A.cell, B.cell], elims, units: [], lines,
                  chain: path.map(p => ({ cell: p.cell, digit: p.digit })),
                  region: path.length + ' links, ' + cellName(A.cell) + ' to ' + cellName(B.cell),
                  why: 'The chain ' + path.map(p => p.digit + ' in ' + cellName(p.cell)).join(' = ') +
                       ' alternates strong and weak links, so at least one of its two ends is true. ' +
                       (A.digit === B.digit
                         ? 'Both ends are the ' + A.digit + ', so everything seeing both loses it.'
                         : 'The two ends see each other, so neither can hold the other’s digit.')
                });
              }
            }
          }
          walk(n, depth + 1, !wantStrong);
          used.delete(k); path.pop();
          if (out.length >= (limit || 6)) return;
        }
      })(startNode, 0, true);
    }
    return out;
  }

  /* ---------------- audit ----------------
     The check board's end of the master tier. Same contract as audit() in
     techniques.js — conditions the marks settle come back ok or bad, claims
     about squares you have not typed come back `assume` — but the tier makes
     the split sharper, because most of what is up here is a claim about a
     COUNT. A chain's links are strong links, and a strong link is the sentence
     "this unit has exactly two of these": something a fragment can never show
     you, and the whole reason a chain is hard to trust in play.

     So the honest yes on this tier is rare and worth having: the XY-chain and
     the unique rectangle can be settled outright, and everything else comes
     back with its links listed as counts you still owe. */

  function audit(notes, id, sel) {
    const marked = [];
    for (let i = 0; i < 81; i++) if (notes[i] && notes[i].size) marked.push(i);
    const src = (sel && sel.length ? sel.slice() : marked.slice());
    const cells = src.filter(i => notes[i] && notes[i].size).sort((a, b) => a - b);
    const of = i => [...notes[i]].sort((a, b) => a - b);
    const R = {
      id, name: NAME[id], cells, unmarked: src.filter(i => !(notes[i] && notes[i].size)),
      conditions: [], kills: [], zone: [], digits: [], lines: [], pivot: null,
      wings: [], roof: [], units: [], zoneText: '', note: ''
    };
    const cap = t => (/^r\d+c\d+/.test(t) ? t : t.charAt(0).toUpperCase() + t.slice(1));
    const ok = t => (R.conditions.push({ state: 'ok', text: cap(t) }), true);
    const bad = t => (R.conditions.push({ state: 'bad', text: cap(t) }), true);
    const assume = t => (R.conditions.push({ state: 'assume', text: cap(t) }), true);
    const done = () => {
      R.verdict = R.conditions.some(c => c.state === 'bad') ? 'no'
        : R.conditions.some(c => c.state === 'assume') ? 'maybe' : 'yes';
      const s1 = new Set();
      R.zone = R.zone.filter(i => (s1.has(i) ? false : (s1.add(i), true)));
      const s2 = new Set();
      R.kills = R.kills.filter(k => {
        const key = k.cell + ':' + k.digit;
        return s2.has(key) ? false : (s2.add(key), true);
      });
      return R;
    };
    function land(region, d, skip) {
      region.forEach(i => {
        if (skip.indexOf(i) >= 0) return;
        if (notes[i] && notes[i].size) { if (notes[i].has(d)) R.kills.push({ cell: i, digit: d }); }
        else R.zone.push(i);
      });
    }
    const seesBoth = (a, b, d, skip) => {
      const out = [];
      for (let i = 0; i < 81; i++) {
        if (skip.indexOf(i) >= 0) continue;
        if (sees(i, a) && sees(i, b)) out.push(i);
      }
      land(out, d, skip);
      return out;
    };
    const common = cs => {
      const out = [];
      for (let d = 1; d <= 9; d++) if (cs.every(i => notes[i].has(d))) out.push(d);
      return out;
    };
    const witness = (u, d, skip) => u.filter(i => skip.indexOf(i) < 0 && notes[i] && notes[i].has(d));
    const blanks = (u, skip) => u.filter(i => skip.indexOf(i) < 0 && !(notes[i] && notes[i].size));
    const plural = (n, one, many) => (n === 1 ? one : many);
    /* Every chain on this tier leans on strong links, and a fragment cannot
       prove one. This is the sentence that says so, once, in the same shape
       every time. */
    function linkCondition(u, d, skip) {
      const clash = witness(u, d, skip);
      if (clash.length) return bad('You have typed another ' + d + ' at ' + list(clash) + ' in ' +
        unitName(u) + ', so that is not a strong link — the chain needs exactly two ' + d + 's there.');
      const unknown = blanks(u, skip);
      if (unknown.length) return assume(unitName(u) + ' must hold exactly two ' + d + 's — the two in ' +
        'the chain. ' + unknown.length + ' of its squares ' + plural(unknown.length, 'is', 'are') +
        ' blank here.');
      return ok(unitName(u) + ' holds exactly two ' + d + 's — you typed it all in.');
    }

    if (!cells.length) { bad('Nothing to read — write some pencil marks in first.'); return done(); }
    if (R.unmarked.length) {
      bad(list(R.unmarked) + ' ' + plural(R.unmarked.length, 'has', 'have') + ' no marks in it.');
      return done();
    }

    /* ---- unique rectangle: everything it claims is in the four corners ---- */
    if (id === 'unique_rect') {
      if (cells.length !== 4) { bad('A unique rectangle is four corners; you have marked ' +
        cells.length + '.'); return done(); }
      const rs = [...new Set(cells.map(rowOf))], cs = [...new Set(cells.map(colOf))];
      if (rs.length !== 2 || cs.length !== 2) { bad('These four do not make a rectangle: they cover ' +
        rs.length + ' rows and ' + cs.length + ' columns.'); return done(); }
      ok('Four corners of a rectangle, rows ' + rs.map(x => x + 1).join(' and ') + ', columns ' +
         cs.map(x => x + 1).join(' and ') + '.');
      const bx = new Set(cells.map(boxOf));
      if (bx.size !== 2) { bad('The four corners lie in ' + bx.size + ' boxes. A deadly pattern ' +
        'needs exactly two — over four boxes the digits cannot swap without leaving a box short, ' +
        'and this is the false positive that catches everyone.'); return done(); }
      ok('They lie in exactly two boxes.');
      const pairs = common(cells);
      if (pairs.length < 2) { bad('The four corners share ' + (pairs.length ? 'only the ' + pairs[0] :
        'no digit') + '. A unique rectangle needs the same two candidates in all four.'); return done(); }
      const bare = cells.filter(i => notes[i].size === 2);
      const pool = bare.length ? of(bare[0]) : pairs.slice(0, 2);
      const [A, B] = pool;
      if (!cells.every(i => notes[i].has(A) && notes[i].has(B))) {
        bad('Not every corner can take both ' + A + ' and ' + B + '.'); return done(); }
      ok('All four can take ' + A + ' and ' + B + '.');
      R.digits = [A, B];
      R.lines = [[cells[0], cells[1], 'lead'], [cells[2], cells[3], 'lead'],
                 [cells[0], cells[2], 'lead'], [cells[1], cells[3], 'lead']];
      assume('This one argues from the puzzle having exactly one answer, not from the grid. It is ' +
             'only safe on a puzzle you trust and a grid you have not already broken.');
      const extras = cells.filter(i => notes[i].size > 2);
      if (extras.length === 1) {
        ok('Three corners hold nothing but ' + A + '/' + B + ', and ' + cellName(extras[0]) +
           ' carries ' + of(extras[0]).filter(d => d !== A && d !== B).join('/') + ' as well.');
        [A, B].forEach(d => { if (notes[extras[0]].has(d)) R.kills.push({ cell: extras[0], digit: d }); });
        R.zoneText = 'Type 1. ' + cellName(extras[0]) + ' loses ' + A + ' and ' + B + ', which leaves ' +
          'it on ' + of(extras[0]).filter(d => d !== A && d !== B).join('/') + '.';
      } else if (extras.length === 2 && extras.every(i => notes[i].size === 3)) {
        const e1 = of(extras[0]).filter(d => d !== A && d !== B)[0];
        const e2 = of(extras[1]).filter(d => d !== A && d !== B)[0];
        if (e1 !== e2) { bad('The two corners with extras carry different ones (' + e1 + ' and ' + e2 +
          '), so nothing is forced. That is a type 3 or 4 rectangle at best, and this audits ' +
          'types 1 and 2.'); return done(); }
        ok(cellName(extras[0]) + ' and ' + cellName(extras[1]) + ' each carry one extra ' + e1 + '.');
        R.digits = [e1];
        seesBoth(extras[0], extras[1], e1, cells);
        R.roof = extras.slice();
        R.zoneText = 'Type 2. One of ' + list(extras) + ' has to be the ' + e1 + ', so everything ' +
          'seeing both loses it.';
      } else {
        bad('For a type 1 exactly one corner carries extras; for a type 2, exactly two, one extra ' +
            'digit each. You have ' + extras.length + ' corners with extras.');
        return done();
      }
      return done();
    }

    /* ---- BUG+1: the one technique a fragment cannot support at all ---- */
    if (id === 'bug') {
      bad('BUG+1 is a claim about every unsolved square on the board — that all of them hold two ' +
          'candidates except one, and that every digit has exactly two homes in every unit. A ' +
          'handful of squares cannot show that, and no honest answer can be given from one.');
      R.note = 'Take it to the trainer instead: on the Master tier the coach checks the whole ' +
               'position for it, and only offers it when the digits on the board still lead to ' +
               'exactly one answer.';
      return done();
    }

    /* ---- finned X-Wing ---- */
    if (id === 'finned') {
      if (cells.length < 4 || cells.length > 7) { bad('A finned X-Wing is the four corners plus its ' +
        'fins — four to seven squares. You have marked ' + cells.length + '.'); return done(); }
      const ds = common(cells);
      if (!ds.length) { bad('They share no digit, and a fish is one digit only.'); return done(); }
      const d = ds[0];
      R.digits = [d];
      ok('All ' + cells.length + ' squares can take the ' + d + '.');
      let best = null;
      [[ROWS, rowOf, colOf, 'row', 'column'], [COLS, colOf, rowOf, 'column', 'row']].forEach(cfg => {
        if (best) return;
        const [lines, on, at, word, crossWord] = cfg;
        const ls = [...new Set(cells.map(on))];
        if (ls.length !== 2) return;
        const xs = [...new Set(cells.map(at))].sort((a, b) => a - b);
        if (xs.length !== 3 && xs.length !== 4) return;
        for (let a = 0; a < xs.length; a++) for (let b = a + 1; b < xs.length; b++) {
          const covers = [xs[a], xs[b]];
          const fins = cells.filter(i => covers.indexOf(at(i)) < 0);
          if (!fins.length) continue;
          if (new Set(fins.map(boxOf)).size !== 1) continue;
          if (new Set(fins.map(on)).size !== 1) continue;
          const fl = on(fins[0]), other = ls.find(x => x !== fl);
          if (other === undefined) continue;
          if (cells.some(i => on(i) === other && covers.indexOf(at(i)) < 0)) continue;
          if (!cells.some(i => on(i) === fl && covers.indexOf(at(i)) >= 0)) continue;
          best = { lines, on, at, word, crossWord, ls, covers, fins, fl };
          return;
        }
      });
      if (!best) { bad('These do not lay out as a finned fish: two lines, two crossing lines ' +
        'covering all of it but the fins, and every fin in one box beside the pattern.'); return done(); }
      ok('Two ' + best.word + 's (' + best.ls.map(x => x + 1).sort().join(' and ') + ') landing on ' +
         best.crossWord + 's ' + best.covers.map(x => x + 1).join(' and ') + ', with ' +
         list(best.fins) + ' left over.');
      ok('The ' + plural(best.fins.length, 'fin', 'fins') + ' sits in box ' + (boxOf(best.fins[0]) + 1) +
         ' — that is what keeps the eliminations alive, and what confines them.');
      best.ls.forEach(l => {
        const u = best.lines[l];
        const clash = witness(u, d, cells);
        if (clash.length) bad('You have typed another ' + d + ' at ' + list(clash) + ' in ' +
          unitName(u) + ', outside both the pattern and the fins, so there is no fish underneath.');
        else {
          const unknown = blanks(u, cells);
          if (unknown.length) assume(unitName(u) + ' must hold no ' + d + ' outside these squares. ' +
            unknown.length + ' of its squares ' + plural(unknown.length, 'is', 'are') + ' blank here.');
          else ok(unitName(u) + ' holds no other ' + d + ' — you typed it all in.');
        }
      });
      if (R.conditions.some(c => c.state === 'bad')) return done();
      const finBox = boxOf(best.fins[0]);
      const region = [];
      best.covers.forEach(x => (best.at === colOf ? COLS[x] : ROWS[x]).forEach(i => {
        if (best.ls.indexOf(best.on(i)) >= 0) return;
        if (boxOf(i) !== finBox) return;
        region.push(i);
      }));
      land(region, d, cells);
      R.units = best.ls.map(l => best.lines[l]);
      R.zoneText = 'The ' + d + ' leaves the part of ' + best.crossWord + 's ' +
        best.covers.map(x => x + 1).join(' and ') + ' that sits inside box ' + (finBox + 1) +
        ' — and nothing else, because only those squares see every fin.';
      return done();
    }

    /* ---- 2-string kite ---- */
    if (id === 'kite') {
      if (cells.length !== 4) { bad('A kite is four squares — two in a row, two in a column. You ' +
        'have marked ' + cells.length + '.'); return done(); }
      const ds = common(cells);
      if (!ds.length) { bad('They share no digit, and a kite is one digit only.'); return done(); }
      const d = ds[0];
      R.digits = [d];
      ok('Four squares, all able to take the ' + d + '.');
      let found = null;
      cells.forEach(nr => cells.forEach(nk => {
        if (found || nr === nk) return;
        const fr = cells.find(i => i !== nr && i !== nk && rowOf(i) === rowOf(nr));
        const fk = cells.find(i => i !== nr && i !== nk && colOf(i) === colOf(nk));
        if (fr === undefined || fk === undefined || fr === fk) return;
        if (rowOf(nr) === rowOf(nk) || colOf(nr) === colOf(nk)) return;
        if (boxOf(nr) !== boxOf(nk)) return;
        found = { nr, nk, fr, fk };
      }));
      if (!found) { bad('These four are not a kite: it needs two on one row, two on one column, and ' +
        'the two near ends sharing a box without sharing a line.'); return done(); }
      ok('Row ' + (rowOf(found.nr) + 1) + ' holds ' + list([found.nr, found.fr]) + ', column ' +
         (colOf(found.nk) + 1) + ' holds ' + list([found.nk, found.fk]) + '.');
      ok('The near ends ' + list([found.nr, found.nk]) + ' share box ' + (boxOf(found.nr) + 1) +
         ', so they cannot both be the ' + d + '.');
      linkCondition(ROWS[rowOf(found.nr)], d, cells);
      linkCondition(COLS[colOf(found.nk)], d, cells);
      if (R.conditions.some(c => c.state === 'bad')) return done();
      R.roof = [found.fr, found.fk];
      R.units = [ROWS[rowOf(found.nr)], COLS[colOf(found.nk)]];
      R.lines = [[found.fr, found.nr, 'lead'], [found.nk, found.fk, 'lead'],
                 [found.nr, found.nk, 'cross']];
      seesBoth(found.fr, found.fk, d, cells);
      R.zoneText = 'One of the far ends ' + list([found.fr, found.fk]) + ' is the ' + d +
        ', so anything seeing both loses it.';
      return done();
    }

    /* ---- empty rectangle ---- */
    if (id === 'empty_rect') {
      if (cells.length < 4 || cells.length > 6) { bad('Mark the box’s spots for the digit and ' +
        'the two ends of the strong link — four to six squares. You have ' + cells.length + '.');
        return done(); }
      const ds = common(cells);
      if (!ds.length) { bad('They share no digit, and this is one digit’s argument.'); return done(); }
      const d = ds[0];
      R.digits = [d];
      let found = null;
      [...new Set(cells.map(boxOf))].forEach(bi => {
        if (found) return;
        const inBox = cells.filter(i => boxOf(i) === bi);
        const out = cells.filter(i => boxOf(i) !== bi);
        if (inBox.length < 2 || out.length !== 2) return;
        const rs = [...new Set(inBox.map(rowOf))], cs = [...new Set(inBox.map(colOf))];
        rs.forEach(r => cs.forEach(c => {
          if (found) return;
          if (!inBox.every(i => rowOf(i) === r || colOf(i) === c)) return;
          if (!inBox.some(i => rowOf(i) === r && colOf(i) !== c)) return;
          if (!inBox.some(i => colOf(i) === c && rowOf(i) !== r)) return;
          [[out[0], out[1]], [out[1], out[0]]].forEach(([A, Z]) => {
            if (found) return;
            let target = -1, unit = null;
            if (colOf(A) === colOf(Z) && rowOf(A) === r && colOf(A) !== c) {
              target = rowOf(Z) * 9 + c; unit = COLS[colOf(A)];
            } else if (rowOf(A) === rowOf(Z) && colOf(A) === c && rowOf(A) !== r) {
              target = r * 9 + colOf(Z); unit = ROWS[rowOf(A)];
            }
            if (target < 0 || boxOf(target) === bi) return;
            found = { bi, r, c, inBox, A, Z, target, unit };
          });
        }));
      });
      if (!found) { bad('These do not lay out as an empty rectangle plus a link: the box’s ' +
        'spots must fill one row and one column of it, and the other two squares must be a line ' +
        'pair with one end on that row or column.'); return done(); }
      ok('Box ' + (found.bi + 1) + '’s ' + d + 's sit in row ' + (found.r + 1) + ' and column ' +
         (found.c + 1) + ' — so the box’s ' + d + ' is on one of them.');
      const box = BOXES[found.bi];
      const clash = witness(box, d, cells);
      if (clash.length) bad('You have typed a ' + d + ' at ' + list(clash) + ' in box ' +
        (found.bi + 1) + ', off both lines, so the box is not confined at all.');
      else {
        const unknown = blanks(box, cells);
        if (unknown.length) assume('Box ' + (found.bi + 1) + ' must hold no other ' + d + '. ' +
          unknown.length + ' of its squares ' + plural(unknown.length, 'is', 'are') + ' blank here.');
        else ok('Box ' + (found.bi + 1) + ' holds no other ' + d + ' — you typed it all in.');
      }
      linkCondition(found.unit, d, cells);
      if (R.conditions.some(c => c.state === 'bad')) return done();
      R.units = [box];
      R.lines = [[found.A, found.Z, 'lead'], [found.Z, found.target, 'cross']];
      land([found.target], d, cells);
      R.zoneText = 'It comes down to one square: ' + cellName(found.target) + '. If ' +
        cellName(found.A) + ' is the ' + d + ' the box takes column ' + (found.c + 1) + '; if it is ' +
        'not, ' + cellName(found.Z) + ' is the ' + d + ' — and ' + cellName(found.target) +
        ' loses it either way.';
      return done();
    }

    /* ---- W-Wing ---- */
    if (id === 'w_wing') {
      if (cells.length !== 4) { bad('A W-Wing is four squares: the two that read the same pair, and ' +
        'the two ends of the link between them. You have marked ' + cells.length + '.'); return done(); }
      let found = null;
      cells.forEach(P => cells.forEach(Q => {
        if (found || P >= Q) return;
        if (notes[P].size !== 2 || notes[Q].size !== 2) return;
        const p = of(P), q = of(Q);
        if (p[0] !== q[0] || p[1] !== q[1] || sees(P, Q)) return;
        const rest = cells.filter(i => i !== P && i !== Q);
        if (rest.length !== 2) return;
        p.forEach((B, k) => {
          if (found) return;
          const A = p[1 - k];
          if (!rest.every(i => notes[i].has(B))) return;
          const u = UNITS.find(un => un.includes(rest[0]) && un.includes(rest[1]));
          if (!u) return;
          const [X, Y] = rest;
          if (sees(X, P) && sees(Y, Q)) found = { P, Q, A, B, X, Y, u };
          else if (sees(Y, P) && sees(X, Q)) found = { P, Q, A, B, X: Y, Y: X, u };
        });
      }));
      if (!found) { bad('These four are not a W-Wing: two of them must read the same two digits ' +
        'without seeing each other, and the other two must share a unit, both hold one of those ' +
        'digits, and each see one of the pair.'); return done(); }
      ok(cellName(found.P) + ' and ' + cellName(found.Q) + ' both read ' + found.A + '/' + found.B +
         ', and they are strangers to each other.');
      ok(cellName(found.X) + ' and ' + cellName(found.Y) + ' share ' + unitName(found.u) +
         ', and each sees one of the pair.');
      linkCondition(found.u, found.B, cells);
      if (R.conditions.some(c => c.state === 'bad')) return done();
      R.digits = [found.A];
      R.roof = [found.P, found.Q];
      R.units = [found.u];
      R.lines = [[found.P, found.X, 'cross'], [found.X, found.Y, 'lead'], [found.Y, found.Q, 'cross']];
      seesBoth(found.P, found.Q, found.A, cells);
      R.zoneText = 'One of ' + list([found.P, found.Q]) + ' has to be the ' + found.A +
        ', so anything seeing both loses it.';
      return done();
    }

    /* ---- XY-chain: the one thing up here a fragment settles outright ---- */
    if (id === 'xy_chain') {
      if (cells.length < 3) { bad('A chain needs at least three squares; you have marked ' +
        cells.length + '.'); return done(); }
      if (cells.length > 8) { bad('Eight squares is as long a chain as this will order for you.');
        return done(); }
      const wrong = cells.filter(i => notes[i].size !== 2);
      if (wrong.length) { bad(list(wrong) + ' ' + plural(wrong.length, 'has', 'have') +
        ' more than two marks. Every link in an XY-chain is a two-mark square.'); return done(); }
      ok(cells.length + ' squares, two marks each.');
      /* The selection is a set; the chain is an order. Find one — every square
         used once, each seeing the next and sharing the digit it is forced to. */
      let chain = null;
      cells.forEach(start => {
        if (chain) return;
        of(start).forEach(Z => {
          if (chain) return;
          const other = of(start).find(x => x !== Z);
          const path = [start];
          (function walk(cur, need) {
            if (chain) return;
            if (path.length === cells.length) {
              if (need === Z && cur !== start) chain = { path: path.slice(), Z };
              return;
            }
            cells.forEach(nxt => {
              if (chain || path.indexOf(nxt) >= 0) return;
              if (!sees(cur, nxt) || !notes[nxt].has(need)) return;
              path.push(nxt);
              walk(nxt, of(nxt).find(x => x !== need));
              path.pop();
            });
          })(start, other);
        });
      });
      if (!chain) { bad('These squares will not chain: each has to see the next and carry the digit ' +
        'the one before it is pushed onto, and the two ends have to land on the same digit.');
        return done(); }
      const a = chain.path[0], b = chain.path[chain.path.length - 1];
      ok('They chain as ' + chain.path.map(cellName).join(' → ') + '.');
      ok('Both ends can be the ' + chain.Z + ': if ' + cellName(a) + ' is not, the chain flips all ' +
         'the way along and ' + cellName(b) + ' is.');
      R.digits = [chain.Z];
      R.roof = [a, b];
      R.cells = chain.path.slice();
      for (let k = 0; k + 1 < chain.path.length; k++) R.lines.push([chain.path[k], chain.path[k + 1], 'lead']);
      seesBoth(a, b, chain.Z, chain.path);
      R.zoneText = 'One of ' + list([a, b]) + ' is the ' + chain.Z + ', so anything seeing both ' +
        'loses it.';
      R.note = 'Nothing here needs a scan you have not done. Every link is inside a square you ' +
        'typed, which is what makes this the one chain you can settle from a fragment.';
      return done();
    }

    /* ---- AIC ---- */
    if (id === 'aic') {
      if (cells.length < 3 || cells.length > 7) { bad('Mark the squares the chain runs through — ' +
        'three to seven of them. You have ' + cells.length + '.'); return done(); }
      /* Order the squares into an alternating chain. A link inside a square is
         strong only when the square has two marks; a link between squares is
         strong only if that unit has two spots, which a fragment cannot show —
         so those are found here and reported as assumptions below. */
      let chain = null;
      const linkUnit = (a, b, d) => UNITS.find(u => u.includes(a) && u.includes(b) &&
        u.every(i => i === a || i === b || !(notes[i] && notes[i].has(d))));
      /* `wantStrong` is the kind of link the next step must be, so a chain is
         finished when the step just taken was a STRONG one — that is, when the
         next one would be weak. Getting that the wrong way round accepts a
         chain ending on a weak link, which proves nothing at all. */
      cells.forEach(start => {
        if (chain) return;
        of(start).forEach(sd => {
          if (chain) return;
          const path = [{ cell: start, digit: sd }];
          const used = new Set([start]);
          (function walk(cur, wantStrong) {
            if (chain) return;
            if (!wantStrong && path.length >= 4 && used.size === cells.length) {
              chain = path.slice();
              return;
            }
            if (path.length > cells.length + 2) return;
            cells.forEach(nxt => {
              if (chain) return;
              if (nxt === cur.cell) {
                /* Inside the square: strong when it holds exactly two marks,
                   weak whenever it holds more. */
                of(nxt).forEach(d2 => {
                  if (chain || d2 === cur.digit) return;
                  if (path.length > 1 && path[path.length - 2].cell === nxt) return;
                  const strong = notes[nxt].size === 2;
                  if (strong !== wantStrong) return;
                  path.push({ cell: nxt, digit: d2, inCell: true });
                  walk({ cell: nxt, digit: d2 }, !wantStrong);
                  path.pop();
                });
                return;
              }
              if (used.has(nxt) || !sees(cur.cell, nxt) || !notes[nxt].has(cur.digit)) return;
              const u = wantStrong ? linkUnit(cur.cell, nxt, cur.digit) : null;
              if (wantStrong && !u) return;         // no unit where these are the only two
              used.add(nxt);
              path.push({ cell: nxt, digit: cur.digit, unit: u });
              walk({ cell: nxt, digit: cur.digit }, !wantStrong);
              path.pop(); used.delete(nxt);
            });
          })({ cell: start, digit: sd }, true);
        });
      });
      if (!chain) { bad('These squares will not make an alternating chain. Strong and weak links ' +
        'have to alternate, and it has to start and end on a strong one — inside a two-mark square, ' +
        'or between two squares that are the only homes for a digit in some unit.'); return done(); }
      const A = chain[0], B = chain[chain.length - 1];
      ok('It reads as ' + chain.map(n => n.digit + ' in ' + cellName(n.cell)).join(' = ') + '.');
      ok('Strong and weak links alternate, and both ends are strong — so at least one end is true.');
      chain.forEach(n => { if (n.unit) linkCondition(n.unit, n.digit, cells); });
      R.digits = [...new Set(chain.map(n => n.digit))].sort((a, b) => a - b);
      R.cells = [...new Set(chain.map(n => n.cell))];
      R.roof = [A.cell, B.cell];
      for (let k = 0; k + 1 < chain.length; k++) {
        if (chain[k].cell !== chain[k + 1].cell)
          R.lines.push([chain[k].cell, chain[k + 1].cell, k % 2 ? 'cross' : 'lead']);
      }
      if (A.digit === B.digit) {
        seesBoth(A.cell, B.cell, A.digit, R.cells);
        R.zoneText = 'Both ends are the ' + A.digit + ', so every square seeing ' + cellName(A.cell) +
          ' and ' + cellName(B.cell) + ' loses it.';
      } else if (A.cell === B.cell) {
        of(A.cell).forEach(d => {
          if (d !== A.digit && d !== B.digit) R.kills.push({ cell: A.cell, digit: d });
        });
        R.zoneText = 'Both ends are in ' + cellName(A.cell) + ', so it is ' + A.digit + ' or ' +
          B.digit + ' and every other mark in it dies.';
      } else if (sees(A.cell, B.cell)) {
        if (notes[A.cell].has(B.digit)) R.kills.push({ cell: A.cell, digit: B.digit });
        if (notes[B.cell].has(A.digit)) R.kills.push({ cell: B.cell, digit: A.digit });
        R.zoneText = 'The ends carry different digits and see each other, so neither can hold the ' +
          'other’s: ' + cellName(A.cell) + ' loses the ' + B.digit + ' and ' + cellName(B.cell) +
          ' loses the ' + A.digit + '.';
      } else {
        assume('The two ends carry different digits and do not see each other, so this particular ' +
               'chain proves something true without killing anything. Extend it, or start it ' +
               'somewhere else.');
        R.zoneText = '';
      }
      return done();
    }

    /* ---- simple colouring ---- */
    if (id === 'colouring') {
      if (cells.length < 4) { bad('Colouring needs a network: at least four squares linked in ' +
        'pairs. You have marked ' + cells.length + '.'); return done(); }
      const ds = common(cells);
      if (!ds.length) { bad('They share no digit, and colouring runs on one digit.'); return done(); }
      const d = ds[0];
      R.digits = [d];
      ok('All ' + cells.length + ' squares can take the ' + d + '.');
      /* Two squares count as a link here when nothing else you have typed in
         their unit can take the digit. That is a strong link as far as the
         fragment goes, and every one of them is listed below as a count. */
      const links = [];
      for (let a = 0; a < cells.length; a++) for (let b = a + 1; b < cells.length; b++) {
        const u = UNITS.find(un => un.includes(cells[a]) && un.includes(cells[b]) &&
          !witness(un, d, [cells[a], cells[b]]).length);
        if (u) links.push({ a: cells[a], b: cells[b], unit: u });
      }
      if (links.length < 2) { bad('Only ' + links.length + ' of these squares pair up in a unit, ' +
        'so there is no chain to colour.'); return done(); }
      const colour = new Map();
      colour.set(links[0].a, 0);
      let changed = true, broken = false;
      while (changed) {
        changed = false;
        links.forEach(L => {
          if (colour.has(L.a) && !colour.has(L.b)) { colour.set(L.b, 1 - colour.get(L.a)); changed = true; }
          else if (colour.has(L.b) && !colour.has(L.a)) { colour.set(L.a, 1 - colour.get(L.b)); changed = true; }
          else if (colour.has(L.a) && colour.get(L.a) === colour.get(L.b)) broken = true;
        });
      }
      if (broken) { bad('The links you have marked cannot be two-coloured — following them round ' +
        'gives one square both colours. On a real board that means an elimination somewhere was ' +
        'wrong.'); return done(); }
      const loose = cells.filter(i => !colour.has(i));
      if (loose.length) { bad(list(loose) + ' ' + plural(loose.length, 'is', 'are') +
        ' not linked to the rest, so the chain does not reach ' + plural(loose.length, 'it', 'them') +
        '.'); return done(); }
      ok('They colour alternately: ' + list(cells.filter(i => colour.get(i) === 0)) + ' one colour, ' +
         list(cells.filter(i => colour.get(i) === 1)) + ' the other.');
      links.forEach(L => linkCondition(L.unit, d, [L.a, L.b]));
      if (R.conditions.some(c => c.state === 'bad')) return done();
      R.lines = links.map(L => [L.a, L.b, 'lead']);
      const A = cells.filter(i => colour.get(i) === 0), B = cells.filter(i => colour.get(i) === 1);
      let trap = null;
      [A, B].forEach(same => {
        if (trap) return;
        for (let x = 0; x < same.length; x++) for (let y = x + 1; y < same.length; y++)
          if (sees(same[x], same[y])) { trap = { same, pair: [same[x], same[y]] }; return; }
      });
      if (trap) {
        ok(list(trap.pair) + ' take the same colour and see each other, so that whole colour is false.');
        trap.same.forEach(i => R.kills.push({ cell: i, digit: d }));
        R.zoneText = 'A colour is all true or all false. These two cannot both be the ' + d + ', so ' +
          'every square in their colour loses it.';
        return done();
      }
      const region = [];
      for (let i = 0; i < 81; i++) {
        if (cells.indexOf(i) >= 0) continue;
        if (A.some(x => sees(i, x)) && B.some(x => sees(i, x))) region.push(i);
      }
      land(region, d, cells);
      R.zoneText = region.length
        ? 'One colour is the truth. Anything seeing both colours loses the ' + d + ' whichever it is.'
        : 'The colouring holds, but nothing sees both colours — this network kills nothing where it ' +
          'stands. Extend it with another link and try again.';
      return done();
    }

    bad('No audit for ' + id + '.');
    return done();
  }

  /* ---------------- aggregate ----------------
     Cheap first, and the chain search last and conditionally: an AIC that
     exists on a board where a naked single also exists is not information, it
     is noise, and finding it costs more than every other detector combined. */
  function findAll(grid, notes, opts) {
    const T = root.SudokuTech;
    const cand = T.effective(grid, notes);
    const safe = C.solve(grid, 2).length === 1;
    let all = [].concat(
      uniqueRect(grid, cand, safe), bugPlusOne(grid, cand, safe),
      finnedFish(grid, cand), kite(grid, cand), emptyRect(grid, cand),
      colouring(grid, cand), wWing(grid, cand), xyChain(grid, cand)
    );
    const base = (opts && opts.base) || [];
    if (!all.length && !base.length) all = all.concat(aic(grid, cand));
    const seen = new Set();
    all = all.filter(f => {
      const k = f.id + '|' + f.cells.slice().sort((a, b) => a - b).join(',') + '|' +
                f.elims.map(e => e.cell + ':' + e.digit).sort().join(',');
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
    all.sort((a, b) => a.rank - b.rank || b.elims.length - a.elims.length);
    return { findings: all, candidates: cand, unique: safe };
  }

  root.SudokuMaster = {
    findAll, audit, NAME, EXPLAIN, LESSON, RANK, IDS,
    strongLinks, uniqueRect, bugPlusOne, finnedFish, kite, emptyRect, colouring,
    wWing, xyChain, aic
  };
})(typeof window !== 'undefined' ? window : globalThis);
