import { describe, expect, it } from 'vitest';
import {
  getRunnerAnimationPose,
  getRunnerFrameLayout,
  selectRunnerAnimation,
  RUNNER_BODY_BOB_AMPLITUDE,
  RUNNER_CYCLE_SECONDS,
  RUNNER_FRAMES_PER_SECOND,
} from './runnerAnimation';

describe('runner animation timing', () => {
  it('uses an 18 fps sprite cycle lasting about two thirds of a second', () => {
    expect(RUNNER_FRAMES_PER_SECOND).toBe(18);
    expect(RUNNER_CYCLE_SECONDS).toBeCloseTo(0.667, 2);
    expect(getRunnerAnimationPose(0, 12).frameIndex).toBe(0);
    expect(getRunnerAnimationPose(1 / RUNNER_FRAMES_PER_SECOND, 12).frameIndex).toBe(1);
    expect(getRunnerAnimationPose(RUNNER_CYCLE_SECONDS, 12).frameIndex).toBe(0);
  });

  it('wraps the stride phase without a discontinuity at the cycle boundary', () => {
    const beforeWrap = getRunnerAnimationPose(RUNNER_CYCLE_SECONDS - 0.000001, 12);
    const afterWrap = getRunnerAnimationPose(RUNNER_CYCLE_SECONDS, 12);

    expect(Math.abs(beforeWrap.bobOffset - afterWrap.bobOffset)).toBeLessThan(0.001);
    expect(Math.abs(beforeWrap.stride - afterWrap.stride)).toBeLessThan(0.001);
    expect(beforeWrap.contactStrength).toBeGreaterThan(0.99);
    expect(afterWrap.contactStrength).toBe(1);
  });

  it('alternates foot contacts and keeps the body bob within the requested stride', () => {
    const leftContact = getRunnerAnimationPose(0.01, 12);
    const rightContact = getRunnerAnimationPose(
      RUNNER_CYCLE_SECONDS / 2 + 0.01,
      12,
    );
    const bobSamples = Array.from({ length: 24 }, (_, index) =>
      getRunnerAnimationPose((index / 24) * RUNNER_CYCLE_SECONDS, 12).bobOffset,
    );

    expect(leftContact.contactFoot).toBe('left');
    expect(leftContact.contactStrength).toBeGreaterThan(0);
    expect(rightContact.contactFoot).toBe('right');
    expect(rightContact.contactStrength).toBeGreaterThan(0);
    expect(Math.max(...bobSamples) - Math.min(...bobSamples)).toBeCloseTo(
      RUNNER_BODY_BOB_AMPLITUDE * 2,
      1,
    );
  });

  it('maps the source cycle contact poses to frames zero and six', () => {
    const leftContactFrame = getRunnerAnimationPose(0, 12);
    const rightContactFrame = getRunnerAnimationPose(
      RUNNER_CYCLE_SECONDS / 2,
      12,
    );

    expect(leftContactFrame.frameIndex).toBe(0);
    expect(leftContactFrame.contactFoot).toBe('left');
    expect(leftContactFrame.contactStrength).toBe(1);
    expect(
      getRunnerAnimationPose(1 / RUNNER_FRAMES_PER_SECOND, 12).contactStrength,
    ).toBeGreaterThan(0);
    expect(rightContactFrame.frameIndex).toBe(6);
    expect(rightContactFrame.contactFoot).toBe('right');
    expect(rightContactFrame.contactStrength).toBe(1);
  });

  it('provides four distinct procedural fallback poses per sprite cycle', () => {
    const steps = [0.04, 0.21, 0.38, 0.55].map(
      (elapsed) => getRunnerAnimationPose(elapsed, 0).stepIndex,
    );

    expect(new Set(steps).size).toBe(4);
  });

  it('keeps a still frame and disables runner movement effects for reduced motion', () => {
    const pose = getRunnerAnimationPose(RUNNER_CYCLE_SECONDS / 4, 12, true);

    expect(pose.frameIndex).toBe(0);
    expect(pose.bobOffset).toBe(0);
    expect(pose.stride).toBe(0);
    expect(pose.stepIndex).toBe(0);
    expect(pose.contactStrength).toBe(0);
  });
});

describe('run and slide frame selection', () => {
  it('starts a held slide at frame one and loops independently from the run cycle', () => {
    expect(selectRunnerAnimation(false, 0.2, 0, 12).action).toBe('run');
    expect(selectRunnerAnimation(false, 0.2, 0, 12).pose.frameIndex).toBe(3);
    expect(selectRunnerAnimation(true, 8, 0, 12)).toMatchObject({
      action: 'slide',
      pose: { frameIndex: 0 },
    });
    expect(selectRunnerAnimation(true, 8, 1 / 18, 12).pose.frameIndex).toBe(1);
    expect(selectRunnerAnimation(true, 8, 1, 12).pose.frameIndex).toBe(6);
    expect(selectRunnerAnimation(true, 8, 0.72, 12, true)).toMatchObject({
      action: 'slide',
      pose: { frameIndex: 0 },
    });
  });
});

describe('runner sprite geometry', () => {
  it('normalizes frame sizes around a shared center and foot baseline', () => {
    const frames = [
      { width: 120, height: 100 },
      { width: 110, height: 96 },
      { width: 116, height: 98 },
    ];
    const layout = getRunnerFrameLayout(frames);

    expect(layout.width).toBe(120);
    expect(layout.height).toBe(100);
    expect(layout.placements).toEqual([
      { x: 0, y: 0 },
      { x: 5, y: 4 },
      { x: 2, y: 2 },
    ]);
    const baselines = layout.placements.map(
      (placement, index) => placement.y + frames[index]!.height,
    );
    expect(new Set(baselines).size).toBe(1);
  });
});
