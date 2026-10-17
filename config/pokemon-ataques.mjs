// Um ataque básico e uma habilidade fixos por espécie, inclusive após evolução.
export const POKEMON_ATTACK_OVERRIDES = Object.freeze({
  '0001':Object.freeze({regular:'basico-bulbasaur'}),
  '0002':Object.freeze({regular:'basico-bulbasaur'}),
  '0003':Object.freeze({regular:'basico-bulbasaur'})
});
export const DEFAULT_POKEMON_REGULAR = 'tapa';
// Alias legado de uma única habilidade; nenhuma pool aleatória é utilizada.
export const DEFAULT_CHARGED_POOL = Object.freeze(['tapa-carregado']);

// Demais espécies usam o carregado correspondente ao básico, sem sorteio.
export const POKEMON_ABILITY_OVERRIDES = Object.freeze({
  '0001':'rajada-sementes', '0002':'folha-navalha', '0003':'morteiro-polen'
});
export const DEFAULT_POKEMON_ABILITY = null;
