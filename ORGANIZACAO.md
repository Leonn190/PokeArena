# ORGANIZAÇÃO OFICIAL — PokeArena

**Versão 0.5 (12/10/2026), com decisão de interface atualizada para partida única. Leitura obrigatória antes de QUALQUER alteração por Codex.**

**Atualização prioritária de 13/10/2026 — capítulos:** o comando do criador substitui as regras conflitantes do GDD e das etapas antigas. Para esta implementação, o criador dispensou expressamente a leitura do GDD ausente. Permanecem o modo local, os três golpes universais, a arquitetura e todas as proibições da seção 9. As regras vigentes estão na seção 8; não restaurar terrenos ou a antiga progressão por rodadas.

**Decisão posterior:** não existe mais modo livre de testes. O site apresenta somente "Criar partida local", e a partida offline em memória é o único fluxo ativo. Não reintroduzir o segundo modo nas etapas posteriores.

Este documento prevalece sobre sugestões genéricas de estrutura e sobre o plano antigo de Codex **quanto à arquitetura e à forma de executar alterações**. Para regras de jogo, consultar o `GAME_DESIGN_POKEMON_TFT_v0_4_Multiplayer_Economia_Combate.md` disponibilizado pelo criador; este arquivo NÃO precisa ser copiado para a raiz. O plano de implementação é `PLANO_CODEX_POKEARENA_v0_5.md`. **Se houver conflito, avisar o criador e não inventar regras.**

## Regra prioritária de execução — desenvolvimento OFFLINE em TODAS as etapas

**Esta decisão do criador, de 12/10/2026, substitui provisoriamente qualquer instrução abaixo que exija API, HTTP, Render, PostgreSQL, autenticação remota ou partida servidor-autoritária ativa.** Nas etapas 01 a 11, inclusive a integração final, implementar e usar somente simulação local em memória. O site não deve chamar endpoints para iniciar partidas; nenhuma funcionalidade de partida pode exigir servidor ou banco de dados. Não iniciar, implementar ou testar a API durante a Etapa 01. As referências a deploy, contrato HTTP, transações e servidor nas seções seguintes documentam **exclusivamente a arquitetura futura**, não instruem ativá-los agora.

- `server/game/` permanece independente de navegador/Node/HTTP e concentra regras reutilizáveis. O frontend poderá importar esse domínio diretamente para a simulação local provisória, sem reivindicar autoridade competitiva online.
- `server/` deve continuar autossuficiente para migração futura, mas `server/index.mjs`, `server/match.mjs`, `server/store.mjs` e `src/services/api.mjs` não participam do fluxo offline até nova decisão explícita do criador.
- **Etapa 01:** menu com partida local preservado e Puxar Partida criando sessão local de 3–8 participantes (um humano e bots), 100 HP, nove ouros, rodada 1. Não executar batalhas, IA, compras competitivas, economia ou rodadas prematuramente.
- **Etapas 02–11:** evoluir a simulação local e suas regras puras nas respectivas etapas, mantendo a separação que permitirá posteriormente transferir a autoridade ao servidor. Nunca tratar resultados locais como partidas oficiais online.

## 1. Objetivo irrevogável

- **Frontend**: site Astro estático no GitHub Pages, Canvas 2D, animações PMDCollab, interface, câmera, renderização, entradas de usuário e partida local (simulador offline).
- **Backend**: serviço Node HTTP dentro de `server/`, executável localmente ou no Render. Em modo Partida, será **autoritário** sobre sala, saldo, estoque, ofertas, IV, fusões, ações, bots, cronômetro, simulação, dano nos 100 HP, eliminações e vencedor. O navegador somente envia intenção de ação e mostra estado/eventos confirmados.
- **Banco de dados**: armazenamento atrás de um adaptador. Em desenvolvimento, memória volátil; em produção com `DATABASE_URL`, PostgreSQL. Nenhum dado crítico de partida depende da memória do navegador ou de arquivo gravado no disco efêmero do Render.
- **Separação futura**: `server/` é uma aplicação **AUTOSSUFICIENTE** com `package.json` próprio, imports internos e variável `PORT`. Deve funcionar se sua pasta for **COPIADA** integralmente para a raiz de outro repositório GitHub e instalada/iniciada pelo Render. Manter a pasta original no repositório do site porque a partida local usa as regras compartilhadas; não movê-la sem atualizar as importações do frontend. Após a separação, sincronizar explicitamente versões das regras compartilhadas ou fazer o frontend consultar o servidor; partidas oficiais jamais dependem do motor do cliente.
- **Localmente**: a página Astro pode ser usada coma partida local sem API; a própria API pode ser iniciada localmente. Futuras partidas competitivas locais deverão chamar exatamente os mesmos endpoints do Render e permanecer servidor-autoritárias. **Não criar fallback de partida competitiva controlada pelo browser.**

## 2. ÚNICOS GOLPES PERMITIDOS — REGRA TEMPORÁRIA OBRIGATÓRIA

**ATÉ ORDEM EXPLÍCITA EM CONTRÁRIO, TODOS OS POKÉMON TÊM SOMENTE ESTES TRÊS GOLPES DISPONÍVEIS:**

1. **Disparo** — ataque especial à distância com projétil.
2. **Investida** — ataque físico de contato.
3. **Ataque Legal** — ataque físico de alcance curto/intermediário.

**Todos** compartilham exatamente o mesmo catálogo em `server/game/moves.mjs`. No combate, **dois golpes equipados por Pokémon**, e o terceiro é uma opção de troca; nunca três equipados. Nenhum golpe específico por espécie, nenhum golpe novo, status, habilidades ou ataques especiais, mesmo que o GDD v0.4 ou planos antigos mencionem pools de seis. A troca competitiva deve custar 2 ouros quando a economia for implementada; partida local pode ser gratuito. Evolução não gera novos golpes. O balanceamento numérico dos três é provisório.

## 3. Estrutura de diretórios permitida

```text
PokeArena/
├── AGENTS.md                     # ponte curta que força Codex a ler este arquivo
├── ORGANIZACAO.md                # ESTA norma de arquitetura
├── PLANO_CODEX_POKEARENA_v0_5.md # passos por ordem
├── astro.config.mjs              # configuração Astro existente
├── package.json                  # build do frontend (NÃO misturar com API)
├── .gitignore                    # ignora geração local
├── .github/workflows/deploy.yml  # deploy do site no GitHub Pages
├── public/                       # favicon e sprites/assets públicos
│   └── sprites/
├── scripts/                      # APENAS preparo necessário dos sprites no build
│   └── prepare-sprites.mjs
├── src/
│   ├── pages/index.astro         # casca Astro e HTML dos controles
│   ├── styles/global.css         # estilos do jogo
│   ├── ui/                        # Canvas, HUD, câmera, sprites, input
│   │   ├── arena.js              # composição do simulador legado; reduzir progressivamente
│   │   ├── camera.mjs
│   │   ├── renderer.mjs
│   │   └── sprites.mjs
│   └── services/api.mjs          # único ponto de acesso HTTP à API
└── server/                       # API INDEPENDENTE; pode ser copiada para outro repo
    ├── package.json             # dependências e start SOMENTE da API
    ├── index.mjs                # HTTP, rotas, CORS e validações do transporte
    ├── match.mjs                # estado de sala e autorização de jogador
    ├── store.mjs                # memória local / PostgreSQL via DATABASE_URL
    └── game/                    # REGRAS PURAS; nenhuma dependência de DOM/Canvas
        ├── rules.mjs            # constantes e fórmulas aprovadas do GDD
        ├── roster.mjs           # inventário/economia/unidades de cada participante
        ├── pokemon.mjs          # dados de espécies e evoluções
        ├── moves.mjs            # 3 golpes universais, somente 3
        ├── structures.mjs       # estruturas físicas, efeitos e transações
        └── battle.mjs           # motor compartilhado de duas a quatro equipes
```

**Não criar arquivos só porque aparecem em uma arquitetura idealizada.** Acrescentar módulos somente quando houver responsabilidade concreta. `server/game/structures.mjs` substitui o antigo módulo de terrenos; não restabelecer mecânicas de solo. Novos arquivos permitidos apenas em pastas já legitimadas acima; nova pasta raiz somente se o criador pedir expressamente.

## 4. Fronteiras obrigatórias entre módulos

1. `server/game/*` não importa `window`, `document`, Canvas, CSS, Astro, imagens ou APIs de rede. Regras de dano, colisão, IA, compras, raridades, IV, evolução, estruturas, consumíveis, espólios e vitórias ficam aqui. Efeitos aleatórios devem aceitar RNG controlável; a simulação precisa produzir resultado consistente no backend.
2. `server/index.mjs` é transporte: valida entrada, sessão, origem e roteamento. Não contém cálculo de dano nem regras de loja. Não aceitar `winner`, `damage`, `gold`, `hp` ou `iv` vindos do usuário como fonte de verdade.
3. `server/match.mjs` gerencia ciclo e autorização. Somente o servidor gera ofertas, sorteios e emparelhamentos, aplica alterações com transações e publica snapshots filtrados. O servidor nunca expõe mãos/ofertas futuras ou segredos dos outros jogadores.
4. `server/store.mjs` é o único acesso ao banco; transações e reserva do pool no mesmo estado são atômicas. A criação inicial de tabelas é permitida apenas no servidor; não escrever arquivos persistentes dentro do container Render.
5. `src/services/api.mjs` centraliza URL da API, headers e chamadas. Quando o modo competitivo estiver implementado, a UI não recalcula vitórias, recompensas, sorteios ou vida. Pode fazer interpolação visual dos eventos do servidor, sem assumir sua autoridade.
6. `src/ui/*` contém apenas visual, controles e o **simulador offline partida local**. Ainda existe lógica antiga concentrada em `arena.js` que deverá migrar paulatinamente para `server/game/` conforme as próximas etapas; não adicionar mecânicas competitivas novas nesse arquivo.
7. Pokémon definem dados e `collisionRadius` de jogo; tamanho de sprite e animação nunca alteram física, alcance ou dano. Assets e cache só afetam apresentação.
8. O motor aceita duas equipes nos duelos, três na fase 4 (15×10) e quatro na fase 9 (20×10), em Battle Royale sem alianças. A sala continua com 3–8 participantes. Clones completam grupos e não possuem economia, inventário, HP de jogador ou autoridade para vencer a partida. Nunca colocar os oito participantes em uma única arena.
9. Os bots devem chamar as MESMAS operações de regra/economia utilizadas para jogadores humanos, sem acesso a resultados futuros e sem unidades gratuitas.
10. Manter modelo serializável e com IDs estáveis; evitar `Map`, classes de Canvas e objetos DOM nos snapshots persistidos. Para anti-replay usar versão/revisão e, quando as ações forem implementadas, identificador de ação idempotente.

## 5. Contrato HTTP fixo (versão inicial)

| Método/rota | Uso |
|---|---|
| `GET /api/v1/health` | Saúde da API; `competitiveReady:false` enquanto incompleta |
| `POST /api/v1/matches` | Cria sala de 3–8 participantes; devolve `{match,playerId,token}`. Token só para titular, guardar com cuidado. |
| `GET /api/v1/matches/:id` | Snapshot AUTORIZADO (`Authorization: Bearer ...`). |
| `POST /api/v1/matches/:id/actions` | Futuras intenções (`buy`, `sell`, `place`, `reroll`, `ready` etc.), validação e resultado pelo servidor. **Hoje retorna 501, propositalmente.** |

Ao implementar comandos competitivos, manter esse prefixo e o formato geral; rejeitar ações fora da preparação, calcular fases pelo relógio do servidor, não confiar em timestamps do cliente, não duplicar operações em reenvios e transacionar simultaneamente estoque/economia/IV/pool/vitória. A partida local não chama esses endpoints para declarar vencedor de partida oficial.

**Escopo REAL já entregue na fundação:** API HTTP e repositório de partidas em memória/PostgreSQL, criação e consulta autorizada de sala, regras compartilhadas do duelo inicial, frontend atual de partida local. **NÃO** está entregue ainda: matchmaking humano, login, execução oficial de rodadas pelo servidor, batalha competitiva real, persistência de contas, nem vitórias online. Essas etapas constam do plano. Nunca anunciar o stub como servidor competitivo pronto.

## 6. Deploy Render sem retrabalho de arquitetura

1. Copiar o **conteúdo inteiro** de `server/` (não apenas `index.mjs`) para a raiz de um repositório novo da API. `server/package.json` já tem `start` e Node `>=20`.
2. No Render criar **Web Service** com runtime Node; branch principal; comando build `npm install`; start `npm start`. Render define `PORT`. Se usar monorepo diretamente, definir Root Directory `server` e manter os mesmos comandos relativos a essa pasta.
3. Para salvar estado entre reinícios, configurar **Render Postgres** e a variável **secreta** `DATABASE_URL` da API. O adapter cria a tabela `matches` no primeiro início. Sem ela, partidas são mantidas só em memória e somem quando o processo reinicia: apenas desenvolvimento local.
4. Configurar `CORS_ORIGINS` se houver outro domínio de frontend. Já estão permitidos `https://leonn190.github.io`, `http://localhost:4321`, `http://127.0.0.1:4321`.
5. No GitHub do **frontend** configurar a Actions Variable `POKEARENA_API_URL` com `https://...onrender.com` (sem barra final). O workflow injeta no build como `PUBLIC_POKEARENA_API_URL`, lido pelo adaptador do navegador.
6. O repositório do site **continua com cópia de `server/`**, usada para compartilhar código da partida local. A API publicada fica no repositório separado; alterações futuras precisam ser sincronizadas conscientemente (ou migrar o simulador local para outro pacote versionado por decisão do criador). **Não** presumir que duas cópias em repositórios diferentes se atualizam sozinhas.

## 7. Uso local, sem alterar o contrato

- **API local (somente por iniciativa do usuário):** na pasta `server/`, `node index.mjs`; sem `DATABASE_URL` usa memória na porta `10000`; com banco usa Postgres.
- **Site local (somente por iniciativa do usuário):** no repositório raiz, instalar dependências necessárias do Astro por iniciativa própria e iniciar `npm run dev` (foi acrescentado o script `dev`). `http://localhost:4321` aponta automaticamente para `http://localhost:10000`, caso a API esteja rodando.
- O site Astro no GitHub Pages **não** inicia um Node server por si próprio. Render funciona como serviço separado.
- A API não é necessária para carregar o simulador; **partida oficial no browser só deve ser habilitada após `competitiveReady:true` com ações implementadas**. Offline não significa vitória oficial sem servidor.

## 8. Regras de conteúdo que não devem ser violadas

- Partida local única com 3–8 participantes (humano + bots), 100 HP e nove ouros iniciais. Banco físico de dez espaços compartilhado entre Pokémon e estruturas. Preservados os tempos atuais do código: preparação 30 s, entrada 3 s, combate até 30 s; resultado/coleta 4 s. Nenhuma API é ativada.
- Cada capítulo tem dez fases: normal, ouro, normal, tripla, PvE, normal, dano dobrado, normal, quádrupla, lendário. `round` é apenas o índice absoluto de compatibilidade; capítulo e fase são derivados dele. Repete enquanto houver mais de um participante real vivo.
- Campo começa com um Pokémon; sobe após as fases 3, 7 e 10, para a preparação seguinte, até seis. Estruturas não contam nesse limite. Duelo preserva o campo 10×5 de cada lado; arenas especiais têm dez linhas de combate, além das reservas visuais.
- Loja com seis ofertas obrigatórias de Pokémon e duas flexíveis (60% Pokémon, 40% estruturas). Chances comum/incomum/raro/épico/mítico/lendário: capítulo 1 `32/30/25/12/1/0`; capítulo 2 `27/30/26/14/2/1`; capítulo 3+ `23/25/28/18/4/2`. Míticos custam 6, lendários 8, demais preços preservados. Sorteia raridade antes da espécie; uma raridade sem estoque deixa o slot vazio, sem redistribuir porcentagens. Bússola influencia apenas a espécie dentro da raridade.
- Dano normal: modificador fixo da sala (0 para 3–4, 1 para 5–6, 2 para 7–8 iniciais) + capítulo + sobreviventes. Cada sobrevivente soma 1 no capítulo 1; depois soma 2 se estiver acima de 75% do próprio HP máximo, senão 1. Na fase 7 dobra somente o total de dano ao jogador.
- Nas arenas triplas/quádruplas, primeiro recebe zero de dano; demais recebem modificador + capítulo + componente 1/4/9 para segundo/terceiro/quarto. Ordem de eliminação decide o ranking; empate de tempo usa proporção de HP restante, quantidade viva, dano causado e índice estável. Primeiro é vitória, último derrota e intermediários neutros. Clones integram o ranking, mas não recebem consequências fora do combate.
- Renda por fase: 5 + 1 por vitória + juros `min(3,floor(saldo/10))` antes da renda + sequência `min(3,max(0,contagem-2))`. Neutros preservam a sequência sem aumentá-la. Fase 2 concede ainda 1 por abate durante a luta, 3 por vitória e 1 por sobrevivente próprio. Aposta opcional de 1–5 ouros, debitada na confirmação durante preparação, imutável: acerto paga 2×, erro zero, empate devolve o valor.
- PvE da fase 5: Fácil tem limite−1 unidades (mínimo 1), HP e atributos de combate a 80%; Médio tem o limite atual e atributos a 100%; Difícil tem o limite atual, HP e atributos ofensivos a 125%. Máximo seis, só espécies e golpes já existentes. Parâmetros iniciais de composição: sorteio das raridades comum a épico com pesos do capítulo, IV normal `min(100,40+20×(capítulo−1))`. Derrota não causa dano. Vitória concede capítulo + 2/4/6 pontos conforme dificuldade.
- Espólios cinza/azul/amarelo valem 1/2/4 pontos. Sorteio uniforme entre combinações de quantidades cuja soma fecha o orçamento, sem multiplicar pesos por permutações dos recipientes. Conteúdo é sorteado uma vez e armazenado. Cinza: ouro 1–4, Pokébola ou Pokémon comum/incomum (valor máximo 5); azul: ouro 5–10, Great/Ultra ou Pokémon incomum/raro (máximo 12); amarelo: ouro 12–18, Ultra/Master ou Pokémon raro/épico/mítico (máximo 20). Seleção pondera custo real dos Pokémon e valores relativos dos recursos; valores iniciais das bolas para esse sorteio são 2/5/8/12, sem preço de compra.
- As quatro bolas são consumíveis exclusivos de espólios. Chances comum/incomum/raro/épico: Pokébola `100/50/0/0`, Great `100/100/50/0`, Ultra `100/100/100/50`, Master `100/100/100/100`. Míticos/lendários inelegíveis. Tentativa válida exige espaço e consome a bola mesmo na falha. Sucesso preserva espécie, evolução e IV, cria ID próprio e não copia equipamentos. Proveniência distingue cópias criadas de reservas da pool, impedindo inflar o estoque ao vendê-las. Zygarde continua consolidado numa única instância e não aceita cópia quando já completo.
- Fase 10: um lendário sorteado por capítulo, igual para todos, sem escolha de dificuldade. IV exclusivo do chefe: 100, 500, 1000, 2000, 3000, 4000…; o IV normal continua limitado a 100. Vitória concede um amarelo; derrota não elimina nem causa dano. Chefes não pertencem ao inventário e não são clonáveis.
- Avatar se move com clique direito; câmera preserva botão central, Espaço+arraste e Shift+direito. Não é combatente nem obstáculo. Coleta física entrega ouro, bolas e Pokémon; espólios restantes são entregues antes da fase seguinte. Com banco cheio, Pokémon já sorteados ficam como recompensas pendentes, sem perda nem ressorteio, e entram assim que houver espaço. A animação de dano não controla HP.
- Terrenos, pintura, misturas de solo e suas influências foram removidos. Estruturas ficam em `server/game/structures.mjs`, com catálogo, preços, efeitos e combinações exclusivamente entre estruturas preservados, oito pontos no campo, dimensões 1×1/2×2 e sem sobreposição entre estruturas. Compra coloca instância no banco; arraste posiciona/reposiciona/retira e a venda usa a região da loja. Não há inventário ou aba separados.
- Evoluções, pool finita, IV normal, Babys, equipamentos existentes e os três golpes universais permanecem. Regras ficam em `server/game/`; HUD, avatar desenhado, sprites e efeitos ficam em `src/ui/`.

## 9. Regras ABSOLUTAS ao Codex: sem testes e sem lixo

**Em TODOS os comandos do plano, ANTES de codar, abrir e ler novamente `AGENTS.md`, `ORGANIZACAO.md` e a etapa atual de `PLANO_CODEX_POKEARENA_v0_5.md`.** Consultar GDD quando etapa mexer em regra. Alterar SOMENTE o necessário à etapa, em arquivos com responsabilidade clara, e informar arquivos criados/movidos/excluídos.

**NÃO EXECUTAR NADA**: não executar testes, build, servidor local, instalação, simulações, scripts nem comandos de verificação, sob qualquer nome. Proibidos especialmente `npm test`, `npm run build`, `npm run dev`, `npm install`, `npx`, `node`, Playwright, Vitest, Jest, `curl`, testes ad hoc e comandos que criem saída. **Somente leitura/análise estática de fonte; não alegar que testou.** O GitHub Actions continua executando o build normal QUANDO O USUÁRIO PUBLICAR; isso não autoriza o Codex a rodar builds.

**NÃO CRIAR** `.node`, `node_modules`, `.astro`, `dist`, `.cache`, `.tmp`, `.codex`, `coverage`, `test-results`, `playwright-report`, `tmp`, `temp`, `.venv`, `__pycache__`, `*.log`, `test*`, `mock*`, `fixture*`, screenshots, relatórios, backups, cópias numeradas, `.bat`, `.ps1`, pipelines paralelos, experimentos ou quaisquer pastas de teste na raiz ou fora dela. Não mover o projeto para pasta aninhada `PokeArena/PokeArena`. Não criar `src/scripts` legado de novo. **Não criar pastas adicionais na raiz.** A pasta `server/` e os arquivos `AGENTS.md`, `ORGANIZACAO.md` e plano são **as únicas adições estruturais de topo explicitamente autorizadas nesta reorganização**.

**NÃO APAGAR** `.github`, `public/sprites`, `package.json`, `astro.config.mjs` nem ativos úteis. Exclusões devem ser motivadas por importações atualizadas; remover referências antigas e código morto em vez de deixar duas versões concorrentes. **Sem bibliotecas/frameworks novos por conforto pessoal**; `pg` já está listado exclusivamente para Postgres no servidor. Evitar React, Next, Firebase, WebSockets, Docker ou ambientes paralelos até decisão explícita.

**Concluir cada etapa** com: alterações reais, arquivos tocados, regras ainda pendentes, passos de conferência **manual para o usuário**, e declaração explícita **“Nenhum teste, build, servidor ou instalação foi executado.”**
