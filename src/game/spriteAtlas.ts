export type SpriteAction = 'run' | 'slide';

export interface SpriteFrameCrop {
  action: SpriteAction;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AtlasRow {
  y: number;
  height: number;
}

interface RgbSample {
  red: number;
  green: number;
  blue: number;
  count: number;
}

const ATLAS_COLUMNS = 6;
const ATLAS_COLUMN_WIDTH = 256;
const BACKGROUND_CHANNEL_TOLERANCE = 12;

const ACTION_ROWS: Readonly<Record<SpriteAction, readonly AtlasRow[]>> = {
  run: [
    { y: 84, height: 194 },
    { y: 331, height: 204 },
  ],
  slide: [
    { y: 668, height: 117 },
    { y: 842, height: 122 },
  ],
};

function sampleEdgeBackgroundColors(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): RgbSample[] {
  const clusters = new Map<string, RgbSample>();

  const addSample = (x: number, y: number): void => {
    const offset = (y * width + x) * 4;
    if (pixels[offset + 3]! <= 12) {
      return;
    }

    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    const lightest = Math.max(red, green, blue);
    const darkest = Math.min(red, green, blue);
    if (darkest < 220 || lightest - darkest > 18) {
      return;
    }

    const key = `${red >> 3}:${green >> 3}:${blue >> 3}`;
    const cluster = clusters.get(key);
    if (cluster) {
      cluster.red += red;
      cluster.green += green;
      cluster.blue += blue;
      cluster.count += 1;
    } else {
      clusters.set(key, { red, green, blue, count: 1 });
    }
  };

  for (let x = 0; x < width; x += 1) {
    addSample(x, 0);
    addSample(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    addSample(0, y);
    addSample(width - 1, y);
  }

  const samples: RgbSample[] = [];
  const rankedClusters = [...clusters.values()].sort(
    (left, right) => right.count - left.count,
  );
  for (const cluster of rankedClusters) {
    const color = {
      red: cluster.red / cluster.count,
      green: cluster.green / cluster.count,
      blue: cluster.blue / cluster.count,
      count: cluster.count,
    };
    const isDistinctSample = samples.every(
      (sample) =>
        Math.max(
          Math.abs(sample.red - color.red),
          Math.abs(sample.green - color.green),
          Math.abs(sample.blue - color.blue),
        ) > BACKGROUND_CHANNEL_TOLERANCE / 2,
    );
    if (isDistinctSample) {
      samples.push(color);
    }
    if (samples.length === 2) {
      break;
    }
  }

  return samples.length > 0
    ? samples
    : [{ red: 255, green: 255, blue: 255, count: 0 }];
}

function matchesSampledBackground(
  pixels: Uint8ClampedArray,
  offset: number,
  backgroundSamples: readonly RgbSample[],
): boolean {
  const red = pixels[offset]!;
  const green = pixels[offset + 1]!;
  const blue = pixels[offset + 2]!;

  return backgroundSamples.some(
    (sample) =>
      Math.max(
        Math.abs(red - sample.red),
        Math.abs(green - sample.green),
        Math.abs(blue - sample.blue),
      ) <= BACKGROUND_CHANNEL_TOLERANCE,
  );
}

export function getActionFrameCrops(action: SpriteAction): SpriteFrameCrop[] {
  const rows = ACTION_ROWS[action];
  return rows.flatMap((row, rowIndex) =>
    Array.from({ length: ATLAS_COLUMNS }, (_, column) => ({
      action,
      index: rowIndex * ATLAS_COLUMNS + column,
      x: column * ATLAS_COLUMN_WIDTH,
      y: row.y,
      width: ATLAS_COLUMN_WIDTH,
      height: row.height,
    })),
  );
}

export function makeCheckerboardTransparent(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): number {
  if (
    width <= 0 ||
    height <= 0 ||
    pixels.length !== width * height * 4
  ) {
    throw new RangeError('Pixel data dimensions do not match the supplied image.');
  }

  const backgroundSamples = sampleEdgeBackgroundColors(pixels, width, height);
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0;
  let tail = 0;

  const addBackgroundPixel = (x: number, y: number): void => {
    if (x < 0 || x >= width || y < 0 || y >= height) {
      return;
    }

    const index = y * width + x;
    if (visited[index]) {
      return;
    }
    visited[index] = 1;

    if (
      matchesSampledBackground(
        pixels,
        index * 4,
        backgroundSamples,
      )
    ) {
      queue[tail] = index;
      tail += 1;
    }
  };

  for (let x = 0; x < width; x += 1) {
    addBackgroundPixel(x, 0);
    addBackgroundPixel(x, height - 1);
  }
  for (let y = 1; y < height - 1; y += 1) {
    addBackgroundPixel(0, y);
    addBackgroundPixel(width - 1, y);
  }

  while (head < tail) {
    const index = queue[head]!;
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    addBackgroundPixel(x - 1, y);
    addBackgroundPixel(x + 1, y);
    addBackgroundPixel(x, y - 1);
    addBackgroundPixel(x, y + 1);
  }

  for (let index = 0; index < tail; index += 1) {
    pixels[queue[index]! * 4 + 3] = 0;
  }

  return tail;
}
