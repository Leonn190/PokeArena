import { BY_ID, getDirection } from './pokemon.mjs';

export const BOARD = { columns: 8, rows: 8, teamRows: 4, width: 880, height: 758, tile: 74, x: 144, y: 77 };
export const DEFAULT_TEAMS = [
  [{id:'0001',col:2,row:1},{id:'0005',col:5,row:1},{id:'0009',col:3,row:2}],
  [{id:'0007',col:2,row:6},{id:'0002',col:5,row:6},{id:'0006',col:4,row:5}]
];
const INITIAL_GAP = 36;

export function tilePosition(col,row,gap=0) {
  return { x:BOARD.x + (col+.5)*BOARD.tile, y: BOARD.y + (row+.5)*BOARD.tile + (row<4 ? -gap/2 : gap/2) };
}
export function cellAtPixel(x,y,gap=0) {
  const col=Math.floor((x-BOARD.x)/BOARD.tile);
  let row=null;
  for(let r=0;r<BOARD.rows;r++){
    const y0=BOARD.y+r*BOARD.tile+(r<4?-gap/2:gap/2);
    if(y>=y0&&y<y0+BOARD.tile){row=r;break;}
  }
  return row!==null && col>=0&&col<BOARD.columns ? {col,row} : null;
}
export function cloneLineups(preset=DEFAULT_TEAMS) {
  return preset.map(team=>team.map(member=>({...member})));
}
export function maxHealth(stats) {return 60+stats.vida*2;}

function fromLineups(lineups) {
  let nextId=0;
  return lineups.flatMap((lineup,team)=>lineup.map(entry=>{
    const type=BY_ID[entry.id];if(!type)throw Error(`Pokémon não encontrado: ${entry.id}`);
    if((team===0&&entry.row>=4)||(team===1&&entry.row<4))throw Error('Posição fora da metade');
    const hp=maxHealth(type.stats);
    return { uid:`unit-${nextId++}`,team,type,col:entry.col,row:entry.row,
      renderCol:entry.col, renderRow:entry.row, destCol:entry.col, destRow:entry.row,
      moveTime:0,moveDuration:0,health:hp,maxHealth:hp,
      state:'Idle',stateTime:Math.random()*.5, facing:team===0?0:4,
      cooldown:0.35+Math.random()*.6, windup:0,fireSent:false,
      hitFlash:0,hurtTime:0,dead:false, attackKind:'spa',moveCount:0};
  }));
}

export function createBattle(lineups=DEFAULT_TEAMS) {
  const selected=cloneLineups(lineups);
  return { phase:'setup',elapsed:0,joinProgress:0,gap:INITIAL_GAP, winner:null,
    lineups:selected,units:fromLineups(selected),projectiles:[],effects:[],floaters:[],events:[],kills:[0,0] };
}
export function startBattle(battle) {
  if(battle.phase!=='setup')return false;
  if(!battle.lineups[0].length||!battle.lineups[1].length)return false;
  battle.phase='joining';battle.joinProgress=0;battle.events=[{type:'start'}];return true;
}
export function putPokemon(battle,team,id,col,row) {
  if(battle.phase!=='setup'||!BY_ID[id])return false;
  if(team!==0&&team!==1)return false;
  if(!Number.isInteger(col)||col<0||col>=BOARD.columns||!Number.isInteger(row)||row<0||row>=BOARD.rows)return false;
  if((team===0&&row>=4)||(team===1&&row<4))return false;
  const teamList=battle.lineups[team];
  const oldCell=teamList.findIndex(p=>p.row===row&&p.col===col);
  const oldSame=teamList.findIndex(p=>p.id===id);
  if(oldSame>=0){ teamList.splice(oldSame,1); }
  const occupying=teamList.findIndex(p=>p.row===row&&p.col===col);
  if(occupying>=0) teamList.splice(occupying,1);
  if(teamList.length>=3){ return false; }
  teamList.push({id,col,row});
  battle.units=fromLineups(battle.lineups);return true;
}
export function removePokemon(battle,team,col,row){
  if(battle.phase!=='setup')return false;
  const list=battle.lineups[team];
  const index=list.findIndex(p=>p.col===col&&p.row===row);
  if(index<0)return false;
  list.splice(index,1);battle.units=fromLineups(battle.lineups);return true;
}
export function randomLineups(random=Math.random){
  const ids=Object.keys(BY_ID);
  for(let i=ids.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[ids[i],ids[j]]=[ids[j],ids[i]];}
  const spots=[[[1,1],[4,1],[3,2]],[[1,6],[4,6],[5,5]]];
  return [0,1].map(team=>spots[team].map(([col,row],i)=>({id:ids[team*3+i],col,row})));
}

export function physicalOrSpecialDamage(attacker,defender,kind,random=Math.random){
  const power=kind==='atk'?attacker.stats.atk:attacker.stats.spa;
  const protection=kind==='atk'?defender.stats.def:defender.stats.spd;
  const variance=0.88+random()*0.24;
  return Math.max(1,Math.round((7+power*.47)*(100/(85+protection))*variance));
}
function setState(u,state){if(u.state!==state){u.state=state;u.stateTime=0;}}
function distance(a,b){return Math.hypot(a.col-b.col,a.row-b.row);}
function aliveUnits(battle,team){return battle.units.filter(u=>!u.dead&&u.team===team);}
function getTarget(battle,u,random){
  const candidates=aliveUnits(battle,1-u.team);
  if(!candidates.length)return null;
  candidates.sort((a,b)=>distance(u,a)-distance(u,b));
  // Preferir alvo próximo, mas às vezes escolher o segundo para variar a batalha.
  if(candidates.length>1&&random()<.22)return candidates[1];
  return candidates[0];
}
function canEnter(battle,unit,col,row){
  return col>=0&&col<BOARD.columns&&row>=0&&row<BOARD.rows&&!battle.units.some(u=>u!==unit&&!u.dead&&u.col===col&&u.row===row);
}
function moveUnit(battle,u,target,random){
  const stepOptions=[{dx:0,dy:1},{dx:1,dy:0},{dx:0,dy:-1},{dx:-1,dy:0},
    {dx:1,dy:1},{dx:1,dy:-1},{dx:-1,dy:1},{dx:-1,dy:-1}];
  const options=stepOptions.map(s=>({col:u.col+s.dx,row:u.row+s.dy,noise:random()*1.7}))
    .filter(s=>canEnter(battle,u,s.col,s.row));
  if(!options.length){setState(u,'Idle');u.cooldown=.2;return;}
  const dist=distance(u,target);
  const wander=dist<=3.2&&random()<.36;
  for(const opt of options){
    const d=Math.hypot(opt.col-target.col,opt.row-target.row);
    opt.score = wander ? opt.noise*2+Math.abs(d-2.6) : d+opt.noise;
  }
  options.sort((a,b)=>a.score-b.score);
  const to=options[0];
  u.renderCol=u.col;u.renderRow=u.row;
  u.col=to.col;u.row=to.row;
  u.destCol=to.col;u.destRow=to.row;
  u.moveDuration=.32+(.23*(1-u.type.stats.vel/120));
  if(u.moveDuration<.22)u.moveDuration=.22;
  u.moveTime=u.moveDuration;
  u.facing=getDirection(u.col-u.renderCol,u.row-u.renderRow);
  u.moveCount++;
  setState(u,'Walk');
}
function attack(battle,u,target,random){
  u.attackTarget=target.uid;
  u.attackKind=random()<.45?'atk':'spa';
  u.windup=.34;u.fireSent=false;
  u.facing=getDirection(target.col-u.col,target.row-u.row);
  setState(u,'Attack');
  battle.events.push({type:'prepare',name:u.type.name});
}
function fire(battle,u){
  const target=battle.units.find(z=>z.uid===u.attackTarget&&!z.dead);
  if(!target)return;
  const origin=tilePosition(u.col,u.row);
  const color=u.attackKind==='atk'?'#ffbf73':u.type.color;
  battle.projectiles.push({owner:u.uid,target:target.uid,team:u.team,
    x:origin.x,y:origin.y-18,kind:u.attackKind,color,radius:u.attackKind==='atk'?7:9,
    speed:u.attackKind==='atk'?415:335});
  battle.events.push({type:'attack',name:u.type.name,kind:u.attackKind});
}
function hit(battle,p,target,random){
  const attacker=battle.units.find(u=>u.uid===p.owner);
  if(!attacker)return;
  const damage=physicalOrSpecialDamage(attacker.type,target.type,p.kind,random);
  target.health=Math.max(0,target.health-damage);
  target.hitFlash=.25;target.hurtTime=.22;
  const at=unitPosition(target);
  battle.floaters.push({x:at.x,y:at.y-25,text:`-${damage}`,time:.8,total:.8,kind:p.kind});
  battle.effects.push({x:at.x,y:at.y-6,color:p.color,time:.34,total:.34});
  battle.events.push({type:'hit',name:target.type.name,damage,kind:p.kind});
  if(!target.health){
    target.dead=true;setState(target,'Hurt');battle.kills[attacker.team]++;
    battle.events.push({type:'ko',name:target.type.name,by:attacker.type.name});
    if(!aliveUnits(battle,target.team).length){
      battle.phase='finished';battle.winner=attacker.team;
      battle.events.push({type:'finish',winner:attacker.team});
    }
  }
}
export function unitPosition(u){
  if(u.moveTime>0){
    const progress=1-u.moveTime/u.moveDuration;
    const smooth=progress*progress*(3-2*progress);
    return tilePosition(u.renderCol+(u.destCol-u.renderCol)*smooth,u.renderRow+(u.destRow-u.renderRow)*smooth);
  }
  return tilePosition(u.col,u.row);
}
function decrementFx(battle,dt){
  for (const list of [battle.floaters,battle.effects]){
    for(const x of list)x.time-=dt;
    for(let i=list.length-1;i>=0;i--)if(list[i].time<=0)list.splice(i,1);
  }
  for(const u of battle.units){
    u.stateTime+=dt;
    u.hitFlash=Math.max(0,u.hitFlash-dt);
    u.hurtTime=Math.max(0,u.hurtTime-dt);
  }
}
export function updateBattle(battle,seconds,random=Math.random){
  const dt=Math.min(.05,Math.max(0,seconds));
  battle.events=[];
  decrementFx(battle,dt);
  if(battle.phase==='setup'||battle.phase==='finished')return battle;
  battle.elapsed+=dt;
  if(battle.phase==='joining'){
    battle.joinProgress=Math.min(1,battle.joinProgress+dt/1.15);
    const t=battle.joinProgress;
    battle.gap=INITIAL_GAP*(1-t*t*(3-2*t));
    if(t>=1){battle.phase='fighting';battle.gap=0;battle.events.push({type:'joined'});}
    return battle;
  }
  for(const u of battle.units){
    if(u.dead)continue;
    if(u.moveTime>0){
      u.moveTime=Math.max(0,u.moveTime-dt);
      if(u.moveTime===0){setState(u,'Idle');u.cooldown=.08+random()*.22;}
      continue;
    }
    if(u.windup>0){
      u.windup=Math.max(0,u.windup-dt);
      if(!u.fireSent && u.windup<=.18){u.fireSent=true;fire(battle,u);}
      if(u.windup===0){setState(u,'Idle');u.cooldown=.6+(120-u.type.stats.vel)*.007+random()*.35;}
      continue;
    }
    if(u.hurtTime>0){setState(u,'Hurt');continue;}
    u.cooldown-=dt;
    if(u.cooldown>0){setState(u,'Idle');continue;}
    const target=getTarget(battle,u,random);
    if(!target)continue;
    // A IA prefere ataques quando está perto, mas ainda se move ocasionalmente.
    if(distance(u,target)<=3.65&&random()<.72)attack(battle,u,target,random);
    else moveUnit(battle,u,target,random);
  }
  for(let i=battle.projectiles.length-1;i>=0;i--){
    const p=battle.projectiles[i];
    const target=battle.units.find(u=>u.uid===p.target&&!u.dead);
    if(!target){battle.projectiles.splice(i,1);continue;}
    const at=unitPosition(target);
    const dx=at.x-p.x,dy=at.y-18-p.y;
    const d=Math.hypot(dx,dy),step=dt*p.speed;
    if(d<=step+p.radius+7){
      battle.projectiles.splice(i,1);hit(battle,p,target,random);
    }else {p.x+=dx/d*step;p.y+=dy/d*step;}
  }
  if(battle.phase==='finished')battle.projectiles=[];
  return battle;
}
