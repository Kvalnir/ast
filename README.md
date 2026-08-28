# Advanced Sudoku Techniques

A three-page static site for getting past the wall in Apple News+ **Challenging** sudoku.

- **`index.html`** — the pattern reference. Nine patterns, each on a real position with real
  pencil marks, each with a scan routine, News+-specific guidance, and the common false positives.
- **`trainer.html`** — a live board that keeps the News+ reflexes and names the patterns available
  in your position, one hint level at a time. Thirty-two verified puzzles across four difficulties
  are built in, and you can **import the one you are actually stuck on** — by typing it, or by
  pasting 81 characters into a box that lays them out as a nine-by-nine grid so you can check them
  against the page.
- **`cheatsheet.html`** — the same nine patterns as a card grid: the trigger that fires each one,
  the deletion it earns, and where it goes wrong. The reference is what you read; this is what you
  keep open beside the puzzle. Each card links back to its full write-up, and its figures are
  miniatures of the same positions.

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
git add index.html trainer.html cheatsheet.html manifest.webmanifest sw.js assets tools \
        .githooks \
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
index.html              pattern reference (generated — see tools/)
trainer.html            interactive board
cheatsheet.html         one-page crib of the nine (generated — see tools/)
manifest.webmanifest    PWA metadata: name, icons, start URL
sw.js                   service worker — precache, offline, update prompt
assets/css/site.css     shared design tokens and all page styles
assets/js/core.js       units, peers, candidates, backtracking solver
assets/js/techniques.js the nine detectors, plus verify() — see "Two questions" below
assets/js/bank.js       32 verified puzzles, tagged by technique required
assets/js/import.js     read a puzzle off another screen: validate, derive, tag
assets/js/trainer.js    board UI, News+ behaviours, hint ladder, the two pads
assets/js/pwa.js        service worker registration, update and install prompts
assets/icons/*.png      app icons (generated — see tools/icons.py)
assets/icons/icon.svg   the same mark as vector, for the tab favicon (hand-written)
tools/                  Python generators (only needed to rebuild content)
```

Two things here have two sources of truth, and both are worth knowing about:

- `icon.svg` carries the same 24-unit geometry as `tools/icons.py`, because a nine-cell grid does
  not survive a 16px downsample and browsers that support SVG favicons should get the vector.
- The **difficulty tiers** are decided by `tier_of()` in `tools/bank.py`, which stocks the bank,
  and by `tierOf()` in `assets/js/trainer.js`, which tiers an imported puzzle by the same rule.
  Derived rather than read off the entry, so an import is tiered like a bank puzzle.

Edit each pair together or they drift.

## Installing it as an app

The site is a PWA, which matters here because a sudoku trainer is something you reach for on a
phone, on a train, without a signal. Open it, then **Add to Home Screen** (iOS Share menu) or take
the **Install** offer the site makes on Chromium browsers. It opens without browser chrome and
starts on the trainer; the reference and the cheat sheet are one tap away in the site bar, and all
three work with the network off.

Two things worth knowing:

- **Everything is precached on the first visit** — all three pages, the CSS, all six scripts and
  the seven icons: 18 files, 451 KB. There is no lazy loading to go wrong later.
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

**It keeps the News+ reflexes that matter.** Autofill, per-square Autocheck, notes in fixed 3×3
slots, and — importantly — notes cleared on entry *before* the entry is judged. Enter a wrong digit
and you will watch it get flagged **and** destroy a dozen notes, exactly as the app does. Undo
restores both. Practising on a board with different reflexes would be practising the wrong thing.

**The controls deliberately go further.** News+ has one keypad and a Pen/Notes switch, which is the
thing you are working around rather than a thing worth copying: it makes every press a question you
answer twice. So there are two pads, one job each — **notes on the left, digits on the right** — and
the tools between them. Both are 3×3 because the notes inside a square are laid out on the same 3×3
in the same order, which makes "the 7 is bottom-left" one fact rather than two.

With nothing selected, the right pad lights that digit across the board instead. That is the one
place the old rule survives, and it is what the focus square on a note means everywhere else.

**A selection is a set.** A tap moves it; adding takes something deliberate — the **multi** toggle
beside the left pad's caption, a held <kbd>Shift</kbd> or <kbd>Ctrl</kbd>, or a drag across the
board. One-square play still costs one tap, because writing a digit lets go of the selection. A
finger only drags while multi is on: claiming the gesture the rest of the time would mean the board
could not be scrolled past on a phone.

The pen writes into one square and refuses a multiple selection rather than obliging it — the same
digit in two selected squares is never a legal position, so obeying would only ever make a board to
undo. The left pad is the one that takes several at once.

**Three things the left pad can do**, chosen with the mode buttons and named in the caption above
the pad:

| Mode | The left pad | The right pad |
|------|--------------|---------------|
| **Cross off** | Strikes a note out. A real elimination — the coach reads notes *minus* crossed-off — but drawn rather than deleted, so crossing it again puts it back | Writes the digit |
| **Highlight** | Marks a note in violet, changing nothing about the position | Writes the digit |
| **Erase** | Removes the note outright | Takes back a digit you wrote and gives the square its notes again |

One press decides its direction from the whole selection: if every selected square already carries
the mark it comes off, otherwise it goes on. That is what makes a second press clear a highlight,
and it stops a mixed selection flickering half on and half off.

**Crossing off rather than deleting is the point of the split.** An elimination you can see is an
elimination you can check, argue with, and take back without unwinding history — and **Check my
notes** can tell you that you struck a true digit while it is still one press from being restored.
Automatic removal still deletes, because that is the board keeping itself rather than a deduction
of yours, and a grid wearing three dozen automatic cross-offs would bury the handful you made by
hand.

**The filled square means focus, and only focus.** A highlight is colour alone. The square has to
stay scannable across eighty-one of them, and putting one behind every highlight too makes the two
read as one signal — at which point the digit you are hunting stops jumping out of the grid.

**Autoclear**, on by default, fills any square whose notes have come down to one, then again for
whatever that forces, until the board stops moving. It reads *your* notes rather than the solution,
so a candidate you wrongly rubbed out gets written in and Autocheck marks it red where it lands;
the alternative is a helper that quietly knows better than you. The whole cascade sits inside the
snapshot of the entry that caused it, so it is one press of Undo.

**Clear the basics** plays out every single, pointing pair, claiming and subset from where you are
and stops at the first advanced pattern. It refuses rather than guesses: a wrong digit on the
board, or a note that has lost its true digit, stops it before it can prove a false single and
build on it.

**It is fully playable from the keyboard.**

| Key | Does |
|-----|------|
| <kbd>1</kbd>–<kbd>9</kbd> | Write the digit, or light it if no square is selected |
| <kbd>Shift</kbd>+<kbd>1</kbd>–<kbd>9</kbd> | The left pad's job instead — mark, cross off or erase the note |
| <kbd>←</kbd><kbd>↑</kbd><kbd>↓</kbd><kbd>→</kbd> | Move the selection (needs a square selected to start) |
| <kbd>Esc</kbd> | Drop the selection; again to leave Read the board |
| <kbd>Backspace</kbd> | Take back the digit and restore the square's notes |
| <kbd>N</kbd> | Cycle Cross off → Highlight → Erase |
| <kbd>M</kbd> | Select multiple on or off |
| <kbd>H</kbd> | Show me more — the next rung of the hint ladder |
| <kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Z</kbd> | Undo, notes and marks included |

<kbd>Shift</kbd> is read off `event.code` rather than `event.key`, because shift+5 arrives as `%`.

These belong to the board, and only to the board: while the caret is in a text field — the paste
box, most of all — every key is that field's, so an 81-character string types in whole.

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
where, or *Names + counts* to see how many of each. Knowing an X-Wing is on the board turns an
unbounded search into a bounded one, which is the whole problem; the counts tell you whether the
one you found is the only one. Clicking a technique picks it, and clicking it again walks to its
next instance.

**Notes arrive with the puzzle.** Autofill is still there for rebuilding them, but the board no
longer opens empty: the coach cannot read a position without notes, so starting blank only meant
the first thing you did on every puzzle was press the same key. **Difficulty** picks which of the
four tiers the next puzzle comes from — Easy needs nothing but singles, Normal adds pointing and
subsets, Challenging needs one advanced pattern, Extra needs two or more.

**Read the board** is the coach asked backwards. Turn it on, select the squares you think make a
pattern, and it says what they are — including a pattern read correctly that kills nothing, which
the coach itself can never mention because every detector past the singles drops a finding with no
eliminations. It also names what you nearly had: "there is an X-Wing on 6 here, but it also needs
r7c2". While it is on, clicking a technique chip draws its geometry rather than naming it — three
rungs of the ladder in one click, which is what the mode is for and why it is not what a chip does
the rest of the time.

**Drills** fast-forward a real puzzle to the exact position where one technique is the move —
everything cheaper already played. This is the fastest way to train the eye, because you get the
pattern in isolation without solving forty squares first.

**Check my notes** compares your candidates against the true solution and flags any square that has
lost its real digit. This is the one error News+ cannot catch: Autocheck validates answers and never
notes, so an elimination you made in error is invisible until the grid dies twenty moves later.

**Importing the puzzle you are stuck on** is the point of the whole thing: the thirty-two in the
bank are for practice, and the one beating you is on another screen. Press **Type in a puzzle** and the
board becomes the entry surface — tap a square, tap the printed digit, one tap each. There is a
paste box for the desktop case, and an imported puzzle rides in the URL (`trainer.html#p=…`), so
a link moves it between the phone and the desk.

You enter the givens and nothing else. The solution comes from the solver, the technique tags from
the coach's own detectors, and the level from those — an imported puzzle is a bank entry like any
other by the time it reaches the board, which is why every other feature works on it unchanged.

**The validation is the feature, not the chore.** Transcribing 25 digits off a phone goes wrong,
and a single misread digit yields a coach that talks confident nonsense for twenty moves. So the
grid has to be a real puzzle before it is allowed on the board, and the solver settles it: no
solution means a digit is wrong, more than one means a given is missing, exactly one is the
solution you get to keep. When it fails, every single-cell change is tried and the ones that would
make it a real puzzle are named — often a single square, and never the whole grid. The refusal
leaves the digits on the board with those squares marked, so the fix is one tap.

A note on what that search is *not*: asking which given, taken back out, lets the grid solve looks
equivalent and is worthless. On a contradictory grid it is true of nearly every given, because
dropping any constraint lets the wrong digit find a home — it names two dozen squares and means
nothing.

**Catch me up** plays every forced move from the printed digits and stops at the first advanced
pattern — the wall, which is where someone who is stuck already is. It runs from the givens rather
than from your board, so it is sound even if the position you typed has a wrong digit in it. Three
outcomes, and the middle one is the useful one: it stops at a pattern and the coach is on it; it
stalls short of 81 because the puzzle wants something past the nine patterns here; or it solves the
thing outright with nothing advanced needed — in which case what you are missing is not a pattern
but an entry that is wrong, and **Check my notes** with Autocheck will find it.

Imported puzzles are kept in `localStorage` — the puzzle, not the position, which is 81 characters
that survive anything. Restart already exists for getting back to the start of one.

## The cheat sheet

**It is a peer of the other two, not a subsection.** It has its own link in the site bar because it
is a thing you keep open beside the puzzle, the way the trainer is — the lesson is what you read
once, this is what you glance at. Patterns links to it from the hero and from the triage table, and
every card title links back to its own write-up.

**The figures are the same positions the lesson works through**, drawn small: same paper ground,
same amber pattern cells, same struck-red eliminations, same connecting lines from the same
coordinates. A card that showed a different position, or an elimination the lesson does not claim,
would quietly break the promise made at the top of this file — so the eliminations are taken from
`examples.json` and labelled with the digits each cell actually loses.

**Below the cards** sit the three things worth having on the same screen as them: the stall loop in
six moves, the trigger table read feature-first rather than name-first, and a glossary. There is no
JavaScript on the page at all.

**Uniqueness is a footnote, not a card** — see the note at the foot of Patterns, linked from the
glossary. The reasoning is in *Notes on scope* below.

## Rebuilding the content

Only needed if you want different puzzles or edited lesson text.

```bash
cd tools
python3 bank.py        # regenerate the puzzle bank (slow — it verifies uniqueness)
                       # 8 puzzles per tier; tier_of() decides which tier each lands in
python3 build.py       # regenerate ../index.html from template.html
python3 cheatsheet.py  # regenerate ../cheatsheet.html
```

`build.py` takes its prose from `template.html` and its figures from `examples.json`.
`cheatsheet.py` carries its own copy of the positions in the `TECH` table at the top of the file,
because its figures are schematic rather than rendered from a real grid. **The two describe the
same positions**, so if you change an example in `examples.json`, change the matching card. A
base cell or an elimination that disagrees between the two pages is the one bug neither generator
can catch for you.

`mini.py` is the small 9×9 figure, shared: `cheatsheet.py` draws one per card, `build.py` draws the
single uniqueness example at the foot of the lesson. One renderer, so the two pages cannot drift
into two dialects of the same picture. The uniqueness figure is the only one built by hand rather
than read out of a verified position — if you edit it, check it stays a legal deadly pattern: four
cells, two rows, two columns, and exactly two boxes.

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

Expected: `solved 32/32 assertions 2047 fails 0`.

The same snippet runs in a browser console on any page of the site, where `SudokuCore`,
`SudokuTech` and `SUDOKU_BANK` are already globals — drop the three `require` lines and read the
bank from `SUDOKU_BANK`. Useful when the machine in front of you has no node.

### Two questions, two code paths

`findAll` answers *what can I play here?* and every detector past the singles bails the moment a
pattern kills nothing, because a move that changes no candidate is not a move. `verify` — what
**Read the board** runs on — answers *am I reading these squares right?*, where a pattern that
kills nothing is still a pattern correctly read.

That is why it is a separate pass rather than a filter over `findAll`: an inspector built on
`findAll` would answer "nothing here" precisely when you had got it right and the pattern happened
to be sterile, which is the worst thing a confidence check can do. So `verify` tests shape alone
and counts the kills afterwards, and an empty kill list is a result rather than a rejection.

Checked the same way as the detectors — every finding in every banked puzzle, played to the wall,
each one handed back to `verify` as a bare set of cells, and then handed back again with its own
eliminations already applied so that it kills nothing:

```
shapes 33793   missed 0   still-named-when-sterile 19098   vanished 0
```

Nineteen thousand of those thirty-four thousand shapes are invisible to the coach. That is the
feature, not a rounding error.

## Notes on scope

The trainer detects naked and hidden singles, pointing pairs, claiming, naked pairs and triples,
hidden pairs and triples, X-Wing, swordfish, skyscraper and XY-Wing. That is comfortably enough for
the News+ challenging tier — every puzzle in the bank solves with them alone.

Chains beyond the skyscraper (colouring, kites, W-wings, forcing chains) are deliberately absent:
they are rarely the move at this tier, and adding them would let the coach answer positions you
should be solving with something cheaper.

Uniqueness (the unique rectangle, BUG+1) is documented as a footnote at the foot of the lesson and
deliberately not detected. It is never needed here, and it is the one argument on the site that
reasons from the puzzle having a single solution rather than from the grid in front of you. Every
detector above degrades safely on a grid the player has corrupted — it finds nothing, or it
contradicts itself. A uniqueness detector would keep working and name a confident, wrong
elimination, on the exact failure mode the News+ section spends its length warning about. If you
ever add one, gate it on the position still being solvable.

## Words

Three words, three jobs, and the site is consistent about them — worth keeping that way, because
they are near-synonyms in ordinary sudoku writing and drift is invisible until someone reads two
pages in a row.

- **Pattern** — the configuration on the board, and the site's countable noun for the nine.
  *Nine patterns, the pattern doing the work, pattern cells.* The default; when in doubt, use it.
- **Technique** — the named method you apply, as a method: the drills, the coach ladder, the
  detectors in `techniques.js`.
- **Shape** is not used as a synonym for either. It was — in the hero, the figure captions and the
  cheat sheet's title — and the pages ended up disagreeing about what to call the same thing.
