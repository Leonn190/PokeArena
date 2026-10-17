// O regular conserva a categoria da espécie; alcance e animação seguem a habilidade.
export const POKEMON_ATTACK_OVERRIDES = Object.freeze({});
export const DEFAULT_POKEMON_REGULAR = 'tapa';

// Demais espécies usam o carregado correspondente ao básico, sem sorteio.
export const POKEMON_ABILITY_OVERRIDES = Object.freeze({
  '0001':'0001', '0002':'0002', '0003':'0003'
});
export const DEFAULT_POKEMON_ABILITY = null;
