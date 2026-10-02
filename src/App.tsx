import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import CharacterPreview from './components/CharacterPreview';
import GameCanvas from './components/GameCanvas';
import {
  CUSTOM_GAME_TUNING,
  getDoubleJumpStatus,
  getRunSpeed,
  type GameSnapshot,
  type GameState,
  type PlayerAction,
} from './game/engine';
import { getLevel, LEVELS } from './game/levels';
import {
  OrderedPlayerActionQueue,
  reduceSlideSources,
  type SlideSourceEvent,
} from './game/input';
import { getObstacleCue } from './game/obstaclePattern';
import {
  readProgress,
  recordRun,
  writeProgress,
  type ProgressData,
} from './game/progress';
import { isInteractiveKeyboardTarget } from './game/keyboard';

type Screen = 'menu' | 'playing' | 'paused' | 'result';

const INITIAL_SNAPSHOT: GameSnapshot = {
  score: 0,
  distance: 0,
  goalDistance: LEVELS[0]!.distanceGoal,
  progress: 0,
  energy: CUSTOM_GAME_TUNING.startingEnergy,
  collectibles: 0,
  combo: 0,
  speed: LEVELS[0]!.baseSpeed,
  doubleJumpStatus: 'recovered',
  cue: null,
};

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 44 44" fill="none">
        <path
          d="M8 27.8c-2.5-1.1-3.2-4.3-1.5-6.3 1.2-1.4 3-1.7 4.6-1.2C11.8 14.7 16.4 10 22 10c5.7 0 10.2 4.6 10.9 10.2 2.1-.5 4.5.6 5.1 2.8.9 2.9-1.3 5.8-4.3 5.8H12.1c-1.6 0-3-.3-4.1-1Z"
          fill="currentColor"
        />
        <path d="m17 34 3.2-3.7M24 35l3.2-3.7M31 34l2.4-3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M6.5 4.5v11m7-11v11" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="m7 4.8 8.4 4.5a.8.8 0 0 1 0 1.4L7 15.2a.8.8 0 0 1-1.2-.7V5.5a.8.8 0 0 1 1.2-.7Z" fill="currentColor" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="4.2" y="8.5" width="11.6" height="8.4" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6.8 8.5V6.2a3.2 3.2 0 0 1 6.4 0v2.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function formatNumber(value: number): string {
  return Math.floor(value).toLocaleString('zh-TW');
}

function formatMeters(centimeters: number): string {
  return `${formatNumber(centimeters / 100)} m`;
}

function getSnapshot(state: GameState): GameSnapshot {
  return {
    score: Math.floor(state.score),
    distance: state.distance,
    goalDistance: state.level.distanceGoal,
    progress: Math.min(state.distance / state.level.distanceGoal, 1),
    energy: state.energy,
    collectibles: state.collectibles,
    combo: state.combo,
    speed: getRunSpeed(state.level, state.distance),
    doubleJumpStatus: getDoubleJumpStatus(state.player),
    cue: getObstacleCue(state.level, state.distance, state.player),
  };
}

function App() {
  const [progress, setProgress] = useState<ProgressData>(() => readProgress());
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const [selectedLevelId, setSelectedLevelId] = useState(progress.unlockedLevel);
  const [activeLevelId, setActiveLevelId] = useState(1);
  const [screen, setScreen] = useState<Screen>('menu');
  const [runKey, setRunKey] = useState(0);
  const [snapshot, setSnapshot] = useState<GameSnapshot>(INITIAL_SNAPSHOT);
  const [actionQueue] = useState(() => new OrderedPlayerActionQueue());
  const [actionQueueVersion, setActionQueueVersion] = useState(0);
  const [outcome, setOutcome] = useState<'won' | 'lost' | null>(null);
  const [accessibleHintsEnabled, setAccessibleHintsEnabled] = useState(false);
  const actionIdRef = useRef(0);
  const runKeyRef = useRef(runKey);
  runKeyRef.current = runKey;
  const slideSourcesRef = useRef<ReadonlySet<string>>(new Set());
  const [slideHeld, setSlideHeld] = useState(false);
  const [slideAnnouncement, setSlideAnnouncement] = useState('');
  const slideButtonRef = useRef<HTMLButtonElement>(null);
  const pulseTimerRef = useRef<number | null>(null);
  const clickSuppressionTimerRef = useRef<number | null>(null);
  const suppressNextSlideClickRef = useRef(false);
  const releaseAllSlideSourcesRef = useRef<
    (announce?: boolean, notifyGameCanvas?: boolean) => void
  >(() => {});
  const dialogRef = useRef<HTMLDivElement>(null);
  const dialogPrimaryRef = useRef<HTMLButtonElement>(null);
  const gameRegionRef = useRef<HTMLElement>(null);
  const mapHeadingRef = useRef<HTMLHeadingElement>(null);
  const previousScreenRef = useRef<Screen>('menu');

  const activeLevel = getLevel(activeLevelId);
  const selectedLevel = getLevel(selectedLevelId);
  const isCleared = progress.clearedLevels.includes(activeLevel.id);
  const doubleJumpStatusLabel =
    snapshot.doubleJumpStatus === 'available'
      ? '可用'
      : snapshot.doubleJumpStatus === 'used'
        ? '已用'
        : '落地恢復';

  const sendAction = (action: PlayerAction, notifyGameCanvas = true): void => {
    if (action !== 'slideEnd' && screen !== 'playing') {
      return;
    }

    actionIdRef.current += 1;
    actionQueue.enqueue({
      id: actionIdRef.current,
      runKey: runKeyRef.current,
      action,
    });
    if (notifyGameCanvas) {
      setActionQueueVersion((version) => version + 1);
    }
  };

  const dispatchSlideSourceEvent = (
    event: SlideSourceEvent,
    announce = true,
    notifyGameCanvas = true,
  ): void => {
    const result = reduceSlideSources(slideSourcesRef.current, event);
    slideSourcesRef.current = result.sources;
    if (!result.action) {
      return;
    }

    const isHeld = result.action === 'slideStart';
    if (announce) {
      setSlideHeld(isHeld);
      setSlideAnnouncement(
        isHeld ? '滑行中，放開即可恢復跑步。' : '已恢復跑步。',
      );
    }
    sendAction(result.action, notifyGameCanvas);
  };

  const clearClickSuppression = (): void => {
    if (clickSuppressionTimerRef.current !== null) {
      window.clearTimeout(clickSuppressionTimerRef.current);
      clickSuppressionTimerRef.current = null;
    }
    suppressNextSlideClickRef.current = false;
  };

  const suppressNextSlideClick = (): void => {
    clearClickSuppression();
    suppressNextSlideClickRef.current = true;
    clickSuppressionTimerRef.current = window.setTimeout(() => {
      suppressNextSlideClickRef.current = false;
      clickSuppressionTimerRef.current = null;
    }, 800);
  };

  const releaseAllSlideSources = (
    announce = true,
    notifyGameCanvas = true,
  ): void => {
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }
    clearClickSuppression();
    dispatchSlideSourceEvent(
      { type: 'releaseAll' },
      announce,
      notifyGameCanvas,
    );
  };
  releaseAllSlideSourcesRef.current = releaseAllSlideSources;

  const beginSlidePointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    if (event.button !== 0 || event.currentTarget.disabled) {
      return;
    }

    suppressNextSlideClick();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture can fail if a browser cancels the pointer before dispatch.
    }
    dispatchSlideSourceEvent({
      type: 'press',
      source: `pointer:${event.pointerId}`,
    });
  };

  const endSlidePointer = (
    event: ReactPointerEvent<HTMLButtonElement>,
  ): void => {
    dispatchSlideSourceEvent({
      type: 'release',
      source: `pointer:${event.pointerId}`,
    });
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    } catch {
      // The browser may already have released capture during cancellation.
    }
  };

  const getSlideButtonKeySource = (
    event: Pick<KeyboardEvent, 'code' | 'key'>,
  ): string | null => {
    if (event.code === 'Space' || event.key === ' ') {
      return 'slide-button-key:Space';
    }
    if (event.key === 'Enter') {
      return 'slide-button-key:Enter';
    }
    return null;
  };

  const beginSlideButtonKey = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void => {
    const source = getSlideButtonKeySource(event.nativeEvent);
    if (!source || event.repeat || event.currentTarget.disabled) {
      return;
    }

    event.preventDefault();
    suppressNextSlideClick();
    dispatchSlideSourceEvent({ type: 'press', source });
  };

  const endSlideButtonKey = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
  ): void => {
    const source = getSlideButtonKeySource(event.nativeEvent);
    if (!source) {
      return;
    }

    event.preventDefault();
    dispatchSlideSourceEvent({ type: 'release', source });
  };

  const handleSlideButtonClick = (
    event: ReactMouseEvent<HTMLButtonElement>,
  ): void => {
    if (event.detail > 0) {
      clearClickSuppression();
      return;
    }

    if (suppressNextSlideClickRef.current) {
      clearClickSuppression();
      return;
    }

    dispatchSlideSourceEvent({ type: 'press', source: 'sr-click-pulse' });
    if (pulseTimerRef.current !== null) {
      window.clearTimeout(pulseTimerRef.current);
    }
    pulseTimerRef.current = window.setTimeout(() => {
      dispatchSlideSourceEvent({
        type: 'release',
        source: 'sr-click-pulse',
      });
      pulseTimerRef.current = null;
    }, 600);
  };

  useEffect(() => {
    writeProgress(progress);
  }, [progress]);

  useEffect(() => {
    const onWindowBlur = (): void => {
      releaseAllSlideSourcesRef.current();
    };
    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'hidden') {
        releaseAllSlideSourcesRef.current();
        setScreen((current) =>
          current === 'playing' ? 'paused' : current,
        );
      }
    };

    window.addEventListener('blur', onWindowBlur);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      window.removeEventListener('blur', onWindowBlur);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      releaseAllSlideSourcesRef.current(false, false);
    };
  }, []);

  useLayoutEffect(() => {
    const previousScreen = previousScreenRef.current;
    if (screen === 'paused' || screen === 'result') {
      dialogPrimaryRef.current?.focus();
    } else if (screen === 'playing' && previousScreen !== 'playing') {
      gameRegionRef.current?.focus({ preventScroll: true });
    } else if (screen === 'menu' && previousScreen !== 'menu') {
      mapHeadingRef.current?.focus();
    }
    previousScreenRef.current = screen;
  }, [screen]);

  const startLevel = (levelId: number): void => {
    const level = getLevel(levelId);
    if (level.id > progressRef.current.unlockedLevel) {
      return;
    }

    releaseAllSlideSources();
    setActiveLevelId(level.id);
    setSelectedLevelId(level.id);
    setSnapshot({
      ...INITIAL_SNAPSHOT,
      goalDistance: level.distanceGoal,
      speed: level.baseSpeed,
    });
    setOutcome(null);
    const nextRunKey = runKeyRef.current + 1;
    runKeyRef.current = nextRunKey;
    setRunKey(nextRunKey);
    setScreen('playing');
  };

  const returnToMenu = (): void => {
    releaseAllSlideSources();
    setScreen('menu');
    setOutcome(null);
  };

  const togglePause = (): void => {
    if (screen === 'playing') {
      releaseAllSlideSources();
      setScreen('paused');
    } else if (screen === 'paused') {
      setScreen('playing');
    }
  };

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>): void => {
    if (event.key === 'Escape') {
      if (screen === 'paused') {
        event.preventDefault();
        togglePause();
      }
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = dialogRef.current;
    const focusableElements = dialog?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])',
    );
    if (!dialog || !focusableElements?.length) {
      event.preventDefault();
      return;
    }

    const first = focusableElements[0]!;
    const last = focusableElements[focusableElements.length - 1]!;
    const focusIsInsideDialog = dialog.contains(document.activeElement);

    if (event.shiftKey && (document.activeElement === first || !focusIsInsideDialog)) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !focusIsInsideDialog)
    ) {
      event.preventDefault();
      first.focus();
    }
  };

  const finishRun = (finalState: GameState): void => {
    releaseAllSlideSources();
    const cleared = finalState.status === 'won';
    const nextProgress = recordRun(
      progressRef.current,
      finalState.level.id,
      finalState.score,
      finalState.collectibles,
      cleared,
    );
    progressRef.current = nextProgress;
    setProgress(nextProgress);
    setSnapshot(getSnapshot(finalState));
    if (cleared && finalState.level.id < LEVELS.length) {
      setSelectedLevelId(finalState.level.id + 1);
    }
    setOutcome(cleared ? 'won' : 'lost');
    setScreen('result');
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.defaultPrevented) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'escape' || key === 'p') {
        if (screen === 'playing' || screen === 'paused') {
          event.preventDefault();
          togglePause();
        }
        return;
      }

      if (
        screen === 'playing' &&
        !event.repeat &&
        (key === 'arrowdown' || key === 's')
      ) {
        event.preventDefault();
        dispatchSlideSourceEvent({
          type: 'press',
          source: `keyboard:${key === 'arrowdown' ? 'ArrowDown' : 'S'}`,
        });
        return;
      }

      const interactiveTarget = isInteractiveKeyboardTarget(event.target);
      if (
        interactiveTarget &&
        (event.code === 'Space' || key === ' ' || key === 'enter')
      ) {
        return;
      }

      if (
        screen === 'menu' &&
        (key === 'enter' || key === ' ')
      ) {
        event.preventDefault();
        startLevel(selectedLevelId);
        return;
      }

      if (event.repeat || screen !== 'playing') {
        return;
      }

      if (event.code === 'Space' || key === 'arrowup' || key === 'w') {
        event.preventDefault();
        sendAction('jump');
      }
    };

    const onKeyUp = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if (key === 'arrowdown' || key === 's') {
        dispatchSlideSourceEvent({
          type: 'release',
          source: `keyboard:${key === 'arrowdown' ? 'ArrowDown' : 'S'}`,
        });
        return;
      }

      const source = getSlideButtonKeySource(event);
      if (source) {
        dispatchSlideSourceEvent({ type: 'release', source });
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [screen, selectedLevelId]);

  const reachedAllStages = progress.clearedLevels.length === LEVELS.length;
  const journeyProgressPercent = Math.floor(
    (progress.clearedLevels.length / LEVELS.length) * 100,
  );

  return (
    <main className="app-shell">
      {screen === 'menu' ? (
        <>
          <header className="site-header">
            <a className="brand" href="#top" aria-label="雲尾衝刺日記首頁">
              <BrandMark />
              <span className="brand-wordmark">
                <strong>雲尾衝刺日記</strong>
                <small>TALE OF TINY TRAILS</small>
              </span>
            </a>
            <div className="header-actions">
              <span className="header-progress">
                <span className="header-progress-dot" />
                {progress.clearedLevels.length} / {LEVELS.length} 已通關
              </span>
              <a className="header-link" href="#level-map">
                旅程地圖 <ArrowIcon />
              </a>
            </div>
          </header>

          <div className="page-container" id="top">
            <section className="hero-section">
              <div className="hero-copy">
                <p className="eyebrow">
                  <span className="eyebrow-line" />
                  一段慢慢變快的旅程
                </p>
                <h1>
                  雲尾
                  <br />
                  <span>衝刺日記</span>
                </h1>
                <p className="hero-description">
                  跟著小跑者穿越 {LEVELS.length} 段各有風景的步道。跳過樹樁、滑過低門，
                  收集沿路的能量果實，朝下一個山丘出發。
                </p>
                <div className="hero-actions">
                  <button
                    className="button button-primary button-large"
                    type="button"
                    onClick={() => startLevel(selectedLevelId)}
                  >
                    <PlayIcon />
                    開始第 {String(selectedLevelId).padStart(2, '0')} 關
                    <ArrowIcon />
                  </button>
                  <a className="text-link" href="#level-map">
                    選擇步道 <ArrowIcon />
                  </a>
                </div>
                <label className="accessible-hints-toggle">
                  <input
                    type="checkbox"
                    checked={accessibleHintsEnabled}
                    onChange={(event) => setAccessibleHintsEnabled(event.target.checked)}
                  />
                  <span>
                    <strong>開啟螢幕閱讀器跑道提示</strong>
                    <small>由輔助技術播報關卡開始、前方障礙與結算結果。</small>
                  </span>
                </label>

                <div className="hero-stats" aria-label="冒險紀錄">
                  <div className="hero-stat">
                    <strong>{String(progress.clearedLevels.length).padStart(2, '0')}</strong>
                    <span>已完成關卡</span>
                  </div>
                  <span className="stat-divider" />
                  <div className="hero-stat">
                    <strong>{formatNumber(progress.totalCollectibles)}</strong>
                    <span>收集能量果實</span>
                  </div>
                  <span className="stat-divider" />
                  <div className="hero-stat">
                    <strong>{String(progress.unlockedLevel).padStart(2, '0')}</strong>
                    <span>目前旅程</span>
                  </div>
                </div>
              </div>

              <div className="hero-art-card">
                <div className="art-card-topline">
                  <div>
                    <span className="art-card-label">接下來的步道</span>
                    <strong>{selectedLevel.region}</strong>
                  </div>
                  <span className="level-chip">
                    STAGE {String(selectedLevel.id).padStart(2, '0')}
                  </span>
                </div>
                <div className="hero-landscape">
                  <div className="landscape-sun" />
                  <div className="landscape-cloud landscape-cloud-one" />
                  <div className="landscape-cloud landscape-cloud-two" />
                  <div className="landscape-hill landscape-hill-back" />
                  <div className="landscape-hill landscape-hill-front" />
                  <div className="landscape-path" />
                  <div className="landscape-flower flower-one" aria-hidden="true">✳</div>
                  <div className="landscape-flower flower-two" aria-hidden="true">✳</div>
                  <div className="preview-orb orb-one" />
                  <div className="preview-orb orb-two" />
                  <CharacterPreview />
                  <div className="landscape-ground" />
                  <div className="landscape-caption">
                    <span>沿著風，向前跑</span>
                    <span className="caption-sparkle">✦</span>
                  </div>
                </div>
                <div className="art-card-footer">
                  <div>
                    <span className="footer-overline">路程目標</span>
                    <strong>{formatMeters(selectedLevel.distanceGoal)}</strong>
                  </div>
                  <div className="route-dots" aria-hidden="true">
                    <span className="route-dot route-dot-active" />
                    <span />
                    <span />
                    <span />
                    <span />
                    <span className="route-dot route-dot-end">✦</span>
                  </div>
                  <div className="footer-next">
                    <span className="footer-overline">難度</span>
                    <strong>{'●'.repeat(selectedLevel.difficulty)}<i>{'●'.repeat(5 - selectedLevel.difficulty)}</i></strong>
                  </div>
                </div>
              </div>
            </section>

            <section className="how-to-play" aria-label="玩法提示">
              <div className="how-to-heading">
                <span className="how-to-icon">?</span>
                <div>
                  <strong>跑起來很簡單</strong>
                  <span>看見障礙，及時反應</span>
                </div>
              </div>
              <div className="how-to-rule" />
              <div className="how-to-tip">
                <span className="keycap">空白鍵 / ↑</span>
                <span>先跳躍；離地後再按一次，可完成二段跳</span>
              </div>
              <div className="how-to-tip">
                <span className="keycap">↓ / S 按住</span>
                <span>持續滑過連續低門，最後一座通過後放開</span>
              </div>
              <div className="how-to-tip">
                <span className="tip-energy">✦</span>
                <span>跳躍／滑行收集不同高度的果實</span>
              </div>
            </section>

            <section className="level-map" id="level-map">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">
                    <span className="eyebrow-line" />
                    旅程地圖
                  </p>
                  <h2 ref={mapHeadingRef} tabIndex={-1}>
                    {LEVELS.length} 段步道，越跑越遠。
                  </h2>
                </div>
                <div className="map-progress">
                  <span className="map-progress-label">旅程進度</span>
                  <strong>{progress.clearedLevels.length}<small> / {LEVELS.length}</small></strong>
                  <div className="map-progress-track">
                    <span style={{ width: `${journeyProgressPercent}%` }} />
                  </div>
                </div>
              </div>

              {reachedAllStages && (
                <div className="all-clear-banner">
                  <span>✦</span>
                  {LEVELS.length} 段步道都已完成，謝謝你陪小跑者跑到星光站！
                </div>
              )}

              <div className="level-grid">
                {LEVELS.map((level) => {
                  const locked = level.id > progress.unlockedLevel;
                  const cleared = progress.clearedLevels.includes(level.id);
                  const active = selectedLevelId === level.id;
                  const accentStyle = {
                    '--level-accent': level.palette.accent,
                  } as CSSProperties;

                  return (
                    <button
                      className={`level-card${active ? ' level-card-selected' : ''}${locked ? ' level-card-locked' : ''}${cleared ? ' level-card-cleared' : ''}`}
                      key={level.id}
                      type="button"
                      style={accentStyle}
                      disabled={locked}
                      onClick={() => setSelectedLevelId(level.id)}
                      aria-pressed={active}
                      aria-label={
                        locked
                          ? `第 ${level.id} 關 ${level.name}，尚未解鎖`
                          : `選擇第 ${level.id} 關 ${level.name}${cleared ? '，已通關' : ''}`
                      }
                    >
                      <div className="level-card-top">
                        <span className="level-number">{String(level.id).padStart(2, '0')}</span>
                        {locked ? (
                          <span className="level-status level-status-locked"><LockIcon /></span>
                        ) : cleared ? (
                          <span className="level-status level-status-clear">✓</span>
                        ) : (
                          <span className="level-status level-status-open">↗</span>
                        )}
                      </div>
                      <strong className="level-name">{level.name}</strong>
                      <span className="level-region">{level.region}</span>
                      {locked && (
                        <span className="level-lock-copy">尚未解鎖</span>
                      )}
                      <span className="level-card-bottom">
                        <span>{formatMeters(level.distanceGoal)}</span>
                        <span className="difficulty-dots" aria-label={`難度 ${level.difficulty} / 5`}>
                          {Array.from({ length: 5 }, (_, index) => (
                            <i className={index < level.difficulty ? 'dot-active' : ''} key={index} />
                          ))}
                        </span>
                      </span>
                      {cleared && progress.bestScores[level.id] ? (
                        <span className="level-best">最佳 {formatNumber(progress.bestScores[level.id]!)}</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <p className="map-footnote">
                完成目前關卡即可解鎖下一段步道。最佳分數與收集紀錄只儲存在這台裝置。
              </p>
            </section>

            <footer className="site-footer">
              <span><BrandMark /> 雲尾衝刺日記</span>
              <span>一段專屬於你的輕快旅程</span>
            </footer>
          </div>
        </>
      ) : (
        <div className="game-page">
          <header className="game-header">
            <button
              className="back-button"
              type="button"
              aria-label="返回旅程地圖"
              onClick={returnToMenu}
            >
              <span className="back-arrow">←</span>
              <span>旅程地圖</span>
            </button>
            <div className="game-stage-title">
              <span>STAGE {String(activeLevel.id).padStart(2, '0')}</span>
              <strong>{activeLevel.name}</strong>
            </div>
            <div
              className="best-score game-header-best"
              role="group"
              aria-label={`本關最佳分數 ${formatNumber(progress.bestScores[activeLevel.id] ?? 0)}`}
            >
              <span>本關最佳</span>
              <strong>{formatNumber(progress.bestScores[activeLevel.id] ?? 0)}</strong>
            </div>
            {screen === 'result' ? (
              <span className={`game-status-tag ${outcome === 'won' ? 'status-success' : 'status-failure'}`}>
                {outcome === 'won' ? '步道完成' : '本次結束'}
              </span>
            ) : (
              <button
                className="pause-button"
                type="button"
                onClick={togglePause}
              >
                <PauseIcon />
                <span>暫停</span>
                <kbd>P</kbd>
              </button>
            )}
          </header>

          <div className="game-page-container">
            <div className="game-intro-row">
              <div>
                <p className="eyebrow">
                  <span className="eyebrow-line" />
                  {activeLevel.region}
                </p>
                <h1>{activeLevel.name}</h1>
                <p className="game-subtitle">{activeLevel.description}</p>
              </div>
            </div>

            <div className="game-layout">
              <section
                className="game-main"
                aria-label="遊戲區"
                ref={gameRegionRef}
                tabIndex={-1}
              >
                <div className="hud-grid">
                  <div className="hud-card hud-score">
                    <span className="hud-label">星光分數</span>
                    <strong>{formatNumber(snapshot.score)}</strong>
                    <span className="hud-symbol score-symbol">✦</span>
                  </div>
                  <div className="hud-card hud-energy">
                    <div className="energy-heading">
                      <span className="hud-label">體力</span>
                      <strong>{Math.round(snapshot.energy)}%</strong>
                    </div>
                    <div
                      className="energy-track"
                      role="progressbar"
                      aria-label="剩餘體力"
                      aria-valuenow={Math.round(snapshot.energy)}
                      aria-valuemin={0}
                      aria-valuemax={CUSTOM_GAME_TUNING.startingEnergy}
                    >
                      <span style={{ width: `${Math.max(0, Math.min(100, snapshot.energy))}%` }} />
                    </div>
                    <span className="hud-symbol energy-symbol">✦</span>
                  </div>
                </div>

                <div className="distance-row">
                  <div>
                    <span>步道進度</span>
                    <strong>{formatMeters(snapshot.distance)} <i>/</i> {formatMeters(snapshot.goalDistance)}</strong>
                  </div>
                  <strong className="progress-percent">{Math.floor(snapshot.progress * 100)}%</strong>
                </div>
                <div
                  className="run-progress-track"
                  role="progressbar"
                  aria-label="關卡路程進度"
                  aria-valuenow={Math.floor(snapshot.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${Math.max(0, Math.min(100, snapshot.progress * 100))}%` }} />
                  <i />
                </div>

                <div
                  className={`double-jump-status-card double-jump-status-${snapshot.doubleJumpStatus}`}
                  role="group"
                  aria-label={`二段跳狀態：${doubleJumpStatusLabel}`}
                >
                  <span className="double-jump-status-title">二段跳</span>
                  <strong className="double-jump-status-value">
                    <i aria-hidden="true" />
                    {doubleJumpStatusLabel}
                  </strong>
                </div>

                <div className={`game-scene${screen === 'paused' || screen === 'result' ? ' game-scene-muted' : ''}`}>
                  <GameCanvas
                    level={activeLevel}
                    runKey={runKey}
                    isRunning={screen === 'playing'}
                    accessibleHintsEnabled={accessibleHintsEnabled}
                    actionQueue={actionQueue}
                    actionQueueVersion={actionQueueVersion}
                    onSnapshot={setSnapshot}
                    onFinish={finishRun}
                  />

                  {screen === 'paused' && (
                    <div
                      className="scene-overlay"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="game-dialog-title"
                      ref={dialogRef}
                      onKeyDown={handleDialogKeyDown}
                    >
                      <div className="overlay-card pause-overlay-card">
                        <span className="overlay-kicker">先歇一會兒</span>
                        <h2 id="game-dialog-title">旅程暫停中</h2>
                        <p>喝口水，準備好再繼續向前。</p>
                        <button
                          ref={dialogPrimaryRef}
                          className="button button-primary"
                          type="button"
                          onClick={togglePause}
                        >
                          <PlayIcon /> 繼續奔跑
                        </button>
                        <button className="overlay-text-button" type="button" onClick={() => startLevel(activeLevel.id)}>
                          重新開始本關
                        </button>
                      </div>
                    </div>
                  )}

                  {screen === 'result' && (
                    <div
                      className="scene-overlay"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="game-dialog-title"
                      ref={dialogRef}
                      onKeyDown={handleDialogKeyDown}
                    >
                      <div className={`overlay-card result-overlay-card ${outcome === 'won' ? 'result-win' : 'result-loss'}`}>
                        <span className={`result-emblem ${outcome === 'won' ? 'emblem-win' : 'emblem-loss'}`}>
                          {outcome === 'won' ? '✦' : '…'}
                        </span>
                        <span className="overlay-kicker">
                          {outcome === 'won' ? '步道完成' : '旅程結算'}
                        </span>
                        <h2 id="game-dialog-title">
                          {outcome === 'won' ? '跑得真棒！' : '休息一下，再試一次'}
                        </h2>
                        <p>
                          {outcome === 'won'
                            ? activeLevel.id < LEVELS.length
                              ? `下一段「${getLevel(activeLevel.id + 1).name}」已經解鎖。`
                              : `${LEVELS.length} 段步道全數完成，小跑者抵達星光站！`
                            : '體力已耗盡；收集能量果實補充體力，再試著跑得更遠。'}
                        </p>
                        <div className="result-summary">
                          <div><span>星光分數</span><strong>{formatNumber(snapshot.score)}</strong></div>
                          <div><span>能量果實</span><strong>{snapshot.collectibles}</strong></div>
                          <div><span>完成路程</span><strong>{formatMeters(snapshot.distance)}</strong></div>
                        </div>
                        <div className="result-actions">
                          {outcome === 'won' && activeLevel.id < LEVELS.length && (
                            <button
                              ref={dialogPrimaryRef}
                              className="button button-primary"
                              type="button"
                              onClick={() => startLevel(activeLevel.id + 1)}
                            >
                              下一關 <ArrowIcon />
                            </button>
                          )}
                          <button
                            ref={
                              outcome === 'won' && activeLevel.id < LEVELS.length
                                ? undefined
                                : dialogPrimaryRef
                            }
                            className={`button ${outcome === 'won' && activeLevel.id < LEVELS.length ? 'button-secondary' : 'button-primary'}`}
                            type="button"
                            onClick={() => startLevel(activeLevel.id)}
                          >
                            {outcome === 'won' ? '再跑一次' : '重新挑戰'}
                          </button>
                          <button className="overlay-text-button" type="button" onClick={returnToMenu}>
                            回到旅程地圖
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {screen !== 'result' && (
                  <div className={`game-controls game-controls-${screen}`}>
                    <div className="control-hint">
                      <span className="control-hint-dot" />
                      <span>
                        {screen === 'paused'
                          ? '暫停中'
                          : snapshot.cue?.kind === 'hold' && slideHeld
                            ? '滑行中；最後一座低門通過後放開。'
                            : snapshot.cue
                              ? snapshot.cue.text
                              : slideHeld
                                ? '滑行中，放開即可恢復跑步。'
                                : snapshot.combo > 1
                            ? `連續收集 × ${snapshot.combo}`
                            : '自動向前奔跑'}
                      </span>
                    </div>
                    <div className="touch-controls" role="group" aria-label="遊戲操作">
                      <button
                        className="touch-button touch-jump"
                        type="button"
                        aria-label="跳躍（Space、向上鍵或 W）"
                        onClick={() => sendAction('jump')}
                        disabled={screen !== 'playing'}
                      >
                        <span className="touch-icon">⌃</span>
                        <span>跳躍</span>
                        <kbd>Space / ↑ / W</kbd>
                      </button>
                      <button
                        ref={slideButtonRef}
                        className={`touch-button touch-slide${slideHeld ? ' touch-slide-held' : ''}`}
                        type="button"
                        aria-label={
                          slideHeld
                            ? '滑行中，放開即可恢復跑步'
                            : '按住滑行；向下鍵或 S，聚焦按鈕時也可按住 Space 或 Enter；放開即恢復跑步'
                        }
                        aria-keyshortcuts="ArrowDown S Space Enter"
                        onPointerDown={beginSlidePointer}
                        onPointerUp={endSlidePointer}
                        onPointerCancel={endSlidePointer}
                        onLostPointerCapture={endSlidePointer}
                        onKeyDown={beginSlideButtonKey}
                        onKeyUp={endSlideButtonKey}
                        onClick={handleSlideButtonClick}
                        disabled={screen !== 'playing'}
                      >
                        <span className="touch-icon">⌄</span>
                        <span>{slideHeld ? '滑行中' : '滑行'}</span>
                        <kbd>{slideHeld ? '放開恢復跑步' : '按住 ↓ / S'}</kbd>
                      </button>
                    </div>
                  </div>
                )}
                <p className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
                  {slideAnnouncement}
                </p>
              </section>

              <aside className="mission-panel">
                <div className="mission-card">
                  <div className="mission-card-heading">
                    <span className="mission-icon">✧</span>
                    <span>本遊戲自訂任務</span>
                  </div>
                  <h2>跑完這段步道</h2>
                  <p>抵達終點即可解鎖下一關，沿途收集能量果實可延長本次奔跑。</p>
                  <div className="mission-goal">
                    <span className="goal-track-icon">↗</span>
                    <span><small>目標路程</small><strong>{formatMeters(activeLevel.distanceGoal)}</strong></span>
                  </div>
                  <div className="mission-goal">
                    <span className="goal-collect-icon">✦</span>
                    <span><small>本次收集</small><strong>{snapshot.collectibles} 顆能量果實</strong></span>
                  </div>
                </div>

                <div className="guide-card">
                  <h3>前方怎麼走</h3>
                  <div className="guide-row">
                    <span className="guide-visual guide-stump">▰</span>
                    <span><strong>樹樁 / 裂隙</strong><small>按跳躍越過</small></span>
                    <kbd>↑</kbd>
                  </div>
                  <div className="guide-row">
                    <span className="guide-visual guide-stump">▰</span>
                    <span><strong>緊接樹樁 / 高樹樁</strong><small>先離地，再按一次二段跳</small></span>
                    <kbd>↑ ×2</kbd>
                  </div>
                  <div className="guide-row">
                    <span className="guide-visual guide-arch">⌒</span>
                    <span><strong>連續低門</strong><small>按住滑行；最後一座通過後放開</small></span>
                    <kbd>↓ / S</kbd>
                  </div>
                </div>

                <p className="energy-note">
                  <span>✦</span>
                  本 Prototype 自訂平衡（非官方數值）：起跑體力 {CUSTOM_GAME_TUNING.startingEnergy} 點；每秒 −{CUSTOM_GAME_TUNING.passiveEnergyDrainPerSecond}、碰撞 −{CUSTOM_GAME_TUNING.collisionEnergyCost}、果實 +{CUSTOM_GAME_TUNING.pickupEnergyRestore}。歸零即結束。
                </p>
                {isCleared && (
                  <div className="cleared-note">
                    <span>✓</span>
                    你已通過這一關，可以重玩並刷新最佳分數。
                  </div>
                )}
              </aside>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

export default App;
