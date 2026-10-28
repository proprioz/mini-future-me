import * as THREE from 'three';

// Maximum finger/mouse travel (px) for a press to still count as a tap.
const TAP_SLOP = 12;
// Zoom factor per wheel pixel: one notch of a mouse wheel (~100 px) zooms by about 15 %.
const WHEEL_ZOOM = 0.0015;
// Turn (radians) for a drag across the whole width: the ±20° of the camera fit in a short drag.
const DRAG_TURN = 1.5;
// Turn (radians) per pixel of horizontal scroll (trackpad).
const WHEEL_TURN = 0.003;

/** Callbacks of `PointerInput`; `wheel` is true for a mouse wheel or trackpad, false for a drag or pinch. */
export interface PointerHandlers {
  onTap: (ndc: THREE.Vector2, pointerType: string) => void;
  onHover: (ndc: THREE.Vector2) => void;
  onLeave: () => void;
  onPan: (dx: number, dy: number) => void;
  onZoom: (factor: number, ndc: THREE.Vector2, wheel: boolean) => void;
  onTurn: (angle: number, wheel: boolean) => void;
}

interface PressedPointer {
  x: number;
  y: number;
  startX: number;
  startY: number;
  turn: boolean;
}

interface Pinch {
  distance: number;
  angle: number;
  x: number;
  y: number;
}

/**
 * Unified mouse + touch + pen input via Pointer Events.
 * Reports positions in normalized device coordinates, ready for raycasting.
 * A press that travels drags the view (`onPan`), two fingers pinch it and the wheel zooms (`onZoom`).
 * Dragging with the right mouse button, twisting two fingers or scrolling sideways turns it (`onTurn`).
 */
export class PointerInput {
  element: HTMLElement;
  pointers: Map<number, PressedPointer>;
  dragging: boolean;
  pinch: Pinch | null;

  constructor(element: HTMLElement, { onTap, onHover, onLeave, onPan, onZoom, onTurn }: PointerHandlers) {
    this.element = element;
    this.pointers = new Map(); // pressed pointers by id: { x, y, startX, startY, turn (right button) }
    this.dragging = false; // the press moved too far to be a tap
    this.pinch = null; // { distance, angle, x, y } of the two fingers on the last move

    element.addEventListener('pointerdown', (e) => {
      element.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, {
        x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, turn: e.button === 2,
      });
      if (this.pointers.size === 1) this.dragging = false;
      else {
        // A second finger: no tap any more, the gesture is a pinch until every finger is lifted.
        this.dragging = true;
        this.pinch = this.measurePinch();
      }
    });

    element.addEventListener('pointermove', (e) => {
      const pointer = this.pointers.get(e.pointerId);
      if (!pointer) {
        // Hover only makes sense with a mouse; on touch there is no cursor.
        if (e.pointerType === 'mouse') onHover(this.toNdc(e));
        return;
      }
      const dx = e.clientX - pointer.x;
      const dy = e.clientY - pointer.y;
      Object.assign(pointer, { x: e.clientX, y: e.clientY });

      if (this.pointers.size >= 2) {
        const pinch = this.measurePinch();
        onZoom(pinch.distance / this.pinch!.distance, this.toNdc(pinch), false);
        onPan(pinch.x - this.pinch!.x, pinch.y - this.pinch!.y);
        // Wrapped to [-π, π] so that crossing the vertical doesn't jump a whole turn.
        onTurn(Math.atan2(Math.sin(pinch.angle - this.pinch!.angle), Math.cos(pinch.angle - this.pinch!.angle)), false);
        this.pinch = pinch;
        return;
      }
      if (!this.dragging && Math.hypot(e.clientX - pointer.startX, e.clientY - pointer.startY) > TAP_SLOP) {
        this.dragging = true;
        onLeave();
      }
      if (!this.dragging) return;
      // The right button turns the room: dragging right brings its front corner along to the right.
      if (pointer.turn) onTurn((-dx / element.clientWidth) * DRAG_TURN, false);
      else onPan(dx, dy);
    });

    const release = (e: PointerEvent, tap: boolean) => {
      const pointer = this.pointers.get(e.pointerId);
      if (!pointer) return;
      this.pointers.delete(e.pointerId);
      if (this.pointers.size === 1) this.pinch = null;
      if (tap && !this.dragging && !pointer.turn && this.pointers.size === 0) onTap(this.toNdc(e), e.pointerType);
    };
    element.addEventListener('pointerup', (e) => release(e, true));
    element.addEventListener('pointercancel', (e) => release(e, false));

    element.addEventListener('wheel', (e) => {
      e.preventDefault();
      // Pinching a trackpad comes as a wheel with ctrlKey and small deltas: it gets a stronger factor.
      const delta = e.deltaY * (e.deltaMode === 1 ? 33 : 1) * (e.ctrlKey ? 8 : 1);
      onZoom(Math.exp(-delta * WHEEL_ZOOM), this.toNdc(e), true);
      if (e.deltaX) onTurn(-e.deltaX * (e.deltaMode === 1 ? 33 : 1) * WHEEL_TURN, true);
    }, { passive: false });

    element.addEventListener('pointerleave', () => onLeave());
    element.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /** Distance, angle (clockwise on screen) and midpoint (client px) of the first two pressed pointers. */
  measurePinch(): Pinch {
    const [a, b] = this.pointers.values();
    return {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      angle: Math.atan2(b.y - a.y, b.x - a.x),
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    };
  }

  /** Normalized device coordinates of a client position (an event, or `{ x, y }`). */
  toNdc({ clientX, clientY, x = clientX!, y = clientY! }: { clientX?: number; clientY?: number; x?: number; y?: number }): THREE.Vector2 {
    const rect = this.element.getBoundingClientRect();
    return new THREE.Vector2(
      ((x - rect.left) / rect.width) * 2 - 1,
      -((y - rect.top) / rect.height) * 2 + 1,
    );
  }
}
