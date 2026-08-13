import random, itertools, json, copy

ROWS = [[r*9+c for c in range(9)] for r in range(9)]
COLS = [[r*9+c for r in range(9)] for c in range(9)]
BOXES = []
for br in range(3):
    for bc in range(3):
        BOXES.append([(br*3+r)*9+(bc*3+c) for r in range(3) for c in range(3)])
UNITS = ROWS + COLS + BOXES

PEERS = [set() for _ in range(81)]
for u in UNITS:
    for a in u:
        for b in u:
            if a != b:
                PEERS[a].add(b)

def row(i): return i//9
def col(i): return i%9
def box(i): return (i//9//3)*3 + (i%9)//3

def solve_count(grid, limit=2):
    g = grid[:]
    def cands(i):
        used = set()
        for p in PEERS[i]:
            if g[p]: used.add(g[p])
        return [d for d in range(1,10) if d not in used]
    def rec():
        best, bestc = -1, None
        for i in range(81):
            if g[i] == 0:
                c = cands(i)
                if len(c) == 0: return 0
                if bestc is None or len(c) < len(bestc):
                    best, bestc = i, c
                    if len(c) == 1: break
        if best == -1: return 1
        n = 0
        for d in bestc:
            g[best] = d
            n += rec()
            g[best] = 0
            if n >= limit: break
        return n
    return rec()

def full_grid(rng):
    g = [0]*81
    def rec(i):
        if i == 81: return True
        used = set()
        for p in PEERS[i]:
            if g[p]: used.add(g[p])
        opts = [d for d in range(1,10) if d not in used]
        rng.shuffle(opts)
        for d in opts:
            g[i] = d
            if rec(i+1): return True
            g[i] = 0
        return False
    rec(0)
    return g

def make_puzzle(rng):
    g = full_grid(rng)
    order = list(range(81))
    rng.shuffle(order)
    for i in order:
        keep = g[i]
        g[i] = 0
        if solve_count(g) != 1:
            g[i] = keep
    return g

# ---------- candidate state ----------
class State:
    def __init__(self, grid):
        self.g = grid[:]
        self.c = [set() if grid[i] else set(range(1,10)) for i in range(81)]
        for i in range(81):
            if grid[i]:
                for p in PEERS[i]:
                    self.c[p].discard(grid[i])
    def place(self, i, d):
        self.g[i] = d
        self.c[i] = set()
        for p in PEERS[i]:
            self.c[p].discard(d)
    def clone(self):
        s = State.__new__(State)
        s.g = self.g[:]
        s.c = [set(x) for x in self.c]
        return s
    def snapshot(self):
        return {"g": self.g[:], "c": [sorted(x) for x in self.c]}

def name(i): return "r%dc%d" % (row(i)+1, col(i)+1)

# ---------- basic techniques ----------
def naked_single(s):
    for i in range(81):
        if not s.g[i] and len(s.c[i]) == 1:
            return {"type":"naked_single","cell":i,"digit":next(iter(s.c[i]))}
    return None

def hidden_single(s):
    for u in UNITS:
        for d in range(1,10):
            spots = [i for i in u if not s.g[i] and d in s.c[i]]
            if len(spots) == 1 and not any(s.g[i]==d for i in u):
                return {"type":"hidden_single","cell":spots[0],"digit":d,"unit":u}
    return None

def locked_candidates(s):
    # pointing: box -> line ; claiming: line -> box
    for b_idx, b in enumerate(BOXES):
        for d in range(1,10):
            spots = [i for i in b if not s.g[i] and d in s.c[i]]
            if len(spots) < 2: continue
            for line in (ROWS[row(spots[0])], COLS[col(spots[0])]):
                if all(i in line for i in spots):
                    elim = [i for i in line if i not in b and not s.g[i] and d in s.c[i]]
                    if elim:
                        return {"type":"pointing","digit":d,"base":spots,"elim":elim,"unit":line,"box":b}
    for line in ROWS+COLS:
        for d in range(1,10):
            spots = [i for i in line if not s.g[i] and d in s.c[i]]
            if len(spots) < 2: continue
            b = BOXES[box(spots[0])]
            if all(i in b for i in spots):
                elim = [i for i in b if i not in line and not s.g[i] and d in s.c[i]]
                if elim:
                    return {"type":"claiming","digit":d,"base":spots,"elim":elim,"unit":line,"box":b}
    return None

def naked_subset(s, size):
    for u in UNITS:
        cells = [i for i in u if not s.g[i] and len(s.c[i]) <= size and len(s.c[i]) >= 2]
        for combo in itertools.combinations(cells, size):
            union = set()
            for i in combo: union |= s.c[i]
            if len(union) == size:
                elim = []
                for i in u:
                    if i in combo or s.g[i]: continue
                    if s.c[i] & union:
                        elim.append(i)
                if elim:
                    return {"type":"naked_%d"%size,"base":list(combo),"digits":sorted(union),
                            "elim":elim,"unit":u}
    return None

def hidden_subset(s, size):
    for u in UNITS:
        free = [i for i in u if not s.g[i]]
        digs = [d for d in range(1,10) if any(d in s.c[i] for i in free)]
        for combo in itertools.combinations(digs, size):
            spots = set()
            for d in combo:
                spots |= {i for i in free if d in s.c[i]}
            if len(spots) == size and all(len({d for d in combo if d in s.c[i]})>=1 for i in spots):
                elim = [i for i in spots if s.c[i] - set(combo)]
                if elim:
                    return {"type":"hidden_%d"%size,"base":sorted(spots),"digits":sorted(combo),
                            "elim":elim,"unit":u}
    return None

# ---------- fish ----------
def fish(s, size):
    for d in range(1,10):
        for lines, other in ((ROWS, COLS), (COLS, ROWS)):
            avail = []
            for li, line in enumerate(lines):
                spots = [i for i in line if not s.g[i] and d in s.c[i]]
                if 2 <= len(spots) <= size:
                    avail.append((li, spots))
            for combo in itertools.combinations(avail, size):
                cross = set()
                for _, spots in combo:
                    for i in spots:
                        cross.add(col(i) if lines is ROWS else row(i))
                if len(cross) != size: continue
                base = [i for _, spots in combo for i in spots]
                elim = []
                for x in cross:
                    line = other[x]
                    for i in line:
                        if i in base or s.g[i]: continue
                        if d in s.c[i]: elim.append(i)
                if elim:
                    return {"type":"xwing" if size==2 else ("swordfish" if size==3 else "jellyfish"),
                            "digit":d,"base":base,"elim":elim,
                            "orient":"row" if lines is ROWS else "col",
                            "lines":[li for li,_ in combo],"cross":sorted(cross)}
    return None

# ---------- wings ----------
def xy_wing(s):
    bi = [i for i in range(81) if not s.g[i] and len(s.c[i])==2]
    for p in bi:
        X, Y = sorted(s.c[p])
        for a in bi:
            if a == p or a not in PEERS[p]: continue
            if X not in s.c[a]: continue
            Z = (s.c[a] - {X})
            if len(Z)!=1: continue
            Z = next(iter(Z))
            if Z == Y: continue
            for b in bi:
                if b in (p,a) or b not in PEERS[p]: continue
                if s.c[b] != {Y, Z}: continue
                elim = [i for i in range(81) if not s.g[i] and i not in (p,a,b)
                        and i in PEERS[a] and i in PEERS[b] and Z in s.c[i]]
                if elim:
                    return {"type":"xy_wing","pivot":p,"wings":[a,b],"digit":Z,
                            "elim":elim,"base":[p,a,b],
                            "labels":{"pivot":[X,Y],"a":[X,Z],"b":[Y,Z]}}
    return None

def skyscraper(s):
    for d in range(1,10):
        for lines, other in ((ROWS,COLS),(COLS,ROWS)):
            strong = []
            for li,line in enumerate(lines):
                spots=[i for i in line if not s.g[i] and d in s.c[i]]
                if len(spots)==2: strong.append((li,spots))
            for (l1,s1),(l2,s2) in itertools.combinations(strong,2):
                for k in range(2):
                    a1,b1 = s1[k], s1[1-k]
                    for j in range(2):
                        a2,b2 = s2[j], s2[1-j]
                        # a1,a2 share the cross-line (the "base"), b1,b2 are the roof
                        same = (col(a1)==col(a2)) if lines is ROWS else (row(a1)==row(a2))
                        if not same: continue
                        diff = (col(b1)!=col(b2)) if lines is ROWS else (row(b1)!=row(b2))
                        if not diff: continue
                        if box(b1)==box(b2): continue
                        elim=[i for i in range(81) if not s.g[i] and d in s.c[i]
                              and i not in (a1,a2,b1,b2)
                              and i in PEERS[b1] and i in PEERS[b2]]
                        if elim:
                            return {"type":"skyscraper","digit":d,"base":[a1,a2,b1,b2],
                                    "roof":[b1,b2],"floor":[a1,a2],"elim":elim,
                                    "orient":"row" if lines is ROWS else "col"}
    return None

# ---------- solve loop ----------
BASIC = [
    ("naked_single", naked_single),
    ("hidden_single", hidden_single),
    ("pointing", locked_candidates),
    ("naked_2", lambda s: naked_subset(s,2)),
    ("hidden_2", lambda s: hidden_subset(s,2)),
    ("naked_3", lambda s: naked_subset(s,3)),
    ("hidden_3", lambda s: hidden_subset(s,3)),
]
ADVANCED = [
    ("xwing", lambda s: fish(s,2)),
    ("skyscraper", skyscraper),
    ("xy_wing", xy_wing),
    ("swordfish", lambda s: fish(s,3)),
]

def apply(s, mv):
    t = mv["type"]
    if t in ("naked_single","hidden_single"):
        s.place(mv["cell"], mv["digit"])
        return
    if t in ("pointing","claiming","xwing","swordfish","jellyfish","xy_wing","skyscraper"):
        d = mv["digit"]
        for i in mv["elim"]: s.c[i].discard(d)
        return
    if t.startswith("naked_") or t.startswith("hidden_"):
        ds = set(mv["digits"])
        if t.startswith("naked_"):
            for i in mv["elim"]: s.c[i] -= ds
        else:
            for i in mv["elim"]: s.c[i] &= ds
        return
    raise ValueError(t)

def run(grid, want):
    """Solve with basics; when stuck, try advanced. Record first clean example of each wanted type."""
    s = State(grid)
    found = {}
    guard = 0
    while guard < 500:
        guard += 1
        mv = None
        for nm, fn in BASIC:
            mv = fn(s)
            if mv: break
        if mv is None:
            for nm, fn in ADVANCED:
                mv = fn(s)
                if mv:
                    if mv["type"] in want and mv["type"] not in found:
                        found[mv["type"]] = {"move": mv, "state": s.snapshot()}
                    break
        else:
            if mv["type"] in want and mv["type"] not in found:
                found[mv["type"]] = {"move": mv, "state": s.snapshot()}
        if mv is None:
            break
        apply(s, mv)
        if all(s.g): break
    return found, all(s.g)
