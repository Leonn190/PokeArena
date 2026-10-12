# Instrução permanente para Codex — PokeArena

**ANTES DE QUALQUER MODIFICAÇÃO**, leia integralmente `ORGANIZACAO.md` e a etapa aplicável de `PLANO_CODEX_POKEARENA_v0_5.md`. O GDD v0.4 rege as regras aprovadas, exceto pela substituição TEMPORÁRIA dos golpes: todos os Pokémon têm **APENAS Disparo, Investida e Ataque Legal**, com **DOIS** equipados.

O backend competitivo fica em `server/`, preparado para cópia autônoma para o Render, e decide oficialmente o resultado; o Astro/Canvas fica no frontend com Modo Teste local. **Nunca criar vitória oficial no navegador**. Nunca mudar a arquitetura sem alinhar com `ORGANIZACAO.md`.

**NÃO EXECUTE testes, builds, servidores, instalações, scripts, simulações ou comandos de verificação. NÃO CRIE pastas/arquivos de teste, node_modules, .node, .astro, dist, caches, logs, temporários, mocks, fixtures, backups, .bat, .ps1 ou outras pastas de raiz. Apenas revisão estática.** Detalhes obrigatórios completos estão na seção 9 de `ORGANIZACAO.md`. Repita essa proibição no resumo de cada etapa e não afirme ter testado.
