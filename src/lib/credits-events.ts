/**
 * Credits update events - dispatch when credits change so sidebar updates immediately
 */

export const CREDITS_UPDATED_EVENT = 'credits-updated';

export function dispatchCreditsUpdated(balance: number): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CREDITS_UPDATED_EVENT, { detail: { balance } }));
  }
}
