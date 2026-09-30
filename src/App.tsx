import { useEffect, useRef, useState, type CSSProperties } from 'react';
import CharacterPreview from './components/CharacterPreview';
import GameCanvas, { type ActionRequest } from './components/GameCanvas';
import {
  CUSTOM_GAME_TUNING,
  type GameSnapshot,
  type GameState,
  type PlayerAction,
} from './game/engine';
import { getLevel, LEVELS } from './game/levels';
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
    speed: state.level.baseSpeed,
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
  const [actionRequest, setActionRequest] = useState<ActionRequest | null>(null);
  const [outcome, setOutcome] = useState<'won' | 'lost' | null>(null);
  const [accessibleHintsEnabled, setAccessibleHintsEnabled] = useState(false);
  const actionIdRef = useRef(0);

  const activeLevel = getLevel(activeLevelId);
  const selectedLevel = getLevel(selectedLevelId);
  const isCleared = progress.clearedLevels.includes(activeLevel.id);

  useEffect(() => {
    writeProgress(progress);
  }, [progress]);

  const startLevel = (levelId: number): void => {
    const level = getLevel(levelId);
    if (level.id > progressRef.current.unlockedLevel) {
      return;
    }

    setActiveLevelId(level.id);
    setSelectedLevelId(level.id);
    setSnapshot({
      ...INITIAL_SNAPSHOT,
      goalDistance: level.distanceGoal,
      speed: level.baseSpeed,
    });
    setActionRequest(null);
    setOutcome(null);
    setRunKey((key) => key + 1);
    setScreen('playing');
  };

  const returnToMenu = (): void => {
    setScreen('menu');
    setOutcome(null);
  };

  const sendAction = (action: PlayerAction): void => {
    if (screen !== 'playing') {
      return;
    }

    actionIdRef.current += 1;
    setActionRequest({ id: actionIdRef.current, action });
  };

  const togglePause = (): void => {
    if (screen === 'playing') {
      setScreen('paused');
    } else if (screen === 'paused') {
      setScreen('playing');
    }
  };

  const finishRun = (finalState: GameState): void => {
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
      if (isInteractiveKeyboardTarget(event.target)) {
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
      } else if (key === 'arrowdown' || key === 's') {
        event.preventDefault();
        sendAction('slide');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screen, selectedLevelId]);

  const reachedAllStages = progress.clearedLevels.length === LEVELS.length;

  return (
    <main className="app-shell">
      {screen === 'menu' ? (
        <>
          <header className="site-header">
            <a className="brand" href="#top" aria-label="雲尾衝刺日記首頁">
              <BrandMark />
              <span className="brand-wordmark">
                <strong>雲尾衝刺</strong>
                <small>TALE OF TINY TRAILS</small>
              </span>
            </a>
            <div className="header-actions">
              <span className="header-progress">
                <span className="header-progress-dot" />
                {progress.clearedLevels.length} / 10 已通關
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
                  跟著小跑者穿越十段各有風景的步道。跳過樹樁、滑過低門，
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
                  <div className="landscape-flower flower-one">✳</div>
                  <div className="landscape-flower flower-two">✳</div>
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
                <span>跳過樹樁與裂隙</span>
              </div>
              <div className="how-to-tip">
                <span className="keycap">↓</span>
                <span>滑過低矮拱門</span>
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
                  <h2>十段步道，越跑越遠。</h2>
                </div>
                <div className="map-progress">
                  <span className="map-progress-label">旅程進度</span>
                  <strong>{progress.clearedLevels.length}<small> / 10</small></strong>
                  <div className="map-progress-track">
                    <span style={{ width: `${progress.clearedLevels.length * 10}%` }} />
                  </div>
                </div>
              </div>

              {reachedAllStages && (
                <div className="all-clear-banner">
                  <span>✦</span>
                  十段步道都已完成，謝謝你陪小跑者跑到星光站！
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
            <button className="back-button" type="button" onClick={returnToMenu}>
              <span className="back-arrow">←</span>
              <span>旅程地圖</span>
            </button>
            <div className="game-stage-title">
              <span>STAGE {String(activeLevel.id).padStart(2, '0')}</span>
              <strong>{activeLevel.name}</strong>
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
              <div className="best-score">
                <span>本關最佳</span>
                <strong>{formatNumber(progress.bestScores[activeLevel.id] ?? 0)}</strong>
              </div>
            </div>

            <div className="game-layout">
              <section className="game-main" aria-label="遊戲區">
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
                    <div className="energy-track" aria-label={`剩餘體力 ${Math.round(snapshot.energy)}%`}>
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

                <div className={`game-scene${screen === 'paused' || screen === 'result' ? ' game-scene-muted' : ''}`}>
                  <GameCanvas
                    level={activeLevel}
                    runKey={runKey}
                    isRunning={screen === 'playing'}
                    accessibleHintsEnabled={accessibleHintsEnabled}
                    actionRequest={actionRequest}
                    onSnapshot={setSnapshot}
                    onFinish={finishRun}
                  />

                  {screen === 'paused' && (
                    <div className="scene-overlay">
                      <div className="overlay-card pause-overlay-card">
                        <span className="overlay-kicker">先歇一會兒</span>
                        <h2>旅程暫停中</h2>
                        <p>喝口水，準備好再繼續向前。</p>
                        <button className="button button-primary" type="button" onClick={togglePause}>
                          <PlayIcon /> 繼續奔跑
                        </button>
                        <button className="overlay-text-button" type="button" onClick={() => startLevel(activeLevel.id)}>
                          重新開始本關
                        </button>
                      </div>
                    </div>
                  )}

                  {screen === 'result' && (
                    <div className="scene-overlay">
                      <div className={`overlay-card result-overlay-card ${outcome === 'won' ? 'result-win' : 'result-loss'}`}>
                        <span className={`result-emblem ${outcome === 'won' ? 'emblem-win' : 'emblem-loss'}`}>
                          {outcome === 'won' ? '✦' : '…'}
                        </span>
                        <span className="overlay-kicker">
                          {outcome === 'won' ? '步道完成' : '旅程結算'}
                        </span>
                        <h2>{outcome === 'won' ? '跑得真棒！' : '休息一下，再試一次'}</h2>
                        <p>
                          {outcome === 'won'
                            ? activeLevel.id < LEVELS.length
                              ? `下一段「${getLevel(activeLevel.id + 1).name}」已經解鎖。`
                              : '十段步道全數完成，小跑者抵達星光站！'
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
                              className="button button-primary"
                              type="button"
                              onClick={() => startLevel(activeLevel.id + 1)}
                            >
                              下一關 <ArrowIcon />
                            </button>
                          )}
                          <button
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
                  <div className="game-controls">
                    <div className="control-hint">
                      <span className="control-hint-dot" />
                      <span>
                        {screen === 'paused'
                          ? '暫停中'
                          : snapshot.combo > 1
                            ? `連續收集 × ${snapshot.combo}`
                            : '自動向前奔跑'}
                      </span>
                    </div>
                    <div className="touch-controls" aria-label="觸控操作">
                      <button
                        className="touch-button touch-slide"
                        type="button"
                        onClick={() => sendAction('slide')}
                        disabled={screen !== 'playing'}
                      >
                        <span className="touch-icon">⌄</span>
                        <span>滑行</span>
                        <kbd>↓</kbd>
                      </button>
                      <button
                        className="touch-button touch-jump"
                        type="button"
                        onClick={() => sendAction('jump')}
                        disabled={screen !== 'playing'}
                      >
                        <span className="touch-icon">⌃</span>
                        <span>跳躍</span>
                        <kbd>空白</kbd>
                      </button>
                    </div>
                  </div>
                )}
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
                    <span className="guide-visual guide-arch">⌒</span>
                    <span><strong>低矮拱門</strong><small>按滑行通過</small></span>
                    <kbd>↓</kbd>
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
