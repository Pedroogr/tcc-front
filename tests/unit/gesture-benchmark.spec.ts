import { describe, expect, it } from 'vitest';
import {
  GestureBenchmarkRecorder,
  gestureBenchmarkEnabled,
  summarizeGestureBenchmark,
} from '@/gesture/gesture-benchmark';

describe('gesture benchmark activation', () => {
  it('enables collection only for benchmark=1', () => {
    expect(gestureBenchmarkEnabled('?benchmark=1')).toBe(true);
    expect(gestureBenchmarkEnabled('?benchmark=0')).toBe(false);
    expect(gestureBenchmarkEnabled('?other=1')).toBe(false);
  });
});

describe('gesture benchmark summary', () => {
  it('reports observed nearest-rank p50 and p95 values', () => {
    const samples = Array.from({ length: 20 }, (_, index) => ({
      captureToResponseMs: index + 1,
      inferenceMs: index + 21,
      rttMs: index + 41,
      trackerMs: index + 61,
      presentationMs: index + 81,
      endToEndMs: index + 101,
    }));

    expect(summarizeGestureBenchmark(samples)).toEqual({
      sampleCount: 20,
      metricsMs: {
        captureToResponse: { p50: 10, p95: 19 },
        inference: { p50: 30, p95: 39 },
        rtt: { p50: 50, p95: 59 },
        tracker: { p50: 70, p95: 79 },
        presentation: { p50: 90, p95: 99 },
        endToEnd: { p50: 110, p95: 119 },
      },
    });
  });

  it('records response, presentation and end-to-end from frame timing boundaries', () => {
    const recorder = new GestureBenchmarkRecorder();

    recorder.record(
      {
        sampledAtMs: 100,
        resultReadyAtMs: 130,
        inferenceMs: 12,
        rttMs: 24,
        trackerMs: 2,
      },
      140,
    );

    expect(recorder.summary()).toEqual({
      sampleCount: 1,
      metricsMs: {
        captureToResponse: { p50: 30, p95: 30 },
        inference: { p50: 12, p95: 12 },
        rtt: { p50: 24, p95: 24 },
        tracker: { p50: 2, p95: 2 },
        presentation: { p50: 8, p95: 8 },
        endToEnd: { p50: 40, p95: 40 },
      },
    });
  });

  it('keeps RTT unmeasured for local inference', () => {
    const recorder = new GestureBenchmarkRecorder();

    recorder.record(
      {
        sampledAtMs: 10,
        resultReadyAtMs: 20,
        inferenceMs: 8,
        rttMs: null,
        trackerMs: 1,
      },
      25,
    );

    expect(recorder.summary().metricsMs.rtt).toBeNull();
  });

  it('clears every in-memory sample between controlled rounds', () => {
    const recorder = new GestureBenchmarkRecorder();
    recorder.record(
      {
        sampledAtMs: 0,
        resultReadyAtMs: 10,
        inferenceMs: 8,
        rttMs: 9,
        trackerMs: 1,
      },
      12,
    );

    recorder.reset();

    expect(recorder.summary()).toEqual({
      sampleCount: 0,
      metricsMs: {
        captureToResponse: null,
        inference: null,
        rtt: null,
        tracker: null,
        presentation: null,
        endToEnd: null,
      },
    });
  });

  it('rounds exported percentiles to three decimal places', () => {
    const summary = summarizeGestureBenchmark([
      {
        captureToResponseMs: 1.23456,
        inferenceMs: 2.34567,
        rttMs: 3.45678,
        trackerMs: 4.56789,
        presentationMs: 5.67891,
        endToEndMs: 6.78912,
      },
    ]);

    expect(summary.metricsMs.captureToResponse).toEqual({ p50: 1.235, p95: 1.235 });
    expect(summary.metricsMs.endToEnd).toEqual({ p50: 6.789, p95: 6.789 });
  });
});
