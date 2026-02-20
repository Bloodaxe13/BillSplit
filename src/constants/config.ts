/**
 * App-wide configuration constants.
 */

/** Deep link URL scheme */
export const APP_SCHEME = 'billsplit';

/** Maximum group size */
export const MAX_GROUP_SIZE = 15;

/** Free tier receipt scan limit per month */
export const FREE_SCAN_LIMIT = 20;

/** Pro subscription pricing */
export const PRO_PRICING = {
  monthly: 4.99,
  yearly: 34.99,
  currency: 'USD',
} as const;

/** Receipt processing timeout in milliseconds */
export const RECEIPT_PROCESSING_TIMEOUT_MS = 30_000;

/** Supported currencies for home currency selection */
export const SUPPORTED_HOME_CURRENCIES = [
  'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'NZD', 'SGD',
  'JPY', 'KRW', 'THB', 'IDR', 'MYR', 'PHP', 'VND',
  'INR', 'CHF', 'SEK', 'NOK', 'DKK', 'HKD', 'TWD',
  'BRL', 'MXN', 'ZAR', 'AED',
] as const;

export type SupportedCurrency = typeof SUPPORTED_HOME_CURRENCIES[number];

/** Invite code length */
export const INVITE_CODE_LENGTH = 8;

/** Default pagination page size */
export const PAGE_SIZE = 20;
