# PokeArena — origens dos assets

- **Pokémon PMD (animações e portraits):** https://github.com/PMDCollab/SpriteCollab — **CC BY-NC 4.0**: uso não comercial com atribuição. Preservar `sprites/<id>/credits.txt` e `portraits/creditos/<id>.txt`. Direitos sobre Pokémon pertencem aos titulares respectivos.
- **Ícones PNG dos 18 tipos:** Pokémon Showdown, https://play.pokemonshowdown.com/sprites/typeicons/ — fontes individuais registradas em `treinadores/manifest.json`. Os SVGs antigos de partywhale foram removidos; seu texto MIT permanece em `tipos/LICENSE-MIT.txt`.
- **Treinadores e Pokébolas:** assets locais provenientes de https://github.com/pret/pokeemerald, com fontes e animações descritas em `treinadores/manifest.json`. Direitos sobre Pokémon pertencem aos respectivos titulares.
- **Tileset de cenário:** Kenney Roguelike/RPG Pack, https://kenney.nl/assets/roguelike-rpg-pack — **CC0**. Se a URL principal falhar, usa o espelho do OpenGameArt, ou um atlas Tiny Town do Kenney. Fonte exata: `cenario/fonte-kenney/fonte.json`.
- **Portrait fallback:** arte oficial hospedada em https://github.com/PokeAPI/sprites quando não existe retrato PMD; não confundir hospedagem com permissão comercial.

**Importante:** `assets/terrenos/*.png` são versões tonalizadas de samples Kenney para representar provisoriamente os 11 biomas; não são ainda autotiles ou tiles de transição. `assets/estruturas/*.png` são pixel art provisórias criadas pelo script e identificadas pelo ID exato das 14 estruturas. O atlas CC0 original está preservado em `assets/cenario/fonte-kenney/atlas.png` para criar arte mais detalhada depois. Os arquivos `-Offsets.png` e `-Shadow.png` do PMD são metadados, não frames para desenhar como sprites.

**Integração:** o script não modifica JS/CSS, gameplay nem `sprites/manifest.json`. A integração visual desses recursos deve ser feita numa etapa posterior.
