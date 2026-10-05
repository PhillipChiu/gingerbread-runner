import type { ReactNode, Ref } from 'react';
import {
  CUSTOM_GAME_TUNING,
  type GameSnapshot,
} from '../game/engine';

interface GameMainLayoutProps {
  snapshot: GameSnapshot;
  doubleJumpStatusLabel: string;
  doubleJumpStatusCompactLabel: string;
  formatNumber: (value: number) => string;
  formatMeters: (centimeters: number) => string;
  regionRef?: Ref<HTMLElement>;
  children: ReactNode;
}

export default function GameMainLayout({
  snapshot,
  doubleJumpStatusLabel,
  doubleJumpStatusCompactLabel,
  formatNumber,
  formatMeters,
  regionRef,
  children,
}: GameMainLayoutProps) {
  return (
    <section
      className="game-main"
      aria-label="遊戲區"
      ref={regionRef}
      tabIndex={-1}
    >
      <div className="hud-grid">
        <div
          className={`double-jump-status-card double-jump-status-${snapshot.doubleJumpStatus}`}
          role="group"
          aria-label={`二段跳狀態：${doubleJumpStatusLabel}`}
        >
          <span className="double-jump-status-title">二段跳</span>
          <strong className="double-jump-status-value">
            <i aria-hidden="true" />
            <span className="double-jump-status-full">
              {doubleJumpStatusLabel}
            </span>
            <span
              className="double-jump-status-compact"
              aria-hidden="true"
            >
              {doubleJumpStatusCompactLabel}
            </span>
          </strong>
        </div>
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
            <span
              style={{
                width: `${Math.max(0, Math.min(100, snapshot.energy))}%`,
              }}
            />
          </div>
          <span className="hud-symbol energy-symbol">✦</span>
        </div>
      </div>

      <div className="distance-row">
        <div>
          <span>步道進度</span>
          <strong>
            {formatMeters(snapshot.distance)} <i>/</i>{' '}
            {formatMeters(snapshot.goalDistance)}
          </strong>
        </div>
        <strong className="progress-percent">
          {Math.floor(snapshot.progress * 100)}%
        </strong>
      </div>
      <div
        className="run-progress-track"
        role="progressbar"
        aria-label="關卡路程進度"
        aria-valuenow={Math.floor(snapshot.progress * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span
          style={{
            width: `${Math.max(0, Math.min(100, snapshot.progress * 100))}%`,
          }}
        />
        <i />
      </div>

      {children}
    </section>
  );
}
