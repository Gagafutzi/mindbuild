const place=(P,root,dim)=>{const pos={[root]:Array(dim).fill(0)};let ch=true;while(ch){ch=false;for(const [s,r,v] of P){
  if(pos[r]&&!pos[s]){pos[s]=pos[r].map((x,i)=>x+v[i]);ch=true}else if(pos[s]&&!pos[r]){pos[r]=pos[s].map((x,i)=>x-v[i]);ch=true}}}return pos};
// ---- frames-B CLOCKS: marked premises state dtau = dt + dx. Per-axis readers vs truth.
{
  const S=[['Eve','Fay',[-1,-1,-1,1],1],['Cole','Ash',[1,-1,1,-1],0],['Dell','Ash',[-1,-1,-1,-1],0],['Eve','Bell',[-1,0,0,-1],1],['Ash','Bell',[1,-1,1,-1],1]];
  const lit=place(S.map(([s,r,v])=>[s,r,v]),'Fay',4), tru=place(S.map(([s,r,v,m])=>[s,r,m?[v[0],v[1],v[2],v[3]-v[0]]:v]),'Fay',4);
  const tauMinusX=(lit.Fay[3]-lit.Dell[3])-(lit.Fay[0]-lit.Dell[0]);
  console.log('CLOCKS Fay-Dell time: literal',lit.Fay[3]-lit.Dell[3],'| endpoint tau-minus-x shortcut',tauMinusX,'| true',tru.Fay[3]-tru.Dell[3],'(designer: later)');
}
// ---- frames-B BARGE: aboard premises state dx' = dx - dt.  Question asked aboard.
{
  const S=[['Dell','Cole',[-1,1,-1,-1],1],['Dell','Fay',[-1,1,-1,-1],0],['Bell','Cole',[-1,-1,-1,-1],0],['Eve','Ash',[-1,-1,-1,0],1],['Bell','Ash',[0,-1,1,1],0]];
  const w=place(S.map(([s,r,v,m])=>[s,r,m?[v[0]+v[3],v[1],v[2],v[3]]:v]),'Fay',4);
  const d=w.Eve.map((x,i)=>x-w.Fay[i]); console.log('BARGE Eve-Fay world',d,'aboard east',d[0]-d[3],'(designer: east, +1)');
}
// ---- LIGHT CONE (a) and (b)
{
  const P=[['Ash','Bell',[1,1,1,-1]],['Cane','Bell',[-1,-1,-1,1]],['Ash','Dune',[1,1,-1,1]],['Ash','Elm',[0,1,-1,-3]]];
  const p=place(P,'Bell',4); const d=p.Cane.map((x,i)=>x-p.Dune[i]); const l1=Math.abs(d[0])+Math.abs(d[1])+Math.abs(d[2]);
  console.log('CONE (a) Cane-Dune',d,'taxicab',l1,'time',d[3],'reach?',l1<=d[3],'| per-axis (Chebyshev)',Math.max(...d.slice(0,3).map(Math.abs))<=d[3]);
  // (b) signals: time gap = taxicab of the premise
  const sp=[['Ash','Bell',[1,-1,1]],['Bell','Cane',[0,1,-1]]].map(([s,r,v])=>[s,r,[...v,v.reduce((a,x)=>a+Math.abs(x),0)]]);
  const q=place([...sp,['Dune','Bell',[-1,1,1,1]],['Elm','Dune',[1,1,-1,0]]],'Cane',4);
  const e=q.Dune.map((x,i)=>x-q.Cane[i]);const L=Math.abs(e[0])+Math.abs(e[1])+Math.abs(e[2]);
  console.log('CONE (b) Dune-Cane',e,'taxicab',L,'reach?',L<=e[3],'| route-sum reading: premise steps',3+2+3,'> time');
}
// ---- WORLDLINES level: brute force over hours on positions p(t)=p0+v t
{
  const v={Ash:[1,1],Bell:[1,0],Cane:[0,0],Dune:[0,0]};
  const S=[['Ash','Bell',5,[-1,-1]],['Cane','Bell',4,[0,1]],['Dune','Cane',5,[-1,-1]]];
  const p0={Ash:[0,0]};let ch=true;while(ch){ch=false;for(const [s,r,h,d] of S){
    if(p0[r]&&!p0[s]){p0[s]=p0[r].map((x,i)=>x+v[r][i]*h+d[i]-v[s][i]*h);ch=true}else if(p0[s]&&!p0[r]){p0[r]=p0[s].map((x,i)=>x+v[s][i]*h-d[i]-v[r][i]*h);ch=true}}}
  const at=(o,t)=>p0[o].map((x,i)=>x+v[o][i]*t);
  for(let t=-50;t<=50;t++) if(at('Cane',t)[1]===at('Ash',t)[1]) console.log('WORLDLINES level: Cane level with Ash N-S at hour',t,'; Ash east of Cane?',at('Ash',t)[0]-at('Cane',t)[0],'| static chain Ash-Cane east',-1-0);
}
// ---- dynamics LOCAL CLOCKS (ring m=4): solve by carrying each axis separately and combining once at the end
{
  const m=4, zone={Dune:2}; zone.Cane=((zone.Dune-1-1)%m+m)%m+1; zone.Bell=((zone.Cane-1-1)%m+m)%m+1;
  const clockSum=0+2; // Bell->Cane same reading, Cane->Dune +2
  console.log('LOCAL CLOCKS per-axis carry then one subtraction: zones Bell',zone.Bell,'Dune',zone.Dune,'-> real gap',clockSum-(zone.Dune-zone.Bell),'(designer 4) -- telescopes: only endpoint zones enter');
}
