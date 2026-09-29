import { getRaisedHandSide, isValidPerson } from './pose-rules';
import type { NormalizedBox, PersonPose, RaisedHandSide } from './pose-types';

export const MIN_RAISED_SAMPLES = 3;
export const MIN_RAISED_SPAN_MS = 250;
export const ROUND_SELECTION_MS = 5_000;
export const ROUND_CLEAR_TO_REARM_MS = 500;
export const TRACK_FORGET_AFTER_MS = 3_000;
export const TRACK_MIN_IOU = 0.3;
export const TRACK_MAX_CENTROID_DISTANCE = 0.15;

type Track = {
  id: number;
  pose: PersonPose;
  lastSeenMs: number;
  raised: boolean;
  raisedAtMs: number | null;
  raisedSamples: number;
  confirmed: boolean;
  handSide: RaisedHandSide;
};

export type RoundSelection = {
  raisedAtMs: number;
  selectedAtMs: number;
  expiresAtMs: number;
  personBox: NormalizedBox;
  pose: PersonPose;
  handSide: Exclude<RaisedHandSide, null>;
};

function boxIou(left: NormalizedBox, right: NormalizedBox) {
  const leftX2 = left.x + left.width;
  const leftY2 = left.y + left.height;
  const rightX2 = right.x + right.width;
  const rightY2 = right.y + right.height;
  const width = Math.max(0, Math.min(leftX2, rightX2) - Math.max(left.x, right.x));
  const height = Math.max(0, Math.min(leftY2, rightY2) - Math.max(left.y, right.y));
  const intersection = width * height;
  if (!intersection) return 0;
  return intersection / (left.width * left.height + right.width * right.height - intersection);
}

function centroidDistance(left: NormalizedBox, right: NormalizedBox) {
  const dx = left.x + left.width / 2 - (right.x + right.width / 2);
  const dy = left.y + left.height / 2 - (right.y + right.height / 2);
  return Math.hypot(dx, dy);
}

function clearRaisedState(track: Track) {
  track.raised = false;
  track.raisedAtMs = null;
  track.raisedSamples = 0;
  track.confirmed = false;
  track.handSide = null;
}

export class GestureRoundTracker {
  private tracks = new Map<number, Track>();
  private nextTrackId = 1;
  private selection: RoundSelection | null = null;
  private mode: 'armed' | 'selected' | 'cooldown' = 'armed';
  private clearSinceMs: number | null = null;

  get trackedPersonCount() {
    return this.tracks.size;
  }

  update(poses: PersonPose[], sampledAtMs: number): RoundSelection | null {
    this.forgetOldTracks(sampledAtMs);
    const visibleTracks = this.matchAndUpdate(
      poses.filter(isValidPerson),
      sampledAtMs,
    );

    if (this.mode === 'selected' && this.selection) {
      if (sampledAtMs < this.selection.expiresAtMs) {
        return this.selection;
      }
      this.selection = null;
      this.mode = 'cooldown';
      this.clearSinceMs = null;
    }

    if (this.mode === 'cooldown') {
      const anyRaised = visibleTracks.some((track) => track.raised);
      if (anyRaised) {
        this.clearSinceMs = null;
      } else if (this.clearSinceMs === null) {
        this.clearSinceMs = sampledAtMs;
      } else if (sampledAtMs - this.clearSinceMs >= ROUND_CLEAR_TO_REARM_MS) {
        this.mode = 'armed';
        this.clearSinceMs = null;
        this.tracks.forEach(clearRaisedState);
      }
      return null;
    }

    const winner = visibleTracks
      .filter(
        (track) =>
          track.raised && track.confirmed && track.raisedAtMs !== null && track.handSide,
      )
      .sort(
        (left, right) =>
          (left.raisedAtMs as number) - (right.raisedAtMs as number) ||
          left.pose.normalizedBox.x - right.pose.normalizedBox.x ||
          left.id - right.id,
      )[0];

    if (!winner || winner.raisedAtMs === null || !winner.handSide) {
      return null;
    }

    this.selection = {
      raisedAtMs: winner.raisedAtMs,
      selectedAtMs: sampledAtMs,
      expiresAtMs: sampledAtMs + ROUND_SELECTION_MS,
      personBox: { ...winner.pose.normalizedBox },
      pose: winner.pose,
      handSide: winner.handSide,
    };
    this.mode = 'selected';
    return this.selection;
  }

  private forgetOldTracks(nowMs: number) {
    for (const [id, track] of this.tracks) {
      if (nowMs - track.lastSeenMs > TRACK_FORGET_AFTER_MS) {
        this.tracks.delete(id);
      }
    }
  }

  private matchAndUpdate(poses: PersonPose[], sampledAtMs: number) {
    const trackList = [...this.tracks.values()];
    const assignments = new Map<number, Track>();
    const assignedTrackIds = new Set<number>();
    const assignedPoseIndexes = new Set<number>();
    const iouPairs: Array<{ track: Track; poseIndex: number; score: number }> = [];

    trackList.forEach((track) => {
      poses.forEach((pose, poseIndex) => {
        const score = boxIou(track.pose.normalizedBox, pose.normalizedBox);
        if (score >= TRACK_MIN_IOU) iouPairs.push({ track, poseIndex, score });
      });
    });
    iouPairs.sort((left, right) => right.score - left.score || left.track.id - right.track.id);
    for (const pair of iouPairs) {
      if (assignedTrackIds.has(pair.track.id) || assignedPoseIndexes.has(pair.poseIndex)) continue;
      assignments.set(pair.poseIndex, pair.track);
      assignedTrackIds.add(pair.track.id);
      assignedPoseIndexes.add(pair.poseIndex);
    }

    const distancePairs: Array<{ track: Track; poseIndex: number; distance: number }> = [];
    trackList
      .filter((track) => !assignedTrackIds.has(track.id))
      .forEach((track) => {
        poses.forEach((pose, poseIndex) => {
          if (assignedPoseIndexes.has(poseIndex)) return;
          const distance = centroidDistance(track.pose.normalizedBox, pose.normalizedBox);
          if (distance <= TRACK_MAX_CENTROID_DISTANCE) {
            distancePairs.push({ track, poseIndex, distance });
          }
        });
      });
    distancePairs.sort(
      (left, right) => left.distance - right.distance || left.track.id - right.track.id,
    );
    for (const pair of distancePairs) {
      if (assignedTrackIds.has(pair.track.id) || assignedPoseIndexes.has(pair.poseIndex)) continue;
      assignments.set(pair.poseIndex, pair.track);
      assignedTrackIds.add(pair.track.id);
      assignedPoseIndexes.add(pair.poseIndex);
    }

    trackList
      .filter((track) => !assignedTrackIds.has(track.id))
      .forEach(clearRaisedState);

    const unmatchedPoseIndexes = poses
      .map((_, index) => index)
      .filter((index) => !assignedPoseIndexes.has(index))
      .sort((left, right) => poses[left].normalizedBox.x - poses[right].normalizedBox.x);
    for (const poseIndex of unmatchedPoseIndexes) {
      const track: Track = {
        id: this.nextTrackId++,
        pose: poses[poseIndex],
        lastSeenMs: sampledAtMs,
        raised: false,
        raisedAtMs: null,
        raisedSamples: 0,
        confirmed: false,
        handSide: null,
      };
      this.tracks.set(track.id, track);
      assignments.set(poseIndex, track);
    }

    const visibleTracks: Track[] = [];
    poses.forEach((pose, poseIndex) => {
      const track = assignments.get(poseIndex);
      if (!track) return;
      track.pose = pose;
      track.lastSeenMs = sampledAtMs;
      this.updateRaisedState(track, sampledAtMs);
      visibleTracks.push(track);
    });
    return visibleTracks;
  }

  private updateRaisedState(track: Track, sampledAtMs: number) {
    const handSide = getRaisedHandSide(track.pose);
    if (!handSide) {
      clearRaisedState(track);
      return;
    }

    if (!track.raised || track.raisedAtMs === null) {
      track.raised = true;
      track.raisedAtMs = sampledAtMs;
      track.raisedSamples = 1;
      track.confirmed = false;
    } else {
      track.raisedSamples += 1;
    }
    track.handSide = handSide;
    track.confirmed =
      track.raisedSamples >= MIN_RAISED_SAMPLES &&
      sampledAtMs - track.raisedAtMs >= MIN_RAISED_SPAN_MS;
  }
}
