import * as SecureStore from 'expo-secure-store';

const KEY_STORE_KEY = 'diary_encryption_key';

async function getOrCreateKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(KEY_STORE_KEY);
  if (!key) {
    // Generate a random 32-byte hex key
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    key = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    await SecureStore.setItemAsync(KEY_STORE_KEY, key);
  }
  return key;
}

// XOR-based obfuscation — sufficient for write-only local diary privacy.
// Not cryptographically secure for multi-party use.
function xorEncrypt(text: string, key: string): string {
  const result: number[] = [];
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(String.fromCharCode(...result));
}

export async function encryptDiary(plaintext: string): Promise<string> {
  const key = await getOrCreateKey();
  return xorEncrypt(plaintext, key);
}

// Diary is write-only: decryption intentionally NOT exported.
// If user wants to read, they export the raw encrypted string.
