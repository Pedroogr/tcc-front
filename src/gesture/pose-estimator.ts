import type { PersonPose } from './pose-types';

export const POSE_MODEL_URL = '/models/yolo11s-pose.onnx';

export type PoseBackend = 'webgpu' | 'wasm';

export type PoseWorkerRequest =
  | { type: 'init'; modelUrl: string }
  | {
      type: 'detect';
      requestId: string;
      bitmap: ImageBitmap;
      sampledAtMs: number;
    }
  | { type: 'dispose' };

export type PoseDetectionFrame = {
  sampledAtMs: number;
  inferenceMs: number;
  poses: PersonPose[];
};

export type PoseWorkerResponse =
  | { type: 'ready'; backend: PoseBackend }
  | ({ type: 'result'; requestId: string } & PoseDetectionFrame)
  | { type: 'error'; requestId?: string; message: string };

type PendingDetection = {
  requestId: string;
  resolve: (frame: PoseDetectionFrame) => void;
  reject: (error: Error) => void;
};

type WorkerFactory = () => Worker;

function defaultWorkerFactory() {
  return new Worker(new URL('./pose-worker.ts', import.meta.url), { type: 'module' });
}

export class PoseEstimator {
  private readonly workerFactory: WorkerFactory;
  private worker: Worker | null = null;
  private startPromise: Promise<PoseBackend> | null = null;
  private resolveStart: ((backend: PoseBackend) => void) | null = null;
  private rejectStart: ((error: Error) => void) | null = null;
  private pendingDetection: PendingDetection | null = null;
  private backend: PoseBackend | null = null;
  private disposed = false;
  private requestSequence = 0;

  constructor(workerFactory: WorkerFactory = defaultWorkerFactory) {
    this.workerFactory = workerFactory;
  }

  start() {
    if (this.disposed) {
      return Promise.reject(new Error('Estimador de pose encerrado.'));
    }
    if (this.backend) return Promise.resolve(this.backend);
    if (this.startPromise) return this.startPromise;

    this.worker = this.workerFactory();
    this.worker.onmessage = (event: MessageEvent<PoseWorkerResponse>) => {
      this.handleMessage(event.data);
    };
    this.worker.onerror = (event: ErrorEvent) => {
      this.failCurrentOperation(event.message || 'O worker de pose falhou.');
    };
    this.startPromise = new Promise<PoseBackend>((resolve, reject) => {
      this.resolveStart = resolve;
      this.rejectStart = reject;
    });
    const request: PoseWorkerRequest = { type: 'init', modelUrl: POSE_MODEL_URL };
    this.worker.postMessage(request);
    return this.startPromise;
  }

  async detect(bitmap: ImageBitmap, sampledAtMs: number) {
    if (this.disposed) {
      bitmap.close();
      throw new Error('Estimador de pose encerrado.');
    }
    if (!this.backend || !this.worker) {
      bitmap.close();
      throw new Error('Estimador de pose ainda não foi iniciado.');
    }
    if (this.pendingDetection) {
      bitmap.close();
      throw new Error('Já existe uma inferência em andamento.');
    }

    const requestId = `pose-${++this.requestSequence}`;
    const result = new Promise<PoseDetectionFrame>((resolve, reject) => {
      this.pendingDetection = { requestId, resolve, reject };
    });
    const request: PoseWorkerRequest = {
      type: 'detect',
      requestId,
      bitmap,
      sampledAtMs,
    };
    this.worker.postMessage(request, [bitmap]);
    return result;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const error = new Error('Estimador de pose encerrado.');
    this.rejectStart?.(error);
    this.pendingDetection?.reject(error);
    this.pendingDetection = null;
    this.resolveStart = null;
    this.rejectStart = null;
    if (this.worker) {
      const request: PoseWorkerRequest = { type: 'dispose' };
      this.worker.postMessage(request);
      this.worker.terminate();
      this.worker = null;
    }
  }

  private handleMessage(response: PoseWorkerResponse) {
    if (this.disposed) return;
    if (response.type === 'ready') {
      this.backend = response.backend;
      this.resolveStart?.(response.backend);
      this.resolveStart = null;
      this.rejectStart = null;
      return;
    }
    if (response.type === 'result') {
      if (this.pendingDetection?.requestId !== response.requestId) return;
      const pending = this.pendingDetection;
      this.pendingDetection = null;
      pending.resolve({
        sampledAtMs: response.sampledAtMs,
        inferenceMs: response.inferenceMs,
        poses: response.poses,
      });
      return;
    }

    const error = new Error(response.message);
    if (response.requestId && this.pendingDetection?.requestId === response.requestId) {
      const pending = this.pendingDetection;
      this.pendingDetection = null;
      pending.reject(error);
    } else if (!this.backend) {
      this.rejectStart?.(error);
      this.resolveStart = null;
      this.rejectStart = null;
    }
  }

  private failCurrentOperation(message: string) {
    const error = new Error(message);
    if (!this.backend) {
      this.rejectStart?.(error);
      this.resolveStart = null;
      this.rejectStart = null;
    }
    this.pendingDetection?.reject(error);
    this.pendingDetection = null;
  }
}
