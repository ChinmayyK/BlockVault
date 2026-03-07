import axios from 'axios';
import { getApiBase } from '@/lib/getApiBase';
import { env } from '@/config/env';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';

const baseURL = getApiBase() || '/';
const AUTH_STORAGE_KEY = env.authStorageKey;

// Create axios instance with base configuration
export const apiClient = axios.create({
  baseURL,
  timeout: env.apiTimeout,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    try {
      const userStr = localStorage.getItem(AUTH_STORAGE_KEY);
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.jwt) {
          config.headers.Authorization = `Bearer ${user.jwt}`;
        }
        if (user.address) {
          config.headers['X-Wallet-Address'] = user.address;
        }
      }
    } catch (error) {
      logger.error('Failed to parse user from localStorage:', error);
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const AUTH_TOAST_COOLDOWN_MS = 6000;
let lastAuthToastAt = 0;
const NETWORK_TOAST_COOLDOWN_MS = 6000;
let lastNetworkToastAt = 0;

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    if (response.status !== 401) {
      lastAuthToastAt = 0;
    }
    return response;
  },
  (error) => {
    // Handle specific error cases
    if (error.response?.status === 401) {
      const config = error.config || {};
      const skipRedirect = (config as any).skipAuthRedirect;
      const skipToast = (config as any).skipAuthToast;
      const now = Date.now();
      if (!skipToast && now - lastAuthToastAt > AUTH_TOAST_COOLDOWN_MS) {
        toast.error('Authentication required. Please sign in again if needed.');
        lastAuthToastAt = now;
      }
      if (!skipRedirect) {
        try {
          const userStr = localStorage.getItem(AUTH_STORAGE_KEY);
          if (userStr) {
            const user = JSON.parse(userStr);
            if (user?.address) {
              localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({ address: user.address }));
            } else {
              localStorage.removeItem(AUTH_STORAGE_KEY);
            }
          }
        } catch (storageError) {
          logger.error('Failed to reset auth storage after 401:', storageError);
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('blockvault:session-expired'));
          if (window.location.pathname !== '/') {
            window.location.replace('/');
          }
        }
      }
    }
    if (!error.response) {
      const now = Date.now();
      if (!error.config?.skipNetworkToast && now - lastNetworkToastAt > NETWORK_TOAST_COOLDOWN_MS) {
        toast.error('Network error. Please check your connection and try again.');
        lastNetworkToastAt = now;
      }
      logger.error('Network/timeout error', error);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
