// Ways out for the finished poster (a canvas at print size): printer, PNG or PDF file, phone.
// Everything stays on this PC or its local network; jsPDF is loaded only when a PDF is asked for.
import { trade } from '../trades/current.ts';

/** The stand server's answer to sharePoster() (server/index.ts). */
export interface SharedPoster {
  id: string;
  /** Address of the phone page, for the QR code. */
  url: string;
  /** false: no network found, phones can't reach this PC. */
  network: boolean;
  wifi: string;
  ttlMinutes: number;
}

/** File name from the first name: "affiche-lea.png". */
export function fileName(name: string, extension: string): string {
  const slug = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `affiche${slug ? `-${slug}` : ''}.${extension}`;
}

function download(url: string, name: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

export async function downloadPng(canvas: HTMLCanvasElement, name: string): Promise<void> {
  const url = URL.createObjectURL((await toBlob(canvas, 'image/png'))!);
  download(url, fileName(name, 'png'));
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function downloadPdf(canvas: HTMLCanvasElement, name: string): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  pdf.setProperties({ title: `Mon affiche · ${trade().title}` });
  // JPEG keeps the file light (≈ 1 Mo instead of 10); invisible once printed.
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  pdf.save(fileName(name, 'pdf'));
}

/** Prints the poster on a full A4 page, from a hidden frame (the game stays as it is). */
export async function printPoster(canvas: HTMLCanvasElement): Promise<void> {
  const url = URL.createObjectURL((await toBlob(canvas, 'image/png'))!);
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><title>Mon affiche</title>
    <style>@page { size: A4 portrait; margin: 0 } html, body { margin: 0; height: 100% }
    img { display: block; width: 100%; height: 100%; object-fit: contain }</style>
    <img src="${url}">`);
  doc.close();
  await doc.querySelector('img')!.decode();
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  // print() returns once the dialog closes (or right away in some browsers): clean up a bit later.
  setTimeout(() => {
    frame.remove();
    URL.revokeObjectURL(url);
  }, 60_000);
}

/**
 * Sends the poster to the stand server (server/index.ts), which keeps it in memory for a while and
 * serves it to the visitor's phone. Resolves with { url, network, wifi, ttlMinutes }.
 */
export async function sharePoster(canvas: HTMLCanvasElement, name: string): Promise<SharedPoster> {
  const image = await toBlob(canvas, 'image/jpeg', 0.9);
  // The phone page shows the trade's game title and a word about the job (server/phonePages.ts).
  const { title, job, icon, phone } = trade();
  const query = new URLSearchParams({ name: fileName(name, 'jpg'), title, job, icon, fact: phone.fact });
  const response = await fetch(`/api/posters?${query}`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/jpeg' },
    body: image,
  });
  if (!response.ok) throw new Error(`Serveur du stand : ${response.status}`);
  return response.json();
}
