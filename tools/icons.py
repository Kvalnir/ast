"""Generate the PWA icon set from one drawing routine.

Run from this directory:  python3 icons.py

The mark is the top-left 3x3 block of a board, cropped: the two heavy rules
run past the block so the grid reads as continuing off the icon, and the
centre cell carries a placed digit. It is the same glyph the site uses as its
bookmark elsewhere, redrawn here in the site palette.

The glyph is described in its own 24-unit square (the SVG viewBox it came
from, kept identical so the two stay in step) and mapped onto a canvas drawn
at 8x and downsampled, which is cheaper than fighting PIL for antialiased
primitives.

Outputs to ../assets/icons/. Regenerate only when the mark changes; the files
are committed so the site has no build step.
"""

from PIL import Image, ImageDraw

INK   = (15, 26, 32)      # icon ground -- --ink lifted slightly so it is not
                          # invisible against a black home screen
AMBER = (240, 180, 41)    # --amber
PAPER = (233, 238, 232)   # --paper

SS = 8                    # supersample factor
HEAVY, THIN = 1.7, 1.0    # the two stroke weights, in glyph units

# The mark is hung on the filled cell, not on its own bounding box: the glyph
# is cropped, so its ink runs 3..21 while the filled cell sits at 10,10, and
# centring the box leaves the one thing the eye lands on high and to the left.
#
# The cost is that the icon must reserve the same room on both sides of the
# cell, and the ink reaches further past it one way (11.85 units) than the
# other (7.85). So the mark sits low and right in a square of FOOT units, with
# the leftover space piling up above and behind it -- deliberate, and the
# reason `scale` here buys a visibly smaller mark than centring the box did.
SQ = 10.0                                 # centre of the filled cell
EDGE = HEAVY / 2                          # half a heavy stroke, incl. its cap
REACH = max(SQ - (3 - EDGE), (21 + EDGE) - SQ)
FOOT = 2 * REACH                          # the square the mark needs, centred


class Pen:
    """Draws glyph coordinates onto a supersampled canvas.

    `scale` is how much of the canvas edge FOOT spans, so 1.0 puts the mark's
    furthest ink hard against the edge and the filled cell dead centre.
    """

    def __init__(self, d, S, scale):
        self.d = d
        self.k = S * scale / FOOT         # units -> pixels
        self.c = S / 2                    # the filled cell lands here

    def at(self, x, y):
        return self.c + (x - SQ) * self.k, self.c + (y - SQ) * self.k

    def px(self, units):
        return max(1, round(units * self.k))

    def line(self, x0, y0, x1, y1, units, fill):
        w = self.px(units)
        self.d.line([self.at(x0, y0), self.at(x1, y1)], fill=fill, width=w)
        for x, y in ((x0, y0), (x1, y1)):    # PIL butts its line ends; the
            self.cap(x, y, w, fill)          # glyph asks for round caps

    def cap(self, x, y, w, fill):
        cx, cy = self.at(x, y)
        r = w / 2
        self.d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=fill)

    def arc(self, cx, cy, r, start, end, units, fill):
        # PIL strokes an arc inward from its bounding box, so the box is the
        # outer edge: push it out by half the stroke to centre it on r.
        rr = r + units / 2
        (x0, y0), (x1, y1) = self.at(cx - rr, cy - rr), self.at(cx + rr, cy + rr)
        self.d.arc([x0, y0, x1, y1], start, end, fill=fill, width=self.px(units))

    def box(self, x, y, w, h, r, fill):
        (x0, y0), (x1, y1) = self.at(x, y), self.at(x + w, y + h)
        self.d.rounded_rectangle([x0, y0, x1, y1], radius=r * self.k, fill=fill)


def glyph(pen):
    # The block's own two edges, meeting at the board's rounded corner.
    pen.line(3, 21, 3, 4.7, HEAVY, PAPER)
    pen.arc(4.7, 4.7, 1.7, 180, 270, HEAVY, PAPER)
    pen.line(4.7, 3, 21, 3, HEAVY, PAPER)

    # The other two, overrunning the block: the board carries on past the crop.
    pen.line(17, 3, 17, 21, HEAVY, PAPER)
    pen.line(3, 17, 21, 17, HEAVY, PAPER)

    # Cell rules inside the block.
    for u in (7.67, 12.33):
        pen.line(u, 3, u, 17, THIN, PAPER)
        pen.line(3, u, 17, u, THIN, PAPER)

    # The centre cell, filled: the one digit the block has given up.
    pen.box(8.7, 8.7, 2.6, 2.6, 0.7, AMBER)


def draw(size, *, scale, radius_frac, bleed):
    """One icon. `bleed` fills the whole canvas with the ground colour instead
    of rounding the corners -- what maskable and iOS both want."""
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if bleed:
        d.rectangle([0, 0, S, S], fill=INK)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius_frac), fill=INK)

    glyph(Pen(d, S, scale))
    return img.resize((size, size), Image.LANCZOS)


def save(img, name, *, flatten=False):
    path = "../assets/icons/" + name
    if flatten:                                  # iOS ignores alpha and can
        bg = Image.new("RGB", img.size, INK)     # composite it against black
        bg.paste(img, mask=img.split()[3])
        bg.save(path)
    else:
        img.save(path)
    print("wrote", path)


if __name__ == "__main__":
    import os
    os.makedirs("../assets/icons", exist_ok=True)

    # 0.90 leaves the overrunning rules a hair of clearance inside the rounded
    # corner; at 1.0 their end caps would sit on the edge itself.
    for size in (192, 512):
        save(draw(size, scale=0.90, radius_frac=0.22, bleed=False), f"icon-{size}.png")

    # Maskable: full bleed, and the mark pulled in until its furthest ink --
    # the two rule ends at 3,21 and 21,3, ~13.9 units out from the cell --
    # clears the 80% safe circle a launcher may crop to.
    for size in (192, 512):
        save(draw(size, scale=0.64, radius_frac=0, bleed=True), f"icon-maskable-{size}.png")

    # iOS masks to its own superellipse, so keep a little more room than the
    # rounded-corner icons need.
    save(draw(180, scale=0.88, radius_frac=0, bleed=True), "apple-touch-icon.png", flatten=True)

    # A tab favicon is 16px more often than 32: run the mark as large as the
    # crop allows so the thin rules survive the browser's own downsample.
    save(draw(32, scale=0.96, radius_frac=0.18, bleed=False), "favicon-32.png")
