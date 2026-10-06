import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BACKGROUND_MUSIC_ISSUE_MESSAGES } from '../game/backgroundMusic';
import SoundNotice from './SoundNotice';
import SoundToggle from './SoundToggle';

function renderToggle(enabled: boolean, className?: string): string {
  return renderToStaticMarkup(
    <SoundToggle
      enabled={enabled}
      onToggle={() => undefined}
      className={className}
    />,
  );
}

describe('SoundToggle', () => {
  it('is a named toggle button that reports being pressed while music is on', () => {
    const markup = renderToggle(true);

    expect(markup).toMatch(/^<button /);
    expect(markup).toContain('type="button"');
    expect(markup).toContain('aria-label="背景音樂"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('<span class="sound-toggle-state">開</span>');
  });

  it('keeps its name when music is off and reports the state through aria-pressed', () => {
    const markup = renderToggle(false);

    expect(markup).toContain('aria-label="背景音樂"');
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('<span class="sound-toggle-state">關</span>');
  });

  it('hides its decorative speaker icon from assistive technology', () => {
    for (const enabled of [true, false]) {
      const markup = renderToggle(enabled);

      expect(markup.match(/<svg /g)).toHaveLength(1);
      expect(markup).toMatch(/<svg[^>]*aria-hidden="true"/);
      expect(markup).toMatch(/<svg[^>]*focusable="false"/);
    }
  });

  it('appends a caller class after the base class', () => {
    expect(renderToggle(true, 'sound-toggle-dialog')).toContain(
      'class="sound-toggle sound-toggle-dialog"',
    );
    expect(renderToggle(true)).toContain('class="sound-toggle"');
  });

  it.each([
    ['a mouse or touch click while on', true, 1, false, true],
    ['a keyboard activation while on', true, 0, false, false],
    ['a mouse or touch click while off', false, 1, true, true],
    ['a keyboard activation while off', false, 0, true, false],
  ])('reports %s', (_situation, enabled, detail, nextEnabled, viaPointer) => {
    const calls: [boolean, boolean][] = [];
    const toggle = SoundToggle({
      enabled,
      onToggle: (next, pointer) => {
        calls.push([next, pointer]);
      },
    });

    // Keyboard and assistive-technology activation produce click events with
    // detail 0; only real pointer clicks have a positive detail.
    toggle.props.onClick({ detail });

    expect(calls).toEqual([[nextEnabled, viaPointer]]);
  });
});

describe('SoundNotice', () => {
  it('keeps an empty status region mounted while nothing is wrong', () => {
    const markup = renderToStaticMarkup(
      <SoundNotice issue={null} onRetry={() => undefined} />,
    );

    expect(markup).toBe('<div class="sound-notice-region" role="status"></div>');
  });

  it.each(['autoplay-blocked', 'asset-unavailable', 'playback-failed'] as const)(
    'announces the %s message with a retry button inside the status region',
    (issue) => {
      const markup = renderToStaticMarkup(
        <SoundNotice issue={issue} onRetry={() => undefined} />,
      );

      expect(markup).toMatch(/^<div class="sound-notice-region" role="status">/);
      expect(markup).toContain(`data-issue="${issue}"`);
      expect(markup).toContain(`<p>${BACKGROUND_MUSIC_ISSUE_MESSAGES[issue]}</p>`);
      expect(markup).toContain(
        '<button class="sound-notice-retry" type="button">重試播放</button>',
      );
    },
  );
});
