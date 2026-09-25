# Pokémon BW Sprite Studio

A no-build, local-only web app for inspecting and editing Pokémon Black/White battle graphics in the Gen V Pokégra archive (`/a/0/0/4`).

## Current first-tool features

- Opens a user-selected `.nds` file locally in the browser (the ROM is not uploaded).
- Finds `/a/0/0/4` through the NDS FNT/FAT rather than assuming a hardcoded ROM offset.
- Understands the 20-member Pokémon/form blocks used by Black/White.
- Front/back normal and shiny static design previews.
- Front/back animation-sheet viewer.
- Pixel editor for static graphics and animation sheets.
- NCLR palette editor, including normal and shiny palettes.
- Reconstructs animation frames from NCGR + NCER + NANR + NMCR.
- Animation editing for NMCR map-part X/Y placement and supported NANR frame duration/translation values.
- Raw member inspector and decoded member export.
- Patch-manifest export.
- Experimental **non-destructive patched-ROM export**. The exporter recompresses dirty members and only writes a ROM copy when every edited asset fits in its original NARC member slot. It never modifies the source ROM.

## Run it

Because the app uses ES modules, serve the folder with any static HTTP server instead of opening `index.html` as a `file://` URL.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.


## GitHub Pages

This repository is ready to publish as a GitHub Pages site using the included `.github/workflows/pages.yml` workflow. The app uses only relative URLs, so it works under the repository subpath.

For this repository, the expected Pages URL is:

`https://minuteandone.github.io/Poketools/`

If Pages has not been enabled for the repository yet, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions** once. Future pushes to `main` deploy automatically.

## Scope / next steps

This is the first module of a broader Black/White editor. The animation view currently focuses on the real part-animation stack (NCER/NANR/NMCR) and uses NMAR to locate the idle map when its label data is available. Planned expansion points include a higher-level NMAR timeline editor, draggable sprite parts, form-name metadata, female variants UI, undo/redo, import PNG → indexed tiles, NARC relocation/rebuild for edits that grow beyond their original compressed slots, and editors for other game systems.

## ROMs and copyrighted assets

No Pokémon ROM or extracted Pokémon artwork is bundled. Use a ROM you are legally entitled to use. All decoding/editing is performed in the browser.

## Credits

Format/parser behavior was cross-checked against the MIT-licensed AnimaEngine project by KillDaWill, especially its Gen V Pokégra role mapping and Nitro resource parsing. See `THIRD_PARTY_NOTICES.md`.
