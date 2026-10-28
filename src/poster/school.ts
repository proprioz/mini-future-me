import QRCode from 'qrcode';

// The school that runs the stand, in the footer of every poster: logo, name, website and a QR code
// that opens it, plus the booth team who guided the visitor ("Tu as été servi·e par …").
// Set for each stand in .env.local (see .env.example), with the logo in public/school/logo.svg; none of
// it is in the repository. Without `url`, the poster and the printed « Dans les coulisses » have no
// school block.
const env = import.meta.env;
export const SCHOOL = {
  name: env.VITE_SCHOOL_NAME ?? '',
  site: env.VITE_SCHOOL_SITE ?? '',
  url: env.VITE_SCHOOL_URL ?? '',
};

const LOGO_FILE = 'school/logo.svg';

let logo: Promise<HTMLImageElement | null> | null = null;

/** The school logo, loaded once (null if the file is missing: the footer then writes the name). */
export function loadLogo(): Promise<HTMLImageElement | null> {
  logo ??= (async () => {
    if (!SCHOOL.url) return null;
    const image = new Image();
    image.src = `${import.meta.env.BASE_URL}${LOGO_FILE}`;
    try {
      await image.decode();
      return image;
    } catch {
      return null;
    }
  })();
  return logo;
}

const QR = SCHOOL.url ? QRCode.create(SCHOOL.url, { errorCorrectionLevel: 'M' }).modules : null;

/** Draws the QR code of the school website as vector squares (sharp at any print size). */
export function drawSchoolQr(g: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
  const module = size / QR!.size;
  const path = new Path2D();
  for (let row = 0; row < QR!.size; row++) {
    for (let col = 0; col < QR!.size; col++) {
      if (QR!.get(row, col)) path.rect(x + col * module, y + row * module, module, module);
    }
  }
  g.fillStyle = color;
  g.fill(path);
}

// The booth team's names stay from one visitor to the next (the kiosk reset reloads the page).
const SERVED_BY_KEY = 'studio-media:served-by';

export function savedServedBy(): string {
  try {
    return localStorage.getItem(SERVED_BY_KEY) ?? '';
  } catch {
    return ''; // storage blocked: the names are typed again
  }
}

export function saveServedBy(names: string): void {
  try {
    localStorage.setItem(SERVED_BY_KEY, names);
  } catch {
    // storage blocked: the names last until the next visitor
  }
}
