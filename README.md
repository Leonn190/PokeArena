# Pokémon Arena — Kanto Auto Battle (v0.2)

Protótipo **Astro + JavaScript + Canvas 2D** de auto-battle 3 contra 3, totalmente visto de cima. Dois tabuleiros de 8×4 quadrados (azul em cima, vermelho embaixo) se unem em um de 8×8 no início da luta. Não há servidor nem banco de dados.

## O que existe na v0.2

- **Nove Pokémon de Kanto disponíveis:** Bulbasaur, Ivysaur, Venusaur, Charmander, Charmeleon, Charizard, Squirtle, Wartortle e Blastoise.
- **Dois times, com até três Pokémon em cada**, selecionados e posicionados nos quadrados das respectivas metades.
- **Autoplay:** a luta começa sozinha após alguns segundos se você não interagir; ou clique **COMEÇAR AGORA**. A tela de preparação permite trocar posições/escolher espécies.
- **Seis atributos para cada espécie:** VIDA, ATK, SPA, DEF, SPD, VEL. São os stats base da espécie (sem IVs, EVs nem níveis). HP de batalha = `60 + 2 × VIDA`.
- **Combate:** deslocamento aleatório guiado por proximidade de adversários, tiro de projéteis, ataque físico usando ATK contra DEF, ou ataque especial usando SPA contra SPD. VEL modifica ritmo de movimento e ataques. A luta termina quando todos os Pokémon de um dos times forem derrotados.
- **Sprites PMD:** arquivos de Idle, Walk, Attack e Hurt separados por Pokémon; 8 orientações incluindo cima/baixo/esquerda/direita. A orientação correta no formato PMD é **2 = esquerda** e **6 = direita**.
- Barra de HP por lutador, vencedor, log e tela de ficha dos atributos.
- **SORTEAR EQUIPES** cria dois times aleatórios sem repetir Pokémon entre eles; **PREPARAR** volta para edição.

### Como montar equipes

1. Na lateral, escolha **AZUL** (cima) ou **VERMELHO** (baixo).
2. Clique em qualquer um dos nove Pokémon para selecioná-lo.
3. Clique no quadrado da sua metade onde deseja colocá-lo. Um quadrado ocupado é substituído se você escolher outra espécie.
4. Para remover, clique novamente no Pokémon do mesmo quadrado, ou use botão direito nele. Para mover um Pokémon existente, escolha-o e clique em outro quadrado da mesma metade.
5. Para lutar, clique em **COMEÇAR AGORA**. Se não fizer nada, uma batalha de demonstração começa automaticamente em ~3,6 segundos.

Máximo de 3 por equipe. Uma espécie não pode se repetir **dentro do mesmo time**; na opção de sorteio, também não se repete entre os times.

## Publicar no GitHub Pages (sem instalar nada)

1. **Extraia este ZIP.** No GitHub crie um repositório público, por exemplo `Pokemon-Arena`.
2. Envie **todos os arquivos e pastas extraídos diretamente na raiz do repositório** usando **Add file > Upload files**. Inclua `.github/workflows/deploy.yml` (a pasta `.github` pode estar oculta no Windows).
3. Faça o commit na branch **main**.
4. Em **Settings > Pages > Build and deployment**, selecione **Source: GitHub Actions**.
5. Na aba **Actions** aguarde a execução do workflow **Publicar Arena no GitHub Pages**. Se for a primeira configuração de Pages e a execução anterior falhou, clique em **Run workflow** para executar novamente.
6. Abra `https://SEU_USUARIO.github.io/NOME_DO_REPOSITORIO/`.

**A configuração Astro ajusta automaticamente `base`** no GitHub Actions, mesmo em repositórios com outros nomes. Se seu repositório for `seuusuario.github.io`, a página será publicada na raiz.

O workflow usa **Node 22**, instala o Astro, baixa os PNGs do PMDCollab para `public/sprites/` e publica a pasta `dist/` no Pages. Os sprites passam a ser servidos como arquivos locais no site publicado. Os PNGs não foram incluídos no ZIP para não duplicar o acervo de terceiros; por isso, o build precisa de conexão com o GitHub na primeira instalação. Se os sprites não puderem ser baixados, o GitHub Actions falha visivelmente em vez de publicar arquivos incompletos.

## Rodar no computador

Instale **Node.js 20+** e execute:

```bash
npm install
npm run dev
```

Abra `http://localhost:4321/`.

```bash
npm run build     # Gera o site estático na pasta dist
npm run preview   # Abre o site compilado
npm test          # Executa testes de lógica
```

Se o download dos PNGs falhar localmente, o jogo usa placeholders simples ou tenta os URLs remotos. O combate funciona mesmo sem os sprites; porém, no GitHub Actions, o deploy exige que estejam presentes.

## Estrutura

```text
src/pages/index.astro       Interface Astro
src/styles/global.css       Estilo e responsividade
src/scripts/pokemon.mjs     Elenco, seis atributos, direção PMD, metadados de sprites
src/scripts/battle.mjs      Regras do tabuleiro e simulador de combate
src/scripts/arena.js        Renderização Canvas 2D e interação
scripts/prepare-sprites.mjs Download dos PNGs oficiais/comunitários PMD
.github/workflows/deploy.yml Deploy automático pelo GitHub Actions
tests/battle.test.mjs       Testes de regras e animações
astro.config.mjs            Ajuste automático de URL/base de GitHub Pages
```

## Limitações atuais

É um protótipo de combate, não o sistema inteiro do TFT: não há tipos, vantagens elementais, habilidades, itens, custo de unidades, ouro, estrelas, experiência, sinergias, som ou multiplayer. As decisões de movimentação e ataque são aleatórias com preferência por inimigos próximos; elas não fazem planejamento estratégico avançado. Não há seleção manual do alvo durante o combate.

## Créditos / direitos

Sprites do [PMD Sprite Repository / SpriteCollab](https://sprites.pmdcollab.org/) e seus artistas. Confira a atribuição dos artistas de cada espécie e a política de uso do projeto antes de publicar. Sprites criados pelos artistas não são automaticamente de uso livre: o SpriteCollab usa condições de atribuição e **uso não comercial**. Pokémon e seus personagens pertencem aos respectivos titulares; este é um protótipo **não comercial**, não oficial nem afiliado à Nintendo, GAME FREAK, Creatures ou The Pokémon Company.

- Repositório: https://github.com/PMDCollab/SpriteCollab
- Licença/termos: https://github.com/PMDCollab/SpriteCollab/blob/master/LICENSE.md
- Site: https://sprites.pmdcollab.org/
