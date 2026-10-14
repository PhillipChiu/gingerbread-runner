import { describe, expect, it } from 'vitest';
import {
  expandObstaclePattern,
  getObstacleCue,
  OBSTACLE_COLLISION_CLEARANCE,
  OBSTACLE_WIDTHS,
} from './obstaclePattern';
import { LEVELS } from './levels';
import {
  DOUBLE_JUMP_IMPULSE,
  getRunSpeed,
  getVerticalHeightAtTime,
  JUMP_GRAVITY,
  JUMP_IMPULSE,
} from './physics';

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

// A runner already in the air for one obstacle must not be told to spend the
// only airborne jump on it when the jump in progress already clears it and the
// gap or stump right next to it needs that jump instead. If the jump in
// progress touches down early enough that a runner who needs 200 ms to answer
// still takes off inside the next obstacle's ground-jump window, they are told
// to land first and then jump, and the second jump stays in reserve. The words
// are on screen 200 ms before that window opens, so answering them (or the
// touchdown) 200 ms later is never early. Level 11 is where the stump, gap,
// stump follow-up caught players out; the rule itself is shared.
describe('second-jump cues next to a gap', () => {
  type CuePlayer = NonNullable<Parameters<typeof getObstacleCue>[2]>;
  interface ShownCue {
    key: string;
    kind: string;
    text: string;
    firstDistance: number;
    lastDistance: number;
  }
  interface CueStretch {
    kind: string;
    text: string;
    from: number;
    to: number;
  }

  // The same words in the air and on the ground: touchdown must not swap in a
  // new instruction the runner would have to read and answer all over again.
  // They say "after landing", never "at once": how long after touchdown a jump
  // is safe depends on where the jump before it was taken.
  const LAND_FIRST_GAP = '先別在空中按跳，落地後再跳過裂隙。';
  const LAND_FIRST_STUMP = '先別在空中按跳，落地後再跳過樹樁。';
  const LAND_FIRST_PREFIX = '先別在空中按跳';
  // How long a runner is assumed to need to answer something they see, and the
  // longest frame the engine simulates (20 Hz): the cue code leaves one of
  // them for the frame the runner touches down in and one for the frame they
  // press in.
  const REACTION_SECONDS = 0.2;
  const SLOWEST_FRAME_SECONDS = 0.05;

  const level = LEVELS[10]!;
  const { sections } = expandObstaclePattern(level);
  const pairSection = sections[0]!;
  const gapStumpSection = sections[1]!;
  const stumpGapStumpSection = sections[2]!;
  const [firstStumpContact, gapContact, trailingContact] =
    stumpGapStumpSection.followupJumpContactDistances as [
      number,
      number,
      number,
    ];
  const jumpKey = (jumpNumber: number) =>
    `${stumpGapStumpSection.id}:jump-${jumpNumber}`;
  const grounded: CuePlayer = {
    jumpHeight: 0,
    jumpVelocity: 0,
    jumpsUsed: 0,
    slideHeld: false,
  };

  function groundCueAt(distance: number) {
    return getObstacleCue(level, distance, grounded);
  }

  /** Distances at which a grounded runner is told to jump for `cueKey`. */
  function groundJumpWindow(cueKey: string, contactDistance: number) {
    const distances: number[] = [];
    for (
      let distance = contactDistance - 400;
      distance < contactDistance;
      distance += 1
    ) {
      const cue = groundCueAt(distance);
      if (cue?.key === cueKey && cue.kind === 'jump') {
        distances.push(distance);
      }
    }
    return distances;
  }

  /**
   * What a grounded runner is shown for `cueKey` as the run goes on: one entry
   * for each stretch of distance over which the kind and words stay the same.
   */
  function groundCues(cueKey: string, contactDistance: number, step = 0.25) {
    const stretches: CueStretch[] = [];
    for (
      let distance = contactDistance - 500;
      distance < contactDistance;
      distance += step
    ) {
      const cue = groundCueAt(distance);
      if (cue?.key !== cueKey) {
        continue;
      }

      const last = stretches.at(-1);
      if (last?.kind === cue.kind && last.text === cue.text) {
        last.to = distance;
      } else {
        stretches.push({
          kind: cue.kind,
          text: cue.text,
          from: distance,
          to: distance,
        });
      }
    }
    return stretches;
  }

  /** Takeoffs near the start, middle and end of an ordinary jump window. */
  function takeoffsAcross(distances: number[]) {
    return [
      distances[7]!,
      distances[Math.floor(distances.length / 2)]!,
      distances[distances.length - 6]!,
    ];
  }

  /**
   * What a runner who pressed jump at `takeoffDistance` is shown until landing,
   * and where they land. With `secondJumpDistance` they also press the second
   * jump there, so the rest of the flight is shown with both jumps spent.
   */
  function jumpFrom(takeoffDistance: number, secondJumpDistance?: number) {
    const cues: ShownCue[] = [];
    // The arc is closed-form from the last launch: the takeoff, then the
    // second jump if there is one.
    let launchSeconds = 0;
    let launchHeight = 0;
    let launchVelocity = JUMP_IMPULSE;
    let jumpsUsed = 1;
    let seconds = 0;
    for (let distance = takeoffDistance + 1; ; distance += 1) {
      seconds += 1 / getRunSpeed(level, distance - 1);
      if (
        jumpsUsed === 1 &&
        secondJumpDistance !== undefined &&
        distance >= secondJumpDistance
      ) {
        launchHeight = getVerticalHeightAtTime(
          launchHeight,
          launchVelocity,
          seconds - launchSeconds,
        );
        launchVelocity = DOUBLE_JUMP_IMPULSE;
        launchSeconds = seconds;
        jumpsUsed = 2;
      }

      const elapsed = seconds - launchSeconds;
      const jumpHeight = getVerticalHeightAtTime(
        launchHeight,
        launchVelocity,
        elapsed,
      );
      if (jumpHeight <= 0) {
        return { cues, landing: distance };
      }

      const cue = getObstacleCue(level, distance, {
        jumpHeight,
        jumpVelocity: launchVelocity - JUMP_GRAVITY * elapsed,
        jumpsUsed,
        slideHeld: false,
      });
      if (!cue) {
        continue;
      }

      const last = cues.at(-1);
      if (last?.key === cue.key && last.kind === cue.kind) {
        last.lastDistance = distance;
      } else {
        cues.push({
          key: cue.key,
          kind: cue.kind,
          text: cue.text,
          firstDistance: distance,
          lastDistance: distance,
        });
      }
    }
  }

  const firstStumpWindow = groundJumpWindow(jumpKey(1), firstStumpContact);
  const gapWindow = groundJumpWindow(jumpKey(2), gapContact);
  const trailingWindow = groundJumpWindow(jumpKey(3), trailingContact);
  const gapOfGapStumpWindow = groundJumpWindow(
    `${gapStumpSection.id}:jump-1`,
    gapStumpSection.followupJumpContactDistances[0]!,
  );
  const flightsFrom = (takeoffs: number[]) =>
    takeoffs.map((takeoff) => ({ takeoff, ...jumpFrom(takeoff) }));
  const firstStumpFlights = flightsFrom(firstStumpWindow);
  const gapFlights = flightsFrom(gapWindow);
  const isToldToLandFirst = (cues: ShownCue[], nextCueKey: string) =>
    cues.some(
      ({ key, text }) =>
        key === nextCueKey && text.startsWith(LAND_FIRST_PREFIX),
    );
  // Takeoffs whose jump in progress is told to land first for what follows.
  const firstStumpTakeoffsToldToLandFirst = firstStumpFlights
    .filter(({ cues }) => isToldToLandFirst(cues, jumpKey(2)))
    .map(({ takeoff }) => takeoff);
  const gapTakeoffsToldToLandFirst = gapFlights
    .filter(({ cues }) => isToldToLandFirst(cues, jumpKey(3)))
    .map(({ takeoff }) => takeoff);
  // The gap takeoffs told to land first whose jump touches down before the
  // trailing stump window opens: the words are still `prepare` at touchdown.
  const gapTakeoffsLandingBeforeTrailingWindow = gapFlights
    .filter(
      ({ cues, landing }) =>
        isToldToLandFirst(cues, jumpKey(3)) && landing < trailingWindow[0]!,
    )
    .map(({ takeoff }) => takeoff);

  it('is the level 11 stump, gap, stump follow-up with ordinary jump windows', () => {
    expect(stumpGapStumpSection.id).toBe('level-11-section-3');
    expect(stumpGapStumpSection.followupJumps).toEqual([
      'stump',
      'gap',
      'stump',
    ]);
    expect(gapStumpSection.followupJumps).toEqual(['gap', 'stump']);
    expect(pairSection.followupJumps).toEqual(['stump', 'stump']);
    expect(firstStumpWindow.length).toBeGreaterThan(100);
    expect(gapWindow.length).toBeGreaterThan(100);
    expect(trailingWindow.length).toBeGreaterThan(100);
    expect(gapOfGapStumpWindow.length).toBeGreaterThan(100);
    expect(firstStumpTakeoffsToldToLandFirst.length).toBeGreaterThan(50);
    expect(gapTakeoffsToldToLandFirst.length).toBeGreaterThan(50);
  });

  it('keeps the same words on the ground for the whole window of each follow-up', () => {
    const wordsOver = (distances: number[]) => [
      ...new Set(distances.map((distance) => groundCueAt(distance)!.text)),
    ];

    expect(wordsOver(firstStumpWindow), 'the first stump').toEqual([
      '現在跳過樹樁。',
    ]);
    expect(wordsOver(gapWindow), 'the gap').toEqual([LAND_FIRST_GAP]);
    expect(wordsOver(trailingWindow), 'the trailing stump').toEqual([
      LAND_FIRST_STUMP,
    ]);
  });

  // The land-first words are on screen a reaction time before the window opens
  // and stay up, unchanged, until it closes. They are `prepare` while it is
  // shut and `jump` once it is open, so only the latter asks for a press the
  // moment it appears, and nobody who answers them 200 ms after seeing them
  // takes off early.
  it.each([
    ['the gap', 2, gapContact, LAND_FIRST_GAP],
    ['the trailing stump', 3, trailingContact, LAND_FIRST_STUMP],
  ] as const)(
    'shows the land-first words for %s 200 ms before its window opens and keeps them up',
    (_name, jumpNumber, contact, words) => {
      const step = 0.25;
      const stretches = groundCues(jumpKey(jumpNumber), contact, step).filter(
        ({ text }) => text === words,
      );

      expect(stretches.map(({ kind }) => kind)).toEqual(['prepare', 'jump']);
      const [wait, go] = stretches as [CueStretch, CueStretch];
      expect(wait.to + step, 'the words never leave the screen').toBe(go.from);
      expect(
        (go.from - wait.from) / getRunSpeed(level, go.from),
        'seconds on screen before the window opens',
      ).toBeCloseTo(REACTION_SECONDS, 2);
    },
  );

  it.each(takeoffsAcross(firstStumpWindow))(
    'never offers the first stump the second jump when a jump from %i already clears it',
    (takeoff) => {
      const { cues } = jumpFrom(takeoff);

      expect(
        cues.filter(({ key }) => key.startsWith(`${jumpKey(1)}:second`)),
      ).toEqual([]);
    },
  );

  it('lets a runner who lands before the gap window opens recover and then jump', () => {
    const { cues, landing } = jumpFrom(takeoffsAcross(firstStumpWindow)[0]!);

    expect(landing).toBeLessThan(gapWindow[0]!);
    expect(cues, 'nothing in the air invites a press').toEqual([]);
    expect(groundCueAt(landing)?.kind, 'no jump cue before the window').not.toBe(
      'jump',
    );
    expect(groundCueAt(gapWindow[0]!)).toMatchObject({
      key: jumpKey(2),
      kind: 'jump',
    });
  });

  // A jump that touches down a reaction time or more before the window opens
  // is told, in the air, to land first. The words stay on screen after
  // touchdown: `prepare` while the window is still shut.
  it.each(takeoffsAcross(firstStumpTakeoffsToldToLandFirst))(
    'tells a runner whose first stump jump from %i lands before the gap window to land first',
    (takeoff) => {
      const { cues, landing } = jumpFrom(takeoff);

      expect(landing).toBeLessThan(gapWindow[0]!);
      expect(cues, 'one cue from takeoff to landing').toEqual([
        expect.objectContaining({
          key: jumpKey(2),
          kind: 'prepare',
          text: LAND_FIRST_GAP,
        }),
      ]);
      expect(groundCueAt(landing), 'the same words on the ground').toMatchObject({
        key: jumpKey(2),
        kind: 'prepare',
        text: LAND_FIRST_GAP,
      });
      expect(
        groundCueAt(gapWindow[0]!),
        'asks for the press once the window is open',
      ).toMatchObject({ key: jumpKey(2), kind: 'jump', text: LAND_FIRST_GAP });
    },
  );

  // Land-first needs a reaction time and two slow frames of ground time inside
  // the window. A first stump jump taken so late that it touches down with less
  // than that left is not promised a landing jump, and nothing in the air asks
  // for a press: the second jump could not clear the gap from there anyway. The
  // window is still open when they land, so the ground says to jump.
  it('does not promise a landing jump when the first stump jump leaves too little of the gap window', () => {
    const { cues, landing } = jumpFrom(firstStumpWindow.at(-1)!);
    const speed = getRunSpeed(level, landing);

    expect(
      landing + speed * (REACTION_SECONDS + 2 * SLOWEST_FRAME_SECONDS),
      'touchdown, a reaction time and two 20 Hz frames is past the window',
    ).toBeGreaterThan(gapWindow.at(-1)! + 1);
    expect(
      cues.filter(({ text }) => text.startsWith(LAND_FIRST_PREFIX)),
      'never told to land first',
    ).toEqual([]);
    expect(
      cues.filter(({ kind }) => kind === 'jump' || kind === 'doubleJump'),
      'nothing in the air asks for a press',
    ).toEqual([]);
    expect(landing, 'back on the ground inside the window').toBeGreaterThanOrEqual(
      gapWindow[0]!,
    );
    expect(groundCueAt(landing)).toMatchObject({
      key: jumpKey(2),
      kind: 'jump',
      text: LAND_FIRST_GAP,
    });
  });

  it('lets a runner whose gap jump lands before the trailing stump window opens recover and then jump', () => {
    const { cues, landing } = jumpFrom(gapWindow[7]!);

    expect(landing).toBeLessThan(trailingWindow[0]!);
    expect(cues, 'nothing in the air invites a press').toEqual([]);
    expect(groundCueAt(landing)?.kind, 'no jump cue before the window').not.toBe(
      'jump',
    );
    expect(groundCueAt(trailingWindow[0]!)).toMatchObject({
      key: jumpKey(3),
      kind: 'jump',
    });
  });

  it.each(takeoffsAcross(gapTakeoffsLandingBeforeTrailingWindow))(
    'tells a runner whose jump from %i clears the gap to land first and jump the trailing stump',
    (takeoff) => {
      const { cues, landing } = jumpFrom(takeoff);

      expect(landing).toBeLessThan(trailingWindow[0]!);
      expect(cues, 'one cue from takeoff to landing').toEqual([
        expect.objectContaining({
          key: jumpKey(3),
          kind: 'prepare',
          text: LAND_FIRST_STUMP,
        }),
      ]);
      expect(groundCueAt(landing), 'the same words on the ground').toMatchObject(
        {
          key: jumpKey(3),
          kind: 'prepare',
          text: LAND_FIRST_STUMP,
        },
      );
      expect(
        groundCueAt(trailingWindow[0]!),
        'asks for the press once the window is open',
      ).toMatchObject({
        key: jumpKey(3),
        kind: 'jump',
        text: LAND_FIRST_STUMP,
      });
    },
  );

  // The gap's own jump taken as late as it can be touches down with the
  // trailing stump's window already open, so the words ask for the press from
  // the air, and the runner who answers them finds the window still open.
  it('asks for the trailing stump jump from the air when the gap jump lands inside its window', () => {
    const { cues, landing } = jumpFrom(gapWindow.at(-1)!);

    expect(landing).toBeGreaterThanOrEqual(trailingWindow[0]!);
    expect(landing).toBeLessThanOrEqual(trailingWindow.at(-1)!);
    expect(cues, 'one cue from takeoff to landing').toEqual([
      expect.objectContaining({
        key: jumpKey(3),
        kind: 'jump',
        text: LAND_FIRST_STUMP,
      }),
    ]);
    expect(groundCueAt(landing), 'the same words on the ground').toMatchObject({
      key: jumpKey(3),
      kind: 'jump',
      text: LAND_FIRST_STUMP,
    });
  });

  // Whatever the takeoff, the land-first words are never a promise the window
  // cannot keep: they are only shown when touchdown is no earlier than the
  // words would have been on screen for a reaction time before the window
  // opens, and when a runner who answers after a reaction time and two slow
  // frames (one to land in, one to press in) still finds the window open.
  it('only tells a runner in the air to land first when answering after touchdown still lands inside the window', () => {
    // The cue works out where the jump lands at the speed it has now, and the
    // speed still rises a little before touchdown, so allow a couple of pixels
    // (a few milliseconds) either way.
    const estimateSlackPx = 2;
    const violations: string[] = [];
    const counts = { told: 0, notTold: 0 };
    for (const { flights, nextKey, nextWindow } of [
      { flights: firstStumpFlights, nextKey: jumpKey(2), nextWindow: gapWindow },
      { flights: gapFlights, nextKey: jumpKey(3), nextWindow: trailingWindow },
    ]) {
      for (const { takeoff, cues, landing } of flights) {
        if (!isToldToLandFirst(cues, nextKey)) {
          counts.notTold += 1;
          continue;
        }

        counts.told += 1;
        const speed = getRunSpeed(level, landing);
        if (
          landing + speed * REACTION_SECONDS <
          nextWindow[0]! - estimateSlackPx
        ) {
          violations.push(`${takeoff}: told to land first too early`);
        }
        if (
          landing + speed * (REACTION_SECONDS + 2 * SLOWEST_FRAME_SECONDS) >
          nextWindow.at(-1)! + estimateSlackPx
        ) {
          violations.push(`${takeoff}: told to land first too late`);
        }
      }
    }

    expect(violations).toEqual([]);
    expect(counts.told, 'takeoffs told to land first').toBeGreaterThan(100);
    expect(counts.notTold, 'takeoffs not told to land first').toBeGreaterThan(
      100,
    );
  });

  it('still offers the second jump when the jump in progress would land in the stump', () => {
    const { cues } = jumpFrom(firstStumpWindow[0]! - 40);

    expect(cues).toContainEqual(
      expect.objectContaining({
        key: `${stumpGapStumpSection.id}:jump-1:second`,
        kind: 'doubleJump',
      }),
    );
  });

  it('still offers the second jump when the jump in progress would drop into the gap', () => {
    const { cues } = jumpFrom(gapOfGapStumpWindow[0]! - 40);

    expect(cues).toContainEqual(
      expect.objectContaining({
        key: `${gapStumpSection.id}:jump-1:second`,
        kind: 'doubleJump',
      }),
    );
  });

  it('leaves the stump pair its own second-jump cue', () => {
    const pairWindow = groundJumpWindow(
      `${pairSection.id}:double-jump-1:first`,
      pairSection.followupJumpContactDistances[0]!,
    );
    const { cues } = jumpFrom(takeoffsAcross(pairWindow)[1]!);

    expect(cues).toContainEqual(
      expect.objectContaining({
        key: `${pairSection.id}:double-jump-1:second`,
        kind: 'doubleJump',
      }),
    );
  });

  // The rule is shared, so the words in a follow-up's ground window are checked
  // on every level: next to a gap (the gap itself, or the follow-up right after
  // one) they are the land-first words the same follow-up shows in the air, and
  // everywhere else they are the plain instruction.
  it('shows the land-first words in a ground window only for follow-ups next to a gap', () => {
    const checked = { nextToGap: 0, plain: 0 };
    for (const other of LEVELS) {
      for (const section of expandObstaclePattern(other).sections) {
        section.followupJumps.forEach((jumpType, index) => {
          if (jumpType !== 'stump' && jumpType !== 'gap') {
            return;
          }

          const contact = section.followupJumpContactDistances[index]!;
          const key = `${section.id}:jump-${index + 1}`;
          const words = new Set<string>();
          for (
            let distance = contact - 400;
            distance < contact;
            distance += 2
          ) {
            const cue = getObstacleCue(other, distance, grounded);
            if (cue?.key === key && cue.kind === 'jump') {
              words.add(cue.text);
            }
          }
          if (words.size === 0) {
            // A stump pair answered by its own double-jump cue.
            return;
          }

          const name = jumpType === 'gap' ? '裂隙' : '樹樁';
          const nextToGap =
            index > 0 &&
            (jumpType === 'gap' || section.followupJumps[index - 1] === 'gap');
          checked[nextToGap ? 'nextToGap' : 'plain'] += 1;
          expect([...words], `${section.id} jump ${index + 1}`).toEqual([
            nextToGap
              ? `${LAND_FIRST_PREFIX}，落地後再跳過${name}。`
              : `現在跳過${name}。`,
          ]);
        });
      }
    }

    expect(checked.nextToGap).toBeGreaterThan(0);
    expect(checked.plain).toBeGreaterThan(0);
  });
});
