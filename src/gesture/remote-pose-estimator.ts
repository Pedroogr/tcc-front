import type {
  PoseBackend,
  PoseDetectionFrame,
  PoseEstimatorPort,
} from './pose-estimator';
import {
  encodePoseFrame,
  parsePoseServerMessage,
  POSE_PROTOCOL_VERSION,
  type PoseServerMessage,
} from './remote-pose-protocol';

export type RemotePoseEstimatorConfig = {
  url: string;
  token: string;
  handshakeTimeoutMs?: number;
  inferenceTimeoutMs?: number;
  maxWidth?: number;
  jpegQuality?: number;
};

export type RemotePoseEstimatorDependencies = {
  createSocket?: (url: string) => WebSocket;
  createCanvas?: () => HTMLCanvasElement;
  now?: () => number;
};

type DetectionRequest = {
  bitmap: ImageBitmap;
  sampledAtMs: number;
  frameId: number | null;
  sentAtMs: number | null;
  bitmapClosed: boolean;
  settled: boolean;
  resolve: (frame: PoseDetectionFrame) => void;
  reject: (error: Error) => void;
};

const REMOTE_BACKEND: PoseBackend = 'remote-cuda';
const DEFAULT_HANDSHAKE_TIMEOUT_MS = 5000;
const DEFAULT_INFERENCE_TIMEOUT_MS = 5000;
const DEFAULT_MAX_WIDTH = 640;
const DEFAULT_JPEG_QUALITY = 0.8;

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function encodeBitmapAsJpeg(
  bitmap: ImageBitmap,
  maxWidth: number,
  jpegQuality: number,
  createCanvas: () => HTMLCanvasElement,
): Promise<Uint8Array> {
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = createCanvas();
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Não foi possível preparar a compressão do frame.');
  context.drawImage(bitmap, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => {
        if (value) resolve(value);
        else reject(new Error('Não foi possível comprimir o frame.'));
      },
      'image/jpeg',
      jpegQuality,
    );
  });
  return new Uint8Array(await blob.arrayBuffer());
}

export class RemotePoseEstimator implements PoseEstimatorPort {
  private readonly config: Required<RemotePoseEstimatorConfig>;
  private readonly createSocket: (url: string) => WebSocket;
  private readonly createCanvas: () => HTMLCanvasElement;
  private readonly now: () => number;
  private socket: WebSocket | null = null;
  private startPromise: Promise<PoseBackend> | null = null;
  private resolveStart: ((backend: PoseBackend) => void) | null = null;
  private rejectStart: ((error: Error) => void) | null = null;
  private handshakeTimer: ReturnType<typeof setTimeout> | null = null;
  private inferenceTimer: ReturnType<typeof setTimeout> | null = null;
  private backend: PoseBackend | null = null;
  private active: DetectionRequest | null = null;
  private pending: DetectionRequest | null = null;
  private generation = 0;
  private nextFrameId = 1;
  private disposed = false;

  constructor(
    config: RemotePoseEstimatorConfig,
    dependencies: RemotePoseEstimatorDependencies = {},
  ) {
    this.config = {
      url: config.url,
      token: config.token,
      handshakeTimeoutMs: config.handshakeTimeoutMs ?? DEFAULT_HANDSHAKE_TIMEOUT_MS,
      inferenceTimeoutMs: config.inferenceTimeoutMs ?? DEFAULT_INFERENCE_TIMEOUT_MS,
      maxWidth: config.maxWidth ?? DEFAULT_MAX_WIDTH,
      jpegQuality: config.jpegQuality ?? DEFAULT_JPEG_QUALITY,
    };
    this.createSocket = dependencies.createSocket ?? ((url) => new WebSocket(url));
    this.createCanvas =
      dependencies.createCanvas ?? (() => document.createElement('canvas'));
    this.now = dependencies.now ?? (() => performance.now());
  }

  start(): Promise<PoseBackend> {
    if (this.disposed) return Promise.reject(new Error('Estimador remoto encerrado.'));
    if (this.backend) return Promise.resolve(this.backend);
    if (this.startPromise) return this.startPromise;

    const generation = ++this.generation;
    const socket = this.createSocket(this.config.url);
    this.socket = socket;
    socket.binaryType = 'arraybuffer';
    this.startPromise = new Promise<PoseBackend>((resolve, reject) => {
      this.resolveStart = resolve;
      this.rejectStart = reject;
    });

    socket.onopen = () => {
      if (!this.isCurrent(generation, socket)) return;
      socket.send(
        JSON.stringify({
          type: 'hello',
          protocolVersion: POSE_PROTOCOL_VERSION,
          token: this.config.token,
        }),
      );
    };
    socket.onmessage = (event) => {
      this.handleSocketMessage(generation, socket, event.data);
    };
    socket.onerror = () => {
      this.failConnection(generation, 'Não foi possível conectar ao servidor de gestos.');
    };
    socket.onclose = () => {
      this.failConnection(generation, 'Conexão com o servidor de gestos encerrada.', false);
    };
    this.handshakeTimer = setTimeout(() => {
      this.failConnection(
        generation,
        'Tempo esgotado ao conectar ao servidor de gestos.',
      );
    }, this.config.handshakeTimeoutMs);

    return this.startPromise;
  }

  detect(bitmap: ImageBitmap, sampledAtMs: number): Promise<PoseDetectionFrame> {
    if (this.disposed) {
      bitmap.close();
      return Promise.reject(new Error('Estimador remoto encerrado.'));
    }
    if (!this.backend || !this.socket) {
      bitmap.close();
      return Promise.reject(new Error('Estimador remoto ainda não foi iniciado.'));
    }

    const request = this.createRequest(bitmap, sampledAtMs);
    if (this.active) {
      if (this.pending) {
        this.closeBitmap(this.pending);
        this.rejectRequest(
          this.pending,
          new Error('Frame substituído por uma amostra mais recente.'),
        );
      }
      this.pending = request;
    } else {
      this.active = request;
      void this.sendActive(this.generation, request);
    }
    return new Promise<PoseDetectionFrame>((resolve, reject) => {
      request.resolve = resolve;
      request.reject = reject;
    });
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const error = new Error('Estimador remoto encerrado.');
    this.clearHandshakeTimer();
    this.clearInferenceTimer();
    this.rejectStart?.(error);
    this.resolveStart = null;
    this.rejectStart = null;
    this.startPromise = null;
    this.backend = null;
    this.generation += 1;
    if (this.active) {
      this.closeBitmap(this.active);
      this.rejectRequest(this.active, error);
      this.active = null;
    }
    if (this.pending) {
      this.closeBitmap(this.pending);
      this.rejectRequest(this.pending, error);
      this.pending = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  }

  private createRequest(bitmap: ImageBitmap, sampledAtMs: number): DetectionRequest {
    return {
      bitmap,
      sampledAtMs,
      frameId: null,
      sentAtMs: null,
      bitmapClosed: false,
      settled: false,
      resolve: () => undefined,
      reject: () => undefined,
    };
  }

  private async sendActive(generation: number, request: DetectionRequest) {
    let jpeg: Uint8Array;
    try {
      jpeg = await encodeBitmapAsJpeg(
        request.bitmap,
        this.config.maxWidth,
        this.config.jpegQuality,
        this.createCanvas,
      );
    } catch (error) {
      if (this.active === request) {
        this.active = null;
        this.rejectRequest(
          request,
          new Error(errorMessage(error, 'Não foi possível comprimir o frame.')),
        );
        this.promotePending();
      }
      return;
    } finally {
      this.closeBitmap(request);
    }

    const socket = this.socket;
    if (!this.isCurrent(generation, socket) || this.active !== request) return;
    const frameId = this.nextFrameId;
    this.nextFrameId = (this.nextFrameId + 1) >>> 0;
    request.frameId = frameId;
    request.sentAtMs = this.now();
    try {
      socket.send(encodePoseFrame(frameId, jpeg));
      this.inferenceTimer = setTimeout(() => {
        if (this.active !== request || request.frameId !== frameId) return;
        this.failConnection(generation, 'Tempo esgotado durante a inferência remota.');
      }, this.config.inferenceTimeoutMs);
    } catch {
      this.failConnection(generation, 'Não foi possível enviar o frame ao servidor de gestos.');
    }
  }

  private handleSocketMessage(generation: number, socket: WebSocket, data: unknown) {
    if (!this.isCurrent(generation, socket)) return;
    let message: PoseServerMessage;
    try {
      if (typeof data !== 'string') throw new Error('expected text message');
      message = parsePoseServerMessage(JSON.parse(data));
    } catch {
      this.failConnection(generation, 'O servidor de gestos enviou uma mensagem inválida.');
      return;
    }

    if (message.type === 'ready') {
      if (this.backend) return;
      this.clearHandshakeTimer();
      this.backend = REMOTE_BACKEND;
      this.resolveStart?.(REMOTE_BACKEND);
      this.resolveStart = null;
      this.rejectStart = null;
      return;
    }

    if (!this.backend) {
      this.failConnection(generation, 'O servidor de gestos recusou a conexão.');
      return;
    }

    if (message.type === 'pose') {
      if (!this.active || this.active.frameId !== message.frameId) return;
      const completed = this.active;
      this.clearInferenceTimer();
      this.active = null;
      this.resolveRequest(completed, {
        sampledAtMs: completed.sampledAtMs,
        inferenceMs: message.timings.inferenceMs,
        rttMs:
          completed.sentAtMs === null
            ? 0
            : Math.max(0, this.now() - completed.sentAtMs),
        poses: message.poses,
      });
      this.promotePending();
      return;
    }

    if (message.frameId === undefined) {
      this.failConnection(generation, message.message);
      return;
    }
    if (!this.active || this.active.frameId !== message.frameId) return;
    const failed = this.active;
    this.clearInferenceTimer();
    this.active = null;
    this.rejectRequest(failed, new Error(message.message));
    this.promotePending();
  }

  private promotePending() {
    if (!this.pending || !this.backend || !this.socket) return;
    const next = this.pending;
    this.pending = null;
    this.active = next;
    void this.sendActive(this.generation, next);
  }

  private failConnection(generation: number, message: string, closeSocket = true) {
    if (generation !== this.generation) return;
    const error = new Error(message);
    this.clearHandshakeTimer();
    this.clearInferenceTimer();
    this.rejectStart?.(error);
    this.resolveStart = null;
    this.rejectStart = null;
    this.startPromise = null;
    this.backend = null;
    this.generation += 1;
    if (this.active) {
      this.closeBitmap(this.active);
      this.rejectRequest(this.active, error);
      this.active = null;
    }
    if (this.pending) {
      this.closeBitmap(this.pending);
      this.rejectRequest(this.pending, error);
      this.pending = null;
    }
    const socket = this.socket;
    this.socket = null;
    if (closeSocket && socket && socket.readyState !== WebSocket.CLOSED) socket.close();
  }

  private isCurrent(generation: number, socket: WebSocket | null): socket is WebSocket {
    return generation === this.generation && socket !== null && socket === this.socket;
  }

  private clearHandshakeTimer() {
    if (this.handshakeTimer === null) return;
    clearTimeout(this.handshakeTimer);
    this.handshakeTimer = null;
  }

  private clearInferenceTimer() {
    if (this.inferenceTimer === null) return;
    clearTimeout(this.inferenceTimer);
    this.inferenceTimer = null;
  }

  private closeBitmap(request: DetectionRequest) {
    if (request.bitmapClosed) return;
    request.bitmapClosed = true;
    request.bitmap.close();
  }

  private resolveRequest(request: DetectionRequest, frame: PoseDetectionFrame) {
    if (request.settled) return;
    request.settled = true;
    request.resolve(frame);
  }

  private rejectRequest(request: DetectionRequest, error: Error) {
    if (request.settled) return;
    request.settled = true;
    request.reject(error);
  }
}
