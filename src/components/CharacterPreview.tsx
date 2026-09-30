import { useEffect, useRef } from 'react';
import { loadCharacterFrames } from '../game/sprites';

export default function CharacterPreview() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let animationFrame = 0;
    let frames: Awaited<ReturnType<typeof loadCharacterFrames>> | null = null;
    let active = true;
    let startedAt = 0;

    void loadCharacterFrames()
      .then((loadedFrames) => {
        if (active) {
          frames = loadedFrames;
        }
      })
      .catch(() => {
        frames = null;
      });

    const draw = (now: number): void => {
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
        const elapsed = (now - startedAt) / 1_000;
        const frame = frames[Math.floor(elapsed * 11) % frames.length]!;
        const scale = Math.min(208 / frame.width, 186 / frame.height);
        const width = frame.width * scale;
        const height = frame.height * scale;
        context.drawImage(
          frame,
          (canvas.width - width) / 2,
          canvas.height - height - 9 + Math.sin(elapsed * 6) * 3,
          width,
          height,
        );
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    animationFrame = window.requestAnimationFrame(draw);
    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return <canvas ref={canvasRef} className="character-preview" width={240} height={210} aria-hidden="true" />;
}
