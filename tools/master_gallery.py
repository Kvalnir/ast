# Generates ../master-gallery.html — the recognition drill for the master tier.
#
# Same page as gallery.py one tier up, and the same bargain: nine figures per
# technique, six real and three that are not, shuffled, with the answer hidden
# until you tap. What changes is where the positions come from — the harvest in
# tools/harvest-master.js rather than a second Python engine — and what the
# figures show. A chain is an argument about a handful of squares, so a chain's
# figure draws those squares and nothing else; a single-digit technique is
# hunted on the digit's whole map, so its figure draws the map.
#
# BUG+1 has no section here on purpose. It is a claim about every unsolved
# square at once, and a fair figure of it is sixty dots — there is nothing to
# recognise and nothing to get wrong. It is taught on the lesson page and
# detected in the trainer, and this page says so rather than inventing an
# exercise for it.
#
# Run:  python3 master_gallery.py

import json
import random
from master_data import TECH, ORDER
from masterfig import figure, killed, cold_cap
from mini import mini

EX = json.load(open("./master-examples.json"))
SKIP = {"bug"}
SHOWN = [k for k in ORDER if TECH[k]["key"] not in SKIP]


def spot_html(inst, ok):
    cold = cold_cap(inst)
    if ok:
        kills = killed(inst)
        warm = '<b>Yes.</b> ' + (inst["why"] or "") + ((' <b>' + kills + '</b>') if kills else '')
    else:
        miss = inst["miss"] or "it fails one of the conditions."
        warm = '<b>No.</b> ' + miss[0].upper() + miss[1:] + '.'
    return ('<figure class="spot" data-state="hidden">'
            '<button class="spotbtn" type="button" aria-expanded="false" '
            'aria-label="Show the answer for this position: %s">%s</button>'
            '<figcaption class="figcap"><span class="cold">%s</span>'
            '<span class="warm %s">%s</span></figcaption></figure>'
            % (cold, mini(figure(inst, ok)), cold, "yes" if ok else "no", warm))


def section_html(t, figs):
    spots = "".join(spot_html(inst, ok) for inst, ok in figs)
    return '''
  <section class="galsec" id="%s">
    <div class="galintro">
      <span class="eyebrow"><i>%s</i> %s</span>
      <h2><a href="master.html#%s">%s</a></h2>
      <p class="what">%s</p>
      <p class="guard"><span>Where it goes wrong</span>%s</p>
      <button class="reveal galall" type="button">Show all nine</button>
    </div>
    <div class="spots">%s</div>
  </section>''' % (t["id"], t["n"], t["family"], t["id"], t["title"], t["what"], t["guard"], spots)


BUG_SECTION = '''
  <section class="galsec" id="bug">
    <div class="galintro">
      <span class="eyebrow"><i>12</i> Uniqueness</span>
      <h2><a href="master.html#bug">BUG+1</a></h2>
      <p class="what">%s</p>
      <p class="guard"><span>Why there is no drill here</span>BUG+1 is not a shape and cannot be
        made into one. It is a statement about <b>every unsolved square at once</b> — all of them
        down to two marks except a single square with three — so a fair figure of it is sixty dots
        and one number, and there is nothing in it to recognise or to get wrong. You will notice
        the position or you will not.</p>
      <a class="reveal" href="master.html#bug">Read it on the lesson page</a>
    </div>
    <div class="spots galnone">
      <p>What to do instead: when a hard puzzle thins out and every square you look at is down to
      two marks, stop and count. One square with three is the whole trigger. The
      <a href="trainer.html">trainer</a> checks for it on every move of the Master tier, and it will
      not offer it unless the digits on your board still lead to exactly one answer.</p>
    </div>
  </section>''' % TECH["bug"]["what"]


def build(seed=20260909, positives=6, misses=3):
    rng = random.Random(seed)
    sections, report = [], []
    for k in ORDER:
        t = TECH[k]
        if t["key"] in SKIP:
            sections.append(BUG_SECTION)
            continue
        yes = EX["yes"].get(t["key"]) or []
        no = EX["no"].get(t["key"]) or []
        if len(yes) < positives or len(no) < misses:
            raise SystemExit("%s: harvested %d real and %d near misses; need %d and %d"
                             % (t["key"], len(yes), len(no), positives, misses))
        figs = [(i, True) for i in yes[:positives]] + [(i, False) for i in no[:misses]]
        rng.shuffle(figs)
        sections.append(section_html(t, figs))
        report.append("  %-13s %d real, %d near" % (t["key"], positives, misses))
    nav = "".join('<a href="#%s">%s</a>' % (TECH[k]["id"], TECH[k]["title"]) for k in ORDER)
    out = PAGE % (nav, "".join(sections))
    open("../master-gallery.html", "w").write(out)
    print("master-gallery.html", len(out), "bytes")
    print("\n".join(report))


PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Master gallery — Advanced Sudoku Techniques</title>
<meta name="description" content="Nine positions per master technique — six real, three near misses — with the answer hidden until you ask. Recognition practice for chains, fins, kites and colouring.">
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
<noscript><style>.spot .warm{display:block}.spot .cold{display:none}.spotbtn{cursor:default}
.spot .mini i.b{background:#F5DFA4;color:var(--amber-ink)}
.spot .mini i.x{background:rgba(226,84,63,.20);color:var(--red-ink);text-decoration:line-through}
.spot .geo3{display:block}</style></noscript>
</head>
<body data-page="gallery" data-tier="master">
<div class="gal">

  <div class="sitebar">
    <span class="mark"><span class="mark-long">Advanced Sudoku <em>Techniques</em></span><span class="mark-short">AST</span></span>
    <nav>
      <a data-page="patterns" href="master.html">Patterns</a>
      <a data-page="trainer" href="trainer.html">Trainer</a>
      <a data-page="cheatsheet" href="master-cheatsheet.html">Cheat sheet</a>
      <a data-page="gallery" aria-current="page" href="master-gallery.html">Gallery</a>
      <a data-page="check" href="check.html">Check</a>
    </nav>
  </div>

  <header class="galhero">
    <p class="kicker">Master tier · recognition drill</p>
    <h1>Nine of each. <em>Three are lying.</em></h1>
    <p class="lede">The same drill as the <a href="gallery.html">Advanced gallery</a>, one tier up, and harder in a particular way: on this tier the near misses are not sloppy readings, they are <b>sound readings of the wrong thing</b> — a rectangle that cannot swap, fins in two boxes, a chain that comes back on the wrong digit, a colouring that is perfectly correct and kills nothing. Six of each nine are real. Read the figure, decide, then tap it.</p>
    <p class="lede">Two kinds of figure. A single-digit technique — fins, kites, empty rectangles, colouring — is hunted on one digit's whole map, so that is what its figures show, the way the News+ highlight does. A chain is an argument about a handful of squares, so a chain's figure draws those squares and their marks and nothing else: the question is whether the links hold, not whether you can find them.</p>
    <div class="legend cribleg">
      <p><span class="swatch b"></span> Amber cells are the pattern you were asked about</p>
      <p><span class="swatch l"></span> Amber lines show how it connects</p>
      <p><span class="swatch p"></span> Ringed cells are ends, fins and wings</p>
      <p><span class="swatch k"></span> Struck red digits are what it kills</p>
      <p><span class="swatch f"></span> A red ring is the mark that breaks it</p>
      <p><span class="swatch n"></span> Grey is the rest of the position; a dot is a cell with more marks than fit</p>
    </div>
    <p class="galnote">Positions are real states of real puzzles, and every elimination claimed was checked against the puzzle's own solution before the figure was drawn — by <code>assets/js/master.js</code>, the detectors the trainer runs. See <code>tools/harvest-master.js</code>.</p>
  </header>

<nav aria-label="Techniques">%s</nav>
%s

  <footer>
    <p>Cover the captions, work a row of nine, and only then check. When the shape you are unsure about is one you are actually looking at rather than one of these, the <a href="check.html">pattern check</a> audits it condition by condition — and on this tier most of what it reports is a count only your own grid can settle. Square references use <code>r5c3</code> for row 5, column 3.</p>
  </footer>

</div>
<script>
document.querySelectorAll(".spot").forEach(function (sp) {
  var btn = sp.querySelector(".spotbtn");
  btn.addEventListener("click", function () {
    var shown = sp.getAttribute("data-state") === "shown";
    sp.setAttribute("data-state", shown ? "hidden" : "shown");
    btn.setAttribute("aria-expanded", String(!shown));
  });
});
document.querySelectorAll(".galall").forEach(function (btn) {
  btn.addEventListener("click", function () {
    var sec = btn.closest(".galsec");
    var show = sec.querySelectorAll('.spot[data-state="hidden"]').length > 0;
    sec.querySelectorAll(".spot").forEach(function (sp) {
      sp.setAttribute("data-state", show ? "shown" : "hidden");
      sp.querySelector(".spotbtn").setAttribute("aria-expanded", String(show));
    });
    btn.textContent = show ? "Hide the answers" : "Show all nine";
  });
});
</script>
<script src="assets/js/tier.js"></script>
<script src="assets/js/pwa.js" defer></script>
</body>
</html>
'''

if __name__ == "__main__":
    build()
