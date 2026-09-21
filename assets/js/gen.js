/* gen.js — a puzzle to order.

   The bank is thirty-two puzzles, and a drill you can run twice on the same
   board is a drill you memorise. This makes a fresh one: fill a grid, take
   givens away while the solution stays unique, walk what is left with the
   coach's own detectors, and keep it only if the walk needed what was asked
   for. Nothing is tagged by hand and nothing is trusted: a puzzle is dealt
   only after the detectors have solved it, so the coach can never run out of
   moves on one it made.

   "Needs" means what it means in the bank — the technique turned up in the
   walk, cheapest move first — and the walk is the one import.js runs, so a
   made puzzle and a typed one are described by the same rule. It is
   order-dependent in the same way: a puzzle that needed an XY-Wing here may
   have had a skyscraper route too, and finding that one is not wrong.

   The same file is the worker and the page's copy. As a worker it pulls in the
   engine with importScripts and answers messages; on the page it only defines
   SudokuGen, which the trainer uses when a worker cannot be made (file://) and
   which a console can drive for a check. A search is a few hundred attempts
   for the common patterns and a few thousand for a swordfish, and each attempt
   is tens of milliseconds — so it belongs off the main thread, where a phone
   does not freeze for the duration.

   Random on purpose, where the bank is seeded: a puzzle that only exists for
   the person it was dealt to needs no reproducing, and it rides in the URL
   like an import if they want it back. */
if (typeof importScripts === 'function') {
  importScripts('core.js', 'techniques.js', 'master.js', 'import.js');
}
(function (root) {
  'use strict';
  const C = root.SudokuCore, T = root.SudokuTech, M = root.SudokuMaster, I = root.SudokuImport;

  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  };

  /* A solved grid, by filling the squares in order with the digits that fit,
     in a random order each time. Backtracks a handful of times at most. */
  function fullGrid() {
    const g = new Array(81).fill(0);
    function rec(i) {
      if (i === 81) return true;
      const used = new Set();
      C.PEERS[i].forEach(p => { if (g[p]) used.add(g[p]); });
      const opts = [];
      for (let d = 1; d <= 9; d++) if (!used.has(d)) opts.push(d);
      shuffle(opts);
      for (const d of opts) {
        g[i] = d;
        if (rec(i + 1)) return true;
      }
      g[i] = 0;
      return false;
    }
    rec(0);
    return g;
  }

  /* Givens taken away one at a time, in a random order, each kept only if the
     grid still has one solution without it. What is left is minimal — no given
     can be removed — which is the same kind of puzzle bank.py makes, and the
     same kind the drills are cut from. */
  function makePuzzle() {
    const g = fullGrid();
    const order = shuffle([...Array(81).keys()]);
    for (const i of order) {
      const keep = g[i];
      g[i] = 0;
      if (C.solve(g, 2).length !== 1) g[i] = keep;
    }
    return g;
  }

  /* One attempt against a spec: { want: [ids], tier }. With patterns wanted,
     the puzzle must need every one of them; with none, it must land on the
     named difficulty. The master detectors join the walk only when a master
     pattern is wanted, so a request for an X-Wing gets a puzzle the nine can
     finish, and a request for a kite gets one they cannot. */
  function attempt(spec) {
    const want = spec.want || [];
    const master = M && want.some(id => M.IDS.includes(id)) ? M : null;
    const grid = makePuzzle();
    const w = I.walk(grid, null, 0, master);
    if (w.filled !== 81) return null;
    const p = grid.join('');
    const puzzle = I.describe(p, C.solve(grid, 1)[0].join(''), w, master);
    if (want.length) {
      if (!want.every(id => puzzle.t.includes(id))) return null;
    } else if (I.tierOf(puzzle) !== spec.tier) return null;
    puzzle.generated = Date.now();
    return puzzle;
  }

  /* Attempts until one fits or the cap is reached. `tick` hears the count
     every `every` attempts, which is what the status line runs on. */
  function search(spec, tick) {
    const cap = spec.cap || 4000, every = spec.every || 25;
    for (let n = 1; n <= cap; n++) {
      const puzzle = attempt(spec);
      if (puzzle) return { puzzle, tries: n };
      if (tick && n % every === 0) tick(n);
    }
    return { puzzle: null, tries: cap };
  }

  root.SudokuGen = { fullGrid, makePuzzle, attempt, search };

  /* The worker end. One message in, progress out while it looks, and either
     the puzzle or the news that the cap was hit. The trainer stops a search by
     terminating the worker, so there is no message for that. */
  if (typeof importScripts === 'function') {
    self.onmessage = e => {
      const spec = e.data || {};
      const t0 = Date.now();
      const r = search(spec, n => self.postMessage({ type: 'progress', tries: n }));
      self.postMessage(r.puzzle
        ? { type: 'done', puzzle: r.puzzle, tries: r.tries, ms: Date.now() - t0 }
        : { type: 'fail', tries: r.tries, ms: Date.now() - t0 });
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
