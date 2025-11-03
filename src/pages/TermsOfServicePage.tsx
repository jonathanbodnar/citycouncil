import React from 'react';

const TermsOfServicePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        <div className="prose max-w-none">
          <p className="text-gray-600 mb-6">
            <strong>Last updated:</strong> {new Date().toLocaleDateString()}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Acceptance of Terms</h2>
            <p className="text-gray-700">
              By accessing and using ShoutOut, you accept and agree to be bound by the terms 
              and provision of this agreement.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Description</h2>
            <p className="text-gray-700 mb-4">
              ShoutOut is a platform that connects customers with conservative talent to create 
              personalized video messages. We facilitate:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Custom video message orders</li>
              <li>Secure payment processing</li>
              <li>Content delivery and sharing</li>
              <li>Customer support services</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">User Responsibilities</h2>
            <p className="text-gray-700 mb-4">Users agree to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Use the platform for lawful purposes only</li>
              <li>Respect intellectual property rights</li>
              <li>Not engage in harassment or inappropriate behavior</li>
              <li>Pay for services as agreed</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Talent Obligations</h2>
            <p className="text-gray-700 mb-4">Talent users agree to:</p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Deliver videos within the specified timeframe</li>
              <li>Create original, appropriate content</li>
              <li>Maintain professional standards</li>
              <li>Respond to customer requests promptly</li>
              <li>Comply with platform guidelines</li>
              <li>Own all rights to images, videos, and content they upload to the platform, or have explicit permission to use such content</li>
              <li>Indemnify ShoutOut against any claims arising from unauthorized use of copyrighted or trademarked materials in their uploads</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment and Refunds</h2>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>All payments are processed securely through Stripe</li>
              <li>We offer a 100% money-back satisfaction guarantee</li>
              <li>Refunds are processed within 5-7 business days</li>
              <li>Orders not delivered on time are eligible for automatic refunds</li>
              <li>Platform fees apply to all transactions</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Content Rights</h2>
            <p className="text-gray-700">
              Customers receive personal use rights to their commissioned videos. Talent retains 
              ownership of their likeness and performance. Commercial use requires separate agreement.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
            <p className="text-gray-700">
              ShoutOut is not liable for any indirect, incidental, special, or consequential damages 
              arising from the use of our platform or services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Information</h2>
            <p className="text-gray-700">
              For questions about these Terms of Service, contact us at:
              <br />
              Email: <a href="mailto:legal@shoutout.com" className="text-primary-600 hover:text-primary-700">legal@shoutout.com</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default TermsOfServicePage;
