import { icon as iconSvg } from './icons.ts';
import { skillOf } from '../game/skills.ts';
import type { IconName } from './iconPaths.ts';
import type { Task } from '../trades/types.ts';

export interface TaskBoardOptions {
  icon: IconName;
  title: string;
  subtitle: string;
  tasks: Task[];
  done: Set<string>;
}

/**
 * Small card listing client orders: the cork board shows them all, a station with several orders its own.
 * `open()` resolves with the task the visitor picked, or null if they closed the card.
 */
export class TaskBoard {
  root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  open({ icon, title, subtitle, tasks, done }: TaskBoardOptions) {
    const el = document.createElement('div');
    el.className = 'minigame board';
    el.innerHTML = `
      <section class="mg-card board-card" role="dialog" aria-label="${title}">
        <header class="mg-head">
          <span class="mg-icon">${iconSvg(icon)}</span>
          <div class="mg-heading"><small>${subtitle}</small><h1>${title}</h1></div>
          <button class="mg-close" aria-label="Fermer">${iconSvg('x')}</button>
        </header>
        <div class="board-list">
          ${tasks.map((task) => `
            <button class="board-task ${done.has(task.id) ? 'done' : ''}" data-task="${task.id}">
              <span class="board-icon">${iconSvg(task.icon)}</span>
              <span class="board-text"><b>${task.title}</b><small>${task.where}</small></span>
              <span class="board-status">${done.has(task.id) ? iconSvg(skillOf(task)!.icon) : 'À faire'}</span>
            </button>`).join('')}
        </div>
      </section>`;
    this.root.appendChild(el);

    return new Promise<Task | null>((resolve) => {
      const close = (task: Task | null) => {
        el.classList.add('leaving');
        setTimeout(() => el.remove(), 250);
        resolve(task);
      };
      el.querySelector('.mg-close')!.addEventListener('click', () => close(null));
      // Tapping the dimmed room around the card closes it too.
      el.addEventListener('click', (e) => {
        if (e.target === el) close(null);
      });
      for (const button of el.querySelectorAll<HTMLButtonElement>('.board-task')) {
        button.addEventListener('click', () => close(tasks.find((t) => t.id === button.dataset.task)!));
      }
    });
  }
}
