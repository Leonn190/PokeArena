// Atributos base oficiais (Gen 1 e evoluções): HP / Attack / Sp.Atk / Defense / Sp.Def / Speed.
// Nota: DEF e SPD são defesas física e especial; VEL é velocidade de movimento/ação.
// Metadados de animação extraídos dos respectivos AnimData.xml do PMDCollab.
const SPRITES = {
  '0001': { Idle:[32,40,[40,6,6]], Walk:[40,40,[4,4,4,4,4,4]], Attack:[64,72,[4,2,4,2,2,2,2,2,2,2,4]], Hurt:[40,56,[2,8]] },
  '0002': { Idle:[32,32,[40,12,12,12]], Walk:[32,32,[8,10,8,10]], Attack:[64,64,[4,2,4,2,2,2,2,2,4]], Hurt:[48,56,[2,8]] },
  '0003': { Idle:[32,32,[30,16,12,16]], Walk:[32,32,[8,16,8,16]], Attack:[72,72,[4,2,4,2,2,2,2,2,2,2,4]], Hurt:[48,48,[2,8]] },
  '0004': { Idle:[32,40,[12,8,8,8]], Walk:[32,32,[6,8,6,8]], Attack:[64,64,[2,2,4,2,2,2,2,2,2,2,2]], Hurt:[48,56,[2,8]] },
  '0005': { Idle:[32,56,[40,2,3,3,3,2]], Walk:[24,32,[8,10,8,10]], Attack:[72,80,[2,2,2,2,4,1,1,2,2,2,2,2,2,2]], Hurt:[48,64,[2,8]] },
  '0006': { Idle:[40,48,[15,15,15,15]], Walk:[40,48,[8,10,8,10]], Attack:[80,88,[2,2,2,2,4,1,1,2,2,2,2,2,2,2]], Hurt:[64,64,[2,8]] },
  '0007': { Idle:[32,32,[30,2,2,4,4,4,2,2]], Walk:[32,32,[12,8,12,8]], Attack:[64,72,[2,4,1,1,1,2,2,2,2,2]], Hurt:[40,56,[2,8]] },
  '0008': { Idle:[24,40,[40,2,2,2]], Walk:[32,40,[8,10,8,10]], Attack:[64,72,[4,2,4,2,2,2,2,2,2,2,4]], Hurt:[48,48,[2,8]] },
  '0009': { Idle:[40,40,[32,12,4,4,4,4,4,8]], Walk:[32,40,[8,14,8,14]], Attack:[64,72,[2,2,2,2,2,2,2,1,1,1,2,2,4]], Hurt:[40,40,[2,8]] },
};
// Catálogo aprovado no GDD v0.4: 100 entradas COMPRÁVEIS.
// Estatísticas base da Pokédex (HP, Atk, Def, SpA, SpD, Vel); Klawf #950: Pokédex Gen IX.
// Os tipos numéricos são os IDs canônicos veekun. Formas derivadas fora da lista
// comprável só entram na loja se forem explicitamente listadas pelo GDD.
import { RULES } from './rules.mjs';

const TYPE_NAMES = ['','Normal','Lutador','Voador','Venenoso','Terrestre','Pedra','Inseto','Fantasma','Aço','Fogo','Água','Grama','Elétrico','Psíquico','Gelo','Dragão','Sombrio','Fada'];
const TYPE_COLORS = ['','#c5bf9b','#db8b63','#a6c5d5','#aa8ac4','#cfae72','#ae9983','#b6c96d','#a69bc8','#afc3cc','#ffa56f','#83c7ff','#75d8a9','#f5d36f','#e6aed4','#a1d8e6','#9baee0','#8c88af','#e5acd2'];
const CATALOG = [
  [1,'Bulbasaur','comum',[45,49,49,65,65,45],[12,4]],
  [7,'Squirtle','comum',[44,48,65,50,64,43],[11]],
  [4,'Charmander','comum',[39,52,43,60,50,65],[10]],
  [13,'Weedle','comum',[40,35,30,20,20,50],[7,4]],
  [10,'Caterpie','comum',[45,30,35,20,20,45],[7]],
  [60,'Poliwag','comum',[40,50,40,40,40,90],[11]],
  [66,'Machop','comum',[70,80,50,35,35,35],[2]],
  [273,'Seedot','comum',[40,40,50,30,30,30],[12]],
  [270,'Lotad','comum',[40,30,30,40,50,30],[11,12]],
  [582,'Vanillite','comum',[36,50,50,65,60,44],[15]],
  [761,'Bounsweet','comum',[42,30,38,30,38,32],[12]],
  [129,'Magikarp','comum',[20,10,55,15,20,80],[11]],
  [568,'Trubbish','comum',[50,50,62,40,62,65],[4]],
  [174,'Igglybuff','comum',[90,30,15,40,20,15],[1,18]],
  [172,'Pichu','comum',[20,40,15,35,35,60],[13]],
  [173,'Cleffa','comum',[50,25,28,45,55,15],[18]],
  [440,'Happiny','comum',[100,5,5,15,65,30],[1]],
  [446,'Munchlax','comum',[135,85,40,40,85,5],[1]],
  [767,'Wimpod','comum',[25,35,40,20,30,80],[7,11]],
  [712,'Bergmite','comum',[55,69,85,32,35,28],[15]],
  [41,'Zubat','comum',[40,45,35,30,40,55],[4,3]],
  [92,'Gastly','incomum',[30,35,30,100,35,80],[8,4]],
  [63,'Abra','incomum',[25,20,15,105,55,90],[14]],
  [81,'Magnemite','incomum',[25,35,70,95,55,45],[13,9]],
  [280,'Ralts','incomum',[28,25,25,45,35,40],[14,18]],
  [255,'Torchic','incomum',[45,60,40,70,50,45],[10]],
  [363,'Spheal','incomum',[70,40,50,55,50,25],[15,11]],
  [393,'Piplup','incomum',[53,51,53,61,56,40],[11]],
  [656,'Froakie','incomum',[41,56,40,62,44,71],[11]],
  [653,'Fennekin','incomum',[40,45,40,62,60,60],[10]],
  [728,'Popplio','incomum',[50,54,54,66,56,40],[11]],
  [25,'Pikachu','incomum',[35,55,40,50,50,90],[13]],
  [133,'Eevee','incomum',[55,55,50,45,65,55],[1]],
  [39,'Jigglypuff','incomum',[115,45,20,45,25,20],[1,18]],
  [331,'Cacnea','incomum',[50,85,40,85,40,35],[12]],
  [361,'Snorunt','incomum',[50,50,50,50,50,50],[15]],
  [557,'Dwebble','incomum',[50,65,85,35,35,55],[7,6]],
  [318,'Carvanha','incomum',[45,90,20,65,20,65],[11,17]],
  [320,'Wailmer','incomum',[130,70,35,70,35,60],[11]],
  [333,'Swablu','incomum',[45,40,60,40,75,50],[1,3]],
  [714,'Noibat','incomum',[40,30,35,45,40,55],[3,16]],
  [702,'Dedenne','incomum',[67,58,57,81,67,101],[13,18]],
  [562,'Yamask','incomum',[38,30,85,55,65,30],[8]],
  [718,'Zygarde','incomum',[108,100,121,81,95,95],[16,5]],
  [532,'Timburr','incomum',[75,80,55,25,35,35],[2]],
  [459,'Snover','incomum',[60,62,50,62,60,40],[12,15]],
  [304,'Aron','raro',[50,70,100,40,40,30],[9,6]],
  [111,'Rhyhorn','raro',[80,85,95,30,30,25],[5,6]],
  [607,'Litwick','raro',[50,30,55,65,55,20],[8,10]],
  [669,'Flabébé','raro',[44,38,39,61,79,42],[18]],
  [722,'Rowlet','raro',[68,55,55,50,50,42],[12,3]],
  [725,'Litten','raro',[45,65,40,60,40,70],[10]],
  [856,'Hatenna','raro',[42,30,45,56,53,39],[14]],
  [859,'Impidimp','raro',[45,45,30,55,40,50],[17,18]],
  [113,'Chansey','raro',[250,5,5,35,105,50],[1]],
  [570,'Zorua','raro',[40,65,40,80,40,65],[17]],
  [622,'Golett','raro',[59,74,50,35,50,35],[5,8]],
  [708,'Phantump','raro',[43,70,48,50,60,38],[8,12]],
  [40,'Wigglytuff','raro',[140,70,45,85,50,45],[1,18]],
  [147,'Dratini','raro',[41,64,45,50,50,50],[16]],
  [443,'Gible','raro',[58,70,45,40,45,42],[16,5]],
  [246,'Larvitar','raro',[50,64,50,45,50,41],[6,5]],
  [633,'Deino','raro',[52,65,50,45,50,38],[17,16]],
  [679,'Honedge','raro',[45,80,100,35,37,28],[9,8]],
  [447,'Riolu','raro',[40,70,40,35,40,60],[2]],
  [624,'Pawniard','raro',[45,85,70,40,40,60],[17,9]],
  [131,'Lapras','epico',[130,85,80,85,95,60],[11,15]],
  [143,'Snorlax','epico',[160,110,65,65,110,30],[1]],
  [621,'Druddigon','epico',[77,120,90,60,90,48],[16]],
  [778,'Mimikyu','epico',[55,90,80,50,105,96],[8,18]],
  [701,'Hawlucha','epico',[78,92,75,74,63,118],[2,3]],
  [359,'Absol','epico',[65,130,60,75,60,75],[17]],
  [950,'Klawf','epico',[70,100,115,35,55,75],[6]],
  [794,'Buzzwole','epico',[107,139,139,53,53,79],[7,2]],
  [95,'Onix','epico',[35,45,160,30,45,70],[6,5]],
  [123,'Scyther','epico',[70,110,80,55,80,105],[7,3]],
  [796,'Xurkitree','epico',[83,89,71,173,71,83],[13]],
  [799,'Guzzlord','epico',[223,101,53,97,53,43],[17,16]],
  [214,'Heracross','epico',[80,125,75,40,95,85],[7,2]],
  [227,'Skarmory','epico',[65,80,140,40,70,70],[9,3]],
  [789,'Cosmog','mitico',[43,29,31,29,31,37],[14]],
  [891,'Kubfu','mitico',[60,90,60,53,50,72],[2]],
  [808,'Meltan','mitico',[46,65,65,55,35,34],[9]],
  [151,'Mew','mitico',[100,100,100,100,100,100],[14]],
  [648,'Meloetta','mitico',[100,77,77,128,128,90],[1,14]],
  [719,'Diancie','mitico',[50,100,150,100,150,50],[6,18]],
  [721,'Volcanion','mitico',[80,110,120,130,90,70],[10,11]],
  [807,'Zeraora','mitico',[88,112,75,102,80,143],[13]],
  [491,'Darkrai','mitico',[70,90,90,135,90,125],[17]],
  [801,'Magearna','mitico',[80,95,115,130,115,65],[9,18]],
  [385,'Jirachi','mitico',[100,100,100,100,100,100],[9,14]],
  [150,'Mewtwo','lendario',[106,110,90,154,90,130],[14]],
  [716,'Xerneas','lendario',[126,131,95,131,98,99],[18]],
  [717,'Yveltal','lendario',[126,131,95,131,98,99],[17,3]],
  [890,'Eternatus','lendario',[140,85,95,145,95,130],[4,16]],
  [384,'Rayquaza','lendario',[105,150,90,150,90,95],[16,3]],
  [382,'Kyogre','lendario',[100,100,90,150,140,90],[11]],
  [383,'Groudon','lendario',[100,150,140,100,90,90],[5]],
  [484,'Palkia','lendario',[90,120,100,150,120,100],[11,16]],
  [483,'Dialga','lendario',[100,120,120,150,100,90],[9,16]],
];
// Caminhos homologados na tabela 5.4; ainda não implica sprites ou compra da forma intermediária.
export const EVOLUTION_PATHS = Object.freeze({
  'Bulbasaur':'Ivysaur,Venusaur',
  'Squirtle':'Wartortle,Blastoise',
  'Charmander':'Charmeleon,Charizard',
  'Weedle':'Kakuna,Beedrill',
  'Caterpie':'Metapod,Butterfree',
  'Poliwag':'Poliwhirl,Poliwrath|Politoed',
  'Machop':'Machoke,Machamp',
  'Seedot':'Nuzleaf,Shiftry',
  'Lotad':'Lombre,Ludicolo',
  'Vanillite':'Vanillish,Vanilluxe',
  'Bounsweet':'Steenee,Tsareena',
  'Magikarp':'Gyarados',
  'Trubbish':'Garbodor',
  'Igglybuff':'Jigglypuff,Wigglytuff',
  'Pichu':'Pikachu,Raichu',
  'Cleffa':'Clefairy,Clefable',
  'Happiny':'Chansey,Blissey',
  'Munchlax':'Snorlax',
  'Wimpod':'Golisopod',
  'Bergmite':'Avalugg',
  'Zubat':'Golbat,Crobat',
  'Gastly':'Haunter,Gengar',
  'Abra':'Kadabra,Alakazam',
  'Magnemite':'Magneton,Magnezone',
  'Ralts':'Kirlia,Gardevoir|Gallade',
  'Torchic':'Combusken,Blaziken',
  'Spheal':'Sealeo,Walrein',
  'Piplup':'Prinplup,Empoleon',
  'Froakie':'Frogadier,Greninja',
  'Fennekin':'Braixen,Delphox',
  'Popplio':'Brionne,Primarina',
  'Pikachu':'Raichu',
  'Eevee':'Eeveelution',
  'Jigglypuff':'Wigglytuff',
  'Cacnea':'Cacturne',
  'Snorunt':'Glalie|Froslass',
  'Dwebble':'Crustle',
  'Carvanha':'Sharpedo',
  'Wailmer':'Wailord',
  'Swablu':'Altaria',
  'Noibat':'Noivern',
  'Yamask':'Cofagrigus',
  'Timburr':'Gurdurr,Conkeldurr',
  'Snover':'Abomasnow',
  'Aron':'Lairon,Aggron',
  'Rhyhorn':'Rhydon,Rhyperior',
  'Litwick':'Lampent,Chandelure',
  'Flabébé':'Floette,Florges',
  'Rowlet':'Dartrix,Decidueye',
  'Litten':'Torracat,Incineroar',
  'Hatenna':'Hattrem,Hatterene',
  'Impidimp':'Morgrem,Grimmsnarl',
  'Chansey':'Blissey',
  'Zorua':'Zoroark',
  'Golett':'Golurk',
  'Phantump':'Trevenant',
  'Dratini':'Dragonair,Dragonite',
  'Gible':'Gabite,Garchomp',
  'Larvitar':'Pupitar,Tyranitar',
  'Deino':'Zweilous,Hydreigon',
  'Honedge':'Doublade,Aegislash',
  'Riolu':'Lucario',
  'Pawniard':'Bisharp,Kingambit',
  'Onix':'Steelix',
  'Scyther':'Scizor|Kleavor',
  'Cosmog':'Cosmoem,Solgaleo|Lunala',
  'Kubfu':'Urshifu',
  'Meltan':'Melmetal',
});

const BASE_SPRITES = Object.freeze({Idle:{width:40,height:40,durations:[12,12,12,12],asset:'Idle'}});
const make = ([num,name,rarity,[vida,atk,def,spa,spd,vel],typeIds]) => {
  const id = String(num).padStart(4,'0');
  const types = typeIds.map(type => TYPE_NAMES[type]);
  const evolution = EVOLUTION_PATHS[name] || '';
  const stage = SPRITES[id] ? (['0001','0004','0007'].includes(id) ? 1 : ['0002','0005','0008'].includes(id) ? 2 : 3) : 1;
  return {
    id,number:num,name,group:name,rarity,price:RULES.rarityPrice[rarity],type:types[0],types,
    color:TYPE_COLORS[typeIds[0]],stats:{vida,atk,def,spa,spd,vel},
    stage,collisionRadius:stage===3?23:stage===2?19:16,
    evolutionPath:evolution,
    spriteAvailable:!!SPRITES[id],
    sprites: SPRITES[id] ? Object.fromEntries(Object.entries(SPRITES[id]).map(([key,[width,height,durations]]) => [key,{width,height,durations,hitFrame:Math.floor(durations.length*.55),asset:key}])) : {...BASE_SPRITES}
  };
};
export const SHOP_POKEMON = CATALOG.map(make);
// Seis evoluções preservadas do simulador, não fazem parte das 100 entradas da loja.
const starterEvolutions = [
  [2,'Ivysaur','Bulbasaur',1,'incomum',[60,62,63,80,80,60],[12,4],2],
  [3,'Venusaur','Bulbasaur',1,'raro',[80,82,83,100,100,80],[12,4],3],
  [5,'Charmeleon','Charmander',4,'incomum',[58,64,58,80,65,80],[10],2],
  [6,'Charizard','Charmander',4,'raro',[78,84,78,109,85,100],[10,3],3],
  [8,'Wartortle','Squirtle',7,'incomum',[59,63,80,65,80,58],[11],2],
  [9,'Blastoise','Squirtle',7,'raro',[79,83,100,85,105,78],[11],3]
].map(([num,name,group,_start,rarity,stats,typeIds,stage]) => ({
  ...make([num,name,rarity,stats,typeIds]),group,stage,
  collisionRadius:stage===3?23:19,
  price:stage===2?2:3
}));
// Índices estáveis de evolução. As 100 espécies acima são as ÚNICAS compráveis.
// Atributos das formas derivadas ainda sem dados completos usam escala visual provisória
// (sem se fazer passar por valores oficiais); iniciais preservam seus atributos já cadastrados.
const EVOLUTION_NUMBERS = Object.freeze({
  Ivysaur:2,Venusaur:3,Wartortle:8,Blastoise:9,Charmeleon:5,Charizard:6,
  Kakuna:14,Beedrill:15,Metapod:11,Butterfree:12,Poliwhirl:61,Poliwrath:62,Politoed:186,
  Machoke:67,Machamp:68,Nuzleaf:274,Shiftry:275,Lombre:271,Ludicolo:272,
  Vanillish:583,Vanilluxe:584,Steenee:762,Tsareena:763,Gyarados:130,Garbodor:569,
  Raichu:26,Clefairy:35,Clefable:36,Blissey:242,Golisopod:768,Avalugg:713,
  Golbat:42,Crobat:169,Haunter:93,Gengar:94,Kadabra:64,Alakazam:65,
  Magneton:82,Magnezone:462,Kirlia:281,Gardevoir:282,Gallade:475,
  Combusken:256,Blaziken:257,Sealeo:364,Walrein:365,Prinplup:394,Empoleon:395,
  Frogadier:657,Greninja:658,Braixen:654,Delphox:655,Brionne:729,Primarina:730,
  Vaporeon:134,Jolteon:135,Flareon:136,Espeon:196,Umbreon:197,Leafeon:470,Glaceon:471,Sylveon:700,
  Cacturne:332,Glalie:362,Froslass:478,Crustle:558,Sharpedo:319,Wailord:321,
  Altaria:334,Noivern:715,Cofagrigus:563,Gurdurr:533,Conkeldurr:534,Abomasnow:460,
  Lairon:305,Aggron:306,Rhydon:112,Rhyperior:464,Lampent:608,Chandelure:609,
  Floette:670,Florges:671,Dartrix:723,Decidueye:724,Torracat:726,Incineroar:727,
  Hattrem:857,Hatterene:858,Morgrem:860,Grimmsnarl:861,Zoroark:571,Golurk:623,
  Trevenant:709,Dragonair:148,Dragonite:149,Gabite:444,Garchomp:445,
  Pupitar:247,Tyranitar:248,Zweilous:634,Hydreigon:635,Doublade:680,Aegislash:681,
  Lucario:448,Bisharp:625,Kingambit:983,Steelix:208,Scizor:212,Kleavor:900,
  Cosmoem:790,Solgaleo:791,Lunala:792,Urshifu:892,
  'Urshifu (Decisivo)':892,'Urshifu (Fluido)':892,Melmetal:809
});
const EEVEELUTIONS = 'Vaporeon|Jolteon|Flareon|Espeon|Umbreon|Leafeon|Glaceon|Sylveon';
// Tipagens canônicas que MUDAM ao evoluir (demais formas herdam da origem).
const EVOLUTION_TYPES = Object.freeze({
  Butterfree:['Inseto','Voador'],Poliwrath:['Água','Lutador'],
  Nuzleaf:['Grama','Sombrio'],Shiftry:['Grama','Sombrio'],Gyarados:['Água','Voador'],
  Gallade:['Psíquico','Lutador'],Combusken:['Fogo','Lutador'],Blaziken:['Fogo','Lutador'],
  Empoleon:['Água','Aço'],Greninja:['Água','Sombrio'],Delphox:['Fogo','Psíquico'],
  Primarina:['Água','Fada'],Vaporeon:['Água'],Jolteon:['Elétrico'],Flareon:['Fogo'],
  Espeon:['Psíquico'],Umbreon:['Sombrio'],Leafeon:['Grama'],Glaceon:['Gelo'],Sylveon:['Fada'],
  Cacturne:['Grama','Sombrio'],Froslass:['Gelo','Fantasma'],Altaria:['Dragão','Voador'],
  Abomasnow:['Grama','Gelo'],Decidueye:['Grama','Fantasma'],
  Incineroar:['Fogo','Sombrio'],Hatterene:['Psíquico','Fada'],
  Dragonite:['Dragão','Voador'],Tyranitar:['Pedra','Sombrio'],Lucario:['Lutador','Aço'],
  Steelix:['Aço','Terrestre'],Scizor:['Inseto','Aço'],Kleavor:['Inseto','Pedra'],
  Solgaleo:['Psíquico','Aço'],Lunala:['Psíquico','Fantasma'],
  'Urshifu (Decisivo)':['Lutador','Sombrio'],
  'Urshifu (Fluido)':['Lutador','Água']
});
// Quantidades do GDD 5.4, em cada avanço de estágio (não três para todos).
const FIRST_STAGE_COUNTS = Object.freeze({
  ...Object.fromEntries(['Bulbasaur','Squirtle','Charmander','Weedle','Caterpie','Poliwag','Machop',
    'Seedot','Lotad','Vanillite','Bounsweet','Zubat','Gastly','Abra','Magnemite','Ralts',
    'Torchic','Spheal','Piplup','Froakie','Fennekin','Popplio','Pikachu','Jigglypuff',
    'Cacnea','Dwebble','Carvanha','Wailmer','Swablu','Noibat','Yamask','Timburr','Snover',
    'Chansey','Zorua','Golett','Phantump','Dratini','Gible','Larvitar','Deino','Honedge',
    'Pawniard'].map(n=>[n,3])),
  ...Object.fromEntries(['Trubbish','Igglybuff','Pichu','Cleffa','Happiny','Wimpod','Bergmite',
    'Eevee','Snorunt','Riolu'].map(n=>[n,4])),
  Magikarp:6,Munchlax:5,
  ...Object.fromEntries(['Aron','Rhyhorn','Litwick','Flabébé','Rowlet','Litten','Hatenna',
    'Impidimp','Onix','Scyther','Cosmog','Kubfu','Meltan'].map(n=>[n,2]))
});
const SECOND_STAGE_COUNTS = Object.freeze({
  ...Object.fromEntries(['Ivysaur','Wartortle','Charmeleon','Kakuna','Metapod','Poliwhirl','Machoke',
    'Nuzleaf','Lombre','Vanillish','Steenee','Jigglypuff','Pikachu','Clefairy','Chansey','Golbat'].map(n=>[n,3])),
  ...Object.fromEntries(['Haunter','Kadabra','Magneton','Kirlia','Combusken','Sealeo',
    'Prinplup','Frogadier','Braixen','Brionne','Gurdurr','Lairon','Rhydon','Lampent',
    'Floette','Dartrix','Torracat','Hattrem','Morgrem','Dragonair','Gabite','Pupitar',
    'Zweilous','Doublade','Bisharp','Cosmoem'].map(n=>[n,2]))
});
const PATHS = Object.fromEntries(Object.entries(EVOLUTION_PATHS).map(([name,path]) =>
  [name,path.replace('Eeveelution',EEVEELUTIONS)
    .replace('Urshifu','Urshifu (Decisivo)|Urshifu (Fluido)').split(',').map(step => step.split('|'))]));
const derived = [...starterEvolutions];
const allByName = new Map([...SHOP_POKEMON,...derived].map(p=>[p.name,p]));
for(const [origin,steps] of Object.entries(PATHS)) {
  let predecessor=allByName.get(origin);
  if(!predecessor)continue;
  for(let step=0;step<steps.length;step++) {
    const branch=steps[step];
    for(const name of branch) {
      if(!allByName.has(name)) {
        const number=EVOLUTION_NUMBERS[name];
        if(!number)continue;
        const id=String(number).padStart(4,'0')+(name==='Urshifu (Decisivo)'?'-dec':name==='Urshifu (Fluido)'?'-flu':'');
        const baseStats=Object.fromEntries(Object.entries(predecessor.stats).map(([key,value]) =>
          [key,Math.max(1,Math.round(value * (step===0?1.28:1.38)))]));
        const evolved={...make([number,name,predecessor.rarity,
          [baseStats.vida,baseStats.atk,baseStats.def,baseStats.spa,baseStats.spd,baseStats.vel],
          (EVOLUTION_TYPES[name]||predecessor.types).map(type=>TYPE_NAMES.indexOf(type))]),
          id,group:origin,stage:Math.min(3,predecessor.stage+1),
          collisionRadius:Math.min(3,predecessor.stage+1)===3?23:19,
          buyable:false,estimatedStats:true};
        derived.push(evolved);
        allByName.set(name,evolved);
      }
    }
    predecessor=allByName.get(branch[0])||predecessor;
  }
}
export const POKEMON=[...SHOP_POKEMON,...derived];
export const BY_ID=Object.fromEntries(POKEMON.map(p=>[p.id,p]));
export const SHOP_IDS=SHOP_POKEMON.map(p=>p.id);
export const STARTER_SHOP_IDS=Object.freeze(['0001','0004','0007']);
export const EVOLUTION_OPTIONS=Object.freeze(Object.fromEntries(Object.entries(PATHS).flatMap(([origin,steps])=>{
  const names=[origin,...steps.slice(0,-1).map(s=>s[0])];
  return names.map((name,index)=>[allByName.get(name)?.id,steps[index].map(n=>allByName.get(n)?.id).filter(Boolean)])
    .filter(([id,options])=>id&&options.length);
})));
export const FUSION_COSTS=Object.freeze(Object.fromEntries([
  ...Object.entries(FIRST_STAGE_COUNTS),...Object.entries(SECOND_STAGE_COUNTS)
].map(([name,count])=>[allByName.get(name)?.id,count]).filter(([id])=>id)));
export const EVOLVES_TO=Object.freeze(Object.fromEntries(Object.entries(EVOLUTION_OPTIONS)
  .filter(([,options])=>options.length===1).map(([id,options])=>[id,options[0]])));
// Endereços são metadados opcionais; não são consultados em partidas locais.
export const artworkUrl = p => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.number}.png`;
export const spritePath = (p, animation) => `${p.id}/${animation}-Anim.png`;
export const spriteUrl = (p, animation) => `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${spritePath(p,animation)}`;

// PMD sheet directions: S=0, SE=1, E=2, NE=3, N=4, NW=5, W=6, SW=7.
export function getDirection(dx,dy) {
  if (dx === 0 && dy === 0) return 0;
  return Math.round((Math.atan2(dx,dy)/(Math.PI/4)+8))%8;
}
export function getFrame(durations, seconds, loop=true) {
  if (!durations?.length) return 0;
  const total=durations.reduce((a,b)=>a+b,0);
  let ticks=Math.max(0,Math.floor(seconds*60));
  ticks=loop ? ticks % total : Math.min(ticks,total-1);
  for(let i=0;i<durations.length;i++){if(ticks<durations[i])return i;ticks-=durations[i];}
  return durations.length-1;
}
export function applySpriteManifest(manifest){
  for (const p of POKEMON) {
    const entries=manifest?.pokemon?.[p.id];
    if (entries && Object.keys(entries).length) {
      p.sprites={...p.sprites,...entries};
      p.spriteAvailable=true;
    }
  }
}
