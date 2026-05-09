import { useState, useEffect, useRef } from 'react';

// Tracks the last seen balance across mounts so the animation only fires
// when the value actually changes (not on every page navigation).
let _lastBalance: number | undefined = undefined;

/**
 * Animates a number from 0 to `target` over `duration` ms.
 * Only triggers when `active` is true (default: always).
 */
export function useCountUp(target: number, duration = 900, active = true): number {
  const shouldAnimate = _lastBalance !== target;
  const [value, setValue] = useState(shouldAnimate ? 0 : target);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active || !shouldAnimate || target === 0) { setValue(target); _lastBalance = target; return; }
    const startTime = performance.now();
    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        _lastBalance = target;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [target, duration, active, shouldAnimate]);

  return value;
}
