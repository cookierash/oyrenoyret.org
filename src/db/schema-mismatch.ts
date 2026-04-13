export function isDbSchemaMismatch(error: unknown): boolean {
  const code =
    error && typeof error === 'object' && 'code' in error && typeof (error as any).code === 'string'
      ? String((error as any).code)
      : '';

  const name =
    error && typeof error === 'object' && 'name' in error && typeof (error as any).name === 'string'
      ? String((error as any).name)
      : '';

  // Prisma codes
  if (code === 'P2021' || code === 'P2022' || code === 'P1012') {
    return true;
  }

  // Postgres codes that commonly indicate "migrations not applied" (driver adapters can surface these)
  // 42P01 undefined_table, 42703 undefined_column, 42704 undefined_object/type
  if (code === '42P01' || code === '42703' || code === '42704') {
    return true;
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : '';

  if (!message) return false;

  // Prisma validation errors often indicate a stale generated client vs. code (e.g. field added in schema but
  // not yet regenerated in the runtime environment). Treat these as schema drift so callers can gracefully
  // fall back to a narrower query shape.
  if (name === 'PrismaClientValidationError') {
    const lowered = message.toLowerCase();
    if (
      lowered.includes('unknown field') ||
      lowered.includes('unknown argument') ||
      lowered.includes('unknown input field')
    ) {
      return true;
    }
  }

  // Common Postgres errors surfaced through Prisma when migrations haven't been applied.
  // Examples include: relation/table does not exist, column does not exist.
  const lowered = message.toLowerCase();
  if (
    lowered.includes('does not exist') &&
    (lowered.includes('relation') ||
      lowered.includes('table') ||
      lowered.includes('column') ||
      lowered.includes('type') ||
      lowered.includes('enum'))
  ) {
    return true;
  }

  // Enum drift (e.g. added enum value/type not yet migrated)
  if (lowered.includes('invalid input value for enum')) {
    return true;
  }

  // Prisma known codes sometimes appear in the message.
  if (message.includes('P2021') || message.includes('P2022') || message.includes('P1012')) {
    return true;
  }

  return false;
}
