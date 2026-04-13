import { EN_MESSAGES } from '@/src/i18n/messages/en';
import { AZ_MESSAGES } from '@/src/i18n/messages/az';

export const MESSAGES = {
  en: EN_MESSAGES,
  az: AZ_MESSAGES,
} as const;

export type Locale = keyof typeof MESSAGES;
export type Messages = (typeof MESSAGES)['en'];

export const DEFAULT_LOCALE: Locale = 'az';
export const SUPPORTED_LOCALES = Object.keys(MESSAGES) as Locale[];

export function isSupportedLocale(value?: string): value is Locale {
  return !!value && Object.prototype.hasOwnProperty.call(MESSAGES, value);
}

type Primitive = string | number | boolean | null | undefined;

type DotPrefix<T extends string> = T extends '' ? '' : `.${T}`;

type DepthLimit = 6;
type PrevDepth = [never, 0, 1, 2, 3, 4, 5, 6];

type DotNestedKeys<T, Depth extends number = DepthLimit> = Depth extends 0
  ? ''
  : T extends Primitive
    ? ''
    : {
        [K in keyof T & string]: T[K] extends Primitive
          ? K
          : `${K}${DotPrefix<DotNestedKeys<T[K], PrevDepth[Depth]>>}`;
      }[keyof T & string];

export type MessageKey = DotNestedKeys<Messages>;

export type TranslateVars = Record<string, string | number>;

export function getMessages(locale: Locale): Messages {
  return (MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE]) as Messages;
}

function resolveKey(source: Messages, key: MessageKey): string | undefined {
  const parts = key.split('.');
  let current: unknown = source;
  for (const part of parts) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => {
    const value = vars[key];
    return value === undefined ? '' : String(value);
  });
}

export function translate(locale: Locale, key: MessageKey, vars?: TranslateVars): string {
  const primary = getMessages(locale);
  const fallback = getMessages(DEFAULT_LOCALE);
  const value = resolveKey(primary, key) ?? resolveKey(fallback, key);
  if (!value) return key;
  return interpolate(value, vars);
}

export function createTranslator(locale: Locale) {
  return (key: MessageKey, vars?: TranslateVars) => translate(locale, key, vars);
}

export function normalizeLocale(value?: string): Locale {
  if (!value) return DEFAULT_LOCALE;
  if (isSupportedLocale(value)) return value;
  const base = value.split('-')[0];
  if (isSupportedLocale(base)) return base;
  return DEFAULT_LOCALE;
}

export function getLocaleCode(locale: Locale): string {
  return locale;
}
