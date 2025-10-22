# ShoutOut Payment Flow with LunarPay Integration

## Overview
ShoutOut integrates with LunarPay as a payment orchestration layer, which handles Fortis payment processing and vendor payouts. Card forms are hosted on our platform using Fortis Elements, NOT redirected to LunarPay.

## Test Configuration
- **Environment**: https://devapp.lunarpay.com
- **Test Merchant ID**: 299
- **Production Merchant ID**: (To be provided after testing)

## Payment Flow

### Step 1: Payment Initiation
When a user wants to make a payment on ShoutOut:

1. **Create Customer** (if needed):
   ```
   POST https://devapp.lunarpay.com/customer/create
   ```

2. **Create Ticket Intention** (for card tokenization):
   ```
   POST https://devapp.lunarpay.com/customer/apiv1/pay/create_fortis_ticket_intention/299
   ```
   OR

   **Create Transaction Intention** (for direct payment):
   ```
   POST https://devapp.lunarpay.com/customer/apiv1/pay/create_fortis_transaction_intention/299
   ```

### Step 2: Fortis Elements Integration
3. **Initialize Fortis Elements** on our platform:
   - Use the `ticket` returned from Step 1
   - Load Fortis Elements script: `https://js.sandbox.fortis.tech/elements.js`
   - Create card element and mount it in our payment form
   - Handle Apple Pay and Google Pay integration

### Step 3: Payment Processing
4. **Process Payment** through Fortis Elements:
   - User enters card details in our hosted form
   - Fortis Elements handles secure card processing
   - Elements returns payment result

### Step 4: Payment Confirmation
5. **Send Result to LunarPay**:
   ```
   POST https://devapp.lunarpay.com/customer/apiv1/pay/payment_link/[intention_id]
   ```
   - Send Fortis Elements payment result
   - LunarPay updates payment status in dashboard
   - LunarPay handles transaction storage and reporting

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
