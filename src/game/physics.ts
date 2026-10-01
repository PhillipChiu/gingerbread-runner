import type { LevelConfig } from './levels';

export const JUMP_GRAVITY = 1_650;
export const JUMP_IMPULSE = 675;
export const STUMP_JUMP_CLEARANCE = 40;
export const GAP_JUMP_CLEARANCE = 58;

export function getRunSpeed(level: LevelConfig, distance: number): number {
  const progress = Math.min(Math.max(distance / level.distanceGoal, 0), 1);
  return level.baseSpeed + level.speedRamp * progress;
}

export function getJumpAvoidanceTimeWindow(
  obstacleType: 'stump' | 'gap',
): { ascentSeconds: number; descentSeconds: number } {
  const minimumHeight =
    obstacleType === 'gap' ? GAP_JUMP_CLEARANCE : STUMP_JUMP_CLEARANCE;
  const root = Math.sqrt(
    JUMP_IMPULSE ** 2 - 2 * JUMP_GRAVITY * minimumHeight,
  );

  return {
    ascentSeconds: (JUMP_IMPULSE - root) / JUMP_GRAVITY,
    descentSeconds: (JUMP_IMPULSE + root) / JUMP_GRAVITY,
  };
}
