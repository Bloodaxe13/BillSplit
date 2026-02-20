export interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  fetchedAt: Date;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
}
