import { POKEMON, BY_ID, getFrame, spritePath, spriteUrl } from './pokemon.mjs';
import { BOARD, createBattle, startBattle, updateBattle, cloneLineups, randomLineups, putPokemon, removePokemon, cellAtPixel, tilePosition, unitPosition, DEFAULT_TEAMS } from './battle.mjs';

const $ = id => document.getElementById(id);
const canvas = $('arena');
const ctx = canvas.getContext('2d', { alpha: false });
const base = (canvas.dataset.base || '/').replace(/\/?$/,'/');
const spriteMap = new Map();
let battle=createBattle();
let chosenTeam=0;
let selectedId='0001';
let hovered=null;
let autoTimer=null;
let lastFrame=0;
let lastHud=0;
let visualTime=0;
let lastPhase='';
let resultAnnounced=false;

function say(msg) { $('placement-tip').querySelector('p').textContent=msg; }
function stopAutoplay() { if(autoTimer){clearTimeout(autoTimer);autoTimer=null;} }
function firstLaunch() {
  stopAutoplay();
  autoTimer=setTimeout(()=>{autoTimer=null;if(battle.phase==='setup')begin();},3600);
}
function restart(preset=DEFAULT_TEAMS,auto=false){
  stopAutoplay();battle=createBattle(preset);resultAnnounced=false;$('outcome').hidden=true;
  say('Selecione um Pokémon e depois um quadrado da sua metade. Clique no mesmo Pokémon para remover.');
  updateControls();updateHud();if(auto)firstLaunch();
}
function begin(){stopAutoplay();if(!startBattle(battle)){say('Coloque pelo menos um Pokémon em cada equipe antes de lutar.');return;}updateControls();updateHud();}
$('start').addEventListener('click',()=>battle.phase==='setup'?begin():restart());
$('reset').addEventListener('click',()=>restart(battle.lineups));
$('shuffle').addEventListener('click',()=>restart(randomLineups()));
$('again').addEventListener('click',()=>restart(randomLineups(),true));
for (const team of [0,1]) $( `pick-${team}` ).addEventListener('click',()=>{
  stopAutoplay();chosenTeam=team;updateControls();
  say(battle.phase==='setup'?`Editando equipe ${team===0?'AZUL (cima)':'VERMELHA (baixo)'}. Escolha um Pokémon e toque num quadrado.`:'Para mudar posições, clique em PREPARAR.');
});

function sizeCanvas(){
  const scale=Math.min(2,Math.max(1,window.devicePixelRatio||1));
  if(canvas.width===Math.round(BOARD.width*scale)&&canvas.height===Math.round(BOARD.height*scale))return;
  canvas.width=Math.round(BOARD.width*scale);canvas.height=Math.round(BOARD.height*scale);
  ctx.setTransform(scale,0,0,scale,0,0);
  ctx.imageSmoothingEnabled=false;
}
window.addEventListener('resize',sizeCanvas);
sizeCanvas();

function pointerCell(event){
  const rect=canvas.getBoundingClientRect();
  const x=(event.clientX-rect.left)*BOARD.width/rect.width;
  const y=(event.clientY-rect.top)*BOARD.height/rect.height;
  return cellAtPixel(x,y,battle.gap);
}
canvas.addEventListener('pointermove',event=>{hovered=battle.phase==='setup'?pointerCell(event):null;});
canvas.addEventListener('pointerleave',()=>{hovered=null;});
canvas.addEventListener('click',event=>{
  if(battle.phase!=='setup')return;
  const cell=pointerCell(event);if(!cell)return;
  stopAutoplay();const team=cell.row<4?0:1;
  if(team!==chosenTeam){
    chosenTeam=team;updateControls();
  }
  const occupying=battle.lineups[team].find(p=>p.col===cell.col&&p.row===cell.row);
  if(occupying?.id===selectedId){removePokemon(battle,team,cell.col,cell.row);say(`Removido de (${cell.col+1},${cell.row+1}). Toque no quadrado para recolocar.`);}
  else if(putPokemon(battle,team,selectedId,cell.col,cell.row))say(`${BY_ID[selectedId].name} posicionado no time ${team===0?'AZUL':'VERMELHO'}!`);
  else say('Equipe cheia (máximo de três). Toque em um quadrado ocupado para substituir ou selecione um Pokémon já presente para movê-lo.');
  updateHud();updateControls();
});
canvas.addEventListener('contextmenu',e=>{
  e.preventDefault();if(battle.phase!=='setup')return;
  stopAutoplay();const cell=pointerCell(e);if(!cell)return;
  if(removePokemon(battle,cell.row<4?0:1,cell.col,cell.row)){
    say('Pokémon removido.');updateHud();updateControls();
  }
});
canvas.addEventListener('keydown',e=>{
  if(battle.phase!=='setup')return;
  if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Enter',' '].includes(e.key))return;
  e.preventDefault();
  if(!hovered)hovered={col:3,row:chosenTeam?5:2};
  if(e.key==='ArrowDown')hovered.row=Math.min(7,hovered.row+1);
  if(e.key==='ArrowUp')hovered.row=Math.max(0,hovered.row-1);
  if(e.key==='ArrowRight')hovered.col=Math.min(7,hovered.col+1);
  if(e.key==='ArrowLeft')hovered.col=Math.max(0,hovered.col-1);
  if(e.key==='Enter'||e.key===' '){
    const team=hovered.row<4?0:1;chosenTeam=team;
    const old=battle.lineups[team].find(u=>u.col===hovered.col&&u.row===hovered.row);
    if(old?.id===selectedId)removePokemon(battle,team,hovered.col,hovered.row);
    else putPokemon(battle,team,selectedId,hovered.col,hovered.row);
    stopAutoplay();updateHud();updateControls();
  }
});

const roster=$('roster-grid');
for(const p of POKEMON){
  const card=document.createElement('button');card.type='button';card.className='roster-mon';card.dataset.id=p.id;
  card.innerHTML=`<span class="dex">#${String(p.number).padStart(3,'0')}</span><canvas width="70" height="63" aria-hidden="true"></canvas><span class="mon-name">${p.name}</span><span class="type-bar"></span>`;
  card.querySelector('.type-bar').style.background=p.color;
  card.setAttribute('aria-label',`Selecionar ${p.name}`);
  card.addEventListener('click',()=>{
    stopAutoplay();selectedId=p.id;updateDetails();updateControls();
    if(battle.phase==='setup')say(`Selecionado: ${p.name}. Agora toque num quadrado da equipe ${chosenTeam===0?'AZUL':'VERMELHA'}.`);
    else say('Para alterar os times, clique em PREPARAR.');
  });roster.appendChild(card);
}
function updateDetails(){
  const p=BY_ID[selectedId];$('detail-name').textContent=p.name;
  $('dex-number').textContent='#'+String(p.number).padStart(3,'0');
  $('detail-type').textContent=p.type.toUpperCase();
  $('detail-type').style.color=p.color;
  $('stats-list').innerHTML=['vida','atk','spa','def','spd','vel'].map(key=>{
    const n=p.stats[key],width=Math.round(n/120*100);
    return `<div class="stat"><span>${key.toUpperCase()}</span><div class="stat-line"><div class="stat-fill" style="width:${Math.min(100,width)}%;background:${p.color}"></div></div><span class="stat-val">${n}</span></div>`;
  }).join('');
  drawSmallSprite($('selected-avatar').querySelector('canvas'),p,0);
}
function updateControls(){
  document.querySelectorAll('.roster-mon').forEach(el=>{
    const selected=el.dataset.id===selectedId;
    el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));
  });
  for(const team of [0,1]){
    const b=$(`pick-${team}`);b.classList.toggle('chosen',chosenTeam===team);b.setAttribute('aria-pressed',String(chosenTeam===team));
  }
  $('start').disabled=battle.phase==='setup'&&(!battle.lineups[0].length||!battle.lineups[1].length);
  $('start-label').textContent=battle.phase==='setup'?'COMEÇAR AGORA':'REFAZER LUTA';
  $('start-icon').textContent=battle.phase==='setup'?'▶':'↻';
  $('shuffle').disabled=battle.phase!=='setup';
  $('phase-label').textContent=({setup:'MONTANDO TIMES',joining:'UNINDO AS ARENAS',fighting:'BATALHA EM ANDAMENTO',finished:'BATALHA ENCERRADA'})[battle.phase];
}

function addLog(text,kind='normal'){
  const log=$('battle-log');
  if(log.querySelector('.log-empty'))log.innerHTML='';
  const m=Math.floor(battle.elapsed/60),s=Math.floor(battle.elapsed%60);
  const stamp=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  const node=document.createElement('div');node.className=`log-entry ${kind}`;
  const time=document.createElement('span');time.className='time';time.textContent=stamp;
  node.append(time,document.createTextNode(text));
  log.prepend(node);
  while(log.children.length>11)log.lastElementChild.remove();
}
function updateHud(){
  for(const team of [0,1]){
    const list=$(`team-${team}-list`), members=battle.units.filter(u=>u.team===team);
    $(`alive-${team}`).textContent=String(members.filter(u=>!u.dead).length);
    $(`count-${team}`).textContent=`${members.length} / 3`;
    list.innerHTML=members.length?members.map(u=>{
      const hp=Math.round(u.health/u.maxHealth*100);
      return `<div class="unit-item ${u.dead?'is-out':''}"><div class="unit-portrait"><canvas width="35" height="35" data-mon="${u.type.id}"></canvas></div><div class="unit-label"><b>${u.type.name}</b><small>#${String(u.type.number).padStart(3,'0')} · VEL ${u.type.stats.vel}</small></div><div class="unit-life"><div class="life-track"><div class="life-fill" style="width:${hp}%"></div></div><small>${Math.ceil(u.health)} / ${u.maxHealth}</small></div></div>`;
    }).join(''):'<div class="log-empty">Nenhum Pokémon posicionado.</div>';
    list.querySelectorAll('canvas[data-mon]').forEach(el=>drawSmallSprite(el,BY_ID[el.dataset.mon],0));
  }
  const seconds=Math.floor(Math.max(0,battle.elapsed-(battle.phase==='joining'?battle.joinProgress*1.15:1.15)));
  $('clock').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  if(battle.phase!==lastPhase){
    lastPhase=battle.phase;
    if(battle.phase==='joining')addLog('As duas arenas estão se unindo.');
    if(battle.phase==='fighting')addLog('Combate iniciado. As equipes avançam!');
  }
  const msgs={
    setup:['PREPARE AS EQUIPES','Selecione os Pokémon nos quadrados do tabuleiro.'],
    joining:['ARENAS SE APROXIMANDO','As duas metades estão virando um campo só.'],
    fighting:['COMBATE AUTOMÁTICO','Os Pokémon caminham, escolhem alvos e atacam.'],
    finished:['CONFRONTO TERMINADO',`O time ${battle.winner===0?'azul':'vermelho'} venceu a batalha.`]
  };
  $('status-title').textContent=msgs[battle.phase][0];$('status-description').textContent=msgs[battle.phase][1];
  if(battle.phase==='finished'&&!resultAnnounced){
    resultAnnounced=true;
    $('result-title').textContent=`TIME ${battle.winner===0?'AZUL':'VERMELHO'} VENCEU!`;
    $('result-title').style.color=battle.winner===0?'#8fdafa':'#f7b6c3';
    $('result-note').textContent=`${battle.units.filter(u=>u.team===battle.winner&&!u.dead).length} Pokémon sobreviveram.`;
    $('outcome').hidden=false;updateControls();
  }
}
async function loadSprite(p,action){
  const img=new Image();img.decoding='async';
  const key=`${p.id}:${action}`;
  let fallback=false;
  await new Promise(resolve=>{
    img.onload=()=>{spriteMap.set(key,img);resolve();};
    img.onerror=()=>{if(!fallback){fallback=true;img.src=spriteUrl(p,action);}else resolve();};
    img.src=`${base}sprites/${spritePath(p,action)}`;
  });
}
Promise.all(POKEMON.flatMap(p=>['Idle','Walk','Attack','Hurt'].map(a=>loadSprite(p,a)))).then(()=>{
  document.querySelectorAll('.roster-mon').forEach(node=>drawSmallSprite(node.querySelector('canvas'),BY_ID[node.dataset.id],0));
  updateDetails();updateHud();
});

function drawSmallSprite(dest,p,direction=0){
  if(!dest||!p)return;
  const c=dest.getContext('2d');c.clearRect(0,0,dest.width,dest.height);
  const image=spriteMap.get(`${p.id}:Idle`),meta=p.sprites.Idle;
  if(image?.naturalWidth){
    const s=Math.min((dest.width-4)/meta.width,(dest.height-4)/meta.height);
    c.imageSmoothingEnabled=false;
    c.drawImage(image,0,Math.min(direction,7)*meta.height,meta.width,meta.height,(dest.width-meta.width*s)/2,(dest.height-meta.height*s)/2,meta.width*s,meta.height*s);
  }else{
    c.fillStyle=p.color;c.beginPath();c.arc(dest.width/2,dest.height/2,Math.min(dest.width,dest.height)*.27,0,Math.PI*2);c.fill();
    c.fillStyle='#102438';c.font=`bold ${Math.min(22,dest.width*.3)}px sans-serif`;c.textAlign='center';c.textBaseline='middle';c.fillText(p.name[0],dest.width/2,dest.height/2);
  }
}

function roundRect(x,y,w,h,r,fill,stroke=null){
  ctx.beginPath();ctx.roundRect(x,y,w,h,r);
  if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}
}
function glow(x,y,r,color,alpha=.5){
  ctx.save();ctx.globalAlpha=alpha;
  const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');
  ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.restore();
}
function line(x1,y1,x2,y2,color,w=1){ctx.strokeStyle=color;ctx.lineWidth=w;ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();}
function drawBoard(t){
  const bg=ctx.createLinearGradient(0,0,880,758);bg.addColorStop(0,'#0e2134');bg.addColorStop(.52,'#111c2b');bg.addColorStop(1,'#251d2b');
  ctx.fillStyle=bg;ctx.fillRect(0,0,880,758);
  glow(275,140,265,'#3a8cad',.09);glow(655,650,255,'#b35b7c',.09);
  for(let k=0;k<24;k++){
    let x=(k*171.7+31)%880,y=(k*89.25+17)%758;
    ctx.fillStyle=`rgba(137,190,215,${.045+.025*Math.sin(t+k)})`;ctx.fillRect(x,y,2,2);
  }
  for(const team of [0,1]){
    const y=BOARD.y+team*4*BOARD.tile+(team===0?-battle.gap/2:battle.gap/2);
    const color=team===0?'#72cafa':'#f39eaf';
    roundRect(BOARD.x-13,y-14,BOARD.columns*BOARD.tile+26,4*BOARD.tile+28,12,team===0?'#122e42':'#352638',team===0?'#3c7296':'#8b566a');
    roundRect(BOARD.x-5,y-5,BOARD.columns*BOARD.tile+10,4*BOARD.tile+10,6,'#111e2d',team===0?'#337599':'#92576d');
    for(let r=0;r<4;r++)for(let col=0;col<8;col++){
      const globalRow=team*4+r;
      const xx=BOARD.x+col*BOARD.tile, yy=y+r*BOARD.tile;
      const alt=(col+r)%2===0;
      ctx.fillStyle=team===0?(alt?'#1c384d':'#183348'):(alt?'#3d2c3d':'#35283a');
      ctx.fillRect(xx+1,yy+1,BOARD.tile-2,BOARD.tile-2);
      ctx.strokeStyle=team===0?'#2b5067':'#624456';ctx.lineWidth=.75;ctx.strokeRect(xx+.5,yy+.5,BOARD.tile-1,BOARD.tile-1);
      if(battle.phase==='setup'&&hovered?.row===globalRow&&hovered?.col===col){
        ctx.fillStyle=team===chosenTeam?'#ffffff22':'#f8c6c817';ctx.fillRect(xx+2,yy+2,BOARD.tile-4,BOARD.tile-4);
        ctx.lineWidth=2;ctx.strokeStyle=team===0?'#a4e8ff':'#ffd0dc';ctx.strokeRect(xx+2,yy+2,BOARD.tile-4,BOARD.tile-4);
      }
      if((r===1||r===2)&&(col===1||col===6)){
        ctx.fillStyle=team===0?'#69adcf18':'#e58ba519';ctx.fillRect(xx+24,yy+24,BOARD.tile-48,BOARD.tile-48);
      }
    }
    ctx.font='900 11px system-ui';ctx.letterSpacing='1px';ctx.textAlign='left';ctx.fillStyle=color;
    ctx.fillText(team===0?'↑ TIME AZUL  /  CAMPO SUPERIOR':'↓ TIME VERMELHO  /  CAMPO INFERIOR',BOARD.x+9,y-21);
  }
  if(battle.gap>2){
    const cy=BOARD.y+4*BOARD.tile;
    line(BOARD.x-10,cy,BOARD.x+BOARD.columns*BOARD.tile+10,cy,'#9bdaf14f');
    ctx.textAlign='center';ctx.fillStyle='#89aebc';ctx.font='bold 9px system-ui';
    if(battle.gap>20)ctx.fillText('AS ARENAS SE UNEM NO COMBATE',440,cy+3);
  }else{
    let y=BOARD.y+4*BOARD.tile;
    glow(440,y,165,'#87cffa',.07);
    line(BOARD.x,y,BOARD.x+8*BOARD.tile,y,'#93cde94c',2);
  }
  ctx.letterSpacing='0px';
}
function drawUnit(u,t){
  if(u.dead)return;
  const position=unitPosition(u),{x,y}=position;
  const color=u.team===0?'#76d3f9':'#f09eac';
  // Sombras e seletores exatamente sob os pés, como um jogo top-down.
  ctx.save();ctx.fillStyle='#00000058';ctx.beginPath();ctx.ellipse(x,y+20,27,11,0,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle=color;ctx.lineWidth=2;ctx.globalAlpha=.8;ctx.beginPath();ctx.ellipse(x,y+21,24,11,0,0,Math.PI*2);ctx.stroke();ctx.restore();
  const state=u.state;
  const image=spriteMap.get(`${u.type.id}:${state}`)||spriteMap.get(`${u.type.id}:Idle`);
  const action=image===spriteMap.get(`${u.type.id}:${state}`)?state:'Idle';
  const meta=u.type.sprites[action];
  if(u.hitFlash>0)glow(x,y-19,49,'#ffffff',Math.min(.5,u.hitFlash*2));
  if(image?.naturalWidth&&meta){
    const frame=getFrame(meta.durations,u.stateTime,action!=='Attack'&&action!=='Hurt');
    const rows=Math.floor(image.naturalHeight/meta.height);
    const direction=rows===8?u.facing:0;
    const s=Math.min(2,70/u.type.sprites.Idle.height);
    const dw=meta.width*s,dh=meta.height*s;
    ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,frame*meta.width,direction*meta.height,meta.width,meta.height,
      Math.round(x-dw/2),Math.round(y+24-dh+(state==='Walk'?Math.sin(t*13)*1.2:0)),Math.round(dw),Math.round(dh));
    ctx.imageSmoothingEnabled=true;
  }else{
    ctx.fillStyle=u.type.color;ctx.beginPath();ctx.arc(x,y-12,22,0,Math.PI*2);ctx.fill();
    ctx.fillStyle='#16293a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 17px system-ui';ctx.fillText(u.type.name.slice(0,2).toUpperCase(),x,y-10);
  }
  // Barras acima das cabeças; não se movem em perspectiva.
  const bw=53;
  roundRect(x-bw/2,y-67,bw,7,3,'#05121edc');
  const fraction=Math.max(0,u.health/u.maxHealth);
  if(fraction>0)roundRect(x-bw/2+1,y-66,Math.max(1,(bw-2)*fraction),5,2,fraction>.35?color:'#f3bd63');
  ctx.fillStyle='#e4f0f5';ctx.textAlign='center';ctx.textBaseline='alphabetic';ctx.font='bold 10px system-ui';
  ctx.shadowColor='#020913';ctx.shadowBlur=5;ctx.fillText(u.type.name,x,y+38);ctx.shadowBlur=0;
}
function drawEffects(){
  for(const p of battle.projectiles){
    glow(p.x,p.y,24,p.color,.23);
    ctx.save();ctx.shadowBlur=17;ctx.shadowColor=p.color;ctx.fillStyle=p.kind==='spa'?'#f4ffff':'#ffcf94';
    ctx.beginPath();ctx.arc(p.x,p.y,p.radius,0,Math.PI*2);ctx.fill();
    ctx.strokeStyle=p.color;ctx.lineWidth=2;ctx.stroke();ctx.restore();
  }
  for(const e of battle.effects){
    const age=1-e.time/e.total;glow(e.x,e.y,48,e.color,(1-age)*.32);
    ctx.globalAlpha=1-age;ctx.strokeStyle=e.color;ctx.lineWidth=3;
    ctx.beginPath();ctx.arc(e.x,e.y,12+age*28,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
  }
  for(const n of battle.floaters){
    const age=1-n.time/n.total;
    ctx.globalAlpha=Math.min(1,n.time*4);ctx.textAlign='center';ctx.font='900 20px system-ui';
    ctx.fillStyle=n.kind==='spa'?'#e0efff':'#ffd79a';ctx.shadowColor='#05111c';ctx.shadowBlur=8;
    ctx.fillText(n.text,n.x,n.y-age*38);
    ctx.globalAlpha=1;ctx.shadowBlur=0;
  }
}
function draw(t){
  ctx.clearRect(0,0,BOARD.width,BOARD.height);
  drawBoard(t);
  battle.units.filter(u=>!u.dead).sort((a,b)=>unitPosition(a).y-unitPosition(b).y).forEach(u=>drawUnit(u,t));
  drawEffects();
}
function processEvents(events){
  for(const ev of events){
    if(ev.type==='ko')addLog(`${ev.name} foi derrotado por ${ev.by}.`,'ko');
    if(ev.type==='finish')addLog(`Vitória da equipe ${ev.winner===0?'AZUL':'VERMELHA'}!`,'win');
    if(ev.type==='hit'&&Math.random()<.17)addLog(`${ev.name} recebeu ${ev.damage} de dano (${ev.kind==='atk'?'ATK':'SPA'}).`);
  }
}
function frame(timestamp){
  if(!lastFrame)lastFrame=timestamp;
  const dt=Math.min(.05,(timestamp-lastFrame)/1000);lastFrame=timestamp;visualTime+=dt;
  updateBattle(battle,dt);
  if(battle.events.length)processEvents(battle.events);
  draw(visualTime);
  if(timestamp-lastHud>155){updateHud();lastHud=timestamp;}
  requestAnimationFrame(frame);
}
updateDetails();updateControls();updateHud();firstLaunch();requestAnimationFrame(frame);
