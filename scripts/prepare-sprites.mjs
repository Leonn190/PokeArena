import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIGHTERS, spriteFile, originalSpriteUrl } from '../src/scripts/fighters.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'public', 'sprites');
const states = ['Idle', 'Walk', 'Attack', 'Hurt'];
const files = FIGHTERS.flatMap(fighter => states.map(state => ({
  fighter, state, location: path.join(output, spriteFile(fighter, state))
})));

async function download({ fighter, state, location }) {
  try {
    if ((await fs.stat(location)).size > 0) return true;
  } catch { /* Ainda nao existe */ }
  await fs.mkdir(path.dirname(location), { recursive: true });
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(originalSpriteUrl(fighter, state), {
        signal: AbortSignal.timeout(8500),
        headers: { 'User-Agent': 'PokemonArena-Demo/0.1' }
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = Buffer.from(await response.arrayBuffer());
      if (content.length < 100 || content.toString('hex', 0, 8) !== '89504e470d0a1a0a') {
        throw new Error('PNG invalido');
      }
      await fs.writeFile(location, content);
      console.log(`✓ ${fighter.name} / ${state}`);
      return true;
    } catch (error) {
      if (attempt === 2) {
        console.warn(`⚠ Nao foi possivel salvar ${fighter.name} / ${state}: ${error.message}`);
        console.warn('  O navegador tentara carregar o PNG original do SpriteCollab.');
      }
    }
  }
  return false;
}

await fs.mkdir(output, { recursive: true });
// Baixar em paralelo, mantendo um limite amigavel para o servidor.
for (let i = 0; i < files.length; i += 4) {
  await Promise.all(files.slice(i, i + 4).map(download));
}
console.log('Sprites preparados.');
