import type { PlayerAction } from './engine';

export interface QueuedPlayerAction {
  id: number;
  runKey: number;
  action: PlayerAction;
}

export type SlideSourceEvent =
  | { type: 'press'; source: string }
  | { type: 'release'; source: string }
  | { type: 'releaseAll' };

export interface SlideSourceReduction {
  sources: ReadonlySet<string>;
  action: 'slideStart' | 'slideEnd' | null;
}

export function reduceSlideSources(
  current: ReadonlySet<string>,
  event: SlideSourceEvent,
): SlideSourceReduction {
  if (event.type === 'releaseAll') {
    return current.size > 0
      ? { sources: new Set(), action: 'slideEnd' }
      : { sources: current, action: null };
  }

  if (event.type === 'press') {
    if (current.has(event.source)) {
      return { sources: current, action: null };
    }

    const sources = new Set(current);
    sources.add(event.source);
    return {
      sources,
      action: current.size === 0 ? 'slideStart' : null,
    };
  }

  if (!current.has(event.source)) {
    return { sources: current, action: null };
  }

  const sources = new Set(current);
  sources.delete(event.source);
  return {
    sources,
    action: sources.size === 0 ? 'slideEnd' : null,
  };
}

export class OrderedPlayerActionQueue {
  private readonly requests: QueuedPlayerAction[] = [];

  enqueue(request: QueuedPlayerAction): void {
    this.requests.push(request);
  }

  drain(): QueuedPlayerAction[] {
    return this.requests.splice(0);
  }
}
