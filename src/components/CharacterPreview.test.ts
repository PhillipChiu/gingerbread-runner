import { describe, expect, it } from 'vitest';
import { getCharacterPreviewFrameIndex } from './CharacterPreview';

describe('character preview frame selection', () => {
  it('starts from a valid frame when a new animation origin is ahead of the rAF timestamp', () => {
    expect(getCharacterPreviewFrameIndex(1_828.1, 1_830.3, 12, false)).toBe(0);
  });

  it('keeps frame indices within the sprite sheet after motion preference changes', () => {
    const timestamps = [1_828.1, 1_830.3, 1_831.2, 12_000];
    const frameCount = 12;

    for (const now of timestamps) {
      const frameIndex = getCharacterPreviewFrameIndex(now, 1_830.3, frameCount, false);

      expect(frameIndex).toBeGreaterThanOrEqual(0);
      expect(frameIndex).toBeLessThan(frameCount);
    }
  });

  it('uses the first frame while reduced motion is enabled', () => {
    expect(getCharacterPreviewFrameIndex(1_900, 1_830.3, 12, true)).toBe(0);
  });
});
