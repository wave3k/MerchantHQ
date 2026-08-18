export type CurrencyCode = "CDF" | "USD" | "EUR";
export type AppLanguage = "fr" | "en" | "ln" | "sw";

let primaryCurrency: CurrencyCode = "CDF";
let secondaryCurrency: CurrencyCode | null = "USD";
let secondaryRate = 2800;
let appLanguage: AppLanguage = "fr";

const currencySymbols: Record<CurrencyCode, string> = {
  CDF: "FC",
  USD: "$",
  EUR: "€",
};

export function configureFormatting(preferences: {
  primary?: CurrencyCode;
  secondary?: CurrencyCode | null;
  rate?: number;
  language?: AppLanguage;
}): void {
  if (preferences.primary) primaryCurrency = preferences.primary;
  if (preferences.secondary !== undefined) {
    secondaryCurrency =
      preferences.secondary === primaryCurrency ? null : preferences.secondary;
  }
  if (preferences.rate && Number.isFinite(preferences.rate) && preferences.rate > 0) {
    secondaryRate = preferences.rate;
  }
  if (preferences.language) appLanguage = preferences.language;
}

export function locale(): string {
  return appLanguage === "en" ? "en-US" : "fr-FR";
}

function formatCurrency(value: number, currency: CurrencyCode): string {
  const decimals = currency === "CDF" ? 0 : 2;
  const amount = new Intl.NumberFormat(locale(), {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
  return currency === "CDF"
    ? `${amount} ${currencySymbols[currency]}`
    : `${currencySymbols[currency]}${amount}`;
}

export function formatMoney(value: number): string {
  const main = formatCurrency(value, primaryCurrency);
  if (!secondaryCurrency || secondaryRate <= 0) return main;
  return `${main} · ${formatCurrency(value / secondaryRate, secondaryCurrency)}`;
}

export function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(locale(), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat(locale(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "");
}
