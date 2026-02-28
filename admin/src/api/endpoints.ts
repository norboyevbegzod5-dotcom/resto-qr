import api from './client';

export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
};

export const usersApi = {
  getAll: (params?: Record<string, any>) =>
    api.get('/admin/users', { params }),
};

export const brandsApi = {
  getAll: () => api.get('/admin/brands'),
  create: (data: { name: string; slug: string }) => api.post('/admin/brands', data),
  update: (id: number, data: { name: string; slug: string }) => api.put(`/admin/brands/${id}`, data),
  delete: (id: number) => api.delete(`/admin/brands/${id}`),
};

export const campaignsApi = {
  getAll: () => api.get('/admin/campaigns'),
  getById: (id: number) => api.get(`/admin/campaigns/${id}`),
  create: (data: any) => api.post('/admin/campaigns', data),
  update: (id: number, data: any) => api.put(`/admin/campaigns/${id}`, data),
  delete: (id: number) => api.delete(`/admin/campaigns/${id}`),
};

export const vouchersApi = {
  getAll: (params?: Record<string, any>) =>
    api.get('/admin/vouchers', { params }),
  generate: (data: { campaignId: number; brandId: number; count: number }) =>
    api.post('/admin/vouchers/generate', data),
  exportCsv: (params?: Record<string, any>) =>
    api.get('/admin/vouchers/export', { params, responseType: 'blob' }),
  getQrUrl: (code: string) => `/api/admin/vouchers/qr/${code}`,
  exportQrPdf: (params: { campaignId: number; brandId?: number; status?: string }) =>
    api.get('/admin/vouchers/qr-batch', { params, responseType: 'blob' }),
  exportQrZip: (params: { campaignId: number; brandId?: number; status?: string }) =>
    api.get('/admin/vouchers/qr-batch-zip', { params, responseType: 'blob' }),
  deleteAll: () => api.delete('/admin/vouchers/all'),
};

export const botsApi = {
  getAll: () => api.get('/admin/bots'),
  create: (data: { name: string; token: string; username: string; brandId?: number; miniAppUrl?: string }) =>
    api.post('/admin/bots', data),
  update: (id: number, data: any) => api.put(`/admin/bots/${id}`, data),
  delete: (id: number) => api.delete(`/admin/bots/${id}`),
  restart: (id: number) => api.post(`/admin/bots/${id}/restart`),
  stop: (id: number) => api.post(`/admin/bots/${id}/stop`),
};

export const lotteryApi = {
  checkCode: (code: string) => api.post('/admin/check-code', { code }),
  markWinner: (code: string) => api.post('/admin/mark-winner', { code }),
};

export const broadcastApi = {
  preview: (filters: { minVouchers?: number; maxRemaining?: number; eligible?: boolean }) =>
    api.post('/admin/broadcast/preview', filters),
  send: (data: { message: string; minVouchers?: number; maxRemaining?: number; eligible?: boolean }) =>
    api.post('/admin/broadcast/send', data),
};

export const statsApi = {
  get: () => api.get('/admin/stats'),
};
