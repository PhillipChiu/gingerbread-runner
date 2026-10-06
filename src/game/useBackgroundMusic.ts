import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  createBrowserBackgroundMusic,
  type BackgroundMusicIssue,
  type BackgroundMusicScreen,
} from './backgroundMusic';

export interface BackgroundMusicControls {
  enabled: boolean;
  issue: BackgroundMusicIssue | null;
  startRun: () => void;
  setEnabled: (enabled: boolean) => void;
  retry: () => void;
}

/**
 * Binds the shared background-music controller to the current screen.
 * Call startRun() from the click/keydown handler that starts a level so the
 * first play() happens inside that user gesture.
 */
export function useBackgroundMusic(
  screen: BackgroundMusicScreen,
): BackgroundMusicControls {
  const [music] = useState(createBrowserBackgroundMusic);
  const { enabled, issue } = useSyncExternalStore(
    music.subscribe,
    music.getSnapshot,
    music.getSnapshot,
  );

  useEffect(() => {
    music.syncScreen(screen);
  }, [music, screen]);

  useEffect(() => () => music.dispose(), [music]);

  return {
    enabled,
    issue,
    startRun: music.startRun,
    setEnabled: music.setEnabled,
    retry: music.retry,
  };
}
