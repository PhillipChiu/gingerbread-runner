import { describe, expect, it } from 'vitest';
import {
  expandObstaclePattern,
  getObstacleCue,
  OBSTACLE_COLLISION_CLEARANCE,
} from './obstaclePattern';
import { LEVELS } from './levels';

const EXPECTED_DESIGNS = [
  {
    atProgress: [0.26],
    archCount: 2,
    archPitchPx: 170,
    releaseToJumpPx: 520,
    followupJumps: [['stump']],
    jumpPairClearancePx: 0,
    recoveryPx: 650,
    prelude: [{ atProgress: 0.08, type: 'stump' }],
  },
  {
    atProgress: [0.22, 0.62],
    archCount: 3,
    archPitchPx: 165,
    releaseToJumpPx: 500,
    followupJumps: [['stump'], ['stump']],
    jumpPairClearancePx: 0,
    recoveryPx: 650,
  },
  {
    atProgress: [0.22, 0.62],
    archCount: 4,
    archPitchPx: 158,
    releaseToJumpPx: 480,
    followupJumps: [['stump'], ['stump']],
    jumpPairClearancePx: 0,
    recoveryPx: 620,
  },
  {
    atProgress: [0.2, 0.62],
    archCount: 4,
    archPitchPx: 150,
    releaseToJumpPx: 460,
    followupJumps: [['stump'], ['stump']],
    jumpPairClearancePx: 0,
    recoveryPx: 600,
  },
  {
    atProgress: [0.16, 0.44, 0.72],
    archCount: 5,
    archPitchPx: 145,
    releaseToJumpPx: 460,
    followupJumps: [['stump'], ['stump'], ['stump', 'stump']],
    jumpPairClearancePx: 600,
    recoveryPx: 600,
  },
  {
    atProgress: [0.15, 0.44, 0.73],
    archCount: 5,
    archPitchPx: 140,
    releaseToJumpPx: 440,
    followupJumps: [['stump'], ['stump'], ['stump']],
    jumpPairClearancePx: 0,
    recoveryPx: 580,
  },
  {
    atProgress: [0.15, 0.44, 0.73],
    archCount: 6,
    archPitchPx: 134,
    releaseToJumpPx: 430,
    followupJumps: [['stump'], ['stump', 'stump'], ['gap']],
    jumpPairClearancePx: 580,
    recoveryPx: 560,
  },
  {
    atProgress: [0.15, 0.44, 0.73],
    archCount: 6,
    archPitchPx: 128,
    releaseToJumpPx: 430,
    followupJumps: [['stump'], ['gap'], ['stump', 'gap']],
    jumpPairClearancePx: 580,
    recoveryPx: 560,
  },
  {
    atProgress: [0.12, 0.33, 0.54, 0.74],
    archCount: 7,
    archPitchPx: 124,
    releaseToJumpPx: 420,
    followupJumps: [['stump'], ['stump'], ['gap'], ['gap', 'stump']],
    jumpPairClearancePx: 560,
    recoveryPx: 540,
  },
  {
    atProgress: [0.12, 0.33, 0.54, 0.73],
    archCount: 8,
    archPitchPx: 118,
    releaseToJumpPx: 420,
    followupJumps: [['stump'], ['gap'], ['stump', 'gap'], ['gap', 'stump']],
    jumpPairClearancePx: 560,
    recoveryPx: 540,
  },
];

describe('deterministic obstacle patterns', () => {
  it('preserves each UIUX section count, anchor, pitch, release and jump sequence', () => {
    expect(LEVELS).toHaveLength(EXPECTED_DESIGNS.length);

    LEVELS.forEach((level, levelIndex) => {
      const expected = EXPECTED_DESIGNS[levelIndex]!;
      const config = level.obstaclePattern;

      expect(config.slideSections).toHaveLength(expected.atProgress.length);
      expect(config.slideSections.map((section) => section.atProgress)).toEqual(
        expected.atProgress,
      );
      expect(
        config.slideSections.map((section) => section.archCount),
      ).toEqual(expected.atProgress.map(() => expected.archCount));
      expect(
        config.slideSections.map((section) => section.archPitchPx),
      ).toEqual(expected.atProgress.map(() => expected.archPitchPx));
      expect(
        config.slideSections.map((section) => section.releaseToJumpPx),
      ).toEqual(expected.atProgress.map(() => expected.releaseToJumpPx));
      expect(config.slideSections.map((section) => section.followupJumps)).toEqual(
        expected.followupJumps,
      );
      expect(
        config.slideSections.map((section) => section.jumpPairClearancePx),
      ).toEqual(expected.atProgress.map(() => expected.jumpPairClearancePx));
      expect(
        config.slideSections.map((section) => section.recoveryPx),
      ).toEqual(expected.atProgress.map(() => expected.recoveryPx));
      expect(config.prelude.map(({ atProgress, type }) => ({ atProgress, type }))).toEqual(
        expected.prelude ?? [],
      );
    });
  });

  it('expands every configured obstacle into ordered collision-distance geometry', () => {
    LEVELS.forEach((level) => {
      const expanded = expandObstaclePattern(level);
      const widths = { arch: 82, stump: 58, gap: 88 };

      expect(expanded.obstacles.length).toBeGreaterThan(0);
      expect(
        expanded.obstacles.map((obstacle) => obstacle.contactDistance),
      ).toEqual(
        [...expanded.obstacles]
          .map((obstacle) => obstacle.contactDistance)
          .sort((left, right) => left - right),
      );
      for (const obstacle of expanded.obstacles) {
        expect(obstacle.width).toBe(widths[obstacle.type]);
        expect(obstacle.patternId).toBeTruthy();
        expect(obstacle.patternIndex).toBeGreaterThan(0);
        expect(obstacle.patternCount).toBeGreaterThanOrEqual(
          obstacle.patternIndex,
        );
      }

      expanded.sections.forEach((section, sectionIndex) => {
        const group = expanded.obstacles.filter(
          (obstacle) => obstacle.patternId === section.id,
        );
        const arches = group.filter((obstacle) => obstacle.patternRole === 'arch');
        const jumps = group.filter(
          (obstacle) => obstacle.patternRole === 'followup',
        );

        expect(section.firstArchContactDistance).toBe(
          section.requestedContactDistance,
        );
        expect(section.firstArchContactDistance).toBe(
          Math.round(section.atProgress * level.distanceGoal),
        );
        expect(section.holdStartDistance).toBe(
          section.firstArchContactDistance - 300,
        );
        expect(arches).toHaveLength(section.archCount);
        expect(jumps.map((obstacle) => obstacle.type)).toEqual(
          section.followupJumps,
        );
        expect(arches.map((obstacle) => obstacle.width)).toEqual(
          arches.map(() => 82),
        );
        expect(arches.map((obstacle) => obstacle.patternIndex)).toEqual(
          arches.map((_, index) => index + 1),
        );
        expect(arches.map((obstacle) => obstacle.patternCount)).toEqual(
          arches.map(() => section.archCount),
        );
        expect(
          arches.slice(1).map((obstacle, index) =>
            obstacle.contactDistance - arches[index]!.contactDistance,
          ),
        ).toEqual(arches.slice(1).map(() => section.archPitchPx));

        const lastArch = arches.at(-1)!;
        expect(section.lastArchClearDistance).toBe(
          lastArch.contactDistance + lastArch.width + OBSTACLE_COLLISION_CLEARANCE,
        );
        expect(jumps[0]!.contactDistance - section.lastArchClearDistance).toBe(
          section.releaseToJumpPx,
        );
        expect(jumps.map((obstacle) => obstacle.patternIndex)).toEqual(
          jumps.map((_, index) => index + 1),
        );
        expect(jumps.map((obstacle) => obstacle.patternCount)).toEqual(
          jumps.map(() => jumps.length),
        );

        for (let index = 1; index < jumps.length; index += 1) {
          const previous = jumps[index - 1]!;
          const current = jumps[index]!;
          expect(
            current.contactDistance -
              previous.contactDistance -
              previous.width -
              OBSTACLE_COLLISION_CLEARANCE,
          ).toBe(section.jumpPairClearancePx);
        }

        const finalJump = jumps.at(-1)!;
        expect(section.finalFollowupClearDistance).toBe(
          finalJump.contactDistance +
            finalJump.width +
            OBSTACLE_COLLISION_CLEARANCE,
        );

        const nextSection = expanded.sections[sectionIndex + 1];
        if (nextSection) {
          expect(
            nextSection.firstArchContactDistance -
              section.finalFollowupClearDistance,
          ).toBeGreaterThanOrEqual(section.recoveryPx);
        }
      });

      const lastObstacle = expanded.obstacles.at(-1)!;
      expect(
        level.distanceGoal -
          lastObstacle.contactDistance -
          lastObstacle.width -
          OBSTACLE_COLLISION_CLEARANCE,
      ).toBeGreaterThanOrEqual(650);
    });
  });

  it('places the tutorial stump before stage one and preserves at least 650px after it', () => {
    const level = LEVELS[0]!;
    const expanded = expandObstaclePattern(level);
    const prelude = expanded.obstacles.filter(
      (obstacle) => obstacle.patternRole === 'prelude',
    );

    expect(prelude).toHaveLength(1);
    expect(prelude[0]).toMatchObject({
      type: 'stump',
      width: 58,
      contactDistance: Math.round(level.distanceGoal * 0.08),
    });
    expect(prelude[0]!.contactDistance).toBeLessThan(
      expanded.sections[0]!.holdStartDistance,
    );
  });

  it('gives speed-maximum-aware preview, hold, release and jump cues', () => {
    LEVELS.forEach((level) => {
      const { sections } = expandObstaclePattern(level);
      const fastestSpeed = level.baseSpeed + level.speedRamp;

      for (const section of sections) {
        const holdDistance =
          section.lastArchClearDistance - section.holdStartDistance;
        expect(holdDistance).toBe(
          (section.archCount - 1) * section.archPitchPx + 82 + 59 + 300,
        );
        expect(holdDistance / fastestSpeed).toBeCloseTo(
          ((section.archCount - 1) * section.archPitchPx + 82 + 59 + 300) /
            fastestSpeed,
        );
        expect(
          getObstacleCue(level, section.firstArchContactDistance - 650)?.kind,
        ).toBe('preview');
        expect(
          getObstacleCue(level, section.holdStartDistance)?.kind,
        ).toBe('hold');
        expect(
          getObstacleCue(level, section.lastArchClearDistance)?.kind,
        ).toBe('release');
        expect(
          getObstacleCue(
            level,
            section.followupJumpContactDistances[0]! - 300,
          )?.kind,
        ).toBe('jump');
      }
    });
  });
});
