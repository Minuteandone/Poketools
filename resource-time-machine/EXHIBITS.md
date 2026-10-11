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
