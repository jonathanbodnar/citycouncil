// LunarPay Service Integration
// Handles payment processing through LunarPay backend with Fortis Elements hosted on our platform
// Documentation: https://app.lunarpay.com/api-docs/
// Test Environment: https://devapp.lunarpay.com
// Test Merchant ID: 299

interface LunarPayConfig {
  apiUrl: string;
  apiKey: string;
  merchantId: string;
  environment: 'development' | 'production';
}

interface PaymentIntentionRequest {
  amount: number;
  currency: string;
  orderId: string;
  customerEmail: string;
  customerName: string;
  description: string;
  metadata?: Record<string, any>;
}

interface PaymentIntentionResponse {
  success: boolean;
  ticket: string;
  clientSecret: string;
  intentionId: string;
  error?: string;
}

interface PaymentConfirmationRequest {
  intentionId: string;
  paymentResult: any; // Result from Fortis Elements
  orderId: string;
}

interface PaymentConfirmationResponse {
  success: boolean;
  transactionId: string;
  status: 'completed' | 'failed' | 'pending';
  error?: string;
}

interface VendorPayoutRequest {
  vendorId: string;
  amount: number;
  orderId: string;
  description: string;
}

export class LunarPayService {
  private config: LunarPayConfig;

  constructor() {
    this.config = {
      apiUrl: process.env.REACT_APP_LUNARPAY_API_URL || 'https://devapp.lunarpay.com',
      apiKey: process.env.REACT_APP_LUNARPAY_API_KEY || '',
      merchantId: process.env.REACT_APP_LUNARPAY_MERCHANT_ID || '299', // Test merchant ID
      environment: (process.env.REACT_APP_LUNARPAY_ENV as 'development' | 'production') || 'development'
    };
  }

  // Step 1: Create Fortis transaction intention for Commerce.js Elements
  public async createTransactionIntention(request: PaymentIntentionRequest): Promise<PaymentIntentionResponse> {
    try {
      console.log('Creating Fortis transaction intention for merchant 299');
      console.log('API URL:', `${this.config.apiUrl}/customer/apiv1/pay/create_fortis_transaction_intention/${this.config.merchantId}`);
      console.log('API Key present:', !!this.config.apiKey);
      
      const response = await fetch(`${this.config.apiUrl}/customer/apiv1/pay/create_fortis_transaction_intention/${this.config.merchantId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(request.amount * 100), // Convert to cents
          currency: request.currency || 'USD',
          order_id: request.orderId,
          customer_email: request.customerEmail,
          customer_name: request.customerName,
          description: request.description,
          metadata: request.metadata,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Transaction intention failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Transaction intention response:', data);
      
      return {
        success: true,
        ticket: data.client_token, // Use client_token for Commerce.js
        clientSecret: data.client_token,
        intentionId: data.intention_id,
      };

    } catch (error) {
      console.error('LunarPay transaction intention error:', error);
      return {
        success: false,
        ticket: '',
        clientSecret: '',
        intentionId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }


  // Step 3: Send payment result back to LunarPay to complete payment
  public async confirmPayment(request: PaymentConfirmationRequest): Promise<PaymentConfirmationResponse> {
    try {
      // Use payment link confirmation endpoint
      const response = await fetch(`${this.config.apiUrl}/customer/apiv1/pay/payment_link/${request.intentionId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          payment_result: request.paymentResult,
          order_id: request.orderId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Payment confirmation failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        transactionId: data.transaction_id,
        status: data.status,
      };

    } catch (error) {
      console.error('LunarPay payment confirmation error:', error);
      return {
        success: false,
        transactionId: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Create customer using LunarPay API
  public async createCustomer(customerData: {
    email: string;
    name: string;
    phone?: string;
    address?: any;
  }) {
    try {
      const response = await fetch(`${this.config.apiUrl}/customer/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          email: customerData.email,
          name: customerData.name,
          phone: customerData.phone,
          address: customerData.address,
        }),
      });

      if (!response.ok) {
        throw new Error(`Customer creation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('LunarPay customer creation error:', error);
      throw error;
    }
  }

  // Initialize Fortis Commerce.js Elements with client_token (hosted on our platform)
  public initializeFortisCommerce(containerId: string, clientToken: string, options?: any): Promise<{ elements: any }> {
    return new Promise((resolve, reject) => {
      // Load Fortis Commerce.js script if not already loaded
      if (!window.Commerce) {
        const script = document.createElement('script');
        script.src = this.config.environment === 'production'
          ? 'https://js.fortis.tech/commercejs-v1.0.0.min.js'
          : 'https://js.sandbox.fortis.tech/commercejs-v1.0.0.min.js';
        
        script.onload = () => {
          this.createCommerceElements(containerId, clientToken, options).then(resolve).catch(reject);
        };
        
        script.onerror = () => reject(new Error('Failed to load Fortis Commerce.js'));
        document.head.appendChild(script);
      } else {
        this.createCommerceElements(containerId, clientToken, options).then(resolve).catch(reject);
      }
    });
  }

  private async createCommerceElements(containerId: string, clientToken: string, options: any = {}): Promise<{ elements: any }> {
    console.log('Creating Commerce.js elements with client_token:', clientToken);
    
    const elements = new window.Commerce.elements(clientToken);
    
    const elementConfig = {
      container: `#${containerId}`,
      theme: 'default',
      environment: 'sandbox', // Always sandbox for testing
      view: 'default',
      language: 'en-us',
      defaultCountry: 'US',
      floatingLabels: true,
      showReceipt: true,
      showSubmitButton: true,
      showValidationAnimation: true,
      hideAgreementCheckbox: false,
      hideTotal: false,
      digitalWallets: ['ApplePay', 'GooglePay'],
      appearance: {
        variables: {
          colorPrimary: '#3B82F6', // Blue theme to match ShoutOut
          colorBackground: '#FFFFFF',
          colorText: '#374151',
          colorDanger: '#EF4444',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          spacingUnit: '4px',
          borderRadius: '8px'
        }
      },
      ...options
    };

    console.log('Commerce.js element config:', elementConfig);
    elements.create(elementConfig);
    
    return { elements };
  }

  // Vendor/Talent management through LunarPay
  public async createVendor(vendorData: any) {
    try {
      const response = await fetch(`${this.config.apiUrl}/v1/vendors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Merchant-Id': this.config.merchantId,
        },
        body: JSON.stringify({
          external_id: vendorData.talentId,
          business_name: vendorData.businessName,
          contact_name: vendorData.contactName,
          email: vendorData.email,
          phone: vendorData.phone,
          address: vendorData.address,
        }),
      });

      if (!response.ok) {
        throw new Error(`Vendor creation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('LunarPay vendor creation error:', error);
      throw error;
    }
  }

  // Process vendor payout through LunarPay
  public async processVendorPayout(payoutData: VendorPayoutRequest) {
    try {
      const response = await fetch(`${this.config.apiUrl}/v1/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Merchant-Id': this.config.merchantId,
        },
        body: JSON.stringify({
          vendor_id: payoutData.vendorId,
          amount: Math.round(payoutData.amount * 100), // Convert to cents
          description: payoutData.description,
          reference: payoutData.orderId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Payout failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('LunarPay payout error:', error);
      throw error;
    }
  }

  // Get vendor details
  public async getVendor(vendorId: string) {
    try {
      const response = await fetch(`${this.config.apiUrl}/v1/vendors/${vendorId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Merchant-Id': this.config.merchantId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get vendor: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('LunarPay get vendor error:', error);
      throw error;
    }
  }

  // Get payout history for a vendor
  public async getVendorPayouts(vendorId: string, startDate?: string, endDate?: string) {
    try {
      const params = new URLSearchParams({
        vendor_id: vendorId,
        ...(startDate && { start_date: startDate }),
        ...(endDate && { end_date: endDate }),
      });

      const response = await fetch(`${this.config.apiUrl}/v1/payouts?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Merchant-Id': this.config.merchantId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get payouts: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('LunarPay get payouts error:', error);
      throw error;
    }
  }
}

// Global type declarations for Fortis Commerce.js
declare global {
  interface Window {
    Commerce: {
      elements: new (clientToken: string) => any;
    };
  }
}

export const lunarPayService = new LunarPayService();
