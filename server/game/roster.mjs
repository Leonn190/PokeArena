import { RULES } from './rules.mjs';

// Modelo serializável que poderá ser salvo em Postgres. DOM/Canvas não entram aqui.
export function createParticipant({id,name,isBot}) {
  return {
    id,name,isBot,hp:RULES.startingHp,gold:RULES.startingGold,
    bench:Array(RULES.bankSlots).fill(null),board:[],shop:Array(RULES.shopSlots).fill(null),
    shopLocked:false,items:[],structures:[],fieldEffects:[],eliminated:false,
    // Na etapa da loja, reservar ofertas e preservar proveniência do pool aqui.
    unitInventory:[],reservedOffers:[]
  };
}

// Operações de dados do Modo Teste legado. São funções explícitas, sem DOM.
// Não reutilizar sorteios locais como fonte de verdade no competitivo.
export function createSandboxState() {
  return {
    round:1,gold:Infinity,infiniteGold:true,
    playerBench:Array(RULES.bankSlots).fill(null),
    enemyBench:Array(RULES.bankSlots).fill(null),
    playerBoard:[],enemyBoard:[],shop:Array(RULES.shopSlots).fill(null)
  };
}
export function createSandboxPokemon(speciesId,team,instanceId,random=Math.random) {
  return {
    instanceId,speciesId,team,iv:Math.floor(random()*101),
    activeMoves:['disparo','investida'],slots:2,
    col:team?5:4,row:team?2:7,x:0,y:0
  };
}
export function removeFromSandbox(state,unit) {
  for(const bench of [state.playerBench,state.enemyBench]) {
    const slot=bench.indexOf(unit);
    if(slot!==-1)bench[slot]=null;
  }
  for(const board of [state.playerBoard,state.enemyBoard]) {
    const index=board.indexOf(unit);
    if(index!==-1)board.splice(index,1);
  }
}
export function nextSandboxFusion(units,evolvesTo) {
  const groups=new Map();
  for(const unit of units) {
    if(!evolvesTo[unit.speciesId])continue;
    const group=groups.get(unit.speciesId)||[];
    group.push(unit);
    groups.set(unit.speciesId,group);
  }
  // APENAS para as três linhas de iniciantes do sandbox original.
  // O competitivo segue a tabela de fusão POR ESPÉCIE do GDD §5.4.
  return [...groups.entries()].find(([,group])=>group.length>=3)||null;
}
