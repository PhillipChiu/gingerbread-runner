import { describe, expect, it } from 'vitest';
import {
  advanceGame,
  applyPlayerAction,
  createGameState,
  CUSTOM_GAME_TUNING,
  getRunSpeed,
  GROUND_Y,
  isPlayerSliding,
  PICKUP_BOB_ANGULAR_SPEED,
  PICKUP_TOUCH_RADIUS,
  PLAYER_CENTER_X,
  PLAYER_WIDTH,
  PLAYER_X,
  WORLD_HEIGHT,
  type GameState,
  type PlayerState,
} from './engine';
import { LEVELS } from './levels';
import {
  expandObstaclePattern,
  getObstacleCue,
  HIGH_STUMP_CUE_MARGIN,
  OBSTACLE_WIDTHS,
  PLAYER_COLLISION_WIDTH,
} from './obstaclePattern';
import {
  ARCH_HEIGHT,
  ARCH_JUMP_CLEARANCE,
  DOUBLE_JUMP_IMPULSE,
  HIGH_STUMP_HEIGHT,
  HIGH_STUMP_JUMP_CLEARANCE,
  JUMP_GRAVITY,
  JUMP_IMPULSE,
  getVerticalHeightAtTime,
} from './physics';
import {
  RUNNER_DRAW_BOUNDS,
  SLIDE_DRAW_BOUNDS,
} from './runnerAnimation';

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

function spawnPickupAtHeightIndex(heightIndex: number): GameState {
  const initial = createGameState(LEVELS[0]!);
  let randomCall = 0;
  const random = (): number => {
    randomCall += 1;
    return randomCall === 1 ? (heightIndex + 0.25) / 4 : 0.5;
  };

  return advanceGame(
    {
      ...initial,
      obstacleSchedule: [],
      obstacleSections: [],
      obstacleQuietZones: [],
      nextScheduledObstacleIndex: 0,
      nextPickupIn: 0,
    },
    0.05,
    random,
  );
}

function getHighStumpFirstJumpCueWindow(
  level: (typeof LEVELS)[number],
  obstacle: ReturnType<typeof expandObstaclePattern>['obstacles'][number],
): { startDistance: number; endDistance: number } | null {
  const cueKey = `${obstacle.patternId}:first-jump`;
  const hasFirstJumpCue = (distance: number): boolean => {
    const cue = getObstacleCue(level, distance);
    return cue?.key === cueKey && cue.kind === 'jump';
  };
  let firstCueDistance: number | null = null;
  let lastCueDistance: number | null = null;

  for (
    let distance = Math.max(0, obstacle.contactDistance - 400);
    distance < obstacle.contactDistance;
    distance += 1
  ) {
    if (hasFirstJumpCue(distance)) {
      firstCueDistance ??= distance;
      lastCueDistance = distance;
    }
  }

  if (firstCueDistance === null || lastCueDistance === null) {
    return null;
  }

  let noCueDistance = firstCueDistance - 1;
  let cueDistance = firstCueDistance;
  while (cueDistance - noCueDistance > 1e-7) {
    const middleDistance = (noCueDistance + cueDistance) / 2;
    if (hasFirstJumpCue(middleDistance)) {
      cueDistance = middleDistance;
    } else {
      noCueDistance = middleDistance;
    }
  }
  const startDistance = cueDistance;

  cueDistance = lastCueDistance;
  noCueDistance = lastCueDistance + 1;
  while (noCueDistance - cueDistance > 1e-7) {
    const middleDistance = (cueDistance + noCueDistance) / 2;
    if (hasFirstJumpCue(middleDistance)) {
      cueDistance = middleDistance;
    } else {
      noCueDistance = middleDistance;
    }
  }

  return { startDistance, endDistance: noCueDistance };
}

interface HighStumpCueSample {
  state: GameState;
  frameIndex: number;
  frameDelta: number;
}

function observeHighStumpDoubleJumpCueSamples(
  level: (typeof LEVELS)[number],
  obstacle: ReturnType<typeof expandObstaclePattern>['obstacles'][number],
  takeoffDistance: number,
  frameDeltas: readonly number[],
  initialFramePhaseSeconds = 0,
): HighStumpCueSample[] {
  let state = createIsolatedObstacleState(level, [obstacle], takeoffDistance);
  state = applyPlayerAction(state, 'jump');
  if (initialFramePhaseSeconds > 0) {
    state = advanceGame(state, initialFramePhaseSeconds, () => 0.9);
  }

  const samples: HighStumpCueSample[] = [];
  const cueKey = `${obstacle.patternId}:double-jump`;
  let hasObservedCue = false;

  for (
    let frame = 0;
    frame < 1_200 &&
    state.distance < obstacle.contactDistance &&
    state.status === 'running';
    frame += 1
  ) {
    const cue = getObstacleCue(level, state.distance, state.player);
    if (cue?.key === cueKey && cue.kind === 'doubleJump') {
      hasObservedCue = true;
      samples.push({
        state,
        frameIndex: frame,
        frameDelta: frameDeltas[frame % frameDeltas.length]!,
      });
    } else if (hasObservedCue) {
      break;
    }

    state = advanceGame(
      state,
      frameDeltas[frame % frameDeltas.length]!,
      () => 0.9,
    );
  }

  return samples;
}

function applySafeHighStumpDoubleJump(
  level: (typeof LEVELS)[number],
  obstacle: ReturnType<typeof expandObstaclePattern>['obstacles'][number],
  sample: HighStumpCueSample,
  context: string,
): GameState {
  const cue = getObstacleCue(level, sample.state.distance, sample.state.player);
  expect(cue, context).toMatchObject({
    key: `${obstacle.patternId}:double-jump`,
    kind: 'doubleJump',
  });
  expect(sample.state.player.jumpHeight, context).toBeGreaterThan(0);
  expect(sample.state.player.jumpsUsed, context).toBe(1);
  expect(sample.state.distance, context).toBeLessThan(obstacle.contactDistance);

  const jumped = applyPlayerAction(sample.state, 'jump');
  expect(jumped.player.jumpsUsed, context).toBe(2);
  expect(jumped.player.jumpHeight, context).toBeGreaterThan(0);

  const speed = getRunSpeed(level, jumped.distance);
  const clearDistance =
    obstacle.contactDistance + obstacle.width + PLAYER_COLLISION_WIDTH;
  const timeAtContact =
    (obstacle.contactDistance - jumped.distance) / speed;
  const timeAtClear = (clearDistance - jumped.distance) / speed;
  const heightAtContact = getVerticalHeightAtTime(
    jumped.player.jumpHeight,
    jumped.player.jumpVelocity,
    timeAtContact,
  );
  const heightAtClear = getVerticalHeightAtTime(
    jumped.player.jumpHeight,
    jumped.player.jumpVelocity,
    timeAtClear,
  );
  const requiredClearance =
    HIGH_STUMP_JUMP_CLEARANCE + HIGH_STUMP_CUE_MARGIN;

  expect(heightAtContact, `${context}, height at contact`).toBeGreaterThan(
    requiredClearance,
  );
  expect(heightAtClear, `${context}, height at clear`).toBeGreaterThan(
    requiredClearance,
  );

  return jumped;
}

function expectHighStumpOverlapToStayClear(
  initialState: GameState,
  level: (typeof LEVELS)[number],
  obstacle: ReturnType<typeof expandObstaclePattern>['obstacles'][number],
  frameDeltas: readonly number[],
  startingFrameIndex: number,
  context: string,
): void {
  const clearDistance =
    obstacle.contactDistance + obstacle.width + PLAYER_COLLISION_WIDTH;
  const speed = getRunSpeed(level, initialState.distance);
  let state = initialState;
  let frameIndex = startingFrameIndex;
  let observedOverlap = false;

  for (
    let frame = 0;
    frame < 100 && state.distance < clearDistance;
    frame += 1
  ) {
    const before = state;
    state = advanceGame(
      before,
      frameDeltas[frameIndex % frameDeltas.length]!,
      () => 0.9,
    );
    frameIndex += 1;

    const overlapStartDistance = Math.max(
      before.distance,
      obstacle.contactDistance,
    );
    const overlapEndDistance = Math.min(state.distance, clearDistance);
    if (overlapEndDistance > overlapStartDistance) {
      observedOverlap = true;
      for (const overlapDistance of [
        overlapStartDistance,
        overlapEndDistance,
      ]) {
        const overlapTime =
          (overlapDistance - before.distance) / speed;
        const overlapHeight = getVerticalHeightAtTime(
          before.player.jumpHeight,
          before.player.jumpVelocity,
          overlapTime,
        );
        expect(
          overlapHeight,
          `${context}, overlap at distance ${overlapDistance}`,
        ).toBeGreaterThan(
          HIGH_STUMP_JUMP_CLEARANCE + HIGH_STUMP_CUE_MARGIN,
        );
      }
    }
  }

  expect(observedOverlap, context).toBe(true);
  expect(state.distance, context).toBeGreaterThanOrEqual(clearDistance);
  expect(state.energy, context).toBeGreaterThan(95);
  expect(state.status, context).toBe('running');
}

function advanceToHighStumpContactLead(
  level: (typeof LEVELS)[number],
  obstacle: ReturnType<typeof expandObstaclePattern>['obstacles'][number],
  takeoffDistance: number,
  contactLeadSeconds: number,
  frameDeltas: readonly number[],
): GameState {
  let state = createIsolatedObstacleState(level, [obstacle], takeoffDistance);
  state = applyPlayerAction(state, 'jump');
  const speed = getRunSpeed(level, state.distance);
  const targetDistance =
    obstacle.contactDistance - speed * contactLeadSeconds;
  let frame = 0;

  while (state.distance < targetDistance - 1e-7) {
    const frameDelta = frameDeltas[frame % frameDeltas.length]!;
    const secondsToTarget = (targetDistance - state.distance) / speed;
    state = advanceGame(
      state,
      Math.min(frameDelta, secondsToTarget),
      () => 0.9,
    );
    frame += 1;
  }

  return state;
}

const GATE_FRAME_SECONDS = 1 / 60;
const GATE_OVERLAP_DISTANCE = OBSTACLE_WIDTHS.arch + PLAYER_COLLISION_WIDTH;
const SINGLE_JUMP_APEX = JUMP_IMPULSE ** 2 / (2 * JUMP_GRAVITY);

interface GatePlan {
  /** Constant run speed in px/s, so every frame moves the same distance. */
  speed: number;
  /** Index of the first frame whose end state overlaps the gate. */
  contactFrame: number;
  /** Frames on which jump is pressed, applied just before that frame advances. */
  jumpFrames?: readonly number[];
  /** Frames on which slide is pressed and then held, in the air or on the ground. */
  slideFrames?: readonly number[];
  /** Hold slide from frame 0. */
  holdSlide?: boolean;
}

interface GateRun {
  overlapFrames: number;
  lowestOverlapHeight: number;
  highestOverlapHeight: number;
  collisions: number;
}

/** Plays one ground gate through the real advanceGame loop, frame by frame. */
function runThroughGate({
  speed,
  contactFrame,
  jumpFrames = [],
  slideFrames = [],
  holdSlide = false,
}: GatePlan): GateRun {
  const level = { ...LEVELS[0]!, baseSpeed: speed, speedRamp: 0 };
  // Contact sits mid-frame so floating-point rounding cannot flip an edge frame.
  const contactDistance = speed * GATE_FRAME_SECONDS * (contactFrame + 0.5);
  const clearDistance = contactDistance + GATE_OVERLAP_DISTANCE;
  const gate = {
    ...expandObstaclePattern(level).obstacles.find(
      (obstacle) => obstacle.type === 'arch',
    )!,
    contactDistance,
  };
  let state = createIsolatedObstacleState(level, [gate], 0);
  if (holdSlide) {
    state = applyPlayerAction(state, 'slideStart');
  }

  const run: GateRun = {
    overlapFrames: 0,
    lowestOverlapHeight: Number.POSITIVE_INFINITY,
    highestOverlapHeight: 0,
    collisions: 0,
  };

  for (
    let frame = 0;
    frame < 600 && state.distance < clearDistance;
    frame += 1
  ) {
    if (jumpFrames.includes(frame)) {
      state = applyPlayerAction(state, 'jump');
    }
    if (slideFrames.includes(frame)) {
      state = applyPlayerAction(state, 'slideStart');
    }

    const before = state;
    state = advanceGame(before, GATE_FRAME_SECONDS, () => 0.9);

    const passiveDrainOnly =
      before.energy -
      CUSTOM_GAME_TUNING.passiveEnergyDrainPerSecond * GATE_FRAME_SECONDS;
    if (state.energy < passiveDrainOnly - 1e-9) {
      run.collisions += 1;
    }

    if (state.distance > contactDistance && state.distance < clearDistance) {
      run.overlapFrames += 1;
      run.lowestOverlapHeight = Math.min(
        run.lowestOverlapHeight,
        state.player.jumpHeight,
      );
      run.highestOverlapHeight = Math.max(
        run.highestOverlapHeight,
        state.player.jumpHeight,
      );
    }
  }

  return run;
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
    expect(doubleJump.player.jumpVelocity).toBe(DOUBLE_JUMP_IMPULSE);
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
      const firstClearDistance =
        first!.contactDistance + first!.width + PLAYER_COLLISION_WIDTH;

      for (
        let frame = 0;
        frame < 50 &&
        state.distance <= pairClearDistance &&
        state.status === 'running';
        frame += 1
      ) {
        const cue = getObstacleCue(level, state.distance, state.player);
        if (useDoubleJump && !secondJumpAccepted && cue?.kind === 'doubleJump') {
          expect(state.player.jumpHeight).toBeGreaterThan(0);
          expect(state.player.jumpsUsed).toBe(1);
          expect(state.distance).toBeLessThan(firstClearDistance);
          const jumped = applyPlayerAction(state, 'jump');
          secondJumpAccepted =
            jumped.player.jumpsUsed === 2 &&
            jumped.player.jumpHeight > 0 &&
            state.player.jumpHeight > 0;
          expect(jumped.player.jumpHeight).toBeGreaterThan(0);
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
    expect(doubleJumpPeak).toBeCloseTo(214, 0);
    expect(
      GROUND_Y - doubleJumpPeak - RUNNER_DRAW_BOUNDS.height,
    ).toBeGreaterThan(0);
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

  it('keeps L8 high-stump cue edges safe across run speeds and RAF phases', () => {
    const designedLevel = LEVELS[7]!;
    const speedCases = [
      { name: 'minimum', speed: designedLevel.baseSpeed },
      {
        name: 'maximum',
        speed: designedLevel.baseSpeed + designedLevel.speedRamp,
      },
    ];
    const frameSchedules = [
      { name: '120 Hz', deltas: [1 / 120] },
      { name: '60 Hz', deltas: [1 / 60] },
      { name: '30 Hz', deltas: [1 / 30] },
      { name: 'mixed RAF phases', deltas: [1 / 120, 1 / 60, 1 / 30] },
    ] as const;
    const phaseFractions = [0.15, 0.55, 0.9];

    for (const { name: speedName, speed } of speedCases) {
      const level = {
        ...designedLevel,
        baseSpeed: speed,
        speedRamp: 0,
      };
      const obstacle = expandObstaclePattern(level).obstacles.find(
        (scheduled) => scheduled.type === 'highStump',
      )!;
      const firstCueWindow = getHighStumpFirstJumpCueWindow(level, obstacle);
      expect(firstCueWindow).not.toBeNull();
      const { startDistance, endDistance } = firstCueWindow!;
      const firstCueDuration = (endDistance - startDistance) / speed;
      const firstCueStartState = createIsolatedObstacleState(
        level,
        [obstacle],
        startDistance,
      );
      const firstCueEndState = createIsolatedObstacleState(
        level,
        [obstacle],
        endDistance - 1e-6,
      );

      expect(firstCueDuration, `${speedName} first-jump cue`).toBeGreaterThanOrEqual(
        0.15,
      );
      expect(
        getObstacleCue(level, startDistance, firstCueStartState.player),
      ).toMatchObject({
        key: `${obstacle.patternId}:first-jump`,
        kind: 'jump',
      });
      expect(
        getObstacleCue(level, endDistance - 1e-6, firstCueEndState.player),
      ).toMatchObject({
        key: `${obstacle.patternId}:first-jump`,
        kind: 'jump',
      });
      expect(
        getObstacleCue(level, endDistance, firstCueEndState.player)?.key,
      ).not.toBe(`${obstacle.patternId}:first-jump`);

      const takeoffDistances = Array.from({ length: 9 }, (_, index) =>
        Math.min(
          startDistance + ((endDistance - startDistance) * index) / 8,
          endDistance - 1e-6,
        ),
      );
      for (const takeoffDistance of takeoffDistances) {
        const firstCueState = createIsolatedObstacleState(
          level,
          [obstacle],
          takeoffDistance,
        );
        expect(
          getObstacleCue(level, takeoffDistance, firstCueState.player),
        ).toMatchObject({
          key: `${obstacle.patternId}:first-jump`,
          kind: 'jump',
        });

        const continuousCueSamples = observeHighStumpDoubleJumpCueSamples(
          level,
          obstacle,
          takeoffDistance,
          [1 / 1_000],
        );
        const firstDoubleJumpCue = continuousCueSamples[0];
        const lastDoubleJumpCue = continuousCueSamples.at(-1);
        const context =
          `speed=${speedName}(${speed}), takeoff=${takeoffDistance}, ` +
          `first-jump lead=${(obstacle.contactDistance - takeoffDistance) / speed}s`;

        expect(continuousCueSamples.length, context).toBeGreaterThan(0);
        expect(
          (lastDoubleJumpCue!.state.distance -
            firstDoubleJumpCue!.state.distance) /
            speed +
            lastDoubleJumpCue!.frameDelta,
          `${context}, double-jump cue interval`,
        ).toBeGreaterThanOrEqual(0.15);

        for (const cueEdge of [
          firstDoubleJumpCue!,
          lastDoubleJumpCue!,
        ]) {
          const jumped = applySafeHighStumpDoubleJump(
            level,
            obstacle,
            cueEdge,
            `${context}, 1 ms cue edge at ${cueEdge.state.distance}`,
          );
          expectHighStumpOverlapToStayClear(
            jumped,
            level,
            obstacle,
            [1 / 120],
            cueEdge.frameIndex,
            `${context}, 1 ms cue edge`,
          );
        }

        const tooLateState = advanceToHighStumpContactLead(
          level,
          obstacle,
          takeoffDistance,
          0.06,
          [1 / 120, 1 / 60, 1 / 30],
        );
        const tooLateCue = getObstacleCue(
          level,
          tooLateState.distance,
          tooLateState.player,
        );
        expect(tooLateState.distance).toBeCloseTo(
          obstacle.contactDistance - speed * 0.06,
          6,
        );
        expect(tooLateState.player.jumpHeight).toBeGreaterThan(0);
        expect(tooLateCue?.kind).not.toBe('doubleJump');

        for (const schedule of frameSchedules) {
          for (const phaseFraction of phaseFractions) {
            const samples = observeHighStumpDoubleJumpCueSamples(
              level,
              obstacle,
              takeoffDistance,
              schedule.deltas,
              schedule.deltas[0]! * phaseFraction,
            );
            const phaseContext =
              `${context}, ${schedule.name}, phase=${phaseFraction}`;

            expect(samples.length, phaseContext).toBeGreaterThan(0);
            for (const cueSample of samples) {
              applySafeHighStumpDoubleJump(
                level,
                obstacle,
                cueSample,
                `${phaseContext}, cue at ${cueSample.state.distance}`,
              );
            }

            for (const cueEdge of [samples[0]!, samples.at(-1)!]) {
              const jumped = applySafeHighStumpDoubleJump(
                level,
                obstacle,
                cueEdge,
                `${phaseContext}, input at ${cueEdge.state.distance}`,
              );
              expectHighStumpOverlapToStayClear(
                jumped,
                level,
                obstacle,
                schedule.deltas,
                cueEdge.frameIndex,
                `${phaseContext}, collision overlap`,
              );
            }
          }
        }
      }
    }
  });

  it.each([
    [0, 176],
    [1, 56],
    [2, 20],
    [3, 56],
  ])(
    'spawns fruit height %i at its configured distance above ground',
    (heightIndex, expectedGroundOffset) => {
      const state = spawnPickupAtHeightIndex(heightIndex);
      const pickup = state.pickups[0];

      expect(pickup).toBeDefined();
      expect(pickup?.y).toBe(GROUND_Y - expectedGroundOffset);
      expect(pickup && GROUND_Y - pickup.y).toBe(expectedGroundOffset);
    },
  );

  it('collects a nearby energy fruit for score and run energy', () => {
    const initial = createGameState(LEVELS[0]!);
    const state = {
      ...initial,
      energy: 60,
      score: 150,
      nextPickupIn: 5,
      pickups: [{ id: 12, x: PLAYER_CENTER_X + 12, y: GROUND_Y - 56 }],
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
      pickups: [{ id: 13, x: PLAYER_CENTER_X + 12, y: GROUND_Y - 176 }],
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
      pickups: [{ id: 14, x: PLAYER_CENTER_X + 12, y: GROUND_Y - 20 }],
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
      pickups: [{ id: 15, x: PLAYER_CENTER_X + 12, y: GROUND_Y - 20 }],
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

  it.each(['start', 'end'] as const)(
    'does not spawn a pickup just outside a quiet-zone %s boundary when its touch range overlaps',
    (boundary) => {
      const initial = createGameState(LEVELS[0]!);
      const spawnState = {
        ...initial,
        obstacleSchedule: [],
        obstacleSections: [],
        obstacleQuietZones: [],
        nextScheduledObstacleIndex: 0,
        nextPickupIn: 0,
      };
      const preview = advanceGame(spawnState, 0.05, () => 0.9);
      const previewPickup = preview.pickups[0]!;
      const predictedPickupDistance =
        preview.distance + previewPickup.x - PLAYER_CENTER_X;
      const interactionHalfWidth =
        Math.max(RUNNER_DRAW_BOUNDS.width, SLIDE_DRAW_BOUNDS.width) / 2 +
        PICKUP_TOUCH_RADIUS;
      const quietZone =
        boundary === 'start'
          ? {
              startDistance: predictedPickupDistance + 1,
              endDistance: predictedPickupDistance + 101,
            }
          : {
              startDistance: predictedPickupDistance - 101,
              endDistance: predictedPickupDistance - 1,
            };

      expect(
        boundary === 'start'
          ? predictedPickupDistance < quietZone.startDistance
          : predictedPickupDistance >= quietZone.endDistance,
      ).toBe(true);
      expect(
        predictedPickupDistance + interactionHalfWidth >=
          quietZone.startDistance &&
          predictedPickupDistance - interactionHalfWidth <
            quietZone.endDistance,
      ).toBe(true);

      const state = advanceGame(
        { ...spawnState, obstacleQuietZones: [quietZone] },
        0.05,
        () => 0.9,
      );

      expect(state.pickups).toHaveLength(0);
    },
  );

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

describe('ground gate (arch) clearance', () => {
  // 480 px/s is 8px per 1/60s frame, so the 141px overlap spans 17-18 frames.
  const GATE_SPEED = 480;

  it('lets a grounded held slide pass the whole gate overlap', () => {
    const run = runThroughGate({
      speed: GATE_SPEED,
      contactFrame: 10,
      holdSlide: true,
    });

    expect(run.overlapFrames).toBeGreaterThanOrEqual(17);
    expect(run.highestOverlapHeight).toBe(0);
    expect(run.collisions, 'collisions while sliding').toBe(0);
  });

  it('still collides when a single jump peaks inside the gate overlap', () => {
    const run = runThroughGate({
      speed: GATE_SPEED,
      contactFrame: 16,
      jumpFrames: [0],
    });

    expect(run.overlapFrames).toBeGreaterThanOrEqual(17);
    expect(run.highestOverlapHeight).toBeGreaterThan(130);
    expect(run.highestOverlapHeight).toBeLessThanOrEqual(SINGLE_JUMP_APEX);
    expect(run.collisions, 'collisions at the single-jump apex').toBe(1);
  });

  it('still collides when a late double jump never rises above the gate', () => {
    const run = runThroughGate({
      speed: GATE_SPEED,
      contactFrame: 55,
      jumpFrames: [0, 46],
    });

    expect(run.overlapFrames).toBeGreaterThanOrEqual(17);
    expect(run.highestOverlapHeight).toBeLessThan(SINGLE_JUMP_APEX);
    expect(run.collisions, 'collisions of a low double jump').toBe(1);
  });

  it('still collides when a double jump sinks below the gate before the overlap ends', () => {
    const run = runThroughGate({
      speed: GATE_SPEED,
      contactFrame: 50,
      jumpFrames: [0, 25],
    });

    expect(run.overlapFrames).toBeGreaterThanOrEqual(17);
    expect(run.highestOverlapHeight).toBeGreaterThan(SINGLE_JUMP_APEX);
    expect(run.lowestOverlapHeight).toBeLessThan(SINGLE_JUMP_APEX);
    expect(run.collisions, 'collisions of a sinking double jump').toBe(1);
  });

  it('clears the whole gate overlap with a double jump above the single-jump apex', () => {
    const run = runThroughGate({
      speed: GATE_SPEED,
      contactFrame: 34,
      jumpFrames: [0, 25],
    });

    expect(run.overlapFrames).toBeGreaterThanOrEqual(17);
    expect(run.lowestOverlapHeight).toBeGreaterThan(SINGLE_JUMP_APEX);
    expect(run.lowestOverlapHeight).toBeGreaterThan(ARCH_JUMP_CLEARANCE);
    expect(run.collisions, 'collisions of a high double jump').toBe(0);
  });

  describe('when the slide is pressed in the air', () => {
    // The slide is held from frame 40, long before a single jump lands about
    // 49.1 frames after liftoff. It only protects the runner while the runner is
    // on the ground, so what counts is whether the gate arrives before or after
    // the touchdown.
    it('collides with a gate that arrives before the runner has landed', () => {
      const run = runThroughGate({
        speed: GATE_SPEED,
        contactFrame: 46,
        jumpFrames: [0],
        slideFrames: [40],
      });

      expect(run.overlapFrames).toBeGreaterThanOrEqual(17);
      expect(run.highestOverlapHeight).toBeGreaterThan(0);
      expect(run.collisions, 'collisions of a gate that arrives mid-air').toBe(1);
    });

    it('lets the held slide pass a gate that arrives after the runner has landed', () => {
      const run = runThroughGate({
        speed: GATE_SPEED,
        contactFrame: 52,
        jumpFrames: [0],
        slideFrames: [40],
      });

      expect(run.overlapFrames).toBeGreaterThanOrEqual(17);
      expect(run.highestOverlapHeight, 'on the ground for the whole overlap').toBe(0);
      expect(run.collisions, 'collisions of a gate that arrives after landing').toBe(0);
    });

    it('still clears the whole gate overlap with a high double jump', () => {
      const run = runThroughGate({
        speed: GATE_SPEED,
        contactFrame: 34,
        jumpFrames: [0, 25],
        slideFrames: [30],
      });

      expect(run.overlapFrames).toBeGreaterThanOrEqual(17);
      expect(run.lowestOverlapHeight).toBeGreaterThan(ARCH_JUMP_CLEARANCE);
      expect(run.collisions, 'collisions of a high double jump').toBe(0);
    });

    it('still collides when a double jump sinks below the gate before the overlap ends', () => {
      const run = runThroughGate({
        speed: GATE_SPEED,
        contactFrame: 50,
        jumpFrames: [0, 25],
        slideFrames: [30],
      });

      expect(run.overlapFrames).toBeGreaterThanOrEqual(17);
      expect(run.highestOverlapHeight).toBeGreaterThan(SINGLE_JUMP_APEX);
      expect(run.lowestOverlapHeight).toBeLessThan(SINGLE_JUMP_APEX);
      expect(run.collisions, 'collisions of a sinking double jump').toBe(1);
    });
  });

  it('collides at exactly the gate height and clears only above it', () => {
    const initial = createGameState(LEVELS[0]!);
    // A velocity of 825/32 px/s over 1/32 s lifts exactly as far as gravity
    // pulls back, so the frame leaves the jump height untouched.
    const crossGate = (jumpHeight: number) =>
      advanceGame(
        {
          ...initial,
          nextPickupIn: 5,
          nextScheduledObstacleIndex: initial.obstacleSchedule.length,
          player: {
            jumpHeight,
            jumpVelocity: 825 / 32,
            jumpsUsed: 2,
            slideHeld: false,
            slideElapsed: 0,
          },
          obstacles: [
            { id: 17, type: 'arch' as const, x: 246, width: OBSTACLE_WIDTHS.arch },
          ],
        },
        1 / 32,
        () => 0.9,
      );

    const atGateHeight = crossGate(ARCH_JUMP_CLEARANCE);
    const aboveGateHeight = crossGate(ARCH_JUMP_CLEARANCE + 0.25);

    expect(atGateHeight.player.jumpsUsed).toBe(2);
    expect(atGateHeight.player.jumpHeight).toBe(ARCH_JUMP_CLEARANCE);
    expect(atGateHeight.energy).toBeLessThan(67);
    expect(atGateHeight.obstacles).toHaveLength(0);

    expect(aboveGateHeight.player.jumpHeight).toBe(ARCH_JUMP_CLEARANCE + 0.25);
    expect(aboveGateHeight.energy).toBeGreaterThan(99);
    expect(aboveGateHeight.obstacles).toHaveLength(1);
  });

  it('puts the gate between the single-jump apex and the double-jump peak', () => {
    const doubleJumpPeak =
      SINGLE_JUMP_APEX + DOUBLE_JUMP_IMPULSE ** 2 / (2 * JUMP_GRAVITY);

    expect(ARCH_JUMP_CLEARANCE).toBe(ARCH_HEIGHT);
    expect(ARCH_HEIGHT).toBeGreaterThan(SINGLE_JUMP_APEX);
    expect(ARCH_HEIGHT).toBeLessThan(doubleJumpPeak);
  });

  it('keeps a double-jump pass possible at the slowest gate speed in the game', () => {
    const slowestGateSpeed = Math.min(
      ...LEVELS.flatMap((level) =>
        expandObstaclePattern(level)
          .obstacles.filter((obstacle) => obstacle.type === 'arch')
          .map((gate) => getRunSpeed(level, gate.contactDistance)),
      ),
    );
    // Jumps are fixed at the best timing (second jump at the first-jump apex);
    // only the gate position is swept.
    const clearingContactFrames: number[] = [];
    for (let contactFrame = 0; contactFrame < 120; contactFrame += 1) {
      const run = runThroughGate({
        speed: slowestGateSpeed,
        contactFrame,
        jumpFrames: [0, 25],
      });
      if (run.overlapFrames > 0 && run.collisions === 0) {
        clearingContactFrames.push(contactFrame);
      }
    }

    expect(clearingContactFrames.length).toBeGreaterThan(0);
  });
});

describe('ground gate (arch) swept overlap within one frame', () => {
  // Level 1's slowest gate runs at about 257 px/s, so a 1/60 s frame moves the
  // gate only 4.3 px. That is little against its 141 px of overlap, yet enough
  // for the runner to cross the 144 px gate height, or for the gate to enter or
  // leave the hitbox, between the start and the end state of a single frame.
  const GATE_SPEED = 258;
  const GATE_WIDTH = OBSTACLE_WIDTHS.arch;
  // The runner hitbox edges advanceGame tests against (private there).
  const HITBOX_RIGHT = PLAYER_X + PLAYER_WIDTH - 6;
  const HITBOX_LEFT = HITBOX_RIGHT - PLAYER_COLLISION_WIDTH;

  /** Gate whose right edge starts `inside` px past the hitbox's left edge. */
  const gateLeavingHitbox = (inside: number) =>
    HITBOX_LEFT + inside - GATE_WIDTH;
  /** Gate whose left edge starts `outside` px beyond the hitbox's right edge. */
  const gateEnteringHitbox = (outside: number) => HITBOX_RIGHT + outside;

  /** Advances exactly one frame past a single gate at a constant run speed. */
  function advanceOneGateFrame({
    gateX,
    player,
    speed = GATE_SPEED,
    frameSeconds = GATE_FRAME_SECONDS,
  }: {
    gateX: number;
    player: Partial<PlayerState>;
    speed?: number;
    frameSeconds?: number;
  }): GameState {
    const level = { ...LEVELS[0]!, baseSpeed: speed, speedRamp: 0 };
    const initial = createGameState(level);

    return advanceGame(
      {
        ...initial,
        nextPickupIn: 5,
        nextScheduledObstacleIndex: initial.obstacleSchedule.length,
        player: { ...initial.player, ...player },
        obstacles: [
          { id: 17, type: 'arch' as const, x: gateX, width: GATE_WIDTH },
        ],
      },
      frameSeconds,
      () => 0.9,
    );
  }

  // A hit costs 34 energy and removes the gate; a miss only pays the passive
  // drain of one frame and leaves the gate behind.
  function expectGateHit(after: GameState): void {
    expect(after.energy, 'energy after the gate hit').toBeLessThan(67);
    expect(after.obstacles, 'gate removed by the hit').toHaveLength(0);
  }

  function expectGateMissed(after: GameState): void {
    expect(after.energy, 'energy after passing the gate').toBeGreaterThan(99);
    expect(after.obstacles, 'gate left behind').toHaveLength(1);
  }

  it('collides when a descending runner sinks below the gate height and the gate then leaves the hitbox within the same frame', () => {
    // Review repro: the runner crosses 144 px at about 10.6 ms, the gate's right
    // edge leaves the hitbox at about 13.6 ms, and the 16.7 ms frame ends with
    // no overlap left for an end-of-frame check to find.
    const player = { jumpHeight: 149, jumpVelocity: -462.5, jumpsUsed: 2 };
    const gateX = gateLeavingHitbox(3.5);
    const leaveSeconds = 3.5 / GATE_SPEED;

    expect(player.jumpHeight).toBeGreaterThan(ARCH_JUMP_CLEARANCE);
    expect(leaveSeconds).toBeLessThan(GATE_FRAME_SECONDS);
    expect(
      getVerticalHeightAtTime(
        player.jumpHeight,
        player.jumpVelocity,
        leaveSeconds,
      ),
    ).toBeLessThan(ARCH_JUMP_CLEARANCE);
    expect(
      gateX + GATE_WIDTH - GATE_SPEED * GATE_FRAME_SECONDS,
      'gate right edge at the end of the frame',
    ).toBeLessThan(HITBOX_LEFT);

    expectGateHit(advanceOneGateFrame({ gateX, player }));
  });

  it('collides when the gate reaches the hitbox before a rising runner has climbed above the gate height', () => {
    // The runner is still below 144 px when the gate enters at about 1.9 ms but
    // ends the frame at about 150 px, which an end-of-frame check would accept.
    const player = { jumpHeight: 142.3, jumpVelocity: 500, jumpsUsed: 2 };
    const gateX = gateEnteringHitbox(0.5);
    const enterSeconds = 0.5 / GATE_SPEED;

    expect(
      getVerticalHeightAtTime(
        player.jumpHeight,
        player.jumpVelocity,
        enterSeconds,
      ),
    ).toBeLessThan(ARCH_JUMP_CLEARANCE);
    expect(
      getVerticalHeightAtTime(
        player.jumpHeight,
        player.jumpVelocity,
        GATE_FRAME_SECONDS,
      ),
    ).toBeGreaterThan(ARCH_JUMP_CLEARANCE);

    expectGateHit(advanceOneGateFrame({ gateX, player }));
  });

  it('lets a rising runner pass a gate that only reaches the hitbox after the runner is above the gate height', () => {
    const player = { jumpHeight: 142.3, jumpVelocity: 500, jumpsUsed: 2 };
    const gateX = gateEnteringHitbox(3);
    const enterSeconds = 3 / GATE_SPEED;

    expect(
      getVerticalHeightAtTime(
        player.jumpHeight,
        player.jumpVelocity,
        enterSeconds,
      ),
    ).toBeGreaterThan(ARCH_JUMP_CLEARANCE);

    expectGateMissed(advanceOneGateFrame({ gateX, player }));
  });

  describe('when the gate leaves the hitbox exactly mid-frame', () => {
    // 256 px/s over 1/32 s moves the gate exactly 8 px, so a gate whose right
    // edge starts 4 px inside the hitbox leaves it at exactly 1/64 s. A runner
    // at its apex falls by 0.5 * gravity * (1/64)^2 over that time, so every
    // number below is exact in floating point.
    const SPEED = 256;
    const FRAME_SECONDS = 1 / 32;
    const LEAVE_SECONDS = 1 / 64;
    const FALL_UNTIL_LEAVING = 0.5 * JUMP_GRAVITY * LEAVE_SECONDS ** 2;
    const gateX = gateLeavingHitbox(4);

    const apexPlayerReaching = (heightWhenLeaving: number) => ({
      jumpHeight: heightWhenLeaving + FALL_UNTIL_LEAVING,
      jumpVelocity: 0,
      jumpsUsed: 2,
    });

    it('collides when the runner is at exactly the gate height as the gate leaves', () => {
      const player = apexPlayerReaching(ARCH_JUMP_CLEARANCE);

      expect(
        getVerticalHeightAtTime(
          player.jumpHeight,
          player.jumpVelocity,
          LEAVE_SECONDS,
        ),
      ).toBe(ARCH_JUMP_CLEARANCE);
      expect(gateX + GATE_WIDTH - SPEED * FRAME_SECONDS).toBeLessThan(
        HITBOX_LEFT,
      );

      expectGateHit(
        advanceOneGateFrame({
          gateX,
          player,
          speed: SPEED,
          frameSeconds: FRAME_SECONDS,
        }),
      );
    });

    it('passes when the runner is above the gate height until the gate leaves, even if it sinks below afterwards', () => {
      const after = advanceOneGateFrame({
        gateX,
        player: apexPlayerReaching(ARCH_JUMP_CLEARANCE + 0.25),
        speed: SPEED,
        frameSeconds: FRAME_SECONDS,
      });

      expect(after.player.jumpHeight).toBeLessThan(ARCH_JUMP_CLEARANCE);
      expectGateMissed(after);
    });
  });

  it('lets a runner that stays above the gate height for the whole swept overlap pass', () => {
    const after = advanceOneGateFrame({
      gateX: gateLeavingHitbox(3.5),
      player: { jumpHeight: 160, jumpVelocity: -462.5, jumpsUsed: 2 },
    });

    expect(after.player.jumpHeight).toBeGreaterThan(ARCH_JUMP_CLEARANCE);
    expectGateMissed(after);
  });

  it('still lets a grounded held slide pass a gate that leaves the hitbox mid-frame', () => {
    const after = advanceOneGateFrame({
      gateX: gateLeavingHitbox(3.5),
      player: { slideHeld: true },
    });

    expect(after.player.jumpHeight).toBe(0);
    expectGateMissed(after);
  });

  it('still lets a grounded held slide pass a gate that reaches the hitbox mid-frame', () => {
    const after = advanceOneGateFrame({
      gateX: gateEnteringHitbox(3),
      player: { slideHeld: true },
    });

    expect(after.player.jumpHeight).toBe(0);
    expectGateMissed(after);
  });

  describe('when the runner touches down within the frame while holding the slide', () => {
    // A slide held in the air only protects the runner once it is on the ground,
    // so the grounded slide the frame ends in must not excuse an overlap that
    // began while the runner was still airborne under the gate height.

    /** A single jump `height` px above the ground on its way down, slide held. */
    const fallingSingleJump = (height: number) => ({
      jumpHeight: height,
      jumpVelocity: -Math.sqrt(JUMP_IMPULSE ** 2 - 2 * JUMP_GRAVITY * height),
      jumpsUsed: 1,
      slideHeld: true,
    });
    /** A jump lands at the speed it left the ground with. */
    const secondsUntilTouchdown = (player: { jumpVelocity: number }) =>
      (JUMP_IMPULSE + player.jumpVelocity) / JUMP_GRAVITY;
    const secondsUntilGateArrives = (outside: number) => outside / GATE_SPEED;

    it('collides when the gate reaches the hitbox before the runner touches down', () => {
      // Review repro: a real single jump enters its last 60 fps frame about 1 px
      // up and falling at 673 px/s. The gate arrives 1.2 ms in and the runner is
      // down at 1.5 ms, so the frame ends in a grounded slide.
      const player = fallingSingleJump(1);

      expect(
        secondsUntilGateArrives(0.3),
        'the gate arrives while the runner is airborne',
      ).toBeLessThan(secondsUntilTouchdown(player));
      expect(
        secondsUntilTouchdown(player),
        'the runner touches down inside the frame',
      ).toBeLessThan(GATE_FRAME_SECONDS);

      const after = advanceOneGateFrame({
        gateX: gateEnteringHitbox(0.3),
        player,
      });

      expect(isPlayerSliding(after.player), 'frame ends in a grounded slide').toBe(
        true,
      );
      expectGateHit(after);
    });

    it('collides when the gate reaches the hitbox long before the runner touches down', () => {
      // A runner that enters its last frame lower down touches down later in it:
      // here 12 ms in, after the gate has been inside the hitbox since 3.9 ms.
      const player = fallingSingleJump(8);

      expect(
        secondsUntilGateArrives(1),
        'the gate arrives while the runner is airborne',
      ).toBeLessThan(secondsUntilTouchdown(player));
      expect(
        secondsUntilTouchdown(player),
        'the runner touches down inside the frame',
      ).toBeLessThan(GATE_FRAME_SECONDS);

      const after = advanceOneGateFrame({
        gateX: gateEnteringHitbox(1),
        player,
      });

      expect(isPlayerSliding(after.player), 'frame ends in a grounded slide').toBe(
        true,
      );
      expectGateHit(after);
    });

    it('lets the held slide pass a gate that only reaches the hitbox after the runner has touched down', () => {
      const player = fallingSingleJump(1);

      expect(
        secondsUntilTouchdown(player),
        'the runner is on the ground when the gate arrives',
      ).toBeLessThan(secondsUntilGateArrives(0.5));
      expect(
        secondsUntilGateArrives(0.5),
        'the gate still arrives inside the frame',
      ).toBeLessThan(GATE_FRAME_SECONDS);

      const after = advanceOneGateFrame({
        gateX: gateEnteringHitbox(0.5),
        player,
      });

      expect(isPlayerSliding(after.player), 'frame ends in a grounded slide').toBe(
        true,
      );
      expectGateMissed(after);
    });
  });
});
