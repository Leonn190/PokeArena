# Instrução permanente para Codex — PokeArena

Antes de editar leia `ORGANIZACAO.md` e o trecho aplicável de `PLANO_CODEX_POKEARENA_v0_5.md`. **O pedido mais recente do criador e as regras deste arquivo (17/10/2026) prevalecem sobre definições antigas conflitantes da organização e do plano.**

## Regras vigentes do combate (17/10/2026)

- Cada Pokémon possui um regular genérico e uma habilidade carregada. Físicos usam Atk/Def; especiais SpA/SpD. Somente a família Bulbasaur possui habilidades exclusivas: `0001` Tiro de Semente (3 × 40% SpA, alcance 4, custo 20), `0002` Chicote de Vinha (cone de 80% Atk com agrupamento, alcance 2, custo 25) e `0003` Morteiro de Pólen (110% SpA e cura de 55% SpA em área, alcance 3, custo 30). Demais espécies usam habilidades genéricas de custo 20.
- O alcance único é configurado na habilidade equipada e resolvido no domínio para IA, regular e ficha; genéricos usam 1 para contato e 3 para distância. Não depende dos sprites. Dentro do alcance, a unidade para e ataca, sem recuar para manter distância máxima.
- Evoluir equipa a habilidade padrão da nova espécie. A roleta custa 2 ouros, escolhe sempre outra habilidade da própria linhagem até a forma atual, exige preparação, posse e mais de uma opção. Não existe sorteio do regular, pool universal aleatória ou múltiplos slots de habilidades. A escolha pertence à instância e é preservada entre banco, campo, combate e rodadas.
- Exatamente seis atributos e seis IVs: vida, atk, def, spa, spd e vel. IV geral e poder total usam somente esses seis. Energia é recurso, nunca atributo: começa em zero, não cresce passivamente e ganha 5 por ação de ataque iniciada, uma única vez, inclusive em habilidades com vários projéteis. O máximo é o custo equipado; descontar o custo antes do ganho e limitar a barra. Não há regeneração nativa; curas e efeitos de estruturas permanecem.
- Com energia suficiente a habilidade tem prioridade obrigatória, caminhando até o alcance sem gastar antes de iniciar. A velocidade reduz o intervalo dos regulares. Animação regular: Attack no alcance 1, Shoot no alcance ≥2, com fallback Attack e visual seguro.
- Animações PMDCollab por lista de preferência disponível em cada ataque, com `Attack` de fallback. Animar `Hurt` ao receber dano, `Sleep` no banco, `Idle` virado para o jogador antes/depois da luta e entrada com rotação ao iniciar. Vencedores atiram projéteis no treinador ao término. `scripts/prepare-sprites.mjs` gera o manifesto com `Sleep` dos PNGs/XMLs já disponíveis.
- Ficha compacta com retrato, tipos, barras reais em combate (vida cheia e energia inicial fora dele), nível/IV/poder, seis linhas de atributos com IV visual, habilidade equipada e tooltip acessível por mouse e teclado; preservar venda.
- Arena de grama contínua, sem grade durante o jogo; grade de posicionamento aparece apenas segurando Pokémon ou objeto. Elenco na ordem de famílias (básico e evoluções consecutivas).

## Restrições permanentes

- Loja com **exatamente seis slots** (quatro Pokémon e dois flexíveis). Preserve capítulos, economia, equipes, sprites existentes e interface.
- Único modo jogável é partida local em memória contra bots (3–8 participantes); nenhum backend remoto, banco online, API HTTP ou autenticação ativados nesta etapa.
- Backend do domínio em `server/game/`, configurações em `config/`, UI em `src/ui/`; preserve esse particionamento para a futura migração.
- **Não executar testes, builds, servidores, instalações, simulações, scripts de verificação ou criar artefatos descartáveis** no repositório; apenas inspeção estática. Não incluir `node_modules`, `.astro`, `dist`, caches, logs, mocks, pastas de testes ou dependências novas.
