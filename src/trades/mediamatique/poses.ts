import type { Pose } from '../../character/poses.ts';

// The media trade's own pose for the poster, in the format of the shared ones (character/poses.ts):
// a camera in both hands, or in one hand with the poster in the other.
export const PHOTOGRAPHER: Pose = {
  id: 'photographer', label: 'Photographe',
  leftArm: { fwd: 0.55, out: -0.1, bend: 1.35, bendOut: -0.55 },
  rightArm: { fwd: 0.55, out: -0.1, bend: 1.35, bendOut: -0.55 },
  head: { tilt: 0.06, nod: 0.04 },
  props: { camera: { hand: 'both', depth: -0.03 } },
  withCreation: {
    rightArm: { out: 0.32, fwd: 0.2, bend: 0.25 },
    props: {
      camera: { hand: 'left', depth: -0.03, turn: -0.3 },
      creation: { hand: 'right', grip: [0.55, 0.8], depth: 0.03, tilt: -0.1, turn: 0.15 },
    },
  },
};
