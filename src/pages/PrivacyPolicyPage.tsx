import React from 'react';

const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        <div className="prose max-w-none">
          <p className="text-gray-600 mb-6">
            <strong>Effective Date:</strong> November 6, 2025<br />
            <strong>Last Updated:</strong> November 6, 2025
          </p>

          <p className="text-gray-700 mb-8">
            ShoutOut ("we," "us," or "our") is committed to protecting your privacy. This Privacy Policy 
            explains how we collect, use, disclose, and safeguard your information when you use our platform, 
            including our website and mobile applications (collectively, the "Services").
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Information We Collect</h2>
            
            <h3 className="text-lg font-semibold text-gray-800 mb-3 mt-4">1.1 Information You Provide</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Account Information:</strong> Name, email address, username, password, and profile information</li>
              <li><strong>Payment Information:</strong> Credit/debit card details processed through Fortis Commerce (PCI-DSS compliant)</li>
              <li><strong>Banking Information:</strong> Bank account details for talent payouts, collected and verified through Plaid and processed by Moov (encrypted and securely stored)</li>
              <li><strong>Phone Number:</strong> For SMS-based multi-factor authentication (MFA) via Twilio</li>
              <li><strong>Order Details:</strong> Video requests, occasion details, recipient information, and communications</li>
              <li><strong>Talent Information:</strong> Profile photos, promotional videos, pricing, categories, bio, and social media links</li>
              <li><strong>Identity Verification:</strong> Government-issued ID or other verification documents for talent accounts</li>
            </ul>

            <h3 className="text-lg font-semibold text-gray-800 mb-3 mt-4">1.2 Automatically Collected Information</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Device Information:</strong> IP address, browser type, operating system, device identifiers</li>
              <li><strong>Usage Data:</strong> Pages viewed, time spent, features used, search queries, and interaction patterns</li>
              <li><strong>Cookies and Tracking:</strong> Session cookies, analytics cookies, and Meta Pixel for advertising (see Section 6)</li>
              <li><strong>Location Data:</strong> Approximate location based on IP address</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">2. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Service Provision:</strong> Create and manage accounts, process orders, facilitate video delivery</li>
              <li><strong>Payment Processing:</strong> Process transactions via Fortis Commerce and distribute payouts via Moov</li>
              <li><strong>Bank Verification:</strong> Verify bank account ownership and eligibility using Plaid</li>
              <li><strong>Security & Authentication:</strong> Enable multi-factor authentication (MFA) via SMS using Twilio</li>
              <li><strong>Communications:</strong> Send order updates, notifications, promotional offers, and customer support responses</li>
              <li><strong>Platform Improvement:</strong> Analyze usage patterns, conduct A/B testing, improve features and UX</li>
              <li><strong>Fraud Prevention:</strong> Detect and prevent fraudulent transactions, account takeovers, and abuse</li>
              <li><strong>Legal Compliance:</strong> Comply with applicable laws, regulations, and legal processes</li>
              <li><strong>Marketing:</strong> Retargeting and conversion tracking via Meta Pixel (with your consent)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">3. Third-Party Service Providers</h2>
            <p className="text-gray-700 mb-4">
              We share your information with the following third-party service providers who process data on our behalf:
            </p>

            <div className="ml-4 space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-800">Fortis Commerce (Payment Processing)</h3>
                <p className="text-gray-700 text-sm mt-1">
                  <strong>Purpose:</strong> Securely process credit/debit card transactions and refunds<br />
                  <strong>Data Shared:</strong> Payment card details, transaction amounts, customer billing information<br />
                  <strong>Privacy Policy:</strong> <a href="https://fortis.tech/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">https://fortis.tech/privacy</a>
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-800">Moov (Payout Processing)</h3>
                <p className="text-gray-700 text-sm mt-1">
                  <strong>Purpose:</strong> Process ACH bank transfers for talent payouts<br />
                  <strong>Data Shared:</strong> Bank account numbers, routing numbers, account holder names, payout amounts<br />
                  <strong>Privacy Policy:</strong> <a href="https://moov.io/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">https://moov.io/legal/privacy</a>
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold text-gray-800">Plaid (Bank Account Verification)</h3>
                <p className="text-gray-700 text-sm mt-1">
                  <strong>Purpose:</strong> Securely connect and verify bank accounts for payouts<br />
                  <strong>Data Shared:</strong> Bank login credentials (handled entirely by Plaid, not stored by us), bank account details<br />
                  <strong>Privacy Policy:</strong> <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">https://plaid.com/legal/#end-user-privacy-policy</a><br />
                  <strong>Note:</strong> Plaid uses bank-level encryption and does not share your bank login credentials with ShoutOut.
                </p>
              </div>

              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-semibold text-gray-800">Twilio (SMS Authentication)</h3>
                <p className="text-gray-700 text-sm mt-1">
                  <strong>Purpose:</strong> Send SMS verification codes for multi-factor authentication (MFA)<br />
                  <strong>Data Shared:</strong> Phone numbers, verification codes (temporary, auto-deleted after use)<br />
                  <strong>Privacy Policy:</strong> <a href="https://www.twilio.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">https://www.twilio.com/legal/privacy</a><br />
                  <strong>Opt-Out:</strong> You can use authenticator app-based MFA instead of SMS.
                </p>
              </div>

              <div className="border-l-4 border-indigo-500 pl-4">
                <h3 className="font-semibold text-gray-800">Supabase (Database & Authentication)</h3>
                <p className="text-gray-700 text-sm mt-1">
                  <strong>Purpose:</strong> Hosting, database management, user authentication, and cloud storage<br />
                  <strong>Data Shared:</strong> All user data, encrypted at rest and in transit<br />
                  <strong>Privacy Policy:</strong> <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">https://supabase.com/privacy</a>
                </p>
              </div>

              <div className="border-l-4 border-pink-500 pl-4">
                <h3 className="font-semibold text-gray-800">Meta (Facebook) Pixel</h3>
                <p className="text-gray-700 text-sm mt-1">
                  <strong>Purpose:</strong> Advertising analytics, retargeting, and conversion tracking<br />
                  <strong>Data Shared:</strong> Browsing behavior, page views, email submissions (hashed)<br />
                  <strong>Privacy Policy:</strong> <a href="https://www.facebook.com/privacy/policy" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">https://www.facebook.com/privacy/policy</a><br />
                  <strong>Opt-Out:</strong> Disable cookies in your browser or visit <a href="https://www.facebook.com/ads/preferences" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Facebook Ad Preferences</a>
                </p>
              </div>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">4. Data Security & Encryption</h2>
            <p className="text-gray-700 mb-4">
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Encryption:</strong> All data in transit uses TLS 1.2+ encryption; data at rest is encrypted using AES-256</li>
              <li><strong>Payment Security:</strong> Fortis is PCI-DSS Level 1 compliant; we never store full card details</li>
              <li><strong>Bank Data:</strong> Bank information is tokenized and encrypted by Plaid and Moov; we do not store raw bank credentials</li>
              <li><strong>MFA:</strong> Multi-factor authentication available via SMS (Twilio) or TOTP authenticator apps</li>
              <li><strong>Access Controls:</strong> Role-based access, principle of least privilege, regular security audits</li>
              <li><strong>Monitoring:</strong> Real-time fraud detection, rate limiting, and automated threat response</li>
            </ul>
            <p className="text-gray-700 mt-4">
              <strong>Important:</strong> No method of transmission over the internet is 100% secure. While we strive to protect 
              your data, we cannot guarantee absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">5. Data Retention</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Active Accounts:</strong> Data retained while your account is active</li>
              <li><strong>Deleted Accounts:</strong> Personal data deleted within 30 days, except as required for legal/tax purposes</li>
              <li><strong>Transaction Records:</strong> Financial records retained for 7 years per IRS requirements</li>
              <li><strong>SMS Codes:</strong> Twilio SMS codes auto-expire after 10 minutes and are permanently deleted after 30 days</li>
              <li><strong>Payment Data:</strong> Fortis retains tokenized payment data per card network rules</li>
              <li><strong>Backup Data:</strong> Encrypted backups retained for 90 days for disaster recovery</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">6. Cookies & Tracking Technologies</h2>
            <p className="text-gray-700 mb-4">We use the following types of cookies and tracking technologies:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Essential Cookies:</strong> Required for authentication, session management, and security</li>
              <li><strong>Analytics Cookies:</strong> Google Analytics, Supabase Analytics (anonymized usage data)</li>
              <li><strong>Advertising Cookies:</strong> Meta Pixel for retargeting and conversion tracking</li>
              <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
            </ul>
            <p className="text-gray-700 mt-4">
              <strong>Cookie Control:</strong> You can disable cookies in your browser settings. However, this may limit 
              functionality. To opt out of targeted advertising, visit <a href="http://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">www.aboutads.info/choices</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">7. Your Privacy Rights</h2>
            <p className="text-gray-700 mb-4">Depending on your location, you may have the following rights:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li><strong>Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data ("right to be forgotten")</li>
              <li><strong>Data Portability:</strong> Receive your data in a machine-readable format</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing emails, disable SMS MFA, opt out of targeted ads</li>
              <li><strong>Restrict Processing:</strong> Limit how we process your data in certain circumstances</li>
              <li><strong>Object:</strong> Object to processing based on legitimate interests</li>
            </ul>
            <p className="text-gray-700 mt-4">
              To exercise these rights, contact us at <a href="mailto:privacy@shoutout.us" className="text-primary-600 hover:underline">privacy@shoutout.us</a>. 
              We will respond within 30 days.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">8. California Privacy Rights (CCPA)</h2>
            <p className="text-gray-700 mb-4">
              If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 ml-4">
              <li>Right to know what personal information is collected, used, shared, or sold</li>
              <li>Right to delete personal information (subject to legal exceptions)</li>
              <li>Right to opt-out of the "sale" of personal information (we do not sell your data)</li>
              <li>Right to non-discrimination for exercising your CCPA rights</li>
            </ul>
            <p className="text-gray-700 mt-4">
              <strong>Note:</strong> We do not sell personal information as defined by CCPA. Meta Pixel usage may constitute 
              "sharing" for targeted advertising; you can opt out via <a href="https://www.facebook.com/ads/preferences" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Facebook Ad Preferences</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">9. Children's Privacy</h2>
            <p className="text-gray-700">
              ShoutOut is not intended for users under the age of 13 (or 16 in the EU). We do not knowingly collect 
              personal information from children. If we discover that we have collected data from a child, we will 
              delete it immediately. Parents or guardians who believe their child has provided us with information 
              should contact us at <a href="mailto:privacy@shoutout.us" className="text-primary-600 hover:underline">privacy@shoutout.us</a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">10. International Data Transfers</h2>
            <p className="text-gray-700">
              Our Services are hosted in the United States. If you access our platform from outside the U.S., your 
              data may be transferred to and processed in the U.S., which may have different data protection laws. 
              By using our Services, you consent to this transfer. We use standard contractual clauses (SCCs) and 
              ensure our third-party providers comply with GDPR and other applicable regulations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">11. Changes to This Privacy Policy</h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. We will notify you of material changes by posting 
              the updated policy on this page and updating the "Last Updated" date. For significant changes, we may 
              also send you an email notification. Your continued use of our Services after changes constitutes 
              acceptance of the updated policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">12. Contact Us</h2>
            <p className="text-gray-700">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, 
              please contact us:
            </p>
            <div className="mt-4 ml-4 text-gray-700">
              <strong>ShoutOut</strong><br />
              Email: <a href="mailto:privacy@shoutout.us" className="text-primary-600 hover:underline">privacy@shoutout.us</a><br />
              Support: <a href="mailto:support@shoutout.us" className="text-primary-600 hover:underline">support@shoutout.us</a><br />
              Website: <a href="https://shoutout.us" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">https://shoutout.us</a>
            </div>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">13. Third-Party Links</h2>
            <p className="text-gray-700">
              Our Services may contain links to third-party websites and services (e.g., talent social media profiles). 
              We are not responsible for the privacy practices of these third parties. We encourage you to review their 
              privacy policies before providing any personal information.
            </p>
          </section>

          <div className="mt-12 p-6 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">
              <strong>Acknowledgment:</strong> By using ShoutOut, you acknowledge that you have read, understood, and 
              agree to be bound by this Privacy Policy and our Terms of Service.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
