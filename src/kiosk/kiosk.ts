import { sound } from './sound.ts';
import { icon } from '../ui/icons.ts';

// Kiosk mode for the stand: a pause when nobody plays any more, a full reset between two visitors,
// « Recommencer à zéro » (a corner button, also on the pause card, always confirmed), a hidden reset
// for the staff, and a soft click on every button. Every way of starting over goes back to the
// welcome screen.

const IDLE_SECONDS = 60; // without any touch, before the game pauses on "Es-tu là ?"
const STAFF_TAPS = 5; // quick taps in the top-left corner reset the game right away
const STAFF_WINDOW = 2500; // ms
const CORNER = 64; // px
const TAPPABLE = 'button, .choice, .swatch';

const card = (label: string, body: string) =>
  `<section class="kiosk-warning-card" role="alertdialog" aria-label="${label}">${body}</section>`;
const CARDS = {
  idle: card('Es-tu là ?', `
    <div class="kiosk-warning-icon" aria-hidden="true">${icon('eyes')}</div>
    <h1>Es-tu là ?</h1>
    <p>Le jeu est en pause.</p>
    <button class="btn btn-primary">Je suis là</button>
    <button class="btn btn-ghost" data-answer="ask-restart">${icon('arrows-counter-clockwise')} Recommencer à zéro</button>`),
  restart: card('Recommencer à zéro ?', `
    <div class="kiosk-warning-icon" aria-hidden="true">${icon('arrows-counter-clockwise')}</div>
    <h1>Recommencer à zéro ?</h1>
    <p>Tu reviens au début du jeu : ton perso, tes domaines gagnés et ton affiche seront effacés.</p>
    <button class="btn btn-primary" data-answer="restart">Oui, recommencer</button>
    <button class="btn btn-ghost">Non, je continue</button>`),
};

class Kiosk {
  watching: boolean;
  lastActivity: number;
  extensions: Set<{ seconds: number }>;
  staffTaps: number[];
  idleEnabled!: boolean;
  veil!: HTMLDivElement;
  warning!: HTMLDivElement;
  restartButton!: HTMLButtonElement;

  constructor() {
    this.watching = false;
    this.lastActivity = performance.now();
    this.extensions = new Set<{ seconds: number }>();
    this.staffTaps = [];
  }

  /** Sets up the overlays and listeners. `idle`: whether inactivity pauses the game. */
  install(root: HTMLElement, { idle = true }: { idle?: boolean } = {}): void {
    this.idleEnabled = idle;
    this.veil = document.createElement('div');
    this.veil.className = 'kiosk-veil';
    this.warning = document.createElement('div');
    this.warning.className = 'kiosk-warning';
    this.warning.hidden = true;
    this.restartButton = document.createElement('button');
    this.restartButton.className = 'kiosk-restart';
    this.restartButton.hidden = true;
    this.restartButton.setAttribute('aria-label', 'Recommencer à zéro');
    this.restartButton.innerHTML = icon('arrows-counter-clockwise');
    this.restartButton.addEventListener('click', () => this.ask('restart'));
    root.append(this.restartButton, this.warning, this.veil);
    // The card covers the whole screen until the visitor answers, so nothing can be touched behind
    // it. Answered on click (not on pointerdown), so that the tap ends on the card and doesn't go
    // through to whatever button lies under it. Any tap goes back to the game, except the restart
    // buttons: starting over always takes a second, deliberate tap.
    this.warning.addEventListener('click', (e) => {
      const answer = (e.target as Element).closest<HTMLElement>('[data-answer]')?.dataset.answer;
      if (answer === 'ask-restart') return this.ask('restart');
      if (answer === 'restart') return this.reset();
      this.warning.hidden = true;
      this.poke();
    });

    for (const type of ['pointerdown', 'pointermove', 'keydown', 'wheel']) {
      window.addEventListener(type, () => this.poke(), { capture: true, passive: true });
    }
    window.addEventListener('pointerdown', (e) => {
      if ((e.target as Element).closest?.(TAPPABLE) && !(e.target as Element).closest(':disabled')) sound.play('tap');
      this.staffCorner(e);
    }, { capture: true });
    setInterval(() => this.check(), 250);
  }

  /** From now on, inactivity counts and the visitor can start over (not on the welcome screen). */
  startWatching(): void {
    this.watching = this.idleEnabled;
    this.restartButton.hidden = false;
    this.poke();
  }

  /** Shows the card: « Es-tu là ? » (`idle`) or the confirmation before starting over (`restart`). */
  ask(card: keyof typeof CARDS): void {
    this.warning.innerHTML = CARDS[card];
    this.warning.hidden = false;
    sound.play('pop');
  }

  /** Something happened (a touch, a key…): the visitor is still there. */
  poke(): void {
    if (!this.warning.hidden) return; // only an answer on the card counts once it is shown
    this.lastActivity = performance.now();
  }

  /** Allows `seconds` of inactivity while a slow step is shown; call the returned function after. */
  extend(seconds: number): () => void {
    const extension = { seconds };
    this.extensions.add(extension);
    this.poke();
    return () => {
      this.extensions.delete(extension);
      this.poke();
    };
  }

  get limit(): number {
    return Math.max(IDLE_SECONDS, ...[...this.extensions].map((e) => e.seconds));
  }

  /** Pauses the game on "Es-tu là ?" once nobody has touched it for `limit` seconds. */
  check(): void {
    if (!this.watching || !this.warning.hidden) return;
    if ((performance.now() - this.lastActivity) / 1000 < this.limit) return;
    this.ask('idle');
  }

  staffCorner(event: PointerEvent): void {
    if (event.clientX > CORNER || event.clientY > CORNER) return;
    const now = performance.now();
    this.staffTaps = [...this.staffTaps.filter((t) => now - t < STAFF_WINDOW), now];
    if (this.staffTaps.length >= STAFF_TAPS) this.reset();
  }

  /**
   * Back to the welcome screen for the next visitor. Reloading the page is the surest way to forget
   * everything: look, first name, domains won, scan measurements. Posters already sent to the
   * stand server stay there until they expire, so the QR code keeps working.
   */
  reset(): void {
    this.watching = false;
    this.warning.hidden = true;
    this.veil.classList.add('closing');
    setTimeout(() => location.reload(), 450);
  }
}

export const kiosk = new Kiosk();
