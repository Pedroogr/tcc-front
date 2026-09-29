/// <reference lib="webworker" />

import * as ort from 'onnxruntime-web/webgpu';
import { isValidPerson } from './pose-rules';
import type { PoseBackend, PoseWorkerRequest, PoseWorkerResponse } from './pose-estimator';
import { decodeYoloPose, type LetterboxTransform } from './yolo-pose';

const INPUT_SIZE = 1280;
const INPUT_NAME = 'images';
const OUTPUT_NAME = 'output0';
const CHANNELS = 3;

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
let session: ort.InferenceSession | null = null;
let canvas: OffscreenCanvas | null = null;

function send(response: PoseWorkerResponse) {
  workerScope.postMessage(response);
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Falha desconhecida na inferência de pose.';
}

async function createSession(modelUrl: string) {
  let backend: PoseBackend = 'webgpu';
  try {
    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['webgpu'],
      graphOptimizationLevel: 'all',
    });
  } catch {
    backend = 'wasm';
    ort.env.wasm.numThreads = 1;
    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
  }
  return backend;
}

function frameToTensor(bitmap: ImageBitmap) {
  canvas ??= new OffscreenCanvas(INPUT_SIZE, INPUT_SIZE);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas de inferência indisponível.');

  const scale = Math.min(INPUT_SIZE / bitmap.width, INPUT_SIZE / bitmap.height);
  const scaledWidth = bitmap.width * scale;
  const scaledHeight = bitmap.height * scale;
  const padX = (INPUT_SIZE - scaledWidth) / 2;
  const padY = (INPUT_SIZE - scaledHeight) / 2;
  context.fillStyle = 'rgb(114, 114, 114)';
  context.fillRect(0, 0, INPUT_SIZE, INPUT_SIZE);
  context.drawImage(bitmap, padX, padY, scaledWidth, scaledHeight);

  const pixels = context.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE).data;
  const planeSize = INPUT_SIZE * INPUT_SIZE;
  const chw = new Float32Array(CHANNELS * planeSize);
  for (let pixel = 0; pixel < planeSize; pixel += 1) {
    const rgba = pixel * 4;
    chw[pixel] = pixels[rgba] / 255;
    chw[planeSize + pixel] = pixels[rgba + 1] / 255;
    chw[planeSize * 2 + pixel] = pixels[rgba + 2] / 255;
  }

  const letterbox: LetterboxTransform = {
    inputWidth: INPUT_SIZE,
    inputHeight: INPUT_SIZE,
    scale,
    padX,
    padY,
  };
  return {
    tensor: new ort.Tensor('float32', chw, [1, CHANNELS, INPUT_SIZE, INPUT_SIZE]),
    letterbox,
  };
}

async function detect(request: Extract<PoseWorkerRequest, { type: 'detect' }>) {
  if (!session) throw new Error('Modelo de pose ainda não foi carregado.');
  const startedAt = performance.now();
  try {
    const { tensor, letterbox } = frameToTensor(request.bitmap);
    const outputs = await session.run({ [INPUT_NAME]: tensor });
    const output = outputs[OUTPUT_NAME];
    if (!output || output.dims.length !== 3 || output.dims[1] !== 56) {
      throw new Error('Saída YOLO Pose inválida.');
    }
    const data =
      output.data instanceof Float32Array
        ? output.data
        : Float32Array.from(output.data as ArrayLike<number>);
    const poses = decodeYoloPose(
      data,
      output.dims[2],
      { width: request.bitmap.width, height: request.bitmap.height },
      letterbox,
    ).filter(isValidPerson);
    send({
      type: 'result',
      requestId: request.requestId,
      sampledAtMs: request.sampledAtMs,
      inferenceMs: performance.now() - startedAt,
      poses,
    });
  } finally {
    request.bitmap.close();
  }
}

workerScope.onmessage = (event: MessageEvent<PoseWorkerRequest>) => {
  const request = event.data;
  if (request.type === 'init') {
    void createSession(request.modelUrl)
      .then((backend) => send({ type: 'ready', backend }))
      .catch((error: unknown) => send({ type: 'error', message: messageFrom(error) }));
    return;
  }
  if (request.type === 'dispose') {
    const activeSession = session;
    session = null;
    void activeSession?.release();
    workerScope.close();
    return;
  }
  void detect(request).catch((error: unknown) =>
    send({ type: 'error', requestId: request.requestId, message: messageFrom(error) }),
  );
};

export {};
