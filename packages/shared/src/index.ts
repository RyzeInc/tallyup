export type CurrencyCode = "USD" | (string & {});

export type MoneyAmount = {
  value: number;
  currency: CurrencyCode;
};

export const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const clampNumber = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));
