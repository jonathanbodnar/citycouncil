import React from 'react';

const CommunityGuidelinesPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Community Guidelines</h1>
        <div className="prose max-w-none">
          <p className="text-gray-600 mb-6">
            <strong>Last updated:</strong> {new Date().toLocaleDateString()}
          </p>

          <p className="text-gray-700 mb-8">
            ShoutOut is a platform that connects fans with their favorite conservative personalities 
            through personalized video messages. These guidelines help ensure a positive, respectful, 
            and safe experience for everyone in our community—customers, talent, and staff alike.
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">For Customers</h2>
            
            <h3 className="text-lg font-medium text-gray-800 mb-3">Ordering Guidelines</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Provide clear, respectful instructions for your video request</li>
              <li>Use appropriate language in your order details and recipient information</li>
              <li>Do not request content that is illegal, hateful, harassing, or sexually explicit</li>
              <li>Do not impersonate others or provide false information</li>
              <li>Respect the talent's right to decline requests they find inappropriate</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">Prohibited Content in Requests</h3>
            <p className="text-gray-700 mb-2">You may not request videos that:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Contain hate speech, threats, or harassment toward any individual or group</li>
              <li>Promote violence or illegal activities</li>
              <li>Include sexually explicit or pornographic content</li>
              <li>Defame, slander, or libel any person</li>
              <li>Infringe on intellectual property rights</li>
              <li>Are intended to embarrass, humiliate, or harm the recipient</li>
              <li>Contain false claims presented as endorsements</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">Using Your Video</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Videos are for personal, non-commercial use unless otherwise agreed</li>
              <li>Do not edit videos to misrepresent the talent's words or intent</li>
              <li>Do not use videos for commercial advertising without explicit permission</li>
              <li>Respect the talent's likeness and reputation when sharing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">For Talent</h2>
            
            <h3 className="text-lg font-medium text-gray-800 mb-3">Content Standards</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Create original, high-quality video content</li>
              <li>Deliver videos within your stated fulfillment timeframe</li>
              <li>Be professional and respectful in all communications</li>
              <li>Only use images, music, and content you own or have rights to use</li>
              <li>Do not include content that violates laws or platform policies</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-3">Right to Decline</h3>
            <p className="text-gray-700 mb-4">
              Talent have the right to decline any request that makes them uncomfortable or 
              that they believe violates these guidelines. If you decline a request, the customer 
              will receive a full refund.
            </p>

            <h3 className="text-lg font-medium text-gray-800 mb-3">Profile Accuracy</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Maintain accurate and up-to-date profile information</li>
              <li>Use authentic photos and videos that represent you</li>
              <li>Set realistic fulfillment times you can consistently meet</li>
              <li>Keep your availability status current</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Prohibited Conduct</h2>
            <p className="text-gray-700 mb-4">The following is prohibited for all users:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li><strong>Harassment:</strong> Bullying, intimidation, or persistent unwanted contact</li>
              <li><strong>Hate Speech:</strong> Content that attacks people based on race, ethnicity, religion, gender, sexual orientation, disability, or national origin</li>
              <li><strong>Impersonation:</strong> Pretending to be another person or entity</li>
              <li><strong>Fraud:</strong> Deceptive practices, scams, or misrepresentation</li>
              <li><strong>Spam:</strong> Unsolicited bulk messages or promotional content</li>
              <li><strong>Illegal Activity:</strong> Any content or conduct that violates applicable laws</li>
              <li><strong>Platform Manipulation:</strong> Creating fake accounts, fake reviews, or gaming the system</li>
              <li><strong>Circumventing Payments:</strong> Attempting to conduct transactions outside the platform</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Privacy & Safety</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Do not share personal contact information (phone numbers, addresses, social media) through the platform</li>
              <li>Do not request or share private information about third parties without consent</li>
              <li>Report any suspicious activity or safety concerns to our support team</li>
              <li>Protect your account credentials and do not share login information</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Intellectual Property</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Respect copyrights, trademarks, and other intellectual property rights</li>
              <li>Do not upload content you don't have rights to use</li>
              <li>Videos created on ShoutOut remain the intellectual property of the talent, with a license granted to the customer for personal use</li>
              <li>Report any suspected intellectual property violations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Enforcement</h2>
            <p className="text-gray-700 mb-4">
              Violations of these guidelines may result in:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>Warning and request to modify behavior</li>
              <li>Temporary suspension of account</li>
              <li>Permanent removal from the platform</li>
              <li>Forfeiture of pending payouts (for talent)</li>
              <li>Legal action where appropriate</li>
            </ul>
            <p className="text-gray-700">
              We reserve the right to remove any content and terminate any account at our discretion 
              if we believe these guidelines have been violated.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Reporting Violations</h2>
            <p className="text-gray-700 mb-4">
              If you encounter content or behavior that violates these guidelines, please report it 
              immediately through our Help & Support page or by emailing{' '}
              <a href="mailto:support@shoutout.us" className="text-blue-600 hover:text-blue-800">
                support@shoutout.us
              </a>
              . We take all reports seriously and will investigate promptly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Changes to Guidelines</h2>
            <p className="text-gray-700">
              We may update these Community Guidelines from time to time. Continued use of the 
              platform after changes are posted constitutes acceptance of the updated guidelines. 
              We encourage you to review these guidelines periodically.
            </p>
          </section>

          <section className="mt-12 p-6 bg-gray-50 rounded-lg">
            <p className="text-gray-700 text-center">
              <strong>Questions?</strong> Visit our{' '}
              <a href="/help" className="text-blue-600 hover:text-blue-800">Help & Support</a>{' '}
              page or email us at{' '}
              <a href="mailto:support@shoutout.us" className="text-blue-600 hover:text-blue-800">
                support@shoutout.us
              </a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default CommunityGuidelinesPage;

