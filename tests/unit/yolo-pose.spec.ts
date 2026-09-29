import { describe, expect, it } from 'vitest';
import { decodeYoloPose, type LetterboxTransform } from '@/gesture/yolo-pose';

const source = { width: 1920, height: 1080 };
const letterbox: LetterboxTransform = {
  inputWidth: 1280,
  inputHeight: 1280,
  scale: 2 / 3,
  padX: 0,
  padY: 280,
};

function tensor(candidateCount: number) {
  return new Float32Array(56 * candidateCount);
}

function setCandidate(
  output: Float32Array,
  candidateCount: number,
  candidate: number,
  values: Partial<Record<number, number>>,
) {
  for (const [channel, value] of Object.entries(values)) {
    output[Number(channel) * candidateCount + candidate] = value;
  }
}

describe('YOLO11 pose output decoding', () => {
  it('reverses letterbox coordinates and decodes all 17 keypoints', () => {
    const output = tensor(1);
    setCandidate(output, 1, 0, {
      0: 640,
      1: 640,
      2: 640,
      3: 320,
      4: 0.8,
      5: 640,
      6: 500,
      7: 0.9,
      53: 320,
      54: 400,
      55: 0.7,
    });

    const [person] = decodeYoloPose(output, 1, source, letterbox);

    expect(person.confidence).toBeCloseTo(0.8);
    expect(person.box).toEqual({ x1: 480, y1: 300, x2: 1440, y2: 780 });
    expect(person.normalizedBox.x).toBeCloseTo(0.25);
    expect(person.normalizedBox.y).toBeCloseTo(300 / 1080);
    expect(person.normalizedBox.width).toBeCloseTo(0.5);
    expect(person.normalizedBox.height).toBeCloseTo(480 / 1080);
    expect(person.keypoints).toHaveLength(17);
    expect(person.keypoints[0]).toEqual({ x: 960, y: 330, confidence: expect.closeTo(0.9) });
    expect(person.keypoints[16]).toEqual({ x: 480, y: 180, confidence: expect.closeTo(0.7) });
  });

  it('filters confidence below 0.25 while accepting the exact threshold', () => {
    const output = tensor(2);
    setCandidate(output, 2, 0, { 0: 300, 1: 500, 2: 100, 3: 200, 4: 0.2499 });
    setCandidate(output, 2, 1, { 0: 900, 1: 500, 2: 100, 3: 200, 4: 0.25 });

    const people = decodeYoloPose(output, 2, source, letterbox);

    expect(people).toHaveLength(1);
    expect(people[0].confidence).toBe(0.25);
  });

  it('clips boxes and keypoints to the source frame', () => {
    const output = tensor(1);
    setCandidate(output, 1, 0, {
      0: 100,
      1: 100,
      2: 600,
      3: 800,
      4: 0.9,
      5: -20,
      6: 1400,
      7: 0.8,
    });

    const [person] = decodeYoloPose(output, 1, source, letterbox);

    expect(person.box.x1).toBe(0);
    expect(person.box.y1).toBe(0);
    expect(person.box.x2).toBe(600);
    expect(person.box.y2).toBe(330);
    expect(person.keypoints[0]).toEqual({ x: 0, y: 1080, confidence: expect.closeTo(0.8) });
  });

  it('applies class-agnostic NMS and keeps the higher-confidence overlap', () => {
    const output = tensor(3);
    setCandidate(output, 3, 0, { 0: 500, 1: 600, 2: 300, 3: 300, 4: 0.7 });
    setCandidate(output, 3, 1, { 0: 510, 1: 610, 2: 300, 3: 300, 4: 0.9 });
    setCandidate(output, 3, 2, { 0: 1000, 1: 600, 2: 200, 3: 300, 4: 0.8 });

    const people = decodeYoloPose(output, 3, source, letterbox);

    expect(people.map((person) => person.confidence)).toEqual([
      expect.closeTo(0.9),
      expect.closeTo(0.8),
    ]);
  });

  it.each([
    ['wrong channel count', new Float32Array(55), 1],
    ['zero candidates', new Float32Array(), 0],
  ])('rejects %s', (_label, output, candidateCount) => {
    expect(() => decodeYoloPose(output, candidateCount, source, letterbox)).toThrow(
      'Saída YOLO Pose inválida.',
    );
  });
});
