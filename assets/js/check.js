/* check.js — the scratch board. Mark a handful of squares, name the technique
   you think you are looking at, and be told whether it holds.

   Deliberately NOT a puzzle. There are no givens, no solution, no coach and no
   solver here: the board is a piece of paper for copying four or five squares
   onto, and every answer comes from SudokuTech.audit(), which reasons about
   nothing but the marks you have typed. See the long note above audit() in
   techniques.js for why that is a different question from the trainer's, and
   why the honest answer to it is sometimes "the shape is right, and here is
   the count you still owe". */
(function () {
  'use strict';
  const C = window.SudokuCore, T = window.SudokuTech,
        M = window.SudokuMaster, TIER = window.SudokuTier;
  const onMaster = () => !!(M && TIER && TIER.is('master'));
  const $ = id => document.getElementById(id);
  const boardEl = $('board'), geoEl = $('geo');

  const S = {
    notes: [], sel: [], multi: false, erase: false,
    id: null, report: null, focus: null, history: []
  };
  const blank = () => { const a = []; for (let i = 0; i < 81; i++) a.push(new Set()); return a; };
  S.notes = blank();

  /* ---------------- history ---------------- */
  /* Marks only, because marks are all there is here — no grid, no givens, no
     solution. Two hundred steps, as the trainer keeps, and for a sharper
     reason: Clear board is one press away from the pad, and nothing else on
     this page could put those squares back. */
  function snapshot() {
    S.history.push(S.notes.map(n => [...n]));
    if (S.history.length > 200) S.history.shift();
  }
  function undo() {
    const h = S.history.pop(); if (!h) return;
    S.notes = h.map(a => new Set(a));
    /* The report described the marks that have just gone. Same rule as
       stale(): a verdict about a board that no longer exists is the one thing
       this page cannot leave on the screen. */
    S.report = null; S.id = null;
    say('Undone.', '');
    render();
  }

  /* The nine, in the site's order. `need` is what to select, and it is here
     rather than in the audit because it is advice for before you press, not a
     verdict after. */
  const TECHS = [
    ['pointing', 'Pointing pair', 'the two or three spots inside the box'],
    ['claiming', 'Claiming', 'the two or three spots on the line'],
    ['naked_pair', 'Naked pair', 'the two squares'],
    ['naked_triple', 'Naked triple', 'the three squares'],
    ['hidden_pair', 'Hidden pair', 'the two squares, with all their marks'],
    ['xwing', 'X-Wing', 'the four corners'],
    ['swordfish', 'Swordfish', 'every spot in the three lines'],
    ['skyscraper', 'Skyscraper', 'the two spots in each of the two lines'],
    ['xy_wing', 'XY-Wing', 'the hinge and both wings']
  ];
  /* What to mark before you press, for the tier above. Longer, because most of
     these are two things joined — a pattern and the link that arms it. */
  const MASTER_TECHS = [
    ['unique_rect', 'Unique rectangle', 'all four corners of the rectangle'],
    ['bug', 'BUG+1', 'nothing — this one needs the whole board'],
    ['finned', 'Finned X-Wing', 'the four corners and every fin'],
    ['kite', '2-string kite', 'the two spots in the row and the two in the column'],
    ['empty_rect', 'Empty rectangle', 'the box’s spots, plus both ends of the link'],
    ['colouring', 'Simple colouring', 'every square in the chain'],
    ['w_wing', 'W-Wing', 'the two matching squares and both ends of the link'],
    ['xy_chain', 'XY-chain', 'every two-mark square in the chain'],
    ['aic', 'AIC', 'every square the chain runs through']
  ];
  const isMasterId = id => MASTER_TECHS.some(t => t[0] === id);

  /* An XY-Wing off the cheat sheet, so the first thing the panel ever says is
     a worked example rather than an empty state. Verified there, and audited
     here by the same code as anything you type. */
  const DEMO = {
    id: 'xy_wing',
    marks: { 42: [1, 5], 60: [1, 9], 52: [5, 9] },
    say: 'An XY-Wing from the cheat sheet, typed in for you. Press the other names to see what a ' +
         'refusal looks like.'
  };
  /* The master demo is a four-link XY-chain, which is the one technique up
     there a fragment can settle outright — so the first thing the panel says
     on this tier is a real yes rather than a list of counts you owe. */
  const DEMO_MASTER = {
    id: 'xy_chain',
    marks: { 0: [1, 2], 4: [2, 3], 40: [3, 4], 44: [4, 1] },
    say: 'A four-link XY-chain. Press the other names to watch it refuse, and note how much of ' +
         'this tier comes back as a count only your own grid can settle.'
  };

  /* ---------------- board ---------------- */
  let rules = '';
  for (let k = 1; k < 9; k++) {
    const box = k % 3 === 0 ? ' class="box"' : '';
    rules += '<line' + box + ' x1="' + k + '" y1="0" x2="' + k + '" y2="9"/>' +
             '<line' + box + ' x1="0" y1="' + k + '" x2="9" y2="' + k + '"/>';
  }
  $('gridlines').innerHTML = rules;

  const cells = [];
  for (let i = 0; i < 81; i++) {
    const d = document.createElement('div');
    d.className = 'sq';
    d.tabIndex = -1;
    d.setAttribute('role', 'gridcell');
    d.dataset.i = i;
    const nts = document.createElement('div');
    nts.className = 'notes';
    for (let n = 1; n <= 9; n++) {
      const s = document.createElement('span');
      s.className = 'nt';
      s.textContent = n;
      nts.appendChild(s);
    }
    d.appendChild(nts);
    boardEl.appendChild(d);
    cells.push({ el: d, notes: [...nts.children] });
  }

  let dragging = false, dragged = false;
  const canDrag = e => e.pointerType !== 'touch' || S.multi;
  boardEl.addEventListener('pointerdown', e => {
    const sq = e.target.closest('.sq'); if (!sq) return;
    select(+sq.dataset.i, e.shiftKey || e.ctrlKey || e.metaKey);
    if (!canDrag(e)) return;
    dragging = true; dragged = false;
    boardEl.style.touchAction = 'none';
  });
  boardEl.addEventListener('pointermove', e => {
    if (!dragging) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const sq = el && el.closest && el.closest('.sq');
    if (!sq || !boardEl.contains(sq)) return;
    const i = +sq.dataset.i;
    if (S.sel.indexOf(i) >= 0) return;
    dragged = true;
    S.sel.push(i);
    render();
  });
  const endDrag = () => { dragging = false; boardEl.style.touchAction = ''; };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  boardEl.addEventListener('click', e => {
    if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; }
  }, true);

  function select(i, add) {
    const at = S.sel.indexOf(i);
    if (add || S.multi) {
      if (at >= 0) S.sel.splice(at, 1); else S.sel.push(i);
    } else {
      S.sel = (S.sel.length === 1 && at === 0) ? [] : [i];
    }
    render();
  }

  /* ---------------- marks ---------------- */
  const pad = $('pad');
  for (let d = 1; d <= 9; d++) {
    const b = document.createElement('button');
    b.className = 'key'; b.type = 'button'; b.textContent = d;
    b.addEventListener('click', () => mark(d));
    pad.appendChild(b);
  }

  function mark(d) {
    /* Nothing selected, so the press lights the digit rather than writing it —
       the trainer's focus mode, on a board where it answers a slightly
       different question: not "where can a 6 go" but "did I type the 6s I
       meant to". Pressing it again puts it out. */
    if (!S.sel.length) { S.focus = S.focus === d ? null : d; render(); return; }
    snapshot();
    if (S.erase) { S.sel.forEach(i => S.notes[i].delete(d)); }
    else {
      /* One rule for a multi-square press: if every selected square already
         has the digit, the press takes it away; otherwise it puts it in
         everywhere. Toggling each square independently makes a drag across
         four squares produce four different answers. */
      const all = S.sel.every(i => S.notes[i].has(d));
      S.sel.forEach(i => (all ? S.notes[i].delete(d) : S.notes[i].add(d)));
    }
    stale();
    render();
  }

  function clearCells() {
    if (!S.sel.length) { say('Nothing selected.', 'warn'); return; }
    snapshot();
    S.sel.forEach(i => S.notes[i].clear());
    stale();
    render();
  }

  function clearBoard() {
    snapshot();
    S.notes = blank(); S.sel = []; S.report = null; S.id = null;
    say('');
    render();
  }

  /* A report describes a set of marks. Change the marks and it is describing a
     board that no longer exists, so it goes — rather than sitting there being
     quietly wrong, which is the one thing this page cannot afford. */
  function stale() {
    if (S.report) { S.report = null; say('Marks changed — ask again.', ''); }
  }

  /* ---------------- asking ---------------- */
  const chips = $('chips');
  function fillChips() {
    chips.innerHTML = '';
    (onMaster() ? MASTER_TECHS : TECHS).forEach(([id, name, need]) => {
      const b = document.createElement('button');
      b.className = 'chip' + (onMaster() ? ' mst' : ''); b.type = 'button'; b.dataset.id = id;
      b.setAttribute('aria-pressed', 'false');
      b.textContent = name;
      b.title = 'Mark ' + need + ', then press this.';
      b.addEventListener('click', () => ask(id));
      chips.appendChild(b);
    });
  }
  fillChips();
  if (TIER) TIER.onChange(() => {
    /* The question changes, so the answer to the old one goes. The marks stay:
       the squares you copied in are the same squares either way. */
    S.report = null; S.id = null;
    fillChips();
    say(onMaster()
      ? 'Master tier. The same board, audited against uniqueness, fins, colouring, wings and chains.'
      : 'Advanced tier. Back to the nine.', '');
    render();
  });

  function ask(id) {
    S.id = id;
    S.report = isMasterId(id) ? M.audit(S.notes, id, S.sel) : T.audit(S.notes, id, S.sel);
    say('');
    render();
  }

  function say(msg, kind) {
    const el = $('flash');
    el.textContent = msg || '';
    el.className = 'note flash' + (kind ? ' ' + kind : '');
  }

  /* ---------------- keyboard ---------------- */
  const isTyping = el => !!el && (el.isContentEditable || el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && !/^(checkbox|radio|button|submit|range)$/i.test(el.type)));
  window.addEventListener('keydown', e => {
    if (isTyping(document.activeElement)) return;
    if (e.metaKey || e.ctrlKey) {
      if (e.key === 'z') { e.preventDefault(); undo(); }
      return;
    }
    if (e.altKey) return;
    if (e.key >= '1' && e.key <= '9') { mark(+e.key); e.preventDefault(); return; }
    if (e.key === 'Backspace' || e.key === 'Delete') { clearCells(); e.preventDefault(); return; }
    /* One layer per press, the trainer's rule: the squares you picked first,
       then the lit digit, then the mode. Dropping all three at once throws
       away a selection that took a minute to assemble. */
    if (e.key === 'Escape') {
      if (S.sel.length) S.sel = [];
      else if (S.focus !== null) S.focus = null;
      else S.erase = false;
      render(); e.preventDefault(); return;
    }
    const move = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (move === undefined) return;
    e.preventDefault();
    const at = S.sel.length ? S.sel[S.sel.length - 1] : (move > 0 ? -move : 81 + move);
    let next = at + move;
    if (move === -1 && C.colOf(at) === 0) next = at;
    if (move === 1 && C.colOf(at) === 8) next = at;
    if (next < 0 || next > 80) next = at;
    S.sel = [next];
    render();
  });

  /* ---------------- render ---------------- */
  function render() {
    const r = S.report;
    const pat = new Set(r ? r.cells : []);
    const zone = new Set(r ? r.zone : []);
    const killMap = new Map();
    if (r) r.kills.forEach(k => {
      if (!killMap.has(k.cell)) killMap.set(k.cell, new Set());
      killMap.get(k.cell).add(k.digit);
    });
    const rings = new Set(r ? (r.roof || []).concat(r.wings || []) : []);
    const sel = new Set(S.sel);

    /* Same seek mode the trainer has: with a focus digit set, a square that
       cannot hold it steps back, so the digit is found by scanning squares
       rather than by reading every note in them. */
    boardEl.classList.toggle('seek', !!S.focus);

    for (let i = 0; i < 81; i++) {
      const c = cells[i];
      c.el.className = 'sq' +
        (S.focus && !S.notes[i].has(S.focus) ? ' cold' : '') +
        (pat.has(i) ? ' pat' : '') +
        (killMap.has(i) ? ' tgt' : '') +
        (zone.has(i) ? ' unit' : '') +
        (rings.has(i) || (r && r.pivot === i) ? ' pivot' : '') +
        (sel.has(i) ? ' sel' : '') +
        (S.sel.length && S.sel[S.sel.length - 1] === i ? ' last' : '');
      c.notes.forEach((sp, k) => {
        const d = k + 1;
        const on = S.notes[i].has(d);
        sp.className = 'nt' + (on ? ' on' : '') +
          (on && S.focus === d ? ' lit' : '') +
          (on && r && pat.has(i) && r.digits.indexOf(d) >= 0 ? ' patd' : '') +
          (on && killMap.has(i) && killMap.get(i).has(d) ? ' dead' : '');
      });
    }

    geoEl.innerHTML = '';
    if (r && r.verdict !== 'no' && r.lines) {
      const ends = new Map();
      r.lines.forEach(([a, b]) => {
        ends.set(a, (ends.get(a) || 0) + 1);
        ends.set(b, (ends.get(b) || 0) + 1);
      });
      r.lines.forEach(([a, b, style]) => {
        const dashed = style === 'cross';
        let x1 = C.colOf(a) + 0.5, y1 = C.rowOf(a) + 0.5,
            x2 = C.colOf(b) + 0.5, y2 = C.rowOf(b) + 0.5;
        const len = Math.hypot(x2 - x1, y2 - y1) || 1;
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

    /* pad: a digit key reports whether the selection already carries it — and
       with nothing selected the pad sinks a shade, because a press then lights
       a digit rather than writing one. Both readbacks are the trainer's, and
       the sunk pad is only honest now that the press does something. */
    const one = S.sel.length === 1 ? S.sel[0] : null;
    const focusing = !S.sel.length;
    [...pad.children].forEach((b, k) => {
      const d = k + 1;
      const has = S.sel.length && S.sel.every(i => S.notes[i].has(d));
      b.classList.toggle('noted', !!has);
      b.classList.toggle('focused', focusing && S.focus === d);
    });
    pad.classList.toggle('focusmode', focusing);
    pad.classList.toggle('rubmode', S.erase);
    /* The caption says what the pad is doing, not what it usually does. */
    $('capMark').textContent = S.erase ? 'Erase' : 'Pencil marks';
    $('bErase').setAttribute('aria-pressed', String(S.erase));
    $('bMulti').setAttribute('aria-pressed', String(S.multi));
    $('bClear').disabled = !S.sel.length;
    $('bUndo').disabled = !S.history.length;

    const n = countMarked();
    $('mCount').textContent = n ? n + ' square' + (n === 1 ? '' : 's') + ' marked' : 'empty board';
    $('mSel').textContent = S.sel.length
      ? 'auditing the ' + S.sel.length + ' selected'
      : 'auditing every marked square';
    $('padHint').textContent = focusing
      ? (S.multi ? 'Select multiple is on — tap squares to add them'
                 : 'Nothing selected — tap a square, or a number to light it')
      : S.erase
        ? 'The pad takes marks away — press Erase again to go back to writing'
        : one !== null
          ? 'Writing marks into ' + C.cellName(one)
          : S.sel.length + ' squares — the pad works on all of them at once';

    [...chips.children].forEach(b => {
      b.setAttribute('aria-pressed', String(S.id === b.dataset.id));
    });
    renderReport();
  }

  function countMarked() {
    let n = 0;
    for (let i = 0; i < 81; i++) if (S.notes[i].size) n++;
    return n;
  }

  const ICON = { ok: '✓', bad: '✗', assume: '?' };

  function renderReport() {
    const out = $('report'), r = S.report;
    if (!r) {
      out.innerHTML = '<p class="none">Write the marks you can see, then press the technique you ' +
        'think it is. Nothing is solved here and nothing is guessed: you get the conditions of ' +
        'that pattern, one at a time, checked against what you typed.</p>';
      return;
    }
    const p = [];
    const article = /^[AEIOUX]/.test(r.name) ? 'an ' : 'a ';
    /* Mid-sentence, so the name loses its capital — except the two that are
       spelled with one wherever they appear. */
    const name = /^X/.test(r.name) ? r.name : r.name.charAt(0).toLowerCase() + r.name.slice(1);
    let head;
    if (r.verdict === 'yes') head = 'Yes — that is ' + article + name + '.';
    else if (r.verdict === 'no') head = 'No — that is not ' + article + name + '.';
    else head = 'Everything your marks can settle checks out. What is left is a count only your grid can make.';
    p.push('<p class="verdict ' + r.verdict + '">' + head + '</p>');

    /* Two children exactly, glyph then sentence: the list is a two-column grid,
       so a bare text node would become a third item and wrap under the tick. */
    p.push('<ul class="conds">' + r.conditions.map(c =>
      '<li class="' + c.state + '"><span aria-hidden="true">' + ICON[c.state] + '</span>' +
      '<span><span class="sr">' + (c.state === 'ok' ? 'checks out' : c.state === 'bad' ? 'fails' :
        'not settled here') + ': </span>' + c.text + '</span></li>').join('') + '</ul>');

    if (r.verdict !== 'no') {
      const bits = [];
      if (r.zoneText) bits.push(r.zoneText);
      if (r.kills.length) bits.push('Of the squares you have marked, <b>' +
        r.kills.map(k => k.digit + ' dies in ' + C.cellName(k.cell)).join(', ') + '</b>.');
      if (r.zone.length) bits.push((r.kills.length ? 'The other <b>' : 'All <b>') + r.zone.length +
        ' square' + (r.zone.length === 1 ? '' : 's') + '</b> in that ground ' +
        (r.zone.length === 1 ? 'is' : 'are') + ' blank here — lit on the board, and what to go and ' +
        'look at on the real grid.');
      else if (!r.kills.length) bits.push('Nothing you have marked loses anything. That does not ' +
        'make the reading wrong — it makes it worthless in this position, which is a thing worth ' +
        'knowing before you spend another minute on it.');
      p.push('<p class="lands">' + bits.join(' ') + '</p>');
    }
    if (r.note) p.push('<p class="rnote">' + r.note + '</p>');
    out.innerHTML = p.join('');
  }

  /* ---------------- buttons ---------------- */
  $('bUndo').addEventListener('click', undo);
  $('bErase').addEventListener('click', () => { S.erase = !S.erase; render(); });
  $('bMulti').addEventListener('click', () => { S.multi = !S.multi; render(); });
  $('bClear').addEventListener('click', clearCells);
  $('bWipe').addEventListener('click', clearBoard);
  $('bDemo').addEventListener('click', () => {
    const demo = onMaster() ? DEMO_MASTER : DEMO;
    clearBoard();
    Object.keys(demo.marks).forEach(k => demo.marks[k].forEach(d => S.notes[+k].add(d)));
    ask(demo.id);
    say(demo.say, '');
  });

  render();
})();
