import { useEffect, useRef } from 'react';
import { loadCharacterFrames } from '../game/sprites';

export default function CharacterPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationFrame: number | null = null;
    let frames: Awaited<ReturnType<typeof loadCharacterFrames>> | null = null;
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

      if (frames && frames.length > 0) {
        const elapsed = reduceMotion ? 0 : (now - startedAt) / 1_000;
        const frame = frames[Math.floor(elapsed * 11) % frames.length]!;
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

    void loadCharacterFrames()
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
