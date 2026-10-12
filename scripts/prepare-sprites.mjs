import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { POKEMON, spritePath, spriteUrl } from '../src/scripts/pokemon.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public', 'sprites');
const actions = ['Idle','Walk','Attack','Hurt'];
const requests = POKEMON.flatMap(p => actions.map(action => ({p,action})));
let successful = 0;
let missing = [];
async function loadOne({p,action}) {
  const target = path.join(output,spritePath(p,action));
  await fs.mkdir(path.dirname(target),{recursive:true});
  try {
    const file = await fs.readFile(target);
    if(file.length>100 && file.subarray(0,8).toString('hex')==='89504e470d0a1a0a') { successful++;return; }
  }catch{}
  for(let attempt=0;attempt<3;attempt++) {
    try {
      const response=await fetch(spriteUrl(p,action),{signal:AbortSignal.timeout(18000),headers:{'User-Agent':'PokemonArenaDemo/0.2'}});
      if(!response.ok)throw Error('HTTP '+response.status);
      const buff=Buffer.from(await response.arrayBuffer());
      if(buff.length<100||buff.subarray(0,8).toString('hex')!=='89504e470d0a1a0a') throw Error('arquivo PNG invalido');
      await fs.writeFile(target,buff);
      successful++; console.log(`✓ ${p.name} ${action}`);return;
    }catch(error){ if(attempt===2) console.warn(`! Falha ao baixar ${p.name}/${action}: ${error.message}`); }
  }
  missing.push(`${p.name}/${action}`);
}
for (let i=0;i<requests.length;i+=4) await Promise.all(requests.slice(i,i+4).map(loadOne));
console.log(`Sprites: ${successful}/${requests.length}`);
// Ao rodar offline, ainda é possível abrir um preview com representações substitutas.
// No GitHub Actions, a falha dos sprites deve interromper a publicação, em vez de gerar site quebrado.
if(missing.length&&process.env.CI)throw Error('Sprites ausentes: '+missing.join(', '));
