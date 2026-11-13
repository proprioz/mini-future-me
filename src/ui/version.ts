// The version of the game running on this PC (set by vite.config.ts when it builds), in the PC's time:
// in the « Le code » chapter of « Dans les coulisses », and small in a corner when the stand turns it on
// in .env.local: VITE_VERSION=true on the welcome screen, VITE_VERSION=partout on every screen (staging).
const { version, commit, date } = __BUILD__;
const updated = new Date(date);
const setting = import.meta.env.VITE_VERSION ?? '';

export const VERSION = {
  /** Where the corner stamp shows (nowhere by default). */
  stamp: /^partout$/i.test(setting) ? 'everywhere' : /^(true|1|on|oui)$/i.test(setting) ? 'welcome' : 'none',
  /** package.json's version, such as « 0.1.0 ». */
  number: version,
  /** The last commit, such as « 5f691d8 »; empty when the game is not a git clone. */
  commit,
  /** Such as « 13.11.2026 ». */
  date: updated.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' }),
  /** Such as « 14:32 ». */
  time: updated.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }),
};

/** The corner stamp, such as « Version 0.1.0 (5f691d8) · mise à jour le 13.11.2026 à 14:32 ». */
export const versionStamp = () =>
  `<p class="version-stamp">Version ${VERSION.number}${VERSION.commit ? ` (${VERSION.commit})` : ''} · mise à jour le ${VERSION.date} à ${VERSION.time}</p>`;
