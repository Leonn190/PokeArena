# Instrução permanente para Codex — PokeArena

Antes de editar leia `ORGANIZACAO.md` e o trecho aplicável de `PLANO_CODEX_POKEARENA_v0_5.md`. **O pedido mais recente do criador e as regras deste arquivo (14/10/2026) prevalecem sobre qualquer definição antiga de ataques da organização e do plano.**

## Regras vigentes do combate (14/10/2026)

- **Exatamente OITO ataques universais**, em `config/ataques.mjs`: quatro regulares (Disparo, Tapa, Energia, Tiro de Energia) e quatro correspondentes carregados, mais fortes. Físicos usam Atk/Def; especiais SpA/SpD. Os dois de longo alcance por grupo disparam projéteis; os dois de curto alcance atingem em contato.
- Cada espécie tem **UM regular fixo e inalterável**, determinado em `server/game/moves.mjs` com overrides em `config/pokemon-ataques.mjs`. Cada espécie tem **pool fixa de TRÊS carregados**, recebe um deles aleatoriamente ao nascer e pode roletar **somente o carregado**, por 2 de ouro, sempre diferente do atual.
- +1 energia/s; 0 regeneração base/s; com energia suficiente o carregado tem prioridade **obrigatória** sobre regulares, inclusive quando for necessário caminhar até o alcance. A velocidade do Pokémon reduz o intervalo dos ataques regulares.
- Animações PMDCollab por lista de preferência disponível em cada ataque, com `Attack` de fallback. Animar `Hurt` ao receber dano, `Sleep` no banco, `Idle` virado para o jogador antes/depois da luta e entrada com rotação ao iniciar. Vencedores atiram projéteis no treinador ao término. `scripts/prepare-sprites.mjs` gera o manifesto com `Sleep` dos PNGs/XMLs já disponíveis.
- Habilidades exclusivas por espécie estão **reservadas**, mas **todas sem habilidade ativa nesta versão**. Nenhuma habilidade pode ser trocada.
- Arena de grama contínua, sem grade durante o jogo; grade de posicionamento aparece apenas segurando Pokémon ou objeto. Elenco na ordem de famílias (básico e evoluções consecutivas).

## Restrições permanentes

- Loja com **exatamente seis slots** (quatro Pokémon e dois flexíveis). Preserve capítulos, economia, equipes, sprites existentes e interface.
- Único modo jogável é partida local em memória contra bots (3–8 participantes); nenhum backend remoto, banco online, API HTTP ou autenticação ativados nesta etapa.
- Backend do domínio em `server/game/`, configurações em `config/`, UI em `src/ui/`; preserve esse particionamento para a futura migração.
- **Não executar testes, builds, servidores, instalações, simulações, scripts de verificação ou criar artefatos descartáveis** no repositório; apenas inspeção estática. Não incluir `node_modules`, `.astro`, `dist`, caches, logs, mocks, pastas de testes ou dependências novas.
