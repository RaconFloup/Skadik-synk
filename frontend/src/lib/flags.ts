const FLAG_MAP: Record<string, string> = {
  Poland: 'pl',
  Germany: 'de',
  USA: 'us',
  Russia: 'ru',
  Netherlands: 'nl',
  France: 'fr',
  UK: 'gb',
  Ukraine: 'ua',
}

const EMOJI_MAP: Record<string, string> = {
  '\u{1F1F5}\u{1F1F1}': 'pl',
  '\u{1F1E9}\u{1F1EA}': 'de',
  '\u{1F1FA}\u{1F1F8}': 'us',
  '\u{1F1F7}\u{1F1FA}': 'ru',
  '\u{1F1F3}\u{1F1F1}': 'nl',
  '\u{1F1EB}\u{1F1F7}': 'fr',
  '\u{1F1EC}\u{1F1E7}': 'gb',
  '\u{1F1FA}\u{1F1E6}': 'ua',
}

export function normalizeCountry(raw: string): string {
  if (/^[a-z]{2}\s/.test(raw)) return raw
  const emoji = raw.match(/^\p{So}{2}/u)?.[0]
  const code = emoji ? EMOJI_MAP[emoji] : null
  const name = raw.replace(/^[^\s]+\s/, '').trim()
  return code ? `${code} ${name}` : raw
}

export function countryName(raw: string): string {
  const normalized = normalizeCountry(raw)
  return normalized.replace(/^[^\s]+\s/, '').trim()
}

export function flagImg(raw: string): string | null {
  const code = normalizeCountry(raw).split(/\s/)[0]
  return code && Object.values(FLAG_MAP).includes(code) ? `https://flagcdn.com/w20/${code}.png` : null
}
