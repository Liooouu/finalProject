import { useCallback, useEffect, useRef, useState } from "react";

// For temporary action feedback only, not loading state or persistent guidance.
// Each setter call restarts the timer, including repeated identical messages.
export function useTransientState(initialValue = "", duration = 3000) {
  const [value, setValue] = useState(initialValue);
  const resetValue = useRef(initialValue);
  const timer = useRef(null);
  const mounted = useRef(true);

  const setTransientValue = useCallback((nextValue) => {
    if (!mounted.current) return;
    clearTimeout(timer.current);
    setValue(nextValue);
    timer.current = setTimeout(() => {
      setValue(resetValue.current);
      timer.current = null;
    }, duration);
  }, [duration]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; clearTimeout(timer.current); };
  }, []);
  return [value, setTransientValue];
}
