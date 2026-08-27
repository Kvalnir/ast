import random, json, engine
from engine import *

ADV = {"xwing","swordfish","xy_wing","skyscraper"}

def trace(grid):
    s=State(grid); seq=[]; guard=0
    while guard<600:
        guard+=1
        mv=None
        for nm,fn in BASIC:
            mv=fn(s)
            if mv: break
        if mv is None:
            for nm,fn in ADVANCED:
                mv=fn(s)
                if mv: break
        if mv is None: return None
        seq.append(mv["type"]); apply(s,mv)
        if all(s.g): return seq
    return None

def solution(p):
    g=p[:]
    def rec():
        best=-1;bc=None
        for i in range(81):
            if g[i]==0:
                used={g[q] for q in PEERS[i] if g[q]}
                c=[d for d in range(1,10) if d not in used]
                if not c: return False
                if bc is None or len(c)<len(bc): best,bc=i,c
        if best==-1: return True
        for d in bc:
            g[best]=d
            if rec(): return True
            g[best]=0
        return False
    rec(); return g

SINGLES = {"naked_single","hidden_single"}

def tier_of(uniq, adv):
    """The four the trainer offers, named for what the puzzle asks of you rather
    than for how it feels: easy needs nothing but singles, normal adds the
    interactions and subsets, and the two hard tiers are separated by how many
    of the advanced patterns you have to find. Mirrored in JS by tierOf() —
    change one and change the other."""
    if len(adv) >= 2: return "extra"
    if len(adv) == 1: return "challenging"
    if any(x not in SINGLES for x in uniq): return "normal"
    return "easy"

PER_TIER = 8

bank=[]
rng=random.Random(4242)
tiers={}
shapes={}
for t in range(4000):
    p=engine.make_puzzle(rng)
    seq=trace(p)
    if not seq: continue
    uniq=sorted(set(seq))
    adv=sorted(ADV & set(uniq))
    tier=tier_of(uniq, adv)
    if tiers.get(tier,0) >= PER_TIER: continue
    # spread the hard tiers over different patterns rather than eight of one
    key=(tier, tuple(adv))
    if adv and shapes.get(key,0) >= 3: continue
    shapes[key]=shapes.get(key,0)+1
    tiers[tier]=tiers.get(tier,0)+1
    hardest = "advanced" if adv else ("intermediate" if any(x not in SINGLES for x in uniq) else "basic")
    bank.append({"p":"".join(map(str,p)),"s":"".join(map(str,solution(p))),
                 "t":uniq,"adv":adv,"level":hardest,"tier":tier,
                 "givens":sum(1 for x in p if x)})
    if len(bank) >= PER_TIER*4: break

ORDER={"easy":0,"normal":1,"challenging":2,"extra":3}
bank.sort(key=lambda b:(ORDER[b["tier"]], -len(b["adv"]), b["givens"]))
json.dump(bank, open("bank.json","w"))
print(len(bank), {k:v for k,v in sorted(tiers.items())})
for b in bank: print(" ", b["tier"], b["givens"], b["adv"] or b["t"])
