/* trainer.js — a News+-shaped board that names the techniques in your position. */
(function () {
  'use strict';
  const C = window.SudokuCore, T = window.SudokuTech, BANK = window.SUDOKU_BANK,
        I = window.SudokuImport;
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
    autocheck: true, autoRemove: true, peers: true, coach: 'full', autoclear: true,
    tier: 'challenging',
    solved: false, noteCheck: null,
    /* import: `capture` hands the board over to transcription, `mark` is the
       set of squares the validator wants looked at again, `before` is the
       puzzle capture interrupted so Cancel can put it back. */
    capture: false, mark: [], before: null,
    /* inspect: the board read the other way round. `insp` is the squares you
       have pointed at, `report` is what SudokuTech.verify made of them. */
    inspect: false, insp: [], report: null
  };

  const NAMES = {
    naked_single: 'Naked single', hidden_single: 'Hidden single',
    pointing: 'Pointing pair', claiming: 'Claiming',
    naked_pair: 'Naked pair', hidden_pair: 'Hidden pair', naked_triple: 'Naked triple',
    hidden_triple: 'Hidden triple', xwing: 'X-Wing', skyscraper: 'Skyscraper',
    swordfish: 'Swordfish', xy_wing: 'XY-Wing'
  };
  const ADVANCED = ['xwing', 'skyscraper', 'swordfish', 'xy_wing'];

  /* The four difficulties, named for what a puzzle asks of you rather than for
     how it feels. Mirrors tier_of() in tools/bank.py, which is what stocks the
     bank — change one and change the other, or the selector starts handing out
     puzzles that do not match their label. Derived rather than read off the
     entry so that an imported puzzle is tiered by the same rule. */
  const SINGLES = ['naked_single', 'hidden_single'];
  const TIERS = ['easy', 'normal', 'challenging', 'extra'];
  const TIER_LABEL = { easy: 'Easy', normal: 'Normal', challenging: 'Challenging', extra: 'Extra' };
  function tierOf(p) {
    const adv = p.adv || [];
    if (adv.length >= 2) return 'extra';
    if (adv.length === 1) return 'challenging';
    return (p.t || []).some(x => !SINGLES.includes(x)) ? 'normal' : 'easy';
  }

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
    const i = +sq.dataset.i;
    /* Inspect mode takes the board's tap over rather than sharing it. There is
       no caret while you are reading — a tap adds a square to the question, not
       a destination for the next digit. */
    if (S.inspect) { inspToggle(i); return; }
    select(i);
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
        /* Inside the same snapshot as the entry that caused it: one thing you
           did, one press of Undo to take it back. */
        if (S.autoclear) autoclear();
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

  /* ---------------- autoclear ----------------
     A square whose notes have come down to one candidate is not a decision any
     more, so it fills itself. Each fill strips that digit from its peers, which
     can bring another square down to one, so this runs until the board stops
     moving — one entry can finish most of a box.

     It reads YOUR notes, not the solution. A candidate you wrongly rubbed out
     can leave a square holding one wrong digit, and this will write it in.
     That is the honest behaviour and the same bargain the rest of the board
     makes: autocheck marks it red where it lands, and a helper that quietly
     knew better would be hiding the mistake instead of showing it.

     Peers are stripped whether or not `Clear notes on entry` is set, because
     the cascade is the note-keeping — without it nothing would ever come down
     to one and the feature would do nothing at all. */
  function autoclear() {
    let placed = 0;
    for (let pass = 0; pass < 81; pass++) {
      let moved = false;
      for (let i = 0; i < 81; i++) {
        if (S.grid[i] || S.notes[i].size !== 1) continue;
        const d = [...S.notes[i]][0];
        S.grid[i] = d;
        S.notes[i] = new Set();
        S.wrong[i] = S.autocheck && S.sol[i] !== d;
        C.PEERS[i].forEach(x => S.notes[x].delete(d));
        moved = true; placed++;
      }
      if (!moved) break;
    }
    return placed;
  }
  const anyForced = () => S.grid.some((v, i) => !v && S.notes[i].size === 1);

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
    computeReport();
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
    if (opts.title) b.title = opts.title;
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
    if (S.autoclear) autoclear();
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

  /* ---------------- inspect ----------------
     The coach hands its answer down a ladder, a rung per press. This asks the
     opposite way round: you point at squares and it says what they are —
     including a pattern that is correctly read and kills nothing, which is the
     one the coach can never mention, because there is no move in it and every
     detector past the singles drops it. See SudokuTech.verify.

     It is a mode rather than a gesture, and deliberately so. The board is an
     input surface the rest of the time and the pad writes into whatever is
     selected, so a second meaning for a tap has to displace the first. It is
     also the anti-thesis of a trainer — point, and be told — which is fine as
     something you switch on and corrosive as something the board just does. */
  function setInspect(on) {
    if (S.capture) return;
    S.inspect = on;
    S.insp = [];
    S.report = null;
    /* The caret goes with it: nothing is selected-to-type-into while reading,
       and a caret left behind would let the pad write into a square you are
       pointing at for an entirely different reason. */
    S.sel = null;
    flash('');
    render();
  }

  function inspToggle(i) {
    const k = S.insp.indexOf(i);
    if (k >= 0) S.insp.splice(k, 1); else S.insp.push(i);
    computeReport();
    render();
  }

  /* Recomputed on every position change as well as every tap, so a report does
     not go on describing a board you have since played a move into. */
  function computeReport() {
    S.report = S.inspect && S.insp.length
      ? T.verify(S.grid, S.notes.some(s => s.size) ? S.notes : null, S.insp, S.findings)
      : null;
  }

  /* ---------------- clear the basics ----------------
     Play out everything below the advanced patterns and stop at the wall.
     import.js already has the walker and I.ADV_RANK already is the boundary —
     ranks 1-6 are the singles, pointing, claiming and the subsets; 7 and up are
     the fish and the wings. Unlike Catch me up, which restarts from the printed
     givens because an import has no position yet, this one walks from wherever
     you are.

     It refuses rather than guesses. The walker reasons from YOUR notes, so a
     single wrong elimination lets it prove a false single and then build on it
     — the one error this trainer otherwise exists to catch. */
  function clearBasics() {
    if (S.capture || S.solved) return;
    if (S.wrong.some(Boolean)) {
      flash('There is a wrong digit on the board, and every basic move would be played on top of it. Fix that first.', 'warn');
      return;
    }
    const anyNotes = S.notes.some(s => s.size);
    if (anyNotes) {
      const missing = [];
      for (let i = 0; i < 81; i++) {
        if (!S.grid[i] && S.notes[i].size && !S.notes[i].has(S.sol[i])) missing.push(i);
      }
      if (missing.length) {
        S.noteCheck = missing;
        render();
        flash(missing.length + ' square' + (missing.length > 1 ? 's have' : ' has') +
          ' lost its true digit \u2014 marked in red. The basics would be played on top of that, so fix those notes and press it again.', 'warn');
        return;
      }
    }
    /* Walk first, snapshot second. The walker builds its own copies, so nothing
       has moved yet at this point — and a press that turns out to have nothing
       to play must not cost an undo step, or pressing it twice silently eats
       the position the first press earned you. */
    const w = I.walk(S.grid, anyNotes ? S.notes : null, I.ADV_RANK);
    if (!w.played.length) {
      flash(w.stopped
        ? 'Nothing basic left to clear \u2014 the cheapest move on the board is already ' +
          article(NAMES[w.stopped.id]) + NAMES[w.stopped.id] + '.'
        : 'Nothing fires from here at all.', w.stopped ? '' : 'warn');
      return;
    }
    snapshot();
    S.grid = w.grid;
    S.notes = w.notes;
    S.wrong = new Array(81).fill(false);
    S.sel = null; S.pick = null; S.level = 0; S.noteCheck = null;
    S.insp = []; S.report = null;
    recompute();
    const played = w.played.map(x => x[1] + ' \u00d7 ' + NAMES[x[0]]).join(', ');
    const filled = ' ' + w.filled + ' of 81 squares filled.';
    /* Walking from an empty grid of notes fills them from the placed digits,
       which is an Autofill you did not ask for. Say so. */
    const noted = anyNotes ? '' : ' Notes were filled in to do it, the same as pressing Autofill.';
    if (w.stopped) {
      flash('Played ' + played + '. What is left starts at ' + article(NAMES[w.stopped.id]) +
        NAMES[w.stopped.id] + ' \u2014' + filled + noted);
    } else if (w.filled === 81) {
      flash('That solved it outright \u2014 ' + played + '. Nothing advanced was needed.' + noted, 'good');
    } else {
      flash('Played ' + played + ', and then nothing more fires.' + filled +
        ' This one needs something past the nine patterns the site teaches.' + noted, 'warn');
    }
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
    S.solved = false; S.noteCheck = null; S.mark = []; S.insp = []; S.report = null;
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
    /* Notes in from the start. News+ makes you press Autofill and so does the
       button, but nothing here is being taught by withholding them — the coach
       cannot read a position without notes, so an empty board just means the
       first thing you do on every puzzle is press the same key. */
    const base = C.baseCandidates(g);
    S.notes = []; for (let i = 0; i < 81; i++) S.notes.push(g[i] ? new Set() : base[i]);
    S.wrong = new Array(81).fill(false);
    S.history = []; S.sel = null; S.focus = null; S.pick = null; S.level = 0;
    S.solved = false; S.noteCheck = null; S.mark = []; S.insp = []; S.report = null;
    recompute();
    flash('');
  }
  function newPuzzle() {
    importPanel('start');
    I.clearHash();
    /* Falls back to the whole bank rather than dealing nothing, which is what a
       tier with no puzzles left in it would otherwise do. */
    const pool = BANK.filter(p => tierOf(p) === S.tier);
    if (!pool.length) return load(BANK[Math.floor(Math.random() * BANK.length)]);
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
    const inspSet = new Set(S.inspect ? S.insp : []);
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
        (inspSet.has(i) ? ' insp' : '') +
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
      /* A connector runs through the centre of every square between its ends,
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
         rectangle. */
      const ends = new Map();
      f.lines.forEach(([a, b]) => {
        ends.set(a, (ends.get(a) || 0) + 1);
        ends.set(b, (ends.get(b) || 0) + 1);
      });
      f.lines.forEach(([a, b, style]) => {
        const dashed = style === 'cross';
        let x1 = C.colOf(a) + 0.5, y1 = C.rowOf(a) + 0.5,
            x2 = C.colOf(b) + 0.5, y2 = C.rowOf(b) + 0.5;
        const len = Math.hypot(x2 - x1, y2 - y1);
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
        ['case' + (dashed ? ' cross' : ''), dashed ? 'cross' : ''].forEach(cls => {
          const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          l.setAttribute('x1', x1); l.setAttribute('y1', y1);
          l.setAttribute('x2', x2); l.setAttribute('y2', y2);
          if (cls) l.setAttribute('class', cls);
          geoEl.appendChild(l);
        });
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

    $('bAutoclear').setAttribute('aria-pressed', S.autoclear);
    $('bPen').setAttribute('aria-pressed', S.mode === 'pen');
    $('bNotes').setAttribute('aria-pressed', S.mode === 'notes');
    $('bUndo').disabled = !S.history.length;
    $('bApply').disabled = !S.pick;
    /* Capture mode borrows the board, so everything that acts on a position
       rather than builds one steps out of the way for the duration. Undo,
       Erase and the pad stay: those are the transcription controls. */
    ['bAutofill', 'bAutoclear', 'bNotes', 'bMore', 'bCheckNotes', 'bNew', 'bRestart',
     'bCatchUp', 'bCopyLink', 'bClearBase'].forEach(id => { $(id).disabled = S.capture; });
    [...$('drills').querySelectorAll('.chip')].forEach(b => { b.disabled = S.capture; });

    /* meta */
    if (S.capture) {
      $('mLevel').textContent = 'Importing';
      $('mGivens').textContent = S.grid.filter(v => v).length + ' entered';
      $('mNeeds').textContent = 'not checked yet';
    } else if (S.puzzle) {
      $('mLevel').textContent = TIER_LABEL[tierOf(S.puzzle)] || 'Imported';
      $('mGivens').textContent = S.puzzle.givens + ' givens';
      $('mNeeds').textContent = S.puzzle.adv.length
        ? 'needs ' + S.puzzle.adv.map(x => NAMES[x]).join(' + ')
        : 'subsets only';
    }
    $('boardwrap').classList.toggle('inspecting', S.inspect);
    renderCoach();
    renderInspector();
  }

  /* The report. Everything it says comes out of SudokuTech.verify — this only
     decides the order to say it in: what you have got, what you nearly had,
     and, when neither, why nothing fits. */
  function renderInspector() {
    const btn = $('bInspect'), out = $('nReport'), count = $('nCount');
    btn.setAttribute('aria-pressed', S.inspect);
    btn.textContent = S.inspect ? 'Stop inspecting' : 'Inspect the board';
    btn.disabled = S.capture;
    $('bInspClear').disabled = !S.insp.length;
    $('nNote').hidden = S.inspect;
    count.hidden = !S.inspect;
    count.textContent = S.insp.length
      ? S.insp.length + ' square' + (S.insp.length === 1 ? '' : 's') + ' picked'
      : 'tap the squares you are reading';

    if (!S.report) {
      out.innerHTML = S.inspect
        ? '<p class="none">Tap the squares you think make a pattern. Tap one again to drop it.</p>' : '';
      out.hidden = !S.inspect;
      return;
    }

    const r = S.report, p = [];
    const names = a => a.map(C.cellName).join(', ');
    /* `kills: []` is a result, not a failure — it is the whole reason this
       exists, so it gets the longer sentence rather than an apology. */
    const killLine = k => k.length
      ? 'Kills ' + k.length + ' candidate' + (k.length === 1 ? '' : 's') + ': <b>' +
        k.map(x => x.digit + ' from ' + C.cellName(x.cell)).join(', ') + '</b>.'
      : '<b>Kills nothing.</b> The reading is right \u2014 every square it would clear has lost those digits already, which is why the coach never lists it.';

    if (r.filled.length) p.push('<p class="dim">' + names(r.filled) + ' already ' +
      (r.filled.length === 1 ? 'holds a digit' : 'hold digits') + ', so ' +
      (r.filled.length === 1 ? 'it is' : 'they are') + ' out of the reading.</p>');

    r.shapes.forEach(sh => p.push('<p class="found"><b>' + sh.name + '</b> on ' +
      sh.digits.join(', ') + ' \u2014 ' + sh.region + '. ' + killLine(sh.kills) +
      '<span class="why">' + sh.why + '</span></p>'));

    r.near.forEach(nr => {
      const bits = [];
      if (nr.missing.length) bits.push('it also needs <b>' + names(nr.missing) + '</b>');
      if (nr.extra.length) bits.push('<b>' + names(nr.extra) + '</b> ' +
        (nr.extra.length === 1 ? 'is not' : 'are not') + ' part of it');
      p.push('<p class="miss">Close \u2014 there is ' + article(nr.name) + '<b>' + nr.name +
        '</b> on ' + nr.digits.join(', ') + ' here, but ' + bits.join(', and ') + '.</p>');
    });

    /* Only when there is nothing else to say. A near miss has already explained
       what is going on, and "no subset can live across these" printed under
       "there is a Skyscraper here" reads as the panel contradicting itself —
       true of subsets, irrelevant to the pattern it just named. */
    if (!r.shapes.length && !r.near.length) {
      let why;
      if (!r.cells.length) why = 'Every square you picked already holds a digit.';
      else if (r.cells.length === 1) why = C.cellName(r.cells[0]) + ' can still be ' +
        [...r.cand[r.cells[0]]].sort((a, b) => a - b).join(', ') + ', and nothing forces it yet.';
      else if (!r.shared.length) why = 'These squares share no row, column or box, so no subset or interaction can live across them \u2014 and they make no single-digit pattern either.';
      else why = 'No pattern the site teaches fits these ' + r.cells.length + ' squares.';
      p.push('<p class="none">' + why + '</p>');
    }
    out.innerHTML = p.join('');
    out.hidden = false;
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
          title: arr.length > 1 ? 'Click again for the next of the ' + arr.length : '',
          onClick: () => {
            /* Clicking the chip you are already on walks to the next instance.
               Three X-Wings on the board is three different rectangles, and the
               count printed beside the name is a promise you can reach them. */
            const cur = S.pick && S.pick.id === id ? arr.indexOf(S.pick) : -1;
            S.pick = arr[(cur + 1) % arr.length];
            /* While inspecting, a chip draws. That hands out three rungs of the
               ladder in one click, which is what the mode is for and exactly
               why it is not what a chip does the rest of the time. */
            S.level = S.inspect ? Math.max(3, S.level) : Math.max(1, S.level);
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

  /* Four states, one at a time: offering, transcribing, pasting, imported. */
  function importPanel(state) {
    $('iStart').hidden = state !== 'start';
    $('iCapRow').hidden = state !== 'capture';
    $('iPasteBox').hidden = state !== 'paste';
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
    S.capture = true;
    S.puzzle = null;
    S.grid = seed ? C.parse(seed) : new Array(81).fill(0);
    S.given = S.grid.map(v => v > 0);
    S.sol = new Array(81).fill(0);
    S.notes = []; for (let i = 0; i < 81; i++) S.notes.push(new Set());
    S.history = []; S.sel = null; S.focus = null; S.pick = null; S.level = 0;
    S.solved = false; S.noteCheck = null; S.mark = []; S.mode = 'pen';
    /* Capture wants the board as a typing surface and the inspector wants it as
       a question. Only one of them can have it. */
    S.inspect = false; S.insp = []; S.report = null;
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
    $('iText').value = '';
    held = 0;
    endCapture();
    load(p);
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
  /* Switching it on resolves what is already forced, because a toggle that
     waits for your next entry to show what it does looks broken. Only takes an
     undo step if it actually placed something. */
  $('bAutoclear').addEventListener('click', () => {
    S.autoclear = !S.autoclear;
    if (S.autoclear && anyForced()) { snapshot(); autoclear(); recompute(); }
    else render();
  });
  $('bCheckNotes').addEventListener('click', checkNotes);
  $('bClearBase').addEventListener('click', clearBasics);
  $('bInspect').addEventListener('click', () => setInspect(!S.inspect));
  $('bInspClear').addEventListener('click', () => {
    S.insp = []; S.report = null; render();
  });
  $('sAutocheck').addEventListener('change', e => { S.autocheck = e.target.checked; });
  $('sAutoRemove').addEventListener('change', e => { S.autoRemove = e.target.checked; });
  $('sHighlightPeers').addEventListener('change', e => { S.peers = e.target.checked; render(); });
  $('sCoach').addEventListener('change', e => { S.coach = e.target.value; render(); });
  $('sTier').addEventListener('change', e => { S.tier = e.target.value; newPuzzle(); });

  $('bCapture').addEventListener('click', () => { startCapture(null); iSay(''); });
  $('bPaste').addEventListener('click', () => {
    importPanel('paste');
    relayout(null);
    $('iText').focus();
  });
  $('iText').addEventListener('input', relayout);
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
  /* Out of the import and back to the bank. An import takes the board over —
     hash, meta line, panel — and until now the only way off it was the New
     puzzle button three sections down, which is not where you are looking.
     newPuzzle() already drops the hash and returns the panel to 'start'; the
     puzzle itself is in the saved list, so nothing is thrown away. */
  $('bFresh').addEventListener('click', () => { endCapture(); newPuzzle(); iSay(''); });

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
    /* Escape backs out one layer at a time: the squares you picked first, then
       the mode. Leaving both at once loses a selection you may have spent a
       minute assembling. */
    if (e.key === 'Escape') {
      if (S.inspect) {
        if (S.insp.length) { S.insp = []; S.report = null; render(); }
        else setInspect(false);
        return;
      }
      deselect();
      return;
    }
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
