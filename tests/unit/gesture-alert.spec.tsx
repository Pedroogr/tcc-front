import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GestureFirstHandAlert } from '@/operator/GestureFirstHandAlert';
import { OperatorBidPage } from '@/operator/OperatorBidPage';
import {
  GESTURE_ALERT_SOUND_MS,
  GESTURE_ALERT_VIBRATION_PATTERN,
  gesturePayloadToEvent,
  triggerGestureAlertFeedback,
  useGestureFirstHandAlert,
  type GestureFirstHandEvent,
} from '@/operator/gesture-alert';
import type { GestureFirstHandDetectedPayload } from '@/api/socket';
import type { OperatorSession } from '@/types/operator';

const { operatorSocket } = vi.hoisted(() => ({
  operatorSocket: {
    on: vi.fn(),
    emit: vi.fn(),
    disconnect: vi.fn(),
  },
}));

vi.mock('@/api/socket', () => ({
  createOperatorCommerceSocket: vi.fn(() => operatorSocket),
}));

vi.mock('@/api/operatorApi', () => ({
  createOperatorBid: vi.fn(),
  searchOperatorBuyers: vi.fn(() => Promise.resolve([])),
  OperatorApiError: class OperatorApiError extends Error {
    status = 500;
  },
}));

const NOW = new Date('2026-09-29T15:00:00.000Z');

function event(
  eventId: string,
  expiresAt = new Date(NOW.getTime() + 5_000).toISOString(),
): GestureFirstHandEvent {
  return {
    eventId,
    capturedAt: NOW.toISOString(),
    expiresAt,
    snapshot: new Blob([eventId], { type: 'image/jpeg' }),
  };
}

function Harness({ value }: { value: GestureFirstHandEvent | null }) {
  const alert = useGestureFirstHandAlert(value);

  if (!alert) {
    return <div>inactive</div>;
  }

  return (
    <div>
      <span data-testid="event-id">{alert.eventId}</span>
      <span data-testid="remaining">{alert.remainingSeconds}</span>
      <span data-testid="snapshot-url">{alert.snapshotUrl}</span>
    </div>
  );
}

async function flushEffects() {
  await act(async () => undefined);
}

describe('useGestureFirstHandAlert', () => {
  const createObjectURL = vi.fn((blob: Blob) => `blob:${blob.size}:${Math.random()}`);
  const revokeObjectURL = vi.fn();
  const vibrate = vi.fn(() => true);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vibrate,
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vibrate.mockClear();
  });

  it('activates once, counts down from the server expiry, and cleans up at expiry', async () => {
    render(<Harness value={event('gesture-1')} />);
    await flushEffects();

    expect(screen.getByTestId('event-id')).toHaveTextContent('gesture-1');
    expect(screen.getByTestId('remaining')).toHaveTextContent('5');
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(GESTURE_ALERT_VIBRATION_PATTERN);

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases the previous URL when a newer event replaces it', async () => {
    const { rerender, unmount } = render(<Harness value={event('gesture-1')} />);
    await flushEffects();
    const firstUrl = screen.getByTestId('snapshot-url').textContent;

    rerender(<Harness value={event('gesture-2')} />);
    await flushEffects();

    expect(screen.getByTestId('event-id')).toHaveTextContent('gesture-2');
    expect(createObjectURL).toHaveBeenCalledTimes(2);
    expect(revokeObjectURL).toHaveBeenCalledWith(firstUrl);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    unmount();
    expect(revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('suppresses a repeated event ID for the lifetime of the hook', async () => {
    const first = event('gesture-1');
    const { rerender } = render(<Harness value={first} />);
    await flushEffects();

    rerender(
      <Harness
        value={{
          ...first,
          expiresAt: new Date(NOW.getTime() + 10_000).toISOString(),
          snapshot: new Blob(['replacement']),
        }}
      />,
    );
    await flushEffects();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('remaining')).toHaveTextContent('5');
  });

  it('ignores expired and invalid events without allocating resources or feedback', () => {
    const { rerender } = render(
      <Harness value={event('expired', new Date(NOW.getTime() - 1).toISOString())} />,
    );

    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();

    rerender(<Harness value={event('invalid', 'not-a-date')} />);
    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('does not revive an expired event when the same ID is repeated', async () => {
    const { rerender } = render(
      <Harness value={event('gesture-1', new Date(NOW.getTime() - 1).toISOString())} />,
    );
    await flushEffects();

    rerender(<Harness value={event('gesture-1')} />);
    await flushEffects();

    expect(screen.getByText('inactive')).toBeInTheDocument();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(vibrate).not.toHaveBeenCalled();
  });
});

describe('triggerGestureAlertFeedback', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('does not throw when vibration and audio are unavailable or fail', () => {
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('blocked');
      }),
    });
    vi.stubGlobal(
      'AudioContext',
      class {
        constructor() {
          throw new Error('blocked');
        }
      },
    );

    expect(() => triggerGestureAlertFeedback()).not.toThrow();

    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: undefined,
    });
    vi.stubGlobal('AudioContext', undefined);
    expect(() => triggerGestureAlertFeedback()).not.toThrow();
  });

  it('plays exactly 200 ms and closes the audio context after the oscillator ends', () => {
    const close = vi.fn().mockResolvedValue(undefined);
    const connect = vi.fn();
    const start = vi.fn();
    const stop = vi.fn();
    let handleEnded: (() => void) | undefined;
    const oscillator = {
      frequency: { value: 0 },
      type: 'sine' as OscillatorType,
      connect,
      start,
      stop,
      addEventListener: vi.fn(
        (name: string, listener: () => void, options?: AddEventListenerOptions) => {
          expect(name).toBe('ended');
          expect(options).toEqual({ once: true });
          handleEnded = listener;
        },
      ),
    };
    const gain = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect,
    };
    class MockAudioContext {
      currentTime = 10;
      destination = {};
      createOscillator = vi.fn(() => oscillator);
      createGain = vi.fn(() => gain);
      close = close;
    }
    vi.stubGlobal('AudioContext', MockAudioContext);
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: undefined,
    });

    triggerGestureAlertFeedback();

    expect(oscillator.frequency.value).toBe(880);
    expect(start).toHaveBeenCalledWith(10);
    expect(stop).toHaveBeenCalledWith(10 + GESTURE_ALERT_SOUND_MS / 1_000);
    expect(close).not.toHaveBeenCalled();

    handleEnded?.();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe('GestureFirstHandAlert', () => {
  it('renders the approved compact alert with accessible text and token colors', () => {
    const { container } = render(
      <GestureFirstHandAlert
        alert={{
          eventId: 'gesture-1',
          capturedAt: NOW.toISOString(),
          expiresAt: new Date(NOW.getTime() + 5_000).toISOString(),
          snapshotUrl: 'blob:gesture-1',
          remainingSeconds: 5,
        }}
      />,
    );

    const alert = screen.getByRole('alert', { name: 'Primeira mão detectada' });
    expect(alert).toHaveTextContent('Primeira mão detectada');
    expect(alert).toHaveTextContent('5s');
    expect(alert).toHaveTextContent('Imagem capturada agora');
    expect(alert).toHaveTextContent('Som e vibração quando disponíveis');
    expect(alert).toHaveClass('border-primary', 'bg-card', 'text-foreground');
    expect(
      screen.getByAltText(
        'Pessoa com a primeira mão levantada, destacada pela estação de gestos',
      ),
    ).toHaveAttribute('src', 'blob:gesture-1');
    expect(container.querySelector('button')).not.toBeInTheDocument();
  });
});

describe('gesturePayloadToEvent', () => {
  const basePayload = {
    eventId: '4da148c7-0b3f-4cd9-b14d-e99581fd880f',
    auctionId: 'auction-1',
    capturedAt: NOW.toISOString(),
    expiresAt: new Date(NOW.getTime() + 5_000).toISOString(),
    personBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
    snapshotMimeType: 'image/jpeg' as const,
  };

  it.each([
    ['ArrayBuffer', new Uint8Array([1, 2, 3]).buffer],
    ['offset Uint8Array', new Uint8Array([9, 1, 2, 3, 9]).subarray(1, 4)],
    ['serialized Buffer', { type: 'Buffer' as const, data: [1, 2, 3] }],
  ])('copies exact JPEG bytes from %s', async (_label, snapshot) => {
    const converted = gesturePayloadToEvent(
      { ...basePayload, snapshot },
      'auction-1',
      NOW.getTime(),
    );

    expect(converted).not.toBeNull();
    expect(converted?.snapshot.type).toBe('image/jpeg');
    expect([...new Uint8Array(await converted!.snapshot.arrayBuffer())]).toEqual([1, 2, 3]);
  });

  it.each([
    ['wrong MIME', { ...basePayload, snapshotMimeType: 'image/png', snapshot: new Uint8Array([1]) }],
    ['invalid binary', { ...basePayload, snapshot: { nope: true } }],
    ['wrong auction', { ...basePayload, auctionId: 'auction-2', snapshot: new Uint8Array([1]) }],
    [
      'expired event',
      {
        ...basePayload,
        expiresAt: new Date(NOW.getTime() - 1).toISOString(),
        snapshot: new Uint8Array([1]),
      },
    ],
  ])('rejects %s', (_label, payload) => {
    expect(
      gesturePayloadToEvent(
        payload as GestureFirstHandDetectedPayload,
        'auction-1',
        NOW.getTime(),
      ),
    ).toBeNull();
  });
});

describe('OperatorBidPage gesture boundary', () => {
  const session: OperatorSession = {
    type: 'OPERATOR',
    operatorAccess: {
      id: 'operator-access-1',
      auctionId: 'auction-1',
      label: 'Pista principal',
      expiresAt: '2026-09-30T15:00:00.000Z',
    },
    currentLot: {
      id: 'lot-1',
      code: '1',
      title: 'Lote 1',
      status: 'IN_AUCTION',
      currentPrice: '1000',
      nextMinimumBid: '1100',
    },
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:gesture-1'),
      revokeObjectURL: vi.fn(),
    });
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: vi.fn(() => true),
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    operatorSocket.on.mockClear();
    operatorSocket.emit.mockClear();
    operatorSocket.disconnect.mockClear();
  });

  it('is hidden without an event and overlays without replacing the bidding flow', async () => {
    const props = {
      token: 'operator-token',
      session,
      isSyncing: false,
      syncError: '',
      notice: '',
      onRefresh: vi.fn(async () => session),
      onAuthoritativeConflict: vi.fn(async () => session),
      onClearNotice: vi.fn(),
      onLogout: vi.fn(),
    };
    const { rerender } = render(<OperatorBidPage {...props} />);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Registrar lance presencial')).toBeInTheDocument();

    rerender(<OperatorBidPage {...props} gestureEvent={event('gesture-1')} />);
    await flushEffects();

    expect(
      screen.getByRole('alert', { name: 'Primeira mão detectada' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Registrar lance presencial')).toBeInTheDocument();
    expect(screen.getByLabelText('Buscar comprador')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revisar lance' })).toBeInTheDocument();
  });

  it('subscribes to valid events for its auction and ignores another auction', async () => {
    render(
      <OperatorBidPage
        token="operator-token"
        session={session}
        isSyncing={false}
        syncError=""
        notice=""
        onRefresh={vi.fn(async () => session)}
        onAuthoritativeConflict={vi.fn(async () => session)}
        onClearNotice={vi.fn()}
        onLogout={vi.fn()}
      />,
    );
    const subscription = operatorSocket.on.mock.calls.find(
      ([eventName]) => eventName === 'gesture:first-hand-detected',
    );
    expect(subscription).toBeDefined();
    const receive = subscription?.[1] as (payload: GestureFirstHandDetectedPayload) => void;
    const payload: GestureFirstHandDetectedPayload = {
      eventId: '4da148c7-0b3f-4cd9-b14d-e99581fd880f',
      auctionId: 'auction-2',
      capturedAt: NOW.toISOString(),
      expiresAt: new Date(NOW.getTime() + 5_000).toISOString(),
      personBox: { x: 0.1, y: 0.2, width: 0.3, height: 0.4 },
      snapshotMimeType: 'image/jpeg',
      snapshot: new Uint8Array([1, 2, 3]),
    };

    act(() => receive(payload));
    await flushEffects();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => receive({ ...payload, auctionId: 'auction-1' }));
    await flushEffects();
    expect(screen.getByRole('alert', { name: /Primeira .* detectada/ })).toBeInTheDocument();
  });
});
