import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import { supabase } from '../services/supabase';

interface TalentProfile {
  id: string;
  username?: string;
  full_name?: string;
}

const PrivacyPolicy: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const [talentProfile, setTalentProfile] = useState<TalentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTalent = async () => {
      if (!username) {
        setLoading(false);
        return;
      }

      try {
        // Try to find by username first, then by ID, including user data for fallback name
        let { data: profile } = await supabase
          .from('talent_profiles')
          .select(`
            id, 
            username, 
            full_name,
            users!talent_profiles_user_id_fkey (
              full_name
            )
          `)
          .eq('username', username)
          .single();

        if (!profile) {
          const { data: profileById } = await supabase
            .from('talent_profiles')
            .select(`
              id, 
              username, 
              full_name,
              users!talent_profiles_user_id_fkey (
                full_name
              )
            `)
            .eq('id', username)
            .single();
          profile = profileById;
        }

        setTalentProfile(profile);
      } catch (error) {
        console.error('Error fetching talent:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTalent();
  }, [username]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const userName = (talentProfile as any)?.users?.full_name;
  const displayName = talentProfile?.full_name || userName || 'Creator';
  const currentDate = new Date().toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-300">
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Back Link */}
        <Link 
          to={`/${username}`}
          className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to {displayName}'s page
        </Link>

        {/* Header */}
        <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: {currentDate}</p>

        {/* Content */}
        <div className="space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Introduction</h2>
            <p>
              This Privacy Policy explains how {displayName} ("we", "us", or "our") collects, uses, 
              and protects your personal information when you subscribe to our newsletter through 
              this bio page hosted on ShoutOut Bio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Information We Collect</h2>
            <p className="mb-3">When you subscribe to our newsletter, we collect:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Your email address</li>
              <li>The date and time of your subscription</li>
              <li>Your interaction with our emails (opens, clicks)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">How We Use Your Information</h2>
            <p className="mb-3">We use your email address to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Send you our newsletter with updates, content, and announcements</li>
              <li>Notify you about new content, products, or services</li>
              <li>Respond to your inquiries or requests</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Email Service Providers</h2>
            <p>
              We may use third-party email service providers (such as Mailchimp, GetResponse, 
              Flodesk, or similar services) to manage our newsletter subscriptions and send emails. 
              These providers have their own privacy policies governing the use of your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Data Protection</h2>
            <p>
              We take reasonable measures to protect your personal information from unauthorized 
              access, use, or disclosure. However, no method of transmission over the Internet 
              or electronic storage is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Unsubscribe from our newsletter at any time using the link in our emails</li>
              <li>Request access to the personal information we hold about you</li>
              <li>Request deletion of your personal information</li>
              <li>Withdraw your consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Cookies and Tracking</h2>
            <p>
              Our emails may contain tracking pixels that help us understand how you interact 
              with our content. This information is used to improve our communications and 
              provide you with more relevant content.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. Any changes will be posted 
              on this page with an updated revision date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">Contact</h2>
            <p>
              If you have any questions about this Privacy Policy or how we handle your data, 
              please reach out through our main profile page or social media channels.
            </p>
          </section>

          <section className="pt-8 border-t border-white/10">
            <p className="text-gray-500 text-sm">
              This bio page is powered by{' '}
              <a 
                href="https://shoutout.us" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                ShoutOut
              </a>
              . For questions about the platform itself, please visit{' '}
              <a 
                href="https://shoutout.us/privacy" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300"
              >
                ShoutOut's Privacy Policy
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;




