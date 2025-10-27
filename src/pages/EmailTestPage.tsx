import React, { useState } from 'react';
import { emailService } from '../services/emailService';
import toast from 'react-hot-toast';

const EmailTestPage: React.FC = () => {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string>('');

  const sendTestEmail = async () => {
    setSending(true);
    setResult('');
    
    try {
      const success = await emailService.sendEmail({
        to: 'hello@shoutout.us',
        subject: '✅ Mailgun Test Email from ShoutOut',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h1 style="color: #111827;">🎉 Mailgun Configuration Test</h1>
            <p>This is a test email sent from:</p>
            <div style="background: #eff6ff; padding: 15px; border-radius: 10px; margin: 20px 0;">
              <p><strong>From:</strong> ShoutOut &lt;noreply@mail.shoutout.us&gt;</p>
              <p><strong>To:</strong> hello@shoutout.us</p>
              <p><strong>Domain:</strong> mail.shoutout.us</p>
              <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p style="color: #22c55e; font-weight: bold;">✅ If you're reading this, Mailgun is configured correctly!</p>
            <p>Your email notification system is ready to send:</p>
            <ul>
              <li>Order confirmations</li>
              <li>Delivery notifications</li>
              <li>Onboarding reminders</li>
              <li>Promotion emails</li>
            </ul>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">
              Sent via Mailgun API from ShoutOut notification system
            </p>
          </div>
        `
      });

      if (success) {
        setResult('✅ Test email sent successfully! Check hello@shoutout.us inbox.');
        toast.success('Test email sent! Check your inbox.');
      } else {
        setResult('⚠️ Email sending may have failed. Check console for Mailgun configuration issues.');
        toast.error('Email may not have sent. Check Mailgun credentials.');
      }
    } catch (error: any) {
      setResult(`❌ Error: ${error.message}`);
      toast.error('Failed to send test email');
      console.error('Test email error:', error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="glass-strong rounded-3xl shadow-modern-lg border border-white/30 p-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-red-600 bg-clip-text text-transparent mb-4 text-center">
            📧 Mailgun Email Test
          </h1>
          
          <div className="space-y-4">
            <div className="glass rounded-2xl p-6 border border-white/30">
              <h3 className="font-semibold text-gray-900 mb-3">Test Configuration:</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <p><strong>From:</strong> ShoutOut &lt;noreply@mail.shoutout.us&gt;</p>
                <p><strong>To:</strong> hello@shoutout.us</p>
                <p><strong>Domain:</strong> mail.shoutout.us</p>
                <p><strong>API:</strong> {process.env.REACT_APP_MAILGUN_API_KEY ? '✅ Configured' : '❌ Missing'}</p>
              </div>
            </div>

            <button
              onClick={sendTestEmail}
              disabled={sending}
              className="w-full bg-gradient-to-r from-blue-600 to-red-600 text-white py-4 px-8 rounded-2xl font-bold hover:from-blue-700 hover:to-red-700 transition-all duration-300 shadow-modern-lg hover:shadow-modern-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending Test Email...' : '📧 Send Test Email to hello@shoutout.us'}
            </button>

            {result && (
              <div className={`glass-strong rounded-2xl p-6 border border-white/30 ${
                result.includes('✅') ? 'bg-green-50/50' : 
                result.includes('❌') ? 'bg-red-50/50' : 'bg-yellow-50/50'
              }`}>
                <p className="text-sm">{result}</p>
              </div>
            )}

            <div className="glass rounded-2xl p-4 border border-white/30 bg-blue-50/50">
              <p className="text-xs text-blue-800">
                <strong>Note:</strong> Make sure REACT_APP_MAILGUN_API_KEY and REACT_APP_MAILGUN_DOMAIN are set in your environment variables.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmailTestPage;

