// Fills the photo slots of the scan screen with a test person, as if the files were picked.
// Usage from browser_evaluate: (await import('/tools/playwright/upload.ts')).upload(3)
import { VIEWS, photoUrl } from './portraits.ts';

const SLOT_OF_VIEW: Record<string, string> = { '01_face': 'front', '02_profil_gauche': 'left', '03_profil_droit': 'right', '04_dos': 'back' };

export async function upload(person: number, views = VIEWS) {
  for (const view of views) {
    const blob = await (await fetch(photoUrl(person, view))).blob();
    const file = new File([blob], `${view}.jpg`, { type: 'image/jpeg' });
    const input = document.querySelector<HTMLInputElement>(`[data-slot="${SLOT_OF_VIEW[view]}"] input`)!;
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  return document.querySelectorAll('.photo-slot.filled').length;
}
