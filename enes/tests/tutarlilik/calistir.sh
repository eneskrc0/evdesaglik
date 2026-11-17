#!/bin/sh
# Demo (JavaScript) ile deney (Python) v5 seçim kuralları aynı mı? + uçtan uca demo provası
set -e; cd "$(dirname "$0")/../.."; mkdir -p /tmp/tutarlilik
python3 tests/tutarlilik/gen.py
python3 tests/tutarlilik/py_rank.py
python3 -c "s=open('web/index.html').read();i=s.index('function rankC(');j=s.index('function runDay(');open('/tmp/tutarlilik/rankC.js','w').write(s[i:j])"
node tests/tutarlilik/js_rank.js
python3 -c "import json;a=json.load(open('/tmp/tutarlilik/py.json'));b=json.load(open('/tmp/tutarlilik/js.json'));print('Aynı ilk 3:',sum(x==y for x,y in zip(a,b)),'/',len(a))"
python3 tests/tutarlilik/e2e.py "$PWD/web/dist/bornova.html"   # playwright + Chrome gerekir
python3 tests/tutarlilik/track_test.py "$PWD/web/dist/bornova.html"   # canlı takip
python3 tests/tutarlilik/transit_test.py "$PWD/web/dist/izmir.html"   # toplu taşıma: JS = Python matrisi + takip
