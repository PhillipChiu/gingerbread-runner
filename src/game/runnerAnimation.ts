export const RUNNER_FRAMES_PER_SECOND = 18;
export const RUNNER_FRAME_COUNT = 12;
export const RUNNER_CYCLE_SECONDS =
  RUNNER_FRAME_COUNT / RUNNER_FRAMES_PER_SECOND;
export const RUNNER_BODY_BOB_AMPLITUDE = 5;

export interface RunnerFrameDimensions {
  width: number;
  height: number;
}

export interface RunnerFramePlacement {
  x: number;
  y: number;
}

export interface RunnerFrameLayout {
  width: number;
  height: number;
  placements: RunnerFramePlacement[];
}

export interface RunnerAnimationPose {
  frameIndex: number;
  cycleProgress: number;
  bobOffset: number;
  stride: number;
  stepIndex: number;
  contactFoot: 'left' | 'right';
  contactStrength: number;
}

export function getRunnerFrameLayout(
  frames: readonly RunnerFrameDimensions[],
): RunnerFrameLayout {
  const width = frames.reduce(
    (maximum, frame) =>
      Math.max(maximum, Number.isFinite(frame.width) ? frame.width : 0),
    0,
  );
  const height = frames.reduce(
    (maximum, frame) =>
      Math.max(maximum, Number.isFinite(frame.height) ? frame.height : 0),
    0,
  );

  return {
    width,
    height,
    placements: frames.map((frame) => ({
      x: (width - frame.width) / 2,
      y: height - frame.height,
    })),
  };
}

export function getRunnerAnimationPose(
  elapsedSeconds: number,
  frameCount: number,
  reduceMotion = false,
): RunnerAnimationPose {
  const elapsed = Number.isFinite(elapsedSeconds)
    ? Math.max(0, elapsedSeconds)
    : 0;
  const validFrameCount =
    Number.isInteger(frameCount) && frameCount > 0 ? frameCount : 1;
  const cycleProgress =
    (elapsed % RUNNER_CYCLE_SECONDS) / RUNNER_CYCLE_SECONDS;
  const contactDistance = Math.min(
    cycleProgress,
    1 - cycleProgress,
    Math.abs(cycleProgress - 0.5),
  );

  return {
    frameIndex: reduceMotion
      ? 0
      : Math.floor(cycleProgress * validFrameCount) % validFrameCount,
    cycleProgress,
    bobOffset: reduceMotion
      ? 0
      : Math.sin(cycleProgress * Math.PI * 2) * RUNNER_BODY_BOB_AMPLITUDE,
    stride: reduceMotion ? 0 : Math.sin(cycleProgress * Math.PI * 2),
    stepIndex: reduceMotion ? 0 : Math.floor(cycleProgress * 4) % 4,
    contactFoot: cycleProgress < 0.5 ? 'left' : 'right',
    contactStrength: reduceMotion
      ? 0
      : Math.max(0, 1 - contactDistance / 0.08),
  };
}
