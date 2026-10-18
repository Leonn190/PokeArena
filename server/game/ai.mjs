// Tática determinística sobre unidades de combate e planejamento econômico dos bots.
// Recebe RNG injetável; usa exclusivamente ações públicas do domínio de partida.
import { BY_ID, FUSION_COSTS } from './pokemon.mjs';
import { RULES, fieldLimitForBattle, battleKind } from './rules.mjs';
import { purchaseLocalOffer, refreshLocalShop, sellLocalUnit, confirmLocalBet, selectPveDifficulty, cloneLocalPokemon, moveLocalUnit, feedLocalUnit, canFeedLocalUnit, BALLS } from './roster.mjs';
import { buyStructure, placeStructure } from './structures.mjs';
import {calculateCompass} from './compass.mjs';
import {combatRange,RANGE_EPSILON} from './moves.mjs';

const owned = player => [...player.board, ...player.bench.filter(u=>u&&u.kind!=='structure')];
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
const edge = (a,b) => Math.max(0,distance(a,b)-a.radius-b.radius);

export function chooseCombatTarget(unit, enemies, tileSize) {
  if (!enemies.length) return null;
  const reach = combatRange(unit.type.id,unit)*tileSize+RANGE_EPSILON;
  const current = enemies.find(enemy=>enemy.uid===unit.targetId);
  if(current&&edge(unit,current)<=reach)return current;
  const reachable = enemies.filter(enemy=>edge(unit,enemy)<=reach);
  if(!reachable.length){
    const nearest=enemies.reduce((best,enemy)=>edge(unit,enemy)<edge(unit,best)?enemy:best);
    // Mantém a aproximação quando a alternativa não poupa sequer uma célula.
    return current&&edge(unit,current)<=edge(unit,nearest)+tileSize?current:nearest;
  }
  return (reachable.length?reachable:enemies).reduce((best,enemy) => {
    const gap=edge(unit,enemy);
    const hp=enemy.health/Math.max(1,enemy.maxHealth);
    const threat=(enemy.stats.atk+enemy.stats.spa)/Math.max(1,enemy.stats.def+enemy.stats.spd);
    const score=gap/(tileSize*1.45)+hp*1.6-threat*.45;
    return !best||score<best.score ? {enemy,score} : best;
  },null)?.enemy || null;
}

function preference(player,speciesId,round,style) {
  const species=BY_ID[speciesId];
  const group=owned(player).filter(unit=>unit.speciesId===speciesId).length;
  const needed=FUSION_COSTS[speciesId]||99;
  const duplicates=group>0 ? 4+group*2+(group===needed-1?7:0) : 0;
  const stats=species.stats;
  const sturdy=(stats.vida+stats.def+stats.spd)/3;
  const damage=Math.max(stats.atk,stats.spa);
  const role=style==='front' ? sturdy*.032 : style==='back' ? damage*.037 : (sturdy+damage)*.016;
  const economy=style==='economy' ? (7-species.price)*.85 : 0;
  const pricePenalty=round<4 ? species.price*.6 : 0;
  return duplicates+role+economy-pricePenalty;
}

function reorganizeBot(match,player,round,style) {
  const limit=fieldLimitForBattle(round);
  const pool=owned(player);
  const ranked=pool.slice().sort((a,b)=>{
    const pa=BY_ID[a.speciesId],pb=BY_ID[b.speciesId];
    const stat=p => style==='front' ? p.stats.vida+p.stats.def+p.stats.spd :
      style==='back' ? (p.stats.atk+p.stats.spa)*1.4+p.stats.vel :
      p.stats.vida+p.stats.atk+p.stats.spa+p.stats.def+p.stats.spd;
    return stat(pb)*(1+(b.iv||0)*.003)-stat(pa)*(1+(a.iv||0)*.003);
  });
  const field=ranked.slice(0,limit);
  for(const unit of [...player.board]){
    if(field.includes(unit))continue;
    const replacement=field.find(u=>player.bench.includes(u));
    if(replacement)moveLocalUnit(match,player,replacement,{col:unit.col,row:unit.row});
    else {
      const slot=player.bench.findIndex(u=>!u);
      if(slot>=0)moveLocalUnit(match,player,unit,{col:slot,row:11});
    }
  }
  for(const unit of field){
    if(player.board.includes(unit))continue;
    const free=Array.from({length:50},(_,i)=>({col:i%10,row:6+Math.floor(i/10)}))
      .find(cell=>!player.board.some(u=>u.col===cell.col&&u.row===cell.row));
    if(free)moveLocalUnit(match,player,unit,free);
  }
  const front=field.filter(unit=>{
    const p=BY_ID[unit.speciesId];
    return p.stats.vida+p.stats.def+p.stats.spd >= p.stats.atk+p.stats.spa+p.stats.vel;
  });
  const back=field.filter(unit=>!front.includes(unit));
  // Sempre dentro das 5 linhas do lado do jogador; no duelo o motor espelha o oponente.
  function place(list,startRow) {
    list.forEach((unit,index)=>{
      const columns=[4,5,3,6,2,7,1,8,0,9];
      moveLocalUnit(match,player,unit,{col:columns[index%columns.length],row:Math.min(10,startRow+Math.floor(index/columns.length))});
    });
  }
  place(front, style==='back'?8:6);
  place(back,style==='front'?9:10);
}

export function prepareLocalBots(match,random=Math.random) {
  for(const bot of match.players) {
    if(!bot.isBot||bot.eliminated)continue;
    const style=bot.strategy||(bot.strategy=['front','back','evolution','economy'][(match.players.indexOf(bot)-1)%4]);
    const limit=fieldLimitForBattle(match.round);
    const target=Math.min(RULES.bankSlots+limit,Math.max(limit+2,style==='evolution'?limit+5:limit+3));
    // Desapega de uma unidade fraca quando banco/campo estão ocupados e
    // há uma oferta substancialmente melhor. Venda usa a MESMA operação do humano.
    if(bot.bench.every(Boolean)&&bot.board.length>=limit) {
      const lowest=owned(bot).filter(unit=>!((FUSION_COSTS[unit.speciesId]||99)<=owned(bot).filter(x=>x.speciesId===unit.speciesId).length+1))
        .sort((a,b)=>preference(bot,a.speciesId,match.round,style)-preference(bot,b.speciesId,match.round,style))[0];
      const stronger=!!lowest && bot.shop.some(id=>BY_ID[id]&&BY_ID[id].price<=bot.gold&&
        preference(bot,id,match.round,style)>preference(bot,lowest?.speciesId,match.round,style)+2);
      if(lowest&&stronger)sellLocalUnit(match,bot,lowest);
    }
    let rerolls=0;
    let actions=0;
    while(actions++<18 && owned(bot).length<target) {
      const options=bot.shop.map((id,index)=>({id,index}))
        .filter(offer=>BY_ID[offer.id]&&BY_ID[offer.id].price<=bot.gold)
        .sort((a,b)=>preference(bot,b.id,match.round,style)-preference(bot,a.id,match.round,style));
      const buffer=style==='economy'?Math.min(10,match.round*2):style==='evolution'?0:2;
      if(options.length && bot.gold-BY_ID[options[0].id].price>=buffer) {
        // Sem cópias gratuitas: compra usa a reserva real e evolui pelas mesmas regras.
        if(purchaseLocalOffer(match,bot,options[0].index,random))continue;
      }
      if(rerolls>=2 || bot.shopLocked || bot.gold<RULES.rerollCostGold+buffer+1)break;
      if(!refreshLocalShop(match,bot,random,true))break;
      rerolls++;
    }
    reorganizeBot(match,bot,match.round,style);
    // Mesmas operações físicas e econômicas do jogador.
    if(bot.gold>=5 && bot.structures.length<3){
      const index=bot.shop.findIndex((id,i)=>i<2 && bot.shopKinds[i]==='estrutura');
      if(index>=0)buyStructure(match,bot,index);
    }
    const toPlace=bot.bench.find(u=>u?.kind==='structure');
    if(toPlace){
      const positions=[[1,1],[6,2],[3,3],[7,0],[0,4]];
      for(const [col,row] of positions)if(placeStructure(match,bot,toPlace,col,row))break;
    }
    for(const ball of [...bot.consumables]){
      const target=owned(bot).filter(u=>!(u.zygardeProgress>=100)&&BALLS[ball].chances[Object.keys(RULES.rarityPrice).indexOf(BY_ID[u.speciesId].rarity)]>0)
        .sort((a,b)=>BY_ID[b.speciesId].price-BY_ID[a.speciesId].price)[0];
      if(target)cloneLocalPokemon(match,bot,ball,target,random);
    }
    reorganizeBot(match,bot,match.round,style);
    // Alimentação opcional, uma vez por preparação; mantém o campo e cópias
    // necessárias para evolução. Usa a mesma regra validada do jogador.
    const feedTarget=bot.board.find(unit=>unit.level<RULES.niveis.maximo&&
      !Object.hasOwn(FUSION_COSTS,unit.speciesId)&&
      ['comum','incomum','raro','epico'].includes(BY_ID[unit.speciesId]?.rarity));
    if(feedTarget){
      const spare=bot.bench.find(unit=>unit?.kind!=='structure'&&
        BY_ID[unit?.speciesId]?.rarity===BY_ID[feedTarget.speciesId].rarity&&
        owned(bot).filter(candidate=>candidate.speciesId===unit.speciesId).length<
          (FUSION_COSTS[unit.speciesId]||99)&&canFeedLocalUnit(match,bot,unit,feedTarget));
      if(spare)feedLocalUnit(match,bot,spare,feedTarget);
    }
    if(battleKind(match.round)==='gold'&&bot.gold>0)confirmLocalBet(match,bot,bot.board.length===limit?'win':'loss',Math.min(5,bot.gold));
    if(battleKind(match.round)==='pve')selectPveDifficulty(match,bot,bot.board.length<limit?'easy':style==='front'?'hard':'medium');
    bot.compass=calculateCompass(bot);
    match.revision++;
  }
}
