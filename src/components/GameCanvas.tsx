import { useEffect, useRef, useState } from 'react';
import {
  advanceGame,
  applyPlayerAction,
  createGameState,
  getRunSpeed,
  PLAYER_WIDTH,
  PLAYER_X,
  toGameSnapshot,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  type GameSnapshot,
  type GameState,
  type ObstacleType,
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
  accessibleHintsEnabled: boolean;
  actionRequest: ActionRequest | null;
  onSnapshot: (snapshot: GameSnapshot) => void;
  onFinish: (state: GameState) => void;
}

interface LatestProps extends GameCanvasProps {}

const OBSTACLE_HINT_LEAD_SECONDS = 1.25;
const OBSTACLE_HINT_COOLDOWN_SECONDS = 1.1;

function getObstacleHint(type: ObstacleType): string {
  switch (type) {
    case 'arch':
      return '低矮拱門，請滑行。';
    case 'gap':
      return '裂隙，請跳躍。';
    default:
      return '樹樁，請跳躍。';
  }
}

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
    let processedActionId = -1;
    let lastFrameAt = 0;
    let lastSnapshotAt = 0;
    let finishNotified = false;
    let hasDrawn = false;
    let wasActive = false;
    let hintsWereEnabled = false;
    let terminalAnnouncementRunKey = -1;
    let lastObstacleAnnouncementAt = Number.NEGATIVE_INFINITY;
    let state: GameState | null = null;
    let frames: SpriteFrame[] | null = null;
    let active = true;
    const announcedObstacleIds = new Set<number>();
    let render: (now: number) => void = () => {};

    const scheduleFrame = (): void => {
      if (active && animationFrame === null) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    void loadCharacterFrames()
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
        processedActionId = currentProps.actionRequest?.id ?? -1;
        finishNotified = false;
        lastSnapshotAt = 0;
        lastFrameAt = 0;
        terminalAnnouncementRunKey = -1;
        lastObstacleAnnouncementAt = Number.NEGATIVE_INFINITY;
        announcedObstacleIds.clear();
        wasActive = false;
        isNewRun = true;
      }

      if (
        currentProps.actionRequest &&
        currentProps.actionRequest.id !== processedActionId
      ) {
        processedActionId = currentProps.actionRequest.id;
        state = applyPlayerAction(state, currentProps.actionRequest.action);
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
      drawGameScene(context, state, frames);

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
          const warningDistance =
            getRunSpeed(state.level, state.distance) *
            OBSTACLE_HINT_LEAD_SECONDS;
          const nextObstacle = state.obstacles
            .filter(
              (obstacle) =>
                !announcedObstacleIds.has(obstacle.id) &&
                obstacle.x <= PLAYER_X + PLAYER_WIDTH + warningDistance &&
                obstacle.x + obstacle.width > PLAYER_X + PLAYER_WIDTH,
            )
            .sort((left, right) => left.x - right.x)[0];

          if (
            nextObstacle &&
            state.elapsed - lastObstacleAnnouncementAt >=
              OBSTACLE_HINT_COOLDOWN_SECONDS
          ) {
            announcedObstacleIds.add(nextObstacle.id);
            lastObstacleAnnouncementAt = state.elapsed;
            setLiveAnnouncement(
              `前方第 ${announcedObstacleIds.size} 個障礙：${getObstacleHint(nextObstacle.type)}`,
            );
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
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame);
      }
      scheduleFrameRef.current = null;
    };
  }, []);

  useEffect(() => {
    scheduleFrameRef.current?.();
  }, [props.isRunning, props.runKey, props.actionRequest?.id]);

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
