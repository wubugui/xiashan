import { safeStorage } from '@/lib/safeStorage';

const SAVE_KEYS = [
  'xiashan-player-store',
  'xiashan-shop-store',
  'xiashan_daily_claim',
];

export function clearLocalSave() {
  SAVE_KEYS.forEach((key) => safeStorage.removeItem(key));
}

export function clearLocalSaveAndReload() {
  clearLocalSave();
  window.location.hash = '#/';
  window.location.reload();
}
