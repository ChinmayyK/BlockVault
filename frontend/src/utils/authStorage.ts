import { env } from '@/config/env';

export const AUTH_STORAGE_KEY = env.authStorageKey;

const emitAuthChange = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('blockvault:auth-changed'));
  }
};

export const readStoredUser = <T = any>(): (T & { jwt?: string; address?: string }) | null => {
  if (typeof window === 'undefined') {
    return null;
  }
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    emitAuthChange();
    return null;
  }
};

export const writeStoredUser = (value: any) => {
  if (typeof window === 'undefined') {
    return;
  }
  if (!value) {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    emitAuthChange();
    return;
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(value));
  emitAuthChange();
};

export const clearStoredUser = () => {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  emitAuthChange();
};

