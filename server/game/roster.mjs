import { RULES, fieldLimitForBattle, interestForGold, shopOddsForBattle } from './rules.mjs';
import { BY_ID, SHOP_POKEMON, FUSION_COSTS, EVOLUTION_OPTIONS } from './pokemon.mjs';
import {calculateCompass, speciesCompassWeight, weightedSpeciesPick,ALL_TYPES} from './compass.mjs';
import {newTerrain,STRUCTURES} from './terrain.mjs';

// Todas as operações de partida são síncronas e executadas em memória.
// match.pool representa somente cópias LIVRES; ofertas possuem reservas próprias.
const RARITIES = Object.keys(RULES.rarityPrice);
const purchasedCopies = unit => unit.provenance || [{speciesId:unit.speciesId, cost:unit.purchaseCost ?? BY_ID[unit.speciesId]?.price ?? 0}];
const ownedUnits = participant => [...participant.board, ...participant.bench.filter(Boolean)];
const soldValue = unit => Math.max(0, purchasedCopies(unit).reduce((sum, part) => sum + part.cost, 0) - (unit.evolutionSteps || 0));
export const saleValueLocal = soldValue;

export function createParticipant({id,name,isBot}) {
  return {
    id,name,isBot,hp:RULES.startingHp,gold:RULES.startingGold,
    bench:Array(RULES.bankSlots).fill(null),board:[],shop:Array(RULES.shopSlots).fill(null),
    shopKinds:Array(RULES.shopSlots).fill(null),
    shopLocked:false,items:[],structures:[],structureInventory:[],terrain:newTerrain(),
    compass:Object.fromEntries(ALL_TYPES.map(type=>[type,0])),eliminated:false,
    unitInventory:[],reservedOffers:Array(RULES.shopSlots).fill(null)
  };
}

// Entidade de partida; a lógica não depende de um simulador paralelo.
export function createMatchPokemon(speciesId,team,instanceId,random=Math.random) {
  return {
    instanceId,speciesId,team,iv:Math.min(100,Math.floor(random()*101)),
    activeMoves:['disparo','investida'],slots:2,
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
    pairings:[],phaseDeadline:null,nextUnitId:0,localOnly:true
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
  // Política provisória para raridade esgotada: redistribuir só entre raridades ainda disponíveis.
  const tiers=RARITIES.map((rarity,index) => ({rarity,weight:odds[index],species:available.filter(p => p.rarity===rarity)}))
    .filter(t => t.weight>0 && t.species.length);
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
  return roll<RULES.flexibleOdds.pokemon ? 'pokemon'
    : roll<RULES.flexibleOdds.pokemon+RULES.flexibleOdds.item ? 'item':'estrutura';
}
export function refreshLocalShop(match,participant,random=Math.random,paid=false) {
  if(match.phase!=='preparation'||participant.eliminated||participant.shopLocked)return false;
  if(paid&&participant.gold<RULES.rerollCostGold)return false;
  if(paid)participant.gold-=RULES.rerollCostGold;
  releaseOffers(match,participant);
  for(let i=0;i<RULES.shopSlots;i++) {
    const kind=kindForSlot(i,random);
    participant.shopKinds[i]=kind;
    // Itens continuam reservados à etapa 10; estruturas têm catálogo real na etapa 09.
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
  if(match.phase!=='preparation'||participant.eliminated)return false;
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
    keeper.activeMoves=keeper.activeMoves.filter(m=>['disparo','investida','ataque-legal'].includes(m)).slice(0,2);
    if(keeper.activeMoves.length<2)keeper.activeMoves=['disparo','investida'];
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
  if(match.phase!=='preparation'||participant.eliminated||!Number.isInteger(index)||index<0||index>=RULES.shopSlots)return null;
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
  if(match.phase!=='preparation'||participant.eliminated||!unit||!ownedUnits(participant).includes(unit))return false;
  removeOwnedUnit(participant,unit);
  participant.gold+=soldValue(unit);
  participant.items.push(...(unit.items||[]));
  for(const part of purchasedCopies(unit))returnToPool(match,part.speciesId);
  participant.compass=calculateCompass(participant);
  match.revision++;
  return true;
}
export function releaseEliminatedLocalPlayer(match,participant) {
  if(!participant.eliminated||participant.poolReleased)return;
  releaseOffers(match,participant);
  for(const unit of ownedUnits(participant))for(const part of purchasedCopies(unit))returnToPool(match,part.speciesId);
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
  const available=['disparo','investida','ataque-legal'];
  const equipped=(unit.activeMoves||[]).slice(0,2);
  if(equipped.length!==2||!equipped.every(id=>available.includes(id)))return false;
  const replacement=available.find(id=>!equipped.includes(id));
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
    if(participant.eliminated)continue;
    const won=match.combats.some(c=>c.result?.winnerId===participant.id);
    // Convenção provisória documentada: juros sobre ouro ANTES da nova renda.
    participant.gold+=RULES.baseRoundGold+(won?RULES.victoryBonusGold:0)+interestForGold(participant.gold);
  }
  match.revision++;
}
