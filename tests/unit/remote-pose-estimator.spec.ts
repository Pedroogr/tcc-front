import { describe, expect, it, vi } from 'vitest';
import { RemotePoseEstimator } from '@/gesture/remote-pose-estimator';

type SentValue = string | ArrayBuffer | ArrayBufferView | Blob;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly url: string;
  readyState = FakeWebSocket.CONNECTING;
  binaryType: BinaryType = 'blob';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  sent: SentValue[] = [];
  closeCalls = 0;

  constructor(url: string) {
    this.url = url;
  }

  send(value: SentValue) {
    this.sent.push(value);
  }

  close() {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.closeCalls += 1;
    this.readyState = FakeWebSocket.CLOSED;
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  receive(value: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(value) }));
  }

  disconnect() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { code: 1006 }));
  }
}

class FakeCanvas {
  width = 0;
  height = 0;
  drawnBitmap: ImageBitmap | null = null;
  mimeType: string | undefined;
  quality: number | undefined;

  getContext(contextId: string) {
    if (contextId !== '2d') return null;
    return {
      drawImage: (bitmap: ImageBitmap) => {
        this.drawnBitmap = bitmap;
      },
    };
  }

  toBlob(callback: BlobCallback, type?: string, quality?: number) {
    this.mimeType = type;
    this.quality = quality;
    callback(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type }));
  }
}

function bitmap(width = 1280, height = 720) {
  return { width, height, close: vi.fn() } as unknown as ImageBitmap;
}

function readyMessage() {
  return {
    type: 'ready',
    protocolVersion: 1,
    model: { name: 'yolo11s-pose', sha256: 'hash', inputSize: 640 },
    device: { type: 'cuda', name: 'RTX 3070 Ti' },
  };
}

function poseMessage(frameId: number, inferenceMs = 18) {
  return {
    type: 'pose',
    protocolVersion: 1,
    frameId,
    modelVersion: 'yolo11s-pose:hash',
    timings: {
      decodeMs: 1,
      preprocessMs: 2,
      inferenceMs,
      postprocessMs: 3,
      totalMs: 24,
    },
    poses: [],
  };
}

function frameIdOf(value: SentValue) {
  if (!(value instanceof ArrayBuffer)) throw new Error('expected binary frame');
  return new DataView(value).getUint32(0, false);
}

function createHarness(
  options: {
    handshakeTimeoutMs?: number;
    inferenceTimeoutMs?: number;
    now?: () => number;
  } = {},
) {
  const sockets: FakeWebSocket[] = [];
  const canvases: FakeCanvas[] = [];
  const estimator = new RemotePoseEstimator(
    {
      url: 'ws://192.168.15.4:8765/v1/pose',
      token: 'session-secret',
      handshakeTimeoutMs: options.handshakeTimeoutMs ?? 5000,
      inferenceTimeoutMs: options.inferenceTimeoutMs ?? 5000,
      maxWidth: 640,
      jpegQuality: 0.8,
    },
    {
      createSocket: (url) => {
        const socket = new FakeWebSocket(url);
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      createCanvas: () => {
        const canvas = new FakeCanvas();
        canvases.push(canvas);
        return canvas as unknown as HTMLCanvasElement;
      },
      now: options.now ?? (() => 0),
    },
  );
  return { estimator, sockets, canvases };
}

async function startHarness(harness: ReturnType<typeof createHarness>) {
  const starting = harness.estimator.start();
  const socket = harness.sockets.at(-1)!;
  socket.open();
  socket.receive(readyMessage());
  await expect(starting).resolves.toBe('remote-cuda');
  return socket;
}

async function waitForBinaryFrame(socket: FakeWebSocket, index = 1) {
  await vi.waitFor(() => {
    expect(socket.sent[index]).toBeInstanceOf(ArrayBuffer);
  });
  return socket.sent[index]!;
}

describe('RemotePoseEstimator', () => {
  it('authenticates in the first message without putting the token in the URL', async () => {
    const harness = createHarness();
    const starting = harness.estimator.start();
    const socket = harness.sockets[0]!;

    expect(socket.url).toBe('ws://192.168.15.4:8765/v1/pose');
    expect(socket.url).not.toContain('session-secret');
    socket.open();
    expect(socket.sent).toEqual([
      JSON.stringify({ type: 'hello', protocolVersion: 1, token: 'session-secret' }),
    ]);

    socket.receive(readyMessage());
    await expect(starting).resolves.toBe('remote-cuda');
  });

  it('fails startup when the authenticated handshake times out', async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness({ handshakeTimeoutMs: 50 });
      const starting = harness.estimator.start();
      harness.sockets[0]!.open();
      const rejected = expect(starting).rejects.toThrow(
        'Tempo esgotado ao conectar ao servidor de gestos.',
      );

      await vi.advanceTimersByTimeAsync(50);

      await rejected;
      expect(harness.sockets[0]!.closeCalls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('compresses a resized JPEG, closes the bitmap and maps the matching pose', async () => {
    const times = [100, 138];
    const harness = createHarness({ now: () => times.shift() ?? 138 });
    const socket = await startHarness(harness);
    const source = bitmap();

    const detection = harness.estimator.detect(source, 1234);
    const binary = await waitForBinaryFrame(socket);
    const sentFrameId = frameIdOf(binary);

    expect([...new Uint8Array(binary as ArrayBuffer).slice(4)]).toEqual([0xff, 0xd8, 0xff, 0xd9]);
    expect(harness.canvases[0]).toMatchObject({
      width: 640,
      height: 360,
      drawnBitmap: source,
      mimeType: 'image/jpeg',
      quality: 0.8,
    });
    expect(source.close).toHaveBeenCalledOnce();

    socket.receive(poseMessage(sentFrameId, 17.5));
    await expect(detection).resolves.toEqual({
      sampledAtMs: 1234,
      inferenceMs: 17.5,
      rttMs: 38,
      poses: [],
    });
  });

  it('keeps one request in flight and replaces only the unsent pending frame', async () => {
    const harness = createHarness();
    const socket = await startHarness(harness);
    const firstBitmap = bitmap();
    const replacedBitmap = bitmap();
    const newestBitmap = bitmap();

    const first = harness.estimator.detect(firstBitmap, 100);
    const firstBinary = await waitForBinaryFrame(socket);
    const replaced = harness.estimator.detect(replacedBitmap, 200);
    const newest = harness.estimator.detect(newestBitmap, 300);

    await expect(replaced).rejects.toThrow('Frame substituído por uma amostra mais recente.');
    expect(replacedBitmap.close).toHaveBeenCalledOnce();
    expect(socket.sent).toHaveLength(2);

    socket.receive(poseMessage(frameIdOf(firstBinary)));
    await expect(first).resolves.toMatchObject({ sampledAtMs: 100 });
    const newestBinary = await waitForBinaryFrame(socket, 2);
    socket.receive(poseMessage(frameIdOf(newestBinary)));
    await expect(newest).resolves.toMatchObject({ sampledAtMs: 300 });
    expect(newestBitmap.close).toHaveBeenCalledOnce();
  });

  it('ignores stale frame responses until the active frame arrives', async () => {
    const harness = createHarness();
    const socket = await startHarness(harness);
    const detection = harness.estimator.detect(bitmap(), 400);
    const binary = await waitForBinaryFrame(socket);
    const expectedFrameId = frameIdOf(binary);
    let settled = false;
    void detection.finally(() => {
      settled = true;
    });

    socket.receive(poseMessage((expectedFrameId + 1) >>> 0));
    await Promise.resolve();
    expect(settled).toBe(false);

    socket.receive(poseMessage(expectedFrameId));
    await expect(detection).resolves.toMatchObject({ sampledAtMs: 400 });
  });

  it('ends the connection when an active inference times out', async () => {
    vi.useFakeTimers();
    try {
      const harness = createHarness({ inferenceTimeoutMs: 50 });
      const socket = await startHarness(harness);
      const detection = harness.estimator.detect(bitmap(), 500);
      await vi.advanceTimersByTimeAsync(0);
      expect(socket.sent[1]).toBeInstanceOf(ArrayBuffer);
      const rejected = expect(detection).rejects.toThrow(
        'Tempo esgotado durante a inferência remota.',
      );

      await vi.advanceTimersByTimeAsync(50);

      await rejected;
      expect(socket.closeCalls).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('isolates reconnections from messages emitted by an older socket', async () => {
    const harness = createHarness();
    const firstStart = harness.estimator.start();
    const firstSocket = harness.sockets[0]!;
    firstSocket.open();
    firstSocket.disconnect();
    await expect(firstStart).rejects.toThrow('Conexão com o servidor de gestos encerrada.');

    const secondStart = harness.estimator.start();
    const secondSocket = harness.sockets[1]!;
    secondSocket.open();
    let settled = false;
    void secondStart.finally(() => {
      settled = true;
    });

    firstSocket.receive(readyMessage());
    await Promise.resolve();
    expect(settled).toBe(false);

    secondSocket.receive(readyMessage());
    await expect(secondStart).resolves.toBe('remote-cuda');
  });

  it('rejects pending work, closes bitmaps and disposes idempotently', async () => {
    const harness = createHarness();
    const socket = await startHarness(harness);
    const activeBitmap = bitmap();
    const pendingBitmap = bitmap();
    const active = harness.estimator.detect(activeBitmap, 1);
    await waitForBinaryFrame(socket);
    const pending = harness.estimator.detect(pendingBitmap, 2);

    harness.estimator.dispose();
    harness.estimator.dispose();

    await expect(active).rejects.toThrow('Estimador remoto encerrado.');
    await expect(pending).rejects.toThrow('Estimador remoto encerrado.');
    expect(activeBitmap.close).toHaveBeenCalledOnce();
    expect(pendingBitmap.close).toHaveBeenCalledOnce();
    expect(socket.closeCalls).toBe(1);
  });
});
