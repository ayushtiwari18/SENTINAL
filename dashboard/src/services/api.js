import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const api = axios.create({ baseURL: API_BASE });

const unwrap     = res => res.data.data;
const unwrapSafe = res => res.data.data ?? res.data;

// ── Core API calls ──────────────────────────────────────────────────────
export const getStats          = ()       => api.get('/api/stats').then(unwrap);
export const getRecentAttacks  = (n = 50) => api.get(`/api/attacks/recent?limit=${n}`).then(unwrap);
export const getForensics      = (id)     => api.get(`/api/attacks/${id}/forensics`).then(unwrap);
export const getAlerts         = (n = 50) => api.get(`/api/alerts?limit=${n}`).then(unwrap);
export const markAlertRead     = (id)     => api.patch(`/api/alerts/${id}/read`).then(unwrap);
export const getRecentLogs     = (n = 50) => api.get(`/api/logs/recent?limit=${n}`).then(unwrap);
export const getServiceStatus  = ()       => api.get('/api/service-status').then(unwrap);
export const getHealth         = ()       => api.get('/api/health').then(unwrap);
export const getIpIntel        = (ip)     => api.get(`/api/intel/${ip}`).then(unwrap);

export const uploadPcap = (file, projectId = 'pcap-upload') => {
  const form = new FormData();
  form.append('pcap', file);
  form.append('projectId', projectId);
  return api.post('/api/pcap/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(unwrap);
};

// ── Nexus API calls ───────────────────────────────────────────────────────
export const getPendingActions = ()   => api.get('/api/actions/pending').then(unwrap);
export const approveAction     = (id) => api.post(`/api/actions/${id}/approve`, { approvedBy: 'human' }).then(unwrapSafe);
export const rejectAction      = (id) => api.post(`/api/actions/${id}/reject`,  { rejectedBy: 'human' }).then(unwrapSafe);
export const getAuditLog       = (n = 50) => api.get(`/api/audit?limit=${n}`).then(unwrap);

// ── Gemini AI API calls ────────────────────────────────────────────────────

// Single-shot chat (POST) — supports conversation history
// history: [{ role: 'user'|'model', text: string }]
export const geminiChat = (question, history = []) =>
  api.post('/api/gemini/chat', { message: question, history }).then(unwrap);

// Streaming chat — returns an EventSource the caller must manage
// Yields SSE events: { type: 'chunk', text } | { type: 'done', suggestions, sourcedEventIds } | { type: 'error', errorCode }
export const geminiChatStream = (question, history = []) => {
  const params = new URLSearchParams({
    message: question,
    ...(history.length ? { history: JSON.stringify(history) } : {}),
  });
  return new EventSource(`${API_BASE}/api/gemini/chat/stream?${params}`);
};

// Report — supports reportType: 'technical' | 'executive' | 'forensic'
export const geminiReport = (attackId, reportType = 'technical') =>
  api.post(`/api/gemini/report/${attackId}`, { reportType }).then(unwrap);

// Report export — opens as a download URL
export const geminiReportExportUrl = (attackId, reportType = 'technical') =>
  `${API_BASE}/api/gemini/report/${attackId}/export?reportType=${reportType}`;

// Correlation
export const geminiCorrelate = () =>
  api.post('/api/gemini/correlate').then(unwrap);

// Correlation history — last 20 snapshots for risk score trending
export const geminiCorrelateHistory = () =>
  api.get('/api/gemini/correlate/history').then(unwrap);

// Mutation — returns variants with evasionProbability + category scoring
export const geminiMutate = (payload, attackType = 'unknown') =>
  api.post('/api/gemini/mutate', { payload, attackType }).then(unwrap);
