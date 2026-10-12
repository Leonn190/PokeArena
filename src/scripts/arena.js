import { POKEMON,BY_ID,getFrame,spritePath,spriteUrl,applySpriteManifest } from './pokemon.mjs';
import { BOARD,createBattle,startBattle,updateBattle,randomLineups,putPokemonAt,removePokemonAt,cellAtPixel,tilePosition,teamAt,unitPosition,updateLoadout,DEFAULT_TEAMS } from './battle.mjs';
import { movePool, initialLoadout, MOVES_BY_ID } from './moves.mjs';
const $=id=>document.getElementById(id);
const canvas=$('arena'),ctx=canvas.getContext('2d',{alpha:false});
const base=(canvas.dataset.base||'/').replace(/\/?$/,'/');
let battle=createBattle();let selectedId='0001',chosenTeam=0,activeSlot=0;
let hovered=null,drag=null,pendingRoster=null,ghost=null;
let lastFrame=0,lastHud=0,visualTime=0,lastPhase='',resultAnnounced=false;
const spriteMap=new Map(),loadouts=new Map(POKEMON.map(p=>[p.id,initialLoadout(p.id)]));
const TAU=Math.PI*2;
const field={left:BOARD.x,top:BOARD.y,right:BOARD.x+10*BOARD.tile,bottom:BOARD.y+5*BOARD.tile};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const hash=(x,y,z=0)=>{let v=Math.imul(x*374761393^y*668265263^z*1274126177,1597334677);v^=v>>>13;v=Math.imul(v,1274126177);return ((v^(v>>>16))>>>0)/4294967295;};
const say=msg=>{$('placement-tip').querySelector('p').textContent=msg;};
function restart(preset=DEFAULT_TEAMS){
  battle=createBattle(preset);resultAnnounced=false;lastPhase='';$('outcome').hidden=true;
  for(const p of POKEMON)updateLoadout(battle,p.id,loadouts.get(p.id));
  say('Arraste um Pokémon da lista para o campo ou arraste os que já estão no gramado. Clique para selecionar; botão direito para remover. A luta só começa quando você mandar.');
  updateControls();updateHud();renderMoves();
}
function begin(){if(!startBattle(battle)){say('É necessário ter ao menos um Pokémon em cada equipe.');return;}updateControls();updateHud();}
$('start').addEventListener('click',()=>battle.phase==='setup'?begin():restart(battle.lineups));
$('reset').addEventListener('click',()=>restart(battle.lineups));
$('shuffle').addEventListener('click',()=>restart(randomLineups()));
$('again').addEventListener('click',()=>restart(randomLineups()));
for(const team of [0,1])$(`pick-${team}`).addEventListener('click',()=>{
  chosenTeam=team;updateControls();say(`Equipe ${team?'VERMELHA (direita)':'AZUL (esquerda)'} selecionada. Você pode clicar no gramado ou arrastar um Pokémon.`);
});
function canvasPoint(clientX,clientY){
  const rect=canvas.getBoundingClientRect();return{x:(clientX-rect.left)*BOARD.width/rect.width,y:(clientY-rect.top)*BOARD.height/rect.height};
}
function hitUnit(p){
  let closest=null,proximity=45;
  for(const team of [0,1])battle.lineups[team].forEach((u,index)=>{
    const distance=Math.hypot(p.x-u.x,p.y-u.y+16);
    if(distance<proximity){closest={u,team,index};proximity=distance;}
  });
  return closest;
}
function placeAt(p,id,from){
  const cell=cellAtPixel(p.x,p.y);
  if(!cell){say('Solte o Pokémon sobre o gramado, dentro dos limites da arena.');return false;}
  const team=teamAt(p.x);
  const source=from ? {team:from.team,index:from.index} : null;
  if(!putPokemonAt(battle,team,id,clamp(p.x,field.left+34,field.right-34),clamp(p.y,field.top+34,field.bottom-34),source)){
    say('Posição inválida: espaço ocupado ou equipe cheia (máximo 3 por lado).');return false;
  }
  updateLoadout(battle,id,loadouts.get(id));chosenTeam=team;selectedId=id;
  say(`${BY_ID[id].name} colocado no time ${team===0?'AZUL':'VERMELHO'}. Arraste para ajustar a posição sem usar casas fixas.`);
  updateHud();updateControls();updateDetails();renderMoves();return true;
}
canvas.addEventListener('pointerdown',e=>{
  if(battle.phase!=='setup')return;
  if(e.button!==0)return;
  const p=canvasPoint(e.clientX,e.clientY);const hit=hitUnit(p);
  if(hit){selectedId=hit.u.id;chosenTeam=hit.team;updateDetails();renderMoves();updateControls();}
  drag={kind:hit?'unit':'empty',from:hit,pointer:e.pointerId,start:p,last:p,moved:false};
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
  const p=canvasPoint(e.clientX,e.clientY);
  hovered=battle.phase==='setup'?cellAtPixel(p.x,p.y):null;
  if(drag?.pointer===e.pointerId){drag.last=p;drag.moved=drag.moved||Math.hypot(p.x-drag.start.x,p.y-drag.start.y)>7;}
});
canvas.addEventListener('pointerup',e=>{
  if(!drag||drag.pointer!==e.pointerId||battle.phase!=='setup')return;
  const d=drag;drag=null;
  const p=canvasPoint(e.clientX,e.clientY);
  if(d.kind==='unit'){
    if(d.moved)placeAt(p,d.from.u.id,d.from);
    else {say(`${BY_ID[d.from.u.id].name} selecionado. Arraste para reposicionar ou clique com botão direito para remover.`);}
  }else if(cellAtPixel(p.x,p.y)){
    const to=d.moved?p:tilePosition(hovered?.col??Math.floor((p.x-field.left)/BOARD.tile),hovered?.row??Math.floor((p.y-field.top)/BOARD.tile));
    placeAt(to,selectedId,null);
  }
});
canvas.addEventListener('pointercancel',()=>{drag=null;});
canvas.addEventListener('pointerleave',()=>{if(!drag)hovered=null;});
canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();if(battle.phase!=='setup')return;
  const found=hitUnit(canvasPoint(e.clientX,e.clientY));
  if(found&&removePokemonAt(battle,found.team,found.index)){say(`${BY_ID[found.u.id].name} removido.`);updateHud();updateControls();}
});
canvas.addEventListener('keydown',e=>{
  if(battle.phase!=='setup'||!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Enter',' '].includes(e.key))return;
  e.preventDefault();if(!hovered)hovered={col:chosenTeam===0?2:7,row:2};
  if(e.key==='ArrowDown')hovered.row=Math.min(4,hovered.row+1);
  if(e.key==='ArrowUp')hovered.row=Math.max(0,hovered.row-1);
  if(e.key==='ArrowRight')hovered.col=Math.min(9,hovered.col+1);
  if(e.key==='ArrowLeft')hovered.col=Math.max(0,hovered.col-1);
  if(e.key==='Enter'||e.key===' ')placeAt(tilePosition(hovered.col,hovered.row),selectedId,null);
});

const roster=$('roster-grid');
for(const p of POKEMON){
  const card=document.createElement('button');card.type='button';card.className='roster-mon';card.dataset.id=p.id;
  card.innerHTML=`<span class="dex">#${String(p.number).padStart(3,'0')}</span><canvas width="70" height="63" aria-hidden="true"></canvas><span class="mon-name">${p.name}</span><span class="type-bar"></span>`;
  card.querySelector('.type-bar').style.background=p.color;
  card.setAttribute('aria-label',`Selecionar ou arrastar ${p.name}`);
  card.addEventListener('click',()=>{selectedId=p.id;updateDetails();updateControls();renderMoves();if(battle.phase==='setup')say(`Selecionado: ${p.name}. Clique numa posição do seu lado do campo ou arraste o card para o gramado.`);});
  card.addEventListener('pointerdown',e=>{if(battle.phase!=='setup'||e.button!==0)return;pendingRoster={id:p.id,x:e.clientX,y:e.clientY,pointer:e.pointerId,moved:false};});
  card.addEventListener('dragstart',e=>e.preventDefault());
  roster.appendChild(card);
}
function newGhost(id){
  ghost=document.createElement('div');ghost.className='drag-ghost';ghost.textContent=BY_ID[id].name;
  document.body.appendChild(ghost);
}
window.addEventListener('pointermove',e=>{
  const d=pendingRoster;if(!d||d.pointer!==e.pointerId)return;
  if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)>9){d.moved=true;newGhost(d.id);}
  if(ghost){ghost.style.left=`${e.clientX+15}px`;ghost.style.top=`${e.clientY-25}px`;}
});
window.addEventListener('pointerup',e=>{
  const d=pendingRoster;if(!d||d.pointer!==e.pointerId)return;
  pendingRoster=null;ghost?.remove();ghost=null;
  if(d.moved&&battle.phase==='setup'){const p=canvasPoint(e.clientX,e.clientY);if(cellAtPixel(p.x,p.y))placeAt(p,d.id,null);}
});
function updateDetails(){
  const p=BY_ID[selectedId];$('detail-name').textContent=p.name;$('dex-number').textContent='#'+String(p.number).padStart(3,'0');
  $('detail-type').textContent=p.type.toUpperCase();$('detail-type').style.color=p.color;
  $('stats-list').innerHTML=['vida','atk','spa','def','spd','vel'].map(k=>{
    const n=p.stats[k];return `<div class="stat"><span>${k.toUpperCase()}</span><div class="stat-line"><div class="stat-fill" style="width:${Math.min(100,Math.round(n/120*100))}%;background:${p.color}"></div></div><span class="stat-val">${n}</span></div>`;
  }).join('');
  drawSmallSprite($('selected-avatar').querySelector('canvas'),p,0);
}
function renderMoves(){
  const equipped=loadouts.get(selectedId)||initialLoadout(selectedId);const pool=movePool(selectedId);
  $('moves-active').innerHTML=equipped.map((id,i)=>{
    const m=MOVES_BY_ID[id];return `<button type="button" class="move-item active-move ${activeSlot===i?'move-picked':''}" data-slot="${i}"><span class="move-icon">${m.category==='spa'?'✦':'⚔'}</span><span class="move-name"><b>${m.name}</b><small>${m.category==='atk'?'FÍSICO':'ESPECIAL'} · ${m.range.toFixed(1)} casas</small></span><strong>${m.damage}</strong></button>`;
  }).join('');
  $('moves-reserve').innerHTML=pool.filter(m=>!equipped.includes(m.id)).map(m=>`<button type="button" class="move-item reserve-move" data-move="${m.id}" ${battle.phase==='setup'?'':'disabled'}><span class="move-icon">${m.category==='spa'?'✦':'⚔'}</span><span class="move-name"><b>${m.name}</b><small>${m.category==='atk'?'FÍSICO':'ESPECIAL'} · ${m.range.toFixed(1)} casas</small></span><strong>${m.damage}</strong></button>`).join('');
  $('moves-active').querySelectorAll('button[data-slot]').forEach(el=>el.addEventListener('click',()=>{activeSlot=Number(el.dataset.slot);renderMoves();}));
  $('moves-reserve').querySelectorAll('button[data-move]').forEach(el=>el.addEventListener('click',()=>{
    if(battle.phase!=='setup')return;
    const next=[...equipped];next[activeSlot]=el.dataset.move;
    loadouts.set(selectedId,next);updateLoadout(battle,selectedId,next);renderMoves();updateHud();
  }));
}
function updateControls(){
  for(const el of document.querySelectorAll('.roster-mon')){el.classList.toggle('selected',el.dataset.id===selectedId);el.setAttribute('aria-pressed',String(el.dataset.id===selectedId));}
  for(const team of [0,1]){const el=$(`pick-${team}`);el.classList.toggle('chosen',chosenTeam===team);el.setAttribute('aria-pressed',String(chosenTeam===team));}
  $('start').disabled=battle.phase==='setup'&&(!battle.lineups[0].length||!battle.lineups[1].length);
  $('start-label').textContent=battle.phase==='setup'?'INICIAR BATALHA':'PREPARAR NOVAMENTE';
  $('start-icon').textContent=battle.phase==='setup'?'▶':'↺';
  $('shuffle').disabled=battle.phase!=='setup';
  $('phase-label').textContent={setup:'AGUARDANDO SEU COMANDO',fighting:'BATALHA EM ANDAMENTO',finished:'BATALHA ENCERRADA'}[battle.phase];
  $('roster-grid').classList.toggle('roster-locked',battle.phase!=='setup');
}
function addLog(msg,kind='normal'){
  const el=$('battle-log');if(el.querySelector('.log-empty'))el.innerHTML='';
  const m=Math.floor(battle.elapsed/60),s=Math.floor(battle.elapsed%60);
  const div=document.createElement('div');div.className=`log-entry ${kind}`;
  div.innerHTML=`<span class="time">${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}</span>`;
  div.append(document.createTextNode(msg));el.prepend(div);
  while(el.children.length>12)el.lastElementChild.remove();
}
function updateHud(){
  for(const team of [0,1]){
    const members=battle.units.filter(u=>u.team===team);
    $(`alive-${team}`).textContent=String(members.filter(u=>!u.dead).length);
    $(`count-${team}`).textContent=`${members.length} / 3`;
    const list=$(`team-${team}-list`);
    list.innerHTML=members.length?members.map(u=>{
      const hp=100*u.health/u.maxHealth;return `<div class="unit-item ${u.dead?'is-out':''}"><div class="unit-portrait"><canvas width="35" height="35" data-mon="${u.type.id}"></canvas></div><div class="unit-label"><b>${u.type.name}</b><small>VEL ${u.type.stats.vel} · ${u.activeMoves.map(id=>MOVES_BY_ID[id]?.name).join(' / ')}</small></div><div class="unit-life"><div class="life-track"><div class="life-fill" style="width:${hp}%"></div></div><small>${Math.ceil(u.health)} / ${u.maxHealth}</small></div></div>`;
    }).join(''):'<div class="log-empty">Arraste um Pokémon da lista.</div>';
    list.querySelectorAll('canvas[data-mon]').forEach(c=>drawSmallSprite(c,BY_ID[c.dataset.mon],0));
  }
  const total=Math.floor(battle.elapsed);$('clock').textContent=`${String(Math.floor(total/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;
  if(battle.phase!==lastPhase){lastPhase=battle.phase;
    if(battle.phase==='fighting')addLog('Você iniciou o combate!');
    if(battle.phase==='finished')renderMoves();
  }
  const messages={setup:['CAMPO PRONTO','Monte os dois times. Nenhuma luta começa sozinha.'],fighting:['BATALHA AUTOMÁTICA','Movimento livre, alcance e cadência de ataque por velocidade.'],finished:['PARTIDA ENCERRADA',`Vitória do time ${battle.winner===0?'azul':'vermelho'}!`]};
  $('status-title').textContent=messages[battle.phase][0];$('status-description').textContent=messages[battle.phase][1];
  if(battle.phase==='finished'&&!resultAnnounced){resultAnnounced=true;
    $('result-title').textContent=`TIME ${battle.winner===0?'AZUL':'VERMELHO'} VENCEU!`;
    $('result-title').style.color=battle.winner===0?'#9ddfff':'#f7b6c3';
    $('result-note').textContent=`${battle.units.filter(u=>u.team===battle.winner&&!u.dead).length} Pokémon sobreviveram.`;
    $('outcome').hidden=false;updateControls();
  }
}
function assetFor(p,action){const meta=p.sprites[action];return meta?.asset||action;}
async function loadImage(p,action){
  const key=`${p.id}:${action}`;if(spriteMap.has(key))return;
  const image=new Image();image.decoding='async';
  await new Promise(resolve=>{
    let remote=false;
    image.onload=()=>{spriteMap.set(key,image);resolve();};
    image.onerror=()=>{if(remote){resolve();return;}remote=true;image.src=spriteUrl(p,action);};
    image.src=`${base}sprites/${spritePath(p,action)}`;
  });
}
async function prepareSprites(){
  try{
    const r=await fetch(`${base}sprites/manifest.json`);
    if(r.ok){const manifest=await r.json();applySpriteManifest(manifest);}
  }catch{}
  const requests=POKEMON.flatMap(p=>[...new Set(Object.values(p.sprites).map(x=>x.asset).filter(Boolean))].map(action=>[p,action]));
  // Bateladas evitam centenas de downloads simultâneos.
  for(let i=0;i<requests.length;i+=9){await Promise.all(requests.slice(i,i+9).map(([p,a])=>loadImage(p,a)));if(i===0)refreshPortraits();}
  refreshPortraits();
}
function refreshPortraits(){
  document.querySelectorAll('.roster-mon').forEach(node=>drawSmallSprite(node.querySelector('canvas'),BY_ID[node.dataset.id],0));
  updateDetails();updateHud();
}
function getImageMeta(p,state){
  const meta=p.sprites[state]||p.sprites.Idle;
  const image=spriteMap.get(`${p.id}:${assetFor(p,state)}`);
  if(image?.naturalWidth)return{image,meta};
  return{image:spriteMap.get(`${p.id}:Idle`),meta:p.sprites.Idle};
}
function drawSmallSprite(dest,p,direction=0){
  if(!dest||!p)return;const c=dest.getContext('2d');c.clearRect(0,0,dest.width,dest.height);
  const {image,meta}=getImageMeta(p,'Idle');
  if(image?.naturalWidth){
    const scale=Math.min((dest.width-4)/meta.width,(dest.height-4)/meta.height);
    const dirs=Math.floor(image.naturalHeight/meta.height);
    c.imageSmoothingEnabled=false;
    c.drawImage(image,0,(dirs===8?direction:0)*meta.height,meta.width,meta.height,(dest.width-meta.width*scale)/2,(dest.height-meta.height*scale)/2,meta.width*scale,meta.height*scale);
  }else{
    c.fillStyle=p.color;c.beginPath();c.ellipse(dest.width/2,dest.height/2,dest.width*.23,dest.height*.27,0,0,TAU);c.fill();
    c.fillStyle='#163b2c';c.font=`bold ${Math.min(15,dest.width*.23)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(p.name.slice(0,2).toUpperCase(),dest.width/2,dest.height/2);
  }
}
function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,TAU);ctx.fill();}
function box(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function line(x,y,toX,toY,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(toX,toY);ctx.stroke();}
function grassClump(x,y,size,shade){
  line(x,y,x-size*.5,y-size*.8,shade,1.35);
  line(x,y,x,y-size,shade,1.4);
  line(x,y,x+size*.55,y-size*.7,shade,1.35);
}
function makeTerrain(){
  const temp=document.createElement('canvas');temp.width=BOARD.width;temp.height=BOARD.height;
  const previousCtx=ctx;const c=temp.getContext('2d');c.imageSmoothingEnabled=false;
  // Margem exterior com árvores em estilo pixel-art.
  c.fillStyle='#244d27';c.fillRect(0,0,BOARD.width,BOARD.height);
  c.fillStyle='#315d2e';c.fillRect(37,38,886,513);
  c.fillStyle='#234a26';c.fillRect(56,56,850,474);
  c.fillStyle='#a8c47d';c.fillRect(field.left-10,field.top-10,field.right-field.left+20,field.bottom-field.top+20);
  c.fillStyle='#658f47';c.fillRect(field.left-5,field.top-5,field.right-field.left+10,field.bottom-field.top+10);
  for(let row=0;row<5;row++)for(let col=0;col<10;col++){
    const x=field.left+col*BOARD.tile,y=field.top+row*BOARD.tile;
    const green=(hash(col,row)*3)|0;
    c.fillStyle=['#83b853','#88ba56','#7fb34e'][green];c.fillRect(x,y,BOARD.tile,BOARD.tile);
    for(let j=0;j<29;j++){
      const xx=x+hash(col*40+j,row,17)*(BOARD.tile-7)+3;
      const yy=y+hash(col, row*50+j,26)*(BOARD.tile-8)+4;
      c.strokeStyle=hash(j,col,row)>.46?'#649f46':'#aed276';c.lineWidth=1.2;
      c.beginPath();c.moveTo(xx,yy+3);c.lineTo(xx-2,yy);c.moveTo(xx+1,yy+3);c.lineTo(xx+2,yy-1);c.stroke();
      if(hash(col,j,row)>.985){c.fillStyle='#f9edce';c.fillRect(xx,yy-2,3,3);c.fillStyle='#e8a4b0';c.fillRect(xx+1,yy-1,1,1);}
    }
    // Zonas naturais de grama alta em manchas orgânicas, sem formar grade aparente.
    if(hash(col,row,60)>.6){
      for(let k=0;k<5;k++){
        const xx=x+hash(col,k,row)*65+6,yy=y+hash(row,k,col)*56+12;
        c.fillStyle='#6ba449';c.fillRect(xx,yy,12,5);
        c.fillStyle='#4f8a3c';c.fillRect(xx+3,yy-5,5,5);
      }
    }
  }
  // Caminho estreito de terra atravessando o centro, sem colisão ou restrição de movimento.
  for(let i=0;i<41;i++){
    const x=field.left+10+i*18.5,center=field.top+190+Math.sin(i*.23)*26;
    const yy=center-5;
    c.fillStyle=i%2?'#a2b36a':'#b0b976';c.fillRect(x,yy,13,10);
    c.fillStyle='#9baf68';c.fillRect(x+4,yy+8,7,2);
  }
  // Árvores e arbustos fora da região jogável, em múltiplas camadas pixeladas.
  const drawTree=(x,y,n)=>{
    c.fillStyle='#152e1c';c.fillRect(x-17,y+4,34,14);
    c.fillStyle='#295b2f';c.fillRect(x-23,y-23,46,34);
    c.fillStyle='#397638';c.fillRect(x-18,y-33,36,37);
    c.fillStyle='#4e9145';c.fillRect(x-9,y-36,26,19);
    c.fillStyle='#75ad58';c.fillRect(x-12,y-29,10,9);
    c.fillStyle='#31713a';c.fillRect(x+7,y-6,11,9);
  };
  for(let i=0;i<17;i++){drawTree(40+i*55,68+(i%3)*3,i);drawTree(40+i*55,567+(i%4)*2,i);}
  for(let i=0;i<8;i++){drawTree(26,122+i*56,i);drawTree(935,122+i*56,i);}
  c.strokeStyle='#cae4a5';c.lineWidth=3;c.strokeRect(field.left-1.5,field.top-1.5,field.right-field.left+3,field.bottom-field.top+3);
  return temp;
}
const terrain=makeTerrain();
function drawBoard(t){
  ctx.drawImage(terrain,0,0);
  // Sob a grama não há barreira no meio: apenas indicadores da área de posicionamento.
  if(battle.phase==='setup'){
    box(field.left,field.top,5*BOARD.tile,5*BOARD.tile,'#6cb7ff0a');
    box(field.left+5*BOARD.tile,field.top,5*BOARD.tile,5*BOARD.tile,'#ff92a70a');
    ctx.setLineDash([9,9]);line(field.left+5*BOARD.tile,field.top,field.left+5*BOARD.tile,field.bottom,'#ecf6dfc7',2);ctx.setLineDash([]);
    if(hovered){const {col,row}=hovered;ctx.fillStyle=col<5?'#b4eaff2b':'#ffc6d52b';ctx.fillRect(field.left+col*BOARD.tile,field.top+row*BOARD.tile,BOARD.tile,BOARD.tile);}
    ctx.font='900 12px system-ui';ctx.textAlign='center';ctx.fillStyle='#e8f8d9';ctx.shadowColor='#264923';ctx.shadowBlur=9;
    ctx.fillText('AZUL · POSICIONAMENTO',field.left+BOARD.tile*2.5,field.top-16);
    ctx.fillText('VERMELHO · POSICIONAMENTO',field.left+BOARD.tile*7.5,field.top-16);ctx.shadowBlur=0;
  }
  // Pequenos insetos luminosos dão vida ao campo sem afetar a física.
  for(let i=0;i<12;i++){
    const x=field.left+28+hash(i,2)*(field.right-field.left-55),y=field.top+25+hash(5,i)*(field.bottom-field.top-50);
    ellipse(x+Math.sin(t*.9+i)*2,y+Math.cos(t*.7+i)*2,1.5,1.5,`rgba(255,252,203,${.2+.15*Math.sin(t*1.5+i)})`);
  }
}
function drawUnit(u,t,preview=false){
  if(u.dead)return;
  let x=u.x,y=u.y;
  if(drag?.kind==='unit'&&drag.from?.u.id===u.type.id&&drag.from?.index===battle.lineups[u.team].findIndex(z=>z.id===u.type.id)&&drag.from.team===u.team){
    if(drag.moved){x=drag.last.x;y=drag.last.y;}
  }
  const color=u.team===0?'#6dccf7':'#ff9da8';
  ellipse(x,y+11,u.radius+9,10,'#224b2c68');
  ctx.save();ctx.strokeStyle=color;ctx.lineWidth=2;ctx.globalAlpha=.86;
  ctx.beginPath();ctx.ellipse(x,y+11,u.radius+6,10,0,0,TAU);ctx.stroke();ctx.restore();
  if(u.hitFlash>0){ellipse(x,y-16,37,32,`rgba(255,250,210,${u.hitFlash*1.9})`);}
  const {image,meta}=getImageMeta(u.type,u.state);
  if(image?.naturalWidth&&meta){
    const direction=Math.floor(image.naturalHeight/meta.height)===8?u.facing:0;
    const seconds=u.cast?u.cast.elapsed:u.stateTime;
    const frame=getFrame(meta.durations,seconds,!u.cast&&u.state!=='Hurt');
    const scale=clamp(66/u.type.sprites.Idle.height,1.22,2.05);
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,frame*meta.width,direction*meta.height,meta.width,meta.height,
      Math.round(x-meta.width*scale/2),Math.round(y+16-meta.height*scale),Math.round(meta.width*scale),Math.round(meta.height*scale));
    ctx.imageSmoothingEnabled=true;
  }else{
    // Fallback visual quando não é possível baixar os sprites (offline).
    ellipse(x,y-15,24,25,u.type.color);
    ellipse(x-7,y-23,6,6,'#fff3cb');ellipse(x+7,y-23,6,6,'#fff3cb');
    ellipse(x-7,y-23,2,3,'#223b2c');ellipse(x+7,y-23,2,3,'#223b2c');
    ctx.fillStyle='#163624';ctx.font='bold 10px system-ui';ctx.textAlign='center';ctx.fillText(u.type.name.slice(0,3).toUpperCase(),x,y+2);
  }
  // Barra de vida flutua acima, sem bloquear o personagem.
  const bw=53,bh=7,py=y-75;
  ctx.fillStyle='#173321dc';ctx.fillRect(x-bw/2,py,bw,bh);
  const health=clamp(u.health/u.maxHealth,0,1);
  ctx.fillStyle=health>.35?'#80df78':'#ffbd66';ctx.fillRect(x-bw/2+1,py+1,(bw-2)*health,bh-2);
  ctx.fillStyle='#fffbea';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.font='bold 10px system-ui';ctx.shadowColor='#1b4022';ctx.shadowBlur=4;
  ctx.fillText(u.type.name,x,y+27);ctx.shadowBlur=0;
  if(u.cast){
    const name=MOVES_BY_ID[u.cast.moveId]?.name;
    if(name){ctx.font='bold 9px system-ui';ctx.fillStyle='#fff6b9';ctx.shadowColor='#1a3b26';ctx.shadowBlur=3;ctx.fillText(name,x,y-82);ctx.shadowBlur=0;}
  }
}
function drawEffects(){
  for(const p of battle.projectiles){
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(Math.atan2(p.vy,p.vx));
    ctx.globalAlpha=.24;ellipse(-13,0,20,8,p.color);ctx.globalAlpha=1;
    const m=MOVES_BY_ID[p.moveId];
    if(m?.effect==='leaf'){ellipse(0,0,15,7,p.color);line(-7,0,7,0,'#438a3e',2);}
    else if(m?.effect==='flame'){ellipse(0,0,16,8,'#ff8a40');ellipse(4,0,10,5,'#ffe17f');}
    else if(m?.effect==='water'){ellipse(0,0,17,8,'#4cb9f0');ellipse(5,0,9,5,'#cbf4ff');}
    else {ellipse(0,0,13,7,p.color);ellipse(3,0,6,4,'#f8fdff');}
    ctx.restore();
  }
  for(const e of battle.effects){
    const a=1-e.time/e.total;ctx.save();ctx.globalAlpha=1-a;
    for(let j=0;j<7;j++){
      const angle=TAU*j/7+(e.style==='flame'?.3:0);const r=8+a*33;
      line(e.x+Math.cos(angle)*r*.4,e.y+Math.sin(angle)*r*.4,
        e.x+Math.cos(angle)*r,e.y+Math.sin(angle)*r,e.color,3);
    }ctx.restore();
  }
  for(const f of battle.floaters){
    const a=1-f.time/f.total;ctx.save();ctx.globalAlpha=Math.min(1,f.time*4);
    ctx.font='900 19px system-ui';ctx.textAlign='center';ctx.shadowColor='#23512a';ctx.shadowBlur=4;
    ctx.fillStyle=f.kind==='atk'?'#fff0aa':'#e4f7ff';ctx.fillText(f.text,f.x,f.y-a*36);ctx.restore();
  }
}
function draw(t){ctx.clearRect(0,0,BOARD.width,BOARD.height);drawBoard(t);
  battle.units.filter(u=>!u.dead).slice().sort((a,b)=>a.y-b.y).forEach(u=>drawUnit(u,t));
  drawEffects();
  if(pendingRoster?.moved&&ghost){const p=canvasPoint(parseFloat(ghost.style.left)-15,parseFloat(ghost.style.top)+25);
    if(cellAtPixel(p.x,p.y)){ctx.save();ctx.globalAlpha=.45;ellipse(p.x,p.y+8,25,11,'#ffffff');ctx.restore();}
  }
}
function processEvents(events){
  for(const ev of events){
    if(ev.type==='ko')addLog(`${ev.name} caiu! ${ev.by} conseguiu o nocaute.`,'ko');
    if(ev.type==='finish')addLog(`Time ${ev.winner===0?'AZUL':'VERMELHO'} venceu a batalha!`,'win');
    if(ev.type==='attack'&&Math.random()<.19)addLog(`${ev.name} usou ${ev.move}.`);
  }
}
function frame(timestamp){
  if(!lastFrame)lastFrame=timestamp;const dt=Math.min(.05,(timestamp-lastFrame)/1000);lastFrame=timestamp;visualTime+=dt;
  updateBattle(battle,dt);if(battle.events.length)processEvents(battle.events);
  draw(visualTime);if(timestamp-lastHud>175){updateHud();lastHud=timestamp;}
  requestAnimationFrame(frame);
}
function sizeCanvas(){const scale=clamp(window.devicePixelRatio||1,1,2);
  const w=Math.round(BOARD.width*scale),h=Math.round(BOARD.height*scale);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;ctx.setTransform(scale,0,0,scale,0,0);}
}
window.addEventListener('resize',sizeCanvas);sizeCanvas();
updateControls();updateDetails();renderMoves();updateHud();
prepareSprites();requestAnimationFrame(frame);
