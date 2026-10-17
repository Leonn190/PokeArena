import { getFrame } from '../../server/game/pokemon.mjs';
import { TAU } from '../../server/game/battle.mjs';
const clamp = (value,low,high) => Math.max(low,Math.min(high,value));

// Animação, tamanho VISUAL e sombra nunca alteram raio de colisão ou dano.
export function createSpriteRenderer(ctx, getImageMeta) {
  const frameBounds = new Map();
  const pokemonScale = new Map();
  const sampleCanvas = document.createElement('canvas');
  const sampleCtx = sampleCanvas.getContext('2d', {willReadFrequently:true});
  function visibleFrameBounds(p, action, frame, direction) {
    const key = `${p.id}:${action}:${frame}:${direction}`;
    if(frameBounds.has(key)) return frameBounds.get(key);
    const {image,meta}=getImageMeta(p,action);
    if(!image?.naturalWidth||!meta||!meta.width||!meta.height||frame>=Math.floor(image.naturalWidth/meta.width)) return null;
    const directions=Math.floor(image.naturalHeight/meta.height);
    const dir=directions===8?direction:0;
    const w=meta.width,h=meta.height;
    sampleCanvas.width=w; sampleCanvas.height=h;
    sampleCtx.clearRect(0,0,w,h);
    sampleCtx.drawImage(image,frame*w,dir*h,w,h,0,0,w,h);
    let bounds;
    try {
      const data=sampleCtx.getImageData(0,0,w,h).data;
      let left=w,right=0,top=h,bottom=0;
      for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
        if(data[(y*w+x)*4+3]<20) continue;
        left=Math.min(left,x); right=Math.max(right,x+1);
        top=Math.min(top,y); bottom=Math.max(bottom,y+1);
      }
      bounds=bottom>top&&right>left?{left,top,right,bottom,width:right-left,height:bottom-top}:null;
    } catch {
      bounds={left:0,top:0,right:w,bottom:h-8,width:w,height:h-8};
    }
    frameBounds.set(key,bounds);
    return bounds;
  }
  function unitScale(p) {
    if(pokemonScale.has(p.id))return pokemonScale.get(p.id);
    const front=visibleFrameBounds(p,'Idle',0,0);
    const back=visibleFrameBounds(p,'Idle',0,4);
    const target=[0,43,57,72][p.stage]||43;
    if(!front&&!back)return target/22;
    const height=Math.max(front?.height??1,back?.height??1,1);
    const scale=clamp(target/height,1.05,3.7);
    pokemonScale.set(p.id,scale);
    return scale;
  }
  function groundShadow(p,x,y,highlight=null) {
    const bounds=visibleFrameBounds(p,'Idle',0,0);
    const width=(bounds?.width||18)*unitScale(p);
    const radiusX=clamp(width*.35,9,23),radiusY=clamp(radiusX*.28,3,6);
    ctx.fillStyle='rgba(12,38,22,.25)';
    ctx.beginPath(); ctx.ellipse(x,y+9,radiusX,radiusY,0,0,TAU); ctx.fill();
    if(highlight){
      ctx.save(); ctx.strokeStyle=highlight;ctx.globalAlpha=.82;ctx.lineWidth=1.65;
      ctx.beginPath();ctx.ellipse(x,y+9,radiusX+2.5,radiusY+1.7,0,0,TAU);ctx.stroke();ctx.restore();
    }
  }
  function drawUnitSprite(type,x,y,stateName,facing,stateTime,castElapsed=0,cast=null) {
    const {image,meta}=getImageMeta(type,stateName);
    if(image?.naturalWidth&&meta&&meta.width>0&&meta.height>0&&image.naturalWidth>=meta.width&&image.naturalHeight>=meta.height){
      const direction=Math.floor(image.naturalHeight/meta.height)===8?facing:0;
      const declared=getFrame(meta.durations,cast?castElapsed:stateTime,!cast&&stateName!=='Hurt');
      // Validar dimensões reais da folha: metadados incompatíveis jamais
      // recortam o frame vizinho e o exibem como outro Pokémon.
      const columns=Math.floor(image.naturalWidth/meta.width);
      const frame=clamp(declared,0,Math.max(0,columns-1));
      const bounds=visibleFrameBounds(type,stateName,frame,direction)||visibleFrameBounds(type,'Idle',0,direction);
      const scale=unitScale(type),footY=y+7;
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(image,frame*meta.width,direction*meta.height,meta.width,meta.height,
        Math.round(x-meta.width*scale/2),Math.round(footY-(bounds?.bottom??meta.height)*scale),
        Math.round(meta.width*scale),Math.round(meta.height*scale));
      ctx.imageSmoothingEnabled=true;
    } else {
      ctx.fillStyle=type.color;ctx.beginPath();ctx.ellipse(x,y-14,18,22,0,0,TAU);ctx.fill();
      ctx.fillStyle='#17331f';ctx.font='bold 10px system-ui';ctx.textAlign='center';
      ctx.fillText(type.name.slice(0,3).toUpperCase(),x,y);
    }
  }
  return {visibleFrameBounds,unitScale,groundShadow,drawUnitSprite};
}
