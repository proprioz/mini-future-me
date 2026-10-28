---
name: new-trade
description: Designs and builds a new trade ("filière") for Mini Future Me — its client story, office work stations, mini-games, the object the avatar holds on the poster, poster decor and texts — in the same art direction and game feel as the existing media trade (Mini Future Me Médiamaticien·ne). Use when someone wants to add a trade or job to the game, create a new set of tasks or mini-games, design new office furniture or a poster decor, or asks how to make the game about another profession.
---

# New trade

A trade is a folder `src/trades/<id>/` behind the contract described in `docs/adding-a-trade.md`. The
common game (welcome, scan, avatar, room, poster studio, export) never changes for a new trade. The media
trade, `src/trades/mediamatique/`, is the reference implementation: read it before writing anything, and
reuse its patterns rather than inventing new ones.

The goal is that every trade feels like the same game. Follow the references:

- [references/art-direction.md](references/art-direction.md): palette and its roles, 3D furniture and
  stations, screens and canvas drawings, poster decors, the held object.
- [references/minigame-dna.md](references/minigame-dna.md): how a task plays, the building blocks of the
  mini-game card, texts, feedback and sounds.
- [references/trade-content.md](references/trade-content.md): finding the content (training plan,
  domains), the client story, the job chapter, and how to write the French texts.

## Workflow

Work in this order, and stop at each **checkpoint** to show the human what you propose before going on:
a trade is mostly content decisions, and the person adding it knows the job better than you.

1. **Research the job** (trade-content.md): the official training plan (in Switzerland, the SERI
   ordinance and training plan of the federal VET diploma, and orientation.ch), its domains of
   competence, what an apprentice really does.
2. **Write the concept**, one short page:
   - the client and their order: one story, from first step to finished product (media: a lemonade
     brand's campaign, from the product shoot to the printed posters);
   - 4 to 6 tasks, each one a real gesture of the job that a 13-year-old can do in 30 to 60 seconds, all
     in one room (the common room becomes the trade's office, workshop, front desk, surgery…). The game
     is a short, simple demo: choose a few telling gestures rather than covering the whole job, and be
     inventive when the trade mostly happens outdoors or on site (its preparation, its tools, a
     workshop corner);
   - 3 to 5 domains of the job (from the training plan), each trained by one or more tasks, plus a final
     domain won with the whole order;
   - the work stations (2 to 4, a task may share a station) and where they stand in the room;
   - the object made (what the avatar holds on the poster);
   - one trade decor for the poster and, if it makes sense, one trade pose;
   - the job, inclusive (it names the trade: "Mini Future Me Cuisinier·ère"), and the pitch.

   **Checkpoint**: get the concept approved.
3. **Register the trade** in `src/trades/index.ts` and create `src/trades/<id>/index.ts` with the contract
   fields. Start with placeholder tasks (a `MiniGame` that ends on a button) so the whole loop runs
   (welcome → office → poster) before any real mini-game exists. Try it with `?filiere=<id>`.
4. **Build the stations** (`stations.ts`, art-direction.md). **Checkpoint**: a screenshot of the office.
5. **Build the mini-games**, one at a time (minigame-dna.md), each in its own file, with its CSS in the
   trade's `style.css`. Play each one with the mouse and by touch before the next.
6. **Build the held object** (`creation.ts`) and check it in every pose of the poster studio, with and
   without it; add `holds` overrides if it floats or clips.
7. **Paint the trade decor** (and pose), wire `studio`, `poster`, `phone`, `welcome`.
8. **Write the job chapter** (`about.ts`, trade-content.md). **Checkpoint**: have the texts read by
   someone who knows the job.
9. **Verify**: the checklist at the end of `docs/adding-a-trade.md`, at 1280×620, 1920×1080 and
   3440×1440, with no console errors, then `pnpm check` and `pnpm build`.
10. **Document**: add the trade to the table of trades in `README.md` and `README.fr.md`, and a section
    for it in `PLAN.md` and `PLAN.fr.md` (like "Media trade: Mini Future Me Médiamaticien·ne").

## Rules that are easy to miss

- The common code must not name the trade: if you need something new from the trade, add a field to the
  contract (and document it in `docs/adding-a-trade.md` and its French version) instead of an `if`.
- Never copy the media trade's art (the bottle, the green screen, the poster layout) into another trade;
  copy its *patterns*.
- Everything offline: no image or font from the Internet, no CDN. Draw procedurally (canvas, Three.js
  primitives) like the rest of the game; a new pictogram goes through `tools/build-icons.ts`.
- No emojis in the UI, sizes in `rem`, game texts in French with "tu" and inclusive job names.
- The conventions in `AGENTS.md` apply throughout.
