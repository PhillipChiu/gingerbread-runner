import type {
  FollowupJumpType,
  LevelConfig,
  PatternObstacleType,
  SlideSectionPattern,
} from './levels';

export const OBSTACLE_WIDTHS: Readonly<Record<PatternObstacleType, number>> = {
  arch: 82,
  stump: 58,
  gap: 88,
};

export const PLAYER_COLLISION_WIDTH = 59;
export const OBSTACLE_COLLISION_CLEARANCE = PLAYER_COLLISION_WIDTH;
export const SLIDE_HOLD_LEAD_DISTANCE = 300;
export const SECTION_PREVIEW_LEAD_DISTANCE = 650;
export const SAFE_FINISH_DISTANCE = 650;

export type ObstaclePatternRole = 'prelude' | 'arch' | 'followup';

export interface ScheduledObstacle {
  type: PatternObstacleType;
  width: number;
  contactDistance: number;
  patternId: string;
  patternRole: ObstaclePatternRole;
  patternIndex: number;
  patternCount: number;
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
}

export type ObstacleCueKind =
  | 'prelude'
  | 'preview'
  | 'hold'
  | 'release'
  | 'jump'
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
): ScheduledObstacle {
  return {
    type,
    width: OBSTACLE_WIDTHS[type],
    contactDistance,
    patternId,
    patternRole,
    patternIndex,
    patternCount,
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

  const obstacles: ScheduledObstacle[] = level.obstaclePattern.prelude.map(
    (pattern, index, prelude) =>
      obstacle(
        pattern.type,
        progressToDistance(pattern.atProgress, level.distanceGoal),
        `level-${level.id}-prelude-${index + 1}`,
        'prelude',
        index + 1,
        prelude.length,
      ),
  );

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
  const expanded = { obstacles, sections };
  expandedPatternCache.set(level, expanded);
  return expanded;
}

function getJumpName(type: FollowupJumpType): string {
  return type === 'gap' ? '裂隙' : '樹樁';
}

export function getObstacleCue(
  level: LevelConfig,
  distance: number,
): ObstacleCue | null {
  const { obstacles, sections } = expandObstaclePattern(level);
  const currentDistance = Math.max(0, distance);

  for (const section of sections) {
    const previewStart =
      section.firstArchContactDistance - SECTION_PREVIEW_LEAD_DISTANCE;
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

    const firstJumpCueStart =
      section.followupJumpContactDistances[0]! -
      SLIDE_HOLD_LEAD_DISTANCE;
    if (
      currentDistance >= section.lastArchClearDistance &&
      currentDistance < firstJumpCueStart
    ) {
      return {
        key: `${section.id}:release`,
        kind: 'release',
        text: `最後一座低門已清空，現在放開滑行，準備跳過${getJumpName(section.followupJumps[0]!)}。`,
      };
    }

    for (
      let jumpIndex = 0;
      jumpIndex < section.followupJumpContactDistances.length;
      jumpIndex += 1
    ) {
      const cueStart =
        section.followupJumpContactDistances[jumpIndex]! -
        SLIDE_HOLD_LEAD_DISTANCE;
      const nextCueStart =
        section.followupJumpContactDistances[jumpIndex + 1] === undefined
          ? section.finalFollowupClearDistance
          : section.followupJumpContactDistances[jumpIndex + 1]! -
            SLIDE_HOLD_LEAD_DISTANCE;

      if (currentDistance >= cueStart && currentDistance < nextCueStart) {
        const jumpType = section.followupJumps[jumpIndex]!;
        return {
          key: `${section.id}:jump-${jumpIndex + 1}`,
          kind: 'jump',
          text: `現在跳過${getJumpName(jumpType)}。放開滑行後，按跳躍越過前方障礙。`,
        };
      }
    }

    const nextSection = sections[section.sectionIndex + 1];
    if (
      currentDistance >= section.finalFollowupClearDistance &&
      currentDistance < section.recoveryEndDistance &&
      (!nextSection ||
        currentDistance <
          nextSection.firstArchContactDistance -
            SECTION_PREVIEW_LEAD_DISTANCE)
    ) {
      return {
        key: `${section.id}:recovery`,
        kind: 'recovery',
        text: '本組跳躍已完成，恢復奔跑並留意下一組。',
      };
    }
  }

  for (const prelude of obstacles) {
    const cueStart = prelude.contactDistance - SLIDE_HOLD_LEAD_DISTANCE;
    const cueEnd =
      prelude.contactDistance +
      prelude.width +
      OBSTACLE_COLLISION_CLEARANCE;
    if (currentDistance >= cueStart && currentDistance < cueEnd) {
      const action =
        prelude.type === 'arch'
          ? '按住滑行'
          : '現在跳躍';
      const obstacleName =
        prelude.type === 'gap'
          ? '裂隙'
          : prelude.type === 'stump'
            ? '樹樁'
            : '低門';
      return {
        key: `${prelude.patternId}:cue`,
        kind: 'prelude',
        text: `前方${obstacleName}，${action}通過。`,
      };
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
