export type WriteRestriction =
  | null
  | 'emailNotVerified'
  | 'accountSuspended'
  | 'accountBanned';

export function getWriteRestrictionMessage(
  restriction: WriteRestriction,
  fallbackEmailNotVerified: string,
): string {
  switch (restriction) {
    case 'accountSuspended':
      return 'Your account is suspended and cannot perform this action.';
    case 'accountBanned':
      return 'Your account is banned and cannot perform this action.';
    case 'emailNotVerified':
      return fallbackEmailNotVerified;
    default:
      return 'You cannot perform this action right now.';
  }
}

