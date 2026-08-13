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

bank=[]
rng=random.Random(4242)
counts={}
for t in range(600):
    p=engine.make_puzzle(rng)
    seq=trace(p)
    if not seq: continue
    uniq=sorted(set(seq))
    adv=sorted(ADV & set(uniq))
    hardest = "advanced" if adv else ("intermediate" if any(x in uniq for x in ("naked_2","hidden_2","naked_3","hidden_3")) else "basic")
    if hardest=="basic": continue
    key=tuple(adv) if adv else ("subset",)
    if counts.get(key,0)>=4: continue
    counts[key]=counts.get(key,0)+1
    bank.append({"p":"".join(map(str,p)),"s":"".join(map(str,solution(p))),
                 "t":uniq,"adv":adv,"level":hardest,
                 "givens":sum(1 for x in p if x)})
    if len(bank)>=34: break

bank.sort(key=lambda b:(b["level"]!="advanced", -len(b["adv"]), b["givens"]))
json.dump(bank, open("bank.json","w"))
print(len(bank))
for b in bank[:40]: print(b["level"], b["givens"], b["adv"] or b["t"])
