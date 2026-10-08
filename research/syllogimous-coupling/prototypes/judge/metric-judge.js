// Independent re-solve of the metric designer's examples, with a per-axis reader for each.
const AX=['x','y','z','t'];
function place(P,root,axes){ // P: [subj, ref, vec (null entries = unstated)] -> per-axis union of known offsets
  const out={};for(const a of axes){const pos={[root]:0};let ch=true;
    while(ch){ch=false;for(const [s,r,v] of P){const d=v[a];if(d===null||d===undefined)continue;
      if(pos[r]!==undefined&&pos[s]===undefined){pos[s]=pos[r]+d;ch=true}else if(pos[s]!==undefined&&pos[r]===undefined){pos[r]=pos[s]-d;ch=true}}}
    out[a]=pos}return out}
// ---------- BRIDGES ----------
{
  const N=null;
  const P=[['Hale','Iris',[N,-1,1,-1]],['Hale','Fern',[1,0,1,1]],['Iris','Ash',[1,1,0,-1]],['Bell','Fern',[-1,0,-1,-1]],['Hale','Gale',[0,-1,1,-1]]];
  const per=place(P,'Ash',[0,1,2,3]);
  console.log('BRIDGES per-axis east: Ash-Hale known?',per[0].Hale!==undefined&&per[0].Ash!==undefined?'yes':'NO -> "can\'t tell"');
  // bridge: x_Ash - x_Bell = t_Ash - t_Hale.  time component containing Ash and Hale:
  const tAH=per[3].Ash-per[3].Hale;   // both in Ash's time component?
  const perB=place(P,'Bell',[0]);
  const xAsh_minus_xBell=tAH; const xHale_minus_xBell=perB[0].Hale-perB[0].Bell;
  console.log('  time Ash-Hale =',tAH,'; east Hale-Bell =',xHale_minus_xBell,'; so east Ash-Hale =',xAsh_minus_xBell-xHale_minus_xBell,'(designer: same longitude)');
}
// ---------- WALKING TOTALS form A ----------
{
  const N=null;
  const P=[['Jade','Fern',[-1,1,-1,0]],['Gale','Ash',[0,-1,1,-1]],['Fern','Iris',[1,-1,1,0]],['Ash','Jade',[0,-1,1,N]],['Dune','Fern',[-1,1,-1,0]]];
  const per=place(P,'Dune',[0,1,2,3]);
  const g=[0,1,2].map(a=>per[a].Gale-per[a].Dune);
  console.log('WALK A: Gale-Dune on east/north/up =',g,'; time per-axis known?',per[3].Gale!==undefined?'yes':'NO');
  const dt=-(6-g.reduce((s,v)=>s+Math.abs(v),0)); // "earlier" stated
  const tI=place(P,'Iris',[3])[3]; // Iris time component
  console.log('  Gale-Dune time =',dt,'; Iris-Dune time =',tI.Dune!==undefined?tI.Dune-tI.Iris:'?','-> Gale-Iris =',dt-(-(tI.Dune-tI.Iris)),'(designer: 2 earlier)');
}
// ---------- WALKING TOTALS form B ----------
{
  const cells=new Set();
  for(let k=0;k<=4;k++){ // Elm-Fern = (0,0,k, -(4-k))  (k above, 4-k earlier)
    const ElmF=[0,0,k,-(4-k)];
    const Gale=ElmF.map((v,i)=>v+[1,-1,1,1][i]);      // Gale-Elm
    const Ash=Gale.map((v,i)=>v-[1,1,1,-1][i]);        // Gale-Ash
    const Iris=Ash.map((v,i)=>v+[1,-1,-1,1][i]);       // Iris-Ash
    cells.add(Math.sign(Iris[2])+','+Math.sign(Iris[3]));
  }
  console.log('WALK B: possible (up,time) sign cells of Iris-Fern:',[...cells].join(' | '),' (designer: 3 diagonal cells)');
}
// ---------- NEAREST ----------
{
  const P=[['Cork','Iris',[1,0,1,-1]],['Hale','Dune',[-1,-1,0,1]],['Cork','Gale',[0,-1,0,1]],['Fern','Cork',[0,-1,1,-1]],['Hale','Gale',[1,1,1,1]]];
  const per=place(P,'Fern',[0,1,2,3]);
  for(const c of ['Iris','Dune','Hale']){const v=[0,1,2,3].map(a=>per[a][c]-per[a].Fern);
    console.log('NEAREST',c,'-Fern',v,'L1',v.reduce((s,x)=>s+Math.abs(x),0),'Linf',Math.max(...v.map(Math.abs)),'hamming',v.filter(x=>x).length)}
}
// ---------- RANKED, with and without the strictness convention ----------
{
  const N=null;
  const P=[['Jade','Dune',[-1,1,1,1]],['Bell','Iris',[1,-1,N,1]],['Fern','Iris',[-1,0,0,1]],['Hale','Bell',[-1,0,-1,-1]],['Iris','Gale',[-1,1,-1,1]],['Jade','Bell',[1,-1,0,-1]]];
  const t=place(P,'Iris',[3])[3]; const z1=place(P,'Iris',[2])[2], z2=place(P,'Dune',[2])[2];
  console.log('RANKED time: Hale-Iris =',t.Hale-t.Iris,' Jade-Gale =',t.Jade-t.Gale);
  // informative: Hale before Iris, same time -> h_Iris - h_Hale >= w.  Dune & Hale in same height component:
  const hD_minus_hH=z2.Dune-z2.Hale;
  for(const w of [1,0]) console.log(`  tie rule w=${w}: Iris - Dune >= ${w - hD_minus_hH} ->`, (w-hD_minus_hH)>=1?'above (determined)':'above OR level (open: "can\'t tell")');
}
