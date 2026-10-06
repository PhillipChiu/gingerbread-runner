import type {
  FollowupJumpType,
  LevelConfig,
  PatternObstacleType,
  SlideSectionPattern,
} from './levels';
import {
  DOUBLE_JUMP_IMPULSE,
  GAP_JUMP_CLEARANCE,
  HIGH_STUMP_JUMP_CLEARANCE,
  JUMP_GRAVITY,
  JUMP_IMPULSE,
  STUMP_JUMP_CLEARANCE,
  getJumpAvoidanceTimeWindow,
  getRunSpeed,
  getVerticalClearanceTimeWindow,
  getVerticalHeightAtTime,
} from './physics';

export const OBSTACLE_WIDTHS: Readonly<Record<PatternObstacleType, number>> = {
  arch: 82,
  highStump: 42,
  stump: 58,
  gap: 88,
};

export const PLAYER_COLLISION_WIDTH = 59;
export const OBSTACLE_COLLISION_CLEARANCE = PLAYER_COLLISION_WIDTH;
export const SLIDE_HOLD_LEAD_DISTANCE = 300;
export const JUMP_PREPARE_LEAD_DISTANCE = 300;
export const SECTION_PREVIEW_LEAD_DISTANCE = 650;
export const MIN_RECOVERY_CUE_DISTANCE = 300;
export const SAFE_FINISH_DISTANCE = 650;
const DOUBLE_JUMP_CUE_MARGIN = 6;
export const HIGH_STUMP_CUE_MARGIN = 2;
export const HIGH_STUMP_DOUBLE_JUMP_MIN_CONTACT_LEAD_SECONDS = 0.08;
const MIN_HIGH_STUMP_DOUBLE_JUMP_CUE_SECONDS = 0.15;
const FIRST_JUMP_CUE_EARLY_TOLERANCE_SECONDS = 0.095;
const FIRST_JUMP_CUE_LATE_TOLERANCE_SECONDS = 0.06;
const SEQUENCE_PREVIEW_LEAD_DISTANCE = 300;

export type ObstaclePatternRole = 'prelude' | 'arch' | 'followup';

export interface ScheduledObstacle {
  type: PatternObstacleType;
  width: number;
  contactDistance: number;
  patternId: string;
  patternRole: ObstaclePatternRole;
  patternIndex: number;
  patternCount: number;
  sequenceId?: string;
}

export interface ObstacleQuietZone {
  startDistance: number;
  endDistance: number;
}

export interface ExpandedSlideSection extends SlideSectionPattern {
  id: string;
  sectionIndex: number;
  requestedContactDistance: number;
  firstArchContactDistance: number;
  holdStartDistance: number;
  lastArchClearDistance: number;
  followupJumpContactDistances: number[];
  finalFollowupClearDistance: number;
  recoveryEndDistance: number;
}

export interface ExpandedObstaclePattern {
  obstacles: ScheduledObstacle[];
  sections: ExpandedSlideSection[];
  quietZones: ObstacleQuietZone[];
}

export type ObstacleCueKind =
  | 'prelude'
  | 'prepare'
  | 'preview'
  | 'hold'
  | 'release'
  | 'jump'
  | 'doubleJump'
  | 'recovery';

export interface ObstacleCue {
  key: string;
  kind: ObstacleCueKind;
  text: string;
}

interface RelativeSlideSection {
  pattern: SlideSectionPattern;
  requestedContactDistance: number;
  archLastClearOffset: number;
  followupOffsets: number[];
  finalFollowupClearOffset: number;
}

interface ActionableWindow {
  startDistance: number;
  endDistance: number;
}

interface CuePlayerState {
  jumpHeight: number;
  jumpVelocity: number;
  jumpsUsed: number;
  slideHeld: boolean;
}

const expandedPatternCache = new WeakMap<LevelConfig, ExpandedObstaclePattern>();

function progressToDistance(progress: number, distanceGoal: number): number {
  if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
    throw new RangeError(`Obstacle progress must be between 0 and 1: ${progress}`);
  }

  return Math.round(progress * distanceGoal);
}

function getRelativeSection(
  pattern: SlideSectionPattern,
  distanceGoal: number,
): RelativeSlideSection {
  if (
    !Number.isInteger(pattern.archCount) ||
    pattern.archCount < 1 ||
    !Number.isFinite(pattern.archPitchPx) ||
    pattern.archPitchPx <= 0 ||
    pattern.followupJumps.length === 0 ||
    pattern.releaseToJumpPx < 0 ||
    pattern.jumpPairClearancePx < 0 ||
    pattern.recoveryPx < 0
  ) {
    throw new RangeError('Slide sections require positive arches and valid clearances.');
  }

  const archLastClearOffset =
    (pattern.archCount - 1) * pattern.archPitchPx +
    OBSTACLE_WIDTHS.arch +
    OBSTACLE_COLLISION_CLEARANCE;
  const followupOffsets: number[] = [];
  let previousFollowupContactOffset =
    archLastClearOffset + pattern.releaseToJumpPx;

  pattern.followupJumps.forEach((_, index) => {
    const contactOffset =
      index === 0
        ? previousFollowupContactOffset
        : previousFollowupContactOffset +
          OBSTACLE_WIDTHS[pattern.followupJumps[index - 1]!] +
          OBSTACLE_COLLISION_CLEARANCE +
          pattern.jumpPairClearancePx;
    followupOffsets.push(contactOffset);
    previousFollowupContactOffset = contactOffset;
  });

  const lastFollowupType = pattern.followupJumps.at(-1)!;
  const finalFollowupClearOffset =
    followupOffsets.at(-1)! +
    OBSTACLE_WIDTHS[lastFollowupType] +
    OBSTACLE_COLLISION_CLEARANCE;

  return {
    pattern,
    requestedContactDistance: progressToDistance(
      pattern.atProgress,
      distanceGoal,
    ),
    archLastClearOffset,
    followupOffsets,
    finalFollowupClearOffset,
  };
}

function placeSectionAnchors(
  relativeSections: readonly RelativeSlideSection[],
  distanceGoal: number,
): number[] {
  const contacts: number[] = [];

  for (let index = 0; index < relativeSections.length; index += 1) {
    const current = relativeSections[index]!;
    const previous = relativeSections[index - 1];
    const minimumContact = previous
      ? contacts[index - 1]! +
        previous.finalFollowupClearOffset +
        previous.pattern.recoveryPx
      : 0;
    contacts.push(Math.max(current.requestedContactDistance, minimumContact));
  }

  if (relativeSections.length === 0) {
    return contacts;
  }

  const lastIndex = relativeSections.length - 1;
  contacts[lastIndex] = Math.min(
    contacts[lastIndex]!,
    distanceGoal -
      SAFE_FINISH_DISTANCE -
      relativeSections[lastIndex]!.finalFollowupClearOffset,
  );

  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    contacts[index] = Math.min(
      contacts[index]!,
      contacts[index + 1]! -
        relativeSections[index]!.finalFollowupClearOffset -
        relativeSections[index]!.pattern.recoveryPx,
    );
  }

  if (
    contacts[0]! < 0 ||
    contacts.some((contact, index) => {
      const relative = relativeSections[index]!;
      return (
        contact < 0 ||
        contact + relative.finalFollowupClearOffset >
          distanceGoal - SAFE_FINISH_DISTANCE
      );
    })
  ) {
    throw new RangeError(
      'Obstacle sections do not fit while preserving recovery and safe-finish distances.',
    );
  }

  for (let index = 1; index < contacts.length; index += 1) {
    const previous = relativeSections[index - 1]!;
    if (
      contacts[index]! <
      contacts[index - 1]! +
        previous.finalFollowupClearOffset +
        previous.pattern.recoveryPx
    ) {
      throw new RangeError('Slide sections overlap their follow-up or recovery route.');
    }
  }

  return contacts;
}

function obstacle(
  type: PatternObstacleType,
  contactDistance: number,
  patternId: string,
  patternRole: ObstaclePatternRole,
  patternIndex: number,
  patternCount: number,
  sequenceId?: string,
): ScheduledObstacle {
  return {
    type,
    width: OBSTACLE_WIDTHS[type],
    contactDistance,
    patternId,
    patternRole,
    patternIndex,
    patternCount,
    ...(sequenceId ? { sequenceId } : {}),
  };
}

export function expandObstaclePattern(
  level: LevelConfig,
): ExpandedObstaclePattern {
  const cached = expandedPatternCache.get(level);
  if (cached) {
    return cached;
  }

  const relativeSections = level.obstaclePattern.slideSections.map((section) =>
    getRelativeSection(section, level.distanceGoal),
  );
  const contacts = placeSectionAnchors(relativeSections, level.distanceGoal);
  const sections: ExpandedSlideSection[] = relativeSections.map(
    (relative, sectionIndex) => {
      const id = `level-${level.id}-section-${sectionIndex + 1}`;
      const firstArchContactDistance = contacts[sectionIndex]!;
      const lastArchClearDistance =
        firstArchContactDistance + relative.archLastClearOffset;
      const followupJumpContactDistances = relative.followupOffsets.map(
        (offset) => firstArchContactDistance + offset,
      );
      const finalFollowupClearDistance =
        firstArchContactDistance + relative.finalFollowupClearOffset;
      const nextSection = relativeSections[sectionIndex + 1];
      const recoveryEndDistance = nextSection
        ? contacts[sectionIndex + 1]!
        : Math.min(
            level.distanceGoal,
            finalFollowupClearDistance + relative.pattern.recoveryPx,
          );

      return {
        ...relative.pattern,
        id,
        sectionIndex,
        requestedContactDistance: relative.requestedContactDistance,
        firstArchContactDistance,
        holdStartDistance:
          firstArchContactDistance - SLIDE_HOLD_LEAD_DISTANCE,
        lastArchClearDistance,
        followupJumpContactDistances,
        finalFollowupClearDistance,
        recoveryEndDistance,
      };
    },
  );

  const prelude = level.obstaclePattern.prelude;
  const sequenceCounts = new Map<string, number>();
  for (const pattern of prelude) {
    if (pattern.sequenceId) {
      sequenceCounts.set(
        pattern.sequenceId,
        (sequenceCounts.get(pattern.sequenceId) ?? 0) + 1,
      );
    }
  }

  const sequenceIndexes = new Map<string, number>();
  const previousSequenceObstacle = new Map<string, ScheduledObstacle>();
  const obstacles: ScheduledObstacle[] = prelude.map((pattern, index) => {
    const sequenceId = pattern.sequenceId;
    const previous = sequenceId
      ? previousSequenceObstacle.get(sequenceId)
      : undefined;
    const clearanceGap = pattern.afterPreviousClearancePx;
    if (
      clearanceGap !== undefined &&
      (!previous ||
        !Number.isFinite(clearanceGap) ||
        clearanceGap < 0)
    ) {
      throw new RangeError(
        'A prelude clearance gap requires a previous obstacle in the same sequence.',
      );
    }

    const contactDistance =
      clearanceGap !== undefined
        ? previous!.contactDistance +
          previous!.width +
          OBSTACLE_COLLISION_CLEARANCE +
          clearanceGap
        : progressToDistance(pattern.atProgress, level.distanceGoal);
    const patternId = sequenceId
      ? `level-${level.id}-prelude-${sequenceId}`
      : `level-${level.id}-prelude-${index + 1}`;
    const patternIndex = sequenceId
      ? (sequenceIndexes.get(sequenceId) ?? 0) + 1
      : 1;
    if (sequenceId) {
      sequenceIndexes.set(sequenceId, patternIndex);
    }
    const scheduled = obstacle(
      pattern.type,
      contactDistance,
      patternId,
      'prelude',
      patternIndex,
      sequenceId ? sequenceCounts.get(sequenceId)! : 1,
      sequenceId,
    );
    if (sequenceId) {
      previousSequenceObstacle.set(sequenceId, scheduled);
    }

    return scheduled;
  });

  for (const section of sections) {
    for (let index = 0; index < section.archCount; index += 1) {
      obstacles.push(
        obstacle(
          'arch',
          section.firstArchContactDistance + index * section.archPitchPx,
          section.id,
          'arch',
          index + 1,
          section.archCount,
        ),
      );
    }

    section.followupJumps.forEach((type, index) => {
      obstacles.push(
        obstacle(
          type,
          section.followupJumpContactDistances[index]!,
          section.id,
          'followup',
          index + 1,
          section.followupJumps.length,
        ),
      );
    });
  }

  obstacles.sort((left, right) => left.contactDistance - right.contactDistance);
  const preludeCueGroups = new Map<string, ScheduledObstacle[]>();
  for (const scheduled of obstacles) {
    if (
      scheduled.patternRole === 'prelude' &&
      (scheduled.sequenceId || scheduled.type === 'highStump')
    ) {
      const group = preludeCueGroups.get(scheduled.patternId) ?? [];
      group.push(scheduled);
      preludeCueGroups.set(scheduled.patternId, group);
    }
  }
  const quietZones: ObstacleQuietZone[] = [...preludeCueGroups.values()].map(
    (group) => {
      const first = group[0]!;
      const last = group.at(-1)!;
      return {
        startDistance:
          first.contactDistance - SECTION_PREVIEW_LEAD_DISTANCE,
        endDistance:
          last.contactDistance +
          last.width +
          OBSTACLE_COLLISION_CLEARANCE +
          MIN_RECOVERY_CUE_DISTANCE,
      };
    },
  );
  const expanded = { obstacles, sections, quietZones };
  expandedPatternCache.set(level, expanded);
  return expanded;
}

function getJumpName(type: FollowupJumpType): string {
  if (type === 'gap') {
    return '裂隙';
  }
  return type === 'highStump' ? '高樹樁' : '樹樁';
}

function getJumpCueWindow(
  level: LevelConfig,
  obstacleType: 'stump' | 'gap',
  contactDistance: number,
  obstacleWidth: number,
  currentDistance: number,
): ActionableWindow | null {
  const speed = getRunSpeed(level, currentDistance);
  const { ascentSeconds, descentSeconds } =
    getJumpAvoidanceTimeWindow(obstacleType);
  const startDistance =
    contactDistance +
    obstacleWidth +
    OBSTACLE_COLLISION_CLEARANCE -
    speed * descentSeconds;
  const endDistance = contactDistance - speed * ascentSeconds;

  return startDistance < endDistance
    ? { startDistance, endDistance }
    : null;
}

function getHighStumpFirstJumpWindow(
  level: LevelConfig,
  obstacle: ScheduledObstacle,
): ActionableWindow | null {
  const speed = getRunSpeed(level, obstacle.contactDistance);
  const firstJumpPeakTime = JUMP_IMPULSE / JUMP_GRAVITY;
  const firstJumpPeakHeight = JUMP_IMPULSE ** 2 / (2 * JUMP_GRAVITY);
  const secondJumpWindow = getVerticalClearanceTimeWindow(
    firstJumpPeakHeight,
    DOUBLE_JUMP_IMPULSE,
    HIGH_STUMP_JUMP_CLEARANCE + HIGH_STUMP_CUE_MARGIN,
  );
  if (!secondJumpWindow) {
    return null;
  }

  const obstacleTraversalSeconds =
    (obstacle.width + OBSTACLE_COLLISION_CLEARANCE) / speed;
  const earliestSecondJumpSeconds = Math.max(
    secondJumpWindow.ascentSeconds,
    HIGH_STUMP_DOUBLE_JUMP_MIN_CONTACT_LEAD_SECONDS,
  );
  const latestSecondJumpSeconds =
    secondJumpWindow.descentSeconds - obstacleTraversalSeconds;
  const usableSecondJumpSeconds =
    latestSecondJumpSeconds - earliestSecondJumpSeconds;
  if (
    usableSecondJumpSeconds <
    MIN_HIGH_STUMP_DOUBLE_JUMP_CUE_SECONDS
  ) {
    return null;
  }

  const secondJumpToContactSeconds =
    (earliestSecondJumpSeconds + latestSecondJumpSeconds) / 2;
  const secondJumpDistance =
    obstacle.contactDistance - speed * secondJumpToContactSeconds;
  const targetFirstJumpDistance =
    secondJumpDistance - speed * firstJumpPeakTime;
  return {
    startDistance:
      targetFirstJumpDistance -
      speed * FIRST_JUMP_CUE_EARLY_TOLERANCE_SECONDS,
    endDistance:
      targetFirstJumpDistance +
      speed * FIRST_JUMP_CUE_LATE_TOLERANCE_SECONDS,
  };
}

function isDoubleJumpPair(
  level: LevelConfig,
  first: ScheduledObstacle,
  second: ScheduledObstacle,
): boolean {
  if (first.type !== 'stump' || second.type !== 'stump') {
    return false;
  }

  const speed = getRunSpeed(level, first.contactDistance);
  const singleJumpWindow = getJumpAvoidanceTimeWindow('stump');
  const fullPairDistance =
    second.contactDistance +
    second.width +
    OBSTACLE_COLLISION_CLEARANCE -
    first.contactDistance;

  return (
    fullPairDistance >
    speed *
      (singleJumpWindow.descentSeconds - singleJumpWindow.ascentSeconds)
  );
}

function getDoubleJumpPairFirstWindow(
  level: LevelConfig,
  first: ScheduledObstacle,
  second: ScheduledObstacle,
): ActionableWindow | null {
  if (!isDoubleJumpPair(level, first, second)) {
    return null;
  }

  const speed = getRunSpeed(level, first.contactDistance);
  const safeClearance = STUMP_JUMP_CLEARANCE + DOUBLE_JUMP_CUE_MARGIN;
  const firstClearDistance =
    first.contactDistance +
    first.width +
    OBSTACLE_COLLISION_CLEARANCE;
  const secondContactDistance =
    second.contactDistance;
  const secondClearDistance =
    secondContactDistance +
    second.width +
    OBSTACLE_COLLISION_CLEARANCE;
  const secondJumpStartDistance = firstClearDistance;
  const secondJumpDuration =
    (secondClearDistance - secondJumpStartDistance) / speed;
  const firstJumpFlightSeconds = (2 * JUMP_IMPULSE) / JUMP_GRAVITY;
  const earliestTakeoffDistance =
    firstClearDistance - speed * firstJumpFlightSeconds;
  const validTakeoffDistances: number[] = [];

  for (
    let takeoffDistance = Math.ceil(earliestTakeoffDistance);
    takeoffDistance < first.contactDistance;
    takeoffDistance += 1
  ) {
    const timeAtFirstContact =
      (first.contactDistance - takeoffDistance) / speed;
    const timeAtFirstClear =
      (firstClearDistance - takeoffDistance) / speed;
    const heightAtFirstContact = getVerticalHeightAtTime(
      0,
      JUMP_IMPULSE,
      timeAtFirstContact,
    );
    const heightAtFirstClear = getVerticalHeightAtTime(
      0,
      JUMP_IMPULSE,
      timeAtFirstClear,
    );
    if (
      heightAtFirstContact <= safeClearance ||
      heightAtFirstClear <= safeClearance
    ) {
      continue;
    }

    const secondJumpStartTime =
      (secondContactDistance - secondJumpStartDistance) / speed;
    const heightAtSecondContact = getVerticalHeightAtTime(
      heightAtFirstClear,
      DOUBLE_JUMP_IMPULSE,
      secondJumpStartTime,
    );
    const heightAtSecondClear = getVerticalHeightAtTime(
      heightAtFirstClear,
      DOUBLE_JUMP_IMPULSE,
      secondJumpDuration,
    );
    if (
      heightAtSecondContact > safeClearance &&
      heightAtSecondClear > safeClearance
    ) {
      validTakeoffDistances.push(takeoffDistance);
    }
  }

  if (validTakeoffDistances.length < 2) {
    return null;
  }

  return {
    startDistance: validTakeoffDistances[0]! + 1,
    endDistance: validTakeoffDistances.at(-1)!,
  };
}

function canDoubleJumpClearPair(
  level: LevelConfig,
  currentDistance: number,
  first: ScheduledObstacle,
  second: ScheduledObstacle,
  player: CuePlayerState,
): boolean {
  if (
    player.jumpHeight <= 0 ||
    player.jumpsUsed !== 1 ||
    player.slideHeld
  ) {
    return false;
  }

  const speed = getRunSpeed(level, currentDistance);
  const safeClearance = STUMP_JUMP_CLEARANCE + DOUBLE_JUMP_CUE_MARGIN;
  const obstacles = [first, second];

  for (const obstacle of obstacles) {
    const clearDistance =
      obstacle.contactDistance +
      obstacle.width +
      OBSTACLE_COLLISION_CLEARANCE;
    if (currentDistance >= clearDistance) {
      continue;
    }

    const firstOverlappingDistance = Math.max(
      currentDistance,
      obstacle.contactDistance,
    );
    const startTime = (firstOverlappingDistance - currentDistance) / speed;
    const endTime = (clearDistance - currentDistance) / speed;
    const heightAtStart = getVerticalHeightAtTime(
      player.jumpHeight,
      DOUBLE_JUMP_IMPULSE,
      startTime,
    );
    const heightAtEnd = getVerticalHeightAtTime(
      player.jumpHeight,
      DOUBLE_JUMP_IMPULSE,
      endTime,
    );
    if (
      heightAtStart <= safeClearance ||
      heightAtEnd <= safeClearance
    ) {
      return false;
    }
  }

  return true;
}

function getDoubleJumpPairCue(
  level: LevelConfig,
  currentDistance: number,
  first: ScheduledObstacle,
  second: ScheduledObstacle,
  cueKey: string,
  player?: CuePlayerState,
): ObstacleCue | null {
  const firstJumpWindow = getDoubleJumpPairFirstWindow(
    level,
    first,
    second,
  );
  if (!firstJumpWindow) {
    return null;
  }

  const secondClearDistance =
    second.contactDistance +
    second.width +
    OBSTACLE_COLLISION_CLEARANCE;
  const firstJumpPrepareStart =
    firstJumpWindow.startDistance - SEQUENCE_PREVIEW_LEAD_DISTANCE;

  if (player?.jumpHeight && player.jumpsUsed === 1) {
    if (
      player.slideHeld &&
      currentDistance >= first.contactDistance - 60 &&
      currentDistance < secondClearDistance
    ) {
      return {
        key: `${cueKey}:second-release`,
        kind: 'release',
        text: '跳躍與滑行互斥，先放開滑行，再空中二段跳。',
      };
    }

    if (
      !player.slideHeld &&
      currentDistance >= first.contactDistance &&
      currentDistance < secondClearDistance &&
      canDoubleJumpClearPair(
        level,
        currentDistance,
        first,
        second,
        player,
      )
    ) {
      return {
        key: `${cueKey}:second`,
        kind: 'doubleJump',
        text: `空中再按一次二段跳，越過第二座樹樁。`,
      };
    }

    if (
      currentDistance >= first.contactDistance - 60 &&
      currentDistance < secondClearDistance
    ) {
      return {
        key: `${cueKey}:second-prepare`,
        kind: 'prepare',
        text: '第一跳已離地，保持在空中，準備再按一次跳躍。',
      };
    }

    return null;
  }

  if (player?.slideHeld) {
    if (
      currentDistance >= firstJumpPrepareStart &&
      currentDistance < first.contactDistance
    ) {
      return {
        key: `${cueKey}:release`,
        kind: 'release',
        text: '連跳樹樁需要跳躍，現在放開滑行。',
      };
    }
    return null;
  }

  if (player?.jumpsUsed) {
    return null;
  }

  if (
    currentDistance >= firstJumpPrepareStart &&
    currentDistance < firstJumpWindow.startDistance
  ) {
    return {
      key: `${cueKey}:prepare`,
      kind: 'prepare',
      text: '前方兩座緊接樹樁；先跳第一座，離地後再二段跳。',
    };
  }

  if (
    currentDistance >= firstJumpWindow.startDistance &&
    currentDistance < firstJumpWindow.endDistance
  ) {
    return {
      key: `${cueKey}:first`,
      kind: 'jump',
      text: '現在先跳過第一座樹樁，空中再按一次跳躍越過第二座。',
    };
  }

  return null;
}

function getHighStumpCue(
  level: LevelConfig,
  currentDistance: number,
  obstacle: ScheduledObstacle,
  player?: CuePlayerState,
): ObstacleCue | null {
  const firstJumpWindow = getHighStumpFirstJumpWindow(level, obstacle);
  if (!firstJumpWindow) {
    return null;
  }

  const prepareStart =
    firstJumpWindow.startDistance - JUMP_PREPARE_LEAD_DISTANCE;
  const obstacleClearDistance =
    obstacle.contactDistance +
    obstacle.width +
    OBSTACLE_COLLISION_CLEARANCE;

  if (player?.jumpHeight && player.jumpsUsed === 1) {
    if (
      player.slideHeld &&
      currentDistance >= prepareStart &&
      currentDistance < obstacle.contactDistance
    ) {
      return {
        key: `${obstacle.patternId}:release`,
        kind: 'release',
        text: '跳躍與滑行互斥，先放開滑行，再空中二段跳。',
      };
    }

    const speed = getRunSpeed(level, currentDistance);
    const secondJumpWindow = getVerticalClearanceTimeWindow(
      player.jumpHeight,
      DOUBLE_JUMP_IMPULSE,
      HIGH_STUMP_JUMP_CLEARANCE + HIGH_STUMP_CUE_MARGIN,
    );
    if (secondJumpWindow) {
      const safeWindow = {
        startDistance:
          obstacleClearDistance -
          speed * secondJumpWindow.descentSeconds,
        endDistance: Math.min(
          obstacle.contactDistance -
            speed * secondJumpWindow.ascentSeconds,
          obstacle.contactDistance -
            speed * HIGH_STUMP_DOUBLE_JUMP_MIN_CONTACT_LEAD_SECONDS,
        ),
      };
      if (
        !player.slideHeld &&
        safeWindow.startDistance < safeWindow.endDistance &&
        currentDistance >= safeWindow.startDistance &&
        currentDistance < safeWindow.endDistance
      ) {
        return {
          key: `${obstacle.patternId}:double-jump`,
          kind: 'doubleJump',
          text: '高樹樁就在前方，現在空中二段跳！',
        };
      }

      if (
        currentDistance >= firstJumpWindow.startDistance &&
        currentDistance < obstacle.contactDistance &&
        currentDistance < safeWindow.startDistance
      ) {
        return {
          key: `${obstacle.patternId}:double-prepare`,
          kind: 'prepare',
          text: '第一跳已離地；保持空中，等高樹樁前的二段跳提示。',
        };
      }
    }

    return null;
  }

  if (player?.jumpsUsed || player?.slideHeld) {
    if (
      player.slideHeld &&
      currentDistance >= prepareStart &&
      currentDistance < obstacle.contactDistance
    ) {
      return {
        key: `${obstacle.patternId}:release`,
        kind: 'release',
        text: '高樹樁需要跳躍，現在放開滑行。',
      };
    }

    return null;
  }

  if (
    currentDistance >= prepareStart &&
    currentDistance < firstJumpWindow.startDistance
  ) {
    return {
      key: `${obstacle.patternId}:prepare`,
      kind: 'prepare',
      text: '前方高樹樁很高，先準備第一跳；離地後還要再跳一次。',
    };
  }

  if (
    currentDistance >= firstJumpWindow.startDistance &&
    currentDistance < firstJumpWindow.endDistance
  ) {
    return {
      key: `${obstacle.patternId}:first-jump`,
      kind: 'jump',
      text: '現在第一跳！跳離地後，再按一次二段跳越過高樹樁。',
    };
  }

  return null;
}

function getPrepareCue(
  key: string,
  obstacleType: FollowupJumpType,
): ObstacleCue {
  return {
    key,
    kind: 'prepare',
    text: `前方${getJumpName(obstacleType)}，準備跳躍；稍後依提示起跳。`,
  };
}

function getJumpCue(
  key: string,
  obstacleType: 'stump' | 'gap',
  releaseSlide: boolean,
): ObstacleCue {
  return {
    key,
    kind: 'jump',
    text: releaseSlide
      ? `現在放開滑行並跳過${getJumpName(obstacleType)}。`
      : `現在跳過${getJumpName(obstacleType)}。`,
  };
}

function isGroundedAndReadyToJump(player?: CuePlayerState): boolean {
  return (
    !player ||
    (!player.slideHeld &&
      player.jumpHeight === 0 &&
      player.jumpVelocity === 0 &&
      player.jumpsUsed === 0)
  );
}

/**
 * Whether the jump already in progress, with no further input, stays above the
 * obstacle's clearance height from first contact until the player is past it.
 * The arc is concave, so checking both ends of the overlap covers all of it.
 */
function isObstacleClearedByCurrentJump(
  level: LevelConfig,
  currentDistance: number,
  obstacle: ScheduledObstacle,
  clearance: number,
  player: CuePlayerState,
): boolean {
  const speed = getRunSpeed(level, currentDistance);
  const overlapStartSeconds = Math.max(
    0,
    (obstacle.contactDistance - currentDistance) / speed,
  );
  const overlapEndSeconds =
    (obstacle.contactDistance +
      obstacle.width +
      OBSTACLE_COLLISION_CLEARANCE -
      currentDistance) /
    speed;

  return [overlapStartSeconds, overlapEndSeconds].every(
    (seconds) =>
      getVerticalHeightAtTime(
        player.jumpHeight,
        player.jumpVelocity,
        seconds,
      ) > clearance,
  );
}

function getStateAwareJumpCue(
  level: LevelConfig,
  currentDistance: number,
  obstacle: ScheduledObstacle,
  cueKey: string,
  cueWindow: ActionableWindow,
  player?: CuePlayerState,
  nextJumpType?: FollowupJumpType,
): ObstacleCue | null {
  if (!player) {
    return null;
  }

  if (player.slideHeld) {
    const prepareStart =
      cueWindow.startDistance - JUMP_PREPARE_LEAD_DISTANCE;
    if (
      currentDistance >= prepareStart &&
      currentDistance < obstacle.contactDistance
    ) {
      return {
        key: `${cueKey}:release`,
        kind: 'release',
        text: player.jumpHeight > 0
          ? '跳躍與滑行互斥，先放開滑行，再空中二段跳。'
          : '跳躍與滑行互斥，先放開滑行再起跳。',
      };
    }
    return null;
  }

  if (player.jumpHeight <= 0 || player.jumpsUsed !== 1) {
    return null;
  }

  if (obstacle.type !== 'stump' && obstacle.type !== 'gap') {
    return null;
  }

  // The optional second jump is also what gets a runner over a gap. When the
  // jump already in progress clears this obstacle, offering it only spends the
  // second jump and stretches the airtime: after a stump the runner lands past
  // the next gap's ground-jump window with no jump left, and after a gap it
  // does the same to the obstacle that follows. Keep it for that neighbour.
  if (
    nextJumpType !== undefined &&
    (obstacle.type === 'gap' || nextJumpType === 'gap') &&
    isObstacleClearedByCurrentJump(
      level,
      currentDistance,
      obstacle,
      obstacle.type === 'gap' ? GAP_JUMP_CLEARANCE : STUMP_JUMP_CLEARANCE,
      player,
    )
  ) {
    return null;
  }

  const minimumHeight =
    obstacle.type === 'gap' ? GAP_JUMP_CLEARANCE : STUMP_JUMP_CLEARANCE;
  const secondJumpWindow = getVerticalClearanceTimeWindow(
    player.jumpHeight,
    DOUBLE_JUMP_IMPULSE,
    minimumHeight + DOUBLE_JUMP_CUE_MARGIN,
  );
  if (!secondJumpWindow) {
    return null;
  }

  const speed = getRunSpeed(level, currentDistance);
  const clearDistance =
    obstacle.contactDistance +
    obstacle.width +
    OBSTACLE_COLLISION_CLEARANCE;
  const actionableWindow = {
    startDistance:
      clearDistance - speed * secondJumpWindow.descentSeconds,
    endDistance:
      obstacle.contactDistance - speed * secondJumpWindow.ascentSeconds,
  };

  if (
    actionableWindow.startDistance < actionableWindow.endDistance &&
    currentDistance < obstacle.contactDistance &&
    currentDistance >= actionableWindow.startDistance &&
    currentDistance < actionableWindow.endDistance
  ) {
    return {
      key: `${cueKey}:second`,
      kind: 'doubleJump',
      text: `空中再按一次二段跳，越過${getJumpName(obstacle.type)}。`,
    };
  }

  const prepareStart =
    actionableWindow.startDistance - JUMP_PREPARE_LEAD_DISTANCE;
  if (
    actionableWindow.startDistance < actionableWindow.endDistance &&
    currentDistance >= prepareStart &&
    currentDistance < actionableWindow.startDistance &&
    currentDistance < obstacle.contactDistance
  ) {
    return {
      key: `${cueKey}:second-prepare`,
      kind: 'prepare',
      text: `保持在空中，準備再按一次跳躍越過${getJumpName(obstacle.type)}。`,
    };
  }

  return null;
}

function getScheduledFollowup(
  obstacles: readonly ScheduledObstacle[],
  section: ExpandedSlideSection,
  index: number,
): ScheduledObstacle {
  return obstacles.find(
    (scheduled) =>
      scheduled.patternId === section.id &&
      scheduled.patternRole === 'followup' &&
      scheduled.patternIndex === index + 1,
  )!;
}

export function getObstacleCue(
  level: LevelConfig,
  distance: number,
  player?: CuePlayerState,
): ObstacleCue | null {
  const { obstacles, sections } = expandObstaclePattern(level);
  const currentDistance = Math.max(0, distance);

  for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex += 1) {
    const section = sections[sectionIndex]!;
    const previousSection = sections[sectionIndex - 1];
    let previewStart =
      section.firstArchContactDistance - SECTION_PREVIEW_LEAD_DISTANCE;
    if (previousSection) {
      const recoveryStart = previousSection.finalFollowupClearDistance;
      const recoveryDistance = previewStart - recoveryStart;
      if (recoveryDistance >= MIN_RECOVERY_CUE_DISTANCE) {
        if (
          currentDistance >= recoveryStart &&
          currentDistance < previewStart
        ) {
          return {
            key: `${previousSection.id}:recovery`,
            kind: 'recovery',
            text: '本組跳躍已完成，恢復奔跑並留意下一組。',
          };
        }
      } else {
        previewStart = recoveryStart;
      }
    }

    const holdCueStart = section.holdStartDistance;

    if (currentDistance >= previewStart && currentDistance < holdCueStart) {
      return {
        key: `${section.id}:preview`,
        kind: 'preview',
        text: `第 ${section.sectionIndex + 1} 組：前方連續 ${section.archCount} 座低門；稍後按住滑行，最後一座通過後放開，再跳過${getJumpName(section.followupJumps[0]!)}。`,
      };
    }

    if (
      currentDistance >= holdCueStart &&
      currentDistance < section.lastArchClearDistance
    ) {
      return {
        key: `${section.id}:hold`,
        kind: 'hold',
        text: `現在按住滑行，連穿 ${section.archCount} 座低門；最後一座完全通過後放開。`,
      };
    }

    for (
      let jumpIndex = 0;
      jumpIndex < section.followupJumpContactDistances.length;
      jumpIndex += 1
    ) {
      const jumpType = section.followupJumps[jumpIndex]!;
      const contactDistance =
        section.followupJumpContactDistances[jumpIndex]!;
      const obstacle = getScheduledFollowup(obstacles, section, jumpIndex);
      const nextType = section.followupJumps[jumpIndex + 1];
      const nextObstacle =
        nextType === 'stump'
          ? getScheduledFollowup(obstacles, section, jumpIndex + 1)
          : undefined;

      if (
        nextObstacle &&
        nextType === 'stump' &&
        isDoubleJumpPair(level, obstacle, nextObstacle)
      ) {
        const pairKey = `${section.id}:double-jump-${jumpIndex + 1}`;
        const pairWindow = getDoubleJumpPairFirstWindow(
          level,
          obstacle,
          nextObstacle,
        );
        if (
          pairWindow &&
          currentDistance >= section.lastArchClearDistance &&
          currentDistance <
            pairWindow.startDistance - SEQUENCE_PREVIEW_LEAD_DISTANCE
        ) {
          return {
            key: `${section.id}:release`,
            kind: 'release',
            text: '最後一座低門已清空，現在放開滑行，準備連跳樹樁。',
          };
        }
        if (player?.slideHeld && currentDistance >= section.lastArchClearDistance) {
          return {
            key: `${section.id}:release`,
            kind: 'release',
            text: '連續樹樁需要跳躍，現在放開滑行。',
          };
        }

        const pairCue = getDoubleJumpPairCue(
          level,
          currentDistance,
          obstacle,
          nextObstacle,
          pairKey,
          player,
        );
        if (pairCue) {
          return pairCue;
        }
        jumpIndex += 1;
        continue;
      }

      if (jumpType === 'highStump') {
        const highCue = getHighStumpCue(
          level,
          currentDistance,
          obstacle,
          player,
        );
        if (highCue) {
          return highCue;
        }
        continue;
      }

      const cueWindow = getJumpCueWindow(
        level,
        jumpType,
        contactDistance,
        obstacle.width,
        currentDistance,
      );
      if (!cueWindow) {
        continue;
      }

      const jumpCueKey = `${section.id}:jump-${jumpIndex + 1}`;
      if (jumpIndex === 0) {
        if (
          currentDistance >= section.lastArchClearDistance &&
          currentDistance < cueWindow.startDistance
        ) {
          if (!player || player.slideHeld) {
            return {
              key: `${section.id}:release`,
              kind: 'release',
              text: `最後一座低門已清空，現在放開滑行，準備跳過${getJumpName(jumpType)}。`,
            };
          }

          if (isGroundedAndReadyToJump(player)) {
            return getPrepareCue(jumpCueKey, jumpType);
          }
        }
      }

      const stateAwareCue = getStateAwareJumpCue(
        level,
        currentDistance,
        obstacle,
        jumpCueKey,
        cueWindow,
        player,
        nextType,
      );
      if (stateAwareCue) {
        return stateAwareCue;
      }
      if (!isGroundedAndReadyToJump(player)) {
        continue;
      }

      if (jumpIndex > 0) {
        const previousJumpType = section.followupJumps[jumpIndex - 1]!;
        const previousJumpClearDistance =
          section.followupJumpContactDistances[jumpIndex - 1]! +
          OBSTACLE_WIDTHS[previousJumpType] +
          OBSTACLE_COLLISION_CLEARANCE;
        const prepareStart = Math.max(
          previousJumpClearDistance,
          contactDistance - JUMP_PREPARE_LEAD_DISTANCE,
        );

        if (
          currentDistance >= previousJumpClearDistance &&
          currentDistance < prepareStart
        ) {
          return {
            key: `${section.id}:recovery-${jumpIndex}`,
            kind: 'recovery',
            text: '本次跳躍已完成，恢復奔跑並留意下一個障礙。',
          };
        }

        if (
          currentDistance >= prepareStart &&
          currentDistance < cueWindow.startDistance
        ) {
          return getPrepareCue(jumpCueKey, jumpType);
        }
      }

      if (
        currentDistance >= cueWindow.startDistance &&
        currentDistance < cueWindow.endDistance
      ) {
        return getJumpCue(
          jumpCueKey,
          jumpType,
          player?.slideHeld ?? false,
        );
      }
    }

    if (
      sectionIndex === sections.length - 1 &&
      currentDistance >= section.finalFollowupClearDistance &&
      currentDistance < section.recoveryEndDistance
    ) {
      return {
        key: `${section.id}:recovery`,
        kind: 'recovery',
        text: '本組跳躍已完成，恢復奔跑並留意下一組。',
      };
    }
  }

  const preludeObstacles = obstacles.filter(
    (obstacle) => obstacle.patternRole === 'prelude',
  );
  const preludeGroups = new Map<string, ScheduledObstacle[]>();
  for (const prelude of preludeObstacles) {
    const group = preludeGroups.get(prelude.patternId) ?? [];
    group.push(prelude);
    preludeGroups.set(prelude.patternId, group);
  }

  for (const group of preludeGroups.values()) {
    const first = group[0]!;
    const second = group[1];
    if (
      second &&
      isDoubleJumpPair(level, first, second)
    ) {
      const pairCue = getDoubleJumpPairCue(
        level,
        currentDistance,
        first,
        second,
        first.patternId,
        player,
      );
      if (pairCue) {
        return pairCue;
      }
      continue;
    }

    for (const prelude of group) {
      if (prelude.type === 'highStump') {
        const highCue = getHighStumpCue(
          level,
          currentDistance,
          prelude,
          player,
        );
        if (highCue) {
          return highCue;
        }
        continue;
      }

      const cueStart =
        prelude.contactDistance - JUMP_PREPARE_LEAD_DISTANCE;
      const cueEnd =
        prelude.contactDistance +
        prelude.width +
        OBSTACLE_COLLISION_CLEARANCE;

      if (prelude.type === 'arch') {
        if (currentDistance >= cueStart && currentDistance < cueEnd) {
          return {
            key: `${prelude.patternId}:hold`,
            kind: 'hold',
            text: '前方低門，按住滑行通過。',
          };
        }

        continue;
      }

      const cueWindow = getJumpCueWindow(
        level,
        prelude.type,
        prelude.contactDistance,
        prelude.width,
        currentDistance,
      );
      if (!cueWindow) {
        continue;
      }

      const jumpCueKey = `${prelude.patternId}:jump`;
      const stateAwareCue = getStateAwareJumpCue(
        level,
        currentDistance,
        prelude,
        jumpCueKey,
        cueWindow,
        player,
      );
      if (stateAwareCue) {
        return stateAwareCue;
      }
      if (!isGroundedAndReadyToJump(player)) {
        continue;
      }

      if (
        currentDistance >= cueStart &&
        currentDistance < cueWindow.startDistance
      ) {
        return getPrepareCue(`${prelude.patternId}:prepare`, prelude.type);
      }

      if (
        currentDistance >= cueWindow.startDistance &&
        currentDistance < cueWindow.endDistance
      ) {
        return getJumpCue(jumpCueKey, prelude.type, false);
      }
    }
  }

  const lastSection = sections.at(-1);
  if (
    lastSection &&
    currentDistance >= lastSection.finalFollowupClearDistance &&
    currentDistance < level.distanceGoal - SAFE_FINISH_DISTANCE
  ) {
    return {
      key: `level-${level.id}:safe-finish`,
      kind: 'recovery',
      text: '前方路線清空，穩定奔跑至終點。',
    };
  }

  return null;
}
