# Generates ../master-cheatsheet.html — the crib for the tier above the nine.
#
# Same page as cheatsheet.py, one tier up, with one deliberate difference: its
# figures are not hand-drawn. The Advanced crib carries nine schematics
# transcribed by hand from examples.json, which is affordable for nine shapes
# that fit in a glance and dishonest for nine chains — a hand-drawn chain is a
# chain nobody checked. So these come out of master-examples.json like the
# lesson page's, verified against their puzzles' own solutions before they were
# written down.
#
# The other difference is the WHY column. On the Advanced crib a card is a
# trigger and a deletion, because you already believe the technique. Up here
# the argument is the thing you forget mid-puzzle, so every card carries the
# one sentence that reconstructs it.
#
# Run:  python3 master_cheatsheet.py

import json
from master_data import TECH, ORDER
from masterfig import figure, killed
from mini import mini

EX = json.load(open("./master-examples.json"))


def example(key):
    got = EX["yes"].get(key) or []
    return got[0] if got else None


def card(t):
    inst = example(t["key"])
    fig = ""
    if inst:
        fig = '%s\n      <p class="figcap">%s</p>' % (
            mini(figure(inst, True)),
            ("<b>%s.</b> %s" % (inst["region"], killed(inst))) if inst["region"] else killed(inst))
    return '''
  <article class="card mcard" id="%(id)s">
    <div class="cardhead">
      <span class="eyebrow"><i>%(n)s</i> %(family)s</span>
      <h2><a href="master.html#%(id)s">%(title)s</a></h2>
    </div>
    <div class="cardfig">%(fig)s
    </div>
    <div class="cardbody">
      <p class="what">%(what)s</p>
      <dl class="kv">
        <dt>Look for</dt><dd>%(find)s</dd>
        <dt>Then delete</dt><dd>%(kill)s</dd>
        <dt>Because</dt><dd>%(why)s</dd>
      </dl>
      <p class="guard"><span>Where it goes wrong</span>%(guard)s</p>
    </div>
  </article>''' % dict(t, fig=fig)


CARDS = "".join(card(TECH[k]) for k in ORDER)

# The trigger table, read feature-first the way the Advanced crib's is: what you
# are looking at, and which of the nine it means.
TRIGGERS = [
    ("The same two marks on two cells of one line, twice over", "unique-rectangle",
     "Unique rectangle &mdash; count the boxes before you believe it"),
    ("Every square down to two marks except one", "bug",
     "BUG+1 &mdash; the odd square out takes the digit that appears three times"),
    ("A line with three spots where you wanted two", "finned-fish",
     "Finned X-Wing &mdash; if the extra sits in a corner's box, the fish still pays"),
    ("Two lines of two whose near ends share a box", "kite",
     "2-string kite &mdash; kill what sees both far ends"),
    ("A box whose spots fill one row and one column", "empty-rectangle",
     "Empty rectangle &mdash; cross it with a two-spot line"),
    ("One digit with two-spot units all over the grid", "colouring",
     "Colour the network &mdash; a repeated colour in a unit kills it outright"),
    ("The same pair of marks in two cells that are strangers", "w-wing",
     "W-Wing &mdash; look for a two-spot unit on one of the digits between them"),
    ("A run of two-mark cells sharing digits end to end", "xy-chain",
     "XY-chain &mdash; it pays if it comes back to the digit it started on"),
    ("Nothing above fires and the position is tight", "aic",
     "Build an AIC by hand &mdash; strong, weak, strong, and read the two ends"),
]

LOOP = [
    "Run the <a href=\"cheatsheet.html\">Advanced loop</a> to its end first. Every time.",
    "Circle the bi-value cells, then look for the same pair twice on a line &mdash; unique rectangle.",
    "Go back to the lines with three spots for a digit &mdash; finned X-Wing.",
    "From your list of two-spot lines: near ends in a box is a kite, a box filling one row and one column is an empty rectangle.",
    "Colour one digit's whole network. Repeat for the digit with the next most two-spot units.",
    "Matching pairs that are strangers &mdash; W-Wing. Then chain the bi-value cells &mdash; XY-chain.",
    "Only then build a chain by hand, and keep it to three links if you want to be able to check it.",
]

GLOSSARY = [
    ("Strong link", "A unit with exactly two homes for a digit, or a cell with exactly two candidates: <b>at least one is true</b>."),
    ("Weak link", "Two candidates that cannot both be true &mdash; same digit in one unit, or two digits in one cell."),
    ("Alternating chain", "Strong, weak, strong &hellip; starting and ending strong. It proves at least one end is true."),
    ("Fin", "A spot in a fish's base line outside the covering lines. Harmless if one box sees all of it."),
    ("Near end / far end", "In a kite, the two ends sharing a box, and the two that do not. The far ones do the work."),
    ("Colour", "One side of an alternating network. All true or all false, and you do not know which."),
    ("Deadly pattern", "Four cells on a rectangle in two boxes holding the same two candidates. A unique puzzle cannot contain one."),
    ("Grave (BUG)", "A position where every unsolved cell holds two candidates and every digit has two homes per unit. Its answers come in pairs."),
    ("Degrades safely", "What a technique does on a grid you have broken: finds nothing, rather than finding something wrong. Every technique here does except the two that reason from uniqueness."),
]

TRIG = "".join(
    '<li><span class="see">%s</span><span class="try">&rarr; <a href="#%s">%s</a></span></li>' % (see, aid, then)
    for see, aid, then in TRIGGERS)
LOOPLIS = "".join("<li>%s</li>" % s for s in LOOP)
GLOSS = "".join("<div><dt>%s</dt><dd>%s</dd></div>" % (t, d) for t, d in GLOSSARY)

HTML = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Master cheat sheet — Advanced Sudoku Techniques</title>
<meta name="description" content="The master tier on one page: what fires each technique, what it lets you delete, why it is true, and where it goes wrong.">
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
<body data-page="cheatsheet" data-tier="master">
<div class="crib">

  <div class="sitebar">
    <span class="mark"><span class="mark-long">Advanced Sudoku <em>Techniques</em></span><span class="mark-short">AST</span></span>
    <nav>
      <a data-page="patterns" href="master.html">Patterns</a>
      <a data-page="trainer" href="trainer.html">Trainer</a>
      <a data-page="cheatsheet" aria-current="page" href="master-cheatsheet.html">Cheat sheet</a>
      <a data-page="gallery" href="master-gallery.html">Gallery</a>
      <a data-page="check" href="check.html">Check</a>
    </nav>
  </div>

  <header class="cribhead">
    <p class="kicker">Master tier · crib notes</p>
    <h1>Nine more, <em>one page</em>.</h1>
    <p class="lede">The tier above the nine, reduced to what fires it, what it earns and — new on this page — <b>why it is true</b>. That last column is not decoration: an unfamiliar chain you cannot reconstruct is a chain you will not act on, and half of these are unfamiliar for a while. <a href="master.html">The lessons</a> are the long version; the <a href="cheatsheet.html">Advanced crib</a> is the one to keep open first, because everything on it still comes first.</p>
    <div class="legend cribleg">
      <p><span class="swatch b"></span> Amber cells are the pattern doing the work</p>
      <p><span class="swatch l"></span> Amber lines show how it connects</p>
      <p><span class="swatch p"></span> Ringed cells are ends, fins and wings</p>
      <p><span class="swatch k"></span> Struck red digits are what it kills</p>
      <p><span class="swatch n"></span> Grey is the rest of the position; a dot is a cell with more marks than fit</p>
    </div>
  </header>

  <div class="cards">{CARDS}
  </div>

  <section class="block cribblock" id="loop">
    <span class="eyebrow"><i>A</i> The loop</span>
    <h2>Where these go in the order</h2>
    <p>Nothing here is worth a minute while a pointing pair is unplayed. Restart at the top after any successful elimination — on this tier one deletion routinely re-opens the cheap techniques.</p>
    <ol class="order">{LOOPLIS}</ol>
  </section>

  <section class="block cribblock" id="triggers">
    <span class="eyebrow"><i>B</i> Diagnosis</span>
    <h2>Read the trigger, not the name</h2>
    <p>What you are looking at, and which of the nine it means. Ordered roughly by what the move costs you to find.</p>
    <ol class="triage">{TRIG}</ol>
    <p class="hint">If nothing fires, the likeliest explanations are still the cheap ones.<br>A missed pointing pair, a wrong digit, or an elimination you made by hand that was not sound.<br>Check those three before you go looking for a longer chain.</p>
  </section>

  <section class="block cribblock" id="glossary">
    <span class="eyebrow"><i>C</i> Vocabulary</span>
    <h2>Glossary</h2>
    <dl class="gloss">{GLOSS}</dl>
  </section>

  <section class="block cribblock" id="warning">
    <span class="eyebrow"><i>D</i> Honesty</span>
    <h2>Two of these trust the puzzle, not your grid</h2>
    <p>The unique rectangle and BUG+1 argue from the puzzle having exactly one answer. Every other technique on both tiers reads only what is in front of it, and finds nothing on a grid you have corrupted; these two keep working and hand you a confident wrong elimination instead. The trainer will not offer either unless the digits on your board still lead to a single solution — <a href="master.html#uniqueness">the long version is here</a>.</p>
  </section>

  <footer>
    <p>Every figure is a real position from a real puzzle, and every elimination shown was checked against that puzzle's solution before the figure was drawn — by <code>assets/js/master.js</code>, the same detectors the <a href="trainer.html">trainer</a> runs. Square references use <code>r5c3</code> for row 5, column 3.</p>
  </footer>

</div>
<script src="assets/js/tier.js"></script>
<script src="assets/js/pwa.js" defer></script>
</body>
</html>
'''

open("../master-cheatsheet.html", "w").write(HTML)
print("master-cheatsheet.html", len(HTML))
