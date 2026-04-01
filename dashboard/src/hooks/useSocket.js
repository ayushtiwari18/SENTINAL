import { useEffect, useRef } from 'react';
import socket from '../services/socket';

/**
 * FIX: Previously had `handler` in useEffect deps array.
 * Every re-render produced a new handler reference → useEffect re-ran →
 * socket.off + socket.on fired mid-render → triggered setItems → another
 * re-render → infinite loop → confirm modal never stabilised → buttons
 * appeared to do nothing (no network request ever fired).
 *
 * Fix: store handler in a ref. The effect runs only when eventName changes
 * (i.e. once per mount). The ref always holds the latest handler so stale
 * closure is not an issue.
 */
export function useSocket(eventName, handler) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const listener = (...args) => handlerRef.current(...args);
    socket.on(eventName, listener);
    return () => socket.off(eventName, listener);
  }, [eventName]); // handler deliberately excluded — ref handles updates
}
