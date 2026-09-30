import { useEffect, useRef } from 'react';
import {
  advanceGame,
  applyPlayerAction,
  createGameState,
  toGameSnapshot,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GameSnapshot,
  type GameState,
  type PlayerAction,
} from '../game/engine';
import { drawGameScene } from '../game/render';
import { loadCharacterFrames, type SpriteFrame } from '../game/sprites';
import type { LevelConfig } from '../game/levels';

export interface ActionRequest {
  id: number;
  action: PlayerAction;
}

interface GameCanvasProps {
  level: LevelConfig;
  runKey: number;
  isRunning: boolean;
  actionRequest: ActionRequest | null;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onFinish: (state: GameState) => void;
}

interface LatestProps extends GameCanvasProps {}

export default function GameCanvas(props: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef<LatestProps>(props);
  propsRef.current = props;

  useEffect(() => {
    let animationFrame = 0;
    let currentRunKey = -1;
    let processedActionId = -1;
    let lastFrameAt = 0;
    let lastSnapshotAt = 0;
    let finishNotified = false;
    let state: GameState | null = null;
    let frames: SpriteFrame[] | null = null;
    let active = true;

    void loadCharacterFrames()
      .then((loadedFrames) => {
        if (active) {
          frames = loadedFrames;
        }
      })
      .catch(() => {
        frames = null;
      });

    const render = (now: number): void => {
      const currentProps = propsRef.current;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        return;
      }

      if (!state || currentRunKey !== currentProps.runKey) {
        state = createGameState(currentProps.level);
        currentRunKey = currentProps.runKey;
        processedActionId = currentProps.actionRequest?.id ?? -1;
        finishNotified = false;
        lastSnapshotAt = 0;
      }

      if (
        currentProps.actionRequest &&
        currentProps.actionRequest.id !== processedActionId
      ) {
        processedActionId = currentProps.actionRequest.id;
        state = applyPlayerAction(state, currentProps.actionRequest.action);
      }

      const delta = lastFrameAt === 0 ? 0 : (now - lastFrameAt) / 1_000;
      lastFrameAt = now;
      if (currentProps.isRunning && state.status === 'running') {
        state = advanceGame(state, delta);
      }

      context.setTransform(
        canvas.width / WORLD_WIDTH,
        0,
        0,
        canvas.height / WORLD_HEIGHT,
        0,
        0,
      );
      drawGameScene(context, state, frames, now);

      if (lastSnapshotAt === 0 || now - lastSnapshotAt >= 120) {
        currentProps.onSnapshot(toGameSnapshot(state));
        lastSnapshotAt = now;
      }

      if (state.status !== 'running' && !finishNotified) {
        finishNotified = true;
        currentProps.onFinish(state);
      }

      animationFrame = window.requestAnimationFrame(render);
    };

    animationFrame = window.requestAnimationFrame(render);
    return () => {
      active = false;
      window.cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="game-canvas"
      width={WORLD_WIDTH}
      height={WORLD_HEIGHT}
      role="img"
      aria-label={`第 ${props.level.id} 關：${props.level.name}，跑酷遊戲畫面`}
    />
  );
}
