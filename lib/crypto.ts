/**
 * Encryption utilities for sensitive data at rest.
 * 
 * IMPORTANT: This module provides encryption for sensitive tokens stored in the database.
 * The encryption key must be set via ENCRYPTION_KEY environment variable (32-byte hex string).
 * 
 * Usage:
 *   const encrypted = encrypt(plaidAccessToken);
 *   const decrypted = decrypt(encrypted);
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get the encryption key from environment.
 * Returns undefined if not configured (for graceful degradation in dev).
 */
function getEncryptionKey(): Buffer | undefined {
  const keyHex = process.env.ENCRYPTION_KEY;
  if (!keyHex) {
    console.warn("[crypto] ENCRYPTION_KEY not set - encryption disabled. Set a 32-byte hex key in production.");
    return undefined;
  }
  
  const key = Buffer.from(keyHex, "hex");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (64 hex characters)");
  }
  return key;
}

/**
 * Encrypt a plaintext string.
 * Returns format: iv:authTag:ciphertext (all hex-encoded)
 * 
 * If encryption key is not configured, returns the plaintext with a prefix
 * to indicate it's unencrypted (for development/migration purposes).
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    // In development without encryption key, prefix to indicate unencrypted
    return `unencrypted:${plaintext}`;
  }
  
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decrypt an encrypted string.
 * Expects format: iv:authTag:ciphertext (all hex-encoded)
 * 
 * Handles both encrypted and legacy unencrypted values gracefully.
 */
export function decrypt(encryptedData: string): string {
  // Handle unencrypted legacy data
  if (encryptedData.startsWith("unencrypted:")) {
    return encryptedData.slice("unencrypted:".length);
  }
  
  // Handle legacy plain tokens (no colons = old unencrypted format)
  if (!encryptedData.includes(":")) {
    console.warn("[crypto] Decrypting legacy unencrypted token - consider migrating");
    return encryptedData;
  }
  
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("Cannot decrypt: ENCRYPTION_KEY not configured");
  }
  
  const parts = encryptedData.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  
  const [ivHex, authTagHex, ciphertext] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

/**
 * Check if a value is already encrypted.
 * Used during migration to avoid double-encryption.
 */
export function isEncrypted(value: string): boolean {
  if (value.startsWith("unencrypted:")) return true;
  const parts = value.split(":");
  return parts.length === 3 && parts[0].length === IV_LENGTH * 2;
}

/**
 * Generate a new encryption key (for initial setup).
 * Run this once and store the output in ENCRYPTION_KEY env var.
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString("hex");
}
