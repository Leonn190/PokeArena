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
    if (images.has(key) || loading.has(key) || missing.has(key)) return;
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
    // Somente os iniciais do simulador; demais espécies entram no cache sob demanda.
    for(const p of POKEMON.filter(p => ['0001','0004','0007'].includes(p.id))) warmPokemon(p);
    onLoaded();
  }
  function getImageMeta(p, stateName) {
    const meta = p.sprites[stateName] || p.sprites.Idle;
    if (!p.sprites[stateName]) void loadImage(p,'Idle');
    const action = meta?.asset || stateName;
    const image = images.get(`${p.id}:${action}`) || images.get(`${p.id}:Idle`);
    if(!image) void loadImage(p,action);
    return {image,meta};
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
