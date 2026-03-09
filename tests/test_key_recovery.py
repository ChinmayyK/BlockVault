"""
Unit tests for the new Key Recovery and File Key wrapping architecture.
"""
import base64
import os
import pytest

from blockvault.core.key_recovery import (
    generate_file_key,
    generate_recovery_key,
    encrypt_with_aes_gcm,
    decrypt_with_aes_gcm,
    wrap_file_key_with_passphrase,
    unwrap_file_key_with_passphrase,
    wrap_file_key_with_recovery_key,
    unwrap_file_key_with_recovery_key,
    wrap_file_key_with_wallet,
    unwrap_file_key_with_wallet,
)


def test_generate_keys():
    # Test file key generation
    file_key = generate_file_key()
    assert isinstance(file_key, bytes)
    assert len(file_key) == 32  # 256 bits

    # Test recovery key generation format
    recovery_key = generate_recovery_key()
    assert isinstance(recovery_key, str)
    assert len(recovery_key) == 19  # 4 blocks of 4 chars + 3 dashes
    assert recovery_key.count('-') == 3


def test_aes_gcm_encryption():
    file_key = generate_file_key()
    plaintext = b"Highly sensitive legal document"
    aad = b"user_id:123"

    # Encrypt
    ciphertext_nonce = encrypt_with_aes_gcm(file_key, plaintext, aad)
    assert len(ciphertext_nonce) > len(plaintext) + 12
    
    # Decrypt
    decrypted = decrypt_with_aes_gcm(file_key, ciphertext_nonce, aad)
    assert decrypted == plaintext
    
    # Decrypt with wrong AAD should fail
    with pytest.raises(Exception):
        decrypt_with_aes_gcm(file_key, ciphertext_nonce, b"user_id:456")
        
    # Decrypt with wrong key should fail
    wrong_key = generate_file_key()
    with pytest.raises(Exception):
        decrypt_with_aes_gcm(wrong_key, ciphertext_nonce, aad)


def test_passphrase_wrapping():
    file_key = generate_file_key()
    passphrase = "my_secure_password123"
    
    # Wrap
    salt_b64, wrapped_b64 = wrap_file_key_with_passphrase(file_key, passphrase)
    assert isinstance(salt_b64, str)
    assert isinstance(wrapped_b64, str)
    
    # Unwrap
    unwrapped_key = unwrap_file_key_with_passphrase(wrapped_b64, passphrase, salt_b64)
    assert unwrapped_key == file_key
    
    # Unwrap with wrong passphrase
    with pytest.raises(ValueError, match="Decryption failed"):
        unwrap_file_key_with_passphrase(wrapped_b64, "wrong_password", salt_b64)


def test_recovery_key_wrapping():
    file_key = generate_file_key()
    recovery_key = generate_recovery_key()
    
    # Wrap
    salt_b64, wrapped_b64 = wrap_file_key_with_recovery_key(file_key, recovery_key)
    
    # Unwrap
    unwrapped_key = unwrap_file_key_with_recovery_key(wrapped_b64, recovery_key, salt_b64)
    assert unwrapped_key == file_key
    
    # Unwrap with wrong recovery key
    with pytest.raises(ValueError, match="Decryption failed"):
        unwrap_file_key_with_recovery_key(wrapped_b64, "ZXA9-wrong-key-AF92", salt_b64)


def test_wallet_wrapping():
    # ECIES requires Ethereum compatible secp256k1 keys
    # Dummy key generation for test purposes using coincurve (underlying eciespy)
    try:
        from coincurve.keys import PrivateKey
    except ImportError:
        pytest.skip("coincurve not available for test")
        
    priv_key = PrivateKey()
    priv_hex = priv_key.to_hex()
    pub_hex = priv_key.public_key.format(compressed=False).hex()
    
    file_key = generate_file_key()
    
    # Wrap using public key
    wrapped_b64 = wrap_file_key_with_wallet(file_key, pub_hex)
    
    # Unwrap using private key
    unwrapped_key = unwrap_file_key_with_wallet(wrapped_b64, priv_hex)
    assert unwrapped_key == file_key
    
    # Unwrap with wrong private key
    wrong_priv = PrivateKey().to_hex()
    with pytest.raises(ValueError, match="ECIES decryption failed"):
        unwrap_file_key_with_wallet(wrapped_b64, wrong_priv)
