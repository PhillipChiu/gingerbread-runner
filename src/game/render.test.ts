import { describe, expect, it } from 'vitest';
import {
  advanceGame,
  createGameState,
  getRunSpeed,
  GROUND_Y,
  PICKUP_BOB_AMPLITUDE,
  PICKUP_BOB_ANGULAR_SPEED,
  PICKUP_TOUCH_RADIUS,
  PLAYER_CENTER_X,
  type GameState,
} from './engine';
import { LEVELS } from './levels';
import { OBSTACLE_WIDTHS } from './obstaclePattern';
import { ARCH_HEIGHT } from './physics';
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

describe('bobbing energy fruit rendering', () => {
  it('draws the fruit glow and body at the collision bob position', () => {
    const initial = createGameState(LEVELS[0]!);
    const pickup = { id: 1, x: 913, y: GROUND_Y - 16 };
    const elapsed =
      (Math.PI * 1.5 - pickup.id) / PICKUP_BOB_ANGULAR_SPEED;
    const expectedY = pickup.y - PICKUP_BOB_AMPLITUDE;
    const radialGradientCenters: number[] = [];
    const fruitArcCenters: number[] = [];
    const gradient: CanvasGradient = {
      addColorStop: (_offset: number, _color: string) => {},
    };
    const context = new Proxy(
      {
        createLinearGradient: () => gradient,
        createRadialGradient: (x: number, y: number) => {
          if (x === pickup.x) {
            radialGradientCenters.push(y);
          }
          return gradient;
        },
        arc: (x: number, y: number) => {
          if (x === pickup.x) {
            fruitArcCenters.push(y);
          }
        },
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
    const state: GameState = { ...initial, elapsed, pickups: [pickup] };

    drawGameScene(context, state, { run: [], slide: [] });

    expect(radialGradientCenters).toContain(expectedY);
    expect(fruitArcCenters.length).toBeGreaterThan(0);
    expect(fruitArcCenters.every((y) => y === expectedY)).toBe(true);
  });
});

interface RecordedCall {
  name: string;
  args: number[];
}

function recordSceneCalls(state: GameState): RecordedCall[] {
  const calls: RecordedCall[] = [];
  const gradient: CanvasGradient = {
    addColorStop: (_offset: number, _color: string) => {},
  };
  const context = new Proxy(
    {
      createLinearGradient: () => gradient,
      createRadialGradient: () => gradient,
    } as unknown as CanvasRenderingContext2D,
    {
      get(target, property, receiver) {
        if (Reflect.has(target, property)) {
          return Reflect.get(target, property, receiver);
        }

        return (...args: number[]) => {
          calls.push({ name: String(property), args });
        };
      },
      set(target, property, value, receiver) {
        return Reflect.set(target, property, value, receiver);
      },
    },
  );

  drawGameScene(context, state, { run: [], slide: [] }, true);
  return calls;
}

function isSameCall(first: RecordedCall, second: RecordedCall): boolean {
  return (
    first.name === second.name &&
    JSON.stringify(first.args) === JSON.stringify(second.args)
  );
}

/** The calls `after` made on top of `before`, found by trimming the shared head and tail. */
function getInsertedCalls(
  before: RecordedCall[],
  after: RecordedCall[],
): RecordedCall[] {
  let head = 0;
  while (head < before.length && isSameCall(before[head]!, after[head]!)) {
    head += 1;
  }

  let tail = 0;
  while (
    tail < before.length - head &&
    isSameCall(
      before[before.length - 1 - tail]!,
      after[after.length - 1 - tail]!,
    )
  ) {
    tail += 1;
  }

  return after.slice(head, after.length - tail);
}

function getDrawnYs(calls: RecordedCall[]): number[] {
  return calls.flatMap(({ name, args }) => {
    if (name === 'moveTo' || name === 'lineTo') {
      return [args[1]!];
    }
    if (name === 'arcTo') {
      return [args[1]!, args[3]!];
    }
    if (name === 'arc') {
      return [args[1]! - args[2]!, args[1]! + args[2]!];
    }
    if (name === 'rect' || name === 'fillRect') {
      return [args[1]!, args[1]! + args[3]!];
    }

    return [];
  });
}

describe('ground gate rendering', () => {
  it('draws the gate from the ground up to the shared collision height', () => {
    const initial = createGameState(LEVELS[0]!);
    const gate = {
      id: 1,
      type: 'arch' as const,
      x: 700,
      width: OBSTACLE_WIDTHS.arch,
    };
    const gateCalls = getInsertedCalls(
      recordSceneCalls({ ...initial, obstacles: [] }),
      recordSceneCalls({ ...initial, obstacles: [gate] }),
    );
    const drawnYs = getDrawnYs(gateCalls);

    expect(drawnYs.length).toBeGreaterThan(0);
    expect(Math.min(...drawnYs)).toBe(GROUND_Y - ARCH_HEIGHT);
    expect(Math.max(...drawnYs)).toBe(GROUND_Y);
  });
});
