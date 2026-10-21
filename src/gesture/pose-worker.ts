/// <reference lib="webworker" />

import * as ort from 'onnxruntime-web/webgpu';
import { isValidPerson } from './pose-rules';
import type {
  LocalPoseBackend,
  PoseWorkerRequest,
  PoseWorkerResponse,
} from './pose-estimator';
import { decodeYoloPose, type LetterboxTransform } from './yolo-pose';

const DEFAULT_INPUT_SIZE = 640;
const MAX_WASM_THREADS = 8;
const INPUT_NAME = 'images';
const OUTPUT_NAME = 'output0';
const CHANNELS = 3;

const workerScope = self as unknown as DedicatedWorkerGlobalScope;
let session: ort.InferenceSession | null = null;
let canvas: OffscreenCanvas | null = null;
// O ONNX exportado tem entrada fixa; lemos do modelo para aceitar 640 ou 1280 sem mudar código.
let inputSize = DEFAULT_INPUT_SIZE;

// Threads no WASM exigem SharedArrayBuffer, disponível só com cross-origin isolation (COOP/COEP).
function wasmThreadCount() {
  if (!workerScope.crossOriginIsolated) return 1;
  return Math.max(1, Math.min(navigator.hardwareConcurrency || 1, MAX_WASM_THREADS));
}

function modelInputSize(activeSession: ort.InferenceSession) {
  const input = activeSession.inputMetadata.find((metadata) => metadata.name === INPUT_NAME);
  const side = input?.isTensor ? input.shape[3] : undefined;
  return typeof side === 'number' && side > 0 ? side : DEFAULT_INPUT_SIZE;
}

function send(response: PoseWorkerResponse) {
  workerScope.postMessage(response);
}

function messageFrom(error: unknown) {
  return error instanceof Error ? error.message : 'Falha desconhecida na inferência de pose.';
}

async function createSession(modelUrl: string) {
  let backend: LocalPoseBackend = 'webgpu';
  try {
    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['webgpu'],
      graphOptimizationLevel: 'all',
    });
  } catch (error) {
    console.warn('WebGPU indisponível, usando CPU (WASM):', error);
    backend = 'wasm';
    ort.env.wasm.numThreads = wasmThreadCount();
    session = await ort.InferenceSession.create(modelUrl, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
    });
    console.info(`Inferência WASM com ${ort.env.wasm.numThreads} thread(s).`);
  }
  inputSize = modelInputSize(session);
  return backend;
}

function frameToTensor(bitmap: ImageBitmap) {
  canvas ??= new OffscreenCanvas(inputSize, inputSize);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Canvas de inferência indisponível.');

  const scale = Math.min(inputSize / bitmap.width, inputSize / bitmap.height);
  const scaledWidth = bitmap.width * scale;
  const scaledHeight = bitmap.height * scale;
  const padX = (inputSize - scaledWidth) / 2;
  const padY = (inputSize - scaledHeight) / 2;
  context.fillStyle = 'rgb(114, 114, 114)';
  context.fillRect(0, 0, inputSize, inputSize);
  context.drawImage(bitmap, padX, padY, scaledWidth, scaledHeight);

  const pixels = context.getImageData(0, 0, inputSize, inputSize).data;
  const planeSize = inputSize * inputSize;
  const chw = new Float32Array(CHANNELS * planeSize);
  for (let pixel = 0; pixel < planeSize; pixel += 1) {
    const rgba = pixel * 4;
    chw[pixel] = pixels[rgba] / 255;
    chw[planeSize + pixel] = pixels[rgba + 1] / 255;
    chw[planeSize * 2 + pixel] = pixels[rgba + 2] / 255;
  }

  const letterbox: LetterboxTransform = {
    inputWidth: inputSize,
    inputHeight: inputSize,
    scale,
    padX,
    padY,
  };
  return {
    tensor: new ort.Tensor('float32', chw, [1, CHANNELS, inputSize, inputSize]),
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
