import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Currency ──────────────────────────────────────────────────────────────────
//
// Users pick a currency in onboarding / Settings → Profile (saved as
// `user_settings.currency`). AuthProvider keeps it in sync via
// `setActiveCurrency`, and `formatCurrency` formats with it, so call sites just
// use `formatCurrency(amount)`.

/** Currencies offered in onboarding and settings → the locale used to format them. */
export const CURRENCY_LOCALES: Record<string, string> = {
  INR: "en-IN", // ₹1,18,000.00 (lakh/crore grouping)
  USD: "en-US", // $1,180.00
  EUR: "en-IE", // €1,180.00 (English formatting)
  GBP: "en-GB", // £1,180.00
  JPY: "en-US", // ¥1,180
  AUD: "en-US", // A$1,180.00 (unambiguous vs USD)
  CAD: "en-US", // CA$1,180.00
}

export const DEFAULT_CURRENCY = "INR"

let activeCurrency = DEFAULT_CURRENCY

const normalizeCurrency = (code?: string | null): string => {
  const c = typeof code === "string" ? code.trim().toUpperCase() : ""
  return c in CURRENCY_LOCALES ? c : DEFAULT_CURRENCY
}

/** Set the currency used by `formatCurrency`. Unknown/empty values fall back to INR. */
export function setActiveCurrency(code?: string | null) {
  activeCurrency = normalizeCurrency(code)
}

export function getActiveCurrency(): string {
  return activeCurrency
}

/**
 * Format an amount in a specific currency. With no currency (undefined/null, e.g.
 * settings not loaded yet) it uses the user's active currency; an empty or
 * unknown code falls back to INR.
 */
export function formatMoney(
  amount: number | string,
  currency?: string | null,
  opts?: { asciiSafe?: boolean }
) {
  const code = currency == null ? activeCurrency : normalizeCurrency(currency)
  const value = typeof amount === "string" ? parseFloat(amount) : amount
  const n = Number.isFinite(value) ? (value as number) : 0
  const fmt = (display: "symbol" | "code") =>
    new Intl.NumberFormat(CURRENCY_LOCALES[code], {
      style: "currency",
      currency: code,
      currencyDisplay: display,
    }).format(n)

  const symbolic = fmt("symbol")
  // PDF built-in fonts (Helvetica) can't draw symbols like ₹: print "INR 1,180.00" instead
  if (opts?.asciiSafe && /[^\u0000-ÿ]/.test(symbolic)) return fmt("code")
  return symbolic
}

/** Format an amount in the user's currency. */
export function formatCurrency(amount: number | string) {
  return formatMoney(amount)
}

/** Just the symbol, for labels like "Unit Cost (₹)". */
export function currencySymbol(currency?: string | null): string {
  const code = currency == null ? activeCurrency : normalizeCurrency(currency)
  const parts = new Intl.NumberFormat(CURRENCY_LOCALES[code], {
    style: "currency",
    currency: code,
  }).formatToParts(0)
  return parts.find((p) => p.type === "currency")?.value ?? code
}
