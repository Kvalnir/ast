/* harvest-master.js — the positions the Master pages are drawn from.
 *
 * The Advanced pages get their figures from tools/engine.py, which carries a
 * second implementation of the nine detectors. That was tolerable for nine and
 * is not for eighteen: a chain detector written twice is a chain detector that
 * disagrees with itself, and the disagreement would surface as a figure
 * claiming an elimination the trainer will not make.
 *
 * So the master tier has ONE implementation — assets/js/master.js, the one the
 * trainer runs — and this script walks real puzzles with it and writes down
 * what it finds. The Python generators render from the JSON; they do no
 * detecting of their own. Rebuilding the figures needs a JS runtime; redrawing
 * the pages does not, which is why the JSON is committed.
 *
 *   node tools/harvest-master.js > tools/master-examples.json
 *
 * With no node to hand, open dev/harvest.html in a browser and copy what it
 * prints. Either way, every instance written out has been checked against its
 * puzzle's solution first: nothing reaches a figure that would delete a digit
 * the answer needs.
 *
 * A near miss here is a real position that fails one condition of the
 * technique it is filed under — a rectangle over four boxes, fins in two
 * boxes, a chain that comes back on the wrong digit. Nothing is manufactured
 * by editing a grid, and each one is checked to contain no genuine instance of
 * its technique in the part of the board its figure will show.
 */
(function (root) {
  'use strict';

  function harvest(C, T, M, bank, opts) {
    opts = opts || {};
    const WANT_YES = opts.yes || 9;      // six for the gallery, three for the lesson
    const WANT_NO = opts.no || 4;
    const PASSES = opts.passes || 8;
    const { ROWS, COLS, BOXES, UNITS, PEERS, rowOf, colOf, boxOf, cellName } = C;
    const sees = (a, b) => PEERS[a].has(b);
    const spots = (g, cand, u, d) => u.filter(i => !g[i] && cand[i].has(d));

    /* ---- puzzles: the bank, and the same puzzles seen from other angles.
       Transposing and relabelling gives a board with the same logic in a
       different orientation, which is all these figures need to stop looking
       like nine views of one position. */
    let seed = 20260909;
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    function shuffle(a) {
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
    function transform(p, s, plain) {
      if (plain) return [p.slice(), s.slice()];
      const perm = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const rowP = [], colP = [];
      shuffle([0, 1, 2]).forEach(b => shuffle([0, 1, 2]).forEach(x => rowP.push(b * 3 + x)));
      shuffle([0, 1, 2]).forEach(b => shuffle([0, 1, 2]).forEach(x => colP.push(b * 3 + x)));
      const flip = rnd() < 0.5;
      const map = grid => {
        const out = new Array(81).fill(0);
        for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
          const v = grid[rowP[r] * 9 + colP[c]];
          out[flip ? c * 9 + r : r * 9 + c] = v ? perm[v - 1] : 0;
        }
        return out;
      };
      return [map(p), map(s)];
    }

    /* ---- near misses. Each is a real configuration that fails exactly one
       condition of the technique it is filed under, and each says which. */
    function nearUniqueRect(g, cand) {
      const out = [];
      for (let r1 = 0; r1 < 9; r1++) for (let r2 = r1 + 1; r2 < 9; r2++)
        for (let c1 = 0; c1 < 9; c1++) for (let c2 = c1 + 1; c2 < 9; c2++) {
          const cells = [r1 * 9 + c1, r1 * 9 + c2, r2 * 9 + c1, r2 * 9 + c2];
          if (cells.some(i => g[i])) continue;
          if (new Set(cells.map(boxOf)).size !== 4) continue;   // the whole point
          const bare = cells.filter(i => cand[i].size === 2);
          if (bare.length < 2) continue;
          const pair = [...cand[bare[0]]].sort((a, b) => a - b);
          if (!cells.every(i => pair.every(d => cand[i].has(d)))) continue;
          if (!bare.every(i => [...cand[i]].sort((a, b) => a - b).join() === pair.join())) continue;
          out.push({
            cells, digits: pair, elims: [], bad: null,
            miss: 'the four corners lie in four different boxes. A rectangle only turns deadly ' +
                  'across two — over four the digits cannot swap without leaving a box short, ' +
                  'and this is the false positive that catches everyone'
          });
        }
      return out;
    }

    function nearFinned(g, cand) {
      const out = [];
      for (let d = 1; d <= 9; d++) {
        for (const [lines, kind] of [[ROWS, 'row'], [COLS, 'column']]) {
          const sp = lines.map(l => spots(g, cand, l, d));
          const at = k => kind === 'row' ? colOf(k) : rowOf(k);
          for (let i = 0; i < 9; i++) for (let j = i + 1; j < 9; j++) {
            if (sp[i].length < 2 || sp[j].length < 2) continue;
            const all = sp[i].concat(sp[j]);
            if (all.length > 6) continue;
            const xs = [...new Set(all.map(at))].sort((a, b) => a - b);
            if (xs.length !== 3) continue;
            for (let a = 0; a < 3; a++) for (let b = a + 1; b < 3; b++) {
              const covers = [xs[a], xs[b]];
              const fins = all.filter(k => covers.indexOf(at(k)) < 0);
              if (fins.length < 2) continue;
              if (new Set(fins.map(boxOf)).size === 1) continue;   // that one works
              out.push({
                cells: all, digits: [d], elims: [], bad: fins[0], soloDigit: d,
                miss: 'the spots left over — ' + fins.map(cellName).join(', ') + ' — are in ' +
                      new Set(fins.map(boxOf)).size + ' different boxes. A fin only works when one ' +
                      'box sees all of it, because that box is the whole of what survives'
              });
            }
          }
        }
      }
      return out;
    }

    function nearKite(g, cand) {
      const out = [];
      for (let d = 1; d <= 9; d++) {
        const rows = [], cols = [];
        ROWS.forEach((u, li) => { const s = spots(g, cand, u, d); if (s.length === 2) rows.push({ li, s }); });
        COLS.forEach((u, li) => { const s = spots(g, cand, u, d); if (s.length === 2) cols.push({ li, s }); });
        rows.forEach(R => cols.forEach(K => {
          for (let a = 0; a < 2; a++) for (let b = 0; b < 2; b++) {
            const nr = R.s[a], fr = R.s[1 - a], nk = K.s[b], fk = K.s[1 - b];
            if (nr === nk || fr === fk) return;
            if (boxOf(nr) === boxOf(nk)) return;
            if (rowOf(nr) === rowOf(nk) || colOf(nr) === colOf(nk)) return;
            if (sees(fr, fk)) return;
            out.push({
              cells: [fr, nr, nk, fk], digits: [d], elims: [], bad: nr, soloDigit: d,
              miss: 'the near ends ' + cellName(nr) + ' and ' + cellName(nk) + ' are strangers — ' +
                    'different row, column and box — so nothing stops both of them being the ' + d +
                    ', and the far ends prove nothing'
            });
          }
        }));
      }
      return out;
    }

    function nearEmptyRect(g, cand) {
      const out = [];
      for (let d = 1; d <= 9; d++) {
        BOXES.forEach((box, bi) => {
          const sp = spots(g, cand, box, d);
          if (sp.length < 3 || sp.length > 5) return;
          const rs = [...new Set(sp.map(rowOf))], cs = [...new Set(sp.map(colOf))];
          if (rs.length < 2 || cs.length < 2) return;
          let fits = false;
          rs.forEach(r => cs.forEach(c => {
            if (sp.every(i => rowOf(i) === r || colOf(i) === c)) fits = true;
          }));
          if (fits) return;
          out.push({
            cells: sp, digits: [d], elims: [], bad: null, soloDigit: d,
            miss: 'box ' + (bi + 1) + '’s ' + d + 's do not fit one row and one column of it. ' +
                  'Without that there is no “the ' + d + ' is on this line or that one”, and ' +
                  'nothing to cross a link with'
          });
        });
      }
      return out;
    }

    function nearColouring(g, cand) {
      const out = [];
      for (let d = 1; d <= 9; d++) {
        const links = M.strongLinks(g, cand, d);
        if (links.length < 3) continue;
        const adj = new Map();
        links.forEach(L => {
          if (!adj.has(L.a)) adj.set(L.a, []);
          if (!adj.has(L.b)) adj.set(L.b, []);
          adj.get(L.a).push(L.b); adj.get(L.b).push(L.a);
        });
        const colour = new Map();
        [...adj.keys()].forEach(start => {
          if (colour.has(start)) return;
          const comp = [start]; colour.set(start, 0);
          let broken = false;
          for (let qi = 0; qi < comp.length; qi++) adj.get(comp[qi]).forEach(n => {
            if (colour.has(n)) { if (colour.get(n) === colour.get(comp[qi])) broken = true; return; }
            colour.set(n, 1 - colour.get(comp[qi])); comp.push(n);
          });
          if (broken || comp.length < 4 || comp.length > 8) return;
          const A = comp.filter(i => colour.get(i) === 0), B = comp.filter(i => colour.get(i) === 1);
          const clash = [A, B].some(same => same.some((x, xi) => same.slice(xi + 1).some(y => sees(x, y))));
          if (clash) return;
          for (let i = 0; i < 81; i++) {
            if (g[i] || !cand[i].has(d) || comp.indexOf(i) >= 0) continue;
            if (A.some(x => sees(i, x)) && B.some(x => sees(i, x))) return;   // it works
          }
          out.push({
            cells: comp, digits: [d], elims: [], bad: null, soloDigit: d,
            lines: links.filter(L => comp.indexOf(L.a) >= 0).map(L => [L.a, L.b, 'lead']),
            miss: 'the colouring is sound and it is worth nothing here: no two squares of one ' +
                  'colour share a unit, and no square outside the chain sees both colours. A ' +
                  'correct reading that kills nothing is still not a move'
          });
        });
      }
      return out;
    }

    function nearWWing(g, cand) {
      const out = [];
      const bi = [];
      for (let i = 0; i < 81; i++) if (!g[i] && cand[i].size === 2) bi.push(i);
      for (let x = 0; x < bi.length; x++) for (let y = x + 1; y < bi.length; y++) {
        const P = bi[x], Q = bi[y];
        if (sees(P, Q)) continue;
        const p = [...cand[P]].sort((a, b) => a - b), q = [...cand[Q]].sort((a, b) => a - b);
        if (p.join() !== q.join()) continue;
        let linked = false;
        p.forEach(B => M.strongLinks(g, cand, B).forEach(L => {
          [[L.a, L.b], [L.b, L.a]].forEach(([X, Y]) => {
            if (X === P || X === Q || Y === P || Y === Q) return;
            if (sees(X, P) && sees(Y, Q)) linked = true;
          });
        }));
        if (linked) continue;
        /* Only interesting if something WOULD die, or the figure is a picture
           of nothing happening for no visible reason. */
        let would = 0;
        for (let i = 0; i < 81; i++) {
          if (g[i] || i === P || i === Q) continue;
          if (sees(i, P) && sees(i, Q) && (cand[i].has(p[0]) || cand[i].has(p[1]))) would++;
        }
        if (!would) continue;
        out.push({
          cells: [P, Q], digits: p, elims: [], bad: null,
          miss: cellName(P) + ' and ' + cellName(Q) + ' do read the same two digits, and nothing ' +
                'joins them: there is no unit where one of ' + p.join(' or ') + ' has exactly two ' +
                'homes, one seeing each. Two matching pairs on their own force nothing at all'
        });
      }
      return out;
    }

    function nearXyChain(g, cand) {
      const out = [];
      const bi = [];
      for (let i = 0; i < 81; i++) if (!g[i] && cand[i].size === 2) bi.push(i);
      bi.forEach(start => {
        [...cand[start]].forEach(Z => {
          const other = [...cand[start]].find(x => x !== Z);
          const path = [start];
          (function walk(cur, need) {
            if (out.length > 400 || path.length > 5) return;
            if (path.length >= 4 && need !== Z && !sees(start, cur)) {
              const ends = [start, cur];
              let would = 0;
              for (let i = 0; i < 81; i++) {
                if (g[i] || path.indexOf(i) >= 0 || !cand[i].has(Z)) continue;
                if (sees(i, ends[0]) && sees(i, ends[1])) would++;
              }
              if (would) out.push({
                cells: path.slice(), digits: [Z], elims: [], bad: cur, chainEnds: ends,
                lines: path.slice(0, -1).map((c, k) => [c, path[k + 1], 'lead']),
                miss: 'the chain runs, and it comes back on the wrong digit: start it at ' +
                      cellName(start) + ' as the ' + Z + ' and the cascade leaves ' + cellName(cur) +
                      ' as the ' + need + ', not the ' + Z + '. Both ends have to be the same digit ' +
                      'or there is nothing either way'
              });
            }
            if (path.length >= 5) return;
            bi.forEach(nxt => {
              if (path.indexOf(nxt) >= 0 || !sees(cur, nxt) || !cand[nxt].has(need)) return;
              path.push(nxt);
              walk(nxt, [...cand[nxt]].find(x => x !== need));
              path.pop();
            });
          })(start, other);
        });
      });
      return out;
    }

    function nearAic(g, cand) {
      /* A chain that alternates properly and proves something worth nothing:
         the two ends carry different digits and are strangers, so neither can
         be knocked out by the other. */
      const out = [];
      const key = (c, d) => c * 10 + d;
      const strong = new Map();
      const add = (a, b) => { if (!strong.has(a)) strong.set(a, []); strong.get(a).push(b); };
      for (let d = 1; d <= 9; d++) M.strongLinks(g, cand, d).forEach(L => {
        add(key(L.a, d), { cell: L.b, digit: d, unit: L.unit });
        add(key(L.b, d), { cell: L.a, digit: d, unit: L.unit });
      });
      for (let i = 0; i < 81; i++) {
        if (g[i] || cand[i].size !== 2) continue;
        const [x, y] = [...cand[i]];
        add(key(i, x), { cell: i, digit: y, inCell: true });
        add(key(i, y), { cell: i, digit: x, inCell: true });
      }
      const nodes = [];
      for (let i = 0; i < 81; i++) if (!g[i]) cand[i].forEach(d => nodes.push({ cell: i, digit: d }));
      let budget = 20000;
      for (const start of nodes) {
        if (out.length >= 60 || budget <= 0) break;
        const path = [start];
        const used = new Set([key(start.cell, start.digit)]);
        (function walk(cur, depth, wantStrong) {
          if (out.length >= 60 || depth >= 3 || budget <= 0) return;
          const nexts = wantStrong ? (strong.get(key(cur.cell, cur.digit)) || [])
            : (() => {
              const r = [];
              PEERS[cur.cell].forEach(p => { if (!g[p] && cand[p].has(cur.digit)) r.push({ cell: p, digit: cur.digit }); });
              cand[cur.cell].forEach(e => { if (e !== cur.digit) r.push({ cell: cur.cell, digit: e }); });
              return r;
            })();
          for (const n of nexts) {
            const k = key(n.cell, n.digit);
            if (used.has(k)) continue;
            if (!wantStrong && !(strong.get(k) || []).length) continue;
            if (--budget <= 0) return;
            used.add(k); path.push(n);
            if (wantStrong && path.length === 4) {
              const A = path[0], B = n;
              if (A.digit !== B.digit && A.cell !== B.cell && !sees(A.cell, B.cell)) {
                out.push({
                  cells: [...new Set(path.map(p => p.cell))], digits: [...new Set(path.map(p => p.digit))],
                  elims: [], bad: null, chain: path.map(p => ({ cell: p.cell, digit: p.digit })),
                  lines: path.slice(0, -1).map((p, i2) => [p.cell, path[i2 + 1].cell, i2 % 2 ? 'cross' : 'lead'])
                    .filter(l => l[0] !== l[1]),
                  miss: 'the links do alternate, and the two ends are the ' + A.digit + ' in ' +
                        cellName(A.cell) + ' and the ' + B.digit + ' in ' + cellName(B.cell) +
                        ' — different digits, and strangers to each other. One of them is true and ' +
                        'neither can touch the other, so the chain is sound and pays nothing'
                });
              }
            }
            walk(n, depth + 1, !wantStrong);
            used.delete(k); path.pop();
          }
        })(start, 0, true);
      }
      return out;
    }

    const NEAR = {
      unique_rect: nearUniqueRect, finned: nearFinned, kite: nearKite,
      empty_rect: nearEmptyRect, colouring: nearColouring, w_wing: nearWWing,
      xy_chain: nearXyChain, aic: nearAic
    };
    /* BUG+1 has no near miss worth drawing and no figure worth drawing either:
       both are claims about all sixty-odd unsolved squares at once. It is
       taught on the lesson page and detected in the trainer, and the gallery
       says so rather than faking an exercise. */
    const IDS = ['unique_rect', 'bug', 'finned', 'kite', 'empty_rect', 'colouring',
                 'w_wing', 'xy_chain', 'aic'];

    /* ---- is the figure worth looking at, and can it be read at 24px? ---- */
    const SOLO = { finned: 1, kite: 1, empty_rect: 1, colouring: 1 };
    function usable(id, mv, g, cand) {
      if (SOLO[id]) {
        let n = 0;
        for (let i = 0; i < 81; i++) if (!g[i] && cand[i].has(mv.digits[0])) n++;
        return n >= 5 && n <= 20;
      }
      if (id === 'bug') return true;
      /* `e.cell || e[0]` would read r1c1 as a falsy zero. */
      const cells = mv.cells.concat((mv.elims || []).map(e => (e.cell === undefined ? e[0] : e.cell)));
      return cells.every(i => g[i] || cand[i].size <= 4) && mv.cells.length <= 8;
    }

    function verify(id, mv, sol, g, cand) {
      for (let i = 0; i < 81; i++) {
        if (!g[i] && !cand[i].has(sol[i])) return 'candidates lost the answer at ' + cellName(i);
        if (g[i] && g[i] !== sol[i]) return 'placed digit disagrees at ' + cellName(i);
      }
      if (mv.placement && sol[mv.placement.cell] !== mv.placement.digit)
        return id + ' places the wrong digit in ' + cellName(mv.placement.cell);
      for (const e of (mv.elims || [])) {
        if (sol[e.cell] === e.digit) return id + ' would kill the answer at ' + cellName(e.cell);
      }
      return null;
    }

    function snap(id, mv, g, cand, sol, ok) {
      return {
        id, ok,
        g: g.join(''),
        s: sol.join(''),
        c: Array.from({ length: 81 }, (_, i) => g[i] ? '' : [...cand[i]].sort().join('')),
        cells: (mv.cells || []).slice(),
        elims: (mv.elims || []).map(e => [e.cell, e.digit]),
        placement: mv.placement ? [mv.placement.cell, mv.placement.digit] : null,
        digits: (mv.digits || []).slice(),
        fins: (mv.fins || []).slice(),
        roof: (mv.roof || mv.chainEnds || []).slice(),
        pivot: mv.pivot === undefined ? null : mv.pivot,
        soloDigit: mv.soloDigit || (SOLO[id] ? mv.digits[0] : null),
        lines: (mv.lines || []).slice(),
        units: (mv.units || []).map(u => u.slice(0, 1).concat([u.length])),
        region: mv.region || '',
        why: mv.why || '',
        miss: mv.miss || '',
        bad: mv.bad === undefined ? null : mv.bad,
        kind: mv.kind || ''
      };
    }

    const yes = {}, no = {}, seen = {};
    IDS.forEach(id => { yes[id] = []; no[id] = []; seen[id] = new Set(); });
    const sig = (id, mv) => id + '|' + (mv.digits || []).join('') + '|' +
      (mv.cells || []).slice().sort((a, b) => a - b).join(',');

    let walked = 0, problems = [];
    outer:
    for (let pass = 0; pass < PASSES; pass++) {
      for (let bi = 0; bi < bank.length; bi++) {
        if (IDS.every(id => yes[id].length >= WANT_YES && (!NEAR[id] || no[id].length >= WANT_NO))) break outer;
        const [p0, sol] = transform(C.parse(bank[bi].p), C.parse(bank[bi].s), pass === 0);
        const g = p0.slice();
        let notes = C.baseCandidates(g);
        walked++;
        for (let step = 0; step < 300; step++) {
          const cand = T.effective(g, notes);
          const safe = C.solve(g, 2).length === 1;
          const found = [].concat(
            M.uniqueRect(g, cand, safe), M.bugPlusOne(g, cand, safe), M.finnedFish(g, cand),
            M.kite(g, cand), M.emptyRect(g, cand), M.colouring(g, cand), M.wWing(g, cand),
            M.xyChain(g, cand)
          );
          if (yes.aic.length < WANT_YES) found.push(...M.aic(g, cand, 2));
          found.forEach(mv => {
            const id = mv.id;
            if (!yes[id] || yes[id].length >= WANT_YES) return;
            if (seen[id].has(sig(id, mv)) || !usable(id, mv, g, cand)) return;
            const bad = verify(id, mv, sol, g, cand);
            if (bad) { problems.push(bad); return; }
            seen[id].add(sig(id, mv));
            yes[id].push(snap(id, mv, g, cand, sol, true));
          });
          IDS.forEach(id => {
            if (!NEAR[id] || no[id].length >= WANT_NO) return;
            const list = NEAR[id](g, cand);
            for (const mv of list) {
              const s = sig(id, mv) + '|no';
              if (seen[id].has(s) || !usable(id, mv, g, cand)) continue;
              /* A "no" figure must not contain a genuine one of its own kind in
                 the part of the board it shows. */
              if (SOLO[id]) {
                const real = { finned: M.finnedFish, kite: M.kite, empty_rect: M.emptyRect,
                               colouring: M.colouring }[id](g, cand);
                if (real.some(r => r.digits[0] === mv.digits[0])) continue;
              } else if (id === 'unique_rect') {
                /* Only the corners in the picture matter: a genuine rectangle
                   elsewhere on the board is not in the figure and cannot make
                   its answer wrong. */
                if (M.uniqueRect(g, cand, true).some(r => r.cells.some(x => mv.cells.indexOf(x) >= 0)))
                  continue;
              }
              const bad = verify(id, mv, sol, g, cand);
              if (bad) { problems.push(bad); continue; }
              seen[id].add(s);
              no[id].push(snap(id, mv, g, cand, sol, false));
              break;
            }
          });
          const adv = T.findAll(g, notes).findings;
          const all = adv.concat(found).sort((a, b) => a.rank - b.rank);
          if (!all.length) break;
          const f = all[0];
          if (f.placement) {
            g[f.placement.cell] = f.placement.digit;
            notes[f.placement.cell] = new Set();
            C.PEERS[f.placement.cell].forEach(x => notes[x].delete(f.placement.digit));
          } else f.elims.forEach(e => notes[e.cell].delete(e.digit));
          if (g.every(x => x)) break;
        }
      }
    }
    const counts = {};
    IDS.forEach(id => { counts[id] = [yes[id].length, no[id].length]; });
    return { yes, no, meta: { walked, counts, problems: problems.slice(0, 10) } };
  }

  if (typeof module !== 'undefined' && module.exports) {
    const fs = require('fs'), path = require('path');
    const dir = path.join(__dirname, '..');
    global.window = global;
    require(path.join(dir, 'assets/js/core.js'));
    require(path.join(dir, 'assets/js/techniques.js'));
    require(path.join(dir, 'assets/js/master.js'));
    const bank = JSON.parse(fs.readFileSync(path.join(dir, 'tools/bank.json'), 'utf8'));
    const data = harvest(global.SudokuCore, global.SudokuTech, global.SudokuMaster, bank);
    process.stderr.write(JSON.stringify(data.meta, null, 1) + '\n');
    process.stdout.write(JSON.stringify({ yes: data.yes, no: data.no }));
  } else {
    root.harvestMaster = harvest;
  }
})(typeof window !== 'undefined' ? window : globalThis);
