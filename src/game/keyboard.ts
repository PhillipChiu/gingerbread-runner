const INTERACTIVE_TARGETS =
  'button, a, input, select, textarea, summary, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [role="button"], [role="link"], [role="checkbox"], [role="switch"], [role="menuitem"], [role="option"], [role="slider"], [tabindex]:not([tabindex="-1"])';

export function isInteractiveKeyboardTarget(
  target: EventTarget | null,
): boolean {
  if (target === null || typeof target !== 'object' || !('closest' in target)) {
    return false;
  }

  const closest = (
    target as EventTarget & {
      closest?: (selectors: string) => Element | null;
    }
  ).closest;

  return typeof closest === 'function' && Boolean(closest.call(target, INTERACTIVE_TARGETS));
}
