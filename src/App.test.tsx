/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import GameMainLayout from './components/GameMainLayout';
import type { GameSnapshot } from './game/engine';

const landscapeMediaQuery =
  '@media (max-width: 900px) and (orientation: landscape) and (max-height: 520px)';
const stylesheet = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

function getBlocks(source: string, header: string): string[] {
  const blocks: string[] = [];
  let searchFrom = 0;

  while (true) {
    const blockStart = source.indexOf(header, searchFrom);
    if (blockStart < 0) {
      return blocks;
    }

    const openingBrace = source.indexOf('{', blockStart);
    let depth = 0;
    let closingBrace = openingBrace;
    for (; closingBrace < source.length; closingBrace += 1) {
      if (source[closingBrace] === '{') {
        depth += 1;
      } else if (source[closingBrace] === '}') {
        depth -= 1;
        if (depth === 0) {
          break;
        }
      }
    }

    blocks.push(source.slice(openingBrace + 1, closingBrace));
    searchFrom = closingBrace + 1;
  }
}

function getRuleDeclarations(
  source: string,
  selector: string,
): string | undefined {
  const escapedSelector = selector.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  );
  return new RegExp(`${escapedSelector}\\s*\\{([^{}]*)\\}`).exec(source)?.[1];
}

function renderGameMain(): string {
  const snapshot: GameSnapshot = {
    score: 123,
    distance: 456,
    goalDistance: 5_200,
    progress: 456 / 5_200,
    energy: 87,
    collectibles: 2,
    combo: 1,
    speed: 348,
    doubleJumpStatus: 'recovered',
    cue: null,
  };

  return renderToStaticMarkup(
    <GameMainLayout
      snapshot={snapshot}
      doubleJumpStatusLabel="落地恢復"
      doubleJumpStatusCompactLabel="恢復"
      formatNumber={(value) => String(value)}
      formatMeters={(centimeters) => `${centimeters} cm`}
    >
      <div className="game-scene" aria-label="遊戲場景" />
      <div className="game-controls game-controls-playing">
        <div className="control-hint">
          <span className="control-hint-dot" />
          <span>前方高樹樁，跳躍後再按一次。</span>
        </div>
        <div className="touch-controls" role="group" aria-label="遊戲操作">
          <button className="touch-button touch-jump" type="button">
            跳躍
          </button>
          <button className="touch-button touch-slide" type="button">
            滑行
          </button>
        </div>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite" />
    </GameMainLayout>,
  );
}

describe('mobile landscape game HUD', () => {
  it('renders the accessible double-jump card first, before progress and scene', () => {
    const markup = renderGameMain();
    const hudStart = markup.indexOf('<div class="hud-grid">');
    const distanceRowStart = markup.indexOf('<div class="distance-row">');
    const hudMarkup = markup.slice(hudStart, distanceRowStart);
    const hudCards = [...hudMarkup.matchAll(/class="([^"]+)"/g)]
      .flatMap((match) => match[1]!.split(' '))
      .filter((className) =>
        ['double-jump-status-card', 'hud-score', 'hud-energy'].includes(
          className,
        ),
      );

    expect(hudStart).toBeGreaterThanOrEqual(0);
    expect(hudCards).toEqual([
      'double-jump-status-card',
      'hud-score',
      'hud-energy',
    ]);
    expect(markup).toContain('aria-label="二段跳狀態：落地恢復"');
    expect(markup).toContain(
      '<span class="double-jump-status-compact" aria-hidden="true">恢復</span>',
    );
    expect(distanceRowStart).toBeGreaterThan(hudStart);
    expect(markup.indexOf('class="run-progress-track"')).toBeGreaterThan(
      distanceRowStart,
    );
    expect(markup.indexOf('class="game-scene"')).toBeGreaterThan(
      markup.indexOf('class="run-progress-track"'),
    );
  });

  it('lays all three cards across the HUD row and keeps touch controls at the sides', () => {
    const [layoutStyles, controlHintStyles] = getBlocks(
      stylesheet,
      landscapeMediaQuery,
    );
    expect(layoutStyles).toBeDefined();
    expect(controlHintStyles).toBeDefined();

    const gameMain = getRuleDeclarations(layoutStyles!, '.game-main');
    const hudGrid = getRuleDeclarations(layoutStyles!, '.hud-grid');
    const jumpStatusCard = getRuleDeclarations(
      layoutStyles!,
      '.hud-grid > .double-jump-status-card',
    );
    const distanceRow = getRuleDeclarations(layoutStyles!, '.distance-row');
    const progressTrack = getRuleDeclarations(
      layoutStyles!,
      '.run-progress-track',
    );
    const scene = getRuleDeclarations(layoutStyles!, '.game-scene');
    const controls = getRuleDeclarations(layoutStyles!, '.game-controls');
    const jumpButton = getRuleDeclarations(
      layoutStyles!,
      '.game-controls .touch-jump',
    );
    const slideButton = getRuleDeclarations(
      layoutStyles!,
      '.game-controls .touch-slide',
    );
    const controlHintText = getRuleDeclarations(
      controlHintStyles!,
      '.game-controls .control-hint > span:last-child',
    );

    expect(gameMain).toMatch(/grid-template-rows:\s*auto auto auto auto;/);
    expect(hudGrid).toContain('grid-column: 1 / -1;');
    expect(hudGrid).toContain('grid-row: 1;');
    expect(hudGrid).toMatch(
      /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\);/,
    );
    expect(jumpStatusCard).toContain('min-height: 34px;');
    expect(jumpStatusCard).not.toMatch(/grid-(?:column|row):/);
    expect(
      getRuleDeclarations(layoutStyles!, '.double-jump-status-full'),
    ).toContain('display: none;');
    expect(
      getRuleDeclarations(layoutStyles!, '.double-jump-status-compact'),
    ).toContain('display: inline;');
    expect(distanceRow).toContain('grid-column: 2;');
    expect(distanceRow).toContain('grid-row: 2;');
    expect(progressTrack).toContain('grid-column: 2;');
    expect(progressTrack).toContain('grid-row: 3;');
    expect(scene).toContain('grid-column: 2;');
    expect(scene).toContain('grid-row: 4;');
    expect(controls).toContain('grid-column: 1 / -1;');
    expect(controls).toContain('grid-row: 4;');
    expect(jumpButton).toContain('grid-column: 1;');
    expect(slideButton).toContain('grid-column: 3;');
    expect(
      getRuleDeclarations(
        controlHintStyles!,
        '.game-controls .control-hint',
      ),
    ).toContain('grid-column: 2;');
    expect(controlHintText).not.toMatch(/white-space:\s*nowrap/);
  });
});
