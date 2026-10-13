// Etapa 08: pesos por tipo SOMENTE dentro da raridade já sorteada.
import {BY_ID} from './pokemon.mjs';
import {structureInfluence,recipeInfluence} from './structures.mjs';
export const ALL_TYPES=Object.freeze(['Normal','Lutador','Voador','Venenoso','Terrestre','Pedra','Inseto','Fantasma','Aço','Fogo','Água','Grama','Elétrico','Psíquico','Gelo','Dragão','Sombrio','Fada']);
export function calculateCompass(player) {
  const influence=Object.fromEntries(ALL_TYPES.map(type=>[type,0]));
  function add(obj) {for(const [type,n] of Object.entries(obj))if(type in influence)influence[type]+=n;}
  for(const [list,points] of [[player.board||[],5],[(player.bench||[]).filter(Boolean),2]]) {
    for(const mon of list) {
      const types=BY_ID[mon.speciesId]?.types||[];
      for(const type of types)if(type in influence)influence[type]+=points/types.length;
    }
  }
  add(structureInfluence(player));add(recipeInfluence(player));
  return influence;
}
export function speciesCompassWeight(species,influence) {
  if(!species)return 1;
  const score=(species.types||[]).reduce((sum,type)=>sum+(influence[type]||0),0);
  return 1+Math.min(Math.max(0,score)/15,3);
}
export function weightedSpeciesPick(species,influence,random=Math.random) {
  if(!species?.length)return null;
  const weights=species.map(mon=>speciesCompassWeight(mon,influence));
  let roll=random()*weights.reduce((a,b)=>a+b,0);
  for(let i=0;i<species.length;i++)if((roll-=weights[i])<0)return species[i];
  return species[species.length-1];
}
