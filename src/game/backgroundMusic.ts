import type { StorageLike } from './progress';

export const BACKGROUND_MUSIC_PUBLIC_PATH = 'audio/runner-theme-loop.wav';
export const BACKGROUND_MUSIC_VOLUME = 0.35;
export const BACKGROUND_MUSIC_STORAGE_KEY =
  'cloudtail-runner.background-music.v1';

export type BackgroundMusicScreen = 'menu' | 'playing' | 'paused' | 'result';

export type BackgroundMusicIssue =
  | 'autoplay-blocked'
  | 'asset-unavailable'
  | 'playback-failed';

export const BACKGROUND_MUSIC_ISSUE_MESSAGES: Record<
  BackgroundMusicIssue,
  string
> = {
  'autoplay-blocked':
    '瀏覽器阻擋了背景音樂播放。請按「重試播放」；若仍沒有聲音，請檢查此網站的聲音權限。',
  'asset-unavailable':
    '背景音樂檔案載入失敗，目前以靜音繼續遊戲。請確認網路連線後按「重試播放」。',
  'playback-failed':
    '背景音樂無法播放，目前以靜音繼續遊戲。可按「重試播放」再試一次。',
};

// MediaError.MEDIA_ERR_ABORTED; the MediaError global only exists in browsers.
const MEDIA_ERR_ABORTED = 1;

/** The subset of HTMLAudioElement the controller relies on. */
export interface BackgroundMusicAudio {
  src: string;
  loop: boolean;
  volume: number;
  preload: string;
  currentTime: number;
  readonly paused: boolean;
  readonly error: { readonly code: number } | null;
  play(): Promise<void>;
  pause(): void;
  load(): void;
  addEventListener(type: 'error', listener: () => void): void;
  removeEventListener(type: 'error', listener: () => void): void;
}

export interface BackgroundMusicSnapshot {
  /** The player's saved preference; independent of the current screen. */
  readonly enabled: boolean;
  /** Set only while music should be playing but the last attempt failed. */
  readonly issue: BackgroundMusicIssue | null;
}

export interface BackgroundMusicOptions {
  url: string;
  createAudio: () => BackgroundMusicAudio;
  storage?: StorageLike | null;
}

export interface BackgroundMusic {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => BackgroundMusicSnapshot;
  /**
   * Begins (or restarts) the shared track from 0:00. Call it synchronously from
   * the click/keydown handler that starts a level so play() runs inside the
   * user gesture that browsers require for audible playback.
   */
  readonly startRun: () => void;
  /** Pauses on every screen except 'playing' and resumes without seeking. */
  readonly syncScreen: (screen: BackgroundMusicScreen) => void;
  /** Saves the player's preference; enabling mid-run starts playback. */
  readonly setEnabled: (enabled: boolean) => void;
  /** Tries again after a reported issue; call it from a user gesture. */
  readonly retry: () => void;
  readonly dispose: () => void;
}

/** Resolves the public asset against Vite's base path without doubling slashes. */
export function resolveBackgroundMusicUrl(baseUrl: string): string {
  const base =
    baseUrl === '' || baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${BACKGROUND_MUSIC_PUBLIC_PATH}`;
}

function rethrowUnlessStorageDenied(error: unknown): void {
  if (!(error instanceof DOMException)) {
    throw error;
  }
}

function getBrowserStorage(): StorageLike | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch (error) {
    // Blocked storage (SecurityError) only costs persistence, not playback.
    rethrowUnlessStorageDenied(error);
    return null;
  }
}

function readEnabledPreference(storage: StorageLike | null): boolean {
  try {
    return storage?.getItem(BACKGROUND_MUSIC_STORAGE_KEY) !== 'off';
  } catch (error) {
    rethrowUnlessStorageDenied(error);
    return true;
  }
}

function writeEnabledPreference(
  storage: StorageLike | null,
  enabled: boolean,
): void {
  try {
    storage?.setItem(BACKGROUND_MUSIC_STORAGE_KEY, enabled ? 'on' : 'off');
  } catch (error) {
    // Private browsing or a full quota refuses the write; the choice still
    // applies to every later level in this page session.
    rethrowUnlessStorageDenied(error);
  }
}

function getErrorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error
    ? String(error.name)
    : '';
}

export function createBackgroundMusic({
  url,
  createAudio,
  storage = null,
}: BackgroundMusicOptions): BackgroundMusic {
  const listeners = new Set<() => void>();
  let audio: BackgroundMusicAudio | null = null;
  let enabled = readEnabledPreference(storage);
  let issue: BackgroundMusicIssue | null = null;
  let hasStartedRun = false;
  let isRunPlaying = false;
  let playRequestId = 0;
  let snapshot: BackgroundMusicSnapshot = { enabled, issue };

  const publish = (): void => {
    if (snapshot.enabled === enabled && snapshot.issue === issue) {
      return;
    }

    snapshot = { enabled, issue };
    listeners.forEach((listener) => listener());
  };

  const setIssue = (next: BackgroundMusicIssue | null): void => {
    issue = next;
    publish();
  };

  // Nothing plays before a user-initiated run start, and never while muted.
  const shouldPlay = (): boolean => enabled && hasStartedRun && isRunPlaying;

  const handleAudioError = (): void => {
    const code = audio?.error?.code;
    if (!shouldPlay() || code === undefined || code === MEDIA_ERR_ABORTED) {
      return;
    }

    setIssue('asset-unavailable');
  };

  const getAudio = (): BackgroundMusicAudio => {
    if (audio) {
      return audio;
    }

    const created = createAudio();
    created.preload = 'auto';
    created.loop = true;
    created.volume = BACKGROUND_MUSIC_VOLUME;
    created.addEventListener('error', handleAudioError);
    created.src = url;
    audio = created;
    return created;
  };

  const handlePlayRejection = (requestId: number, error: unknown): void => {
    // Pausing, muting or restarting while play() is pending makes the browser
    // reject the older request with AbortError. Only the newest request that
    // is still wanted may report a failure.
    if (requestId !== playRequestId || !shouldPlay()) {
      return;
    }

    switch (getErrorName(error)) {
      case 'NotAllowedError':
        setIssue('autoplay-blocked');
        break;
      case 'NotSupportedError':
        setIssue('asset-unavailable');
        break;
      default:
        setIssue('playback-failed');
    }
  };

  const requestPlayback = (): void => {
    const element = getAudio();
    if (element.error) {
      // A failed element rejects play() until its resource is loaded again.
      element.load();
    }
    if (issue !== null) {
      setIssue(null);
    }
    if (!element.paused) {
      return;
    }

    playRequestId += 1;
    const requestId = playRequestId;
    element
      .play()
      .catch((error: unknown) => handlePlayRejection(requestId, error));
  };

  const reconcile = (): void => {
    if (shouldPlay()) {
      requestPlayback();
      return;
    }

    if (audio && !audio.paused) {
      audio.pause();
    }
    if (issue !== null) {
      // Nothing is trying to play, so there is no failure left to report.
      setIssue(null);
    }
  };

  const startRun = (): void => {
    hasStartedRun = true;
    isRunPlaying = true;
    if (audio && audio.currentTime !== 0) {
      audio.currentTime = 0;
    }
    reconcile();
  };

  const syncScreen = (screen: BackgroundMusicScreen): void => {
    isRunPlaying = screen === 'playing';
    reconcile();
  };

  const setEnabled = (next: boolean): void => {
    if (next !== enabled) {
      enabled = next;
      writeEnabledPreference(storage, next);
      publish();
    }
    reconcile();
  };

  const dispose = (): void => {
    playRequestId += 1;
    hasStartedRun = false;
    isRunPlaying = false;
    if (audio) {
      audio.removeEventListener('error', handleAudioError);
      audio.pause();
      audio = null;
    }
    setIssue(null);
  };

  return {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => snapshot,
    startRun,
    syncScreen,
    setEnabled,
    retry: reconcile,
    dispose,
  };
}

export function createBrowserBackgroundMusic(): BackgroundMusic {
  return createBackgroundMusic({
    url: resolveBackgroundMusicUrl(import.meta.env.BASE_URL),
    createAudio: () => new Audio(),
    storage: getBrowserStorage(),
  });
}
