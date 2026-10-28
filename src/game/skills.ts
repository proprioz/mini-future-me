import { icon } from '../ui/icons.ts';
import { trade } from '../trades/current.ts';
import type { Skill, Task } from '../trades/types.ts';

// The domains of the job the visitor wins in the office: `trade().skills`, each one
// { id, label, icon, tint, tasks } and won once all its `tasks` are done.

export const skillById = (id: string | undefined) => trade().skills.find((skill) => skill.id === id);

/** Share of the skill's tasks in `done` (a set of task ids), from 0 to 1. */
export function skillProgress(skill: Skill, done: Set<string>) {
  return skill.tasks.filter((id) => done.has(id)).length / skill.tasks.length;
}

/** Ids of the skills whose tasks are all in `done`. */
export function wonSkills(done: Set<string>) {
  return new Set(trade().skills.filter((skill) => skillProgress(skill, done) === 1).map((skill) => skill.id));
}

/** The domain a task trains, the one shown on its win screen and order card. */
export function skillOf(task: Task) {
  return trade().skills.find((skill) => skill.tasks.includes(task.id));
}

/** Round badge of `skill`: its ring fills with `progress`, the pictogram takes the skill's colour once won. */
export function skillBadge(skill: Skill, progress: number, extra = '') {
  return `<span class="skill-badge ${progress === 1 ? 'on' : ''} ${extra}" style="--skill: ${skill.tint}; --progress: ${progress}">`
    + `${icon(skill.icon, { tint: null })}</span>`;
}
