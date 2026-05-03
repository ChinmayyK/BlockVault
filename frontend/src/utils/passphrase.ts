const COMMON_WEAK_PASSPHRASES = new Set([
  'password',
  '12345678',
  'qwerty12',
  'abcdefgh',
  'letmein1',
  'password1',
]);

export const validatePassphrase = (passphrase: string): string | null => {
  if (!passphrase || passphrase.trim().length < 8) {
    return 'Passphrase must be at least 8 characters.';
  }
  if (COMMON_WEAK_PASSPHRASES.has(passphrase.toLowerCase())) {
    return 'Passphrase is too common. Please choose a stronger one.';
  }
  return null;
};
