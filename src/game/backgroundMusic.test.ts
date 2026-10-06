import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BACKGROUND_MUSIC_ISSUE_MESSAGES,
  BACKGROUND_MUSIC_STORAGE_KEY,
  BACKGROUND_MUSIC_VOLUME,
  createBackgroundMusic,
  createBrowserBackgroundMusic,
  resolveBackgroundMusicUrl,
  type BackgroundMusic,
  type BackgroundMusicAudio,
  type BackgroundMusicIssue,
} from './backgroundMusic';
import { LEVELS, MAX_LEVELS } from './levels';
import type { StorageLike } from './progress';

const TRACK_URL = '/gingerbread-runner/audio/runner-theme-loop.wav';

// MediaError codes; the MediaError global only exists in browsers.
const MEDIA_ERR_ABORTED = 1;
const MEDIA_ERR_SRC_NOT_SUPPORTED = 4;

/** A scriptable stand-in for HTMLAudioElement that records how it was driven. */
class FakeAudio implements BackgroundMusicAudio {
  loop = false;
  volume = 1;
  preload = '';
  paused = true;
  error: { readonly code: number } | null = null;
  playCalls = 0;
  pauseCalls = 0;
  loadCalls = 0;
  readonly srcAssignments: string[] = [];
  readonly seeks: number[] = [];

  private source = '';
  private position = 0;
  private playFailure: string | null = null;
  private holdNext = false;
  private abortPendingPlay: (() => void) | null = null;
  private readonly errorListeners = new Set<() => void>();

  get src(): string {
    return this.source;
  }

  set src(value: string) {
    this.source = value;
    this.srcAssignments.push(value);
  }

  get currentTime(): number {
    return this.position;
  }

  set currentTime(value: number) {
    this.position = value;
    this.seeks.push(value);
  }

  get errorListenerCount(): number {
    return this.errorListeners.size;
  }

  play(): Promise<void> {
    this.playCalls += 1;

    if (this.playFailure !== null) {
      // A refused play() leaves the element paused, like a real browser.
      return Promise.reject(
        new DOMException(`play() failed: ${this.playFailure}`, this.playFailure),
      );
    }

    this.paused = false;
    if (this.holdNext) {
      this.holdNext = false;
      return new Promise<void>((_resolve, reject) => {
        this.abortPendingPlay = () => {
          reject(
            new DOMException('The play() request was interrupted.', 'AbortError'),
          );
        };
      });
    }

    return Promise.resolve();
  }

  pause(): void {
    this.pauseCalls += 1;
    this.paused = true;
    this.interruptPendingPlay();
  }

  load(): void {
    this.loadCalls += 1;
    this.error = null;
    this.paused = true;
    this.position = 0;
    this.interruptPendingPlay();
  }

  addEventListener(_type: 'error', listener: () => void): void {
    this.errorListeners.add(listener);
  }

  removeEventListener(_type: 'error', listener: () => void): void {
    this.errorListeners.delete(listener);
  }

  /** Makes every play() reject with the named DOMException until allowPlay(). */
  failPlayWith(name: string): void {
    this.playFailure = name;
  }

  allowPlay(): void {
    this.playFailure = null;
  }

  /** Keeps the next play() pending, like a start that is still buffering. */
  holdNextPlay(): void {
    this.holdNext = true;
  }

  /** Moves the playhead the way playback would; unlike a seek it is not recorded. */
  advance(seconds: number): void {
    this.position += seconds;
  }

  emitError(code: number): void {
    this.error = { code };
    this.errorListeners.forEach((listener) => listener());
  }

  private interruptPendingPlay(): void {
    this.abortPendingPlay?.();
    this.abortPendingPlay = null;
  }
}

function createMemoryStorage(saved?: string): StorageLike {
  const entries = new Map<string, string>();
  if (saved !== undefined) {
    entries.set(BACKGROUND_MUSIC_STORAGE_KEY, saved);
  }

  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => {
      entries.set(key, value);
    },
  };
}

function createHarness(storage: StorageLike | null = createMemoryStorage()) {
  const audio = new FakeAudio();
  let createCount = 0;
  const music = createBackgroundMusic({
    url: TRACK_URL,
    createAudio: () => {
      createCount += 1;
      return audio;
    },
    storage,
  });

  return { music, audio, createCount: () => createCount };
}

/** Starts a level the way App does: the click handler, then the screen effect. */
function startLevel(music: BackgroundMusic): void {
  music.startRun();
  music.syncScreen('playing');
}

// Lets a rejected play() promise reach the controller's catch handler.
const settle = (): Promise<void> =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('background music URL', () => {
  it.each([
    ['/', '/audio/runner-theme-loop.wav'],
    ['/gingerbread-runner/', '/gingerbread-runner/audio/runner-theme-loop.wav'],
    ['/gingerbread-runner', '/gingerbread-runner/audio/runner-theme-loop.wav'],
    ['./', './audio/runner-theme-loop.wav'],
    ['', 'audio/runner-theme-loop.wav'],
  ])('appends the public asset to the %j base path', (baseUrl, expected) => {
    const url = resolveBackgroundMusicUrl(baseUrl);

    expect(url).toBe(expected);
    expect(url).not.toContain('//');
  });
});

describe('browser background music', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubAudioConstructor(): FakeAudio[] {
    const created: FakeAudio[] = [];
    vi.stubGlobal('Audio', function () {
      const audio = new FakeAudio();
      created.push(audio);
      return audio;
    });
    return created;
  }

  it('builds the Audio element lazily from import.meta.env.BASE_URL', () => {
    const created = stubAudioConstructor();
    const music = createBrowserBackgroundMusic();
    expect(created).toHaveLength(0);

    music.startRun();

    expect(created).toHaveLength(1);
    expect(created[0]?.src).toBe(
      `${import.meta.env.BASE_URL}audio/runner-theme-loop.wav`,
    );
    expect(created[0]?.src).not.toContain('//');
  });

  it('saves the mute choice in localStorage and restores it next time', () => {
    const storage = createMemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    stubAudioConstructor();

    createBrowserBackgroundMusic().setEnabled(false);

    expect(storage.getItem('cloudtail-runner.background-music.v1')).toBe('off');
    expect(createBrowserBackgroundMusic().getSnapshot().enabled).toBe(false);
  });

  it('still plays when the browser refuses access to localStorage', () => {
    const created = stubAudioConstructor();
    vi.stubGlobal('window', {
      get localStorage(): Storage {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
    });

    const music = createBrowserBackgroundMusic();
    music.startRun();

    expect(music.getSnapshot().enabled).toBe(true);
    expect(created[0]?.playCalls).toBe(1);
  });
});

describe('background music lifecycle', () => {
  it('stays silent and creates no audio until the player starts a run', () => {
    const { music, audio, createCount } = createHarness();

    music.syncScreen('menu');
    music.syncScreen('playing');
    music.setEnabled(true);
    music.retry();

    expect(createCount()).toBe(0);
    expect(audio.playCalls).toBe(0);
    expect(audio.srcAssignments).toEqual([]);
  });

  it('calls play() inside startRun so the start click is the user gesture', () => {
    const { music, audio, createCount } = createHarness();

    // Nothing is awaited between the call and the checks: play() must already
    // have been requested while the browser still counts the click as active.
    music.startRun();

    expect(createCount()).toBe(1);
    expect(audio.playCalls).toBe(1);
    expect(audio.paused).toBe(false);
  });

  it('configures the shared element as a quiet loop', () => {
    const { music, audio } = createHarness();

    music.startRun();

    expect(audio.loop).toBe(true);
    expect(audio.preload).toBe('auto');
    expect(audio.volume).toBe(BACKGROUND_MUSIC_VOLUME);
    expect(BACKGROUND_MUSIC_VOLUME).toBeGreaterThanOrEqual(0.3);
    expect(BACKGROUND_MUSIC_VOLUME).toBeLessThanOrEqual(0.4);
    expect(audio.srcAssignments).toEqual([TRACK_URL]);
  });

  it.each(['paused', 'result', 'menu'] as const)(
    'pauses when the screen becomes %s',
    (screen) => {
      const { music, audio } = createHarness();
      startLevel(music);

      music.syncScreen(screen);

      expect(audio.paused).toBe(true);
    },
  );

  it('resumes from the same position when the pause dialog closes', () => {
    const { music, audio } = createHarness();
    startLevel(music);
    audio.advance(12.5);

    music.syncScreen('paused');
    music.syncScreen('playing');

    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(12.5);
    expect(audio.seeks).toEqual([]);
    expect(audio.playCalls).toBe(2);
  });

  it.each(['paused', 'result', 'menu'] as const)(
    'plays from the beginning when a run starts again from the %s screen',
    (screen) => {
      const { music, audio } = createHarness();
      startLevel(music);
      audio.advance(17.5);
      music.syncScreen(screen);

      startLevel(music);

      expect(audio.seeks).toEqual([0]);
      expect(audio.currentTime).toBe(0);
      expect(audio.paused).toBe(false);
    },
  );

  it('rewinds without a second play() when a run restarts mid-playback', () => {
    const { music, audio } = createHarness();
    startLevel(music);
    audio.advance(4);

    startLevel(music);

    expect(audio.seeks).toEqual([0]);
    expect(audio.playCalls).toBe(1);
    expect(audio.paused).toBe(false);
  });
});

describe('shared track across levels', () => {
  it('plays the one track from one audio element in all 20 levels', () => {
    expect(LEVELS).toHaveLength(20);
    expect(MAX_LEVELS).toBe(LEVELS.length);
    const { music, audio, createCount } = createHarness();

    for (const level of LEVELS) {
      startLevel(music);
      expect(audio.currentTime).toBe(0);
      expect(audio.paused).toBe(false);

      audio.advance(level.id);
      music.syncScreen('result');
      expect(audio.paused).toBe(true);
      music.syncScreen('menu');
    }

    expect(createCount()).toBe(1);
    expect(audio.srcAssignments).toEqual([TRACK_URL]);
    expect(audio.playCalls).toBe(LEVELS.length);
    // Every level after the first rewinds the same element instead of loading
    // a new one.
    expect(audio.seeks).toEqual(Array<number>(LEVELS.length - 1).fill(0));
  });

  it('keeps music settings out of the level definitions', () => {
    for (const level of LEVELS) {
      const musicKeys = Object.keys(level).filter((key) =>
        /music|audio|bgm|track|song|sound/i.test(key),
      );

      expect(musicKeys).toEqual([]);
    }
  });
});

describe('mute preference', () => {
  it('is on by default', () => {
    const { music } = createHarness();

    expect(music.getSnapshot()).toEqual({ enabled: true, issue: null });
  });

  it.each([
    ['off', false],
    ['on', true],
    ['unexpected', true],
  ])('reads a saved value of %j as enabled=%s', (saved, enabled) => {
    const { music } = createHarness(createMemoryStorage(saved));

    expect(music.getSnapshot().enabled).toBe(enabled);
  });

  it('is saved when toggled and restored by the next page load', () => {
    const storage = createMemoryStorage();
    createHarness(storage).music.setEnabled(false);
    expect(storage.getItem(BACKGROUND_MUSIC_STORAGE_KEY)).toBe('off');

    const reloaded = createHarness(storage);
    expect(reloaded.music.getSnapshot().enabled).toBe(false);

    reloaded.music.setEnabled(true);
    expect(storage.getItem(BACKGROUND_MUSIC_STORAGE_KEY)).toBe('on');
    expect(createHarness(storage).music.getSnapshot().enabled).toBe(true);
  });

  it('keeps every level run and restart silent without creating audio', () => {
    const { music, audio, createCount } = createHarness(
      createMemoryStorage('off'),
    );

    for (let run = 0; run < MAX_LEVELS; run += 1) {
      startLevel(music);
      music.syncScreen('paused');
      startLevel(music);
      music.syncScreen('result');
      music.syncScreen('menu');
    }

    expect(createCount()).toBe(0);
    expect(audio.playCalls).toBe(0);
  });

  it('mutes mid-run and resumes from the same position when unmuted', () => {
    const storage = createMemoryStorage();
    const { music, audio } = createHarness(storage);
    startLevel(music);
    audio.advance(9);

    music.setEnabled(false);
    expect(audio.paused).toBe(true);
    expect(storage.getItem(BACKGROUND_MUSIC_STORAGE_KEY)).toBe('off');

    music.setEnabled(true);
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(9);
    expect(audio.seeks).toEqual([]);
  });

  it('rewinds a muted restart so unmuting later starts from the beginning', () => {
    const { music, audio } = createHarness();
    startLevel(music);
    audio.advance(21);
    music.setEnabled(false);
    music.syncScreen('result');

    startLevel(music);
    expect(audio.paused).toBe(true);
    expect(audio.currentTime).toBe(0);

    music.setEnabled(true);
    expect(audio.paused).toBe(false);
    expect(audio.currentTime).toBe(0);
  });

  it('does not start music when unmuted from the menu or the pause dialog', () => {
    const { music, audio, createCount } = createHarness(
      createMemoryStorage('off'),
    );

    music.setEnabled(true);
    expect(createCount()).toBe(0);

    startLevel(music);
    music.syncScreen('paused');
    music.setEnabled(false);
    music.setEnabled(true);
    expect(audio.paused).toBe(true);

    music.syncScreen('playing');
    expect(audio.paused).toBe(false);
  });

  it('keeps the choice for this page session when storage is blocked', () => {
    const blockedStorage: StorageLike = {
      getItem: () => {
        throw new DOMException('The operation is insecure.', 'SecurityError');
      },
      setItem: () => {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      },
    };
    const { music, audio } = createHarness(blockedStorage);
    expect(music.getSnapshot().enabled).toBe(true);

    music.setEnabled(false);
    startLevel(music);

    expect(music.getSnapshot().enabled).toBe(false);
    expect(audio.playCalls).toBe(0);
  });

  it('does not swallow unexpected storage errors', () => {
    const brokenRead: StorageLike = {
      getItem: () => {
        throw new TypeError('getItem is broken');
      },
      setItem: () => undefined,
    };
    const brokenWrite: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new TypeError('setItem is broken');
      },
    };

    expect(() => createHarness(brokenRead)).toThrow(TypeError);
    expect(() => createHarness(brokenWrite).music.setEnabled(false)).toThrow(
      TypeError,
    );
  });
});

describe('playback failures', () => {
  it.each<[string, BackgroundMusicIssue]>([
    ['NotAllowedError', 'autoplay-blocked'],
    ['NotSupportedError', 'asset-unavailable'],
    ['InvalidStateError', 'playback-failed'],
  ])('reports a %s from play() as %s', async (errorName, expectedIssue) => {
    const { music, audio } = createHarness();
    audio.failPlayWith(errorName);

    startLevel(music);
    await settle();

    expect(music.getSnapshot().issue).toBe(expectedIssue);
  });

  it('gives each failure its own non-empty message', () => {
    const messages = Object.values(BACKGROUND_MUSIC_ISSUE_MESSAGES);

    expect(messages).toHaveLength(3);
    expect(new Set(messages).size).toBe(messages.length);
    expect(messages.every((message) => message.trim() !== '')).toBe(true);
  });

  it('notifies subscribers when a failure appears and when it clears', async () => {
    const { music, audio } = createHarness();
    const listener = vi.fn();
    music.subscribe(listener);
    audio.failPlayWith('NotAllowedError');

    music.startRun();
    await settle();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(music.getSnapshot().issue).toBe('autoplay-blocked');

    music.syncScreen('paused');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(music.getSnapshot().issue).toBeNull();
  });

  it('retries a blocked start from the next user gesture', async () => {
    const { music, audio } = createHarness();
    audio.failPlayWith('NotAllowedError');
    startLevel(music);
    await settle();
    expect(music.getSnapshot().issue).toBe('autoplay-blocked');

    audio.allowPlay();
    music.retry();

    expect(music.getSnapshot().issue).toBeNull();
    expect(audio.paused).toBe(false);
  });

  it('treats unmuting during a run as another attempt to start the music', async () => {
    const { music, audio } = createHarness();
    audio.failPlayWith('NotAllowedError');
    startLevel(music);
    await settle();
    music.setEnabled(false);
    audio.allowPlay();

    music.setEnabled(true);

    expect(audio.paused).toBe(false);
    expect(music.getSnapshot().issue).toBeNull();
  });

  it.each<[string, (music: BackgroundMusic) => void]>([
    ['the run is paused', (music) => music.syncScreen('paused')],
    ['the player mutes the music', (music) => music.setEnabled(false)],
  ])('clears the notice when %s', async (_situation, act) => {
    const { music, audio } = createHarness();
    audio.failPlayWith('NotAllowedError');
    startLevel(music);
    await settle();
    expect(music.getSnapshot().issue).toBe('autoplay-blocked');

    act(music);

    expect(music.getSnapshot().issue).toBeNull();
  });

  it('reports a failed file load from the element error event', () => {
    const { music, audio } = createHarness();
    startLevel(music);

    audio.emitError(MEDIA_ERR_SRC_NOT_SUPPORTED);

    expect(music.getSnapshot().issue).toBe('asset-unavailable');
  });

  it('ignores aborted loads and errors while no music is wanted', () => {
    const { music, audio } = createHarness();
    startLevel(music);

    audio.emitError(MEDIA_ERR_ABORTED);
    expect(music.getSnapshot().issue).toBeNull();

    music.syncScreen('paused');
    audio.emitError(MEDIA_ERR_SRC_NOT_SUPPORTED);
    expect(music.getSnapshot().issue).toBeNull();
  });

  it('reloads an element whose file failed to load before retrying', () => {
    const { music, audio } = createHarness();
    startLevel(music);
    audio.emitError(MEDIA_ERR_SRC_NOT_SUPPORTED);

    music.retry();

    expect(audio.loadCalls).toBe(1);
    expect(audio.playCalls).toBe(2);
    expect(audio.paused).toBe(false);
    expect(music.getSnapshot().issue).toBeNull();
  });

  it('does not report the AbortError caused by pausing a pending play()', async () => {
    const { music, audio } = createHarness();
    audio.holdNextPlay();
    music.startRun();

    music.setEnabled(false);
    await settle();

    expect(music.getSnapshot().issue).toBeNull();
  });

  it('does not report an interrupted play() that a restart already replaced', async () => {
    const { music, audio } = createHarness();
    audio.holdNextPlay();
    startLevel(music);
    music.syncScreen('paused');

    startLevel(music);
    await settle();

    expect(audio.playCalls).toBe(2);
    expect(audio.paused).toBe(false);
    expect(music.getSnapshot().issue).toBeNull();
  });
});

describe('background music subscription', () => {
  it('returns the same snapshot until the enabled flag or issue changes', () => {
    const { music } = createHarness();
    const listener = vi.fn();
    const unsubscribe = music.subscribe(listener);
    const initial = music.getSnapshot();

    startLevel(music);
    music.syncScreen('paused');
    music.setEnabled(true);
    expect(music.getSnapshot()).toBe(initial);
    expect(listener).not.toHaveBeenCalled();

    music.setEnabled(false);
    expect(music.getSnapshot()).toEqual({ enabled: false, issue: null });
    expect(listener).toHaveBeenCalledTimes(1);

    music.setEnabled(false);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    music.setEnabled(true);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('does not notify again when the same failure is reported twice', () => {
    const { music, audio } = createHarness();
    startLevel(music);
    const listener = vi.fn();
    music.subscribe(listener);

    audio.emitError(MEDIA_ERR_SRC_NOT_SUPPORTED);
    const failed = music.getSnapshot();
    audio.emitError(MEDIA_ERR_SRC_NOT_SUPPORTED);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(music.getSnapshot()).toBe(failed);
  });

  it('stops the music and detaches from the element on dispose', () => {
    const { music, audio } = createHarness();
    startLevel(music);

    music.dispose();

    expect(audio.paused).toBe(true);
    expect(audio.errorListenerCount).toBe(0);
    audio.emitError(MEDIA_ERR_SRC_NOT_SUPPORTED);
    expect(music.getSnapshot().issue).toBeNull();
  });

  it('keeps the mute choice and can start again after dispose', () => {
    const { music, audio } = createHarness();
    music.setEnabled(false);
    music.dispose();
    expect(music.getSnapshot().enabled).toBe(false);

    music.setEnabled(true);
    startLevel(music);

    expect(audio.paused).toBe(false);
    expect(audio.errorListenerCount).toBe(1);
  });
});
