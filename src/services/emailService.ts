// Mailgun Email Service

interface EmailParams {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

class EmailService {
  private apiKey: string;
  private domain: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.REACT_APP_MAILGUN_API_KEY || '';
    this.domain = process.env.REACT_APP_MAILGUN_DOMAIN || '';
    this.apiUrl = `https://api.mailgun.net/v3/${this.domain}/messages`;
  }

  async sendEmail({ to, subject, html, from = 'ShoutOut <noreply@mail.shoutout.us>' }: EmailParams): Promise<boolean> {
    try {
      console.log('Mailgun Config Check:', {
        apiKey: this.apiKey ? '✅ Set' : '❌ Missing',
        domain: this.domain || '❌ Missing',
        apiUrl: this.apiUrl
      });

      if (!this.apiKey || !this.domain) {
        console.warn('Mailgun not configured. Email would be sent:', { to, subject });
        console.warn('IMPORTANT: Mailgun emails must be sent from backend, not frontend!');
        console.warn('Consider setting up a backend API endpoint for email sending.');
        return false;
      }

      const formData = new FormData();
      formData.append('from', from);
      formData.append('to', to);
      formData.append('subject', subject);
      formData.append('html', html);

      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(`api:${this.apiKey}`)}`,
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Mailgun API error: ${response.statusText}`);
      }

      console.log('Email sent successfully to:', to);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  // Talent Onboarding Reminders
  async sendOnboardingReminder(email: string, fullName: string, onboardingLink: string, currentStep: number): Promise<boolean> {
    const stepNames = {
      1: 'Create Your Account',
      2: 'Complete Your Profile Details',
      3: 'Add Your Payout Information',
      4: 'Upload Your Promo Video'
    };

    const stepDescriptions = {
      1: 'Create your account to get started',
      2: 'Add your bio, pricing, and profile photo',
      3: 'Set up your bank account for payouts',
      4: 'Record and upload your promotional video'
    };

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">👋 Complete Your ShoutOut Setup</h1>
        <p>Hi ${fullName},</p>
        <p>You're almost ready to start earning with ShoutOut! You have ${4 - currentStep + 1} step${4 - currentStep > 0 ? 's' : ''} remaining.</p>
        
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #fef2f2 100%); border-radius: 15px; padding: 25px; margin: 25px 0;">
          <h3 style="margin-top: 0; color: #1e40af;">📍 Next Step: ${stepNames[currentStep as keyof typeof stepNames]}</h3>
          <p style="margin-bottom: 20px;">${stepDescriptions[currentStep as keyof typeof stepDescriptions]}</p>
          <a href="${onboardingLink}" style="background: linear-gradient(to right, #2563eb, #dc2626); color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: bold;">
            Continue Setup
          </a>
        </div>
        
        <p><strong>Why Complete Your Setup:</strong></p>
        <ul>
          <li>💰 <strong>$250 Onboarding Bonus</strong> - Get paid extra for your first 10 orders</li>
          <li>📢 <strong>Free Promotion</strong> - $200/month in ad spend promoting your profile</li>
          <li>🎬 <strong>Start Earning</strong> - Receive video requests from fans</li>
          <li>⚡ <strong>0% Fees</strong> - No platform fees on your first 10 orders</li>
        </ul>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          Your onboarding link never expires. Complete your setup whenever you're ready!
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: `⏰ Complete Your ShoutOut Setup - Step ${currentStep} of 4`,
      html
    });
  }

  async sendPromotionClaimed(email: string, fullName: string): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #7c3aed;">🎁 Promotion Package Claimed!</h1>
        <p>Hi ${fullName},</p>
        <p>Congratulations! You're now part of the ShoutOut Promotion Program.</p>
        <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0;">What You Get:</h3>
          <ul>
            <li><strong>$200/month</strong> in ad spend on Rumble & Meta</li>
            <li><strong>$250 bonus</strong> after 10 orders in 30 days</li>
            <li><strong>0% fees</strong> on your first 10 orders</li>
          </ul>
        </div>
        <p><strong>Remember to:</strong></p>
        <ul>
          <li>Add your ShoutOut link to your social media bio</li>
          <li>Post your promo video 2x per month (tag @shoutoutforus)</li>
          <li>Share at least one ShoutOut video on Instagram</li>
        </ul>
        <p>Keep up the great work!</p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: '🎁 Welcome to the ShoutOut Promotion Program!',
      html
    });
  }

  async sendNewOrderNotification(email: string, talentName: string, orderDetails: {
    userName: string;
    amount: number;
    requestDetails: string;
    deadline: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">🎬 New ShoutOut Order!</h1>
        <p>Hi ${talentName},</p>
        <p>You have a new order request!</p>
        <div style="background: #eff6ff; border-radius: 10px; padding: 20px; margin: 20px 0;">
          <p><strong>From:</strong> ${orderDetails.userName}</p>
          <p><strong>Amount:</strong> $${orderDetails.amount.toFixed(2)}</p>
          <p><strong>Due:</strong> ${orderDetails.deadline}</p>
          <p><strong>Request:</strong></p>
          <p style="background: white; padding: 15px; border-radius: 5px;">${orderDetails.requestDetails}</p>
        </div>
        <a href="https://shoutout.us/dashboard" style="background: linear-gradient(to right, #2563eb, #dc2626); color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: bold;">
          View Order Details
        </a>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: `🎬 New Order from ${orderDetails.userName}`,
      html
    });
  }

  async sendOrderDeadlineReminder(email: string, talentName: string, orderDetails: {
    userName: string;
    hoursLeft: number;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #dc2626;">⏰ Order Deadline Approaching!</h1>
        <p>Hi ${talentName},</p>
        <p><strong>Reminder:</strong> You have less than ${orderDetails.hoursLeft} hours left to complete your order for ${orderDetails.userName}.</p>
        <div style="background: #fef2f2; border-left: 4px solid #dc2626; padding: 20px; margin: 20px 0;">
          <p style="margin: 0;">⚠️ Please complete and upload the ShoutOut video soon to avoid late delivery penalties.</p>
        </div>
        <a href="https://shoutout.us/dashboard" style="background: linear-gradient(to right, #dc2626, #2563eb); color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: bold;">
          Complete Order Now
        </a>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: `⏰ Deadline Reminder: Order from ${orderDetails.userName}`,
      html
    });
  }

  // User Notifications
  async sendOrderConfirmation(email: string, userName: string, orderDetails: {
    talentName: string;
    amount: number;
    adminFee: number;
    charityAmount?: number;
    total: number;
    requestDetails: string;
    estimatedDelivery: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">🎉 Order Confirmed!</h1>
        <p>Hi ${userName},</p>
        <p>Thank you for your order! Here's your receipt:</p>
        
        <div style="background: #f8fafc; border-radius: 10px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Order Summary</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;"><strong>Talent:</strong></td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${orderDetails.talentName}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">ShoutOut Price:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">$${orderDetails.amount.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">Service Fee:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">$${orderDetails.adminFee.toFixed(2)}</td>
            </tr>
            ${orderDetails.charityAmount ? `
            <tr>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #dc2626;">Charity Donation:</td>
              <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; text-align: right; color: #dc2626;">$${orderDetails.charityAmount.toFixed(2)}</td>
            </tr>
            ` : ''}
            <tr>
              <td style="padding: 15px 0; font-size: 18px;"><strong>Total:</strong></td>
              <td style="padding: 15px 0; font-size: 18px; text-align: right;"><strong>$${orderDetails.total.toFixed(2)}</strong></td>
            </tr>
          </table>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
            <p><strong>Your Request:</strong></p>
            <p style="background: white; padding: 15px; border-radius: 5px;">${orderDetails.requestDetails}</p>
          </div>
          
          <p style="margin-top: 20px;"><strong>Estimated Delivery:</strong> ${orderDetails.estimatedDelivery}</p>
        </div>
        
        <a href="https://shoutout.us/dashboard" style="background: linear-gradient(to right, #2563eb, #dc2626); color: white; padding: 15px 30px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: bold;">
          Track Your Order
        </a>
        
        <p style="color: #666; font-size: 12px; margin-top: 30px;">
          You'll receive another email when your ShoutOut is ready!
        </p>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: `🎬 Order Confirmed - ${orderDetails.talentName} ShoutOut`,
      html
    });
  }

  async sendOrderDelivered(email: string, userName: string, orderDetails: {
    talentName: string;
    videoUrl: string;
  }): Promise<boolean> {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #22c55e;">✨ Your ShoutOut is Ready!</h1>
        <p>Hi ${userName},</p>
        <p>Great news! ${orderDetails.talentName} has completed your personalized ShoutOut video!</p>
        
        <div style="background: linear-gradient(135deg, #eff6ff 0%, #fef2f2 100%); border-radius: 15px; padding: 30px; margin: 30px 0; text-align: center;">
          <div style="font-size: 48px; margin-bottom: 20px;">🎥</div>
          <h2 style="margin-bottom: 20px;">Your Video is Ready to Watch!</h2>
          <a href="${orderDetails.videoUrl}" style="background: linear-gradient(to right, #2563eb, #dc2626); color: white; padding: 15px 40px; text-decoration: none; border-radius: 10px; display: inline-block; font-weight: bold; font-size: 16px;">
            Watch Your ShoutOut
          </a>
        </div>
        
        <p>We hope you love your personalized video! Don't forget to:</p>
        <ul>
          <li>Share it on social media</li>
          <li>Tag @shoutoutforus so we can celebrate with you!</li>
          <li>Leave a review to help others</li>
        </ul>
        
        <a href="https://shoutout.us/dashboard" style="background: #f3f4f6; color: #374151; padding: 12px 24px; text-decoration: none; border-radius: 10px; display: inline-block; margin-top: 20px;">
          View in Dashboard
        </a>
      </div>
    `;

    return this.sendEmail({
      to: email,
      subject: `✨ Your ShoutOut from ${orderDetails.talentName} is Ready!`,
      html
    });
  }
}

export const emailService = new EmailService();

