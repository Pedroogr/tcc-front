import { describe, expect, it } from 'vitest';
import {
  getRaisedHandSide,
  isValidPerson,
  MIN_BOX_HEIGHT,
  MIN_BOX_WIDTH,
} from '@/gesture/pose-rules';
import type { PersonPose, PoseKeypoint } from '@/gesture/pose-types';

function point(x = 0, y = 0, confidence = 0): PoseKeypoint {
  return { x, y, confidence };
}

function pose(width = 100, height = 180): PersonPose {
  return {
    confidence: 0.9,
    box: { x1: 10, y1: 20, x2: 10 + width, y2: 20 + height },
    normalizedBox: { x: 0.1, y: 0.1, width: 0.4, height: 0.7 },
    keypoints: Array.from({ length: 17 }, () => point()),
  };
}

describe('PoC person validity rules', () => {
  it('accepts the exact minimum box when a shoulder and head are reliable', () => {
    const person = pose(MIN_BOX_WIDTH, MIN_BOX_HEIGHT);
    person.keypoints[0] = point(40, 30, 0.35);
    person.keypoints[5] = point(35, 70, 0.35);

    expect(isValidPerson(person)).toBe(true);
  });

  it('rejects a box below either minimum dimension', () => {
    const tooNarrow = pose(MIN_BOX_WIDTH - 0.01, MIN_BOX_HEIGHT);
    const tooShort = pose(MIN_BOX_WIDTH, MIN_BOX_HEIGHT - 0.01);
    for (const person of [tooNarrow, tooShort]) {
      person.keypoints[0] = point(40, 30, 0.9);
      person.keypoints[5] = point(35, 70, 0.9);
    }

    expect(isValidPerson(tooNarrow)).toBe(false);
    expect(isValidPerson(tooShort)).toBe(false);
  });

  it.each([
    ['one shoulder and head', [5, 0]],
    ['both shoulders', [5, 6]],
    ['one shoulder, hip, and four reliable points', [5, 11, 7, 9]],
    ['one shoulder and six reliable points', [5, 7, 9, 13, 14, 15]],
  ])('accepts %s', (_label, indexes) => {
    const person = pose();
    indexes.forEach((index) => {
      person.keypoints[index] = point(50, 50 + index, 0.9);
    });

    expect(isValidPerson(person)).toBe(true);
  });

  it('rejects a plausible box without a reliable shoulder', () => {
    const person = pose();
    [0, 1, 2, 11, 12, 13, 14].forEach((index) => {
      person.keypoints[index] = point(50, 50 + index, 0.9);
    });

    expect(isValidPerson(person)).toBe(false);
  });
});

describe('PoC raised-hand rules', () => {
  function validUpperBody() {
    const person = pose();
    person.keypoints[5] = point(40, 100, 0.9);
    person.keypoints[6] = point(80, 100, 0.9);
    return person;
  }

  it('requires a scale-relative margin above the shoulder when the elbow is unavailable', () => {
    const person = validUpperBody();
    person.keypoints[9] = point(40, 100, 0.9);
    expect(getRaisedHandSide(person)).toBe(null);

    person.keypoints[9] = point(40, 99.99, 0.9);
    expect(getRaisedHandSide(person)).toBe(null);

    person.keypoints[9] = point(40, 90, 0.9);
    expect(getRaisedHandSide(person)).toBe('left');
  });

  it('accepts a bent raised forearm with the wrist near the shoulder', () => {
    const person = validUpperBody();
    person.keypoints[9] = point(40, 108, 0.9);
    person.keypoints[7] = point(40, 160, 0.9);

    expect(getRaisedHandSide(person)).toBe('left');
  });

  it('classifies equivalent raised arms consistently at different scales', () => {
    const nearby = validUpperBody();
    nearby.keypoints[9] = point(40, 70, 0.9);
    nearby.keypoints[7] = point(40, 170, 0.9);

    const distant = pose(200, 360);
    distant.keypoints[5] = point(80, 200, 0.9);
    distant.keypoints[6] = point(160, 200, 0.9);
    distant.keypoints[9] = point(80, 140, 0.9);
    distant.keypoints[7] = point(80, 340, 0.9);

    expect(getRaisedHandSide(nearby)).toBe('left');
    expect(getRaisedHandSide(distant)).toBe('left');
  });

  it('does not treat a horizontal forearm near the shoulder as raised', () => {
    const person = validUpperBody();
    person.keypoints[7] = point(20, 105, 0.9);
    person.keypoints[9] = point(80, 105, 0.9);

    expect(getRaisedHandSide(person)).toBe(null);
  });

  it('does not treat a shallow, nearly horizontal forearm as raised', () => {
    const person = validUpperBody();
    person.keypoints[7] = point(20, 108, 0.9);
    person.keypoints[9] = point(80, 101, 0.9);

    expect(getRaisedHandSide(person)).toBe(null);
  });

  it('ignores an unreliable elbow but requires reliable shoulder and wrist', () => {
    const person = validUpperBody();
    person.keypoints[7] = point(40, 500, 0.34);
    person.keypoints[9] = point(40, 70, 0.9);
    expect(getRaisedHandSide(person)).toBe('left');

    person.keypoints[9] = point(40, 70, 0.34);
    expect(getRaisedHandSide(person)).toBe(null);
  });

  it('reports left, right, and both without treating a normal pose as raised', () => {
    const person = validUpperBody();
    expect(getRaisedHandSide(person)).toBe(null);

    person.keypoints[9] = point(40, 70, 0.9);
    expect(getRaisedHandSide(person)).toBe('left');

    person.keypoints[9] = point(40, 120, 0.9);
    person.keypoints[10] = point(80, 70, 0.9);
    expect(getRaisedHandSide(person)).toBe('right');

    person.keypoints[9] = point(40, 70, 0.9);
    expect(getRaisedHandSide(person)).toBe('both');
  });
});
