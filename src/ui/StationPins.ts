import * as THREE from 'three';
import { icon } from './icons.ts';
import type { Interactable } from '../game/Room.ts';

const point = new THREE.Vector3();

export type PinState = 'todo' | 'next' | 'done';

interface Pin {
  item: Interactable;
  pin: HTMLButtonElement;
  label: HTMLElement;
}

/**
 * Round badges floating above each work station, so visitors see at a glance what can be used, what
 * is done and where the next order is. They are big tap targets too: the phone or the camera are
 * small in the room, their badge is not. The next order's badge bounces and shows its name.
 */
export class StationPins {
  el: HTMLDivElement;
  pins: Pin[];

  constructor(root: HTMLElement, items: Interactable[], onTap: (item: Interactable) => unknown) {
    this.el = document.createElement('div');
    this.el.className = 'pins';
    this.pins = items.map((item) => {
      const pin = document.createElement('button');
      pin.className = 'pin';
      pin.dataset.state = 'todo';
      pin.innerHTML = `<span class="pin-icon">${icon(item.icon)}</span><span class="pin-label"></span>`;
      pin.setAttribute('aria-label', item.label);
      pin.addEventListener('click', () => onTap(item));
      this.el.appendChild(pin);
      return { item, pin, label: pin.querySelector<HTMLElement>('.pin-label')! };
    });
    root.appendChild(this.el);
    this.setHovered(null);
  }

  /** `state`: 'todo', 'next' (the order to do now), 'done' (all its orders delivered). */
  set(id: string, state: PinState, label?: string) {
    const entry = this.pins.find((p) => p.item.id === id)!;
    entry.pin.dataset.state = state;
    entry.label.textContent = label ?? entry.item.label;
  }

  setHovered(id: string | null | undefined) {
    for (const { item, pin } of this.pins) pin.classList.toggle('hovered', item.id === id);
  }

  /** Follows the stations on screen; called every frame. */
  update(camera: THREE.Camera, canvas: HTMLElement) {
    const { width, height } = canvas.getBoundingClientRect();
    for (const { item, pin } of this.pins) {
      point.copy(item.markerAt).project(camera);
      pin.style.transform = `translate(${((point.x + 1) / 2) * width}px, ${((1 - point.y) / 2) * height}px)`;
    }
  }
}
