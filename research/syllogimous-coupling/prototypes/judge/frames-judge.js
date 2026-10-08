// Judge: can the frames example (rung `frames`) be solved one WORLD axis at a time?
// The solver below keeps exactly one scalar per axis and never reads another axis's value.
// For each premise it only looks up WHICH stated column feeds this axis (and its sign) --
// a static routing table from the stated frame, like a codex lookup.
const AX = ['east','north','up','time'];
// frames as given by the prototype output: g maps our axis i -> speaker axis p[i] with sign s[i]?
// Derive directly from the English: Bell turned a quarter from north toward later:
//   Bell's north = our later, Bell's later = our south.  Eve: a quarter from above toward west:
//   Eve's above = our west?  The designer says "Eve's east is our above and Eve's above is our west".
// Use the derivation lines the prototype printed to build each speaker's routing (stated col -> world axis, sign).
const route = {
  Bell: {0:[0,1], 1:[3,1], 2:[2,1], 3:[1,-1]},   // Bell east->our east, north->our later, up->up, later->our south
  Eve:  {0:[2,1], 1:[1,1], 2:[0,-1], 3:[3,1]},   // Eve east->our up, north->north, above->our west, time->time
  none: {0:[0,1],1:[1,1],2:[2,1],3:[3,1]},
};
// premises: [subject, reference, speaker, stated vector]
const P = [
  ['Dell','Ash','none',[1,1,1,-1]],
  ['Cole','Bell','Bell',[0,-1,1,-1]],
  ['Fay','Ash','none',[0,-1,-1,-1]],
  ['Ash','Bell','Bell',[1,1,1,-1]],
  ['Cole','Eve','Eve',[1,-1,1,-1]],
];
function solveAxis(k){ // one scalar per object on world axis k only
  const pos={Ash:0}; let changed=true;
  while(changed){changed=false; for(const [s,r,sp,v] of P){
    // which stated column lands on world axis k?
    const ent=Object.entries(route[sp]).find(([c,[w]])=>w===k); const c=+ent[0], sg=ent[1][1];
    const d=sg*v[c];
    if(pos[r]!==undefined&&pos[s]===undefined){pos[s]=pos[r]+d;changed=true}
    else if(pos[s]!==undefined&&pos[r]===undefined){pos[r]=pos[s]-d;changed=true}
  }}
  return pos;
}
const world=[0,1,2,3].map(k=>{const p=solveAxis(k);return p.Dell-p.Eve});
console.log('Dell-Eve, world axes, solved one axis at a time:',world);
// answer in Eve's reckoning: Eve's col c reads world axis route.Eve[c]
const eve=[0,1,2,3].map(c=>{const [w,sg]=route.Eve[c];return sg*world[w]});
console.log('in Eve reckoning:',eve,'(designer: [2,0,-1,0] = east, same latitude, below, same time)');
