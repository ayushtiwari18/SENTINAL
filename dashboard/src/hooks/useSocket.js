import { useEffect } from 'react';
import socket from '../services/socket';

export function useSocket(eventName, handler) {
  useEffect(() => {
    socket.on(eventName, handler);
    return () => socket.off(eventName, handler);
  }, [eventName, handler]);
}
