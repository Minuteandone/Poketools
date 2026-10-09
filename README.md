# Pokémon BW Sprite Studio

A no-build, local-only web app for inspecting and editing Pokémon Black/White and Black 2/White 2 battle graphics in the Gen V Pokégra archive (`/a/0/0/4`).

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

## Touch-first Animation V3 (October 2026)

- **Move:** Tap a part, choose **Move whole part** or **Move keyframe**, and drag with a finger, mouse, or stylus.
- **Rotate/scale:** Switch the touch tool to rotation, uniform scale, width-only scale, or height-only scale. Drag sideways. Six touch-friendly nudge buttons provide stepwise rotation, scale and sprite changes.
- **Change sprite:** Choose **Change sprite (swipe)** to swipe through real NCER cells in the current keyframe. You can also choose a cell in the keyframe inspector.
- **Create a genuinely new sprite-mapped part:** Expand **Map a new part from the sprite sheet**, choose **Create new mapped sprite cell**, choose an allowed Nintendo DS object size (8×8, 16×16, etc.), then tap the **upper-left tile** of its graphic on the sheet. Press **＋ New part**. This creates an NCER cell and independent NANR animation, and adds an NMCR map record. No existing part needs to be copied.
- **Use an existing sprite cell instead:** Switch **New part source** to **Use existing sprite cell**, pick a cell, then press **＋ New part**. That part still gets its own animation track.
- **Find Pokémon by name:** Use the searchable-by-scrolling Pokémon dropdown (#001–#649); the form dropdown appears only when the selected Pokémon has alternative graphics supported by the current BW or B2W2 archive.

These edits work with the sprite tiles already in the animation sheet. Draw or modify those tiles through the existing **Sprite editor**. The mapper is not yet a PNG-to-NCGR importer or a freeform polygon editor: Nintendo DS OAM only supports specific rectangle dimensions. Only the user's locally opened ROM supplies sprite art.

### Automated checks

`node --test tests/smoke.mjs` runs fixture-based tests for new NCER cell serialization/reparse, preservation of existing OAM attributes, rectangle validation, UI controls, all 649 Pokémon names, and version-dependent form selectors. Tests contain no extracted assets or ROM files.

## Scope / next steps

This is the first module of a broader Black/White editor. The animation view currently focuses on the real part-animation stack (NCER/NANR/NMCR) and uses NMAR to locate the idle map when its label data is available. Planned expansion points include a higher-level NMAR timeline editor, complete sprite-sheet atlas authoring, female variants UI, undo/redo, import PNG → indexed tiles, additional animation tracks, and editors for other game systems. Part dragging, named forms, and archive relocation/rebuilding are available in V3.

## ROMs and copyrighted assets

No Pokémon ROM or extracted Pokémon artwork is bundled. Use a ROM you are legally entitled to use. All decoding/editing is performed in the browser.

## Credits

Format/parser behavior was cross-checked against the MIT-licensed AnimaEngine project by KillDaWill, especially its Gen V Pokégra role mapping and Nitro resource parsing. See `THIRD_PARTY_NOTICES.md`.


## Animation V2 (historical)

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