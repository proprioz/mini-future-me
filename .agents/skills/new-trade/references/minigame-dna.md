# Mini-games: how a task plays

Read `src/minigames/MiniGame.ts` (the common base) and the five media games in
`src/trades/mediamatique/`: `ProPrint.ts` is the simplest (choices, then a check), `PhotoRetouch.ts`
uses sliders with a live score, `ProductShoot.ts` chains steps on a canvas, `PosterLayout.ts` is drag
and drop (with a tap-tap alternative), `SocialPublish.ts` an animated reveal.

## The feel

- **One real gesture of the job**, simplified until a 13-year-old gets it in a few seconds. The visitor
  should leave having *done* something recognisable (framing a photo, choosing CMYK), not having read
  about it.
- **30 to 60 seconds**, then the win screen. Chain 2 to 4 short steps at most.
- **No blocking failure, no timer, no score to beat.** Feedback says what to change ("Trop sombre : plus
  de lumière."), the visitor tries again at their pace. If a check fails at the end, `this.end(false,
  hint)` shows "Presque !" with one hint per mistake, and "Réessayer" keeps what was right (see how
  `ProPrint` keeps `this.values` across rounds).
- **Touch first**: big targets, sliders and segmented buttons rather than small handles, drag always
  doubled by tap-then-tap. Nothing depends on hover or on the keyboard.
- **Something visual reacts to every action**: a canvas preview that changes as you set it (the print
  preview gets blurry at 72 dpi, the photo darkens), a ✓ when a setting is right, a short sound.
- Randomise the target a little each round (the right light power changes) so replaying is not just
  repeating.

## Building blocks

The card (header with the task's icon, title and the client's one-line `brief`, close button) and the
result screens come from `MiniGame`. In `play(el)`, build the body with the shared classes of
`src/style.css`:

| Class | Use |
|---|---|
| `.mg-visual` (+ `.mg-fit` to keep a canvas's ratio) | the big visual on the left: a canvas, or HTML |
| `.mg-side` | the panel on the right, stacked: |
| `.mg-step` | small uppercase step label ("Étape 2/3", "LUMIÈRE") |
| `.mg-text` | the instruction, one short sentence, key words in `<b>` |
| `.mg-field` + `.mg-field-label` + `.mg-seg` / `.mg-seg-option` (`.selected`) | a setting with 2–4 choices |
| `.mg-slider` (`.ok` shows a ✓) | a slider with its label in a `<span>` |
| `.mg-feedback` (`data-tone` = `ok` / `warn`, set by `this.feedback(el, html, tone)`) | the live feedback line, shakes on change |
| `.mg-actions` + `.btn .btn-primary` (`.ready` pulses when it is time) | the final action ("Imprimer", "Déclencher") |

Trade-specific styling goes in the trade's `style.css`, with classes prefixed by the game
(`print-…`, `shoot-…`), sizes in `rem`.

Helpers of `MiniGame`, all cleaned up when the round ends: `this.loop(fn)` (per frame),
`this.after(ms, fn)`, `this.listen(target, type, fn)`, `this.canvasPoint(canvas, event)`,
`this.feedback(el, html, tone)`. Draw canvases at a fixed internal size (e.g. 1200 × 800) and let CSS
scale them. Wait for text in canvases: fonts are loaded before `play()` is called.

Sounds (`sound.play(name)` from `src/kiosk/sound.ts`): `tap` (a choice), `tick` (a slider step or a
small success), `pop` (something appears), `sparkle` (a step done), `shutter`, `oops` and `star` /
`fanfare` (played by `MiniGame` itself on the result screens). Add a new synthesized sound there if the
trade really needs one (no audio files).

## Sharing what was made

A game that makes something sets `this.result` before `this.end(true)`; later tasks read
`this.results[taskId]`, and `creation.from(results)` turns it into the held object. When a later task
needs an earlier result that was not played yet, use a sensible default (media: `DEFAULT_DESIGN`), so
the orders can be played in any order from the cork board.

## Texts

French, "tu", inclusive, as short as possible: the `brief` is the client speaking in one line ("Une belle
photo de notre limonade !"); each instruction is one sentence; the win title (`win`) says what was just
made ("C'est dans la boîte !"); the `fact` is one sentence about the job, the thing to remember. Use the
job's real words (CMJN, fonds perdus, mise au point) and let the context explain them.
