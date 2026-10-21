import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listAuctions } from '@/api/auctionsApi';
import { GestureStationApp } from '@/gesture/GestureStationApp';
import { readGestureServerSettings } from '@/gesture/gesture-server-settings';
import {
  GestureStationController,
  loadOwnedGestureAuction,
  type GestureStationDependencies,
  type GestureStationState,
} from '@/gesture/use-gesture-station';
import type { PoseDetectionFrame, PoseEstimator } from '@/gesture/pose-estimator';
import type { GestureServerSettings } from '@/gesture/gesture-server-settings';
import type { PersonPose, PoseKeypoint } from '@/gesture/pose-types';
import type { Auction } from '@/types/auction';

vi.mock('@/api/auctionsApi', () => ({ listAuctions: vi.fn() }));

const ownedAuction: Auction = {
  id: 'auction-1',
  title: 'Remate Primavera',
  status: 'LIVE',
  mode: 'PRESENTIAL',
  auctionHouseId: 'house-1',
  auctionHouse: { id: 'house-1', name: 'Escritório Pampa' },
};

function storage(actorType = 'AUCTION_HOUSE', houseId = 'house-1') {
  const values = new Map([
    ['cattleAuctionToken', 'house-token'],
    ['cattleAuctionActorType', actorType],
    ['cattleAuctionHouse', JSON.stringify({ id: houseId, name: 'Escritório Pampa' })],
  ]);
  return { getItem: (key: string) => values.get(key) ?? null } as Storage;
}

function keypoint(x = 0, y = 0, confidence = 0): PoseKeypoint {
  return { x, y, confidence };
}

function raisedPerson(): PersonPose {
  const keypoints = Array.from({ length: 17 }, () => keypoint());
  keypoints[0] = keypoint(150, 120, 0.9);
  keypoints[5] = keypoint(130, 180, 0.9);
  keypoints[6] = keypoint(170, 180, 0.9);
  keypoints[7] = keypoint(130, 170, 0.9);
  keypoints[9] = keypoint(130, 140, 0.9);
  return {
    confidence: 0.9,
    box: { x1: 100, y1: 100, x2: 200, y2: 300 },
    normalizedBox: { x: 0.1, y: 0.1, width: 0.1, height: 0.2 },
    keypoints,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fakeStream() {
  const endedListeners: Array<() => void> = [];
  const track = {
    stop: vi.fn(),
    addEventListener: vi.fn((_name: string, listener: () => void) => {
      endedListeners.push(listener);
    }),
    removeEventListener: vi.fn(),
  };
  return {
    stream: { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream,
    track,
    endedListeners,
  };
}

function fakeVideo() {
  return {
    srcObject: null,
    videoWidth: 1920,
    videoHeight: 1080,
    play: vi.fn(() => Promise.resolve()),
  } as unknown as HTMLVideoElement;
}

function bitmap() {
  return { width: 1920, height: 1080, close: vi.fn() } as unknown as ImageBitmap;
}

const localSettings: GestureServerSettings = {
  mode: 'local',
  serverUrl: '',
  token: '',
};

const remoteSettings: GestureServerSettings = {
  mode: 'remote',
  serverUrl: 'ws://10.8.0.1:8765/v1/pose',
  token: 'runtime-secret',
};

function controllerHarness(overrides: Partial<GestureStationDependencies> = {}) {
  const firstStream = fakeStream();
  const states: GestureStationState[] = [];
  const scheduled: Array<() => void> = [];
  const estimator = {
    start: vi.fn(() => Promise.resolve('webgpu' as const)),
    detect: vi.fn(() =>
      Promise.resolve({ sampledAtMs: 0, inferenceMs: 12, poses: [] }),
    ),
    dispose: vi.fn(),
  };
  const dependencies: GestureStationDependencies = {
    getUserMedia: vi.fn(() => Promise.resolve(firstStream.stream)),
    createEstimator: vi.fn(() => estimator as unknown as PoseEstimator),
    createBitmap: vi.fn(() => Promise.resolve(bitmap())),
    scheduleFrame: vi.fn((callback) => {
      scheduled.push(callback);
      return scheduled.length;
    }),
    cancelFrame: vi.fn(),
    now: vi.fn(() => 0),
    nowDate: vi.fn(() => new Date('2026-09-29T18:00:00.000Z')),
    randomUUID: vi.fn(() => '4da148c7-0b3f-4cd9-b14d-e99581fd880f'),
    createSnapshot: vi.fn(() =>
      Promise.resolve(new Blob(['jpeg'], { type: 'image/jpeg' })),
    ),
    submitEvent: vi.fn(() =>
      Promise.resolve({
        eventId: '4da148c7-0b3f-4cd9-b14d-e99581fd880f',
        expiresAt: '2026-09-29T18:00:05.000Z',
      }),
    ),
    ...overrides,
  };
  const controller = new GestureStationController(
    'auction-1',
    fakeVideo(),
    (state) => states.push(state),
    dependencies,
  );
  return { controller, dependencies, estimator, firstStream, states, scheduled };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('gesture station authorization', () => {
  it('rejects buyers before listing auctions or touching camera/model APIs', async () => {
    const listAuctions = vi.fn();

    await expect(
      loadOwnedGestureAuction('auction-1', storage('USER'), listAuctions),
    ).resolves.toEqual({ status: 'unauthorized' });
    expect(listAuctions).not.toHaveBeenCalled();
  });

  it('rejects an auction owned by a different office', async () => {
    const listAuctions = vi.fn(() => Promise.resolve([ownedAuction]));

    await expect(
      loadOwnedGestureAuction('auction-1', storage('AUCTION_HOUSE', 'house-2'), listAuctions),
    ).resolves.toEqual({ status: 'not-found' });
  });

  it('renders an unauthorized direct route without requesting camera access', async () => {
    sessionStorage.setItem('cattleAuctionActorType', 'USER');
    sessionStorage.setItem('cattleAuctionToken', 'buyer-token');
    const getUserMedia = vi.fn();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, enumerateDevices: vi.fn() },
    });

    render(<GestureStationApp auctionId="auction-1" />);

    expect(await screen.findByText('Acesso exclusivo do escritório')).toBeInTheDocument();
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it('collects the remote token as a per-tab password and renders only safe telemetry', async () => {
    sessionStorage.setItem('cattleAuctionActorType', 'AUCTION_HOUSE');
    sessionStorage.setItem('cattleAuctionToken', 'house-token');
    sessionStorage.setItem(
      'cattleAuctionHouse',
      JSON.stringify({ id: 'house-1', name: 'Escritório Pampa' }),
    );
    vi.mocked(listAuctions).mockResolvedValueOnce([ownedAuction]);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { enumerateDevices: vi.fn(() => Promise.resolve([])) },
    });

    render(<GestureStationApp auctionId="auction-1" />);
    const mode = await screen.findByLabelText('Modo de inferência');
    fireEvent.change(mode, { target: { value: 'remote' } });
    const token = screen.getByLabelText('Token do servidor de gestos');

    expect(token).toHaveAttribute('type', 'password');
    fireEvent.change(token, { target: { value: 'runtime-secret' } });
    expect(readGestureServerSettings().token).toBe('runtime-secret');
    expect(screen.queryByText('runtime-secret')).not.toBeInTheDocument();
    expect(screen.queryByText(/10\.8\.0\.1/)).not.toBeInTheDocument();
    expect(screen.getByText('Conectividade')).toBeInTheDocument();
    expect(screen.getByText('Inferência')).toBeInTheDocument();
    expect(screen.getByText('RTT')).toBeInTheDocument();
    expect(screen.getByText('Desempenho')).toBeInTheDocument();
  });
});

describe('GestureStationController lifecycle', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('starts the selected camera and releases tracks, worker, and frame scheduling on stop', async () => {
    const harness = controllerHarness();

    await harness.controller.start('camera-2');
    expect(harness.dependencies.getUserMedia).toHaveBeenCalledWith({
      audio: false,
      video: {
        deviceId: { exact: 'camera-2' },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    });
    expect(harness.estimator.start).toHaveBeenCalledOnce();
    expect(harness.states.at(-1)?.phase).toBe('running');

    harness.controller.stop();

    expect(harness.firstStream.track.stop).toHaveBeenCalledOnce();
    expect(harness.estimator.dispose).toHaveBeenCalledOnce();
    expect(harness.dependencies.cancelFrame).toHaveBeenCalled();
    expect(harness.states.at(-1)?.phase).toBe('stopped');
  });

  it('ignores a late inference after stop and does not schedule or submit again', async () => {
    const detection = deferred<PoseDetectionFrame>();
    const harness = controllerHarness();
    harness.estimator.detect.mockReturnValueOnce(detection.promise);
    await harness.controller.start('');
    harness.scheduled.shift()?.();
    await flush();

    harness.controller.stop();
    detection.resolve({ sampledAtMs: 100, inferenceMs: 10, poses: [raisedPerson()] });
    await flush();

    expect(harness.dependencies.submitEvent).not.toHaveBeenCalled();
    expect(harness.states.at(-1)?.phase).toBe('stopped');
    expect(harness.scheduled).toHaveLength(0);
  });

  it('submits the first stable hand once and never retries the round', async () => {
    const times = [0, 130, 260, 400];
    const harness = controllerHarness({
      now: vi.fn(() => times.shift() ?? 400),
    });
    harness.estimator.detect.mockImplementation((_bitmap, sampledAtMs) =>
      Promise.resolve({ sampledAtMs, inferenceMs: 10, poses: [raisedPerson()] }),
    );
    await harness.controller.start('');

    for (let frame = 0; frame < 4; frame += 1) {
      harness.scheduled.shift()?.();
      await flush();
    }

    await waitFor(() => expect(harness.dependencies.submitEvent).toHaveBeenCalledOnce());
    expect(harness.dependencies.createSnapshot).toHaveBeenCalledOnce();
    expect(harness.dependencies.submitEvent).toHaveBeenCalledWith('auction-1', {
      eventId: '4da148c7-0b3f-4cd9-b14d-e99581fd880f',
      capturedAt: '2026-09-29T18:00:00.000Z',
      personBox: { x: 0.1, y: 0.1, width: 0.1, height: 0.2 },
      snapshot: expect.any(Blob),
    });
  });

  it('does not queue an offline selection for later delivery', async () => {
    const times = [0, 130, 260];
    const harness = controllerHarness({ now: vi.fn(() => times.shift() ?? 260) });
    harness.estimator.detect.mockImplementation((_bitmap, sampledAtMs) =>
      Promise.resolve({ sampledAtMs, inferenceMs: 10, poses: [raisedPerson()] }),
    );
    harness.controller.setOnline(false);
    await harness.controller.start('');
    for (let frame = 0; frame < 3; frame += 1) {
      harness.scheduled.shift()?.();
      await flush();
    }
    harness.controller.setOnline(true);
    harness.scheduled.shift()?.();
    await flush();

    expect(harness.dependencies.submitEvent).not.toHaveBeenCalled();
    expect(harness.states.some((state) => state.delivery === 'offline')).toBe(true);
  });

  it('still delivers a stable gesture when inference is slower than five FPS', async () => {
    const times = [0, 10_000, 20_000, 20_130, 20_260];
    const harness = controllerHarness({
      now: vi.fn(() => times.shift() ?? 20_260),
    });
    harness.estimator.detect.mockImplementation((_bitmap, sampledAtMs) =>
      Promise.resolve({
        sampledAtMs,
        inferenceMs: 1_000,
        poses: sampledAtMs >= 20_000 ? [raisedPerson()] : [],
      }),
    );
    await harness.controller.start('');

    for (let frame = 0; frame < 5; frame += 1) {
      harness.scheduled.shift()?.();
      await flush();
    }

    expect(harness.states.some((state) => state.reliable === false)).toBe(true);
    await waitFor(() => expect(harness.dependencies.submitEvent).toHaveBeenCalledOnce());
  });

  it('can retry initialization after a model failure and releases the failed camera', async () => {
    const firstEstimator = {
      start: vi.fn(() => Promise.reject(new Error('modelo indisponível'))),
      detect: vi.fn(),
      dispose: vi.fn(),
    };
    const secondEstimator = {
      start: vi.fn(() => Promise.resolve('wasm' as const)),
      detect: vi.fn(),
      dispose: vi.fn(),
    };
    const createEstimator = vi
      .fn()
      .mockReturnValueOnce(firstEstimator)
      .mockReturnValueOnce(secondEstimator);
    const harness = controllerHarness({ createEstimator });

    await harness.controller.start('');
    expect(harness.states.at(-1)).toMatchObject({
      phase: 'error',
      message: 'modelo indisponível',
    });
    expect(harness.firstStream.track.stop).toHaveBeenCalledOnce();

    await harness.controller.start('');
    expect(secondEstimator.start).toHaveBeenCalledOnce();
    expect(harness.states.at(-1)).toMatchObject({ phase: 'running', backend: 'wasm' });
  });

  it('offers local mode only after an explicit retry when remote startup fails', async () => {
    const remoteEstimator = {
      start: vi.fn(() => Promise.reject(new Error('servidor remoto indisponível'))),
      detect: vi.fn(),
      dispose: vi.fn(),
    };
    const localEstimator = {
      start: vi.fn(() => Promise.resolve('webgpu' as const)),
      detect: vi.fn(),
      dispose: vi.fn(),
    };
    const createEstimator = vi.fn((settings: GestureServerSettings) =>
      settings.mode === 'remote' ? remoteEstimator : localEstimator,
    );
    const harness = controllerHarness({ createEstimator });

    await harness.controller.start('', remoteSettings);

    expect(createEstimator).toHaveBeenCalledTimes(1);
    expect(createEstimator).toHaveBeenLastCalledWith(remoteSettings);
    expect(localEstimator.start).not.toHaveBeenCalled();
    expect(harness.states.at(-1)).toMatchObject({
      phase: 'error',
      message: 'servidor remoto indisponível',
    });
    expect(JSON.stringify(harness.states)).not.toContain('runtime-secret');
    expect(JSON.stringify(harness.states)).not.toContain('10.8.0.1');

    await harness.controller.start('', localSettings);

    expect(createEstimator).toHaveBeenCalledTimes(2);
    expect(localEstimator.start).toHaveBeenCalledOnce();
    expect(harness.states.at(-1)).toMatchObject({
      phase: 'running',
      backend: 'webgpu',
    });
  });

  it('stops a remote round on disconnect without changing estimator or emitting an event', async () => {
    const detection = deferred<PoseDetectionFrame>();
    const remoteEstimator = {
      start: vi.fn(() => Promise.resolve('remote-cuda' as const)),
      detect: vi.fn(() => detection.promise),
      dispose: vi.fn(),
    };
    const createEstimator = vi.fn(() => remoteEstimator);
    const harness = controllerHarness({ createEstimator });
    await harness.controller.start('', remoteSettings);
    harness.scheduled.shift()?.();
    await flush();

    detection.reject(new Error('Conexão com o servidor de gestos encerrada.'));
    await flush();

    expect(createEstimator).toHaveBeenCalledOnce();
    expect(remoteEstimator.dispose).toHaveBeenCalledOnce();
    expect(harness.dependencies.submitEvent).not.toHaveBeenCalled();
    expect(harness.states.at(-1)).toMatchObject({
      phase: 'error',
      backend: 'remote-cuda',
      message: 'Conexão com o servidor de gestos encerrada.',
    });
  });

  it('publishes inference and RTT telemetry from a processed remote frame', async () => {
    const harness = controllerHarness();
    harness.estimator.start.mockResolvedValueOnce('remote-cuda');
    harness.estimator.detect.mockResolvedValueOnce({
      sampledAtMs: 100,
      inferenceMs: 17.2,
      rttMs: 41.8,
      poses: [],
    });
    await harness.controller.start('', remoteSettings);

    harness.scheduled.shift()?.();
    await flush();

    expect(harness.states.at(-1)).toMatchObject({
      phase: 'running',
      backend: 'remote-cuda',
      inferenceMs: 17.2,
      rttMs: 41.8,
    });
  });
});
