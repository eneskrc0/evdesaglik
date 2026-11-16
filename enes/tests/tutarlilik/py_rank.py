import json,sys,numpy as np
sys.path.insert(0,'/home/claude/evde-saglik')
import sim.engine as E
cfg={"a":0.6,"b":0.06,"c":0.15,"alpha":0.95}
cases=json.load(open('/tmp/tutarlilik/cases.json'));out=[]
class W:
    def __init__(s,i,v): s.id=i; s.blocks=[(0,0,0,True)]*v
class M:
    def __init__(s,p): s.p=np.array(p)
    def predict_proba(s,X): return np.c_[1-s.p,s.p]
class R: pass
for c in cases:
    n=len(c['p']);cands=[{"w":W(i,c['vis'][i]),"exp_arrival":0,"_tt":c['tt'][i]} for i in range(n)]
    res=R();res.notif_per_worker={i:c['load'][i] for i in range(n)}
    E.features=lambda cc,req,t,hist: [cc["_tt"]]+[0]*11
    class Q: win_end=60
    o=E.select_with_policy(cands,Q,0,{},M(c['p']),res,cfg)
    out.append([x["w"].id for x in o[:3]])
json.dump(out,open('/tmp/tutarlilik/py.json','w'))
