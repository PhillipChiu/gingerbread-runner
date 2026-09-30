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
  palette: LevelPalette;
}

export const LEVELS: readonly LevelConfig[] = [
  {
    id: 1,
    name: '晨光麥田',
    region: '柔風草原',
    description: '迎著晨風暖暖起跑，先練習跳過小樹樁。',
    distanceGoal: 5_200,
    baseSpeed: 250,
    speedRamp: 28,
    obstacleInterval: 1.72,
    pickupInterval: 1.34,
    gapChance: 0,
    difficulty: 1,
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
    description: '溪水旁的路變窄了，留意接連出現的莓果箱。',
    distanceGoal: 6_320,
    baseSpeed: 264,
    speedRamp: 32,
    obstacleInterval: 1.6,
    pickupInterval: 1.3,
    gapChance: 0.02,
    difficulty: 1,
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
    description: '海風開始加速，低低的拱門記得俯身滑過。',
    distanceGoal: 7_440,
    baseSpeed: 278,
    speedRamp: 36,
    obstacleInterval: 1.5,
    pickupInterval: 1.26,
    gapChance: 0.04,
    difficulty: 2,
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
    description: '果樹枝影交錯，樹樁與拱門會輪流考驗反應。',
    distanceGoal: 8_560,
    baseSpeed: 292,
    speedRamp: 40,
    obstacleInterval: 1.42,
    pickupInterval: 1.22,
    gapChance: 0.07,
    difficulty: 2,
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
    description: '森林裡的步道開始起伏，偶爾會出現小段裂隙。',
    distanceGoal: 9_680,
    baseSpeed: 306,
    speedRamp: 44,
    obstacleInterval: 1.34,
    pickupInterval: 1.18,
    gapChance: 0.1,
    difficulty: 3,
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
    description: '山風吹得更急，收集能量果實延長本次奔跑。',
    distanceGoal: 10_800,
    baseSpeed: 320,
    speedRamp: 48,
    obstacleInterval: 1.27,
    pickupInterval: 1.14,
    gapChance: 0.13,
    difficulty: 3,
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
    description: '冰原路面空曠卻更快，跳躍時機要抓得剛剛好。',
    distanceGoal: 11_920,
    baseSpeed: 334,
    speedRamp: 52,
    obstacleInterval: 1.2,
    pickupInterval: 1.1,
    gapChance: 0.16,
    difficulty: 4,
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
    description: '星砂路線障礙更密集，請留意前方落差。',
    distanceGoal: 13_040,
    baseSpeed: 348,
    speedRamp: 56,
    obstacleInterval: 1.13,
    pickupInterval: 1.07,
    gapChance: 0.19,
    difficulty: 4,
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
    description: '熱風裡的裂隙又長又急，衝刺前先觀察節奏。',
    distanceGoal: 14_160,
    baseSpeed: 362,
    speedRamp: 60,
    obstacleInterval: 1.06,
    pickupInterval: 1.04,
    gapChance: 0.23,
    difficulty: 5,
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
    description: '最後一段旅程，專注切換跳躍與滑行，跑向星光終點。',
    distanceGoal: 15_280,
    baseSpeed: 376,
    speedRamp: 64,
    obstacleInterval: 0.99,
    pickupInterval: 1,
    gapChance: 0.27,
    difficulty: 5,
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

export function getLevel(id: number): LevelConfig {
  return LEVELS[Math.min(Math.max(Math.floor(id), 1), LEVELS.length) - 1]!;
}
