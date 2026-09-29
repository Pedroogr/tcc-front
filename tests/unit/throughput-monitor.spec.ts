import { describe, expect, it } from 'vitest';
import {
  ThroughputMonitor,
  THROUGHPUT_WINDOW_MS,
} from '@/gesture/throughput-monitor';

function fillWindow(
  monitor: ThroughputMonitor,
  startMs: number,
  samples: number,
) {
  const firstIndex = startMs === 0 ? 0 : 1;
  for (let index = firstIndex; index < samples; index += 1) {
    monitor.record(startMs + (index * THROUGHPUT_WINDOW_MS) / samples);
  }
  return monitor.record(startMs + THROUGHPUT_WINDOW_MS);
}

describe('ThroughputMonitor', () => {
  it('does not judge an incomplete window', () => {
    const monitor = new ThroughputMonitor();

    expect(monitor.record(0)).toEqual({
      fps: null,
      reliable: true,
      completedWindow: false,
    });
    expect(monitor.record(9_999)).toEqual({
      fps: null,
      reliable: true,
      completedWindow: false,
    });
  });

  it('pauses only after two consecutive complete windows below 5 FPS', () => {
    const monitor = new ThroughputMonitor();

    const first = fillWindow(monitor, 0, 40);
    expect(first).toEqual({ fps: 4, reliable: true, completedWindow: true });

    const second = fillWindow(monitor, 10_000, 40);
    expect(second).toEqual({ fps: 4, reliable: false, completedWindow: true });
  });

  it('resets the low-window streak and resumes after one healthy complete window', () => {
    const monitor = new ThroughputMonitor();
    fillWindow(monitor, 0, 40);
    fillWindow(monitor, 10_000, 40);

    const healthy = fillWindow(monitor, 20_000, 50);

    expect(healthy).toEqual({ fps: 5, reliable: true, completedWindow: true });
  });

  it('counts empty elapsed windows as unreliable instead of hiding a stall', () => {
    const monitor = new ThroughputMonitor();
    monitor.record(0);

    const result = monitor.record(20_001);

    expect(result.completedWindow).toBe(true);
    expect(result.fps).toBe(0);
    expect(result.reliable).toBe(false);
  });
});
