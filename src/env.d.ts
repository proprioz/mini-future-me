// The stand's settings, in .env.local (see .env.example).
interface ImportMetaEnv {
  /** Ids of the trades the stand shows, separated by commas (every trade by default). */
  readonly VITE_TRADES?: string;
  /** false (or 0, off, non) turns the photo scan off for the whole stand. */
  readonly VITE_SCAN?: string;
  readonly VITE_SCHOOL_NAME?: string;
  readonly VITE_SCHOOL_SITE?: string;
  readonly VITE_SCHOOL_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
