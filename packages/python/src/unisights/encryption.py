# src/unisights/encryption.py
"""
Payload encryption/decryption module.

Implements the Unisights encryption scheme:
- Key derived from site_id, bucket, and ua_hash
- XOR-based encryption with keystream
- HMAC-SHA256 authentication
"""

import hashlib
import hmac as hmac_lib
import json
import logging
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class EncryptionError(Exception):
    """Base encryption error."""
    pass


class TagMismatchError(EncryptionError):
    """HMAC tag verification failed - payload may be tampered."""
    pass


class DecryptionError(EncryptionError):
    """Decryption operation failed."""
    pass


def derive_client_key(site_id: str, bucket: int, ua_hash: str) -> bytes:
    """Derive client key from public inputs.
    
    Args:
        site_id: Website/asset ID
        bucket: Time bucket (timestamp_ms // 30_000)
        ua_hash: User agent hash
    
    Returns:
        32-byte client key (SHA256 hash)
    """
    h = hashlib.sha256()
    h.update(site_id.encode('utf-8'))
    h.update(b":")
    h.update(bucket.to_bytes(8, byteorder='big'))
    h.update(b":")
    h.update((ua_hash or "").encode('utf-8'))
    
    return h.digest()


def decrypt_ciphertext(
    ciphertext: bytes,
    tag: bytes,
    bucket: int,
    site_id: str,
    ua_hash: str,
) -> bytes:
    """Decrypt ciphertext using XOR keystream.
    
    Args:
        ciphertext: Encrypted payload bytes
        tag: HMAC-SHA256 authentication tag
        bucket: Time bucket (from payload envelope)
        site_id: Website/asset ID (from payload envelope)
        ua_hash: User agent hash (from payload envelope)
    
    Returns:
        Decrypted plaintext bytes
    
    Raises:
        TagMismatchError: If HMAC verification fails (tampered or wrong inputs)
        DecryptionError: If decryption fails
    """
    try:
        # Step 1: Derive client key
        client_key = derive_client_key(site_id, bucket, ua_hash)
        
        # Step 2: Verify HMAC-SHA256 tag before decrypting
        expected_tag = hmac_lib.new(
            client_key,
            ciphertext,
            hashlib.sha256
        ).digest()
        
        if not hmac_lib.compare_digest(expected_tag, tag):
            logger.warning(
                "Payload tag mismatch - rejected. "
                f"site_id={site_id}, bucket={bucket}"
            )
            raise TagMismatchError("HMAC tag verification failed - payload rejected")
        
        # Step 3: Generate keystream via SHA256 chunks
        keystream = b""
        chunk = 0
        while len(keystream) < len(ciphertext):
            chunk_hash = hashlib.sha256(
                client_key + chunk.to_bytes(4, byteorder='big')
            ).digest()
            keystream += chunk_hash
            chunk += 1
        
        # Step 4: XOR ciphertext with keystream to get plaintext
        plaintext = bytes(
            c ^ k for c, k in zip(ciphertext, keystream[:len(ciphertext)])
        )
        
        logger.debug(f"Payload decrypted successfully: {len(plaintext)} bytes")
        return plaintext
        
    except TagMismatchError:
        raise
    except Exception as e:
        logger.error(f"Decryption failed: {type(e).__name__}: {e}")
        raise DecryptionError(f"Decryption operation failed: {e}") from e


def decrypt_payload(
    encrypted_payload: Dict[str, Any],
) -> Dict[str, Any]:
    """Decrypt complete payload envelope.
    
    Expects payload structure:
    {
        "encrypted": true,
        "envelope": {
            "site_id": "...",
            "ua_hash": "...",
            "bucket": 12345,
            "tag": "...",  # base64 encoded
            "ciphertext": "..."  # base64 encoded
        },
        "data": {...}  # only if encrypted=false
    }
    
    Args:
        encrypted_payload: Full payload dict with encryption metadata
    
    Returns:
        Decrypted payload with "data" field populated
    
    Raises:
        DecryptionError: If decryption fails
        TagMismatchError: If authentication fails
    """
    try:
        # Check if payload is actually encrypted
        encrypted_flag = encrypted_payload.get("encrypted", False)
        
        if not encrypted_flag:
            # Not encrypted, return as-is
            return encrypted_payload
        
        # Look for encryption metadata in two places:
        # 1. Inside "envelope" field (standard format)
        # 2. At root level (browser SDK format)
        envelope = encrypted_payload.get("envelope", {})
        
        # Extract from envelope or root level
        site_id = envelope.get("site_id") or encrypted_payload.get("site_id")
        ua_hash = envelope.get("ua_hash") or encrypted_payload.get("ua_hash", "")
        bucket = envelope.get("bucket") or encrypted_payload.get("bucket")
        tag_b64 = envelope.get("tag") or encrypted_payload.get("tag")
        ciphertext_b64 = envelope.get("ciphertext") or encrypted_payload.get("data")
        
        # Validate required fields
        if not all([site_id, bucket is not None, tag_b64, ciphertext_b64]):
            raise DecryptionError("Missing required encryption fields (need: site_id, bucket, tag, data/ciphertext)")
        
        # Decode from base64
        import base64
        try:
            tag = base64.b64decode(tag_b64)
            ciphertext = base64.b64decode(ciphertext_b64)
        except Exception as e:
            raise DecryptionError(f"Failed to decode base64: {e}")
        
        # Decrypt
        plaintext = decrypt_ciphertext(
            ciphertext=ciphertext,
            tag=tag,
            bucket=bucket,
            site_id=site_id,
            ua_hash=ua_hash,
        )
        
        # Parse decrypted JSON
        try:
            decrypted_data = json.loads(plaintext.decode('utf-8'))
        except Exception as e:
            raise DecryptionError(f"Failed to parse decrypted JSON: {e}")
        
        # Return payload with decrypted data
        return {
            **encrypted_payload,
            "data": decrypted_data,
            "encrypted": False,  # Mark as decrypted
        }
        
    except (DecryptionError, TagMismatchError):
        raise
    except Exception as e:
        logger.error(f"Payload decryption failed: {type(e).__name__}: {e}")
        raise DecryptionError(f"Payload decryption failed: {e}") from e


def verify_encrypted_payload(payload: Dict[str, Any]) -> bool:
    """Check if payload is encrypted.
    
    Args:
        payload: Payload dict
    
    Returns:
        True if payload.encrypted is True and has envelope
    """
    return (
        payload.get("encrypted") is True and
        "envelope" in payload
    )