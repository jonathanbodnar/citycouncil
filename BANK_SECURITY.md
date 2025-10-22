# Bank Account Security Implementation

## Overview
ShoutOut implements bank-level security for storing talent banking information using AES-256-GCM encryption with masked display and secure retrieval for Fortis payouts.

## Security Features

### 🔒 **Encryption**
- **Algorithm**: AES-256-GCM (industry standard)
- **Key Length**: 256 bits
- **IV**: Unique 96-bit initialization vector per field
- **Storage**: Encrypted data + IV stored separately

### 👁️ **Masked Input**
- **Account Number**: Shows only last 4 digits (`****1234`)
- **Routing Number**: Shows only first 4 digits (`1234****`)
- **Toggle Visibility**: Eye icon to reveal/hide numbers
- **Auto-mask**: Numbers masked when field loses focus

### 🛡️ **Secure Storage**
- **Encrypted Fields**: `account_number_encrypted`, `routing_number_encrypted`
- **Initialization Vectors**: `account_number_iv`, `routing_number_iv`
- **Masked Display**: `account_number_masked`, `routing_number_masked`
- **Original Fields**: Deprecated, made nullable for backward compatibility

## Database Schema

### Updated `vendor_bank_info` Table
```sql
-- Encrypted storage fields
account_number_encrypted TEXT,        -- AES-256-GCM encrypted account number
account_number_iv TEXT,              -- IV for account number encryption
account_number_masked VARCHAR(50),   -- Masked for display (****1234)

routing_number_encrypted TEXT,       -- AES-256-GCM encrypted routing number
routing_number_iv TEXT,             -- IV for routing number encryption
routing_number_masked VARCHAR(50),  -- Masked for display (1234****)

-- Original fields (deprecated, nullable)
account_number VARCHAR(255),        -- DEPRECATED: Use encrypted version
routing_number VARCHAR(20),         -- DEPRECATED: Use encrypted version
```

## Implementation

### 1. User Input (Step 3 Onboarding)
```typescript
<SecureBankInput
  label="Account Number"
  type="account"
  value={payoutData.account_number}
  onChange={(value) => setPayoutData({...payoutData, account_number: value})}
  required={true}
  maxLength={17}
/>
```

### 2. Encryption Before Storage
```typescript
// Encrypt sensitive information
const { encryptedAccount, encryptedRouting } = await bankEncryption.encryptBankInfo(
  payoutData.account_number,
  payoutData.routing_number
);

// Store encrypted data
await supabase.from('vendor_bank_info').insert([{
  talent_id: talentId,
  account_number_encrypted: encryptedAccount.encrypted,
  account_number_iv: encryptedAccount.iv,
  routing_number_encrypted: encryptedRouting.encrypted,
  routing_number_iv: encryptedRouting.iv,
  account_number_masked: bankEncryption.maskAccountNumber(accountNumber),
  routing_number_masked: bankEncryption.maskRoutingNumber(routingNumber)
}]);
```

### 3. Secure Retrieval for Fortis API
```typescript
// For payout processing (admin/backend only)
const bankInfo = await bankAccountService.getBankAccountForPayouts(talentId);
const { accountNumber, routingNumber } = bankInfo;

// Use decrypted numbers for Fortis API calls
await fortisAPI.createVendor({
  account_number: accountNumber,
  routing_number: routingNumber
});
```

### 4. Display in Admin Panel
```typescript
// For display purposes (shows masked numbers)
const displayInfo = await bankAccountService.getBankAccountForDisplay(talentId);
console.log(displayInfo.account_number_masked); // "****1234"
console.log(displayInfo.routing_number_masked); // "1234****"
```

## Security Best Practices

### 🔑 **Encryption Key Management**
1. **Development**: Key auto-generated and logged (for testing only)
2. **Production**: Store encryption key in secure environment variable
3. **Rotation**: Plan for key rotation and re-encryption
4. **Backup**: Secure backup of encryption key essential

### 🛡️ **Access Control**
1. **Decryption**: Only allowed for payout processing
2. **Display**: Always show masked versions in UI
3. **Logging**: Never log decrypted bank account numbers
4. **Admin Access**: Limited to verified admin users only

### 📋 **Environment Configuration**
```bash
# CRITICAL: Store this key securely in production
REACT_APP_BANK_ENCRYPTION_KEY=your_base64_256_bit_key_here
```

### 🔐 **Key Generation**
To generate a secure encryption key:
```javascript
// Run this once to generate a key, then store securely
const key = await window.crypto.subtle.generateKey(
  { name: 'AES-GCM', length: 256 },
  true,
  ['encrypt', 'decrypt']
);
const exportedKey = await window.crypto.subtle.exportKey('raw', key);
const keyString = btoa(String.fromCharCode(...new Uint8Array(exportedKey)));
console.log('Store this key securely:', keyString);
```

## Migration Steps

1. **Run Migration**: Execute `database/add_bank_encryption.sql`
2. **Set Encryption Key**: Add to environment variables
3. **Test Encryption**: Verify bank account storage works
4. **Test Decryption**: Verify Fortis payout integration
5. **Verify Masking**: Check UI shows masked numbers correctly

## Security Notes

⚠️ **CRITICAL SECURITY REQUIREMENTS:**
- Encryption key MUST be stored securely (not in code/database)
- Decrypted bank numbers should NEVER be logged
- Access to decryption should be limited to payout processing
- Regular security audits recommended
- Consider HSM (Hardware Security Module) for production

✅ **Benefits:**
- Bank-level security for sensitive data
- PCI compliance support
- Secure integration with Fortis API
- User-friendly masked display
- Audit trail for all bank account operations
