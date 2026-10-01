import { describe, expect, it } from 'vitest';
import {
  advanceGame,
  createGameState,
  getRunSpeed,
  GROUND_Y,
  PICKUP_TOUCH_RADIUS,
  PLAYER_CENTER_X,
  type GameState,
} from './engine';
import { LEVELS } from './levels';
import { drawGameScene } from './render';
import {
  RUNNER_DRAW_BOUNDS,
  SLIDE_DRAW_BOUNDS,
} from './runnerAnimation';
import type { RunnerSpriteFrames } from './sprites';

type EllipseArguments = Parameters<CanvasRenderingContext2D['ellipse']>;

function drawFallbackBodyEllipse(sliding: boolean): EllipseArguments | null {
  const initial = createGameState(LEVELS[0]!);
  const state: GameState = sliding
    ? { ...initial, player: { ...initial.player, slideHeld: true } }
    : initial;
  let nextEllipseIsRunnerBody = false;
  let runnerBodyEllipse: EllipseArguments | null = null;
  const gradient: CanvasGradient = {
    addColorStop: (_offset: number, _color: string) => {},
  };
  const context = new Proxy(
    {
      translate: (_x: number, _y: number) => {
        nextEllipseIsRunnerBody = true;
      },
      ellipse: (...args: EllipseArguments) => {
        if (nextEllipseIsRunnerBody) {
          runnerBodyEllipse = args;
          nextEllipseIsRunnerBody = false;
        }
      },
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
    } as unknown as CanvasRenderingContext2D,
    {
      get(target, property, receiver) {
        return Reflect.get(target, property, receiver) ?? (() => {});
      },
      set(target, property, value, receiver) {
        return Reflect.set(target, property, value, receiver);
      },
    },
  );

  const missingFrames: RunnerSpriteFrames = { run: [], slide: [] };
  drawGameScene(context, state, missingFrames, true);

  return runnerBodyEllipse;
}

function advanceFallbackPickup(sliding: boolean, outsideTouchRange: boolean) {
  const initial = createGameState(LEVELS[0]!);
  const bounds = sliding ? SLIDE_DRAW_BOUNDS : RUNNER_DRAW_BOUNDS;
  const delta = 0.05;
  const pickupX =
    PLAYER_CENTER_X +
    bounds.width / 2 +
    PICKUP_TOUCH_RADIUS +
    (outsideTouchRange ? 1 : -1);
  const state: GameState = {
    ...initial,
    energy: 60,
    nextPickupIn: 5,
    obstacleSections: [],
    player: sliding
      ? { ...initial.player, slideHeld: true }
      : initial.player,
    pickups: [
      {
        id: 0,
        x: pickupX + getRunSpeed(initial.level, initial.distance) * delta,
        y: GROUND_Y - bounds.height / 2,
      },
    ],
  };

  return advanceGame(state, delta, () => 0.9, true);
}

describe('fallback runner pickup bounds', () => {
  it.each([
    ['running', false, RUNNER_DRAW_BOUNDS],
    ['sliding', true, SLIDE_DRAW_BOUNDS],
  ] as const)(
    'renders the %s fallback within its shared collision bounds',
    (_action, sliding, bounds) => {
      const bodyEllipse = drawFallbackBodyEllipse(sliding);

      expect(bodyEllipse).not.toBeNull();
      expect(bodyEllipse).toEqual([
        0,
        -bounds.height / 2,
        (bounds.width - 7) / 2,
        (bounds.height - 7) / 2,
        0,
        0,
        Math.PI * 2,
      ]);
    },
  );

  it.each([
    ['running', false],
    ['sliding', true],
  ] as const)(
    'collects a fruit touching the %s fallback and leaves a separated one',
    (_action, sliding) => {
      const touching = advanceFallbackPickup(sliding, false);
      const separated = advanceFallbackPickup(sliding, true);

      expect(touching.collectibles).toBe(1);
      expect(touching.pickups).toHaveLength(0);
      expect(separated.collectibles).toBe(0);
      expect(separated.pickups).toHaveLength(1);
    },
  );
});
