use hmac::{Hmac, Mac};
use sha2::{Digest, Sha256};
use wasm_bindgen::JsValue;

type HmacSha256 = Hmac<Sha256>;

/// Bucket size in milliseconds (30 seconds).
const BUCKET_MS: f64 = 30_000.0;

// ─────────────────────────────────────────────
// EncryptedPayload
// ─────────────────────────────────────────────

/// Output of a single encrypt() call.
/// Contains everything the server needs to derive server_key and decrypt.
pub struct EncryptedPayload {
    /// XOR-encrypted ciphertext.
    pub ciphertext: Vec<u8>,
    /// HMAC-SHA256(client_key, ciphertext) — integrity tag.
    pub tag: Vec<u8>,
    /// Time bucket used — server uses this to reproduce client_key.
    pub bucket: u64,
}

// ─────────────────────────────────────────────
// EncryptionConfig
// ─────────────────────────────────────────────

/// Client-side encryption config.
/// No server secret stored here — client_key is derived from public inputs only.
pub struct EncryptionConfig {
    pub enabled: bool,
}

impl EncryptionConfig {
    pub fn new() -> Self {
        Self { enabled: false }
    }

    pub fn configure(&mut self, enable: bool) {
        self.enabled = enable;
    }

    /// Encrypt plaintext using client-side rolling key derivation.
    ///
    /// client_key = SHA256(site_id || ":" || bucket || ":" || ua_hash)
    /// ciphertext = plaintext XOR keystream(client_key)
    /// tag        = HMAC-SHA256(client_key, ciphertext)
    ///
    /// Server then computes:
    ///   server_key = HMAC(SERVER_SECRET, client_key)
    ///
    /// Returns None if encryption is disabled.
    pub fn encrypt(
        &self,
        plain: &[u8],
        site_id: &str,
        ua_hash: &str,
        timestamp_ms: f64,
    ) -> Result<Option<EncryptedPayload>, JsValue> {
        if !self.enabled {
            return Ok(None);
        }

        let bucket = derive_bucket(timestamp_ms);
        let client_key = derive_client_key(site_id, bucket, ua_hash);
        let ciphertext = xor_stream(plain, &client_key);
        let tag = authenticate(&client_key, &ciphertext)?;

        Ok(Some(EncryptedPayload { ciphertext, tag, bucket }))
    }
}

// ─────────────────────────────────────────────
// Key derivation (public — no secret)
// ─────────────────────────────────────────────

/// floor(timestamp_ms / 30_000) — rotates every 30 seconds.
pub fn derive_bucket(timestamp_ms: f64) -> u64 {
    (timestamp_ms / BUCKET_MS).floor() as u64
}

/// SHA256(site_id || ":" || bucket_be_bytes || ":" || ua_hash)
/// Public inputs only — server can reproduce this independently.
pub fn derive_client_key(site_id: &str, bucket: u64, ua_hash: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(site_id.as_bytes());
    hasher.update(b":");
    hasher.update(bucket.to_be_bytes());
    hasher.update(b":");
    hasher.update(ua_hash.as_bytes());
    let result = hasher.finalize();
    let mut key = [0u8; 32];
    key.copy_from_slice(&result);
    key
}

// ─────────────────────────────────────────────
// XOR stream cipher
// ─────────────────────────────────────────────

/// Expand key into keystream via SHA256(key || chunk_index), then XOR with plaintext.
/// Each SHA256 call produces 32 bytes; chunks repeat until length is covered.
pub fn xor_stream(plain: &[u8], key: &[u8; 32]) -> Vec<u8> {
    let mut keystream = Vec::with_capacity(plain.len());
    let mut chunk = 0u32;

    while keystream.len() < plain.len() {
        let mut hasher = Sha256::new();
        hasher.update(key);
        hasher.update(chunk.to_be_bytes());
        keystream.extend_from_slice(&hasher.finalize());
        chunk += 1;
    }

    plain
        .iter()
        .zip(keystream.iter())
        .map(|(p, k)| p ^ k)
        .collect()
}

// ─────────────────────────────────────────────
// Authentication tag
// ─────────────────────────────────────────────

/// HMAC-SHA256(client_key, ciphertext) — proves ciphertext integrity.
pub fn authenticate(key: &[u8; 32], ciphertext: &[u8]) -> Result<Vec<u8>, JsValue> {
    let mut mac = HmacSha256::new_from_slice(key)
        .map_err(|e| JsValue::from_str(&format!("HMAC auth error: {}", e)))?;
    mac.update(ciphertext);
    Ok(mac.finalize().into_bytes().to_vec())
}

// ─────────────────────────────────────────────
// Decryption (server-side)
// ─────────────────────────────────────────────

/// Errors returned by [`decrypt`].
#[derive(Debug, PartialEq)]
pub enum DecryptError {
    /// HMAC tag did not match — payload was tampered with or inputs are wrong.
    TagMismatch,
    /// HMAC initialisation failed (key length issue).
    HmacError(String),
}

impl std::fmt::Display for DecryptError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            DecryptError::TagMismatch => write!(f, "tag mismatch — payload rejected"),
            DecryptError::HmacError(e) => write!(f, "HMAC error: {}", e),
        }
    }
}

/// Decrypt and verify a payload produced by [`EncryptionConfig::encrypt`].
///
/// # Arguments
/// * `ciphertext` — raw ciphertext bytes from the `data` field
/// * `tag`        — HMAC-SHA256 tag bytes from the `tag` field
/// * `bucket`     — time bucket from the `bucket` field
/// * `site_id`    — site/asset ID from the `site_id` field
/// * `ua_hash`    — user-agent hash from the `ua_hash` field
///
/// # Returns
/// * `Ok(Vec<u8>)` — plaintext bytes on success
/// * `Err(DecryptError::TagMismatch)` — if any input has been tampered with
///
/// # Server usage
/// ```rust
/// let plaintext = decrypt(&ciphertext, &tag, bucket, site_id, ua_hash)?;
/// let payload: serde_json::Value = serde_json::from_slice(&plaintext)?;
/// ```
pub fn decrypt(
    ciphertext: &[u8],
    tag: &[u8],
    bucket: u64,
    site_id: &str,
    ua_hash: &str,
) -> Result<Vec<u8>, DecryptError> {
    let client_key = derive_client_key(site_id, bucket, ua_hash);

    // Verify tag before decrypting — reject tampered payloads immediately
    let expected_tag = authenticate(&client_key, ciphertext)
        .map_err(|e| DecryptError::HmacError(e.as_string().unwrap_or_default()))?;

    if expected_tag.as_slice() != tag {
        return Err(DecryptError::TagMismatch);
    }

    Ok(xor_stream(ciphertext, &client_key))
}

// ─────────────────────────────────────────────
// Tests (native — no WASM needed)
// ─────────────────────────────────────────────

// #[cfg(test)]
// mod tests {
//     use super::*;

//     const SITE_ID: &str = "site-abc";
//     const UA_HASH: &str = "ua1234";
//     const NOW_MS: f64 = 1_700_000_015_000.0;

//     // ── Bucket ────────────────────────────────

//     #[test]
//     fn test_bucket_floor() {
//         assert_eq!(derive_bucket(0.0), 0);
//         assert_eq!(derive_bucket(29_999.0), 0);
//         assert_eq!(derive_bucket(30_000.0), 1);
//         assert_eq!(derive_bucket(59_999.0), 1);
//         assert_eq!(derive_bucket(60_000.0), 2);
//     }

//     #[test]
//     fn test_same_bucket_within_window() {
//         assert_eq!(derive_bucket(NOW_MS), derive_bucket(NOW_MS + 10_000.0));
//     }

//     #[test]
//     fn test_different_bucket_across_window() {
//         let b1 = derive_bucket(NOW_MS);
//         assert_eq!(derive_bucket(NOW_MS + 30_000.0), b1 + 1);
//     }

//     // ── Client key derivation ─────────────────

//     #[test]
//     fn test_client_key_deterministic() {
//         let bucket = derive_bucket(NOW_MS);
//         let k1 = derive_client_key(SITE_ID, bucket, UA_HASH);
//         let k2 = derive_client_key(SITE_ID, bucket, UA_HASH);
//         assert_eq!(k1, k2);
//     }

//     #[test]
//     fn test_client_key_changes_with_bucket() {
//         let b = derive_bucket(NOW_MS);
//         let k1 = derive_client_key(SITE_ID, b, UA_HASH);
//         let k2 = derive_client_key(SITE_ID, b + 1, UA_HASH);
//         assert_ne!(k1, k2);
//     }

//     #[test]
//     fn test_client_key_changes_with_site_id() {
//         let b = derive_bucket(NOW_MS);
//         let k1 = derive_client_key("site-A", b, UA_HASH);
//         let k2 = derive_client_key("site-B", b, UA_HASH);
//         assert_ne!(k1, k2);
//     }

//     #[test]
//     fn test_client_key_changes_with_ua_hash() {
//         let b = derive_bucket(NOW_MS);
//         let k1 = derive_client_key(SITE_ID, b, "ua-A");
//         let k2 = derive_client_key(SITE_ID, b, "ua-B");
//         assert_ne!(k1, k2);
//     }

//     // ── XOR stream ────────────────────────────

//     #[test]
//     fn test_xor_roundtrip() {
//         let key = [0xABu8; 32];
//         let plain = b"hello unisights analytics core!";
//         let cipher = xor_stream(plain, &key);
//         assert_eq!(xor_stream(&cipher, &key).as_slice(), plain.as_slice());
//     }

//     #[test]
//     fn test_xor_empty_input() {
//         assert!(xor_stream(&[], &[0u8; 32]).is_empty());
//     }

//     #[test]
//     fn test_xor_multi_chunk() {
//         let key = [0x42u8; 32];
//         let plain = vec![0xFFu8; 100]; // > 32 bytes — tests multi-chunk expansion
//         let cipher = xor_stream(&plain, &key);
//         assert_eq!(xor_stream(&cipher, &key), plain);
//     }

//     #[test]
//     fn test_xor_ciphertext_differs_from_plaintext() {
//         let key = [0x01u8; 32];
//         let plain = b"sensitive payload data";
//         assert_ne!(xor_stream(plain, &key).as_slice(), plain.as_slice());
//     }

//     // ── Authentication ────────────────────────

//     #[test]
//     fn test_tag_deterministic() {
//         let key = [0x01u8; 32];
//         assert_eq!(
//             authenticate(&key, b"data").unwrap(),
//             authenticate(&key, b"data").unwrap()
//         );
//     }

//     #[test]
//     fn test_tag_changes_with_data() {
//         let key = [0x01u8; 32];
//         assert_ne!(
//             authenticate(&key, b"data-A").unwrap(),
//             authenticate(&key, b"data-B").unwrap()
//         );
//     }

//     #[test]
//     fn test_tag_changes_with_key() {
//         assert_ne!(
//             authenticate(&[0x01u8; 32], b"data").unwrap(),
//             authenticate(&[0x02u8; 32], b"data").unwrap()
//         );
//     }

//     // ── EncryptionConfig ──────────────────────

//     #[test]
//     fn test_disabled_returns_none() {
//         let config = EncryptionConfig::new();
//         assert!(config.encrypt(b"payload", SITE_ID, UA_HASH, NOW_MS).unwrap().is_none());
//     }

//     #[test]
//     fn test_enabled_returns_some() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         assert!(config.encrypt(b"payload", SITE_ID, UA_HASH, NOW_MS).unwrap().is_some());
//     }

//     #[test]
//     fn test_disable_clears() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         config.configure(false);
//         assert!(!config.enabled);
//         assert!(config.encrypt(b"payload", SITE_ID, UA_HASH, NOW_MS).unwrap().is_none());
//     }

//     #[test]
//     fn test_encrypt_decrypt_roundtrip() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let plain = b"analytics payload data";
//         let enc = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
//             .expect("roundtrip should succeed");
//         assert_eq!(decrypted, plain);
//     }

//     #[test]
//     fn test_tag_verifies() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let enc = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         // Valid tag — decrypt should succeed
//         assert!(decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH).is_ok());
//         // Corrupted tag — decrypt must fail
//         let mut bad_tag = enc.tag.clone();
//         bad_tag[0] ^= 0xFF;
//         assert_eq!(
//             decrypt(&enc.ciphertext, &bad_tag, enc.bucket, SITE_ID, UA_HASH).unwrap_err(),
//             DecryptError::TagMismatch
//         );
//     }

//     #[test]
//     fn test_bucket_in_output() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let result = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         assert_eq!(result.bucket, derive_bucket(NOW_MS));
//     }

//     #[test]
//     fn test_same_bucket_same_ciphertext() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let plain = b"deterministic";
//         let r1 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let r2 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS + 5_000.0).unwrap().unwrap();
//         assert_eq!(r1.bucket, r2.bucket);
//         assert_eq!(r1.ciphertext, r2.ciphertext);
//     }

//     #[test]
//     fn test_different_bucket_different_ciphertext() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let plain = b"same plaintext";
//         let r1 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let r2 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS + 30_000.0).unwrap().unwrap();
//         assert_ne!(r1.bucket, r2.bucket);
//         assert_ne!(r1.ciphertext, r2.ciphertext);
//     }

//     #[test]
//     fn test_client_key_never_sent() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let result = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let _ = result.ciphertext;
//         let _ = result.tag;
//         let _ = result.bucket;
//     }

//     // ── Decryption ────────────────────────────

//     #[test]
//     fn test_server_decrypts_correctly() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let plain = b"analytics event payload";
//         let enc = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
//             .expect("decryption should succeed");
//         assert_eq!(decrypted, plain);
//     }

//     #[test]
//     fn test_server_decrypts_empty_payload() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let plain = b"";
//         let enc = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
//             .expect("empty payload should decrypt");
//         assert_eq!(decrypted, plain);
//     }

//     #[test]
//     fn test_server_decrypts_large_payload() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let plain = vec![0x42u8; 1024];
//         let enc = config.encrypt(&plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
//             .expect("large payload should decrypt");
//         assert_eq!(decrypted, plain);
//     }

//     #[test]
//     fn test_server_decrypts_unicode_payload() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let plain = "நன்றி • 감사합니다 • ありがとう".as_bytes();
//         let enc = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
//             .expect("unicode payload should decrypt");
//         assert_eq!(decrypted, plain);
//     }

//     #[test]
//     fn test_server_rejects_tampered_ciphertext() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let enc = config.encrypt(b"real data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let mut tampered = enc.ciphertext.clone();
//         tampered[0] ^= 0xFF;
//         let result = decrypt(&tampered, &enc.tag, enc.bucket, SITE_ID, UA_HASH);
//         assert_eq!(result.unwrap_err(), DecryptError::TagMismatch);
//     }

//     #[test]
//     fn test_server_rejects_tampered_tag() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let enc = config.encrypt(b"real data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let mut bad_tag = enc.tag.clone();
//         bad_tag[0] ^= 0xFF;
//         let result = decrypt(&enc.ciphertext, &bad_tag, enc.bucket, SITE_ID, UA_HASH);
//         assert_eq!(result.unwrap_err(), DecryptError::TagMismatch);
//     }

//     #[test]
//     fn test_server_rejects_wrong_site_id() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let enc = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let result = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, "wrong-site", UA_HASH);
//         assert_eq!(result.unwrap_err(), DecryptError::TagMismatch);
//     }

//     #[test]
//     fn test_server_rejects_wrong_ua_hash() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let enc = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let result = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, "wrong-ua");
//         assert_eq!(result.unwrap_err(), DecryptError::TagMismatch);
//     }

//     #[test]
//     fn test_server_rejects_wrong_bucket() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let enc = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let result = decrypt(&enc.ciphertext, &enc.tag, enc.bucket + 1, SITE_ID, UA_HASH);
//         assert_eq!(result.unwrap_err(), DecryptError::TagMismatch);
//     }

//     #[test]
//     fn test_server_accepts_same_bucket_window() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let plain = b"same window payload";
//         let r1 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let r2 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS + 10_000.0).unwrap().unwrap();
//         assert_eq!(r1.bucket, r2.bucket);
//         let d1 = decrypt(&r1.ciphertext, &r1.tag, r1.bucket, SITE_ID, UA_HASH).unwrap();
//         let d2 = decrypt(&r2.ciphertext, &r2.tag, r2.bucket, SITE_ID, UA_HASH).unwrap();
//         assert_eq!(d1, plain);
//         assert_eq!(d2, plain);
//     }

//     #[test]
//     fn test_decryption_produces_valid_json() {
//         let mut config = EncryptionConfig::new();
//         config.configure(true);
//         let plain = br#"{"asset_id":"abc","events":[],"scroll_depth":0.5}"#;
//         let enc = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
//         let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
//             .expect("json payload should decrypt");
//         let parsed: serde_json::Value = serde_json::from_slice(&decrypted)
//             .expect("decrypted bytes should be valid JSON");
//         assert_eq!(parsed["asset_id"], "abc");
//         assert_eq!(parsed["scroll_depth"], 0.5);
//     }

//     #[test]
//     fn test_decrypt_error_display() {
//         assert_eq!(
//             DecryptError::TagMismatch.to_string(),
//             "tag mismatch — payload rejected"
//         );
//     }
// }