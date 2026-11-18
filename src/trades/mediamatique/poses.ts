import { POSES } from '../../character/poses.ts';
import type { Pose } from '../../character/poses.ts';

// The media trade's version of a shared pose for the poster (character/poses.ts).

// Fier·ère, offered from the start: the shared pose shows the poster laid out in both hands, and holds
// the camera the same way until the poster is made.
const shared = POSES.find((pose) => pose.id === 'proud')!;
export const PROUD: Pose = {
  ...shared,
  needsCreation: false,
  props: { camera: { hand: 'both', depth: 0.02 } },
  withCreation: { props: shared.props },
};
