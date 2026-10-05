import { MAX_LEVELS } from './levels';

export const PROGRESS_STORAGE_KEY = 'cloudtail-runner.progress.v1';

export interface ProgressData {
  unlockedLevel: number;
  clearedLevels: number[];
  bestScores: Record<number, number>;
  totalCollectibles: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const DEFAULT_PROGRESS: ProgressData = {
  unlockedLevel: 1,
  clearedLevels: [],
  bestScores: {},
  totalCollectibles: 0,
};

const LEGACY_FINAL_LEVEL = 10;

function normalizeProgress(value: unknown): ProgressData {
  if (!value || typeof value !== 'object') {
    return { ...DEFAULT_PROGRESS, clearedLevels: [], bestScores: {} };
  }

  const candidate = value as Partial<ProgressData>;
  const clearedLevels = Array.isArray(candidate.clearedLevels)
    ? [...new Set(candidate.clearedLevels)]
        .filter(
          (level): level is number =>
            Number.isInteger(level) && level >= 1 && level <= MAX_LEVELS,
        )
        .sort((first, second) => first - second)
    : [];
  const bestScores: Record<number, number> = {};

  if (candidate.bestScores && typeof candidate.bestScores === 'object') {
    for (const [levelText, score] of Object.entries(candidate.bestScores)) {
      const level = Number(levelText);
      if (
        Number.isInteger(level) &&
        level >= 1 &&
        level <= MAX_LEVELS &&
        typeof score === 'number' &&
        Number.isFinite(score) &&
        score >= 0
      ) {
        bestScores[level] = Math.floor(score);
      }
    }
  }

  const storedUnlockedLevel =
    typeof candidate.unlockedLevel === 'number' &&
    Number.isFinite(candidate.unlockedLevel)
      ? Math.min(
          Math.max(Math.floor(candidate.unlockedLevel), 1),
          MAX_LEVELS,
        )
      : 1;
  const unlockedLevel = Math.max(
    storedUnlockedLevel,
    clearedLevels.includes(LEGACY_FINAL_LEVEL)
      ? LEGACY_FINAL_LEVEL + 1
      : 1,
  );
  const totalCollectibles =
    typeof candidate.totalCollectibles === 'number' &&
    Number.isFinite(candidate.totalCollectibles)
      ? Math.max(0, Math.floor(candidate.totalCollectibles))
      : 0;

  return { unlockedLevel, clearedLevels, bestScores, totalCollectibles };
}

export function readProgress(storage?: StorageLike | null): ProgressData {
  try {
    const selectedStorage =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    const raw = selectedStorage?.getItem(PROGRESS_STORAGE_KEY);
    return raw ? normalizeProgress(JSON.parse(raw) as unknown) : normalizeProgress(null);
  } catch {
    return normalizeProgress(null);
  }
}

export function writeProgress(
  progress: ProgressData,
  storage?: StorageLike | null,
): void {
  try {
    const selectedStorage =
      storage ??
      (typeof window !== 'undefined' ? window.localStorage : undefined);
    selectedStorage?.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify(normalizeProgress(progress)),
    );
  } catch {
    // Storage may be unavailable in private browsing; the current run still works.
  }
}

export function recordRun(
  progress: ProgressData,
  level: number,
  score: number,
  collectibles: number,
  cleared: boolean,
): ProgressData {
  const safeLevel = Math.min(Math.max(Math.floor(level), 1), MAX_LEVELS);
  const safeUnlockedLevel = Math.min(
    Math.max(Math.floor(progress.unlockedLevel), 1),
    MAX_LEVELS,
  );
  const safeScore = Math.max(0, Math.floor(score));
  const clearedLevels = cleared
    ? [...new Set([...progress.clearedLevels, safeLevel])].sort(
        (first, second) => first - second,
      )
    : [...progress.clearedLevels];

  return {
    unlockedLevel: cleared
      ? Math.max(safeUnlockedLevel, Math.min(safeLevel + 1, MAX_LEVELS))
      : safeUnlockedLevel,
    clearedLevels,
    bestScores: {
      ...progress.bestScores,
      [safeLevel]: Math.max(progress.bestScores[safeLevel] ?? 0, safeScore),
    },
    totalCollectibles: progress.totalCollectibles + Math.max(0, Math.floor(collectibles)),
  };
}
