import { useEffect, useRef } from 'react';
import { RUNNER_FRAMES_PER_SECOND } from '../game/runnerAnimation';
import { loadRunnerSpriteFrames } from '../game/sprites';

const PREVIEW_FRAMES_PER_SECOND = RUNNER_FRAMES_PER_SECOND;

function getElapsedSeconds(now: number, startedAt: number): number {
  if (!Number.isFinite(now) || !Number.isFinite(startedAt)) {
    return 0;
  }

  const elapsedMilliseconds = now - startedAt;
  return Number.isFinite(elapsedMilliseconds)
    ? Math.max(0, elapsedMilliseconds) / 1_000
    : 0;
}

export function getCharacterPreviewFrameIndex(
  now: number,
  startedAt: number,
  frameCount: number,
  reduceMotion: boolean,
): number {
  if (reduceMotion || !Number.isInteger(frameCount) || frameCount <= 0) {
    return 0;
  }

  const elapsedSeconds = getElapsedSeconds(now, startedAt);
  const frameIndex = Math.floor(elapsedSeconds * PREVIEW_FRAMES_PER_SECOND) % frameCount;

  return Number.isInteger(frameIndex) && frameIndex >= 0 && frameIndex < frameCount
    ? frameIndex
    : 0;
}

export default function CharacterPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationFrame: number | null = null;
    let frames: Awaited<ReturnType<typeof loadRunnerSpriteFrames>> | null = null;
    let active = true;
    let startedAt = 0;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = motionPreference.matches;

    const draw = (now: number): void => {
      animationFrame = null;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        return;
      }

      if (startedAt === 0) {
        startedAt = now;
      }
      context.clearRect(0, 0, canvas.width, canvas.height);

      if (frames && frames.run.length > 0) {
        const elapsed = getElapsedSeconds(now, startedAt);
        const frameIndex = getCharacterPreviewFrameIndex(
          now,
          startedAt,
          frames.run.length,
          reduceMotion,
        );
        const frame = frames.run[frameIndex];

        if (frame) {
          const scale = Math.min(208 / frame.width, 186 / frame.height);
          const width = frame.width * scale;
          const height = frame.height * scale;
          context.drawImage(
            frame,
            (canvas.width - width) / 2,
            canvas.height - height - 9 + (reduceMotion ? 0 : Math.sin(elapsed * 6) * 3),
            width,
            height,
          );
        }
      }

      if (!reduceMotion) {
        animationFrame = window.requestAnimationFrame(draw);
      }
    };

    const redraw = (): void => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      startedAt = 0;
      draw(performance.now());
    };

    const onMotionPreferenceChange = (): void => {
      reduceMotion = motionPreference.matches;
      redraw();
    };

    void loadRunnerSpriteFrames()
      .then((loadedFrames) => {
        if (active) {
          frames = loadedFrames;
          if (reduceMotion) {
            redraw();
          }
        }
      })
      .catch(() => {
        if (active) {
          frames = null;
        }
      });

    motionPreference.addEventListener('change', onMotionPreferenceChange);
    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      active = false;
      motionPreference.removeEventListener('change', onMotionPreferenceChange);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, []);

  return <canvas ref={canvasRef} className="character-preview" width={240} height={210} aria-hidden="true" />;
}
