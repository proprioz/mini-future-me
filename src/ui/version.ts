// The version of the game running on this PC (set by vite.config.ts when it builds), in the PC's time:
// in the « Le code » chapter of « Dans les coulisses », and in a corner of the welcome screen when the
// stand turns it on with VITE_VERSION=true (in .env.local).
const { version, commit, date } = __BUILD__;
const updated = new Date(date);

export const VERSION = {
  /** Shown in a corner of the welcome screen (off by default). */
  onWelcome: /^(true|1|on|oui)$/i.test(import.meta.env.VITE_VERSION ?? ''),
  /** package.json's version, such as « 0.1.0 ». */
  number: version,
  /** The last commit, such as « 5f691d8 »; empty when the game is not a git clone. */
  commit,
  /** Such as « 13.11.2026 ». */
  date: updated.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  /** Such as « 14:32 ». */
  time: updated.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }),
};
