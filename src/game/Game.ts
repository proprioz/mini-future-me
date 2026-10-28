import * as THREE from 'three';
import { IsoStage } from './IsoStage.ts';
import { buildRoom, type Interactable, type Room } from './Room.ts';
import { PointerInput } from './PointerInput.ts';
import { ClickMarker, TileHighlight } from './markers.ts';
import { Character, type Look } from '../character/Character.ts';
import { Hud } from '../ui/Hud.ts';
import { TaskBoard } from '../ui/TaskBoard.ts';
import { StationPins } from '../ui/StationPins.ts';
import { skillOf } from './skills.ts';
import { trade } from '../trades/current.ts';
import { unlockedBy } from '../poster/unlocks.ts';
import { sound } from '../kiosk/sound.ts';
import { icon } from '../ui/icons.ts';
import type { Tile } from './Grid.ts';
import type { Results, Task } from '../trades/types.ts';

const START_TILE = { x: 3, z: 2 };
// Characters a bit larger than life, as in most isometric games, so faces stay readable.
const PLAYER_SCALE = 1.45;
// Lets the hop play before the mini-game covers the room.
const OPEN_DELAY = 450; // ms

function findItem(object: THREE.Object3D): Interactable | null {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (o.userData.item) return o.userData.item;
  return null;
}

export class Game {
  room: Room;
  stage: IsoStage;
  player: Character;
  clickMarker: ClickMarker;
  tileHighlight: TileHighlight;
  tasks: Task[];
  done: Set<string>;
  results: Results;
  busy: boolean;
  board: TaskBoard;
  pins: StationPins;
  hud: Hud;
  raycaster: THREE.Raycaster;
  hovered: Interactable | null;
  timer: THREE.Timer;
  /** Station of the next order, which glows softly. */
  nextItem!: Interactable | null;

  constructor(container: HTMLElement, look: Look) {
    this.room = buildRoom();
    this.stage = new IsoStage(container, {
      target: new THREE.Vector3(this.room.width / 2, 1.3, this.room.depth / 2),
      viewSize: { width: 10, height: 8.4 },
    });
    const { scene } = this.stage;
    scene.add(this.room.group);

    this.player = new Character(look);
    this.player.group.scale.setScalar(PLAYER_SCALE);
    this.player.placeAt(this.room.grid.center(START_TILE));
    this.player.lookAt(new THREE.Vector3(20, 0, 20));
    scene.add(this.player.group);

    this.clickMarker = new ClickMarker();
    this.tileHighlight = new TileHighlight();
    scene.add(this.clickMarker.mesh, this.tileHighlight.mesh);

    this.tasks = trade().tasks; // the client's orders, in order
    this.done = new Set<string>(); // ids of the tasks won: the domains of the job follow (skills.ts)
    this.results = {}; // what the visitor made in a task (game.result), by task id: see trade().creation
    this.busy = false; // a card (board or mini-game) is open
    this.board = new TaskBoard(document.body);
    this.pins = new StationPins(document.body, this.room.interactables, (item) => !this.busy && this.useItem(item));
    this.hud = new Hud(document.body);
    this.hud.setSkills(this.done);
    this.refreshMission();

    this.raycaster = new THREE.Raycaster();
    this.hovered = null;

    new PointerInput(this.stage.renderer.domElement, {
      onTap: (ndc) => this.handleTap(ndc),
      onHover: (ndc) => this.handleHover(ndc),
      onLeave: () => this.clearHover(),
      onPan: (dx, dy) => !this.busy && this.stage.panBy(dx, dy),
      onZoom: (factor, ndc, smooth) => !this.busy && (smooth ? this.stage.zoomBy(factor, ndc) : this.stage.zoomAt(factor, ndc)),
      onTurn: (angle, smooth) => !this.busy && (smooth ? this.stage.turnBy(angle) : this.stage.turnNow(angle)),
    });
    this.hud.onView({
      zoom: (factor) => !this.busy && this.stage.zoomBy(factor),
      turn: (angle) => !this.busy && this.stage.turnBy(angle),
    });

    this.timer = new THREE.Timer();
  }

  start(): void {
    this.timer.reset();
    this.stage.renderer.setAnimationLoop((t) => this.tick(t));
  }

  stop(): void {
    this.stage.renderer.setAnimationLoop(null);
  }

  tick(timestamp: number): void {
    this.timer.update(timestamp);
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const time = this.timer.getElapsed();
    this.player.update(dt, time);
    this.clickMarker.update(dt);
    this.nextItem?.setGlow(0.5 + 0.5 * Math.sin(time * 4));
    this.stage.render();
    this.pins.update(this.stage.camera, this.stage.renderer.domElement);
    this.hud.setViewLimits(this.stage);
  }

  /** What is under the pointer: an interactable item, or a floor tile. */
  pick(ndc: THREE.Vector2) {
    this.raycaster.setFromCamera(ndc, this.stage.camera);
    const [hit] = this.raycaster.intersectObject(this.room.group, true);
    if (!hit) return null;
    const item = findItem(hit.object);
    return item ? { item } : { tile: this.room.grid.tileAt(hit.point) };
  }

  handleTap(ndc: THREE.Vector2): void {
    if (this.busy) return;
    const hit = this.pick(ndc);
    if (!hit) return;
    if (hit.item) this.useItem(hit.item);
    else this.walkTo(hit.tile);
  }

  handleHover(ndc: THREE.Vector2): void {
    const hit = this.pick(ndc);
    const item = hit?.item ?? null;
    this.setHovered(item);

    const { grid } = this.room;
    if (hit?.tile && grid.isWalkable(hit.tile.x, hit.tile.z)) this.tileHighlight.show(grid.center(hit.tile));
    else this.tileHighlight.hide();
  }

  clearHover(): void {
    this.setHovered(null);
    this.tileHighlight.hide();
  }

  setHovered(item: Interactable | null): void {
    if (item === this.hovered) return;
    this.hovered?.setHighlight(false);
    item?.setHighlight(true);
    this.hovered = item;
    this.pins.setHovered(item?.id);
    this.stage.renderer.domElement.style.cursor = item ? 'pointer' : 'default';
  }

  walkTo(tile: Tile, onArrive?: () => void): void {
    const { grid } = this.room;
    const goal = grid.isWalkable(tile.x, tile.z) ? tile : grid.nearestWalkable(tile);
    if (!goal) return;
    const tiles = grid.findPath(grid.tileAt(this.player.position), goal);
    if (!tiles) return;
    // The first tile is the one we're standing on; skip it to avoid stepping back.
    if (tiles.length > 1) tiles.shift();
    this.clickMarker.show(grid.center(goal));
    this.player.walk(tiles.map((t) => grid.center(t)), onArrive);
  }

  useItem(item: Interactable, task: Task | null = null): void {
    this.walkTo(item.useTile, () => {
      this.player.lookAt(item.focus);
      this.player.hop();
      setTimeout(() => (task ? this.playTask(task) : this.openItem(item)), OPEN_DELAY);
    });
  }

  /** First order not delivered yet, in campaign order (null once they all are). */
  nextTask(): Task | null {
    return this.tasks.find((t) => !this.done.has(t.id)) ?? null;
  }

  /** Walks to the station of `task` and opens it. */
  goTo(task: Task): void {
    if (this.busy) return;
    this.useItem(this.room.interactables.find((i) => i.id === task.item)!, task);
  }

  /**
   * A station goes straight to its next order. The cork board lists every order, and a station whose
   * orders are all delivered (in media, the laptop has three) asks which one to play again.
   */
  async openItem(item: Interactable): Promise<void> {
    if (this.busy) return;
    const orders = item.id === 'orders';
    const tasks = orders ? this.tasks : this.tasks.filter((t) => t.item === item.id);
    const todo = !orders && tasks.find((t) => !this.done.has(t.id));
    if (todo || tasks.length === 1) {
      this.playTask(todo || tasks[0]);
      return;
    }
    this.clearHover();
    this.busy = true;
    const task = await this.board.open({
      icon: item.icon,
      title: orders ? 'Commandes clients' : item.label,
      subtitle: orders ? `${this.done.size}/${this.tasks.length} réussies` : 'Rejouer',
      tasks,
      done: this.done,
    });
    this.busy = false;
    if (!task) return;
    // From the board, walk over to the station where the order is played.
    if (task.item === item.id) this.playTask(task);
    else this.useItem(this.room.interactables.find((i) => i.id === task.item)!, task);
  }

  /** Opens a task by id, from wherever the player stands (handy from the devtools). */
  openTask(id: string): Promise<void> {
    return this.playTask(this.tasks.find((t) => t.id === id)!);
  }

  async playTask(task: Task): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.stop();
    this.clearHover();
    const replay = this.done.has(task.id);
    const last = this.tasks.every((t) => t === task || this.done.has(t.id));
    // The win screen offers to chain straight on to the next order (or to the poster after the last).
    const next = replay ? null : last ? `${icon('image')} Mon affiche` : `Suivante ${icon('arrow-right')}`;
    const game = new task.Game(task, { replay, next, results: this.results, done: new Set(this.done) });
    const won = await game.run(document.body);
    this.busy = false;
    this.start();
    if (!won) return;

    this.player.hop();
    if (game.result) this.results[task.id] = game.result;
    if (replay) return;
    this.done.add(task.id);
    this.hud.setSkills(this.done);
    this.refreshMission();
    if (last) {
      this.hud.toast(`${icon('confetti')} ${trade().skills.length} domaines du métier gagnés ! Crée ton affiche`, 6000);
      sound.play('fanfare');
      this.hud.highlight('poster');
    } else {
      // The domain the task trains: won, with what it unlocks for the poster, or how far it is.
      const skill = skillOf(task)!;
      const count = skill.tasks.filter((id) => this.done.has(id)).length;
      const won = count === skill.tasks.length;
      const unlocks = won ? unlockedBy(skill.id).map((u) => `${u.kind} « ${u.label} »`).join(', ') : '';
      const status = won ? `Domaine gagné : ${skill.label}` : `${skill.label} ${count}/${skill.tasks.length}`;
      this.hud.toast(`${icon(skill.icon)} ${status}${unlocks ? ` · Débloqué : ${unlocks}` : ''}`, 4500);
    }
    if (game.goNext) {
      if (last) this.hud.trigger('poster');
      else this.goTo(this.nextTask()!);
    }
  }

  /** Points at the next order: the mission button at the bottom and the bouncing station badge. */
  refreshMission(): void {
    const next = this.nextTask();
    this.nextItem?.setGlow(0);
    this.nextItem = this.room.interactables.find((i) => i.id === next?.item) ?? null;
    for (const item of this.room.interactables) {
      const tasks = this.tasks.filter((t) => t.item === item.id);
      if (item.id === next?.item) this.pins.set(item.id, 'next', next.title);
      else this.pins.set(item.id, tasks.length && tasks.every((t) => this.done.has(t.id)) ? 'done' : 'todo');
    }
    this.hud.setMission(next ? {
      icon: next.icon,
      title: next.title,
      go: `Y aller ${icon('arrow-right')}`,
      onClick: () => this.goTo(next),
    } : {
      icon: 'image',
      title: 'Crée ton affiche',
      go: `C’est parti ${icon('arrow-right')}`,
      onClick: () => this.hud.trigger('poster'),
    });
  }
}
