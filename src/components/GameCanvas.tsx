import { useEffect, useRef, useState } from 'react';
import {
  advanceGame,
  applyPlayerAction,
  createGameState,
  toGameSnapshot,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GameSnapshot,
  type GameState,
} from '../game/engine';
import { drawGameScene } from '../game/render';
import {
  loadRunnerSpriteFrames,
  type RunnerSpriteFrames,
} from '../game/sprites';
import type { LevelConfig } from '../game/levels';
import { getObstacleCue } from '../game/obstaclePattern';
import type { OrderedPlayerActionQueue } from '../game/input';

interface GameCanvasProps {
  level: LevelConfig;
  runKey: number;
  isRunning: boolean;
  accessibleHintsEnabled: boolean;
  actionQueue: OrderedPlayerActionQueue;
  actionQueueVersion: number;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onFinish: (state: GameState) => void;
}

interface LatestProps extends GameCanvasProps {}

export default function GameCanvas(props: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef<LatestProps>(props);
  const scheduleFrameRef = useRef<(() => void) | null>(null);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');
  propsRef.current = props;

  useEffect(() => {
    if (!props.accessibleHintsEnabled) {
      setLiveAnnouncement('');
    }
  }, [props.accessibleHintsEnabled]);

  useEffect(() => {
    let animationFrame: number | null = null;
    let currentRunKey = -1;
    let lastFrameAt = 0;
    let lastSnapshotAt = 0;
    let finishNotified = false;
    let hasDrawn = false;
    let wasActive = false;
    let hintsWereEnabled = false;
    let terminalAnnouncementRunKey = -1;
    let lastObstacleCueKey = '';
    let state: GameState | null = null;
    let frames: RunnerSpriteFrames | null = null;
    let active = true;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduceMotion = motionPreference.matches;
    let render: (now: number) => void = () => {};

    const scheduleFrame = (): void => {
      if (active && animationFrame === null) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    const onMotionPreferenceChange = (): void => {
      reduceMotion = motionPreference.matches;
      scheduleFrame();
    };
    motionPreference.addEventListener('change', onMotionPreferenceChange);

    void loadRunnerSpriteFrames()
      .then((loadedFrames) => {
        if (active) {
          frames = loadedFrames;
          scheduleFrame();
        }
      })
      .catch(() => {
        if (active) {
          frames = null;
        }
      });

    render = (now: number): void => {
      animationFrame = null;
      const currentProps = propsRef.current;
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) {
        return;
      }

      let isNewRun = false;
      if (!state || currentRunKey !== currentProps.runKey) {
        state = createGameState(currentProps.level);
        currentRunKey = currentProps.runKey;
        finishNotified = false;
        lastSnapshotAt = 0;
        lastFrameAt = 0;
        terminalAnnouncementRunKey = -1;
        lastObstacleCueKey = '';
        wasActive = false;
        isNewRun = true;
      }

      for (const request of currentProps.actionQueue.drain()) {
        if (request.runKey === currentRunKey) {
          state = applyPlayerAction(state, request.action);
        }
      }

      if (currentProps.accessibleHintsEnabled && (isNewRun || !hintsWereEnabled)) {
        const transition = isNewRun ? '開始' : '進行中';
        setLiveAnnouncement(
          `第 ${currentProps.level.id} 關「${currentProps.level.name}」${transition}。`,
        );
      } else if (!currentProps.accessibleHintsEnabled && hintsWereEnabled) {
        setLiveAnnouncement('');
      }
      hintsWereEnabled = currentProps.accessibleHintsEnabled;

      const shouldAdvance =
        currentProps.isRunning && state.status === 'running';
      const delta =
        shouldAdvance && lastFrameAt !== 0
          ? (now - lastFrameAt) / 1_000
          : 0;
      if (shouldAdvance) {
        state = advanceGame(state, delta);
        lastFrameAt = now;
      } else {
        lastFrameAt = 0;
      }

      context.setTransform(
        canvas.width / WORLD_WIDTH,
        0,
        0,
        canvas.height / WORLD_HEIGHT,
        0,
        0,
      );
      drawGameScene(context, state, frames, reduceMotion);

      const isActive =
        currentProps.isRunning && state.status === 'running';
      if (isActive && (lastSnapshotAt === 0 || now - lastSnapshotAt >= 120)) {
        currentProps.onSnapshot(toGameSnapshot(state));
        lastSnapshotAt = now;
      } else if (!isActive && (wasActive || !hasDrawn)) {
        currentProps.onSnapshot(toGameSnapshot(state));
        lastSnapshotAt = 0;
      }

      if (state.status !== 'running' && !finishNotified) {
        finishNotified = true;
        currentProps.onFinish(state);
      }

      if (currentProps.accessibleHintsEnabled) {
        if (
          state.status !== 'running' &&
          terminalAnnouncementRunKey !== currentProps.runKey
        ) {
          terminalAnnouncementRunKey = currentProps.runKey;
          setLiveAnnouncement(
            state.status === 'won'
              ? `第 ${currentProps.level.id} 關完成。`
              : `第 ${currentProps.level.id} 關結束，體力已耗盡。`,
          );
        } else if (state.status === 'running') {
          const cue = getObstacleCue(state.level, state.distance);
          if (cue && cue.key !== lastObstacleCueKey) {
            lastObstacleCueKey = cue.key;
            setLiveAnnouncement(cue.text);
          } else if (!cue) {
            lastObstacleCueKey = '';
          }
        }
      }

      hasDrawn = true;
      wasActive = isActive;
      if (isActive) {
        scheduleFrame();
      }
    };

    scheduleFrameRef.current = scheduleFrame;
    scheduleFrame();
    return () => {
      active = false;
      motionPreference.removeEventListener('change', onMotionPreferenceChange);
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      scheduleFrameRef.current = null;
    };
  }, []);

  useEffect(() => {
    scheduleFrameRef.current?.();
  }, [props.isRunning, props.runKey, props.actionQueueVersion]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="game-canvas"
        width={WORLD_WIDTH}
        height={WORLD_HEIGHT}
        role="img"
        aria-label={`第 ${props.level.id} 關：${props.level.name}，跑酷遊戲畫面`}
      />
      <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {props.accessibleHintsEnabled ? liveAnnouncement : ''}
      </p>
    </>
  );
}
