import type { TFunction } from 'i18next';

// The database refuses with this code when someone does something too often.
const RATE_LIMITED = 'MA429';

export function isRateLimited(error: unknown) {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === RATE_LIMITED;
}

// The message to show for a failed action.
export function errorText(t: TFunction, error: unknown) {
  return isRateLimited(error) ? t('common.tooOften') : t('common.error');
}
