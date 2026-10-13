import {LOOT_TIERS,BALL_CONFIG} from '../../config/espolios.mjs';
import {initialLoadout, MOVES_BY_ID} from './moves.mjs';
import { RULES, fieldLimitForBattle, interestForGold, shopOddsForBattle, roomModifier, battleKind, streakBonus, PVE_DIFFICULTIES } from './rules.mjs';
import { BY_ID, SHOP_POKEMON, FUSION_COSTS, EVOLUTION_OPTIONS } from './pokemon.mjs';
import {calculateCompass, speciesCompassWeight, weightedSpeciesPick,ALL_TYPES} from './compass.mjs';
import {STRUCTURES,placeStructure,movePlacedStructure,bankStructure} from './structures.mjs';

// Todas as operações de partida são síncronas e executadas em memória.
// match.pool representa somente cópias LIVRES; ofertas possuem reservas próprias.
const RARITIES = Object.keys(RULES.rarityPrice);
const purchasedCopies = unit => unit.provenance || [{speciesId:unit.speciesId, cost:unit.purchaseCost ?? BY_ID[unit.speciesId]?.price ?? 0}];
const ownedUnits = participant => [...participant.board, ...participant.bench.filter(u=>u&&u.kind!=='structure')];
const soldValue = unit => Math.max(0, purchasedCopies(unit).reduce((sum, part) => sum + part.cost, 0) - (unit.evolutionSteps || 0));
export const saleValueLocal = soldValue;

export function createParticipant({id,name,isBot}) {
  return {
    id,name,isBot,hp:RULES.startingHp,gold:RULES.startingGold,
    bench:Array(RULES.bankSlots).fill(null),board:[],shop:Array(RULES.shopSlots).fill(null),
    shopKinds:Array(RULES.shopSlots).fill(null),
    shopLocked:false,items:[],structures:[],consumables:[],loot:[],pendingRewards:[],
    avatar:{x:500,y:665,targetX:500,targetY:665},streak:{result:null,count:0},history:[],bet:null,pveDifficulty:'medium',
    compass:Object.fromEntries(ALL_TYPES.map(type=>[type,0])),eliminated:false,
    unitInventory:[],reservedOffers:Array(RULES.shopSlots).fill(null)
  };
}

// Entidade de partida; a lógica não depende de um simulador paralelo.
export function createMatchPokemon(speciesId,team,instanceId,random=Math.random) {
  return {
    instanceId,speciesId,team,iv:Math.min(100,Math.floor(random()*101)),
    activeMoves:initialLoadout(speciesId),slots:2,
    col:team?5:4,row:team?2:7
  };
}

export function createLocalMatchState(playerCount,sessionId) {
  if(!Number.isInteger(playerCount)||playerCount<RULES.minPlayers||playerCount>RULES.maxPlayers)
    throw new RangeError(`A partida local aceita ${RULES.minPlayers} a ${RULES.maxPlayers} participantes.`);
  const ownerId=`${sessionId}-player`;
  const players=[createParticipant({id:ownerId,name:'Jogador',isBot:false})];
  for(let i=1;i<playerCount;i++) players.push(createParticipant({id:`${sessionId}-bot-${i}`,name:`Bot ${i}`,isBot:true}));
  return {
    id:sessionId,ownerId,ruleset:RULES.version,revision:0,round:1,
    phase:'awaiting-match-engine',players,outcomes:[],championId:null,
    pool:Object.fromEntries(SHOP_POKEMON.map(p => [p.id,RULES.rarityPool[p.rarity]])),
    pairings:[],phaseDeadline:null,nextUnitId:0,localOnly:true,initialPlayerCount:playerCount,roomModifier:roomModifier(playerCount),chapter:1,stage:1
  };
}

function poolCount(match,speciesId) {return match.pool[speciesId] ?? 0;}
function returnToPool(match,speciesId) {
  const species=BY_ID[speciesId];
  if(!species||!Object.hasOwn(RULES.rarityPool,species.rarity))return;
  match.pool[speciesId]=Math.min(RULES.rarityPool[species.rarity],poolCount(match,speciesId)+1);
}
function releaseOffers(match,participant) {
  for(const speciesId of participant.reservedOffers || []) if(speciesId) returnToPool(match,speciesId);
  participant.reservedOffers=Array(RULES.shopSlots).fill(null);
  participant.shop=Array(RULES.shopSlots).fill(null);
  participant.shopKinds=Array(RULES.shopSlots).fill(null);
}
function rollSpecies(match,participant,random) {
  const odds=shopOddsForBattle(match.round);
  const available=SHOP_POKEMON.filter(p => poolCount(match,p.id)>0 &&
    !(p.name==='Zygarde' && ownedUnits(participant).some(u => u.speciesId===p.id && u.zygardeProgress>=100)));
  if(!available.length)return null;
  // Sorteia a raridade antes da disponibilidade: uma pool esgotada deixa o slot vazio.
  const tiers=RARITIES.map((rarity,index) => ({rarity,weight:odds[index],species:available.filter(p => p.rarity===rarity)}));
  if(!tiers.length)return null;
  const total=tiers.reduce((sum,t)=>sum+t.weight,0);
  let roll=random()*total;
  const tier=tiers.find(t => (roll-=t.weight)<0) || tiers[tiers.length-1];
  participant.compass=calculateCompass(participant);
  return weightedSpeciesPick(tier.species,participant.compass,random)?.id||null;
}
function kindForSlot(slot,random) {
  if(slot>=RULES.flexibleShopSlots)return 'pokemon';
  const roll=random();
  return roll<RULES.flexibleOdds.pokemon ? 'pokemon':'estrutura';
}
export const canManageLocalInventory=(match,participant)=>!!participant&&!participant.eliminated&&
  ['preparation','intro','combat'].includes(match?.phase);
export function refreshLocalShop(match,participant,random=Math.random,paid=false) {
  if(!canManageLocalInventory(match,participant)||participant.shopLocked)return false;
  if(paid&&participant.gold<RULES.rerollCostGold)return false;
  if(paid)participant.gold-=RULES.rerollCostGold;
  releaseOffers(match,participant);
  for(let i=0;i<RULES.shopSlots;i++) {
    const kind=kindForSlot(i,random);
    participant.shopKinds[i]=kind;
    // Consumíveis são exclusivos de espólios; os dois slots flexíveis não os ofertam.
    if(kind==='estrutura') {
      const weighted=STRUCTURES.map(s=>({s,weight:s.rarity==='comum'?65:s.rarity==='rara'?27:8}));
      let pick=random()*weighted.reduce((sum,x)=>sum+x.weight,0);
      participant.shop[i]=(weighted.find(x=>(pick-=x.weight)<0)||weighted.at(-1)).s.id;
      continue;
    }
    if(kind!=='pokemon')continue;
    const id=rollSpecies(match,participant,random);
    if(!id)continue;
    participant.shop[i]=id;
    participant.reservedOffers[i]=id;
    match.pool[id]-=1;
  }
  match.revision++;
  return true;
}
export function toggleLocalShopLock(match,participant) {
  if(!canManageLocalInventory(match,participant))return false;
  participant.shopLocked=!participant.shopLocked;
  match.revision++;
  return true;
}
const fullBench = p => p.bench.every(Boolean);
function chooseEvolution(unit,participant,random) {
  const options=EVOLUTION_OPTIONS[unit.speciesId] || [];
  if(!options.length)return null;
  if(options.length===1)return options[0];
  const influence=calculateCompass(participant);
  const weighted=options.map(id=>({id,weight:speciesCompassWeight(BY_ID[id],influence)}));
  participant.compass=influence;
  let pick=random()*weighted.reduce((sum,item)=>sum+item.weight,0);
  return (weighted.find(item=>(pick-=item.weight)<0)||weighted.at(-1)).id;
}
function removeOwnedUnit(participant,unit) {
  const slot=participant.bench.indexOf(unit);
  if(slot>=0)participant.bench[slot]=null;
  const index=participant.board.indexOf(unit);
  if(index>=0)participant.board.splice(index,1);
}

export function fuseLocalUnits(match,participant,random=Math.random) {
  let count=0;
  // Zygarde mantém uma única instância física, inclusive quando recebido por espólio/clonagem.
  const zygardes=ownedUnits(participant).filter(u=>BY_ID[u.speciesId]?.name==='Zygarde');
  if(zygardes.length){
    const keeper=zygardes[0];keeper.zygardeProgress||=10;
    for(const other of zygardes.slice(1)){
      keeper.provenance=[...purchasedCopies(keeper),...purchasedCopies(other)];
      keeper.purchaseCost=keeper.provenance.reduce((sum,p)=>sum+p.cost,0);
      keeper.zygardeProgress=Math.min(100,keeper.zygardeProgress+(other.zygardeProgress||10));
      keeper.iv=Math.max(keeper.iv,other.iv);
      participant.items.push(...(other.items||[]));removeOwnedUnit(participant,other);count++;match.revision++;
    }
    if(keeper.zygardeProgress>=100)for(let slot=0;slot<RULES.shopSlots;slot++){
      if(participant.reservedOffers[slot]!==keeper.speciesId)continue;
      returnToPool(match,keeper.speciesId);participant.reservedOffers[slot]=null;participant.shop[slot]=null;participant.shopKinds[slot]=null;
    }
  }
  // Inclui cópias de origens distintas que resultaram na mesma espécie.
  for(let guard=0;guard<100;guard++) {
    const units=ownedUnits(participant);
    const group=new Map();
    for(const unit of units) {
      const qty=FUSION_COSTS[unit.speciesId];
      if(!qty||!(EVOLUTION_OPTIONS[unit.speciesId]?.length))continue;
      if(!group.has(unit.speciesId))group.set(unit.speciesId,[]);
      group.get(unit.speciesId).push(unit);
    }
    const eligible=[...group.entries()].find(([id,list])=>list.length>=FUSION_COSTS[id]);
    if(!eligible)break;
    const [speciesId,list]=eligible;
    const copies=list.slice(0,FUSION_COSTS[speciesId]);
    const targetId=chooseEvolution(copies[0],participant,random);
    if(!targetId||!BY_ID[targetId])break;
    const keeper=copies[0];
    for(const other of copies.slice(1))removeOwnedUnit(participant,other);
    keeper.provenance=copies.flatMap(purchasedCopies);
    keeper.purchaseCost=keeper.provenance.reduce((sum,item)=>sum+item.cost,0);
    keeper.iv=Math.max(...copies.map(u=>u.iv));
    if(copies.some(unit=>unit.babyPerfect))keeper.iv=100;
    if(['0172','0173','0174','0440','0446'].includes(speciesId)) {
      keeper.iv=100;
      keeper.babyPerfect=true;
    }
    keeper.evolutionSteps=Math.max(...copies.map(unit=>unit.evolutionSteps||0))+1;
    keeper.speciesId=targetId;
    keeper.activeMoves=keeper.activeMoves?.length===2 && MOVES_BY_ID[keeper.activeMoves[0]]?.kind==='regular' && MOVES_BY_ID[keeper.activeMoves[1]]?.kind==='charged' ? [...keeper.activeMoves]:initialLoadout(targetId);
    keeper.slots=2;
    // Os itens não são comercializados nesta etapa, mas as fusões preservam até dois.
    const collected=copies.flatMap(unit=>unit.items||[]);
    keeper.items=collected.slice(0,RULES.maxEquippedItems);
    participant.items.push(...collected.slice(RULES.maxEquippedItems));
    count++;
    participant.compass=calculateCompass(participant);
    match.revision++;
  }
  return count;
}
export function purchaseLocalOffer(match,participant,index,random=Math.random) {
  if(!canManageLocalInventory(match,participant)||!Number.isInteger(index)||index<0||index>=RULES.shopSlots)return null;
  const id=participant.shop[index];
  const p=BY_ID[id];
  if(!p||participant.reservedOffers[index]!==id||participant.gold<p.price)return null;
  const existingZygarde=p.name==='Zygarde' ? ownedUnits(participant).find(u=>u.speciesId===id):null;
  if(existingZygarde?.zygardeProgress>=100)return null;
  const canFuseOnPurchase = (FUSION_COSTS[id] || Infinity) <=
    ownedUnits(participant).filter(u=>u.speciesId===id).length + 1;
  if(!existingZygarde&&fullBench(participant)&&!canFuseOnPurchase)return null;
  participant.gold-=p.price;
  participant.shop[index]=null;
  participant.reservedOffers[index]=null;
  participant.shopKinds[index]=null;
  const part={speciesId:id,cost:p.price};
  let unit;
  if(existingZygarde) {
    existingZygarde.zygardeProgress=Math.min(100,(existingZygarde.zygardeProgress||10)+10);
    existingZygarde.iv=Math.max(existingZygarde.iv,Math.min(100,Math.floor(random()*101)));
    existingZygarde.provenance.push(part);
    existingZygarde.purchaseCost+=p.price;
    if(existingZygarde.zygardeProgress===100) {
      for(let slot=0;slot<RULES.shopSlots;slot++) {
        if(participant.reservedOffers[slot]!==id)continue;
        returnToPool(match,id);
        participant.reservedOffers[slot]=null;
        participant.shop[slot]=null;
        participant.shopKinds[slot]=null;
      }
    }
    unit=existingZygarde;
  } else {
    const benchSlot=participant.bench.findIndex(slot=>!slot);
    unit=createMatchPokemon(id,0,`${match.id}-unit-${++match.nextUnitId}`,random);
    unit.provenance=[part];
    unit.purchaseCost=p.price;
    unit.evolutionSteps=0;
    unit.items=[];
    if(p.name==='Zygarde')unit.zygardeProgress=10;
    // Slot provisório somente quando a compra completa uma fusão com banco cheio.
    if(benchSlot<0)participant.bench.push(unit);
    else participant.bench[benchSlot]=unit;
  }
  fuseLocalUnits(match,participant,random);
  // A fusão consome a cópia temporária ou libera um banco normal.
  if(participant.bench.length>RULES.bankSlots) {
    const extra=participant.bench.pop();
    if(extra) {
      const free=participant.bench.findIndex(slot=>!slot);
      if(free>=0)participant.bench[free]=extra;
    }
  }
  participant.compass=calculateCompass(participant);
  match.revision++;
  return ownedUnits(participant).find(u=>u.provenance?.includes(part)) || unit;
}
export function sellLocalUnit(match,participant,unit) {
  if(!canManageLocalInventory(match,participant)||!unit||!ownedUnits(participant).includes(unit))return false;
  removeOwnedUnit(participant,unit);
  participant.gold+=soldValue(unit);
  participant.items.push(...(unit.items||[]));
  for(const part of purchasedCopies(unit))if(part.pool!==false)returnToPool(match,part.speciesId);
  participant.compass=calculateCompass(participant);
  match.revision++;
  return true;
}
export function releaseEliminatedLocalPlayer(match,participant) {
  if(!participant.eliminated||participant.poolReleased)return;
  releaseOffers(match,participant);
  for(const unit of [...ownedUnits(participant),...participant.pendingRewards])for(const part of purchasedCopies(unit))if(part.pool!==false)returnToPool(match,part.speciesId);
  for(const loot of participant.loot)if(loot.reward.kind==='pokemon')for(const part of purchasedCopies(loot.reward.unit))if(part.pool!==false)returnToPool(match,part.speciesId);
  participant.loot=[];participant.pendingRewards=[];
  participant.poolReleased=true;
  match.revision++;
}
export function prepareLocalRound(match,random=Math.random) {
  if(match.phase!=='preparation')return;
  for(const participant of match.players) {
    if(participant.eliminated)continue;
    if(!participant.shopLocked)refreshLocalShop(match,participant,random);
  }
  // Preparação tática de bots ocorre em ai.mjs, chamada pelo ciclo da partida.
}
export function changeLocalMove(match,participant,unit,slot) {
  if(match.phase!=='preparation'||participant.eliminated||
    !ownedUnits(participant).includes(unit)||!Number.isInteger(slot)||slot<0||slot>1||
    participant.gold<RULES.moveChangeCostGold)return false;
  const equipped=(unit.activeMoves||[]).slice(0,2);
  const kind=slot===0?'regular':'charged';
  if(equipped.length!==2||MOVES_BY_ID[equipped[slot]]?.kind!==kind)return false;
  const replacement=Object.values(MOVES_BY_ID).find(move=>move.kind===kind && move.id!==equipped[slot])?.id;
  if(!replacement)return false;
  participant.gold-=RULES.moveChangeCostGold;
  equipped[slot]=replacement;
  unit.activeMoves=equipped;
  unit.slots=2;
  match.revision++;
  return true;
}
export function awardLocalRoundIncome(match) {
  for(const participant of match.players) {
    if(participant.eliminated||participant.lastIncomeRound===match.round)continue;
    participant.lastIncomeRound=match.round;
    const outcome=participant.history.at(-1);
    const won=outcome?.round===match.round&&outcome.result==='win';
    const interest=interestForGold(participant.gold);
    participant.lastIncome={base:RULES.baseRoundGold,victory:won?1:0,interest,streak:streakBonus(participant.streak.count)};
    participant.gold+=Object.values(participant.lastIncome).reduce((a,b)=>a+b,0);
  }
  match.revision++;
}

export function confirmLocalBet(match,player,prediction,amount) {
  if(match?.phase!=='preparation'||battleKind(match.round)!=='gold'||player.eliminated||player.bet||!['win','loss'].includes(prediction)||!Number.isInteger(amount)||amount<1||amount>5||amount>player.gold)return false;
  player.gold-=amount;player.bet={prediction,amount,round:match.round,settled:false};match.revision++;return true;
}
export function selectPveDifficulty(match,player,difficulty) {
  if(match?.phase!=='preparation'||battleKind(match.round)!=='pve'||player.eliminated||!PVE_DIFFICULTIES[difficulty])return false;
  player.pveDifficulty=difficulty;match.revision++;return true;
}
export function recordLocalResult(match,player,result,damage=0,place=null) {
  if(player.history.some(entry=>entry.round===match.round))return;
  if(result!=='neutral')player.streak={result,count:player.streak.result===result?player.streak.count+1:1};
  if(player.bet?.round===match.round&&!player.bet.settled){
    player.gold+=result==='neutral'?player.bet.amount:result===player.bet.prediction?player.bet.amount*2:0;
    player.bet.settled=true;
  }
  player.hp=Math.max(0,player.hp-damage);player.eliminated=player.hp===0;
  player.history.push({round:match.round,result,damage,place});match.revision++;
}
export const BALLS=BALL_CONFIG;
export function cloneLocalPokemon(match,player,ballId,unit,random=Math.random) {
  if(match?.phase!=='preparation'||player.eliminated||!ownedUnits(player).includes(unit))return null;
  const ball=BALLS[ballId],index=player.consumables.indexOf(ballId),slot=player.bench.findIndex(u=>!u);
  const chance=ball?.chances[RARITIES.indexOf(BY_ID[unit.speciesId]?.rarity)]||0;
  if(index<0||slot<0||chance===0||unit.bossIv||unit.zygardeProgress>=100)return null;
  player.consumables.splice(index,1);
  const success=random()<chance;
  if(success){
    const copy={...unit,instanceId:`${match.id}-unit-${++match.nextUnitId}`,items:[],activeMoves:[...unit.activeMoves],
      provenance:purchasedCopies(unit).map(part=>({...part,pool:false})),col:slot,row:11};
    player.bench[slot]=copy;
    fuseLocalUnits(match,player,random);
  }
  player.cloneEffect={unitId:unit.instanceId,success,revision:++match.revision};
  player.compass=calculateCompass(player);return {success};
}
const LOOT=LOOT_TIERS;
function rollLootReward(match,player,color,random) {
  const def=LOOT[color];
  const eligible=SHOP_POKEMON.filter(p=>def.rarities.includes(p.rarity)&&p.price<=def.cap&&poolCount(match,p.id)>0&&
    !(p.name==='Zygarde'&&ownedUnits(player).some(u=>u.speciesId===p.id&&u.zygardeProgress>=100)));
  // Normaliza a quantidade de candidatos por categoria, ponderando pelo valor real.
  // Assim muitos Pokémon baratos no catálogo não dominam os espólios de maior qualidade.
  const choices=[];
  for(let amount=def.gold[0];amount<=def.gold[1];amount++)choices.push({kind:'gold',amount,value:amount,weight:amount/(def.gold[1]-def.gold[0]+1)});
  for(const id of def.balls)choices.push({kind:'ball',id,value:BALLS[id].value,weight:BALLS[id].value/def.balls.length});
  for(const p of eligible)choices.push({kind:'pokemon',species:p,value:p.price,weight:p.price/eligible.length});
  let roll=random()*choices.reduce((sum,c)=>sum+c.weight,0);
  const selected=choices.find(c=>(roll-=c.weight)<0)||choices.at(-1);
  if(selected.kind==='pokemon'){
    const species=selected.species;
    match.pool[species.id]--;
    const unit=createMatchPokemon(species.id,0,`${match.id}-reward-${++match.nextUnitId}`,random);
    unit.provenance=[{speciesId:species.id,cost:species.price}];unit.purchaseCost=species.price;unit.items=[];
    return {kind:'pokemon',unit,value:species.price};
  }
  return selected.kind==='gold'?{kind:'gold',amount:selected.amount,value:selected.value}:{kind:'ball',id:selected.id,value:selected.value};
}
export function grantLocalLoot(match,player,points,random=Math.random,legendary=false) {
  const combinations=[];
  for(let yellow=0;yellow<=Math.floor(points/4);yellow++)for(let blue=0;blue<=Math.floor((points-yellow*4)/2);blue++)combinations.push({yellow,blue,gray:points-yellow*4-blue*2});
  const counts=legendary?{yellow:1,blue:0,gray:0}:combinations[Math.floor(random()*combinations.length)];
  for(const [color,count] of Object.entries(counts))for(let i=0;i<count;i++){
    const index=player.loot.length;
    player.loot.push({id:`${match.id}-loot-${++match.nextUnitId}`,color,x:300+(index%8)*58,y:465+(Math.floor(index/8)%5)*42,reward:rollLootReward(match,player,color,random)});
  }
  match.revision++;
}
export function deliverPendingRewards(match,player,random=Math.random) {
  while(player.pendingRewards.length&&player.bench.some(u=>!u)){
    const slot=player.bench.findIndex(u=>!u),unit=player.pendingRewards.shift();unit.col=slot;unit.row=11;player.bench[slot]=unit;
    fuseLocalUnits(match,player,random);match.revision++;
  }
  player.compass=calculateCompass(player);
}
export function collectLocalLoot(match,player,all=false,random=Math.random) {
  for(let i=player.loot.length-1;i>=0;i--){
    const item=player.loot[i];
    if(!all&&Math.hypot(player.avatar.x-item.x,player.avatar.y-item.y)>30)continue;
    const reward=item.reward;
    if(reward.kind==='gold')player.gold+=reward.amount;
    else if(reward.kind==='ball')player.consumables.push(reward.id);
    else player.pendingRewards.push(reward.unit);
    player.loot.splice(i,1);match.revision++;
  }
  deliverPendingRewards(match,player,random);
}
export function moveLocalAvatar(match,player,x,y) {
  if(!match||player.eliminated||![x,y].every(Number.isFinite))return false;
  const kind=battleKind(match.round),columns=match.phase==='preparation'?10:kind==='triple'?15:kind==='quadruple'?20:10;
  player.avatar.targetX=Math.max(220,Math.min(210+columns*58-10,x));player.avatar.targetY=Math.max(126,Math.min(686,y));return true;
}
export function updateLocalAvatars(match,dt,random=Math.random) {
  for(const player of match.players){
    if(player.eliminated)continue;
    const a=player.avatar,dx=a.targetX-a.x,dy=a.targetY-a.y,d=Math.hypot(dx,dy),step=Math.min(d,180*Math.max(0,Math.min(dt,.1)));
    if(d){a.x+=dx/d*step;a.y+=dy/d*step;}
    collectLocalLoot(match,player,player.isBot,random);
  }
}

export function moveLocalUnit(match,player,unit,target,swap=true) {
  if(!canManageLocalInventory(match,player)||!unit||!target||!Number.isInteger(target.col)||target.col<0||target.col>=10||!Number.isInteger(target.row)||target.row<6||target.row>11)return false;
  const fromBench=player.bench.indexOf(unit),fromBoard=player.board.indexOf(unit),benchTarget=target.row===11;
  if(benchTarget&&fromBench>=0){
    const other=player.bench[target.col];
    if(other===unit)return true;
    if(other&&!swap)return false;
    player.bench[fromBench]=other;player.bench[target.col]=unit;
    if(other){other.col=fromBench;other.row=11;}
    unit.col=target.col;unit.row=11;match.revision++;return true;
  }
  if(unit.kind==='structure'){
    if(benchTarget)return bankStructure(match,player,unit,target.col);
    return fromBench>=0?placeStructure(match,player,unit,target.col,target.row-6):movePlacedStructure(match,player,unit,target.col,target.row-6);
  }
  if(fromBench<0&&fromBoard<0)return false;
  if(match.phase!=='preparation'&&(!benchTarget||fromBench<0))return false;
  const other=benchTarget?player.bench[target.col]:player.board.find(u=>u.col===target.col&&u.row===target.row);
  if(other===unit)return true;
  if(other?.kind==='structure'||other&&!swap)return false;
  if(!benchTarget&&fromBench>=0&&!other&&player.board.length>=fieldLimitForBattle(match.round))return false;
  removeOwnedUnit(player,unit);
  if(other){
    removeOwnedUnit(player,other);
    if(fromBench>=0)player.bench[fromBench]=other;
    else {other.col=unit.col;other.row=unit.row;player.board.push(other);}
  }
  unit.col=target.col;unit.row=target.row;
  if(benchTarget)player.bench[target.col]=unit;else player.board.push(unit);
  player.compass=calculateCompass(player);match.revision++;return true;
}
