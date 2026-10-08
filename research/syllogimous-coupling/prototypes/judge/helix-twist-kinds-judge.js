// HELIX: solve the worked day item treating time as ONE unrolled integer t (no second axis needed).
{
  // premises: [subj, ref, watchStep, dayClause|null]
  const P=[['Ash','Hart',-1,null],['Gale','Bell',1,0],['Ash','Iris',1,0],['Bell','Hart',1,null]];
  const verdicts=new Set();
  for(let p=0;p<4;p++){ // phase of Iris, the only unknown besides relative offsets
    const t={Iris:p}; let ch=true;
    while(ch){ch=false;for(const [s,r,k] of P){if(t[r]!==undefined&&t[s]===undefined){t[s]=t[r]+k;ch=true}else if(t[s]!==undefined&&t[r]===undefined){t[r]=t[s]-k;ch=true}}}
    const day=x=>Math.floor(t[x]/4);
    if(!P.every(([s,r,k,d])=>d===null||day(s)-day(r)===d)) continue;
    verdicts.add(day('Iris')===day('Bell'));
  }
  console.log('HELIX day item, one integer axis t, all surviving phases say same-day =',[...verdicts],' (designer: FALSE)');
  console.log('  -> the item is a 1-D carry problem on t; east/north clauses never enter it.');
}
// TWIST (Mobius, 5 columns, flip about centre line y=0). Cover semantics: target = proj(ref_cover + delta).
{
  const M=5;
  const proj=(x,y)=>{let laps=Math.floor((x-1)/M);return [((x-1)%M+M)%M+1,(laps%2?-1:1)*y]};
  // place by search: each object (col,y). Hart (1,0).
  const pos={Hart:[1,0]};
  // premise: subj = ref + (dcol, dy) measured in ref's chart; dcol>0 clockwise.
  const P=[['Elm','Hart',-2,-1],['Elm','Cole',-2,+1],['Iris','Hart',-2,0],['Cole','Dune',+1,+1]];
  const fwd=(r,dc,dy)=>proj(r[0]+dc,r[1]+dy);
  let ch=true;while(ch){ch=false;for(const [s,r,dc,dy] of P){
    if(pos[r]&&!pos[s]){pos[s]=fwd(pos[r],dc,dy);ch=true}
    else if(pos[s]&&!pos[r]){ // invert: find ref with fwd(ref)=s
      for(let c=1;c<=M;c++)for(let y=-6;y<=6;y++){const f=fwd([c,y],dc,dy);if(f[0]===pos[s][0]&&f[1]===pos[s][1]){pos[r]=[c,y];ch=true}}
    }}}
  console.log('TWIST chart positions',JSON.stringify(pos),' Dune north of Hart?',pos.Dune[1]>pos.Hart[1],' (designer: Dune 1 north -> claim "south" FALSE)');
  // per-axis north reading
  const n={Hart:0};n.Elm=-1;n.Cole=n.Elm-1;n.Dune=n.Cole-1;console.log('  flat per-axis north: Dune',n.Dune,'-> "south" (wrong)');
  // the short way round: Dune is col 5, Hart col 1, adjacent across the twist
  const across=fwd(pos.Hart,-1,0); console.log('  Hart stepped 1 anticlockwise lands at',across,'; Dune at',pos.Dune,'-> from Hart across the twist Dune reads',-pos.Dune[1]<0?'south':'north');
}
// KINDS (mirror rule). Positions in kind-0 frame; premise "S is d relative to R" in R's reckoning.
{
  const P=[['Hart','Bell',0,0],['Cole','Fern',+1,0],['Fern','Dune',+1,1],['Fern','Hart',-1,0]]; // [subj,ref,eastStated,oppositeKind]
  const x={Cole:0},k={Cole:0}; let ch=true;
  while(ch){ch=false;for(const [s,r,d,o] of P){
    if(k[r]!==undefined&&k[s]===undefined){k[s]=k[r]^o;x[s]=x[r]+(k[r]?-d:d);ch=true}
    else if(k[s]!==undefined&&k[r]===undefined){k[r]=k[s]^o;x[r]=x[s]-(k[r]?-d:d);ch=true}}}
  console.log('KINDS east (kind-0 frame, Cole kind 0):',JSON.stringify(x),' Dune==Cole?',x.Dune===x.Cole,'(designer TRUE)');
  const f={Cole:0};f.Fern=f.Cole-1;f.Dune=f.Fern-1;console.log('  face value Dune-Cole =',f.Dune-f.Cole,'(-> west, wrong)');
}
