import { describe, expect, it } from 'vitest';
import {
  advanceGame,
  applyPlayerAction,
  createGameState,
  getRunSpeed,
  PLAYER_CENTER_X,
} from './engine';
import { LEVELS } from './levels';

describe('ten-stage runner data', () => {
  it('contains ten stages with increasing distance and pace', () => {
    expect(LEVELS).toHaveLength(10);

    for (let index = 1; index < LEVELS.length; index += 1) {
      expect(LEVELS[index]!.distanceGoal).toBeGreaterThan(LEVELS[index - 1]!.distanceGoal);
      expect(LEVELS[index]!.baseSpeed).toBeGreaterThan(LEVELS[index - 1]!.baseSpeed);
      expect(LEVELS[index]!.obstacleInterval).toBeLessThan(LEVELS[index - 1]!.obstacleInterval);
    }
  });

  it('ramps speed with distance but never exceeds the level ramp', () => {
    const level = LEVELS[0]!;

    expect(getRunSpeed(level, 0)).toBe(level.baseSpeed);
    expect(getRunSpeed(level, level.distanceGoal)).toBe(level.baseSpeed + level.speedRamp);
    expect(getRunSpeed(level, level.distanceGoal * 2)).toBe(level.baseSpeed + level.speedRamp);
  });
});

describe('runner state', () => {
  it('supports grounded jumps and timed slides but not double-jumps', () => {
    const initial = createGameState(LEVELS[0]!);
    const jumping = applyPlayerAction(initial, 'jump');
    const sliding = applyPlayerAction(initial, 'slide');

    expect(jumping.player.jumpVelocity).toBeGreaterThan(0);
    expect(sliding.player.slideRemaining).toBeGreaterThan(0);
    expect(applyPlayerAction(jumping, 'jump')).toBe(jumping);
  });

  it('uses only run energy as a collision penalty', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      combo: 3,
      nextObstacleIn: 5,
      nextPickupIn: 5,
      obstacles: [{ id: 10, type: 'stump' as const, x: 246, width: 58 }],
    };
    const hit = advanceGame(state, 0.05, () => 0.9);

    expect(hit.energy).toBeLessThan(initial.energy);
    expect(hit.status).toBe('running');
    expect(hit.invulnerability).toBeGreaterThan(0);
    expect(hit.obstacles).toHaveLength(0);
    expect(hit.combo).toBe(state.combo);
    expect(hit.score).toBeGreaterThan(state.score);
    expect(hit).not.toHaveProperty('lives');
  });

  it('ends the run when collision drains the single energy resource', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      energy: 20,
      nextObstacleIn: 5,
      nextPickupIn: 5,
      obstacles: [{ id: 10, type: 'stump' as const, x: 246, width: 58 }],
    };
    const exhausted = advanceGame(state, 0.05, () => 0.9);

    expect(exhausted.energy).toBe(0);
    expect(exhausted.status).toBe('lost');
  });

  it('ends the run when passive energy drain reaches zero', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      energy: 0.01,
      nextObstacleIn: 5,
      nextPickupIn: 5,
    };
    const exhausted = advanceGame(state, 0.05, () => 0.9);

    expect(exhausted.energy).toBe(0);
    expect(exhausted.status).toBe('lost');
  });

  it('allows a jump to clear a tree stump', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      nextObstacleIn: 5,
      nextPickupIn: 5,
      player: { jumpHeight: 92, jumpVelocity: 0, slideRemaining: 0 },
      obstacles: [{ id: 11, type: 'stump' as const, x: 246, width: 58 }],
    };
    const cleared = advanceGame(state, 0.05, () => 0.9);

    expect(cleared.energy).toBeGreaterThan(99);
    expect(cleared.obstacles).toHaveLength(1);
  });

  it('collects a nearby energy fruit for score and run energy', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      energy: 60,
      score: 150,
      nextObstacleIn: 5,
      nextPickupIn: 5,
      pickups: [{ id: 12, x: PLAYER_CENTER_X + 12, y: 270 }],
    };
    const collected = advanceGame(state, 0.05, () => 0.9);

    expect(collected.collectibles).toBe(1);
    expect(collected.score).toBeGreaterThan(state.score);
    expect(collected.energy).toBeGreaterThan(state.energy);
    expect(collected.pickups).toHaveLength(0);
  });

  it('finishes a level at its configured distance goal', () => {
    const initial = createGameState(LEVELS[0]!);
    const almostThere = {
      ...initial,
      distance: initial.level.distanceGoal - 2,
      nextObstacleIn: 5,
      nextPickupIn: 5,
    };
    const finished = advanceGame(almostThere, 0.05, () => 0.9);

    expect(finished.status).toBe('won');
    expect(finished.distance).toBe(initial.level.distanceGoal);
  });
});
