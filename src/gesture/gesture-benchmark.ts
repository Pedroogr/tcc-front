export type GestureBenchmarkSample = {
  captureToResponseMs: number;
  inferenceMs: number;
  rttMs: number | null;
  trackerMs: number;
  presentationMs: number;
  endToEndMs: number;
};

export type GestureBenchmarkFrameTiming = {
  sampledAtMs: number;
  resultReadyAtMs: number;
  inferenceMs: number;
  rttMs: number | null;
  trackerMs: number;
};

type Percentiles = { p50: number; p95: number };

export type GestureBenchmarkSummary = {
  sampleCount: number;
  metricsMs: {
    captureToResponse: Percentiles | null;
    inference: Percentiles | null;
    rtt: Percentiles | null;
    tracker: Percentiles | null;
    presentation: Percentiles | null;
    endToEnd: Percentiles | null;
  };
};

export function gestureBenchmarkEnabled(search: string) {
  return new URLSearchParams(search).get('benchmark') === '1';
}

function nearestRank(values: number[], percentile: number) {
  const ordered = [...values].sort((left, right) => left - right);
  const rank = Math.ceil((percentile / 100) * ordered.length);
  return ordered[rank - 1];
}

function metric(values: Array<number | null>): Percentiles | null {
  const measured = values.filter((value): value is number => value !== null);
  if (measured.length === 0) return null;
  const rounded = (value: number) => Math.round(value * 1_000) / 1_000;
  return {
    p50: rounded(nearestRank(measured, 50)),
    p95: rounded(nearestRank(measured, 95)),
  };
}

export function summarizeGestureBenchmark(
  samples: GestureBenchmarkSample[],
): GestureBenchmarkSummary {
  return {
    sampleCount: samples.length,
    metricsMs: {
      captureToResponse: metric(samples.map((sample) => sample.captureToResponseMs)),
      inference: metric(samples.map((sample) => sample.inferenceMs)),
      rtt: metric(samples.map((sample) => sample.rttMs)),
      tracker: metric(samples.map((sample) => sample.trackerMs)),
      presentation: metric(samples.map((sample) => sample.presentationMs)),
      endToEnd: metric(samples.map((sample) => sample.endToEndMs)),
    },
  };
}

export class GestureBenchmarkRecorder {
  private readonly samples: GestureBenchmarkSample[] = [];

  record(frame: GestureBenchmarkFrameTiming, presentedAtMs: number) {
    this.samples.push({
      captureToResponseMs: frame.resultReadyAtMs - frame.sampledAtMs,
      inferenceMs: frame.inferenceMs,
      rttMs: frame.rttMs,
      trackerMs: frame.trackerMs,
      presentationMs: presentedAtMs - frame.resultReadyAtMs - frame.trackerMs,
      endToEndMs: presentedAtMs - frame.sampledAtMs,
    });
  }

  summary() {
    return summarizeGestureBenchmark(this.samples);
  }

  reset() {
    this.samples.length = 0;
  }
}
