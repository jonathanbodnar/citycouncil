import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ShoppingBagIcon,
  TicketIcon,
  UserPlusIcon,
  VideoCameraIcon
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

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-purple-600/10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6">
              The only <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">free-speech, commerce-ready</span> bio link that helps you secure your uncancellable audience.
            </h1>
            <p className="text-xl sm:text-2xl text-gray-300 max-w-3xl mx-auto leading-relaxed mb-8">
              Our mission at ShoutOut is to empower free-speech creators through richer experiences for their audience.
            </p>
            
            {/* Badge Section */}
            <div className="flex flex-wrap justify-center gap-3 mb-8">
              <span className="px-4 py-2 bg-blue-500/20 border border-blue-400/50 rounded-full text-blue-300 font-medium">
                Security
              </span>
              <span className="px-4 py-2 bg-purple-500/20 border border-purple-400/50 rounded-full text-purple-300 font-medium">
                Simplicity
              </span>
              <span className="px-4 py-2 bg-pink-500/20 border border-pink-400/50 rounded-full text-pink-300 font-medium">
                Sovereignty
              </span>
            </div>

            <div className="max-w-3xl mx-auto">
              <p className="text-lg text-gray-300 leading-relaxed mb-4">
                Your link in bio is one of the most powerful tools you have as a creator. Use it wisely.
              </p>
              <p className="text-lg text-gray-300 leading-relaxed">
                Best part? We already built it for you. If you are a creator on ShoutOut, you have a <strong className="text-white">Shout.bio</strong> pre-built and pre-integrated. No additional setup required.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Own Your Audience Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="glass rounded-2xl p-8 sm:p-12 shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6 text-center">
            Own your audience.
          </h2>
          <div className="prose prose-lg prose-invert max-w-none">
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              Social platforms only show your posts to <strong className="text-white">~2.6% of your followers</strong>. Your hard earned audience is being stolen.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed mb-6">
              <strong className="text-white">Shout.bio</strong> turns followers into an owned audience—fast.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed mb-8">
              Creators using shout.bio convert <strong className="text-white">~6% of profile views</strong> into instantly reachable fans, all on auto pilot.
            </p>
            <p className="text-gray-300 text-lg leading-relaxed">
              Send updates directly from your dashboard—without clunky tools like Mailchimp.
            </p>
          </div>

          {/* Badge */}
          <div className="mt-8 p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-400/50 rounded-xl">
            <p className="text-green-300 font-semibold text-center">
              ✨ Plus we build your fan list FOR you! Driving users on shoutout to subscribe to your list.
            </p>
          </div>

          {/* Placeholder for image */}
          <div className="mt-12 rounded-xl overflow-hidden bg-gray-800/50 border border-white/10">
            <div className="aspect-video flex items-center justify-center">
              <p className="text-gray-400 text-lg">[Image Placeholder: Audience Growth Visualization]</p>
            </div>
          </div>
        </div>
      </div>

      {/* Services Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Fuel your platform's growth
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Through simple, easy to use, services already integrated into your ShoutOut profile.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div 
                key={index}
                className="glass rounded-xl p-6 hover:glass-strong transition-all duration-300 hover:transform hover:scale-105"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mb-4">
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
          <p className="text-lg text-gray-300 mb-4">
            …all with <strong className="text-white">zero effort</strong>.
          </p>
        </div>

        {/* Placeholder for service images */}
        <div className="mt-12 grid md:grid-cols-2 gap-6">
          <div className="rounded-xl overflow-hidden bg-gray-800/50 border border-white/10">
            <div className="aspect-video flex items-center justify-center">
              <p className="text-gray-400 text-sm">[Image Placeholder: Service Example 1]</p>
            </div>
          </div>
          <div className="rounded-xl overflow-hidden bg-gray-800/50 border border-white/10">
            <div className="aspect-video flex items-center justify-center">
              <p className="text-gray-400 text-sm">[Image Placeholder: Service Example 2]</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 mb-16">
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 sm:p-12 text-center shadow-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Ready to Own Your Audience?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join ShoutOut as a creator and get your Shout.bio link automatically set up and ready to go.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/onboard"
              className="inline-block px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-lg"
            >
              Apply as Creator
            </Link>
            <Link
              to="/"
              className="inline-block px-8 py-4 bg-transparent text-white font-semibold rounded-lg border-2 border-white hover:bg-white/10 transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

