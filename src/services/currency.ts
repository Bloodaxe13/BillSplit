import { supabase } from "../lib/supabase";
import type { ExchangeRates, CurrencyInfo } from "../types/currency";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Number of decimal places for each currency's smallest unit.
 * Most currencies use 2 (cents), but some use 0 or 3.
 * If a currency is not listed here it defaults to 2.
 */
export const CURRENCY_DECIMALS: Record<string, number> = {
  // 0 decimal places — smallest unit IS the major unit
  BIF: 0,
  CLP: 0,
  DJF: 0,
  GNF: 0,
  IDR: 0,
  ISK: 0,
  JPY: 0,
  KMF: 0,
  KRW: 0,
  PYG: 0,
  RWF: 0,
  UGX: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,

  // 3 decimal places
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
};

/** Common travel currencies for the picker UI. */
export const CURRENCIES: CurrencyInfo[] = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "\u20AC" },
  { code: "GBP", name: "British Pound", symbol: "\u00A3" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$" },
  { code: "JPY", name: "Japanese Yen", symbol: "\u00A5" },
  { code: "CNY", name: "Chinese Yuan", symbol: "\u00A5" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$" },
  { code: "THB", name: "Thai Baht", symbol: "\u0E3F" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM" },
  { code: "PHP", name: "Philippine Peso", symbol: "\u20B1" },
  { code: "VND", name: "Vietnamese Dong", symbol: "\u20AB" },
  { code: "KRW", name: "South Korean Won", symbol: "\u20A9" },
  { code: "INR", name: "Indian Rupee", symbol: "\u20B9" },
  { code: "TWD", name: "New Taiwan Dollar", symbol: "NT$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "AED", name: "UAE Dirham", symbol: "AED" },
  { code: "SAR", name: "Saudi Riyal", symbol: "SAR" },
  { code: "TRY", name: "Turkish Lira", symbol: "\u20BA" },
  { code: "CZK", name: "Czech Koruna", symbol: "K\u010D" },
  { code: "PLN", name: "Polish Zloty", symbol: "z\u0142" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft" },
  { code: "ILS", name: "Israeli Shekel", symbol: "\u20AA" },
  { code: "COP", name: "Colombian Peso", symbol: "COL$" },
  { code: "ARS", name: "Argentine Peso", symbol: "AR$" },
  { code: "PEN", name: "Peruvian Sol", symbol: "S/" },
  { code: "BHD", name: "Bahraini Dinar", symbol: "BD" },
  { code: "KWD", name: "Kuwaiti Dinar", symbol: "KD" },
  { code: "LKR", name: "Sri Lankan Rupee", symbol: "Rs" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E\u00A3" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD" },
];

// ---------------------------------------------------------------------------
// Symbol lookup
// ---------------------------------------------------------------------------

const symbolMap = new Map<string, string>(
  CURRENCIES.map((c) => [c.code, c.symbol])
);

/**
 * Return the display symbol for a currency code.
 * Falls back to the ISO code itself if no symbol is mapped.
 */
export function getCurrencySymbol(currency: string): string {
  return symbolMap.get(currency.toUpperCase()) ?? currency.toUpperCase();
}

// ---------------------------------------------------------------------------
// Decimal helpers
// ---------------------------------------------------------------------------

/** How many minor-unit digits this currency has. Defaults to 2. */
function decimalsFor(currency: string): number {
  return CURRENCY_DECIMALS[currency.toUpperCase()] ?? 2;
}

/**
 * Convert a smallest-unit integer amount to a major-unit float.
 * e.g. 4200 USD cents -> 42.00, 45000 IDR -> 45000.
 */
function toMajor(amount: number, currency: string): number {
  const d = decimalsFor(currency);
  return d === 0 ? amount : amount / 10 ** d;
}

/**
 * Convert a major-unit float back to the smallest-unit integer.
 * Rounds to the nearest integer to avoid floating-point dust.
 */
function toMinor(major: number, currency: string): number {
  const d = decimalsFor(currency);
  return Math.round(d === 0 ? major : major * 10 ** d);
}

// ---------------------------------------------------------------------------
// Exchange-rate fetching (session-cached)
// ---------------------------------------------------------------------------

let cachedRates: ExchangeRates | null = null;

/**
 * Fetch the latest exchange rates from the `exchange_rates` table.
 * Results are cached in-memory for the lifetime of the session so
 * subsequent calls are free.
 */
export async function getExchangeRates(): Promise<ExchangeRates | null> {
  if (cachedRates) {
    return cachedRates;
  }

  const { data, error } = await supabase
    .from("exchange_rates")
    .select("base_currency, rates, fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return null;
  }

  cachedRates = {
    base: data.base_currency as string,
    rates: data.rates as Record<string, number>,
    fetchedAt: new Date(data.fetched_at as string),
  };

  return cachedRates;
}

/**
 * Clear the in-memory cache so the next `getExchangeRates()` call
 * hits the database. Useful after a background refresh.
 */
export function clearRateCache(): void {
  cachedRates = null;
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/**
 * Convert an amount (in smallest currency unit) from one currency to another.
 *
 * All rates are relative to USD (the base), so cross-rate conversion is:
 *   amount_in_base = amount / from_rate
 *   amount_in_target = amount_in_base * to_rate
 *
 * Returns the result in the target currency's smallest unit, rounded to
 * the nearest integer.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: ExchangeRates
): number {
  const from = fromCurrency.toUpperCase();
  const to = toCurrency.toUpperCase();

  // Same currency — no conversion needed
  if (from === to) {
    return amount;
  }

  const fromRate = from === rates.base ? 1 : rates.rates[from];
  const toRate = to === rates.base ? 1 : rates.rates[to];

  if (fromRate === undefined) {
    throw new Error(`Exchange rate not available for currency: ${from}`);
  }
  if (toRate === undefined) {
    throw new Error(`Exchange rate not available for currency: ${to}`);
  }

  // Convert smallest-unit -> major -> USD major -> target major -> smallest-unit
  const majorFrom = toMajor(amount, from);
  const majorInBase = majorFrom / fromRate;
  const majorInTarget = majorInBase * toRate;

  return toMinor(majorInTarget, to);
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format a smallest-unit amount for a single currency.
 * e.g. formatCurrency(450000, "IDR") => "450,000 IDR"
 *      formatCurrency(4200, "USD")   => "$42.00 USD"
 */
export function formatCurrency(amount: number, currency: string): string {
  const code = currency.toUpperCase();
  const d = decimalsFor(code);
  const major = toMajor(amount, code);
  const symbol = getCurrencySymbol(code);

  // Use Intl.NumberFormat for locale-aware grouping & decimals
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  }).format(major);

  // Currencies whose symbol is the same as the code (e.g. CHF, AED)
  // just show "42.00 CHF". Otherwise prefix the symbol: "$42.00 USD".
  if (symbol === code) {
    return `${formatted} ${code}`;
  }

  return `${symbol}${formatted} ${code}`;
}

/**
 * Format an amount showing both the original currency and an approximate
 * conversion to the user's home currency.
 *
 * e.g. formatDualCurrency(450000, "IDR", "AUD", rates)
 *      => "Rp450,000 IDR (\u2248 A$42.00 AUD)"
 *
 * If `originalCurrency` and `homeCurrency` are the same, only one
 * formatted value is returned (no duplicate).
 */
export function formatDualCurrency(
  amount: number,
  originalCurrency: string,
  homeCurrency: string,
  rates: ExchangeRates
): string {
  const original = formatCurrency(amount, originalCurrency);

  if (originalCurrency.toUpperCase() === homeCurrency.toUpperCase()) {
    return original;
  }

  const converted = convertCurrency(
    amount,
    originalCurrency,
    homeCurrency,
    rates
  );
  const convertedFormatted = formatCurrency(converted, homeCurrency);

  return `${original} (\u2248 ${convertedFormatted})`;
}
