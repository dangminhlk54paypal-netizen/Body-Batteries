import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

// iOS "Reduce Motion" for code that animates outside Reanimated (e.g.
// LayoutAnimation, which ignores the setting on its own). Reanimated's own
// animations already honor it by default (ReduceMotion.System). Starts false
// until the async read resolves; setState only in callbacks.
export function useReduceMotionSetting(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (alive) setReduce(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return reduce;
}
