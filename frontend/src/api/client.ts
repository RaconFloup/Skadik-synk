import axios from 'axios'
import type { Server, ServerCreate, SyncResult } from '@/types'

const api = axios.create({
  baseURL: '/api',
})

export const serversApi = {
  getAll: () => api.get<Server[]>('/servers').then(res => res.data),
  getById: (id: string) => api.get<Server>(`/servers/${id}`).then(res => res.data),
  create: (data: ServerCreate) => api.post<Server>('/servers', data).then(res => res.data),
  update: (id: string, data: Partial<ServerCreate>) => api.put<Server>(`/servers/${id}`, data).then(res => res.data),
  delete: (id: string) => api.delete(`/servers/${id}`),
  sync: (id: string) => api.post<SyncResult>(`/servers/${id}/sync`).then(res => res.data),
  syncTermix: (id: string) => api.post(`/servers/${id}/sync-termix`).then(res => res.data),
  syncZublo: (id: string) => api.post(`/servers/${id}/sync-zublo`).then(res => res.data),
  syncGdrive: (id: string) => api.post(`/servers/${id}/sync-gdrive`).then(res => res.data),
}

export default api