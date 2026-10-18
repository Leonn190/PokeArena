import {initialLoadout} from './moves.mjs';
import { createBattle, startBattle, updateBattle, tilePosition } from './battle.mjs';
import { RULES, defeatDamage, placementDamage, fieldLimitForBattle, chapterForBattle, stageForBattle, battleKind, bossIv, PVE_DIFFICULTIES, shopOddsForBattle } from './rules.mjs';
import { awardLocalRoundIncome, awardLocalRoundLevels, prepareLocalRound, releaseEliminatedLocalPlayer, recordLocalResult, grantLocalLoot, collectLocalLoot, updateLocalAvatars } from './roster.mjs';
import { prepareLocalBots } from './ai.mjs';
import { SHOP_POKEMON } from './pokemon.mjs';
import { STRUCTURE_BY_ID } from './structures.mjs';

export const LOCAL_PHASES=Object.freeze({PREPARATION:'preparation',INTRO:'intro',COMBAT:'combat',RESULT:'result',FINISHED:'finished'});
const activePlayers=match=>match.players.filter(p=>!p.eliminated&&p.hp>0);
const findPlayer=(match,id)=>match.players.find(p=>p.id===id);
const cloneFormation=player=>player.board.map(u=>({...u,activeMoves:[...u.activeMoves]}));

// Formações em quatro setores; a equipe observada ocupa o setor inferior.
function arenaCell(col,row,team,count,size=1) {
  const local=row-6;
  if(count===4&&team>=2)return {col:col+10,row:team===2?row:5-local-(size-1)};
  return {col,row:team===1?5-local-(size-1):row};
}
function combatLineup(member,team,count,round) {
  return member.board.slice(0,fieldLimitForBattle(round)).map((unit,index)=>({...unit,
    instanceId:member.clone||member.pve?`${member.id}-${index}`:unit.instanceId,
    ...arenaCell(unit.col,unit.row,team,count),team}));
}
function environmentFor(member,team,count) {
  return {structures:(member.structures||[]).map(s=>{
    const size=STRUCTURE_BY_ID[s.id]?.size||1;
    const cell=arenaCell(s.col,s.row+6,team,count,size);
    const pos=tilePosition(cell.col+(size-1)/2,cell.row+(size-1)/2);
    return {...s,combatX:pos.x,combatY:pos.y};
  })};
}
function pveTeam(match,player,random) {
  if(battleKind(match.round)==='legendary')return {id:`boss-${player.id}`,pve:true,structures:[],board:[{
    speciesId:match.legendaryId,col:4,row:8,iv:100,bossIv:bossIv(match.chapter),activeMoves:initialLoadout(match.legendaryId,random)
  }]};
  const difficulty=PVE_DIFFICULTIES[player.pveDifficulty];
  const count=Math.max(1,Math.min(6,fieldLimitForBattle(match.round)+difficulty.countOffset));
  const odds=shopOddsForBattle(match.round),rarities=Object.keys(RULES.rarityPrice);
  const catalog=SHOP_POKEMON.filter(p=>!['mitico','lendario'].includes(p.rarity));
  const board=Array.from({length:count},(_,i)=>{
    let roll=random()*catalog.reduce((sum,p)=>sum+odds[rarities.indexOf(p.rarity)]/catalog.filter(c=>c.rarity===p.rarity).length,0);
    const species=catalog.find(p=>(roll-=odds[rarities.indexOf(p.rarity)]/catalog.filter(c=>c.rarity===p.rarity).length)<0)||catalog[0];
    return {speciesId:species.id,col:[4,5,3,6,2,7][i],row:8,iv:Math.min(100,40+(match.chapter-1)*20),pveModifiers:difficulty,activeMoves:initialLoadout(species.id,random)};
  });
  return {id:`pve-${player.id}`,pve:true,structures:[],board};
}
function makePairings(match,random) {
  const players=activePlayers(match),kind=battleKind(match.round);
  if(['pve','legendary'].includes(kind))return players.map((p,i)=>({id:`r${match.round}-${i}`,members:[p,pveTeam(match,p,random)]}));
  const size=kind==='quadruple'?4:2;
  // Distribui os reais antes de completar grupos, minimizando clones e grupos solitários.
  const count=Math.ceil(players.length/size),groups=Array.from({length:count},()=>[]);
  const offset=(match.round-1)%players.length;
  const ordered=players.slice(offset).concat(players.slice(0,offset));
  const waiting=[...ordered],previous=new Set(match.previousPairs||[]);
  const pairKey=(a,b)=>[a,b].sort().join('|');
  while(waiting.length)for(const group of groups){
    if(!waiting.length)break;
    const candidate=waiting.map((p,index)=>({index,score:group.filter(m=>previous.has(pairKey(m.id,p.id))).length})).sort((a,b)=>a.score-b.score)[0];
    group.push(waiting.splice(candidate.index,1)[0]);
  }
  return groups.map((members,index)=>{
    let cursor=0;
    while(members.length<size){
      const source=ordered.find(p=>!members.some(m=>(m.sourceId||m.id)===p.id))||ordered[cursor++%ordered.length];
      members.push({id:`clone-${match.round}-${index}-${members.length}`,sourceId:source.id,name:`Clone de ${source.name}`,clone:true,board:cloneFormation(source),structures:source.structures.map(s=>({...s}))});
    }
    const owner=members.findIndex(member=>member.id===match.ownerId);
    if(owner>0)members.unshift(members.splice(owner,1)[0]);
    return {id:`r${match.round}-${index}`,members};
  });
}
export function startLocalMatchCycle(match,nowSeconds=0,random=Math.random) {
  match.chapter=chapterForBattle(match.round);match.stage=stageForBattle(match.round);
  if(match.legendaryChapter!==match.chapter){
    const bosses=SHOP_POKEMON.filter(p=>p.rarity==='lendario');
    match.legendaryId=bosses[Math.floor(random()*bosses.length)].id;match.legendaryChapter=match.chapter;
  }
  match.phase='preparation';match.phaseStartedAt=nowSeconds;match.phaseDeadline=nowSeconds+RULES.preparationSeconds;
  match.combats=[];match.pairings=[];
  for(const player of match.players){collectLocalLoot(match,player,true,random);player.bet=null;
    player.avatar.x=Math.min(780,player.avatar.x);player.avatar.targetX=Math.min(780,player.avatar.targetX);
  }
  prepareLocalRound(match,random);prepareLocalBots(match,random);
  match.lastMessage='Prepare sua equipe para a próxima fase.';return match;
}
export function startCombatPhase(match,nowSeconds=0,random=Math.random) {
  match.roundLevelRoster=Object.fromEntries(activePlayers(match).map(player=>[player.id,{
    field:player.board.slice(0,fieldLimitForBattle(match.round)).map(unit=>unit.instanceId),
    bench:player.bench.filter(unit=>unit&&unit.kind!=='structure').map(unit=>unit.instanceId)
  }]));
  match.phase='intro';match.phaseStartedAt=nowSeconds;match.phaseDeadline=nowSeconds+RULES.battleIntroSeconds;
  match.pairings=makePairings(match,random);
  match.combats=match.pairings.map(pairing=>{
    const count=pairing.members.length;
    return {...pairing,playerIds:pairing.members.map(m=>m.id),status:'running',result:null,goldKillsPaid:pairing.members.map(()=>0),
      battle:createBattle(pairing.members.map((m,t)=>combatLineup(m,t,count,match.round)),pairing.members.map((m,t)=>environmentFor(m,t,count)))};
  });
  match.previousPairs=match.combats.flatMap(c=>c.members.filter(m=>!m.clone&&!m.pve).flatMap((m,i,list)=>list.slice(i+1).map(other=>[m.id,other.id].sort().join('|'))));
  match.lastMessage='Entrada das equipes.';return match;
}
function finishCombat(match,combat,random) {
  if(combat.status!=='running'||combat.battle.phase!=='finished')return;
  const battle=combat.battle,kind=battleKind(match.round),special=kind==='quadruple',pve=['pve','legendary'].includes(kind);
  const winner=battle.winner,survivors=battle.units.filter(u=>!u.dead&&u.team===winner);
  combat.status='finished';combat.result={winnerId:combat.members[winner]?.id||null,damage:0,survivors:survivors.length,ranking:battle.ranking.map(t=>combat.members[t].id),outcomes:{}};
  const reports=combat.members.map((member,team)=>({playerId:member.id,name:member.name||'PvE',round:match.round,
    units:battle.units.filter(u=>u.team===team).map(u=>({instanceId:u.uid,speciesId:u.type.id,damage:u.damageDealt,
      damagePhysical:u.damagePhysical,damageSpecial:u.damageSpecial,mitigatedPhysical:u.mitigatedPhysical,
      mitigatedSpecial:u.mitigatedSpecial,healingDone:u.healingDone,health:u.health,maxHealth:u.maxHealth,energy:u.energy,maxEnergy:u.maxEnergy}))}));
  for(const [team,member] of combat.members.entries()){
    if(member.clone||member.pve)continue;
    const player=findPlayer(match,member.id),place=battle.ranking.indexOf(team)+1;
    const result=special?(place===1?'win':place===combat.members.length?'loss':'neutral'):winner===null?'neutral':winner===team?'win':'loss';
    const damage=pve?0:special?placementDamage(match.round,place,match.roomModifier):result==='loss'?defeatDamage(match.round,survivors,match.roomModifier):0;
    player.lastRoundDamage={...reports[team],opponents:reports.filter((_,index)=>index!==team)};
    if(kind==='gold')player.gold+=(result==='win'?3:0)+battle.units.filter(u=>u.team===team&&!u.dead).length;
    if(pve&&result==='win')grantLocalLoot(match,player,kind==='legendary'?4:match.chapter+PVE_DIFFICULTIES[player.pveDifficulty].points,random,kind==='legendary');
    recordLocalResult(match,player,result,damage,special?place:null);
    combat.result.outcomes[player.id]={result,damage,place};
    if(damage){combat.result.damage=Math.max(combat.result.damage,damage);combat.result.loserId=player.id;}
  }
}
function finishCombatPhase(match,nowSeconds,random) {
  for(const combat of match.combats)finishCombat(match,combat,random);
  match.outcomes.push({round:match.round,combats:match.combats.map(c=>({id:c.id,playerIds:c.playerIds,status:c.status,result:c.result}))});
  awardLocalRoundLevels(match);
  awardLocalRoundIncome(match);
  for(const p of match.players)releaseEliminatedLocalPlayer(match,p);
  // A animação representa o HP já decidido no domínio.
  match.phase='result';match.phaseStartedAt=nowSeconds;match.phaseDeadline=nowSeconds+4;
  return match;
}
export function updateLocalMatchCycle(match,dtSeconds,nowSeconds=0,random=Math.random) {
  if(!match||match.phase==='finished')return match;
  updateLocalAvatars(match,dtSeconds,random);
  if(match.phase==='preparation'&&nowSeconds>=match.phaseDeadline)return startCombatPhase(match,nowSeconds,random);
  if(match.phase==='intro'){
    if(nowSeconds<match.phaseDeadline)return match;
    match.phase='combat';match.phaseStartedAt=nowSeconds;match.phaseDeadline=nowSeconds+RULES.battleSeconds;
    for(const c of match.combats)startBattle(c.battle);return match;
  }
  if(match.phase==='result'){
    if(nowSeconds<match.phaseDeadline)return match;
    for(const p of match.players)collectLocalLoot(match,p,true,random);
    const alive=activePlayers(match);
    if(alive.length<=1){match.phase='finished';match.championId=alive[0]?.id||null;match.phaseDeadline=null;match.combats=[];match.pairings=[];return match;}
    match.round++;return startLocalMatchCycle(match,nowSeconds,random);
  }
  if(match.phase!=='combat')return match;
  for(const combat of match.combats){
    if(combat.status!=='running')continue;
    updateBattle(combat.battle,dtSeconds,random);
    if(nowSeconds>=match.phaseDeadline){
      let remaining=Math.max(0,RULES.battleSeconds-combat.battle.elapsed);
      while(remaining>0&&combat.battle.phase==='fighting'){const step=Math.min(.05,remaining);updateBattle(combat.battle,step,random);remaining-=step;}
    }
    if(battleKind(match.round)==='gold')for(const [team,member] of combat.members.entries()){
      if(member.clone||member.pve)continue;
      const earned=combat.battle.kills[team]-combat.goldKillsPaid[team];
      if(earned){findPlayer(match,member.id).gold+=earned;combat.goldKillsPaid[team]+=earned;match.revision++;}
    }
    finishCombat(match,combat,random);
  }
  if(match.combats.every(c=>c.status==='finished'))finishCombatPhase(match,nowSeconds,random);
  return match;
}
export const phaseRemainingSeconds=(match,nowSeconds=0)=>match?.phaseDeadline?Math.max(0,Math.ceil(match.phaseDeadline-nowSeconds)):0;
export const aliveCount=match=>activePlayers(match).length;
export const combatForPlayer=(match,id)=>match?.combats?.find(c=>c.playerIds.includes(id))||null;
