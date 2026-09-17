# Working on this repo

Static site, no build step, served from `main` at kvalnir.github.io/ast/. The README is the
long version; these are the rules that bite if you skip them.

## Before you push

- **Bump `VERSION` in `sw.js`** whenever any precached file changes (every page, `site.css`,
  every script, the icons). Nothing does it for you; without it returning visitors keep the old
  files. One-line comment on what changed.
- **Run the PII hook by hand** — `bash .githooks/pre-commit` after staging. `core.hooksPath` is
  local config and is not set in every clone, so the hook that guards this public repo may not
  fire on its own.
- **`git add` named paths, never `-A`.** Under WSL the root picks up dotfiles that must not be
  published. `.gitignore` covers the known ones; a blanket add is the wrong habit here.
- **Push to `main`.** That push is the deploy and the only way the site can be tested for real.
  No feature branches.

## Generated pages

`index.html`, `cheatsheet.html`, `gallery.html`, `master.html`, `master-cheatsheet.html` and
`master-gallery.html` are **outputs of `tools/*.py`**. Edit the generator (or `tools/template.html`,
`tools/master_data.py`) and regenerate — a hand edit to the page is reverted the next time
anyone runs the script. All six are seeded and deterministic; the whole set rebuilds in under
ten seconds from `tools/`. Check that the committed page matches its generator before and
after: regenerate into a scratch copy and `diff`.

`tools/bank.py` **regenerates the puzzle bank the moment it runs** — no arguments, no dry run,
minutes of uniqueness checking. Do not invoke it unless the bank is meant to change. It writes
only at the end, so a killed run leaves `bank.json` intact.

## Where things are decided once

- **Technique names**: `SudokuTech.NAME` and `SudokuMaster.NAME` in the JS; `build.py`,
  `cheatsheet.py`, `master_data.py` on the Python side. A rename is one edit per side.
- **Difficulty tiers**: `tier_of()` in `tools/bank.py` and `tierOf()` in `assets/js/trainer.js`
  are the same rule twice. Change both.
- **Connector colours**: `lines()` in `tools/mini.py` and `lineColours()` in `assets/js/core.js`.
- **Icon geometry**: `tools/icons.py` and `assets/icons/icon.svg`.
- **Prose for the master tier**: `tools/master_data.py`, shared by three pages.

## Layout constants that were measured, not derived

`.tplay` (trainer) and `.check .tplay` (check page) in `site.css` size the board against the
viewport height with a constant that was measured in a browser at a 900px window. If anything
in that column changes height — the standfirst, the hint line, the pads, the tools — re-measure:
the column's bottom should land just above the viewport bottom. Over, and `position:sticky`
stops working; short, and the board is smaller than it could be.

The entry text on the trainer and the check board is one sentence on purpose: every line of
prose above the board is a line taken from the grid on every visit, on every phone.

## Verifying

No node on the usual machine. The engine checks in the README run unchanged in a browser
console on any page of the site (`SudokuCore`, `SudokuTech`, `SudokuMaster`, `SUDOKU_BANK` are
globals). Expected: `solved 32/32 assertions 2047 fails 0`.

The gitignored `dev/` directory may hold a headless-Chromium harness (`dev/scripts/dev-browser.sh`)
for screenshots and `eval`; git will never show it, so look before assuming there is no way to
render a page. Its service worker serves assets cache-first, so the first shot after an edit is
the previous build — take two.

## Words

**Pattern** is the configuration on the board and the countable noun for the nine. **Technique**
is the named method. **Shape** is not a synonym for either. The README's *Words* section has the
reasoning; the pages are consistent about this and should stay so.
