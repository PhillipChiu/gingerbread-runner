import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROGRESS,
  PROGRESS_STORAGE_KEY,
  readProgress,
  recordRun,
  writeProgress,
  type StorageLike,
} from './progress';

function createMemoryStorage(): StorageLike {
  const entries = new Map<string, string>();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

describe('local progress', () => {
  it('unlocks the next stage after a clear and preserves the best score', () => {
    const firstRun = recordRun(DEFAULT_PROGRESS, 1, 840, 4, true);
    const replay = recordRun(firstRun, 1, 620, 2, false);

    expect(firstRun.unlockedLevel).toBe(2);
    expect(replay.unlockedLevel).toBe(2);
    expect(replay.clearedLevels).toEqual([1]);
    expect(replay.bestScores[1]).toBe(840);
    expect(replay.totalCollectibles).toBe(6);
  });

  it('round-trips a valid record and safely ignores malformed storage', () => {
    const storage = createMemoryStorage();
    const progress = recordRun(DEFAULT_PROGRESS, 3, 1_250, 7, true);

    writeProgress(progress, storage);
    expect(storage.getItem(PROGRESS_STORAGE_KEY)).not.toBeNull();
    expect(readProgress(storage)).toEqual(progress);

    storage.setItem(PROGRESS_STORAGE_KEY, '{bad json');
    expect(readProgress(storage)).toEqual(DEFAULT_PROGRESS);
  });

  it('clamps a corrupted record to supported stage and score ranges', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      PROGRESS_STORAGE_KEY,
      JSON.stringify({
        unlockedLevel: 99,
        clearedLevels: [1, 11, 2, '3'],
        bestScores: { 1: 150, 12: 9_999, 2: -10 },
        totalCollectibles: -1,
      }),
    );

    expect(readProgress(storage)).toEqual({
      unlockedLevel: 10,
      clearedLevels: [1, 2],
      bestScores: { 1: 150 },
      totalCollectibles: 0,
    });
  });
});
