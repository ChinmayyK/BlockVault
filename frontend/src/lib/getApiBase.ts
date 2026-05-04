import { env } from '@/config/env';

const normalizeBaseUrl = (url: string | undefined) => {
  if (!url) {
    return '';
  }
  return url.replace(/\/+$/, '');
};

/**
 * Returns the API base URL depending on environment.
 * In development we rely on the Vite proxy so we use relative paths.
 */
export const getApiBase = (): string => {
  if (env.isDevelopment) {
    return '';
  }

  return normalizeBaseUrl(env.apiUrl) || '';
};





