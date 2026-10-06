import { useEffect, useRef } from 'react';
import {
  BACKGROUND_MUSIC_ISSUE_MESSAGES,
  type BackgroundMusicIssue,
} from '../game/backgroundMusic';

interface SoundNoticeProps {
  issue: BackgroundMusicIssue | null;
  onRetry: () => void;
}

/**
 * The live region stays mounted so assistive technology announces a failure
 * the moment its message appears.
 */
export default function SoundNotice({ issue, onRetry }: SoundNoticeProps) {
  const noticeRef = useRef<HTMLDivElement>(null);

  // Browsers keep the game where it was when content is inserted above it,
  // which can leave a fresh notice off-screen on short landscape phones.
  useEffect(() => {
    if (issue !== null) {
      noticeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [issue]);

  return (
    <div className="sound-notice-region" role="status">
      {issue !== null && (
        <div className="sound-notice" data-issue={issue} ref={noticeRef}>
          <p>{BACKGROUND_MUSIC_ISSUE_MESSAGES[issue]}</p>
          <button
            className="sound-notice-retry"
            type="button"
            onClick={onRetry}
          >
            重試播放
          </button>
        </div>
      )}
    </div>
  );
}
