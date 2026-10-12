# Pokémon Arena Kanto — V3 (protótipo 2D)

Reescrita da V2 em **Astro + Canvas 2D + JavaScript**, preservando os **nove Pokémon disponíveis no ZIP original**: Bulbasaur, Ivysaur, Venusaur, Charmander, Charmeleon, Charizard, Squirtle, Wartortle e Blastoise.

## Instalar e jogar no Windows

1. Extraia **todo o ZIP** numa pasta (não abra os arquivos dentro do ZIP).
2. Instale o Node.js 20+ (preferencialmente **22**).
3. Dê duplo clique em **INICIAR_JOGO.bat** ou abra um terminal na pasta e rode:

```bash
npm install
npm run dev
```

4. Entre em **http://localhost:4321/**.

**A primeira execução precisa de internet para baixar os PNGs/animações do PMDCollab.** Se a conexão ao repositório falhar, o jogo ainda abre e funciona com desenhos substitutos, mas sem os sprites reais. O script guarda as imagens localmente na pasta `public/sprites`, para não ter que baixar tudo novamente.

## Mudanças da v3

- **Mapa único com 10 colunas e 5 linhas** (10×5), gramado verde, arbustos e árvores decorativas estilo pixel-art. O centro da arena não é uma parede: os indicadores de times aparecem **somente na preparação**.
- O time **azul começa à esquerda** e o **vermelho à direita**, três Pokémon por equipe. Cada Pokémon é um objeto posicionado em **coordenadas contínuas**; a grade só serve como escala espacial do mundo e área de preparação.
- **Arraste** os Pokémon do catálogo para a metade desejada; **arraste os já colocados** para novas posições (inclusive com precisão fracionária). Clicar em um Pokémon o seleciona; clicar numa posição vazia adiciona o Pokémon selecionado; botão direito remove. Para touchscreen, use arrastar; teclado aceita as setas e Enter no canvas.
- **Batalha iniciada exclusivamente pelo jogador**: não existe contagem regressiva nem autoplay. Botões **INICIAR BATALHA**, **PREPARAR** e **SORTEAR EQUIPES**.
- **Movimento real com pixels/segundo**, direção e sprites Walk/Idle; separação de corpos, limites da arena e perseguição/afastamento em função dos alcances dos golpes.
- **Velocidade (VEL)** determina tanto pixels/s de caminhada quanto **intervalo entre ataques**; ATK/SPA e DEF/SPD influenciam os danos físico/especial. O alcance é calculado a partir das **bordas dos corpos**, usando raio aproximado baseado na largura do sprite `Idle`. Golpes de contato recebem apenas um pequeno ajuste pelo tamanho do frame de ataque; não é considerada toda a área transparente da spritesheet (evita golpes corpo-a-corpo à distância).
- Cada espécie tem **8 golpes cadastrados**: 2 equipados + 6 na reserva de possibilidades. Cada golpe possui categoria (`atk`/`spa`), dano-base, alcance em células e prioridade de animações. Durante a preparação, selecione um slot e clique num golpe de reserva para testar outra dupla. **Sorteio/drop de golpes após combate ainda não foi implementado**: os seis de reserva são a futura pool de drops.
- **Animações PMDCollab verificadas em tempo de preparação**: o script lê `AnimData.xml` de cada Pokémon e descobre as animações existentes, dimensões, durações, `CopyOf` e `HitFrame`. Só baixa PNGs presentes no XML. No combate, cada golpe busca sua lista ordenada de animações: `Slash`, `Scratch`, `Shoot`, `SpAttack`, etc. Se a espécie não possuir a preferida, usa a próxima; último recurso **Attack**, depois **Idle**. O frame de impacto orienta quando o dano ou projétil sai.
- Projéteis de ataques à distância seguem os alvos; ataques corpo-a-corpo testam o alcance no instante do impacto. Há efeitos visuais por ataque, texto de dano, HP e vencedor.

## Estrutura do projeto

```text
src/pages/index.astro       Layout do jogo
src/styles/global.css       Estilo e responsividade
src/scripts/arena.js        Canvas, sprites, controles, mapa e interface
src/scripts/battle.mjs      Física, IA, golpes, projéteis, posicionamento e HP
src/scripts/moves.mjs       8 movimentos / espécie, alcance, dano e animações
src/scripts/pokemon.mjs     9 espécies e atributos, metadados de fallback
scripts/prepare-sprites.mjs Lê XML e baixa sprites existentes, gera manifest.json
public/sprites/             Gerada automaticamente na primeira execução
tests/battle.test.mjs       Testes de lógica independentes do browser
INICIAR_JOGO.bat            Inicializador Windows
.github/workflows/deploy.yml Publicação no GitHub Pages
```

## Comandos

```bash
npm test         # 9 testes de combate e formação
npm run dev      # prepara sprites e inicia modo desenvolvimento
npm run build    # prepara sprites e gera site estático em dist/
npm run preview  # mostra a compilação estática
```

**Atenção:** o campo possui *10×5*, mas não há movimento discreto entre quadrados. O movimento é contínuo, com velocidade em pixels/s.

## Limites deste protótipo

- Apenas os **nove Pokémon que já estavam no ZIP V2**. Não foram incluídos os ~100 Pokémon de listas externas ao arquivo, pois não constam do projeto recebido.
- O sistema ainda não inclui vantagem de tipos, itens, evolução, tiers, economia, IA estratégica complexa, loja, drops aleatórios ou multiplayer.
- A posição de impacto dos sprites é aproximada pelo `HitFrame` e pelos raios do corpo, não por leitura de pixels das mãos/efeitos nem pelos arquivos de offsets. Essa é uma aproximação visual/física inicial, passível de refinamento.
- Quando a internet está indisponível e `AnimData.xml` não está em cache, usam-se as quatro animações antigas como metadados de fallback. Para testar animações especiais de cada golpe, execute com internet.

## Direitos e atribuição

Sprites coletados do **[PMDCollab SpriteCollab](https://sprites.pmdcollab.org/)**, projeto de artistas da comunidade. **CC BY-NC 4.0 (atribuição, uso não comercial)** para contribuições da comunidade; verifique atribuição e licença específicas antes de uma eventual publicação. Pokémon pertence a seus respectivos titulares; este protótipo de fãs não é oficial e não está associado à Nintendo/Game Freak/Creatures/The Pokémon Company.
