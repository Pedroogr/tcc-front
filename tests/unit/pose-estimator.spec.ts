import { describe, expect, it, vi } from 'vitest';
import {
  PoseEstimator,
  type PoseWorkerRequest,
  type PoseWorkerResponse,
} from '@/gesture/pose-estimator';

class FakeWorker {
  onmessage: ((event: MessageEvent<PoseWorkerResponse>) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();

  respond(data: PoseWorkerResponse) {
    this.onmessage?.({ data } as MessageEvent<PoseWorkerResponse>);
  }

  fail(message: string) {
    this.onerror?.({ message } as ErrorEvent);
  }
}

function bitmap() {
  return { width: 1920, height: 1080, close: vi.fn() } as unknown as ImageBitmap;
}

function latestRequest(worker: FakeWorker) {
  return worker.postMessage.mock.lastCall?.[0] as PoseWorkerRequest;
}

describe('PoseEstimator worker protocol', () => {
  it('starts the worker and reports the backend selected during initialization', async () => {
    const worker = new FakeWorker();
    const estimator = new PoseEstimator(() => worker as unknown as Worker);

    const started = estimator.start();
    expect(latestRequest(worker)).toEqual({
      type: 'init',
      modelUrl: '/models/yolo11s-pose.onnx',
    });

    worker.respond({ type: 'ready', backend: 'webgpu' });
    await expect(started).resolves.toBe('webgpu');
  });

  it('transfers one bitmap at a time and correlates only its response', async () => {
    const worker = new FakeWorker();
    const estimator = new PoseEstimator(() => worker as unknown as Worker);
    const started = estimator.start();
    worker.respond({ type: 'ready', backend: 'wasm' });
    await started;

    const firstBitmap = bitmap();
    const secondBitmap = bitmap();
    const detection = estimator.detect(firstBitmap, 123);
    const request = latestRequest(worker);

    expect(request).toMatchObject({ type: 'detect', sampledAtMs: 123 });
    expect(worker.postMessage.mock.lastCall?.[1]).toEqual([firstBitmap]);
    await expect(estimator.detect(secondBitmap, 124)).rejects.toThrow(
      'Já existe uma inferência em andamento.',
    );
    expect(secondBitmap.close).toHaveBeenCalledOnce();

    worker.respond({
      type: 'result',
      requestId: 'another-request',
      sampledAtMs: 1,
      inferenceMs: 1,
      poses: [],
    });
    let settled = false;
    void detection.finally(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    if (request.type !== 'detect') throw new Error('expected detect request');
    worker.respond({
      type: 'result',
      requestId: request.requestId,
      sampledAtMs: 123,
      inferenceMs: 42,
      poses: [],
    });
    await expect(detection).resolves.toEqual({
      sampledAtMs: 123,
      inferenceMs: 42,
      poses: [],
    });
  });

  it('surfaces initialization and runtime errors from the worker', async () => {
    const initWorker = new FakeWorker();
    const initEstimator = new PoseEstimator(() => initWorker as unknown as Worker);
    const starting = initEstimator.start();
    initWorker.respond({ type: 'error', message: 'modelo inválido' });
    await expect(starting).rejects.toThrow('modelo inválido');

    const runtimeWorker = new FakeWorker();
    const runtimeEstimator = new PoseEstimator(() => runtimeWorker as unknown as Worker);
    const runtimeStart = runtimeEstimator.start();
    runtimeWorker.respond({ type: 'ready', backend: 'webgpu' });
    await runtimeStart;
    const detecting = runtimeEstimator.detect(bitmap(), 10);
    const request = latestRequest(runtimeWorker);
    if (request.type !== 'detect') throw new Error('expected detect request');
    runtimeWorker.respond({
      type: 'error',
      requestId: request.requestId,
      message: 'falha na GPU',
    });
    await expect(detecting).rejects.toThrow('falha na GPU');
  });

  it('rejects pending work and terminates the worker when disposed', async () => {
    const worker = new FakeWorker();
    const estimator = new PoseEstimator(() => worker as unknown as Worker);
    const started = estimator.start();
    worker.respond({ type: 'ready', backend: 'wasm' });
    await started;
    const detecting = estimator.detect(bitmap(), 10);

    estimator.dispose();

    await expect(detecting).rejects.toThrow('Estimador de pose encerrado.');
    expect(worker.postMessage).toHaveBeenLastCalledWith({ type: 'dispose' });
    expect(worker.terminate).toHaveBeenCalledOnce();
    await expect(estimator.detect(bitmap(), 20)).rejects.toThrow(
      'Estimador de pose encerrado.',
    );
  });

  it('rejects the current operation when the worker itself crashes', async () => {
    const worker = new FakeWorker();
    const estimator = new PoseEstimator(() => worker as unknown as Worker);
    const starting = estimator.start();

    worker.fail('worker crashed');

    await expect(starting).rejects.toThrow('worker crashed');
  });
});
