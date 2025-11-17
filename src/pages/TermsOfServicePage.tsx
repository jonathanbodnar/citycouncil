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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Independent Contractor Relationship</h2>
            <p className="text-gray-700 mb-4">
              <strong>All talent on the ShoutOut platform are independent contractors (1099).</strong> 
              Talent are NOT employees, agents, or representatives of ShoutOut. This independent contractor 
              relationship means:
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Talent operate their own independent businesses and set their own pricing</li>
              <li>Talent are responsible for their own taxes, insurance, and business operations</li>
              <li>Talent have no authority to bind ShoutOut to any agreements or obligations</li>
              <li>Talent do not receive employee benefits from ShoutOut</li>
              <li>The relationship is solely for the purpose of facilitating video message services through the platform</li>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Processing and Platform Responsibility</h2>
            <p className="text-gray-700 mb-4">
              <strong>ShoutOut is solely responsible for all payment processing, refunds, disputes, and payment-related issues.</strong>
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>All payments are processed securely through ShoutOut's payment processor</li>
              <li>ShoutOut collects payment from customers and distributes earnings to talent according to the payout schedule</li>
              <li>ShoutOut handles all payment disputes, chargebacks, and fraud prevention</li>
              <li>Talent are NOT responsible for payment processing, refunds, or payment-related customer service issues</li>
              <li>Talent will receive their earnings regardless of any refunds issued by ShoutOut</li>
            </ul>
            
            <h3 className="text-lg font-semibold text-gray-900 mb-3 mt-6">Refund Policy</h3>
            <ul className="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>We offer a 100% money-back satisfaction guarantee</li>
              <li>Refunds are processed by ShoutOut within 5-7 business days</li>
              <li>Orders not delivered on time are eligible for automatic refunds at ShoutOut's discretion</li>
              <li>All refund decisions are made solely by ShoutOut, not by talent</li>
              <li>Platform fees apply to all transactions</li>
            </ul>

            <p className="text-gray-700 mb-2">
              <strong>Platform Issues and Service Delivery:</strong>
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>ShoutOut is responsible for platform bugs, technical issues, and service interruptions</li>
              <li>Talent are NOT liable for platform malfunctions, payment processing errors, or undelivered services caused by platform issues</li>
              <li>ShoutOut manages all customer service inquiries related to orders, payments, refunds, and technical support</li>
              <li>Customers should contact ShoutOut support for any issues—talent are not responsible for resolving platform-related problems</li>
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
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Limitation of Talent Liability</h2>
            <p className="text-gray-700 mb-4">
              <strong>Talent on the ShoutOut platform are NOT responsible for:</strong>
            </p>
            <ul className="list-disc list-inside text-gray-700 space-y-2">
              <li>Payment processing issues, failed transactions, or billing errors</li>
              <li>Refund requests, refund processing, or refund-related disputes</li>
              <li>Platform bugs, technical malfunctions, or service interruptions</li>
              <li>Customer service issues related to payments, orders, or platform functionality</li>
              <li>Chargebacks, payment disputes, or fraud prevention</li>
              <li>Undelivered services caused by platform technical issues or payment processing failures</li>
              <li>Any actions, decisions, or policies implemented by ShoutOut</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Talent's sole obligation is to create and deliver video content as requested, provided payment 
              has been successfully processed by ShoutOut. All other responsibilities rest with ShoutOut as 
              the platform operator.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Limitation of Platform Liability</h2>
            <p className="text-gray-700">
              ShoutOut is not liable for any indirect, incidental, special, or consequential damages 
              arising from the use of our platform or services. However, ShoutOut maintains full responsibility 
              for payment processing, refunds, and platform-related technical issues as outlined in this agreement.
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
