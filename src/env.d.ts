// The stand's settings, in .env.local (see .env.example).
interface ImportMetaEnv {
  /** Ids of the trades the stand shows, separated by commas (every trade by default). */
  readonly VITE_TRADES?: string;
  /** false (or 0, off, non) turns the photo scan off for the whole stand. */
  readonly VITE_SCAN?: string;
  /** The game's version in a corner: true (or 1, on, oui) on the welcome screen, partout on every screen. */
  readonly VITE_VERSION?: string;
  readonly VITE_SCHOOL_NAME?: string;
  readonly VITE_SCHOOL_SITE?: string;
  readonly VITE_SCHOOL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Set by vite.config.ts: package.json's version, the last commit (empty without git) and its ISO date. */
declare const __BUILD__: { version: string; commit: string; date: string };
