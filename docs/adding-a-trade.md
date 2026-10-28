# Adding a trade

[Version française](adding-a-trade.fr.md)

The game makes short, simple demos: a few gestures of a trade, in a single room, in about 5 minutes. Pick
what can happen in one room (an office, a workshop, a front desk, a surgery…) and is fun to do with a
finger; leave the rest to the "Le métier" chapter.

A trade ("filière") is what the visitor discovers in a game: the client's orders played in the office,
the domains of the job they train, the work stations, and the object the avatar holds on the final
poster. Everything else (welcome, photo scan, avatar creator, office room, poster studio, export, kiosk
mode) is common to every trade.

The media trade, **Mini Future Me Médiamaticien·ne** (`src/trades/mediamatique/`), is the complete example: copy its structure.

**With an AI assistant**: point it to the [`new-trade`](../.agents/skills/new-trade/SKILL.md) skill. It holds
the workflow (research, concept, checkpoints) and the game's DNA (art direction, how a mini-game plays,
how to write the job's content), so the new trade matches the others. Most assistants find it on their own
in `.agents/skills/`.

**Rather hand it over?** The game's creator can build the trade with your school, on quotation: open a
["New trade" request](https://github.com/proprioz/mini-future-me/issues/new?template=nouvelle-filiere.yml).

## 1. Register the trade

In `src/trades/index.ts`, add an entry to `TRADES`:

```ts
{
  id: 'cuisine',                      // folder name, and value of VITE_TRADES / ?filiere
  job: 'cuisinier·ère',               // the job, inclusive, lower case: the trade is called "Mini Future Me Cuisinier·ère"
  icon: 'cooking-pot',                // pictogram (see "Pictograms" below)
  pitch: 'Recettes, dressage, service', // one line on the trade choice card
  load: () => import('./cuisine/index.ts'),
},
```

Then try it with http://localhost:5173/?filiere=cuisine, and at the booth with `VITE_TRADES=cuisine` (or
`VITE_TRADES=mediamatique,cuisine` to offer both on the welcome screen).

## 2. The trade module

`src/trades/<id>/index.ts` exports by default an object with these fields, typed by `TradeModule` in
`src/trades/types.ts`: end it with `} satisfies TradeModule;` (see `mediamatique/index.ts`) and your editor
and `pnpm typecheck` point out a missing field or a wrong pictogram name.

| Field | What it is |
|---|---|
| `scan` | `false` to skip the photo scan for this trade (visitors create the avatar by hand); on by default, unless the booth turns it off with `VITE_SCAN=false` |
| `welcome.highlight` | `[icon, text]`, the middle tile of the welcome screen ("Un métier créatif") |
| `tasks` | the client's orders, in order (see 3) |
| `skills` | the domains of the job, each `{ id, label, icon, tint, tasks: [task ids] }`; won once all its tasks are done |
| `finalSkill` | id of the domain won with the whole order (shown on the last win screen) |
| `buildStations(ctx)` | builds the work stations in the office (see 4) |
| `creation` | the object the avatar holds on the poster (see 5) |
| `studio` | `decors`, `poses`, `unlocks`, `titles`, optionally `defaultDecor` (see 6) |
| `poster.caption` | the line under the visitor's name on the poster |
| `about.chapter` | the "Le métier" chapter of "Dans les coulisses", same shape as the common chapters of `src/ui/AboutPanel.ts` |
| `phone.fact` | a word about the job on the phone page of the poster, after the job's name |

Import the trade's CSS from `index.ts` (`import './style.css'`): it loads with the trade.

## 3. Tasks: the mini-games

Each task is `{ id, item, where, icon, title, Game, brief, win, fact }` (see `mediamatique/tasks.ts`):

- `item`: id of the station where it is played; several tasks may share a station.
- `where`: where it is played, for the cork board ("sur le laptop").
- `brief`: the client's request, one line; `win`: the title of the win screen; `fact`: the one thing to
  remember about the job.
- `Game`: a class extending `src/minigames/MiniGame.ts`. Build the game in `play(el)` and call
  `this.end(true)` when it is won, or `this.end(false, 'what to fix')`. The helpers `loop`, `after`,
  `listen`, `canvasPoint` and `feedback` clean up after themselves.
- A game that makes something sets `this.result`; the game keeps it in `results[task.id]`, which later
  tasks receive (`this.results`).

The rules of the game, from PLAN.md: 30 to 60 seconds per task, no blocking failure and no timer, the
bare minimum of text (one line of request, one short sentence per instruction), and it must work with a
finger as well as with a mouse.

## 4. Office stations

`buildStations(ctx)` adds the trade's furniture to the common room (`src/game/Room.ts`). `ctx` holds the
`group` to add meshes to and the walking `grid`. Use the helpers exported by `Room.ts`:

- `makeInteractable(ctx, object, { id, label, icon, useTile, focus, hitbox })` registers a station: `id` is
  the `item` of its tasks, `useTile` the tile where the avatar stands to use it, `focus` the point it looks
  at (the badge floats above it), `hitbox` an invisible box that widens the tap target.
- `ctx.grid.block([x, z], …)` marks the tiles the furniture stands on.
- `addTo`, `canvasTexture`, and the materials of `src/render/materials.ts` (`box`, `cylinder`, `toon`…).

The room is 7 × 5 tiles. Free for the stations: the back wall from x = 1 (a plant stands in the corner),
the left wall from z = 3 (the cork board and its sideboard are at z = 1–2), and the floor away from the rug
(around 3.4, 2.9) and the beanbag (tile 1, 4). Keep stations big: each one should read at a glance.

## 5. The object the avatar holds

`creation` has three fields:

- `from(results)`: what the visitor made, from the tasks' results, or `null` if not made yet (the poses then
  hold nothing, and "Fier·ère" is not offered).
- `mesh(data)`: builds the object, a `THREE.Object3D` centred on its middle, with
  `userData.size = { w, h, d }` in world units (the avatar's legs are about 0.4 long). It is called again
  whenever the prop is rebuilt: cache what is costly to draw.
- `holds`: by pose id, what overrides how that pose holds the object (`hand`, `grip`, `depth`, `lean`, `turn`,
  `tilt`; see `hold()` in `src/character/poses.ts`). The shared poses are made for a flat sheet held by its
  edge: a bulky object (a cake, a chair) will want its own grips, e.g. `proud: { grip: [0, -1, 0] }` to rest
  it on the hands.

## 6. Poster studio

- `decors` and `poses`: lists, in order, of ids of the shared ones (`src/poster/decors.ts`: lagoon, party,
  city, premiere; `src/character/poses.ts`: proud, wave, cheer, hero) or of the trade's own objects, in the
  same format (the media trade adds a "Studio photo" decor and a "Photographe" pose).
- `unlocks`: by decor or pose id, the id of the domain to win first; the others are free.
- `titles`: the titles over the avatar, `{ id, lines: [line 1, line 2] }`; the first is the default.
- `defaultDecor`: id of the decor shown first (the first one otherwise).

## Pictograms

Icons are Phosphor names listed in `tools/build-icons.ts`: add the ones your trade needs, then run
`pnpm icons`.

## Checklist

- [ ] Entry in `src/trades/index.ts`, module in `src/trades/<id>/`
- [ ] Every task can be won in 30 to 60 s, with a mouse and with a finger
- [ ] Stations readable at a glance, nothing blocking the paths between them
- [ ] The held object looks right in every pose (with and without it)
- [ ] Job chapter checked with the training's official plan, no brand names
- [ ] Checked at 1280×620, 1920×1080 and 3440×1440, no console errors
- [ ] `pnpm check` passes: the tests check every trade on their own (ids that match, a domain for every task, stations reachable, a whole visit offline)
- [ ] README (both languages): the trade in the table of trades
