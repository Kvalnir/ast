/* trainer.js — a News+-shaped board that names the techniques in your position. */
(function () {
  'use strict';
  const C = window.SudokuCore, T = window.SudokuTech, BANK = window.SUDOKU_BANK;
  const $ = id => document.getElementById(id);
  const boardEl = $('board'), geoEl = $('geo');

  /* ---------------- state ---------------- */
  const S = {
    puzzle: null, given: [], grid: [], sol: [],
    notes: [], wrong: [], sel: null, mode: 'pen', focus: null,
    history: [], findings: [], pick: null, level: 0,
    autocheck: true, autoRemove: true, peers: true, coach: 'names',
    solved: false, noteCheck: null
  };

  const NAMES = {
    naked_single: 'Naked single', hidden_single: 'Hidden single',
    pointing: 'Pointing pair', claiming: 'Claiming',
    naked_pair: 'Naked pair', hidden_pair: 'Hidden pair', naked_triple: 'Naked triple',
    hidden_triple: 'Hidden triple', xwing: 'X-Wing', skyscraper: 'Skyscraper',
    swordfish: 'Swordfish', xy_wing: 'XY-Wing'
  };
  const ADVANCED = ['xwing', 'skyscraper', 'swordfish', 'xy_wing'];

  /* What each technique *is*, independent of the position on the board. The
     coach's `why` explains this instance; this explains the idea. Kept to one
     or two sentences on purpose — it is a reminder for someone mid-puzzle, not
     the lesson. The full write-up is a click away on index.html. */
  const EXPLAIN = {
    naked_single: 'A square with only one candidate left. Nothing else fits, so it is that digit.',
    hidden_single: 'A digit with only one square left in its row, column or box — even though that square still shows other candidates of its own.',
    pointing: 'Every remaining copy of a digit inside one box sits on a single line. That line has to supply the box, so the digit leaves the rest of the line outside it.',
    claiming: 'Every remaining copy of a digit on one line sits inside a single box. The box has to supply the line, so the digit leaves the rest of the box.',
    naked_pair: 'Two squares in a unit holding the same two candidates. Between them they use both digits up, so those digits leave every other square in the unit.',
    naked_triple: 'Three squares in a unit sharing the same three candidates between them. Those digits are spoken for, so they leave the rest of the unit.',
    hidden_pair: 'Two digits in a unit that can only go in the same two squares. Those squares belong to the pair, so every other candidate inside them dies.',
    hidden_triple: 'Three digits confined to the same three squares in a unit. Those squares are theirs, so their other candidates die.',
    xwing: 'One digit forming a rectangle: two rows where it fits in only the same two columns. It must take a diagonal pair of corners, so it leaves those columns everywhere else.',
    skyscraper: 'Two lines where a digit has just two spots and which share one end column. The two far ends cover each other, so any square seeing both loses the digit.',
    swordfish: 'The X-Wing idea stretched to three rows and three columns instead of two.',
    xy_wing: 'A hinge square of X/Y seeing one wing of X/Z and another of Y/Z. Whichever way the hinge falls, Z lands in a wing, so any square seeing both wings loses Z.'
  };
  const LESSON = {
    pointing: 'pointing', claiming: 'claiming', naked_pair: 'naked-pair',
    naked_triple: 'naked-triple', hidden_pair: 'hidden-pair', xwing: 'x-wing',
    swordfish: 'swordfish', skyscraper: 'skyscraper', xy_wing: 'xy-wing'
  };

  /* ---------------- build DOM once ---------------- */
  const cells = [];
  for (let i = 0; i < 81; i++) {
    const d = document.createElement('div');
    d.className = 'sq';
    if (C.colOf(i) % 3 === 0 && C.colOf(i)) d.classList.add('bl');
    if (C.rowOf(i) % 3 === 0 && C.rowOf(i)) d.classList.add('bt');
    d.tabIndex = -1;
    d.setAttribute('role', 'gridcell');
    d.dataset.i = i;
    const val = document.createElement('span'); val.className = 'val';
    const nts = document.createElement('div'); nts.className = 'notes';
    for (let n = 1; n <= 9; n++) {
      const s = document.createElement('span'); s.className = 'nt'; s.textContent = n;
      nts.appendChild(s);
    }
    d.appendChild(val); d.appendChild(nts);
    boardEl.appendChild(d);
    cells.push({ el: d, val, notes: [...nts.children] });
  }
  boardEl.addEventListener('click', e => {
    const sq = e.target.closest('.sq'); if (!sq) return;
    select(+sq.dataset.i);
  });

  const padEl = $('pad');
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement('button');
    b.className = 'key'; b.type = 'button';
    b.innerHTML = d + '<span class="left" data-left="' + d + '"></span>';
    b.addEventListener('click', () => press(d));
    padEl.appendChild(b);
  }

  /* The one rule the whole pad runs on: with a square selected a digit goes
     into it, with nothing selected it lights that digit across the board. Two
     jobs, one pad, and the selection is what says which — so deselecting a
     square is also how you reach the focus. */
  function press(d) {
    if (S.sel === null) { S.focus = S.focus === d ? null : d; render(); }
    else enter(d);
  }

  /* ---------------- history ---------------- */
  function snapshot() {
    S.history.push({
      grid: S.grid.slice(), wrong: S.wrong.slice(),
      notes: S.notes.map(s => [...s])
    });
    if (S.history.length > 200) S.history.shift();
  }
  function undo() {
    const h = S.history.pop(); if (!h) return;
    S.grid = h.grid; S.wrong = h.wrong;
    S.notes = h.notes.map(a => new Set(a));
    S.solved = false; S.noteCheck = null;
    recompute();
  }

  /* ---------------- moves ---------------- */
  /* Clicking the selected square again drops the selection. The focus goes with
     it only when this square is what lit it — a focus you set deliberately on
     the focus pad outlives the square you happened to be sitting on. */
  function select(i) {
    if (S.sel === i) {
      if (S.focus && S.focus === S.grid[i]) S.focus = null;
      S.sel = null;
    } else {
      S.sel = i;
      if (S.grid[i]) S.focus = S.grid[i];
    }
    render();
  }

  function deselect() {
    if (S.sel === null) return;
    if (S.focus && S.focus === S.grid[S.sel]) S.focus = null;
    S.sel = null;
    render();
  }

  function enter(d) {
    if (S.sel === null || S.given[S.sel] || S.solved) return;
    const i = S.sel;
    snapshot();
    if (S.mode === 'notes') {
      if (S.grid[i]) { S.history.pop(); return; }
      if (S.notes[i].has(d)) S.notes[i].delete(d); else S.notes[i].add(d);
    } else {
      if (S.grid[i] === d) { S.grid[i] = 0; S.wrong[i] = false; }
      else {
        S.grid[i] = d;
        S.notes[i] = new Set();
        S.wrong[i] = S.autocheck && S.sol[i] !== d;
        /* News clears notes on entry, before judging whether the entry was right. */
        if (S.autoRemove) C.PEERS[i].forEach(p => S.notes[p].delete(d));
      }
      S.focus = S.grid[i] || null;
    }
    S.noteCheck = null;
    recompute();
  }

  function erase() {
    if (S.sel === null || S.given[S.sel] || S.solved) return;
    snapshot();
    S.grid[S.sel] = 0; S.wrong[S.sel] = false; S.notes[S.sel] = new Set();
    S.noteCheck = null;
    recompute();
  }

  function autofill() {
    snapshot();
    const base = C.baseCandidates(S.grid);
    for (let i = 0; i < 81; i++) S.notes[i] = S.grid[i] ? new Set() : base[i];
    S.noteCheck = null;
    recompute();
    flash('Notes filled from the digits on the board. Anything you eliminated by logic is gone — that is what a second Autofill costs you in News+ too.');
  }

  /* ---------------- coach ---------------- */
  function recompute() {
    const anyNotes = S.notes.some(s => s.size);
    const res = T.findAll(S.grid, anyNotes ? S.notes : null);
    S.findings = res.findings;
    S.cand = res.candidates;
    if (S.pick) {
      const still = S.findings.find(f => f.id === S.pick.id &&
        f.cells.join() === S.pick.cells.join() && f.digits.join() === S.pick.digits.join());
      if (still) S.pick = still; else { S.pick = null; S.level = 0; }
    }
    S.solved = S.grid.every(v => v) && S.grid.every((v, i) => v === S.sol[i]);
    render();
  }

  function groups() {
    const m = new Map();
    S.findings.forEach(f => {
      if (!m.has(f.id)) m.set(f.id, []);
      m.get(f.id).push(f);
    });
    return m;
  }

  /* The move you should actually play is the cheapest one. Advanced patterns that
     also happen to be present are surfaced separately, not recommended. */
  function chooseDefault() { return S.findings[0] || null; }
  function article(name) { return /^[AEIOUX]/.test(name) ? 'an ' : 'a '; }

  /* One chip, plus the hover/focus definition that goes with it. Shared by the
     coach row and the drill row so the two cannot drift apart.

     The definition is aria-describedby rather than markup inside the button:
     text inside the button joins its accessible name, which would make every
     chip announce as a full paragraph before you could tell what it was. */
  let tipSeq = 0;
  function makeChip(id, opts) {
    opts = opts || {};
    const wrap = document.createElement('span');
    wrap.className = 'chipwrap';
    const b = document.createElement('button');
    b.className = 'chip' + (ADVANCED.includes(id) ? ' adv' : '');
    b.type = 'button';
    b.innerHTML = NAMES[id] + (opts.count ? '<span class="n">' + opts.count + '</span>' : '');
    if (opts.pressed !== undefined) b.setAttribute('aria-pressed', !!opts.pressed);
    if (opts.onClick) b.addEventListener('click', opts.onClick);
    wrap.appendChild(b);
    if (EXPLAIN[id]) {
      const tip = document.createElement('span');
      tip.className = 'tip';
      tip.id = 'tip' + (++tipSeq);
      tip.setAttribute('role', 'tooltip');
      tip.innerHTML = '<b>' + NAMES[id] + '</b> — ' + EXPLAIN[id];
      b.setAttribute('aria-describedby', tip.id);
      wrap.appendChild(tip);
    }
    return wrap;
  }

  /* The same text as the tooltip, inlined into the hint ladder. Hover is not
     available on a touch screen and is not discoverable anywhere, so the
     explanation has to exist in the prose too. */
  function defLine(id) {
    return EXPLAIN[id] ? '<span class="def">' + EXPLAIN[id] + '</span>' : '';
  }

  function more() {
    if (!S.findings.length) return;
    if (!S.pick) { S.pick = chooseDefault(); S.level = 1; }
    else S.level = Math.min(5, S.level + 1);
    if (S.pick && S.level >= 3 && S.pick.soloDigit) S.focus = S.pick.soloDigit;
    render();
  }

  function applyPick() {
    const f = S.pick; if (!f) return;
    snapshot();
    if (f.placement) {
      const { cell, digit } = f.placement;
      S.grid[cell] = digit; S.notes[cell] = new Set(); S.wrong[cell] = false;
      if (S.autoRemove) C.PEERS[cell].forEach(p => S.notes[p].delete(digit));
    } else {
      if (!S.notes.some(s => s.size)) {
        const base = C.baseCandidates(S.grid);
        for (let i = 0; i < 81; i++) S.notes[i] = S.grid[i] ? new Set() : base[i];
      }
      f.elims.forEach(e => S.notes[e.cell].delete(e.digit));
    }
    S.pick = null; S.level = 0; S.noteCheck = null;
    recompute();
  }

  function checkNotes() {
    if (!S.notes.some(s => s.size)) { flash('No notes to check yet — press Autofill first.', 'warn'); return; }
    const missing = [];
    for (let i = 0; i < 81; i++) {
      if (S.grid[i] || !S.notes[i].size) continue;
      if (!S.notes[i].has(S.sol[i])) missing.push(i);
    }
    S.noteCheck = missing;
    render();
    if (!missing.length) flash('Every note still contains its true digit. Nothing you eliminated was wrong.', 'good');
    else flash(missing.length + ' square' + (missing.length > 1 ? 's have' : ' has') +
      ' lost its true digit — marked in red. This is the one error News+ cannot catch for you.', 'warn');
  }

  function flash(msg, kind) {
    const n = $('cNote');
    n.textContent = msg;
    n.className = 'note' + (kind ? ' ' + kind : '');
  }

  /* ---------------- drills ---------------- */
  /* Fast-forward a real puzzle to a position where `id` is the move to find.
     Pass 1 wants it to be the cheapest thing available. Pass 2 settles for a
     position with no singles left, which is still a fair hunt. */
  /* The bank is tagged with the generator's names; map them to the detector ids. */
  const BANK_TAG = {
    naked_pair: 'naked_2', hidden_pair: 'hidden_2',
    naked_triple: 'naked_3', hidden_triple: 'hidden_3'
  };
  function buildDrill(id) {
    const relaxed = [];
    const tag = BANK_TAG[id] || id;
    /* tagged puzzles first, but never filter them out entirely — a technique can
       show up in a puzzle that doesn't strictly require it */
    const order = BANK.filter(p => p.t.includes(tag)).concat(BANK.filter(p => !p.t.includes(tag)));
    for (const p of order) {
      const grid = C.parse(p.p), sol = C.parse(p.s);
      let notes = C.baseCandidates(grid);
      for (let step = 0; step < 400; step++) {
        const { findings } = T.findAll(grid, notes);
        if (!findings.length) break;
        const target = findings.find(f => f.id === id);
        if (target) {
          const cheaper = findings.filter(f => f.rank < target.rank);
          const others = [...new Set(findings.filter(f => f.id !== id).map(f => f.id))];
          const snap = {
            puzzle: p, grid: grid.slice(), sol,
            notes: notes.map(s => new Set(s)), others
          };
          if (!cheaper.length) return snap;
          if (!cheaper.some(f => f.placement) && relaxed.length < 1) relaxed.push(snap);
        }
        const f = findings[0];
        if (f.placement) {
          grid[f.placement.cell] = f.placement.digit;
          notes[f.placement.cell] = new Set();
          C.PEERS[f.placement.cell].forEach(x => notes[x].delete(f.placement.digit));
        } else f.elims.forEach(e => notes[e.cell].delete(e.digit));
      }
    }
    return relaxed[0] || null;
  }

  function startDrill(id) {
    const d = buildDrill(id);
    if (!d) { flash('No position with ' + article(NAMES[id]) + NAMES[id] + ' in the current bank.', 'warn'); return; }
    S.puzzle = d.puzzle;
    S.given = C.parse(d.puzzle.p).map(v => v > 0);
    S.grid = d.grid.slice();
    S.sol = d.sol.slice();
    S.notes = d.notes.map(s => new Set(s));
    S.wrong = new Array(81).fill(false);
    S.history = []; S.sel = null; S.focus = null; S.pick = null; S.level = 0;
    S.solved = false; S.noteCheck = null;
    recompute();
    const also = (d.others || []).filter(x => x !== id);
    flash('No singles left on this board. ' + article(NAMES[id]).replace(/^./, c => c.toUpperCase()) +
      NAMES[id] + ' is there to be found' +
      (also.length ? ', alongside ' + also.map(x => NAMES[x]).join(', ') : '') +
      '. Hunt it before you press for hints.');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- puzzles ---------------- */
  function load(p) {
    S.puzzle = p;
    const g = C.parse(p.p);
    S.given = g.map(v => v > 0);
    S.grid = g.slice();
    S.sol = C.parse(p.s);
    S.notes = []; for (let i = 0; i < 81; i++) S.notes.push(new Set());
    S.wrong = new Array(81).fill(false);
    S.history = []; S.sel = null; S.focus = null; S.pick = null; S.level = 0;
    S.solved = false; S.noteCheck = null;
    recompute();
    flash('');
  }
  function newPuzzle() {
    const pool = BANK.filter(p => p.level === 'advanced');
    let p, guard = 0;
    do { p = pool[Math.floor(Math.random() * pool.length)]; guard++; }
    while (S.puzzle && p.p === S.puzzle.p && guard < 20);
    load(p);
  }

  /* ---------------- render ---------------- */
  function render() {
    const f = S.pick, lvl = S.level;
    const showUnits = f && lvl >= 2, showCells = f && lvl >= 3, showElims = f && lvl >= 4;

    const unitSet = new Set(), patSet = new Set(), tgtSet = new Set();
    if (showUnits && f.units) f.units.forEach(u => u.forEach(i => unitSet.add(i)));
    if (showCells) f.cells.forEach(i => patSet.add(i));
    const elimMap = new Map();
    if (showElims) f.elims.forEach(e => {
      tgtSet.add(e.cell);
      if (!elimMap.has(e.cell)) elimMap.set(e.cell, new Set());
      elimMap.get(e.cell).add(e.digit);
    });

    const peerSet = new Set();
    if (S.peers && S.sel !== null) C.PEERS[S.sel].forEach(i => peerSet.add(i));
    const noteBad = new Set(S.noteCheck || []);

    boardEl.classList.toggle('solo', !!(S.focus && f && lvl >= 3 && f.soloDigit === S.focus));

    for (let i = 0; i < 81; i++) {
      const c = cells[i], el = c.el, v = S.grid[i];
      el.className = 'sq' +
        (C.colOf(i) % 3 === 0 && C.colOf(i) ? ' bl' : '') +
        (C.rowOf(i) % 3 === 0 && C.rowOf(i) ? ' bt' : '') +
        (S.given[i] ? ' given' : (v ? ' user' : '')) +
        (peerSet.has(i) ? ' peer' : '') +
        (unitSet.has(i) ? ' unit' : '') +
        (patSet.has(i) ? ' pat' : '') +
        (tgtSet.has(i) ? ' tgt' : '') +
        (f && showCells && f.pivot === i ? ' pivot' : '') +
        (S.wrong[i] ? ' bad' : '') +
        (S.focus && v === S.focus ? ' hit' : '') +
        (S.sel === i ? ' sel' : '');

      c.val.textContent = v || '';
      c.val.style.display = v ? '' : 'none';
      const showNotes = !v;
      c.notes.forEach((sp, k) => {
        const d = k + 1;
        const on = showNotes && S.notes[i].has(d);
        const flagged = showNotes && noteBad.has(i) && d === S.sol[i];
        sp.className = 'nt' + (on || flagged ? ' on' : '') +
          (on && S.focus === d ? ' lit solo' : '') +
          (on && showCells && patSet.has(i) && f.digits.includes(d) ? ' patd' : '') +
          (on && elimMap.has(i) && elimMap.get(i).has(d) ? ' dead' : '') +
          (flagged ? ' miss' : '');
      });
    }

    /* geometry overlay */
    geoEl.innerHTML = '';
    if (showCells && f.lines) {
      f.lines.forEach(([a, b, style]) => {
        const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        l.setAttribute('x1', C.colOf(a) + 0.5); l.setAttribute('y1', C.rowOf(a) + 0.5);
        l.setAttribute('x2', C.colOf(b) + 0.5); l.setAttribute('y2', C.rowOf(b) + 0.5);
        if (style === 'cross') l.setAttribute('class', 'cross');
        geoEl.appendChild(l);
      });
    }

    /* keypad. In Notes mode the pad doubles as a readout of the selected
       square's pencil marks, so a digit key shows whether pressing it will add
       or remove a note. Only for an empty square: a filled one has no notes to
       report, and lighting keys there would be a lie.

       `focused` is painted only while the pad is in focus mode. The focus digit
       survives selecting a square — the board keeps it lit — but the pad shows
       what the next tap will do, and while a square is selected the next tap is
       an entry, not a focus. */
    const focusing = S.sel === null;
    const notesMode = S.mode === 'notes';
    const selNotes = (notesMode && !focusing && !S.grid[S.sel]) ? S.notes[S.sel] : null;
    padEl.classList.toggle('notesmode', notesMode && !focusing);
    padEl.classList.toggle('focusmode', focusing);
    [...padEl.children].forEach((b, k) => {
      const d = k + 1;
      const placed = S.grid.filter(v => v === d).length;
      b.classList.toggle('done', placed >= 9);
      b.classList.toggle('noted', !!(selNotes && selNotes.has(d)));
      b.classList.toggle('focused', focusing && S.focus === d);
      b.querySelector('.left').textContent = placed >= 9 ? '' : (9 - placed);
    });
    /* Kept short enough to hold one line down to the 320px board floor. The
       height of this line is part of the constant .tplay sizes the board
       against, so a second line here silently costs the board 17px. */
    $('padHint').textContent = focusing
      ? 'Nothing selected — tap to light a digit'
      : (notesMode ? 'Tap a number to add or remove a note'
                   : 'Tap a number to place it');

    $('bPen').setAttribute('aria-pressed', S.mode === 'pen');
    $('bNotes').setAttribute('aria-pressed', S.mode === 'notes');
    $('bUndo').disabled = !S.history.length;
    $('bApply').disabled = !S.pick;

    /* meta */
    if (S.puzzle) {
      $('mLevel').textContent = S.puzzle.level === 'advanced' ? 'Challenging' : 'Moderate';
      $('mGivens').textContent = S.puzzle.givens + ' givens';
      $('mNeeds').textContent = S.puzzle.adv.length
        ? 'needs ' + S.puzzle.adv.map(x => NAMES[x]).join(' + ')
        : 'subsets only';
    }
    renderCoach();
  }

  function renderCoach() {
    const g = groups(), chipsEl = $('chips'), lad = $('ladder');
    const total = S.findings.length;
    $('cCount').textContent = S.coach === 'off' ? 'hidden'
      : total ? total + ' move' + (total === 1 ? '' : 's') + ' available' : 'nothing available';

    chipsEl.innerHTML = '';
    if (S.coach !== 'off') {
      [...g.entries()].sort((a, b) => a[1][0].rank - b[1][0].rank).forEach(([id, arr]) => {
        chipsEl.appendChild(makeChip(id, {
          count: S.coach === 'full' ? arr.length : 0,
          pressed: !!(S.pick && S.pick.id === id),
          onClick: () => {
            S.pick = arr[0]; S.level = Math.max(1, S.level);
            if (S.level >= 3 && S.pick.soloDigit) S.focus = S.pick.soloDigit;
            render();
          }
        }));
      });
    }

    if (S.solved) {
      lad.innerHTML = '<span class="step">Solved</span>Every square correct. Try a drill for the technique you leaned on most.';
      return;
    }
    if (!total) {
      lad.innerHTML = '<span class="step">Nothing found</span>' +
        (S.notes.some(s => s.size)
          ? 'No technique fires on your current notes. Either an elimination was wrong — press <b>Check my notes</b> — or a placed digit is wrong.'
          : 'Press <b>Autofill</b> to get notes in, and the coach can start reading your position.');
      return;
    }
    const f = S.pick;
    if (!f || S.level === 0) {
      const hardest = chooseDefault();
      const adv = [...new Set(S.findings.filter(x => ADVANCED.includes(x.id) && x.id !== hardest.id)
                                        .map(x => x.id))];
      lad.innerHTML = '<span class="step">Level 0 — what exists</span>' +
        (S.coach === 'off'
          ? 'Coach is off. Turn it on below, or press <b>Show me more</b> for one nudge.'
          : 'Cheapest move on the board: ' + article(NAMES[hardest.id]) + '<em>' + NAMES[hardest.id] + '</em>.' +
            (adv.length
              ? ' Also present, if you want the harder hunt: <em>' + adv.map(x => NAMES[x]).join('</em>, <em>') + '</em>.'
              : '') +
            ' Find it yourself first, then press <b>Show me more</b>.' +
            defLine(hardest.id));
      return;
    }
    const steps = [
      () => '<span class="step">Level 1 — which technique</span>There is ' + article(NAMES[f.id]) + '<em>' + NAMES[f.id] +
            '</em> on the board' + (f.digits.length === 1 ? ' on the digit <b>' + f.digits[0] + '</b>' : '') +
            '. Nothing about where yet.' + defLine(f.id),
      () => '<span class="step">Level 2 — where to look</span>Look at <b>' + f.region +
            '</b>. The relevant unit' + ((f.units && f.units.length > 1) ? 's are' : ' is') + ' tinted on the board.',
      () => '<span class="step">Level 3 — the pattern</span>The squares doing the work are <b>' +
            f.cells.map(C.cellName).join(', ') + '</b>' +
            (f.pivot !== undefined ? ', hinged on <b>' + C.cellName(f.pivot) + '</b>' : '') +
            '. They are amber, with the connecting geometry drawn over them.',
      () => '<span class="step">Level 4 — what it kills</span>' +
            (f.placement
              ? '<b>' + C.cellName(f.placement.cell) + '</b> must be <b>' + f.placement.digit + '</b>.'
              : f.elims.length + (f.elims.length === 1 ? ' candidate dies: <b>' : ' candidates die: <b>') +
                f.elims.map(e => e.digit + ' from ' + C.cellName(e.cell)).join(', ') + '</b>.'),
      () => '<span class="step">Level 5 — why</span>' + f.why +
            (LESSON[f.id] ? ' <a href="index.html#' + LESSON[f.id] + '" style="color:var(--amber)">Read the full technique &rarr;</a>' : '')
    ];
    lad.innerHTML = steps[Math.min(S.level, 5) - 1]();
  }

  /* ---------------- wiring ---------------- */
  $('bUndo').addEventListener('click', undo);
  $('bPen').addEventListener('click', () => { S.mode = 'pen'; render(); });
  $('bNotes').addEventListener('click', () => { S.mode = 'notes'; render(); });
  $('bErase').addEventListener('click', erase);
  $('bAutofill').addEventListener('click', autofill);
  $('bMore').addEventListener('click', more);
  $('bApply').addEventListener('click', applyPick);
  $('bClearHint').addEventListener('click', () => { S.pick = null; S.level = 0; flash(''); render(); });
  $('bNew').addEventListener('click', newPuzzle);
  $('bRestart').addEventListener('click', () => load(S.puzzle));
  $('bCheckNotes').addEventListener('click', checkNotes);
  $('sAutocheck').addEventListener('change', e => { S.autocheck = e.target.checked; });
  $('sAutoRemove').addEventListener('change', e => { S.autoRemove = e.target.checked; });
  $('sHighlightPeers').addEventListener('change', e => { S.peers = e.target.checked; render(); });
  $('sCoach').addEventListener('change', e => { S.coach = e.target.value; render(); });

  const drillEl = $('drills');
  ['pointing', 'claiming', 'naked_pair', 'hidden_pair', 'naked_triple', 'xwing', 'skyscraper', 'swordfish', 'xy_wing']
    .forEach(id => drillEl.appendChild(makeChip(id, { onClick: () => startDrill(id) })));

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'z') { e.preventDefault(); undo(); }
      return;
    }
    if (e.key >= '1' && e.key <= '9') { press(+e.key); e.preventDefault(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { erase(); e.preventDefault(); return; }
    if (e.key === 'n' || e.key === 'N') { S.mode = S.mode === 'pen' ? 'notes' : 'pen'; render(); return; }
    if (e.key === 'h' || e.key === 'H') { more(); return; }
    if (e.key === 'Escape') { deselect(); return; }
    if (S.sel === null) return;
    const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (moves[e.key] !== undefined) {
      const n = S.sel + moves[e.key];
      if (n >= 0 && n < 81) select(n);
      e.preventDefault();
    }
  });

  newPuzzle();
})();
