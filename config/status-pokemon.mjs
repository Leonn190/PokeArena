/**
 * PokeArena — atributos balanceados do elenco (16/10/2026)
 *
 * Copie para: config/status-pokemon.mjs
 *
 * 100 espécies compráveis encontradas no GitHub + 115 espécies/formas derivadas.
 * Base: stats da Pokédex (HP, Atk, Def, SpA, SpD, Speed).
 * Ajuste: curva de compressão para extremos, multiplicadores suaves de raridade,
 * e reforço de estágios evolutivos para a economia estilo TFT.
 *
 * Tudo está embutido neste arquivo. NÃO há fetch, API, CDN, banco de dados,
 * geração aleatória ou dependência externa.
 *
 * Ordem de cada registro:
 * ID | Nome | Raridade da família | Estágio de balanceamento
 * | vida,atk,def,spa,spd,vel
 *
 * Energia +1/s e regeneração 0/s seguem as regras ATUAIS do projeto.
 * IVs, estruturas, tipos, fusão, Zygarde e PvE continuam sendo calculados
 * pelo motor original do jogo.
 *
 * NOTA SOBRE O CATÁLOGO PUBLICADO:
 * O repositório ainda inclui Wigglytuff e Klawf entre os 100 compráveis,
 * embora a revisão planejada os exclua da loja. Permanecem aqui para dar
 * cobertura exata ao código atual; este módulo NÃO altera quem é vendável.
 */
const REGISTROS = `
0001|Bulbasaur|comum|1|69,68,68,76,76,66
0007|Squirtle|comum|1|69,68,76,69,76,65
0004|Charmander|comum|1|66,70,65,74,69,76
0013|Weedle|comum|1|66,60,57,49,49,69
0010|Caterpie|comum|1|69,57,60,49,49,66
0060|Poliwag|comum|1|66,69,63,63,63,87
0066|Machop|comum|1|82,83,69,60,60,60
0273|Seedot|comum|1|66,63,69,57,57,57
0270|Lotad|comum|1|66,57,57,63,69,57
0582|Vanillite|comum|1|64,69,69,76,74,65
0761|Bounsweet|comum|1|67,57,62,57,62,58
0129|Magikarp|comum|1|52,39,71,44,49,83
0568|Trubbish|comum|1|72,69,75,63,75,76
0174|Igglybuff|comum|1|90,57,44,63,49,44
0172|Pichu|comum|1|52,63,44,60,60,74
0173|Cleffa|comum|1|72,53,55,66,71,44
0440|Happiny|comum|1|94,32,32,44,76,57
0446|Munchlax|comum|1|107,85,63,63,85,32
0767|Wimpod|comum|1|56,60,63,49,57,83
0712|Bergmite|comum|1|75,78,85,58,60,55
0041|Zubat|comum|1|66,66,60,57,63,71
0092|Gastly|incomum|1|66,66,62,100,66,91
0063|Abra|incomum|1|62,54,49,102,78,96
0081|Magnemite|incomum|1|62,66,86,98,78,72
0280|Ralts|incomum|1|64,58,58,72,66,69
0255|Torchic|incomum|1|76,81,69,86,75,72
0363|Spheal|incomum|1|90,69,75,78,75,58
0393|Piplup|incomum|1|81,76,77,82,79,69
0656|Froakie|incomum|1|73,79,69,82,72,87
0653|Fennekin|incomum|1|73,72,69,82,81,81
0728|Popplio|incomum|1|79,78,78,84,79,69
0025|Pikachu|incomum|1|69,78,69,75,75,96
0133|Eevee|incomum|1|82,78,75,72,84,78
0039|Jigglypuff|incomum|1|110,72,54,72,58,54
0331|Cacnea|incomum|1|79,93,69,93,69,66
0361|Snorunt|incomum|1|79,75,75,75,75,75
0557|Dwebble|incomum|1|79,84,93,66,66,78
0318|Carvanha|incomum|1|76,96,54,84,54,84
0320|Wailmer|incomum|1|115,86,66,86,66,81
0333|Swablu|incomum|1|76,69,81,69,89,75
0714|Noibat|incomum|1|73,62,66,72,69,78
0702|Dedenne|incomum|1|88,80,79,92,85,100
0562|Yamask|incomum|1|71,62,93,78,84,62
0718|Zygarde|incomum|1|107,100,108,92,98,98
0532|Timburr|incomum|1|92,91,78,58,66,66
0459|Snover|incomum|1|85,82,75,82,81,69
0304|Aron|raro|1|87,95,110,76,76,68
0111|Rhyhorn|raro|1|104,103,108,68,68,64
0607|Litwick|raro|1|87,68,86,92,86,59
0669|Flabébé|raro|1|83,75,75,90,100,77
0722|Rowlet|raro|1|98,86,86,83,83,77
0725|Litten|raro|1|84,92,76,89,76,95
0856|Hatenna|raro|1|81,68,80,87,85,75
0859|Impidimp|raro|1|84,80,68,86,76,83
0113|Chansey|raro|1|167,38,38,72,112,83
0570|Zorua|raro|1|80,92,76,100,76,92
0622|Golett|raro|1|93,97,83,72,83,72
0708|Phantump|raro|1|82,95,82,83,89,75
0040|Wigglytuff|raro|1|131,95,80,103,83,80
0147|Dratini|raro|1|81,91,80,83,83,83
0443|Gible|raro|1|92,95,80,76,80,77
0246|Larvitar|raro|1|87,91,83,80,83,77
0633|Deino|raro|1|88,92,83,80,83,75
0679|Honedge|raro|1|84,100,110,72,74,67
0447|Riolu|raro|1|80,95,76,72,76,89
0624|Pawniard|raro|1|84,103,95,76,76,89
0131|Lapras|epico|1|140,113,110,113,118,98
0143|Snorlax|epico|1|152,126,101,101,126,75
0621|Druddigon|epico|1|113,131,116,98,116,90
0778|Mimikyu|epico|1|99,116,110,91,123,119
0701|Hawlucha|epico|1|114,117,107,107,100,130
0359|Absol|epico|1|106,135,98,107,98,107
0950|Klawf|epico|1|109,121,128,80,95,107
0794|Buzzwole|epico|1|129,139,139,93,93,110
0095|Onix|epico|1|84,88,148,75,88,104
0123|Scyther|epico|1|109,126,110,95,110,123
0796|Xurkitree|epico|1|116,115,105,153,105,112
0799|Guzzlord|epico|1|175,121,93,119,93,86
0214|Heracross|epico|1|115,133,107,84,118,113
0227|Skarmory|epico|1|106,110,140,84,104,104
0789|Cosmog|mitico|1|97,80,82,80,82,87
0891|Kubfu|mitico|1|110,124,105,100,98,113
0808|Meltan|mitico|1|100,109,109,102,85,85
0151|Mew|mitico|1|135,130,130,130,130,130
0648|Meloetta|mitico|1|135,117,117,144,144,124
0719|Diancie|mitico|1|103,130,154,130,154,98
0721|Volcanion|mitico|1|123,135,140,145,124,112
0807|Zeraora|mitico|1|128,136,115,131,118,151
0491|Darkrai|mitico|1|117,124,124,147,124,143
0801|Magearna|mitico|1|123,127,138,145,138,109
0385|Jirachi|mitico|1|135,130,130,130,130,130
0150|Mewtwo|lendario|1|148,146,134,168,134,156
0716|Xerneas|lendario|1|159,157,137,157,139,139
0717|Yveltal|lendario|1|159,157,137,157,139,139
0890|Eternatus|lendario|1|166,131,137,164,137,156
0384|Rayquaza|lendario|1|148,166,134,166,134,137
0382|Kyogre|lendario|1|145,140,134,166,161,134
0383|Groudon|lendario|1|145,166,161,140,134,134
0484|Palkia|lendario|1|139,151,140,166,151,140
0483|Dialga|lendario|1|145,151,151,166,140,134
0002|Ivysaur|comum|2|93,90,90,100,100,89
0003|Venusaur|comum|3|121,117,118,127,127,116
0008|Wartortle|comum|2|92,90,100,91,100,87
0009|Blastoise|comum|3|120,118,127,119,130,115
0005|Charmeleon|comum|2|91,91,87,100,91,100
0006|Charizard|comum|3|120,119,115,132,119,127
0014|Kakuna|comum|2|83,63,82,63,63,72
0015|Beedrill|comum|3|111,122,88,92,116,113
0011|Metapod|comum|2|86,59,86,63,63,68
0012|Butterfree|comum|3|108,92,96,122,116,110
0061|Poliwhirl|comum|2|95,91,91,82,82,105
0062|Poliwrath|comum|3|127,125,125,110,122,110
0186|Politoed|comum|3|127,113,113,122,127,110
0067|Machoke|comum|2|103,109,94,82,89,79
0068|Machamp|comum|3|127,142,116,107,119,100
0274|Nuzleaf|comum|2|98,94,76,89,76,89
0275|Shiftry|comum|3|127,127,103,122,103,116
0271|Lombre|comum|2|93,82,82,89,94,82
0272|Ludicolo|comum|3|121,110,110,122,127,110
0583|Vanillish|comum|2|87,91,91,100,97,88
0584|Vanilluxe|comum|3|115,125,119,133,125,116
0762|Steenee|comum|2|88,76,81,76,81,90
0763|Tsareena|comum|3|116,138,126,96,126,111
0130|Gyarados|comum|2|111,120,99,89,109,100
0569|Garbodor|comum|2|103,107,101,89,101,97
0026|Raichu|comum|3|108,122,100,122,116,133
0035|Clefairy|comum|2|98,79,81,89,91,72
0036|Clefable|comum|3|129,110,112,125,122,103
0242|Blissey|comum|3|196,54,54,113,145,100
0768|Golisopod|comum|2|101,120,126,89,105,76
0713|Avalugg|comum|2|111,117,142,78,80,66
0042|Golbat|comum|2|101,100,94,91,97,105
0169|Crobat|comum|3|124,122,116,110,116,142
0093|Haunter|incomum|2|91,90,87,127,94,117
0094|Gengar|incomum|3|118,117,113,156,124,146
0064|Kadabra|incomum|2|87,79,74,129,103,122
0065|Alakazam|incomum|3|115,106,101,159,137,151
0082|Magneton|incomum|2|95,97,117,129,103,103
0462|Magnezone|incomum|3|126,121,148,156,134,113
0281|Kirlia|incomum|2|86,79,79,100,94,90
0282|Gardevoir|incomum|3|124,117,117,154,148,127
0475|Gallade|incomum|3|124,154,117,117,148,127
0256|Combusken|incomum|2|102,112,97,112,97,94
0257|Blaziken|incomum|3|133,151,121,146,121,127
0364|Sealeo|incomum|2|119,97,103,106,103,87
0365|Walrein|incomum|3|151,127,134,137,134,117
0394|Prinplup|incomum|2|104,101,102,110,107,90
0395|Empoleon|incomum|3|135,131,133,146,140,113
0657|Frogadier|incomum|2|98,99,92,111,95,118
0658|Greninja|incomum|3|127,137,119,142,121,152
0654|Braixen|incomum|2|101,97,96,115,103,105
0655|Delphox|incomum|3|129,120,122,148,140,142
0729|Brionne|incomum|2|102,103,103,115,110,90
0730|Primarina|incomum|3|133,123,123,154,149,113
0134|Vaporeon|incomum|2|138,100,97,125,117,100
0135|Jolteon|incomum|2|105,100,97,125,117,134
0136|Flareon|incomum|2|105,134,97,117,125,100
0196|Espeon|incomum|2|105,100,97,134,117,125
0197|Umbreon|incomum|2|122,100,125,97,134,100
0470|Leafeon|incomum|2|105,125,134,97,100,117
0471|Glaceon|incomum|2|105,97,125,134,117,100
0700|Sylveon|incomum|2|122,100,100,125,134,97
0332|Cacturne|incomum|2|108,127,97,127,97,94
0362|Glalie|incomum|2|114,109,109,109,109,109
0478|Froslass|incomum|2|108,109,103,109,103,125
0558|Crustle|incomum|2|108,122,132,100,106,87
0319|Sharpedo|incomum|2|108,129,83,117,83,117
0321|Wailord|incomum|2|155,115,87,115,87,97
0334|Altaria|incomum|2|111,103,115,103,122,109
0715|Noivern|incomum|2|116,103,109,118,109,131
0563|Cofagrigus|incomum|2|100,90,140,117,122,74
0533|Gurdurr|incomum|2|116,122,112,83,90,83
0534|Conkeldurr|incomum|3|148,161,137,110,117,101
0460|Abomasnow|incomum|2|119,116,106,116,112,97
0305|Lairon|raro|2|112,126,152,100,100,91
0306|Aggron|raro|3|138,160,198,125,125,116
0112|Rhydon|raro|2|139,147,142,95,95,91
0464|Rhyperior|raro|3|169,177,172,121,121,106
0608|Lampent|raro|2|112,91,107,129,107,103
0609|Chandelure|raro|3|130,121,147,180,147,140
0670|Floette|raro|2|107,95,97,117,131,101
0671|Florges|raro|3|144,129,131,161,185,137
0723|Dartrix|raro|2|124,117,117,114,114,101
0724|Decidueye|raro|3|144,158,137,154,154,133
0726|Torracat|raro|2|115,123,100,120,100,126
0727|Incineroar|raro|3|156,163,147,140,147,125
0857|Hattrem|raro|2|110,91,110,124,116,99
0858|Hatterene|raro|3|128,147,151,175,156,94
0860|Morgrem|raro|2|115,107,95,117,103,114
0861|Grimmsnarl|raro|3|156,166,129,151,137,125
0571|Zoroark|raro|2|112,135,107,142,107,135
0623|Golurk|raro|2|130,144,120,103,120,103
0709|Trevenant|raro|2|128,137,118,110,121,104
0148|Dragonair|raro|2|112,123,110,114,114,114
0149|Dragonite|raro|3|153,174,151,154,154,140
0444|Gabite|raro|2|117,126,110,100,103,121
0445|Garchomp|raro|3|164,172,151,140,144,155
0247|Pupitar|raro|2|119,123,114,110,114,100
0248|Tyranitar|raro|3|159,174,160,151,154,126
0634|Zweilous|raro|2|120,123,114,110,114,106
0635|Hydreigon|raro|3|154,157,147,169,147,153
0680|Doublade|raro|2|111,137,157,95,99,87
0681|Aegislash|raro|3|130,116,177,116,177,125
0448|Lucario|raro|2|119,137,114,140,114,126
0625|Bisharp|raro|2|115,145,132,107,114,114
0983|Kingambit|raro|3|159,175,166,125,144,116
0208|Steelix|epico|2|134,136,196,114,122,90
0212|Scizor|epico|2|131,162,145,114,132,122
0900|Kleavor|epico|2|131,165,142,105,125,136
0790|Cosmoem|mitico|2|117,96,175,96,175,105
0791|Solgaleo|mitico|3|214,208,187,191,173,180
0792|Lunala|mitico|3|214,191,173,208,187,180
0892-dec|Urshifu (Decisivo)|mitico|2|161,174,156,129,126,154
0892-flu|Urshifu (Fluido)|mitico|2|161,174,156,129,126,154
0809|Melmetal|mitico|2|183,181,181,142,131,101
`.trim();

// Atributos estatísticos que o motor realmente usa em batalha.
export const ATRIBUTOS_DE_COMBATE = Object.freeze([
  'vida', 'atk', 'def', 'spa', 'spd', 'vel'
]);
export const ENERGIA_POR_SEGUNDO = 1;
export const REGENERACAO_POR_SEGUNDO = 0;

const removerAcentos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const normalizarNome = (s) => removerAcentos(String(s)).toLowerCase().trim();

const POR_ID = Object.create(null);
const POR_NOME = Object.create(null);

for (const linha of REGISTROS.split('\n')) {
  const [id, nome, raridade, estagioTexto, atributosTexto] = linha.split('|');
  const valores = atributosTexto.split(',').map(Number);
  const registro = Object.freeze({
    id,
    nome,
    raridade,
    estagio: Number(estagioTexto),
    vida: valores[0],
    atk: valores[1],
    def: valores[2],
    spa: valores[3],
    spd: valores[4],
    vel: valores[5],
    energia: ENERGIA_POR_SEGUNDO,
    regeneracao: REGENERACAO_POR_SEGUNDO
  });
  POR_ID[id] = registro;
  POR_NOME[normalizarNome(nome)] = registro;
}

export const STATUS_POKEMON = Object.freeze(POR_ID);
export const TOTAL_POKEMON_COM_STATUS = Object.keys(POR_ID).length;

/** Aceita ID ("0001", 1, "0892-dec") ou nome ("Flabébé"). */
export function obterStatusPokemon(idOuNome) {
  if (idOuNome == null) return null;
  const valor = String(idOuNome).trim();
  const porId = /^\d+$/.test(valor) ? valor.padStart(4, '0') : valor;
  return STATUS_POKEMON[porId] ?? POR_NOME[normalizarNome(valor)] ?? null;
}

/** 
 * Aplica os seis stats a objetos do roster atual, sem romper a estrutura do motor.
 * Os dois stats de energia e regeneração também ficam expostos no Pokémon,
 * mas seu comportamento segue os valores globais do combate (+1/s e 0/s).
 *
 * Não altera loja, raridade, preço, habilidades, sprites, tipos nem evolução.
 * Retorna espécies aplicadas e IDs ausentes (se o elenco for expandido no futuro).
 */
export function aplicarStatusPokemon(pokemons, { estrito = false } = {}) {
  let aplicados = 0;
  const ausentes = [];
  for (const pokemon of pokemons) {
    const status = obterStatusPokemon(pokemon.id);
    if (!status) {
      ausentes.push(pokemon.id);
      continue;
    }
    pokemon.stats = Object.fromEntries(
      ATRIBUTOS_DE_COMBATE.map((atributo) => [atributo, status[atributo]])
    );
    pokemon.energia = status.energia;
    pokemon.regeneracao = status.regeneracao;
    pokemon.estimatedStats = false;
    aplicados += 1;
  }
  if (estrito && ausentes.length) {
    throw new Error(`PokeArena: status não cadastrados para: ${ausentes.join(', ')}`);
  }
  return { aplicados, ausentes };
}

export default STATUS_POKEMON;
