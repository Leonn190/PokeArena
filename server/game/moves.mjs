// Catálogo e resolução do regular e da habilidade equipada pela instância.
import { ATTACKS } from '../../config/ataques.mjs';
import { POKEMON_ATTACK_OVERRIDES, DEFAULT_POKEMON_REGULAR, POKEMON_ABILITY_OVERRIDES, DEFAULT_POKEMON_ABILITY } from '../../config/pokemon-ataques.mjs';
import { BY_ID, EVOLUTION_OPTIONS } from './pokemon.mjs';
export const MOVES = ATTACKS;
export const MOVES_BY_ID = Object.freeze(Object.fromEntries(MOVES.map(move=>[move.id,move])));
const rangedTypes = new Set(['Elétrico','Água','Fogo','Grama','Gelo','Psíquico','Fantasma','Fada','Dragão','Voador']);
const ancestorsBySpecies=Object.create(null);
for(const [id,next] of Object.entries(EVOLUTION_OPTIONS)){
  for(const child of next)(ancestorsBySpecies[child]??=[]).push(id);
}
const abilityOptions=Object.create(null);
export function regularForPokemon(speciesId) {
  const override=POKEMON_ATTACK_OVERRIDES[speciesId]?.regular;
  if(MOVES_BY_ID[override]?.kind==='regular')return override;
  const p=BY_ID[speciesId];
  if(!p)return DEFAULT_POKEMON_REGULAR;
  const special=p.stats.spa>p.stats.atk;
  const ranged=p.types.some(type=>rangedTypes.has(type));
  return special?(ranged?'tiro-energia':'energia'):(ranged?'disparo':'tapa');
}
export function abilityForPokemon(speciesId) {
  return POKEMON_ABILITY_OVERRIDES[speciesId]??DEFAULT_POKEMON_ABILITY??{
    disparo:'disparo-carregado',tapa:'tapa-carregado',energia:'energia-carregada',
    'tiro-energia':'tiro-energia-carregado'
  }[regularForPokemon(speciesId)]??'tapa-carregado';
}
export function initialLoadout(speciesId) {
  return [regularForPokemon(speciesId),abilityForPokemon(speciesId)];
}
// Apenas ancestrais da forma atual: evoluções futuras e ramos irmãos não entram.
export function availableAbilities(speciesId, visited=new Set()) {
  if(abilityOptions[speciesId])return abilityOptions[speciesId];
  if(visited.has(speciesId))return [];
  visited.add(speciesId);
  const ancestors=ancestorsBySpecies[speciesId]||[];
  return abilityOptions[speciesId]=Object.freeze([...new Set([abilityForPokemon(speciesId),...ancestors.flatMap(id=>availableAbilities(id,visited))])]);
}
export function equippedAbility(speciesId,entry={}) {
  const id=entry.abilityId??entry.activeMoves?.[1];
  return MOVES_BY_ID[availableAbilities(speciesId).includes(id)?id:abilityForPokemon(speciesId)];
}
export function validLoadout(speciesId,entry={}) {
  const state=Array.isArray(entry)?{activeMoves:entry}:entry;
  return [regularForPokemon(speciesId),equippedAbility(speciesId,state).id];
}
export function combatRange(speciesId,entry={}) {
  return equippedAbility(speciesId,entry).range;
}
export function resolvedMoves(speciesId,entry={}) {
  const [regularId,abilityId]=validLoadout(speciesId,entry);
  const range=combatRange(speciesId,entry);
  return [{...MOVES_BY_ID[regularId],range,projectile:range>=2,
    animationPriority:range>=2?['Shoot','Attack']:['Attack']},MOVES_BY_ID[abilityId]];
}
export function chooseMoveAnimation(move,available) {
  for(const name of move?.animationPriority||[])if(available?.[name])return name;
  return available?.Attack?'Attack':available?.Idle?'Idle':Object.keys(available||{})[0]||'Idle';
}
export const animationCandidates = () => [...new Set(['Sleep','Hurt',...MOVES.flatMap(move=>move.animationPriority)])];
