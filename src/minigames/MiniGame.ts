import { fontsReady } from '../ui/fonts.ts';
import { sound } from '../kiosk/sound.ts';
import { icon } from '../ui/icons.ts';
import { skillBadge, skillById, skillOf, skillProgress } from '../game/skills.ts';
import { trade } from '../trades/current.ts';
import type { Results, Task } from '../trades/types.ts';

export interface MiniGameOptions {
  replay?: boolean;
  next?: string | null;
  results?: Results;
  done?: Set<string>;
}

/**
 * Base for the task mini-games of every trade: an overlay card with the client's request in its header, straight
 * into the game, then the result (the domain of the job it trains and one fact about it, or a hint and
 * "Réessayer").
 * Subclasses build the game in `play(el)` and call `this.end(success, message)` when it is over.
 * `run()` resolves with true once the task is won and the visitor goes back to the office.
 * `next`: label of a button on the win screen that chains on to what comes next; `goNext` then tells
 * whether it was pressed. `results`: what the visitor made in earlier tasks, by task id (a game that
 * makes something sets `this.result`). `done`: ids of the tasks already won, for the domains' progress.
 */
export class MiniGame {
  task: Task;
  done: Set<string>;
  replay: boolean;
  next: string | null;
  results: Results;
  /** What the game made, kept in `results[task.id]` for the later tasks. */
  result?: unknown;
  goNext: boolean;
  playing: boolean;
  frame: number;
  cleanups: (() => void)[];
  el!: HTMLElement;
  card!: HTMLElement;
  body!: HTMLElement;
  resolve: ((won: boolean) => void) | null = null;

  constructor(task: Task, { replay = false, next = null, results = {}, done = new Set<string>() }: MiniGameOptions = {}) {
    this.task = task;
    this.done = done;
    this.replay = replay;
    this.next = next;
    this.results = results;
    this.goNext = false;
    this.playing = false;
    this.frame = 0;
    this.cleanups = [];
  }

  async run(root: HTMLElement): Promise<boolean> {
    const { task } = this;
    this.el = document.createElement('div');
    this.el.className = 'minigame';
    this.el.innerHTML = `
      <section class="mg-card" role="dialog" aria-label="${task.title}">
        <header class="mg-head">
          <span class="mg-icon">${icon(task.icon)}</span>
          <div class="mg-heading">
            <h1>${task.title}</h1>
            <p class="mg-quote">${icon('chat-circle-dots')} ${task.brief}</p>
          </div>
          <button class="mg-close" aria-label="Fermer">${icon('x')}</button>
        </header>
        <div class="mg-body"></div>
      </section>`;
    root.appendChild(this.el);
    this.card = this.el.querySelector<HTMLElement>('.mg-card')!;
    this.body = this.el.querySelector<HTMLElement>('.mg-body')!;
    this.el.querySelector('.mg-close')!.addEventListener('click', () => this.close(false));

    await fontsReady();
    this.startPlay();
    return new Promise<boolean>((resolve) => {
      this.resolve = resolve;
    });
  }

  /** Replaces the card's content; the results fit in a smaller card than the game. */
  setScreen(html: string, { compact = true } = {}): HTMLElement {
    this.card.classList.toggle('mg-compact', compact);
    this.body.innerHTML = html;
    return this.body.firstElementChild as HTMLElement;
  }

  startPlay() {
    const el = this.setScreen('<div class="mg-play"></div>', { compact: false });
    this.playing = true;
    this.play(el);
  }

  /** Builds the game inside `el`. Implemented by each mini-game. */
  play(_el: HTMLElement): void {}

  /** Ends the round. `message` (HTML, only shown on a miss) says what to fix. */
  end(success: boolean, message = '') {
    if (!this.playing) return;
    this.playing = false;
    this.cleanup();
    if (success) this.showWin();
    else this.showRetry(message);
  }

  showWin() {
    sound.play('star');
    // The domain this task trains, and the trade's final domain (the whole order) when this was its
    // last task; their rings fill from where they were.
    const after = new Set([...this.done, this.task.id]);
    const final = skillById(trade().finalSkill);
    const skills = [skillOf(this.task)!];
    if (!this.replay && final && final !== skills[0] && skillProgress(final, after) === 1) skills.push(final);
    const screen = this.setScreen(`
      <div class="mg-screen mg-result">
        <div class="mg-skills">${skills.map((skill) => {
          const count = skill.tasks.filter((id) => after.has(id)).length;
          return `
          <div class="mg-skill" data-progress="${count / skill.tasks.length}">
            ${skillBadge(skill, skillProgress(skill, this.done))}
            <span>${skill.label}${count < skill.tasks.length ? ` <small>${count}/${skill.tasks.length}</small>` : ''}</span>
          </div>`;
        }).join('')}
        </div>
        <h2>${this.replay ? 'Bien joué !' : this.task.win}</h2>
        <aside class="mg-fact">${icon('lightbulb')} ${this.task.fact}</aside>
        <div class="mg-actions">
          <button class="btn ${this.next ? 'btn-ghost' : 'btn-primary'}" data-action="back">${icon('arrow-left')} Bureau</button>
          ${this.next ? `<button class="btn btn-primary" data-action="next">${this.next}</button>` : ''}
        </div>
      </div>`);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const el of screen.querySelectorAll<HTMLElement>('.mg-skill')) {
        const badge = el.querySelector<HTMLElement>('.skill-badge')!;
        badge.style.setProperty('--progress', el.dataset.progress ?? '0');
        badge.classList.toggle('on', el.dataset.progress === '1');
      }
    }));
    screen.querySelector('[data-action="back"]')!.addEventListener('click', () => this.close(true));
    screen.querySelector('[data-action="next"]')?.addEventListener('click', () => {
      this.goNext = true;
      this.close(true);
    });
  }

  showRetry(message: string) {
    sound.play('oops');
    const screen = this.setScreen(`
      <div class="mg-screen mg-result">
        <div class="mg-oops" aria-hidden="true">${icon('smiley-nervous')}</div>
        <h2>Presque !</h2>
        <div class="mg-message">${message}</div>
        <div class="mg-actions">
          <button class="btn btn-ghost" data-action="later">Plus tard</button>
          <button class="btn btn-primary" data-action="retry">Réessayer</button>
        </div>
      </div>`);
    screen.querySelector('[data-action="later"]')!.addEventListener('click', () => this.close(false));
    screen.querySelector('[data-action="retry"]')!.addEventListener('click', () => this.startPlay());
  }

  close(won: boolean) {
    this.playing = false;
    this.cleanup();
    this.el.classList.add('leaving');
    setTimeout(() => this.el.remove(), 250);
    this.resolve?.(won);
    this.resolve = null;
  }

  // ------------------------------------------------------------ helpers for the games

  /** Calls `fn(dt, time)` every frame until the round ends. */
  loop(fn: (dt: number, time: number) => void) {
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      fn(dt, now / 1000);
      if (this.playing) this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  /** `setTimeout` that is cancelled if the round ends or the card closes first. */
  after(ms: number, fn: () => void) {
    const id = setTimeout(() => this.playing && fn(), ms);
    this.cleanups.push(() => clearTimeout(id));
  }

  /** Event listener removed when the round ends. */
  listen<K extends keyof HTMLElementEventMap>(target: EventTarget, type: K, fn: (event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): void;
  listen(target: EventTarget, type: string, fn: (event: any) => void, options?: boolean | AddEventListenerOptions): void;
  listen(target: EventTarget, type: string, fn: (event: any) => void, options?: boolean | AddEventListenerOptions) {
    target.addEventListener(type, fn, options);
    this.cleanups.push(() => target.removeEventListener(type, fn, options));
  }

  cleanup() {
    cancelAnimationFrame(this.frame);
    for (const fn of this.cleanups.splice(0)) fn();
  }

  /** Pointer position in the canvas' own pixel coordinates. */
  canvasPoint(canvas: HTMLCanvasElement, event: { clientX: number; clientY: number }) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  /** Shows a short feedback line; `tone` is 'ok', 'warn' or '' (neutral). */
  feedback(el: HTMLElement, text: string, tone = '') {
    el.innerHTML = text;
    el.dataset.tone = tone;
    el.classList.remove('bump');
    void el.offsetWidth; // restart the animation
    el.classList.add('bump');
  }
}
