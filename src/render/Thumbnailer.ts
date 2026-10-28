import { Character } from '../character/Character.ts';
import type { Look } from '../character/Character.ts';
import type { Expression } from '../character/FaceTexture.ts';
import type { Pose } from '../character/poses.ts';
import { applyPose } from '../character/poses.ts';
import { CharacterStage } from './CharacterStage.ts';
import type { StageView, ViewName } from './CharacterStage.ts';

export interface ThumbnailOptions {
  view: ViewName | StageView;
  heading: number;
  expression?: Expression;
  pose?: Pose | null;
}

/** Renders option thumbnails (square) with an off-screen stage and a spare character. */
export class Thumbnailer {
  stage: CharacterStage;
  character: Character;

  constructor(size: number) {
    this.stage = new CharacterStage({ pedestal: false, shadows: false });
    this.stage.setSize(size, size);
    this.character = new Character();
    this.stage.scene.add(this.character.group);
  }

  draw(canvas: HTMLCanvasElement, look: Partial<Look>, { view, heading, expression = 'happy', pose = null }: ThumbnailOptions): void {
    this.character.setLook(look);
    this.character.setExpression(expression);
    this.character.heading = this.character.targetHeading = heading;
    this.character.update(0, 0); // apply the idle pose
    applyPose(this.character, pose);
    this.stage.setView(view);
    this.stage.render();
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(this.stage.canvas, 0, 0, canvas.width, canvas.height);
  }
}
