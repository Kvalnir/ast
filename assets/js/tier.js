/* tier.js — the Advanced / Master switch, and the only thing that knows which
 * page is which tier's version of which.
 *
 * The site is two sites wearing one set of clothes. Three pages exist twice —
 * the reference, the cheat sheet and the gallery — and two pages exist once
 * and change what they detect (the trainer and the check board). A reader
 * should never have to know which kind they are standing on: the switch
 * carries you to the same place in the other tier where there is one, and
 * quietly re-reads the board where there is not.
 *
 * The tier is remembered rather than kept in the URL. It is a setting about
 * you — which techniques you are working on — not a property of the page, and
 * a link someone hands you should open at whatever tier they are reading in
 * rather than dragging you back to theirs.
 *
 * With JS off, every nav link stays exactly what the HTML says it is: the
 * Advanced pages, which are the ones a first-time reader wants anyway.
 */
(function (root) {
  'use strict';

  const KEY = 'ast-tier';
  const TIERS = ['advanced', 'master'];
  /* Which file is which page, at which tier. A page missing from a tier keeps
     its single file and is told to re-read itself instead. */
  const PAGES = {
    patterns: { advanced: 'index.html', master: 'master.html' },
    cheatsheet: { advanced: 'cheatsheet.html', master: 'master-cheatsheet.html' },
    gallery: { advanced: 'gallery.html', master: 'master-gallery.html' },
    trainer: { advanced: 'trainer.html', master: 'trainer.html' },
    check: { advanced: 'check.html', master: 'check.html' }
  };

  function stored() {
    try {
      const v = root.localStorage.getItem(KEY);
      return TIERS.indexOf(v) >= 0 ? v : 'advanced';
    } catch (e) { return 'advanced'; }
  }
  function remember(t) {
    try { root.localStorage.setItem(KEY, t); } catch (e) { /* private mode; the switch still works for this visit */ }
  }

  const body = document.body;
  const here = body.getAttribute('data-page') || '';
  /* A page that only exists in one tier declares it, and visiting it directly
     — from a link, a bookmark, the back button — sets the switch rather than
     arguing with it. */
  const pageTier = body.getAttribute('data-tier');
  let tier = pageTier || stored();
  if (pageTier) remember(pageTier);

  function paint() {
    body.setAttribute('data-tier', tier);
    document.querySelectorAll('nav a[data-page]').forEach(a => {
      const p = PAGES[a.getAttribute('data-page')];
      if (!p) return;
      a.setAttribute('href', p[tier]);
      if (a.getAttribute('data-page') === here) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    document.querySelectorAll('.tierswitch button[data-tier]').forEach(b => {
      b.setAttribute('aria-pressed', String(b.dataset.tier === tier));
    });
    const flip = document.querySelector('.tierflip');
    if (flip) {
      const other = tier === 'advanced' ? 'master' : 'advanced';
      const label = t => (t === 'advanced' ? 'Advanced' : 'Master');
      flip.innerHTML = '<span aria-hidden="true">\u21c4</span> ' + label(tier);
      flip.setAttribute('aria-label', 'Tier: ' + label(tier) + '. Switch to ' + label(other) + '.');
      flip.dataset.other = other;
    }
  }

  function go(next) {
    if (next === tier) return;
    tier = next;
    remember(tier);
    const p = PAGES[here];
    /* Same page, other tier — unless this page is the same in both, in which
       case nothing needs to move and the page re-reads itself in place. */
    if (p && p[tier] && p[tier] !== p[pageTier || 'advanced'] && p.advanced !== p.master) {
      root.location.href = p[tier] + (root.location.hash || '');
      return;
    }
    paint();
    root.dispatchEvent(new CustomEvent('tierchange', { detail: { tier } }));
  }

  /* Built here rather than in five HTML files, three of which are generated.
     It goes in the site bar on every page, before the nav, so the two controls
     that decide what you are looking at sit together. */
  function build() {
    const bar = document.querySelector('.sitebar');
    if (!bar) return;
    const wrap = document.createElement('div');
    wrap.className = 'tierswitch';
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', 'Technique tier');
    TIERS.forEach(t => {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.tier = t;
      b.textContent = t === 'advanced' ? 'Advanced' : 'Master';
      b.title = t === 'advanced'
        ? 'The nine patterns that break the Apple News+ challenging tier'
        : 'The tier above: uniqueness, finned fish, colouring, wings and chains';
      b.addEventListener('click', () => go(t));
      wrap.appendChild(b);
    });
    /* A phone cannot hold a wordmark, five destinations and a two-word
       segmented control on one line, and this bar is sticky, so a second line
       is charged to every screen of every puzzle. Below 560px the pair is
       replaced by one button that names the tier you are in and switches when
       pressed; above it, the pair, because a segmented control says what the
       alternative is without being pressed. */
    const flip = document.createElement('button');
    flip.type = 'button';
    flip.className = 'tierflip';
    flip.addEventListener('click', () => go(flip.dataset.other));
    wrap.appendChild(flip);
    const nav = bar.querySelector('nav');
    bar.insertBefore(wrap, nav);
  }

  build();
  paint();

  root.SudokuTier = {
    get: () => tier,
    set: go,
    is: t => tier === t,
    page: (name, t) => (PAGES[name] || {})[t || tier],
    /* The trainer and the check board ask this rather than reading the
       switch's DOM, so a page can be driven from a test without a click. */
    onChange: fn => root.addEventListener('tierchange', e => fn(e.detail.tier))
  };
})(typeof window !== 'undefined' ? window : globalThis);
