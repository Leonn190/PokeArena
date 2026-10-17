import { POKEMON, applySpriteManifest, spritePath } from '../../server/game/pokemon.mjs';

// Cache e demanda por sprites são assuntos de apresentação, não de regras.
export function createSpriteCache(base, onImageReady = () => {}) {
  const images = new Map();
  const loading = new Set();
  const missing = new Set();
  let manifestReady = false;

  async function loadImage(p, action) {
    const key = `${p.id}:${action}`;
    if (!p.spriteAvailable || images.has(key) || loading.has(key) || missing.has(key)) return;
    loading.add(key);
    const image = new Image();
    image.decoding = 'async';
    await new Promise(resolve => {
      image.onload = () => { images.set(key,image); if (action === 'Idle') onImageReady(); resolve(); };
      // Etapas offline: usar somente sprites presentes em public/sprites/.
      image.onerror = () => { missing.add(key); resolve(); };
      image.src = `${base}sprites/${spritePath(p,action)}`;
    });
    loading.delete(key);
  }
  function warmPokemon(p) {
    if (!p) return;
    for (const action of new Set(Object.values(p.sprites).map(meta => meta.asset).filter(Boolean))) {
      void loadImage(p,action);
    }
  }
  async function prepareSprites(onLoaded = () => {}) {
    if (!manifestReady) {
      try {
        const response = await fetch(`${base}sprites/manifest.json`);
        if(response.ok) applySpriteManifest(await response.json());
      } catch { /* Offline: metadados padrão ainda funcionam. */ }
      manifestReady = true;
    }
    // Os PNGs locais existem apenas para uma parte do catálogo.
    for(const p of POKEMON.filter(p => ['0001','0004','0007'].includes(p.id))) warmPokemon(p);
    onLoaded();
  }
  const cleanOnly=new Set(['0702','0131','0582']);
  function getImageMeta(p, stateName) {
    // Certas folhas de golpes incluem efeitos em redor da criatura. O visual
    // desses três Pokémon usa uma folha limpa para outras habilidades;
    // Attack/Shoot respeitam a escolha obrigatória do regular por alcance.
    const visualAction=cleanOnly.has(p.id)&&!['Idle','Walk','Hurt','Sleep','Attack','Shoot'].includes(stateName)
      ? (p.sprites.Walk?'Walk':'Idle') : stateName;
    const desired=p.sprites[visualAction] || p.sprites.Idle;
    const action=desired?.asset || visualAction;
    const image=images.get(`${p.id}:${action}`);
    if(!image&&p.spriteAvailable)void loadImage(p,action);
    if(image)return {image,meta:desired};
    // A família Bulbasaur usa Attack se a folha da habilidade não carregar.
    if(['0001','0002','0003'].includes(p.id)&&!['Idle','Walk','Hurt','Sleep'].includes(visualAction)&&p.sprites.Attack){
      const fallback=p.sprites.Attack,asset=fallback.asset||'Attack';
      const attackImage=images.get(`${p.id}:${asset}`);
      if(attackImage)return {image:attackImage,meta:fallback};
      if(p.spriteAvailable)void loadImage(p,asset);
    }
    // Nunca combinar imagem Idle com dimensões/durações de Attack/Walk/Shoot:
    // isso fazia um quadro cortar frames adjacentes, criando sprites "extras".
    const idle=p.sprites.Idle;
    const idleImage=images.get(`${p.id}:${idle?.asset||'Idle'}`);
    if(!idleImage&&p.spriteAvailable)void loadImage(p,idle?.asset||'Idle');
    return {image:idleImage||null,meta:idle};
  }
  const portraits=new Map();
  const portraitTargets=new Map();
  function drawPortrait(dest,p) {
    if(!dest||!p)return;
    const context=dest.getContext('2d');
    context.clearRect(0,0,dest.width,dest.height);
    let image=portraits.get(p.id);
    if(!image){
      image=new Image();
      portraits.set(p.id,image);
      image.onload=()=>{
        for(const target of portraitTargets.get(p.id)||[]){
          if(target.isConnected&&target.dataset.portraitId===p.id)drawPortrait(target,p);
        }
      };
      image.src=`${base}portraits/${p.id}.png`;
    }
    dest.dataset.portraitId=p.id;
    const targets=portraitTargets.get(p.id)||new Set();
    for(const target of targets)if(!target.isConnected)targets.delete(target);
    targets.add(dest);portraitTargets.set(p.id,targets);
    if(image.naturalWidth){
      const width=image.naturalWidth,height=image.naturalHeight;
      const scale=Math.min(dest.width/width,dest.height/height);
      context.imageSmoothingEnabled=false;
      context.drawImage(image,(dest.width-width*scale)/2,(dest.height-height*scale)/2,width*scale,height*scale);
    }
  }
  return {prepareSprites,getImageMeta,drawPortrait,warmPokemon};
}
