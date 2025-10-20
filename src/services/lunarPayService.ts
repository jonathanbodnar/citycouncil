// LunarPay Service Integration
// Handles payment processing through LunarPay backend instead of direct Fortis API
// Documentation: https://app.lunarpay.com/api-docs/

interface LunarPayConfig {
  apiUrl: string;
  apiKey: string;
  merchantId: string;
  environment: 'sandbox' | 'production';
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
      apiUrl: process.env.REACT_APP_LUNARPAY_API_URL || 'https://api.lunarpay.com',
      apiKey: process.env.REACT_APP_LUNARPAY_API_KEY || '',
      merchantId: process.env.REACT_APP_LUNARPAY_MERCHANT_ID || '862763',
      environment: (process.env.REACT_APP_LUNARPAY_ENV as 'sandbox' | 'production') || 'sandbox'
    };
  }

  // Step 1: Request payment intention/ticket from LunarPay
  public async createPaymentIntention(request: PaymentIntentionRequest): Promise<PaymentIntentionResponse> {
    try {
      const response = await fetch(`${this.config.apiUrl}/v1/payments/intentions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Merchant-Id': this.config.merchantId,
        },
        body: JSON.stringify({
          amount: Math.round(request.amount * 100), // Convert to cents
          currency: request.currency || 'USD',
          order_id: request.orderId,
          customer: {
            email: request.customerEmail,
            name: request.customerName,
          },
          description: request.description,
          metadata: request.metadata,
          payment_methods: ['card', 'apple_pay', 'google_pay'],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Payment intention failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      return {
        success: true,
        ticket: data.ticket,
        clientSecret: data.client_secret,
        intentionId: data.intention_id,
      };

    } catch (error) {
      console.error('LunarPay payment intention error:', error);
      return {
        success: false,
        ticket: '',
        clientSecret: '',
        intentionId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Step 3: Send payment result back to LunarPay to store
  public async confirmPayment(request: PaymentConfirmationRequest): Promise<PaymentConfirmationResponse> {
    try {
      const response = await fetch(`${this.config.apiUrl}/v1/payments/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Merchant-Id': this.config.merchantId,
        },
        body: JSON.stringify({
          intention_id: request.intentionId,
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

  // Initialize Fortis Elements with LunarPay ticket
  public initializeFortisElements(containerId: string, ticket: string, options?: any): Promise<{ elements: any; cardElement: any }> {
    return new Promise((resolve, reject) => {
      // Load Fortis Elements script if not already loaded
      if (!window.FortisElements) {
        const script = document.createElement('script');
        script.src = this.config.environment === 'production'
          ? 'https://js.fortis.tech/elements.js'
          : 'https://js.sandbox.fortis.tech/elements.js';
        
        script.onload = () => {
          this.createElements(containerId, ticket, options).then(resolve).catch(reject);
        };
        
        script.onerror = () => reject(new Error('Failed to load Fortis Elements'));
        document.head.appendChild(script);
      } else {
        this.createElements(containerId, ticket, options).then(resolve).catch(reject);
      }
    });
  }

  private async createElements(containerId: string, ticket: string, options: any = {}): Promise<{ elements: any; cardElement: any }> {
    const elements = window.FortisElements.create({
      // Use the ticket from LunarPay instead of direct API credentials
      ticket: ticket,
      environment: this.config.environment,
      ...options
    });

    const cardElement = elements.create('card', {
      style: {
        base: {
          fontSize: '16px',
          color: '#374151',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
          '::placeholder': {
            color: '#9CA3AF',
          },
        },
        invalid: {
          color: '#EF4444',
        },
      },
      hidePostalCode: false,
      // Enable Apple Pay and Google Pay
      paymentMethods: {
        applePay: {
          enabled: true,
        },
        googlePay: {
          enabled: true,
        },
      },
    });

    cardElement.mount(`#${containerId}`);
    return { elements, cardElement };
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

// Global type declarations for Fortis Elements
declare global {
  interface Window {
    FortisElements: any;
  }
}

export const lunarPayService = new LunarPayService();
