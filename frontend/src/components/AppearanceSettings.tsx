import { useState } from 'react'
import { themes, getThemeById, applyTheme } from '@/config/themes'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Palette, Sun, Moon } from 'lucide-react'

const STORAGE_KEY = 'skadik-theme-settings'

interface ThemeSettings {
  themeId: string
  isDark: boolean
  customColors: Record<string, string>
  useCustomColors: boolean
}

function loadSettings(): ThemeSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (e) {
    console.error('Failed to load theme settings:', e)
  }
  return {
    themeId: 'green',
    isDark: false,
    customColors: {},
    useCustomColors: false,
  }
}

function saveSettings(settings: ThemeSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

const colorLabels: Record<string, string> = {
  primary: 'Основной цвет',
  background: 'Фон',
  foreground: 'Текст',
  card: 'Карточки',
  accent: 'Акцент',
  destructive: 'Опасные действия',
  border: 'Границы',
  muted: 'Вторичный текст',
}

export function AppearanceSettings() {
  const [settings, setSettings] = useState<ThemeSettings>(loadSettings)
  const [activeTab, setActiveTab] = useState<'themes' | 'colors'>('themes')

  function handleThemeChange(themeId: string) {
    const newSettings = { ...settings, themeId, useCustomColors: false }
    setSettings(newSettings)
    saveSettings(newSettings)
    const theme = getThemeById(themeId)
    applyTheme(theme, newSettings.isDark)
  }

  function handleDarkModeToggle() {
    const newIsDark = !settings.isDark
    const newSettings = { ...settings, isDark: newIsDark }
    setSettings(newSettings)
    saveSettings(newSettings)
    if (settings.useCustomColors && Object.keys(settings.customColors).length > 0) {
      const root = document.documentElement
      if (newIsDark) {
        root.classList.add('dark')
      } else {
        root.classList.remove('dark')
      }
    } else {
      const theme = getThemeById(settings.themeId)
      applyTheme(theme, newIsDark)
    }
  }

  function handleColorChange(colorKey: string, value: string) {
    const newCustomColors = { ...settings.customColors, [colorKey]: value }
    const newSettings = {
      ...settings,
      customColors: newCustomColors,
      useCustomColors: true,
    }
    setSettings(newSettings)
    saveSettings(newSettings)
    const root = document.documentElement
    if (settings.isDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
    Object.entries(newCustomColors).forEach(([key, val]) => {
      const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
      root.style.setProperty(cssVar, val)
    })
  }

  function handleResetColors() {
    const newSettings = { ...settings, customColors: {}, useCustomColors: false }
    setSettings(newSettings)
    saveSettings(newSettings)
    const theme = getThemeById(settings.themeId)
    applyTheme(theme, settings.isDark)
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Внешний вид</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Настройте тему оформления и цвета интерфейса
        </p>
      </div>

      <div className="flex gap-2 border-b border-border/50">
        <button
          onClick={() => setActiveTab('themes')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'themes'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Palette className="h-4 w-4" />
          Темы
        </button>
        <button
          onClick={() => setActiveTab('colors')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'colors'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Palette className="h-4 w-4" />
          Цвета
        </button>
      </div>

      {activeTab === 'themes' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Выбор темы</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDarkModeToggle}
              className="flex items-center gap-2"
            >
              {settings.isDark ? (
                <>
                  <Sun className="h-4 w-4" />
                  Светлая
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  Темная
                </>
              )}
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {themes.map((theme) => (
              <Card
                key={theme.id}
                className={`cursor-pointer border-2 p-4 transition-all hover:shadow-md ${
                  settings.themeId === theme.id && !settings.useCustomColors
                    ? 'border-primary'
                    : 'border-border/50'
                }`}
                onClick={() => handleThemeChange(theme.id)}
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-medium">{theme.name}</span>
                  {settings.themeId === theme.id && !settings.useCustomColors && (
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex gap-2">
                  <div
                    className="h-8 flex-1 rounded-md"
                    style={{ backgroundColor: `hsl(${theme.light.primary})` }}
                  />
                  <div
                    className="h-8 flex-1 rounded-md"
                    style={{ backgroundColor: `hsl(${theme.light.background})` }}
                  />
                  <div
                    className="h-8 flex-1 rounded-md"
                    style={{ backgroundColor: `hsl(${theme.light.accent})` }}
                  />
                  <div
                    className="h-8 flex-1 rounded-md"
                    style={{ backgroundColor: `hsl(${theme.light.card})` }}
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'colors' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium">Ручная настройка цветов</h3>
            <Button variant="outline" size="sm" onClick={handleResetColors}>
              Сбросить
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {Object.entries(colorLabels).map(([key, label]) => {
              const currentTheme = getThemeById(settings.themeId)
              const themeColors = settings.isDark ? currentTheme.dark : currentTheme.light
              const currentValue =
                settings.customColors[key] ||
                themeColors[key as keyof typeof themeColors] ||
                ''

              return (
                <div key={key} className="flex items-center justify-between rounded-lg border border-border/50 p-3">
                  <span className="text-sm font-medium">{label}</span>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-8 w-8 rounded-md border border-border/50"
                      style={{ backgroundColor: `hsl(${currentValue})` }}
                    />
                    <input
                      type="color"
                      value={hslToHex(currentValue)}
                      onChange={(e) => handleColorChange(key, hexToHsl(e.target.value))}
                      className="h-8 w-12 cursor-pointer rounded-md border-0 bg-transparent p-0"
                    />
                    <span className="w-20 text-xs text-muted-foreground">
                      {currentValue}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>

          <Card className="p-4">
            <p className="mb-2 text-sm font-medium">Предпросмотр</p>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button>Основная кнопка</Button>
                <Button variant="secondary">Вторичная</Button>
                <Button variant="destructive">Опасная</Button>
              </div>
              <div className="rounded-lg border border-border/50 p-3">
                <p className="text-sm font-medium">Пример карточки</p>
                <p className="text-xs text-muted-foreground">Текст с пояснением</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function hslToHex(hsl: string): string {
  try {
    const [h, s, l] = hsl.split(' ').map((v) => parseFloat(v.replace('%', '')))
    const sNorm = s / 100
    const lNorm = l / 100

    const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
    const m = lNorm - c / 2

    let r = 0, g = 0, b = 0

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c
    } else {
      r = c; g = 0; b = x
    }

    r = Math.round((r + m) * 255)
    g = Math.round((g + m) * 255)
    b = Math.round((b + m) * 255)

    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
  } catch {
    return '#000000'
  }
}

function hexToHsl(hex: string): string {
  try {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
        case g: h = ((b - r) / d + 2) / 6; break
        case b: h = ((r - g) / d + 4) / 6; break
      }
    }

    h = Math.round(h * 360)
    s = Math.round(s * 100)
    l = Math.round(l * 100)

    return `${h} ${s}% ${l}%`
  } catch {
    return '0 0% 0%'
  }
}
