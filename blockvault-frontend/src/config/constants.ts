// Application constants

export const APP_NAME = 'BlockVault';
export const APP_VERSION = '2.0.0';

// Route paths
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  FILES: '/files',
  LEGAL: '/legal',
  CASES: '/cases',
  BLOCKCHAIN: '/blockchain',
  SETTINGS: '/settings',
} as const;

// API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    LOGOUT: '/auth/logout',
    PROFILE: '/users/profile',
  },
  FILES: {
    LIST: '/files/',
    UPLOAD: '/files/',
    DOWNLOAD: (id: string) => `/files/${id}`,
    DELETE: (id: string) => `/files/${id}`,
    SHARE: (id: string) => `/files/${id}/share`,
    SHARED: '/files/shared',
    SHARES_OUTGOING: '/files/shares/outgoing',
  },
  CASES: {
    LIST: '/cases',
    CREATE: '/cases',
    UPDATE: (id: string) => `/cases/${id}`,
    DELETE: (id: string) => `/cases/${id}`,
  },
  LEGAL: {
    NOTARIZE: '/legal/notarize',
    SIGN: '/legal/sign',
    ANALYZE: '/legal/analyze',
  },
} as const;

// File upload limits
export const FILE_LIMITS = {
  MAX_SIZE: 100 * 1024 * 1024, // 100MB
  ALLOWED_TYPES: [
    'image/*',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/*',
    'video/*',
    'audio/*',
  ],
};

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'blockvault_auth_token',
  USER_PROFILE: 'blockvault_user_profile',
  RSA_KEYS: 'blockvault_rsa_keys',
  LEGAL_DOCUMENTS: 'legal_documents',
  CASES: 'cases',
} as const;

// Encryption settings
export const CRYPTO_CONFIG = {
  ALGORITHM: 'AES-256-GCM',
  KEY_SIZE: 256,
  IV_LENGTH: 12,
  TAG_LENGTH: 16,
  RSA_KEY_SIZE: 2048,
} as const;

// UI constants
export const UI = {
  TOAST_DURATION: 4000,
  DEBOUNCE_DELAY: 300,
  ANIMATION_DURATION: 200,
} as const;

