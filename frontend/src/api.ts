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
  changePassword: (body: any) => http.post('/auth/change-password', body).then((r) => r.data),
  users: () => http.get('/users').then((r) => r.data),
  updateUser: (id: number, body: any) => http.patch(`/users/${id}`, body).then((r) => r.data),
  deleteUser: (id: number) => http.delete(`/users/${id}`).then((r) => r.data),
  companies: () => http.get('/companies').then((r) => r.data),
  departments: (companyId?: number) => http.get('/departments', { params: companyId ? { companyId } : {} }).then((r) => r.data),
  memos: (params: Record<string, string> = {}) => http.get('/memos', { params }).then((r) => r.data),
  memo: (id: number) => http.get(`/memos/${id}`).then((r) => r.data),
  createMemo: (body: any) => http.post('/memos', body).then((r) => r.data),
  updateMemo: (id: number, body: any) => http.put(`/memos/${id}`, body).then((r) => r.data),
  deleteMemo: (id: number) => http.delete(`/memos/${id}`).then((r) => r.data),
  submitMemo: (id: number, next?: string) => http.post(`/memos/${id}/submit`, { next }).then((r) => r.data),
  approveMemo: (id: number, comment?: string, next?: string) => http.post(`/memos/${id}/approve`, { comment, next }).then((r) => r.data),
  rejectMemo: (id: number, comment: string) => http.post(`/memos/${id}/reject`, { comment }).then((r) => r.data),
  holdMemo: (id: number, comment?: string) => http.post(`/memos/${id}/hold`, { comment }).then((r) => r.data),
  forwardMemo: (id: number, recipients: string[]) => http.post(`/memos/${id}/forward`, { recipients }).then((r) => r.data),
  announcement: () => http.get('/announcement').then((r) => r.data),
  setAnnouncement: (message: string, active: boolean) => http.put('/announcement', { message, active }).then((r) => r.data),
  summary: () => http.get('/dashboard/summary').then((r) => r.data),
  monthly: () => http.get('/dashboard/monthly').then((r) => r.data),
  series: (range: string, companyId?: string) => http.get('/dashboard/series', { params: { range, ...(companyId ? { companyId } : {}) } }).then((r) => r.data),
  demoSeed: () => http.post('/dashboard/demo-seed').then((r) => r.data),
  overview: (params: Record<string, string> = {}) => http.get('/dashboard/overview', { params }).then((r) => r.data),
  byCompany: () => http.get('/dashboard/company').then((r) => r.data),
  byDept: () => http.get('/dashboard/department').then((r) => r.data),
  listAttachments: (memoId: number) => http.get(`/memos/${memoId}/attachments`).then((r) => r.data),
  uploadAttachment: (memoId: number, file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return http.post(`/memos/${memoId}/attachments`, fd).then((r) => r.data);
  },
  deleteAttachment: (memoId: number, attId: number) =>
    http.delete(`/memos/${memoId}/attachments/${attId}`).then((r) => r.data),
  downloadAttachment: async (memoId: number, attId: number, filename: string) => {
    const res = await http.get(`/memos/${memoId}/attachments/${attId}`, { responseType: 'blob' });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  },
  attachmentBlobUrl: async (memoId: number, attId: number) => {
    const res = await http.get(`/memos/${memoId}/attachments/${attId}`, { responseType: 'blob' });
    return URL.createObjectURL(res.data as Blob);
  },
  pdfUrl: (id: number) => `${BASE}/memos/${id}/pdf`,
  openPdf: async (id: number, memoNo?: string) => {
    const res = await http.get(`/memos/${id}/pdf`, { responseType: 'blob' });
    const blob = new Blob([res.data as BlobPart], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(memoNo || 'memo-' + id).replace(/[^\w.-]+/g, '_')}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  },
};
