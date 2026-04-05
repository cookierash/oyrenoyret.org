import type { MessageKey, Messages, TranslateVars } from '@/src/i18n';

type AuthErrorPayload = {
  error?: string;
  errorKey?: string;
  errorVars?: TranslateVars;
};

export function resolveAuthError(
  messages: Messages,
  t: (key: MessageKey, vars?: TranslateVars) => string,
  fallback: string,
  payload?: AuthErrorPayload,
) {
  if (payload?.errorKey) {
    const key = payload.errorKey as keyof typeof messages.auth.errors;
    if (messages.auth.errors && Object.prototype.hasOwnProperty.call(messages.auth.errors, key)) {
      return t(`auth.errors.${payload.errorKey}` as MessageKey, payload.errorVars);
    }
  }
  if (payload?.error) return payload.error;
  return fallback;
}
