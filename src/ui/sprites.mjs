import { POKEMON, applySpriteManifest, spritePath } from '../../server/game/pokemon.mjs';
import { TAU } from '../../server/game/battle.mjs';

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
    // desses três Pokémon usa uma folha limpa, sem mudar seu ataque real.
    const visualAction=cleanOnly.has(p.id)&&!['Idle','Walk','Hurt'].includes(stateName)
      ? (p.sprites.Walk?'Walk':'Idle') : stateName;
    const desired=p.sprites[visualAction] || p.sprites.Idle;
    const action=desired?.asset || visualAction;
    const image=images.get(`${p.id}:${action}`);
    if(!image&&p.spriteAvailable)void loadImage(p,action);
    if(image)return {image,meta:desired};
    // Nunca combinar imagem Idle com dimensões/durações de Attack/Walk/Shoot:
    // isso fazia um quadro cortar frames adjacentes, criando sprites "extras".
    const idle=p.sprites.Idle;
    const idleImage=images.get(`${p.id}:${idle?.asset||'Idle'}`);
    if(!idleImage&&p.spriteAvailable)void loadImage(p,idle?.asset||'Idle');
    return {image:idleImage||null,meta:idle};
  }
  function drawSmallSprite(dest, p, direction = 0) {
    if(!dest||!p) return;
    const context = dest.getContext('2d');
    context.clearRect(0,0,dest.width,dest.height);
    const {image,meta}=getImageMeta(p,'Idle');
    if(image?.naturalWidth && meta) {
      const scale=Math.min((dest.width-4)/meta.width,(dest.height-4)/meta.height);
      const dirs=Math.floor(image.naturalHeight/meta.height);
      context.imageSmoothingEnabled=false;
      context.drawImage(image,0,(dirs===8?direction:0)*meta.height,meta.width,meta.height,(dest.width-meta.width*scale)/2,(dest.height-meta.height*scale)/2,meta.width*scale,meta.height*scale);
    } else {
      context.fillStyle=p.color;
      context.beginPath();
      context.ellipse(dest.width/2,dest.height/2,dest.width*.25,dest.height*.28,0,0,TAU);
      context.fill();
      context.fillStyle='#18331e';
      context.font='bold 12px sans-serif';
      context.textAlign='center';
      context.textBaseline='middle';
      context.fillText(p.name.slice(0,2).toUpperCase(),dest.width/2,dest.height/2);
    }
  }
  return {prepareSprites,getImageMeta,drawSmallSprite,warmPokemon};
}
