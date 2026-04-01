/**
 * SENTINAL — Shared Socket.io Client
 * One connection, shared across all components.
 * Never instantiate socket.io-client directly in components.
 *
 * Socket event payload shape (from broadcastService.js):
 *   { event: string, timestamp: string, data: { ...fields } }
 */
import { io } from 'socket.io-client';

const GATEWAY_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

const socket = io(GATEWAY_URL, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000,
  reconnectionDelayMax: 10000
});

socket.on('connect', () => {
  console.log(`[SOCKET] Connected — id: ${socket.id}`);
});

socket.on('connect_error', (err) => {
  console.error('[SOCKET] Connection error:', err.message);
});

socket.on('disconnect', (reason) => {
  console.warn('[SOCKET] Disconnected:', reason);
  if (reason === 'io server disconnect') {
    console.log('[SOCKET] Reconnecting...');
    socket.connect();
  }
});

socket.on('reconnect', (attempt) => {
  console.log(`[SOCKET] Reconnected after ${attempt} attempt(s)`);
});

export default socket;
