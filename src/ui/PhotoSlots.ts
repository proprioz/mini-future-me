import { icon } from './icons.ts';
import type { IconName } from './iconPaths.ts';

/** A photo slot, and the view of the visitor it shows. */
export type SlotName = 'front' | 'left' | 'right' | 'back';

/** The photos given, by slot (only the filled ones). */
export type PhotoSources = Partial<Record<SlotName, ImageBitmap>>;

interface Slot {
  name: SlotName;
  label: string;
  icon: IconName;
  required?: boolean;
}

interface DecodedPhoto {
  bitmap: ImageBitmap;
  file: File;
}

export interface PhotoSlotsOptions {
  sort: (bitmaps: ImageBitmap[]) => Promise<(SlotName | null)[]>;
  onChange?: () => void;
  onError?: (file: File) => void;
}

export const SLOTS: Slot[] = [
  { name: 'front', label: 'De face', icon: 'smiley-blank', required: true },
  { name: 'left', label: 'Profil gauche', icon: 'arrow-fat-left' },
  { name: 'right', label: 'Profil droit', icon: 'arrow-fat-right' },
  { name: 'back', label: 'De dos', icon: 'user' },
];

/**
 * The four photo slots. A click opens the file picker, where several photos can be picked at once;
 * dropping files works too. A single photo goes into the slot it was given to, several are sorted
 * into their slots by `sort` (bitmaps → slot names, null when unsure). Photos are decoded in memory
 * for the analysis and never stored: `clear()` forgets them.
 */
export class PhotoSlots {
  sort: PhotoSlotsOptions['sort'];
  onChange: PhotoSlotsOptions['onChange'];
  onError: PhotoSlotsOptions['onError'];
  photos: Partial<Record<SlotName, { bitmap: ImageBitmap; url: string }>>;
  sorting: boolean;
  generation: number;
  el: HTMLDivElement;

  constructor(root: HTMLElement, { sort, onChange, onError }: PhotoSlotsOptions) {
    this.sort = sort;
    this.onChange = onChange;
    this.onError = onError; // a file the browser cannot decode (HEIC from an iPhone, not an image…)
    this.photos = {}; // name → { bitmap, url }
    this.sorting = false;
    this.generation = 0; // bumped by clear(): photos still being sorted are then dropped

    this.el = document.createElement('div');
    this.el.className = 'photo-slots';
    this.el.innerHTML = SLOTS.map((slot) => `
      <label class="photo-slot" data-slot="${slot.name}">
        <input type="file" accept="image/*" multiple hidden>
        <img alt="">
        <span class="photo-slot-icon">${icon(slot.icon)}</span>
        <span class="photo-slot-label">${slot.label}${slot.required ? '' : ' <small>(facultatif)</small>'}</span>
        <button type="button" class="photo-slot-remove" aria-label="Retirer la photo">${icon('x')}</button>
      </label>`).join('');
    root.appendChild(this.el);

    for (const slotEl of this.el.querySelectorAll<HTMLElement>('.photo-slot')) {
      const { slot } = slotEl.dataset as { slot: SlotName };
      const input = slotEl.querySelector('input')!;
      input.addEventListener('change', () => {
        this.add([...input.files!], slot);
        input.value = '';
      });
      slotEl.querySelector('.photo-slot-remove')!.addEventListener('click', (e) => {
        e.preventDefault();
        this.remove(slot);
      });
      slotEl.addEventListener('dragover', (e) => {
        e.preventDefault();
        slotEl.classList.add('dragover');
      });
      slotEl.addEventListener('dragleave', () => slotEl.classList.remove('dragover'));
      slotEl.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        slotEl.classList.remove('dragover');
        this.add([...e.dataTransfer!.files], slot);
      });
    }
    // Files dropped between the slots are always sorted.
    this.el.addEventListener('dragover', (e) => e.preventDefault());
    this.el.addEventListener('drop', (e) => {
      e.preventDefault();
      this.add([...e.dataTransfer!.files]);
    });
  }

  /** `files` picked on `slot` (or dropped anywhere): one goes there, several are sorted. */
  async add(files: File[], slot?: SlotName) {
    // Sorted by name, so 01_face, 02_profil_gauche… keep their order when the sorting is unsure.
    const images = files.filter((file) => file.type.startsWith('image/'))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, SLOTS.length);
    if (!images.length) return;
    const generation = this.generation;
    this.setSorting(true);
    const photos = (await Promise.all(images.map((file) => this.decode(file)))).filter(Boolean) as DecodedPhoto[];
    const guesses = photos.length > 1 || !slot ? await this.sort(photos.map((p) => p.bitmap)) : null;
    if (generation !== this.generation) {
      for (const photo of photos) photo.bitmap.close();
      return;
    }
    if (guesses) this.place(photos, guesses);
    else if (photos.length) this.show(slot!, photos[0]);
    this.setSorting(false);
  }

  /** Each photo into its guessed slot; the unsure ones and duplicates fill the slots left. */
  place(photos: DecodedPhoto[], guesses: (SlotName | null)[]) {
    const placed = new Map<SlotName, DecodedPhoto>(); // slot name → photo
    const unsure: DecodedPhoto[] = [];
    photos.forEach((photo, i) => {
      const guess = guesses?.[i];
      if (guess && !placed.has(guess)) placed.set(guess, photo);
      else unsure.push(photo);
    });
    // Empty slots first, so a second batch doesn't replace the photos of the first one.
    const left = SLOTS.map((s) => s.name).filter((name) => !placed.has(name))
      .sort((a, b) => Number(Boolean(this.photos[a])) - Number(Boolean(this.photos[b])));
    unsure.forEach((photo, i) => placed.set(left[i], photo));
    for (const [name, photo] of placed) this.show(name, photo);
  }

  async decode(file: File): Promise<DecodedPhoto | null> {
    try {
      return { bitmap: await createImageBitmap(file), file }; // applies the EXIF orientation of phone photos
    } catch {
      this.onError?.(file);
      return null;
    }
  }

  show(name: SlotName, { bitmap, file }: DecodedPhoto) {
    this.remove(name, { silent: true });
    const url = URL.createObjectURL(file);
    this.photos[name] = { bitmap, url };
    const slotEl = this.el.querySelector(`[data-slot="${name}"]`)!;
    slotEl.querySelector('img')!.src = url;
    slotEl.classList.add('filled');
    this.onChange?.();
  }

  setSorting(sorting: boolean) {
    this.sorting = sorting;
    this.el.classList.toggle('sorting', sorting);
    this.onChange?.();
  }

  remove(name: SlotName, { silent = false } = {}) {
    const photo = this.photos[name];
    if (!photo) return;
    photo.bitmap.close();
    URL.revokeObjectURL(photo.url);
    delete this.photos[name];
    const slotEl = this.el.querySelector(`[data-slot="${name}"]`)!;
    slotEl.querySelector('img')!.removeAttribute('src');
    slotEl.classList.remove('filled');
    if (!silent) this.onChange?.();
  }

  get ready() {
    return Boolean(this.photos.front) && !this.sorting;
  }

  /** { front, left, right, back } images for the analyzer (only the filled ones). */
  sources() {
    return Object.fromEntries(Object.entries(this.photos).map(([name, { bitmap }]) => [name, bitmap])) as PhotoSources;
  }

  clear() {
    this.generation++;
    this.setSorting(false);
    for (const name of Object.keys(this.photos) as SlotName[]) this.remove(name, { silent: true });
  }
}
