import { useState, useEffect, useRef } from 'react'
import { hostingApi, telegramApi } from '@/api/client'
import type { Hosting } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Server, Plus, Trash2, Check, Pencil, Globe, Search, Wand2, Loader2, Upload, MessageCircle } from 'lucide-react'

interface FormData {
  name: string
  url: string
  logo_url: string
}

const emptyForm: FormData = { name: '', url: '', logo_url: '' }

export function HostingManager() {
  const [hostings, setHostings] = useState<Hosting[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [fetchingTelegram, setFetchingTelegram] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    hostingApi.getAll().then(setHostings).catch(console.error).finally(() => setLoading(false))
  }, [])

  function openAdd() {
    setEditId(null)
    setForm(emptyForm)
    setLogoPreview(null)
    setDialogOpen(true)
  }

  function openEdit(hosting: Hosting) {
    setEditId(hosting.id)
    setForm({ name: hosting.name, url: hosting.url || '', logo_url: hosting.logo_url || '' })
    setLogoPreview(hosting.logo_url || null)
    setDialogOpen(true)
  }

  async function handleSave() {
    const name = form.name.trim()
    if (!name) return
    setSaving(true)
    try {
      if (editId) {
        const updated = await hostingApi.update(editId, form)
        setHostings((prev) => prev.map((h) => (h.id === editId ? updated : h)))
      } else {
        const created = await hostingApi.create(form)
        setHostings((prev) => [...prev, created])
      }
      setDialogOpen(false)
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Ошибка при сохранении')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await hostingApi.delete(id)
      setHostings((prev) => prev.filter((h) => h.id !== id))
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Ошибка при удалении')
    }
  }

  async function handleSetDefault(id: string) {
    const hosting = hostings.find((h) => h.id === id)
    if (!hosting) return
    try {
      const updated = await hostingApi.update(id, { is_default: !hosting.is_default })
      setHostings((prev) =>
        prev.map((h) => (h.id === id ? updated : { ...h, is_default: false }))
      )
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Ошибка')
    }
  }

  function extractDomain(url: string): string {
    const hostname = url.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0]
    const parts = hostname.split('.')
    const multiTlds: string[] = ['co.uk', 'com.au', 'co.jp', 'co.nz', 'co.kr', 'or.jp', 'ac.uk', 'gov.uk']
    if (parts.length > 2) {
      const lastTwo = parts.slice(-2).join('.')
      return multiTlds.includes(lastTwo) ? parts.slice(-3).join('.') : parts.slice(-2).join('.')
    }
    return hostname
  }

  function autoSetFavicon(siteUrl: string) {
    const domain = extractDomain(siteUrl)
    if (!domain) return
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    setLogoPreview(faviconUrl)
    setForm((prev) => ({ ...prev, logo_url: faviconUrl }))
  }

  function searchDuckDuckGo() {
    const domain = extractDomain(form.url)
    if (!domain) return
    const logoUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`
    setLogoPreview(logoUrl)
    setForm((prev) => ({ ...prev, logo_url: logoUrl }))
  }

  function searchFavicon() {
    const domain = extractDomain(form.url)
    if (!domain) return
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    setLogoPreview(faviconUrl)
    setForm((prev) => ({ ...prev, logo_url: faviconUrl }))
  }

  function isTelegramUrl(url: string): boolean {
    return /t\.me\/(\w+)$/.test(url.trim().replace(/\/$/, ''))
  }

  function extractTelegramUsername(url: string): string | null {
    const match = url.trim().replace(/\/$/, '').match(/t\.me\/(\w+)$/)
    return match ? match[1] : null
  }

  async function handleTelegramFetch() {
    const username = extractTelegramUsername(form.url)
    if (!username) return
    setFetchingTelegram(true)
    try {
      const result = await telegramApi.fetchAvatar(username)
      setLogoPreview(result.logo_url)
      setForm((prev) => ({ ...prev, logo_url: result.logo_url }))
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || 'Ошибка при загрузке аватара'
      alert(msg)
    } finally {
      setFetchingTelegram(false)
    }
  }

  function handleUrlChange(value: string) {
    setForm((prev) => ({ ...prev, url: value }))
    if (value.trim() && !editId) {
      autoSetFavicon(value)
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setLogoPreview(dataUrl)
      setForm((prev) => ({ ...prev, logo_url: dataUrl }))
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function removeLogoBg() {
    const url = form.logo_url
    if (!url) return

    if (url.startsWith('data:')) {
      processImage(url)
      return
    }

    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = canvasRef.current!
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        const threshold = 220
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
            data[i + 3] = 0
          }
        }
        ctx.putImageData(imageData, 0, 0)
        setLogoPreview(canvas.toDataURL('image/png'))
        setForm((prev) => ({ ...prev, logo_url: canvas.toDataURL('image/png') }))
      } catch {
        alert('Не удалось обработать изображение — сервер не поддерживает CORS. Скачайте логотип и загрузите через "Загрузить".')
      }
    }
    img.onerror = () => {
      alert('Не удалось загрузить изображение. Сервер не поддерживает CORS. Скачайте логотип и загрузите через "Загрузить".')
    }
    img.src = url
  }

  function processImage(url: string) {
    const img = new window.Image()
    img.onload = () => {
      const canvas = canvasRef.current!
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      const threshold = 220
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > threshold && data[i + 1] > threshold && data[i + 2] > threshold) {
          data[i + 3] = 0
        }
      }
      ctx.putImageData(imageData, 0, 0)
      setLogoPreview(canvas.toDataURL('image/png'))
      setForm((prev) => ({ ...prev, logo_url: canvas.toDataURL('image/png') }))
    }
    img.src = url
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-border/50 bg-card p-6">
        <p className="text-sm text-muted-foreground">Загрузка...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button onClick={openAdd} size="sm" className="flex items-center gap-1">
        <Plus className="h-4 w-4" />
        Добавить хостинг
      </Button>

      <div className="space-y-2">
        {hostings.length === 0 && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Нет добавленных хостингов
          </p>
        )}
        {hostings.map((hosting) => (
          <div
            key={hosting.id}
            className="flex items-center justify-between rounded-lg border border-border/50 bg-card px-4 py-3"
          >
            <div className="flex items-center gap-3">
              {hosting.logo_url ? (
                <img src={hosting.logo_url} alt="" className="h-6 w-6 rounded object-contain" />
              ) : (
                <Server className="h-4 w-4 text-muted-foreground" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{hosting.name}</span>
                  {hosting.is_default && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      По умолчанию
                    </span>
                  )}
                </div>
                {hosting.url && (
                  <a href={hosting.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                    <Globe className="h-3 w-3" />
                    {hosting.url.replace(/^https?:\/\//, '')}
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => openEdit(hosting)}
                className="rounded p-1.5 text-muted-foreground hover:text-foreground">
                <Pencil className="h-4 w-4" />
              </button>
              <button onClick={() => handleSetDefault(hosting.id)}
                className={'rounded p-1.5 ' + (hosting.is_default ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}
                title={hosting.is_default ? 'Убрать по умолчанию' : 'Сделать по умолчанию'}>
                <Check className="h-4 w-4" />
              </button>
              <button onClick={() => handleDelete(hosting.id)}
                className="rounded p-1.5 text-muted-foreground hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? 'Редактировать хостинг' : 'Добавить хостинг'}</DialogTitle>
            <DialogDescription>
              {editId ? 'Измените данные хостинг-провайдера' : 'Заполните информацию о хостинг-провайдере'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Название *</label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Hetzner" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Ссылка на сайт</label>
              <Input value={form.url} onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://hetzner.com" />
              <p className="mt-1 text-xs text-muted-foreground">Логотип автоматически подгружается из favicon</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Логотип</label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={searchDuckDuckGo}
                  disabled={!form.url.trim()}
                  title="Favicon через DuckDuckGo" className="flex items-center gap-1">
                  <Search className="h-4 w-4" />
                  DuckDuckGo
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={searchFavicon}
                  disabled={!form.url.trim()}
                  title="Логотип из favicon" className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  Favicon
                </Button>
                {isTelegramUrl(form.url) && (
                  <Button type="button" variant="outline" size="sm" onClick={handleTelegramFetch}
                    disabled={fetchingTelegram}
                    title="Загрузить аватар Telegram-бота" className="flex items-center gap-1">
                    {fetchingTelegram ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <MessageCircle className="h-4 w-4" />
                    )}
                    Telegram
                  </Button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
                  title="Загрузить с компьютера" className="flex items-center gap-1">
                  <Upload className="h-4 w-4" />
                  Загрузить
                </Button>
              </div>
            </div>
            {logoPreview && (
              <div className="space-y-2">
                <div className="flex items-start gap-3 rounded-lg border border-border/50 bg-card p-3">
                  <img src={logoPreview} alt="Preview"
                    className="h-12 w-12 rounded object-contain" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground break-all">{logoPreview.length > 120 ? logoPreview.slice(0, 120) + '...' : logoPreview}</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={removeLogoBg}
                    className="flex items-center gap-1 shrink-0">
                    <Wand2 className="h-4 w-4" />
                    Удалить фон
                  </Button>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button type="button" onClick={handleSave} disabled={!form.name.trim() || saving}>
              {saving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Сохранение...</>
              ) : (editId ? 'Сохранить' : 'Добавить')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
