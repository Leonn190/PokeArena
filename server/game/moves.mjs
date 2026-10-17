// Catálogo e resolução determinística do básico e da habilidade por espécie.
import { ATTACKS, ENERGY_PER_SECOND, BASE_REGENERATION_PER_SECOND } from '../../config/ataques.mjs';
import { POKEMON_ATTACK_OVERRIDES, DEFAULT_POKEMON_REGULAR, POKEMON_ABILITY_OVERRIDES, DEFAULT_POKEMON_ABILITY } from '../../config/pokemon-ataques.mjs';
import { BY_ID } from './pokemon.mjs';
export { ENERGY_PER_SECOND, BASE_REGENERATION_PER_SECOND };
export const MOVES = ATTACKS;
export const MOVES_BY_ID = Object.freeze(Object.fromEntries(MOVES.map(move=>[move.id,move])));
export const movePool = () => MOVES;
const rangedTypes = new Set(['Elétrico','Água','Fogo','Grama','Gelo','Psíquico','Fantasma','Fada','Dragão','Voador']);
export function regularForPokemon(speciesId) {
  const override=POKEMON_ATTACK_OVERRIDES[speciesId]?.regular;
  if(MOVES_BY_ID[override]?.kind==='regular')return override;
  const p=BY_ID[speciesId];
  if(!p)return DEFAULT_POKEMON_REGULAR;
  const special=p.stats.spa>p.stats.atk;
  const ranged=p.types.some(type=>rangedTypes.has(type));
  return special?(ranged?'tiro-energia':'energia'):(ranged?'disparo':'tapa');
}
export function chargedPoolForPokemon(speciesId) {
  // Exportação legada: agora contém apenas a habilidade fixa.
  return [abilityForPokemon(speciesId)];
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
export function validLoadout(speciesId) {
  return initialLoadout(speciesId);
}
export function chooseMoveAnimation(move,available) {
  for(const name of move?.animationPriority||[])if(available?.[name])return name;
  return available?.Attack?'Attack':available?.Idle?'Idle':'Attack';
}
export const animationCandidates = () => [...new Set(['Sleep','Hurt',...MOVES.flatMap(move=>move.animationPriority)])];
