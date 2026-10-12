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
const mk = (id, name, group, type, color, hp, atk, spa, def, spd, vel) => ({
  id, number: Number(id), name, group, type, color,
  price: ['0001','0004','0007'].includes(id) ? 3 : ['0002','0005','0008'].includes(id) ? 5 : 8,
  stage: ['0001','0004','0007'].includes(id) ? 1 : ['0002','0005','0008'].includes(id) ? 2 : 3,
  stats: {vida:hp, atk, spa, def, spd, vel},
  sprites: Object.fromEntries(Object.entries(SPRITES[id]).map(([key,[width,height,durations]]) => [key,{width,height,durations,hitFrame:Math.floor(durations.length*.55),asset:key}]))
});
export const POKEMON = [
  mk('0001','Bulbasaur','Bulbasaur','Grama','#75d8a9',45,49,65,49,65,45),
  mk('0002','Ivysaur','Bulbasaur','Grama','#75d8a9',60,62,80,63,80,60),
  mk('0003','Venusaur','Bulbasaur','Grama','#75d8a9',80,82,100,83,100,80),
  mk('0004','Charmander','Charmander','Fogo','#ffa56f',39,52,60,43,50,65),
  mk('0005','Charmeleon','Charmander','Fogo','#ffa56f',58,64,80,58,65,80),
  mk('0006','Charizard','Charmander','Fogo','#ffa56f',78,84,109,78,85,100),
  mk('0007','Squirtle','Squirtle','Água','#83c7ff',44,48,50,65,64,43),
  mk('0008','Wartortle','Squirtle','Água','#83c7ff',59,63,65,80,80,58),
  mk('0009','Blastoise','Squirtle','Água','#83c7ff',79,83,85,100,105,78)
];
export const BY_ID = Object.fromEntries(POKEMON.map(p => [p.id, p]));
export const SHOP_IDS = ['0001','0004','0007'];
export const EVOLVES_TO = Object.freeze({
  '0001':'0002', '0002':'0003',
  '0004':'0005', '0005':'0006',
  '0007':'0008', '0008':'0009'
});
// Ilustrações oficiais em vez dos sprites PMD: CDN da PokéAPI.
// Não é necessário consultar a API a cada atualização de loja; a URL é estável.
export const artworkUrl = p => `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${p.number}.png`;
export const spritePath = (p, animation) => `${p.id}/${animation}-Anim.png`;
export const spriteUrl = (p, animation) => `https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${spritePath(p,animation)}`;

// PMD sheet directions: S=0, SE=1, E=2, NE=3, N=4, NW=5, W=6, SW=7.
export function getDirection(dx,dy) {
  if (dx === 0 && dy === 0) return 0;
  return Math.round((Math.atan2(dx, dy) / (Math.PI / 4) + 8)) % 8;
}
export function getFrame(durations, seconds, loop=true) {
  if (!durations?.length) return 0;
  const total = durations.reduce((a,b)=>a+b,0);
  let ticks = Math.max(0,Math.floor(seconds*60));
  ticks = loop ? ticks % total : Math.min(ticks,total-1);
  for(let i=0;i<durations.length;i++) { if (ticks<durations[i])return i; ticks-=durations[i]; }
  return durations.length-1;
}

// A construção do jogo lê AnimData.xml de cada espécie, e o cliente mescla os
// metadados verificados e aliases CopyOf no carregamento dos sprites.
export function applySpriteManifest(manifest){
  for(const p of POKEMON){
    const anims=manifest?.pokemon?.[p.id];
    if(anims&&Object.keys(anims).length)p.sprites={...p.sprites,...anims};
  }
}
