import { describe, expect, it } from 'vitest';
import {
  getActionFrameCrops,
  makeCheckerboardTransparent,
} from './spriteAtlas';

describe('dual-action sprite atlas geometry', () => {
  it('returns twelve left-to-right, top-to-bottom crops for each action row', () => {
    const runFrames = getActionFrameCrops('run');
    const slideFrames = getActionFrameCrops('slide');

    expect(runFrames).toHaveLength(12);
    expect(slideFrames).toHaveLength(12);
    expect(runFrames[0]).toEqual({
      action: 'run',
      index: 0,
      x: 0,
      y: 84,
      width: 256,
      height: 194,
    });
    expect(runFrames[5]).toEqual({
      action: 'run',
      index: 5,
      x: 1_280,
      y: 84,
      width: 256,
      height: 194,
    });
    expect(runFrames[6]).toEqual({
      action: 'run',
      index: 6,
      x: 0,
      y: 331,
      width: 256,
      height: 204,
    });
    expect(runFrames[11]).toEqual({
      action: 'run',
      index: 11,
      x: 1_280,
      y: 331,
      width: 256,
      height: 204,
    });
    expect(slideFrames[0]).toEqual({
      action: 'slide',
      index: 0,
      x: 0,
      y: 668,
      width: 256,
      height: 117,
    });
    expect(slideFrames[11]).toEqual({
      action: 'slide',
      index: 11,
      x: 1_280,
      y: 842,
      width: 256,
      height: 122,
    });
    expect(
      new Set([...runFrames, ...slideFrames].map(({ x, y }) => `${x}:${y}`)).size,
    ).toBe(24);
    expect(runFrames.every((frame) => frame.y + frame.height <= 535)).toBe(true);
    expect(slideFrames.every((frame) => frame.y + frame.height <= 964)).toBe(true);
  });

  it('flood-fills sampled checkerboard colors from crop edges without deleting cream fur', () => {
    const width = 7;
    const height = 7;
    const pixels = new Uint8ClampedArray(width * height * 4);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const color = (x + y) % 2 === 0 ? 254 : 242;
        pixels[offset] = color;
        pixels[offset + 1] = color;
        pixels[offset + 2] = color;
        pixels[offset + 3] = 255;
      }
    }
    for (let y = 2; y <= 4; y += 1) {
      for (let x = 2; x <= 4; x += 1) {
        const offset = (y * width + x) * 4;
        pixels[offset] = 250;
        pixels[offset + 1] = 237;
        pixels[offset + 2] = 214;
      }
    }

    const removedPixels = makeCheckerboardTransparent(pixels, width, height);

    expect(removedPixels).toBe(width * height - 9);
    expect(pixels[3]).toBe(0);
    expect(pixels[((3 * width + 3) * 4) + 3]).toBe(255);
    expect(Array.from(pixels.slice((3 * width + 3) * 4, (3 * width + 3) * 4 + 3)))
      .toEqual([250, 237, 214]);
  });
});
