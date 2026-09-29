export const THROUGHPUT_WINDOW_MS = 10_000;
export const MIN_RELIABLE_FPS = 5;
export const LOW_WINDOWS_TO_PAUSE = 2;

export type ThroughputStatus = {
  fps: number | null;
  reliable: boolean;
  completedWindow: boolean;
};

export class ThroughputMonitor {
  private windowStartMs: number | null = null;
  private samplesInWindow = 0;
  private consecutiveLowWindows = 0;
  private reliable = true;

  record(timestampMs: number): ThroughputStatus {
    if (this.windowStartMs === null) {
      this.windowStartMs = timestampMs;
      this.samplesInWindow = 1;
      return { fps: null, reliable: this.reliable, completedWindow: false };
    }

    let lastCompletedFps: number | null = null;
    while (timestampMs - this.windowStartMs >= THROUGHPUT_WINDOW_MS) {
      const fps = this.samplesInWindow / (THROUGHPUT_WINDOW_MS / 1_000);
      if (fps < MIN_RELIABLE_FPS) {
        this.consecutiveLowWindows += 1;
        if (this.consecutiveLowWindows >= LOW_WINDOWS_TO_PAUSE) {
          this.reliable = false;
        }
      } else {
        this.consecutiveLowWindows = 0;
        this.reliable = true;
      }
      lastCompletedFps = fps;
      this.windowStartMs += THROUGHPUT_WINDOW_MS;
      this.samplesInWindow = 0;
    }

    this.samplesInWindow += 1;
    return lastCompletedFps === null
      ? { fps: null, reliable: this.reliable, completedWindow: false }
      : {
          fps: lastCompletedFps,
          reliable: this.reliable,
          completedWindow: true,
        };
  }
}
