"""Generate the PWA icon set from one drawing routine.

Run from this directory:  python3 icons.py

The mark is the site's own visual argument in miniature: a 3x3 box with two
amber cells joined by an amber line -- a pointing pair, the first technique on
the page. Everything is drawn at 4x and downsampled, which is cheaper than
fighting PIL for antialiased primitives.

Outputs to ../assets/icons/. Regenerate only when the mark changes; the files
are committed so the site has no build step.
"""

from PIL import Image, ImageDraw

INK    = (15, 26, 32)      # icon ground -- --ink lifted slightly so it is not
                           # invisible against a black home screen
RULE   = (46, 64, 72)      # --rule-strong
AMBER  = (240, 180, 41)    # --amber
PAPER  = (233, 238, 232)   # --paper

SS = 4                     # supersample factor


def draw(size, *, inset, radius_frac, bleed):
    """One icon. `inset` is the fraction of the edge left empty around the
    mark -- maskable icons need a wide margin because the launcher may crop to
    a circle. `bleed` fills the whole canvas with the ground colour instead of
    rounding the corners (also what maskable wants)."""
    S = size * SS
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    if bleed:
        d.rectangle([0, 0, S, S], fill=INK)
    else:
        d.rounded_rectangle([0, 0, S - 1, S - 1], radius=int(S * radius_frac), fill=INK)

    # The 3x3 box, centred.
    pad = S * inset
    box = S - 2 * pad
    step = box / 3.0
    line = max(1, int(S * 0.012))

    def cell(r, c):
        x, y = pad + c * step, pad + r * step
        return [x, y, x + step, y + step]

    # Two cells carrying the pattern, and the line that connects them. Drawn
    # before the grid so the rules sit on top and keep the cell edges crisp.
    for r, c in ((0, 0), (0, 2)):
        x0, y0, x1, y1 = cell(r, c)
        d.rectangle([x0 + line, y0 + line, x1 - line, y1 - line], fill=AMBER)

    cy = pad + step * 0.5
    d.line([pad + step * 0.5, cy, pad + step * 2.5, cy],
           fill=AMBER, width=int(line * 1.6))

    # A third cell in paper white: the placed digit the pattern buys you.
    x0, y0, x1, y1 = cell(2, 1)
    d.rectangle([x0 + line, y0 + line, x1 - line, y1 - line], fill=PAPER)

    # Grid rules, then the heavy box border.
    for i in (1, 2):
        p = pad + i * step
        d.line([pad, p, pad + box, p], fill=RULE, width=line)
        d.line([p, pad, p, pad + box], fill=RULE, width=line)
    d.rectangle([pad, pad, pad + box, pad + box], outline=RULE, width=int(line * 2))

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

    for size in (192, 512):
        save(draw(size, inset=0.14, radius_frac=0.22, bleed=False), f"icon-{size}.png")

    # Maskable: full bleed, mark kept inside the 80% safe zone.
    for size in (192, 512):
        save(draw(size, inset=0.26, radius_frac=0, bleed=True), f"icon-maskable-{size}.png")

    save(draw(180, inset=0.14, radius_frac=0, bleed=True), "apple-touch-icon.png", flatten=True)
    save(draw(32, inset=0.10, radius_frac=0.18, bleed=False), "favicon-32.png")
