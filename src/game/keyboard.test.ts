import { describe, expect, it, vi } from 'vitest';
import { isInteractiveKeyboardTarget } from './keyboard';

describe('keyboard shortcut targets', () => {
  it('recognizes interactive targets so native Space and Enter remain available', () => {
    const closest = vi.fn(() => ({} as Element));
    const target = { closest } as unknown as EventTarget;

    expect(isInteractiveKeyboardTarget(target)).toBe(true);
    expect(closest).toHaveBeenCalledWith(
      expect.stringContaining('button, a, input'),
    );
  });

  it('allows gameplay shortcuts when focus is not on an interactive target', () => {
    const target = { closest: vi.fn(() => null) } as unknown as EventTarget;

    expect(isInteractiveKeyboardTarget(target)).toBe(false);
    expect(isInteractiveKeyboardTarget(null)).toBe(false);
  });
});
