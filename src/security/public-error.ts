export function getPublicErrorMessage(
  error: unknown,
  fallbackMessage: string = 'Internal server error',
): string {
  const isDev = process.env.NODE_ENV === 'development';
  if (!isDev) return fallbackMessage;

  if (error instanceof Error && error.message) return error.message;
  return fallbackMessage;
}

