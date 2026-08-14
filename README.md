# Advanced Sudoku Techniques

A two-page static site for getting past the wall in Apple News+ **Challenging** sudoku.

- **`index.html`** — the pattern reference. Nine patterns, each on a real position with real
  pencil marks, each with a scan routine, News+-specific guidance, and the common false positives.
- **`trainer.html`** — a live board that behaves like News+ and names the techniques available in
  your position, one hint level at a time.

Every position shown, and every elimination claimed, is verified against the puzzle's unique
solution — nothing here is hand-waved.

## Deploying to GitHub Pages

This repo is <https://github.com/Kvalnir/ast>, served at <https://kvalnir.github.io/ast/>.

Working from a fresh clone, do this once — `core.hooksPath` is local config and does **not**
clone, so the PII pre-commit hook is inert until you set it:

```bash
git config core.hooksPath .githooks
```

Setting a new copy up from scratch:

```bash
git init
git add index.html trainer.html manifest.webmanifest sw.js assets tools .githooks \
        .gitignore .nojekyll README.md
git commit -m "Sudoku pattern trainer"
git branch -M main
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

Name the paths rather than reaching for `git add -A`. On WSL this directory picks up
character-special dotfiles (`.bashrc`, `.gitconfig`, `.mcp.json`, `.claude/` and friends) that
have no business in a public repo; `.gitignore` covers the ones seen so far, but a blanket add is
the wrong habit for a repo whose source is world-readable.

Then **Settings → Pages → Source: Deploy from a branch → `main` / `/ (root)`**.

The site is live a minute or two later. No build step, no dependencies, nothing to install — it is
static files and vanilla JS. `.nojekyll` is present so Pages serves the `assets/` directory
untouched.

## Layout

```
index.html              technique reference (generated — see tools/)
trainer.html            interactive board
manifest.webmanifest    PWA metadata: name, icons, start URL
sw.js                   service worker — precache, offline, update prompt
assets/css/site.css     shared design tokens and all page styles
assets/js/core.js       units, peers, candidates, backtracking solver
assets/js/techniques.js the nine detectors; returns structured findings
assets/js/bank.js       20 verified puzzles, tagged by technique required
assets/js/trainer.js    board UI, News+ behaviours, hint ladder
assets/js/pwa.js        service worker registration, update and install prompts
assets/icons/*.png      app icons (generated — see tools/icons.py)
assets/icons/icon.svg   the same mark as vector, for the tab favicon (hand-written)
tools/                  Python generators (only needed to rebuild content)
```

`icon.svg` is the one asset with two sources of truth: it carries the same 24-unit geometry as
`tools/icons.py`, because a nine-cell grid does not survive a 16px downsample and browsers that
support SVG favicons should get the vector. Edit the two together or they drift.

## Installing it as an app

The site is a PWA, which matters here because a sudoku trainer is something you reach for on a
phone, on a train, without a signal. Open it, then **Add to Home Screen** (iOS Share menu) or take
the **Install** offer the site makes on Chromium browsers. It opens without browser chrome and
starts on the trainer; the technique reference is one tap away in the site bar, and both work with
the network off.

Two things worth knowing:

- **Everything is precached on the first visit** — both pages, the CSS, all five scripts and the
  seven icons: 16 files, 309 KB. There is no lazy loading to go wrong later.
- **Fonts arrive one visit late.** They come from Google Fonts, and on a first visit the page has
  already requested them before the worker takes control, so they are only cached from the second
  visit onwards. Until then an offline load falls back to the system stack — the layout holds, the
  type is just plainer.

**When you change a precached file, bump `VERSION` in `sw.js`.** The precache is keyed on that
string, and nothing here bumps it for you. On the next visit a returning visitor gets a small
"a new version of the site is ready" bar and the new worker waits until they accept it — an update
never swaps the code out from under a puzzle in progress.

Service workers need a secure context: `https`, or `localhost`. Opening the files with `file://`
gives you the plain site with no offline support, which is a fine way to work on everything else.
To exercise the PWA locally, serve the directory instead:

```bash
python3 -m http.server 8123
```

## The trainer

**It behaves like News+ on purpose.** Pen and Notes modes, Autofill, per-square Autocheck, notes
in fixed 3×3 slots, and — importantly — notes cleared on entry *before* the entry is judged. Enter
a wrong digit and you will watch it get flagged **and** destroy a dozen notes, exactly as the app
does. Undo restores both; the eraser would not. Practising on a board with different reflexes
would be practising the wrong thing.

**One keypad, and the selection decides what it does.** A square is selected, so a digit goes into
it — placed in Pen, toggled as a note in Notes. Nothing is selected, so the same key lights that
digit everywhere instead, notes included. The pad is 3×3 because the notes inside a square are laid
out on the same 3×3 in the same order, which makes "the 7 is bottom-left" one fact rather than two.

Getting to the second mode is a matter of letting go of the square: click the selected one again,
or press <kbd>Esc</kbd>. Placing a digit releases it for you, so the digit you just entered is lit
across the board without your asking. The line under the pad always says which of the two the next
tap will be.

**It is fully playable from the keyboard.**

| Key | Does |
|-----|------|
| <kbd>1</kbd>–<kbd>9</kbd> | Enter the digit, or light it if no square is selected — the same rule as the pad |
| <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> | Move the selection (needs a square selected to start) |
| <kbd>Esc</kbd> | Let go of the square |
| <kbd>Backspace</kbd> | Erase the square |
| <kbd>N</kbd> | Switch between Pen and Notes |
| <kbd>H</kbd> | Show me more — the next rung of the hint ladder |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd> | Undo, notes included |

**The coach is a ladder, not an answer.** Findings escalate only as far as you ask:

| Level | What you get |
|-------|--------------|
| 0 | Cheapest move available, by name. Advanced patterns also present, listed separately. |
| 1 | Which technique, and on which digit |
| 2 | Which unit to look in — tinted on the board |
| 3 | The pattern squares, in amber, with the connecting geometry drawn over them |
| 4 | The candidates it kills, struck in red |
| 5 | Why it works, linked to the full write-up |

Set **Coach** to *Off* to hunt unaided, *Names only* to know a technique exists without knowing
where, or *Names + counts* to see how many of each. *Names only* is the useful default: knowing an
X-Wing is on the board turns an unbounded search into a bounded one, which is the whole problem.

**Drills** fast-forward a real puzzle to the exact position where one technique is the move —
everything cheaper already played. This is the fastest way to train the eye, because you get the
pattern in isolation without solving forty squares first.

**Check my notes** compares your candidates against the true solution and flags any square that has
lost its real digit. This is the one error News+ cannot catch: Autocheck validates answers and never
notes, so an elimination you made in error is invisible until the grid dies twenty moves later.

## Rebuilding the content

Only needed if you want different puzzles or edited lesson text.

```bash
cd tools
python3 bank.py     # regenerate the puzzle bank (slow — it verifies uniqueness)
python3 build.py    # regenerate ../index.html from template.html
```

`bank.py` emits `bank.json`; convert it to `assets/js/bank.js` with:

```bash
python3 -c "import json;print('window.SUDOKU_BANK = '+json.dumps(json.load(open('bank.json')),separators=(',',':'))+';')" > ../assets/js/bank.js
```

## Verifying the engine

The detectors are checked by solving every banked puzzle using only their own findings and
asserting each deduction against the known solution:

```bash
node -e "
global.window=global;
require('./assets/js/core.js'); require('./assets/js/techniques.js');
const bank=require('./tools/bank.json'), C=SudokuCore, T=SudokuTech;
let fails=0, checked=0, solved=0;
for (const b of bank) {
  const g=C.parse(b.p), sol=C.parse(b.s); let notes=C.baseCandidates(g);
  for (let s=0;s<400;s++){
    const {findings}=T.findAll(g,notes); if(!findings.length) break;
    const f=findings[0];
    for(const e of f.elims){checked++; if(sol[e.cell]===e.digit) fails++;}
    if(f.placement){checked++; if(sol[f.placement.cell]!==f.placement.digit) fails++;
      g[f.placement.cell]=f.placement.digit; notes[f.placement.cell]=new Set();
      C.PEERS[f.placement.cell].forEach(p=>notes[p].delete(f.placement.digit));
    } else f.elims.forEach(e=>notes[e.cell].delete(e.digit));
    if(g.every(x=>x)){solved++;break;}
  }
}
console.log('solved',solved+'/'+bank.length,'assertions',checked,'fails',fails);
"
```

Expected: `solved 20/20 assertions 1384 fails 0`.

## Notes on scope

The trainer detects naked and hidden singles, pointing pairs, claiming, naked pairs and triples,
hidden pairs and triples, X-Wing, swordfish, skyscraper and XY-Wing. That is comfortably enough for
the News+ challenging tier — every puzzle in the bank solves with them alone. Chains beyond the
skyscraper (colouring, kites, W-wings, forcing chains) are deliberately absent: they are rarely the
move at this tier, and adding them would let the coach answer positions you should be solving with
something cheaper.
