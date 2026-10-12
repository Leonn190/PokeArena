import { defineConfig } from 'astro/config';

const [owner = 'leonn190', repository = 'PokeArena'] = (process.env.GITHUB_REPOSITORY || '').split('/');
const projectPage = owner && repository && repository.toLowerCase() !== `${owner.toLowerCase()}.github.io`;
const base = projectPage ? `/${repository}/` : '/';

export default defineConfig({
  site: `https://${owner}.github.io`,
  base,
  output: 'static',
});
