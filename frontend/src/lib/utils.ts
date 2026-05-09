import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const RATES_UPDATED_EVENT = 'skadik-rates-updated'

export function dispatchRatesUpdated() {
  window.dispatchEvent(new CustomEvent(RATES_UPDATED_EVENT))
}