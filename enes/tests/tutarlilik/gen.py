import json,numpy as np
rng=np.random.default_rng(7);cases=[]
for k in range(2000):
    n=int(rng.integers(1,15))
    cases.append(dict(p=rng.beta(1.5,3,n).round(6).tolist(),tt=rng.uniform(5,45,n).round(3).tolist(),
      load=rng.integers(0,12,n).tolist(),vis=rng.integers(0,5,n).tolist()))
json.dump(cases,open('/tmp/tutarlilik/cases.json','w'))
