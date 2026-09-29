import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { listAuctions } from '@/api/auctionsApi';
import { authStorage } from '@/api/http';
import {
  submitGestureEvent,
  type GestureEventAccepted,
  type GestureEventSubmission,
} from '@/api/gestureApi';
import type { Auction } from '@/types/auction';
import { GestureRoundTracker, type RoundSelection } from './gesture-round-tracker';
import { createGestureSnapshot } from './gesture-snapshot';
import {
  PoseEstimator,
  type PoseBackend,
  type PoseDetectionFrame,
} from './pose-estimator';
import type { NormalizedBox, PersonPose } from './pose-types';
import { ThroughputMonitor, type ThroughputStatus } from './throughput-monitor';

export type GestureStationAccess =
  | { status: 'authorized'; auction: Auction }
  | { status: 'unauthorized' | 'not-found' | 'unavailable' };

type AuctionLister = () => Promise<Auction[]>;

export async function loadOwnedGestureAuction(
  auctionId: string,
  storage: Storage = sessionStorage,
  list: AuctionLister = listAuctions,
): Promise<GestureStationAccess> {
  const token = storage.getItem(authStorage.tokenKey);
  const actorType = storage.getItem(authStorage.actorTypeKey);
  const storedOffice = storage.getItem(authStorage.auctionHouseKey);
  if (!token || actorType !== 'AUCTION_HOUSE' || !storedOffice) {
    return { status: 'unauthorized' };
  }

  let officeId = '';
  try {
    officeId = (JSON.parse(storedOffice) as { id?: string }).id ?? '';
  } catch {
    return { status: 'unauthorized' };
  }
  if (!officeId) return { status: 'unauthorized' };

  const auction = (await list()).find((candidate) => {
    const ownerId = candidate.auctionHouseId ?? candidate.auctionHouse?.id;
    return candidate.id === auctionId && ownerId === officeId;
  });
  if (!auction) return { status: 'not-found' };
  if (auction.status === 'FINISHED' || auction.status === 'CANCELED') {
    return { status: 'unavailable' };
  }
  return { status: 'authorized', auction };
}

export type GestureDeliveryState =
  | 'idle'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'offline'
  | 'unreliable';

export type GestureStationState = {
  phase: 'stopped' | 'starting' | 'running' | 'error';
  backend: PoseBackend | null;
  fps: number | null;
  reliable: boolean;
  online: boolean;
  poses: PersonPose[];
  selectedBox: NormalizedBox | null;
  delivery: GestureDeliveryState;
  message: string;
};

type EstimatorPort = Pick<PoseEstimator, 'start' | 'detect' | 'dispose'>;

export type GestureStationDependencies = {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  createEstimator: () => EstimatorPort;
  createBitmap: (source: ImageBitmapSource) => Promise<ImageBitmap>;
  scheduleFrame: (callback: () => void) => number;
  cancelFrame: (handle: number) => void;
  now: () => number;
  nowDate: () => Date;
  randomUUID: () => string;
  createSnapshot: typeof createGestureSnapshot;
  submitEvent: (
    auctionId: string,
    event: GestureEventSubmission,
  ) => Promise<GestureEventAccepted>;
};

function browserDependencies(): GestureStationDependencies {
  return {
    getUserMedia: (constraints) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        return Promise.reject(new Error('Este navegador não oferece acesso à câmera.'));
      }
      return navigator.mediaDevices.getUserMedia(constraints);
    },
    createEstimator: () => new PoseEstimator(),
    createBitmap: (source) => createImageBitmap(source),
    scheduleFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    now: () => performance.now(),
    nowDate: () => new Date(),
    randomUUID: () => crypto.randomUUID(),
    createSnapshot: createGestureSnapshot,
    submitEvent: submitGestureEvent,
  };
}

const initialState = (): GestureStationState => ({
  phase: 'stopped',
  backend: null,
  fps: null,
  reliable: true,
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  poses: [],
  selectedBox: null,
  delivery: 'idle',
  message: '',
});

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') {
      return 'Autorize o acesso à câmera para iniciar o reconhecimento.';
    }
    if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      return 'Nenhuma câmera disponível. Conecte ou selecione outra câmera.';
    }
    if (error.name === 'NotReadableError') {
      return 'A câmera está em uso por outro programa.';
    }
  }
  return error instanceof Error ? error.message : 'Não foi possível iniciar a estação.';
}

function videoConstraints(deviceId: string): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  };
}

export class GestureStationController {
  private readonly auctionId: string;
  private readonly video: HTMLVideoElement;
  private readonly onState: (state: GestureStationState) => void;
  private readonly dependencies: GestureStationDependencies;
  private state = initialState();
  private generation = 0;
  private stream: MediaStream | null = null;
  private estimator: EstimatorPort | null = null;
  private frameHandle: number | null = null;
  private tracker = new GestureRoundTracker();
  private throughput = new ThroughputMonitor();
  private lastSelection: RoundSelection | null = null;
  private endedHandlers = new Map<MediaStreamTrack, () => void>();

  constructor(
    auctionId: string,
    video: HTMLVideoElement,
    onState: (state: GestureStationState) => void,
    dependencies: GestureStationDependencies = browserDependencies(),
  ) {
    this.auctionId = auctionId;
    this.video = video;
    this.onState = onState;
    this.dependencies = dependencies;
    this.onState(this.state);
  }

  setOnline(online: boolean) {
    this.updateState({ online });
  }

  async start(deviceId: string) {
    const generation = ++this.generation;
    this.releaseResources();
    this.tracker = new GestureRoundTracker();
    this.throughput = new ThroughputMonitor();
    this.lastSelection = null;
    this.updateState({
      phase: 'starting',
      backend: null,
      fps: null,
      reliable: true,
      poses: [],
      selectedBox: null,
      delivery: 'idle',
      message: '',
    });

    try {
      const stream = await this.dependencies.getUserMedia(videoConstraints(deviceId));
      if (generation !== this.generation) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      this.stream = stream;
      this.video.srcObject = stream;
      await this.video.play();
      if (generation !== this.generation) return;

      for (const track of stream.getVideoTracks()) {
        const onEnded = () => this.fail(generation, 'A câmera foi desconectada.');
        track.addEventListener('ended', onEnded, { once: true });
        this.endedHandlers.set(track, onEnded);
      }

      const estimator = this.dependencies.createEstimator();
      this.estimator = estimator;
      const backend = await estimator.start();
      if (generation !== this.generation) return;
      this.updateState({ phase: 'running', backend, message: '' });
      this.schedule(generation);
    } catch (error) {
      if (generation === this.generation) {
        this.releaseResources();
        this.updateState({ phase: 'error', message: cameraErrorMessage(error) });
      }
    }
  }

  stop() {
    this.generation += 1;
    this.releaseResources();
    this.tracker = new GestureRoundTracker();
    this.throughput = new ThroughputMonitor();
    this.lastSelection = null;
    this.updateState({
      phase: 'stopped',
      backend: null,
      fps: null,
      reliable: true,
      poses: [],
      selectedBox: null,
      delivery: 'idle',
      message: '',
    });
  }

  private updateState(changes: Partial<GestureStationState>) {
    this.state = { ...this.state, ...changes };
    this.onState(this.state);
  }

  private releaseResources() {
    if (this.frameHandle !== null) {
      this.dependencies.cancelFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.estimator?.dispose();
    this.estimator = null;
    if (this.stream) {
      this.stream.getTracks().forEach((track) => {
        const handler = this.endedHandlers.get(track);
        if (handler) track.removeEventListener('ended', handler);
        track.stop();
      });
    }
    this.endedHandlers.clear();
    this.stream = null;
    this.video.srcObject = null;
  }

  private schedule(generation: number) {
    if (generation !== this.generation || this.state.phase !== 'running') return;
    this.frameHandle = this.dependencies.scheduleFrame(() => {
      this.frameHandle = null;
      void this.processFrame(generation);
    });
  }

  private async processFrame(generation: number) {
    let frame: PoseDetectionFrame;
    try {
      const bitmap = await this.dependencies.createBitmap(this.video);
      if (generation !== this.generation) {
        bitmap.close();
        return;
      }
      const sampledAtMs = this.dependencies.now();
      frame = await this.estimator!.detect(bitmap, sampledAtMs);
    } catch (error) {
      if (generation === this.generation) this.fail(generation, cameraErrorMessage(error));
      return;
    }
    if (generation !== this.generation) return;

    const throughput = this.throughput.record(frame.sampledAtMs);
    const selection = this.tracker.update(frame.poses, frame.sampledAtMs);
    this.updateFromFrame(frame, throughput, selection);
    if (selection && selection !== this.lastSelection) {
      this.lastSelection = selection;
      void this.deliver(selection, generation);
    }
    this.schedule(generation);
  }

  private updateFromFrame(
    frame: PoseDetectionFrame,
    throughput: ThroughputStatus,
    selection: RoundSelection | null,
  ) {
    this.updateState({
      poses: frame.poses,
      selectedBox: selection?.personBox ?? null,
      reliable: throughput.reliable,
      ...(throughput.completedWindow ? { fps: throughput.fps } : {}),
      ...(!throughput.reliable ? { delivery: 'unreliable' as const } : {}),
    });
  }

  private async deliver(selection: RoundSelection, generation: number) {
    if (!this.state.online) {
      this.updateState({ delivery: 'offline' });
      return;
    }
    if (!this.state.reliable) {
      this.updateState({ delivery: 'unreliable' });
      return;
    }

    this.updateState({ delivery: 'sending' });
    try {
      const snapshot = await this.dependencies.createSnapshot(
        this.video,
        selection.personBox,
      );
      if (generation !== this.generation) return;
      const eventId = this.dependencies.randomUUID();
      await this.dependencies.submitEvent(this.auctionId, {
        eventId,
        capturedAt: this.dependencies.nowDate().toISOString(),
        personBox: selection.personBox,
        snapshot,
      });
      if (generation === this.generation) {
        this.updateState({ delivery: 'sent' });
      }
    } catch (error) {
      if (generation === this.generation) {
        this.updateState({
          delivery: 'failed',
          message: cameraErrorMessage(error),
        });
      }
    }
  }

  private fail(generation: number, message: string) {
    if (generation !== this.generation) return;
    this.releaseResources();
    this.updateState({ phase: 'error', message });
  }
}

export function useGestureStation(
  auctionId: string,
  videoRef: RefObject<HTMLVideoElement | null>,
) {
  const [state, setState] = useState<GestureStationState>(initialState);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState('');
  const controllerRef = useRef<GestureStationController | null>(null);

  const refreshCameras = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    const available = devices.filter((device) => device.kind === 'videoinput');
    setCameras(available);
    setSelectedCameraId((current) => current || available[0]?.deviceId || '');
  }, []);

  useEffect(() => {
    queueMicrotask(() => void refreshCameras());
  }, [refreshCameras]);

  useEffect(() => {
    const updateOnline = () => controllerRef.current?.setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
      controllerRef.current?.stop();
      controllerRef.current = null;
    };
  }, []);

  const start = useCallback(async () => {
    if (!videoRef.current) return;
    controllerRef.current ??= new GestureStationController(
      auctionId,
      videoRef.current,
      setState,
    );
    controllerRef.current.setOnline(navigator.onLine);
    await controllerRef.current.start(selectedCameraId);
    await refreshCameras();
  }, [auctionId, refreshCameras, selectedCameraId, videoRef]);

  const stop = useCallback(() => controllerRef.current?.stop(), []);

  const selectCamera = useCallback(
    (deviceId: string) => {
      setSelectedCameraId(deviceId);
      if (state.phase === 'running' && controllerRef.current) {
        void controllerRef.current.start(deviceId);
      }
    },
    [state.phase],
  );

  return { state, cameras, selectedCameraId, selectCamera, start, stop };
}
