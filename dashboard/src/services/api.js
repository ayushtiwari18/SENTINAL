/**
 * SENTINAL — Centralized API Service
 * All components must call through here. No direct fetch/axios in components.
 *
 * Response contract (all Gateway endpoints return):
 *   { success: boolean, message: string, data: any }
 */
import axios from 'axios';

const BASE = 'http://localhost:3000';

const client = axios.create({
  baseURL: BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});

// Interceptor — unwrap data, log errors
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || 'unknown';
    const status = err.response?.status || 'network error';
    console.error(`[API ERROR] ${url} — ${status}:`, err.message);
    return Promise.reject(err);
  }
);

// ———————————————————————————————————————————————
// Logs
// ———————————————————————————————————————————————
export const getRecentLogs = async (limit = 20) => {
  console.log('[API] Fetching recent logs');
  const res = await client.get('/api/logs/recent', { params: { limit } });
  return res.data.data;
};

export const ingestLog = async (payload) => {
  console.log('[API] Ingesting log');
  const res = await client.post('/api/logs/ingest', payload);
  return res.data.data;
};

// ———————————————————————————————————————————————
// Attacks
// ———————————————————————————————————————————————
export const getRecentAttacks = async (limit = 20) => {
  console.log('[API] Fetching recent attacks');
  const res = await client.get('/api/attacks/recent', { params: { limit } });
  return res.data.data;
};

export const getForensics = async (attackId) => {
  console.log(`[API] Fetching forensics for attack ${attackId}`);
  const res = await client.get(`/api/attacks/${attackId}/forensics`);
  return res.data.data;
};

// ———————————————————————————————————————————————
// Stats
// ———————————————————————————————————————————————
export const getStats = async () => {
  console.log('[API] Fetching stats');
  const res = await client.get('/api/stats');
  return res.data.data;
};

// ———————————————————————————————————————————————
// Service Status
// ———————————————————————————————————————————————
export const getServiceStatus = async () => {
  console.log('[API] Fetching service status');
  const res = await client.get('/api/service-status');
  return res.data.data;
};

// ———————————————————————————————————————————————
// Alerts
// ———————————————————————————————————————————————
export const getAlerts = async (limit = 20) => {
  console.log('[API] Fetching alerts');
  const res = await client.get('/api/alerts', { params: { limit } });
  return res.data.data;
};

export const markAlertRead = async (alertId) => {
  console.log(`[API] Marking alert ${alertId} as read`);
  const res = await client.patch(`/api/alerts/${alertId}/read`);
  return res.data.data;
};
