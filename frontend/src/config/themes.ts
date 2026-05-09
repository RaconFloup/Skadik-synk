export interface ThemeColors {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  border: string
  input: string
  ring: string
}

export interface Theme {
  name: string
  id: string
  light: ThemeColors
  dark: ThemeColors
}

export const themes: Theme[] = [
  {
    name: 'Зеленый (по умолчанию)',
    id: 'green',
    light: {
      background: '156 15% 98%',
      foreground: '156 23% 4%',
      card: '0 0% 100%',
      cardForeground: '156 19% 10%',
      popover: '0 0% 100%',
      popoverForeground: '156 19% 10%',
      primary: '156 9% 39%',
      primaryForeground: '156 15% 98%',
      secondary: '156 11% 90%',
      secondaryForeground: '156 11% 15%',
      muted: '156 11% 90%',
      mutedForeground: '156 11% 25%',
      accent: '156 12% 83%',
      accentForeground: '156 11% 15%',
      destructive: '0 72% 51%',
      destructiveForeground: '156 15% 98%',
      border: '156 12% 83%',
      input: '156 12% 83%',
      ring: '156 9% 39%',
    },
    dark: {
      background: '156 23% 4%',
      foreground: '156 6% 96%',
      card: '156 19% 10%',
      cardForeground: '156 6% 96%',
      popover: '156 19% 10%',
      popoverForeground: '156 6% 96%',
      primary: '156 11% 64%',
      primaryForeground: '156 6% 96%',
      secondary: '156 11% 15%',
      secondaryForeground: '156 11% 90%',
      muted: '156 11% 15%',
      mutedForeground: '156 11% 64%',
      accent: '156 11% 25%',
      accentForeground: '156 6% 96%',
      destructive: '0 63% 31%',
      destructiveForeground: '156 6% 96%',
      border: '156 11% 25%',
      input: '156 11% 25%',
      ring: '156 11% 64%',
    },
  },
  {
    name: 'Синий',
    id: 'blue',
    light: {
      background: '210 15% 98%',
      foreground: '210 23% 4%',
      card: '0 0% 100%',
      cardForeground: '210 19% 10%',
      popover: '0 0% 100%',
      popoverForeground: '210 19% 10%',
      primary: '210 100% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '210 11% 90%',
      secondaryForeground: '210 11% 15%',
      muted: '210 11% 90%',
      mutedForeground: '210 11% 25%',
      accent: '210 12% 83%',
      accentForeground: '210 11% 15%',
      destructive: '0 72% 51%',
      destructiveForeground: '0 0% 100%',
      border: '210 12% 83%',
      input: '210 12% 83%',
      ring: '210 100% 50%',
    },
    dark: {
      background: '210 23% 4%',
      foreground: '210 6% 96%',
      card: '210 19% 10%',
      cardForeground: '210 6% 96%',
      popover: '210 19% 10%',
      popoverForeground: '210 6% 96%',
      primary: '210 100% 60%',
      primaryForeground: '0 0% 100%',
      secondary: '210 11% 15%',
      secondaryForeground: '210 11% 90%',
      muted: '210 11% 15%',
      mutedForeground: '210 11% 64%',
      accent: '210 11% 25%',
      accentForeground: '210 6% 96%',
      destructive: '0 63% 31%',
      destructiveForeground: '0 0% 100%',
      border: '210 11% 25%',
      input: '210 11% 25%',
      ring: '210 100% 60%',
    },
  },
  {
    name: 'Фиолетовый',
    id: 'purple',
    light: {
      background: '270 15% 98%',
      foreground: '270 23% 4%',
      card: '0 0% 100%',
      cardForeground: '270 19% 10%',
      popover: '0 0% 100%',
      popoverForeground: '270 19% 10%',
      primary: '270 50% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '270 11% 90%',
      secondaryForeground: '270 11% 15%',
      muted: '270 11% 90%',
      mutedForeground: '270 11% 25%',
      accent: '270 12% 83%',
      accentForeground: '270 11% 15%',
      destructive: '0 72% 51%',
      destructiveForeground: '0 0% 100%',
      border: '270 12% 83%',
      input: '270 12% 83%',
      ring: '270 50% 50%',
    },
    dark: {
      background: '270 23% 4%',
      foreground: '270 6% 96%',
      card: '270 19% 10%',
      cardForeground: '270 6% 96%',
      popover: '270 19% 10%',
      popoverForeground: '270 6% 96%',
      primary: '270 50% 60%',
      primaryForeground: '0 0% 100%',
      secondary: '270 11% 15%',
      secondaryForeground: '270 11% 90%',
      muted: '270 11% 15%',
      mutedForeground: '270 11% 64%',
      accent: '270 11% 25%',
      accentForeground: '270 6% 96%',
      destructive: '0 63% 31%',
      destructiveForeground: '0 0% 100%',
      border: '270 11% 25%',
      input: '270 11% 25%',
      ring: '270 50% 60%',
    },
  },
  {
    name: 'Розовый',
    id: 'rose',
    light: {
      background: '340 15% 98%',
      foreground: '340 23% 4%',
      card: '0 0% 100%',
      cardForeground: '340 19% 10%',
      popover: '0 0% 100%',
      popoverForeground: '340 19% 10%',
      primary: '340 82% 52%',
      primaryForeground: '0 0% 100%',
      secondary: '340 11% 90%',
      secondaryForeground: '340 11% 15%',
      muted: '340 11% 90%',
      mutedForeground: '340 11% 25%',
      accent: '340 12% 83%',
      accentForeground: '340 11% 15%',
      destructive: '0 72% 51%',
      destructiveForeground: '0 0% 100%',
      border: '340 12% 83%',
      input: '340 12% 83%',
      ring: '340 82% 52%',
    },
    dark: {
      background: '340 23% 4%',
      foreground: '340 6% 96%',
      card: '340 19% 10%',
      cardForeground: '340 6% 96%',
      popover: '340 19% 10%',
      popoverForeground: '340 6% 96%',
      primary: '340 82% 62%',
      primaryForeground: '0 0% 100%',
      secondary: '340 11% 15%',
      secondaryForeground: '340 11% 90%',
      muted: '340 11% 15%',
      mutedForeground: '340 11% 64%',
      accent: '340 11% 25%',
      accentForeground: '340 6% 96%',
      destructive: '0 63% 31%',
      destructiveForeground: '0 0% 100%',
      border: '340 11% 25%',
      input: '340 11% 25%',
      ring: '340 82% 62%',
    },
  },
  {
    name: 'Оранжевый',
    id: 'orange',
    light: {
      background: '24 15% 98%',
      foreground: '24 23% 4%',
      card: '0 0% 100%',
      cardForeground: '24 19% 10%',
      popover: '0 0% 100%',
      popoverForeground: '24 19% 10%',
      primary: '24 95% 50%',
      primaryForeground: '0 0% 100%',
      secondary: '24 11% 90%',
      secondaryForeground: '24 11% 15%',
      muted: '24 11% 90%',
      mutedForeground: '24 11% 25%',
      accent: '24 12% 83%',
      accentForeground: '24 11% 15%',
      destructive: '0 72% 51%',
      destructiveForeground: '0 0% 100%',
      border: '24 12% 83%',
      input: '24 12% 83%',
      ring: '24 95% 50%',
    },
    dark: {
      background: '24 23% 4%',
      foreground: '24 6% 96%',
      card: '24 19% 10%',
      cardForeground: '24 6% 96%',
      popover: '24 19% 10%',
      popoverForeground: '24 6% 96%',
      primary: '24 95% 60%',
      primaryForeground: '0 0% 100%',
      secondary: '24 11% 15%',
      secondaryForeground: '24 11% 90%',
      muted: '24 11% 15%',
      mutedForeground: '24 11% 64%',
      accent: '24 11% 25%',
      accentForeground: '24 6% 96%',
      destructive: '0 63% 31%',
      destructiveForeground: '0 0% 100%',
      border: '24 11% 25%',
      input: '24 11% 25%',
      ring: '24 95% 60%',
    },
  },
]

export const defaultTheme = themes[0]

export function getThemeById(id: string): Theme {
  return themes.find((t) => t.id === id) || defaultTheme
}

export function applyTheme(theme: Theme, isDark: boolean = false) {
  const root = document.documentElement
  const colors = isDark ? theme.dark : theme.light

  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }

  Object.entries(colors).forEach(([key, value]) => {
    const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
    root.style.setProperty(cssVar, value)
  })
}

export function applyDarkMode(isDark: boolean) {
  const root = document.documentElement
  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
}

export const STORAGE_KEY = 'skadik-theme-settings'

export interface ThemeSettings {
  themeId: string
  isDark: boolean
  gradientBg: boolean
  customColors: Record<string, string>
  useCustomColors: boolean
}

export function loadAndApplyTheme() {
  const defaultTheme = getThemeById('green')
  applyTheme(defaultTheme, false)
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const settings: ThemeSettings = JSON.parse(saved)
      if (settings.useCustomColors && Object.keys(settings.customColors).length > 0) {
        const root = document.documentElement
        if (settings.isDark) {
          root.classList.add('dark')
        } else {
          root.classList.remove('dark')
        }
        Object.entries(settings.customColors).forEach(([key, value]) => {
          const cssVar = `--${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`
          root.style.setProperty(cssVar, value)
        })
      } else {
        const theme = getThemeById(settings.themeId || 'green')
        applyTheme(theme, settings.isDark ?? false)
      }
    }
  } catch (e) {
    console.error('Failed to load theme settings:', e)
  }
}
