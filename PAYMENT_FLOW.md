# ShoutOut Payment Flow with LunarPay + Fortis Commerce.js Integration

## Overview
ShoutOut integrates with LunarPay as a payment orchestration layer, which handles Fortis payment processing through Commerce.js iframe. Card forms are hosted on our platform using Fortis Commerce.js, NOT redirected to LunarPay.

## Test Configuration
- **Environment**: https://devapp.lunarpay.com
- **Test Merchant ID**: 299
- **Production Merchant ID**: (To be provided after testing)
- **Fortis Script**: https://js.sandbox.fortis.tech/commercejs-v1.0.0.min.js (SANDBOX ONLY)

## Payment Flow

### Step 1: Transaction Intention
When a user wants to make a payment on ShoutOut:

1. **Create Transaction Intention**:
   ```
   POST https://devapp.lunarpay.com/customer/apiv1/pay/create_fortis_transaction_intention/299
   ```
   - This endpoint handles API keys for merchant 299
   - Returns `client_token` needed for Commerce.js iframe

### Step 2: Fortis Commerce.js Integration
2. **Initialize Commerce.js iframe** on our platform:
   - Load Commerce.js script: `https://js.sandbox.fortis.tech/commercejs-v1.0.0.min.js`
   - Use `client_token` from Step 1
   - Create iframe with full payment processing capability
   - Supports Card, Apple Pay, and Google Pay automatically

### Step 3: Payment Processing
3. **Commerce.js handles everything**:
   - User interacts with Commerce.js iframe on our platform
   - Iframe includes card form, Apple Pay, Google Pay buttons
   - Fortis processes payment securely within iframe
   - Payment result handled automatically by Commerce.js

### Step 4: Payment Completion
4. **Automatic result handling**:
   - Commerce.js processes payment and shows receipt
   - Payment status updated automatically in LunarPay dashboard
   - Transaction stored and tracked through LunarPay system
   - Success/error events handled by Commerce.js callbacks

## Commerce.js Configuration

### Script Loading
```html
<script src="https://js.sandbox.fortis.tech/commercejs-v1.0.0.min.js"></script>
```

### Element Creation
```javascript
var elements = new Commerce.elements('{{client_token}}');
elements.create({
  container: '#payment',
  theme: 'default',
  environment: 'sandbox',
  view: 'default',
  language: 'en-us',
  defaultCountry: 'US',
  floatingLabels: true,
  showReceipt: true,
  showSubmitButton: true,
  showValidationAnimation: true,
  hideAgreementCheckbox: false,
  hideTotal: false,
  digitalWallets: ['ApplePay', 'GooglePay']
});
```

## Vendor Payout Flow

### After Payment Success
1. **Vendor Creation** (if not exists):
   - Talent is registered as a vendor in Fortis through LunarPay
   - Store vendor ID in talent profile

2. **Automatic Payout Calculation**:
   - Original payment amount: $100
   - LunarPay/Fortis fees: ~$3-5
   - ShoutOut admin fee: 10%
   - Talent payout: Remaining amount

3. **Payout Processing**:
   - LunarPay handles vendor payouts automatically
   - Based on payout schedule (daily, weekly, etc.)
   - Direct deposit to talent's bank account

## Environment Variables

### Development (.env)
```bash
REACT_APP_LUNARPAY_API_URL=https://devapp.lunarpay.com
REACT_APP_LUNARPAY_API_KEY=your_dev_api_key
REACT_APP_LUNARPAY_MERCHANT_ID=299
REACT_APP_LUNARPAY_ENV=development
```

### Production (.env.production)
```bash
REACT_APP_LUNARPAY_API_URL=https://app.lunarpay.com
REACT_APP_LUNARPAY_API_KEY=your_prod_api_key
REACT_APP_LUNARPAY_MERCHANT_ID=your_production_merchant_id
REACT_APP_LUNARPAY_ENV=production
```

## Key Benefits

1. **Security**: Card data never touches our servers
2. **Compliance**: Fortis handles PCI compliance
3. **Unified Dashboard**: LunarPay provides centralized payment management
4. **Automated Payouts**: Vendor payments handled automatically
5. **Multiple Payment Methods**: Card, Apple Pay, Google Pay support
6. **Real-time Reporting**: Transaction tracking and analytics

## API Endpoints Summary

| Purpose | Method | Endpoint |
|---------|--------|----------|
| Create Customer | POST | `/customer/create` |
| Ticket Intention | POST | `/customer/apiv1/pay/create_fortis_ticket_intention/{merchant_id}` |
| Transaction Intention | POST | `/customer/apiv1/pay/create_fortis_transaction_intention/{merchant_id}` |
| Payment Confirmation | POST | `/customer/apiv1/pay/payment_link/{intention_id}` |
| Get Payment Link | GET | `/c/portal/payment_link/{payment_link_hash}` |

## Testing Steps

1. Set up development environment with test merchant ID 299
2. Test card tokenization flow with ticket intention
3. Test direct payment flow with transaction intention
4. Verify payment confirmation and status updates
5. Test vendor payout processing
6. Validate Apple Pay and Google Pay integration
7. Move to production with real merchant ID

## Notes

- **DO NOT** redirect users to LunarPay payment pages
- **DO** host Fortis Elements on our platform
- **ALL** payments go through our UI with LunarPay backend
- **VENDOR** payouts are automated after fees calculation
- **TEST** thoroughly with merchant ID 299 before production
