export interface Server {
  id: string
  purpose: string
  hosting: string
  country: string
  status: string
  ip: string
  ssh_port: number
  ssh_username: string
  ssh_password: string
  traffic?: string
  cost?: number
  currency: string
  cycle: string
  created?: string
  next_payment?: string
  notes?: string
  services?: Record<string, string>
  termix_host_id?: string
  google_doc_id?: string
  needs_sync: boolean
  not_renewing: boolean
  created_at: string
  updated_at: string
}

export interface ServerCreate {
  purpose: string
  hosting: string
  country: string
  ip: string
  ssh_port?: number
  ssh_username: string
  ssh_password: string
  traffic?: string
  cost?: number
  currency?: string
  cycle?: string
  created?: string
  next_payment?: string
  notes?: string
  services?: Record<string, string>
}

export interface PurposeItem {
  value: string
  label: string
}

export const DEFAULT_PURPOSES: PurposeItem[] = [
  { value: "NODE", label: "NODE" },
  { value: "PANEL", label: "PANEL" },
  { value: "SERVICES", label: "SERVICES" },
]

export const COUNTRIES = [
  { value: "au Australia", label: "Австралия" },
  { value: "at Austria", label: "Австрия" },
  { value: "az Azerbaijan", label: "Азербайджан" },
  { value: "al Albania", label: "Албания" },
  { value: "dz Algeria", label: "Алжир" },
  { value: "ar Argentina", label: "Аргентина" },
  { value: "am Armenia", label: "Армения" },
  { value: "by Belarus", label: "Беларусь" },
  { value: "be Belgium", label: "Бельгия" },
  { value: "bg Bulgaria", label: "Болгария" },
  { value: "br Brazil", label: "Бразилия" },
  { value: "gb UK", label: "Великобритания" },
  { value: "hu Hungary", label: "Венгрия" },
  { value: "vn Vietnam", label: "Вьетнам" },
  { value: "de Germany", label: "Германия" },
  { value: "gr Greece", label: "Греция" },
  { value: "ge Georgia", label: "Грузия" },
  { value: "dk Denmark", label: "Дания" },
  { value: "eg Egypt", label: "Египет" },
  { value: "il Israel", label: "Израиль" },
  { value: "in India", label: "Индия" },
  { value: "id Indonesia", label: "Индонезия" },
  { value: "ie Ireland", label: "Ирландия" },
  { value: "is Iceland", label: "Исландия" },
  { value: "es Spain", label: "Испания" },
  { value: "it Italy", label: "Италия" },
  { value: "kz Kazakhstan", label: "Казахстан" },
  { value: "ca Canada", label: "Канада" },
  { value: "cy Cyprus", label: "Кипр" },
  { value: "kg Kyrgyzstan", label: "Кыргызстан" },
  { value: "cn China", label: "Китай" },
  { value: "lv Latvia", label: "Латвия" },
  { value: "lt Lithuania", label: "Литва" },
  { value: "lu Luxembourg", label: "Люксембург" },
  { value: "mt Malta", label: "Мальта" },
  { value: "ma Morocco", label: "Марокко" },
  { value: "mx Mexico", label: "Мексика" },
  { value: "md Moldova", label: "Молдова" },
  { value: "mc Monaco", label: "Монако" },
  { value: "nl Netherlands", label: "Нидерланды" },
  { value: "nz New Zealand", label: "Новая Зеландия" },
  { value: "no Norway", label: "Норвегия" },
  { value: "ae UAE", label: "ОАЭ" },
  { value: "pl Poland", label: "Польша" },
  { value: "pt Portugal", label: "Португалия" },
  { value: "kr South Korea", label: "Республика Корея" },
  { value: "ru Russia", label: "Россия" },
  { value: "ro Romania", label: "Румыния" },
  { value: "rs Serbia", label: "Сербия" },
  { value: "sg Singapore", label: "Сингапур" },
  { value: "sk Slovakia", label: "Словакия" },
  { value: "si Slovenia", label: "Словения" },
  { value: "us USA", label: "США" },
  { value: "tj Tajikistan", label: "Таджикистан" },
  { value: "th Thailand", label: "Таиланд" },
  { value: "tr Turkey", label: "Турция" },
  { value: "uz Uzbekistan", label: "Узбекистан" },
  { value: "ua Ukraine", label: "Украина" },
  { value: "fi Finland", label: "Финляндия" },
  { value: "fr France", label: "Франция" },
  { value: "hr Croatia", label: "Хорватия" },
  { value: "cz Czech Republic", label: "Чехия" },
  { value: "ch Switzerland", label: "Швейцария" },
  { value: "se Sweden", label: "Швеция" },
  { value: "ee Estonia", label: "Эстония" },
  { value: "jp Japan", label: "Япония" },
]

export const CURRENCIES = [
  { value: "USD", label: "USD ($)" },
  { value: "RUB", label: "RUB (₽)" },
  { value: "EUR", label: "EUR (€)" },
]

export const CYCLES = [
  { value: "daily", label: "Ежедневно" },
  { value: "weekly", label: "Еженедельно" },
  { value: "monthly", label: "Ежемесячно" },
  { value: "yearly", label: "Ежегодно" },
]

export const STATUSES = [
  { value: "active", label: "Активен" },
  { value: "inactive", label: "Неактивен" },
]

export const HOSTING_SUGGESTIONS = [
  "ExpressHost",
  "Hetzner",
  "DigitalOcean",
  "Linode",
  "Vultr",
  "AWS",
  "Google Cloud",
  "Azure",
]

export interface SyncResult {
  termix?: { success: boolean; error?: string }
  google_drive?: { success: boolean; error?: string }
}

export interface ActivityLog {
  id: string
  text: string
  time: string
  created_at: string
}

export interface Hosting {
  id: string
  name: string
  url?: string | null
  logo_url?: string | null
  is_default: boolean
  created_at: string
}

export interface UptimeMonitor {
  id: string
  server_id?: string | null
  name: string
  host: string
  port: number
  check_interval: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UptimeCheck {
  id: string
  monitor_id: string
  is_up: boolean
  response_time_ms?: number | null
  error?: string | null
  checked_at: string
}

export interface UptimeMonitorWithStatus {
  monitor: UptimeMonitor
  last_check: UptimeCheck | null
  recent_checks: UptimeCheck[]
  uptime_24h: number | null
  uptime_7d: number | null
}