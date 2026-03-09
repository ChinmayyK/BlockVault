/**
 * Utility to identify if an error from a wallet provider (Ethers, MetaMask, etc.)
 * is a user-initiated rejection.
 */
export const isUserRejection = (err: any): boolean => {
  if (!err) return false;

  // EIP-1193: User Rejected Request
  if (err.code === 4001) return true;

  // Ethers v6: Action Rejected
  if (err.code === 'ACTION_REJECTED') return true;

  // Generic string checks for various providers
  const message = err.message?.toLowerCase() || '';
  if (message.includes('user rejected')) return true;
  if (message.includes('user denied')) return true;
  if (message.includes('transaction rejected')) return true;

  return false;
};
