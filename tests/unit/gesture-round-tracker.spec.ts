import { describe, expect, it } from 'vitest';
import {
  GestureRoundTracker,
  ROUND_CLEAR_TO_REARM_MS,
  ROUND_SELECTION_MS,
  TRACK_FORGET_AFTER_MS,
} from '@/gesture/gesture-round-tracker';
import type { PersonPose, PoseKeypoint } from '@/gesture/pose-types';

function keypoint(x = 0, y = 0, confidence = 0): PoseKeypoint {
  return { x, y, confidence };
}

function person(x: number, raised = false): PersonPose {
  const keypoints = Array.from({ length: 17 }, () => keypoint());
  keypoints[0] = keypoint(x + 50, 120, 0.9);
  keypoints[5] = keypoint(x + 30, 180, 0.9);
  keypoints[6] = keypoint(x + 70, 180, 0.9);
  keypoints[7] = keypoint(x + 30, 170, 0.9);
  keypoints[9] = keypoint(x + 30, raised ? 140 : 220, 0.9);
  return {
    confidence: 0.9,
    box: { x1: x, y1: 100, x2: x + 100, y2: 300 },
    normalizedBox: { x: x / 1000, y: 0.1, width: 0.1, height: 0.2 },
    keypoints,
  };
}

describe('GestureRoundTracker stability and ordering', () => {
  it('does not confirm three consecutive samples spanning less than 250 ms', () => {
    const tracker = new GestureRoundTracker();

    expect(tracker.update([person(100, true)], 0)).toBeNull();
    expect(tracker.update([person(104, true)], 90)).toBeNull();
    expect(tracker.update([person(108, true)], 180)).toBeNull();
    expect(tracker.update([person(112, true)], 250)?.raisedAtMs).toBe(0);
  });

  it('resets a transient raise before it can become a candidate', () => {
    const tracker = new GestureRoundTracker();

    tracker.update([person(100, true)], 0);
    tracker.update([person(100, true)], 150);
    tracker.update([person(100, false)], 260);
    expect(tracker.update([person(100, true)], 500)).toBeNull();
    expect(tracker.update([person(100, true)], 630)).toBeNull();
    expect(tracker.update([person(100, true)], 750)?.raisedAtMs).toBe(500);
  });

  it('selects the earliest rising edge when candidates confirm together', () => {
    const tracker = new GestureRoundTracker();

    tracker.update([person(100, true), person(500, false)], 0);
    tracker.update([person(103, true), person(500, true)], 50);
    tracker.update([person(106, true), person(500, true)], 150);
    const selected = tracker.update([person(109, true), person(500, true)], 300);

    expect(selected?.raisedAtMs).toBe(0);
    expect(selected?.personBox.x).toBeCloseTo(0.109);
  });

  it('breaks simultaneous ties by screen position rather than detector order', () => {
    const tracker = new GestureRoundTracker();

    tracker.update([person(600, true), person(100, true)], 0);
    tracker.update([person(600, true), person(100, true)], 130);
    const selected = tracker.update([person(600, true), person(100, true)], 260);

    expect(selected?.personBox.x).toBeCloseTo(0.1);
  });

  it('keeps the selected person fixed for five seconds even after lowering', () => {
    const tracker = new GestureRoundTracker();
    tracker.update([person(100, true)], 0);
    tracker.update([person(100, true)], 130);
    const selected = tracker.update([person(100, true)], 260);

    expect(tracker.update([person(700, true), person(100, false)], 1_000)).toBe(selected);
    expect(tracker.update([], 260 + ROUND_SELECTION_MS - 1)).toBe(selected);
    expect(tracker.update([], 260 + ROUND_SELECTION_MS)).toBeNull();
  });

  it('requires 500 clear milliseconds after expiry and never retriggers a held hand', () => {
    const tracker = new GestureRoundTracker();
    tracker.update([person(100, true)], 0);
    tracker.update([person(100, true)], 130);
    tracker.update([person(100, true)], 260);

    expect(tracker.update([person(100, true)], 5_260)).toBeNull();
    expect(tracker.update([person(100, true)], 6_000)).toBeNull();
    expect(tracker.update([], 6_100)).toBeNull();
    expect(tracker.update([], 6_100 + ROUND_CLEAR_TO_REARM_MS - 1)).toBeNull();
    expect(tracker.update([], 6_100 + ROUND_CLEAR_TO_REARM_MS)).toBeNull();

    expect(tracker.update([person(100, true)], 6_700)).toBeNull();
    expect(tracker.update([person(100, true)], 6_830)).toBeNull();
    expect(tracker.update([person(100, true)], 6_960)?.raisedAtMs).toBe(6_700);
  });

  it('matches a moving person long enough to confirm without exposing a track id', () => {
    const tracker = new GestureRoundTracker();

    tracker.update([person(100, true)], 0);
    tracker.update([person(118, true)], 130);
    const selected = tracker.update([person(136, true)], 260);

    expect(selected?.raisedAtMs).toBe(0);
    expect(selected).not.toHaveProperty('trackId');
  });

  it('does not create a second winner when a held hand crosses another track', () => {
    const tracker = new GestureRoundTracker();
    tracker.update([person(100, true), person(600, false)], 0);
    tracker.update([person(180, true), person(520, false)], 130);
    const selected = tracker.update([person(260, true), person(440, false)], 260);

    expect(selected?.raisedAtMs).toBe(0);
    expect(
      tracker.update([person(420, true), person(280, false)], 2_000),
    ).toBe(selected);
    expect(
      tracker.update([person(600, true), person(100, false)], 5_260),
    ).toBeNull();
    expect(
      tracker.update([person(620, true), person(80, false)], 6_000),
    ).toBeNull();
  });

  it('forgets an absent track after three seconds', () => {
    const tracker = new GestureRoundTracker();
    tracker.update([person(100, false)], 0);
    expect(tracker.trackedPersonCount).toBe(1);

    tracker.update([], TRACK_FORGET_AFTER_MS);
    expect(tracker.trackedPersonCount).toBe(1);
    tracker.update([], TRACK_FORGET_AFTER_MS + 1);
    expect(tracker.trackedPersonCount).toBe(0);
  });
});
