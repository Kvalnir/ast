# Generates ../gallery.html — nine figures per technique, six real and three not.
#
# The reference page shows each technique once, on one canonical position. That
# teaches the idea and does nothing for the eye: the shape you meet tomorrow is
# the same logic in a different orientation, on a different digit, with a third
# spot in the line that kills it. So this page shows nine positions per
# technique, SIX of them the real thing and THREE near misses, shuffled, with
# the answer hidden until you ask for it. The question every figure asks is the
# one that actually costs you time at the board: is this one or isn't it?
#
# Everything here is generated, and generated from the same detectors the
# trainer runs — engine.py's all_* generators, which are what its solver reads
# its own moves from. Nothing on this page is drawn by hand, and nothing is
# asserted that the code did not verify:
#
#   * every position is a real state of a real puzzle with a unique solution,
#     reached by playing the engine's own moves from the printed givens;
#   * every elimination claimed is checked against that puzzle's solution
#     before the figure is written (see verify_move);
#   * every near miss is checked to be a near miss — the technique is run again
#     over the spoiled position and must find nothing at all on the digit or in
#     the unit the figure shows.
#
# The spoiling is honest too. Each near miss is made by ADDING a candidate the
# position has not eliminated yet, never by deleting one: that is a board a
# player really can be looking at, one scan short, which is exactly the state
# in which people talk themselves into a pattern that is not there.
#
# The figure convention is the cheat sheet's, and mini.py draws both:
#   b   pattern cell            (amber)
#   r   loose end / wing        (amber ring)
#   x   eliminated, whole cell  (red, struck) — single-digit figures
#   xk  eliminated, some marks  (red tint) — subset figures, <s> on what dies
#   f   the mark that breaks it (red ring) — near misses only
#   p   a placed digit
#   d   another spot for the digit, another cell's marks, or `·` for a cell
#       with too many marks to print
#
# Run:  python3 gallery.py

import random, itertools, html, re
import engine
from engine import ROWS, COLS, BOXES, UNITS, PEERS, row, col, box, name, State
from mini import seg, mini

# How many labelled characters fit a gallery cell. Four is the wide breakpoint
# (24px cells); anything longer prints as a dot, which is also the honest read
# — a cell with five marks is a cell you have already ruled out of a subset.
MAXLAB = 4


# ---------------------------------------------------------------- the walk
def first_move(s):
    for _, fn in engine.BASIC:
        mv = fn(s)
        if mv: return mv
    for _, fn in engine.ADVANCED:
        mv = fn(s)
        if mv: return mv
    return None


def walk(grid):
    """Every position on the engine's own solve path, from the givens on."""
    s = State(grid)
    for _ in range(500):
        yield s
        mv = first_move(s)
        if mv is None: return
        engine.apply(s, mv)
        if all(s.g): return


ALL = {
    "pointing":   lambda s: (m for m in engine.all_locked_candidates(s) if m["type"] == "pointing"),
    "claiming":   lambda s: (m for m in engine.all_locked_candidates(s) if m["type"] == "claiming"),
    "naked_2":    lambda s: engine.all_naked_subset(s, 2),
    "naked_3":    lambda s: engine.all_naked_subset(s, 3),
    "hidden_2":   lambda s: engine.all_hidden_subset(s, 2),
    "xwing":      lambda s: engine.all_fish(s, 2),
    "swordfish":  lambda s: engine.all_fish(s, 3),
    "skyscraper": engine.all_skyscraper,
    "xy_wing":    engine.all_xy_wing,
}
# A state can hold dozens of naked pairs; taking the lot from one position
# would fill a technique's quota with nine views of the same board.
PER_STATE = 6
PER_PUZZLE = 2


def sig(kind, mv):
    """Identity of an instance, for de-duplication across states of one puzzle:
       the same pattern survives many moves and would otherwise be harvested
       once per move."""
    return (kind, mv.get("digit"), tuple(sorted(mv["base"])))


# ---------------------------------------------------------------- honesty
def solution(grid):
    """The puzzle's answer, which every claim on the page is checked against.
       engine.solve_count only counts; this is the same backtracker returning
       the grid it lands on. make_puzzle only ever hands out puzzles with one
       solution, so the first one found is the one."""
    g = grid[:]
    def rec():
        best, bestc = -1, None
        for i in range(81):
            if g[i]: continue
            used = {g[p] for p in PEERS[i] if g[p]}
            c = [d for d in range(1, 10) if d not in used]
            if not c: return False
            if bestc is None or len(c) < len(bestc):
                best, bestc = i, c
                if len(c) == 1: break
        if best == -1: return True
        for d in bestc:
            g[best] = d
            if rec(): return True
            g[best] = 0
        return False
    return g if rec() else None


def verify_move(kind, mv, s, sol):
    """Nothing goes on the page that the solution disagrees with."""
    for i in range(81):
        if not s.g[i]:
            assert sol[i] in s.c[i], "candidate map lost the solution at %s" % name(i)
        else:
            assert s.g[i] == sol[i], "placed digit disagrees with the solution at %s" % name(i)
    if kind in ("naked_2", "naked_3"):
        dead = set(mv["digits"])
        for i in mv["elim"]:
            assert sol[i] not in dead, "%s would lose its own answer" % name(i)
    elif kind == "hidden_2":
        keep = set(mv["digits"])
        for i in mv["elim"]:
            assert sol[i] in keep, "%s would lose its own answer" % name(i)
    else:
        d = mv["digit"]
        for i in mv["elim"]:
            assert sol[i] != d, "%s would lose its own answer" % name(i)
    return True


# ---------------------------------------------------------------- harvest
def harvest(seed, wanted, per_tech, per_near):
    """Real instances and real near misses of each technique, from as many
       different puzzles as it takes. An instance carries the move, a frozen
       copy of the position it was found in, and that puzzle's solution."""
    rng = random.Random(seed)
    yes = {k: [] for k in wanted}
    no = {k: [] for k in wanted}
    seen = {k: set() for k in wanted}
    puzzles = 0
    while puzzles < 1200 and any(len(yes[k]) < per_tech or len(no[k]) < per_near
                                 for k in wanted):
        puzzles += 1
        grid = engine.make_puzzle(rng)
        sol = solution(grid)
        if not sol: continue
        mine = {k: [0, 0] for k in wanted}
        for s in walk(grid):
            for k in wanted:
                if len(yes[k]) < per_tech and mine[k][0] < PER_PUZZLE:
                    for mv in itertools.islice(ALL[k](s), PER_STATE):
                        key = sig(k, mv)
                        if key in seen[k] or not usable(k, mv, s): continue
                        verify_move(k, mv, s, sol)
                        seen[k].add(key)
                        yes[k].append({"kind": k, "mv": mv, "s": s.clone(), "sol": sol,
                                       "puzzle": puzzles})
                        mine[k][0] += 1
                        if mine[k][0] >= PER_PUZZLE: break
                if len(no[k]) < per_near and mine[k][1] < PER_PUZZLE:
                    for mv in itertools.islice(NEAR[k](s), PER_STATE * 2):
                        key = sig(k, mv)
                        if key in seen[k] or not usable(k, mv, s): continue
                        # the figure must not contain the thing it denies
                        if not none_in_view(k, s, view_of(k, mv)): continue
                        verify_move(k, mv, s, sol)
                        seen[k].add(key)
                        no[k].append({"kind": k, "mv": mv, "s": s.clone(), "sol": sol,
                                      "puzzle": puzzles, "miss": mv["miss"], "bad": mv["bad"]})
                        mine[k][1] += 1
                        if mine[k][1] >= PER_PUZZLE: break
    return yes, no, puzzles


def footprint(s, d):
    return [i for i in range(81) if not s.g[i] and d in s.c[i]]


def usable(kind, mv, s):
    """Will this instance draw a figure worth looking at? Too sparse and there
       is nothing to hunt through; too crowded and no cell can be read."""
    if kind in ("naked_2", "naked_3", "hidden_2"):
        u = mv["unit"]
        free = [i for i in u if not s.g[i]]
        if len(free) < 4: return False
        printable = sum(1 for i in free if len(s.c[i]) <= MAXLAB)
        if printable < len(free) - 2: return False   # a unit of dots teaches nothing
        if kind == "hidden_2":
            # both digits in both cells. A pair whose digits split one to each
            # cell is a hidden SINGLE wearing a pair's clothes — the reader
            # would name the single, and be right.
            if any(d not in s.c[i] for i in mv["base"] for d in mv["digits"]): return False
            # the kept digits plus the dying ones still have to fit the cell
            for i in mv["base"]:
                if len(s.c[i]) > MAXLAB: return False
        if kind == "naked_3":
            # a triple with a pair inside it is a pair; ask about the pair
            for x, y in itertools.combinations(mv["base"], 2):
                if len(s.c[x] | s.c[y]) == 2: return False
        return True
    if kind == "xy_wing":
        bi = [i for i in range(81) if not s.g[i] and len(s.c[i]) == 2]
        return 5 <= len(bi) <= 20
    fp = footprint(s, mv["digit"])
    return 6 <= len(fp) <= 22


# ---------------------------------------------------------------- shapes
# engine's detectors stop at patterns that eliminate something, because the
# solver only ever wanted a move. A quiz has to count the ones that do not: the
# moment a barren X-Wing sits in a figure captioned "no", the page is wrong.
# So the near misses are checked against shape alone, and these are the only
# functions here that read a position without asking what it is worth.
def line_spots(s, lines, d):
    return [(li, [i for i in line if not s.g[i] and d in s.c[i]]) for li, line in enumerate(lines)]


def shapes(kind, s, view):
    """Every instance of `kind` inside the part of the board a figure shows —
       one digit's map, one unit's marks, or the whole board for a wing."""
    if kind == "pointing":
        d = view
        for b in BOXES:
            spots = [i for i in b if not s.g[i] and d in s.c[i]]
            if len(spots) < 2: continue
            for line in (ROWS[row(spots[0])], COLS[col(spots[0])]):
                if all(i in line for i in spots): yield spots
    elif kind == "claiming":
        d = view
        for line in ROWS + COLS:
            spots = [i for i in line if not s.g[i] and d in s.c[i]]
            if len(spots) < 2: continue
            if all(i in BOXES[box(spots[0])] for i in spots): yield spots
    elif kind == "naked_2":
        cells = [i for i in view if not s.g[i] and len(s.c[i]) == 2]
        for a, b in itertools.combinations(cells, 2):
            if s.c[a] == s.c[b]: yield [a, b]
    elif kind == "naked_3":
        cells = [i for i in view if not s.g[i] and 2 <= len(s.c[i]) <= 3]
        for combo in itertools.combinations(cells, 3):
            if len(set().union(*(s.c[i] for i in combo))) == 3: yield list(combo)
    elif kind == "hidden_2":
        free = [i for i in view if not s.g[i]]
        homes = {d: {i for i in free if d in s.c[i]} for d in range(1, 10)}
        for d1, d2 in itertools.combinations([d for d in range(1, 10) if len(homes[d]) == 2], 2):
            if homes[d1] == homes[d2]: yield sorted(homes[d1])
    elif kind in ("xwing", "swordfish"):
        d, size = view, 2 if kind == "xwing" else 3
        for lines in (ROWS, COLS):
            avail = [(li, sp) for li, sp in line_spots(s, lines, d) if 2 <= len(sp) <= size]
            for combo in itertools.combinations(avail, size):
                cross = {col(i) if lines is ROWS else row(i) for _, sp in combo for i in sp}
                if len(cross) == size: yield [i for _, sp in combo for i in sp]
    elif kind == "skyscraper":
        d = view
        for lines in (ROWS, COLS):
            strong = [(li, sp) for li, sp in line_spots(s, lines, d) if len(sp) == 2]
            for (l1, s1), (l2, s2) in itertools.combinations(strong, 2):
                for k in range(2):
                    a1, b1 = s1[k], s1[1 - k]
                    for j in range(2):
                        a2, b2 = s2[j], s2[1 - j]
                        same = (col(a1) == col(a2)) if lines is ROWS else (row(a1) == row(a2))
                        diff = (col(b1) != col(b2)) if lines is ROWS else (row(b1) != row(b2))
                        if same and diff and box(b1) != box(b2): yield [a1, a2, b1, b2]
    elif kind == "xy_wing":
        bi = [i for i in range(81) if not s.g[i] and len(s.c[i]) == 2]
        for p in bi:
            X, Y = sorted(s.c[p])
            for a in bi:
                if a == p or a not in PEERS[p] or X not in s.c[a]: continue
                rest = s.c[a] - {X}
                Z = next(iter(rest))
                if Z == Y: continue
                for b in bi:
                    if b in (p, a) or b not in PEERS[p]: continue
                    if s.c[b] == {Y, Z}: yield [p, a, b]


def view_of(kind, mv):
    if kind in ("naked_2", "naked_3", "hidden_2"): return mv["unit"]
    if kind == "xy_wing": return None
    return mv["digit"]


def none_in_view(kind, s, view):
    return next(iter(shapes(kind, s, view)), None) is None


# ---------------------------------------------------------------- near misses
# Not one real pattern with a mark added, but a real position that looks like
# one. Every near miss below is a configuration you meet constantly — a box
# with one stray spot, three cells pooling to four digits, two ends that share
# a box — and each is harvested from a live board rather than manufactured, on
# the condition that the figure it draws contains NO instance of the technique
# it is filed under. The `bad` cell is the one the answer rings.
def near_pointing(s):
    for d in range(1, 10):
        for bi, b in enumerate(BOXES):
            spots = [i for i in b if not s.g[i] and d in s.c[i]]
            if not 3 <= len(spots) <= 4: continue
            for lines, word in ((ROWS, "row"), (COLS, "column")):
                for li in {row(i) if lines is ROWS else col(i) for i in spots}:
                    line = lines[li]
                    on = [i for i in spots if i in line]
                    off = [i for i in spots if i not in line]
                    if len(on) < 2 or len(off) != 1: continue
                    yield {"type": "pointing", "digit": d, "base": on, "elim": [],
                           "unit": line, "box": b, "bad": off[0],
                           "miss": "box %d has another %d off %s %d, at %s" %
                                   (bi + 1, d, word, li + 1, name(off[0]))}


def near_claiming(s):
    for d in range(1, 10):
        for lines in (ROWS, COLS):
            for line in lines:
                spots = [i for i in line if not s.g[i] and d in s.c[i]]
                if not 3 <= len(spots) <= 4: continue
                for bi in {box(i) for i in spots}:
                    b = BOXES[bi]
                    on = [i for i in spots if i in b]
                    off = [i for i in spots if i not in b]
                    if len(on) < 2 or len(off) != 1: continue
                    yield {"type": "claiming", "digit": d, "base": on, "elim": [],
                           "unit": line, "box": b, "bad": off[0],
                           "miss": "%s's %ds are not all inside box %d — there is one at %s" %
                                   (unit_word(line), d, bi + 1, name(off[0]))}


def near_naked_2(s):
    for u in UNITS:
        cells = [i for i in u if not s.g[i] and 2 <= len(s.c[i]) <= 3]
        for a, b in itertools.permutations(cells, 2):
            if len(s.c[a]) != 2 or len(s.c[b]) != 3: continue
            if not s.c[a] < s.c[b]: continue
            extra = sorted(s.c[b] - s.c[a])[0]
            yield {"type": "naked_2", "unit": u, "base": [a, b], "digits": sorted(s.c[a]),
                   "elim": [], "bad": b,
                   "miss": "%s carries a %d as well, so the two cells hold three digits between them"
                           % (name(b), extra)}


def near_naked_3(s):
    for u in UNITS:
        cells = [i for i in u if not s.g[i] and 2 <= len(s.c[i]) <= 3]
        for combo in itertools.combinations(cells, 3):
            union = set().union(*(s.c[i] for i in combo))
            if len(union) != 4: continue
            # only tempting if they overlap heavily: every pair must share a digit
            if any(not (s.c[x] & s.c[y]) for x, y in itertools.combinations(combo, 2)): continue
            odd = [d for d in union if sum(1 for i in combo if d in s.c[i]) == 1]
            if len(odd) != 1: continue
            bad = [i for i in combo if odd[0] in s.c[i]][0]
            yield {"type": "naked_3", "unit": u, "base": list(combo), "digits": sorted(union),
                   "elim": [], "bad": bad,
                   "miss": "the three pool to %s — four digits in three cells is nothing, and the "
                           "%d in %s is the one that spoils it"
                           % (digits_word(sorted(union)), odd[0], name(bad))}


def near_hidden_2(s):
    for u in UNITS:
        free = [i for i in u if not s.g[i]]
        homes = {d: [i for i in free if d in s.c[i]] for d in range(1, 10)}
        for d1 in range(1, 10):
            if len(homes[d1]) != 2: continue
            for d2 in range(1, 10):
                if d2 == d1 or len(homes[d2]) != 3: continue
                if not set(homes[d1]) < set(homes[d2]): continue
                bad = [i for i in homes[d2] if i not in homes[d1]][0]
                yield {"type": "hidden_2", "unit": u, "base": homes[d1], "digits": sorted([d1, d2]),
                       "elim": [], "bad": bad,
                       "miss": "the %d also fits %s, so the two digits have three homes between them"
                               % (d2, name(bad))}


def near_fish(s, size):
    """A line with one spot too many, which is the false positive the page warns
       about: `a line with three that happen to include your columns proves
       nothing`."""
    for d in range(1, 10):
        for lines, word, cross_word in ((ROWS, "row", "column"), (COLS, "column", "row")):
            avail = [(li, sp) for li, sp in line_spots(s, lines, d) if 2 <= len(sp) <= size + 1]
            for combo in itertools.combinations(avail, size):
                if all(len(sp) <= size for _, sp in combo): continue
                cross = {col(i) if lines is ROWS else row(i) for _, sp in combo for i in sp}
                if len(cross) != size + 1: continue
                counts = {}
                for _, sp in combo:
                    for i in sp:
                        x = col(i) if lines is ROWS else row(i)
                        counts[x] = counts.get(x, 0) + 1
                stray = [x for x, n in counts.items() if n == 1]
                if len(stray) != 1: continue
                bad = [i for _, sp in combo for i in sp
                       if (col(i) if lines is ROWS else row(i)) == stray[0]][0]
                base = [i for _, sp in combo for i in sp]
                crowded = [(li, sp) for li, sp in combo if bad in sp][0]
                yield {"type": "xwing" if size == 2 else "swordfish", "digit": d, "base": base,
                       "elim": [], "orient": "row" if lines is ROWS else "col",
                       "lines": [li for li, _ in combo], "cross": sorted(cross),
                       "spots": [sp for _, sp in combo], "bad": bad,
                       "miss": "%s has a %s %d, at %s, so the %d spreads over %s %ss instead of %s"
                               % (line_word(lines, crowded[0]), ORD[len(crowded[1])], d,
                                  name(bad), d, NUMW[size + 1], cross_word, NUMW[size])}


def near_skyscraper(s):
    """Two strong lines that meet twice, or whose loose ends share a box: an
       X-Wing and a pointing pair respectively, and the two things a skyscraper
       is most often confused with."""
    for d in range(1, 10):
        for lines, word in ((ROWS, "row"), (COLS, "column")):
            strong = [(li, sp) for li, sp in line_spots(s, lines, d) if len(sp) == 2]
            for (l1, s1), (l2, s2) in itertools.combinations(strong, 2):
                for k in range(2):
                    a1, b1 = s1[k], s1[1 - k]
                    for j in range(2):
                        a2, b2 = s2[j], s2[1 - j]
                        same = (col(a1) == col(a2)) if lines is ROWS else (row(a1) == row(a2))
                        if not same: continue
                        both = (col(b1) == col(b2)) if lines is ROWS else (row(b1) == row(b2))
                        mv = {"type": "skyscraper", "digit": d, "base": [a1, a2, b1, b2],
                              "roof": [b1, b2], "floor": [a1, a2], "elim": [], "bad": b2,
                              "orient": "row" if lines is ROWS else "col"}
                        if both:
                            yield dict(mv, flavour="xwing", miss="the loose ends %s and %s share a %s as well — "
                                                "two lines meeting twice is an X-Wing, not a skyscraper"
                                                % (name(b1), name(b2),
                                                   "column" if lines is ROWS else "row"))
                        elif box(b1) == box(b2):
                            yield dict(mv, flavour="pointing", miss="the loose ends %s and %s sit in the same box, which "
                                                "makes this a pointing pair rather than a skyscraper"
                                                % (name(b1), name(b2)))


def near_xy_wing(s):
    """A hinge with two bi-value neighbours that do not close: either they share
       no third digit, or one of them is a stranger to the hinge."""
    bi = [i for i in range(81) if not s.g[i] and len(s.c[i]) == 2]
    for p in bi:
        X, Y = sorted(s.c[p])
        for a, b in itertools.combinations([i for i in bi if i != p], 2):
            sees = (a in PEERS[p], b in PEERS[p])
            if not sees[0] and not sees[1]: continue
            if X not in s.c[a] or Y not in s.c[b]: continue
            Za, Zb = s.c[a] - {X}, s.c[b] - {Y}
            Za, Zb = next(iter(Za)), next(iter(Zb))
            if Za in (X, Y) or Zb in (X, Y): continue
            labels = {"pivot": [X, Y], "a": sorted(s.c[a]), "b": sorted(s.c[b])}
            mv = {"type": "xy_wing", "pivot": p, "wings": [a, b], "base": [p, a, b],
                  "elim": [], "labels": labels, "digit": Za}
            if Za == Zb and not (sees[0] and sees[1]):
                stranger = a if not sees[0] else b
                yield dict(mv, flavour="stranger", bad=stranger,
                           miss="%s is a stranger to the hinge — no shared row, column or box — so "
                                "the hinge cannot force it" % name(stranger))
            elif Za != Zb and sees[0] and sees[1]:
                yield dict(mv, flavour="no-third", bad=b,
                           miss="the wings are %s and %s, and they share no third digit, so nothing "
                                "is forced either way"
                                % (digits_word(labels["a"]), digits_word(labels["b"])))


NEAR = {
    "pointing": near_pointing, "claiming": near_claiming,
    "naked_2": near_naked_2, "naked_3": near_naked_3, "hidden_2": near_hidden_2,
    "xwing": lambda s: near_fish(s, 2), "swordfish": lambda s: near_fish(s, 3),
    "skyscraper": near_skyscraper, "xy_wing": near_xy_wing,
}


# ---------------------------------------------------------------- diversity
def features(inst):
    kind, mv, s = inst["kind"], inst["mv"], inst["s"]
    f = [("puzzle", inst["puzzle"]), ("elims", min(len(mv["elim"]), 3))]
    if "flavour" in mv: f.append(("flavour", mv["flavour"]))
    if "digit" in mv: f.append(("digit", mv["digit"]))
    if kind in ("naked_2", "naked_3", "hidden_2"):
        f.append(("unit", unit_kind(mv["unit"])))
        f.append(("where", mv["unit"][0]))
        f.append(("digits", tuple(mv["digits"])))
    elif kind in ("pointing", "claiming"):
        f.append(("unit", unit_kind(mv["unit"])))
        f.append(("where", box(mv["base"][0])))
        f.append(("size", len(mv["base"])))
    elif kind == "xy_wing":
        f.append(("where", box(mv["pivot"])))
        f.append(("shape", tuple(sorted(mv["labels"]["pivot"]))))
    elif kind == "skyscraper":
        f.append(("unit", mv["orient"]))
        f.append(("where", tuple(sorted(row(i) if mv["orient"] == "row" else col(i)
                                        for i in mv["floor"]))))
    else:
        f.append(("unit", mv.get("orient", "row")))
        f.append(("where", tuple(sorted(mv.get("lines", [])))))
    return f


def spread(pool, n):
    """Greedy pick for variety: at every step take the instance that repeats
       the fewest features already on the wall. Nine near-identical row X-Wings
       train nothing, which is the whole failure mode this page exists to fix."""
    chosen, used = [], {}
    for _ in range(min(n, len(pool))):
        best, bestcost = None, None
        for inst in pool:
            if inst in chosen: continue
            cost = sum(used.get(f, 0) ** 2 for f in features(inst))
            if bestcost is None or cost < bestcost:
                best, bestcost = inst, cost
        chosen.append(best)
        for f in features(best):
            used[f] = used.get(f, 0) + 1
    return chosen


# ---------------------------------------------------------------- wording
def unit_kind(u):
    if len({row(i) for i in u}) == 1: return "row"
    if len({col(i) for i in u}) == 1: return "col"
    return "box"


def unit_word(u):
    k = unit_kind(u)
    if k == "row": return "row %d" % (row(u[0]) + 1)
    if k == "col": return "column %d" % (col(u[0]) + 1)
    return "box %d" % (box(u[0]) + 1)


def line_word(lines, li):
    return ("row %d" if lines is ROWS else "column %d") % (li + 1)


NUMW = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five"}
ORD = {2: "second", 3: "third", 4: "fourth", 5: "fifth"}


def join_nums(ns):
    ns = [str(n + 1) for n in sorted(ns)]
    if len(ns) == 1: return ns[0]
    return ", ".join(ns[:-1]) + " and " + ns[-1]


def lines_word(lines, idxs):
    w = "row" if lines is ROWS else "column"
    idxs = sorted(idxs)
    return ("%s %s" if len(idxs) == 1 else "%ss %s") % (w, join_nums(idxs))


def cross_word(lines, idxs):
    return lines_word(COLS if lines is ROWS else ROWS, idxs)


def verb(cs, one, many):
    return one if len(list(cs)) == 1 else many


def cells_word(cs, cap=4):
    cs = list(cs)
    if len(cs) > cap:
        return ", ".join(name(i) for i in cs[:cap]) + " and %d more" % (len(cs) - cap)
    if len(cs) == 1: return name(cs[0])
    return ", ".join(name(i) for i in cs[:-1]) + " and " + name(cs[-1])


def digits_word(ds):
    ds = list(ds)
    if len(ds) == 1: return str(ds[0])
    return "/".join(str(d) for d in ds)


# ---------------------------------------------------------------- figures
def key(i): return "%d-%d" % (row(i) + 1, col(i) + 1)


def dual(cold, warm):
    """A cell that has to read as an ordinary square until the answer is shown.
       Both labels are in the DOM and CSS shows one — which also keeps the
       answer out of the accessibility tree while the figure is cold."""
    return '<span class="cold">%s</span><span class="warm">%s</span>' % (cold, warm)


def marks(cs, kill=()):
    """A cell's own marks, with the dying ones struck. None if it will not fit."""
    cs = sorted(cs)
    if len(cs) > MAXLAB: return None
    return "".join(("<s>%d</s>" % d) if d in kill else str(d) for d in cs)


def solo_cells(inst, ok):
    """One digit's map — the view the News+ highlight gives you, which is how
       these five are hunted in the first place."""
    s, mv = inst["s"], inst["mv"]
    d = mv["digit"]
    cells = {}
    for i in range(81):
        if s.g[i] == d: cells[key(i)] = ("p", str(d))
        elif not s.g[i] and d in s.c[i]: cells[key(i)] = ("d", str(d))
    for i in mv["base"]: cells[key(i)] = ("b", str(d))
    if inst["kind"] == "skyscraper":
        for i in mv["roof"]: cells[key(i)] = ("r", str(d))
    if ok:
        for i in mv["elim"]: cells[key(i)] = ("x", str(d))
    else:
        cells[key(inst["bad"])] = ("f", str(d))
    return cells


def unit_cells(inst, ok):
    """One unit's marks. Every cell that can be printed is printed, because a
       subset is only readable against what its neighbours hold."""
    s, mv = inst["s"], inst["mv"]
    u = mv["unit"]
    cells = {}
    dead = set(mv["digits"])
    for i in u:
        if s.g[i]:
            cells[key(i)] = ("p", str(s.g[i]))
            continue
        lab = marks(s.c[i])
        cells[key(i)] = ("d", lab if lab else "·")
    if inst["kind"] == "hidden_2":
        for i in mv["base"]:
            keep = sorted(dead & s.c[i])
            rest = sorted(s.c[i] - dead)
            warm = "".join(str(x) for x in keep) + "".join("<s>%d</s>" % x for x in rest)
            cold = marks(s.c[i]) or "·"
            cells[key(i)] = ("b", warm if ok else cold)
    else:
        for i in mv["base"]:
            cells[key(i)] = ("b", marks(s.c[i]) or "·")
        if ok:
            for i in mv["elim"]:
                lab = marks(s.c[i], dead)
                cells[key(i)] = ("xk", lab if lab else dual("·", "<s>%s</s>" % digits_word(sorted(dead & s.c[i]))))
    if not ok:
        cls, lab = cells[key(inst["bad"])]
        cells[key(inst["bad"])] = ("f", lab)
    return cells


def wing_cells(inst, ok):
    """Every two-mark square on the board — circle the bi-value cells, which is
       the standing advice for finding this one, and then read the hinges."""
    s, mv = inst["s"], inst["mv"]
    cells = {}
    for i in range(81):
        if s.g[i] or len(s.c[i]) != 2: continue
        cells[key(i)] = ("d", marks(s.c[i]))
    cells[key(mv["pivot"])] = ("b", marks(s.c[mv["pivot"]]) or "·")
    for i in mv["wings"]:
        cells[key(i)] = ("r", marks(s.c[i]) or "·")
    if ok:
        for i in mv["elim"]:
            lab = marks(s.c[i], {mv["digit"]})
            cells[key(i)] = ("xk", lab if lab else dual("·", "<s>%d</s>" % mv["digit"]))
    else:
        cls, lab = cells.get(key(inst["bad"]), ("f", marks(s.c[inst["bad"]]) or "·"))
        cells[key(inst["bad"])] = ("f", lab)
    return cells


def geometry(inst):
    kind, mv, s = inst["kind"], inst["mv"], inst["s"]
    k = lambda i: key(i)
    if kind in ("pointing", "claiming", "naked_2", "naked_3", "hidden_2"):
        b = sorted(mv["base"])
        return [seg(k(b[0]), k(b[-1]))]
    if kind == "xy_wing":
        return [seg(k(mv["pivot"]), k(mv["wings"][0])), seg(k(mv["pivot"]), k(mv["wings"][1]))]
    if kind == "skyscraper":
        f, r = mv["floor"], mv["roof"]
        return [seg(k(f[0]), k(r[0])), seg(k(f[1]), k(r[1])), seg(k(f[0]), k(f[1]), "cross")]
    # fish: along each base line, then across each crossing line
    lines = ROWS if mv["orient"] == "row" else COLS
    other = COLS if mv["orient"] == "row" else ROWS
    out = []
    for spots in mv["spots"]:
        sp = sorted(spots)
        if len(sp) > 1: out.append(seg(k(sp[0]), k(sp[-1])))
    style = "lead" if kind == "xwing" else "cross"
    for x in mv["cross"]:
        sp = sorted(i for i in mv["base"] if i in other[x])
        if len(sp) > 1: out.append(seg(k(sp[0]), k(sp[-1]), style))
    return out


def tint_of(inst):
    kind, mv = inst["kind"], inst["mv"]
    if kind == "pointing": return ("box", box(mv["base"][0]))
    if kind == "claiming":
        u = mv["unit"]
        return ("row", row(u[0]) + 1) if unit_kind(u) == "row" else ("col", col(u[0]) + 1)
    if kind in ("naked_2", "naked_3", "hidden_2"):
        u, k = mv["unit"], unit_kind(mv["unit"])
        if k == "row": return ("row", row(u[0]) + 1)
        if k == "col": return ("col", col(u[0]) + 1)
        return ("box", box(u[0]))
    return None


SOLO = ("pointing", "claiming", "xwing", "swordfish", "skyscraper")


def figure(inst, ok):
    if inst["kind"] in SOLO: cells = solo_cells(inst, ok)
    elif inst["kind"] == "xy_wing": cells = wing_cells(inst, ok)
    else: cells = unit_cells(inst, ok)
    return dict(cap=cold_cap(inst), cells=cells, tint=tint_of(inst), geo=geometry(inst))


# ---------------------------------------------------------------- captions
def cold_cap(inst):
    kind, mv = inst["kind"], inst["mv"]
    if kind in SOLO: return "the %ds" % mv["digit"]
    if kind == "xy_wing": return "every two-mark square"
    return "the marks in %s" % unit_word(mv["unit"])


def warm_cap(inst, ok):
    kind, mv = inst["kind"], inst["mv"]
    if not ok:
        # a square reference keeps its lower-case r: `R3c2` is not how this
        # site writes one. Anything else takes a capital.
        miss = inst["miss"]
        if not re.match(r"r\d c?\d|r\d+c\d+", miss): miss = miss[0].upper() + miss[1:]
        return "<b>No.</b> " + miss + "."
    d = mv.get("digit")
    if kind == "pointing":
        return ("<b>Yes.</b> Box %d keeps its %ds in %s, so the %d leaves %s." %
                (box(mv["base"][0]) + 1, d, unit_word(mv["unit"]), d,
                 cells_word(sorted(mv["elim"]))))
    if kind == "claiming":
        return ("<b>Yes.</b> %s keeps its %ds inside box %d, so the %d leaves %s." %
                (unit_word(mv["unit"])[0].upper() + unit_word(mv["unit"])[1:], d,
                 box(mv["base"][0]) + 1, d, cells_word(sorted(mv["elim"]))))
    if kind in ("naked_2", "naked_3"):
        return ("<b>Yes.</b> %s hold only %s between them, so those digits leave %s." %
                (cells_word(sorted(mv["base"])), digits_word(mv["digits"]),
                 cells_word(sorted(mv["elim"]))))
    if kind == "hidden_2":
        keep = set(mv["digits"])
        lost = "; ".join("%s loses its %s" % (name(i), digits_word(sorted(inst["s"].c[i] - keep)))
                         for i in sorted(mv["elim"]))
        return ("<b>Yes.</b> In %s, %s can only go in %s — so %s." %
                (unit_word(mv["unit"]), digits_word(mv["digits"]), cells_word(sorted(mv["base"])),
                 lost))
    if kind in ("xwing", "swordfish"):
        lines = ROWS if mv["orient"] == "row" else COLS
        return ("<b>Yes.</b> The %ds in %s are confined to %s, so the %d leaves %s." %
                (d, lines_word(lines, mv["lines"]), cross_word(lines, mv["cross"]),
                 d, cells_word(mv["elim"])))
    if kind == "skyscraper":
        lines = ROWS if mv["orient"] == "row" else COLS
        li = [row(i) if mv["orient"] == "row" else col(i) for i in mv["floor"]]
        head = lines_word(lines, li)
        return ("<b>Yes.</b> %s%s have two %ds each and share one end, so one of "
                "%s is the %d — and %s, seeing both, cannot be." %
                (head[0].upper(), head[1:], d, cells_word(sorted(mv["roof"])), d,
                 cells_word(sorted(mv["elim"]))))
    lab = mv["labels"]
    return ("<b>Yes.</b> Hinge %s (%s) sees %s (%s) and %s (%s), so one wing is the %d "
            "and %s %s it." %
            (name(mv["pivot"]), digits_word(lab["pivot"]), name(mv["wings"][0]),
             digits_word(lab["a"]), name(mv["wings"][1]), digits_word(lab["b"]),
             mv["digit"], cells_word(sorted(mv["elim"])), verb(mv["elim"], "loses", "lose")))


# ---------------------------------------------------------------- the nine
# Anchors match the cheat sheet's card ids, so the two pages link both ways.
# The prose here is the gallery's own job: one line on what the shape is, and
# one on the way it lies to you — which is what the three near misses in every
# row are drawn from.
TECH = [
    dict(id="pointing", kind="pointing", n="02", family="Interaction", title="Pointing pair",
         what="Inside one box, a digit's only homes sit in a single row or column.",
         guard="Count the box first. A third spot for the digit anywhere else in the box, on any other line, and there is nothing here."),
    dict(id="claiming", kind="claiming", n="03", family="Interaction", title="Claiming",
         what="Along one line, a digit's only homes sit inside a single box.",
         guard="Easy to run backwards. It is the rest of the <b>box</b> that loses the digit, and only if the line has no spot for it outside that box."),
    dict(id="naked-pair", kind="naked_2", n="04", family="Subset", title="Naked pair",
         what="Two cells in one unit hold the same two candidates and nothing else.",
         guard="Both cells must hold <b>nothing but</b> those two digits. A 3/8/9 beside a 3/8 is not half a pair — it is a target."),
    dict(id="naked-triple", kind="naked_3", n="05", family="Subset", title="Naked triple",
         what="Three cells pooling to exactly three candidates — no cell needs all three.",
         guard="A cell with four or more marks can never join a triple, and three cells pooling to <b>four</b> digits is the commonest false positive here."),
    dict(id="hidden-pair", kind="hidden_2", n="06", family="Subset", title="Hidden pair",
         what="Two digits in a unit with only two possible cells between them, buried under other marks.",
         guard="Read the whole unit, not the two cells. A third home anywhere for either digit and the pair is not hidden — it is not there."),
    dict(id="x-wing", kind="xwing", n="07", family="Single digit", title="X-Wing",
         what="One digit, two lines with exactly two spots each, landing in the same two crossing lines.",
         guard="<b>Exactly</b> two spots per line. A line with three that happen to include your columns proves nothing."),
    dict(id="swordfish", kind="swordfish", n="08", family="Single digit", title="Swordfish",
         what="The X-Wing grown by one: three lines, two or three spots each, confined to three crossing lines.",
         guard="Three lines pooling to <b>four</b> crossings is not a swordfish, and that is what most of them turn out to be."),
    dict(id="skyscraper", kind="skyscraper", n="09", family="Single digit", title="Skyscraper",
         what="Two lines with two spots each, sharing one crossing line. One of the two loose ends must be the digit.",
         guard="Test the loose ends. Sharing the second crossing too is an X-Wing; sharing a box is a pointing pair."),
    dict(id="xy-wing", kind="xy_wing", n="10", family="Chain", title="XY-Wing",
         what="Three two-candidate cells forming a hinge: XY sees XZ and YZ.",
         guard="The hinge must see both wings, all three cells must have exactly two marks, and the wings must share a digit the hinge does <b>not</b> hold."),
]


# ---------------------------------------------------------------- rendering
def spot_html(inst, ok):
    fig = figure(inst, ok)
    cold = html.escape(cold_cap(inst))
    warm = warm_cap(inst, ok)
    return ('<figure class="spot" data-state="hidden">'
            '<button class="spotbtn" type="button" aria-expanded="false" '
            'aria-label="Show the answer for this position: %s">%s</button>'
            '<figcaption class="figcap">'
            '<span class="cold">%s</span>'
            '<span class="warm %s">%s</span>'
            '</figcaption></figure>' % (cold, mini(fig), cold, "yes" if ok else "no", warm))


def section_html(t, figs):
    spots = "".join(spot_html(inst, ok) for inst, ok in figs)
    return '''
  <section class="galsec" id="%s">
    <div class="galintro">
      <span class="eyebrow"><i>%s</i> %s</span>
      <h2><a href="index.html#%s">%s</a></h2>
      <p class="what">%s</p>
      <p class="guard"><span>Where it goes wrong</span>%s</p>
      <button class="reveal galall" type="button">Show all nine</button>
    </div>
    <div class="spots">%s</div>
  </section>''' % (t["id"], t["n"], t["family"], t["id"], t["title"], t["what"], t["guard"], spots)


PAGE = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pattern gallery — Advanced Sudoku Techniques</title>
<meta name="description" content="Nine positions per technique — six real, three near misses — with the answer hidden until you ask. Recognition practice for the nine patterns.">
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
<body>
<div class="gal">

  <div class="sitebar">
    <span class="mark"><span class="mark-long">Advanced Sudoku <em>Techniques</em></span><span class="mark-short">AST</span></span>
    <nav>
      <a href="index.html">Patterns</a>
      <a href="trainer.html">Trainer</a>
      <a href="cheatsheet.html">Cheat sheet</a>
      <a href="gallery.html" aria-current="page">Gallery</a>
      <a href="check.html">Check</a>
    </nav>
  </div>

  <header class="galhero">
    <p class="kicker">Advanced Sudoku Techniques · recognition drill</p>
    <h1>Nine of each. <em>Three are lying.</em></h1>
    <p class="lede">The reference shows every technique once, on one clean position, and one position is not enough to train an eye. Here is each of the nine on nine boards: <b>six are the real thing and three are not</b>, shuffled, with the answer hidden. Read the figure, decide, then tap it.</p>
    <p class="lede">The near misses are the point, and none of them is manufactured: each is a real position holding the thing that gets mistaken for the technique — a box with one stray spot, three cells pooling to four digits, two lines that meet twice. Each figure is checked to contain no instance of the technique it is filed under, so a <b>no</b> is a no about the whole picture. If you can tell those three from the six, you can trust yourself at the puzzle.</p>
    <div class="legend cribleg">
      <p><span class="swatch b"></span> Amber cells are the pattern you were asked about</p>
      <p><span class="swatch l"></span> Amber lines show how it connects</p>
      <p><span class="swatch p"></span> Ringed cells are the loose ends of a chain</p>
      <p><span class="swatch k"></span> Struck red digits are what it kills</p>
      <p><span class="swatch f"></span> A red ring is the mark that breaks it</p>
      <p><span class="swatch n"></span> Grey is the rest of the position; a dot is a cell with more marks than fit</p>
    </div>
    <p class="galnote">Single-digit figures show one digit's whole map, the way the News+ highlight does. Subset figures show one unit's marks. XY-Wing figures show every two-mark square on the board. Positions are real, and every elimination claimed is checked against the puzzle's solution before the figure is drawn — see <code>tools/gallery.py</code>.</p>
  </header>

<nav aria-label="Techniques">%s</nav>
%s

  <footer>
    <p>Recognition is a visual skill, so treat this as reps rather than reading: cover the captions, work a row of nine, and only then check. When you want to test a position you are actually looking at rather than one of these, the <a href="check.html">pattern check</a> takes the cells and marks you can see and audits them condition by condition. Square references use <code>r5c3</code> for row 5, column 3.</p>
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
<script src="assets/js/pwa.js" defer></script>
</body>
</html>
'''


# ---------------------------------------------------------------- main
def main(seed=20250908, per_tech=18, per_near=12, positives=6, misses=3):
    rng = random.Random(seed)
    kinds = [t["kind"] for t in TECH]
    yes, no, puzzles = harvest(seed, kinds, per_tech, per_near)
    sections, report = [], []
    for t in TECH:
        got, wrong = yes[t["kind"]], no[t["kind"]]
        picks = spread(got, positives)
        near = spread(wrong, misses)
        if len(picks) < positives or len(near) < misses:
            raise SystemExit("%s: only %d real and %d near misses (%d/%d harvested)"
                             % (t["kind"], len(picks), len(near), len(got), len(wrong)))
        figs = [(i, True) for i in picks] + [(i, False) for i in near]
        rng.shuffle(figs)
        sections.append(section_html(t, figs))
        report.append("  %-11s %d real of %d harvested, %d near of %d"
                      % (t["kind"], len(picks), len(got), len(near), len(wrong)))
    nav = "".join('<a href="#%s">%s</a>' % (t["id"], t["title"]) for t in TECH)
    out = PAGE % (nav, "".join(sections))
    open("../gallery.html", "w").write(out)
    print("gallery.html", len(out), "bytes, from", puzzles, "puzzles")
    print("\n".join(report))


if __name__ == "__main__":
    main()
