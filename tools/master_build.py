# Generates ../master.html — the lesson page for the tier above the nine.
#
# Same job as build.py does for index.html, and deliberately shorter. The
# Advanced page has to teach someone who has never deliberately eliminated a
# candidate; this one is written for a reader who has already broken the
# News+ challenging tier with the nine, so it spends its length on the ONE
# thing that tier does not need and this one cannot do without: why each of
# these is true. A chain you cannot reconstruct at the board is a chain you
# will not trust enough to delete anything with.
#
# Prose lives in master_data.py, shared with the crib and the drill. Figures
# come from master-examples.json by way of masterfig.py — real positions from
# real puzzles, every elimination checked against the puzzle's own solution
# before it was written down. Nothing on this page is drawn by hand.
#
# Run:  python3 master_build.py

import json
import master_data
from master_data import TECH, ORDER
from masterfig import figure, killed, cellname
from mini import mini

EX = json.load(open("./master-examples.json"))


def example(key, n=0):
    got = EX["yes"].get(key) or []
    return got[n] if len(got) > n else None


def fig_html(inst, t):
    """The caption says WHERE and WHAT DIES, in the width a 216px figure has.
       The argument on this particular position is prose, so it goes in the
       body beside the general one rather than under the picture."""
    kills = killed(inst)
    return '''
      <figure class="mfig">
        %s
        <figcaption class="figcap"><b>%s.</b>%s</figcaption>
      </figure>''' % (mini(figure(inst, True)), inst["region"] or t["title"],
                      (" " + kills) if kills else "")


def section(t):
    inst = example(t["key"])
    fig = fig_html(inst, t) if inst else ""
    case = ('<p class="mcase"><span>On the board beside this</span>%s</p>' % inst["why"]) if inst and inst["why"] else ""
    return '''
<section class="block mblock" id="%(id)s">
  <span class="eyebrow"><i>%(n)s</i> %(family)s</span>
  <h2>%(title)s</h2>
  <p class="mwhat">%(what)s</p>
  <div class="mrow">%(fig)s
    <div class="mbody">
      <p class="mwhy">%(why)s</p>
      %(case)s
      <dl class="kv">
        <dt>Find it</dt><dd>%(find)s</dd>
        <dt>Then delete</dt><dd>%(kill)s</dd>
      </dl>
      <p class="guard"><span>Where it goes wrong</span>%(guard)s</p>
      <p class="mcost">%(cost)s</p>
    </div>
  </div>
</section>''' % dict(t, fig=fig, case=case)


NAV = "".join('<a href="#%s">%s</a>' % (TECH[k]["id"], TECH[k]["title"]) for k in ORDER)
SECTIONS = "".join(section(TECH[k]) for k in ORDER)

PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Master techniques — Advanced Sudoku Techniques</title>
<meta name="description" content="The tier above the nine: unique rectangles, BUG+1, finned fish, kites, empty rectangles, colouring, W-Wings, XY-chains and the alternating inference chain that generates them all.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400;12..96,75..100,700;12..96,75..100,800&family=Instrument+Sans:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<link rel="manifest" href="manifest.webmanifest">
<meta name="theme-color" content="#0A1014">
<link rel="icon" href="assets/icons/icon.svg" type="image/svg+xml">
<link rel="icon" href="assets/icons/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="assets/icons/apple-touch-icon.png">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="AST">
<link rel="stylesheet" href="assets/css/site.css">
</head>
<body data-page="patterns" data-tier="master">
<div class="wrap">

<div class="sitebar">
    <span class="mark"><span class="mark-long">Advanced Sudoku <em>Techniques</em></span><span class="mark-short">AST</span></span>
    <nav>
      <a data-page="patterns" aria-current="page" href="master.html">Patterns</a>
      <a data-page="trainer" href="trainer.html">Trainer</a>
      <a data-page="cheatsheet" href="master-cheatsheet.html">Cheat sheet</a>
      <a data-page="gallery" href="master-gallery.html">Gallery</a>
      <a data-page="check" href="check.html">Check</a>
    </nav>
  </div>

  <header class="hero">
  <p class="kicker">Master tier · beyond the News+ challenging grid</p>
  <h1>Nine more, and really <em>one idea</em>.</h1>
  <p class="lede">The nine on the <a href="index.html" style="color:var(--amber)">Advanced tier</a> will take you through every Apple News+ challenging puzzle and most of what an app calls expert. Past that — Good Sudoku's hardest, the extreme end of any generator — a puzzle will occasionally hold exactly one move that none of them can find. These are those moves. There are nine of them here too, and seven are the same idea wearing different geometry.</p>
  <p class="lede">That idea is the <b>strong link</b>: a unit where a digit has exactly two possible squares, so one of them is true. You already use it — the skyscraper is two strong links sharing an end. A kite is two whose near ends share a box. Colouring is the whole network of them at once. A W-Wing is one link between two identical pairs. An AIC is the general form, and it produces all of the others as special cases. Learn the primitive properly and the names stop being nine things to remember.</p>
  <p class="lede" style="margin-bottom:20px">The other two are different in kind: the <a href="#unique-rectangle" style="color:var(--amber)">unique rectangle</a> and <a href="#bug" style="color:var(--amber)">BUG+1</a> reason from the puzzle having exactly one answer rather than from the grid in front of you. They are cheap, they fire often, and they are the only techniques on this site that can be confidently wrong on a grid you have already broken. There is a section on that below, and the trainer refuses to offer either one unless your board still leads to a single solution.</p>
  <div class="legend">
    <p><span class="swatch b"></span> Amber cells are the pattern doing the work</p>
    <p><span class="swatch l"></span> Amber lines show how the pattern connects</p>
    <p><span class="swatch p"></span> Ringed cells are the ends, fins or wings</p>
    <p><span class="swatch k"></span> Struck red digits are the candidates it kills</p>
  </div>
</header>

<nav aria-label="Techniques">%(nav)s</nav>

<section class="block mblock" id="links">
  <span class="eyebrow"><i>10</i> Groundwork</span>
  <h2>Strong links, weak links, and what a chain is</h2>
  <p>Two sentences hold the whole tier up, and they are worth being able to say exactly.</p>
  <ul>
    <li><b>A strong link</b> joins two candidates where <i>at least one is true</i>. Two of them: a unit with exactly two homes for a digit, and a cell with exactly two candidates. Both are things you can count, and counting them is the entire skill.</li>
    <li><b>A weak link</b> joins two candidates where <i>at most one is true</i>. Two cells in a unit holding the same digit; two digits in one cell. These are free — they are just what a sudoku grid is.</li>
  </ul>
  <p>Alternate them, starting and ending on a strong one, and you have a chain that proves <b>at least one of its two ends is true</b>. That single sentence is the whole of the <a href="#aic">AIC</a>, and every named pattern below is one particular short chain that people found often enough to give a name to. You do not have to think of them that way to use them — but when a position refuses all nine, thinking of them that way is what lets you build the tenth yourself.</p>
  <h3>What this changes about scanning</h3>
  <p>On the Advanced tier the scan is <i>where can this digit go</i>. Up here it is <i>which lines have exactly two spots</i> — a different question about the same board, and one you can answer while you are already counting for X-Wings. Write the two-spot lines down as you find them. Half the techniques below are two entries from that list, held up next to each other.</p>
</section>
%(sections)s

<section class="block mblock" id="uniqueness">
  <span class="eyebrow"><i>20</i> Honesty</span>
  <h2>The two that trust the puzzle</h2>
  <p>Every other technique on this site — both tiers — reasons only from the grid in front of you. Give one a position you have corrupted with a wrong digit or a mistaken elimination and it finds nothing, or it finds something that contradicts something else, and you discover the mistake. That is a property worth naming: they <b>degrade safely</b>.</p>
  <p>The unique rectangle and BUG+1 do not. They reason from the puzzle having exactly one solution, which is a fact about the puzzle rather than about your marks, and it stays true no matter how badly you have mangled the grid. So they keep working after you have made an error, and what they produce is a confident, specific, wrong elimination — on exactly the failure mode this site spends its length warning about.</p>
  <p>Two things follow, and they are why these two are here at all rather than left out as they are on the Advanced tier:</p>
  <ul>
    <li><b>The trainer gates them.</b> Neither is offered unless the digits currently on your board still lead to exactly one solution. That catches a wrong digit outright. It cannot catch a candidate you struck by mistake, because nothing can — your notes are your own claim about the position.</li>
    <li><b>Use them where the puzzle is guaranteed.</b> An app-generated puzzle has one answer by construction, and an app that checks your entries as you go removes the other half of the risk. On a printed grid of unknown provenance, or one you have been fighting for an hour, treat them as the last thing you reach for rather than the first.</li>
  </ul>
  <p>The <a href="index.html#uniqueness">note at the foot of the Advanced page</a> says the same thing from the other side, and explains why the deadly pattern is a footnote there and a technique here.</p>
</section>

<section class="block mblock" id="order">
  <span class="eyebrow"><i>21</i> Method</span>
  <h2>The order to attack in, master edition</h2>
  <p>The Advanced loop still runs first, all of it, every time. Nothing here is worth a minute of your attention while a pointing pair is unplayed — and on this tier the overwhelmingly likely explanation for a stall is still a missed cheap move or a wrong digit several steps back.</p>
  <ol class="order">
    <li>Run the <a href="index.html#order">Advanced order</a> to its end: singles, locked candidates, subsets, X-Wing, skyscraper, swordfish, XY-Wing.</li>
    <li><b>Unique rectangle.</b> Free to spot if your bi-value cells are circled — you are looking for the same pair twice on one line.</li>
    <li><b>Finned X-Wing.</b> You already counted the lines; now go back to the ones with three spots.</li>
    <li><b>Kite, then empty rectangle.</b> Both come off the list of two-spot lines you built during the fish scan.</li>
    <li><b>Colouring</b>, one digit at a time, starting with whichever digit has the most two-spot units.</li>
    <li><b>W-Wing</b>, then <b>XY-chain</b>, both starting from the bi-value cells.</li>
    <li><b>AIC</b>, built by hand from wherever the position looks tightest. If you have got this far, expect one or two links, not six.</li>
    <li><b>BUG+1</b> is not on this list because you do not hunt it. You notice it, late, when every square is down to two.</li>
  </ol>
  <h3>What comes after these</h3>
  <p>Almost nothing you will need. The next tier up is about <b>sets</b> rather than chains — almost locked sets, Sue de Coq, death blossom — and then about search: forcing chains, Nishio, and eventually just trying a digit and seeing what breaks. They are deliberately absent here for the same reason the Advanced page stops where it does: at the point where a technique is rarer than the mistake you would make trying to spot it, it costs you more than it pays.</p>
  <p>If a puzzle beats every technique on both pages, the honest possibilities are, in order: a missed cheap move, a wrong digit, an elimination you made by hand that was not sound, or a puzzle that genuinely needs a search. The first three cover almost all of it.</p>
</section>

<footer>
  <p>Every position on this page is a real state of a real puzzle with a unique solution, and every elimination shown has been checked against that solution — by the same detectors the <a href="trainer.html">trainer</a> runs, which is where these are worth practising. Square references use <code>r5c3</code> for row 5, column 3. The nine that come before these are on the <a href="index.html">Advanced tier</a>.</p>
</footer>

</div>
<script src="assets/js/tier.js"></script>
<script src="assets/js/pwa.js" defer></script>
</body>
</html>
''' % dict(nav=NAV, sections=SECTIONS)

open("../master.html", "w").write(PAGE)
print("master.html", len(PAGE), "bytes")
missing = [k for k in ORDER if not example(TECH[k]["key"])]
if missing:
    print("  no example harvested for:", ", ".join(missing))
