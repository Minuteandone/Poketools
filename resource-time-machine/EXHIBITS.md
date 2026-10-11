# Resource Time Machine — specialized exhibits

This source bundle contains the updated dedicated viewer pages, the Nitro IMD 3D parser, and the shared binary/graphics archive parser.

## Exhibits

- **index.html** — curated museum homepage, not a generic file wall.
- **models.html** — real 3D WebGL mesh viewer for source `.imd` models in the original `resource/` tree.
- **battle-stages.html** — separate 3D battlefield model gallery for original `resource/battle/battle_3d/*.imd` files, with orbit controls and background variants.
- **narc-lab.html** — NARC internal member inspection, Nintendo DS palette and cell graphics composition, hexadecimal inspection, and file-level history.
- **films.html** — frame-based historical opening and logo viewer.
- **events.html** — interactive NPC/object placement maps from original `fldmapdata/eventdata/data/*.mev` files; individual event IDs, source position coordinates, script references and revisions.
- **dialogue.html** — searchable Japanese MessageEditor GMML (`.gmm`) source documents, including developer comments, historical revisions, and alternate text columns.
- **items.html** — decoded original item graphics from `itemicon/*.ncg` with matched `.ncl` color palettes; browser grid and file revision selector.
- **specialists-smoke.mjs** — browser tests that load actual map events, GMML message rows, and Nintendo DS item pixel data.
- **seasons.html** — standalone, correctly assembled seasonal display screens from original `.ncg`/`.ncl`/`.nsc` tiles and tilemaps, with source sheet mode and revision history.
- **footprints.html** — browse original Pokémon footprint graphics IDs with exact palette pixels, automatically trimmed previews, source tile-sheet mode, and revision history.
- **manuals.html** — browse original Pokémon Black/White manual screenshots with real 24-bit BMP scanline decoding, page thumbnails and revisions.
- **viewers/source-tiles.js** — shared strict source Nitro tile/palette/tilemap and Windows BMP decoder; explicitly distinguishes source files from compiled Nitro resources.
- **wallpapers.html** — 16 standard and 8 bonus PC box wallpapers, with correct source 2D tilemap/palette composition and historical revisions.
- **party-icons.html** — 717 source Pokémon party graphics, exact ATTR palette-bank choice and two-frame icon animation.
- **monolith.html** — original independently selectable upper/lower screen backgrounds (map, mission, history, title and others).
- **viewers/collections.css** — mobile-first common gallery stylesheet.
- **mail-gallery.html** — 12 Pokémon stationery designs, plus mailbox backgrounds, from real original source tilemaps.
- **title-lab.html** — source Black/White title logos, independent title layers and original BMP artworks.
- **trainer-cards.html** — real Black/White Trainer Card palette tiers and front/back/badge layouts, without fake dynamic card data.
- **pokedex-ui.html** — named source layers for Pokédex info/list/search UIs, including exact source filenames.
- **viewers/quick-exhibits.js** — shared strict renderer for dedicated small original-source collections.
- **field-model-atlas.html** — searchable real 3D collection of 761 source field models plus 10 additional standalone geometries, with associated original texture-source links.
- **cutscene-studio.html** — 81 actual 3D cinematic source models organized in 19 named scene folders, linked to original ICA/ITA/ITP/IVA resources. Animation playback is not implemented.
- **overworld-terrain.html** — 650 individually preserved Nitro IMD overworld terrain pieces, source variants and original chunk links. Not a stitched world.
- **musical-accessories.html** — 100 cataloged original Pokémon Musical assets plus source graphic ID 999, with original Japanese placement/effect metadata.
- **move-effects.html** — 60 original 2D move-effect graphics with 43 assembled NSC maps and linked source EFFSEQ script examples.
- **field-textures.html** — 566 original (484 numbered + 82 alternate-form) `poke_char2imd/tsure_data` texture atlas sources, with actual pixels and palette banks.
- **battle-ui.html** — 60 original 2D battle-interface screen layouts with independently selected source palettes. These are component graphics, not reconstructed complete gameplay.
- **trainer-records.html** — source trainer battle CSV parsed without losing quoted multiline fields; searchable by trainer IDs, names, classes, or source text.
- **files.html** — optional advanced explorer of the full resource tree.

These new exhibits fetch original files from the source repository on demand; only source file indexes and viewer code are included in the deployed site. Field map coordinates are schematic, not an overworld mesh. 

The model viewer currently decodes exported Nitro `.imd` mesh geometry and embedded palette textures. It does not fully implement all Nitro formats: compiled `.nsbmd`, skinning, and skeletal animation need separate decoders. The NARC viewer parses archives but only renders recognized 2D graphics members as sprites. No false 'render' of arbitrary binary data.

## Original resource source

`https://github.com/e-minence/black_white/tree/main/resource`

## Automated checks

`resource-time-machine/exhibits-smoke.mjs` covers the exhibit homepage, actual 3D model mesh loading, and real NARC member parsing. `specialists-smoke.mjs` checks the additional map, text and item exhibits using Chromium on GitHub Actions.

## Public website

`https://minuteandone.github.io/Poketools/resource-time-machine/`

The zip is a convenient copy of the site's viewer source files. It does not include copyrighted Pokémon ROMs or extracted binary assets.

The footprint viewer shows original graphics IDs (not guaranteed Pokédex numbering) and trims transparent padding without claiming to assemble every possible NCER frame. Season screens implement tile flips and palette-bank metadata. Manual images are original, uncompressed 24-bit BMP pixels.

The original `NCCL/PALT` palette data can contain multiple 16-color banks despite the colors-per-bank header field. The shared decoder now retains every bank. Icon ATTR palette choices are extracted from the original graphic as documented in `resource/pokeicon/graphic/poke_icon_conv.rb`; graphic IDs must not automatically be assumed to be National Pokédex numbers. The Monolith screen pairing is intentionally independent and exploratory.

The four quick-win galleries are honest about the distinction between source layers and complete original game screens. Only matching source graphic/palette/tilemap combinations are assembled; original 24-bit BMPs are decoded directly. A raw tile sheet toggle and historical source revisions are available per item.
