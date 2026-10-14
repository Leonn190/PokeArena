// Catálogo, escolhas imutáveis por espécie e roleta de ataques carregados.
import { ATTACKS, ENERGY_PER_SECOND, BASE_REGENERATION_PER_SECOND } from '../../config/ataques.mjs';
import { POKEMON_ATTACK_OVERRIDES, DEFAULT_POKEMON_REGULAR, DEFAULT_CHARGED_POOL, POKEMON_ABILITY_OVERRIDES, DEFAULT_POKEMON_ABILITY } from '../../config/pokemon-ataques.mjs';
import { BY_ID } from './pokemon.mjs';
export { ENERGY_PER_SECOND, BASE_REGENERATION_PER_SECOND };
export const MOVES = ATTACKS;
export const MOVES_BY_ID = Object.freeze(Object.fromEntries(MOVES.map(move=>[move.id,move])));
export const movePool = () => MOVES;
const rangedTypes = new Set(['Elétrico','Água','Fogo','Grama','Gelo','Psíquico','Fantasma','Fada','Dragão','Voador']);
const chargedForRegular = Object.freeze({
  'disparo':['disparo-carregado','tapa-carregado','tiro-energia-carregado'],
  'tapa':['tapa-carregado','disparo-carregado','energia-carregada'],
  'energia':['energia-carregada','tapa-carregado','tiro-energia-carregado'],
  'tiro-energia':['tiro-energia-carregado','energia-carregada','disparo-carregado']
});
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
  const override=POKEMON_ATTACK_OVERRIDES[speciesId]?.chargedPool;
  const pool=override||chargedForRegular[regularForPokemon(speciesId)]||DEFAULT_CHARGED_POOL;
  const valid=[...new Set(pool)].filter(id=>MOVES_BY_ID[id]?.kind==='charged');
  return valid.length===3?valid:[...DEFAULT_CHARGED_POOL];
}
export function abilityForPokemon(speciesId) {
  return POKEMON_ABILITY_OVERRIDES[speciesId]??DEFAULT_POKEMON_ABILITY;
}
export function initialLoadout(speciesId,random=Math.random) {
  const regular=regularForPokemon(speciesId),pool=chargedPoolForPokemon(speciesId);
  return [regular,pool[Math.min(pool.length-1,Math.floor(Math.max(0,random())*pool.length))]];
}
export function validLoadout(speciesId,moves) {
  const regular=regularForPokemon(speciesId),pool=chargedPoolForPokemon(speciesId);
  return [regular,pool.includes(moves?.[1])?moves[1]:pool[0]];
}
export function chooseMoveAnimation(move,available) {
  for(const name of move?.animationPriority||[])if(available?.[name])return name;
  return available?.Attack?'Attack':available?.Idle?'Idle':'Attack';
}
export const animationCandidates = () => [...new Set(['Sleep','Hurt',...MOVES.flatMap(move=>move.animationPriority)])];
