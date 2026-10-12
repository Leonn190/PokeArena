import { BY_ID, POKEMON, getDirection } from './pokemon.mjs';
import { MOVES_BY_ID, movePool, initialLoadout, chooseMoveAnimation } from './moves.mjs';

// 10 colunas x 5 linhas é a área jogável. O mundo possui coordenadas contínuas (pixels).
export const BOARD = Object.freeze({ columns:10, rows:5, teamColumns:5, width:960, height:590, tile:76, x:100, y:100 });
export const DEFAULT_TEAMS = [
  [{id:'0001',col:1,row:1},{id:'0005',col:2,row:3},{id:'0009',col:3,row:2}],
  [{id:'0007',col:8,row:1},{id:'0002',col:7,row:3},{id:'0006',col:6,row:2}]
];
const TAU=Math.PI*2;
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const rnd=(random)=>random();
const worldBounds={minX:BOARD.x+12,maxX:BOARD.x+BOARD.columns*BOARD.tile-12,minY:BOARD.y+12,maxY:BOARD.y+BOARD.rows*BOARD.tile-12};
export function tilePosition(col,row){return {x:BOARD.x+(col+.5)*BOARD.tile,y:BOARD.y+(row+.5)*BOARD.tile};}
export function cellAtPixel(x,y){const col=Math.floor((x-BOARD.x)/BOARD.tile),row=Math.floor((y-BOARD.y)/BOARD.tile);return col>=0&&col<BOARD.columns&&row>=0&&row<BOARD.rows?{col,row}:null;}
export function teamAt(x){return x<BOARD.x+BOARD.columns*BOARD.tile/2?0:1;}
export const maxHealth=(stats)=>60+stats.vida*2;
export const cloneLineups=(preset=DEFAULT_TEAMS)=>preset.map(team=>team.map(p=>({...p,activeMoves:p.activeMoves?.slice()})));
export const unitPosition=u=>({x:u.x,y:u.y});
export function moveSpeed(stats){return 55+stats.vel*.58;}
export function attackInterval(stats){return clamp(1.53-stats.vel*.0085,.48,1.42);}
export function physicalOrSpecialDamage(attacker,defender,kind,random=Math.random,baseDamage=30){
  const a=attacker.stats[kind==='atk'?'atk':'spa'];
  const d=defender.stats[kind==='atk'?'def':'spd'];
  return Math.max(1,Math.round(baseDamage*(.62+a/105)*(100/(80+d))*(.92+random()*.16)));
}
function normalizeEntry(entry,team){
  const fromTile=tilePosition(entry.col??(team===0?2:7),entry.row??2);
  const x=entry.x??fromTile.x, y=entry.y??fromTile.y;
  return {id:entry.id,x,y,col:clamp(Math.floor((x-BOARD.x)/BOARD.tile),0,9),row:clamp(Math.floor((y-BOARD.y)/BOARD.tile),0,4),activeMoves:entry.activeMoves?.slice()||initialLoadout(entry.id)};
}
function makeUnits(lineups){
  let uid=0;
  return lineups.flatMap((list,team)=>list.map(entry=>{
    const p=BY_ID[entry.id];if(!p)throw new Error('Pokémon inválido: '+entry.id);
    const pos=normalizeEntry(entry,team);const hp=maxHealth(p.stats);
    return {uid:`unit-${uid++}`,team,type:p,...pos, health:hp,maxHealth:hp,dead:false,
      vx:0,vy:0,radius:clamp(12+p.sprites.Idle.width*.23,16,26),
      state:'Idle',stateTime:0, facing:team===0?6:2,
      cooldown:.25+uid*.12,cast:null,hitFlash:0,hurtTime:0, moveCount:0,
      distanceMoved:0,attackCount:0};
  }));
}
export function createBattle(preset=DEFAULT_TEAMS){
  const lineups=cloneLineups(preset).map((list,team)=>list.map(p=>normalizeEntry(p,team)));
  return {phase:'setup',elapsed:0,winner:null,lineups,units:makeUnits(lineups),
    projectiles:[],effects:[],floaters:[],events:[],kills:[0,0]};
}
export function startBattle(b){
  if(b.phase!=='setup'||!b.lineups[0].length||!b.lineups[1].length)return false;
  b.phase='fighting';b.elapsed=0;b.events=[{type:'start'}];return true;
}
function slotOccupant(b,team,x,y,except=null){
  return b.lineups[team].find(p=>p!==except&&Math.hypot(p.x-x,p.y-y)<46);
}
export function putPokemonAt(b,team,id,x,y,from=null){
  if(b.phase!=='setup'||!BY_ID[id]||![0,1].includes(team)||!cellAtPixel(x,y)||teamAt(x)!==team)return false;
  const sourceTeam=from?.team;
  const source=Number.isInteger(sourceTeam)?b.lineups[sourceTeam]?.[from.index]:null;
  if(from&&!source)return false;
  const destination=b.lineups[team];
  const current=source||destination.find(p=>p.id===id);
  if(!current&&destination.length>=3)return false;
  if(source&&sourceTeam!==team&&destination.length>=3)return false;
  if(slotOccupant(b,team,x,y,current))return false;
  if(source){b.lineups[sourceTeam].splice(from.index,1);}
  else if(current){destination.splice(destination.indexOf(current),1);}
  const safeX=clamp(x,worldBounds.minX,worldBounds.maxX);
  const safeY=clamp(y,worldBounds.minY,worldBounds.maxY);
  const entry=normalizeEntry({...current,id,x:safeX,y:safeY},team);
  destination.push(entry);b.units=makeUnits(b.lineups);return true;
}
export function putPokemon(b,team,id,col,row){
  if(!Number.isInteger(col)||!Number.isInteger(row)||col<0||col>=10||row<0||row>=5)return false;
  const p=tilePosition(col,row);return putPokemonAt(b,team,id,p.x,p.y);
}
export function removePokemonAt(b,team,index){
  if(b.phase!=='setup'||!b.lineups[team]?.[index])return false;
  b.lineups[team].splice(index,1);b.units=makeUnits(b.lineups);return true;
}
export function removePokemon(b,team,col,row){
  const i=b.lineups[team]?.findIndex(p=>p.col===col&&p.row===row)??-1;
  return removePokemonAt(b,team,i);
}
export function updateLoadout(b,id,moves){
  if(b.phase!=='setup'||!BY_ID[id]||moves.length!==2||new Set(moves).size!==2)return false;
  const pool=movePool(id);if(!moves.every(m=>pool.some(x=>x.id===m)))return false;
  for(const list of b.lineups)for(const p of list)if(p.id===id)p.activeMoves=moves.slice();
  for(const u of b.units)if(u.type.id===id)u.activeMoves=moves.slice();
  return true;
}
export function randomLineups(random=Math.random){
  const ids=POKEMON.map(p=>p.id);
  for(let i=ids.length-1;i>0;i--){const j=Math.min(i,Math.floor(random()*(i+1)));[ids[j],ids[i]]=[ids[i],ids[j]];}
  const cells=[[[1,1],[2,3],[3,2]],[[8,1],[7,3],[6,2]]];
  return cells.map((team,t)=>team.map(([col,row],i)=>({id:ids[t*3+i],col,row})));
}
const setState=(u,state)=>{if(u.state!==state){u.state=state;u.stateTime=0;}};
const alive=(b,team)=>b.units.filter(u=>!u.dead&&u.team===team);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function edgeDistance(a,b){return Math.max(0,dist(a,b)-a.radius-b.radius);}
export function attackRangePixels(move){return move.range*BOARD.tile;}
// A janela do ataque pode ser maior que a animação Idle. Essa margem
// pequena aproxima golpes com alcance de membros (garra/chicote/asa),
// sem converter todo o frame transparente da spritesheet em hitbox.
export function effectiveAttackRange(unit,move){
  const nominal=attackRangePixels(move);
  if(move.projectile)return nominal;
  const animation=chooseMoveAnimation(move,unit.type.sprites);
  const idle=unit.type.sprites.Idle;
  const attack=unit.type.sprites[animation];
  if(!attack||!idle)return nominal;
  return nominal+clamp((Math.max(attack.width-idle.width,attack.height-idle.height))*.22,0,18);
}
function getTarget(b,u){return alive(b,1-u.team).sort((a,z)=>dist(a,u)-dist(z,u))[0]||null;}
function getMoves(u){return u.activeMoves.map(m=>MOVES_BY_ID[m]).filter(Boolean);}
function turnTowards(u,target){u.facing=getDirection(target.x-u.x,target.y-u.y);}
function beginAttack(b,u,target,move){
  const animation=chooseMoveAnimation(move,u.type.sprites);
  const meta=u.type.sprites[animation]||u.type.sprites.Attack;
  const durations=meta?.durations||[4,4,4,4,4];
  const natural=durations.reduce((s,n)=>s+n,0)/60;
  const length=clamp(natural,.28,1.15);
  const hitFrame=clamp(meta?.hitFrame??Math.floor(durations.length*.55),0,durations.length-1);
  const hitAt=clamp(durations.slice(0,hitFrame).reduce((s,n)=>s+n,0)/60,.08,length*.92);
  u.cast={moveId:move.id,animation,length,hitAt,elapsed:0,fired:false,targetId:target.uid};
  u.vx=0;u.vy=0;turnTowards(u,target);setState(u,animation);
  b.events.push({type:'prepare',name:u.type.name,move:move.name,animation});
}
function spawnProjectile(b,u,target,move){
  const dx=target.x-u.x,dy=target.y-u.y;
  const length=Math.hypot(dx,dy)||1;
  const sx=u.x+(dx/length)*(u.radius+11), sy=u.y-18+(dy/length)*8;
  b.projectiles.push({owner:u.uid,target:target.uid,team:u.team,moveId:move.id,
    x:sx,y:sy,vx:dx/length,vy:dy/length,speed:move.projectileSpeed||410,
    radius:move.category==='atk'?6:9,color:move.color,life:1.8});
}
function applyHit(b,attacker,target,move,random){
  if(target.dead)return;
  const damage=physicalOrSpecialDamage(attacker.type,target.type,move.category,random,move.damage);
  target.health=Math.max(0,target.health-damage);
  target.hitFlash=.20;target.hurtTime=.18;
  b.floaters.push({x:target.x,y:target.y-40,text:`-${damage}`,time:.85,total:.85,kind:move.category});
  b.effects.push({x:target.x,y:target.y-15,color:move.color,time:.35,total:.35,style:move.effect});
  b.events.push({type:'hit',name:target.type.name,damage,kind:move.category,move:move.name});
  if(target.health===0){
    target.dead=true;setState(target,'Hurt');b.kills[attacker.team]++;
    b.events.push({type:'ko',name:target.type.name,by:attacker.type.name});
    if(!alive(b,target.team).length){b.phase='finished';b.winner=attacker.team;b.events.push({type:'finish',winner:b.winner});}
  }
}
function handleCast(b,u,dt,random){
  const cast=u.cast,move=MOVES_BY_ID[cast.moveId];
  cast.elapsed+=dt;u.vx=u.vy=0;
  if(!cast.fired&&cast.elapsed>=cast.hitAt){
    cast.fired=true;u.attackCount++;
    const target=b.units.find(z=>z.uid===cast.targetId&&!z.dead);
    b.events.push({type:'attack',name:u.type.name,kind:move.category,move:move.name});
    if(target){
      if(move.projectile&&edgeDistance(u,target)<=effectiveAttackRange(u,move)+35)spawnProjectile(b,u,target,move);
      else if(!move.projectile&&edgeDistance(u,target)<=effectiveAttackRange(u,move)+9)applyHit(b,u,target,move,random);
    }
  }
  if(cast.elapsed>=cast.length){u.cast=null;setState(u,'Idle');u.cooldown=attackInterval(u.type.stats)*(.88+random()*.24);}
}
function collideAndClamp(b,u,dt){
  u.x=clamp(u.x,worldBounds.minX+u.radius,worldBounds.maxX-u.radius);
  u.y=clamp(u.y,worldBounds.minY+u.radius,worldBounds.maxY-u.radius);
  for(const other of b.units){
    if(other===u||other.dead)continue;
    const dx=u.x-other.x,dy=u.y-other.y;
    const r=u.radius+other.radius+3;const d=Math.hypot(dx,dy);
    if(d<r){
      const angle=d>0.001?Math.atan2(dy,dx):((u.uid<other.uid)?0:Math.PI);
      const overlap=(r-d)*.5;
      const nx=Math.cos(angle),ny=Math.sin(angle);
      u.x+=nx*overlap;u.y+=ny*overlap;
      if(!other.cast){other.x-=nx*overlap;other.y-=ny*overlap;}
    }
  }
  u.x=clamp(u.x,worldBounds.minX+u.radius,worldBounds.maxX-u.radius);
  u.y=clamp(u.y,worldBounds.minY+u.radius,worldBounds.maxY-u.radius);
}
function moveToTarget(b,u,target,dt,ideal){
  const dx=target.x-u.x,dy=target.y-u.y,d=Math.hypot(dx,dy)||1;
  const edge=Math.max(0,d-u.radius-target.radius);
  let nx=dx/d,ny=dy/d;
  let intensity=clamp((edge-ideal)/25,-1,1);
  // Um pouco de flanqueamento quando o alvo está perto, sem saltar de quadrado em quadrado.
  if(Math.abs(intensity)<.25){intensity=0;}
  if(intensity===0){u.vx=0;u.vy=0;setState(u,'Idle');return;}
  const speed=moveSpeed(u.type.stats);
  const vx=nx*speed*intensity,vy=ny*speed*intensity;
  const oldX=u.x,oldY=u.y;
  u.vx=vx;u.vy=vy;u.x+=vx*dt;u.y+=vy*dt;
  collideAndClamp(b,u,dt);
  const walked=Math.hypot(u.x-oldX,u.y-oldY);
  u.distanceMoved+=walked;
  if(walked>.03){u.moveCount++;u.facing=getDirection(u.x-oldX,u.y-oldY);setState(u,'Walk');}
  else {u.vx=u.vy=0;setState(u,'Idle');}
}
export function updateBattle(b,seconds,random=Math.random){
  const dt=clamp(seconds,0,.05);b.events=[];
  for(const fx of [b.effects,b.floaters])for(let i=fx.length-1;i>=0;i--){fx[i].time-=dt;if(fx[i].time<=0)fx.splice(i,1);}
  for(const u of b.units){u.stateTime+=dt;u.hitFlash=Math.max(0,u.hitFlash-dt);u.hurtTime=Math.max(0,u.hurtTime-dt);}
  if(b.phase!=='fighting')return b;
  b.elapsed+=dt;
  for(const u of b.units){
    if(u.dead)continue;
    if(u.cast){handleCast(b,u,dt,random);continue;}
    if(u.hurtTime>0){u.vx=u.vy=0;setState(u,'Hurt');continue;}
    const target=getTarget(b,u);if(!target)continue;
    const moves=getMoves(u);
    const inRange=moves.filter(m=>edgeDistance(u,target)<=effectiveAttackRange(u,m));
    u.cooldown-=dt;
    if(u.cooldown<=0&&inRange.length){
      // Varia entre as duas habilidades equipadas, respeitando alcance e tempo de recarga.
      const chosen=inRange[Math.floor(random()*inRange.length)];beginAttack(b,u,target,chosen);continue;
    }
    const goal=Math.max(...moves.map(m=>effectiveAttackRange(u,m)))*.72;
    moveToTarget(b,u,target,dt,goal);
  }
  for(let i=b.projectiles.length-1;i>=0;i--){
    const p=b.projectiles[i];p.life-=dt;
    const target=b.units.find(u=>u.uid===p.target&&!u.dead);
    if(p.life<=0||!target){b.projectiles.splice(i,1);continue;}
    const dx=target.x-p.x,dy=target.y-17-p.y,d=Math.hypot(dx,dy);
    const step=dt*p.speed;
    if(d<step+target.radius*.75){b.projectiles.splice(i,1);const owner=b.units.find(u=>u.uid===p.owner);if(owner)applyHit(b,owner,target,MOVES_BY_ID[p.moveId],random);}
    else {p.vx=dx/d;p.vy=dy/d;p.x+=p.vx*step;p.y+=p.vy*step;}
    if(b.phase==='finished')break;
  }
  return b;
}
