import { getFrame } from '../../server/game/pokemon.mjs';
import { TAU } from '../../server/game/battle.mjs';
const clamp = (value,low,high) => Math.max(low,Math.min(high,value));

// Animação, tamanho VISUAL e sombra nunca alteram raio de colisão ou dano.
export function createSpriteRenderer(ctx, getImageMeta) {
  const frameBounds = new Map();
  const pokemonScale = new Map();
  const anchors=new Map();
  const floaters=new Set(['Gastly','Haunter','Gengar','Magnemite','Magneton','Magnezone','Mew','Mewtwo','Cosmog','Cosmoem','Lunala','Solgaleo','Flabébé','Floette']);
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
  function stableFoot(p,action,direction,meta){
    const key=`${p.id}:${action}:${direction}`;
    if(anchors.has(key))return anchors.get(key);
    // Ancorar à mediana de quadros impede saltos de 1–3 px entre estados,
    // preservando movimentos verticais naturais desenhados dentro das folhas.
    const available=Math.min(8,meta?.durations?.length||1);
    const positions=[];
    for(let i=0;i<available;i++){
      const bounds=visibleFrameBounds(p,action,i,direction);
      if(bounds)positions.push(bounds.bottom);
    }
    positions.sort((a,b)=>a-b);
    const result=positions.length?positions[Math.floor(positions.length/2)]:meta?.height||40;
    anchors.set(key,result);
    return result;
  }
  function groundShadow(p,x,y,highlight=null) {
    const bounds=visibleFrameBounds(p,'Idle',0,0);
    const width=(bounds?.width||18)*unitScale(p);
    const radiusX=clamp(width*.30,7,18),radiusY=clamp(radiusX*.24,2.4,4.5);
    ctx.fillStyle='rgba(12,38,22,.25)';
    ctx.beginPath(); ctx.ellipse(x,y+3,radiusX,radiusY,0,0,TAU); ctx.fill();
    if(highlight){
      ctx.save(); ctx.strokeStyle=highlight;ctx.globalAlpha=.82;ctx.lineWidth=1.65;
      ctx.beginPath();ctx.ellipse(x,y+3,radiusX+2.5,radiusY+1.7,0,0,TAU);ctx.stroke();ctx.restore();
    }
  }
  function drawUnitSprite(type,x,y,stateName,facing,stateTime,castElapsed=0,cast=null) {
    let shellAlpha=1;
    if(cast?.behavior==='water-spin'&&stateName===cast.animation){
      const active=castElapsed-cast.hitAt;
      shellAlpha=active<0?clamp(castElapsed/Math.max(.01,cast.hitAt),0,1)
        :active>=cast.duration?clamp(1-(active-cast.duration)/.16,0,1):1;
      if(shellAlpha<1){
        ctx.save();ctx.globalAlpha*=1-shellAlpha;
        drawUnitSprite(type,x,y,'Idle',facing,stateTime);
        ctx.restore();
      }
    }
    ctx.save();ctx.globalAlpha*=shellAlpha;
    const {image,meta}=getImageMeta(type,stateName);
    if(image?.naturalWidth&&meta&&meta.width>0&&meta.height>0&&image.naturalWidth>=meta.width&&image.naturalHeight>=meta.height){
      let direction=Math.floor(image.naturalHeight/meta.height)===8?facing:0;
      let declared=getFrame(meta.durations,cast?castElapsed:stateTime,!cast&&stateName!=='Hurt');
      const specialized=cast&&meta.asset===cast.animation;
      const active=castElapsed-(cast?.hitAt||0);
      let visualOffset=0;
      if(specialized&&cast.animation==='Withdraw'&&cast.behavior==='water-spin'){
        // Só sprite/efeitos mudam de direção; a unidade e suas barras não giram.
        if(active>=0&&active<cast.duration){
          direction=(facing+Math.floor(active*24))%8;
          declared=1+Math.floor(active*30)%Math.max(1,meta.durations.length-1);
          visualOffset=Math.sin(active*TAU*8)*1.2;
        }else declared=0;
      }
      if(specialized&&cast.animation==='Charge'&&cast.behavior==='flamethrower'&&active>=0){
        declared=active<cast.duration?5+Math.floor(active*18)%4:9;
      }
      if(specialized&&cast.animation==='Shoot'&&cast.behavior==='double-jet'&&active>=0){
        const recovery=cast.recoveryAt??cast.hitAt+cast.duration;
        declared=castElapsed<recovery?2:3+getFrame(meta.durations.slice(3),castElapsed-recovery,false);
      }
      if(specialized&&cast.animation==='Ricochet'&&cast.behavior==='ricochet'&&active>=0){
        declared=cast.recoveryAt===undefined?6+Math.floor(active*30)%4
          :10+getFrame(meta.durations.slice(10),castElapsed-cast.recoveryAt,false);
      }
      // Validar dimensões reais da folha: metadados incompatíveis jamais
      // recortam o frame vizinho e o exibem como outro Pokémon.
      const columns=Math.floor(image.naturalWidth/meta.width);
      const frame=clamp(declared,0,Math.max(0,columns-1));
      const scale=unitScale(type);
      const hover=floaters.has(type.name)?9:0;
      const footY=y+3-hover+visualOffset;
      const normalizedShell=specialized&&cast.animation==='Ricochet'&&cast.behavior==='ricochet';
      const bounds=normalizedShell?visibleFrameBounds(type,stateName,frame,direction):null;
      const anchor=bounds?.bottom??stableFoot(type,stateName,direction,meta);
      const center=bounds?(bounds.left+bounds.right)/2:meta.width/2;
      ctx.imageSmoothingEnabled=false;
      ctx.drawImage(image,frame*meta.width,direction*meta.height,meta.width,meta.height,
        Math.round(x-center*scale),Math.round(footY-anchor*scale),
        Math.round(meta.width*scale),Math.round(meta.height*scale));
      ctx.imageSmoothingEnabled=true;
    } else {
      ctx.fillStyle=type.color;ctx.beginPath();ctx.ellipse(x,y-14,18,22,0,0,TAU);ctx.fill();
      ctx.fillStyle='#17331f';ctx.font='bold 10px system-ui';ctx.textAlign='center';
      ctx.fillText(type.name.slice(0,3).toUpperCase(),x,y);
    }
    ctx.restore();
  }
  function castEmitters(unit){
    const {type,facing,x,y}=unit,cast=unit.cast;
    const action=cast?.animation||'Idle';
    const {meta}=getImageMeta(type,action),scale=unitScale(type);
    // Pontos na folha Shoot do Blastoise, frame 2, por direção PMD.
    // Aplicar a MESMA escala e âncora usadas para desenhar esse frame.
    if(cast?.behavior==='double-jet'&&meta?.asset==='Shoot'&&type.id==='0009'){
      const cannons=[[[14,26],[32,26]],[[17,24],[32,20]],[[22,22],[33,19]],[[22,16],[33,19]],
        [[14,14],[33,14]],[[15,19],[26,16]],[[15,19],[26,22]],[[16,20],[31,24]]][facing];
      const anchor=stableFoot(type,action,facing,meta);
      return cannons.map(([cx,cy])=>({x:x+(cx-meta.width/2)*scale,y:y+3+(cy-anchor)*scale}));
    }
    if(cast?.behavior==='flamethrower'&&meta?.asset==='Charge'&&type.id==='0006'){
      const mouths=[[24,21],[33,24],[38,24],[34,19],[24,14],[14,19],[10,24],[15,24]];
      const [mx,my]=mouths[facing],anchor=stableFoot(type,action,facing,meta);
      return [{x:x+(mx-meta.width/2)*scale,y:y+3+(my-anchor)*scale}];
    }
    const angle=cast?.angle||0,dx=Math.cos(angle),dy=Math.sin(angle);
    return [{x:x+dx*12,y:y-24+dy*6}];
  }
  return {visibleFrameBounds,unitScale,groundShadow,drawUnitSprite,castEmitters};
}
