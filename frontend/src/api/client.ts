import axios from 'axios'
import type { Server, ServerCreate, SyncResult, ActivityLog, Hosting, UptimeMonitor, UptimeCheck, UptimeMonitorWithStatus, TelegramTestTokenResponse, TelegramSendResponse, ExchangeRatesResponse, BrandingResponse, AuthLoginResponse, HostMetrics, MetricSnapshot } from '@/types'

const TOKEN_KEY = 'skadik-auth-token'

let authFailCallback: (() => void) | null = null

export function setAuthFailureCallback(fn: () => void) {
  authFailCallback = fn
}

const api = axios.create({
  baseURL: '/api',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
      authFailCallback?.()
    }
    return Promise.reject(error)
  }
)

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAuthToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAuthToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
  authFailCallback?.()
}

export const authApi = {
  login: (password: string) => api.post<AuthLoginResponse>('/auth/login', { password }).then(res => res.data),
  verify: () => api.post('/auth/verify').then(res => res.data),
}

export const serversApi = {
  getAll: () => api.get<Server[]>('/servers').then(res => res.data),
  getById: (id: string) => api.get<Server>(`/servers/${id}`).then(res => res.data),
  create: (data: ServerCreate) => api.post<Server>('/servers', data).then(res => res.data),
  update: (id: string, data: Record<string, unknown>) => api.put<Server>(`/servers/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/servers/${id}`),
  sync: (id: string) => api.post<SyncResult>(`/servers/${id}/sync`).then(res => res.data),
  syncTermix: (id: string) => api.post(`/servers/${id}/sync-termix`).then(res => res.data),
  syncGdrive: (id: string) => api.post(`/servers/${id}/sync-gdrive`).then(res => res.data),
}

export const activityApi = {
  getAll: () => api.get<ActivityLog[]>('/activity').then(res => res.data),
  create: (text: string, time: string) => api.post<ActivityLog>('/activity', { text, time }).then(res => res.data),
  delete: (id: string) => api.delete(`/activity/${id}`),
}

export const hostingApi = {
  getAll: () => api.get<Hosting[]>('/hostings').then(res => res.data),
  create: (data: { name: string; url?: string | null; logo_url?: string | null; is_default?: boolean }) =>
    api.post<Hosting>('/hostings', data).then(res => res.data),
  update: (id: string, data: { name?: string; url?: string | null; logo_url?: string | null; is_default?: boolean }) =>
    api.put<Hosting>(`/hostings/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/hostings/${id}`),
}

export const settingsApi = {
  getAll: () => api.get<Record<string, string>>('/settings').then(res => res.data),
  update: (data: Record<string, string>) => api.put<Record<string, string>>('/settings', data).then(res => res.data),
}

export const exchangeRatesApi = {
  get: () => api.get<ExchangeRatesResponse>('/exchange-rates').then(res => res.data),
  refresh: () => api.post<ExchangeRatesResponse>('/exchange-rates/refresh').then(res => res.data),
}

export const brandingApi = {
  get: () => api.get<BrandingResponse>('/settings/public').then(res => res.data),
}

export const telegramApi = {
  fetchAvatar: (botUsername: string) =>
    api.post<{ logo_url: string }>('/telegram/fetch-avatar', { bot_username: botUsername }).then(res => res.data),
  testToken: (token: string) =>
    api.post<TelegramTestTokenResponse>('/telegram/test-token', { token }).then(res => res.data),
  testNotify: (data: { chat_id?: string; topic_id?: string; down_text?: string; up_text?: string }) =>
    api.post<TelegramSendResponse>('/telegram/test-notify', data).then(res => res.data),
  testNotifyBilling: (data: { chat_id?: string; topic_id?: string; template?: string }) =>
    api.post<TelegramSendResponse>('/telegram/test-notify-billing', data).then(res => res.data),
}

export const uptimeApi = {
  getAll: () => api.get<UptimeMonitorWithStatus[]>('/uptime').then(res => res.data),
  create: (data: { name: string; host: string; port?: number; server_id?: string | null; check_interval?: number; is_active?: boolean }) =>
    api.post<UptimeMonitor>('/uptime', data).then(res => res.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put<UptimeMonitor>(`/uptime/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/uptime/${id}`),
  getChecks: (id: string, limit?: number) =>
    api.get<UptimeCheck[]>(`/uptime/${id}/checks`, { params: { limit } }).then(res => res.data),
  checkNow: (id: string) =>
    api.post(`/uptime/${id}/check-now`).then(res => res.data),
  restartScheduler: () =>
    api.post('/uptime/restart-scheduler').then(res => res.data),
}

export const metricsApi = {
  getMetrics: (hostId: number) => api.get<HostMetrics | { error: string; metrics: null }>(`/metrics/${hostId}`).then(res => res.data),
  getHistory: (hostId: number, minutes = 10) =>
    api.get<MetricSnapshot[]>(`/metrics/${hostId}/history`, { params: { minutes } }).then(res => res.data),
  refreshMetrics: (hostId: number) =>
    api.post<HostMetrics | { error: string }>(`/metrics/${hostId}/refresh`).then(res => res.data),
}

export default api