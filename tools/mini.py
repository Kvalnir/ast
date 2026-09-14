# The little 9x9 figure, shared by the two generators.
#
# cheatsheet.py draws one per card; build.py draws the single uniqueness example
# at the foot of the lesson. One renderer, so the two pages cannot drift into
# two dialects of the same picture — and .mini / .geo3 in site.css style both.
# lines() is shared wider still: build.py's full-size figures draw their overlay
# through it too, so a swordfish is coloured the same way at every size.
#
# A spec is a dict:
#   cap    the caption, also the figure's accessible name
#   cells  {"<row>-<col>": (class, label)} — see the key in cheatsheet.py
#   tint   ("box"|"row"|"col", n) or None, the unit to shade
#   geo    [seg(...), ...] connecting lines, or absent for none


def seg(a, b, cls="lead"):
    """Cell centres, in the 0..9 units the overlay's viewBox uses."""
    (r1, c1), (r2, c2) = (int(x) for x in a.split("-")), (int(x) for x in b.split("-"))
    return (c1 - 0.5, r1 - 0.5, c2 - 0.5, r2 - 0.5, cls)


def boxof(r, c):
    return (r - 1) // 3 * 3 + (c - 1) // 3


# Colouring the overlay. Six inks, --link-0 to --link-5 in site.css, and the
# same rule core.js draws the trainer and check boards with — change one and
# change the other.
#
# Every solid segment is a pair, or a strong link: it gets its own colour, in
# drawing order, so an X-Wing's two rows and a swordfish's three columns can be
# told apart at a glance. A dashed segment is a crossing line, and a crossing
# line joins two pairs — so it is drawn in two halves, each in the colour of the
# pair it leaves from, meeting in the middle. A dashed segment touching only
# one solid takes that colour whole; one touching none takes the first ink.
PALETTE = 6


def colours(geo):
    """For each segment, (ink at its first end, ink at its second end)."""
    solid = [k for k, s in enumerate(geo) if s[4] != "cross"]
    own = {k: n % PALETTE for n, k in enumerate(solid)}
    at = {}
    for k in solid:
        x1, y1, x2, y2, _ = geo[k]
        at.setdefault((x1, y1), own[k])
        at.setdefault((x2, y2), own[k])
    out = []
    for k, (x1, y1, x2, y2, _) in enumerate(geo):
        if k in own:
            out.append((own[k], own[k]))
            continue
        a, b = at.get((x1, y1)), at.get((x2, y2))
        if a is None and b is None:
            a = b = 0
        out.append((a if a is not None else b, b if b is not None else a))
    return out


def lines(geo):
    """The <line> elements for a geo list, coloured and split as above."""
    out = []
    def line(cls, ink, x1, y1, x2, y2):
        out.append('<line class="%s c%d" x1="%.2f" y1="%.2f" x2="%.2f" y2="%.2f"/>' % (cls, ink, x1, y1, x2, y2))
    for (x1, y1, x2, y2, cls), (a, b) in zip(geo, colours(geo)):
        if a == b:
            line(cls, a, x1, y1, x2, y2)
        else:
            # Both halves start at their own end, so the dashes start at each
            # pair and meet in the middle rather than running through it.
            mx, my = (x1 + x2) / 2, (y1 + y2) / 2
            line(cls, a, x1, y1, mx, my)
            line(cls, b, x2, y2, mx, my)
    return "".join(out)


def mini(t):
    # The overlay is a sibling of the grid inside .miniwrap, not a child of it:
    # .mini has overflow:hidden so its tinted cells stay inside the rounded
    # corners, which would clip the line ends too.
    out = ['<div class="miniwrap">']
    out.append('<div class="mini" role="img" aria-label="%s">' % t["cap"].replace("&rarr;", "to").replace("&mdash;", "-"))
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
    if t.get("geo"):
        out.append('<svg class="geo3" viewBox="0 0 9 9" preserveAspectRatio="none" aria-hidden="true">')
        out.append(lines(t["geo"]))
        out.append("</svg>")
    out.append("</div>")
    return "".join(out)
