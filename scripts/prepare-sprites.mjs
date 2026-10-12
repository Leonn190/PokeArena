import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {POKEMON,spritePath,spriteUrl} from '../server/game/pokemon.mjs';
import {animationCandidates} from '../server/game/moves.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'public','sprites');
const defaultAnims=['Idle','Walk','Attack','Hurt'];
const wanted=[...new Set([...defaultAnims,...animationCandidates()])];
const manifest={version:3,pokemon:{}};
const errors=[];
const tag=(block,name)=>block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`))?.[1]?.trim();
const readCached=async(file)=>{try{return await fs.readFile(file,'utf8')}catch{return null}};
function parseXML(xml){
  const all={};
  for(const [,block] of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)){
    const name=tag(block,'Name');if(!name)continue;
    all[name]={copyOf:tag(block,'CopyOf')||undefined,width:Number(tag(block,'FrameWidth')),height:Number(tag(block,'FrameHeight')),durations:[...(tag(block,'Durations')||'').matchAll(/<Duration>(\d+)<\/Duration>/g)].map(m=>Number(m[1])),hitFrame:tag(block,'HitFrame')===undefined?undefined:Number(tag(block,'HitFrame'))};
  }
  function expand(name,visiting=new Set()){
    const item=all[name];if(!item||visiting.has(name))return null;
    if(!item.copyOf)return item.width&&item.height&&item.durations.length?{...item,asset:name}:null;
    visiting.add(name);const target=expand(item.copyOf,visiting);
    return target?{...target,asset:target.asset}:null;
  }
  const result={};for(const name of wanted){const info=expand(name);if(info)result[name]=info;}
  return result;
}
async function download(url,filename){
  try{
    const existing=await fs.readFile(filename);
    if(existing.length>100&&existing.subarray(0,8).toString('hex')==='89504e470d0a1a0a')return true;
  }catch{}
  for(let attempt=0;attempt<2;attempt++){
    try{
      const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{'User-Agent':'PokemonArena-v3-fanproject'}});
      if(!r.ok)throw Error('HTTP '+r.status);
      const buf=Buffer.from(await r.arrayBuffer());
      if(buf.length<100||buf.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error('PNG inválido');
      await fs.mkdir(path.dirname(filename),{recursive:true});await fs.writeFile(filename,buf);return true;
    }catch(e){if(attempt===1)return false;}
  }
  return false;
}
await fs.mkdir(output,{recursive:true});
// Evita minutos de espera quando o computador está sem acesso ao GitHub.
const cachedXML=await readCached(path.join(output,'0001','AnimData.xml'));
if(!cachedXML){
  try{
    const probe=await fetch('https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/0001/AnimData.xml',{signal:AbortSignal.timeout(6000)});
    if(!probe.ok)throw Error('HTTP '+probe.status);
    const xml=await probe.text();
    await fs.mkdir(path.join(output,'0001'),{recursive:true});
    await fs.writeFile(path.join(output,'0001','AnimData.xml'),xml);
  }catch(error){
    if(process.env.CI)throw Error('Sem acesso ao repositório PMDCollab no build: '+error.message);
    console.warn('Sem acesso aos sprites PMDCollab. O jogo funciona com desenhos alternativos, mas os PNGs exigem internet.');
    for(const pokemon of POKEMON)manifest.pokemon[pokemon.id]=Object.fromEntries(Object.entries(pokemon.sprites).map(([a,info])=>[a,{...info,asset:a}]));
    await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
    process.exit(0);
  }
}
for(const pokemon of POKEMON){
  const xmlFile=path.join(output,pokemon.id,'AnimData.xml');
  let xml=await readCached(xmlFile);
  if(!xml){
    try{const r=await fetch(`https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/${pokemon.id}/AnimData.xml`,{signal:AbortSignal.timeout(13000)});
      if(!r.ok)throw Error('HTTP '+r.status);
      xml=await r.text();await fs.mkdir(path.dirname(xmlFile),{recursive:true});await fs.writeFile(xmlFile,xml);
    }catch(e){console.warn(`XML ${pokemon.name} indisponível, usando metadados base: ${e.message}`);}
  }
  let meta=xml?parseXML(xml):{};
  if(!Object.keys(meta).length){meta=Object.fromEntries(Object.entries(pokemon.sprites).map(([a,v])=>[a,{...v,asset:a}]));}
  // Primeiro baixa as animações usadas; aliases CopyOf reutilizam o PNG de origem.
  const assets=[...new Set(Object.values(meta).map(x=>x.asset))];
  const available=new Set();
  for(let i=0;i<assets.length;i+=5){
    await Promise.all(assets.slice(i,i+5).map(async action=>{
      const filename=path.join(output,spritePath(pokemon,action));
      const ok=await download(spriteUrl(pokemon,action),filename);
      if(ok)available.add(action);
      else if(defaultAnims.includes(action))errors.push(`${pokemon.name}/${action}`);
    }));
  }
  meta=Object.fromEntries(Object.entries(meta).filter(([name,v])=>available.has(v.asset)));
  manifest.pokemon[pokemon.id]=meta;
  console.log(`${pokemon.name}: ${Object.keys(meta).length} animações compatíveis, ${available.size} PNGs`);
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
if(errors.length){console.warn('Animações básicas ausentes: '+errors.join(', '));if(process.env.CI)throw Error('Falha ao preparar os PNGs essenciais.');}
console.log('Manifesto de animações salvo em public/sprites/manifest.json');
