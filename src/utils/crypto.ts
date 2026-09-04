/**
 * End-to-End Encryption (E2EE) utilities using standard WebCrypto API.
 * AES-GCM 256-bit with PBKDF2 Key Derivation (SHA-256, 100,000 iterations).
 */

const SALT_STRING = 'GlassStream_E2EE_Salt_v1';
const cachedKeyMap = new Map<string, CryptoKey>();

async function deriveKey(passphrase: string, roomId: string): Promise<CryptoKey> {
  const cacheKey = `${passphrase}::${roomId}`;
  if (cachedKeyMap.has(cacheKey)) {
    return cachedKeyMap.get(cacheKey)!;
  }

  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase || 'default_glass_room_e2ee'),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = enc.encode(`${SALT_STRING}_${roomId}`);
  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  cachedKeyMap.set(cacheKey, derivedKey);
  return derivedKey;
}

export async function encryptText(plainText: string, passphrase: string, roomId: string): Promise<string> {
  try {
    const key = await deriveKey(passphrase, roomId);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encoded = enc.encode(plainText);

    const ciphertext = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      encoded
    );

    // Combine IV (12 bytes) + Ciphertext
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);

    // Encode to base64
    let binary = '';
    const bytes = new Uint8Array(combined);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  } catch (err) {
    console.error('Encryption failed:', err);
    return plainText;
  }
}

export async function decryptText(base64Payload: string, passphrase: string, roomId: string): Promise<string> {
  try {
    const binary = window.atob(base64Payload);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    if (bytes.length < 13) {
      return base64Payload; // Not a valid encrypted payload
    }

    const iv = bytes.slice(0, 12);
    const ciphertext = bytes.slice(12);

    const key = await deriveKey(passphrase, roomId);
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    // If decryption fails (e.g. mismatched room key), return a safe indication
    return `[🔒 Mensagem criptografada - Chave incorreta]`;
  }
}

/**
 * Generate Safety Numbers / Fingerprint for verifying E2EE with friends
 */
export async function generateSafetyFingerprint(passphrase: string, roomId: string): Promise<string> {
  try {
    const enc = new TextEncoder();
    const data = enc.encode(`GLASS_STREAM_FINGERPRINT_${passphrase}_${roomId}`);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    
    // Group into 6 blocks of 5 digits
    const numStrings: string[] = [];
    for (let i = 0; i < 12; i += 2) {
      const val = (hashArray[i] * 256 + hashArray[i + 1]) % 100000;
      numStrings.push(val.toString().padStart(5, '0'));
    }
    return numStrings.join(' ');
  } catch (err) {
    return '00000 00000 00000 00000 00000 00000';
  }
}
