// Configurações por espécie. Um único regular IMUTÁVEL e uma pool de três
// carregados, da qual o Pokémon nasce com um escolhido aleatoriamente.
// Override opcional: { regular:'tapa', chargedPool:['...','...','...'] }.
// Espécies sem override recebem seleção fixa calculada por tipo e atributos.
export const POKEMON_ATTACK_OVERRIDES = Object.freeze({});
export const DEFAULT_POKEMON_REGULAR = 'tapa';
export const DEFAULT_CHARGED_POOL = Object.freeze(['tapa-carregado','disparo-carregado','energia-carregada']);

// Espaço reservado para habilidades únicas. Nesta versão NENHUM Pokémon
// possui habilidade ativa: a definição null não concede efeitos de combate.
export const POKEMON_ABILITY_OVERRIDES = Object.freeze({});
export const DEFAULT_POKEMON_ABILITY = null;
