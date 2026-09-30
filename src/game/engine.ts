import type { LevelConfig } from './levels';

export const WORLD_WIDTH = 960;
export const WORLD_HEIGHT = 420;
export const GROUND_Y = 326;
export const PLAYER_X = 174;
export const PLAYER_WIDTH = 72;
export const PLAYER_CENTER_X = PLAYER_X + PLAYER_WIDTH / 2;

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

export type PlayerAction = 'jump' | 'slide';
export type ObstacleType = 'stump' | 'arch' | 'gap';
export type GameStatus = 'running' | 'won' | 'lost';

export interface Obstacle {
  id: number;
  type: ObstacleType;
  x: number;
  width: number;
}

export interface Pickup {
  id: number;
  x: number;
  y: number;
}

export interface PlayerState {
  jumpHeight: number;
  jumpVelocity: number;
  slideRemaining: number;
}

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
  pickups: Pickup[];
  nextObstacleIn: number;
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
}

const GRAVITY = 1_650;
const JUMP_IMPULSE = 675;
const SLIDE_DURATION = 0.72;
const PICKUP_HEIGHTS = [150, 270, 306, 270] as const;
const PICKUP_VERTICAL_TOLERANCE = 32;
const SLIDE_PICKUP_CENTER_OFFSET = 20;

export function getRunSpeed(level: LevelConfig, distance: number): number {
  const progress = Math.min(Math.max(distance / level.distanceGoal, 0), 1);
  return level.baseSpeed + level.speedRamp * progress;
}

export function createGameState(level: LevelConfig): GameState {
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
      slideRemaining: 0,
    },
    obstacles: [],
    pickups: [],
    nextObstacleIn: 0.92,
    nextPickupIn: 0.42,
    nextEntityId: 1,
  };
}

export function applyPlayerAction(
  state: GameState,
  action: PlayerAction,
): GameState {
  if (state.status !== 'running') {
    return state;
  }

  if (action === 'jump') {
    if (
      state.player.jumpHeight > 0 ||
      state.player.jumpVelocity > 0 ||
      state.player.slideRemaining > 0
    ) {
      return state;
    }

    return {
      ...state,
      player: {
        ...state.player,
        jumpVelocity: JUMP_IMPULSE,
      },
    };
  }

  if (state.player.jumpHeight > 0 || state.player.jumpVelocity > 0) {
    return state;
  }

  return {
    ...state,
    player: {
      ...state.player,
      slideRemaining: SLIDE_DURATION,
    },
  };
}

export function advanceGame(
  state: GameState,
  deltaSeconds: number,
  random: () => number = Math.random,
): GameState {
  if (state.status !== 'running') {
    return state;
  }

  const delta = Math.min(Math.max(deltaSeconds, 0), 0.05);
  if (delta === 0) {
    return state;
  }

  const speed = getRunSpeed(state.level, state.distance);
  const distance = state.distance + speed * delta;
  const elapsed = state.elapsed + delta;
  const jumpHeight = Math.max(
    0,
    state.player.jumpHeight + state.player.jumpVelocity * delta,
  );
  const jumpVelocity =
    jumpHeight === 0
      ? 0
      : state.player.jumpVelocity - GRAVITY * delta;
  const slideRemaining = Math.max(0, state.player.slideRemaining - delta);
  const player = { jumpHeight, jumpVelocity, slideRemaining };
  let energy = Math.max(
    0,
    state.energy - CUSTOM_GAME_TUNING.passiveEnergyDrainPerSecond * delta,
  );
  let score =
    state.score + speed * delta * CUSTOM_GAME_TUNING.distanceScoreMultiplier;
  let collectibles = state.collectibles;
  let combo = state.combo;
  let nextEntityId = state.nextEntityId;

  let nextObstacleIn = state.nextObstacleIn - delta;
  const obstacles = state.obstacles.map((obstacle) => ({
    ...obstacle,
    x: obstacle.x - speed * delta,
  }));

  if (nextObstacleIn <= 0 && distance < state.level.distanceGoal - 460) {
    const typeRoll = random();
    const type: ObstacleType =
      typeRoll < state.level.gapChance
        ? 'gap'
        : typeRoll < state.level.gapChance + 0.38
          ? 'arch'
          : 'stump';

    obstacles.push({
      id: nextEntityId,
      type,
      x: WORLD_WIDTH + 48,
      width: type === 'gap' ? 88 + Math.floor(random() * 18) : type === 'arch' ? 82 : 58,
    });
    nextEntityId += 1;
    nextObstacleIn =
      state.level.obstacleInterval * (0.78 + Math.min(random(), 0.99) * 0.38);
  }

  const hitboxLeft = PLAYER_X + 7;
  const hitboxRight = PLAYER_X + PLAYER_WIDTH - 6;
  let collidedThisFrame = false;
  const remainingObstacles: Obstacle[] = [];

  for (const obstacle of obstacles) {
    const overlapsRunner =
      obstacle.x < hitboxRight && obstacle.x + obstacle.width > hitboxLeft;
    const canAvoid =
      obstacle.type === 'arch'
        ? player.slideRemaining > 0
        : player.jumpHeight > (obstacle.type === 'gap' ? 58 : 40);

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
    x: pickup.x - speed * delta,
  }));

  if (nextPickupIn <= 0 && distance < state.level.distanceGoal - 250) {
    const heightIndex = Math.floor(Math.min(random(), 0.999) * PICKUP_HEIGHTS.length);
    pickups.push({
      id: nextEntityId,
      x: WORLD_WIDTH + 44,
      y: PICKUP_HEIGHTS[heightIndex]!,
    });
    nextEntityId += 1;
    nextPickupIn =
      state.level.pickupInterval * (0.83 + Math.min(random(), 0.99) * 0.34);
  }

  const playerCenterY =
    GROUND_Y -
    56 -
    player.jumpHeight +
    (player.slideRemaining > 0 ? SLIDE_PICKUP_CENTER_OFFSET : 0);
  const remainingPickups: Pickup[] = [];

  for (const pickup of pickups) {
    const closeEnough =
      Math.abs(pickup.x - PLAYER_CENTER_X) < 54 &&
      Math.abs(pickup.y - playerCenterY) < PICKUP_VERTICAL_TOLERANCE;

    if (closeEnough) {
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

  return {
    ...state,
    status,
    elapsed,
    distance: Math.min(distance, state.level.distanceGoal),
    score: Math.floor(score),
    energy,
    collectibles,
    combo,
    player,
    obstacles: remainingObstacles,
    pickups: remainingPickups,
    nextObstacleIn,
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
  };
}
