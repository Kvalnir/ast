/* trainer.js — a News+-shaped board that names the techniques in your position. */
(function () {
  'use strict';
  const C = window.SudokuCore, T = window.SudokuTech, BANK = window.SUDOKU_BANK,
        I = window.SudokuImport, V = window.SudokuVision;
  const $ = id => document.getElementById(id);
  /* A caret that takes text: the paste box, or a text field. Checkboxes and
     the coach's selects keep focus after a click, so they stay out of it —
     the pad must still answer while one of them is the focused element. */
  const isTyping = el => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' ||
        (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range)$/i.test(el.type)));
  const boardEl = $('board'), geoEl = $('geo');

  /* ---------------- state ---------------- */
  const S = {
    puzzle: null, given: [], grid: [], sol: [],
    notes: [], wrong: [], sel: null, mode: 'pen', focus: null,
    history: [], findings: [], pick: null, level: 0,
    autocheck: true, autoRemove: true, peers: true, coach: 'names',
    solved: false, noteCheck: null,
    /* import: `capture` hands the board over to transcription, `mark` is the
       set of squares the validator wants looked at again, `before` is the
       puzzle capture interrupted so Cancel can put it back. */
    capture: false, mark: [], before: null,
    /* What a screenshot read that the capture board cannot hold: your own
       entries, and your pencil marks. Capture is about the PRINTED digits, so
       these wait until the puzzle has been accepted and then go back on. */
    pending: null
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
      /* `given` never moves during play, but it is what capture mode is
         editing, so undo has to carry it. */
      given: S.given.slice(),
      notes: S.notes.map(s => [...s])
    });
    if (S.history.length > 200) S.history.shift();
  }
  function undo() {
    const h = S.history.pop(); if (!h) return;
    S.grid = h.grid; S.wrong = h.wrong; S.given = h.given;
    S.notes = h.notes.map(a => new Set(a));
    S.solved = false; S.noteCheck = null;
    if (S.capture) { captureRefresh(); return; }
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
    if (S.capture) { captureEnter(d); return; }
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
        /* The square is done, so the selection lets go of it. That also hands
           the pad back to focus mode on the digit just placed, which is the
           thing you want to look at next. Only on a placement: clearing a
           square above leaves you on it to type the replacement. */
        S.sel = null;
      }
      S.focus = S.grid[i] || null;
    }
    S.noteCheck = null;
    recompute();
  }

  function erase() {
    if (S.sel === null || S.solved) return;
    if (S.capture) {
      snapshot();
      S.grid[S.sel] = 0; S.given[S.sel] = false;
      captureRefresh();
      return;
    }
    if (S.given[S.sel]) return;
    snapshot();
    S.grid[S.sel] = 0; S.wrong[S.sel] = false; S.notes[S.sel] = new Set();
    S.noteCheck = null;
    recompute();
  }

  function autofill() {
    if (S.capture) return;
    snapshot();
    const base = C.baseCandidates(S.grid);
    for (let i = 0; i < 81; i++) S.notes[i] = S.grid[i] ? new Set() : base[i];
    S.noteCheck = null;
    recompute();
    flash('Notes filled from the digits on the board. Anything you eliminated by logic is gone — that is what a second Autofill costs you in News+ too.');
  }

  /* ---------------- coach ---------------- */
  function recompute() {
    if (S.capture) { captureRefresh(); return; }
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
    importPanel('start');
    I.clearHash();
    const d = buildDrill(id);
    if (!d) { flash('No position with ' + article(NAMES[id]) + NAMES[id] + ' in the current bank.', 'warn'); return; }
    S.puzzle = d.puzzle;
    S.given = C.parse(d.puzzle.p).map(v => v > 0);
    S.grid = d.grid.slice();
    S.sol = d.sol.slice();
    S.notes = d.notes.map(s => new Set(s));
    S.wrong = new Array(81).fill(false);
    S.history = []; S.sel = null; S.focus = null; S.pick = null; S.level = 0;
    S.solved = false; S.noteCheck = null; S.mark = [];
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
    S.solved = false; S.noteCheck = null; S.mark = [];
    recompute();
    flash('');
  }
  function newPuzzle() {
    importPanel('start');
    I.clearHash();
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
    /* The validator's marks ride the same red tint an elimination target wears.
       They have to be a background rather than the struck-through digit .bad
       gives you: half of what a failed import wants to point at is an EMPTY
       square — the given you skipped — and a slash through nothing is nothing. */
    S.mark.forEach(i => tgtSet.add(i));

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
    $('padHint').textContent = S.capture
      ? (focusing ? 'Importing — tap a square, or a number to light it'
                  : 'Tap the number printed in this square')
      : focusing
        ? 'Nothing selected — tap to light a digit'
        : (notesMode ? 'Tap a number to add or remove a note'
                     : 'Tap a number to place it');

    $('bPen').setAttribute('aria-pressed', S.mode === 'pen');
    $('bNotes').setAttribute('aria-pressed', S.mode === 'notes');
    $('bUndo').disabled = !S.history.length;
    $('bApply').disabled = !S.pick;
    /* Capture mode borrows the board, so everything that acts on a position
       rather than builds one steps out of the way for the duration. Undo,
       Erase and the pad stay: those are the transcription controls. */
    ['bAutofill', 'bNotes', 'bMore', 'bCheckNotes', 'bNew', 'bRestart',
     'bCatchUp', 'bCopyLink'].forEach(id => { $(id).disabled = S.capture; });
    [...$('drills').querySelectorAll('.chip')].forEach(b => { b.disabled = S.capture; });

    /* meta */
    if (S.capture) {
      $('mLevel').textContent = 'Importing';
      $('mGivens').textContent = S.grid.filter(v => v).length + ' entered';
      $('mNeeds').textContent = 'not checked yet';
    } else if (S.puzzle) {
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
    if (S.capture) {
      $('cCount').textContent = S.grid.filter(v => v).length + ' of 81';
      chipsEl.innerHTML = '';
      lad.innerHTML = '<span class="step">Importing — reading the grid</span>' +
        'Tap a square, then the number printed in it; tap the same number again to take it ' +
        'back out. Leave the blanks blank. A digit repeated in a row, column or box is ' +
        'struck through as you go. When the grid matches, press <b>Check it</b>.';
      return;
    }
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


  /* ---------------- import ----------------
     The trainer's own end of assets/js/import.js: that module decides whether a
     grid is a puzzle, this one collects the digits and says what happened.

     Capture mode is the board itself rather than a form. The puzzle you are
     stuck on is on a phone screen next to you and cannot be copied as text, so
     the entry surface has to be the thing already sized for a thumb — the same
     board, the same keypad, one tap per printed digit. */

  function iSay(msg, kind) {
    const el = $('iResult');
    el.innerHTML = msg || '';
    el.className = 'note' + (kind ? ' ' + kind : '');
  }

  /* Five states, one at a time: offering, transcribing, pasting, reading a
     picture, imported. */
  function importPanel(state) {
    $('iStart').hidden = state !== 'start';
    $('iCapRow').hidden = state !== 'capture';
    $('iPasteBox').hidden = state !== 'paste';
    $('iImageBox').hidden = state !== 'image';
    $('iAfter').hidden = state !== 'after';
    $('iCount').hidden = state !== 'capture';
    $('iNote').hidden = state !== 'start';
  }

  function captureRefresh() {
    S.findings = []; S.pick = null; S.level = 0;
    S.wrong = new Array(81).fill(false);
    I.conflicts(S.grid).forEach(i => { S.wrong[i] = true; });
    $('iCount').textContent = S.grid.filter(v => v).length + ' entered';
    render();
  }

  function startCapture(seed) {
    if (!S.capture) S.before = S.puzzle;
    S.pending = null;
    S.capture = true;
    S.puzzle = null;
    S.grid = seed ? C.parse(seed) : new Array(81).fill(0);
    S.given = S.grid.map(v => v > 0);
    S.sol = new Array(81).fill(0);
    S.notes = []; for (let i = 0; i < 81; i++) S.notes.push(new Set());
    S.history = []; S.sel = null; S.focus = null; S.pick = null; S.level = 0;
    S.solved = false; S.noteCheck = null; S.mark = []; S.mode = 'pen';
    $('boardwrap').classList.add('capturing');
    importPanel('capture');
    captureRefresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Same digit twice clears the square, which is the fastest correction for the
     commonest slip — you tapped 6 where the puzzle prints 8. */
  function captureEnter(d) {
    if (S.sel === null) return;
    const i = S.sel;
    snapshot();
    if (S.grid[i] === d) { S.grid[i] = 0; S.given[i] = false; }
    else { S.grid[i] = d; S.given[i] = true; }
    S.mark = [];
    captureRefresh();
  }

  function endCapture() {
    S.capture = false;
    S.before = null;
    /* A position read from a picture belongs to the transcription it came with.
       Cancel out of capture, or load something else, and it has to go — every
       caller that still wants it reads it before calling this. */
    S.pending = null;
    $('boardwrap').classList.remove('capturing');
  }

  function cancelCapture() {
    const back = S.before;
    endCapture();
    S.mark = [];
    if (back) { load(back); importPanel(back.imported ? 'after' : 'start'); }
    else newPuzzle();
    iSay('');
  }

  /* A refusal is not a dead end: the grid stays on the board with the squares
     the validator wants re-read tinted, so the fix is one tap away. */
  function refuse(res, seed) {
    if (!S.capture) startCapture(seed);
    S.mark = res.cells || [];
    captureRefresh();
    iSay(res.message, 'warn');
  }

  function acceptImport(res) {
    const p = res.puzzle;
    const pend = S.pending;
    $('iText').value = '';
    held = 0;
    endCapture();
    load(p);
    /* A screenshot saw more than the puzzle — where you had got to, and what
       you had pencilled in. The puzzle is what gets saved and what the link
       carries, because that is the durable thing; the position goes back on the
       board now, and only where the puzzle left the square empty, so a digit
       misread as an entry can never overwrite a printed one. */
    if (pend) {
      const g = C.parse(p.p);
      pend.entries.forEach(e => { if (!g[e.cell]) S.grid[e.cell] = e.digit; });
      pend.notes.forEach((set, i) => { if (!S.grid[i]) S.notes[i] = new Set(set); });
      S.pending = null;
      recompute();
    }
    I.save(p);
    I.setHash(p.p);
    importPanel('after');
    renderSaved();
    iSay(res.message, res.walk.filled === 81 ? 'good' : '');
    flash('Your puzzle is on the board — play it as you would any other. If you are already ' +
          'well into it, press Catch me up to skip the moves you have made.');
  }

  /* Checking is up to a few hundred solver runs when the grid turns out to be
     wrong — under a second, but it blocks, so the panel says what it is doing
     and the work waits one frame for that to land on screen. */
  function check(text, seed) {
    iSay('Checking the grid… if something is off, working out where takes a second or two.');
    setTimeout(() => {
      const res = I.analyze(text, NAMES);
      if (res.ok) acceptImport(res);
      else if (res.code === 'length' || res.code === 'empty') iSay(res.message, 'warn');
      else refuse(res, seed);
    }, 30);
  }

  function finishCapture() { check(S.grid.join(''), null); }

  /* A string of the right length that is not a puzzle is worth putting on the
     board — capture mode opens on it with the bad squares marked, so the fix is
     a tap. One of the wrong length has nothing to show yet. */
  /* The box lays itself out as you type: nine to a line, grouped in threes.
     Everything is rebuilt from the grid characters alone, so the separators are
     never something you have to type, delete, or get wrong — which is the point,
     since a run of eighty-one characters cannot be read against a printed grid
     and nine rows of nine can.

     The caret is carried by COUNT rather than by position — how many grid
     characters were in front of it — because the positions either side of a
     relayout mean different things. */
  let held = 0;

  function relayout(e) {
    const el = $('iText');
    const raw = el.value;
    const upto = el.selectionStart === null ? raw.length : el.selectionStart;
    const chars = [];
    let n = 0;
    for (let k = 0; k < raw.length; k++) {
      if (!I.gridChar(raw[k])) continue;
      if (k < upto) n++;
      chars.push(raw[k]);
    }
    /* Backspace onto a space or a line break deleted furniture, not anything
       you typed, so the relayout puts it straight back and the key appears to
       have done nothing. Take the digit in front of it instead — that is what
       was meant, and a key that does nothing feels broken. */
    if (e && /backward/i.test(e.inputType || '') && chars.length === held && n > 0) {
      chars.splice(n - 1, 1);
      n--;
    }
    const text = I.gridify(chars.join(''));
    held = chars.length;
    if (text === raw) return;
    el.value = text;
    const pos = I.gridCaret(n, text.length);
    try { el.setSelectionRange(pos, pos); } catch (err) { /* not focused */ }
  }

  function loadPasted() {
    const raw = $('iText').value;
    check(raw, I.normalise(raw));
  }

  /* ---------------- reading a screenshot ----------------
     EXPERIMENTAL, and the code is shaped by that rather than only labelled
     with it: nothing here calls acceptImport. A read hands its digits to
     CAPTURE mode, which is the surface that already exists for a grid that
     might be wrong — it tints what it doubts and waits for you to press Check
     it. So the worst a bad read can do is waste a glance, and the validator in
     import.js still has the last word on whether any of it is a real puzzle. */

  function readSummary(res) {
    const filled = res.filled;
    const marks = res.noteCount ? ' Its ' + res.noteCount + ' pencil marks came across too, and go ' +
      'back on the board once you accept the puzzle.' : '';
    const shaky = res.low.length
      ? ' <b>' + res.low.length + (res.low.length === 1 ? ' square is' : ' squares are') +
        '</b> marked on the board — those are the ones it is least sure of, so check them first.'
      : ' It is confident about every square, which is not the same as being right: read the grid ' +
        'over before you accept it.';
    if (res.given) {
      const printed = res.given.filter(Boolean).length;
      const mine = filled - printed;
      return ['good', 'Read ' + printed + ' printed digits' +
        (mine ? ', and ' + mine + ' more that the app draws differently because you entered them' : '') +
        '. Only the printed ones are on the board' + (mine ? ' — your own go back on after you accept it' : '') +
        '.' + marks + shaky];
    }
    return ['warn', 'Read ' + filled + ' digits, but nothing in the picture separates the ones the ' +
      'puzzle printed from the ones you entered — this app draws them identically — so all ' +
      filled + ' are on the board as though they were printed. That still gets you a coach on the ' +
      'position you are stuck in, which is the point; what it cannot do is play the puzzle back ' +
      'from its start, so <b>Catch me up</b> will have nothing to do.' + marks + shaky];
  }

  function applyRead(res) {
    startCapture(null);
    const grid = new Array(81).fill(0), entries = [];
    for (let i = 0; i < 81; i++) {
      if (!res.grid[i]) continue;
      if (!res.given || res.given[i]) grid[i] = res.grid[i];
      else entries.push({ cell: i, digit: res.grid[i] });
    }
    S.grid = grid;
    S.given = grid.map(v => v > 0);
    S.pending = { entries: entries, notes: res.notes };
    S.mark = res.low.filter(i => grid[i]);
    captureRefresh();
    const say = readSummary(res);
    iSay(say[1], say[0]);
  }

  function readImage(file) {
    if (!file) return;
    if (!/^image\//.test(file.type || '')) {
      iSay('That is not an image. A screenshot saved as PNG, JPEG or HEIC is what this wants.', 'warn');
      return;
    }
    iSay('Reading the picture… finding the grid and measuring eighty-one squares takes a moment.');
    V.readFile(file).then(res => {
      if (res.ok) applyRead(res);
      else iSay(res.message, 'warn');
    }, err => {
      iSay('That image could not be opened — ' + (err && err.message ? err.message : 'unknown format') +
           '. A PNG or JPEG screenshot is the safe bet.', 'warn');
    });
  }

  /* Play every forced move from the printed digits and stop at the first
     advanced pattern — the wall, which is where someone who is stuck already
     is. Run from the givens rather than from the board in front of you: this
     way it is sound even when the position you typed has a wrong digit in it,
     and Restart is right there if you would rather play it yourself. */
  function catchUp() {
    if (!S.puzzle) return;
    const given = C.parse(S.puzzle.p);
    const w = I.walk(given, null, I.ADV_RANK);
    S.grid = w.grid;
    S.notes = w.notes;
    S.given = given.map(v => v > 0);
    S.wrong = new Array(81).fill(false);
    S.history = []; S.sel = null; S.focus = null; S.pick = null; S.level = 0;
    S.solved = false; S.noteCheck = null; S.mark = [];
    recompute();
    const played = w.played.map(x => x[1] + ' × ' + NAMES[x[0]]).join(', ') || 'nothing';
    if (w.stopped) {
      iSay('Played ' + played + ', and stopped at the first <b>' + NAMES[w.stopped.id] +
        '</b> — ' + w.filled + ' of 81 squares filled, notes in. That is the wall, and the ' +
        'coach is on it: hunt it yourself before you press <b>Show me more</b>.');
    } else if (w.filled === 81) {
      iSay('That solved it outright — ' + played + ' — without needing anything advanced. ' +
        'So if you are stuck on this puzzle, what you are missing is not a pattern: press ' +
        '<b>Restart this one</b>, play your own position back in, and let autocheck find the ' +
        'entry that is wrong.', 'good');
    } else {
      iSay('Played ' + played + ', and then nothing more fires — ' + w.filled + ' of 81 ' +
        'squares. This one needs something past the nine patterns this site teaches.', 'warn');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* Saved imports are the puzzle, not the position: 81 characters that survive
     anything. Restart already exists for getting back to the start of one. */
  function savedLabel(p) {
    const d = p.imported ? new Date(p.imported) : null;
    const when = d ? d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + ' · ' : '';
    return when + p.givens + ' givens';
  }

  function renderSaved() {
    const el = $('iSaved');
    el.innerHTML = '';
    I.saved().forEach(p => {
      const label = savedLabel(p);
      const wrap = document.createElement('span');
      wrap.className = 'saved';
      const b = document.createElement('button');
      b.className = 'chip' + (p.adv && p.adv.length ? ' adv' : '');
      b.type = 'button';
      b.textContent = label;
      b.title = 'Load this imported puzzle' +
        (p.adv && p.adv.length ? ' — needs ' + p.adv.map(x => NAMES[x]).join(' + ') : '');
      b.addEventListener('click', () => {
        endCapture();
        load(p);
        I.setHash(p.p);
        importPanel('after');
        iSay('Back on your imported puzzle: ' + label + '.');
      });
      const x = document.createElement('button');
      x.className = 'chip x';
      x.type = 'button';
      x.textContent = '×';
      x.title = 'Forget this one';
      x.setAttribute('aria-label', 'Forget the import from ' + label);
      x.addEventListener('click', () => { I.forget(p.p); renderSaved(); });
      wrap.appendChild(b); wrap.appendChild(x);
      el.appendChild(wrap);
    });
  }

  function copyLink() {
    const url = window.location.href;
    const ok = () => iSay('Link copied. It carries the puzzle itself, so it opens the same ' +
                          'board on any device.', 'good');
    const no = () => iSay('No clipboard available here — the link is in the address bar, and ' +
                          'it carries the puzzle: ' + url);
    try {
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(ok, no);
      else no();
    } catch (e) { no(); }
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

  $('bCapture').addEventListener('click', () => { startCapture(null); iSay(''); });
  $('bPaste').addEventListener('click', () => {
    importPanel('paste');
    relayout(null);
    $('iText').focus();
  });
  $('iText').addEventListener('input', relayout);
  /* No reader in the page, no button offering one. */
  if (!V) $('bImage').hidden = true;
  else {
    $('bImage').addEventListener('click', () => { importPanel('image'); iSay(''); });
    $('bImageCancel').addEventListener('click', () => {
      importPanel(S.puzzle && S.puzzle.imported ? 'after' : 'start');
      iSay('');
    });
    $('iFile').addEventListener('change', e => {
      const f = e.target.files && e.target.files[0];
      e.target.value = '';   /* so choosing the same file twice fires again */
      readImage(f);
    });
    const drop = $('iDrop');
    ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => {
      e.preventDefault(); drop.classList.add('over');
    }));
    ['dragleave', 'dragend'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('over');
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      readImage(f);
    });
    /* Paste is how a screenshot actually arrives on a desktop, and on iOS it is
       the one route that does not go through the photo library. Only while the
       picture panel is open, so it never steals a paste meant for the text box. */
    document.addEventListener('paste', e => {
      if ($('iImageBox').hidden) return;
      const items = (e.clipboardData && e.clipboardData.items) || [];
      for (let k = 0; k < items.length; k++) {
        if (items[k].kind !== 'file') continue;
        const f = items[k].getAsFile();
        if (f && /^image\//.test(f.type)) { e.preventDefault(); readImage(f); return; }
      }
    });
  }
  $('bPasteLoad').addEventListener('click', loadPasted);
  $('bPasteCancel').addEventListener('click', () => {
    importPanel(S.puzzle && S.puzzle.imported ? 'after' : 'start');
    iSay('');
  });
  $('bCapDone').addEventListener('click', finishCapture);
  $('bCapClear').addEventListener('click', () => { startCapture(null); iSay(''); });
  $('bCapCancel').addEventListener('click', cancelCapture);
  $('bCatchUp').addEventListener('click', catchUp);
  $('bCopyLink').addEventListener('click', copyLink);

  const drillEl = $('drills');
  ['pointing', 'claiming', 'naked_pair', 'hidden_pair', 'naked_triple', 'xwing', 'skyscraper', 'swordfish', 'xy_wing']
    .forEach(id => drillEl.appendChild(makeChip(id, { onClick: () => startDrill(id) })));

  document.addEventListener('keydown', e => {
    /* The paste box wants the same digits the pad does. While the caret is in a
       field, every key belongs to that field — otherwise typing 81 characters
       lands 1-9 on the grid and leaves only the 0s behind. */
    if (isTyping(e.target)) return;
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'z') { e.preventDefault(); undo(); }
      return;
    }
    if (e.key >= '1' && e.key <= '9') { press(+e.key); e.preventDefault(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { erase(); e.preventDefault(); return; }
    /* Notes mean nothing while transcribing — capture writes givens whatever
       the mode says — and the pad would dress itself as a note toggle and lie. */
    if (e.key === 'n' || e.key === 'N') {
      if (!S.capture) { S.mode = S.mode === 'pen' ? 'notes' : 'pen'; render(); }
      return;
    }
    if (e.key === 'h' || e.key === 'H') { more(); return; }
    if (S.capture && e.key === 'Enter') { finishCapture(); e.preventDefault(); return; }
    if (e.key === 'Escape') { deselect(); return; }
    if (S.sel === null) return;
    const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (moves[e.key] !== undefined) {
      const n = S.sel + moves[e.key];
      if (n >= 0 && n < 81) select(n);
      e.preventDefault();
    }
  });

  renderSaved();
  importPanel('start');
  /* A link that carries a puzzle is someone arriving at THAT one, so it beats
     the bank's opening draw. A link that carries a broken one says so and steps
     aside rather than leaving the trainer empty. */
  const linked = I.fromHash();
  const first = linked ? I.analyze(linked, NAMES) : null;
  if (first && first.ok) acceptImport(first);
  else {
    newPuzzle();
    if (first) iSay('The puzzle in that link does not read as a real one. ' + first.message, 'warn');
  }
})();
