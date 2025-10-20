// Fortis Payment Service Integration
// Documentation: https://docs.fortis.tech/v/1_0_0.html

interface FortisConfig {
  companyId: string;
  partnerId: string;
  mid: string;
  apiKey: string;
  apiSecret: string;
  environment: 'sandbox' | 'production';
}

interface PaymentRequest {
  amount: number;
  orderId: string;
  customerId: string;
  description: string;
  customerEmail: string;
  customerName: string;
}

interface VendorRequest {
  talentId: string;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
}

interface PayoutRequest {
  vendorId: string;
  amount: number;
  description: string;
  orderId: string;
}

export class FortisPaymentService {
  private config: FortisConfig;
  private baseUrl: string;

  constructor() {
    this.config = {
      companyId: process.env.REACT_APP_FORTIS_COMPANY_ID || '862763',
      partnerId: process.env.REACT_APP_FORTIS_PARTNER_ID || 'LunarPay',
      mid: process.env.REACT_APP_FORTIS_MID || '466210844885',
      apiKey: process.env.REACT_APP_FORTIS_API_KEY || '',
      apiSecret: process.env.REACT_APP_FORTIS_API_SECRET || '',
      environment: (process.env.REACT_APP_FORTIS_ENV as 'sandbox' | 'production') || 'sandbox'
    };

    this.baseUrl = this.config.environment === 'production' 
      ? 'https://api.fortis.tech' 
      : 'https://api.sandbox.fortis.tech';
  }

  // Initialize Fortis Elements for payment form
  public initializeElements(containerId: string, options?: any) {
    return new Promise((resolve, reject) => {
      // Load Fortis Elements script if not already loaded
      if (!window.FortisElements) {
        const script = document.createElement('script');
        script.src = this.config.environment === 'production'
          ? 'https://js.fortis.tech/elements.js'
          : 'https://js.sandbox.fortis.tech/elements.js';
        
        script.onload = () => {
          this.createElements(containerId, options).then(resolve).catch(reject);
        };
        
        script.onerror = () => reject(new Error('Failed to load Fortis Elements'));
        document.head.appendChild(script);
      } else {
        this.createElements(containerId, options).then(resolve).catch(reject);
      }
    });
  }

  private async createElements(containerId: string, options: any = {}) {
    const elements = window.FortisElements.create({
      companyId: this.config.companyId,
      partnerId: this.config.partnerId,
      mid: this.config.mid,
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
          merchantIdentifier: this.config.partnerId,
        },
        googlePay: {
          enabled: true,
          merchantId: this.config.mid,
        },
      },
    });

    cardElement.mount(`#${containerId}`);
    return { elements, cardElement };
  }

  // Process payment
  public async processPayment(paymentData: PaymentRequest, paymentMethod: any) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Fortis-Company-Id': this.config.companyId,
        },
        body: JSON.stringify({
          transaction_amount: Math.round(paymentData.amount * 100), // Convert to cents
          location_id: this.config.mid,
          payment_method: paymentMethod,
          order_number: paymentData.orderId,
          description: paymentData.description,
          billing_address: {
            first_name: paymentData.customerName.split(' ')[0],
            last_name: paymentData.customerName.split(' ').slice(1).join(' '),
            email: paymentData.customerEmail,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Payment failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Fortis payment error:', error);
      throw error;
    }
  }

  // Create vendor for talent payout
  public async createVendor(vendorData: VendorRequest) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/vendors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Fortis-Company-Id': this.config.companyId,
        },
        body: JSON.stringify({
          company_name: vendorData.businessName,
          contact_name: vendorData.contactName,
          email: vendorData.email,
          phone: vendorData.phone,
          address: vendorData.address,
          external_id: vendorData.talentId, // Link to our talent ID
        }),
      });

      if (!response.ok) {
        throw new Error(`Vendor creation failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Fortis vendor creation error:', error);
      throw error;
    }
  }

  // Process payout to vendor (talent)
  public async processVendorPayout(payoutData: PayoutRequest) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/payouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Fortis-Company-Id': this.config.companyId,
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
      console.error('Fortis payout error:', error);
      throw error;
    }
  }

  // Get vendor details
  public async getVendor(vendorId: string) {
    try {
      const response = await fetch(`${this.baseUrl}/v1/vendors/${vendorId}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Fortis-Company-Id': this.config.companyId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get vendor: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Fortis get vendor error:', error);
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

      const response = await fetch(`${this.baseUrl}/v1/payouts?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-Fortis-Company-Id': this.config.companyId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get payouts: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Fortis get payouts error:', error);
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

export const fortisPayment = new FortisPaymentService();
