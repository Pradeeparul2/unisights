use wasm_bindgen_test::*;
use crate::encryption::{
    decrypt, derive_bucket, derive_client_key, authenticate,
    xor_stream, DecryptError, EncryptionConfig,
};

wasm_bindgen_test_configure!(run_in_browser);

const SITE_ID: &str = "site-abc";
const UA_HASH: &str = "ua1234";
const NOW_MS: f64 = 1_700_000_015_000.0;

// ── Bucket ────────────────────────────────────

#[wasm_bindgen_test]
fn test_bucket_floor() {
    assert_eq!(derive_bucket(0.0), 0);
    assert_eq!(derive_bucket(29_999.0), 0);
    assert_eq!(derive_bucket(30_000.0), 1);
    assert_eq!(derive_bucket(59_999.0), 1);
    assert_eq!(derive_bucket(60_000.0), 2);
}

#[wasm_bindgen_test]
fn test_same_bucket_within_window() {
    assert_eq!(derive_bucket(NOW_MS), derive_bucket(NOW_MS + 10_000.0));
}

#[wasm_bindgen_test]
fn test_different_bucket_across_window() {
    let b1 = derive_bucket(NOW_MS);
    assert_eq!(derive_bucket(NOW_MS + 30_000.0), b1 + 1);
}

// ── Client key ────────────────────────────────

#[wasm_bindgen_test]
fn test_client_key_deterministic() {
    let bucket = derive_bucket(NOW_MS);
    assert_eq!(
        derive_client_key(SITE_ID, bucket, UA_HASH),
        derive_client_key(SITE_ID, bucket, UA_HASH)
    );
}

#[wasm_bindgen_test]
fn test_client_key_changes_with_bucket() {
    let b = derive_bucket(NOW_MS);
    assert_ne!(derive_client_key(SITE_ID, b, UA_HASH), derive_client_key(SITE_ID, b + 1, UA_HASH));
}

#[wasm_bindgen_test]
fn test_client_key_changes_with_site_id() {
    let b = derive_bucket(NOW_MS);
    assert_ne!(derive_client_key("site-A", b, UA_HASH), derive_client_key("site-B", b, UA_HASH));
}

#[wasm_bindgen_test]
fn test_client_key_changes_with_ua_hash() {
    let b = derive_bucket(NOW_MS);
    assert_ne!(derive_client_key(SITE_ID, b, "ua-A"), derive_client_key(SITE_ID, b, "ua-B"));
}

// ── XOR stream ────────────────────────────────

#[wasm_bindgen_test]
fn test_xor_roundtrip() {
    let key = [0xABu8; 32];
    let plain = b"hello unisights analytics core!";
    let cipher = xor_stream(plain, &key);
    assert_eq!(xor_stream(&cipher, &key).as_slice(), plain.as_slice());
}

#[wasm_bindgen_test]
fn test_xor_empty_input() {
    assert!(xor_stream(&[], &[0u8; 32]).is_empty());
}

#[wasm_bindgen_test]
fn test_xor_multi_chunk() {
    let key = [0x42u8; 32];
    let plain = vec![0xFFu8; 100];
    let cipher = xor_stream(&plain, &key);
    assert_eq!(xor_stream(&cipher, &key), plain);
}

#[wasm_bindgen_test]
fn test_xor_ciphertext_differs_from_plaintext() {
    let key = [0x01u8; 32];
    let plain = b"sensitive payload data";
    assert_ne!(xor_stream(plain, &key).as_slice(), plain.as_slice());
}

// ── Authentication tag ────────────────────────

#[wasm_bindgen_test]
fn test_tag_deterministic() {
    let key = [0x01u8; 32];
    assert_eq!(
        authenticate(&key, b"data").unwrap(),
        authenticate(&key, b"data").unwrap()
    );
}

#[wasm_bindgen_test]
fn test_tag_changes_with_data() {
    let key = [0x01u8; 32];
    assert_ne!(
        authenticate(&key, b"data-A").unwrap(),
        authenticate(&key, b"data-B").unwrap()
    );
}

#[wasm_bindgen_test]
fn test_tag_changes_with_key() {
    assert_ne!(
        authenticate(&[0x01u8; 32], b"data").unwrap(),
        authenticate(&[0x02u8; 32], b"data").unwrap()
    );
}

// ── EncryptionConfig ──────────────────────────

#[wasm_bindgen_test]
fn test_disabled_returns_none() {
    let config = EncryptionConfig::new();
    assert!(config.encrypt(b"payload", SITE_ID, UA_HASH, NOW_MS).unwrap().is_none());
}

#[wasm_bindgen_test]
fn test_enabled_returns_some() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    assert!(config.encrypt(b"payload", SITE_ID, UA_HASH, NOW_MS).unwrap().is_some());
}

#[wasm_bindgen_test]
fn test_disable_clears() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    config.configure(false);
    assert!(!config.enabled);
    assert!(config.encrypt(b"payload", SITE_ID, UA_HASH, NOW_MS).unwrap().is_none());
}

#[wasm_bindgen_test]
fn test_encrypt_decrypt_roundtrip() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let plain = b"analytics payload data";
    let enc = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
        .expect("roundtrip should succeed");
    assert_eq!(decrypted, plain);
}

#[wasm_bindgen_test]
fn test_tag_verifies() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let enc = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    assert!(decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH).is_ok());
    let mut bad_tag = enc.tag.clone();
    bad_tag[0] ^= 0xFF;
    assert_eq!(
        decrypt(&enc.ciphertext, &bad_tag, enc.bucket, SITE_ID, UA_HASH).unwrap_err(),
        DecryptError::TagMismatch
    );
}

#[wasm_bindgen_test]
fn test_bucket_in_output() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let enc = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    assert_eq!(enc.bucket, derive_bucket(NOW_MS));
}

#[wasm_bindgen_test]
fn test_same_bucket_same_ciphertext() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let plain = b"deterministic";
    let r1 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let r2 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS + 5_000.0).unwrap().unwrap();
    assert_eq!(r1.bucket, r2.bucket);
    assert_eq!(r1.ciphertext, r2.ciphertext);
}

#[wasm_bindgen_test]
fn test_different_bucket_different_ciphertext() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let plain = b"same plaintext";
    let r1 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let r2 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS + 30_000.0).unwrap().unwrap();
    assert_ne!(r1.bucket, r2.bucket);
    assert_ne!(r1.ciphertext, r2.ciphertext);
}

// ── Decryption ────────────────────────────────

#[wasm_bindgen_test]
fn test_server_decrypts_correctly() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let plain = b"analytics event payload";
    let enc = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
        .expect("decryption should succeed");
    assert_eq!(decrypted, plain);
}

#[wasm_bindgen_test]
fn test_server_decrypts_empty_payload() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let plain = b"";
    let enc = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
        .expect("empty payload should decrypt");
    assert_eq!(decrypted, plain);
}

#[wasm_bindgen_test]
fn test_server_decrypts_large_payload() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let plain = vec![0x42u8; 1024];
    let enc = config.encrypt(&plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
        .expect("large payload should decrypt");
    assert_eq!(decrypted, plain);
}

#[wasm_bindgen_test]
fn test_server_decrypts_unicode_payload() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let plain = "நன்றி • 감사합니다 • ありがとう".as_bytes();
    let enc = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
        .expect("unicode payload should decrypt");
    assert_eq!(decrypted, plain);
}

#[wasm_bindgen_test]
fn test_server_rejects_tampered_ciphertext() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let enc = config.encrypt(b"real data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let mut tampered = enc.ciphertext.clone();
    tampered[0] ^= 0xFF;
    assert_eq!(
        decrypt(&tampered, &enc.tag, enc.bucket, SITE_ID, UA_HASH).unwrap_err(),
        DecryptError::TagMismatch
    );
}

#[wasm_bindgen_test]
fn test_server_rejects_tampered_tag() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let enc = config.encrypt(b"real data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let mut bad_tag = enc.tag.clone();
    bad_tag[0] ^= 0xFF;
    assert_eq!(
        decrypt(&enc.ciphertext, &bad_tag, enc.bucket, SITE_ID, UA_HASH).unwrap_err(),
        DecryptError::TagMismatch
    );
}

#[wasm_bindgen_test]
fn test_server_rejects_wrong_site_id() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let enc = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    assert_eq!(
        decrypt(&enc.ciphertext, &enc.tag, enc.bucket, "wrong-site", UA_HASH).unwrap_err(),
        DecryptError::TagMismatch
    );
}

#[wasm_bindgen_test]
fn test_server_rejects_wrong_ua_hash() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let enc = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    assert_eq!(
        decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, "wrong-ua").unwrap_err(),
        DecryptError::TagMismatch
    );
}

#[wasm_bindgen_test]
fn test_server_rejects_wrong_bucket() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let enc = config.encrypt(b"data", SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    assert_eq!(
        decrypt(&enc.ciphertext, &enc.tag, enc.bucket + 1, SITE_ID, UA_HASH).unwrap_err(),
        DecryptError::TagMismatch
    );
}

#[wasm_bindgen_test]
fn test_server_accepts_same_bucket_window() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let plain = b"same window payload";
    let r1 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let r2 = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS + 10_000.0).unwrap().unwrap();
    assert_eq!(r1.bucket, r2.bucket);
    assert_eq!(
        decrypt(&r1.ciphertext, &r1.tag, r1.bucket, SITE_ID, UA_HASH).unwrap(),
        plain
    );
    assert_eq!(
        decrypt(&r2.ciphertext, &r2.tag, r2.bucket, SITE_ID, UA_HASH).unwrap(),
        plain
    );
}

#[wasm_bindgen_test]
fn test_decryption_produces_valid_json() {
    let mut config = EncryptionConfig::new();
    config.configure(true);
    let plain = br#"{"asset_id":"abc","events":[],"scroll_depth":0.5}"#;
    let enc = config.encrypt(plain, SITE_ID, UA_HASH, NOW_MS).unwrap().unwrap();
    let decrypted = decrypt(&enc.ciphertext, &enc.tag, enc.bucket, SITE_ID, UA_HASH)
        .expect("json payload should decrypt");
    // verify it's valid UTF-8 JSON
    let json_str = std::str::from_utf8(&decrypted).expect("should be valid utf-8");
    assert!(json_str.contains("\"asset_id\":\"abc\""));
    assert!(json_str.contains("\"scroll_depth\":0.5"));
}

#[wasm_bindgen_test]
fn test_decrypt_error_display() {
    assert_eq!(
        DecryptError::TagMismatch.to_string(),
        "tag mismatch — payload rejected"
    );
}