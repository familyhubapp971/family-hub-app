import { useMemo } from 'react';
import { SearchableSelect } from './SearchableSelect';

// FHS-39 — Currency picker. 30 curated currencies (ISO 4217 code +
// symbol + name). Default inferred from navigator.language via the
// Intl.NumberFormat parts API.

export interface CurrencyPickerProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  testId?: string;
  /** `id` for the trigger button — pair with a sibling `<label htmlFor>`. */
  id?: string;
}

interface CurrencyEntry {
  code: string;
  symbol: string;
  name: string;
}

// Curated list — covers the ticket's named examples (GBP, USD, EUR, NGN,
// AED) plus the rest of the top-30 by global GDP. Order keeps frequent
// pickers near the top before alphabetical fall-through.
const CURRENCIES: readonly CurrencyEntry[] = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht' },
];

/**
 * Best-effort currency detection from the browser's locale. Uses
 * `Intl.Locale(locale).maximize().region` to get a 2-letter region
 * code (e.g. `zh` → `zh-Hans-CN` → `CN`) and looks it up in the
 * REGION_TO_CURRENCY map below. Falls back to USD on any failure.
 *
 * Returns one of CURRENCIES[].code so the caller can hand it straight
 * to onChange without an extra lookup.
 */
export function detectBrowserCurrency(): string {
  const knownCodes = new Set(CURRENCIES.map((c) => c.code));
  try {
    const locale = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
    const region = new Intl.Locale(locale).maximize().region ?? '';
    const fromRegion = REGION_TO_CURRENCY[region];
    if (fromRegion && knownCodes.has(fromRegion)) return fromRegion;
  } catch {
    // fall through
  }
  return 'USD';
}

// Region→default-currency map for the curated set. Keep aligned with
// CURRENCIES — anything not here defaults to USD.
const REGION_TO_CURRENCY: Record<string, string> = {
  US: 'USD',
  GB: 'GBP',
  AE: 'AED',
  NG: 'NGN',
  CA: 'CAD',
  AU: 'AUD',
  JP: 'JPY',
  CN: 'CNY',
  IN: 'INR',
  PK: 'PKR',
  SA: 'SAR',
  ZA: 'ZAR',
  EG: 'EGP',
  KE: 'KES',
  GH: 'GHS',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  NZ: 'NZD',
  SG: 'SGD',
  HK: 'HKD',
  KR: 'KRW',
  BR: 'BRL',
  MX: 'MXN',
  TR: 'TRY',
  ID: 'IDR',
  MY: 'MYR',
  TH: 'THB',
  // Eurozone members all map to EUR.
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  IE: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  PT: 'EUR',
  GR: 'EUR',
  FI: 'EUR',
};

export function CurrencyPicker({ value, onChange, className, testId, id }: CurrencyPickerProps) {
  const options = useMemo(
    () =>
      CURRENCIES.map((c) => ({
        value: c.code,
        label: `${c.code} ${c.symbol}`,
        secondary: c.name,
      })),
    [],
  );

  return (
    <SearchableSelect
      options={options}
      value={value}
      onChange={onChange}
      placeholder="Pick a currency"
      searchPlaceholder="Search code, symbol, or name…"
      {...(className ? { className } : {})}
      {...(testId ? { testId } : {})}
      {...(id ? { id } : {})}
      ariaLabel="Currency"
    />
  );
}
