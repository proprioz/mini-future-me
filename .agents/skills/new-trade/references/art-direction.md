# Art direction: the game's DNA

"Lagon": a small floating diorama in the spirit of Monument Valley, Wes Anderson pastels, and chunky,
friendly UI like a Nintendo game. Everything is procedural (Three.js primitives, 2D canvas): no image
files, no 3D models.

## Palette and roles

One palette, `src/render/palette.ts` (`PALETTE`, imported as `C`), mirrored as CSS tokens in
`src/style.css` (`--ink`, `--teal`, `--coral`, `--sun`…). Never invent a colour when one of these fits;
for shades, `mixHex()` and `shadeHex()` from `src/render/materials.ts`.

| Role | Colours |
|---|---|
| Text, outlines, dark metal and plastic | `ink` #1e3a4c, `inkSoft` |
| Environment, selection, "calm" furniture | `teal`, `tealDeep`, `tealMuted`, `aqua`, `mist` |
| Actions, things to press, accents | `coral`, `blush` |
| Rewards, light, warmth | `sun` |
| Secondary accents (sparingly) | `sky`, `lilac`, `leaf` |
| White objects, paper, appliances | `paper` (#fff), or very light greys like `#f3f6f8`, `#e2e9ee` |

The room's shell (pink walls, wainscot, honey parquet) is common and stays as it is. A trade-specific
colour (like `chroma`, the green screen) is added to `PALETTE` with a comment saying which trade uses it.

## Office stations (3D)

Read `src/trades/mediamatique/stations.ts` first: the desk, the photo corner and the copier are the
models to follow.

- **Built from primitives** with the helpers of `src/render/materials.ts`: `box(w, h, d, color, radius)`
  (rounded boxes, radius ≈ 0.01–0.04), `cylinder`, `sphere`, `place(object, x, y, z)`, `toon(color)`.
  Toon shading has a 3-step ramp: flat, cartoon-like. No textures except canvas ones.
- **Oversized and readable**: every station you can use is bigger than real life (the laptop is 0.86 wide
  on a 1.9-wide desk; the camera is scaled 1.4×). It must be recognisable at a glance from across the room,
  from its silhouette alone. A few strong details beat many small ones.
- **Proportions**: 1 unit = 1 floor tile; walls are 2.6 high; a table top is at ≈ 0.75; in the office,
  the avatar is drawn 1.45× its poster size (`PLAYER_SCALE` in `src/game/Game.ts`), so check stations
  next to it in a screenshot.
- **Group, then register**: build each station in a `THREE.Group`, add it to `ctx.group`, block its tiles
  (`ctx.grid.block`), then `makeInteractable(ctx, group, { id, label, icon, useTile, focus, hitbox })`.
  Hover highlight and the "next order" glow are applied automatically to every mesh in the group.
- **Screens and printed things** are `canvasTexture()` (from `src/game/Room.ts`) on a thin box, with
  `emissive: '#ffffff', emissiveMap: texture, emissiveIntensity: 0.5–0.6` so they glow softly. Draw them
  with the palette, in the same flat style as the mini-games. If they show something the visitor makes,
  repaint them when it changes (see `artTexture()` in the media stations).
- **Decor-only pieces** (like the media trade's ring light) are welcome: one per trade is enough to set
  the scene, without blocking paths.
- **Cozy, never realistic**: rounded edges, saturated pastels, ink-coloured dark parts, a little warm light
  (emissive `sun`/`#fff6e6` on lamps).
- Keep paths walkable: the avatar must reach each station's `useTile`, and the floor around the rug stays
  open.

## The held object

The object the avatar holds on the poster (`creation.mesh()`), and any hand prop (the media "camera" in
`src/character/poses.ts`), use the **character** materials: `cel(color, { rim })` and
`celMesh(geometry, material, { outline })` from `src/render/celMaterial.ts`, with a thin ink outline
(≈ 0.004). Size: a little shorter than the avatar's legs (the poster is 0.38 tall). Rounded geometry
(`RoundedBoxGeometry`, cylinders with enough segments). Centre it on its middle and set
`userData.size = { w, h, d }`.

## Poster decors (2D)

Read `src/poster/decors.ts` (shared decors) and `src/trades/mediamatique/decors.ts` (Studio photo).

- A decor is `{ id, label, draw(g) }`, painted on a 1000 × 1414 frame (A4 portrait). Use the exported
  helpers: `linear()` (gradients), `glow()` (soft light), `ellipse()`, `sparkle()`, `seeded()` (fixed
  random, so confetti stays put between redraws).
- **Composition**: the avatar stands in the middle, feet at `FEET_Y` (1115), from about y = 320 to 1115.
  The title covers the top (y < 330), the name card the bottom (y > 1050). Keep the middle open, put
  scenery on both sides (often symmetrical, like the two softboxes at x = 500 ± 405), and a floor from
  y ≈ 1000.
- **Style**: a vertical gradient or radial glow for the background, flat shapes with rounded corners,
  ink outlines (`C.ink`, `lineWidth` ≈ 9, round caps) on objects, white glows for light, a few sparkles.
  Warm and festive, like a celebration of the job.
- The trade decor shows the trade's world (a kitchen pass, a workshop…), simplified to a few iconic shapes.

## Pictograms

Phosphor icons only (`icon('name')`, `drawIcon()`), sticker style: thick ink outline over a pastel fill.
Add new names to `tools/build-icons.ts`, then `pnpm icons`. Pick the trade's icon among them too.
