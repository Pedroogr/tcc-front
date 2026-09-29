import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createGestureSnapshot,
  GESTURE_SNAPSHOT_MAX_BYTES,
  GESTURE_SNAPSHOT_QUALITY,
} from '@/gesture/gesture-snapshot';

const context = {
  drawImage: vi.fn(),
  strokeRect: vi.fn(),
  fillRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 120 })),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  font: '',
  textBaseline: '',
};

function video(width = 1920, height = 1080) {
  return { videoWidth: width, videoHeight: height } as HTMLVideoElement;
}

describe('createGestureSnapshot', () => {
  let blobs: Array<Blob | null>;

  beforeEach(() => {
    blobs = [new Blob([new Uint8Array(1_000)], { type: 'image/jpeg' })];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      context as unknown as CanvasRenderingContext2D,
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => {
      callback(blobs.shift() ?? null);
    });
    vi.stubGlobal(
      'getComputedStyle',
      vi.fn(() => ({ getPropertyValue: () => '#7a3f12' })),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Object.values(context).forEach((value) => {
      if (typeof value === 'function' && 'mockClear' in value) value.mockClear();
    });
  });

  it('draws a 960x540 annotated JPEG using the primary design token', async () => {
    const snapshot = await createGestureSnapshot(video(), {
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });

    expect(snapshot.type).toBe('image/jpeg');
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 960, 540);
    expect(context.strokeStyle).toBe('#7a3f12');
    expect(context.strokeRect).toHaveBeenCalledWith(96, 108, 288, 216);
    expect(context.fillText).toHaveBeenCalledWith(
      'PRIMEIRA MÃO',
      expect.any(Number),
      expect.any(Number),
    );
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      'image/jpeg',
      GESTURE_SNAPSHOT_QUALITY,
    );
  });

  it('preserves aspect ratio for a vertical source', async () => {
    await createGestureSnapshot(video(1080, 1920), {
      x: 0.1,
      y: 0.1,
      width: 0.2,
      height: 0.2,
    });

    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 304, 540);
  });

  it('downscales and redraws when the first JPEG exceeds 256 KiB', async () => {
    blobs = [
      new Blob([new Uint8Array(GESTURE_SNAPSHOT_MAX_BYTES + 1)], {
        type: 'image/jpeg',
      }),
      new Blob([new Uint8Array(2_000)], { type: 'image/jpeg' }),
    ];

    const snapshot = await createGestureSnapshot(video(), {
      x: 0.1,
      y: 0.2,
      width: 0.3,
      height: 0.4,
    });

    expect(snapshot.size).toBe(2_000);
    expect(context.drawImage).toHaveBeenNthCalledWith(2, expect.anything(), 0, 0, 768, 432);
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledTimes(2);
  });

  it('fails with a stable message when canvas encoding returns null', async () => {
    blobs = [null];

    await expect(
      createGestureSnapshot(video(), { x: 0, y: 0, width: 1, height: 1 }),
    ).rejects.toThrow('Não foi possível gerar a imagem do gesto.');
  });

  it('never returns a JPEG over the API limit', async () => {
    blobs = Array.from({ length: 10 }, () =>
      new Blob([new Uint8Array(GESTURE_SNAPSHOT_MAX_BYTES + 1)], {
        type: 'image/jpeg',
      }),
    );

    await expect(
      createGestureSnapshot(video(), { x: 0, y: 0, width: 1, height: 1 }),
    ).rejects.toThrow('A imagem do gesto excedeu o limite de 256 KiB.');
  });
});
