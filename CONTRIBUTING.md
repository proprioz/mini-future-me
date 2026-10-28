# Contributing to Mini Future Me

[Version française](CONTRIBUTING.fr.md)

Thanks for your interest! The game is used at career fair booths by schools; contributions are welcome,
from a typo fix to a whole new trade.

## Getting started

You need [Node.js](https://nodejs.org) 22.18 or newer (it runs the TypeScript of the server and the tools as is) and [pnpm](https://pnpm.io), the project's package manager
(its lockfile is `pnpm-lock.yaml`). Only have npm? `npm install -g pnpm` once, then the commands below.

```bash
pnpm install                 # also copies the photo scan's runtime and models into public/
cp .env.example .env.local   # optional: trades and school of your booth (Windows: copy instead of cp)
pnpm dev                     # the game on http://localhost:5173
pnpm server                  # optional, in a second terminal: the booth server, for the poster's QR code
```

Once `pnpm install` has run, you need neither Internet nor photos: "Sans photos, à la main" on the welcome
screen creates the avatar by hand. Any editor with TypeScript support shows type errors as you type. The
end-to-end tests also need Microsoft Edge, the booth's browser, or Playwright's Chromium (see "Checking
your change").

The game and the design decisions are described in [PLAN.md](PLAN.md); the code layout in the
[README](README.md#structure).

## Conventions

The full list is in [AGENTS.md](AGENTS.md). The essentials:

- Strict TypeScript in ES modules, no framework and no compile step (imports keep their `.ts` extension,
  `import type` for types, no `enum`). Follow the style of the surrounding code: naming, comment density,
  English comments.
- **Game texts in French**, addressing the player with "tu", inclusive (médiamaticien·ne), as short as
  possible. Contributor docs (README, CONTRIBUTING, PLAN, docs/) exist in English and French: update
  both. Internal working notes (`docs/portraits-journal.md`, the portraits skill) stay in French.
- UI sizes in `rem`; pictograms through `icon()`, never emojis; materials through `toon()`.
- The character's options only cover traits that are common in Switzerland, and what the game picks on
  its own never mixes genders (see AGENTS.md before adding an option).
- **Privacy**: everything stays on the PC, works offline, and no image of a face is stored or sent
  anywhere. A change that breaks this cannot be merged.

## Checking your change

`pnpm check` runs everything the CI runs on your pull request: the types (`pnpm typecheck`), the CSS
(`pnpm lint:css`), the rules of the game and the contract of every trade (`pnpm test`), then a whole visit
of every trade in Edge, offline (`pnpm test:e2e`). If you change a rule of the game, add or adjust its test
in `tests/`.

The end-to-end tests open the installed Microsoft Edge. Without Edge (on Linux, for example), install
Playwright's Chromium once with `pnpm exec playwright install chromium`, then run
`E2E_BROWSER=chromium pnpm test:e2e` (PowerShell: `$env:E2E_BROWSER="chromium"; pnpm test:e2e`). A failed
test leaves a trace in `test-results/`: `pnpm exec playwright show-trace <its trace.zip>` replays it step by
step.

The tests don't play the mini-games' gestures nor look at the result: check in a browser too.

- Play the parts you changed, with the mouse and, if you can, with touch.
- Look at the result at least at 1280×620, 1920×1080 and 3440×1440 (the interface scales with the screen).
- Keep an eye on the console: no errors.
- `pnpm build` must pass.

## Adding a trade

A trade (its tasks, its office stations, the object the avatar holds, its texts) is a folder in
`src/trades/`. Follow [docs/adding-a-trade.md](docs/adding-a-trade.md); with an AI assistant, point it to the
[`new-trade`](.agents/skills/new-trade/SKILL.md) skill. Talking about it first in a
["New trade" request](https://github.com/proprioz/mini-future-me/issues/new?template=nouvelle-filiere.yml) helps: someone may already be on it, and if your school would rather hand
the work over, the game's creator can take it on, on quotation.

## Pull requests

- One change per pull request, with a short description of what and why.
- A screenshot when the interface changes.
- Mention the screen sizes and browsers you checked.

## Using an AI assistant (optional)

Use whatever setup you like: any editor, any AI assistant or LLM, or none at all.

- The conventions for assistants are in [AGENTS.md](AGENTS.md), a file most coding assistants read on
  their own.
- Skills for recurring tasks are in `.agents/skills/` (the Agent Skills format, which most assistants load
  on their own): `new-trade` guides the creation of a trade in the game's style.
- If your assistant can drive a browser, the Playwright MCP server is a good way to let it check the
  interface itself (open, look, click); AGENTS.md has a few tips for it.
- The repository includes a ready-made configuration for Claude Code (`.mcp.json` and `.claude/`: the
  portraits skill and its hook). Other tools simply ignore these files.
- Whatever writes the code, you remain its author: read it, understand it and test it yourself before
  opening a pull request.

## License

By contributing, you agree that your contribution is published under the project's license,
[GPL-3.0-or-later](LICENSE).
