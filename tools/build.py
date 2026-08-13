import json, engine

ex = json.load(open("./examples.json"))
def rc(i): return (i//9, i%9)
def cell(r,c): return r*9+c
def seg(a, b, cls="lead"):
    (r1,c1),(r2,c2) = rc(a), rc(b)
    return {"x1":c1+0.5,"y1":r1+0.5,"x2":c2+0.5,"y2":r2+0.5,"cls":cls}

CASES = []

# ---------------- 02 pointing ----------------
m = ex["pointing"]["move"]; st = ex["pointing"]["state"]
CASES.append(dict(
    id="pointing", family="Interaction", n="02",
    title="Pointing pair",
    look="Inside one box, a digit's only homes sit in a single row or column.",
    mode="full", key=[m["digit"]], state=st, base=m["base"], elim=m["elim"],
    elimdigits=[m["digit"]],
    tint=[("unitbox", engine.BOXES[engine.box(m["base"][0])]), ("unitline", engine.ROWS[8])],
    geo=[seg(m["base"][0], m["base"][1])],
    steps=[
        "Look at the bottom-left box. Every 5 that is still possible in that box lives in <b>r9c1</b> or <b>r9c3</b> — nowhere else.",
        "The box has to contain a 5 somewhere, so the 5 for that box is definitely in row 9.",
        "That makes the rest of row 9 off-limits for 5. <b>r9c4</b> drops its 5 and becomes 1/4."],
    scan=[
        "Work one box at a time, and prefer boxes with three to five empty cells — full boxes have nothing to say and empty ones say too much.",
        "Read off which digits the box is still missing. A box missing 1, 4, 5 and 9 gives you exactly four questions to ask.",
        "For each missing digit, find its possible cells <i>inside that box only</i>. Two or three cells is the interesting case.",
        "Ask whether those cells all share a row, or all share a column. If they do, the digit is locked to that line.",
        "Follow the line out of the box in both directions and look for the same digit as a candidate. Those are your eliminations."],
    auto="News lets you light up one digit at a time, which is exactly the view this technique wants: every square already holding that digit turns green, and every <i>note</i> of it picks up a small green chip, so what you are looking at is the true candidate map. Highlight the digit and sweep the nine boxes asking a single visual question: do the lit squares inside this box sit in one row or one column? Then follow that line past the box walls — any lit square out there is dead. Finish all nine boxes before you switch digits, because re-lighting a digit costs a tap and re-orienting your eye costs more. Record each kill by hand: tap the square, Notes tab, tap the digit off. Automatically Remove Notes will not do it for you, since that setting only fires when you enter an answer.",
    watch="A digit locked to a line inside a box is extremely common and usually useless. It only becomes a move if that same digit still appears elsewhere along the line. Confirm the elimination exists <i>before</i> you spend time convincing yourself the pattern is real."))

# ---------------- 03 claiming ----------------
m = ex["claiming"]["move"]; st = ex["claiming"]["state"]
CASES.append(dict(
    id="claiming", family="Interaction", n="03",
    title="Claiming (line to box)",
    look="Along one row or column, a digit's only homes sit inside a single box.",
    mode="full", key=[m["digit"]], state=st, base=m["base"], elim=m["elim"],
    elimdigits=[m["digit"]],
    tint=[("unitline", engine.ROWS[7]), ("unitbox", engine.BOXES[6])],
    geo=[seg(m["base"][0], m["base"][1])],
    steps=[
        "Same puzzle, one move later. In row 8 the only cells that can still be 1 are <b>r8c1</b> and <b>r8c2</b>.",
        "Both sit in the bottom-left box, so that box's 1 must be one of them.",
        "Every other cell in the box loses its 1: <b>r9c1</b> and <b>r9c3</b> go from 1/5/9 down to 5/9."],
    scan=[
        "Pick a row or column with four or fewer empty cells — these are where a digit gets squeezed into one box.",
        "List the digits that line still needs.",
        "For each, find its candidate cells along the line. If they all fall in the same block of three columns (or three rows), the line is claiming that box.",
        "Eliminate the digit from the other six cells of the box.",
        "Immediately re-check that box for a hidden single — claiming very often exposes one."],
    auto="Same lit digit, opposite sweep: run along the rows and columns looking for one whose lit squares all fall inside a single block. Do both sweeps while the digit is still highlighted — you are already looking at the right map, and pointing asks <i>where in the box</i> while claiming asks <i>where in the line</i>. Afterwards, watch for squares that drop to a single note and touch and hold that number on the keypad to commit it.",
    watch="It is easy to mix this up with pointing and apply the elimination in the wrong direction. Say the conclusion out loud before erasing anything: <i>the box's 1 must be in row 8</i> means the rest of row 8 is safe and the rest of the box is not."))

# ---------------- 04 naked pair ----------------
m = ex["naked_2"]["move"]; st = ex["naked_2"]["state"]
CASES.append(dict(
    id="naked-pair", family="Subset", n="04",
    title="Naked pair",
    look="Two cells in one unit hold the same two candidates and nothing else.",
    mode="full", key=m["digits"], state=st, base=m["base"], elim=m["elim"],
    elimdigits=m["digits"],
    tint=[("unitline", engine.ROWS[4])],
    geo=[seg(m["base"][0], m["base"][1])],
    steps=[
        "In row 5, <b>r5c3</b> and <b>r5c7</b> are both exactly 3/8.",
        "Whichever way round they go, those two cells consume both the 3 and the 8 of row 5. No other cell in the row can have either digit.",
        "Strike 3 and 8 from the rest of the row. <b>r5c5</b> was 1/8 — it collapses to a bare 1, and the puzzle starts moving again."],
    scan=[
        "Find every cell with exactly two candidates. Ignore the rest for now; a three-candidate cell cannot be half of a pair.",
        "Take one such cell and check its three units in turn: the eight cells of its row, then its column, then its box.",
        "You are looking for one twin — an identical two-candidate cell. Not a cell that merely contains both digits, an identical one.",
        "When you find the twin, erase both digits from every other cell of the shared unit.",
        "Bonus check: if the twins also sit in the same box, the elimination applies to the box as well as the line. Two units for the price of one."],
    auto="Here the one-digit-at-a-time limit bites: a naked pair is about two digits at once and News can only light one. So drop the highlight and read by density instead. Autofill once after your singles pass, then hunt the emptiest squares — two marks against four or five — and compare the ones sharing a unit. The highlight still helps as a check: light one of the pair's digits and confirm the rest of the unit really does lose it. Then edit each affected square by hand in Notes mode, and never run Autofill again, because it rebuilds notes from the placed digits and restores everything you just deduced away.",
    watch="A naked pair needs both cells to hold <i>nothing but</i> those two digits. A cell reading 3/8/9 beside a 3/8 cell is not a pair — it is the thing the pair is about to shrink."))

# ---------------- 05 naked triple ----------------
m = ex["naked_3"]["move"]; st = ex["naked_3"]["state"]
CASES.append(dict(
    id="naked-triple", family="Subset", n="05",
    title="Naked triple",
    look="Three cells in one unit share three candidates between them — no cell needs to hold all three.",
    mode="full", key=m["digits"], state=st, base=m["base"], elim=m["elim"],
    elimdigits=m["digits"],
    tint=[("unitline", engine.ROWS[4])],
    geo=[seg(m["base"][0], m["base"][2])],
    steps=[
        "Row 5 again, different puzzle: <b>r5c1</b> is 1/3/9, <b>r5c8</b> is 1/3, <b>r5c9</b> is 3/9.",
        "Take the union: {1,3,9} across exactly three cells. Those three cells must swallow all three digits.",
        "So 1, 3 and 9 vanish from the rest of row 5: <b>r5c2</b> 4/5/6/9 &rarr; 4/5/6, <b>r5c3</b> 1/3/4/6 &rarr; 4/6, <b>r5c6</b> 3/5/8/9 &rarr; 5/8."],
    scan=[
        "Choose a unit and mentally cross out every cell with four or more candidates. They can never belong to a triple, which usually removes half the unit instantly.",
        "From what remains you need three cells. Start from a two-candidate cell to keep the search small.",
        "Add a second cell sharing at least one digit with the first, then a third, keeping a running union of digits.",
        "If the union reaches four digits, abandon that combination and back up. If it stops at three digits across three cells, you have it.",
        "Erase all three digits from every other cell in the unit — including the crowded cells you set aside in step one."],
    auto="Three digits, one highlight — the app cannot show you this pattern, so density reading is the whole method. Find the units holding three or four sparse squares and read only those; anything carrying four notes is out. Applying it is the slow part: three digits struck from as many as six squares, each tapped individually in Notes mode, with Undo walking back one action at a time. Confirm the triple twice before you start tapping.",
    watch="Hidden triples exist too and are far harder to see; skip them. Almost every triple that matters in a hard puzzle is a naked one, and the hidden ones usually turn up more easily wearing another name."))

# ---------------- 06 hidden pair ----------------
m = ex["hidden_2"]["move"]; st = ex["hidden_2"]["state"]
CASES.append(dict(
    id="hidden-pair", family="Subset", n="06",
    title="Hidden pair",
    look="Two digits in a unit have only two possible cells between them — buried under other candidates.",
    mode="full", key=m["digits"], state=st, base=m["base"], elim=m["elim"],
    elimdigits=[], keep=m["digits"],
    tint=[("unitline", engine.ROWS[1])],
    geo=[seg(m["base"][0], m["base"][1])],
    steps=[
        "Scan row 2 digit by digit. The 3 can only go in <b>r2c1</b> or <b>r2c4</b>. The 5 can only go in <b>r2c1</b> or <b>r2c4</b>.",
        "Two digits, two cells. Those cells are reserved for 3 and 5 — they can hold nothing else.",
        "<b>r2c4</b> is currently 3/5/7. The 7 gets deleted, and row 2's 7 must now live elsewhere."],
    scan=[
        "Pick a stuck unit and switch modes: stop reading cells, start reading digits.",
        "For each digit the unit still needs, write down where it could go — a footprint like <code>3: c1 c4</code>.",
        "Ignore digits with three or more possible cells. You want the ones with exactly two.",
        "Compare those short footprints. Two digits occupying the <i>same</i> two cells is a hidden pair.",
        "Delete every other candidate from those two cells. Note the direction: this technique cleans out the pattern cells themselves, not the rest of the unit."],
    auto="This is where the digit highlight earns its keep, because hidden subsets live in digits and News shows you exactly one digit's footprint at a time. Take the stuck row, light each digit in turn, and note how many squares in that row stay lit. Two digits scoring exactly two, in the same two squares, is your pair — nine taps and a hopeless-looking unit gives itself up. The chips appear on notes as well as on placed digits, so the count you are reading is the real footprint and not just the answers already on the board.",
    watch="A hidden pair is only worth finding when at least one of the two cells carries extra baggage. If both already read 3/5, you have rediscovered a naked pair and there is nothing to erase."))

# ---------------- 07 X-Wing ----------------
m = ex["xwing"]["move"]; st = ex["xwing"]["state"]
CASES.append(dict(
    id="x-wing", family="Single digit", n="07",
    title="X-Wing",
    look="One digit, two lines, each with exactly two spots — and the spots line up in the same two crossing lines.",
    mode="single", key=[m["digit"]], state=st, base=m["base"], elim=m["elim"],
    elimdigits=[m["digit"]],
    tint=[("unitline", engine.COLS[1]+engine.COLS[6])],
    geo=[seg(cell(5,1), cell(6,1)), seg(cell(5,6), cell(6,6)),
         seg(cell(5,1), cell(5,6)), seg(cell(6,1), cell(6,6))],
    steps=[
        "Only the 6s are shown. Column 2 has exactly two: <b>r6c2</b> and <b>r7c2</b>. Column 7 also has exactly two: <b>r6c7</b> and <b>r7c7</b>.",
        "All four sit on rows 6 and 7, forming a rectangle. Either the 6s take one pair of opposite corners, or the other — no third option.",
        "Either way, rows 6 and 7 have both used up their 6 inside those columns. Every other 6 on those rows dies: <b>r6c4</b> and <b>r6c8</b>."],
    scan=[
        "Commit to one digit and stay with it. Mixing digits is why people never find fish.",
        "Go down the nine rows and count how many cells could still hold that digit. Skip any row that already contains it as a solved value.",
        "Keep only rows scoring exactly 2, and note which columns those cells are in — <code>r6: c2 c7</code>.",
        "Compare the short lists. Two rows with the identical column pair is an X-Wing.",
        "Eliminate the digit from the rest of both columns. Then run the whole scan again by column, comparing row pairs — the two directions are separate hunts.",
        "Move to the next digit. Nine digits, two directions, and every X-Wing on the board has been checked."],
    auto="The lit digit is precisely the single-digit map this figure uses, so the technique becomes a reading exercise rather than a search. Light the digit, count lit squares per row, keep the rows scoring exactly two, then repeat by column. The catch is memory, not vision: News has no colouring, so the shape exists only in your head while you switch to Notes mode and start erasing. Write the two rows and two columns down first — four characters on paper — then tap.",
    watch="Both lines must have <i>exactly</i> two spots. A row with three that happen to include your two columns proves nothing, and it is the most common false positive there is. If one line has three, keep the note — you may have a swordfish or a skyscraper instead."))

# ---------------- 08 Swordfish ----------------
m = ex["swordfish"]["move"]; st = ex["swordfish"]["state"]
CASES.append(dict(
    id="swordfish", family="Single digit", n="08",
    title="Swordfish",
    look="The X-Wing grown by one: three lines, each with two or three spots, all confined to the same three crossing lines.",
    mode="single", key=[m["digit"]], state=st, base=m["base"], elim=m["elim"],
    elimdigits=[m["digit"]],
    tint=[("unitline", engine.COLS[0]+engine.COLS[1]+engine.COLS[5])],
    geo=[seg(cell(4,0), cell(6,0)), seg(cell(2,1), cell(4,1)), seg(cell(2,5), cell(6,5)),
         seg(cell(2,1), cell(2,5), "cross"), seg(cell(4,0), cell(4,1), "cross"),
         seg(cell(6,0), cell(6,5), "cross")],
    steps=[
        "Only the 9s are shown. Column 1 has 9s in rows 5 and 7. Column 2 in rows 3 and 5. Column 6 in rows 3 and 7.",
        "Three columns, and every one of their 9s falls in just three rows: 3, 5 and 7. Those columns need three 9s, and those rows can supply exactly three.",
        "So rows 3, 5 and 7 are fully committed. Any 9 on those rows outside columns 1, 2 and 6 is dead: <b>r5c3</b> and <b>r7c3</b>."],
    scan=[
        "Run the same per-digit count as the X-Wing scan, but this time keep the lines scoring 2 <i>or</i> 3.",
        "If fewer than three lines qualify, there is no swordfish for that digit. Move on immediately — this rejection is most of the speed.",
        "Otherwise take the qualifying lines three at a time and pool their crossing positions.",
        "Exactly three distinct crossing lines in the pool is a swordfish. Four or more and it fails.",
        "Eliminate the digit from those three crossing lines everywhere outside the three base lines."],
    auto="Cheap to attempt once the digit is lit, since it reuses the line counts from your X-Wing pass; still rarely the answer. Apple's challenging puzzles tend to break open on locked candidates or a subset, so if a swordfish is the only thing you can see, re-run the cheaper scans before committing — a pointing pair you walked past is far likelier than a genuine three-line fish. If you do commit, write the three base lines down first, because the elimination is a long run of manual note tapping and a mistake mid-way is hard to unpick.",
    watch="Check that no base line contains the digit as a solved value, and that you really have three distinct lines of the same type. Also check the cheap techniques first: a large share of apparent swordfish dissolve into a pointing pair or an X-Wing you walked past."))

# ---------------- 09 Skyscraper ----------------
m = ex["skyscraper"]["move"]; st = ex["skyscraper"]["state"]
CASES.append(dict(
    id="skyscraper", family="Single digit", n="09",
    title="Skyscraper",
    look="Two lines with exactly two spots each, sharing one crossing line. The two loose ends do the work.",
    mode="single", key=[m["digit"]], state=st, base=m["base"], elim=m["elim"],
    elimdigits=[m["digit"]],
    tint=[("unitline", engine.ROWS[2]+engine.ROWS[8])],
    geo=[seg(cell(2,3), cell(2,6)), seg(cell(8,3), cell(8,7)),
         seg(cell(2,3), cell(8,3), "cross")],
    steps=[
        "Only the 4s are shown. Row 3 has two: <b>r3c4</b> and <b>r3c7</b>. Row 9 has two: <b>r9c4</b> and <b>r9c8</b>. Both share column 4.",
        "Column 4 can hold only one 4, so <b>r3c4</b> and <b>r9c4</b> cannot both be it. At least one of those rows must place its 4 at the far end instead.",
        "So at least one of the roof cells <b>r3c7</b> / <b>r9c8</b> is a 4. Any cell that sees both roofs can't be: <b>r1c8</b> and <b>r7c7</b> lose their 4."],
    scan=[
        "Reuse the X-Wing list: every line where the digit has exactly two spots. You are now interested in the pairs that <i>failed</i> the X-Wing test.",
        "Find two such lines sharing one crossing line but not the other. The shared column is the base; the two mismatched cells are the roof.",
        "Check the roof cells are not in the same box. If they are, this is a pointing pair and you have a simpler move available.",
        "Find the cells that see both roofs: take the row of one roof and the column of the other and note where they cross, then swap and repeat, then add any cell sharing a box with one roof and a line with the other.",
        "Any of those cells holding the digit as a candidate loses it."],
    auto="The best-value advanced pattern in News+, because it costs nothing beyond the X-Wing scan you have already run with the digit lit: two lines holding two lit squares each, sharing one crossing line but not the other. Note the four squares on paper, work out which squares see both roofs, then tap those notes off. If an elimination reduces a square to a single note, touch and hold that number on the keypad to promote it to an answer.",
    watch="If the roofs line up in the same crossing line as well, it is an X-Wing, not a skyscraper. If they share a box, it is locked candidates. The skyscraper is specifically the near-miss case — and it is the cheapest true chain in the game, worth learning well because the same strong-link logic powers everything above it."))

# ---------------- 10 XY-Wing ----------------
m = ex["xy_wing"]["move"]; st = ex["xy_wing"]["state"]
p, (w1, w2) = m["pivot"], m["wings"]
CASES.append(dict(
    id="xy-wing", family="Chain", n="10",
    title="XY-Wing",
    look="Three two-candidate cells forming a hinge: XY sees XZ and YZ.",
    mode="full", key=[m["digit"]], state=st, base=[p, w1, w2], elim=m["elim"],
    elimdigits=[m["digit"]], pivot=p, tint=[],
    geo=[seg(p, w1), seg(p, w2)],
    steps=[
        "The hinge is <b>r5c7</b> = 1/5. It sees <b>r7c7</b> = 1/9 down the column, and <b>r6c8</b> = 5/9 inside its box.",
        "If the hinge is 1, then r7c7 must be 9. If the hinge is 5, then r6c8 must be 9. The hinge is one or the other, so one of the wings is a 9 no matter what.",
        "Any cell seeing <i>both</i> wings therefore cannot be 9. <b>r7c8</b> shares row 7 with one wing and column 8 with the other: its 9 is gone."],
    scan=[
        "Work from your list of two-candidate cells. Pick one as the hinge and call its digits X and Y.",
        "Collect the two-candidate cells the hinge can see — its row, column and box. In a hard grid that is usually two to five cells.",
        "Look for one containing X plus a third digit Z, and another containing Y plus that same Z.",
        "You now know one wing must be Z. Find the cells that see both wings and remove Z from them.",
        "If a hinge yields nothing, move to the next two-candidate cell. A stuck grid rarely offers more than a dozen hinges to try."],
    auto="Three digits and one highlight, so the hinge has to be found by density among the sparse squares Autofill left behind. The highlight comes in at the end: light Z and check whether any lit square actually sees both wings before you spend taps on it. Two cautions specific to News — your eliminations exist only as notes you erased by hand, so a later Autofill undoes the entire deduction; and if a chain leads somewhere impossible, work out first whether the fault is a placed digit or a note. With Autocheck flagging squares, your digits are sound, which means the culprit is an elimination you made by hand — and the only fix is to rebuild the notes.",
    watch="The hinge must see both wings, but the wings need not see each other. People often demand a neat triangle and miss the common case where the wings sit far apart, connected only through the hinge."))

# ---------------- rendering ----------------
def render_grid(case):
    st = case["state"]
    base = set(case["base"]); elim = set(case["elim"]); keydigits = set(case["key"])
    tintmap = {}
    for cls, cells in case.get("tint", []):
        for i in cells: tintmap.setdefault(i, set()).add(cls)
    out = ['<div class="gridwrap"><div class="grid%s">' % (' solo' if case['mode']=='single' else '')]
    for i in range(81):
        r, c = rc(i)
        cls = ["cell"]
        if c % 3 == 0 and c: cls.append("bl")
        if r % 3 == 0 and r: cls.append("bt")
        cls += sorted(tintmap.get(i, []))
        if i in base: cls.append("base")
        if i == case.get("pivot"): cls.append("pivot")
        if i in elim: cls.append("target")
        if st["g"][i]:
            out.append('<div class="%s given"><span class="dig">%d</span></div>' % (" ".join(cls), st["g"][i]))
        else:
            marks = []
            for d in range(1, 10):
                mcls = ["m"]; present = d in st["c"][i]
                if case["mode"] == "single" and d not in keydigits: present = False
                if present:
                    mcls.append("on")
                    if d in keydigits: mcls.append("key")
                    if i in elim:
                        if case.get("keep") is not None:
                            if d not in case["keep"]: mcls.append("kill")
                        elif d in case["elimdigits"]:
                            mcls.append("kill")
                marks.append('<span class="%s">%s</span>' % (" ".join(mcls), d if present else "&nbsp;"))
            out.append('<div class="%s"><div class="marks">%s</div></div>' % (" ".join(cls), "".join(marks)))
    out.append('</div>')
    svg = ['<svg class="geo" viewBox="0 0 9 9" preserveAspectRatio="none" aria-hidden="true">']
    for g in case.get("geo", []):
        svg.append('<line class="%s" x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f"/>' % (g["cls"], g["x1"], g["y1"], g["x2"], g["y2"]))
    svg.append('</svg>')
    out.append("".join(svg)); out.append('</div>')
    return "".join(out)

def render_case(case):
    steps = "".join("<li>%s</li>" % s for s in case["steps"])
    scan = "".join("<li>%s</li>" % s for s in case["scan"])
    if case["mode"] == "single":
        only = 'Showing only the %d candidates. Every other pencil mark is hidden so the shape can surface.' % case["key"][0]
    elif len(case["key"]) == 1:
        only = 'Full pencil marks. The %ds are picked out in amber.' % case["key"][0]
    else:
        only = 'Full pencil marks. The %s are picked out in amber.' % (" and ".join(str(d)+"s" for d in case["key"]))
    return f'''
<section class="case" id="{case['id']}">
  <header class="casehead">
    <span class="eyebrow"><i>{case['n']}</i> {case['family']}</span>
    <h2>{case['title']}</h2>
    <p class="look">{case['look']}</p>
  </header>
  <figure class="fig" data-state="hidden">
    {render_grid(case)}
    <p class="only">{only}</p>
    <button class="reveal" type="button">Show the eliminations</button>
  </figure>
  <h3 class="sub">Why it works</h3>
  <ol class="steps">{steps}</ol>
  <div class="scan"><span>How to find it</span><ol>{scan}</ol></div>
  <div class="auto"><span>In Apple News+</span><p>{case['auto']}</p></div>
  <p class="watch"><span>Where it goes wrong</span>{case['watch']}</p>
</section>'''

# ---------------- practice ----------------
pr = json.load(open("./practice.json"))
pcells = []
for i in range(81):
    r, c = rc(i)
    cls = ["cell"]
    if c % 3 == 0 and c: cls.append("bl")
    if r % 3 == 0 and r: cls.append("bt")
    if pr["puzzle"][i]:
        cls.append("given")
        pcells.append('<div class="%s"><span class="dig">%d</span></div>' % (" ".join(cls), pr["puzzle"][i]))
    else:
        pcells.append('<div class="%s"><span class="sol">%d</span></div>' % (" ".join(cls), pr["solution"][i]))

PRACTICE = """
<section class="block" id="practice">
  <span class="eyebrow"><i>12</i> Practice</span>
  <h2>One grid, five of the nine</h2>
  <p>24 givens, and pitched at roughly what a News+ challenging grid asks of you. Singles alone will not finish it — it needs a pointing pair, a claiming move, a naked pair, a skyscraper and an XY-Wing, roughly in that order. Copy it into a paper grid, or type the givens into any app, and take your time; the point is the hunt, not the finish.</p>
  <figure class="fig" data-state="hidden">
    <div class="gridwrap"><div class="grid">%s</div></div>
    <p class="only">Tap below only when you want to check your work.</p>
    <button class="reveal" type="button">Show the solution</button>
  </figure>
  <p class="hint">When it stalls, work the list in order.<br>Nothing new from singles &rarr; scan each box for a digit trapped in one line.<br>Still nothing &rarr; circle every two-candidate cell and look for a repeated pair.<br>Still nothing &rarr; pick one digit and count its spots in every row and column.</p>
</section>""" % "".join(pcells)

CASE_HTML = "\n".join(render_case(c) for c in CASES)
NAV = ('<a href="#autonotes">Apple setup</a>' + "".join('<a href="#%s">%s</a>' % (c["id"], c["title"]) for c in CASES) + '<a href="#triage">What to try</a><a href="#practice">Practice grid</a>')

HTML = open("./template.html").read()
HTML = (HTML.replace("<!--CASES-->", CASE_HTML)
            .replace("<!--NAV-->", NAV)
            .replace("<!--PRACTICE-->", PRACTICE))
open("../index.html", "w").write(HTML)
print("ok", len(HTML))
