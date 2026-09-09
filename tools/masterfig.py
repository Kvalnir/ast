# The master tier's figures: one harvested position in, one mini spec out.
#
# The Advanced pages draw their miniatures two ways — the cheat sheet's are
# hand-transcribed schematics, the gallery's are derived from a move. Up here
# there is only the second kind, for both pages, because a hand-drawn chain
# figure is a chain nobody checked. Everything here comes out of
# master-examples.json, which assets/js/master.js produced and verified against
# each puzzle's own solution (see tools/harvest-master.js).
#
# The class vocabulary is the cheat sheet's, extended by gallery.py:
#   b   pattern cell             (amber)
#   r   loose end, wing, or fin  (amber ring)
#   x   eliminated, whole cell   (red, struck) — single-digit figures
#   xk  eliminated, some marks   (red tint, <s> on what dies) — cell figures
#   f   the mark that breaks it  (red ring) — near misses only
#   p   a placed digit
#   d   another spot for the digit, or another cell's marks
#
# A figure is drawn one of two ways, and which one depends on how the technique
# is hunted rather than on what family it is in. The four single-digit ones get
# the digit's whole map, which is the view the News+ highlight gives you. The
# rest get only the squares the argument runs through, because a chain is an
# argument about those squares and painting the other sixty around it is noise.

from mini import seg

SOLO = {"finned", "kite", "empty_rect", "colouring"}
MAXLAB = 4


def key(i):
    return "%d-%d" % (i // 9 + 1, i % 9 + 1)


def marks(cs, kill=()):
    """A cell's marks, with the dying ones struck. None if it will not fit."""
    ds = [int(x) for x in cs]
    if len(ds) > MAXLAB:
        return None
    return "".join(("<s>%d</s>" % d) if d in kill else str(d) for d in ds)


def dual(cold, warm):
    return '<span class="cold">%s</span><span class="warm">%s</span>' % (cold, warm)


def solo_cells(inst, ok):
    g, c = inst["g"], inst["c"]
    d = inst["soloDigit"] or (inst["digits"] or [0])[0]
    cells = {}
    for i in range(81):
        if g[i] != "0" and int(g[i]) == d:
            cells[key(i)] = ("p", str(d))
        elif g[i] == "0" and str(d) in c[i]:
            cells[key(i)] = ("d", str(d))
    for i in inst["cells"]:
        cells[key(i)] = ("b", str(d))
    for i in inst.get("roof") or []:
        cells[key(i)] = ("r", str(d))
    for i in inst.get("fins") or []:
        cells[key(i)] = ("r", str(d))
    if ok:
        for i, dd in inst["elims"]:
            cells[key(i)] = ("x", str(dd))
    elif inst.get("bad") is not None:
        cells[key(inst["bad"])] = ("f", str(d))
    return cells


def cell_figure(inst, ok):
    """Only the squares the argument runs through, with their marks."""
    g, c = inst["g"], inst["c"]
    cells = {}
    dead = {}
    if ok:
        for i, dd in inst["elims"]:
            dead.setdefault(i, set()).add(dd)
    for i in inst["cells"]:
        if g[i] != "0":
            cells[key(i)] = ("p", g[i])
            continue
        lab = marks(c[i])
        cells[key(i)] = ("b", lab if lab else "·")
    for i in inst.get("roof") or []:
        if key(i) in cells:
            cls, lab = cells[key(i)]
            cells[key(i)] = ("r", lab)
    if inst.get("pivot") is not None:
        cells[key(inst["pivot"])] = ("b", cells.get(key(inst["pivot"]), ("b", "·"))[1])
    for i, ds in dead.items():
        if g[i] != "0":
            continue
        lab = marks(c[i], ds)
        cells[key(i)] = ("xk", lab if lab else
                         dual("·", "".join("<s>%d</s>" % d for d in sorted(ds))))
    if not ok and inst.get("bad") is not None:
        cls, lab = cells.get(key(inst["bad"]), ("f", marks(c[inst["bad"]]) or "·"))
        cells[key(inst["bad"])] = ("f", lab)
    return cells


def bug_cells(inst, ok):
    """BUG+1 is a statement about the whole board, so the figure has to be the
       whole board: every unsolved square as a dot, every placed digit as
       itself, and the one square still carrying three marks showing them."""
    g, c = inst["g"], inst["c"]
    cells = {}
    for i in range(81):
        if g[i] != "0":
            cells[key(i)] = ("p", g[i])
        else:
            cells[key(i)] = ("d", "·")
    cell, digit = inst["placement"]
    lab = marks(c[cell]) or "·"
    cells[key(cell)] = ("b", lab)
    return cells


def tint_of(inst):
    if inst["id"] != "empty_rect":
        return None
    boxes = {}
    for i in inst["cells"]:
        b = (i // 9 // 3) * 3 + (i % 9) // 3
        boxes[b] = boxes.get(b, 0) + 1
    best = max(boxes.items(), key=lambda kv: kv[1])
    return ("box", best[0]) if best[1] >= 2 else None


def geometry(inst):
    return [seg(key(a), key(b), style) for a, b, style in (inst.get("lines") or [])
            if a != b]


def cold_cap(inst):
    i = inst["id"]
    if i in SOLO:
        return "the %ds" % (inst["soloDigit"] or inst["digits"][0])
    if i == "bug":
        return "one square with three marks"
    if i == "unique_rect":
        return "four corners"
    return "%d squares and their marks" % len(inst["cells"])


def figure(inst, ok=True):
    if inst["id"] in SOLO:
        cells = solo_cells(inst, ok)
    elif inst["id"] == "bug":
        cells = bug_cells(inst, ok)
    else:
        cells = cell_figure(inst, ok)
    return dict(cap=cold_cap(inst), cells=cells, tint=tint_of(inst), geo=geometry(inst))


def cellname(i):
    return "r%dc%d" % (i // 9 + 1, i % 9 + 1)


def names(cs, cap=4):
    cs = list(cs)
    if len(cs) > cap:
        return ", ".join(cellname(i) for i in cs[:cap]) + " and %d more" % (len(cs) - cap)
    if len(cs) == 1:
        return cellname(cs[0])
    return ", ".join(cellname(i) for i in cs[:-1]) + " and " + cellname(cs[-1])


def killed(inst, cap=4):
    """What the move actually takes off the board, in words."""
    if inst.get("placement"):
        return "%s is the %d." % (cellname(inst["placement"][0]), inst["placement"][1])
    es = inst["elims"]
    if not es:
        return ""
    if len(es) > cap:
        head = ", ".join("%d from %s" % (d, cellname(i)) for i, d in es[:cap])
        return head + " and %d more." % (len(es) - cap)
    return ", ".join("%d from %s" % (d, cellname(i)) for i, d in es) + "."
