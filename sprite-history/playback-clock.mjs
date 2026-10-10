// Nintendo DS LCD refreshes approximately 59.826 times per second.
// Gen V sprite animation durations are measured in frame ticks.
// Track elapsed wall-clock time, not "N ticks per draw", so slow devices
// still play animations at the correct speed.
export const DS_ANIMATION_HZ = 59.826;
export const ANIMATION_LOOP_TICKS = 6000;

export function advanceAnimationTick(current, elapsedMs, speed = 1) {
  if (!Number.isFinite(current) || !Number.isFinite(elapsedMs) || !Number.isFinite(speed)) {
    return Number.isFinite(current) ? current : 0;
  }
  // Ignore long tab-suspension gaps rather than jumping far ahead on resume.
  const dt = Math.min(250, Math.max(0, elapsedMs));
  const rate = Math.min(4, Math.max(0, speed));
  return (current + dt * DS_ANIMATION_HZ * rate / 1000) % ANIMATION_LOOP_TICKS;
}
