const fs=require('fs');eval(fs.readFileSync('/tmp/tutarlilik/rankC.js','utf8')+';globalThis.rankC=rankC;');
const V5_CFG={a:0.6,b:0.06,c:0.15,alpha:0.95};
let CUR;globalThis.V5_CFG=V5_CFG;
globalThis.scoreModel=(m,c)=>c.map(x=>CUR.p[x.i]);
globalThis.travelMin=(a)=>CUR.tt[a];
const cases=JSON.parse(fs.readFileSync('/tmp/tutarlilik/cases.json'));const out=[];
for(const c of cases){CUR=c;const n=c.p.length;const load={};
 const cands=[...Array(n).keys()].map(i=>{load[i]=c.load[i];return{i,loc:i,w:{id:i,blocks:Array(c.vis[i]).fill({plat:true})}}});
 out.push(rankC("model5",cands,{loc:0},0,{},null,null,load,0).slice(0,3).map(x=>x.w.id));}
fs.writeFileSync('/tmp/tutarlilik/js.json',JSON.stringify(out));
