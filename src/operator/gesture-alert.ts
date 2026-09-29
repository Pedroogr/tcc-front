import { useEffect, useEffectEvent, useRef, useState } from 'react';

export const GESTURE_ALERT_SOUND_MS = 200;
export const GESTURE_ALERT_VIBRATION_PATTERN = [150, 75, 150] as const;

export type GestureFirstHandEvent = {
  eventId: string;
  capturedAt: string;
  expiresAt: string;
  snapshot: Blob;
};

export type ActiveGestureAlert = {
  eventId: string;
  capturedAt: string;
  expiresAt: string;
  snapshotUrl: string;
  remainingSeconds: number;
};

type BrowserWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

function closeAudioContext(context: AudioContext) {
  try {
    void context.close().catch(() => undefined);
  } catch {
    // Browser feedback is best effort and must never block the visual alert.
  }
}

export function triggerGestureAlertFeedback() {
  try {
    navigator.vibrate?.([...GESTURE_ALERT_VIBRATION_PATTERN]);
  } catch {
    // A denied vibration permission does not affect the visual alert.
  }

  let context: AudioContext | null = null;
  try {
    const browserWindow = window as BrowserWindow;
    const AudioContextConstructor =
      browserWindow.AudioContext ?? browserWindow.webkitAudioContext;
    if (!AudioContextConstructor) {
      return;
    }

    context = new AudioContextConstructor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const startsAt = context.currentTime;
    const endsAt = startsAt + GESTURE_ALERT_SOUND_MS / 1_000;

    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.08, startsAt);
    gain.gain.exponentialRampToValueAtTime(0.0001, endsAt);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.addEventListener(
      'ended',
      () => closeAudioContext(context as AudioContext),
      { once: true },
    );
    oscillator.start(startsAt);
    oscillator.stop(endsAt);
  } catch {
    if (context) {
      closeAudioContext(context);
    }
  }
}

function remainingSeconds(expiresAtMs: number) {
  return Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 1_000));
}

export function useGestureFirstHandAlert(
  event: GestureFirstHandEvent | null,
): ActiveGestureAlert | null {
  const [activeAlert, setActiveAlert] = useState<ActiveGestureAlert | null>(null);
  const seenEventIds = useRef(new Set<string>());
  const readEvent = useEffectEvent(() => event);
  const eventId = event?.eventId;

  useEffect(() => {
    let cancelled = false;
    const currentEvent = readEvent();
    if (!currentEvent) {
      queueMicrotask(() => {
        if (!cancelled) {
          setActiveAlert(null);
        }
      });
      return () => {
        cancelled = true;
      };
    }
    if (seenEventIds.current.has(currentEvent.eventId)) {
      return;
    }
    seenEventIds.current.add(currentEvent.eventId);

    const expiresAtMs = Date.parse(currentEvent.expiresAt);
    const initialRemaining = remainingSeconds(expiresAtMs);
    if (!Number.isFinite(expiresAtMs) || initialRemaining === 0) {
      queueMicrotask(() => {
        if (!cancelled) {
          setActiveAlert(null);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const snapshotUrl = URL.createObjectURL(currentEvent.snapshot);
    let intervalId: number | null = null;
    let released = false;

    const release = () => {
      if (released) {
        return;
      }
      released = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
      URL.revokeObjectURL(snapshotUrl);
    };

    queueMicrotask(() => {
      if (!cancelled) {
        setActiveAlert({
          eventId: currentEvent.eventId,
          capturedAt: currentEvent.capturedAt,
          expiresAt: currentEvent.expiresAt,
          snapshotUrl,
          remainingSeconds: initialRemaining,
        });
      }
    });
    triggerGestureAlertFeedback();

    intervalId = window.setInterval(() => {
      const nextRemaining = remainingSeconds(expiresAtMs);
      if (nextRemaining === 0) {
        release();
        setActiveAlert((current) =>
          current?.eventId === currentEvent.eventId ? null : current,
        );
        return;
      }

      setActiveAlert((current) =>
        current?.eventId === currentEvent.eventId &&
        current.remainingSeconds !== nextRemaining
          ? { ...current, remainingSeconds: nextRemaining }
          : current,
      );
    }, 250);

    return () => {
      cancelled = true;
      release();
    };
  }, [eventId]);

  return activeAlert;
}
