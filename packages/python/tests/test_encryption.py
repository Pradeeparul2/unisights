# tests/test_encryption.py
"""Unit tests for encryption/decryption functionality."""

import pytest
import hashlib
import hmac as hmac_lib
import base64
import json
from unisights.encryption import (
    derive_client_key,
    decrypt_ciphertext,
    decrypt_payload,
    verify_encrypted_payload,
    EncryptionError,
    TagMismatchError,
    DecryptionError,
)


class TestKeyDerivation:
    """Test client key derivation."""

    def test_derive_client_key_basic(self):
        """Test basic key derivation."""
        key = derive_client_key(
            site_id="test-site",
            bucket=12345,
            ua_hash="test-ua",
        )
        assert len(key) == 32  # SHA256 produces 32 bytes
        assert isinstance(key, bytes)

    def test_derive_client_key_deterministic(self):
        """Test key derivation is deterministic."""
        key1 = derive_client_key(
            site_id="test-site",
            bucket=12345,
            ua_hash="test-ua",
        )
        key2 = derive_client_key(
            site_id="test-site",
            bucket=12345,
            ua_hash="test-ua",
        )
        assert key1 == key2

    def test_derive_client_key_different_inputs(self):
        """Test different inputs produce different keys."""
        key1 = derive_client_key(
            site_id="site1",
            bucket=12345,
            ua_hash="ua1",
        )
        key2 = derive_client_key(
            site_id="site2",
            bucket=12345,
            ua_hash="ua1",
        )
        assert key1 != key2

    def test_derive_client_key_different_bucket(self):
        """Test different bucket produces different key."""
        key1 = derive_client_key(
            site_id="site",
            bucket=12345,
            ua_hash="ua",
        )
        key2 = derive_client_key(
            site_id="site",
            bucket=12346,
            ua_hash="ua",
        )
        assert key1 != key2


class TestDecryption:
    """Test ciphertext decryption."""

    def test_decrypt_valid_payload(self):
        """Test decrypting valid payload."""
        site_id = "test-site"
        ua_hash = "test-ua-hash"
        bucket = 12345
        
        # Create test plaintext
        plaintext = b"Hello, World!"
        
        # Derive key
        client_key = derive_client_key(site_id, bucket, ua_hash)
        
        # Generate keystream
        keystream = b""
        chunk = 0
        while len(keystream) < len(plaintext):
            keystream += hashlib.sha256(
                client_key + chunk.to_bytes(4, byteorder='big')
            ).digest()
            chunk += 1
        
        # Encrypt (XOR)
        ciphertext = bytes(
            p ^ k for p, k in zip(plaintext, keystream[:len(plaintext)])
        )
        
        # Create tag
        tag = hmac_lib.new(
            client_key,
            ciphertext,
            hashlib.sha256
        ).digest()
        
        # Decrypt
        decrypted = decrypt_ciphertext(
            ciphertext=ciphertext,
            tag=tag,
            bucket=bucket,
            site_id=site_id,
            ua_hash=ua_hash,
        )
        
        assert decrypted == plaintext

    def test_decrypt_invalid_tag(self):
        """Test decryption with invalid tag."""
        site_id = "test-site"
        ua_hash = "test-ua"
        bucket = 12345
        ciphertext = b"encrypted_data"
        invalid_tag = b"invalid_tag_32_bytes____________"
        
        with pytest.raises(TagMismatchError):
            decrypt_ciphertext(
                ciphertext=ciphertext,
                tag=invalid_tag,
                bucket=bucket,
                site_id=site_id,
                ua_hash=ua_hash,
            )

    def test_decrypt_tampered_ciphertext(self):
        """Test decryption with tampered ciphertext."""
        site_id = "test-site"
        ua_hash = "test-ua"
        bucket = 12345
        plaintext = b"Test"
        
        # Create valid encryption
        client_key = derive_client_key(site_id, bucket, ua_hash)
        keystream = hashlib.sha256(client_key).digest()
        ciphertext = bytes(
            p ^ k for p, k in zip(plaintext, keystream[:len(plaintext)])
        )
        tag = hmac_lib.new(client_key, ciphertext, hashlib.sha256).digest()
        
        # Tamper with ciphertext
        tampered = bytes([(ciphertext[0] + 1) & 0xFF]) + ciphertext[1:]
        
        with pytest.raises(TagMismatchError):
            decrypt_ciphertext(
                ciphertext=tampered,
                tag=tag,
                bucket=bucket,
                site_id=site_id,
                ua_hash=ua_hash,
            )


class TestPayloadDecryption:
    """Test full payload decryption."""

    def test_decrypt_unencrypted_payload(self):
        """Test that unencrypted payloads are returned as-is."""
        payload = {
            "encrypted": False,
            "data": {
                "asset_id": "test",
                "session_id": "session",
            }
        }
        result = decrypt_payload(payload)
        assert result == payload

    def test_decrypt_missing_envelope(self):
        """Test decryption fails with missing envelope."""
        payload = {
            "encrypted": True,
        }
        with pytest.raises(DecryptionError):
            decrypt_payload(payload)

    def test_decrypt_missing_fields(self):
        """Test decryption fails with missing fields."""
        payload = {
            "encrypted": True,
            "envelope": {
                "site_id": "test",
                # Missing other fields
            }
        }
        with pytest.raises(DecryptionError):
            decrypt_payload(payload)


class TestVerifyEncryption:
    """Test encryption verification."""

    def test_verify_encrypted_payload(self):
        """Test verifying encrypted payload."""
        payload = {
            "encrypted": True,
            "envelope": {"site_id": "test"},
        }
        assert verify_encrypted_payload(payload) is True

    def test_verify_unencrypted_payload(self):
        """Test verifying unencrypted payload."""
        payload = {
            "encrypted": False,
            "data": {},
        }
        assert verify_encrypted_payload(payload) is False

    def test_verify_missing_encrypted_field(self):
        """Test verifying payload without encrypted field."""
        payload = {
            "data": {},
        }
        assert verify_encrypted_payload(payload) is False


class TestEncryptionRoundtrip:
    """Test encryption/decryption roundtrip."""

    def test_roundtrip_json_data(self):
        """Test roundtrip with JSON data."""
        site_id = "test-site"
        ua_hash = "test-ua"
        bucket = 59118640
        
        # Original data
        original_data = {
            "asset_id": "test",
            "session_id": "session-123",
            "events": ["click", "scroll"],
        }
        plaintext = json.dumps(original_data).encode('utf-8')
        
        # Create encryption
        client_key = derive_client_key(site_id, bucket, ua_hash)
        
        # Generate keystream
        keystream = b""
        chunk = 0
        while len(keystream) < len(plaintext):
            keystream += hashlib.sha256(
                client_key + chunk.to_bytes(4, byteorder='big')
            ).digest()
            chunk += 1
        
        # Encrypt
        ciphertext = bytes(
            p ^ k for p, k in zip(plaintext, keystream[:len(plaintext)])
        )
        
        # Create tag
        tag = hmac_lib.new(
            client_key,
            ciphertext,
            hashlib.sha256
        ).digest()
        
        # Decrypt
        decrypted = decrypt_ciphertext(
            ciphertext=ciphertext,
            tag=tag,
            bucket=bucket,
            site_id=site_id,
            ua_hash=ua_hash,
        )
        
        # Verify
        decrypted_data = json.loads(decrypted.decode('utf-8'))
        assert decrypted_data == original_data
        assert decrypted_data["asset_id"] == "test"
        assert len(decrypted_data["events"]) == 2