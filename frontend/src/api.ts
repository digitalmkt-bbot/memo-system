import axios from 'axios';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const http = axios.create({ baseURL: BASE });

export const setToken = (t: string | null) => {
  if (t) localStorage.setItem('token', t);
  else localStorage.removeItem('token');
};
export const getToken = () => localStorage.getItem('token');

http.interceptors.request.use((cfg) => {
  const t = getToken();
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      setToken(null);
      if (!location.hash.includes('/login')) location.hash = '#/login';
    }
    const msg = err.response?.data?.message || err.response?.data?.error || err.message;
    return Promise.reject(new Error(Array.isArray(msg) ? msg.join(', ') : msg));
  },
);

export const api = {
  login: (email: string, password: string) => http.post('/auth/login', { email, password }).then((r) => r.data),
  logout: () => http.post('/auth/logout').then((r) => r.data),
  register: (body: any) => http.post('/auth/register', body).then((r) => r.data),
  companies: () => http.get('/companies').then((r) => r.data),
  departments: (companyId?: number) => http.get('/departments', { params: companyId ? { companyId } : {} }).then((r) => r.data),
  memos: (params: Record<string, string> = {}) => http.get('/memos', { params }).then((r) => r.data),
  memo: (id: number) => http.get(`/memos/${id}`).then((r) => r.data),
  createMemo: (body: any) => http.post('/memos', body).then((r) => r.data),
  updateMemo: (id: number, body: any) => http.put(`/memos/${id}`, body).then((r) => r.data),
  deleteMemo: (id: number) => http.delete(`/memos/${id}`).then((r) => r.data),
  submitMemo: (id: number) => http.post(`/memos/${id}/submit`).then((r) => r.data),
  approveMemo: (id: number, comment?: string) => http.post(`/memos/${id}/approve`, { comment }).then((r) => r.data),
  rejectMemo: (id: number, comment: string) => http.post(`/memos/${id}/reject`, { comment }).then((r) => r.data),
  summary: () => http.get('/dashboard/summary').then((r) => r.data),
  monthly: () => http.get('/dashboard/monthly').then((r) => r.data),
  byCompany: () => http.get('/dashboard/company').then((r) => r.data),
  byDept: () => http.get('/dashboard/department').then((r) => r.data),
  pdfUrl: (id: number) => `${BASE}/memos/${id}/pdf`,
};
