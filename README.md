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
- Experimental **non-destructive patched-ROM export**. The exporter recompresses and repacks Pokégra, can grow the archive when structural animation edits need more room, updates affected FAT offsets, and never modifies the source ROM.

## Run it

Because the app uses ES modules, serve the folder with any static HTTP server instead of opening `index.html` as a `file://` URL.

```bash
python -m http.server 8000
```

Then open `http://localhost:8000/`.

## Scope / next steps

This is the first module of a broader Black/White editor. The animation view currently focuses on the real part-animation stack (NCER/NANR/NMCR) and uses NMAR to locate the idle map when its label data is available. Planned expansion points include a higher-level NMAR timeline editor, draggable sprite parts, form-name metadata, female variants UI, undo/redo, import PNG → indexed tiles, NARC relocation/rebuild for edits that grow beyond their original compressed slots, and editors for other game systems.

## ROMs and copyrighted assets

No Pokémon ROM or extracted Pokémon artwork is bundled. Use a ROM you are legally entitled to use. All decoding/editing is performed in the browser.

## Credits

Format/parser behavior was cross-checked against the MIT-licensed AnimaEngine project by KillDaWill, especially its Gen V Pokégra role mapping and Nitro resource parsing. See `THIRD_PARTY_NOTICES.md`.


## Animation V2

The animation editor now has a visual part workflow:

- Click a visible sprite part or select it from the Parts list.
- Hide/show individual parts in the editor without changing the ROM.
- Drag a whole part to edit its NMCR base position.
- Switch drag mode to **Active keyframe motion** to animate the selected part visually.
- Scrub and step through the animation timeline.
- Add/delete keyframes and edit cell, duration, X/Y motion, rotation, and X/Y scale.
- Add a new part with its own independent NANR animation track.
- Duplicate a part into a new independent animation track.
- Delete map parts.
- Show optional part bounds for easier selection.

Structural animation edits rebuild the NMCR/NANR resources rather than pretending new records fit into the original binary layout.

## Larger edits / ROM repacking

Pokégra is now repacked when edited members change size. If the rebuilt archive grows past its original file slot, the ROM exporter can move later filesystem files forward, update their FAT entries, and consume unused padding at the end of the ROM while keeping the overall ROM size unchanged. This makes real new parts and extra keyframes exportable instead of limiting every member to its original byte count.