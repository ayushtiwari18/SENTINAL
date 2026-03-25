import axios from 'axios';

const api = axios.create({ baseURL: 'http://localhost:3000' });

// unwrap standard { success, message, data } envelope
const unwrap = res => res.data.data;

export const getStats          = ()       => api.get('/api/stats').then(unwrap);
export const getRecentAttacks  = (n = 50) => api.get(`/api/attacks/recent?limit=${n}`).then(unwrap);
export const getForensics      = (id)     => api.get(`/api/attacks/${id}/forensics`).then(unwrap);
export const getAlerts         = (n = 50) => api.get(`/api/alerts?limit=${n}`).then(unwrap);
export const markAlertRead     = (id)     => api.patch(`/api/alerts/${id}/read`).then(unwrap);
export const getRecentLogs     = (n = 50) => api.get(`/api/logs/recent?limit=${n}`).then(unwrap);
export const getServiceStatus  = ()       => api.get('/api/service-status').then(unwrap);
export const getHealth         = ()       => api.get('/api/health').then(unwrap);
export const getIpIntel        = (ip)     => api.get(`/api/intel/${ip}`).then(unwrap);

// PCAP upload — multipart/form-data
export const uploadPcap = (file, projectId = 'pcap-upload') => {
  const form = new FormData();
  form.append('pcap', file);
  form.append('projectId', projectId);
  return api.post('/api/pcap/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(unwrap);
};
