export interface LevelPalette {
  skyTop: string;
  skyBottom: string;
  sun: string;
  backHill: string;
  frontHill: string;
  ground: string;
  groundLight: string;
  accent: string;
}

export type PatternObstacleType = 'stump' | 'highStump' | 'arch' | 'gap';
export type FollowupJumpType = 'stump' | 'highStump' | 'gap';

export interface PreludeObstaclePattern {
  atProgress: number;
  type: PatternObstacleType;
  sequenceId?: string;
  afterPreviousClearancePx?: number;
}

export interface SlideSectionPattern {
  atProgress: number;
  archCount: number;
  archPitchPx: number;
  releaseToJumpPx: number;
  followupJumps: readonly FollowupJumpType[];
  jumpPairClearancePx: number;
  recoveryPx: number;
}

export interface ObstaclePattern {
  prelude: readonly PreludeObstaclePattern[];
  slideSections: readonly SlideSectionPattern[];
}

export interface LevelConfig {
  id: number;
  name: string;
  region: string;
  description: string;
  distanceGoal: number;
  baseSpeed: number;
  speedRamp: number;
  obstacleInterval: number;
  pickupInterval: number;
  gapChance: number;
  difficulty: number;
  obstaclePattern: ObstaclePattern;
  palette: LevelPalette;
}

interface AdvancedLevelDesign {
  name: string;
  region: string;
  description: string;
  distanceGoal: number;
  baseSpeed: number;
  speedRamp: number;
  obstacleInterval: number;
  pickupInterval: number;
  gapChance: number;
  pairGapPx: number;
  /**
   * Follow-up spacing for single slide sections, keyed by zero-based section
   * index, where it has to differ from the level's `pairGapPx`.
   */
  sectionPairGapPx?: Readonly<Record<number, number>>;
  archCount: number;
  archPitchPx: number;
  recoveryPx: number;
  sectionCount: 4 | 5;
  palette: LevelPalette;
}

const ADVANCED_FOLLOWUP_PATTERNS: readonly (readonly FollowupJumpType[])[] = [
  ['stump', 'stump'],
  ['gap', 'stump'],
  ['stump', 'gap', 'stump'],
  ['gap'],
  ['stump', 'stump', 'gap'],
];

const ADVANCED_LEVEL_DESIGNS: readonly AdvancedLevelDesign[] = [
  {
    name: '霧銀松徑',
    region: '風鈴松坡',
    description: '高樹樁與緊接樹樁交替出現；先跳再於空中二段跳，低門後也要留意節奏。',
    distanceGoal: 16_400,
    baseSpeed: 390,
    speedRamp: 68,
    obstacleInterval: 0.95,
    pickupInterval: 0.98,
    gapChance: 0.29,
    pairGapPx: 95,
    // Section 3 is stump -> gap -> stump. At 95 px the gap's ground-jump window
    // opens only after the runner has already landed from the first stump, which
    // leaves too little time to read a cue and answer it; the wider spacing
    // lets a runner who needs 200 ms per cue clear all three (see the
    // "200 ms reaction delay" tests in engine.test.ts).
    sectionPairGapPx: { 2: 225 },
    archCount: 8,
    archPitchPx: 114,
    recoveryPx: 500,
    sectionCount: 4,
    palette: {
      skyTop: '#9fb6c9',
      skyBottom: '#e1e7dd',
      sun: '#fff2cb',
      backHill: '#8eaaa0',
      frontHill: '#547a74',
      ground: '#3c625e',
      groundLight: '#a4b78b',
      accent: '#85aeb1',
    },
  },
  {
    name: '翠影石橋',
    region: '苔光古橋',
    description: '高樹樁、裂隙與連跳樹樁輪番出現；依提示完成空中二段跳，再接續滑行。',
    distanceGoal: 17_520,
    baseSpeed: 404,
    speedRamp: 72,
    obstacleInterval: 0.93,
    pickupInterval: 0.96,
    gapChance: 0.31,
    pairGapPx: 108,
    archCount: 8,
    archPitchPx: 112,
    recoveryPx: 488,
    sectionCount: 4,
    palette: {
      skyTop: '#85cfc5',
      skyBottom: '#e0f0d8',
      sun: '#fff2ba',
      backHill: '#9cc8b5',
      frontHill: '#609887',
      ground: '#416f65',
      groundLight: '#91b985',
      accent: '#55afa1',
    },
  },
  {
    name: '煙火竹谷',
    region: '竹影回廊',
    description: '高樹樁後接多種樹樁與裂隙組合；掌握二段跳時機，並在低門前按住滑行。',
    distanceGoal: 18_640,
    baseSpeed: 418,
    speedRamp: 76,
    obstacleInterval: 0.91,
    pickupInterval: 0.94,
    gapChance: 0.33,
    pairGapPx: 120,
    archCount: 9,
    archPitchPx: 110,
    recoveryPx: 476,
    sectionCount: 4,
    palette: {
      skyTop: '#d5a9c5',
      skyBottom: '#f4e3d7',
      sun: '#fff2bd',
      backHill: '#aa9cad',
      frontHill: '#7a738f',
      ground: '#4f5c78',
      groundLight: '#c1ad9a',
      accent: '#d281a0',
    },
  },
  {
    name: '琥珀瀑谷',
    region: '金瀑石階',
    description: '連跳樹樁距離更長，並混合裂隙；高樹樁仍須先跳離地、再按一次二段跳。',
    distanceGoal: 19_760,
    baseSpeed: 432,
    speedRamp: 80,
    obstacleInterval: 0.89,
    pickupInterval: 0.92,
    gapChance: 0.35,
    pairGapPx: 135,
    archCount: 9,
    archPitchPx: 108,
    recoveryPx: 464,
    sectionCount: 4,
    palette: {
      skyTop: '#e6a979',
      skyBottom: '#f8e4b7',
      sun: '#fff1b5',
      backHill: '#c49b77',
      frontHill: '#8b745c',
      ground: '#594d46',
      groundLight: '#c59b63',
      accent: '#e78d53',
    },
  },
  {
    name: '燈籠雨林',
    region: '微光藤徑',
    description: '高樹樁與多段樹樁組合穿插連續低門；注意釋放滑行後的起跳距離。',
    distanceGoal: 20_880,
    baseSpeed: 446,
    speedRamp: 84,
    obstacleInterval: 0.87,
    pickupInterval: 0.9,
    gapChance: 0.37,
    pairGapPx: 148,
    archCount: 10,
    archPitchPx: 106,
    recoveryPx: 452,
    sectionCount: 4,
    palette: {
      skyTop: '#768f76',
      skyBottom: '#d8d5a8',
      sun: '#fff2b5',
      backHill: '#829c75',
      frontHill: '#526d57',
      ground: '#3b5a4b',
      groundLight: '#a3a66c',
      accent: '#e4b957',
    },
  },
  {
    name: '冰晶高原',
    region: '雪線風口',
    description: '更密集的滑行路段後接高樹樁與裂隙；看準窗口，把第二跳留給高障礙。',
    distanceGoal: 22_000,
    baseSpeed: 460,
    speedRamp: 88,
    obstacleInterval: 0.85,
    pickupInterval: 0.88,
    gapChance: 0.39,
    pairGapPx: 162,
    archCount: 10,
    archPitchPx: 104,
    recoveryPx: 440,
    sectionCount: 5,
    palette: {
      skyTop: '#b2d7e6',
      skyBottom: '#f0f1e9',
      sun: '#fff7d6',
      backHill: '#a7c3cd',
      frontHill: '#7699a0',
      ground: '#517681',
      groundLight: '#b4d0cb',
      accent: '#81b7c8',
    },
  },
  {
    name: '薄暮星橋',
    region: '暮色連橋',
    description: '樹樁、裂隙與高樹樁交錯，連續低門後也會接二段跳挑戰。',
    distanceGoal: 23_120,
    baseSpeed: 474,
    speedRamp: 92,
    obstacleInterval: 0.83,
    pickupInterval: 0.86,
    gapChance: 0.41,
    pairGapPx: 175,
    archCount: 11,
    archPitchPx: 102,
    recoveryPx: 428,
    sectionCount: 5,
    palette: {
      skyTop: '#9b97bd',
      skyBottom: '#ded1dc',
      sun: '#fff0c4',
      backHill: '#a7a4c2',
      frontHill: '#727b9d',
      ground: '#4e5b77',
      groundLight: '#b2a5bd',
      accent: '#c1a0dc',
    },
  },
  {
    name: '霞光火山',
    region: '暖石環山道',
    description: '高樹樁後接多重裂隙與樹樁；用二段跳越過高障礙，依序切換跳躍與滑行。',
    distanceGoal: 24_240,
    baseSpeed: 488,
    speedRamp: 96,
    obstacleInterval: 0.81,
    pickupInterval: 0.84,
    gapChance: 0.43,
    pairGapPx: 190,
    archCount: 11,
    archPitchPx: 100,
    recoveryPx: 416,
    sectionCount: 5,
    palette: {
      skyTop: '#ed896a',
      skyBottom: '#f1c08c',
      sun: '#ffe5a6',
      backHill: '#c18a72',
      frontHill: '#9c6c62',
      ground: '#654c4b',
      groundLight: '#c98f65',
      accent: '#e48162',
    },
  },
  {
    name: '流星海岸',
    region: '銀潮浪線',
    description: '高速連續低門與高樹樁交替；提前放開滑行，並把空中第二跳用在關鍵時機。',
    distanceGoal: 25_360,
    baseSpeed: 502,
    speedRamp: 100,
    obstacleInterval: 0.79,
    pickupInterval: 0.82,
    gapChance: 0.45,
    pairGapPx: 205,
    archCount: 12,
    archPitchPx: 98,
    recoveryPx: 404,
    sectionCount: 5,
    palette: {
      skyTop: '#8fc1cb',
      skyBottom: '#e5ead5',
      sun: '#fff0bb',
      backHill: '#91b8ad',
      frontHill: '#527d7b',
      ground: '#3b6668',
      groundLight: '#a9b985',
      accent: '#5eaeb0',
    },
  },
  {
    name: '星光終點',
    region: '遠方星光站',
    description: '最後的高速步道集合高樹樁、裂隙、連跳與密集低門；穩定運用兩段跳抵達終點。',
    distanceGoal: 26_480,
    baseSpeed: 516,
    speedRamp: 104,
    obstacleInterval: 0.77,
    pickupInterval: 0.8,
    gapChance: 0.47,
    pairGapPx: 220,
    archCount: 12,
    archPitchPx: 96,
    recoveryPx: 392,
    sectionCount: 5,
    palette: {
      skyTop: '#7781b4',
      skyBottom: '#c8b9d7',
      sun: '#fff1c4',
      backHill: '#9aa2c2',
      frontHill: '#697b9b',
      ground: '#48566f',
      groundLight: '#a4a4bb',
      accent: '#a7a9ed',
    },
  },
];

function createAdvancedLevel(
  design: AdvancedLevelDesign,
  index: number,
): LevelConfig {
  const anchors =
    design.sectionCount === 4
      ? [0.12, 0.34, 0.56, 0.78]
      : [0.1, 0.27, 0.44, 0.61, 0.78];
  const sequenceOffset = index % ADVANCED_FOLLOWUP_PATTERNS.length;

  return {
    id: index + 11,
    name: design.name,
    region: design.region,
    description: design.description,
    distanceGoal: design.distanceGoal,
    baseSpeed: design.baseSpeed,
    speedRamp: design.speedRamp,
    obstacleInterval: design.obstacleInterval,
    pickupInterval: design.pickupInterval,
    gapChance: design.gapChance,
    difficulty: 5,
    obstaclePattern: {
      prelude: [{ atProgress: 0.05, type: 'highStump' }],
      slideSections: anchors.map((atProgress, sectionIndex) => ({
        atProgress,
        archCount: design.archCount,
        archPitchPx: design.archPitchPx - (sectionIndex % 2) * 2,
        releaseToJumpPx: 760,
        followupJumps:
          ADVANCED_FOLLOWUP_PATTERNS[
            (sectionIndex + sequenceOffset) %
              ADVANCED_FOLLOWUP_PATTERNS.length
          ]!,
        jumpPairClearancePx:
          design.sectionPairGapPx?.[sectionIndex] ?? design.pairGapPx,
        recoveryPx: design.recoveryPx,
      })),
    },
    palette: design.palette,
  };
}

export const LEVELS: readonly LevelConfig[] = [
  {
    id: 1,
    name: '晨光麥田',
    region: '柔風草原',
    description: '先用一次跳躍越過樹樁，再按住滑行穿過連續低門；本關先熟悉基本操作。',
    distanceGoal: 5_200,
    baseSpeed: 250,
    speedRamp: 28,
    obstacleInterval: 1.72,
    pickupInterval: 1.34,
    gapChance: 0,
    difficulty: 1,
    obstaclePattern: {
      prelude: [{ atProgress: 0.08, type: 'stump' }],
      slideSections: [
        {
          atProgress: 0.26,
          archCount: 2,
          archPitchPx: 170,
          releaseToJumpPx: 520,
          followupJumps: ['stump'],
          jumpPairClearancePx: 0,
          recoveryPx: 650,
        },
      ],
    },
    palette: {
      skyTop: '#f5cfa5',
      skyBottom: '#fcebd0',
      sun: '#fff2ae',
      backHill: '#a6c9a2',
      frontHill: '#6f9b79',
      ground: '#52795d',
      groundLight: '#8eae77',
      accent: '#f4a46f',
    },
  },
  {
    id: 2,
    name: '莓果溪谷',
    region: '紅莓小徑',
    description: '先連跳越過緊接的兩座樹樁：第一跳離地後，在空中再按一次二段跳；接著練習低門與放開後起跳。',
    distanceGoal: 6_320,
    baseSpeed: 264,
    speedRamp: 32,
    obstacleInterval: 1.6,
    pickupInterval: 1.3,
    gapChance: 0.02,
    difficulty: 1,
    obstaclePattern: {
      prelude: [
        {
          atProgress: 0.08,
          type: 'stump',
          sequenceId: 'double-jump-tutorial',
        },
        {
          atProgress: 0.08,
          type: 'stump',
          sequenceId: 'double-jump-tutorial',
          afterPreviousClearancePx: 20,
        },
      ],
      slideSections: [0.32, 0.68].map((atProgress) => ({
        atProgress,
        archCount: 3,
        archPitchPx: 165,
        releaseToJumpPx: 500,
        followupJumps: ['stump'],
        jumpPairClearancePx: 0,
        recoveryPx: 650,
      })),
    },
    palette: {
      skyTop: '#f4b2b4',
      skyBottom: '#fde4d0',
      sun: '#fff0bf',
      backHill: '#b2c79a',
      frontHill: '#759b78',
      ground: '#50765d',
      groundLight: '#9cb47c',
      accent: '#e98087',
    },
  },
  {
    id: 3,
    name: '薄荷海岸',
    region: '青綠潮間帶',
    description: '滑行路段後複習連續樹樁：先跳第一座，再在空中二段跳越過第二座。',
    distanceGoal: 7_440,
    baseSpeed: 278,
    speedRamp: 36,
    obstacleInterval: 1.5,
    pickupInterval: 1.26,
    gapChance: 0.04,
    difficulty: 2,
    obstaclePattern: {
      prelude: [],
      slideSections: [0.22, 0.62].map((atProgress, index) => ({
        atProgress,
        archCount: 4,
        archPitchPx: 158,
        releaseToJumpPx: 480,
        followupJumps: index === 1 ? ['stump', 'stump'] : ['stump'],
        jumpPairClearancePx: 20,
        recoveryPx: 620,
      })),
    },
    palette: {
      skyTop: '#a8dcd2',
      skyBottom: '#e0f0d8',
      sun: '#fff2ba',
      backHill: '#9cc8b5',
      frontHill: '#609887',
      ground: '#416f65',
      groundLight: '#91b985',
      accent: '#55afa1',
    },
  },
  {
    id: 4,
    name: '蜜露果園',
    region: '金色果樹坡',
    description: '兩組四座低門後接單樁與雙樁組合，練習放開滑行並在空中完成第二跳。',
    distanceGoal: 8_560,
    baseSpeed: 292,
    speedRamp: 40,
    obstacleInterval: 1.42,
    pickupInterval: 1.22,
    gapChance: 0.07,
    difficulty: 2,
    obstaclePattern: {
      prelude: [],
      slideSections: [0.2, 0.62].map((atProgress, index) => ({
        atProgress,
        archCount: 4,
        archPitchPx: 150,
        releaseToJumpPx: 460,
        followupJumps: index === 1 ? ['stump', 'stump'] : ['stump'],
        jumpPairClearancePx: 24,
        recoveryPx: 600,
      })),
    },
    palette: {
      skyTop: '#f2c27e',
      skyBottom: '#f8e7bd',
      sun: '#fff3ae',
      backHill: '#c4bd83',
      frontHill: '#829765',
      ground: '#5d714c',
      groundLight: '#b5ad67',
      accent: '#e4a64e',
    },
  },
  {
    id: 5,
    name: '焦糖森林',
    region: '琥珀林道',
    description: '三組五座低門後逐步加入緊接樹樁，最後一組要在同一滯空期間連按兩次跳躍。',
    distanceGoal: 9_680,
    baseSpeed: 306,
    speedRamp: 44,
    obstacleInterval: 1.34,
    pickupInterval: 1.18,
    gapChance: 0.1,
    difficulty: 3,
    obstaclePattern: {
      prelude: [],
      slideSections: [0.16, 0.44, 0.72].map((atProgress, index) => ({
        atProgress,
        archCount: 5,
        archPitchPx: 145,
        releaseToJumpPx: 460,
        followupJumps: index === 2 ? ['stump', 'stump'] : ['stump'],
        jumpPairClearancePx: 30,
        recoveryPx: 600,
      })),
    },
    palette: {
      skyTop: '#d9b58f',
      skyBottom: '#f2dfb6',
      sun: '#ffedbd',
      backHill: '#a4b18a',
      frontHill: '#647e68',
      ground: '#465f50',
      groundLight: '#9e9d69',
      accent: '#c98c58',
    },
  },
  {
    id: 6,
    name: '雲霧高地',
    region: '風鈴山腰',
    description: '三組五座低門之後安排雙樁複習，第一次跳躍離地後再用一次二段跳。',
    distanceGoal: 10_800,
    baseSpeed: 320,
    speedRamp: 48,
    obstacleInterval: 1.27,
    pickupInterval: 1.14,
    gapChance: 0.13,
    difficulty: 3,
    obstaclePattern: {
      prelude: [],
      slideSections: [0.15, 0.44, 0.73].map((atProgress, index) => ({
        atProgress,
        archCount: 5,
        archPitchPx: 140,
        releaseToJumpPx: 440,
        followupJumps: index === 2 ? ['stump', 'stump'] : ['stump'],
        jumpPairClearancePx: 34,
        recoveryPx: 580,
      })),
    },
    palette: {
      skyTop: '#a9c6dc',
      skyBottom: '#e0eadc',
      sun: '#fff0c2',
      backHill: '#9eb6a6',
      frontHill: '#688b7e',
      ground: '#486e68',
      groundLight: '#a1b687',
      accent: '#79aabd',
    },
  },
  {
    id: 7,
    name: '霜糖冰原',
    region: '銀白雪線',
    description: '在滑行與裂隙間交替複習連跳樹樁；先確認第一跳已離地，再接空中第二跳。',
    distanceGoal: 11_920,
    baseSpeed: 334,
    speedRamp: 52,
    obstacleInterval: 1.2,
    pickupInterval: 1.1,
    gapChance: 0.16,
    difficulty: 4,
    obstaclePattern: {
      prelude: [],
      slideSections: [0.15, 0.44, 0.73].map((atProgress, index) => ({
        atProgress,
        archCount: 6,
        archPitchPx: 134,
        releaseToJumpPx: 430,
        followupJumps: index === 0 ? ['stump'] : index === 1 ? ['stump', 'stump'] : ['gap'],
        jumpPairClearancePx: 42,
        recoveryPx: 560,
      })),
    },
    palette: {
      skyTop: '#c6deeb',
      skyBottom: '#f0f1e9',
      sun: '#fff7d6',
      backHill: '#a7c3cd',
      frontHill: '#7699a0',
      ground: '#517681',
      groundLight: '#b4d0cb',
      accent: '#81b7c8',
    },
  },
  {
    id: 8,
    name: '星光沙丘',
    region: '夜色星砂路',
    description: '前方第一次出現高樹樁，先跳離地並在空中再跳一次；之後混合低門、樹樁與裂隙。',
    distanceGoal: 13_040,
    baseSpeed: 348,
    speedRamp: 56,
    obstacleInterval: 1.13,
    pickupInterval: 1.07,
    gapChance: 0.19,
    difficulty: 4,
    obstaclePattern: {
      prelude: [{ atProgress: 0.075, type: 'highStump' }],
      slideSections: [0.15, 0.44, 0.73].map((atProgress, index) => ({
        atProgress,
        archCount: 6,
        archPitchPx: 128,
        releaseToJumpPx: 430,
        followupJumps:
          index === 0
            ? ['stump', 'stump']
            : index === 1
              ? ['gap']
              : ['stump', 'gap'],
        jumpPairClearancePx: 55,
        recoveryPx: 560,
      })),
    },
    palette: {
      skyTop: '#8e9bc0',
      skyBottom: '#d7bed0',
      sun: '#fff1c8',
      backHill: '#9e9bb2',
      frontHill: '#777d9c',
      ground: '#555d7b',
      groundLight: '#b7a1a2',
      accent: '#c4a5df',
    },
  },
  {
    id: 9,
    name: '可可火山',
    region: '暖石環山道',
    description: '複習高樹樁與連跳樹樁，並混合裂隙；空中二段跳提示只會在可通過的窗口出現。',
    distanceGoal: 14_160,
    baseSpeed: 362,
    speedRamp: 60,
    obstacleInterval: 1.06,
    pickupInterval: 1.04,
    gapChance: 0.23,
    difficulty: 5,
    obstaclePattern: {
      prelude: [{ atProgress: 0.06, type: 'highStump' }],
      slideSections: [0.12, 0.33, 0.54, 0.74].map((atProgress, index) => ({
        atProgress,
        archCount: 7,
        archPitchPx: 124,
        releaseToJumpPx: 420,
        followupJumps:
          index === 0
            ? ['stump', 'stump']
            : index === 1
              ? ['stump']
            : index === 2
              ? ['gap']
              : ['gap', 'stump'],
        jumpPairClearancePx: 68,
        recoveryPx: 540,
      })),
    },
    palette: {
      skyTop: '#d99476',
      skyBottom: '#f1c08c',
      sun: '#ffe5a6',
      backHill: '#c18a72',
      frontHill: '#9c6c62',
      ground: '#654c4b',
      groundLight: '#c98f65',
      accent: '#e48162',
    },
  },
  {
    id: 10,
    name: '月光糖丘',
    region: '遠方星光站',
    description: '高樹樁加入低門與裂隙組合；依實際提示安排第一跳與空中第二跳，完成綜合複習。',
    distanceGoal: 15_280,
    baseSpeed: 376,
    speedRamp: 64,
    obstacleInterval: 0.99,
    pickupInterval: 1,
    gapChance: 0.27,
    difficulty: 5,
    obstaclePattern: {
      prelude: [{ atProgress: 0.06, type: 'highStump' }],
      slideSections: [0.12, 0.33, 0.54, 0.73].map((atProgress, index) => ({
        atProgress,
        archCount: 8,
        archPitchPx: 118,
        releaseToJumpPx: 420,
        followupJumps:
          index === 0
            ? ['stump']
            : index === 1
              ? ['gap']
              : index === 2
                ? ['stump', 'gap']
                : ['gap', 'stump'],
        jumpPairClearancePx: 560,
        recoveryPx: 540,
      })),
    },
    palette: {
      skyTop: '#7781b4',
      skyBottom: '#c8b9d7',
      sun: '#fff1c4',
      backHill: '#9aa2c2',
      frontHill: '#697b9b',
      ground: '#48566f',
      groundLight: '#a4a4bb',
      accent: '#a7a9ed',
    },
  },
  ...ADVANCED_LEVEL_DESIGNS.map(createAdvancedLevel),
];

export const MAX_LEVELS = LEVELS.length;

export function getLevel(id: number): LevelConfig {
  return LEVELS[Math.min(Math.max(Math.floor(id), 1), LEVELS.length) - 1]!;
}
