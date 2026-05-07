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
  { value: "pl Poland", label: "Poland" },
  { value: "de Germany", label: "Germany" },
  { value: "us USA", label: "USA" },
  { value: "ru Russia", label: "Russia" },
  { value: "nl Netherlands", label: "Netherlands" },
  { value: "fr France", label: "France" },
  { value: "gb UK", label: "UK" },
  { value: "ua Ukraine", label: "Ukraine" },
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