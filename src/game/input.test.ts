import { describe, expect, it } from 'vitest';
import {
  OrderedPlayerActionQueue,
  reduceSlideSources,
  type SlideSourceEvent,
} from './input';

describe('held-slide input sources', () => {
  it('starts and ends the engine hold only when the source set crosses zero', () => {
    let sources: ReadonlySet<string> = new Set();
    const transitions: string[] = [];
    const press = (source: string): void => {
      const result = reduceSlideSources(sources, { type: 'press', source });
      sources = result.sources;
      if (result.action) {
        transitions.push(result.action);
      }
    };
    const release = (event: SlideSourceEvent): void => {
      const result = reduceSlideSources(sources, event);
      sources = result.sources;
      if (result.action) {
        transitions.push(result.action);
      }
    };

    press('pointer:7');
    press('pointer:19');
    press('key:ArrowDown');
    press('key:S');
    expect(transitions).toEqual(['slideStart']);
    expect(sources.size).toBe(4);

    release({ type: 'release', source: 'pointer:7' });
    release({ type: 'release', source: 'key:S' });
    expect(transitions).toEqual(['slideStart']);
    expect(sources).toEqual(new Set(['pointer:19', 'key:ArrowDown']));

    release({ type: 'releaseAll' });
    release({ type: 'releaseAll' });
    expect(transitions).toEqual(['slideStart', 'slideEnd']);
    expect(sources.size).toBe(0);
  });

  it('queues every ordered start and end action without collapsing repeated UI updates', () => {
    const queue = new OrderedPlayerActionQueue();
    queue.enqueue({ id: 1, runKey: 4, action: 'slideStart' });
    queue.enqueue({ id: 2, runKey: 4, action: 'slideEnd' });
    queue.enqueue({ id: 3, runKey: 4, action: 'slideStart' });
    queue.enqueue({ id: 4, runKey: 5, action: 'slideEnd' });

    expect(queue.drain()).toEqual([
      { id: 1, runKey: 4, action: 'slideStart' },
      { id: 2, runKey: 4, action: 'slideEnd' },
      { id: 3, runKey: 4, action: 'slideStart' },
      { id: 4, runKey: 5, action: 'slideEnd' },
    ]);
    expect(queue.drain()).toEqual([]);
  });
});
