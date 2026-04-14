// Environment configuration with fallbacks
export const env = {
  // API Configuration
  apiUrl:
    import.meta.env.VITE_API_URL !== undefined
      ? import.meta.env.VITE_API_URL
      : typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost:5000',
  apiTimeout: Number(import.meta.env.VITE_API_TIMEOUT) || 30000,

  // IPFS Configuration
  ipfsGateway: import.meta.env.VITE_IPFS_GATEWAY || 'https://ipfs.io/ipfs/',
  ipfsApiUrl: import.meta.env.VITE_IPFS_API_URL || 'http://localhost:5001',

  // Blockchain Configuration
  blockchainNetwork: import.meta.env.VITE_BLOCKCHAIN_NETWORK || 'localhost',
  chainId: Number(import.meta.env.VITE_CHAIN_ID) || 31337,
  contractAddress: import.meta.env.VITE_CONTRACT_ADDRESS || '',
  fileRegistryAddress: import.meta.env.VITE_FILE_REGISTRY_ADDRESS || '',
  fileVersionRegistryAddress: import.meta.env.VITE_FILE_VERSION_REGISTRY_ADDRESS || '',

  // WalletConnect
  walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '',

  // Feature Flags
  enableZKML: import.meta.env.VITE_ENABLE_ZKML !== 'false',
  enableRedaction: import.meta.env.VITE_ENABLE_REDACTION !== 'false',
  enableSignatures: import.meta.env.VITE_ENABLE_SIGNATURES !== 'false',

  // App Info
  appName: import.meta.env.VITE_APP_NAME || 'BlockVault',
  appVersion: import.meta.env.VITE_APP_VERSION || '2.0.0',
  isDevelopment: import.meta.env.DEV,
  isProduction: import.meta.env.PROD,
  authStorageKey: import.meta.env.VITE_AUTH_STORAGE_KEY || 'blockvault_user',
};







