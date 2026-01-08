import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingBagIcon,
  TicketIcon,
  UserPlusIcon,
  VideoCameraIcon,
  ShieldCheckIcon,
  ChartBarIcon,
  BoltIcon,
  EnvelopeIcon
} from '@heroicons/react/24/outline';

export default function CreatorsPage() {
  useEffect(() => {
    // Update page title and meta description
    document.title = 'For Creators - ShoutOut Bio Link Platform';
    
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'The only free-speech, commerce-ready bio link that helps you secure your uncancellable audience. Shout.bio turns followers into an owned audience—fast.'
      );
    }

    return () => {
      document.title = 'ShoutOut';
    };
  }, []);

  const services = [
    {
      icon: ShoppingBagIcon,
      title: 'Sell merch',
      description: 'Monetize your audience with custom merchandise directly from your bio link.'
    },
    {
      icon: TicketIcon,
      title: 'Sell tickets',
      description: 'Sell event tickets and access passes seamlessly through your bio.'
    },
    {
      icon: UserPlusIcon,
      title: 'Sell social collaborations',
      description: 'Connect with brands and manage collaboration opportunities all in one place.'
    },
    {
      icon: VideoCameraIcon,
      title: 'Sell ShoutOut orders',
      description: 'Accept personalized video message orders directly from your bio link.'
    }
  ];

  const features = [
    {
      icon: ShieldCheckIcon,
      title: 'Security',
      description: 'Your data and audience are protected with enterprise-grade security.'
    },
    {
      icon: BoltIcon,
      title: 'Simplicity',
      description: 'Pre-built and pre-integrated. No additional setup required.'
    },
    {
      icon: ChartBarIcon,
      title: 'Sovereignty',
      description: 'Own your audience data and grow without platform restrictions.'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-b from-gray-900 via-gray-900 to-gray-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent)]" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 sm:pt-32 sm:pb-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Text Content */}
            <div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                The only <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400">free-speech, commerce-ready</span> bio link that helps you secure your uncancellable audience.
              </h1>
              <p className="text-xl sm:text-2xl text-gray-300 leading-relaxed mb-8">
                Our mission at ShoutOut is to empower free-speech creators through richer experiences for their audience.
              </p>
              
              {/* Badge Section */}
              <div className="flex flex-wrap gap-3 mb-8">
                <span className="px-5 py-2.5 bg-blue-500/10 border border-blue-400/30 rounded-full text-blue-300 font-medium text-sm backdrop-blur-sm">
                  Security
                </span>
                <span className="px-5 py-2.5 bg-purple-500/10 border border-purple-400/30 rounded-full text-purple-300 font-medium text-sm backdrop-blur-sm">
                  Simplicity
                </span>
                <span className="px-5 py-2.5 bg-pink-500/10 border border-pink-400/30 rounded-full text-pink-300 font-medium text-sm backdrop-blur-sm">
                  Sovereignty
                </span>
              </div>

              <div className="mb-8">
                <p className="text-lg sm:text-xl text-gray-300 leading-relaxed mb-4">
                  Your link in bio is one of the most powerful tools you have as a creator. Use it wisely.
                </p>
                <p className="text-lg sm:text-xl text-gray-300 leading-relaxed">
                  Best part? We already built it for you. If you are a creator on ShoutOut, you have a <strong className="text-white font-semibold">Shout.bio</strong> pre-built and pre-integrated. No additional setup required.
                </p>
              </div>

              {/* CTA Button */}
              <div className="mt-8">
                <Link
                  to="/onboard"
                  className="inline-block px-8 py-4 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
                >
                  Start for free
                </Link>
              </div>
            </div>

            {/* Right Column - Example Images */}
            <div className="relative">
              <div className="grid grid-cols-3 gap-4">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                  <div className="relative bg-gray-800 rounded-2xl overflow-hidden border border-gray-700/50">
                    <img 
                      src="/creatorbios/JP.png" 
                      alt="JP Bio Example" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
                <div className="relative group mt-8">
                  <div className="absolute -inset-1 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                  <div className="relative bg-gray-800 rounded-2xl overflow-hidden border border-gray-700/50">
                    <img 
                      src="/creatorbios/Lydia.png" 
                      alt="Lydia Bio Example" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
                <div className="relative group mt-4">
                  <div className="absolute -inset-1 bg-gradient-to-r from-pink-500 to-red-500 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-300"></div>
                  <div className="relative bg-gray-800 rounded-2xl overflow-hidden border border-gray-700/50">
                    <img 
                      src="/creatorbios/Melonie.png" 
                      alt="Melonie Bio Example" 
                      className="w-full h-auto object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div 
                key={index}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mb-6">
                  <Icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">
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

      {/* Own Your Audience Section */}
      <div className="bg-gray-800/30 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Own your audience.
              </h2>
              <div className="space-y-6">
                <p className="text-lg text-gray-300 leading-relaxed">
                  Social platforms only show your posts to <strong className="text-white font-semibold">~2.6% of your followers</strong>. Your hard earned audience is being stolen.
                </p>
                <p className="text-lg text-gray-300 leading-relaxed">
                  <strong className="text-white font-semibold">Shout.bio</strong> turns followers into an owned audience—fast.
                </p>
                <p className="text-lg text-gray-300 leading-relaxed">
                  Creators using shout.bio convert <strong className="text-white font-semibold">~6% of profile views</strong> into instantly reachable fans, all on auto pilot.
                </p>
                <p className="text-lg text-gray-300 leading-relaxed">
                  Send updates directly from your dashboard—without clunky tools like Mailchimp.
                </p>
              </div>

              {/* Badge */}
              <div className="mt-8 p-5 bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-400/30 rounded-xl backdrop-blur-sm">
                <p className="text-green-300 font-semibold flex items-center gap-2">
                  <span className="text-xl">✨</span>
                  <span>Plus we build your fan list FOR you! Driving users on shoutout to subscribe to your list.</span>
                </p>
              </div>
            </div>

            {/* Placeholder for image */}
            <div className="rounded-2xl overflow-hidden bg-gray-800/50 border border-gray-700/50">
              <div className="aspect-[4/3] flex items-center justify-center">
                <p className="text-gray-500 text-center px-4">[Image Placeholder: Audience Growth Visualization]</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
            Fuel your platform's growth
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Through simple, easy to use, services already integrated into your ShoutOut profile.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div 
                key={index}
                className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50 hover:border-gray-600/50 transition-all duration-300 hover:transform hover:scale-105"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {service.title}
                </h3>
                <p className="text-gray-400 leading-relaxed text-sm">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <p className="text-xl text-gray-300">
            …all with <strong className="text-white font-semibold">zero effort</strong>.
          </p>
        </div>

        {/* Placeholder for service images */}
        <div className="mt-16 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl overflow-hidden bg-gray-800/50 border border-gray-700/50">
            <div className="aspect-video flex items-center justify-center">
              <p className="text-gray-500 text-sm">[Image Placeholder: Service Example 1]</p>
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden bg-gray-800/50 border border-gray-700/50">
            <div className="aspect-video flex items-center justify-center">
              <p className="text-gray-500 text-sm">[Image Placeholder: Service Example 2]</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="bg-gray-800/30 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 mb-2">
                ~6%
              </div>
              <div className="text-gray-400 text-sm sm:text-base">Conversion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 mb-2">
                100%
              </div>
              <div className="text-gray-400 text-sm sm:text-base">Owned Audience</div>
            </div>
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-red-400 mb-2">
                0
              </div>
              <div className="text-gray-400 text-sm sm:text-base">Setup Required</div>
            </div>
            <div className="text-center">
              <div className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400 mb-2">
                ∞
              </div>
              <div className="text-gray-400 text-sm sm:text-base">Free Speech</div>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-3xl p-12 sm:p-16 text-center shadow-2xl">
          <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
            Ready to Own Your Audience?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join ShoutOut as a creator and get your Shout.bio link automatically set up and ready to go.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/onboard"
              className="inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-all duration-200 shadow-lg hover:shadow-xl text-lg"
            >
              Apply as Creator
            </Link>
            <Link
              to="/"
              className="inline-block px-8 py-4 bg-transparent text-white font-semibold rounded-lg border-2 border-white hover:bg-white/10 transition-all duration-200 text-lg"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
