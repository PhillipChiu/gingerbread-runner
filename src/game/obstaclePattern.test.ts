import { describe, expect, it } from 'vitest';
import {
  expandObstaclePattern,
  getObstacleCue,
  OBSTACLE_COLLISION_CLEARANCE,
  OBSTACLE_WIDTHS,
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
    atProgress: [0.32, 0.68],
    archCount: 3,
    archPitchPx: 165,
    releaseToJumpPx: 500,
    followupJumps: [['stump'], ['stump']],
    jumpPairClearancePx: 0,
    recoveryPx: 650,
    prelude: [
      { atProgress: 0.08, type: 'stump' },
      { atProgress: 0.08, type: 'stump' },
    ],
  },
  {
    atProgress: [0.22, 0.62],
    archCount: 4,
    archPitchPx: 158,
    releaseToJumpPx: 480,
    followupJumps: [['stump'], ['stump', 'stump']],
    jumpPairClearancePx: 20,
    recoveryPx: 620,
  },
  {
    atProgress: [0.2, 0.62],
    archCount: 4,
    archPitchPx: 150,
    releaseToJumpPx: 460,
    followupJumps: [['stump'], ['stump', 'stump']],
    jumpPairClearancePx: 24,
    recoveryPx: 600,
  },
  {
    atProgress: [0.16, 0.44, 0.72],
    archCount: 5,
    archPitchPx: 145,
    releaseToJumpPx: 460,
    followupJumps: [['stump'], ['stump'], ['stump', 'stump']],
    jumpPairClearancePx: 30,
    recoveryPx: 600,
  },
  {
    atProgress: [0.15, 0.44, 0.73],
    archCount: 5,
    archPitchPx: 140,
    releaseToJumpPx: 440,
    followupJumps: [['stump'], ['stump'], ['stump', 'stump']],
    jumpPairClearancePx: 34,
    recoveryPx: 580,
  },
  {
    atProgress: [0.15, 0.44, 0.73],
    archCount: 6,
    archPitchPx: 134,
    releaseToJumpPx: 430,
    followupJumps: [['stump'], ['stump', 'stump'], ['gap']],
    jumpPairClearancePx: 42,
    recoveryPx: 560,
  },
  {
    atProgress: [0.15, 0.44, 0.73],
    archCount: 6,
    archPitchPx: 128,
    releaseToJumpPx: 430,
    followupJumps: [['stump', 'stump'], ['gap'], ['stump', 'gap']],
    jumpPairClearancePx: 55,
    recoveryPx: 560,
    prelude: [{ atProgress: 0.075, type: 'highStump' }],
  },
  {
    atProgress: [0.12, 0.33, 0.54, 0.74],
    archCount: 7,
    archPitchPx: 124,
    releaseToJumpPx: 420,
    followupJumps: [['stump', 'stump'], ['stump'], ['gap'], ['gap', 'stump']],
    jumpPairClearancePx: 68,
    recoveryPx: 540,
    prelude: [{ atProgress: 0.06, type: 'highStump' }],
  },
  {
    atProgress: [0.12, 0.33, 0.54, 0.73],
    archCount: 8,
    archPitchPx: 118,
    releaseToJumpPx: 420,
    followupJumps: [['stump'], ['gap'], ['stump', 'gap'], ['gap', 'stump']],
    jumpPairClearancePx: 560,
    recoveryPx: 540,
    prelude: [{ atProgress: 0.06, type: 'highStump' }],
  },
];

describe('deterministic obstacle patterns', () => {
  it('preserves each UIUX section count, anchor, pitch, release and jump sequence', () => {
    expect(LEVELS).toHaveLength(20);

    LEVELS.slice(0, EXPECTED_DESIGNS.length).forEach((level, levelIndex) => {
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

  it('expands ten increasingly paced advanced stages with high-stump and jump routes', () => {
    const advancedLevels = LEVELS.slice(10);

    expect(advancedLevels).toHaveLength(10);
    advancedLevels.forEach((level, index) => {
      const previous = LEVELS[index + 9]!;
      const expanded = expandObstaclePattern(level);

      expect(level.id).toBe(index + 11);
      expect(level.distanceGoal).toBeGreaterThan(previous.distanceGoal);
      expect(level.baseSpeed).toBeGreaterThan(previous.baseSpeed);
      expect(level.obstacleInterval).toBeLessThan(previous.obstacleInterval);
      expect(level.obstaclePattern.prelude[0]).toMatchObject({
        atProgress: 0.05,
        type: 'highStump',
      });
      expect(expanded.obstacles.some(({ type }) => type === 'highStump')).toBe(
        true,
      );
      expect(expanded.obstacles.some(({ type }) => type === 'gap')).toBe(true);
      expect(expanded.sections).toHaveLength(index < 5 ? 4 : 5);
    });
  });

  it('teaches a clean L2 double jump and reserves the first high stump for L8', () => {
    const firstLevel = LEVELS[0]!;
    const tutorialLevel = LEVELS[1]!;
    const tutorialPair = expandObstaclePattern(tutorialLevel).obstacles.filter(
      (obstacle) => obstacle.patternRole === 'prelude',
    );

    expect(firstLevel.obstaclePattern.prelude).toHaveLength(1);
    expect(tutorialLevel.description).toContain('二段跳');
    expect(tutorialLevel.obstaclePattern.prelude.map(({ type }) => type)).toEqual(
      ['stump', 'stump'],
    );
    expect(tutorialPair).toHaveLength(2);
    expect(tutorialPair[0]!.patternId).toBe(tutorialPair[1]!.patternId);
    expect(
      tutorialPair[1]!.contactDistance -
        tutorialPair[0]!.contactDistance -
        OBSTACLE_WIDTHS.stump -
        OBSTACLE_COLLISION_CLEARANCE,
    ).toBe(20);
    expect(
      expandObstaclePattern(tutorialLevel).sections[0]!.firstArchContactDistance -
        650,
    ).toBeGreaterThan(
      tutorialPair[1]!.contactDistance +
        OBSTACLE_WIDTHS.stump +
        OBSTACLE_COLLISION_CLEARANCE +
        200,
    );

    const firstHighStumpLevel = LEVELS.find((level) =>
      level.obstaclePattern.prelude.some(
        ({ type }) => type === 'highStump',
      ),
    );
    const firstHighStump = expandObstaclePattern(LEVELS[7]!).obstacles.find(
      (obstacle) => obstacle.type === 'highStump',
    );

    expect(firstHighStumpLevel?.id).toBe(8);
    expect(firstHighStump).toMatchObject({
      type: 'highStump',
      width: 42,
      patternRole: 'prelude',
    });
    expect(
      expandObstaclePattern(LEVELS[7]!).sections[0]!.firstArchContactDistance -
        650,
    ).toBeGreaterThan(
      firstHighStump!.contactDistance +
        OBSTACLE_WIDTHS.highStump +
        OBSTACLE_COLLISION_CLEARANCE +
        200,
    );

    for (const level of LEVELS.slice(2, 7)) {
      expect(
        level.obstaclePattern.slideSections.some((section) =>
          section.followupJumps.some(
            (type, index, jumps) =>
              type === 'stump' && jumps[index + 1] === 'stump',
          ),
        ),
      ).toBe(true);
    }
  });

  it('expands every configured obstacle into ordered collision-distance geometry', () => {
    LEVELS.forEach((level) => {
      const expanded = expandObstaclePattern(level);
      const widths = { arch: 82, highStump: 42, stump: 58, gap: 88 };

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

  it('keeps preparation and release cues until physics-based jump cues are actionable', () => {
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
        const firstPairStartsWithDoubleJump =
          section.followupJumps[0] === 'stump' &&
          section.followupJumps[1] === 'stump';
        expect(
          getObstacleCue(
            level,
            section.lastArchClearDistance,
            {
              jumpHeight: 0,
              jumpVelocity: 0,
              jumpsUsed: 0,
              slideHeld: true,
            },
          )?.kind,
        ).toBe('release');
        if (!firstPairStartsWithDoubleJump) {
          expect(
            getObstacleCue(level, section.lastArchClearDistance)?.kind,
          ).toBe('release');
        }
        const cueKind = getObstacleCue(
          level,
          section.followupJumpContactDistances[0]! - 300,
        )?.kind;
        expect(
          section.followupJumps[0] === 'stump' &&
            section.followupJumps[1] === 'stump'
            ? ['prepare', 'jump']
            : ['release', 'jump'],
        ).toContain(cueKind);
      }
    });
  });

  it('prepares the tutorial jump early but says jump only inside its safe takeoff window', () => {
    const level = LEVELS[0]!;
    const tutorialStump = expandObstaclePattern(level).obstacles.find(
      (obstacle) => obstacle.patternRole === 'prelude',
    )!;
    const preparation = getObstacleCue(
      level,
      tutorialStump.contactDistance - 300,
    );

    expect(preparation).toMatchObject({ kind: 'prepare' });
    expect(preparation?.text).toContain('準備跳躍');
    expect(preparation?.text).not.toContain('現在跳');

    const maximumSpeedLevel = {
      ...level,
      baseSpeed: level.baseSpeed + level.speedRamp,
      speedRamp: 0,
    };
    const maximumSpeedStump = expandObstaclePattern(maximumSpeedLevel).obstacles.find(
      (obstacle) => obstacle.patternRole === 'prelude',
    )!;

    expect(
      getObstacleCue(
        maximumSpeedLevel,
        maximumSpeedStump.contactDistance - 300,
      )?.kind,
    ).not.toBe('jump');
    expect(
      getObstacleCue(
        maximumSpeedLevel,
        maximumSpeedStump.contactDistance - 92,
      )?.kind,
    ).toBe('jump');
    expect(
      getObstacleCue(
        maximumSpeedLevel,
        maximumSpeedStump.contactDistance - 18,
      )?.kind,
    ).toBe('jump');
    expect(
      getObstacleCue(
        maximumSpeedLevel,
        maximumSpeedStump.contactDistance - 17,
      )?.kind,
    ).not.toBe('jump');
  });

  it('matches ordinary stump cues to grounded, airborne, spent, and slide-held player states', () => {
    const level = LEVELS[0]!;
    const { obstacles } = expandObstaclePattern(level);
    const preludeStump = obstacles.find(
      (obstacle) => obstacle.patternRole === 'prelude',
    )!;
    const followupStump = obstacles.find(
      (obstacle) => obstacle.patternRole === 'followup',
    )!;
    const targets = [
      {
        obstacle: preludeStump,
        cueKey: `${preludeStump.patternId}:jump`,
      },
      {
        obstacle: followupStump,
        cueKey: `${followupStump.patternId}:jump-1`,
      },
    ];

    for (const { obstacle, cueKey } of targets) {
      const distance = obstacle.contactDistance - 40;
      const groundedCue = getObstacleCue(level, distance, {
        jumpHeight: 0,
        jumpVelocity: 0,
        jumpsUsed: 0,
        slideHeld: false,
      });
      expect(groundedCue).toMatchObject({ key: cueKey, kind: 'jump' });

      const airborneCue = getObstacleCue(level, distance, {
        jumpHeight: 100,
        jumpVelocity: 200,
        jumpsUsed: 1,
        slideHeld: false,
      });
      expect(airborneCue).toMatchObject({
        key: `${cueKey}:second`,
        kind: 'doubleJump',
      });
      expect(airborneCue?.text).toContain('空中再按一次二段跳');

      const spentCue = getObstacleCue(level, distance, {
        jumpHeight: 100,
        jumpVelocity: 200,
        jumpsUsed: 2,
        slideHeld: false,
      });
      expect(spentCue).toBeNull();

      const slideHeldCue = getObstacleCue(level, distance, {
        jumpHeight: 0,
        jumpVelocity: 0,
        jumpsUsed: 0,
        slideHeld: true,
      });
      expect(slideHeldCue).toMatchObject({
        key: `${cueKey}:release`,
        kind: 'release',
      });
      expect(slideHeldCue?.text).toContain('放開滑行');
    }
  });

  it('keeps every maximum-speed jump cue actionable beyond one snapshot interval', () => {
    LEVELS.forEach((level) => {
      const fastestSpeed = level.baseSpeed + level.speedRamp;
      const maximumSpeedLevel = {
        ...level,
        baseSpeed: fastestSpeed,
        speedRamp: 0,
      };
      const { sections } = expandObstaclePattern(maximumSpeedLevel);

      sections.forEach((section) => {
        for (
          let jumpIndex = 0;
          jumpIndex < section.followupJumps.length;
          jumpIndex += 1
        ) {
          const jumpType = section.followupJumps[jumpIndex]!;
          const contactDistance =
            section.followupJumpContactDistances[jumpIndex]!;
          const nextType = section.followupJumps[jumpIndex + 1];

          if (
            jumpType === 'stump' &&
            nextType === 'stump'
          ) {
            const cueKey =
              `${section.id}:double-jump-${jumpIndex + 1}:first`;
            const actionableCues = Array.from(
              { length: 800 },
              (_, offset) =>
                getObstacleCue(
                  maximumSpeedLevel,
                  contactDistance - 800 + offset,
                ),
            ).filter((cue) => cue?.key === cueKey && cue.kind === 'jump');

            expect(actionableCues.length / fastestSpeed).toBeGreaterThan(
              0.12,
            );
            expect(actionableCues[0]?.text).toContain('第一座樹樁');
            jumpIndex += 1;
            continue;
          }

          const cueKey = `${section.id}:jump-${jumpIndex + 1}`;
          const sampledCues = Array.from(
            { length: 300 },
            (_, offset) =>
              getObstacleCue(
                maximumSpeedLevel,
                contactDistance - 300 + offset,
              ),
          );
          const actionableCues = sampledCues.filter(
            (cue) => cue?.key === cueKey && cue.kind === 'jump',
          );

          expect(actionableCues.length / fastestSpeed).toBeGreaterThan(0.12);
          expect(actionableCues[0]?.text).toContain(
            jumpType === 'gap' ? '裂隙' : '樹樁',
          );

        }
      });
    });
  });

  it('hands L10’s brief third-to-fourth transition directly to a stable preview', () => {
    const level = LEVELS[9]!;
    const { sections } = expandObstaclePattern(level);
    const thirdSection = sections[2]!;
    const fourthSection = sections[3]!;
    const normalPreviewStart =
      fourthSection.firstArchContactDistance - 650;

    expect(
      fourthSection.firstArchContactDistance -
        thirdSection.finalFollowupClearDistance,
    ).toBe(692);
    expect(
      normalPreviewStart - thirdSection.finalFollowupClearDistance,
    ).toBe(42);

    const handoffCue = getObstacleCue(
      level,
      thirdSection.finalFollowupClearDistance,
    );
    const followingSnapshotCue = getObstacleCue(
      level,
      thirdSection.finalFollowupClearDistance + 53,
    );

    expect(handoffCue).toMatchObject({
      key: `${fourthSection.id}:preview`,
      kind: 'preview',
    });
    expect(handoffCue?.text).toContain('第 4 組');
    expect(followingSnapshotCue).toMatchObject({
      key: `${fourthSection.id}:preview`,
      kind: 'preview',
    });
  });
});
