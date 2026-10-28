import type * as THREE from 'three';
import type { MiniGame } from '../minigames/MiniGame.ts';
import type { RoomContext } from '../game/Room.ts';
import type { Grip, Pose } from '../character/poses.ts';
import type { Decor } from '../poster/decors.ts';
import type { Chapter } from '../ui/AboutPanel.ts';
import type { IconName } from '../ui/iconPaths.ts';

// The contract between the common game and a trade (see docs/adding-a-trade.md): what a trade's
// module exports by default, and its entry in trades/index.ts.

/** A client order, played as a mini-game at one of the trade's stations. */
export interface Task {
  id: string;
  /** Id of the station where the task is played (`id` given to makeInteractable()). */
  item: string;
  /** Where it is played, for the cork board ("sur le laptop"). */
  where: string;
  icon: IconName;
  title: string;
  Game: typeof MiniGame;
  /** The client's request, one line. */
  brief: string;
  /** Title of the win screen. */
  win: string;
  /** The one thing to remember about the job, on the win screen. */
  fact: string;
}

/** A domain of the job, won once all its `tasks` are done. */
export interface Skill {
  id: string;
  label: string;
  icon: IconName;
  /** CSS colour of its badge. */
  tint: string;
  tasks: string[];
}

/** What a game made, by task id (each mini-game's `result`). */
export type Results = Record<string, unknown>;

/** The object the avatar holds on the poster. */
export interface Creation<T = any> {
  /** What the visitor made, from the tasks' results, or null if not made yet. */
  from(results: Results): T | null;
  /** The object, centred on its middle, with `userData.size = { w, h, d }` in world units. */
  mesh(data: T): THREE.Object3D;
  /** By pose id, what overrides how that pose holds the object. */
  holds?: Record<string, Grip>;
}

export interface PosterTitle {
  id: string;
  lines: [string, string];
}

export interface Studio {
  /** Ids of the shared decors (poster/decors.ts) or the trade's own. */
  decors: (string | Decor)[];
  /** Ids of the shared poses (character/poses.ts) or the trade's own. */
  poses: (string | Pose)[];
  /** By decor or pose id, the id of the skill to win first. */
  unlocks?: Record<string, string>;
  /** Titles over the avatar; the first is the default. */
  titles: PosterTitle[];
  defaultDecor?: string;
}

/** What a trade's module (src/trades/<id>/index.ts) exports by default. */
export interface TradeModule {
  /** false: visitors create the avatar by hand, without the photo scan. */
  scan?: boolean;
  welcome: { highlight: [IconName, string] };
  tasks: Task[];
  skills: Skill[];
  /** Id of the skill won with the whole order. */
  finalSkill: string;
  buildStations(ctx: RoomContext): void;
  creation: Creation;
  studio: Studio;
  poster: { caption: string };
  about: { chapter: Chapter };
  phone: { fact: string };
}

/** A trade's entry in trades/index.ts: what the welcome screen needs before loading it. */
export interface TradeEntry {
  id: string;
  /** The job, inclusive, lower case ("médiamaticien·ne"). */
  job: string;
  icon: IconName;
  /** One line on the trade choice card. */
  pitch: string;
  load: () => Promise<{ default: TradeModule }>;
}

/** An entry of enabledTrades(): with the job's name ("Médiamaticien·ne") and the game's title. */
export interface TradeMeta extends TradeEntry {
  name: string;
  title: string;
}

/** A trade once loaded (loadTrade()): its entry and its module. */
export type Trade = TradeMeta & TradeModule;
