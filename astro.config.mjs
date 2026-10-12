import { defineConfig } from 'astro/config';

// Detecta automaticamente usuario/repositorio no GitHub Actions.
// Localmente o projeto roda na raiz (http://localhost:4321/).
const [owner = '', repository = ''] = (process.env.GITHUB_REPOSITORY || '').split('/');
const projectPage = owner && repository && repository.toLowerCase() !== `${owner.toLowerCase()}.github.io`;
const base = projectPage ? `/${repository}/` : '/';

export default defineConfig({
  site: owner ? `https://${owner}.github.io` : 'http://localhost:4321',
  base,
  output: 'static',
});
