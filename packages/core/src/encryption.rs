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