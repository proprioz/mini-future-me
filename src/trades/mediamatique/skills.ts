import { PALETTE } from '../../render/palette.ts';
import type { Skill } from '../types.ts';

// What the visitor wins in the office: domains of the federal training plan (see the "Le métier"
// chapter in about.ts), each exercised by one or more tasks. A domain is won once all its `tasks` are
// done; "Mener des projets" is the whole client campaign. `tint` tells the badges apart.
export const SKILLS: Skill[] = [
  { id: 'content', label: 'Produire des contenus', icon: 'camera', tint: PALETTE.sky, tasks: ['shoot', 'retouch'] },
  { id: 'design', label: 'Concevoir des visuels', icon: 'palette', tint: PALETTE.lilac, tasks: ['layout'] },
  { id: 'marketing', label: 'Marketing et communication', icon: 'megaphone', tint: PALETTE.coral, tasks: ['publish', 'print'] },
  { id: 'projects', label: 'Mener des projets', icon: 'clipboard-text', tint: PALETTE.sun, tasks: ['shoot', 'retouch', 'layout', 'publish', 'print'] },
];
