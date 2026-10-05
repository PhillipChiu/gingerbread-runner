import type { LevelConfig } from './levels';
import {
  expandObstaclePattern,
  getObstacleCue,
  SECTION_PREVIEW_LEAD_DISTANCE,
  type ObstacleQuietZone,
  type ObstaclePatternRole,
  type ScheduledObstacle,
} from './obstaclePattern';
import {
  GAP_JUMP_CLEARANCE,
  DOUBLE_JUMP_IMPULSE,
  HIGH_STUMP_JUMP_CLEARANCE,
  JUMP_IMPULSE,
  STUMP_JUMP_CLEARANCE,
  advanceVerticalMotion,
  getRunSpeed,
} from './physics';
import {
  getRunnerAnimationPose,
  RUNNER_DRAW_BOUNDS,
  RUNNER_FRAME_COUNT,
  SLIDE_DRAW_BOUNDS,
} from './runnerAnimation';

export { getRunSpeed } from './physics';

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 420;
export const GROUND_Y = 334;
export const PLAYER_X = 174;
export const PLAYER_WIDTH = 72;
export const PLAYER_CENTER_X = PLAYER_X + PLAYER_WIDTH / 2;
export const PICKUP_TOUCH_RADIUS = 18;
export const PICKUP_BOB_ANGULAR_SPEED = 5;
export const PICKUP_BOB_AMPLITUDE = 4;

export const CUSTOM_GAME_TUNING = {
  startingEnergy: 100,
  passiveEnergyDrainPerSecond: 1.2,
  collisionEnergyCost: 34,
  pickupEnergyRestore: 18,
  distanceScoreMultiplier: 0.08,
  pickupBaseScore: 110,
  comboScorePerPickup: 8,
  maximumComboScore: 12,
} as const;

export type PlayerAction = 'jump' | 'slideStart' | 'slideEnd';
export type ObstacleType = 'stump' | 'highStump' | 'arch' | 'gap';
export type GameStatus = 'running' | 'won' | 'lost';

export interface Obstacle {
  id: number;
  type: ObstacleType;
  x: number;
  width: number;
  contactDistance?: number;
  patternId?: string;
  patternRole?: ObstaclePatternRole;
  patternIndex?: number;
  patternCount?: number;
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
}

export interface PlayerState {
  jumpHeight: number;
  jumpVelocity: number;
  jumpsUsed: number;
  slideHeld: boolean;
  slideElapsed: number;
}

export type DoubleJumpStatus = 'available' | 'used' | 'recovered';

export interface GameState {
  level: LevelConfig;
  status: GameStatus;
  elapsed: number;
  distance: number;
  score: number;
  energy: number;
  collectibles: number;
  combo: number;
  player: PlayerState;
  obstacles: Obstacle[];
  obstacleSchedule: readonly ScheduledObstacle[];
  obstacleSections: ReturnType<typeof expandObstaclePattern>['sections'];
  obstacleQuietZones: readonly ObstacleQuietZone[];
  nextScheduledObstacleIndex: number;
  pickups: Pickup[];
  nextPickupIn: number;
  nextEntityId: number;
}

export interface GameSnapshot {
  score: number;
  distance: number;
  goalDistance: number;
  progress: number;
  energy: number;
  collectibles: number;
  combo: number;
  speed: number;
  doubleJumpStatus: DoubleJumpStatus;
  cue: ReturnType<typeof getObstacleCue>;
}

const PICKUP_HEIGHTS = [
  GROUND_Y - 176,
  GROUND_Y - 56,
  GROUND_Y - 20,
  GROUND_Y - 56,
] as const;
const PLAYER_HITBOX_LEFT = PLAYER_X + 7;
const PLAYER_HITBOX_RIGHT = PLAYER_X + PLAYER_WIDTH - 6;
const PICKUP_INTERACTION_HALF_WIDTH =
  Math.max(RUNNER_DRAW_BOUNDS.width, SLIDE_DRAW_BOUNDS.width) / 2 +
  PICKUP_TOUCH_RADIUS;
const OBSTACLE_SPAWN_RIGHT_EDGE = WORLD_WIDTH + 48;
const PICKUP_SPAWN_X = WORLD_WIDTH + 44;

export function isPlayerSliding(player: PlayerState): boolean {
  return (
    player.slideHeld &&
    player.jumpHeight === 0 &&
    player.jumpVelocity === 0
  );
}

export function getDoubleJumpStatus(player: PlayerState): DoubleJumpStatus {
  if (player.jumpHeight > 0 && player.jumpsUsed >= 2) {
    return 'used';
  }
  if (player.jumpHeight > 0 && player.jumpsUsed === 1) {
    return 'available';
  }

  return 'recovered';
}

export function getPickupRenderY(
  pickup: Pickup,
  elapsed: number,
  reduceMotion = false,
): number {
  return (
    pickup.y +
    (reduceMotion
      ? 0
      : Math.sin(elapsed * PICKUP_BOB_ANGULAR_SPEED + pickup.id) *
        PICKUP_BOB_AMPLITUDE)
  );
}

function overlapsRunnerPickup(
  pickup: Pickup,
  player: PlayerState,
  elapsed: number,
  reduceMotion: boolean,
): boolean {
  const sliding = isPlayerSliding(player);
  const bounds = sliding
    ? SLIDE_DRAW_BOUNDS
    : RUNNER_DRAW_BOUNDS;
  const pose = getRunnerAnimationPose(elapsed, RUNNER_FRAME_COUNT, reduceMotion);
  const baseline =
    GROUND_Y -
    player.jumpHeight +
    (sliding || player.jumpHeight > 0 ? 0 : pose.bobOffset);
  const pickupY = getPickupRenderY(pickup, elapsed, reduceMotion);
  const left = PLAYER_CENTER_X - bounds.width / 2;
  const right = PLAYER_CENTER_X + bounds.width / 2;
  const top = baseline - bounds.height;
  const nearestX = Math.max(left, Math.min(pickup.x, right));
  const nearestY = Math.max(top, Math.min(pickupY, baseline));
  const offsetX = pickup.x - nearestX;
  const offsetY = pickupY - nearestY;

  return (
    offsetX * offsetX + offsetY * offsetY <=
    PICKUP_TOUCH_RADIUS * PICKUP_TOUCH_RADIUS
  );
}

function pickupInterruptsObstacle(
  predictedDistance: number,
  state: GameState,
): boolean {
  const interactionStartDistance =
    predictedDistance - PICKUP_INTERACTION_HALF_WIDTH;
  const interactionEndDistance =
    predictedDistance + PICKUP_INTERACTION_HALF_WIDTH;
  const overlapsProtectedZone = (
    startDistance: number,
    endDistance: number,
  ): boolean =>
    interactionEndDistance >= startDistance &&
    interactionStartDistance < endDistance;

  return (
    state.obstacleSections.some((section) =>
      overlapsProtectedZone(
        section.firstArchContactDistance - SECTION_PREVIEW_LEAD_DISTANCE,
        section.recoveryEndDistance,
      ),
    ) ||
    state.obstacleQuietZones.some((zone) =>
      overlapsProtectedZone(zone.startDistance, zone.endDistance),
    )
  );
}

export function createGameState(level: LevelConfig): GameState {
  const obstaclePattern = expandObstaclePattern(level);
  return {
    level,
    status: 'running',
    elapsed: 0,
    distance: 0,
    score: 0,
    energy: CUSTOM_GAME_TUNING.startingEnergy,
    collectibles: 0,
    combo: 0,
    player: {
      jumpHeight: 0,
      jumpVelocity: 0,
      jumpsUsed: 0,
      slideHeld: false,
      slideElapsed: 0,
    },
    obstacles: [],
    obstacleSchedule: obstaclePattern.obstacles,
    obstacleSections: obstaclePattern.sections,
    obstacleQuietZones: obstaclePattern.quietZones,
    nextScheduledObstacleIndex: 0,
    pickups: [],
    nextPickupIn: 0.42,
    nextEntityId: 1,
  };
}

export function applyPlayerAction(
  state: GameState,
  action: PlayerAction,
): GameState {
  if (action === 'slideEnd') {
    if (!state.player.slideHeld) {
      return state;
    }

    return {
      ...state,
      player: {
        ...state.player,
        slideHeld: false,
        slideElapsed: 0,
      },
    };
  }

  if (state.status !== 'running') {
    return state;
  }

  if (action === 'jump') {
    if (state.player.slideHeld) {
      return state;
    }

    if (
      state.player.jumpHeight > 0 &&
      state.player.jumpsUsed === 1
    ) {
      return {
        ...state,
        player: {
          ...state.player,
          jumpVelocity: DOUBLE_JUMP_IMPULSE,
          jumpsUsed: 2,
        },
      };
    }

    if (
      state.player.jumpHeight !== 0 ||
      state.player.jumpVelocity !== 0 ||
      state.player.jumpsUsed !== 0
    ) {
      return state;
    }

    return {
      ...state,
      player: {
        ...state.player,
        jumpVelocity: JUMP_IMPULSE,
        jumpsUsed: 1,
      },
    };
  }

  if (state.player.slideHeld) {
    return state;
  }

  return {
    ...state,
    player: {
      ...state.player,
      slideHeld: true,
      slideElapsed: 0,
    },
  };
}

export function advanceGame(
  state: GameState,
  deltaSeconds: number,
  random: () => number = Math.random,
  reduceMotion = false,
): GameState {
  if (state.status !== 'running') {
    return state;
  }

  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
  if (delta === 0) {
    return state;
  }

  const speed = getRunSpeed(state.level, state.distance);
  const distance = Math.min(
    state.distance + speed * delta,
    state.level.distanceGoal,
  );
  const distanceDelta = distance - state.distance;
  const elapsed = state.elapsed + delta;
  const verticalMotion = advanceVerticalMotion(
    state.player.jumpHeight,
    state.player.jumpVelocity,
    delta,
  );
  const jumpHeight = verticalMotion.height;
  const jumpVelocity = verticalMotion.velocity;
  const playerIsSliding =
    state.player.slideHeld && jumpHeight === 0 && jumpVelocity === 0;
  const wasSliding = isPlayerSliding(state.player);
  const player = {
    jumpHeight,
    jumpVelocity,
    jumpsUsed: verticalMotion.landed ? 0 : state.player.jumpsUsed,
    slideHeld: state.player.slideHeld,
    slideElapsed: playerIsSliding
      ? wasSliding
        ? state.player.slideElapsed + delta
        : 0
      : 0,
  };
  let energy = Math.max(
    0,
    state.energy - CUSTOM_GAME_TUNING.passiveEnergyDrainPerSecond * delta,
  );
  let score =
    state.score + speed * delta * CUSTOM_GAME_TUNING.distanceScoreMultiplier;
  let collectibles = state.collectibles;
  let combo = state.combo;
  let nextEntityId = state.nextEntityId;

  const obstacles = state.obstacles.map((obstacle) => ({
    ...obstacle,
    x: obstacle.x - distanceDelta,
  }));
  let nextScheduledObstacleIndex = state.nextScheduledObstacleIndex;
  while (nextScheduledObstacleIndex < state.obstacleSchedule.length) {
    const scheduled = state.obstacleSchedule[nextScheduledObstacleIndex]!;
    const x =
      PLAYER_HITBOX_RIGHT + scheduled.contactDistance - distance;
    if (x > OBSTACLE_SPAWN_RIGHT_EDGE) {
      break;
    }

    if (x + scheduled.width > -64) {
      obstacles.push({
        ...scheduled,
        id: nextEntityId,
        x,
      });
      nextEntityId += 1;
    }
    nextScheduledObstacleIndex += 1;
  }

  let collidedThisFrame = false;
  const remainingObstacles: Obstacle[] = [];

  for (const obstacle of obstacles) {
    const overlapsRunner =
      obstacle.x < PLAYER_HITBOX_RIGHT &&
      obstacle.x + obstacle.width > PLAYER_HITBOX_LEFT;
    const canAvoid =
      obstacle.type === 'arch'
        ? isPlayerSliding(player)
        : player.jumpHeight >
          (obstacle.type === 'gap'
            ? GAP_JUMP_CLEARANCE
            : obstacle.type === 'highStump'
              ? HIGH_STUMP_JUMP_CLEARANCE
              : STUMP_JUMP_CLEARANCE);

    if (
      overlapsRunner &&
      !canAvoid &&
      !collidedThisFrame &&
      energy > 0
    ) {
      energy = Math.max(0, energy - CUSTOM_GAME_TUNING.collisionEnergyCost);
      collidedThisFrame = true;
      continue;
    }

    if (obstacle.x + obstacle.width > -64) {
      remainingObstacles.push(obstacle);
    }
  }

  let nextPickupIn = state.nextPickupIn - delta;
  const pickups = state.pickups.map((pickup) => ({
    ...pickup,
    x: pickup.x - distanceDelta,
  }));

  if (nextPickupIn <= 0 && distance < state.level.distanceGoal - 250) {
    const predictedPickupDistance =
      distance + PICKUP_SPAWN_X - PLAYER_CENTER_X;
    const pickupWouldInterruptPattern = pickupInterruptsObstacle(
      predictedPickupDistance,
      state,
    );
    if (!pickupWouldInterruptPattern) {
      const heightIndex = Math.floor(
        Math.min(random(), 0.999) * PICKUP_HEIGHTS.length,
      );
      pickups.push({
        id: nextEntityId,
        x: PICKUP_SPAWN_X,
        y: PICKUP_HEIGHTS[heightIndex]!,
      });
      nextEntityId += 1;
    }
    nextPickupIn =
      state.level.pickupInterval * (0.83 + Math.min(random(), 0.99) * 0.34);
  }

  const remainingPickups: Pickup[] = [];

  for (const pickup of pickups) {
    const predictedPickupDistance =
      distance + pickup.x - PLAYER_CENTER_X;
    const pickupWouldInterruptPattern = pickupInterruptsObstacle(
      predictedPickupDistance,
      state,
    );
    if (pickupWouldInterruptPattern) {
      continue;
    }

    if (overlapsRunnerPickup(pickup, player, elapsed, reduceMotion)) {
      collectibles += 1;
      combo += 1;
      score +=
        CUSTOM_GAME_TUNING.pickupBaseScore +
        Math.min(combo, CUSTOM_GAME_TUNING.maximumComboScore) *
          CUSTOM_GAME_TUNING.comboScorePerPickup;
      energy = Math.min(
        CUSTOM_GAME_TUNING.startingEnergy,
        energy + CUSTOM_GAME_TUNING.pickupEnergyRestore,
      );
      continue;
    }

    if (pickup.x > -32) {
      remainingPickups.push(pickup);
    } else {
      combo = 0;
    }
  }

  const status =
    energy <= 0
      ? 'lost'
      : distance >= state.level.distanceGoal
        ? 'won'
        : 'running';
  const finalPlayer =
    status === 'running'
      ? player
      : { ...player, slideHeld: false, slideElapsed: 0 };

  return {
    ...state,
    status,
    elapsed,
    distance: Math.min(distance, state.level.distanceGoal),
    score: Math.floor(score),
    energy,
    collectibles,
    combo,
    player: finalPlayer,
    obstacles: remainingObstacles,
    obstacleSchedule: state.obstacleSchedule,
    obstacleSections: state.obstacleSections,
    nextScheduledObstacleIndex,
    pickups: remainingPickups,
    nextPickupIn,
    nextEntityId,
  };
}

export function toGameSnapshot(state: GameState): GameSnapshot {
  return {
    score: Math.floor(state.score),
    distance: state.distance,
    goalDistance: state.level.distanceGoal,
    progress: Math.min(state.distance / state.level.distanceGoal, 1),
    energy: state.energy,
    collectibles: state.collectibles,
    combo: state.combo,
    speed: getRunSpeed(state.level, state.distance),
    doubleJumpStatus: getDoubleJumpStatus(state.player),
    cue: getObstacleCue(state.level, state.distance, state.player),
  };
}
