// Definições de ataques editáveis em config/ataques.mjs, compartilhadas por todas as espécies.
import { ATTACKS, ENERGY_PER_SECOND, BASE_REGENERATION_PER_SECOND } from '../../config/ataques.mjs';
import { DEFAULT_POKEMON_ATTACKS, POKEMON_ATTACK_OVERRIDES } from '../../config/pokemon-ataques.mjs';
export { ENERGY_PER_SECOND, BASE_REGENERATION_PER_SECOND };
export const MOVES = ATTACKS;
export const MOVES_BY_ID = Object.freeze(Object.fromEntries(MOVES.map(move => [move.id, move])));
export const movePool = () => MOVES;
export function initialLoadout(speciesId) {
  const proposed=POKEMON_ATTACK_OVERRIDES[speciesId] || DEFAULT_POKEMON_ATTACKS;
  const valid=proposed.length===2&&MOVES_BY_ID[proposed[0]]?.kind==='regular'&&MOVES_BY_ID[proposed[1]]?.kind==='charged';
  return valid?[...proposed]:[...DEFAULT_POKEMON_ATTACKS];
}
export function chooseMoveAnimation(move, available) {
  for (const name of move.animationPriority) if (available?.[name]) return name;
  return available?.Attack ? 'Attack' : available?.Idle ? 'Idle' : 'Attack';
}
export const animationCandidates = () => [...new Set(MOVES.flatMap(move => move.animationPriority))];
