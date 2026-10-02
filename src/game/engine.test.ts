import { describe, expect, it } from 'vitest';
import {
  advanceGame,
  applyPlayerAction,
  createGameState,
  getRunSpeed,
  GROUND_Y,
  PICKUP_BOB_ANGULAR_SPEED,
  PLAYER_CENTER_X,
  PLAYER_WIDTH,
  PLAYER_X,
  WORLD_HEIGHT,
  type GameState,
} from './engine';
import { LEVELS } from './levels';
import {
  expandObstaclePattern,
  getObstacleCue,
  OBSTACLE_WIDTHS,
} from './obstaclePattern';
import {
  DOUBLE_JUMP_IMPULSE,
  HIGH_STUMP_HEIGHT,
  HIGH_STUMP_JUMP_CLEARANCE,
  JUMP_GRAVITY,
  JUMP_IMPULSE,
} from './physics';
import { RUNNER_DRAW_BOUNDS } from './runnerAnimation';

const SIMULATION_FRAME_SECONDS = 0.05;

function getActionableJumpDistances(
  level: (typeof LEVELS)[number],
  cueKey: string,
  contactDistance: number,
): number[] {
  const distances: number[] = [];
  for (
    let distance = contactDistance - 300;
    distance < contactDistance;
    distance += 1
  ) {
    const cue = getObstacleCue(level, distance);
    if (cue?.key === cueKey && cue.kind === 'jump') {
      distances.push(distance);
    }
  }

  return distances;
}

function expectJumpAtCueToClearObstacle(
  level: (typeof LEVELS)[number],
  obstacle: ReturnType<typeof expandObstaclePattern>['obstacles'][number],
  takeoffDistance: number,
): void {
  const initial = createGameState(level);
  let state = applyPlayerAction(
    {
      ...initial,
      distance: takeoffDistance,
      obstacleSchedule: [obstacle],
      obstacleSections: [],
      nextScheduledObstacleIndex: 0,
      nextPickupIn: 5,
    },
    'jump',
  );
  const clearDistance = obstacle.contactDistance + obstacle.width + 59;

  for (
    let frame = 0;
    frame < 40 && state.distance <= clearDistance && state.status === 'running';
    frame += 1
  ) {
    state = advanceGame(state, 0.05, () => 0.9);
  }

  expect(state.distance).toBeGreaterThan(clearDistance);
  expect(state.status).toBe('running');
  expect(state.energy).toBeGreaterThan(99);
  expect(
    state.obstacles.some(
      (remaining) => remaining.contactDistance === obstacle.contactDistance,
    ),
  ).toBe(true);
}

function createIsolatedObstacleState(
  level: (typeof LEVELS)[number],
  obstacles: ReturnType<typeof expandObstaclePattern>['obstacles'],
  distance: number,
): GameState {
  const initial = createGameState(level);

  return {
    ...initial,
    distance,
    obstacleSchedule: obstacles,
    obstacleSections: [],
    obstacleQuietZones: [],
    nextScheduledObstacleIndex: 0,
    nextPickupIn: 5,
  };
}

function getHighStumpFirstJumpCueDistances(
  level: (typeof LEVELS)[number],
  obstacle: ReturnType<typeof expandObstaclePattern>['obstacles'][number],
): number[] {
  const distances: number[] = [];
  const cueKey = `${obstacle.patternId}:first-jump`;

  for (
    let distance = Math.max(0, obstacle.contactDistance - 400);
    distance < obstacle.contactDistance;
    distance += 1
  ) {
    const cue = getObstacleCue(level, distance);
    if (cue?.key === cueKey && cue.kind === 'jump') {
      distances.push(distance);
    }
  }

  return distances;
}

function observeHighStumpDoubleJumpCueDistances(
  level: (typeof LEVELS)[number],
  obstacle: ReturnType<typeof expandObstaclePattern>['obstacles'][number],
  takeoffDistance: number,
): number[] {
  let state = createIsolatedObstacleState(level, [obstacle], takeoffDistance);
  state = applyPlayerAction(state, 'jump');
  const distances: number[] = [];
  const cueKey = `${obstacle.patternId}:double-jump`;

  for (
    let frame = 0;
    frame < 80 && state.distance < obstacle.contactDistance;
    frame += 1
  ) {
    const cue = getObstacleCue(level, state.distance, state.player);
    if (cue?.key === cueKey && cue.kind === 'doubleJump') {
      distances.push(state.distance);
    }
    state = advanceGame(state, SIMULATION_FRAME_SECONDS, () => 0.9);
  }

  return distances;
}

function expectHighStumpCueEdgesToClear(
  level: (typeof LEVELS)[number],
  obstacle: ReturnType<typeof expandObstaclePattern>['obstacles'][number],
  takeoffDistance: number,
  secondJumpDistance: number,
): void {
  let state = createIsolatedObstacleState(level, [obstacle], takeoffDistance);
  const firstCue = getObstacleCue(level, state.distance, state.player);
  expect(firstCue).toMatchObject({
    key: `${obstacle.patternId}:first-jump`,
    kind: 'jump',
  });
  state = applyPlayerAction(state, 'jump');

  let secondJumpAccepted = false;
  const clearDistance =
    obstacle.contactDistance + obstacle.width + 59;

  for (
    let frame = 0;
    frame < 80 &&
    state.distance <= clearDistance &&
    state.status === 'running';
    frame += 1
  ) {
    const cue = getObstacleCue(level, state.distance, state.player);
    if (
      !secondJumpAccepted &&
      state.distance >= secondJumpDistance - 1e-6
    ) {
      expect(cue).toMatchObject({
        key: `${obstacle.patternId}:double-jump`,
        kind: 'doubleJump',
      });
      const jumped = applyPlayerAction(state, 'jump');
      secondJumpAccepted =
        jumped.player.jumpsUsed === 2 &&
        jumped.player.jumpHeight > 0 &&
        state.player.jumpHeight > 0;
      state = jumped;
    }
    state = advanceGame(state, SIMULATION_FRAME_SECONDS, () => 0.9);
  }

  expect(secondJumpAccepted).toBe(true);
  expect(state.distance).toBeGreaterThan(clearDistance);
  expect(state.energy).toBeGreaterThan(95);
  expect(state.status).toBe('running');
}

describe('20-stage runner data', () => {
  it('contains twenty stages with increasing distance and pace', () => {
    expect(LEVELS).toHaveLength(20);

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
  it('supports grounded jumps and rejects airborne jump requests', () => {
    const initial = createGameState(LEVELS[0]!);
    const jumping = applyPlayerAction(initial, 'jump');

    expect(jumping.player.jumpVelocity).toBeGreaterThan(0);
    expect(applyPlayerAction(jumping, 'jump')).toBe(jumping);
  });

  it('accepts exactly one second jump after liftoff and never buffers an early press', () => {
    const initial = createGameState(LEVELS[0]!);
    const firstJump = applyPlayerAction(initial, 'jump');
    const sameFramePress = applyPlayerAction(firstJump, 'jump');
    const airborneWithoutBuffer = advanceGame(
      sameFramePress,
      0.001,
      () => 0.9,
    );

    expect(firstJump.player.jumpsUsed).toBe(1);
    expect(sameFramePress).toBe(firstJump);
    expect(airborneWithoutBuffer.player.jumpHeight).toBeGreaterThan(0);
    expect(airborneWithoutBuffer.player.jumpsUsed).toBe(1);

    const doubleJump = applyPlayerAction(airborneWithoutBuffer, 'jump');
    const thirdPress = applyPlayerAction(doubleJump, 'jump');

    expect(doubleJump.player.jumpsUsed).toBe(2);
    expect(doubleJump.player.jumpVelocity).toBe(470);
    expect(thirdPress).toBe(doubleJump);
  });

  it('restores both jumps only after the runner physically lands', () => {
    const initial = createGameState(LEVELS[0]!);
    let state = advanceGame(
      applyPlayerAction(initial, 'jump'),
      0.05,
      () => 0.9,
    );
    state = applyPlayerAction(state, 'jump');

    expect(state.player.jumpsUsed).toBe(2);

    for (let frame = 0; frame < 30 && state.player.jumpHeight > 0; frame += 1) {
      state = advanceGame(state, 0.05, () => 0.9);
    }

    expect(state.player.jumpHeight).toBe(0);
    expect(state.player.jumpVelocity).toBe(0);
    expect(state.player.jumpsUsed).toBe(0);
    expect(applyPlayerAction(state, 'jump').player.jumpsUsed).toBe(1);
  });

  it('keeps jump and held-slide actions mutually exclusive in either jump phase', () => {
    const initial = createGameState(LEVELS[0]!);
    const heldOnGround = applyPlayerAction(initial, 'slideStart');

    expect(applyPlayerAction(heldOnGround, 'jump')).toBe(heldOnGround);

    const airborne = advanceGame(
      applyPlayerAction(initial, 'jump'),
      0.05,
      () => 0.9,
    );
    const heldInAir = applyPlayerAction(airborne, 'slideStart');

    expect(heldInAir.player.jumpHeight).toBeGreaterThan(0);
    expect(applyPlayerAction(heldInAir, 'jump')).toBe(heldInAir);
    expect(heldInAir.player.jumpsUsed).toBe(1);
  });

  it('keeps the runner sliding while the input is held, then allows a jump after release', () => {
    const initial = createGameState(LEVELS[0]!);
    let sliding = applyPlayerAction(initial, 'slideStart');

    expect(sliding.player.slideHeld).toBe(true);
    for (let frame = 0; frame < 24; frame += 1) {
      sliding = advanceGame(sliding, 0.05, () => 0.9);
    }

    expect(sliding.player.slideHeld).toBe(true);
    expect(applyPlayerAction(sliding, 'jump')).toBe(sliding);

    const released = applyPlayerAction(sliding, 'slideEnd');
    expect(released.player.slideHeld).toBe(false);
    expect(applyPlayerAction(released, 'jump').player.jumpVelocity).toBeGreaterThan(0);
  });

  it('avoids an arch only while grounded and held, then releases into a jump', () => {
    const initial = createGameState(LEVELS[0]!);
    const heldState = applyPlayerAction(initial, 'slideStart');
    const approachingArch = {
      ...heldState,
      nextPickupIn: 5,
      nextScheduledObstacleIndex: heldState.obstacleSchedule.length,
      obstacles: [{ id: 15, type: 'arch' as const, x: 246, width: 82 }],
    };
    const heldCollision = advanceGame(approachingArch, 0.05, () => 0.9);

    expect(heldCollision.energy).toBeGreaterThan(99);
    expect(heldCollision.obstacles).toHaveLength(1);

    const released = applyPlayerAction(approachingArch, 'slideEnd');
    const releasedCollision = advanceGame(released, 0.05, () => 0.9);

    expect(releasedCollision.energy).toBeLessThan(67);
    expect(releasedCollision.obstacles).toHaveLength(0);
    expect(applyPlayerAction(released, 'jump').player.jumpVelocity).toBeGreaterThan(0);
  });

  it('does not let an airborne held slide avoid an arch', () => {
    const initial = createGameState(LEVELS[0]!);
    const jumping = applyPlayerAction(initial, 'jump');
    const heldInAir = applyPlayerAction(jumping, 'slideStart');
    const state = {
      ...heldInAir,
      nextPickupIn: 5,
      obstacles: [{ id: 16, type: 'arch' as const, x: 246, width: 82 }],
    };
    const collided = advanceGame(state, 0.05, () => 0.9);

    expect(collided.player.slideHeld).toBe(true);
    expect(collided.player.jumpHeight).toBeGreaterThan(0);
    expect(collided.energy).toBeLessThan(67);
  });

  it('releases idempotently and forcibly clears held state at a terminal result', () => {
    const initial = createGameState(LEVELS[0]!);
    const held = applyPlayerAction(initial, 'slideStart');
    const released = applyPlayerAction(held, 'slideEnd');

    expect(released.player.slideHeld).toBe(false);
    expect(applyPlayerAction(released, 'slideEnd')).toBe(released);

    const exhausted = advanceGame(
      { ...held, energy: 0.01, nextPickupIn: 5 },
      0.05,
      () => 0.9,
    );
    expect(exhausted.status).toBe('lost');
    expect(exhausted.player.slideHeld).toBe(false);

    const terminalHeld = {
      ...held,
      status: 'lost' as const,
    };
    expect(applyPlayerAction(terminalHeld, 'slideEnd').player.slideHeld).toBe(
      false,
    );
  });

  it('uses only run energy as a collision penalty', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      combo: 3,
      nextPickupIn: 5,
      nextScheduledObstacleIndex: initial.obstacleSchedule.length,
      obstacles: [{ id: 10, type: 'stump' as const, x: 246, width: 58 }],
    };
    const hit = advanceGame(state, 0.05, () => 0.9);

    expect(hit.energy).toBeLessThan(initial.energy);
    expect(hit.status).toBe('running');
    expect(hit.obstacles).toHaveLength(0);
    expect(hit.combo).toBe(state.combo);
    expect(hit.score).toBeGreaterThan(state.score);
  });

  it('ends the run when collision drains the single energy resource', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      energy: 20,
      nextPickupIn: 5,
      nextScheduledObstacleIndex: initial.obstacleSchedule.length,
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
      nextPickupIn: 5,
      nextScheduledObstacleIndex: initial.obstacleSchedule.length,
      player: {
        jumpHeight: 92,
        jumpVelocity: 0,
        jumpsUsed: 1,
        slideHeld: false,
        slideElapsed: 0,
      },
      obstacles: [{ id: 11, type: 'stump' as const, x: 246, width: 58 }],
    };
    const cleared = advanceGame(state, 0.05, () => 0.9);

    expect(cleared.energy).toBeGreaterThan(99);
    expect(cleared.obstacles).toHaveLength(1);
  });

  it('safely clears the tutorial stump at both edges of its maximum-speed jump cue', () => {
    const level = {
      ...LEVELS[0]!,
      baseSpeed: LEVELS[0]!.baseSpeed + LEVELS[0]!.speedRamp,
      speedRamp: 0,
    };
    const obstacle = expandObstaclePattern(level).obstacles.find(
      (scheduled) => scheduled.patternRole === 'prelude',
    )!;
    const cueDistances = getActionableJumpDistances(
      level,
      `${obstacle.patternId}:jump`,
      obstacle.contactDistance,
    );

    expect(cueDistances.length).toBeGreaterThan(0);
    expectJumpAtCueToClearObstacle(level, obstacle, cueDistances[0]!);
    expectJumpAtCueToClearObstacle(level, obstacle, cueDistances.at(-1)!);
  });

  it('safely clears the maximum-speed L10 gap at both edges of its jump cue', () => {
    const level = {
      ...LEVELS[9]!,
      baseSpeed: LEVELS[9]!.baseSpeed + LEVELS[9]!.speedRamp,
      speedRamp: 0,
    };
    const section = expandObstaclePattern(level).sections[1]!;
    const gapIndex = section.followupJumps.indexOf('gap');
    const obstacle = expandObstaclePattern(level).obstacles.find(
      (scheduled) =>
        scheduled.patternId === section.id &&
        scheduled.patternRole === 'followup' &&
        scheduled.patternIndex === gapIndex + 1,
    )!;
    const cueDistances = getActionableJumpDistances(
      level,
      `${section.id}:jump-${gapIndex + 1}`,
      obstacle.contactDistance,
    );

    expect(gapIndex).toBeGreaterThanOrEqual(0);
    expect(cueDistances.length).toBeGreaterThan(0);
    expectJumpAtCueToClearObstacle(level, obstacle, cueDistances[0]!);
    expectJumpAtCueToClearObstacle(level, obstacle, cueDistances.at(-1)!);
  });

  it('requires two jumps in one airtime to clear the L2 tutorial pair', () => {
    const level = LEVELS[1]!;
    const pair = expandObstaclePattern(level).obstacles.filter(
      (obstacle) =>
        obstacle.patternRole === 'prelude' &&
        obstacle.sequenceId === 'double-jump-tutorial',
    );
    const [first, second] = pair;
    expect(first).toBeDefined();
    expect(second).toBeDefined();

    const firstJumpCueDistances = getActionableJumpDistances(
      level,
      `${first!.patternId}:first`,
      first!.contactDistance,
    );
    expect(firstJumpCueDistances.length).toBeGreaterThan(0);
    const takeoffDistance =
      firstJumpCueDistances[Math.floor(firstJumpCueDistances.length / 2)]!;

    const simulatePair = (useDoubleJump: boolean) => {
      let state = createIsolatedObstacleState(
        level,
        pair,
        takeoffDistance,
      );
      expect(
        getObstacleCue(level, state.distance, state.player),
      ).toMatchObject({
        key: `${first!.patternId}:first`,
        kind: 'jump',
      });
      state = applyPlayerAction(state, 'jump');
      let secondJumpAccepted = false;
      const pairClearDistance = second!.contactDistance + second!.width + 59;

      for (
        let frame = 0;
        frame < 50 &&
        state.distance <= pairClearDistance &&
        state.status === 'running';
        frame += 1
      ) {
        const cue = getObstacleCue(level, state.distance, state.player);
        if (useDoubleJump && !secondJumpAccepted && cue?.kind === 'doubleJump') {
          const jumped = applyPlayerAction(state, 'jump');
          secondJumpAccepted =
            jumped.player.jumpsUsed === 2 &&
            jumped.player.jumpHeight > 0 &&
            state.player.jumpHeight > 0;
          state = jumped;
        }
        state = advanceGame(state, SIMULATION_FRAME_SECONDS, () => 0.9);
      }

      return { state, secondJumpAccepted };
    };

    const singleJumpRun = simulatePair(false);
    const doubleJumpRun = simulatePair(true);

    expect(singleJumpRun.secondJumpAccepted).toBe(false);
    expect(singleJumpRun.state.energy).toBeLessThan(80);
    expect(doubleJumpRun.secondJumpAccepted).toBe(true);
    expect(doubleJumpRun.state.energy).toBeGreaterThan(95);
    expect(doubleJumpRun.state.status).toBe('running');
  });

  it('keeps the high-stump art, collision gate, and canvas clearance aligned', () => {
    const firstHighStump = expandObstaclePattern(LEVELS[7]!).obstacles.find(
      (obstacle) => obstacle.type === 'highStump',
    )!;
    const doubleJumpPeak =
      JUMP_IMPULSE ** 2 / (2 * JUMP_GRAVITY) +
      DOUBLE_JUMP_IMPULSE ** 2 / (2 * JUMP_GRAVITY);

    expect(firstHighStump.width).toBe(42);
    expect(OBSTACLE_WIDTHS.highStump).toBe(42);
    expect(HIGH_STUMP_HEIGHT).toBe(160);
    expect(HIGH_STUMP_JUMP_CLEARANCE).toBe(HIGH_STUMP_HEIGHT);
    expect(GROUND_Y).toBe(334);
    expect(WORLD_HEIGHT).toBe(420);
    expect(doubleJumpPeak).toBeCloseTo(205, 0);
    expect(
      GROUND_Y - doubleJumpPeak - RUNNER_DRAW_BOUNDS.height,
    ).toBeGreaterThanOrEqual(8.9);
  });

  it('cannot clear a 160px high stump with the ordinary single jump', () => {
    const designedLevel = LEVELS[7]!;
    const level = {
      ...designedLevel,
      speedRamp: 0,
    };
    const scheduled = expandObstaclePattern(level).obstacles.find(
      (obstacle) => obstacle.type === 'highStump',
    )!;
    const contactDistance = Math.round(
      level.baseSpeed * (JUMP_IMPULSE / JUMP_GRAVITY),
    );
    const obstacle = { ...scheduled, contactDistance };
    let state = createIsolatedObstacleState(level, [obstacle], 0);
    state = applyPlayerAction(state, 'jump');
    let highestSingleJump = 0;
    const clearDistance =
      obstacle.contactDistance + obstacle.width + 59;

    for (
      let frame = 0;
      frame < 80 && state.distance <= clearDistance;
      frame += 1
    ) {
      highestSingleJump = Math.max(
        highestSingleJump,
        state.player.jumpHeight,
      );
      state = advanceGame(state, SIMULATION_FRAME_SECONDS, () => 0.9);
    }

    expect(highestSingleJump).toBeLessThan(HIGH_STUMP_JUMP_CLEARANCE);
    expect(state.energy).toBeLessThan(80);
  });

  it('clears the first high stump at both speed extremes and both cue-window edges', () => {
    const designedLevel = LEVELS[7]!;
    const speeds = [
      designedLevel.baseSpeed,
      designedLevel.baseSpeed + designedLevel.speedRamp,
    ];

    for (const speed of speeds) {
      const level = {
        ...designedLevel,
        baseSpeed: speed,
        speedRamp: 0,
      };
      const obstacle = expandObstaclePattern(level).obstacles.find(
        (scheduled) => scheduled.type === 'highStump',
      )!;
      const firstCueDistances = getHighStumpFirstJumpCueDistances(
        level,
        obstacle,
      );

      expect(firstCueDistances.length / speed).toBeGreaterThan(0.12);
      for (const takeoffDistance of [
        firstCueDistances[0]!,
        firstCueDistances.at(-1)!,
      ]) {
        const secondCueDistances =
          observeHighStumpDoubleJumpCueDistances(
            level,
            obstacle,
            takeoffDistance,
          );
        const secondCueDuration =
          secondCueDistances.length > 0
            ? (secondCueDistances.at(-1)! -
                secondCueDistances[0]! +
                speed * SIMULATION_FRAME_SECONDS) /
              speed
            : 0;

        expect(
          secondCueDuration,
          `speed=${speed}, takeoff=${takeoffDistance}, second cues=${secondCueDistances.join(',')}`,
        ).toBeGreaterThan(0.12);
        expectHighStumpCueEdgesToClear(
          level,
          obstacle,
          takeoffDistance,
          secondCueDistances[0]!,
        );
        expectHighStumpCueEdgesToClear(
          level,
          obstacle,
          takeoffDistance,
          secondCueDistances.at(-1)!,
        );
      }
    }
  });

  it('collects a nearby energy fruit for score and run energy', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      energy: 60,
      score: 150,
      nextPickupIn: 5,
      pickups: [{ id: 12, x: PLAYER_CENTER_X + 12, y: 270 }],
    };
    const collected = advanceGame(state, 0.05, () => 0.9);

    expect(collected.collectibles).toBe(1);
    expect(collected.score).toBeGreaterThan(state.score);
    expect(collected.energy).toBeGreaterThan(state.energy);
    expect(collected.pickups).toHaveLength(0);
  });

  it('requires a jump to collect a high energy fruit', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      nextPickupIn: 5,
      pickups: [{ id: 13, x: PLAYER_CENTER_X + 12, y: 150 }],
    };
    const standing = advanceGame(state, 0.05, () => 0.9);
    let jumping = applyPlayerAction(state, 'jump');
    for (let frame = 0; frame < 4 && jumping.collectibles === 0; frame += 1) {
      jumping = advanceGame(jumping, 0.05, () => 0.9);
    }

    expect(standing.collectibles).toBe(0);
    expect(standing.pickups).toHaveLength(1);
    expect(jumping.collectibles).toBe(1);
    expect(jumping.pickups).toHaveLength(0);
  });

  it('collects a low energy fruit while sliding', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      nextPickupIn: 5,
      pickups: [{ id: 14, x: PLAYER_CENTER_X + 12, y: 306 }],
    };
    const sliding = advanceGame(applyPlayerAction(state, 'slideStart'), 0.05, () => 0.9);

    expect(sliding.collectibles).toBe(1);
    expect(sliding.pickups).toHaveLength(0);
  });

  it('collects a low energy fruit when it visibly overlaps the grounded runner', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      energy: 60,
      nextPickupIn: 5,
      obstacleSections: [],
      pickups: [{ id: 15, x: PLAYER_CENTER_X + 12, y: 306 }],
    };
    const baseline = advanceGame({ ...state, pickups: [] }, 0.05, () => 0.9);
    const collected = advanceGame(state, 0.05, () => 0.9);

    expect(collected.collectibles).toBe(1);
    expect(collected.pickups).toHaveLength(0);
    expect(collected.energy).toBeGreaterThan(state.energy);
    expect(collected.score).toBeGreaterThan(baseline.score);
  });

  it('collects a bobbing fruit when it touches the jumping runner', () => {
    const delta = 0.05;
    const pickupId = 1;
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      elapsed:
        (Math.PI * 1.5 - pickupId) / PICKUP_BOB_ANGULAR_SPEED - delta,
      energy: 60,
      nextPickupIn: 5,
      obstacleSections: [],
      player: { ...initial.player, jumpHeight: 7, jumpVelocity: 657 },
      pickups: [{ id: pickupId, x: PLAYER_CENTER_X + 12, y: GROUND_Y - 16 }],
    };
    const collected = advanceGame(state, delta, () => 0.9);
    const reducedMotion = advanceGame(state, delta, () => 0.9, true);

    expect(collected.collectibles).toBe(1);
    expect(collected.pickups).toHaveLength(0);
    expect(reducedMotion.collectibles).toBe(0);
    expect(reducedMotion.pickups).toHaveLength(1);
  });

  it('places level obstacles at deterministic first-contact distances', () => {
    const level = LEVELS[0]!;
    const section = expandObstaclePattern(level).sections[0]!;
    const initial = createGameState(level);
    const almostAtContact = {
      ...initial,
      distance: section.firstArchContactDistance - 25,
      nextPickupIn: 5,
    };
    const state = advanceGame(almostAtContact, 0.05, () => 0);
    const firstArch = state.obstacles.find(
      (obstacle) =>
        obstacle.patternRole === 'arch' && obstacle.patternIndex === 1,
    );

    expect(firstArch).toBeDefined();
    expect(firstArch?.contactDistance).toBe(section.firstArchContactDistance);
    expect(firstArch?.x).toBeCloseTo(
      PLAYER_X +
        PLAYER_WIDTH -
        6 +
        section.firstArchContactDistance -
        state.distance,
    );
    expect(
      state.obstacles.every(
        (obstacle) =>
          obstacle.patternId !== undefined &&
          obstacle.patternIndex !== undefined &&
          obstacle.patternCount !== undefined,
      ),
    ).toBe(true);
  });

  it('does not spawn random pickups into an upcoming slide transition', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = advanceGame(
      { ...initial, nextPickupIn: 0 },
      0.05,
      () => 0.9,
    );

    expect(state.pickups).toHaveLength(0);
  });

  it('finishes a level at its configured distance goal', () => {
    const initial = createGameState(LEVELS[0]!);
    const almostThere = {
      ...initial,
      distance: initial.level.distanceGoal - 2,
      nextPickupIn: 5,
    };
    const finished = advanceGame(almostThere, 0.05, () => 0.9);

    expect(finished.status).toBe('won');
    expect(finished.distance).toBe(initial.level.distanceGoal);
  });
});
