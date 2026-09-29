import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GESTURE_ALERT_SOUND_MS,
  GESTURE_ALERT_VIBRATION_PATTERN,
  triggerGestureAlertFeedback,
  useGestureFirstHandAlert,
  type GestureFirstHandEvent,
} from '@/operator/gesture-alert';

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
