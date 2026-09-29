import type { NormalizedBox } from './pose-types';

export const GESTURE_SNAPSHOT_MAX_WIDTH = 960;
export const GESTURE_SNAPSHOT_MAX_HEIGHT = 540;
export const GESTURE_SNAPSHOT_MAX_BYTES = 256 * 1024;
export const GESTURE_SNAPSHOT_QUALITY = 0.72;
const MAX_ENCODING_ATTEMPTS = 6;
const RETRY_SCALE = 0.8;

function token(name: string, fallback: string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function encodeJpeg(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar a imagem do gesto.'));
          return;
        }
        if (blob.type !== 'image/jpeg') {
          reject(new Error('A imagem do gesto não foi gerada como JPEG.'));
          return;
        }
        resolve(blob);
      },
      'image/jpeg',
      GESTURE_SNAPSHOT_QUALITY,
    );
  });
}

function drawAnnotatedFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  box: NormalizedBox,
  width: number,
  height: number,
) {
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a imagem do gesto.');

  context.drawImage(video, 0, 0, width, height);
  const x = box.x * width;
  const y = box.y * height;
  const boxWidth = box.width * width;
  const boxHeight = box.height * height;
  const primary = token('--primary', '#7a3f12');
  const foreground = token('--primary-foreground', '#ffffff');
  const lineWidth = Math.max(3, Math.round(width / 320));
  context.strokeStyle = primary;
  context.lineWidth = lineWidth;
  context.strokeRect(x, y, boxWidth, boxHeight);

  const fontSize = Math.max(14, Math.round(width / 48));
  const label = 'PRIMEIRA MÃO';
  const padding = Math.max(6, Math.round(fontSize / 3));
  context.font = `700 ${fontSize}px Archivo, sans-serif`;
  context.textBaseline = 'top';
  const labelWidth = context.measureText(label).width + padding * 2;
  const labelHeight = fontSize + padding * 2;
  const labelY = y >= labelHeight + lineWidth ? y - labelHeight : y + lineWidth;
  context.fillStyle = primary;
  context.fillRect(x, labelY, Math.min(labelWidth, width - x), labelHeight);
  context.fillStyle = foreground;
  context.fillText(label, x + padding, labelY + padding);
}

export async function createGestureSnapshot(
  video: HTMLVideoElement,
  box: NormalizedBox,
) {
  if (video.videoWidth <= 0 || video.videoHeight <= 0) {
    throw new Error('A câmera ainda não possui um quadro disponível.');
  }

  const initialScale = Math.min(
    1,
    GESTURE_SNAPSHOT_MAX_WIDTH / video.videoWidth,
    GESTURE_SNAPSHOT_MAX_HEIGHT / video.videoHeight,
  );
  let width = Math.max(1, Math.round(video.videoWidth * initialScale));
  let height = Math.max(1, Math.round(video.videoHeight * initialScale));
  const canvas = document.createElement('canvas');

  for (let attempt = 0; attempt < MAX_ENCODING_ATTEMPTS; attempt += 1) {
    drawAnnotatedFrame(canvas, video, box, width, height);
    const blob = await encodeJpeg(canvas);
    if (blob.size <= GESTURE_SNAPSHOT_MAX_BYTES) return blob;
    width = Math.max(1, Math.floor(width * RETRY_SCALE));
    height = Math.max(1, Math.floor(height * RETRY_SCALE));
  }

  throw new Error('A imagem do gesto excedeu o limite de 256 KiB.');
}
