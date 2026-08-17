# The little 9x9 figure, shared by the two generators.
#
# cheatsheet.py draws one per card; build.py draws the single uniqueness example
# at the foot of the lesson. One renderer, so the two pages cannot drift into
# two dialects of the same picture — and .mini / .geo3 in site.css style both.
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
        for x1, y1, x2, y2, cls in t["geo"]:
            out.append('<line class="%s" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (cls, x1, y1, x2, y2))
        out.append("</svg>")
    out.append("</div>")
    return "".join(out)
