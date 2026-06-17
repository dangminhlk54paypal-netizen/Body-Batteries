import * as SecureStore from 'expo-secure-store';

const KEY_STORE_KEY = 'diary_encryption_key';

async function getOrCreateKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(KEY_STORE_KEY);
  if (!key) {
    key = generateKeyHex(32);
    await SecureStore.setItemAsync(KEY_STORE_KEY, key);
  }
  return key;
}

// Generates a 32-byte key as a hex string.
// NOTE: uses Math.random (obfuscation-grade, NOT a CSPRNG) so the app stays
// dependency-free — React Native has no global `crypto.getRandomValues`. The
// real protection is that this key is stored in the device secure keychain
// (expo-secure-store); the diary is XOR-obfuscated local data, not multi-party
// encryption. Upgrade to expo-crypto if stronger guarantees are ever needed.
function generateKeyHex(byteLength: number): string {
  let hex = '';
  for (let i = 0; i < byteLength; i++) {
    hex += Math.floor(Math.random() * 256)
      .toString(16)
      .padStart(2, '0');
  }
  return hex;
}

// Encode a (possibly Unicode / Vietnamese) string into UTF-8 bytes. This is
// required: charCodeAt on an accented character returns a value > 255, which
// makes the later btoa() throw "characters outside of the Latin1 range".
function toUtf8Bytes(str: string): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate — combine with the following low surrogate.
      const low = str.charCodeAt(++i);
      code = 0x10000 + ((code - 0xd800) << 10) + (low - 0xdc00);
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f)
      );
    } else {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    }
  }
  return bytes;
}

// XOR-based obfuscation over UTF-8 bytes, then base64 for safe text storage.
// Not cryptographically secure for multi-party use — see getOrCreateKey note.
function xorEncrypt(text: string, key: string): string {
  const bytes = toUtf8Bytes(text);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ^ key.charCodeAt(i % key.length));
  }
  return btoa(binary);
}

export async function encryptDiary(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  return xorEncrypt(plaintext, key);
}

// Diary is write-only: decryption intentionally NOT exported.
// If user wants to read, they export the raw encrypted string.
