import type { LevelConfig } from './levels';

export const JUMP_GRAVITY = 1_650;
export const JUMP_IMPULSE = 675;
export const DOUBLE_JUMP_IMPULSE = 470;
export const STUMP_JUMP_CLEARANCE = 40;
export const GAP_JUMP_CLEARANCE = 58;
export const HIGH_STUMP_HEIGHT = 160;
export const HIGH_STUMP_JUMP_CLEARANCE = HIGH_STUMP_HEIGHT;

export interface VerticalMotion {
  height: number;
  velocity: number;
  landed: boolean;
}

export function advanceVerticalMotion(
  height: number,
  velocity: number,
  deltaSeconds: number,
): VerticalMotion {
  if (deltaSeconds <= 0 || (height === 0 && velocity === 0)) {
    return { height, velocity, landed: false };
  }

  const nextHeight =
    height +
    velocity * deltaSeconds -
    0.5 * JUMP_GRAVITY * deltaSeconds ** 2;
  const nextVelocity = velocity - JUMP_GRAVITY * deltaSeconds;

  if (nextHeight <= 1e-9 && nextVelocity < 0) {
    return { height: 0, velocity: 0, landed: true };
  }

  return {
    height: Math.max(0, nextHeight),
    velocity: nextVelocity,
    landed: false,
  };
}

export function getVerticalHeightAtTime(
  initialHeight: number,
  initialVelocity: number,
  elapsedSeconds: number,
): number {
  return (
    initialHeight +
    initialVelocity * elapsedSeconds -
    0.5 * JUMP_GRAVITY * elapsedSeconds ** 2
  );
}

export function getVerticalClearanceTimeWindow(
  initialHeight: number,
  initialVelocity: number,
  minimumHeight: number,
): { ascentSeconds: number; descentSeconds: number } | null {
  const discriminant =
    initialVelocity ** 2 -
    2 * JUMP_GRAVITY * (minimumHeight - initialHeight);
  if (discriminant < 0) {
    return null;
  }

  const root = Math.sqrt(discriminant);
  const ascentSeconds = Math.max(
    0,
    (initialVelocity - root) / JUMP_GRAVITY,
  );
  const descentSeconds = (initialVelocity + root) / JUMP_GRAVITY;

  return descentSeconds > ascentSeconds
    ? { ascentSeconds, descentSeconds }
    : null;
}

export function getRunSpeed(level: LevelConfig, distance: number): number {
  const progress = Math.min(Math.max(distance / level.distanceGoal, 0), 1);
  return level.baseSpeed + level.speedRamp * progress;
}

export function getJumpAvoidanceTimeWindow(
  obstacleType: 'stump' | 'gap',
): { ascentSeconds: number; descentSeconds: number } {
  const minimumHeight =
    obstacleType === 'gap' ? GAP_JUMP_CLEARANCE : STUMP_JUMP_CLEARANCE;
  return getVerticalClearanceTimeWindow(0, JUMP_IMPULSE, minimumHeight)!;
}
