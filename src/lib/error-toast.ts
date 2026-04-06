export function extractErrorMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const record = payload as Record<string, unknown>;
  if (typeof record.error === 'string' && record.error.trim().length > 0) return record.error;
  if (typeof record.message === 'string' && record.message.trim().length > 0) return record.message;
  return null;
}

export function formatErrorToast(base: string, reason?: string | null): string {
  if (!reason) return base;
  const trimmed = base.trim();
  if (!trimmed) return reason;
  const separator = trimmed.endsWith('.') ? ' ' : ': ';
  return `${trimmed}${separator}${reason}`;
}
