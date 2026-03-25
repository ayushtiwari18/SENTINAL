import { useEffect, useRef } from 'react';

export function useInterval(fn, ms) {
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; }, [fn]);
  useEffect(() => {
    if (!ms) return;
    const id = setInterval(() => fnRef.current(), ms);
    return () => clearInterval(id);
  }, [ms]);
}
