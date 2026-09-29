import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GestureStationApp } from '@/gesture/GestureStationApp';
import {
  GestureStationController,
  loadOwnedGestureAuction,
  type GestureStationDependencies,
  type GestureStationState,
} from '@/gesture/use-gesture-station';
import type { PoseDetectionFrame, PoseEstimator } from '@/gesture/pose-estimator';
import type { PersonPose, PoseKeypoint } from '@/gesture/pose-types';
import type { Auction } from '@/types/auction';

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
});
