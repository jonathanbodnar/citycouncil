import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  SparklesIcon, 
  HeartIcon, 
  ShieldCheckIcon,
  UserGroupIcon,
  VideoCameraIcon,
  StarIcon
} from '@heroicons/react/24/outline';

export default function AboutPage() {
  useEffect(() => {
    // Update page title and meta description
    document.title = 'About ShoutOut - Free-Speech & Faith-Based Video Messages';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'ShoutOut connects you with free-speech voices, faith leaders, patriots, and influencers for personalized video messages. Celebrate special moments with meaningful shoutouts from your favorite personalities.'
      );
    }

    // Add structured data for SEO
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "Organization",
      "name": "ShoutOut",
      "url": "https://shoutout.us",
      "logo": "https://shoutout.us/logo.png",
      "description": "Platform connecting fans with free-speech voices, faith leaders, and patriots for personalized video messages",
      "sameAs": [
        "https://twitter.com/shoutoutus",
        "https://facebook.com/shoutoutus"
      ]
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
      document.title = 'ShoutOut';
    };
  }, []);

  const features = [
    {
      icon: VideoCameraIcon,
      title: 'Personalized Video Messages',
      description: 'Get custom video shoutouts from your favorite free-speech voices, faith leaders, and patriots for birthdays, encouragement, or just because.'
    },
    {
      icon: UserGroupIcon,
      title: 'Diverse Talent Network',
      description: 'Connect with political commentators, pastors, athletes, business leaders, and entertainers who share your values and beliefs.'
    },
    {
      icon: ShieldCheckIcon,
      title: 'Safe & Secure Platform',
      description: 'Your privacy and security matter. We use bank-level encryption and secure payment processing to protect your information.'
    },
    {
      icon: HeartIcon,
      title: 'Meaningful Connections',
      description: 'Create lasting memories with heartfelt messages from personalities who inspire and uplift. Perfect for gifts that truly matter.'
    },
    {
      icon: SparklesIcon,
      title: 'Quick Turnaround',
      description: 'Most video shoutouts are delivered within 7 days. Rush delivery available for urgent occasions and celebrations.'
    },
    {
      icon: StarIcon,
      title: 'Quality Guaranteed',
      description: 'If you\'re not satisfied with your video, we\'ll make it right. Your happiness is our priority.'
    }
  ];

  const stats = [
    { label: 'Talent Network', value: '100+' },
    { label: 'Videos Delivered', value: '10,000+' },
    { label: 'Happy Customers', value: '95%' },
    { label: 'Avg. Delivery Time', value: '3 Days' }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              About <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">ShoutOut</span>
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed">
              Connecting fans with the voices they admire for personalized video messages that inspire, encourage, and celebrate life's special moments.
            </p>
          </div>
        </div>
      </div>

      {/* Mission Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass rounded-2xl p-8 sm:p-12 shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 text-center">
            Our Mission
          </h2>
          <div className="prose prose-lg prose-invert max-w-none">
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              In a world where authentic connections are increasingly rare, <strong className="text-white">ShoutOut</strong> bridges 
              the gap between fans and the personalities they admire. We believe that everyone deserves to experience the joy 
              of receiving a personalized message from someone who inspires them.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              Our platform empowers <strong className="text-white">free-speech voices, faith leaders, patriots, athletes, 
              and entertainers</strong> to connect directly with their supporters through meaningful, personalized video messages. 
              Whether it's a birthday surprise, words of encouragement, or a special celebration, ShoutOut makes it possible.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed">
              We're committed to building a community grounded in <strong className="text-white">shared values, mutual respect, 
              and authentic engagement</strong>. Every video on our platform represents a real connection between people who 
              believe in making the world a better place.
            </p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <div 
              key={index}
              className="glass-strong rounded-xl p-6 text-center border border-white/20"
            >
              <div className="text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
                {stat.value}
              </div>
              <div className="text-gray-400 text-sm sm:text-base">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 text-center">
          Why Choose ShoutOut?
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
            <div 
              key={index}
              className="glass rounded-xl p-6 hover:glass-strong transition-all duration-300 hover:transform hover:scale-105"
            >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* How It Works Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass rounded-2xl p-8 sm:p-12 shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 text-center">
            How ShoutOut Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                1
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Choose Your Talent
              </h3>
              <p className="text-gray-400">
                Browse our network of free-speech voices, faith leaders, patriots, and influencers. Find the perfect person for your occasion.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                2
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Request Your Video
              </h3>
              <p className="text-gray-400">
                Tell us who the video is for and what you'd like them to say. Add special instructions or details to make it personal.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
                3
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Receive & Share
              </h3>
              <p className="text-gray-400">
                Get your personalized video within days. Download it, share it, and create a memory that lasts forever.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Values Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-3xl sm:text-4xl font-bold text-white mb-12 text-center">
          Our Values
        </h2>
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="glass rounded-xl p-8">
            <h3 className="text-2xl font-semibold text-white mb-4">
              🇺🇸 Patriotism & Freedom
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We celebrate American values, constitutional principles, and the freedom to express free-speech viewpoints 
              in a marketplace that often silences them. ShoutOut is a platform where these voices thrive.
            </p>
          </div>
          <div className="glass rounded-xl p-8">
            <h3 className="text-2xl font-semibold text-white mb-4">
              ✝️ Faith & Family
            </h3>
            <p className="text-gray-300 leading-relaxed">
              Faith and family are the foundation of our community. We provide a platform for religious leaders, 
              faith-based content creators, and those who prioritize family values to share their messages of hope.
            </p>
          </div>
          <div className="glass rounded-xl p-8">
            <h3 className="text-2xl font-semibold text-white mb-4">
              💼 Integrity & Excellence
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We hold ourselves to the highest standards of integrity in everything we do. From secure payments to 
              quality content, we're committed to delivering excellence in every interaction.
            </p>
          </div>
          <div className="glass rounded-xl p-8">
            <h3 className="text-2xl font-semibold text-white mb-4">
              🤝 Community & Connection
            </h3>
            <p className="text-gray-300 leading-relaxed">
              We're building more than a platform—we're building a community of like-minded individuals who support 
              each other, share common values, and believe in making genuine connections.
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 mb-16">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 sm:p-12 text-center shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Browse our network of talented personalities and order your first personalized video shoutout today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/"
              className="inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Browse Talent
            </Link>
            <Link
              to="/onboard"
              className="inline-block px-8 py-4 bg-transparent text-white font-semibold rounded-lg border-2 border-white hover:bg-white/10 transition-colors"
            >
              Become Talent
            </Link>
          </div>
        </div>
      </div>

      {/* Contact Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 border-t border-gray-800">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Questions? We're Here to Help
          </h2>
          <p className="text-gray-400 mb-6">
            Have questions about ShoutOut or need assistance? Our team is ready to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              to="/help"
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              Visit Help Center →
            </Link>
            <span className="text-gray-600 hidden sm:inline">|</span>
            <a
              href="mailto:support@shoutout.us"
              className="text-blue-400 hover:text-blue-300 font-semibold"
            >
              Email Support →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

