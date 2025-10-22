// Bank Account Encryption Service
// Uses AES-256-GCM encryption for secure storage of sensitive banking information

interface EncryptionResult {
  encrypted: string;
  iv: string;
}

interface DecryptionResult {
  decrypted: string;
  success: boolean;
  error?: string;
}

export class BankInfoEncryption {
  private readonly algorithm = 'AES-GCM';
  private readonly keyLength = 256;
  
  // Get encryption key from environment or generate one
  private async getEncryptionKey(): Promise<CryptoKey> {
    const keyString = process.env.REACT_APP_BANK_ENCRYPTION_KEY;
    
    if (keyString) {
      // Import existing key from environment
      const keyBuffer = this.base64ToArrayBuffer(keyString);
      return await window.crypto.subtle.importKey(
        'raw',
        keyBuffer,
        { name: this.algorithm },
        false,
        ['encrypt', 'decrypt']
      );
    } else {
      // Generate new key for development (should be stored in production)
      const key = await window.crypto.subtle.generateKey(
        { name: this.algorithm, length: this.keyLength },
        true,
        ['encrypt', 'decrypt']
      );
      
      // Export key for storage (in production, store this securely)
      const exportedKey = await window.crypto.subtle.exportKey('raw', key);
      const keyString = this.arrayBufferToBase64(exportedKey);
      console.warn('DEVELOPMENT: Generated encryption key. Store this securely:', keyString);
      
      return key;
    }
  }

  // Encrypt sensitive bank account information
  public async encryptBankInfo(accountNumber: string, routingNumber: string): Promise<{
    encryptedAccount: EncryptionResult;
    encryptedRouting: EncryptionResult;
  }> {
    try {
      const key = await this.getEncryptionKey();
      
      const encryptedAccount = await this.encrypt(accountNumber, key);
      const encryptedRouting = await this.encrypt(routingNumber, key);
      
      return {
        encryptedAccount,
        encryptedRouting
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt bank information');
    }
  }

  // Decrypt bank account information for Fortis API calls
  public async decryptBankInfo(
    encryptedAccount: EncryptionResult,
    encryptedRouting: EncryptionResult
  ): Promise<{
    accountNumber: string;
    routingNumber: string;
  }> {
    try {
      const key = await this.getEncryptionKey();
      
      const accountResult = await this.decrypt(encryptedAccount, key);
      const routingResult = await this.decrypt(encryptedRouting, key);
      
      if (!accountResult.success || !routingResult.success) {
        throw new Error('Failed to decrypt bank information');
      }
      
      return {
        accountNumber: accountResult.decrypted,
        routingNumber: routingResult.decrypted
      };
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt bank information');
    }
  }

  // Encrypt a single string
  private async encrypt(plaintext: string, key: CryptoKey): Promise<EncryptionResult> {
    const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV for GCM
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);

    const encrypted = await window.crypto.subtle.encrypt(
      { name: this.algorithm, iv },
      key,
      data
    );

    return {
      encrypted: this.arrayBufferToBase64(encrypted),
      iv: this.arrayBufferToBase64(iv)
    };
  }

  // Decrypt a single string
  private async decrypt(encryptionResult: EncryptionResult, key: CryptoKey): Promise<DecryptionResult> {
    try {
      const encrypted = this.base64ToArrayBuffer(encryptionResult.encrypted);
      const iv = this.base64ToArrayBuffer(encryptionResult.iv);

      const decrypted = await window.crypto.subtle.decrypt(
        { name: this.algorithm, iv },
        key,
        encrypted
      );

      const decoder = new TextDecoder();
      return {
        decrypted: decoder.decode(decrypted),
        success: true
      };
    } catch (error) {
      return {
        decrypted: '',
        success: false,
        error: error instanceof Error ? error.message : 'Decryption failed'
      };
    }
  }

  // Utility: Convert ArrayBuffer to Base64
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  // Utility: Convert Base64 to ArrayBuffer
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Mask account number for display (show only last 4 digits)
  public maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 4) return accountNumber;
    return '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4);
  }

  // Mask routing number for display (show only first 4 digits)
  public maskRoutingNumber(routingNumber: string): string {
    if (routingNumber.length <= 4) return routingNumber;
    return routingNumber.slice(0, 4) + '*'.repeat(routingNumber.length - 4);
  }
}

export const bankEncryption = new BankInfoEncryption();
