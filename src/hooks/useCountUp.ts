import { useEffect, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

interface UseCountUpOptions {
  duration?: number;
  decimals?: number;
  startImmediately?: boolean;
}

export function useCountUp(
  target: number,
  options: UseCountUpOptions = {}
): number {
  const { duration = 1200, decimals = 0, startImmediately = true } = options;
  const reducedMotion = useReducedMotion();
  const factor = Math.pow(10, decimals);
  const roundedTarget = Math.round(target * factor) / factor;
  const [count, setCount] = useState(() => (reducedMotion ? roundedTarget : 0));

  useEffect(() => {
    if (reducedMotion) {
      setCount(roundedTarget);
      return;
    }

    if (!startImmediately) return;

    let startTime: number | null = null;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      // Ease-out cubic
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const current = easedProgress * target;

      setCount(Math.round(current * factor) / factor);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        setCount(roundedTarget);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animationFrameId);
  }, [target, duration, decimals, startImmediately, reducedMotion]);

  return count;
}
