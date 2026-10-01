import runnerSpriteAtlasUrl from '../../run_and_slide.png';
import { getRunnerFrameLayout } from './runnerAnimation';
import {
  getActionFrameCrops,
  makeCheckerboardTransparent,
  type SpriteAction,
} from './spriteAtlas';

export type SpriteFrame = HTMLCanvasElement;

export interface RunnerSpriteFrames {
  run: SpriteFrame[];
  slide: SpriteFrame[];
}

let characterFramesPromise: Promise<RunnerSpriteFrames> | null = null;

function keepLargestForegroundComponent(frame: HTMLCanvasElement): void {
  const context = frame.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return;
  }

  const image = context.getImageData(0, 0, frame.width, frame.height);
  const pixels = image.data;
  const pixelCount = frame.width * frame.height;
  const visited = new Uint8Array(pixelCount);
  const keep = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let queueLength = 0;
  let largestComponentSize = 0;

  for (let start = 0; start < pixelCount; start += 1) {
    if (visited[start] || pixels[start * 4 + 3]! <= 12) {
      continue;
    }

    const componentStart = queueLength;
    queue[queueLength] = start;
    queueLength += 1;
    visited[start] = 1;

    for (let head = componentStart; head < queueLength; head += 1) {
      const pixelIndex = queue[head]!;
      const x = pixelIndex % frame.width;
      const y = Math.floor(pixelIndex / frame.width);

      for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
        for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
          if (offsetX === 0 && offsetY === 0) {
            continue;
          }

          const neighborX = x + offsetX;
          const neighborY = y + offsetY;
          if (
            neighborX < 0 ||
            neighborX >= frame.width ||
            neighborY < 0 ||
            neighborY >= frame.height
          ) {
            continue;
          }

          const neighborIndex = neighborY * frame.width + neighborX;
          if (
            !visited[neighborIndex] &&
            pixels[neighborIndex * 4 + 3]! > 12
          ) {
            visited[neighborIndex] = 1;
            queue[queueLength] = neighborIndex;
            queueLength += 1;
          }
        }
      }
    }

    const componentSize = queueLength - componentStart;
    if (componentSize > largestComponentSize) {
      largestComponentSize = componentSize;
      keep.fill(0);
      for (let index = componentStart; index < queueLength; index += 1) {
        keep[queue[index]!] = 1;
      }
    }
  }

  for (let index = 0; index < pixelCount; index += 1) {
    if (!keep[index]) {
      pixels[index * 4 + 3] = 0;
    }
  }

  context.putImageData(image, 0, 0);
}

function trimFrame(source: HTMLCanvasElement): HTMLCanvasElement {
  const context = source.getContext('2d', { willReadFrequently: true });
  if (!context) {
    return source;
  }

  const { data } = context.getImageData(0, 0, source.width, source.height);
  let left = source.width;
  let top = source.height;
  let right = -1;
  let bottom = -1;

  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (data[(y * source.width + x) * 4 + 3]! > 12) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }

  if (right < left || bottom < top) {
    return source;
  }

  const padding = 5;
  const x = Math.max(0, left - padding);
  const y = Math.max(0, top - padding);
  const width = Math.min(source.width - x, right - left + padding * 2 + 1);
  const height = Math.min(source.height - y, bottom - top + padding * 2 + 1);
  const trimmed = document.createElement('canvas');
  trimmed.width = width;
  trimmed.height = height;
  trimmed.getContext('2d')?.drawImage(source, x, y, width, height, 0, 0, width, height);
  return trimmed;
}

function createActionFrames(
  image: HTMLImageElement,
  action: SpriteAction,
): SpriteFrame[] {
  const frames: SpriteFrame[] = [];

  for (const crop of getActionFrameCrops(action)) {
    const frame = document.createElement('canvas');
    frame.width = crop.width;
    frame.height = crop.height;
    const context = frame.getContext('2d', { willReadFrequently: true });

    if (!context) {
      continue;
    }

    context.drawImage(
      image,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height,
    );
    const pixels = context.getImageData(0, 0, frame.width, frame.height);
    makeCheckerboardTransparent(pixels.data, frame.width, frame.height);
    context.putImageData(pixels, 0, 0);
    keepLargestForegroundComponent(frame);
    frames.push(trimFrame(frame));
  }

  const layout = getRunnerFrameLayout(frames);
  return frames.map((source, index) => {
    const normalized = document.createElement('canvas');
    normalized.width = layout.width;
    normalized.height = layout.height;
    normalized
      .getContext('2d')
      ?.drawImage(source, layout.placements[index]!.x, layout.placements[index]!.y);
    return normalized;
  });
}

function createFrames(image: HTMLImageElement): RunnerSpriteFrames {
  return {
    run: createActionFrames(image, 'run'),
    slide: createActionFrames(image, 'slide'),
  };
}

export function loadRunnerSpriteFrames(): Promise<RunnerSpriteFrames> {
  if (characterFramesPromise) {
    return characterFramesPromise;
  }

  characterFramesPromise = new Promise<RunnerSpriteFrames>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(createFrames(image));
    image.onerror = () => reject(new Error('無法載入角色圖片'));
    image.src = runnerSpriteAtlasUrl;
  });

  return characterFramesPromise;
}
