# Generates ../cheatsheet.html — the one-page crib of the nine techniques.
#
# The long-form explanations live in index.html; this page is the thing you keep
# open while you play, so every card is a trigger and a deletion and nothing
# else. The figures are deliberately schematic — 16px cells, a digit or two each —
# but the positions are the SAME positions index.html uses, taken from
# examples.json, so the base cells and the eliminations agree with the full
# write-up card for card. Do not invent extra eliminations here: the site claims
# every elimination it shows is verified against the puzzle's solution, and this
# page is part of the site.
#
#   b   pattern cell            (amber fill, the site's .cell.base)
#   r   loose end / wing        (amber ring, the site's .cell.pivot)
#   x   eliminated              (red tint, struck) — label it with the digits
#                               that cell actually loses, not the whole pattern
#   <s> inside a label          one struck digit within a cell that survives
#   d   another spot for the same digit, or `·` for an ordinary unsolved cell
#
# Run:  python3 cheatsheet.py

TECH = [
    dict(
        id="pointing", n="02", family="Interaction", title="Pointing pair",
        what="Inside one box, a digit's only homes sit in a single row or column.",
        find="A box with two or three spots for a digit, all sharing a line.",
        kill="That digit, from the rest of the line, outside the box.",
        guard="Usually there is nothing to delete. Check the digit still appears further along the line <b>before</b> you talk yourself into the pattern.",
        cap="box 7's 5s are stuck in row 9",
        tint=("box", 6),
        cells={"9-1": ("b", "5"), "9-3": ("b", "5"), "9-4": ("x", "5"),
               "3-1": ("d", "·"), "5-6": ("d", "·"), "1-8": ("d", "·")},
    ),
    dict(
        id="claiming", n="03", family="Interaction", title="Claiming",
        what="Along one line, a digit's only homes sit inside a single box.",
        find="A line with two or three spots for a digit, all inside one box.",
        kill="That digit, from the rest of the box, off the line.",
        guard="Easy to run backwards. The box's 1 is in row 8, so the rest of the row is safe and the rest of the <b>box</b> is not.",
        cap="row 8's 1s are stuck in box 7",
        tint=("row", 8),
        cells={"8-1": ("b", "1"), "8-2": ("b", "1"), "9-1": ("x", "1"), "9-3": ("x", "1"),
               "2-5": ("d", "·"), "4-8": ("d", "·")},
    ),
    dict(
        id="naked-pair", n="04", family="Subset", title="Naked pair",
        what="Two cells in one unit hold the same two candidates and nothing else.",
        find="Two cells in a unit reading exactly the same two marks.",
        kill="Both digits, from every other cell of that unit.",
        guard="Both cells must hold <b>nothing but</b> those two digits. A 3/8/9 cell beside a 3/8 cell is not half a pair — it is a target.",
        cap="r5c3 and r5c7 are both 3/8",
        tint=("row", 5),
        # Struck cells carry the digit each one actually loses, not the pair:
        # r5c1 and r5c9 held a 3, r5c5 held the 8.
        cells={"5-3": ("b", "38"), "5-7": ("b", "38"),
               "5-1": ("x", "3"), "5-5": ("x", "8"), "5-9": ("x", "3")},
    ),
    dict(
        id="naked-triple", n="05", family="Subset", title="Naked triple",
        what="Three cells share three candidates between them — no cell needs to hold all three.",
        find="Three cells in a unit whose marks pool to exactly three digits.",
        kill="All three digits, from every other cell of that unit.",
        guard="A cell with four or more marks can <b>never</b> join a triple. Cross those out first and half the unit disappears.",
        cap="139 / 13 / 39 across three cells of row 5",
        tint=("row", 5),
        cells={"5-1": ("b", "139"), "5-8": ("b", "13"), "5-9": ("b", "39"),
               "5-2": ("x", "9"), "5-3": ("x", "13"), "5-6": ("x", "39")},
    ),
    dict(
        id="hidden-pair", n="06", family="Subset", title="Hidden pair",
        what="Two digits in a unit have only two possible cells between them, buried under other candidates.",
        find="Two digits whose footprints in a stuck unit are the same two cells.",
        kill="Every <em>other</em> candidate, from those two cells.",
        guard="Only pays if one of the cells carries extra marks. Two cells already reading 3/5 is a naked pair with <b>nothing left to delete</b>.",
        cap="3 and 5 live only in r2c1 / r2c4, so r2c4 loses its 7",
        tint=("row", 2),
        # The pattern cell is also the cell the deletion lands in, so the 7 is
        # struck inside an otherwise amber cell.
        cells={"2-1": ("b", "35"), "2-4": ("b", "35<s>7</s>"),
               "2-6": ("d", "·"), "2-8": ("d", "·"), "2-9": ("d", "·")},
    ),
    dict(
        id="x-wing", n="07", family="Single digit", title="X-Wing",
        what="One digit, two lines with exactly two spots each, landing in the same two crossing lines.",
        find="Two lines whose two spots share <em>both</em> crossing lines — a rectangle.",
        kill="The digit, from the rest of the two crossing lines.",
        guard="<b>Exactly</b> two spots per line. A line with three that happen to include your columns proves nothing, and it is the commonest false positive there is.",
        cap="cols 2 and 7, both landing on rows 6 and 7",
        tint=None,
        cells={"6-2": ("b", "6"), "7-2": ("b", "6"), "6-7": ("b", "6"), "7-7": ("b", "6"),
               "6-4": ("x", "6"), "6-8": ("x", "6"), "2-5": ("d", "6"), "4-9": ("d", "6")},
    ),
    dict(
        id="swordfish", n="08", family="Single digit", title="Swordfish",
        what="The X-Wing grown by one: three lines, two or three spots each, confined to three crossing lines.",
        find="Three lines for one digit pooling to exactly three crossings.",
        kill="The digit, from those three crossing lines, outside the three base lines.",
        guard="Rarely the real answer at this tier. Re-run the cheap scans first — most apparent swordfish are a <b>pointing pair you walked past</b>.",
        cap="cols 1, 2, 6 &rarr; rows 3, 5, 7",
        tint=None,
        cells={"5-1": ("b", "9"), "7-1": ("b", "9"), "3-2": ("b", "9"), "5-2": ("b", "9"),
               "3-6": ("b", "9"), "7-6": ("b", "9"), "5-3": ("x", "9"), "7-3": ("x", "9"),
               "1-8": ("d", "9"), "9-5": ("d", "9")},
    ),
    dict(
        id="skyscraper", n="09", family="Single digit", title="Skyscraper",
        what="Two lines with two spots each, sharing one crossing line. One of the two loose ends must be the digit.",
        find="Two rows, two spots each, meeting in one column and parting at the other end.",
        kill="The digit, from any cell that sees <em>both</em> loose ends.",
        guard="Test the loose ends. Sharing the second column too is an <b>X-Wing</b>; sharing a box is a <b>pointing pair</b>. The skyscraper is the near-miss case, where the ends are strangers.",
        cap="rows 3 and 9 share column 4; the ends do the work",
        tint=None,
        cells={"3-4": ("b", "4"), "9-4": ("b", "4"), "3-7": ("r", "4"), "9-8": ("r", "4"),
               "1-8": ("x", "4"), "7-7": ("x", "4"), "5-2": ("d", "4"), "6-9": ("d", "4")},
    ),
    dict(
        id="xy-wing", n="10", family="Chain", title="XY-Wing",
        what="Three two-candidate cells forming a hinge: XY sees XZ and YZ.",
        find="A bi-value hinge seeing two bi-value cells, each sharing one of its digits plus a common third.",
        kill="That third digit, from any cell seeing both wings.",
        guard="The hinge must see both wings. The wings do <b>not</b> need to see each other — demanding a neat triangle is how people miss the common case.",
        cap="hinge 1/5 &rarr; wings 1/9 and 5/9, so r7c8 loses its 9",
        tint=None,
        cells={"5-7": ("b", "15"), "7-7": ("r", "19"), "6-8": ("r", "59"), "7-8": ("x", "9"),
               "3-2": ("d", "·"), "8-4": ("d", "·")},
    ),
]

TRIGGERS = [
    ("One digit's spots in a box sit in one line", "pointing", "Pointing pair &mdash; clear it from the line, outside the box"),
    ("One digit's spots in a line sit in one box", "claiming", "Claiming &mdash; clear it from the box, off the line"),
    ("Two cells in a unit show the same two marks", "naked-pair", "Naked pair &mdash; clear both digits from the rest of the unit"),
    ("Three sparse cells pooling to three digits", "naked-triple", "Naked triple &mdash; clear all three from the rest of the unit"),
    ("Two digits with the same two homes in a unit", "hidden-pair", "Hidden pair &mdash; clear everything else from those two cells"),
    ("Two lines, two spots each, same crossing pair", "x-wing", "X-Wing &mdash; clear the digit from the rest of both crossings"),
    ("Two lines, two spots each, sharing one crossing only", "skyscraper", "Skyscraper &mdash; clear it from cells seeing both loose ends"),
    ("Three lines, two or three spots, three crossings", "swordfish", "Swordfish &mdash; clear it from those three crossing lines"),
    ("A bi-value hinge with two bi-value neighbours", "xy-wing", "XY-Wing &mdash; clear the shared third digit from cells seeing both wings"),
]

LOOP = [
    "Solve every single you can see. Then Autofill Notes, <b>once</b>.",
    "Light each digit in turn: boxes first, for a digit trapped in a line, then lines, for a digit trapped in a box.",
    "Highlight off. Read by density &mdash; sparse squares, two marks then three &mdash; for pairs and triples.",
    "Light each digit again, counting spots per row and column. Lines scoring exactly two feed X-Wings and skyscrapers.",
    "Use each two-mark square in turn as an XY-Wing hinge.",
    "Apply what you find by hand in Notes mode, and never Autofill again.",
]

GLOSSARY = [
    ("Unit", "Any row, column or box. Nine cells that must hold 1&ndash;9 once each."),
    ("Candidate", "A digit still legal in a cell. Your pencil marks."),
    ("Spot", "A cell where a given digit is still a candidate. &ldquo;Two spots&rdquo; means two possible homes in that unit."),
    ("Sees", "Two cells see each other if they share a row, column or box. They cannot both hold the same digit."),
    ("Strangers", "Two cells that see nothing of each other: different row, different column, different box."),
    ("Strong link", "A unit with exactly two spots for a digit, so one of them must be true."),
    ("Loose end", "In a skyscraper, the spot on each line that is not in the shared crossing line."),
    ("Bi-value cell", "A cell with exactly two candidates. Fuel for pairs, wings and chains."),
    ("Footprint", "The list of spots one digit has in one unit. Read digit-first, not cell-first."),
    ("Locked candidates", "The umbrella term for pointing pairs and claiming."),
    ("Base / crossing line", "In fish, the lines you count spots in, and the lines you delete from."),
    ("Hinge", "In an XY-Wing, the middle cell that sees both wings."),
]


def boxof(r, c):
    return (r - 1) // 3 * 3 + (c - 1) // 3


def mini(t):
    out = ['<div class="mini" role="img" aria-label="%s">' % t["cap"].replace("&rarr;", "to").replace("&mdash;", "-")]
    for r in range(1, 10):
        for c in range(1, 10):
            cls = []
            if c % 3 == 1 and c > 1: cls.append("bl")
            if r % 3 == 1 and r > 1: cls.append("bt")
            if t["tint"]:
                kind, n = t["tint"]
                if (kind == "box" and boxof(r, c) == n) or (kind == "row" and r == n) or (kind == "col" and c == n):
                    cls.append("tint")
            hit = t["cells"].get("%d-%d" % (r, c))
            if hit: cls.append(hit[0])
            out.append('<i class="%s">%s</i>' % (" ".join(cls), hit[1] if hit else ""))
    out.append("</div>")
    return "".join(out)


def card(t):
    # Heading FIRST in the source, then the figure, then the detail. The card is
    # laid out with grid areas, so on a wide screen the figure still sits in a
    # column of its own to the left of both; in one column the reading order is
    # the DOM order, and a figure printed above its own title reads as belonging
    # to the card above it.
    return f'''
  <article class="card" id="{t['id']}">
    <div class="cardhead">
      <span class="eyebrow"><i>{t['n']}</i> {t['family']}</span>
      <h2><a href="index.html#{t['id']}">{t['title']}</a></h2>
    </div>
    <div class="cardfig">
      {mini(t)}
      <p class="figcap">{t['cap']}</p>
    </div>
    <div class="cardbody">
      <p class="what">{t['what']}</p>
      <dl class="kv">
        <dt>Look for</dt><dd>{t['find']}</dd>
        <dt>Then delete</dt><dd>{t['kill']}</dd>
      </dl>
      <p class="guard"><span>Where it goes wrong</span>{t['guard']}</p>
    </div>
  </article>'''


CARDS = "".join(card(t) for t in TECH)
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
<title>Cheat sheet — Advanced Sudoku Techniques</title>
<meta name="description" content="The nine patterns on one page: what fires each one, what it lets you delete, and where it goes wrong.">
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
<body>
<div class="crib">

  <div class="sitebar">
    <span class="mark"><span class="mark-long">Advanced Sudoku <em>Techniques</em></span><span class="mark-short">AST</span></span>
    <nav>
      <a href="index.html">Patterns</a>
      <a href="trainer.html">Trainer</a>
      <a href="cheatsheet.html" aria-current="page">Cheat sheet</a>
    </nav>
  </div>

  <header class="cribhead">
    <p class="kicker">Advanced Sudoku Techniques · crib notes</p>
    <h1>Nine patterns, <em>one page</em>.</h1>
    <p class="lede">Every technique reduced to the trigger that fires it and the deletion it earns. <a href="index.html">Patterns</a> is the explainer — this is the thing you keep open while you play. Each name links back to its full write-up.</p>
    <div class="legend cribleg">
      <p><span class="swatch b"></span> Amber cells are the pattern doing the work</p>
      <p><span class="swatch p"></span> Ringed cells are the loose ends of a chain</p>
      <p><span class="swatch k"></span> Struck red digits are the candidates it kills</p>
      <p><span class="swatch n"></span> Grey digits are other spots for the same digit, and a dot is any unsolved cell</p>
    </div>
  </header>

  <div class="cards">{CARDS}
  </div>

  <section class="block cribblock" id="loop">
    <span class="eyebrow"><i>A</i> The loop</span>
    <h2>The stall loop, in six moves</h2>
    <p>Restart at the top after any successful elimination — one placement usually re-opens the cheap techniques.</p>
    <ol class="order">{LOOPLIS}</ol>
  </section>

  <section class="block cribblock" id="triggers">
    <span class="eyebrow"><i>B</i> Diagnosis</span>
    <h2>Read the trigger, not the name</h2>
    <p>In play these work as triggers rather than as logic: a visual feature appears, and it tells you which tool to reach for. Ordered roughly by how cheap the move is.</p>
    <ol class="triage">{TRIG}</ol>
    <p class="hint">If nothing fires, the scan was incomplete or a digit is wrong.<br>Pick three digits and confirm each still has a legal home in every row, column and box.<br>A digit with nowhere to go means a mistake several moves back, and no technique will rescue it.</p>
  </section>

  <section class="block cribblock" id="glossary">
    <span class="eyebrow"><i>C</i> Vocabulary</span>
    <h2>Glossary</h2>
    <dl class="gloss">{GLOSS}</dl>
  </section>

  <footer>
    <p>The positions in these figures are the same ones <a href="index.html">Patterns</a> works through in full, and every elimination shown is checked against the puzzle's solution. Square references use <code>r5c3</code> for row 5, column 3. To practise the patterns on a live board, open the <a href="trainer.html">trainer</a>.</p>
  </footer>

</div>
<script src="assets/js/pwa.js" defer></script>
</body>
</html>
'''

open("../cheatsheet.html", "w").write(HTML)
print("ok", len(HTML))
