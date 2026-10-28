# Mini Future Me: notes for coding assistants

These are the project's conventions, for any AI coding assistant (and for humans too). The game, its
decisions and its roadmap are in [PLAN.md](PLAN.md) (French version: PLAN.fr.md); how to add a trade is
in [docs/adding-a-trade.md](docs/adding-a-trade.md). When a roadmap step of PLAN.md is done, tick it in
both PLAN.md and PLAN.fr.md.

## Conventions

- **pnpm only** (never npm/npx): `pnpm install`, `pnpm dev` (http://localhost:5173), `pnpm build`.
- **`pnpm check` before you call a change done**: types (`pnpm typecheck`), CSS (`pnpm lint:css`), unit tests
  (`pnpm test`) and the game played in Edge (`pnpm test:e2e`); the CI runs the same on every push. When you
  change a rule of the game (or add one), add or adjust its test in `tests/`.
- **Check every visual or interactive change in a browser**: open the page, look, click. If your
  assistant can drive a browser (for example through the Playwright MCP server), let it do so itself; see
  "AI agents with browser tools" below.
- **UI sizes in `rem`, never in `px`** (except 1–2 px lines; `pnpm lint:css` checks it): `1rem` follows the screen size (16 px at
  1366×768, ~22 px in full HD, ~30 px at 1440p, see `html` in `src/style.css`), like the 3D scene. What is
  drawn in a UI canvas scales too (`getComputedStyle(document.documentElement).fontSize / 16`). Check at
  least at 1280×620, 1920×1080 and 3440×1440.
- **Game texts in French**, addressing the player with "tu" ("Touche le sol pour te déplacer"), inclusive
  (médiamaticien·ne). Code, comments and contributor docs in English.
- **Docs written respectfully and inclusively**: say what a piece of data about the visitor is used for,
  rather than what is not shown to them. The texts for visitors ("Dans les coulisses") name no brand
  (no browser, AI or software), except Google for the scan's models and the names of the libraries.
- **TypeScript, strict**, in ES modules, no framework. There is no compile step: Vite serves and builds the
  game, and Node runs `server/`, `tools/` and `scripts/` straight from the `.ts` files by stripping the types.
  So: imports keep their `.ts` extension, type-only imports use `import type`, and only erasable syntax (no
  `enum`, `namespace` or constructor parameter properties). Class fields are declared with their type; in a
  subclass, a field the base class sets is narrowed with `declare`. Classes by domain (`game/`,
  `character/`, `render/`, `ui/`, `trades/`).
- **Tests** in `tests/`: `tests/unit` (Vitest, in Node) checks the rules of the game (no mix of genders,
  A*, posters erased in time) and the contract of every trade; `tests/e2e` (Playwright) plays a whole
  visit of every trade with every request leaving the PC blocked, and checks the layout at the three sizes.
- No emojis in the UI: pictograms through `icon('name')` (HTML) or `drawIcon()` (canvas) from
  `src/ui/icons.ts`. For a new icon, add its Phosphor name to `tools/build-icons.ts`, then `pnpm icons`.
- Materials through `toon()` and the helpers of `src/render/materials.ts`, for a consistent style.
- **Trades**: everything specific to a trade lives in `src/trades/<id>/` behind the contract described in
  `docs/adding-a-trade.md` and typed in `src/trades/types.ts`; the common code (`game/`, `ui/`, `poster/`…) reads it through `trade()` and
  never names a trade.
- **Character options** (`src/character/options.ts`): few options, only traits that are common among
  people in Switzerland and plausible; a rare trait takes the closest option instead of getting its own
  (a single moustache, a single beard, goatee = moustache + around the mouth + chin). Clothing colours:
  only the main ones, the measurement takes the closest. Each option is coded `f`, `m` or neutral, and what
  the game picks by itself never mixes the two (only "Au hasard" does). An option that is no longer
  configurable can still be visible with a fixed value. A new option goes through the whole chain:
  frequency by gender and age (`population.ts`), measured likelihood (`src/scan/classify.ts`), ground truth
  and portrait sheets (`.claude/skills/portraits`), then `pnpm profils`.
- Everything must work **offline** (the booth may have no Internet): no CDN, MediaPipe models stored locally.
- **No image of a face may be stored or sent off the PC.**

## Skills

Task-specific instructions live in `.agents/skills/<name>/SKILL.md` (the Agent Skills format, read by most
coding assistants; `.claude/skills/` links to the same folders for Claude Code). If your tool does not load
skills by itself, read the matching `SKILL.md` before starting such a task.

- `new-trade`: designing and building a new trade with the same art direction and game feel as the
  existing ones. Use it for any new trade, station, mini-game, poster decor or held object.

`.claude/skills/portraits` is the author's improvement loop for the face scan; it needs the test
portraits, which are not in the repository.

## AI agents with browser tools

The repository ships a ready-made configuration for Claude Code (`.mcp.json`: the Playwright MCP server
on Edge, `--isolated`; `.claude/`: the portraits skill and its hook). Other tools ignore these files; set
up an equivalent if yours can drive a browser.

- After changing a file, reload the page (`browser_navigate`) **before** any `browser_evaluate`: Vite
  reloads the whole page on every change (no HMR without a framework) and kills the running script ("Execution
  context was destroyed"). Same after the kiosk reset, which calls `location.reload()`.
- `--isolated` gives each session its own in-memory browser profile, so several sessions can run at
  once; local storage starts empty every time.
- In development, `window.studio` exposes the screens and, once the game has started, `game` and
  `posterStudio` (see README.md, "Test portraits").
