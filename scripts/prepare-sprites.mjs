// Build Astro inteiramente local: lê XML/PNGs já presentes em public/sprites.
// A inclusão de novas espécies no catálogo NÃO dispara downloads de 100 pastas.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {POKEMON,spritePath} from '../server/game/pokemon.mjs';
import {animationCandidates} from '../server/game/moves.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'public','sprites');
const wanted=[...new Set(['Idle','Walk','Attack','Hurt',...animationCandidates()])];
const manifest={version:3,pokemon:{}};
const tag=(block,name)=>block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`))?.[1]?.trim();
const readText=async file=>fs.readFile(file,'utf8').catch(()=>null);
const isFile=async file=>fs.stat(file).then(s=>s.isFile()&&s.size>100).catch(()=>false);

function parseXML(xml) {
  const all={};
  for(const [,block] of xml.matchAll(/<Anim>([\s\S]*?)<\/Anim>/g)) {
    const name=tag(block,'Name');
    if (!name) continue;
    all[name]={
      copyOf:tag(block,'CopyOf')||null,
      width:Number(tag(block,'FrameWidth')),
      height:Number(tag(block,'FrameHeight')),
      durations:[...(tag(block,'Durations')||'').matchAll(/<Duration>(\d+)<\/Duration>/g)].map(m=>Number(m[1])),
      hitFrame:Number(tag(block,'HitFrame')||0)
    };
  }
  function resolve(name,seen=new Set()) {
    const entry=all[name];
    if(!entry||seen.has(name))return null;
    if(!entry.copyOf)return entry.width&&entry.height&&entry.durations.length?{...entry,asset:name}:null;
    seen.add(name);
    return resolve(entry.copyOf,seen);
  }
  return Object.fromEntries(wanted.map(name=>[name,resolve(name)]).filter(([,v])=>v));
}

for (const p of POKEMON) {
  const xml=await readText(path.join(output,p.id,'AnimData.xml'));
  if (!p.spriteAvailable && !xml && !(await isFile(path.join(output,spritePath(p,'Idle'))))) continue;
  const parsed=xml?parseXML(xml):{};
  const metadata=Object.keys(parsed).length?parsed:p.sprites;
  const existing={};
  for (const [action,info] of Object.entries(metadata)) {
    if(!wanted.includes(action))continue;
    if(await isFile(path.join(output,spritePath(p,info.asset||action)))) {
      existing[action]={...info,asset:info.asset||action};
    }
  }
  if(Object.keys(existing).length)manifest.pokemon[p.id]=existing;
}
await fs.writeFile(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));
console.log(`Sprites locais catalogados: ${Object.keys(manifest.pokemon).length} Pokémon.`);
