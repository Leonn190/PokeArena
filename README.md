# Pokémon Arena — protótipo Astro

Um duelo **totalmente automático** de Mega Lucario contra Mega Gengar. Dois Pokémon entram na arena distantes, andam um até o outro, param a certa distância e começam a disparar projéteis. A vida vai caindo até um vencer. Tem botão de reiniciar.

## Publicar no GitHub Pages (sem usar terminal)

1. **Extraia este ZIP** no computador. Não envie o `.zip` fechado ao GitHub.
2. No GitHub, crie um repositório novo, por exemplo `Pokemon-Arena`, com visibilidade **Public**.
3. No repositório, clique em **Add file > Upload files** e envie **todos os arquivos e pastas extraídos**, incluindo `.github`, `src`, `scripts`, `tests`, `public`, `package.json` e `astro.config.mjs`.
   - Atenção: garanta que a pasta oculta `.github/workflows/deploy.yml` seja enviada; caso seu sistema oculte arquivos/pastas, ative a visualização de itens ocultos.
   - Os arquivos devem ficar **na raiz do repositório**, não dentro de uma pasta `pokemon-arena-astro`.
4. Faça o commit direto na branch **main**.
5. Em **Settings > Pages**, defina **Build and deployment > Source: GitHub Actions**.
6. Acesse a aba **Actions** e aguarde o workflow `Publicar Arena no GitHub Pages` ficar verde. Se mudar a configuracao Pages depois do primeiro envio, clique em **Run workflow** ou faça novo commit.
7. Abra `https://SEU_USUARIO.github.io/Pokemon-Arena/` (respeitando maiúsculas/minúsculas do nome do repositório).

**Não é necessário editar caminhos:** o `astro.config.mjs` detecta automaticamente o nome do seu repositório no GitHub Actions.

> Se o GitHub não aceitar o upload da pasta `.github` pela interface, crie o arquivo `.github/workflows/deploy.yml` pelo editor web do GitHub (Add file > Create new file, digitando o caminho completo) e copie o conteúdo do ZIP.

## Rodar no computador

Requisitos: Node.js 20 ou mais novo.

```bash
npm install
npm run dev
```

Abra `http://localhost:4321/`. Para gerar os arquivos estáticos, rode:

```bash
npm run build
```

## Como funciona

- **Astro** gera o site estático.
- **JavaScript + Canvas 2D** cuidam da movimentação, colisão dos projéteis, animações e vida dos combatentes.
- O jogo inicia sozinho. Não precisa de conta, banco de dados, API ou backend.
- Os PNGs das animações `Idle`, `Walk`, `Attack` e `Hurt` são baixados do projeto SpriteCollab durante `npm run build`/`npm run dev`, para `public/sprites`. Assim, quando o GitHub Pages publica a pasta `dist`, as imagens estão dentro do site.
- Caso alguma imagem não seja baixada na etapa de preparação, o navegador tenta o caminho original no repositório SpriteCollab. O combate também tem um fallback visual simples se nem isso funcionar.
- Os metadados de tamanho e duração dos frames vieram dos `AnimData.xml` de cada forma. Os arquivos ficam divididos em linhas (direções) e colunas (frames).

### Mudar ou adicionar Pokémon

Veja `src/scripts/fighters.mjs`: ali estão nomes, velocidade, dano, IDs do SpriteCollab e metadados de animação. A lógica principal fica em `src/scripts/battle.mjs` e a apresentação em `src/scripts/arena.js`. Este primeiro protótipo usa exatamente **dois Pokémon**; mais personagens exigem adaptar o HUD e a lógica.

### Testes

```bash
npm test
```

## Créditos e utilização

As animações de Mega Lucario e Mega Gengar são do projeto [PMD Sprite Repository / SpriteCollab](https://sprites.pmdcollab.org/) e seus artistas/colaboradores. Consulte os créditos por Pokémon no site do projeto. Os recursos são destinados a usos **não comerciais e com atribuição** conforme política do SpriteCollab; Pokémon pertence aos seus respectivos titulares. Este protótipo não é afiliado a Nintendo, Creatures, GAME FREAK ou The Pokémon Company.

Fontes:
- https://github.com/PMDCollab/SpriteCollab
- https://github.com/PMDCollab/SpriteCollab/blob/master/LICENSE.md
- https://wiki.pmdo.pmdcollab.org/PMD_Sprite_Format
