# Instrução permanente para Codex — PokeArena

**ANTES DE MODIFICAR**, leia integralmente `ORGANIZACAO.md` e a etapa aplicável de `PLANO_CODEX_POKEARENA_v0_5.md`. O pedido mais recente do criador prevalece sobre documentos históricos conflitantes.

**REGRAS ATIVAS (13/10/2026):** exclusivamente QUATRO ataques UNIVERSAIS para todos os Pokémon: Investida e Disparo (regulares, corpo a corpo e à distância), Impacto e Raio de Energia (carregados, corpo a corpo e à distância). Cada Pokémon equipa **um regular e um carregado**. Ganha 1 de energia por segundo de combate; o ataque carregado consome a energia necessária quando executado; regeneração base de HP é zero. Definições em `config/ataques.mjs` e `config/pokemon-ataques.mjs`.

Loja com **EXATAMENTE SEIS slots**: quatro somente Pokémon e dois flexíveis (60% Pokémon, 40% estruturas). Chances épicas por capítulo 9/11/15%; tabelas em `config/raridades.mjs`. Configurações gerais ficam na pasta de raiz `config/`, explicitamente autorizada.

**MODO ÚNICO:** menu com dois botões, `Puxar partida` e `Ver elenco`; a única experiência jogável são partidas **locais em memória contra bots**, sem simulador paralelo. Equipe observada do dono da arena sempre embaixo, adversária acima. Backend HTTP/Render/PostgreSQL/Firebase continuam INATIVOS.

**NÃO EXECUTE testes, builds, servidores, instalações, scripts, simulações ou comandos de verificação.** Nenhuma pasta `node_modules`, `.astro`, `dist`, cache, teste, log, mock, backup ou temporário; nenhuma dependência ou framework novo. Somente inspeção estática.

**IMPORTANTE NA FUTURA SEPARAÇÃO DO BACKEND:** `server/game/*` importa `../../config/*.mjs`, pois as configurações estão na raiz por decisão do criador. Para tornar `server/` copiável isoladamente para Render, será necessário incluir e versionar essas configurações no projeto do backend e atualizar os imports por ocasião da migração. NÃO ativar API ou fazer cópias de configurações durante a fase offline.
