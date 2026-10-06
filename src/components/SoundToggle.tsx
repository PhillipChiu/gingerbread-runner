import type { MouseEvent } from 'react';

interface SoundToggleProps {
  enabled: boolean;
  /**
   * viaPointer is true for mouse/touch clicks and false for keyboard or
   * assistive-technology activation, so callers can restore game focus only
   * for pointer users.
   */
  onToggle: (nextEnabled: boolean, viaPointer: boolean) => void;
  className?: string;
}

function SoundIcon({ enabled }: { enabled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path
        d="M3.4 7.9v4.2h2.9l3.9 3.1V4.8L6.3 7.9H3.4Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {enabled ? (
        <path
          d="M13 7.4a3.6 3.6 0 0 1 0 5.2m2.3-7.6a6.7 6.7 0 0 1 0 10"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : (
        <path
          d="m13.2 7.8 4.2 4.4m0-4.4-4.2 4.4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export default function SoundToggle({
  enabled,
  onToggle,
  className,
}: SoundToggleProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    onToggle(!enabled, event.detail > 0);
  };

  return (
    <button
      className={className ? `sound-toggle ${className}` : 'sound-toggle'}
      type="button"
      aria-label="背景音樂"
      aria-pressed={enabled}
      onClick={handleClick}
    >
      <SoundIcon enabled={enabled} />
      <span className="sound-toggle-label">背景音樂</span>
      <span className="sound-toggle-state">{enabled ? '開' : '關'}</span>
    </button>
  );
}
