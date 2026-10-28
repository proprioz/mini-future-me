import { sound } from './sound.ts';
import { icon } from '../ui/icons.ts';

// Kiosk mode for the stand: back to the welcome screen when nobody plays any more, a full reset
// between two visitors, a hidden reset for the staff, and a soft click on every button.

const IDLE_SECONDS = 60; // without any touch, before "Tu es encore là ?"
const WARNING_SECONDS = 10; // countdown on that card before the reset
const STAFF_TAPS = 5; // quick taps in the top-left corner reset the game right away
const STAFF_WINDOW = 2500; // ms
const CORNER = 64; // px
const TAPPABLE = 'button, .choice, .swatch';

class Kiosk {
  watching: boolean;
  lastActivity: number;
  extensions: Set<{ seconds: number }>;
  staffTaps: number[];
  idleEnabled!: boolean;
  veil!: HTMLDivElement;
  warning!: HTMLDivElement;
  countdownEl!: HTMLElement;

  constructor() {
    this.watching = false;
    this.lastActivity = performance.now();
    this.extensions = new Set<{ seconds: number }>();
    this.staffTaps = [];
  }

  /** Sets up the overlays and listeners. `idle`: whether inactivity sends back to the welcome screen. */
  install(root: HTMLElement, { idle = true }: { idle?: boolean } = {}): void {
    this.idleEnabled = idle;
    this.veil = document.createElement('div');
    this.veil.className = 'kiosk-veil';
    this.warning = document.createElement('div');
    this.warning.className = 'kiosk-warning';
    this.warning.hidden = true;
    this.warning.innerHTML = `
      <section class="kiosk-warning-card" role="alertdialog" aria-label="Tu es encore là ?">
        <div class="kiosk-warning-icon" aria-hidden="true">${icon('eyes')}</div>
        <h1>Tu es encore là ?</h1>
        <p>Le jeu recommence dans</p>
        <div class="kiosk-countdown" aria-live="polite"></div>
        <button class="btn btn-primary">Je continue !</button>
      </section>`;
    root.append(this.warning, this.veil);
    this.countdownEl = this.warning.querySelector<HTMLElement>('.kiosk-countdown')!;
    // Dismissed on click (not on pointerdown), so that the tap ends on the card and doesn't go
    // through to whatever button lies under it.
    this.warning.addEventListener('click', () => {
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

  /** From now on, inactivity counts (the welcome screen itself never times out). */
  startWatching(): void {
    this.watching = this.idleEnabled;
    this.poke();
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

  check(): void {
    if (!this.watching) return;
    const idle = (performance.now() - this.lastActivity) / 1000 - this.limit;
    if (idle < 0) return;
    const left = Math.ceil(WARNING_SECONDS - idle);
    if (left <= 0) {
      this.reset();
      return;
    }
    if (this.warning.hidden) this.warning.hidden = false;
    if (this.countdownEl.textContent !== String(left)) {
      this.countdownEl.textContent = String(left);
      sound.play('tick');
    }
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
